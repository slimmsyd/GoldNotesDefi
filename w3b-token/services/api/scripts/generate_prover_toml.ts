#!/usr/bin/env ts-node
/**
 * Generate Prover.toml files with batched inputs for the Noir circuit
 * 
 * BATCHED PROOF IMPLEMENTATION:
 * - Handles ANY number of serials by splitting into batches of 20
 * - Each batch gets its own Prover_batch_N.toml file
 * - Generates a manifest file tracking all batches
 * 
 * Example:
 *   100 serials → 5 batches → 5 Prover files → 5 proofs
 *   50 serials  → 3 batches → 3 Prover files → 3 proofs
 *   15 serials  → 1 batch   → 1 Prover file  → 1 proof
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Load env from w3b-token root
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const CIRCUIT_DIR = path.join(__dirname, "../../../circuits/reserve_proof");
const BATCH_SIZE = 20; // Fixed by the Noir circuit

interface BatchManifest {
    generatedAt: string;
    totalSerials: number;
    batchSize: number;
    batchCount: number;
    batches: {
        batchNumber: number;
        serialCount: number;
        proverFile: string;
        serials: string[]; // Original serial strings for reference
    }[];
}

/**
 * Hash a serial string with SHA256 and truncate to fit in Noir Field (254 bits)
 * We take the first 31 bytes (248 bits) to be safely under the BN254 field prime.
 */
function hashSerialToField(serial: string): string {
    const hash = crypto.createHash("sha256").update(serial).digest("hex");
    // Take first 62 hex chars (31 bytes = 248 bits) - safe for BN254 field
    return "0x" + hash.substring(0, 62);
}

/**
 * Compare two hex strings as big integers (for sorting)
 */
function compareHexStrings(a: string, b: string): number {
    const aNum = BigInt(a);
    const bNum = BigInt(b);
    if (aNum < bNum) return -1;
    if (aNum > bNum) return 1;
    return 0;
}

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Generate a Prover.toml file for a single batch
 */
function generateProverToml(
    sortedHashes: string[],
    batchNumber: number,
    totalBatches: number
): string {
    const activeCount = sortedHashes.length;
    
    // Pad to BATCH_SIZE with max values
    const paddedHashes = [...sortedHashes];
    while (paddedHashes.length < BATCH_SIZE) {
        paddedHashes.push("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    }
    
    return `# Prover.toml - Batch ${batchNumber} of ${totalBatches}
# Generated at: ${new Date().toISOString()}
#
# Contains SHA256 hashes of ${activeCount} Goldback serial numbers.
# Hashes are sorted in ascending order for O(n) uniqueness verification.

# Private inputs (never revealed in the proof)
serials = [${paddedHashes.map(h => `"${h}"`).join(", ")}]
active_count = "${activeCount}"

# Public inputs (visible on-chain)
# NOTE: Run "nargo execute" to compute the correct merkle_root
merkle_root = "0x0000000000000000000000000000000000000000000000000000000000000000"
total_supply = "${activeCount}"
`;
}

async function main() {
    console.log("🔧 Generating Batched Prover.toml Files\n");
    console.log("=".repeat(60));

    const USE_MOCK = process.env.USE_MOCK_DATA === "true";
    const MOCK_COUNT = parseInt(process.env.MOCK_SERIAL_COUNT || "20", 10);
    
    let serialStrings: string[];
    
    if (USE_MOCK) {
        // Generate realistic mock serials (configurable count)
        serialStrings = [];
        for (let i = 1; i <= MOCK_COUNT; i++) {
            serialStrings.push(`GB-2026-${i.toString().padStart(6, "0")}`);
        }
        console.log(`📦 Using ${MOCK_COUNT} mock serials`);
    } else {
        // Fetch ALL serials from Supabase (no limit)
        const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!
        );
        
        const { data, error } = await supabase
            .from("goldback_serials")
            .select("serial_number")
            .order("serial_number");
        
        if (error || !data) {
            console.error("❌ Failed to fetch serials:", error);
            process.exit(1);
        }
        
        serialStrings = data.map(s => s.serial_number);
        console.log(`📦 Fetched ${serialStrings.length} serials from Supabase`);
    }

    if (serialStrings.length === 0) {
        console.error("❌ No serials found!");
        process.exit(1);
    }

    // Step 1: Hash each serial with SHA256
    console.log("\n🔐 Hashing serials with SHA256...");
    const serialsWithHashes = serialStrings.map(serial => ({
        original: serial,
        hash: hashSerialToField(serial),
    }));
    
    // Step 2: Sort by hash (ascending order - CRITICAL for circuit)
    console.log("📊 Sorting hashes in ascending order...");
    serialsWithHashes.sort((a, b) => compareHexStrings(a.hash, b.hash));
    
    // Verify uniqueness (no duplicate hashes)
    for (let i = 0; i < serialsWithHashes.length - 1; i++) {
        if (compareHexStrings(serialsWithHashes[i].hash, serialsWithHashes[i + 1].hash) === 0) {
            console.error(`❌ Duplicate hash found for serials: ${serialsWithHashes[i].original} and ${serialsWithHashes[i + 1].original}`);
            process.exit(1);
        }
    }
    console.log("   ✅ All hashes unique and sorted");
    
    // Step 3: Split into batches
    const batches = chunkArray(serialsWithHashes, BATCH_SIZE);
    const batchCount = batches.length;
    
    console.log(`\n📦 Splitting ${serialStrings.length} serials into ${batchCount} batch(es) of max ${BATCH_SIZE}`);
    
    // Step 4: Create target/batches directory
    const batchDir = path.join(CIRCUIT_DIR, "target", "batches");
    if (!fs.existsSync(batchDir)) {
        fs.mkdirSync(batchDir, { recursive: true });
    }
    
    // Step 5: Generate Prover.toml for each batch
    const manifest: BatchManifest = {
        generatedAt: new Date().toISOString(),
        totalSerials: serialStrings.length,
        batchSize: BATCH_SIZE,
        batchCount,
        batches: [],
    };
    
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchNumber = i + 1;
        const proverFileName = `Prover_batch_${batchNumber}.toml`;
        const proverPath = path.join(batchDir, proverFileName);
        
        const hashes = batch.map(s => s.hash);
        const proverContent = generateProverToml(hashes, batchNumber, batchCount);
        
        fs.writeFileSync(proverPath, proverContent);
        
        manifest.batches.push({
            batchNumber,
            serialCount: batch.length,
            proverFile: proverFileName,
            serials: batch.map(s => s.original),
        });
        
        console.log(`   ✅ Batch ${batchNumber}: ${batch.length} serials → ${proverFileName}`);
    }
    
    // Step 6: Also write the first batch as main Prover.toml for single-batch convenience
    if (batches.length === 1) {
        const mainProverPath = path.join(CIRCUIT_DIR, "Prover.toml");
        const hashes = batches[0].map(s => s.hash);
        fs.writeFileSync(mainProverPath, generateProverToml(hashes, 1, 1));
        console.log(`\n   📄 Also wrote main Prover.toml (single batch mode)`);
    }
    
    // Step 7: Write manifest
    const manifestPath = path.join(batchDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📋 Manifest written to ${manifestPath}`);
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ BATCH GENERATION COMPLETE");
    console.log("=".repeat(60));
    console.log(`   Total serials:  ${serialStrings.length}`);
    console.log(`   Batch size:     ${BATCH_SIZE}`);
    console.log(`   Batches:        ${batchCount}`);
    console.log(`   Output dir:     ${batchDir}`);
    
    console.log("\n📋 Next steps:");
    console.log("   1. Run: npm run prove-batches");
    console.log("      (or manually: ./scripts/prove_batches.sh)");
    console.log("   2. Run: npm run submit-proof");
}

main().catch(console.error);
