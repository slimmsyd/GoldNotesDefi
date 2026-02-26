use anchor_lang::prelude::*;

#[account]
pub struct StakePool {
    pub authority: Pubkey,
    pub wgb_mint: Pubkey,
    pub st_wgb_mint: Pubkey,
    pub vault: Pubkey,

    pub total_wgb_deposited: u64,
    pub total_st_wgb_minted: u64,

    pub fee_basis_points: u16,
    pub unbonding_period: i64,
    pub is_paused: bool,

    pub bump: u8,
    pub vault_bump: u8,
    pub st_wgb_mint_bump: u8,

    pub _reserved: [u8; 64],
}

impl StakePool {
    pub const LEN: usize = 8  // discriminator
        + 32  // authority
        + 32  // wgb_mint
        + 32  // st_wgb_mint
        + 32  // vault
        + 8   // total_wgb_deposited
        + 8   // total_st_wgb_minted
        + 2   // fee_basis_points
        + 8   // unbonding_period
        + 1   // is_paused
        + 1   // bump
        + 1   // vault_bump
        + 1   // st_wgb_mint_bump
        + 64; // _reserved

    /// Calculate how many stWGB tokens to mint for a given WGB deposit.
    /// Uses u128 intermediaries to prevent overflow on multiply-before-divide.
    pub fn wgb_to_st_wgb(&self, wgb_amount: u64) -> Option<u64> {
        if self.total_wgb_deposited == 0 || self.total_st_wgb_minted == 0 {
            return Some(wgb_amount);
        }

        let numerator = (wgb_amount as u128)
            .checked_mul(self.total_st_wgb_minted as u128)?;
        let result = numerator.checked_div(self.total_wgb_deposited as u128)?;

        u64::try_from(result).ok()
    }

    /// Calculate how many WGB tokens to return for a given stWGB burn.
    pub fn st_wgb_to_wgb(&self, st_wgb_amount: u64) -> Option<u64> {
        if self.total_st_wgb_minted == 0 {
            return None;
        }

        let numerator = (st_wgb_amount as u128)
            .checked_mul(self.total_wgb_deposited as u128)?;
        let result = numerator.checked_div(self.total_st_wgb_minted as u128)?;

        u64::try_from(result).ok()
    }
}
