import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import { MerkleTree } from "merkletreejs";
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env from w3b-token root
dotenv.config({ path: path.join(__dirname, "../../../.env") });

// Load IDL
const IDL_PATH = path.join(__dirname, "../../../programs/w3b_protocol/target/idl/wgb_protocol.json");
const IDL = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));

// Constants — read from env first, then fall back to canonical program ID
// IMPORTANT: Must match the declare_id!() in programs/wgb_protocol/src/lib.rs
const PROGRAM_ID = new PublicKey(
    process.env.WGB_PROGRAM_ID || "9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6"
);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Supabase client (using anon key - works for reads without RLS)
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
);

function hashSerial(serial: string): Buffer {
    return crypto.createHash("sha256").update(serial).digest();
}

async function main() {
    console.log("🚀 Anchor Merkle Root Script");
    console.log("============================\n");

    // 1. Fetch all serials from Supabase
    console.log("📦 Fetching serials from Supabase...");
    const { data: serials, error } = await supabase
        .from("goldback_serials")
        .select("serial_number")
        .order("serial_number");

    if (error) {
        console.error("❌ Supabase error:", error.message);
        process.exit(1);
    }

    if (!serials || serials.length === 0) {
        console.log("⚠️  No serials found in database. Nothing to anchor.");
        process.exit(0);
    }

    console.log(`✅ Found ${serials.length} serials\n`);

    // 2. Build Merkle Tree
    console.log("🌳 Building Merkle Tree...");
    const serialStrings = serials.map((s) => s.serial_number);
    const leaves = serialStrings.map(hashSerial);
    const tree = new MerkleTree(leaves, (data: Buffer) => 
        crypto.createHash("sha256").update(data).digest(), 
        { sortPairs: true }
    );
    
    const rootHex = tree.getHexRoot();
    const rootBytes = tree.getRoot();
    
    console.log(`✅ Merkle Root: ${rootHex}`);
    console.log(`   Total Leaves: ${serials.length}\n`);

    // 3. Connect to Solana
    console.log("🔗 Connecting to Solana Devnet...");
    const connection = new Connection(RPC_URL, "confirmed");

    // Load wallet from keypair file
    const keypairPath = process.env.SOLANA_KEYPAIR_PATH || 
        path.join(process.env.HOME!, ".config/solana/id.json");
    
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
    const wallet = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    
    console.log(`✅ Wallet: ${wallet.publicKey.toBase58()}\n`);

    // 4. Create Anchor provider and program
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(wallet),
        { commitment: "confirmed" }
    );
    anchor.setProvider(provider);

    const program = new Program(IDL, provider);

    // 5. Call update_merkle_root
    console.log("📝 Calling update_merkle_root on-chain...");
    
    // Convert root to [u8; 32] array
    const rootArray = Array.from(rootBytes);
    if (rootArray.length !== 32) {
        // Pad with zeros if needed
        while (rootArray.length < 32) rootArray.push(0);
    }

    try {
        const tx = await program.methods
            .updateMerkleRoot(rootArray as number[], new anchor.BN(serials.length))
            .accountsPartial({
                authority: wallet.publicKey,
            })
            .rpc();

        console.log(`\n✅ SUCCESS!`);
        console.log(`   Transaction: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        // 6. Update database with the anchored root
        const { error: updateError } = await supabase
            .from("merkle_roots")
            .upsert({
                root_hash: rootHex,
                total_serials: serials.length,
                solana_tx_hash: tx,
                status: "confirmed"
            }, { onConflict: "root_hash" });

        if (updateError) {
            console.warn("⚠️  Failed to update DB:", updateError.message);
        } else {
            console.log("✅ Database updated with new root.");
        }

        // Update serials to mark them as included
        await supabase
            .from("goldback_serials")
            .update({ included_in_root: rootHex })
            .is("included_in_root", null);

    } catch (err: any) {
        console.error("❌ Transaction failed:", err.message);
        if (err.logs) {
            console.error("   Logs:", err.logs);
        }
        process.exit(1);
    }
}

main().catch(console.error);
