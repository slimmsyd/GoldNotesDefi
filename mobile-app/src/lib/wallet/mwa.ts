import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { env } from '../../config/env';

const APP_IDENTITY = {
  name: 'GoldBack Mobile',
  uri: 'https://wgbs.fun',
};

let cachedWalletAddress: string | null = null;
let cachedAuthToken: string | null = null;

interface AuthorizeResult {
  walletAddress: string;
  accountAddressBase64: string;
  authToken: string;
  walletUriBase: string;
}

export interface WalletConnectResult {
  walletAddress: string;
  authToken: string;
  walletUriBase: string;
}

function clusterFromEnv(): 'devnet' | 'testnet' | 'mainnet-beta' {
  if (env.solanaNetwork === 'mainnet-beta') return 'mainnet-beta';
  if (env.solanaNetwork === 'testnet') return 'testnet';
  return 'devnet';
}

function toWalletAddress(base64Address: string): string {
  const bytes = Buffer.from(base64Address, 'base64');
  return new PublicKey(bytes).toBase58();
}

async function authorizeWallet(
  wallet: Web3MobileWallet,
  expectedWalletAddress?: string
): Promise<AuthorizeResult> {
  const auth = await wallet.authorize({
    identity: APP_IDENTITY,
    cluster: clusterFromEnv(),
  });

  const account = auth.accounts[0];
  if (!account) {
    throw new Error('Wallet did not return an authorized account');
  }

  const walletAddress = toWalletAddress(account.address);
  if (expectedWalletAddress && expectedWalletAddress !== walletAddress) {
    throw new Error('Connected wallet address changed unexpectedly');
  }

  cachedWalletAddress = walletAddress;
  cachedAuthToken = auth.auth_token;

  return {
    walletAddress,
    accountAddressBase64: account.address,
    authToken: auth.auth_token,
    walletUriBase: auth.wallet_uri_base,
  };
}

export async function connectWallet(): Promise<WalletConnectResult> {
  return transact(async (wallet) => {
    const auth = await authorizeWallet(wallet);
    return {
      walletAddress: auth.walletAddress,
      authToken: auth.authToken,
      walletUriBase: auth.walletUriBase,
    };
  });
}

export async function disconnectWallet(authToken?: string | null): Promise<void> {
  const token = authToken || cachedAuthToken;
  if (!token) {
    cachedWalletAddress = null;
    return;
  }

  await transact(async (wallet) => {
    await wallet.deauthorize({ auth_token: token });
  });

  cachedWalletAddress = null;
  cachedAuthToken = null;
}

export async function signMessage(message: string, expectedWalletAddress?: string): Promise<string> {
  return transact(async (wallet) => {
    const auth = await authorizeWallet(wallet, expectedWalletAddress);
    const payload = new TextEncoder().encode(message);
    const signatures = await wallet.signMessages({
      addresses: [auth.accountAddressBase64],
      payloads: [payload],
    });

    if (!signatures[0]) {
      throw new Error('Wallet returned an empty message signature');
    }

    return Buffer.from(signatures[0]).toString('base64');
  });
}

export async function signAndSendTransaction(
  transaction: Transaction,
  expectedWalletAddress?: string
): Promise<string> {
  return transact(async (wallet) => {
    await authorizeWallet(wallet, expectedWalletAddress);
    const signatures = await wallet.signAndSendTransactions({
      transactions: [transaction],
      commitment: 'confirmed',
    });

    if (!signatures[0]) {
      throw new Error('Wallet did not return a transaction signature');
    }

    return signatures[0];
  });
}

export function getWalletAddress(): string | null {
  return cachedWalletAddress;
}
