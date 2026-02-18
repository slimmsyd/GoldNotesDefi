import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'mobile_auth_token';
const AUTH_WALLET_KEY = 'mobile_auth_wallet';
const AUTH_EXPIRES_AT_KEY = 'mobile_auth_expires_at';

export interface StoredAuth {
  token: string;
  wallet: string;
  expiresAt: string;
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  await AsyncStorage.multiSet([
    [AUTH_TOKEN_KEY, auth.token],
    [AUTH_WALLET_KEY, auth.wallet],
    [AUTH_EXPIRES_AT_KEY, auth.expiresAt],
  ]);
}

export async function getAuth(): Promise<StoredAuth | null> {
  const values = await AsyncStorage.multiGet([
    AUTH_TOKEN_KEY,
    AUTH_WALLET_KEY,
    AUTH_EXPIRES_AT_KEY,
  ]);

  const token = values.find(([k]) => k === AUTH_TOKEN_KEY)?.[1] || null;
  const wallet = values.find(([k]) => k === AUTH_WALLET_KEY)?.[1] || null;
  const expiresAt = values.find(([k]) => k === AUTH_EXPIRES_AT_KEY)?.[1] || null;

  if (!token || !wallet || !expiresAt) return null;
  return { token, wallet, expiresAt };
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_WALLET_KEY, AUTH_EXPIRES_AT_KEY]);
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}
