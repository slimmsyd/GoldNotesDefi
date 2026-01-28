// services/api/index.js
// MVP Technical Implementation: Proof of Unique Asset Reserve

const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Middleware: Authenticate Goldback Inc. API calls
const authenticateGoldbackInc = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.GOLDBACK_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// POST /api/v1/goldback/new_batch
// Called by Goldback Inc. when they produce a new batch
app.post('/api/v1/goldback/new_batch', authenticateGoldbackInc, async (req, res) => {
    const { batchId, serials } = req.body;
    
    // 1. Validate the batch
    if (!Array.isArray(serials) || serials.length === 0) {
        return res.status(400).json({ error: 'Invalid batch: serials must be a non-empty array' });
    }
    
    try {
        // 2. Insert serials into database
        const insertPromises = serials.map(serial => {
            const leafHash = crypto.createHash('sha256').update(serial).digest();
            return pool.query(
                `INSERT INTO goldback_serials (serial_number, batch_id, merkle_leaf_hash) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (serial_number) DO NOTHING`,
                [serial, batchId, leafHash]
            );
        });
        await Promise.all(insertPromises);
        
        // 3. Get all serials and compute Merkle root
        const allSerials = await pool.query(
            'SELECT merkle_leaf_hash FROM goldback_serials ORDER BY id'
        );
        const merkleRoot = computeMerkleRoot(allSerials.rows.map(r => r.merkle_leaf_hash));
        
        // 4. Store the new Merkle root
        // Note: In production, this would also anchor on-chain via RPC
        await pool.query(
            `INSERT INTO merkle_roots (root_hash, total_serials) 
             VALUES ($1, $2)
             ON CONFLICT (root_hash) DO NOTHING`,
            [merkleRoot, allSerials.rows.length]
        );
        
        // 5. Update serials with their root inclusion
        await pool.query(
            'UPDATE goldback_serials SET included_in_root = $1 WHERE batch_id = $2',
            [merkleRoot, batchId]
        );
        
        res.json({
            success: true,
            batchId,
            serialsIngested: serials.length,
            newMerkleRoot: merkleRoot,
            totalSerials: allSerials.rows.length
        });
        
    } catch (error) {
        console.error('Error ingesting batch:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/v1/reserve/status
// Public endpoint to check current reserve status
app.get('/api/v1/reserve/status', async (req, res) => {
    try {
        const serialCount = await pool.query('SELECT COUNT(*) as count FROM goldback_serials');
        const latestRoot = await pool.query(
            'SELECT * FROM merkle_roots ORDER BY anchored_at DESC LIMIT 1'
        );
        const latestProof = await pool.query(
            'SELECT * FROM proof_submissions ORDER BY submitted_at DESC LIMIT 1'
        );
        
        res.json({
            totalSerials: parseInt(serialCount.rows[0].count),
            currentMerkleRoot: latestRoot.rows[0]?.root_hash || null,
            lastRootUpdate: latestRoot.rows[0]?.anchored_at || null,
            lastProofSubmission: latestProof.rows[0]?.submitted_at || null,
            proofVerified: latestProof.rows[0]?.verified || false
        });
    } catch (error) {
        console.error('Error fetching status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper: Compute Merkle root from leaf hashes
function computeMerkleRoot(leaves) {
    if (leaves.length === 0) return '0'.repeat(64);
    
    // Hash pairs iteratively until we get root
    let layer = leaves.map(l => Buffer.isBuffer(l) ? l : Buffer.from(l, 'hex'));
    
    while (layer.length > 1) {
        const nextLayer = [];
        for (let i = 0; i < layer.length; i += 2) {
            const left = layer[i];
            const right = layer[i + 1] || left; // Duplicate if odd
            const combined = crypto.createHash('sha256')
                .update(Buffer.concat([left, right]))
                .digest();
            nextLayer.push(combined);
        }
        layer = nextLayer;
    }
    
    return layer[0].toString('hex');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`W3B Reserve API running on port ${PORT}`);
});

module.exports = app;
