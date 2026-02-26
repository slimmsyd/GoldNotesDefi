export interface AuthChallengeResponse {
  wallet: string;
  timestamp: number;
  nonce: string;
  message: string;
}

export type AuthVerifyMethod = 'dev_hmac' | 'solana_ed25519';

export interface AuthVerifyRequest {
  wallet: string;
  timestamp: number;
  nonce: string;
  message: string;
  method: AuthVerifyMethod;
  // Hex when method=dev_hmac, base64 when method=solana_ed25519.
  signature: string;
}

export interface AuthVerifyResponse {
  success: boolean;
  token: string;
  expiresAt: string;
  wallet: string;
}

export interface AuthenticatedRequestContext {
  walletAddress: string;
  source: 'bearer' | 'header';
}

export interface PersistedCartItem {
  id: string;
  name: string;
  price: string;
  image?: string;
  quantity: number;
  source: 'direct' | 'amazon';
}

export interface CartGetResponse {
  exists: boolean;
  cart: PersistedCartItem[] | null;
}

export interface CartSaveRequest {
  cart: PersistedCartItem[] | null;
}

export interface CartSaveResponse {
  success: boolean;
  cart: PersistedCartItem[] | null;
}

export interface CartClearResponse {
  success: boolean;
  message: string;
}

export interface PortfolioDataHealth {
  wgbSource: 'onchain' | 'fallback';
  loyaltySource: 'db' | 'fallback';
}

export interface PortfolioSummaryResponse {
  success: boolean;
  walletAddress: string;
  wgbBalance: number;
  goldbackRateUsd: number;
  portfolioUsd: number;
  loyaltyPoints: number;
  lastUpdated: string;
  dataHealth: PortfolioDataHealth;
}

export interface ShopCatalogItem {
  id: string;
  name: string;
  description: string;
  image: string;
  imageUrl?: string | null;
  imageSource?: 'supabase_public' | 'absolute_url' | 'invalid' | 'none';
  features: string[];
  stock: number;
  minQty: number;
  denominationGb: number | null;
  displayPriceLabel: string;
  unitPriceUsd: number;
}

export interface ShopCatalogResponse {
  success: boolean;
  goldbackRate: number;
  rateUpdatedAt: string | null;
  packages: ShopCatalogItem[];
}

export interface ShippingOption {
  id: string;
  name: string;
  cost: number;
  minOrderValue: number;
  maxOrderValue: number | null;
  insurance: number;
  requiresSignature: boolean;
  isInternational: boolean;
}

export interface ShippingOptionsResponse {
  success: boolean;
  requiredMethod: ShippingOption;
  availableMethods: ShippingOption[];
  shippingUsdDefault: number;
}

export type DirectCheckoutCurrency = 'SOL';

export interface DirectCheckoutItemRequest {
  id: string;
  quantity: number;
}

export interface DirectCheckoutCreateRequest {
  items: DirectCheckoutItemRequest[];
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  isInternational: boolean;
  shippingMethodId: string | null;
  currency: DirectCheckoutCurrency;
}

export interface DirectCheckoutCreateResponse {
  success: boolean;
  orderId: string;
  memo: string;
  merchantWallet: string;
  network: string;
  currency: DirectCheckoutCurrency;
  expectedLamports: string | null;
  expectedUsdcBaseUnits: string | null;
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  pointsPreview: number;
}

export interface DirectCheckoutConfirmRequest {
  orderId: string;
  txSignature: string;
}

export interface DirectCheckoutConfirmResponse {
  success: boolean;
  status: string;
  walletAddress: string;
  pointsAwarded: number;
  newBalance: number;
  txSignature: string;
}

export interface ProtocolAuditRecord {
  id?: number | string;
  root_hash?: string;
  total_serials?: number;
  anchored_at?: string;
  solana_tx_hash?: string | null;
  status?: string;
}

export interface ProtocolStatusData {
  onChain: {
    totalSupply: number;
    provenReserves: number;
    lastProofTimestamp: string | null;
    currentMerkleRoot: string;
    isPaused: boolean;
  };
  solvency: {
    isSolvent: boolean;
    ratio: number | null;
    status: string;
  };
  offChain: {
    lastAuditRecord: ProtocolAuditRecord | null;
    totalBatches: number;
    auditHistory?: ProtocolAuditRecord[];
  };
  fetchedAt: string;
}

export interface ProtocolStatusResponse {
  success: boolean;
  data: ProtocolStatusData | null;
  error?: string;
}

export type ProtocolStatusHistoryResponse = ProtocolStatusResponse;

export interface VaultSummaryResponse {
  success: boolean;
  solvencyStatus: string;
  ratio: number | null;
  totalSupply: number;
  provenReserves: number;
  totalBatches: number;
  currentMerkleRoot: string;
  fetchedAt: string;
}

export interface SwapQuoteView {
  payToken: 'SOL';
  payAmountSol: number;
  solPriceUsd: number;
  goldbackRateUsd: number;
  estimatedWgb: number;
  verifiedAt: string;
}

export interface SwapExecutionResult {
  txSignature: string;
  explorerUrl: string;
  purchasedWgb: number;
}

export interface RedemptionStatusItem {
  id: string;
  amount: number;
  status: number;
  created_at: string;
  burn_tx_hash?: string | null;
  shipping_name?: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_zip?: string | null;
  shipping_country?: string | null;
}

export interface RedemptionStatusResponse {
  success: boolean;
  count: number;
  requests: RedemptionStatusItem[];
}

export interface RedemptionCreateRequest {
  request_id: number;
  amount: number;
  burn_tx_hash: string;
  shipping_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  shipping_country: string;
}

export interface RedemptionCreateResponse {
  success: boolean;
  redemption?: {
    id: string;
    user_wallet: string;
    request_id: number;
    amount: number;
    status: number;
    burn_tx_hash: string | null;
    created_at: string;
  };
  error?: string;
}

export interface WalletSessionState {
  walletAddress: string | null;
  authToken: string | null;
  authMethod: AuthVerifyMethod | null;
  authTokenExpiresAt: string | null;
  connectedAt: string | null;
  lastAuthAt: string | null;
}

export interface UserProfile {
  id: string;
  walletAddress: string;
  email: string | null;
  shippingName: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string;
  isInternational: boolean;
  emailOrderUpdates: boolean;
  emailPromotions: boolean;
  savedCart: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileGetResponse {
  exists: boolean;
  profile: UserProfile | null;
}

export interface UserProfileUpdateRequest {
  email?: string | null;
  shippingName?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string;
  isInternational?: boolean;
  emailOrderUpdates?: boolean;
  emailPromotions?: boolean;
}

export interface UserProfileUpdateResponse {
  success: boolean;
  profile: UserProfile;
}

export interface LoyaltyEvent {
  id: string;
  source: string;
  points: number;
  createdAt: string;
  sourceRef?: string;
  orderId?: string;
}

export interface LoyaltyBalanceResponse {
  success: boolean;
  walletAddress: string;
  balance: number;
  lastUpdated: string;
  events: LoyaltyEvent[];
}

export interface OrderItem {
  asin?: string;
  title: string;
  price: string;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  source: 'amazon' | 'direct';
  status: string;
  totalAmount: number;
  trackingNumber?: string;
  items: OrderItem[];
  shippingAddress?: { name: string; city: string; state: string };
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  success: boolean;
  orders: Order[];
}
