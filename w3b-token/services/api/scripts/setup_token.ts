#!/usr/bin/env ts-node
/**
 * Setup W3B Token-2022 Mint and Treasury
 * 
 * This script:
 * 1. Creates a Token-2022 mint for W3B (0 decimals = 1 token = 1 Goldback)
 * 2. Creates a treasury token account
 * 3. Initializes the ProtocolState with these addresses
 * 
 * Run once during setup.
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
    createInitializeMintInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getMintLen,
    ExtensionType,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Import IDL
const idlJson = require("../../../programs/w3b_protocol/target/idl/w3b_protocol.json");
import { W3bProtocol } from "../../../programs/w3b_protocol/target/types/w3b_protocol";

// Load env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
    console.log("🏗️  Setting up W3B Token-2022 Mint and Treasury\n");
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
    const program = new Program<W3bProtocol>(idlJson as any, provider);
    console.log(`📜 Program ID: ${programId.toBase58()}`);

    // 4. Find ProtocolState PDA
    const [protocolStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("protocol_state")],
        programId
    );
    console.log(`🔐 Protocol State PDA: ${protocolStatePda.toBase58()}`);

    // 5. Create Mint Keypair
    const mintKeypair = Keypair.generate();
    console.log(`\n🪙 W3B Mint Address: ${mintKeypair.publicKey.toBase58()}`);

    // 6. Calculate rent for basic Token-2022 mint (82 bytes for a basic mint)
    const MINT_SIZE = 82;  // Basic Token-2022 mint without extensions
    const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    // 7. Create mint account
    console.log("\n📤 Creating Token-2022 Mint...");
    
    const createMintTx = new Transaction().add(
        // Create account with correct size
        SystemProgram.createAccount({
            fromPubkey: authority.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports: mintRent,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        // Initialize mint (0 decimals = integer tokens)
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            0,  // 0 decimals: 1 W3B = 1 Goldback (integer)
            protocolStatePda,  // Mint authority = Program PDA
            null,  // No freeze authority
            TOKEN_2022_PROGRAM_ID
        )
    );

    const mintSig = await sendAndConfirmTransaction(
        connection,
        createMintTx,
        [authority, mintKeypair]
    );
    console.log(`✅ Mint created: ${mintSig}`);

    // 8. Create Treasury ATA (Associated Token Account)
    const treasuryAta = getAssociatedTokenAddressSync(
        mintKeypair.publicKey,
        authority.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`\n🏦 Treasury ATA: ${treasuryAta.toBase58()}`);

    console.log("📤 Creating Treasury Token Account...");
    const createAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
            authority.publicKey,  // Payer
            treasuryAta,          // ATA address
            authority.publicKey,  // Owner
            mintKeypair.publicKey, // Mint
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )
    );

    const ataSig = await sendAndConfirmTransaction(
        connection,
        createAtaTx,
        [authority]
    );
    console.log(`✅ Treasury ATA created: ${ataSig}`);

    try {
        // Try with multiple account name formats to handle SDK casing quirks
        const accounts = {
            protocolState: protocolStatePda,
            w3bMint: mintKeypair.publicKey,
            w3BMint: mintKeypair.publicKey,  // Try both casings
            treasury: treasuryAta,
            authority: authority.publicKey,
            systemProgram: SystemProgram.programId,
        };
        
        const initTx = await program.methods
            .initialize()
            .accountsPartial(accounts as any)
            .rpc();

        console.log(`✅ ProtocolState initialized: ${initTx}`);
    } catch (error: any) {
        if (error.message?.includes("already in use")) {
            console.log("⚠️  ProtocolState already initialized. Skipping.");
        } else {
            throw error;
        }
    }

    // 10. Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 W3B Token Setup Complete!\n");
    console.log("📋 Save these addresses:\n");
    console.log(`   W3B Mint:      ${mintKeypair.publicKey.toBase58()}`);
    console.log(`   Treasury:      ${treasuryAta.toBase58()}`);
    console.log(`   Protocol PDA:  ${protocolStatePda.toBase58()}`);
    console.log(`   Program ID:    ${programId.toBase58()}`);
    console.log("\n📊 Current State:");
    console.log(`   Total Supply:     0 W3B`);
    console.log(`   Proven Reserves:  0 Goldbacks`);
    console.log("\n🔜 Next: Run simulate → prove → mint flow");
}

main().catch(console.error);
