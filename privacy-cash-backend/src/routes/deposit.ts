/**
 * Deposit Route Handlers - Split-Signing Flow
 *
 * Implements the two-step deposit process for true privacy:
 * 1. POST /api/deposit/create - Creates unsigned transaction with ZK proof
 * 2. POST /api/deposit/submit - Relays user-signed transaction to Privacy Cash
 */

import { Request, Response } from 'express';
import {
    createUnsignedDepositTransaction,
    relaySignedDeposit,
    getUserPrivateBalance,
} from '../lib/deposit-service.js';

/**
 * Step 1: Create an unsigned deposit transaction
 *
 * The backend generates the ZK proof and creates the transaction,
 * but the user must sign it in their wallet.
 */
export async function createDepositHandler(req: Request, res: Response) {
    try {
        const { lamports, userPublicKey, signatureBase64 } = req.body;

        if (!lamports || !userPublicKey || !signatureBase64) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: lamports, userPublicKey, signatureBase64',
            });
        }

        if (typeof lamports !== 'number' || lamports <= 0) {
            return res.status(400).json({
                success: false,
                error: 'lamports must be a positive number',
            });
        }

        console.log(`[Deposit Create] ${lamports} lamports for ${userPublicKey.slice(0, 8)}...`);

        const result = await createUnsignedDepositTransaction({
            lamports,
            userPublicKey,
            signatureBase64,
        });

        res.json({
            success: true,
            unsignedTransaction: result.unsignedTransaction,
            message: result.message,
        });
    } catch (error: any) {
        console.error('Create deposit error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create deposit transaction',
        });
    }
}

/**
 * Step 2: Submit a user-signed deposit transaction
 *
 * After the user signs the transaction in their wallet,
 * we relay it to the Privacy Cash relayer.
 */
export async function submitDepositHandler(req: Request, res: Response) {
    try {
        const { signedTransaction, userPublicKey } = req.body;

        if (!signedTransaction || !userPublicKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: signedTransaction, userPublicKey',
            });
        }

        console.log(`[Deposit Submit] Relaying signed transaction for ${userPublicKey.slice(0, 8)}...`);

        const result = await relaySignedDeposit({
            signedTransaction,
            userPublicKey,
        });

        res.json({
            success: true,
            tx: result.tx,
        });
    } catch (error: any) {
        console.error('Submit deposit error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit deposit transaction',
        });
    }
}

/**
 * Get user's private balance in the privacy pool
 */
export async function getBalanceHandler(req: Request, res: Response) {
    try {
        const { userPublicKey, signatureBase64 } = req.body;

        if (!userPublicKey || !signatureBase64) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: userPublicKey, signatureBase64',
            });
        }

        const result = await getUserPrivateBalance({
            userPublicKey,
            signatureBase64,
        });

        res.json({
            success: true,
            balance: result.balance,
        });
    } catch (error: any) {
        console.error('Get balance error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get private balance',
        });
    }
}

// Legacy handler for backwards compatibility (will be removed)
export async function depositHandler(req: Request, res: Response) {
    return res.status(410).json({
        success: false,
        error: 'This endpoint is deprecated. Use /api/deposit/create and /api/deposit/submit instead.',
    });
}
