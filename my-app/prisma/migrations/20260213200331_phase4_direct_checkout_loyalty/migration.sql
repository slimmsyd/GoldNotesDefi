-- Phase 4: Direct checkout orders + loyalty points ledger

-- CreateTable
CREATE TABLE "DirectCheckoutOrder" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Created',
    "network" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "merchantWallet" TEXT NOT NULL,
    "buyerWallet" TEXT,
    "memo" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "isInternational" BOOLEAN NOT NULL DEFAULT false,
    "shippingMethod" TEXT,
    "subtotalUsd" DECIMAL(10,2) NOT NULL,
    "shippingUsd" DECIMAL(10,2) NOT NULL,
    "totalUsd" DECIMAL(10,2) NOT NULL,
    "solPriceUsd" DECIMAL(10,2),
    "expectedLamports" BIGINT,
    "expectedUsdcBaseUnits" BIGINT,
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectCheckoutOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPointsEvent" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyPointsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectCheckoutOrder_memo_key" ON "DirectCheckoutOrder"("memo");

-- CreateIndex
CREATE UNIQUE INDEX "DirectCheckoutOrder_txSignature_key" ON "DirectCheckoutOrder"("txSignature");

-- CreateIndex
CREATE INDEX "DirectCheckoutOrder_buyerWallet_idx" ON "DirectCheckoutOrder"("buyerWallet");

-- CreateIndex
CREATE INDEX "DirectCheckoutOrder_status_idx" ON "DirectCheckoutOrder"("status");

-- CreateIndex
CREATE INDEX "DirectCheckoutOrder_createdAt_idx" ON "DirectCheckoutOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointsEvent_sourceRef_key" ON "LoyaltyPointsEvent"("sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyPointsEvent_orderId_key" ON "LoyaltyPointsEvent"("orderId");

-- CreateIndex
CREATE INDEX "LoyaltyPointsEvent_walletAddress_idx" ON "LoyaltyPointsEvent"("walletAddress");

-- CreateIndex
CREATE INDEX "LoyaltyPointsEvent_createdAt_idx" ON "LoyaltyPointsEvent"("createdAt");

