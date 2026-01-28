/**
 * Privacy Cash Service - CLIENT-SIDE API CLIENT
 * 
 * Connects to the dedicated Privacy Cash Backend (Railway/Render).
 * The backend handles all SDK operations to avoid Vercel filesystem issues.
 */

// Fee constants from Privacy Cash docs
export const PRIVACY_CASH_FEES = {
    DEPOSIT_PERCENT: 0,        // 0% deposit fee
    WITHDRAW_PERCENT: 0.0035,  // 0.35% withdrawal fee
    WITHDRAW_FIXED_SOL: 0.006, // 0.006 SOL fixed fee
};

export type PrivatePaymentStep =
    | 'IDLE'
    | 'SIGNING_KEY'
    | 'CREATING_TRANSACTION'   // Backend creates unsigned tx with ZK proof
    | 'SIGNING_DEPOSIT'        // User signs the deposit transaction
    | 'SUBMITTING_DEPOSIT'     // Backend relays signed transaction
    | 'WAITING_CONFIRMATION'
    | 'PAYING'
    | 'COMPLETE'
    | 'ERROR';

export interface PrivatePaymentState {
    step: PrivatePaymentStep;
    depositTx?: string;
    paymentTx?: string;
    error?: string;
    amountShielded?: number;
}

/**
 * Calculate the total amount needed including Privacy Cash fees
 */
export function calculatePrivacyFee(amountLamports: number): {
    totalNeeded: number;
    withdrawalFee: number;
    netToMerchant: number;
} {
    const fixedFeeLamports = PRIVACY_CASH_FEES.WITHDRAW_FIXED_SOL * 1_000_000_000;
    
    // Solve: netToMerchant = amountDeposited - (amountDeposited * 0.0035) - fixedFee
    const amountRequired = Math.ceil(
        (amountLamports + fixedFeeLamports) / (1 - PRIVACY_CASH_FEES.WITHDRAW_PERCENT)
    );
    
    const withdrawalFee = Math.ceil(amountRequired * PRIVACY_CASH_FEES.WITHDRAW_PERCENT) + fixedFeeLamports;
    
    return {
        totalNeeded: amountRequired,
        withdrawalFee: withdrawalFee,
        netToMerchant: amountLamports,
    };
}

// LocalStorage keys for state persistence (browser-side)
const SHIELDED_STATE_KEY = 'privacy_cash_shielded_state';

export interface ShieldedState {
    depositTx: string;
    amountLamports: number;
    timestamp: number;
    orderId?: string;
}

export function persistShieldedState(state: ShieldedState): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(SHIELDED_STATE_KEY, JSON.stringify(state));
    }
}

export function getPersistedShieldedState(): ShieldedState | null {
    if (typeof window === 'undefined') return null;
    
    const stored = localStorage.getItem(SHIELDED_STATE_KEY);
    if (!stored) return null;
    
    try {
        const state = JSON.parse(stored) as ShieldedState;
        // Expire after 24 hours
        if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
            clearPersistedShieldedState();
            return null;
        }
        return state;
    } catch {
        return null;
    }
}

export function clearPersistedShieldedState(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(SHIELDED_STATE_KEY);
    }
}

// API Response types
interface DepositResponse {
    success: boolean;
    tx?: string;
    error?: string;
}

interface WithdrawResponse {
    success: boolean;
    tx?: string;
    amount_in_lamports?: number;
    fee_in_lamports?: number;
    error?: string;
}

interface HotWalletResponse {
    success: boolean;
    address?: string;
    error?: string;
}

// Split-signing flow response types
interface CreateDepositResponse {
    success: boolean;
    unsignedTransaction?: string;
    message?: string;
    error?: string;
}

interface SubmitDepositResponse {
    success: boolean;
    tx?: string;
    error?: string;
}

interface BalanceResponse {
    success: boolean;
    balance?: number;
    error?: string;
}

// Backend URL configuration
// Default to localhost for development, update env var for production
const API_BASE_URL = process.env.NEXT_PUBLIC_PRIVACY_CASH_API || 'http://localhost:3001';

/**
 * Call the deposit API endpoint on the backend
 */
export async function depositViaApi(params: {
    lamports: number;
    signatureBase64: string;
}): Promise<DepositResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || response.statusText);
        }
        
        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Call the withdraw API endpoint on the backend
 */
export async function withdrawViaApi(params: {
    lamports: number;
    recipientAddress: string;
    signatureBase64: string;
    userPublicKey: string;
}): Promise<WithdrawResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || response.statusText);
        }

        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Get the hot wallet public address from the backend
 * (Legacy - not needed for full privacy flow)
 */
export async function getHotWalletAddress(): Promise<HotWalletResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/hot-wallet-address`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || response.statusText);
        }

        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ============================================
// SPLIT-SIGNING FLOW (Full Privacy)
// ============================================

/**
 * Step 1: Create unsigned deposit transaction
 *
 * Backend generates ZK proof and creates the transaction.
 * User must sign it in their wallet.
 */
export async function createDepositTransaction(params: {
    lamports: number;
    userPublicKey: string;
    signatureBase64: string;
}): Promise<CreateDepositResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || response.statusText);
        }

        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Step 2: Submit user-signed deposit transaction
 *
 * After user signs the transaction, relay it to Privacy Cash.
 */
export async function submitSignedDeposit(params: {
    signedTransaction: string;
    userPublicKey: string;
}): Promise<SubmitDepositResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || response.statusText);
        }

        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Get user's private balance in the Privacy Cash pool
 */
export async function getPrivateBalance(params: {
    userPublicKey: string;
    signatureBase64: string;
}): Promise<BalanceResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error || response.statusText);
        }

        return response.json();
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
