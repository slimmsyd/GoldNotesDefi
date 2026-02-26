#!/usr/bin/env ts-node
/**
 * Migrate Protocol State Script
 * 
 * One-time migration to resize the ProtocolState account
 * to accommodate new fields (w3b_price_lamports, sol_receiver).
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Import IDL
const idlJson = require("../../../programs/w3b_protocol/target/idl/wgb_protocol.json");
import { WgbProtocol } from "../../../programs/w3b_protocol/target/types/wgb_protocol";

// Load env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
    console.log("🔄 Migrating Protocol State to New Layout\n");
    console.log("=".repeat(60));

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

    // 5. Check current account size
    const accountInfo = await connection.getAccountInfo(protocolStatePda);
    if (!accountInfo) {
        console.log("❌ Protocol state account not found. Run setup_token.ts first.");
        process.exit(1);
    }
    
    console.log(`\n📊 Current account size: ${accountInfo.data.length} bytes`);
    console.log(`   Expected new size: 218 bytes (8 discriminator + 210 data)`);

    if (accountInfo.data.length >= 218) {
        console.log("✅ Account already has correct size. No migration needed.");
        process.exit(0);
    }

    // 6. Run migration
    console.log("\n📤 Running migration...");
    
    try {
        const tx = await (program.methods as any)
            .migrateProtocolState()
            .accountsPartial({
                protocolState: protocolStatePda,
                authority: authority.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        console.log(`✅ Migration successful!`);
        console.log(`   Transaction: ${tx}`);
        
        // 7. Verify new size
        const newAccountInfo = await connection.getAccountInfo(protocolStatePda);
        console.log(`\n📊 New account size: ${newAccountInfo?.data.length} bytes`);
        
        // 8. Fetch and display state
        const state = await program.account.protocolState.fetch(protocolStatePda);
        console.log(`\n📋 Protocol State after migration:`);
        console.log(`   Authority: ${state.authority.toBase58()}`);
        console.log(`   WGB Mint: ${state.wgbMint.toBase58()}`);
        console.log(`   Treasury: ${state.treasury.toBase58()}`);
        console.log(`   WGB Price: ${state.w3bPriceLamports?.toString() || 'N/A'} lamports`);
        console.log(`   SOL Receiver: ${state.solReceiver?.toBase58() || 'N/A'}`);
        
    } catch (error: any) {
        console.error("❌ Migration failed:", error.message);
        if (error.logs) {
            console.error("\n📜 Program logs:");
            error.logs.forEach((log: string) => console.error(`   ${log}`));
        }
        process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Migration complete! Now run set_price.ts to set WGB price.");
}

main().catch(console.error);
