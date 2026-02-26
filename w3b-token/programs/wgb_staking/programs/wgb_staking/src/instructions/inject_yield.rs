use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::state::StakePool;
use crate::errors::StakingError;

pub fn handler(ctx: Context<InjectYield>, amount: u64) -> Result<()> {
    require!(amount > 0, StakingError::ZeroAmount);

    let decimals = ctx.accounts.wgb_mint.decimals;

    token_2022::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.injector_wgb_account.to_account_info(),
                mint: ctx.accounts.wgb_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.injector.to_account_info(),
            },
        ),
        amount,
        decimals,
    )?;

    // Update pool state — only vault balance increases, stWGB supply stays constant
    let pool_mut = &mut ctx.accounts.stake_pool;
    pool_mut.total_wgb_deposited = pool_mut
        .total_wgb_deposited
        .checked_add(amount)
        .ok_or(StakingError::MathOverflow)?;

    let new_rate_num = pool_mut.total_wgb_deposited;
    let new_rate_den = pool_mut.total_st_wgb_minted;

    emit!(YieldInjected {
        injector: ctx.accounts.injector.key(),
        amount,
        new_total_wgb: new_rate_num,
        total_st_wgb: new_rate_den,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!(
        "Yield injected: {} WGB → exchange rate now {}/{}",
        amount,
        new_rate_num,
        new_rate_den
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InjectYield<'info> {
    #[account(
        mut,
        seeds = [b"stake_pool"],
        bump = stake_pool.bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    /// WGB mint (Token-2022) — needed for transfer_checked
    #[account(
        constraint = wgb_mint.key() == stake_pool.wgb_mint @ StakingError::InvalidMint,
    )]
    pub wgb_mint: InterfaceAccount<'info, Mint>,

    /// Vault holding staked WGB
    #[account(
        mut,
        constraint = vault.key() == stake_pool.vault @ StakingError::InvalidMint,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Source WGB token account (from the yield injector)
    #[account(
        mut,
        token::mint = wgb_mint,
        token::authority = injector,
    )]
    pub injector_wgb_account: InterfaceAccount<'info, TokenAccount>,

    /// Anyone can inject yield (permissionless). In practice, this will be
    /// an admin/operator calling from the fee treasury, but we don't restrict it.
    #[account(mut)]
    pub injector: Signer<'info>,

    pub token_program: Program<'info, Token2022>,
}

#[event]
pub struct YieldInjected {
    pub injector: Pubkey,
    pub amount: u64,
    pub new_total_wgb: u64,
    pub total_st_wgb: u64,
    pub timestamp: i64,
}
