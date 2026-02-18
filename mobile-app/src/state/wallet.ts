import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthVerifyMethod, WalletSessionState } from '../lib/api/types';

const WALLET_SESSION_KEY = 'mobile_wallet_session';

const DEFAULT_SESSION: WalletSessionState = {
  walletAddress: null,
  authToken: null,
  authMethod: null,
  authTokenExpiresAt: null,
  connectedAt: null,
  lastAuthAt: null,
};

export async function loadWalletSession(): Promise<WalletSessionState> {
  const raw = await AsyncStorage.getItem(WALLET_SESSION_KEY);
  if (!raw) return { ...DEFAULT_SESSION };

  try {
    const parsed = JSON.parse(raw) as WalletSessionState;
    return {
      ...DEFAULT_SESSION,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SESSION };
  }
}

export async function saveWalletSession(session: WalletSessionState): Promise<void> {
  await AsyncStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
}

export async function clearWalletSession(): Promise<void> {
  await AsyncStorage.removeItem(WALLET_SESSION_KEY);
}

export async function markWalletConnected(walletAddress: string, authToken?: string): Promise<WalletSessionState> {
  const current = await loadWalletSession();
  const updated: WalletSessionState = {
    ...current,
    walletAddress,
    authToken: authToken || current.authToken,
    connectedAt: new Date().toISOString(),
  };
  await saveWalletSession(updated);
  return updated;
}

export async function markWalletAuthenticated(input: {
  walletAddress: string;
  token: string;
  expiresAt: string;
  method: AuthVerifyMethod;
}): Promise<WalletSessionState> {
  const current = await loadWalletSession();
  const now = new Date().toISOString();
  const updated: WalletSessionState = {
    ...current,
    walletAddress: input.walletAddress,
    authToken: input.token,
    authMethod: input.method,
    authTokenExpiresAt: input.expiresAt,
    connectedAt: current.connectedAt || now,
    lastAuthAt: now,
  };
  await saveWalletSession(updated);
  return updated;
}
