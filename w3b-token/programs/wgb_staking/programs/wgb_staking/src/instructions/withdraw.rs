use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022, TransferChecked, Burn};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::state::StakePool;
use crate::errors::StakingError;

pub fn handler(ctx: Context<Withdraw>, st_wgb_amount: u64) -> Result<()> {
    require!(st_wgb_amount > 0, StakingError::ZeroAmount);

    let pool = &ctx.accounts.stake_pool;
    require!(!pool.is_paused, StakingError::PoolPaused);

    // Calculate WGB to return based on current exchange rate
    let wgb_to_return = pool
        .st_wgb_to_wgb(st_wgb_amount)
        .ok_or(StakingError::MathOverflow)?;

    require!(wgb_to_return > 0, StakingError::ExchangeRateZero);
    require!(
        wgb_to_return <= pool.total_wgb_deposited,
        StakingError::InsufficientBalance
    );

    // 1. Burn stWGB from user
    token_2022::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.st_wgb_mint.to_account_info(),
                from: ctx.accounts.user_st_wgb_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        st_wgb_amount,
    )?;

    // 2. Transfer WGB from vault to user (PDA signer)
    let seeds = &[b"stake_pool".as_ref(), &[pool.bump]];
    let signer = &[&seeds[..]];
    let decimals = ctx.accounts.wgb_mint.decimals;

    token_2022::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.wgb_mint.to_account_info(),
                to: ctx.accounts.user_wgb_account.to_account_info(),
                authority: ctx.accounts.stake_pool.to_account_info(),
            },
            signer,
        ),
        wgb_to_return,
        decimals,
    )?;

    // 3. Update pool state
    let pool_mut = &mut ctx.accounts.stake_pool;
    pool_mut.total_wgb_deposited = pool_mut
        .total_wgb_deposited
        .checked_sub(wgb_to_return)
        .ok_or(StakingError::MathOverflow)?;
    pool_mut.total_st_wgb_minted = pool_mut
        .total_st_wgb_minted
        .checked_sub(st_wgb_amount)
        .ok_or(StakingError::MathOverflow)?;

    emit!(Withdrawn {
        user: ctx.accounts.user.key(),
        st_wgb_burned: st_wgb_amount,
        wgb_returned: wgb_to_return,
        new_exchange_rate_num: pool_mut.total_wgb_deposited,
        new_exchange_rate_den: pool_mut.total_st_wgb_minted,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Withdrew: burned {} stWGB → returned {} WGB",
        st_wgb_amount,
        wgb_to_return
    );
    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"stake_pool"],
        bump = stake_pool.bump,
        constraint = !stake_pool.is_paused @ StakingError::PoolPaused,
    )]
    pub stake_pool: Account<'info, StakePool>,

    /// WGB mint (Token-2022) — needed for transfer_checked
    #[account(
        constraint = wgb_mint.key() == stake_pool.wgb_mint @ StakingError::InvalidMint,
    )]
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

    /// User's WGB token account (destination)
    #[account(
        mut,
        token::mint = wgb_mint,
        token::authority = user,
    )]
    pub user_wgb_account: InterfaceAccount<'info, TokenAccount>,

    /// User's stWGB token account (source for burning)
    #[account(
        mut,
        token::mint = st_wgb_mint,
        token::authority = user,
    )]
    pub user_st_wgb_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub st_wgb_burned: u64,
    pub wgb_returned: u64,
    pub new_exchange_rate_num: u64,
    pub new_exchange_rate_den: u64,
    pub timestamp: i64,
}
