/**
 * Privacy Cash Backend Server
 *
 * Dedicated Express server for Privacy Cash SDK operations.
 * Deploy to Railway, Render, or any Node.js hosting.
 */

import express from 'express';
import cors, { CorsOptions } from 'cors';
import { createDepositHandler, submitDepositHandler, getBalanceHandler } from './routes/deposit.js';
import { withdrawHandler } from './routes/withdraw.js';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

function parseAllowedOrigins(value: string | undefined): Set<string> {
    return new Set(
        (value || '')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
    );
}

const allowedOrigins = parseAllowedOrigins(process.env.PRIVACY_ALLOWED_ORIGINS);

if (isProduction && allowedOrigins.size === 0) {
    throw new Error('Missing required production env var: PRIVACY_ALLOWED_ORIGINS');
}

const corsOptions: CorsOptions = {
    origin(origin, callback) {
        // Allow non-browser requests (no Origin header).
        if (!origin) {
            callback(null, true);
            return;
        }

        if (!isProduction) {
            callback(null, true);
            return;
        }

        if (allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes - Split-signing deposit flow (for true privacy)
app.post('/api/deposit/create', createDepositHandler);   // Step 1: Create unsigned tx
app.post('/api/deposit/submit', submitDepositHandler);   // Step 2: Submit signed tx
app.post('/api/deposit/balance', getBalanceHandler);     // Check private balance

// Withdraw (uses relayer signing)
app.post('/api/withdraw', withdrawHandler);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: err.message });
});

app.listen(PORT, () => {
    console.log(`Privacy Cash backend running on port ${PORT}`);
});
