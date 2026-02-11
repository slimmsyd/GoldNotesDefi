import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { W3bProtocol } from "../target/types/w3b_protocol";
import IDL from "../target/idl/w3b_protocol.json";

const {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  MINT_SIZE,
} = require("../../../services/api/node_modules/@solana/spl-token");

describe("programs-w3b-protocol step3 optional profile", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program<W3bProtocol>(IDL as W3bProtocol, provider);
  const connection = provider.connection;
  const payer = (provider.wallet as any).payer as Keypair;

  let protocolStatePda: PublicKey;
  let w3bMint: PublicKey;
  let treasuryAta: PublicKey;

  let testUser: Keypair;
  let testUserTokenAccount: PublicKey;
  let wrongProfileUser: Keypair;
  let wrongProfilePda: PublicKey;

  function parseProtocolStateV2(data: Buffer): { w3bMint: PublicKey; treasury: PublicKey; w3bPriceLamports: BN } {
    const w3bMint = new PublicKey(data.slice(72, 104));
    const treasury = new PublicKey(data.slice(104, 136));
    const w3bPriceLamports = new BN(data.subarray(208, 216), "le");
    return { w3bMint, treasury, w3bPriceLamports };
  }

  async function readProtocolState(): Promise<{ w3bMint: PublicKey; treasury: PublicKey; w3bPriceLamports: BN } | null> {
    const info = await connection.getAccountInfo(protocolStatePda);
    if (!info || info.data.length < 216) return null;
    return parseProtocolStateV2(info.data);
  }

  async function fundFromPayer(recipient: PublicKey, sol: number): Promise<void> {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: Math.floor(sol * LAMPORTS_PER_SOL),
      })
    );

    await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
  }

  async function createMintAndTreasury(protocolPda: PublicKey): Promise<{ mint: PublicKey; treasury: PublicKey }> {
    const mint = Keypair.generate();

    const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(mint.publicKey, 0, protocolPda, null, TOKEN_2022_PROGRAM_ID)
    );

    await sendAndConfirmTransaction(connection, createMintTx, [payer, mint], {
      commitment: "confirmed",
    });

    const treasury = getAssociatedTokenAddressSync(
      mint.publicKey,
      protocolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createTreasuryTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        treasury,
        protocolPda,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, createTreasuryTx, [payer], {
      commitment: "confirmed",
    });

    return { mint: mint.publicKey, treasury };
  }

  async function ensureUserTokenAccount(user: PublicKey): Promise<PublicKey> {
    const userTokenAccount = getAssociatedTokenAddressSync(
      w3bMint,
      user,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const existing = await connection.getAccountInfo(userTokenAccount);
    if (!existing) {
      const createAtaTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          userTokenAccount,
          user,
          w3bMint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );

      await sendAndConfirmTransaction(connection, createAtaTx, [payer], {
        commitment: "confirmed",
      });
    }

    return userTokenAccount;
  }

  async function createUserProfile(user: Keypair): Promise<PublicKey> {
    const [userProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initUserProfile()
      .accountsPartial({
        userProfile: userProfilePda,
        user: user.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc({ commitment: "confirmed" });

    return userProfilePda;
  }

  before(async () => {
    [protocolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol_state")],
      program.programId
    );

    const existingState = await readProtocolState();

    if (existingState) {
      w3bMint = existingState.w3bMint;
      treasuryAta = existingState.treasury;
    } else {
      const created = await createMintAndTreasury(protocolStatePda);
      w3bMint = created.mint;
      treasuryAta = created.treasury;

      await program.methods
        .initializeV2()
        .accountsPartial({
          protocolState: protocolStatePda,
          w3BMint: w3bMint,
          treasury: treasuryAta,
          authority: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .rpc({ commitment: "confirmed" });
    }

    const afterState = await readProtocolState();
    if (!afterState) throw new Error("ProtocolState not found after setup");

    if (afterState.w3bPriceLamports.eqn(0)) {
      await program.methods
        .setW3BPriceAdmin(new BN(1))
        .accountsPartial({
          protocolState: protocolStatePda,
          authority: payer.publicKey,
        })
        .rpc({ commitment: "confirmed" });
    }

    testUser = Keypair.generate();
    await fundFromPayer(testUser.publicKey, 0.2);
    testUserTokenAccount = await ensureUserTokenAccount(testUser.publicKey);

    wrongProfileUser = Keypair.generate();
    await fundFromPayer(wrongProfileUser.publicKey, 0.2);
    wrongProfilePda = await createUserProfile(wrongProfileUser);
  });

  it("buy_w3b succeeds when user_profile is omitted", async () => {
    await program.methods
      .buyW3B(new BN(0))
      .accountsPartial({
        protocolState: protocolStatePda,
        buyer: testUser.publicKey,
        buyerTokenAccount: testUserTokenAccount,
        treasury: treasuryAta,
        solReceiver: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: null,
      } as any)
      .signers([testUser])
      .rpc({ commitment: "confirmed" });
  });

  it("burn_w3b succeeds when user_profile is omitted", async () => {
    const requestId = new BN(Date.now());
    const requestIdLe = requestId.toArrayLike(Buffer, "le", 8);
    const [redemptionRequestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), testUser.publicKey.toBuffer(), requestIdLe],
      program.programId
    );

    await program.methods
      .burnW3B(new BN(0), requestId)
      .accountsPartial({
        protocolState: protocolStatePda,
        user: testUser.publicKey,
        userTokenAccount: testUserTokenAccount,
        w3BMint: w3bMint,
        redemptionRequest: redemptionRequestPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: null,
      } as any)
      .signers([testUser])
      .rpc({ commitment: "confirmed" });
  });

  it("buy_w3b fails with InvalidUserProfileAccount when a wrong profile is provided", async () => {
    try {
      await program.methods
        .buyW3B(new BN(0))
        .accountsPartial({
          protocolState: protocolStatePda,
          buyer: testUser.publicKey,
          buyerTokenAccount: testUserTokenAccount,
          treasury: treasuryAta,
          solReceiver: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          userProfile: wrongProfilePda,
        } as any)
        .signers([testUser])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected buy_w3b to fail for invalid user_profile account");
    } catch (err) {
      const message = String(err);
      const maybeCode = (err as any)?.error?.errorCode?.code;
      const maybeMsg = (err as any)?.error?.errorMessage;
      const maybeLogs = (err as any)?.logs ?? (err as any)?.error?.logs;
      console.log("burn invalid-profile error", { message, maybeCode, maybeMsg, maybeLogs });
      expect(
        message.includes("Invalid user profile account supplied") ||
        message.includes("InvalidUserProfileAccount") ||
        maybeCode === "InvalidUserProfileAccount" ||
        maybeMsg === "Invalid user profile account supplied" ||
        message.includes("account: user_profile")
      ).to.eq(true);
    }
  });

  it("burn_w3b fails with InvalidUserProfileAccount when a wrong profile is provided", async () => {
    const requestId = new BN(Date.now() + 1);
    const requestIdLe = requestId.toArrayLike(Buffer, "le", 8);
    const [redemptionRequestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), testUser.publicKey.toBuffer(), requestIdLe],
      program.programId
    );

    try {
      await program.methods
        .burnW3B(new BN(0), requestId)
        .accountsPartial({
          protocolState: protocolStatePda,
          user: testUser.publicKey,
          userTokenAccount: testUserTokenAccount,
          w3BMint: w3bMint,
          redemptionRequest: redemptionRequestPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          userProfile: wrongProfilePda,
        } as any)
        .signers([testUser])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected burn_w3b to fail for invalid user_profile account");
    } catch (err) {
      const message = String(err);
      const maybeCode = (err as any)?.error?.errorCode?.code;
      const maybeMsg = (err as any)?.error?.errorMessage;
      expect(
        message.includes("Invalid user profile account supplied") ||
        message.includes("InvalidUserProfileAccount") ||
        maybeCode === "InvalidUserProfileAccount" ||
        maybeMsg === "Invalid user profile account supplied" ||
        message.includes("account: user_profile")
      ).to.eq(true);
    }
  });
});
