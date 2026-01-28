/**
 * Withdraw Route Handler
 *
 * Withdraws SOL from the Privacy Cash pool to a recipient.
 * Uses the user's encryption key (derived from their signature) to access their UTXOs.
 * The Privacy Cash relayer handles transaction signing.
 */

import { Request, Response } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { withdraw, EncryptionService, getUtxos } from 'privacycash/utils';
import { WasmFactory } from '@lightprotocol/hasher.rs';
// @ts-ignore - node-localstorage doesn't have type declarations
import { LocalStorage } from 'node-localstorage';
import path from 'node:path';

// Storage for UTXO caching
const storage = new LocalStorage(path.join(process.cwd(), 'cache'));

export async function withdrawHandler(req: Request, res: Response) {
    try {
        const { lamports, recipientAddress, signatureBase64 } = req.body;

        if (!lamports || !recipientAddress || !signatureBase64) {
            return res.status(400).json({
                success: false,
                error: 'Missing lamports, recipientAddress, or signatureBase64',
            });
        }

        console.log(`[Withdraw] ${lamports} lamports to ${recipientAddress}`);

        // Derive encryption key from user's signature
        const signature = Buffer.from(signatureBase64, 'base64');
        const encryptionService = new EncryptionService();
        encryptionService.deriveEncryptionKeyFromSignature(signature);

        const connection = new Connection(
            process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            'confirmed'
        );

        // We need the user's public key to look up their UTXOs
        // For now, we derive it from the signature context
        // In the full flow, frontend should pass userPublicKey
        const recipient = new PublicKey(recipientAddress);

        // Initialize WASM for hashing
        const lightWasm = await WasmFactory.getInstance();

        // Find circuit files path
        const keyBasePath = path.join(
            process.cwd(),
            'node_modules',
            'privacycash',
            'circuit2',
            'transaction2'
        );

        // First, get the user's UTXOs to find their public key
        // The encryption service has the key to decrypt UTXOs
        // We need the depositor's public key - this should be passed from frontend
        // For now, we'll need to require it in the request

        // Actually, looking at the SDK, withdraw needs the publicKey of the depositor
        // The frontend should pass this. Let me check if it's in the request...
        const { userPublicKey } = req.body;

        if (!userPublicKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing userPublicKey - required to identify UTXOs',
            });
        }

        const publicKey = new PublicKey(userPublicKey);

        console.log(`[Withdraw] User: ${userPublicKey.slice(0, 8)}... -> Recipient: ${recipientAddress.slice(0, 8)}...`);

        // Execute withdrawal using the internal withdraw function
        // The relayer handles signing
        const result = await withdraw({
            lightWasm,
            amount_in_lamports: lamports,
            connection,
            encryptionService,
            publicKey,
            recipient,
            keyBasePath,
            storage,
        });

        res.json({
            success: true,
            tx: result.tx,
            amount_in_lamports: result.amount_in_lamports,
            fee_in_lamports: result.fee_in_lamports,
        });
    } catch (error: any) {
        console.error('Withdraw error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Withdrawal failed',
        });
    }
}
