import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = 'mobile_cart_items';

export interface CartItem {
  id: string;
  name: string;
  price: string;
  image?: string;
  quantity: number;
  source: 'direct' | 'amazon';
}

export async function saveCart(items: CartItem[]): Promise<void> {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
}

export async function loadCart(): Promise<CartItem[]> {
  const raw = await AsyncStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

export async function clearCart(): Promise<void> {
  await AsyncStorage.removeItem(CART_KEY);
}
