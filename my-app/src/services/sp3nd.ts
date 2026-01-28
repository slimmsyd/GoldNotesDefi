/**
 * SP3ND Partner API Service
 *
 * This service wraps all SP3ND Partner API endpoints for integrating
 * Amazon product purchases via USDC on Solana.
 *
 * API Documentation: https://www.sp3nd.shop/partner-api/docs
 */

import {
  SP3ND_BASE_URL,
  SP3ND_TREASURY_WALLET,
  SP3ND_MEMO_PREFIX,
  type SP3NDShippingAddress
} from "@/lib/sp3nd-constants";

// ============================================
// Types
// ============================================

export interface SP3NDCartItem {
  item_id: string;
  product_url: string;
  title: string;
  price: number;
  quantity: number;
  image_url?: string;
  asin?: string;
}

export interface SP3NDCart {
  cart_id: string;
  items: SP3NDCartItem[];
  subtotal: number;
  platform_fee: number;
  shipping: number;
  tax: number;
  total: number;
  expires_at: string;
}

export interface SP3NDOrder {
  order_id: string;
  order_number: string;
  status: string;
  total_amount: number;
  items: SP3NDCartItem[];
  shipping_address: SP3NDShippingAddress;
  customer_email: string;
  tracking_number?: string;
  estimated_delivery?: string;
  created_at: string;
  updated_at: string;
}

export interface SP3NDApiResponse<T> {
  success?: boolean;
  error?: string;
  cart?: T;
  order?: T;
  orders?: T[];
  data?: T;
}

// ============================================
// Helper Functions
// ============================================

function getAuthHeaders(): HeadersInit {
  const apiKey = process.env.SP3ND_API_KEY;
  const apiSecret = process.env.SP3ND_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("SP3ND API credentials not configured. Set SP3ND_API_KEY and SP3ND_API_SECRET in .env");
  }

  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
    "X-API-Secret": apiSecret,
  };
}

async function makeRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: object
): Promise<T> {
  const url = `${SP3ND_BASE_URL}/${endpoint}`;

  const options: RequestInit = {
    method,
    headers: getAuthHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `SP3ND API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// SP3ND Service
// ============================================

export const sp3ndService = {
  // ----------------------------------------
  // Cart Management
  // ----------------------------------------

  /**
   * Create a new cart with Amazon product(s)
   * SP3ND will auto-scrape product details from the Amazon URL
   */
  async createCart(amazonUrl: string, quantity: number = 1): Promise<SP3NDApiResponse<SP3NDCart>> {
    return makeRequest<SP3NDApiResponse<SP3NDCart>>("createPartnerCart", "POST", {
      items: [{ product_url: amazonUrl, quantity }],
    });
  },

  /**
   * Add an item to an existing cart
   * If the item already exists, quantity will be increased
   */
  async addItem(cartId: string, amazonUrl: string, quantity: number = 1): Promise<SP3NDApiResponse<SP3NDCart>> {
    return makeRequest<SP3NDApiResponse<SP3NDCart>>(`addItemToPartnerCart/${cartId}`, "POST", {
      product_url: amazonUrl,
      quantity,
    });
  },

  /**
   * Update item quantity in cart
   */
  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<SP3NDApiResponse<SP3NDCart>> {
    return makeRequest<SP3NDApiResponse<SP3NDCart>>(`updateCartItemQuantity/${cartId}/${itemId}`, "PATCH", {
      quantity,
    });
  },

  /**
   * Remove an item from cart
   */
  async removeItem(cartId: string, itemId: string): Promise<SP3NDApiResponse<SP3NDCart>> {
    return makeRequest<SP3NDApiResponse<SP3NDCart>>(`removeCartItem/${cartId}/${itemId}`, "DELETE");
  },

  /**
   * Update shipping address and calculate tax automatically
   */
  async updateShippingAddress(cartId: string, address: SP3NDShippingAddress): Promise<SP3NDApiResponse<SP3NDCart>> {
    return makeRequest<SP3NDApiResponse<SP3NDCart>>(`updateCartShippingAddress/${cartId}`, "PATCH", {
      shipping_address: address,
    });
  },

  /**
   * Get cart details and totals
   */
  async getCart(cartId: string): Promise<SP3NDApiResponse<SP3NDCart>> {
    return makeRequest<SP3NDApiResponse<SP3NDCart>>(`getPartnerCart/${cartId}`, "GET");
  },

  // ----------------------------------------
  // Order Management
  // ----------------------------------------

  /**
   * Create an order from a cart
   * Set test: true for test orders during integration
   */
  async createOrder(
    cartId: string,
    shippingAddress: SP3NDShippingAddress,
    customerEmail: string,
    test: boolean = false
  ): Promise<SP3NDApiResponse<SP3NDOrder>> {
    return makeRequest<SP3NDApiResponse<SP3NDOrder>>("createPartnerOrder", "POST", {
      cart_id: cartId,
      shipping_address: shippingAddress,
      customer_email: customerEmail,
      test,
    });
  },

  /**
   * Get order details by order ID or order number
   */
  async getOrder(orderIdOrNumber: string): Promise<SP3NDApiResponse<SP3NDOrder>> {
    return makeRequest<SP3NDApiResponse<SP3NDOrder>>(`getPartnerOrder/${orderIdOrNumber}`, "GET");
  },

  /**
   * List orders with optional filters
   */
  async listOrders(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    userWallet?: string;
    customerEmail?: string;
  }): Promise<SP3NDApiResponse<SP3NDOrder[]>> {
    const params = new URLSearchParams();

    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());
    if (options?.status) params.append("status", options.status);
    if (options?.userWallet) params.append("user_wallet", options.userWallet);
    if (options?.customerEmail) params.append("customer_email", options.customerEmail);

    const queryString = params.toString();
    const endpoint = queryString ? `getPartnerOrders?${queryString}` : "getPartnerOrders";

    return makeRequest<SP3NDApiResponse<SP3NDOrder[]>>(endpoint, "GET");
  },

  // ----------------------------------------
  // Payment Processing
  // ----------------------------------------

  /**
   * Create a payment transaction record
   * This should be called after generating the payment for the user
   */
  async createTransaction(
    orderId: string,
    orderNumber: string,
    amount: number,
    senderWallet: string
  ): Promise<SP3NDApiResponse<{ memo: string; recipient_address: string }>> {
    return makeRequest("createPartnerTransaction", "POST", {
      order_id: orderId,
      order_number: orderNumber,
      amount,
      currency: "USD",
      memo: `${SP3ND_MEMO_PREFIX} ${orderNumber}`,
      recipient_address: SP3ND_TREASURY_WALLET,
      sender_address: senderWallet,
    });
  },

  // ----------------------------------------
  // Dashboard & Analytics
  // ----------------------------------------

  /**
   * Get partner dashboard metrics
   */
  async getDashboard(): Promise<SP3NDApiResponse<{
    total_orders: number;
    total_revenue: number;
    revenue_share: number;
    orders_this_month: number;
  }>> {
    return makeRequest("getPartnerDashboard", "GET");
  },

  // ----------------------------------------
  // Utility Functions
  // ----------------------------------------

  /**
   * Generate the payment memo for an order
   */
  generatePaymentMemo(orderNumber: string): string {
    return `${SP3ND_MEMO_PREFIX} ${orderNumber}`;
  },

  /**
   * Get the SP3ND treasury wallet address
   */
  getTreasuryWallet(): string {
    return SP3ND_TREASURY_WALLET;
  },

  /**
   * Check if cart has expired (30 min expiry)
   */
  isCartExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  },
};

export default sp3ndService;
