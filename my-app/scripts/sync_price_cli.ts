#!/usr/bin/env node
/**
 * Phase 3 CLI: Sync on-chain W3B price on devnet.
 *
 * Usage examples:
 *   npx ts-node my-app/scripts/sync_price_cli.ts --network devnet
 *   npx ts-node my-app/scripts/sync_price_cli.ts --network devnet --target-lamports 45900000
 *   npx ts-node my-app/scripts/sync_price_cli.ts --network devnet --force
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import anchor from "@coral-xyz/anchor";

type SolanaNetwork = "devnet" | "mainnet-beta" | "testnet";

// Mirror the deployed devnet default from the app protocol constants.
const DEFAULT_PROGRAM_ID = "9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6";

class NodeWallet {
  payer: Keypair;
  constructor(payer: Keypair) {
    this.payer = payer;
  }
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return txs.map((tx) => {
      if (tx instanceof Transaction) tx.partialSign(this.payer);
      return tx;
    });
  }
}

const PRICE_IDL = {
  version: "0.1.0",
  name: "wgb_protocol",
  instructions: [
    {
      name: "set_w3b_price",
      accounts: [
        { name: "protocolState", isMut: true, isSigner: false },
        { name: "operator", isMut: false, isSigner: true },
      ],
      args: [{ name: "priceLamports", type: "u64" }],
    },
  ],
} as const;

type Args = {
  network: SolanaNetwork;
  targetLamports?: number;
  force: boolean;
  adminOverride: boolean;
};

function parseArgs(argv: string[]): Args {
  const out: Args = { network: "devnet", force: false, adminOverride: false };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") {
      out.force = true;
      continue;
    }
    if (arg === "--admin-override") {
      out.adminOverride = true;
      continue;
    }
    if (arg === "--network") {
      const value = argv[++i];
      if (!value || !["devnet", "mainnet-beta", "testnet"].includes(value)) {
        throw new Error("Invalid --network. Use devnet | mainnet-beta | testnet");
      }
      out.network = value as Args["network"];
      continue;
    }
    if (arg === "--target-lamports") {
      const value = argv[++i];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Invalid --target-lamports. Must be a positive integer");
      }
      out.targetLamports = Math.floor(parsed);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage:",
          "  npx ts-node my-app/scripts/sync_price_cli.ts --network devnet [--target-lamports <n>] [--force]",
          "",
          "Flags:",
          "  --network devnet|mainnet-beta|testnet",
          "  --target-lamports <n>    Override computed target price",
          "  --force                  Continue even if env network mismatches flag",
          "  --admin-override         Use admin price setter if operator 20% guard blocks update",
        ].join("\n")
      );
      process.exit(0);
    }
    throw new Error(`Unknown arg: ${arg}`);
  }

  return out;
}

function getRpcEndpoint(network: SolanaNetwork): string {
  if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (network === "mainnet-beta") return "https://api.mainnet-beta.solana.com";
  if (network === "testnet") return "https://api.testnet.solana.com";
  return "https://api.devnet.solana.com";
}

function getProgramId(): string {
  return process.env.NEXT_PUBLIC_W3B_PROGRAM_ID || DEFAULT_PROGRAM_ID;
}

async function fetchGoldbackRateUsd(): Promise<number> {
  const res = await fetch("https://www.goldback.com/gb-proxy.php", {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Goldback API failed: ${res.status}`);
  const data = (await res.json()) as any;
  const rate = Number(data?.quotes?.USDUSD);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid Goldback USD rate");
  return rate;
}

async function fetchSolPriceUsd(): Promise<number> {
  const jupiter = await fetch(
    "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const p1 = Number(jupiter?.data?.["So11111111111111111111111111111111111111112"]?.price);
  if (Number.isFinite(p1) && p1 > 0) return p1;

  const gecko = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const p2 = Number(gecko?.solana?.usd);
  if (Number.isFinite(p2) && p2 > 0) return p2;

  throw new Error("Failed to fetch SOL/USD from Jupiter and CoinGecko");
}

function calculateLamportsPrice(goldbackRateUsd: number, solPriceUsd: number): number {
  return Math.round((goldbackRateUsd / solPriceUsd) * 1_000_000_000);
}

function parseU64LE(data: Buffer, offset: number): number {
  return Number(data.readBigUInt64LE(offset));
}

async function getOnChainPriceLamports(
  connection: Connection,
  programId: PublicKey
): Promise<number | null> {
  const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_state")], programId);
  const info = await connection.getAccountInfo(protocolStatePda, "confirmed");
  if (!info || info.data.length < 216) return null;
  return parseU64LE(info.data, 208);
}

function loadProtocolIdl(programId: PublicKey): any {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "w3b-token/programs/w3b_protocol/target/idl/w3b_protocol.json"),
    path.resolve(process.cwd(), "../w3b-token/programs/w3b_protocol/target/idl/w3b_protocol.json"),
    path.resolve(process.cwd(), "../../w3b-token/programs/w3b_protocol/target/idl/w3b_protocol.json"),
    path.resolve(process.cwd(), "../../../programs/w3b_protocol/target/idl/w3b_protocol.json"),
    path.resolve(scriptDir, "../../w3b-token/programs/w3b_protocol/target/idl/w3b_protocol.json"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
    return {
      ...parsed,
      address: programId.toBase58(),
    };
  }

  return {
    ...PRICE_IDL,
    address: programId.toBase58(),
  };
}

async function syncOnChainPrice(
  connection: Connection,
  operator: Keypair,
  programId: PublicKey,
  newLamportsPrice: number,
  options?: { adminOverride?: boolean }
): Promise<{ tx: string; oldPrice: number; newPrice: number } | null> {
  const wallet = new NodeWallet(operator);
  const provider = new anchor.AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const idlWithAddress = loadProtocolIdl(programId);
  const program = new anchor.Program(idlWithAddress as any, provider);
  const [protocolStatePda] = PublicKey.findProgramAddressSync([Buffer.from("protocol_state")], programId);
  const current = (await getOnChainPriceLamports(connection, programId)) || 0;

  if (current > 0) {
    const driftPercent = (Math.abs(newLamportsPrice - current) / current) * 100;
    if (driftPercent < 1) {
      return null;
    }
  }

  const methods = program.methods as any;
  const setPriceBuilder =
    methods.setW3bPrice?.(new anchor.BN(newLamportsPrice)) ??
    methods.setW3BPrice?.(new anchor.BN(newLamportsPrice)) ??
    methods.set_w3b_price?.(new anchor.BN(newLamportsPrice));

  if (!setPriceBuilder) {
    throw new Error(
      `set_w3b_price method not found on IDL methods. Available methods: ${Object.keys(methods).join(", ")}`
    );
  }

  let tx: string;
  try {
    tx = await setPriceBuilder
      .accountsPartial({
        protocolState: protocolStatePda,
        operator: operator.publicKey,
      })
      .rpc();
  } catch (err: any) {
    const message = err?.message || String(err);
    const isGuardFailure = message.includes("PriceChangeExceedsLimit");
    if (!isGuardFailure || !options?.adminOverride) {
      throw err;
    }

    const setAdminBuilder =
      methods.setW3bPriceAdmin?.(new anchor.BN(newLamportsPrice)) ??
      methods.setW3BPriceAdmin?.(new anchor.BN(newLamportsPrice)) ??
      methods.set_w3b_price_admin?.(new anchor.BN(newLamportsPrice));

    if (!setAdminBuilder) {
      throw new Error(
        `Price guard hit and admin override method not found. Available methods: ${Object.keys(methods).join(", ")}`
      );
    }

    tx = await setAdminBuilder
      .accountsPartial({
        protocolState: protocolStatePda,
        authority: operator.publicKey,
      })
      .rpc();
  }

  return { tx, oldPrice: current, newPrice: newLamportsPrice };
}

function loadEnvFromFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadMyAppEnv(): void {
  const cwd = process.cwd();
  const candidateRoots = [
    cwd,
    path.join(cwd, "my-app"),
    path.resolve(cwd, "..", "my-app"),
  ];

  for (const root of candidateRoots) {
    loadEnvFromFile(path.join(root, ".env.local"));
    loadEnvFromFile(path.join(root, ".env"));
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  loadMyAppEnv();

  const envNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  if (!args.force && envNetwork !== args.network) {
    throw new Error(
      `Network mismatch: --network=${args.network} but NEXT_PUBLIC_SOLANA_NETWORK=${envNetwork}. Use --force to override.`
    );
  }

  const rpcEndpoint = getRpcEndpoint(args.network);
  const connection = new Connection(rpcEndpoint, "confirmed");
  const programId = new PublicKey(getProgramId());
  const keypairPath =
    process.env.SOLANA_KEYPAIR_PATH || path.join(process.env.HOME || "", ".config/solana/id.json");
  const keypairRaw = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const operator = Keypair.fromSecretKey(Uint8Array.from(keypairRaw));

  const onChainBefore = await getOnChainPriceLamports(connection, programId);

  let targetLamports = args.targetLamports;
  let goldbackUsd: number | null = null;
  let solUsd: number | null = null;

  if (!targetLamports) {
    goldbackUsd = await fetchGoldbackRateUsd();
    solUsd = await fetchSolPriceUsd();
    targetLamports = calculateLamportsPrice(goldbackUsd, solUsd);
  }

  const syncResult = await syncOnChainPrice(connection, operator, programId, targetLamports, {
    adminOverride: args.adminOverride,
  });
  const onChainAfter = await getOnChainPriceLamports(connection, programId);

  const output = {
    ok: true,
    network: args.network,
    envNetwork,
    rpcEndpoint,
    operator: operator.publicKey.toBase58(),
    programId: programId.toBase58(),
    inputs: {
      targetLamports,
      goldbackUsd,
      solUsd,
    },
    onChainBefore,
    onChainAfter,
    syncResult,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  process.exit(1);
});
