import { apiClient } from '../api/client';
import {
  AuthChallengeResponse,
  AuthVerifyRequest,
  AuthVerifyResponse,
  CartClearResponse,
  CartGetResponse,
  CartSaveRequest,
  CartSaveResponse,
  PersistedCartItem,
  UserProfileGetResponse,
  UserProfileUpdateRequest,
  UserProfileUpdateResponse,
  OrdersResponse,
  LoyaltyBalanceResponse,
} from '../api/types';
import { createDevHmacSignature } from './dev-signer';
import { saveAuth } from '../../state/auth';
import { markWalletAuthenticated } from '../../state/wallet';

export async function requestAuthChallenge(wallet: string): Promise<AuthChallengeResponse> {
  return apiClient.get<AuthChallengeResponse>(`/api/auth/challenge?wallet=${encodeURIComponent(wallet)}`);
}

export async function verifyAuth(payload: AuthVerifyRequest): Promise<AuthVerifyResponse> {
  return apiClient.post<AuthVerifyResponse>('/api/auth/verify', payload);
}

export async function loginWithDevSigner(wallet: string, devSignerSecret: string): Promise<AuthVerifyResponse> {
  const challenge = await requestAuthChallenge(wallet);
  const signature = createDevHmacSignature(challenge.message, devSignerSecret);

  const result = await verifyAuth({
    wallet: challenge.wallet,
    timestamp: challenge.timestamp,
    nonce: challenge.nonce,
    message: challenge.message,
    method: 'dev_hmac',
    signature,
  });

  await saveAuth({
    token: result.token,
    wallet: result.wallet,
    expiresAt: result.expiresAt,
  });
  await markWalletAuthenticated({
    walletAddress: result.wallet,
    token: result.token,
    expiresAt: result.expiresAt,
    method: 'dev_hmac',
  });

  return result;
}

export async function loginWithWalletSignature(wallet: string): Promise<AuthVerifyResponse> {
  const challenge = await requestAuthChallenge(wallet);
  const { signMessage } = await import('../wallet/mwa');
  const signature = await signMessage(challenge.message, wallet);

  const result = await verifyAuth({
    wallet: challenge.wallet,
    timestamp: challenge.timestamp,
    nonce: challenge.nonce,
    message: challenge.message,
    method: 'solana_ed25519',
    signature,
  });

  await saveAuth({
    token: result.token,
    wallet: result.wallet,
    expiresAt: result.expiresAt,
  });

  await markWalletAuthenticated({
    walletAddress: result.wallet,
    token: result.token,
    expiresAt: result.expiresAt,
    method: 'solana_ed25519',
  });

  return result;
}

export function getUserProfile(): Promise<UserProfileGetResponse> {
  return apiClient.get<UserProfileGetResponse>('/api/user/profile');
}

export function updateUserProfile(payload: UserProfileUpdateRequest): Promise<UserProfileUpdateResponse> {
  return apiClient.post<UserProfileUpdateResponse>('/api/user/profile', payload);
}

export function getOrders(): Promise<OrdersResponse> {
  return apiClient.get<OrdersResponse>('/api/orders');
}

export function getLoyaltyBalance(): Promise<LoyaltyBalanceResponse> {
  return apiClient.get<LoyaltyBalanceResponse>('/api/loyalty/balance');
}

export function getRemoteCart(): Promise<CartGetResponse> {
  return apiClient.get<CartGetResponse>('/api/user/cart');
}

export function saveRemoteCart(cart: PersistedCartItem[] | null): Promise<CartSaveResponse> {
  const payload: CartSaveRequest = { cart };
  return apiClient.post<CartSaveResponse>('/api/user/cart', payload);
}

export function clearRemoteCart(): Promise<CartClearResponse> {
  return apiClient.delete<CartClearResponse>('/api/user/cart');
}
