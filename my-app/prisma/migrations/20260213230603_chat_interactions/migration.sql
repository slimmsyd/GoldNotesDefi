-- Chat analytics: persist questions + answers (sanitized)

-- CreateTable
CREATE TABLE "ChatInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT,
    "pagePath" TEXT,
    "pageUrl" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Started',
    "statusLatest" TEXT,
    "statusHistory" JSONB,
    "model" TEXT,
    "processingTimeMs" INTEGER,
    "errorMessage" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatInteraction_createdAt_idx" ON "ChatInteraction"("createdAt");

-- CreateIndex
CREATE INDEX "ChatInteraction_userId_idx" ON "ChatInteraction"("userId");

-- CreateIndex
CREATE INDEX "ChatInteraction_walletAddress_idx" ON "ChatInteraction"("walletAddress");

-- CreateIndex
CREATE INDEX "ChatInteraction_status_idx" ON "ChatInteraction"("status");

