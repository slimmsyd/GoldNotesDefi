#!/usr/bin/env ts-node
/**
 * Set WGB Price Script
 * 
 * Sets the WGB token price in lamports.
 * 
 * Example: If 1 Goldback = $9.18 and SOL = $200
 * Then 1 WGB = 9.18/200 = 0.0459 SOL = 45,900,000 lamports
 * 
 * Usage: npx ts-node scripts/set_price.ts [price_in_lamports]
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Import IDL
const idlJson = require("../../../programs/w3b_protocol/target/idl/wgb_protocol.json");
import { WgbProtocol } from "../../../programs/w3b_protocol/target/types/wgb_protocol";

// Load env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

// Default price calculation:
// 1 Goldback ≈ $9.18 USD
// If SOL ≈ $200, then 1 WGB = 9.18/200 = 0.0459 SOL
// 0.0459 * 1e9 = 45,900,000 lamports
const DEFAULT_PRICE_LAMPORTS = 45_900_000;

async function main() {
    console.log("💰 Setting WGB Token Price\n");
    console.log("=".repeat(60));

    // Get price from command line or use default
    const priceArg = process.argv[2];
    const priceLamports = priceArg ? parseInt(priceArg, 10) : DEFAULT_PRICE_LAMPORTS;
    
    if (isNaN(priceLamports) || priceLamports <= 0) {
        console.error("❌ Invalid price. Must be a positive integer (lamports).");
        process.exit(1);
    }

    const priceInSol = priceLamports / LAMPORTS_PER_SOL;
    console.log(`📊 Price to set: ${priceLamports} lamports (${priceInSol.toFixed(6)} SOL)`);

    // 1. Setup connection
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    console.log(`🌐 Connected to: ${rpcUrl}`);

    // 2. Load wallet
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH || 
        path.join(require("os").homedir(), ".config/solana/id.json");
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
    const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log(`👛 Authority: ${authority.publicKey.toBase58()}`);

    // 3. Setup Anchor
    const wallet = new Wallet(authority);
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    const programId = new PublicKey(idlJson.address);
    const program = new Program<WgbProtocol>(idlJson as any, provider);
    console.log(`📜 Program ID: ${programId.toBase58()}`);

    // 4. Find ProtocolState PDA
    const [protocolStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_state")],
        programId
    );
    console.log(`🔐 Protocol State PDA: ${protocolStatePda.toBase58()}`);

    // 5. Set the price
    console.log("\n📤 Setting WGB price...");
    
    try {
        const tx = await (program.methods as any)
            .setWgbPrice(new anchor.BN(priceLamports))
            .accountsPartial({
                protocolState: protocolStatePda,
                authority: authority.publicKey,
            })
            .rpc();

        console.log(`✅ Price set successfully!`);
        console.log(`   Transaction: ${tx}`);
        console.log(`   Price: ${priceLamports} lamports (${priceInSol.toFixed(6)} SOL)`);
        
        // 6. Verify by fetching state
        const state = await program.account.protocolState.fetch(protocolStatePda);
        console.log(`\n📊 Verified Protocol State:`);
        console.log(`   WGB Price: ${state.wgbPriceLamports?.toString() || 'N/A'} lamports`);
        console.log(`   SOL Receiver: ${state.solReceiver?.toBase58() || 'N/A'}`);
        
    } catch (error: any) {
        console.error("❌ Failed to set price:", error.message);
        if (error.logs) {
            console.error("\n📜 Program logs:");
            error.logs.forEach((log: string) => console.error(`   ${log}`));
        }
        process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 WGB price configuration complete!");
}

main().catch(console.error);
