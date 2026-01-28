/**
 * Deposit Service - Split-Signing Implementation
 *
 * Creates unsigned deposit transactions that users can sign in their browser wallets.
 * This enables TRUE privacy where the user's wallet deposits directly into the privacy pool.
 *
 * Flow:
 * 1. User signs message → Backend derives encryption key
 * 2. Backend creates unsigned transaction (with ZK proof)
 * 3. User signs transaction in browser wallet
 * 4. Backend relays signed transaction to Privacy Cash
 */

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { deposit, EncryptionService, getUtxos } from 'privacycash/utils';
import { WasmFactory } from '@lightprotocol/hasher.rs';
// @ts-ignore - node-localstorage doesn't have type declarations
import { LocalStorage } from 'node-localstorage';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage for UTXO caching (per-user, keyed by their public key)
const storage = new LocalStorage(path.join(process.cwd(), 'cache'));

// Privacy Cash relayer API
const RELAYER_API_URL = process.env.RELAYER_API_URL || 'https://api3.privacycash.org';

/**
 * Creates an unsigned deposit transaction for the user to sign.
 * The ZK proof is generated server-side, but the transaction requires user signature.
 */
export async function createUnsignedDepositTransaction(params: {
    lamports: number;
    userPublicKey: string;
    signatureBase64: string;
}): Promise<{ unsignedTransaction: string; message: string }> {
    const { lamports, userPublicKey, signatureBase64 } = params;

    console.log(`Creating unsigned deposit: ${lamports} lamports for ${userPublicKey}`);

    // Derive encryption key from user's signature
    const signature = Buffer.from(signatureBase64, 'base64');
    const encryptionService = new EncryptionService();
    encryptionService.deriveEncryptionKeyFromSignature(signature);

    const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
    );
    const publicKey = new PublicKey(userPublicKey);

    // Initialize WASM for hashing
    const lightWasm = await WasmFactory.getInstance();

    // Container to capture the unsigned transaction
    const txContainer: { tx: VersionedTransaction | null } = { tx: null };

    // Find circuit files path
    const keyBasePath = path.join(
        process.cwd(),
        'node_modules',
        'privacycash',
        'circuit2',
        'transaction2'
    );

    // Call deposit with a custom signer that captures the transaction and throws to stop relay
    try {
        await deposit({
            lightWasm,
            amount_in_lamports: lamports,
            connection,
            encryptionService,
            publicKey,
            signer: publicKey, // User is the signer
            transactionSigner: async (tx: VersionedTransaction) => {
                // Capture the transaction
                txContainer.tx = tx;
                console.log('[Deposit Create] Transaction captured, stopping SDK relay...');
                // Throw to prevent SDK from continuing to relay
                throw new Error('TRANSACTION_CAPTURED');
            },
            keyBasePath,
            storage,
        });
    } catch (error: any) {
        // We expect TRANSACTION_CAPTURED error - that means we successfully captured the tx
        if (error.message === 'TRANSACTION_CAPTURED' && txContainer.tx) {
            console.log('[Deposit Create] Successfully captured unsigned transaction');
        } else if (!txContainer.tx) {
            // Real error before transaction was created
            throw error;
        } else {
            // Some other error but we have the transaction
            console.log('[Deposit Create] Captured transaction despite error:', error.message);
        }
    }

    if (!txContainer.tx) {
        throw new Error('Failed to create deposit transaction - no transaction captured');
    }

    // Serialize the unsigned transaction for frontend
    const serialized = Buffer.from(txContainer.tx.serialize()).toString('base64');

    console.log(`Unsigned transaction created, size: ${serialized.length} bytes`);

    return {
        unsignedTransaction: serialized,
        message: 'Transaction created. Please sign with your wallet.',
    };
}

/**
 * Relays a user-signed deposit transaction to the Privacy Cash relayer.
 */
export async function relaySignedDeposit(params: {
    signedTransaction: string;
    userPublicKey: string;
}): Promise<{ tx: string }> {
    const { signedTransaction, userPublicKey } = params;

    console.log(`Relaying signed deposit for ${userPublicKey}`);

    const response = await fetch(`${RELAYER_API_URL}/deposit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            signedTransaction,
            senderAddress: userPublicKey,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Relayer error:', errorText);
        throw new Error(`Deposit relay failed: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as { signature: string; success: boolean };

    if (!result.success) {
        throw new Error('Deposit relay returned success: false');
    }

    console.log(`Deposit relayed successfully: ${result.signature}`);

    return { tx: result.signature };
}

/**
 * Gets the user's private balance (UTXOs) using their encryption key.
 */
export async function getUserPrivateBalance(params: {
    userPublicKey: string;
    signatureBase64: string;
}): Promise<{ balance: number }> {
    const { userPublicKey, signatureBase64 } = params;

    // Derive encryption key from user's signature
    const signature = Buffer.from(signatureBase64, 'base64');
    const encryptionService = new EncryptionService();
    encryptionService.deriveEncryptionKeyFromSignature(signature);

    const connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        'confirmed'
    );
    const publicKey = new PublicKey(userPublicKey);

    const utxos = await getUtxos({
        publicKey,
        connection,
        encryptionService,
        storage,
    });

    // Sum up UTXO balances
    const balance = utxos.reduce((sum, utxo) => sum + utxo.amount.toNumber(), 0);

    return { balance };
}
