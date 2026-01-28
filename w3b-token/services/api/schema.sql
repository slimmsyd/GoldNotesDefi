-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table to store all Goldback serial numbers
-- This is your "Private Inventory"
CREATE TABLE IF NOT EXISTS goldback_serials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number VARCHAR(50) NOT NULL UNIQUE,
    batch_id VARCHAR(50) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    merkle_leaf_hash BYTEA NOT NULL, -- The SHA256 hash of the serial
    included_in_root VARCHAR(66) -- The Merkle root this serial was included in (null if pending)
);

CREATE INDEX IF NOT EXISTS idx_batch ON goldback_serials(batch_id);
CREATE INDEX IF NOT EXISTS idx_root ON goldback_serials(included_in_root);
CREATE INDEX IF NOT EXISTS idx_serial ON goldback_serials(serial_number);

-- Table to track Merkle root history (Public Commitments)
CREATE TABLE IF NOT EXISTS merkle_roots (
    id SERIAL PRIMARY KEY,
    root_hash VARCHAR(66) NOT NULL UNIQUE,
    total_serials INTEGER NOT NULL,
    anchored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    solana_tx_hash VARCHAR(100), -- The transaction where we called update_merkle_root
    status VARCHAR(20) DEFAULT 'unconfirmed' -- unconfirmed, confirmed, failed
);
