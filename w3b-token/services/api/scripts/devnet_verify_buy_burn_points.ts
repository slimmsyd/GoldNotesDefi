#!/usr/bin/env ts-node
/**
 * Phase 3 (WS-E): devnet verification script for buy/burn + points behaviors.
 *
 * Scenarios:
 * 1) buy succeeds with userProfile=null
 * 2) burn succeeds with userProfile=null + redemption PDA created
 * 3) buy fails with wrong profile PDA
 * 4) buy+burn with valid profile updates points
 *
 * Usage:
 *   npx ts-node scripts/devnet_verify_buy_burn_points.ts --amount 1
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const idlJson = require("../../../programs/w3b_protocol/target/idl/w3b_protocol.json");
import { W3bProtocol } from "../../../programs/w3b_protocol/target/types/w3b_protocol";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

type ScenarioResult = {
  scenario: string;
  pass: boolean;
  txSignature?: string;
  explorerUrl?: string;
  error?: string;
  details?: Record<string, unknown>;
};

type Args = {
  amount: number;
  fundSol: number;
};

type ProtocolStateSnapshot = {
  w3bMint: PublicKey;
  treasury: PublicKey;
  solReceiver: PublicKey;
  totalSupply: number;
  provenReserves: number;
  w3bPriceLamports: number;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { amount: 1, fundSol: 0.2 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--amount") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v < 0) throw new Error("Invalid --amount");
      out.amount = Math.floor(v);
      continue;
    }
    if (arg === "--fund-sol") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) throw new Error("Invalid --fund-sol");
      out.fundSol = v;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx ts-node scripts/devnet_verify_buy_burn_points.ts [--amount 1] [--fund-sol 0.2]"
      );
      process.exit(0);
    }
    throw new Error(`Unknown arg: ${arg}`);
  }
  return out;
}

function u64LeBuffer(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    b[i] = Number((v >> BigInt(i * 8)) & BigInt(0xff));
  }
  return b;
}

function explorerUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

async function fetchProtocolStateSnapshot(
  connection: Connection,
  protocolStatePda: PublicKey
): Promise<ProtocolStateSnapshot> {
  const info = await connection.getAccountInfo(protocolStatePda, "confirmed");
  if (!info) throw new Error("ProtocolState not found");
  const d = info.data;
  if (d.length < 248) throw new Error(`ProtocolState too small: ${d.length}`);

  const w3bMint = new PublicKey(d.slice(72, 104));
  const treasury = new PublicKey(d.slice(104, 136));
  const totalSupply = Number(new anchor.BN(d.subarray(136, 144), "le").toString());
  const provenReserves = Number(new anchor.BN(d.subarray(184, 192), "le").toString());
  const w3bPriceLamports = Number(new anchor.BN(d.subarray(208, 216), "le").toString());
  const solReceiver = new PublicKey(d.slice(216, 248));

  return { w3bMint, treasury, solReceiver, totalSupply, provenReserves, w3bPriceLamports };
}

async function ensureAta(
  connection: Connection,
  payer: Keypair,
  owner: PublicKey,
  mint: PublicKey
): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const existing = await connection.getAccountInfo(ata, "confirmed");
  if (existing) return ata;

  const ix = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    owner,
    mint,
    TOKEN_2022_PROGRAM_ID
  );
  const tx = new Transaction().add(ix);
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );
  return ata;
}

async function fundUser(connection: Connection, payer: Keypair, user: PublicKey, sol: number): Promise<void> {
  const lamports = Math.floor(sol * anchor.web3.LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: user,
      lamports,
    })
  );
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");
}

async function main() {
  const args = parseArgs(process.argv);

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH || path.join(require("os").homedir(), ".config/solana/id.json");

  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const operator = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(operator), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const program = new Program<W3bProtocol>(idlJson as any, provider);
  const programId = new PublicKey(idlJson.address);
  const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_state")], programId);
  const state = await fetchProtocolStateSnapshot(connection, protocolStatePda);

  if (state.w3bPriceLamports <= 0) {
    throw new Error("w3b_price_lamports is zero; run price sync first");
  }
  if (state.totalSupply <= 0 || state.provenReserves <= 0) {
    throw new Error("Supply/reserves not seeded; run devnet_seed_reserves_and_mint first");
  }

  const results: ScenarioResult[] = [];

  // Scenario users.
  const userNoProfile = Keypair.generate();
  const userWithProfile = Keypair.generate();
  const wrongProfileOwner = Keypair.generate();

  await fundUser(connection, operator, userNoProfile.publicKey, args.fundSol);
  await fundUser(connection, operator, userWithProfile.publicKey, args.fundSol);
  await fundUser(connection, operator, wrongProfileOwner.publicKey, args.fundSol);

  const ataNoProfile = await ensureAta(connection, operator, userNoProfile.publicKey, state.w3bMint);
  const ataWithProfile = await ensureAta(connection, operator, userWithProfile.publicKey, state.w3bMint);

  const [userWithProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), userWithProfile.publicKey.toBuffer()],
    programId
  );
  const [wrongProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_profile"), wrongProfileOwner.publicKey.toBuffer()],
    programId
  );

  // Ensure profile accounts exist where needed.
  await (program.methods as any)
    .initUserProfile()
    .accountsPartial({
      userProfile: userWithProfilePda,
      user: userWithProfile.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([userWithProfile])
    .rpc();

  await (program.methods as any)
    .initUserProfile()
    .accountsPartial({
      userProfile: wrongProfilePda,
      user: wrongProfileOwner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([wrongProfileOwner])
    .rpc();

  // 1) buy succeeds with userProfile null
  try {
    const sig = await (program.methods as any)
      .buyW3B(new anchor.BN(args.amount))
      .accountsPartial({
        protocolState: protocolStatePda,
        buyer: userNoProfile.publicKey,
        buyerTokenAccount: ataNoProfile,
        treasury: state.treasury,
        solReceiver: state.solReceiver,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: null,
      })
      .signers([userNoProfile])
      .rpc();
    results.push({
      scenario: "buy_null_profile",
      pass: true,
      txSignature: sig,
      explorerUrl: explorerUrl(sig),
    });
  } catch (e) {
    results.push({
      scenario: "buy_null_profile",
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 2) burn succeeds with userProfile null + redemption PDA exists
  try {
    const requestId = BigInt(Date.now());
    const [redemptionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), userNoProfile.publicKey.toBuffer(), u64LeBuffer(requestId)],
      programId
    );
    const sig = await (program.methods as any)
      .burnW3B(new anchor.BN(args.amount), new anchor.BN(requestId.toString()))
      .accountsPartial({
        protocolState: protocolStatePda,
        user: userNoProfile.publicKey,
        userTokenAccount: ataNoProfile,
        w3BMint: state.w3bMint,
        redemptionRequest: redemptionPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: null,
      })
      .signers([userNoProfile])
      .rpc();

    const redemptionInfo = await connection.getAccountInfo(redemptionPda, "confirmed");
    results.push({
      scenario: "burn_null_profile",
      pass: !!redemptionInfo,
      txSignature: sig,
      explorerUrl: explorerUrl(sig),
      details: { redemptionPda: redemptionPda.toBase58(), redemptionExists: !!redemptionInfo },
    });
  } catch (e) {
    results.push({
      scenario: "burn_null_profile",
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 3) wrong profile should fail
  try {
    await (program.methods as any)
      .buyW3B(new anchor.BN(0))
      .accountsPartial({
        protocolState: protocolStatePda,
        buyer: userWithProfile.publicKey,
        buyerTokenAccount: ataWithProfile,
        treasury: state.treasury,
        solReceiver: state.solReceiver,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: wrongProfilePda,
      })
      .signers([userWithProfile])
      .rpc();

    results.push({
      scenario: "buy_wrong_profile_rejected",
      pass: false,
      error: "Expected InvalidUserProfileAccount but instruction succeeded",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isExpected =
      msg.includes("Invalid user profile account supplied") ||
      msg.includes("InvalidUserProfileAccount");
    results.push({
      scenario: "buy_wrong_profile_rejected",
      pass: isExpected,
      error: isExpected ? undefined : msg,
      details: { observedError: msg },
    });
  }

  // 4) valid profile buy+burn updates points
  try {
    const before = (await (program.account as any).userProfile.fetch(userWithProfilePda)) as any;
    const beforePoints = Number(before.points?.toString?.() ?? before.points ?? 0);
    const beforeRedeemed = Number(before.totalRedeemed?.toString?.() ?? before.totalRedeemed ?? 0);

    const buySig = await (program.methods as any)
      .buyW3B(new anchor.BN(args.amount))
      .accountsPartial({
        protocolState: protocolStatePda,
        buyer: userWithProfile.publicKey,
        buyerTokenAccount: ataWithProfile,
        treasury: state.treasury,
        solReceiver: state.solReceiver,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: userWithProfilePda,
      })
      .signers([userWithProfile])
      .rpc();

    const requestId = BigInt(Date.now() + 7);
    const [redemptionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), userWithProfile.publicKey.toBuffer(), u64LeBuffer(requestId)],
      programId
    );

    const burnSig = await (program.methods as any)
      .burnW3B(new anchor.BN(args.amount), new anchor.BN(requestId.toString()))
      .accountsPartial({
        protocolState: protocolStatePda,
        user: userWithProfile.publicKey,
        userTokenAccount: ataWithProfile,
        w3BMint: state.w3bMint,
        redemptionRequest: redemptionPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: userWithProfilePda,
      })
      .signers([userWithProfile])
      .rpc();

    const after = (await (program.account as any).userProfile.fetch(userWithProfilePda)) as any;
    const afterPoints = Number(after.points?.toString?.() ?? after.points ?? 0);
    const afterRedeemed = Number(after.totalRedeemed?.toString?.() ?? after.totalRedeemed ?? 0);

    const expectedMinDeltaPoints = args.amount * 3; // +1 buy, +2 burn
    const pass = afterPoints >= beforePoints + expectedMinDeltaPoints && afterRedeemed >= beforeRedeemed + args.amount;

    results.push({
      scenario: "valid_profile_points_update",
      pass,
      txSignature: burnSig,
      explorerUrl: explorerUrl(burnSig),
      details: {
        buyTx: buySig,
        burnTx: burnSig,
        beforePoints,
        afterPoints,
        beforeRedeemed,
        afterRedeemed,
        expectedMinDeltaPoints,
      },
    });
  } catch (e) {
    results.push({
      scenario: "valid_profile_points_update",
      pass: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const summary = {
    ok: results.every((r) => r.pass),
    rpcUrl,
    programId: programId.toBase58(),
    protocolState: protocolStatePda.toBase58(),
    amount: args.amount,
    results,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exit(1);
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
