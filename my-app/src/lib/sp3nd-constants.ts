// SP3ND Partner API Configuration
// Documentation: https://www.sp3nd.shop/partner-api/docs

export const SP3ND_BASE_URL = "https://us-central1-sp3nddotshop-prod.cloudfunctions.net";

// SP3ND Treasury Wallet - All payments for Amazon items go here
export const SP3ND_TREASURY_WALLET = process.env.NEXT_PUBLIC_SP3ND_TREASURY_WALLET || "2nkTRv3qxk7n2eYYjFAndReVXaV7sTF3Z9pNimvp5jcp";

// Memo prefix for SP3ND payments - must be exact format
export const SP3ND_MEMO_PREFIX = "SP3ND Order:";

// SP3ND cart expiry time in milliseconds (30 minutes)
export const SP3ND_CART_EXPIRY_MS = 30 * 60 * 1000;

// Order status values
export const SP3ND_ORDER_STATUS = {
  CREATED: "Created",
  PAID: "Paid",
  ORDERED: "Ordered",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
} as const;

export type SP3NDOrderStatus = typeof SP3ND_ORDER_STATUS[keyof typeof SP3ND_ORDER_STATUS];

// Shipping address interface for SP3ND
export interface SP3NDShippingAddress {
  name: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
}
