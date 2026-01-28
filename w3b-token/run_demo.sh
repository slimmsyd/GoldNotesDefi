#!/bin/bash

# ==============================================================================
# W3B Token - Master Run Script
# ==============================================================================
# This script automates the setup and execution of the entire $W3B stack.
# It handles:
# 1. Prerequisites Check
# 2. Dependency Installation
# 3. Noir Circuit Compilation (ZK)
# 4. Smart Contract Build (Solana/Anchor)
# 5. API Service Start
# 6. Web App Start
# ==============================================================================

set -e # Exit on error

# --- Colors ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   $W3B Token Standard - Master Run Sequence           ${NC}"
echo -e "${BLUE}======================================================${NC}"

# --- 1. Prerequisites Check ---
echo -e "\n${GREEN}[1/6] Checking Prerequisites...${NC}"

command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js is required but not installed.${NC}"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo -e "${RED}Rust/Cargo is required but not installed.${NC}"; exit 1; }
command -v anchor >/dev/null 2>&1 || { echo -e "${RED}Anchor CLI is required but not installed.${NC}"; exit 1; }
command -v nargo >/dev/null 2>&1 || { echo -e "${RED}Noir (nargo) is required. Install: curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash${NC}"; exit 1; }

echo "✅ All system tools found."

# --- 2. Install Dependencies ---
echo -e "\n${GREEN}[2/6] Installing Dependencies...${NC}"

echo ">> Installing API dependencies..."
cd services/api
npm install
cd ../..

echo ">> Installing Web App dependencies..."
cd apps/web
npm install
cd ../..

# --- 3. Build ZK Circuits (Noir) ---
echo -e "\n${GREEN}[3/6] Building ZK Circuits (The Cryptographic Truth)...${NC}"
cd circuits/reserve_proof

echo ">> Compiling Noir Circuit..."
nargo check
# nargo prove # Uncomment if you want to generate a proof now (requires Prover.toml)

echo "✅ Circuit compiled successfully."
cd ../..

# --- 4. Build Smart Contract (Solana) ---
echo -e "\n${GREEN}[4/6] Building Solana Program (The On-Chain Truth)...${NC}"
cd programs/w3b_protocol

echo ">> Building Anchor Program..."
anchor build

# echo ">> Running Tests (Optional)..."
# anchor test

echo "✅ Smart Contract built."
cd ../..

# --- 5. Start Services ---
echo -e "\n${GREEN}[5/6] Starting Services...${NC}"

# Create a mock .env if not exists
if [ ! -f .env ]; then
    echo ">> Creating default .env from example..."
    cp .env.example .env
fi

echo -e "${BLUE}Instructions to Run:${NC}"
echo "---------------------------------------------------"
echo "1. API Service (Terminal 1):"
echo "   cd services/api && npm start"
echo ""
echo "2. Web App (Terminal 2):"
echo "   cd apps/web && npm run dev"
echo ""
echo "3. Solana Validator (Terminal 3 - Optional if testing locally):"
echo "   solana-test-validator"
echo "---------------------------------------------------"

echo -e "\n${GREEN}Setup Complete! You are ready to run the stack.${NC}"
