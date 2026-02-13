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
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Program, AnchorProvider, BN, setProvider } from "@coral-xyz/anchor";
import { createClient } from "@supabase/supabase-js";
import { MerkleTree } from "merkletreejs";
import crypto from "crypto";
import { PROTOCOL_CONFIG } from "@/lib/protocol-constants";
import { assertMyAppSecurityEnv, authenticateAutoVerifyRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for Solana transactions

assertMyAppSecurityEnv();

/**
 * Minimal wallet adapter for AnchorProvider (replaces removed anchor.Wallet)
 */
class NodeWallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((tx) => {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer);
      }
      return tx;
    });
  }
}

/* ─── IDL (minimal for the instructions we need) ─── */

const W3B_IDL = {
  address: PROTOCOL_CONFIG.programId,
  metadata: {
    name: "w3b_protocol",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "update_merkle_root",
      discriminator: [195, 173, 38, 60, 242, 203, 158, 93],
      accounts: [
        { name: "protocol_state", writable: true },
        { name: "operator", signer: true },
      ],
      args: [
        { name: "new_root", type: { array: ["u8", 32] } },
        { name: "total_serials", type: "u64" },
      ],
    },
    {
      name: "submit_proof",
      discriminator: [54, 241, 46, 84, 4, 212, 46, 94],
      accounts: [
        { name: "protocol_state", writable: true },
        { name: "operator", signer: true },
      ],
      args: [
        { name: "proof_hash", type: "bytes" },
        { name: "claimed_reserves", type: "u64" },
      ],
    },
    {
      name: "mint_w3b",
      discriminator: [248, 247, 23, 67, 218, 96, 151, 122],
      accounts: [
        { name: "protocol_state", writable: true },
        { name: "w3b_mint", writable: true },
        { name: "treasury", writable: true },
        { name: "token_program" },
        { name: "operator", signer: true },
      ],
      args: [{ name: "amount", type: "u64" }],
    },
  ],
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

interface ProtocolStateSnapshot {
  w3bMint: PublicKey;
  treasury: PublicKey;
  totalSupply: number;
  provenReserves: number;
  lastRootUpdate: number;
}

function parseProtocolStateV2(data: Buffer): ProtocolStateSnapshot {
  if (data.length < 216) {
    throw new Error(`ProtocolState account too small: ${data.length}`);
  }

  const w3bMint = new PublicKey(data.slice(72, 104));
  const treasury = new PublicKey(data.slice(104, 136));
  const totalSupply = Number(new BN(data.subarray(136, 144), "le").toString());
  const provenReserves = Number(new BN(data.subarray(184, 192), "le").toString());
  const lastRootUpdate = Number(new BN(data.subarray(192, 200), "le").toString());

  return {
    w3bMint,
    treasury,
    totalSupply,
    provenReserves,
    lastRootUpdate,
  };
}

async function fetchProtocolStateSnapshot(
  connection: Connection,
  protocolStatePda: PublicKey
): Promise<ProtocolStateSnapshot | null> {
  const accountInfo = await connection.getAccountInfo(protocolStatePda, "confirmed");
  if (!accountInfo) {
    return null;
  }
  return parseProtocolStateV2(accountInfo.data);
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
    // 1. Parse body once (manual trigger payload or webhook payload)
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    // 2. Authenticate (webhook secret OR allowlisted wallet signature)
    const auth = authenticateAutoVerifyRequest(request, body);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.reason || "Unauthorized" },
        { status: 401 }
      );
    }

    log(`Request authenticated via ${auth.method}`);

    // 3. Parse optional body (webhook payload or manual trigger)
    let triggerSource = auth.method === "webhook" ? "supabase_webhook" : "manual";
    if (
      body &&
      typeof body === "object" &&
      ((body as Record<string, unknown>).type === "INSERT" ||
        Boolean((body as Record<string, unknown>).record))
    ) {
      triggerSource = "supabase_webhook";
    }
    log(`Trigger source: ${triggerSource}`);

    // 4. Small debounce for webhook triggers (5s wait for bulk inserts)
    if (triggerSource === "supabase_webhook") {
      log("Webhook trigger -- waiting 5s for bulk inserts to settle...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // 5. Fetch all serials from Supabase
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
    const wallet = new NodeWallet(authority);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    setProvider(provider);

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
    let preStateFetched = false;

    try {
      const preState = await fetchProtocolStateSnapshot(connection, protocolStatePda);
      if (preState) {
        preStateFetched = true;
        currentSupply = preState.totalSupply;
        currentReserves = preState.provenReserves;
        w3bMintPubkey = preState.w3bMint;
        treasuryPubkey = preState.treasury;
        log(
          `Pre-state: supply=${currentSupply}, reserves=${currentReserves}`
        );
      } else {
        log("Warning: Protocol state account not found");
      }
    } catch (err) {
      log(`Warning: Could not fetch pre-state: ${err}`);
    }

    const allowInsolventUpdate = process.env.ALLOW_INSOLVENT_UPDATE === "true";
    if (!allowInsolventUpdate) {
      if (!preStateFetched) {
        log("Safety check failed: unable to fetch on-chain protocol state");
        return NextResponse.json(
          { success: false, error: "Safety check failed: unable to fetch on-chain protocol state." },
          { status: 503 }
        );
      }

      if (serials.length < currentSupply) {
        const msg = `Refusing to decrease proven reserves below current on-chain supply (supabaseSerials=${serials.length}, onchainSupply=${currentSupply}). Seed more serials or burn supply, or set ALLOW_INSOLVENT_UPDATE=true to override.`;
        log(msg);
        return NextResponse.json({ success: false, error: msg }, { status: 409 });
      }

      if (serials.length < currentReserves) {
        const msg = `Refusing to decrease proven reserves below current on-chain proven reserves (supabaseSerials=${serials.length}, onchainReserves=${currentReserves}). Seed more serials or set ALLOW_INSOLVENT_UPDATE=true to override.`;
        log(msg);
        return NextResponse.json({ success: false, error: msg }, { status: 409 });
      }
    }

    // Submit update_merkle_root
    log("Submitting update_merkle_root to Solana...");
    const updateTx = await program.methods
      .updateMerkleRoot(rootArray as number[], new BN(serials.length))
      .accountsPartial({
        protocolState: protocolStatePda,
        operator: authority.publicKey,
      })
      .rpc();

    log(`Merkle root updated! Tx: ${updateTx}`);

    // 6.5 Submit proof hash (required for mint_w3b staleness check).
    // Note: current protocol records the hash and enforces reserve-count logic.
    const proofHash = crypto
      .createHash("sha256")
      .update(Buffer.from(rootBytes))
      .update(Buffer.from(String(serials.length)))
      .digest();

    log("Submitting submit_proof to Solana...");
    const proofTx = await (program.methods as any)
      .submitProof(proofHash, new BN(serials.length))
      .accountsPartial({
        protocolState: protocolStatePda,
        operator: authority.publicKey,
      })
      .rpc();

    log(`Proof submitted! Tx: ${proofTx}`);

    // 7. Auto-mint if enabled and reserves > supply
    let mintTx: string | null = null;
    const autoMintEnabled =
      process.env.AUTO_MINT_ENABLED !== "false"; // Enabled by default

    if (autoMintEnabled && w3bMintPubkey && treasuryPubkey) {
      const amountToMint = serials.length - currentSupply;
      if (amountToMint > 0) {
        log(`Auto-minting ${amountToMint} W3B tokens...`);
        mintTx = await (program.methods as any)
          .mintW3B(new BN(amountToMint))
          .accountsPartial({
            protocolState: protocolStatePda,
            w3BMint: w3bMintPubkey,
            w3bMint: w3bMintPubkey,
            treasury: treasuryPubkey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            operator: authority.publicKey,
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
      const postState = await fetchProtocolStateSnapshot(connection, protocolStatePda);
      if (postState) {
        finalState = {
          totalSupply: postState.totalSupply,
          provenReserves: postState.provenReserves,
          lastProofTimestamp: new Date(postState.lastRootUpdate * 1000).toISOString(),
          merkleRoot: rootHex,
        };
        log(
          `Final state: supply=${finalState.totalSupply}, reserves=${finalState.provenReserves}`
        );
      } else {
        log("Warning: Could not fetch post-state");
      }
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
        proofTx,
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
      "Automated reserve verification pipeline. POST supports webhook secret auth or allowlisted wallet-signature auth for manual admin triggers.",
    envVarsRequired: [
      "PROTOCOL_AUTHORITY_KEYPAIR",
      "ADMIN_WEBHOOK_SECRET",
      "ADMIN_WALLET_ALLOWLIST",
      "CRON_SECRET",
      "AUTO_MINT_ENABLED (optional, default: true)",
    ],
  });
}
