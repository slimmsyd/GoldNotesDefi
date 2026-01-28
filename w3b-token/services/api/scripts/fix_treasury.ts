#!/usr/bin/env ts-node
/**
 * Fix Treasury Ownership
 * 
 * Creates a new treasury token account owned by the Protocol PDA
 * so that buy_w3b can transfer tokens from it.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction
} from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Import IDL
const idlJson = require("../../../programs/w3b_protocol/target/idl/w3b_protocol.json");

// Load env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
    console.log("🔧 Fixing Treasury Ownership\n");
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
    const program = new anchor.Program(idlJson as any, provider);
    console.log(`📜 Program ID: ${programId.toBase58()}`);

    // 4. Find ProtocolState PDA
    const [protocolStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_state")],
        programId
    );
    console.log(`🔐 Protocol State PDA: ${protocolStatePda.toBase58()}`);

    // 5. Read current protocol state
    const accountInfo = await connection.getAccountInfo(protocolStatePda);
    if (!accountInfo) {
        console.error("❌ Protocol state not found");
        process.exit(1);
    }
    const data = accountInfo.data;
    const w3bMint = new PublicKey(data.slice(40, 72));
    const oldTreasury = new PublicKey(data.slice(72, 104));
    
    console.log(`\n📊 Current State:`);
    console.log(`   W3B Mint: ${w3bMint.toBase58()}`);
    console.log(`   Old Treasury: ${oldTreasury.toBase58()}`);

    // 6. Get old treasury balance
    const oldTreasuryAccount = await getAccount(connection, oldTreasury, "confirmed", TOKEN_2022_PROGRAM_ID);
    console.log(`   Old Treasury Balance: ${oldTreasuryAccount.amount} W3B`);
    console.log(`   Old Treasury Owner: ${oldTreasuryAccount.owner.toBase58()}`);

    // 7. Create new treasury ATA for the Protocol PDA
    const newTreasury = getAssociatedTokenAddressSync(
        w3bMint,
        protocolStatePda,
        true,  // allowOwnerOffCurve = true for PDAs
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`\n🏦 New Treasury (PDA-owned): ${newTreasury.toBase58()}`);

    // Check if new treasury exists
    const newTreasuryInfo = await connection.getAccountInfo(newTreasury);
    if (!newTreasuryInfo) {
        console.log("📤 Creating new treasury ATA for PDA...");
        const createAtaTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
                authority.publicKey,  // Payer
                newTreasury,          // ATA address
                protocolStatePda,     // Owner = PDA
                w3bMint,              // Mint
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )
        );
        const ataSig = await sendAndConfirmTransaction(connection, createAtaTx, [authority]);
        console.log(`✅ New Treasury created: ${ataSig}`);
    } else {
        console.log("✅ New Treasury already exists");
    }

    // 8. Transfer tokens from old treasury to new treasury
    if (oldTreasuryAccount.amount > 0n) {
        console.log(`\n📤 Transferring ${oldTreasuryAccount.amount} W3B from old to new treasury...`);
        const transferTx = new Transaction().add(
            createTransferInstruction(
                oldTreasury,
                newTreasury,
                authority.publicKey,  // Old treasury is owned by authority
                oldTreasuryAccount.amount,
                [],
                TOKEN_2022_PROGRAM_ID
            )
        );
        const transferSig = await sendAndConfirmTransaction(connection, transferTx, [authority]);
        console.log(`✅ Transfer complete: ${transferSig}`);
    }

    // 9. Verify new treasury balance
    const newTreasuryAccount = await getAccount(connection, newTreasury, "confirmed", TOKEN_2022_PROGRAM_ID);
    console.log(`\n📊 New Treasury Balance: ${newTreasuryAccount.amount} W3B`);
    console.log(`   New Treasury Owner: ${newTreasuryAccount.owner.toBase58()}`);

    // 10. Update protocol-constants.ts
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Treasury Fixed!\n");
    console.log("📋 UPDATE protocol-constants.ts with:");
    console.log(`   treasury: '${newTreasury.toBase58()}'`);
    console.log("\n⚠️  The on-chain protocol state still has the old treasury address.");
    console.log("   For MVP, update the frontend constants to use the new treasury.");
    console.log("   The buy_w3b instruction uses has_one = treasury, so we need to update the program state too.");
}

main().catch(console.error);
