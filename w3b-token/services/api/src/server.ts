import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { buildMerkleTree, hashSerial } from './merkle';

// Load .env from the w3b-token root directory
// Path: src/ -> api/ -> services/ -> w3b-token/.env
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

// --- Routes ---

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
});

/**
 * POST /api/v1/goldback/new_batch
 * Receives a batch of new serial numbers from Goldback Inc. (Simulated)
 */
app.post('/api/v1/goldback/new_batch', async (req, res) => {
    try {
        const { batchId, serials } = req.body;

        if (!batchId || !Array.isArray(serials) || serials.length === 0) {
             res.status(400).json({ error: 'Invalid batch data. batchId and serials array required.' });
             return;
        }

        console.log(`[Batch ${batchId}] Received ${serials.length} new serials.`);

        // 1. Insert serials into DB (idempotent - ignore duplicates)
        // using a transaction to ensure atomicity
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            for (const serial of serials) {
                const leafHash = hashSerial(serial);
                // Postgres requires bytea to be hex string usually or buffer, pg driver handles buffer well
                await client.query(
                    `INSERT INTO goldback_serials (serial_number, batch_id, merkle_leaf_hash) 
                     VALUES ($1, $2, $3) 
                     ON CONFLICT (serial_number) DO NOTHING`,
                    [serial, batchId, leafHash]
                );
            }

            // 2. Re-calculate Global Merkle Root
            // Fetch ALL serials to build the complete tree
            // In production, you might optimize this (incremental updates), but for MVP, rebuilding is safest/simplest.
            const result = await client.query('SELECT serial_number FROM goldback_serials ORDER BY serial_number');
            const allSerials = result.rows.map(row => row.serial_number);
            
            console.log(`Building Merkle Tree with ${allSerials.length} total items...`);
            
            const tree = buildMerkleTree(allSerials);
            const newRoot = tree.getHexRoot();

            console.log(`New Merkle Root: ${newRoot}`);

            // 3. Anchor to DB history
            await client.query(
                `INSERT INTO merkle_roots (root_hash, total_serials, status)
                 VALUES ($1, $2, 'pending_anchor')
                 ON CONFLICT (root_hash) DO NOTHING`,
                [newRoot, allSerials.length]
            );

            await client.query('COMMIT');

            // TODO: Trigger Solana Transaction here
            // await updateOnChainRoot(newRoot, allSerials.length);

            res.json({
                success: true,
                batchId,
                totalSerials: allSerials.length,
                newMerkleRoot: newRoot,
                message: 'Batch processed and Merkle Root updated.'
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error('Error processing batch:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`W3B Backend running on port ${PORT}`);
});
