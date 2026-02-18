import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_DIRECT_CHECKOUT_KEY = 'mobile_pending_direct_checkout';

export interface PendingDirectCheckout {
  orderId: string;
  txSignature: string;
}

export async function savePendingDirectCheckout(pending: PendingDirectCheckout): Promise<void> {
  await AsyncStorage.setItem(PENDING_DIRECT_CHECKOUT_KEY, JSON.stringify(pending));
}

export async function loadPendingDirectCheckout(): Promise<PendingDirectCheckout | null> {
  const raw = await AsyncStorage.getItem(PENDING_DIRECT_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingDirectCheckout;
  } catch {
    return null;
  }
}

export async function clearPendingDirectCheckout(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_DIRECT_CHECKOUT_KEY);
}
