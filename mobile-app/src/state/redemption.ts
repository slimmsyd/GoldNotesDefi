import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_REDEMPTION_KEY = 'mobile_pending_redemption';

export interface PendingRedemptionState {
  requestId: string;
  amount: number;
  txSignature: string;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry: string;
}

export async function savePendingRedemption(state: PendingRedemptionState): Promise<void> {
  await AsyncStorage.setItem(PENDING_REDEMPTION_KEY, JSON.stringify(state));
}

export async function loadPendingRedemption(): Promise<PendingRedemptionState | null> {
  const raw = await AsyncStorage.getItem(PENDING_REDEMPTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRedemptionState;
  } catch {
    return null;
  }
}

export async function clearPendingRedemption(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_REDEMPTION_KEY);
}
