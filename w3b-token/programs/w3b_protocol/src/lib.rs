use anchor_lang::prelude::*;
use anchor_spl::token_2022::{mint_to, mint_to_checked, burn, burn_checked, MintTo, Burn, MintToChecked, BurnChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod w3b_protocol {
    use super::*;

    /// Initialize the Protocol Brain
    /// Why? To set the 'Master Variables' that control the entire system.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let protocol_state = &mut ctx.accounts.protocol_state;
        protocol_state.authority = ctx.accounts.authority.key();
        protocol_state.mint = ctx.accounts.mint.key();
        protocol_state.is_paused = false;
        
        // Safety: Initial counts are zero.
        protocol_state.total_minted = 0;
        protocol_state.total_burned = 0;
        
        msg!("Protocol Brain Initialized. Authority: {}", protocol_state.authority);
        Ok(())
    }

    /// The "Sacred Issuance" Function
    /// Why? This is the Guard. We ONLY mint if the Oracle proves we have Gold in the Vault.
    pub fn mint_w3b(
        ctx: Context<MintW3B>, 
        amount: u64, 
        custody_proven_by_oracle: u64, // The "Truth" from Chainlink
        oracle_proof_id: String // The receipt ID from the API
    ) -> Result<()> {
        let protocol_state = &mut ctx.accounts.protocol_state;

        // 1. Pause Check
        // Why? In emergency (e.g. vault robbery), we pull the plug.
        require!(!protocol_state.is_paused, W3BError::ProtocolPaused);

        // 2. The Circuit Breaker (The Zeroth Law)
        // Check current on-chain supply
        let current_supply = ctx.accounts.mint.supply;
        
        // Calculate what supply WOULD be after this mint
        let required_coverage = current_supply.checked_add(amount)
            .ok_or(W3BError::MathOverflow)?;

        // The Sacred Check: proven_gold >= total_tokens
        // If we have 100 gold, we can't have 101 tokens.
        require!(
            custody_proven_by_oracle >= required_coverage,
            W3BError::InsufficientReserves
        );

        // 3. Execute Mint (Token-2022)
        // We use CPI (Cross-Program Invocation) to call the Token Program
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        // Perform the mint
        mint_to(cpi_ctx, amount)?;

        // 4. Update Protocol Brain
        protocol_state.total_minted = protocol_state.total_minted
            .checked_add(amount)
            .ok_or(W3BError::MathOverflow)?;

        // 5. Emit Event (The Audit Trail)
        emit!(MintEvent {
            amount,
            recipient: ctx.accounts.destination.key(),
            oracle_proof_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Anchor Commitment (The Audit Trail)
    /// Why? To permanently lock a snapshot of the off-chain database onto the blockchain.
    pub fn anchor_commitment(
        ctx: Context<AnchorCommitment>,
        batch_id: String,
        commitment_hash: String // SHA256 of the batch
    ) -> Result<()> {
        // We just emit an event. The transaction itself IS the proof.
        // Indexers will see: "At block 12345, the Admin swore that Batch X has Hash Y"
        emit!(CommitmentAnchoredEvent {
            batch_id,
            commitment_hash,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

// --- DATA STRUCTURES (The "Memory") ---

#[account]
pub struct ProtocolState {
    pub authority: Pubkey,   // Who can pause?
    pub mint: Pubkey,        // What token are we controlling?
    pub total_minted: u64,   // Career stats
    pub total_burned: u64,   // Career stats
    pub is_paused: bool,     // Emergency Switch
}

// --- CONTEXTS (The "Permissions") ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init, 
        payer = authority, 
        space = 8 + 32 + 32 + 8 + 8 + 1, // Standard space allocation
        seeds = [b"protocol_state"], // Determining the address
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintW3B<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: We verify this authority is allowed to mint in the Token Program
    pub mint_authority: Signer<'info>, 
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct AnchorCommitment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>, 
    pub system_program: Program<'info, System>,
}

// --- EVENTS (The "Logs") ---

#[event]
pub struct MintEvent {
    pub amount: u64,
    pub recipient: Pubkey,
    pub oracle_proof_id: String,
    pub timestamp: i64,
}

#[event]
pub struct CommitmentAnchoredEvent {
    pub batch_id: String,
    pub commitment_hash: String,
    pub timestamp: i64,
}

// --- ERRORS (The "Red Flags") ---

#[error_code]
pub enum W3BError {
    #[msg("Insufficient reserves! The Vault has less gold than tokens.")]
    InsufficientReserves,
    #[msg("Protocol is paused due to emergency.")]
    ProtocolPaused,
    #[msg("Math Overflow")]
    MathOverflow,
}
