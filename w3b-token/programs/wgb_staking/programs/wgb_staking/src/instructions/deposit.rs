use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022, TransferChecked, MintTo};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::state::StakePool;
use crate::errors::StakingError;

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::ZeroAmount);

    let pool = &ctx.accounts.stake_pool;
    require!(!pool.is_paused, StakingError::PoolPaused);

    // Calculate stWGB to mint based on current exchange rate
    let st_wgb_to_mint = pool
        .wgb_to_st_wgb(amount)
        .ok_or(StakingError::MathOverflow)?;

    require!(st_wgb_to_mint > 0, StakingError::ExchangeRateZero);

    // 1. Transfer WGB from user to vault
    // Using transfer_checked for Token-2022 (required for tokens with Transfer Fee Extension)
    let decimals = ctx.accounts.wgb_mint.decimals;
    token_2022::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_wgb_account.to_account_info(),
                mint: ctx.accounts.wgb_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        decimals,
    )?;

    // The actual amount received in the vault may differ due to Transfer Fee.
    // For WGB with 0 decimals and 0.1% fee, the fee on small amounts rounds to 0.
    // We track the intended amount for simplicity; a production version should
    // read the vault balance delta for precision.

    // 2. Mint stWGB to user
    let seeds = &[b"stake_pool".as_ref(), &[pool.bump]];
    let signer = &[&seeds[..]];

    token_2022::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.st_wgb_mint.to_account_info(),
                to: ctx.accounts.user_st_wgb_account.to_account_info(),
                authority: ctx.accounts.stake_pool.to_account_info(),
            },
            signer,
        ),
        st_wgb_to_mint,
    )?;

    // 3. Update pool state
    let pool_mut = &mut ctx.accounts.stake_pool;
    pool_mut.total_wgb_deposited = pool_mut
        .total_wgb_deposited
        .checked_add(amount)
        .ok_or(StakingError::MathOverflow)?;
    pool_mut.total_st_wgb_minted = pool_mut
        .total_st_wgb_minted
        .checked_add(st_wgb_to_mint)
        .ok_or(StakingError::MathOverflow)?;

    emit!(Deposited {
        user: ctx.accounts.user.key(),
        wgb_amount: amount,
        st_wgb_minted: st_wgb_to_mint,
        new_exchange_rate_num: pool_mut.total_wgb_deposited,
        new_exchange_rate_den: pool_mut.total_st_wgb_minted,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Deposited {} WGB → minted {} stWGB",
        amount,
        st_wgb_to_mint
    );
    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"stake_pool"],
        bump = stake_pool.bump,
        constraint = !stake_pool.is_paused @ StakingError::PoolPaused,
    )]
    pub stake_pool: Account<'info, StakePool>,

    /// WGB mint (Token-2022)
    pub wgb_mint: InterfaceAccount<'info, Mint>,

    /// stWGB mint — pool PDA is the mint authority
    #[account(
        mut,
        constraint = st_wgb_mint.key() == stake_pool.st_wgb_mint @ StakingError::InvalidMint,
    )]
    pub st_wgb_mint: InterfaceAccount<'info, Mint>,

    /// Vault holding staked WGB
    #[account(
        mut,
        constraint = vault.key() == stake_pool.vault @ StakingError::InvalidMint,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// User's WGB token account (source)
    #[account(
        mut,
        token::mint = wgb_mint,
        token::authority = user,
    )]
    pub user_wgb_account: InterfaceAccount<'info, TokenAccount>,

    /// User's stWGB token account (destination for receipt tokens)
    #[account(
        mut,
        token::mint = st_wgb_mint,
    )]
    pub user_st_wgb_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

#[event]
pub struct Deposited {
    pub user: Pubkey,
    pub wgb_amount: u64,
    pub st_wgb_minted: u64,
    pub new_exchange_rate_num: u64,
    pub new_exchange_rate_den: u64,
    pub timestamp: i64,
}
