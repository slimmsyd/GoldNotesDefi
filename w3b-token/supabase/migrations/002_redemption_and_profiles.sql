-- =====================================================
-- Redemption Requests & User Profiles (Off-Chain Mirror)
-- =====================================================
-- Supports the W3B Protocol V2 redemption flow:
--   burn_w3b -> claim_redemption -> confirm_delivery
--
-- On-chain state (RedemptionRequest PDA) tracks:
--   user, amount, status, fulfiller, timestamps
--
-- Off-chain (this table) adds:
--   Shipping details, tracking, notes, P2P queue
--
-- HOW TO RUN:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- =====================================================

-- =====================================================
-- 1. Redemption Requests
-- =====================================================
-- Mirrors on-chain RedemptionRequest PDAs with added
-- shipping and fulfillment metadata.
-- Status values match on-chain:
--   0 = Pending, 1 = Claimed, 2 = Shipped, 3 = Confirmed, 4 = Cancelled
-- =====================================================

CREATE TABLE IF NOT EXISTS redemption_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- On-chain identifiers
    user_wallet     TEXT NOT NULL,                  -- Solana pubkey of redeemer
    request_id      BIGINT NOT NULL,                -- Sequential ID matching on-chain PDA
    amount          BIGINT NOT NULL,                -- W3B tokens burned
    status          SMALLINT NOT NULL DEFAULT 0,    -- Matches on-chain status enum
    
    -- Fulfillment
    fulfiller_wallet TEXT,                           -- Solana pubkey of P2P fulfiller
    
    -- Shipping details (off-chain only — never stored on-chain)
    shipping_name    TEXT,
    shipping_address TEXT,
    shipping_city    TEXT,
    shipping_state   TEXT,
    shipping_zip     TEXT,
    shipping_country TEXT DEFAULT 'US',
    tracking_number  TEXT,
    
    -- Metadata
    notes           TEXT,                            -- Admin/fulfiller notes
    burn_tx_hash    TEXT,                            -- Solana transaction signature for burn
    claim_tx_hash   TEXT,                            -- Solana transaction signature for claim
    confirm_tx_hash TEXT,                            -- Solana transaction signature for confirm
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at      TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    confirmed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_wallet, request_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_redemption_status ON redemption_requests(status);
CREATE INDEX IF NOT EXISTS idx_redemption_user ON redemption_requests(user_wallet);
CREATE INDEX IF NOT EXISTS idx_redemption_fulfiller ON redemption_requests(fulfiller_wallet);
CREATE INDEX IF NOT EXISTS idx_redemption_created ON redemption_requests(created_at DESC);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_redemption ON redemption_requests;
CREATE TRIGGER set_updated_at_redemption
    BEFORE UPDATE ON redemption_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. User Profiles (Off-Chain Leaderboard Mirror)
-- =====================================================
-- Mirrors on-chain UserProfile PDAs for fast queries.
-- Updated by the backend when on-chain events are detected.
-- Used for: leaderboard, profile pages, tier display.
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identity
    wallet          TEXT NOT NULL UNIQUE,            -- Solana pubkey
    
    -- On-chain mirror fields
    points          BIGINT NOT NULL DEFAULT 0,
    tier            SMALLINT NOT NULL DEFAULT 0,     -- 0=Bronze, 1=Silver, 2=Gold, 3=Platinum
    total_volume    BIGINT NOT NULL DEFAULT 0,       -- Lifetime W3B moved
    total_redeemed  BIGINT NOT NULL DEFAULT 0,       -- W3B burned for physical
    total_fulfilled BIGINT NOT NULL DEFAULT 0,       -- P2P orders fulfilled
    fulfiller_rewards BIGINT NOT NULL DEFAULT 0,     -- Rewards earned as fulfiller
    
    -- Off-chain only
    display_name    TEXT,                             -- Optional display name
    is_fulfiller    BOOLEAN NOT NULL DEFAULT FALSE,   -- Opted in as P2P fulfiller
    fulfiller_region TEXT,                            -- Region they can ship from
    
    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_points ON user_profiles(points DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_fulfiller ON user_profiles(is_fulfiller) WHERE is_fulfiller = TRUE;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON user_profiles;
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. Row Level Security (RLS)
-- =====================================================
-- Public reads, service-role writes.
-- Frontend can read profiles and redemption status.
-- Only the backend (service_role) can insert/update.
-- =====================================================

ALTER TABLE redemption_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Redemption Requests: anyone can read, only service_role can write
CREATE POLICY "redemption_requests_select"
    ON redemption_requests FOR SELECT
    USING (true);

CREATE POLICY "redemption_requests_insert"
    ON redemption_requests FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "redemption_requests_update"
    ON redemption_requests FOR UPDATE
    USING (auth.role() = 'service_role');

-- User Profiles: anyone can read, only service_role can write
CREATE POLICY "user_profiles_select"
    ON user_profiles FOR SELECT
    USING (true);

CREATE POLICY "user_profiles_insert"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "user_profiles_update"
    ON user_profiles FOR UPDATE
    USING (auth.role() = 'service_role');

-- =====================================================
-- 4. Webhook: Notify on new redemption (optional)
-- =====================================================
-- Fires when a new redemption_request is inserted,
-- alerting P2P fulfillers that a new order is available.
-- Uses the same pg_net pattern as 001_auto_verify_webhook.sql.
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    webhook_url TEXT := 'http://localhost:3000/api/admin/redemption-webhook';
    webhook_secret TEXT := 'REPLACE_WITH_SECURE_WEBHOOK_SECRET';
BEGIN
    PERFORM net.http_post(
        url := webhook_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', webhook_secret
        ),
        body := jsonb_build_object(
            'type', 'NEW_REDEMPTION',
            'table', 'redemption_requests',
            'user_wallet', NEW.user_wallet,
            'request_id', NEW.request_id,
            'amount', NEW.amount,
            'triggered_at', now()::text
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_redemption_insert ON redemption_requests;
CREATE TRIGGER notify_redemption_insert
    AFTER INSERT ON redemption_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_redemption();

-- =====================================================
-- Verification: check tables and policies were created
-- =====================================================
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('redemption_requests', 'user_profiles');

SELECT policyname, tablename, cmd
FROM pg_policies
WHERE tablename IN ('redemption_requests', 'user_profiles');

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. The redemption flow:
--    a. User calls burn_w3b on-chain (creates RedemptionRequest PDA)
--    b. Frontend POSTs shipping details to /api/redemption/create
--    c. Backend inserts into redemption_requests table
--    d. pg_net webhook notifies P2P fulfillers
--    e. Fulfiller claims on-chain (claim_redemption)
--    f. Backend updates status in this table
--    g. Admin confirms delivery on-chain (confirm_delivery)
--
-- 2. user_profiles is a READ CACHE — the on-chain PDA is
--    the source of truth. This table is updated by backend
--    event listeners for fast leaderboard queries.
--
-- 3. To update webhook URLs for production:
--    UPDATE the webhook_url in notify_new_redemption()
--    or use Supabase Edge Functions instead.
-- =====================================================
