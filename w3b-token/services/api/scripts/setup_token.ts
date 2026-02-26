#!/usr/bin/env ts-node
/**
 * Setup WGB Token-2022 Mint and Treasury
 * 
 * This script:
 * 1. Creates a Token-2022 mint for WGB (0 decimals = 1 token = 1 Goldback)
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
    createInitializeTransferFeeConfigInstruction,
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
const idlJson = require("../../../programs/w3b_protocol/target/idl/wgb_protocol.json");
import { WgbProtocol } from "../../../programs/w3b_protocol/target/types/wgb_protocol";

// Load env
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
    console.log("🏗️  Setting up WGB Token-2022 Mint and Treasury\n");
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

    // 5. Create Mint Keypair
    const mintKeypair = Keypair.generate();
    console.log(`\n🪙 WGB Mint Address: ${mintKeypair.publicKey.toBase58()}`);

    // 6. Transfer Fee Extension configuration
    const TRANSFER_FEE_BASIS_POINTS = 0;    // No transfer fee (0 decimals makes fees impractical)
    const MAX_FEE = BigInt(0);

    // 7. Calculate rent for Token-2022 mint WITH Transfer Fee Extension
    const mintSize = getMintLen([ExtensionType.TransferFeeConfig]);
    const mintRent = await connection.getMinimumBalanceForRentExemption(mintSize);

    console.log(`   Mint size with Transfer Fee Extension: ${mintSize} bytes`);
    console.log(`   Transfer fee: ${TRANSFER_FEE_BASIS_POINTS} bps (${TRANSFER_FEE_BASIS_POINTS / 100}%)`);

    // 8. Create mint account with Transfer Fee Extension
    // Extension instructions MUST come before createInitializeMintInstruction
    console.log("\n📤 Creating Token-2022 Mint with Transfer Fee Extension...");
    
    const createMintTx = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: authority.publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: mintSize,
            lamports: mintRent,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeTransferFeeConfigInstruction(
            mintKeypair.publicKey,
            protocolStatePda,          // transferFeeConfigAuthority (can update fee params)
            protocolStatePda,          // withdrawWithheldAuthority (can harvest withheld fees)
            TRANSFER_FEE_BASIS_POINTS,
            MAX_FEE,
            TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            0,  // 0 decimals: 1 WGB = 1 Goldback (integer)
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
            wgbMint: mintKeypair.publicKey,
            wgbMint: mintKeypair.publicKey,  // Try both casings
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
    console.log("🎉 WGB Token Setup Complete!\n");
    console.log("📋 Save these addresses:\n");
    console.log(`   WGB Mint:      ${mintKeypair.publicKey.toBase58()}`);
    console.log(`   Treasury:      ${treasuryAta.toBase58()}`);
    console.log(`   Protocol PDA:  ${protocolStatePda.toBase58()}`);
    console.log(`   Program ID:    ${programId.toBase58()}`);
    console.log("\n📊 Current State:");
    console.log(`   Total Supply:     0 WGB`);
    console.log(`   Proven Reserves:  0 Goldbacks`);
    console.log(`   Transfer Fee:     ${TRANSFER_FEE_BASIS_POINTS} bps (${TRANSFER_FEE_BASIS_POINTS / 100}%)`);
    console.log(`   Max Fee:          ${MAX_FEE.toString()} tokens`);
    console.log("\n🔜 Next: Run simulate → prove → mint flow");
}

main().catch(console.error);
