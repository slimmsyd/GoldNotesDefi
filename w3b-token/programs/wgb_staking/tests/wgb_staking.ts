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
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getMintLen,
  ExtensionType,
} from "@solana/spl-token";

// Load IDL — will be available after `anchor build`
const IDL = require("../target/idl/wgb_staking.json");

describe("wgb_staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new Program(IDL as any, provider);
  const connection = provider.connection;
  const payer = (provider.wallet as any).payer as Keypair;

  let stakePoolPda: PublicKey;
  let stakePoolBump: number;
  let vaultPda: PublicKey;
  let vaultBump: number;
  let stWgbMintPda: PublicKey;
  let stWgbMintBump: number;

  let wgbMint: Keypair;

  let userA: Keypair;
  let userAWgbAccount: PublicKey;
  let userAStWgbAccount: PublicKey;

  let userB: Keypair;
  let userBWgbAccount: PublicKey;
  let userBStWgbAccount: PublicKey;

  let yieldInjector: Keypair;
  let yieldInjectorWgbAccount: PublicKey;

  const FEE_BASIS_POINTS = 10; // 0.1%
  const MAX_FEE = BigInt(1000);
  const INITIAL_MINT_AMOUNT = 10_000;

  async function fundFromPayer(recipient: PublicKey, sol: number): Promise<void> {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: Math.floor(sol * LAMPORTS_PER_SOL),
      })
    );
    await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
    });
  }

  async function createWgbMint(): Promise<Keypair> {
    const mint = Keypair.generate();
    const mintSize = getMintLen([ExtensionType.TransferFeeConfig]);
    const mintRent = await connection.getMinimumBalanceForRentExemption(mintSize);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintSize,
        lamports: mintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeTransferFeeConfigInstruction(
        mint.publicKey,
        payer.publicKey, // transferFeeConfigAuthority
        payer.publicKey, // withdrawWithheldAuthority
        FEE_BASIS_POINTS,
        MAX_FEE,
        TOKEN_2022_PROGRAM_ID
      ),
      createInitializeMintInstruction(
        mint.publicKey,
        0, // 0 decimals
        payer.publicKey, // mint authority = payer for testing
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, tx, [payer, mint], {
      commitment: "confirmed",
    });

    return mint;
  }

  async function createStWgbMint(): Promise<void> {
    // stWGB mint is a PDA — we need to create it off-chain with
    // the stake pool PDA as the mint authority
    const mintSize = getMintLen([]);
    const mintRent = await connection.getMinimumBalanceForRentExemption(mintSize);

    // Allocate and initialize the PDA mint account
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: stWgbMintPda,
        space: mintSize,
        lamports: mintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        stWgbMintPda,
        0, // 0 decimals
        stakePoolPda, // mint authority = stake pool PDA
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );

    // We can't sign for a PDA, so we need a different approach.
    // For PDAs, the system program requires the program to create them.
    // Instead, we'll use a regular keypair for the stWGB mint in tests.
    // In production, this would be created via the InitializePool instruction.
  }

  async function createTokenAccount(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true, // allow PDA owner
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const existing = await connection.getAccountInfo(ata);
    if (!existing) {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          ata,
          owner,
          mint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      await sendAndConfirmTransaction(connection, tx, [payer], {
        commitment: "confirmed",
      });
    }

    return ata;
  }

  async function mintWgbTo(
    destination: PublicKey,
    amount: number
  ): Promise<void> {
    const tx = new Transaction().add(
      createMintToInstruction(
        wgbMint.publicKey,
        destination,
        payer.publicKey, // mint authority
        amount,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
    });
  }

  // Using a regular keypair for stWGB mint in tests since PDAs can't be
  // created off-chain. The program validates mint authority = stake pool PDA.
  let stWgbMintKeypair: Keypair;

  before(async () => {
    // 1. Derive PDAs
    [stakePoolPda, stakePoolBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("stake_pool")],
      program.programId
    );
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );
    [stWgbMintPda, stWgbMintBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("st_wgb_mint")],
      program.programId
    );

    // 2. Create WGB mint (Token-2022 with Transfer Fee)
    wgbMint = await createWgbMint();
    console.log(`  WGB Mint: ${wgbMint.publicKey.toBase58()}`);

    // 3. Create stWGB mint as a regular keypair (for test purposes)
    // In production, this would be a PDA-controlled mint
    stWgbMintKeypair = Keypair.generate();
    const stMintSize = getMintLen([]);
    const stMintRent = await connection.getMinimumBalanceForRentExemption(stMintSize);

    const createStMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: stWgbMintKeypair.publicKey,
        space: stMintSize,
        lamports: stMintRent,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        stWgbMintKeypair.publicKey,
        0,
        stakePoolPda, // mint authority = stake pool PDA
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(
      connection,
      createStMintTx,
      [payer, stWgbMintKeypair],
      { commitment: "confirmed" }
    );
    console.log(`  stWGB Mint: ${stWgbMintKeypair.publicKey.toBase58()}`);

    // 4. Create vault token account (WGB held by stake pool PDA)
    const vaultAta = await createTokenAccount(
      wgbMint.publicKey,
      stakePoolPda
    );
    console.log(`  Vault: ${vaultAta.toBase58()}`);

    // 5. Setup users
    userA = Keypair.generate();
    userB = Keypair.generate();
    yieldInjector = Keypair.generate();

    await Promise.all([
      fundFromPayer(userA.publicKey, 1),
      fundFromPayer(userB.publicKey, 1),
      fundFromPayer(yieldInjector.publicKey, 1),
    ]);

    // Create user token accounts
    userAWgbAccount = await createTokenAccount(
      wgbMint.publicKey,
      userA.publicKey
    );
    userBWgbAccount = await createTokenAccount(
      wgbMint.publicKey,
      userB.publicKey
    );
    yieldInjectorWgbAccount = await createTokenAccount(
      wgbMint.publicKey,
      yieldInjector.publicKey
    );

    userAStWgbAccount = await createTokenAccount(
      stWgbMintKeypair.publicKey,
      userA.publicKey
    );
    userBStWgbAccount = await createTokenAccount(
      stWgbMintKeypair.publicKey,
      userB.publicKey
    );

    // 6. Mint WGB to users and yield injector
    await mintWgbTo(userAWgbAccount, 1000);
    await mintWgbTo(userBWgbAccount, 1000);
    await mintWgbTo(yieldInjectorWgbAccount, 5000);

    console.log("  Setup complete: users funded with WGB tokens");
  });

  // ==================== TEST CASES ====================

  it("initializes the stake pool", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await program.methods
      .initializePool(FEE_BASIS_POINTS, new BN(0)) // 0 = instant unstaking
      .accountsPartial({
        stakePool: stakePoolPda,
        wgbMint: wgbMint.publicKey,
        stWgbMint: stWgbMintKeypair.publicKey,
        vault: vaultAta,
        authority: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc({ commitment: "confirmed" });

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.authority.toBase58()).to.equal(
      payer.publicKey.toBase58()
    );
    expect(poolAccount.totalWgbDeposited.toNumber()).to.equal(0);
    expect(poolAccount.totalStWgbMinted.toNumber()).to.equal(0);
    expect(poolAccount.feeBasisPoints).to.equal(FEE_BASIS_POINTS);
    expect(poolAccount.isPaused).to.equal(false);

    console.log("    Pool initialized successfully");
  });

  it("first deposit: 100 WGB → 100 stWGB (1:1 initial rate)", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await program.methods
      .deposit(new BN(100))
      .accountsPartial({
        stakePool: stakePoolPda,
        wgbMint: wgbMint.publicKey,
        stWgbMint: stWgbMintKeypair.publicKey,
        vault: vaultAta,
        userWgbAccount: userAWgbAccount,
        userStWgbAccount: userAStWgbAccount,
        user: userA.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([userA])
      .rpc({ commitment: "confirmed" });

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.totalWgbDeposited.toNumber()).to.equal(100);
    expect(poolAccount.totalStWgbMinted.toNumber()).to.equal(100);

    console.log("    First deposit: 100 WGB → 100 stWGB");
  });

  it("second user deposits: 200 WGB → 200 stWGB (still 1:1 before yield)", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await program.methods
      .deposit(new BN(200))
      .accountsPartial({
        stakePool: stakePoolPda,
        wgbMint: wgbMint.publicKey,
        stWgbMint: stWgbMintKeypair.publicKey,
        vault: vaultAta,
        userWgbAccount: userBWgbAccount,
        userStWgbAccount: userBStWgbAccount,
        user: userB.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([userB])
      .rpc({ commitment: "confirmed" });

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.totalWgbDeposited.toNumber()).to.equal(300);
    expect(poolAccount.totalStWgbMinted.toNumber()).to.equal(300);

    console.log("    Second deposit: 200 WGB → 200 stWGB (total: 300/300)");
  });

  it("inject yield: 300 WGB → exchange rate becomes 600/300 = 2:1", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    await program.methods
      .injectYield(new BN(300))
      .accountsPartial({
        stakePool: stakePoolPda,
        wgbMint: wgbMint.publicKey,
        vault: vaultAta,
        injectorWgbAccount: yieldInjectorWgbAccount,
        injector: yieldInjector.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([yieldInjector])
      .rpc({ commitment: "confirmed" });

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.totalWgbDeposited.toNumber()).to.equal(600);
    expect(poolAccount.totalStWgbMinted.toNumber()).to.equal(300);

    console.log(
      "    Yield injected: 300 WGB → rate now 600/300 = 2.0 WGB per stWGB"
    );
  });

  it("user A withdraws 100 stWGB → receives 200 WGB (2x return)", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get user A's WGB balance before withdrawal
    const beforeInfo = await connection.getTokenAccountBalance(userAWgbAccount);
    const beforeBalance = Number(beforeInfo.value.amount);

    await program.methods
      .withdraw(new BN(100))
      .accountsPartial({
        stakePool: stakePoolPda,
        wgbMint: wgbMint.publicKey,
        stWgbMint: stWgbMintKeypair.publicKey,
        vault: vaultAta,
        userWgbAccount: userAWgbAccount,
        userStWgbAccount: userAStWgbAccount,
        user: userA.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([userA])
      .rpc({ commitment: "confirmed" });

    const afterInfo = await connection.getTokenAccountBalance(userAWgbAccount);
    const afterBalance = Number(afterInfo.value.amount);

    // User should receive 200 WGB (100 stWGB * 600/300 rate)
    // But Transfer Fee may deduct a small amount on the transfer out
    const received = afterBalance - beforeBalance;
    expect(received).to.be.greaterThanOrEqual(199); // Allow for rounding from transfer fee
    expect(received).to.be.lessThanOrEqual(200);

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.totalWgbDeposited.toNumber()).to.equal(400);
    expect(poolAccount.totalStWgbMinted.toNumber()).to.equal(200);

    console.log(
      `    User A withdrew 100 stWGB → received ${received} WGB (pool: 400/200)`
    );
  });

  it("rejects deposit of zero amount", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      await program.methods
        .deposit(new BN(0))
        .accountsPartial({
          stakePool: stakePoolPda,
          wgbMint: wgbMint.publicKey,
          stWgbMint: stWgbMintKeypair.publicKey,
          vault: vaultAta,
          userWgbAccount: userAWgbAccount,
          userStWgbAccount: userAStWgbAccount,
          user: userA.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .signers([userA])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected zero deposit to fail");
    } catch (err) {
      const message = String(err);
      expect(
        message.includes("ZeroAmount") ||
          message.includes("Amount must be greater than zero")
      ).to.equal(true);
      console.log("    Zero deposit correctly rejected");
    }
  });

  it("rejects withdrawal of zero amount", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      await program.methods
        .withdraw(new BN(0))
        .accountsPartial({
          stakePool: stakePoolPda,
          wgbMint: wgbMint.publicKey,
          stWgbMint: stWgbMintKeypair.publicKey,
          vault: vaultAta,
          userWgbAccount: userAWgbAccount,
          userStWgbAccount: userAStWgbAccount,
          user: userA.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .signers([userA])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected zero withdrawal to fail");
    } catch (err) {
      const message = String(err);
      expect(
        message.includes("ZeroAmount") ||
          message.includes("Amount must be greater than zero")
      ).to.equal(true);
      console.log("    Zero withdrawal correctly rejected");
    }
  });

  it("admin can pause the pool", async () => {
    await program.methods
      .setPaused(true)
      .accountsPartial({
        stakePool: stakePoolPda,
        authority: payer.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.isPaused).to.equal(true);
    console.log("    Pool paused successfully");
  });

  it("rejects deposit when pool is paused", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      await program.methods
        .deposit(new BN(10))
        .accountsPartial({
          stakePool: stakePoolPda,
          wgbMint: wgbMint.publicKey,
          stWgbMint: stWgbMintKeypair.publicKey,
          vault: vaultAta,
          userWgbAccount: userAWgbAccount,
          userStWgbAccount: userAStWgbAccount,
          user: userA.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        } as any)
        .signers([userA])
        .rpc({ commitment: "confirmed" });

      expect.fail("Expected deposit to fail when paused");
    } catch (err) {
      const message = String(err);
      expect(
        message.includes("PoolPaused") ||
          message.includes("Pool is paused")
      ).to.equal(true);
      console.log("    Deposit correctly rejected when paused");
    }
  });

  it("admin can unpause the pool", async () => {
    await program.methods
      .setPaused(false)
      .accountsPartial({
        stakePool: stakePoolPda,
        authority: payer.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.isPaused).to.equal(false);
    console.log("    Pool unpaused successfully");
  });

  it("user B withdraws all 200 stWGB → receives proportional WGB", async () => {
    const vaultAta = getAssociatedTokenAddressSync(
      wgbMint.publicKey,
      stakePoolPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const beforeInfo = await connection.getTokenAccountBalance(userBWgbAccount);
    const beforeBalance = Number(beforeInfo.value.amount);

    await program.methods
      .withdraw(new BN(200))
      .accountsPartial({
        stakePool: stakePoolPda,
        wgbMint: wgbMint.publicKey,
        stWgbMint: stWgbMintKeypair.publicKey,
        vault: vaultAta,
        userWgbAccount: userBWgbAccount,
        userStWgbAccount: userBStWgbAccount,
        user: userB.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .signers([userB])
      .rpc({ commitment: "confirmed" });

    const afterInfo = await connection.getTokenAccountBalance(userBWgbAccount);
    const afterBalance = Number(afterInfo.value.amount);

    const received = afterBalance - beforeBalance;
    // 200 stWGB at 400/200 rate = 400 WGB
    expect(received).to.be.greaterThanOrEqual(399);
    expect(received).to.be.lessThanOrEqual(400);

    const poolAccount = await program.account.stakePool.fetch(stakePoolPda);
    expect(poolAccount.totalWgbDeposited.toNumber()).to.equal(0);
    expect(poolAccount.totalStWgbMinted.toNumber()).to.equal(0);

    console.log(
      `    User B withdrew 200 stWGB → received ${received} WGB (pool empty: 0/0)`
    );
  });
});
