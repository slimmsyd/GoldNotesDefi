use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HWufoUDwQDXPDwcyECk1PHmBJi4ziFY913U7jfSoLqy2");

#[program]
pub mod wgb_staking {
    use super::*;

    /// Initialize the staking pool, vault, and stWGB mint.
    /// The stWGB mint and vault token account must be created by the client
    /// before calling this instruction (using Token-2022 with extensions).
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        fee_basis_points: u16,
        unbonding_period: i64,
    ) -> Result<()> {
        instructions::initialize_pool::handler(ctx, fee_basis_points, unbonding_period)
    }

    /// Deposit WGB into the stake pool. Receives stWGB at the current exchange rate.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    /// Withdraw WGB from the stake pool by burning stWGB at the current exchange rate.
    pub fn withdraw(ctx: Context<Withdraw>, st_wgb_amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, st_wgb_amount)
    }

    /// Inject yield into the vault without minting new stWGB.
    /// Increases the exchange rate for all stakers.
    pub fn inject_yield(ctx: Context<InjectYield>, amount: u64) -> Result<()> {
        instructions::inject_yield::handler(ctx, amount)
    }

    /// Pause or unpause the pool (authority only).
    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.stake_pool.is_paused = paused;
        msg!("Pool paused: {}", paused);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"stake_pool"],
        bump = stake_pool.bump,
        has_one = authority,
    )]
    pub stake_pool: Account<'info, state::StakePool>,
    pub authority: Signer<'info>,
}
