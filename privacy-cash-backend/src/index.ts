/**
 * Privacy Cash Backend Server
 * 
 * Dedicated Express server for Privacy Cash SDK operations.
 * Deploy to Railway, Render, or any Node.js hosting.
 */

import express from 'express';
import cors from 'cors';
import { createDepositHandler, submitDepositHandler, getBalanceHandler, depositHandler } from './routes/deposit.js';
import { withdrawHandler } from './routes/withdraw.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Simplified for debugging
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
}));

// Enable pre-flight requests for all routes
app.options('*', cors());


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
