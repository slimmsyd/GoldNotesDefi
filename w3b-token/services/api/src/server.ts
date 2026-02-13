import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { timingSafeEqual } from 'crypto';
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

const isProduction = process.env.NODE_ENV === "production";
const serviceApiSecret = process.env.SERVICE_API_SECRET;

if (isProduction && !serviceApiSecret) {
    throw new Error("Missing required production env var: SERVICE_API_SECRET");
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    if (left.length !== right.length) {
        return false;
    }

    return timingSafeEqual(left, right);
}

function extractBearerToken(req: express.Request): string | null {
    const authHeader = req.header("authorization");
    if (!authHeader) return null;

    const [scheme, token] = authHeader.split(" ");
    if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
        return null;
    }

    return token;
}

const requireServiceAuth: express.RequestHandler = (req, res, next) => {
    if (!serviceApiSecret) {
        res.status(500).json({ error: "Service auth misconfigured" });
        return;
    }

    const token = extractBearerToken(req);
    if (!token || !safeEqual(token, serviceApiSecret)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    next();
};

// --- Routes ---

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
});

/**
 * POST /api/v1/goldback/new_batch
 * Receives a batch of new serial numbers from Goldback Inc. (Simulated)
 */
app.post('/api/v1/goldback/new_batch', requireServiceAuth, async (req, res) => {
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

// ==================== REDEMPTION ENDPOINTS ====================

/**
 * POST /api/v1/redemption/create
 * Called after a user burns W3B on-chain. Stores shipping details off-chain.
 */
app.post('/api/v1/redemption/create', async (req, res) => {
    try {
        const {
            user_wallet,
            request_id,
            amount,
            burn_tx_hash,
            shipping_name,
            shipping_address,
            shipping_city,
            shipping_state,
            shipping_zip,
            shipping_country,
        } = req.body;

        if (!user_wallet || request_id === undefined || !amount) {
            res.status(400).json({ error: 'user_wallet, request_id, and amount are required.' });
            return;
        }

        const result = await pool.query(
            `INSERT INTO redemption_requests (
                user_wallet, request_id, amount, status, burn_tx_hash,
                shipping_name, shipping_address, shipping_city,
                shipping_state, shipping_zip, shipping_country
            ) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_wallet, request_id) DO UPDATE SET
                burn_tx_hash = COALESCE(EXCLUDED.burn_tx_hash, redemption_requests.burn_tx_hash),
                shipping_name = COALESCE(EXCLUDED.shipping_name, redemption_requests.shipping_name),
                shipping_address = COALESCE(EXCLUDED.shipping_address, redemption_requests.shipping_address),
                shipping_city = COALESCE(EXCLUDED.shipping_city, redemption_requests.shipping_city),
                shipping_state = COALESCE(EXCLUDED.shipping_state, redemption_requests.shipping_state),
                shipping_zip = COALESCE(EXCLUDED.shipping_zip, redemption_requests.shipping_zip),
                shipping_country = COALESCE(EXCLUDED.shipping_country, redemption_requests.shipping_country)
            RETURNING *`,
            [
                user_wallet, request_id, amount, burn_tx_hash || null,
                shipping_name || null, shipping_address || null, shipping_city || null,
                shipping_state || null, shipping_zip || null, shipping_country || 'US',
            ]
        );

        console.log(`[Redemption] Created request #${request_id} for ${amount} W3B from ${user_wallet}`);

        res.json({
            success: true,
            redemption: result.rows[0],
        });
    } catch (error: any) {
        console.error('Error creating redemption:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/redemption/pending
 * Lists pending redemption requests available for P2P fulfillers to claim.
 */
app.get('/api/v1/redemption/pending', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id, user_wallet, request_id, amount, status,
                shipping_city, shipping_state, shipping_country,
                created_at
            FROM redemption_requests
            WHERE status = 0
            ORDER BY created_at ASC`
        );

        res.json({
            success: true,
            count: result.rows.length,
            requests: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching pending redemptions:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * GET /api/v1/redemption/status/:wallet
 * Get all redemption requests for a specific user wallet.
 */
app.get('/api/v1/redemption/status/:wallet', async (req, res) => {
    try {
        const { wallet } = req.params;

        const result = await pool.query(
            `SELECT * FROM redemption_requests
             WHERE user_wallet = $1
             ORDER BY created_at DESC`,
            [wallet]
        );

        res.json({
            success: true,
            count: result.rows.length,
            requests: result.rows,
        });
    } catch (error: any) {
        console.error('Error fetching user redemptions:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * PATCH /api/v1/redemption/:id/claim
 * Update a redemption request when it's claimed on-chain by a fulfiller.
 */
app.patch('/api/v1/redemption/:id/claim', requireServiceAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { fulfiller_wallet, claim_tx_hash } = req.body;

        if (!fulfiller_wallet) {
            res.status(400).json({ error: 'fulfiller_wallet is required.' });
            return;
        }

        const result = await pool.query(
            `UPDATE redemption_requests
             SET status = 1,
                 fulfiller_wallet = $1,
                 claim_tx_hash = $2,
                 claimed_at = NOW()
             WHERE id = $3 AND status = 0
             RETURNING *`,
            [fulfiller_wallet, claim_tx_hash || null, id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Redemption not found or not in Pending status.' });
            return;
        }

        res.json({ success: true, redemption: result.rows[0] });
    } catch (error: any) {
        console.error('Error claiming redemption:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * PATCH /api/v1/redemption/:id/confirm
 * Update a redemption request when delivery is confirmed on-chain.
 */
app.patch('/api/v1/redemption/:id/confirm', requireServiceAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { confirm_tx_hash, tracking_number } = req.body;

        const result = await pool.query(
            `UPDATE redemption_requests
             SET status = 3,
                 confirm_tx_hash = $1,
                 tracking_number = COALESCE($2, tracking_number),
                 confirmed_at = NOW()
             WHERE id = $3 AND status = 1
             RETURNING *`,
            [confirm_tx_hash || null, tracking_number || null, id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Redemption not found or not in Claimed status.' });
            return;
        }

        res.json({ success: true, redemption: result.rows[0] });
    } catch (error: any) {
        console.error('Error confirming redemption:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

/**
 * PATCH /api/v1/redemption/:id/cancel
 * Cancel a redemption request (Admin only — no auth middleware yet).
 */
app.patch('/api/v1/redemption/:id/cancel', requireServiceAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE redemption_requests
             SET status = 4, cancelled_at = NOW()
             WHERE id = $1 AND status IN (0, 1)
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Redemption not found or cannot be cancelled.' });
            return;
        }

        res.json({ success: true, redemption: result.rows[0] });
    } catch (error: any) {
        console.error('Error cancelling redemption:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`W3B Backend running on port ${PORT}`);
});
