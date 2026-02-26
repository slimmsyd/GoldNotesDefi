#!/usr/bin/env ts-node
/**
 * Set Transfer Fee Script
 * 
 * Updates the Token-2022 Transfer Fee Extension config on the WGB mint.
 * Authority: must be signed by the protocol admin (authority in ProtocolState).
 * 
 * Usage: npx ts-node scripts/set_transfer_fee.ts [fee_bps] [max_fee]
 *   fee_bps  - Transfer fee in basis points (default: 0)
 *   max_fee  - Maximum fee per transfer in base units (default: 0)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

const idlJson = require("../../../programs/w3b_protocol/target/idl/wgb_protocol.json");
import { WgbProtocol } from "../../../programs/w3b_protocol/target/types/wgb_protocol";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
    console.log("⚙️  Setting WGB Transfer Fee\n");
    console.log("=".repeat(60));

    const feeBps = process.argv[2] ? parseInt(process.argv[2], 10) : 0;
    const maxFee = process.argv[3] ? parseInt(process.argv[3], 10) : 0;

    console.log(`  New fee:     ${feeBps} bps (${feeBps / 100}%)`);
    console.log(`  New max fee: ${maxFee}`);

    const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    const keypairPath = process.env.DEPLOYER_KEY_PATH
        || path.join(require("os").homedir(), ".config/solana/id.json");
    const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const authority = Keypair.fromSecretKey(Uint8Array.from(secretKey));

    console.log(`  Authority:   ${authority.publicKey.toBase58()}`);

    const wallet = new Wallet(authority);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    const program = new Program<WgbProtocol>(idlJson as any, provider);

    const [protocolStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_state")],
        program.programId
    );

    const stateAccount = await program.account.protocolState.fetch(protocolStatePda);
    const wgbMint = stateAccount.wgbMint;

    console.log(`  Program:     ${program.programId.toBase58()}`);
    console.log(`  WGB Mint:    ${wgbMint.toBase58()}`);
    console.log("=".repeat(60));

    const tx = await program.methods
        .updateTransferFee(feeBps, new anchor.BN(maxFee))
        .accounts({
            protocolState: protocolStatePda,
            authority: authority.publicKey,
            wgbMint: wgbMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .signers([authority])
        .rpc();

    console.log(`\n✅ Transfer fee updated!`);
    console.log(`  Tx: ${tx}`);
    console.log(`  Fee: ${feeBps} bps, Max: ${maxFee}`);
}

main().catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
});
