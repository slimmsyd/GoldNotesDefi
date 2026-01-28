# Privacy Cash Backend

Dedicated Node.js backend for Privacy Cash SDK operations.
Deployed separately from the Next.js app (e.g., Railway, Render).

## Why Separate Backend?

The Privacy Cash SDK uses `node-localstorage` which requires a writable filesystem.
Vercel serverless functions have read-only filesystems, so we deploy this as a standalone server.

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env` file:

```
PORT=3001
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

## Deploy to Railway

Since this is a subfolder in your main repository (`privacy-cash-backend`), deploy as a **Monorepo**:

1. **Push code to GitHub**: Ensure this folder is committed and pushed to your main repo.
   ```bash
   git add privacy-cash-backend
   git commit -m "Add privacy cash backend"
   git push origin main
   ```

2. **Create Project in Railway**:
   - Go to [railway.app](https://railway.app) -> New Project -> Deploy from GitHub repo.
   - Select your repository.

3. **Configure Root Directory**:
   - In Railway > Settings > General > **Root Directory**, enter: `/privacy-cash-backend`
   - Railway will now look for `package.json` in this subfolder.

4. **Set Environment Variables**:
   In Variables tab, add:
   - `SOLANA_RPC_URL`: usage `https://api.mainnet-beta.solana.com` (or your Helius URL)
   - `ALLOWED_ORIGINS`: `https://your-production-url.vercel.app,http://localhost:3000`
   - `NODE_ENV`: `production`

5. **Deploy**: Railway will automatically detect Node.js and start the server.


## API Endpoints

### POST /api/deposit
Deposit SOL into the Privacy Cash pool.

**Body:**
```json
{
  "lamports": 1000000,
  "signatureBase64": "base64-encoded-wallet-signature"
}
```

### POST /api/withdraw
Withdraw SOL from the pool to a recipient.

**Body:**
```json
{
  "lamports": 1000000,
  "recipientAddress": "recipient-wallet-address",
  "signatureBase64": "base64-encoded-wallet-signature"
}
```
