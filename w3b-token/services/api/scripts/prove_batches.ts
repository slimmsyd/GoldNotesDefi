#!/usr/bin/env ts-node
/**
 * Prove All Batches
 * 
 * Orchestrates ZK proof generation for all batches:
 * 1. Reads the batch manifest
 * 2. For each batch: copy Prover.toml → run nargo execute → run bb prove
 * 3. Collects all proofs into target/batches/proofs/
 * 4. Generates a proof manifest for submission
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CIRCUIT_DIR = path.join(__dirname, "../../../circuits/reserve_proof");
const BATCH_DIR = path.join(CIRCUIT_DIR, "target", "batches");
const PROOF_DIR = path.join(BATCH_DIR, "proofs");

interface BatchManifest {
    generatedAt: string;
    totalSerials: number;
    batchSize: number;
    batchCount: number;
    batches: {
        batchNumber: number;
        serialCount: number;
        proverFile: string;
        serials: string[];
    }[];
}

interface ProofManifest {
    generatedAt: string;
    totalSerials: number;
    batchCount: number;
    proofs: {
        batchNumber: number;
        serialCount: number;
        proofFile: string;
        vkFile: string;
        publicInputsFile: string;
        merkleRoot: string;
    }[];
}

function runCommand(cmd: string, cwd: string): string {
    console.log(`   $ ${cmd}`);
    try {
        return execSync(cmd, { 
            cwd, 
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
        });
    } catch (error: any) {
        console.error(`   ❌ Command failed: ${cmd}`);
        if (error.stderr) console.error(`   ${error.stderr}`);
        throw error;
    }
}

async function main() {
    console.log("🚀 Batch Proof Generation\n");
    console.log("=".repeat(60));

    // Check manifest exists
    const manifestPath = path.join(BATCH_DIR, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
        console.error("❌ No batch manifest found. Run 'npm run generate-prover' first.");
        process.exit(1);
    }

    const manifest: BatchManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    console.log(`📦 Found ${manifest.batchCount} batch(es) with ${manifest.totalSerials} total serials`);

    // Create proofs directory
    if (!fs.existsSync(PROOF_DIR)) {
        fs.mkdirSync(PROOF_DIR, { recursive: true });
    }

    const proofManifest: ProofManifest = {
        generatedAt: new Date().toISOString(),
        totalSerials: manifest.totalSerials,
        batchCount: manifest.batchCount,
        proofs: [],
    };

    // Process each batch
    for (const batch of manifest.batches) {
        console.log(`\n${"─".repeat(60)}`);
        console.log(`📋 Processing Batch ${batch.batchNumber}/${manifest.batchCount} (${batch.serialCount} serials)`);
        console.log(`${"─".repeat(60)}`);

        const proverSourcePath = path.join(BATCH_DIR, batch.proverFile);
        const proverDestPath = path.join(CIRCUIT_DIR, "Prover.toml");

        // Step 1: Copy batch Prover.toml to main location
        console.log("\n1️⃣ Copying Prover.toml...");
        fs.copyFileSync(proverSourcePath, proverDestPath);
        console.log(`   ✅ Copied ${batch.proverFile} → Prover.toml`);

        // Step 2: Run nargo execute to generate witness
        console.log("\n2️⃣ Generating witness (nargo execute)...");
        try {
            runCommand("nargo execute", CIRCUIT_DIR);
            console.log("   ✅ Witness generated");
        } catch (error) {
            console.error(`   ❌ Failed to generate witness for batch ${batch.batchNumber}`);
            process.exit(1);
        }

        // Step 3: Generate proof with vk (combined command)
        console.log("\n3️⃣ Generating ZK proof with verification key (bb prove)...");
        const vkPath = path.join(CIRCUIT_DIR, "target", "vk");
        if (fs.existsSync(vkPath)) {
            fs.rmSync(vkPath, { recursive: true, force: true });
        }
        try {
            runCommand(
                "bb prove -b ./target/reserve_proof.json -w ./target/reserve_proof.gz -o ./target --write_vk",
                CIRCUIT_DIR
            );
            console.log("   ✅ Proof and verifying key generated");
        } catch (error) {
            console.error(`   ❌ Failed to generate proof for batch ${batch.batchNumber}`);
            process.exit(1);
        }

        // Step 4: Verify the proof locally
        console.log("\n4️⃣ Verifying proof locally (bb verify)...");
        try {
            runCommand("bb verify -p ./target/proof -k ./target/vk", CIRCUIT_DIR);
            console.log("   ✅ Proof verified!");
        } catch (error) {
            console.error(`   ❌ Proof verification failed for batch ${batch.batchNumber}`);
            process.exit(1);
        }

        // Step 5: Copy proof files to batch-specific names
        const batchProofFile = `proof_batch_${batch.batchNumber}`;
        const batchVkFile = `vk_batch_${batch.batchNumber}`;
        const batchPublicInputsFile = `public_inputs_batch_${batch.batchNumber}`;

        fs.copyFileSync(
            path.join(CIRCUIT_DIR, "target", "proof"),
            path.join(PROOF_DIR, batchProofFile)
        );
        fs.copyFileSync(
            path.join(CIRCUIT_DIR, "target", "vk"),
            path.join(PROOF_DIR, batchVkFile)
        );
        fs.copyFileSync(
            path.join(CIRCUIT_DIR, "target", "public_inputs"),
            path.join(PROOF_DIR, batchPublicInputsFile)
        );

        // Extract merkle root from public inputs
        const publicInputs = fs.readFileSync(path.join(CIRCUIT_DIR, "target", "public_inputs"));
        const merkleRoot = "0x" + publicInputs.slice(0, 32).toString("hex");

        proofManifest.proofs.push({
            batchNumber: batch.batchNumber,
            serialCount: batch.serialCount,
            proofFile: batchProofFile,
            vkFile: batchVkFile,
            publicInputsFile: batchPublicInputsFile,
            merkleRoot,
        });

        console.log(`\n   ✅ Batch ${batch.batchNumber} complete!`);
        console.log(`      Merkle root: ${merkleRoot.substring(0, 20)}...`);
    }

    // Write proof manifest
    const proofManifestPath = path.join(PROOF_DIR, "proof_manifest.json");
    fs.writeFileSync(proofManifestPath, JSON.stringify(proofManifest, null, 2));

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL BATCHES PROVEN SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`   Total serials proven: ${manifest.totalSerials}`);
    console.log(`   Batches:              ${manifest.batchCount}`);
    console.log(`   Proofs directory:     ${PROOF_DIR}`);
    console.log(`   Proof manifest:       ${proofManifestPath}`);
    
    console.log("\n📋 Next step:");
    console.log("   Run: npm run submit-proof");
}

main().catch(console.error);
