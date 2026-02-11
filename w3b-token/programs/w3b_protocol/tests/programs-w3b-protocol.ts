import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { W3bProtocol } from "../target/types/w3b_protocol";
import IDL from "../target/idl/w3b_protocol.json";

// Reuse the already-installed spl-token package from the workspace.
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
  let w3bMint: Keypair;
  let treasuryAta: PublicKey;

  async function airdrop(pubkey: PublicKey, sol = 2): Promise<void> {
    const sig = await connection.requestAirdrop(pubkey, sol * anchor.web3.LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  async function createMintAndTreasury(protocolPda: PublicKey): Promise<{ mint: Keypair; treasury: PublicKey }> {
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
      createInitializeMintInstruction(
        mint.publicKey,
        0,
        protocolPda,
        null,
        TOKEN_2022_PROGRAM_ID
      )
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

    return { mint, treasury };
  }

  async function createUserWithTokenAccount(): Promise<{ user: Keypair; userTokenAccount: PublicKey }> {
    const user = Keypair.generate();
    await airdrop(user.publicKey, 2);

    const userTokenAccount = getAssociatedTokenAddressSync(
      w3bMint.publicKey,
      user.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createAtaTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userTokenAccount,
        user.publicKey,
        w3bMint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, createAtaTx, [payer], {
      commitment: "confirmed",
    });

    return { user, userTokenAccount };
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

    const created = await createMintAndTreasury(protocolStatePda);
    w3bMint = created.mint;
    treasuryAta = created.treasury;

    await program.methods
      .initializeV2()
      .accountsPartial({
        protocolState: protocolStatePda,
        w3bMint: w3bMint.publicKey,
        treasury: treasuryAta,
        authority: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ commitment: "confirmed" });

    await program.methods
      .setW3bPriceAdmin(new BN(1))
      .accountsPartial({
        protocolState: protocolStatePda,
        authority: payer.publicKey,
      })
      .rpc({ commitment: "confirmed" });
  });

  it("buy_w3b succeeds when user_profile is omitted", async () => {
    const { user, userTokenAccount } = await createUserWithTokenAccount();

    await program.methods
      .buyW3b(new BN(0))
      .accountsPartial({
        protocolState: protocolStatePda,
        buyer: user.publicKey,
        buyerTokenAccount: userTokenAccount,
        treasury: treasuryAta,
        solReceiver: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: null,
      } as any)
      .signers([user])
      .rpc({ commitment: "confirmed" });
  });

  it("burn_w3b succeeds when user_profile is omitted", async () => {
    const { user, userTokenAccount } = await createUserWithTokenAccount();
    const requestId = new BN(Date.now());

    const requestIdLe = requestId.toArrayLike(Buffer, "le", 8);
    const [redemptionRequestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), user.publicKey.toBuffer(), requestIdLe],
      program.programId
    );

    await program.methods
      .burnW3b(new BN(0), requestId)
      .accountsPartial({
        protocolState: protocolStatePda,
        user: user.publicKey,
        userTokenAccount,
        w3bMint: w3bMint.publicKey,
        redemptionRequest: redemptionRequestPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        userProfile: null,
      } as any)
      .signers([user])
      .rpc({ commitment: "confirmed" });
  });

  it("buy_w3b fails with InvalidUserProfileAccount when a wrong profile is provided", async () => {
    const { user, userTokenAccount } = await createUserWithTokenAccount();

    const otherUser = Keypair.generate();
    await airdrop(otherUser.publicKey, 2);
    const wrongProfile = await createUserProfile(otherUser);

    try {
      await program.methods
        .buyW3b(new BN(0))
        .accountsPartial({
          protocolState: protocolStatePda,
          buyer: user.publicKey,
          buyerTokenAccount: userTokenAccount,
          treasury: treasuryAta,
          solReceiver: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          userProfile: wrongProfile,
        } as any)
        .signers([user])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected buy_w3b to fail for invalid user_profile account");
    } catch (err) {
      const message = String(err);
      expect(message).to.include("Invalid user profile account supplied");
    }
  });

  it("burn_w3b fails with InvalidUserProfileAccount when a wrong profile is provided", async () => {
    const { user, userTokenAccount } = await createUserWithTokenAccount();

    const otherUser = Keypair.generate();
    await airdrop(otherUser.publicKey, 2);
    const wrongProfile = await createUserProfile(otherUser);

    const requestId = new BN(Date.now() + 1);
    const requestIdLe = requestId.toArrayLike(Buffer, "le", 8);
    const [redemptionRequestPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), user.publicKey.toBuffer(), requestIdLe],
      program.programId
    );

    try {
      await program.methods
        .burnW3b(new BN(0), requestId)
        .accountsPartial({
          protocolState: protocolStatePda,
          user: user.publicKey,
          userTokenAccount,
          w3bMint: w3bMint.publicKey,
          redemptionRequest: redemptionRequestPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          userProfile: wrongProfile,
        } as any)
        .signers([user])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected burn_w3b to fail for invalid user_profile account");
    } catch (err) {
      const message = String(err);
      expect(message).to.include("Invalid user profile account supplied");
    }
  });
});
