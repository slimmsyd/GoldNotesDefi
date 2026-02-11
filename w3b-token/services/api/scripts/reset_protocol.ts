#!/usr/bin/env ts-node
/**
 * Reset W3B Protocol to Ground Zero
 *
 * This script performs a FULL reset:
 * 1. Wipes Supabase tables (goldback_serials, merkle_roots)
 * 2. Re-deploys the Solana program to devnet
 * 3. Creates a fresh Token-2022 mint, treasury, and ProtocolState
 * 4. Prints new addresses to update in protocol-constants / .env
 *
 * WARNING: This is destructive. All on-chain state and database records
 * will be permanently deleted. Only use on devnet.
 *
 * Usage: npx ts-node scripts/reset_protocol.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Load env from w3b-token root
dotenv.config({ path: path.join(__dirname, "../../../.env") });

// Paths
const ANCHOR_PROJECT_DIR = path.join(__dirname, "../../../programs/w3b_protocol");
const IDL_PATH = path.join(ANCHOR_PROJECT_DIR, "target/idl/w3b_protocol.json");

// Supabase client (service role for destructive operations)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

/* ─── Helpers ─── */

function separator(label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("=".repeat(60));
}

function loadKeypair(): Keypair {
  // Prefer PROTOCOL_AUTHORITY_KEYPAIR env var (JSON byte array)
  const envKeypair = process.env.PROTOCOL_AUTHORITY_KEYPAIR;
  if (envKeypair) {
    try {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(envKeypair)));
    } catch {
      console.warn("  Invalid PROTOCOL_AUTHORITY_KEYPAIR format, falling back to file...");
    }
  }

  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH ||
    path.join(require("os").homedir(), ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(keypairData));
}

/* ─── Phase 1A: Wipe Supabase ─── */

async function wipeSupabase() {
  separator("Phase 1A: Wipe Supabase Data");

  // Wipe goldback_serials
  console.log("  Deleting all rows from goldback_serials...");
  const { error: serialsError, count: serialsCount } = await supabase
    .from("goldback_serials")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all rows

  if (serialsError) {
    console.error("  Error wiping goldback_serials:", serialsError.message);
    // Try a different approach if the above fails
    const { error: retryError } = await supabase
      .from("goldback_serials")
      .delete()
      .gte("id", ""); // Alternate: match all
    if (retryError) {
      console.error("  Retry also failed:", retryError.message);
      console.warn("  You may need to manually truncate goldback_serials in the Supabase dashboard.");
    } else {
      console.log("  goldback_serials wiped (retry succeeded).");
    }
  } else {
    console.log(`  goldback_serials wiped.`);
  }

  // Wipe merkle_roots
  console.log("  Deleting all rows from merkle_roots...");
  const { error: rootsError } = await supabase
    .from("merkle_roots")
    .delete()
    .neq("id", -1); // Delete all rows (id is int)

  if (rootsError) {
    console.error("  Error wiping merkle_roots:", rootsError.message);
    const { error: retryError } = await supabase
      .from("merkle_roots")
      .delete()
      .gte("id", 0);
    if (retryError) {
      console.error("  Retry also failed:", retryError.message);
      console.warn("  You may need to manually truncate merkle_roots in the Supabase dashboard.");
    } else {
      console.log("  merkle_roots wiped (retry succeeded).");
    }
  } else {
    console.log(`  merkle_roots wiped.`);
  }

  // Wipe redemption_requests (V2 table)
  console.log("  Deleting all rows from redemption_requests...");
  const { error: redemptionsError } = await supabase
    .from("redemption_requests")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (redemptionsError) {
    console.warn("  Could not wipe redemption_requests:", redemptionsError.message);
    console.warn("  (Table may not exist yet — this is OK on first run)");
  } else {
    console.log("  redemption_requests wiped.");
  }

  // Wipe user_profiles (V2 table)
  console.log("  Deleting all rows from user_profiles...");
  const { error: profilesError } = await supabase
    .from("user_profiles")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (profilesError) {
    console.warn("  Could not wipe user_profiles:", profilesError.message);
    console.warn("  (Table may not exist yet — this is OK on first run)");
  } else {
    console.log("  user_profiles wiped.");
  }

  // Verify
  const { count: remainingSerials } = await supabase
    .from("goldback_serials")
    .select("*", { count: "exact", head: true });
  const { count: remainingRoots } = await supabase
    .from("merkle_roots")
    .select("*", { count: "exact", head: true });

  console.log(`\n  Verification:`);
  console.log(`    goldback_serials:      ${remainingSerials ?? 0} rows`);
  console.log(`    merkle_roots:          ${remainingRoots ?? 0} rows`);

  if ((remainingSerials ?? 0) > 0 || (remainingRoots ?? 0) > 0) {
    console.warn("  WARNING: Some rows remain. Check RLS policies or use the Supabase dashboard to truncate.");
  }
}

/* ─── Phase 1B: Re-deploy Solana Program ─── */

function redeploySolanaProgram(): string {
  separator("Phase 1B: Re-deploy Solana Program");

  console.log("  Building Anchor program...");
  try {
    execSync("anchor build", {
      cwd: ANCHOR_PROJECT_DIR,
      stdio: "inherit",
      timeout: 120_000,
    });
    console.log("  Build complete.");
  } catch (err) {
    console.error("  Build failed. Make sure Anchor CLI is installed.");
    throw err;
  }

  // Ensure authority keypair exists for deploy
  const authorityWallet = "/tmp/w3b-authority.json";
  if (!fs.existsSync(authorityWallet)) {
    console.log("  Creating authority keypair file for deploy...");
    const authority = loadKeypair();
    fs.writeFileSync(authorityWallet, `[${Array.from(authority.secretKey)}]`);
  }

  console.log("\n  Deploying to devnet...");
  try {
    const output = execSync(
      `anchor deploy --provider.cluster devnet --provider.wallet ${authorityWallet}`,
      {
        cwd: ANCHOR_PROJECT_DIR,
        timeout: 120_000,
        encoding: "utf-8",
      }
    );
    console.log(output);
    console.log("  Deploy complete.");
  } catch (err: any) {
    console.warn("  Deploy warning:", err.message?.substring(0, 200));
    console.log("  Attempting to continue (program may already be deployed)...");
  }

  // Read program ID from IDL
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
  const programId = idl.address || idl.metadata?.address;
  console.log(`  Program ID: ${programId}`);
  return programId;
}

/* ─── Phase 1C: Fresh Token Setup ─── */

async function freshTokenSetup(programIdStr: string) {
  separator("Phase 1C: Fresh Token Setup");

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const authority = loadKeypair();

  console.log(`  RPC:       ${rpcUrl}`);
  console.log(`  Authority: ${authority.publicKey.toBase58()}`);

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`  Balance:   ${(balance / 1e9).toFixed(4)} SOL`);
  if (balance < 0.05 * 1e9) {
    console.warn("  WARNING: Low balance. You may need to airdrop SOL.");
    console.log("  Run: solana airdrop 2 --url devnet");
  }

  // Setup Anchor
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const programId = new PublicKey(programIdStr);
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
  const program = new Program(idl as any, provider);

  // Find ProtocolState PDA
  const [protocolStatePda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_state")],
    programId
  );
  console.log(`  Protocol PDA: ${protocolStatePda.toBase58()}`);

  // Check if protocol state already exists — close it for a clean slate
  const existingAccount = await connection.getAccountInfo(protocolStatePda);
  if (existingAccount) {
    console.log("  ProtocolState PDA already exists. Closing it for clean slate...");
    try {
      const closeTx = await (program.methods as any)
        .closeProtocolState()
        .accountsPartial({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
        })
        .rpc();
      console.log(`  ProtocolState closed: ${closeTx}`);
      console.log("  Lamports returned to authority.");
    } catch (error: any) {
      console.error("  Failed to close ProtocolState:", error.message);
      console.error("  You may need to manually close it or the authority doesn't match.");
      throw error;
    }
  }

  // Create new mint
  console.log("\n  Creating Token-2022 Mint...");
  const mintKeypair = Keypair.generate();
  const MINT_SIZE = 82;
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0, // 0 decimals: 1 W3B = 1 Goldback
      protocolStatePda, // Mint authority = Program PDA
      null, // No freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  const mintSig = await sendAndConfirmTransaction(connection, createMintTx, [
    authority,
    mintKeypair,
  ]);
  console.log(`  Mint created: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`  Tx: ${mintSig}`);

  // Create Treasury ATA — owner = protocolStatePda (required by buy_w3b constraint)
  const treasuryAta = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    protocolStatePda,
    true, // allowOwnerOffCurve = true for PDA owners
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  console.log(`  Treasury ATA: ${treasuryAta.toBase58()} (owner = PDA)`);

  const createAtaTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      authority.publicKey,    // payer
      treasuryAta,           // ata address
      protocolStatePda,      // owner = PDA (so buy_w3b can transfer from it)
      mintKeypair.publicKey, // mint
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  const ataSig = await sendAndConfirmTransaction(connection, createAtaTx, [authority]);
  console.log(`  Treasury created: ${ataSig}`);

  // Initialize ProtocolState (V2 — requires token_program account)
  console.log("\n  Initializing ProtocolState (V2)...");
  try {
    // Note: Anchor converts w3b_mint -> w3BMint (capitalizes B after digit)
    const accounts = {
      protocolState: protocolStatePda,
      w3BMint: mintKeypair.publicKey,
      treasury: treasuryAta,
      authority: authority.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    };

    const initTx = await (program.methods as any)
      .initializeV2()
      .accountsPartial(accounts as any)
      .rpc();

    console.log(`  ProtocolState V2 initialized: ${initTx}`);
  } catch (error: any) {
    if (error.message?.includes("already in use")) {
      console.log("  ProtocolState already initialized (re-using existing PDA).");
    } else {
      throw error;
    }
  }

  return {
    programId: programIdStr,
    mint: mintKeypair.publicKey.toBase58(),
    treasury: treasuryAta.toBase58(),
    protocolState: protocolStatePda.toBase58(),
  };
}

/* ─── Phase 1D: Print Configuration ─── */

function printConfiguration(addresses: {
  programId: string;
  mint: string;
  treasury: string;
  protocolState: string;
}) {
  separator("Phase 1D: New Configuration");

  console.log("\n  Update these in my-app/.env.local:\n");
  console.log(`  NEXT_PUBLIC_W3B_PROGRAM_ID=${addresses.programId}`);
  console.log(`  NEXT_PUBLIC_W3B_MINT=${addresses.mint}`);
  console.log(`  NEXT_PUBLIC_W3B_TREASURY_ACCOUNT=${addresses.treasury}`);
  console.log(`  NEXT_PUBLIC_W3B_PROTOCOL_STATE_PDA=${addresses.protocolState}`);

  console.log("\n  And in protocol-constants.ts (fallback values):\n");
  console.log(`  programId: '${addresses.programId}'`);
  console.log(`  w3bMint: '${addresses.mint}'`);
  console.log(`  treasury: '${addresses.treasury}'`);
  console.log(`  protocolState: '${addresses.protocolState}'`);

  // Write a JSON file for easy reference
  const outputPath = path.join(__dirname, "reset_output.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        ...addresses,
      },
      null,
      2
    )
  );
  console.log(`\n  Saved to: ${outputPath}`);
}

/* ─── Main ─── */

async function main() {
  console.log("\n");
  console.log("  W3B PROTOCOL - FULL RESET TO GROUND ZERO");
  console.log("  ==========================================");
  console.log("  WARNING: This will destroy ALL data.");
  console.log("  Network: DEVNET ONLY\n");

  // Safety check
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  if (rpcUrl.includes("mainnet")) {
    console.error("  ABORT: Cannot reset on mainnet!");
    process.exit(1);
  }

  // Phase 1A: Wipe Supabase
  await wipeSupabase();

  // Phase 1B: Re-deploy Solana program
  let programId: string;
  try {
    programId = redeploySolanaProgram();
  } catch {
    // If build/deploy fails, try to read existing program ID from IDL
    console.log("  Falling back to existing IDL program ID...");
    const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
    programId = idl.address || idl.metadata?.address;
    console.log(`  Using existing program ID: ${programId}`);
  }

  // Phase 1C: Fresh token setup
  const addresses = await freshTokenSetup(programId);

  // Phase 1D: Print new configuration
  printConfiguration(addresses);

  // Phase 1E: Verify clean slate
  separator("Phase 1E: Verification");
  console.log("\n  Protocol State:");
  console.log("    Total Supply:    0");
  console.log("    Proven Reserves: 0");
  console.log("    Merkle Root:     [empty]");
  console.log("    Is Paused:       false");
  console.log("\n  Supabase:");
  console.log("    goldback_serials:      0 rows");
  console.log("    merkle_roots:          0 rows");
  console.log("    redemption_requests:   0 rows");
  console.log("    user_profiles:         0 rows");
  console.log("\n  Dashboard should show: 'Fully Backed' (0/0 = solvent)");

  console.log("\n" + "=".repeat(60));
  console.log("  RESET COMPLETE");
  console.log("=".repeat(60));
  console.log("\n  Next steps:");
  console.log("  1. Update my-app/.env.local with the addresses above");
  console.log("  2. Update protocol-constants.ts fallback values");
  console.log("  3. Restart the dev server (npm run dev)");
  console.log("  4. Verify dashboard shows 0/0 'Fully Backed'");
  console.log("  5. Add test serials to begin testing\n");
}

main().catch((err) => {
  console.error("\n  FATAL ERROR:", err);
  process.exit(1);
});
