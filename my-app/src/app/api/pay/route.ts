import { ActionGetRequest, ActionPostRequest, ActionPostResponse, createPostResponse } from "@solana/actions";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { BigNumber } from "bignumber.js";

// TODO: Replace with client's actual wallet address
const MERCHANT_WALLET = new PublicKey(process.env.NEXT_PUBLIC_MERCHANT_WALLET || "CrQERYcZMnENP85qZBrdimS7oz2Ura9tAPxkZJPMpbNj"); 

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get("packageId");
    const itemsParam = searchParams.get("items");

    let label = "Gold Backs Store";
    let icon = "https://your-domain.com/logo.png"; // Fallback
    let description = "Purchase";
    let minAmount = 0;

    if (itemsParam) {
        // Handle Cart Checkout
        const items = JSON.parse(itemsParam) as { id: string, quantity: number }[];
        
        // Fetch all packages to get prices
        const packages = await prisma.goldPackage.findMany({
            where: { id: { in: items.map(i => i.id) } }
        });

        let totalUSD = 0;
        items.forEach(item => {
            const pkg = packages.find(p => p.id === item.id);
            if (pkg) {
                const price = parseFloat(pkg.price.replace(/[^0-9.]/g, ""));
                if (!isNaN(price)) {
                    totalUSD += price * item.quantity;
                }
            }
        });

        description = `Purchase ${items.length} items`;
        minAmount = totalUSD;
        // Use the first item's image as icon if available
        if (packages.length > 0 && packages[0].image.startsWith("http")) {
            icon = packages[0].image;
        }

    } else if (packageId) {
        // Handle Single Item Checkout (Legacy support)
        const pkg = await prisma.goldPackage.findUnique({
            where: { id: packageId },
        });

        if (!pkg) {
            return NextResponse.json({ error: "Package not found" }, { status: 404 });
        }

        const priceString = pkg.price.replace(/[^0-9.]/g, "");
        const price = parseFloat(priceString);

        if (isNaN(price)) {
            return NextResponse.json({ error: "Invalid price format" }, { status: 500 });
        }

        label = "Gold Backs Store";
        icon = pkg.image.startsWith("http") ? pkg.image : icon;
        description = `Purchase ${pkg.name}`;
        minAmount = price;
    } else {
        return NextResponse.json({ error: "Missing packageId or items" }, { status: 400 });
    }

    return NextResponse.json({
      label,
      icon,
      description,
      minAmount,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get("packageId");
    const itemsParam = searchParams.get("items");
    const body: ActionPostRequest = await req.json();
    const { account } = body;

    if (!account) {
      return NextResponse.json({ error: "Missing account" }, { status: 400 });
    }

    let totalUSD = 0;
    let description = "";

    if (itemsParam) {
         const items = JSON.parse(itemsParam) as { id: string, quantity: number }[];
        
        // Fetch all packages to get prices
        const packages = await prisma.goldPackage.findMany({
            where: { id: { in: items.map(i => i.id) } }
        });

        items.forEach(item => {
            const pkg = packages.find(p => p.id === item.id);
            if (pkg) {
                const price = parseFloat(pkg.price.replace(/[^0-9.]/g, ""));
                if (!isNaN(price)) {
                    totalUSD += price * item.quantity;
                }
            }
        });
        description = `Purchase ${items.length} items`;

    } else if (packageId) {
        const pkg = await prisma.goldPackage.findUnique({
            where: { id: packageId },
        });

        if (!pkg) {
            return NextResponse.json({ error: "Package not found" }, { status: 404 });
        }

        const priceString = pkg.price.replace(/[^0-9.]/g, "");
        totalUSD = parseFloat(priceString);
        description = `Purchase ${pkg.name}`;
    } else {
        return NextResponse.json({ error: "Missing packageId or items" }, { status: 400 });
    }

    const sender = new PublicKey(account);
    // SWITCH TO MAINNET for production wallets
    const connection = new Connection(clusterApiUrl("mainnet-beta")); 

    console.log(`Processing payment for ${account} on Mainnet`);

    // For this demo, we'll assume 1 SOL = $20 (HARDCODED FOR DEMO)
    // In production, fetch real price from an oracle like Pyth or CoinGecko
    const solPrice = 20; 
    const amountSOL = totalUSD / solPrice;

    const transaction = new Transaction();
    
    // Create transfer instruction
    const transferIx = SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: MERCHANT_WALLET,
      lamports: Math.floor(amountSOL * LAMPORTS_PER_SOL),
    });

    transaction.add(transferIx);
    
    transaction.feePayer = sender;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: `${description} for ${amountSOL.toFixed(4)} SOL`,
      },
    });

    return NextResponse.json(payload, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
    },
  });
}
