/**
 * API Route: POST /api/admin/auto-verify
 *
 * Automated reserve verification pipeline.
 * Replaces the manual `npm run full-pipeline` terminal workflow.
 *
 * Flow:
 * 1. Authenticate request (webhook secret or admin key)
 * 2. Fetch all serials from Supabase goldback_serials table
 * 3. Compute merkle root from serial hashes (pure JS, no nargo)
 * 4. Submit update_merkle_root to Solana (sets proven_reserves = serial count)
 * 5. Auto-mint W3B tokens if proven_reserves > total_supply
 * 6. Log audit trail to merkle_roots table
 *
 * Triggers:
 * - Supabase Database Webhook on goldback_serials INSERT
 * - Manual "Verify Now" button on dashboard
 */

import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { createClient } from "@supabase/supabase-js";
import { MerkleTree } from "merkletreejs";
import crypto from "crypto";
import { PROTOCOL_CONFIG } from "@/lib/protocol-constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for Solana transactions

/* ─── IDL (minimal for the instructions we need) ─── */

const W3B_IDL = {
  version: "0.1.0",
  name: "w3b_protocol",
  instructions: [
    {
      name: "updateMerkleRoot",
      accounts: [
        { name: "protocolState", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
      ],
      args: [
        { name: "newRoot", type: { array: ["u8", 32] } },
        { name: "totalSerials", type: "u64" },
      ],
    },
    {
      name: "mintW3B",
      accounts: [
        { name: "protocolState", isMut: true, isSigner: false },
        { name: "w3bMint", isMut: true, isSigner: false },
        { name: "treasury", isMut: true, isSigner: false },
        { name: "authority", isMut: false, isSigner: true },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
  ],
  accounts: [
    {
      name: "ProtocolState",
      type: {
        kind: "struct" as const,
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "w3bMint", type: "publicKey" },
          { name: "treasury", type: "publicKey" },
          { name: "currentMerkleRoot", type: { array: ["u8", 32] } },
          { name: "lastRootUpdate", type: "i64" },
          { name: "lastProofTimestamp", type: "i64" },
          { name: "provenReserves", type: "u64" },
          { name: "totalSupply", type: "u64" },
          { name: "isPaused", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  metadata: {
    address: PROTOCOL_CONFIG.programId,
  },
};

/* ─── Helpers ─── */

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_W3B_SUPABASE_URL ||
    "https://jbsasakwyxjbetdezifj.supabase.co";
  // Prefer service role key for admin operations, fallback to anon
  const key =
    process.env.W3B_SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_W3B_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function loadAuthorityKeypair(): Keypair {
  const keypairEnv = process.env.PROTOCOL_AUTHORITY_KEYPAIR;
  if (!keypairEnv) {
    throw new Error(
      "PROTOCOL_AUTHORITY_KEYPAIR env var not set. Provide the authority keypair as a JSON array of bytes."
    );
  }

  try {
    const keypairArray = JSON.parse(keypairEnv);
    return Keypair.fromSecretKey(Uint8Array.from(keypairArray));
  } catch {
    throw new Error(
      "PROTOCOL_AUTHORITY_KEYPAIR must be a JSON array of bytes (e.g., [1,2,3,...,64])"
    );
  }
}

function hashSerial(serial: string): Buffer {
  return crypto.createHash("sha256").update(serial).digest();
}

function authenticateRequest(request: Request): boolean {
  const secret = process.env.ADMIN_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, only allow in development
    console.warn("ADMIN_WEBHOOK_SECRET not set -- allowing request in dev mode");
    return process.env.NODE_ENV === "development";
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Check x-webhook-secret header (for Supabase webhooks)
  const webhookSecret = request.headers.get("x-webhook-secret");
  if (webhookSecret === secret) return true;

  return false;
}

/* ─── Main Handler ─── */

export async function POST(request: Request) {
  const startTime = Date.now();
  const logs: string[] = [];

  function log(msg: string) {
    console.log(`[auto-verify] ${msg}`);
    logs.push(msg);
  }

  try {
    // 1. Authenticate
    if (!authenticateRequest(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    log("Request authenticated");

    // 2. Parse optional body (webhook payload or manual trigger)
    let triggerSource = "manual";
    try {
      const body = await request.json();
      if (body?.type === "INSERT" || body?.record) {
        triggerSource = "supabase_webhook";
      }
    } catch {
      // Empty body is fine for manual triggers
    }
    log(`Trigger source: ${triggerSource}`);

    // 3. Small debounce for webhook triggers (5s wait for bulk inserts)
    if (triggerSource === "supabase_webhook") {
      log("Webhook trigger -- waiting 5s for bulk inserts to settle...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // 4. Fetch all serials from Supabase
    const supabase = getSupabaseAdmin();
    const { data: serials, error: serialsError } = await supabase
      .from("goldback_serials")
      .select("serial_number")
      .order("serial_number");

    if (serialsError) {
      throw new Error(`Supabase error: ${serialsError.message}`);
    }

    if (!serials || serials.length === 0) {
      log("No serials found in database. Nothing to verify.");
      return NextResponse.json({
        success: true,
        message: "No serials to verify",
        data: { totalSerials: 0 },
        logs,
        elapsed: Date.now() - startTime,
      });
    }

    log(`Found ${serials.length} serials in database`);

    // 5. Compute Merkle Root
    const serialStrings = serials.map((s) => s.serial_number);
    const leaves = serialStrings.map(hashSerial);
    const tree = new MerkleTree(
      leaves,
      (data: Buffer) => crypto.createHash("sha256").update(data).digest(),
      { sortPairs: true }
    );

    const rootHex = tree.getHexRoot();
    const rootBytes = tree.getRoot();
    const rootArray = Array.from(rootBytes);

    // Pad to 32 bytes if needed
    while (rootArray.length < 32) rootArray.push(0);

    log(`Merkle root: ${rootHex}`);
    log(`Total leaves: ${serials.length}`);

    // 6. Connect to Solana and submit update_merkle_root
    const rpcEndpoint =
      process.env.NEXT_PUBLIC_RPC_ENDPOINT || PROTOCOL_CONFIG.rpcEndpoint;
    const connection = new Connection(rpcEndpoint, "confirmed");
    const authority = loadAuthorityKeypair();
    const programId = new PublicKey(PROTOCOL_CONFIG.programId);

    log(`RPC: ${rpcEndpoint}`);
    log(`Authority: ${authority.publicKey.toBase58()}`);
    log(`Program: ${programId.toBase58()}`);

    // Setup Anchor
    const wallet = new Wallet(authority);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(provider);

    const program = new Program(W3B_IDL as any, provider);

    // Find PDA
    const [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_state")],
      programId
    );

    // Fetch current state before update
    let currentSupply = 0;
    let currentReserves = 0;
    let w3bMintPubkey: PublicKey | null = null;
    let treasuryPubkey: PublicKey | null = null;

    try {
      const preState = await program.account.protocolState.fetch(
        protocolStatePda
      );
      currentSupply = (preState as any).totalSupply.toNumber();
      currentReserves = (preState as any).provenReserves.toNumber();
      w3bMintPubkey = (preState as any).w3bMint;
      treasuryPubkey = (preState as any).treasury;
      log(
        `Pre-state: supply=${currentSupply}, reserves=${currentReserves}`
      );
    } catch (err) {
      log(`Warning: Could not fetch pre-state: ${err}`);
    }

    // Submit update_merkle_root
    log("Submitting update_merkle_root to Solana...");
    const updateTx = await program.methods
      .updateMerkleRoot(rootArray as number[], new anchor.BN(serials.length))
      .accountsPartial({
        protocolState: protocolStatePda,
        authority: authority.publicKey,
      })
      .rpc();

    log(`Merkle root updated! Tx: ${updateTx}`);

    // 7. Auto-mint if enabled and reserves > supply
    let mintTx: string | null = null;
    const autoMintEnabled =
      process.env.AUTO_MINT_ENABLED !== "false"; // Enabled by default

    if (autoMintEnabled && w3bMintPubkey && treasuryPubkey) {
      const amountToMint = serials.length - currentSupply;
      if (amountToMint > 0) {
        log(`Auto-minting ${amountToMint} W3B tokens...`);
        mintTx = await (program.methods as any)
          .mintW3B(new anchor.BN(amountToMint))
          .accountsPartial({
            protocolState: protocolStatePda,
            w3bMint: w3bMintPubkey,
            treasury: treasuryPubkey,
            authority: authority.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        log(`Minted ${amountToMint} tokens! Tx: ${mintTx}`);
      } else {
        log(
          `No minting needed (supply ${currentSupply} >= serials ${serials.length})`
        );
      }
    } else if (!autoMintEnabled) {
      log("Auto-mint disabled (AUTO_MINT_ENABLED=false)");
    }

    // 8. Log audit trail to merkle_roots table
    log("Logging audit trail to Supabase...");
    const { error: auditError } = await supabase.from("merkle_roots").upsert(
      {
        root_hash: rootHex,
        total_serials: serials.length,
        solana_tx_hash: updateTx,
        status: "confirmed",
      },
      { onConflict: "root_hash" }
    );

    if (auditError) {
      log(`Warning: Failed to log audit: ${auditError.message}`);
    } else {
      log("Audit trail logged");
    }

    // Mark serials as included in this root
    await supabase
      .from("goldback_serials")
      .update({ included_in_root: rootHex })
      .is("included_in_root", null);

    // 9. Fetch final state
    let finalState = null;
    try {
      const postState = await program.account.protocolState.fetch(
        protocolStatePda
      );
      finalState = {
        totalSupply: (postState as any).totalSupply.toNumber(),
        provenReserves: (postState as any).provenReserves.toNumber(),
        lastProofTimestamp: new Date(
          (postState as any).lastRootUpdate.toNumber() * 1000
        ).toISOString(),
        merkleRoot: rootHex,
      };
      log(
        `Final state: supply=${finalState.totalSupply}, reserves=${finalState.provenReserves}`
      );
    } catch {
      log("Warning: Could not fetch post-state");
    }

    const elapsed = Date.now() - startTime;
    log(`Complete in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      message: `Verified ${serials.length} serials on-chain`,
      data: {
        totalSerials: serials.length,
        merkleRoot: rootHex,
        updateTx,
        mintTx,
        finalState,
        triggerSource,
      },
      logs,
      elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`ERROR: ${errorMessage}`);

    console.error("[auto-verify] Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        logs,
        elapsed,
      },
      { status: 500 }
    );
  }
}

/* ─── GET handler for status check ─── */

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/admin/auto-verify",
    method: "POST",
    description:
      "Automated reserve verification pipeline. Send POST with Authorization: Bearer <ADMIN_WEBHOOK_SECRET> to trigger.",
    envVarsRequired: [
      "PROTOCOL_AUTHORITY_KEYPAIR",
      "ADMIN_WEBHOOK_SECRET",
      "AUTO_MINT_ENABLED (optional, default: true)",
    ],
  });
}
