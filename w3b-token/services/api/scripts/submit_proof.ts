#!/usr/bin/env ts-node
/**
 * Submit ZK Proof(s) to Solana Blockchain
 *
 * BATCHED PROOF SUPPORT:
 * - Automatically detects if batched proofs exist (proof_manifest.json)
 * - Submits all batch proofs in sequence
 * - Aggregates total supply across all batches
 * - Falls back to single-proof mode if no batch manifest
 *
 * Flow:
 * 1. Verify each proof locally using Barretenberg (bb verify)
 * 2. Update on-chain Merkle root + reserve count to match current submission set
 * 3. Submit each proof hash to the smart contract
 * 4. Mint tokens based on total proven reserves
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as crypto from "crypto";
import { MerkleTree } from "merkletreejs";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";

// Import IDL - using require for JSON
const idlJson = require("../../../programs/w3b_protocol/target/idl/w3b_protocol.json");
import { W3bProtocol } from "../../../programs/w3b_protocol/target/types/w3b_protocol";

// Load env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const CIRCUIT_DIR = path.join(__dirname, "../../../circuits/reserve_proof/target");
const BATCH_PROOF_DIR = path.join(CIRCUIT_DIR, "batches", "proofs");
const BATCH_INPUT_MANIFEST_PATH = path.join(CIRCUIT_DIR, "batches", "manifest.json");

interface ProofManifest {
  generatedAt: string;
  totalSerials: number;
  batchCount: number;
  proofs: {
    batchNumber: number;
    serialCount: number;
    proofFile: string;
    vkFile: string;
    publicInputsFile: string;
    merkleRoot: string;
  }[];
}

interface BatchInputManifest {
  generatedAt: string;
  totalSerials: number;
  batchSize: number;
  batchCount: number;
  batches: {
    batchNumber: number;
    serialCount: number;
    proverFile: string;
    serials: string[];
  }[];
}

interface ProofSubmission {
  batchNumber: number;
  proofHash: Buffer;
  merkleRoot: string;
  serialCount: number;
  verified: boolean;
}

interface ProtocolStateSnapshot {
  w3bMint: PublicKey;
  treasury: PublicKey;
  totalSupply: number;
  provenReserves: number;
  lastProofTimestamp: number;
}

function hexRootToBytes(rootHex: string): number[] {
  const normalized = rootHex.startsWith("0x") ? rootHex.slice(2) : rootHex;
  if (normalized.length > 64) {
    throw new Error(`Merkle root hex too long: ${normalized.length}`);
  }

  const padded = normalized.padStart(64, "0");
  return Array.from(Buffer.from(padded, "hex"));
}

function computeMerkleRootFromSerials(serials: string[]): string {
  if (serials.length === 0) {
    return "0x" + "0".repeat(64);
  }

  const leaves = serials.map((serial) => crypto.createHash("sha256").update(serial).digest());
  const tree = new MerkleTree(
    leaves,
    (data: Buffer) => crypto.createHash("sha256").update(data).digest(),
    { sortPairs: true }
  );

  return tree.getHexRoot();
}

function selectGlobalMerkleRoot(submissions: ProofSubmission[]): string {
  if (fs.existsSync(BATCH_INPUT_MANIFEST_PATH)) {
    const manifest = JSON.parse(
      fs.readFileSync(BATCH_INPUT_MANIFEST_PATH, "utf-8")
    ) as BatchInputManifest;

    const allSerials = manifest.batches.flatMap((b) => b.serials);
    const computedRoot = computeMerkleRootFromSerials(allSerials);
    console.log(`🧮 Computed global Merkle root from serial manifest: ${computedRoot}`);
    return computedRoot;
  }

  const rootFromProof = submissions[0]?.merkleRoot;
  if (!rootFromProof) {
    throw new Error("No proof submissions available to determine Merkle root");
  }

  console.log(`⚠️ Falling back to Merkle root from proof output: ${rootFromProof}`);
  return rootFromProof;
}

async function fetchProtocolStateSnapshot(
  connection: Connection,
  protocolStatePda: PublicKey
): Promise<ProtocolStateSnapshot> {
  const accountInfo = await connection.getAccountInfo(protocolStatePda, "confirmed");
  if (!accountInfo) {
    throw new Error(`Protocol state not found: ${protocolStatePda.toBase58()}`);
  }

  const data = accountInfo.data;
  if (data.length < 216) {
    throw new Error(`Protocol state data too small: ${data.length}`);
  }

  const w3bMint = new PublicKey(data.slice(72, 104));
  const treasury = new PublicKey(data.slice(104, 136));
  const totalSupply = Number(new anchor.BN(data.subarray(136, 144), "le").toString());
  const provenReserves = Number(new anchor.BN(data.subarray(184, 192), "le").toString());
  const lastProofTimestamp = Number(new anchor.BN(data.subarray(200, 208), "le").toString());

  return {
    w3bMint,
    treasury,
    totalSupply,
    provenReserves,
    lastProofTimestamp,
  };
}

/**
 * Verify proof locally using Barretenberg before submitting to blockchain.
 */
function verifyProofLocally(proofPath: string, vkPath: string, publicInputsPath?: string): boolean {
  if (!fs.existsSync(vkPath)) {
    console.error("❌ Verifying key not found at:", vkPath);
    return false;
  }

  try {
    let cmd = `bb verify -p "${proofPath}" -k "${vkPath}"`;
    if (publicInputsPath && fs.existsSync(publicInputsPath)) {
      cmd += ` -i "${publicInputsPath}"`;
    }
    execSync(cmd, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60000,
    });
    return true;
  } catch (error: any) {
    console.error("❌ Proof verification FAILED!");
    if (error.stderr) console.error("   Error:", error.stderr.toString());
    return false;
  }
}

/**
 * Log verification details for audit trail
 */
function logAuditEntry(submissions: ProofSubmission[], totalSupply: number) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    batchCount: submissions.length,
    totalSerials: totalSupply,
    proofs: submissions.map((s) => ({
      batch: s.batchNumber,
      proofHash: s.proofHash.toString("hex"),
      merkleRoot: s.merkleRoot,
      serialCount: s.serialCount,
      verified: s.verified,
    })),
    environment: process.env.SOLANA_RPC_URL?.includes("devnet") ? "devnet" : "mainnet",
  };

  console.log("\n📋 Verification Audit Log:");
  console.log(JSON.stringify(auditLog, null, 2));

  // Also write to file for permanent record
  const auditPath = path.join(BATCH_PROOF_DIR, `audit_${Date.now()}.json`);
  if (fs.existsSync(BATCH_PROOF_DIR)) {
    fs.writeFileSync(auditPath, JSON.stringify(auditLog, null, 2));
    console.log(`   Saved to: ${auditPath}`);
  }

  return auditLog;
}

/**
 * Process batched proofs from manifest
 */
async function processBatchedProofs(): Promise<{ submissions: ProofSubmission[]; totalSupply: number } | null> {
  const manifestPath = path.join(BATCH_PROOF_DIR, "proof_manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return null; // No batch manifest, fall back to single proof
  }

  console.log("📦 Found batch proof manifest");
  const manifest: ProofManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  console.log(`   Total serials: ${manifest.totalSerials}`);
  console.log(`   Batch count:   ${manifest.batchCount}`);

  const submissions: ProofSubmission[] = [];
  let allVerified = true;

  for (const proof of manifest.proofs) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`🔍 Verifying Batch ${proof.batchNumber}/${manifest.batchCount}`);

    const proofPath = path.join(BATCH_PROOF_DIR, proof.proofFile);
    const vkPath = path.join(BATCH_PROOF_DIR, proof.vkFile);
    const publicInputsPath = path.join(BATCH_PROOF_DIR, proof.publicInputsFile);

    if (!fs.existsSync(proofPath)) {
      console.error(`❌ Proof file not found: ${proofPath}`);
      allVerified = false;
      continue;
    }

    const verified = verifyProofLocally(proofPath, vkPath, publicInputsPath);
    if (verified) {
      console.log(`   ✅ Batch ${proof.batchNumber} verified`);
    } else {
      console.log(`   ❌ Batch ${proof.batchNumber} FAILED verification`);
      allVerified = false;
    }

    const proofBytes = fs.readFileSync(proofPath);
    const proofHash = crypto.createHash("sha256").update(proofBytes).digest();

    submissions.push({
      batchNumber: proof.batchNumber,
      proofHash,
      merkleRoot: proof.merkleRoot,
      serialCount: proof.serialCount,
      verified,
    });
  }

  if (!allVerified) {
    console.error("\n🚫 ABORTING: One or more proofs failed verification.");
    process.exit(1);
  }

  return {
    submissions,
    totalSupply: manifest.totalSerials,
  };
}

/**
 * Process single proof (legacy mode)
 */
async function processSingleProof(): Promise<{ submissions: ProofSubmission[]; totalSupply: number }> {
  const proofPath = path.join(CIRCUIT_DIR, "proof");
  const vkPath = path.join(CIRCUIT_DIR, "vk");
  const publicInputsPath = path.join(CIRCUIT_DIR, "public_inputs");

  if (!fs.existsSync(proofPath)) {
    console.error("❌ Proof file not found at:", proofPath);
    process.exit(1);
  }

  console.log("📄 Processing single proof (non-batched mode)");

  const verified = verifyProofLocally(proofPath, vkPath, publicInputsPath);
  if (!verified) {
    console.error("\n🚫 ABORTING: Proof failed verification.");
    process.exit(1);
  }
  console.log("   ✅ Proof verified");

  const proofBytes = fs.readFileSync(proofPath);
  const proofHash = crypto.createHash("sha256").update(proofBytes).digest();

  const publicInputsBytes = fs.readFileSync(publicInputsPath);
  const merkleRootBytes = publicInputsBytes.slice(0, 32);
  const merkleRoot = "0x" + merkleRootBytes.toString("hex");

  const totalSupplyBytes = publicInputsBytes.slice(32, 64);
  const totalSupply = Number(totalSupplyBytes.readBigUInt64BE(24));

  return {
    submissions: [
      {
        batchNumber: 1,
        proofHash,
        merkleRoot,
        serialCount: totalSupply,
        verified: true,
      },
    ],
    totalSupply,
  };
}

async function main() {
  console.log("🚀 Submitting ZK Proof(s) to Solana Blockchain\n");
  console.log("=".repeat(60));

  // Try batched proofs first, fall back to single
  let result = await processBatchedProofs();
  if (!result) {
    result = await processSingleProof();
  }

  const { submissions, totalSupply } = result;

  // Log audit trail
  logAuditEntry(submissions, totalSupply);

  // Setup Solana connection
  console.log("\n" + "=".repeat(60));
  console.log("🔗 Connecting to Solana...\n");

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  console.log(`   RPC: ${rpcUrl}`);

  // Load wallet
  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH || path.join(require("os").homedir(), ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log(`   Wallet: ${keypair.publicKey.toBase58()}`);

  // Setup Anchor
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const programId = new PublicKey(idlJson.address);
  const program = new Program<W3bProtocol>(idlJson as any, provider);
  console.log(`   Program: ${programId.toBase58()}`);

  // Find PDA
  const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_state")], programId);
  console.log(`   Protocol State: ${protocolStatePda.toBase58()}`);

  // Submit proofs
  console.log("\n" + "=".repeat(60));
  console.log("📤 Submitting proofs to blockchain...\n");

  try {
    // Fetch current state
    const preState = await fetchProtocolStateSnapshot(connection, protocolStatePda);
    const currentSupply = preState.totalSupply;
    const amountToMint = totalSupply - currentSupply;

    console.log(`🔍 Pre-State:`);
    console.log(`   Current Supply:     ${currentSupply}`);
    console.log(`   Current Reserves:   ${preState.provenReserves}`);
    console.log(`   Total Proven:       ${totalSupply}`);
    console.log(`   Batches to Submit:  ${submissions.length}`);
    console.log(`   Mint Delta:         ${amountToMint}`);

    // Update root + reserve count first so submit_proof reserve check passes.
    const globalMerkleRoot = selectGlobalMerkleRoot(submissions);
    const txRoot = await (program.methods as any)
      .updateMerkleRoot(hexRootToBytes(globalMerkleRoot), new anchor.BN(totalSupply))
      .accountsPartial({
        protocolState: protocolStatePda,
        operator: keypair.publicKey,
      })
      .rpc();

    console.log(`\n🔹 Merkle root updated. Tx: ${txRoot}`);

    // Submit each proof hash. Claimed reserves must equal protocol_state.proven_reserves.
    for (const submission of submissions) {
      console.log(`\n🔹 Submitting Batch ${submission.batchNumber}/${submissions.length}...`);
      console.log(`   Proof Hash:  ${submission.proofHash.toString("hex").substring(0, 20)}...`);
      console.log(`   Claimed:     ${totalSupply}`);

      const txProof = await program.methods
        .submitProof(Buffer.from(submission.proofHash), new anchor.BN(totalSupply))
        .accountsPartial({
          protocolState: protocolStatePda,
          operator: keypair.publicKey,
        })
        .rpc();

      console.log(`   ✅ Submitted! Tx: ${txProof}`);
    }

    // Mint tokens (if applicable)
    if (amountToMint > 0) {
      console.log(`\n🔹 Minting ${amountToMint} W3B tokens to Treasury...`);

      const { TOKEN_2022_PROGRAM_ID } = require("@solana/spl-token");

      const txMint = await (program.methods as any)
        .mintW3B(new anchor.BN(amountToMint))
        .accountsPartial({
          protocolState: protocolStatePda,
          w3bMint: preState.w3bMint,
          treasury: preState.treasury,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          operator: keypair.publicKey,
        })
        .rpc();

      console.log(`   ✅ Minted! Tx: ${txMint}`);
    } else {
      console.log(`\n🔹 No new tokens to mint (Supply >= Reserves).`);
    }

    // Final state
    const endState = await fetchProtocolStateSnapshot(connection, protocolStatePda);
    console.log(`\n📊 Final Protocol State:`);
    console.log(`   Proven Reserves: ${endState.provenReserves}`);
    console.log(`   Total Supply:    ${endState.totalSupply}`);
    console.log(`   Last Proof:      ${new Date(endState.lastProofTimestamp * 1000).toISOString()}`);
    console.log(`   Valid Solvency:  ${endState.totalSupply <= endState.provenReserves ? "✅ YES" : "❌ NO"}`);
  } catch (error: any) {
    console.error("❌ Transaction failed:", error.message);
    if (error.logs) {
      console.error("\n📜 Program logs:");
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`🎉 Complete! ${submissions.length} proof(s) submitted, ${totalSupply} serials proven.`);
}

main().catch(console.error);
