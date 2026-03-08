# Security Rotation Log (Phase 0)

Purpose: track out-of-band rotation for all secrets that were previously exposed in local env/config files.

## Status
- Phase: `0 - Security Stabilization`
- Git history rewrite: `Deferred`
- Current policy: rotate now, store only in platform env managers.

## Rotation Checklist

| Secret Name | System/Provider | Environment(s) | Rotated (Yes/No) | Rotated At (UTC) | Owner | Notes |
|---|---|---|---|---|---|---|
| `ADMIN_WEBHOOK_SECRET` | Vercel | Preview, Production | No |  |  |  |
| `CRON_SECRET` | Vercel | Production | No |  |  |  |
| `ADMIN_WALLET_ALLOWLIST` | Vercel | Production | No |  |  |  |
| `PROTOCOL_AUTHORITY_KEYPAIR` | Vercel | Production | No |  |  | replace authority keypair and update signer runbooks |
| `W3B_SUPABASE_SERVICE_KEY` | Supabase + Vercel | Production | No |  |  |  |
| `NEXT_PUBLIC_RPC_ENDPOINT` API key | RPC Provider | Preview, Production | No |  |  | regenerate provider API key |
| `SERVICE_API_SECRET` | Issuance Service Host | Production | No |  |  |  |
| `SUPABASE_SERVICE_KEY` | Supabase | Issuance services | No |  |  |  |
| `PRIVACY_ALLOWED_ORIGINS` | Privacy backend host | Production | No |  |  |  |

## Verification Checklist
- [ ] New secrets are set in hosting platform env stores only.
- [ ] No real secrets exist in tracked `.env.example` files.
- [ ] No real secrets exist in tracked source files.
- [ ] Local `.env` files are untracked and remain local-only.
- [ ] Rotate notification sent to team.

## Notes
- This file intentionally contains no secret values.
- Fill this log as each rotation is completed.
