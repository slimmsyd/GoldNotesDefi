#!/usr/bin/env ts-node
/**
 * Phase 3 (WS-D): ingestion-aligned devnet seeding.
 *
 * Goals:
 * - Increase proven reserves to target (never decrease unless --force-decrease)
 * - Refresh proof timestamp
 * - Mint only reserve delta (NOT supply delta), preventing burn-gap backfill
 *
 * Usage:
 *   npx ts-node scripts/devnet_seed_reserves_and_mint.ts --target-reserves 5000
 *   npx ts-node scripts/devnet_seed_reserves_and_mint.ts --target-reserves 5000 --mint-delta auto
 *   npx ts-node scripts/devnet_seed_reserves_and_mint.ts --target-reserves 5000 --mint-delta 120
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const idlJson = require("../../../programs/w3b_protocol/target/idl/w3b_protocol.json");
import { W3bProtocol } from "../../../programs/w3b_protocol/target/types/w3b_protocol";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

type Args = {
  targetReserves: number;
  mintDelta: "auto" | number;
  forceDecrease: boolean;
};

type ProtocolStateSnapshot = {
  w3bMint: PublicKey;
  treasury: PublicKey;
  totalSupply: number;
  provenReserves: number;
  lastProofTimestamp: number;
  w3bPriceLamports: number;
};

function parseArgs(argv: string[]): Args {
  const out: Args = {
    targetReserves: 5000,
    mintDelta: "auto",
    forceDecrease: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--target-reserves") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error("Invalid --target-reserves");
      out.targetReserves = Math.floor(v);
      continue;
    }
    if (arg === "--mint-delta") {
      const raw = argv[++i];
      if (raw === "auto") {
        out.mintDelta = "auto";
      } else {
        const v = Number(raw);
        if (!Number.isFinite(v) || v < 0) throw new Error("Invalid --mint-delta");
        out.mintDelta = Math.floor(v);
      }
      continue;
    }
    if (arg === "--force-decrease") {
      out.forceDecrease = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage:",
          "  npx ts-node scripts/devnet_seed_reserves_and_mint.ts [--target-reserves 5000] [--mint-delta auto|N] [--force-decrease]",
        ].join("\n")
      );
      process.exit(0);
    }
    throw new Error(`Unknown arg: ${arg}`);
  }

  return out;
}

function hexToBytes32(hex: string): number[] {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = normalized.padStart(64, "0").slice(0, 64);
  return Array.from(Buffer.from(padded, "hex"));
}

async function fetchProtocolStateSnapshot(
  connection: Connection,
  protocolStatePda: PublicKey
): Promise<ProtocolStateSnapshot> {
  const info = await connection.getAccountInfo(protocolStatePda, "confirmed");
  if (!info) {
    throw new Error(`Protocol state not found at ${protocolStatePda.toBase58()}`);
  }

  const data = info.data;
  if (data.length < 216) {
    throw new Error(`Protocol state account too small (${data.length})`);
  }

  const w3bMint = new PublicKey(data.slice(72, 104));
  const treasury = new PublicKey(data.slice(104, 136));
  const totalSupply = Number(new anchor.BN(data.subarray(136, 144), "le").toString());
  const provenReserves = Number(new anchor.BN(data.subarray(184, 192), "le").toString());
  const lastProofTimestamp = Number(new anchor.BN(data.subarray(200, 208), "le").toString());
  const w3bPriceLamports = Number(new anchor.BN(data.subarray(208, 216), "le").toString());

  return { w3bMint, treasury, totalSupply, provenReserves, lastProofTimestamp, w3bPriceLamports };
}

function getDeterministicRoot(targetReserves: number): string {
  return "0x" + crypto.createHash("sha256").update(`phase3:seed:root:${targetReserves}`).digest("hex");
}

function getDeterministicProofHash(targetReserves: number): Buffer {
  return crypto.createHash("sha256").update(`phase3:seed:proof:${targetReserves}`).digest();
}

async function main() {
  const args = parseArgs(process.argv);

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH || path.join(require("os").homedir(), ".config/solana/id.json");
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const operator = Keypair.fromSecretKey(Uint8Array.from(secret));

  const wallet = new Wallet(operator);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new Program<W3bProtocol>(idlJson as any, provider);
  const programId = new PublicKey(idlJson.address);
  const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_state")], programId);

  const pre = await fetchProtocolStateSnapshot(connection, protocolStatePda);

  if (!args.forceDecrease && args.targetReserves < pre.provenReserves) {
    throw new Error(
      `Refusing to decrease reserves (${pre.provenReserves} -> ${args.targetReserves}) without --force-decrease`
    );
  }

  const targetReserves = args.targetReserves;
  const reserveDelta = Math.max(0, targetReserves - pre.provenReserves);

  let mintAmount = 0;
  if (args.mintDelta === "auto") {
    // Ingestion-aligned semantics: mint only on reserve increase.
    mintAmount = reserveDelta;
  } else {
    if (args.mintDelta > reserveDelta) {
      throw new Error(
        `mint-delta ${args.mintDelta} exceeds reserve increase ${reserveDelta}; refusing burn-gap backfill`
      );
    }
    mintAmount = args.mintDelta;
  }

  const rootHex = getDeterministicRoot(targetReserves);
  const proofHash = getDeterministicProofHash(targetReserves);

  console.log("=== Phase 3 Devnet Seed (Ingestion-Aligned) ===");
  console.log(`RPC:                ${rpcUrl}`);
  console.log(`Program:            ${programId.toBase58()}`);
  console.log(`ProtocolState:      ${protocolStatePda.toBase58()}`);
  console.log(`Operator:           ${operator.publicKey.toBase58()}`);
  console.log(`Pre.totalSupply:    ${pre.totalSupply}`);
  console.log(`Pre.provenReserves: ${pre.provenReserves}`);
  console.log(`Target reserves:    ${targetReserves}`);
  console.log(`Reserve delta:      ${reserveDelta}`);
  console.log(`Mint amount:        ${mintAmount}`);

  let txRoot: string | null = null;
  let txProof: string | null = null;
  let txMint: string | null = null;

  txRoot = await (program.methods as any)
    .updateMerkleRoot(hexToBytes32(rootHex), new anchor.BN(targetReserves))
    .accountsPartial({
      protocolState: protocolStatePda,
      operator: operator.publicKey,
    })
    .rpc();

  txProof = await (program.methods as any)
    .submitProof(Buffer.from(proofHash), new anchor.BN(targetReserves))
    .accountsPartial({
      protocolState: protocolStatePda,
      operator: operator.publicKey,
    })
    .rpc();

  if (mintAmount > 0) {
    const { TOKEN_2022_PROGRAM_ID } = require("@solana/spl-token");
    txMint = await (program.methods as any)
      .mintW3B(new anchor.BN(mintAmount))
      .accountsPartial({
        protocolState: protocolStatePda,
        w3bMint: pre.w3bMint,
        treasury: pre.treasury,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        operator: operator.publicKey,
      })
      .rpc();
  }

  const post = await fetchProtocolStateSnapshot(connection, protocolStatePda);
  const treasuryBalance = await connection.getTokenAccountBalance(pre.treasury).catch(() => null);
  const treasuryUi = treasuryBalance?.value?.uiAmount ?? null;
  const nowSec = Math.floor(Date.now() / 1000);
  const proofAgeSec = nowSec - post.lastProofTimestamp;

  const checks = {
    treasuryHasSupply: (treasuryBalance?.value?.amount ? Number(treasuryBalance.value.amount) : 0) > 0,
    supplyLeqReserves: post.totalSupply <= post.provenReserves,
    proofFreshForMint: proofAgeSec < 48 * 3600,
  };

  const out = {
    ok: checks.treasuryHasSupply && checks.supplyLeqReserves && checks.proofFreshForMint,
    mode: "ingestion_aligned",
    pre,
    post,
    targetReserves,
    reserveDelta,
    mintAmount,
    tx: {
      updateMerkleRoot: txRoot,
      submitProof: txProof,
      mintW3B: txMint,
    },
    treasury: {
      account: pre.treasury.toBase58(),
      amountRaw: treasuryBalance?.value?.amount ?? null,
      amountUi: treasuryUi,
    },
    checks,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(out, null, 2));

  if (!out.ok) process.exit(1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.exit(1);
});

