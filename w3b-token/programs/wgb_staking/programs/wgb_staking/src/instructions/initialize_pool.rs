use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::Mint;

use crate::state::StakePool;

pub fn handler(
    ctx: Context<InitializePool>,
    fee_basis_points: u16,
    unbonding_period: i64,
) -> Result<()> {
    let pool = &mut ctx.accounts.stake_pool;

    pool.authority = ctx.accounts.authority.key();
    pool.wgb_mint = ctx.accounts.wgb_mint.key();
    pool.st_wgb_mint = ctx.accounts.st_wgb_mint.key();
    pool.vault = ctx.accounts.vault.key();

    pool.total_wgb_deposited = 0;
    pool.total_st_wgb_minted = 0;

    pool.fee_basis_points = fee_basis_points;
    pool.unbonding_period = unbonding_period;
    pool.is_paused = false;

    pool.bump = ctx.bumps.stake_pool;
    pool.vault_bump = ctx.bumps.vault;
    pool.st_wgb_mint_bump = ctx.bumps.st_wgb_mint;

    emit!(PoolInitialized {
        authority: pool.authority,
        wgb_mint: pool.wgb_mint,
        st_wgb_mint: pool.st_wgb_mint,
        vault: pool.vault,
        fee_basis_points,
        unbonding_period,
        timestamp: Clock::get()?.unix_timestamp,
    });

    msg!("WGB Staking Pool initialized");
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = StakePool::LEN,
        seeds = [b"stake_pool"],
        bump,
    )]
    pub stake_pool: Account<'info, StakePool>,

    /// The WGB Token-2022 mint (must already exist)
    pub wgb_mint: InterfaceAccount<'info, Mint>,

    /// stWGB receipt token mint — created as a PDA owned by the stake pool.
    /// Initialized via CPI in a separate step or via Anchor's init constraint
    /// with token_2022 extensions. We use `init` with seeds here.
    /// CHECK: This is initialized as a Token-2022 mint by the client before calling
    /// this instruction, or we initialize it inline. For simplicity, we accept
    /// a pre-created mint whose authority is the stake_pool PDA.
    #[account(
        mut,
        seeds = [b"st_wgb_mint"],
        bump,
    )]
    /// CHECK: Validated by seeds; mint initialization handled off-chain or via companion ix
    pub st_wgb_mint: AccountInfo<'info>,

    /// Vault token account — holds staked WGB. Created as an ATA or PDA token account.
    #[account(
        mut,
        seeds = [b"vault"],
        bump,
    )]
    /// CHECK: Validated by seeds; token account initialization handled off-chain or via companion ix
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct PoolInitialized {
    pub authority: Pubkey,
    pub wgb_mint: Pubkey,
    pub st_wgb_mint: Pubkey,
    pub vault: Pubkey,
    pub fee_basis_points: u16,
    pub unbonding_period: i64,
    pub timestamp: i64,
}
