# GoldBack Project ($W3B) - Sovereign RWA Standard

> **The World's First Privacy-Preserving Real World Asset (RWA) Platform on Solana**

This project bridges the gap between **Physical Sound Money (Goldbacks)** and **Digital Velocity (Solana)**, creating a circular economy where users can earn, trade, and spend gold without surveillance.

---

## 🏗️ The Technology Stack

We leverage deep-tech integrations to solve the "Trilemma of RWAs" (Scalability, Trust, Privacy):

| Feature | Tech Provider | Purpose |
|---------|---------------|---------|
| **High-Performance Network** | **Helius RPC** | Powers our sub-second swaps and real-time asset indexing. |
| **Sacred Issuance** | **Noir (Zero-Knowledge)** | Cryptographically proves `Vault Assets >= Token Supply` without revealing serial numbers. |
| **Privacy Cash** | **ZK-SNARKs** | Enables private consumption. Users can spend gold without exposing their wallet history. |
| **Consumption Bridge** | **SP3ND Integration** | Allows users to buy anything on Amazon using $W3B/USDC directly. |

---

## 🛠️ Project Structure

This monorepo contains the entire ecosystem:

- **`w3b-token/`**: **The Issuance Layer**
  - Contains the Solana Smart Contract (Anchor), Noir ZK Circuits, and the Serial Number Registry.
  - *Run here to mint tokens and generate reserve proofs.*

- **`my-app/`**: **The Consumption Layer (Frontend)**
  - The Next.js 16 Web App. Contains the Swap UI, Goldback Shop, and Amazon Bridge.
  - *Run here to use the app.*

- **`privacy-cash-backend/`**: **The Privacy Layer**
  - A specialized backend that generates spend-proofs for the "Privacy Cash" feature.
  - *Run here to enable private payments.*

---

## 🚀 Detailed Setup & Run Instructions

To run the full platform, you must configure the environment and start 4 simultaneous services.

### 0. Prerequisites

Ensure you have the following installed:
- **Node.js** v20+
- **Rust & Cargo**
- **Solana CLI**
- **Anchor CLI**
- **Noir (`nargo`)**: Required for ZK proofs.
  ```bash
  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
  ```

### 1. Environment Configuration

You must set up `.env` files in two locations:

#### A. W3B Token (Issuance)
```bash
cd w3b-token
cp .env.example .env
```
Fill in your keys:
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`: Your database for gold serial numbers.
- `GOLDAPI_API_KEY`: For real-time gold price fetching.
- `SOLANA_RPC_URL`: Your **Helius** RPC endpoint.

#### B. Privacy Cash Backend
```bash
cd privacy-cash-backend
cp .env.example .env
```
Fill in your keys:
- `SOLANA_RPC_URL`: Your **Helius** RPC endpoint (critical for high-speed ZK proof submission).

---

### 2. Run the Full Stack

Open **4 separate terminal windows** and follow these commands exactly.

#### Terminal 1: The Local Blockchain
Start the validator to simulate the Solana network.
```bash
solana-test-validator --reset
```

#### Terminal 2: The Physical Oracle (Issuance)
This service manages the Goldback serial numbers and generates the "Reserve Proofs" (Noir).
```bash
cd w3b-token/services/api
npm install
npm run dev
```
*Runs on Port 3001.*

#### Terminal 3: The Privacy Backend (Consumption)
This service handles the ZK "Privacy Cash" transactions.
**⚠️ CRITICAL: Force POST 3002 to avoid conflict with Issuance service.**
```bash
cd privacy-cash-backend
npm install
PORT=3002 npm run dev
```
*Runs on Port 3002.*

#### Terminal 4: The Frontend (The App)
The user interface. We point it to our local Privacy Backend (Port 3002).
```bash
cd my-app
npm install
# Override the privacy API URL for local testing
NEXT_PUBLIC_PRIVACY_CASH_API=http://localhost:3002 npm run dev
```
*Runs on Port 3000.*

---

## 🔮 Core Features to Explore

### 1. Direct Crypto Settlement
Go to the **Shop**. Add a Goldback to your cart. Pay with **USDC** or **SOL**.
- **Why?** Instant settlement (T+0). No chargebacks. 0% "Middleman Tax".

### 2. Privacy Cash
At checkout, select **"Private Payment"**.
- **Why?** It generates a ZK proof on your machine, shielding your identity from the merchant. It restores the dignity of cash to the digital age.

### 3. Amazon Bridge
Paste an Amazon URL into the search bar.
- **Why?** It proves that Goldbacks are money. You can exit the gold ecosystem directly into real-world goods without touching a bank.

---

> **Advanced Usage**: See `w3b-token/README.md` for detailed instructions on generating new Merkle Roots and submitting ZK proofs using the batched prover.
