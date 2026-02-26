use anchor_lang::prelude::*;

#[error_code]
pub enum StakingError {
    #[msg("Pool is paused")]
    PoolPaused,
    #[msg("Insufficient balance for this operation")]
    InsufficientBalance,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid mint provided")]
    InvalidMint,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Unbonding period has not elapsed")]
    UnbondingPeriodNotMet,
    #[msg("Unauthorized — caller is not the pool authority")]
    Unauthorized,
    #[msg("Exchange rate calculation returned zero — deposit too small")]
    ExchangeRateZero,
}
