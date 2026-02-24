import { VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

const DEFAULT_JUPITER_QUOTE_URL = 'https://quote-api.jup.ag/v6/quote';
const DEFAULT_JUPITER_SWAP_URL = 'https://quote-api.jup.ag/v6/swap';

const JUPITER_QUOTE_URL =
  process.env.NEXT_PUBLIC_JUPITER_QUOTE_URL || DEFAULT_JUPITER_QUOTE_URL;
const JUPITER_SWAP_URL =
  process.env.NEXT_PUBLIC_JUPITER_SWAP_URL || DEFAULT_JUPITER_SWAP_URL;

export interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan?: unknown[];
}

export interface UsdcToSolQuoteResult {
  quote: JupiterQuoteResponse;
  fetchedAtMs: number;
}

const parseErrorMessage = async (res: Response): Promise<string> => {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error;
    if (typeof body?.message === 'string') return body.message;
    return `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
};

export async function getUsdcToSolQuote(params: {
  inputMint: string;
  outputMint: string;
  inputAmountBaseUnits: bigint;
  slippageBps: number;
}): Promise<UsdcToSolQuoteResult> {
  const search = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.inputAmountBaseUnits.toString(),
    slippageBps: String(params.slippageBps),
    swapMode: 'ExactIn',
    onlyDirectRoutes: 'false',
  });

  const res = await fetch(`${JUPITER_QUOTE_URL}?${search.toString()}`);
  if (!res.ok) {
    const detail = await parseErrorMessage(res);
    throw new Error(`Quote unavailable: ${detail}`);
  }

  const quote = (await res.json()) as JupiterQuoteResponse;
  if (!quote?.outAmount) {
    throw new Error('Route unavailable on the current network');
  }

  if (Array.isArray(quote.routePlan) && quote.routePlan.length === 0) {
    throw new Error('No USDC -> SOL route available right now');
  }

  return {
    quote,
    fetchedAtMs: Date.now(),
  };
}

export async function buildUsdcToSolSwapTx(params: {
  quote: JupiterQuoteResponse;
  userPublicKey: string;
}): Promise<VersionedTransaction> {
  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quoteResponse: params.quote,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });

  if (!res.ok) {
    const detail = await parseErrorMessage(res);
    throw new Error(`Swap transaction build failed: ${detail}`);
  }

  const payload = await res.json();
  if (!payload?.swapTransaction || typeof payload.swapTransaction !== 'string') {
    throw new Error('Swap transaction payload missing from Jupiter response');
  }

  const serialized = Buffer.from(payload.swapTransaction, 'base64');
  return VersionedTransaction.deserialize(serialized);
}
