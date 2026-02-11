#!/usr/bin/env ts-node
/**
 * Migrate W3B Protocol to V2
 * 
 * Calls:
 *   1. migrate_v2  — resizes ProtocolState PDA from V1 to V2 (512 bytes)
 *   2. set_operator — sets the operator key (defaults to authority)
 * 
 * Usage: npx ts-node scripts/migrate_v2.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env from w3b-token root
dotenv.config({ path: path.join(__dirname, "../../../.env") });

// Paths
const IDL_PATH = path.join(__dirname, "../../../programs/w3b_protocol/target/idl/w3b_protocol.json");

const PROGRAM_ID = new PublicKey(
  process.env.W3B_PROGRAM_ID || "9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6"
);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function loadKeypair(): Keypair {
  // Try SOLANA_KEYPAIR_PATH first
  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH ||
    path.join(require("os").homedir(), ".config/solana/id.json");

  if (fs.existsSync(keypairPath)) {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  }

  throw new Error("No keypair found. Set SOLANA_KEYPAIR_PATH env variable.");
}

async function main() {
  console.log("\n  W3B PROTOCOL — MIGRATE TO V2");
  console.log("  ================================\n");

  // Safety check
  if (RPC_URL.includes("mainnet")) {
    console.error("  ABORT: Please review carefully before running on mainnet!");
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const authority = loadKeypair();

  console.log(`  RPC:       ${RPC_URL}`);
  console.log(`  Authority: ${authority.publicKey.toBase58()}`);

  const balance = await connection.getBalance(authority.publicKey);
  console.log(`  Balance:   ${(balance / 1e9).toFixed(4)} SOL\n`);

  // Setup Anchor
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf-8"));
  const program = new Program(idl as any, provider);

  // Derive ProtocolState PDA
  const [protocolStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("protocol_state")],
    PROGRAM_ID
  );
  console.log(`  Protocol PDA: ${protocolStatePda.toBase58()}`);

  // Check current account size
  const accountInfo = await connection.getAccountInfo(protocolStatePda);
  if (!accountInfo) {
    console.error("  ERROR: ProtocolState PDA does not exist. Use initialize_v2 instead.");
    process.exit(1);
  }
  console.log(`  Current size: ${accountInfo.data.length} bytes`);

  if (accountInfo.data.length < 512) {
    // Step 1a: Call migrate_v2 to resize
    console.log("\n  Step 1a: Calling migrate_v2 to resize PDA...");
    try {
      const tx = await program.methods
        .migrateV2()
        .accountsPartial({
          protocolState: protocolStatePda,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log(`  SUCCESS: ${tx}`);
      console.log(`  Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
    } catch (err: any) {
      console.error("  migrate_v2 failed:", err.message);
      if (err.logs) {
        console.error("  Logs:", err.logs.slice(-5));
      }
      process.exit(1);
    }

    const updatedInfo = await connection.getAccountInfo(protocolStatePda);
    console.log(`  New size: ${updatedInfo?.data.length ?? 0} bytes`);
  } else {
    console.log("  ProtocolState already at V2 size (>= 512 bytes). Skipping resize.\n");
  }

  // Step 1b: Call fix_v2_layout to remap V1 data offsets to V2
  console.log("\n  Step 1b: Calling fix_v2_layout to remap data offsets...");
  try {
    const tx = await program.methods
      .fixV2Layout()
      .accountsPartial({
        protocolState: protocolStatePda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`  SUCCESS: ${tx}`);
    console.log(`  Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
  } catch (err: any) {
    console.error("  fix_v2_layout failed:", err.message);
    if (err.logs) {
      console.error("  Logs:", err.logs.slice(-5));
    }
    // Don't exit — might already be fixed
    console.log("  (This is OK if layout was already fixed)\n");
  }

  // Step 2: Call set_operator (set operator = authority for now)
  console.log("\n  Step 2: Calling set_operator...");
  try {
    const tx = await program.methods
      .setOperator(authority.publicKey)
      .accountsPartial({
        protocolState: protocolStatePda,
        authority: authority.publicKey,
      })
      .rpc();

    console.log(`  SUCCESS: ${tx}`);
    console.log(`  Operator set to: ${authority.publicKey.toBase58()}`);
    console.log(`  Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
  } catch (err: any) {
    console.error("  set_operator failed:", err.message);
    if (err.logs) {
      console.error("  Logs:", err.logs.slice(-5));
    }
    process.exit(1);
  }

  // Step 3: Verify by reading protocol state
  console.log("\n  Step 3: Verifying protocol state...");
  try {
    const state = await (program.account as any)["protocolState"].fetch(protocolStatePda);
    console.log(`  Authority:    ${state.authority?.toBase58()}`);
    console.log(`  Operator:     ${state.operator?.toBase58()}`);
    console.log(`  W3B Mint:     ${state.w3bMint?.toBase58()}`);
    console.log(`  Treasury:     ${state.treasury?.toBase58()}`);
    console.log(`  Total Supply: ${state.totalSupply?.toString()}`);
    console.log(`  Total Burned: ${state.totalBurned?.toString()}`);
    console.log(`  Yield APY:    ${state.yieldApyBps?.toString()} bps`);
    console.log(`  Is Paused:    ${state.isPaused}`);
  } catch (err: any) {
    console.error("  Failed to read state:", err.message);
  }

  console.log("\n  ================================");
  console.log("  MIGRATION COMPLETE");
  console.log("  ================================\n");
}

main().catch((err) => {
  console.error("\n  FATAL ERROR:", err);
  process.exit(1);
});
