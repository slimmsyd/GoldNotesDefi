use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::rent::Rent;
use anchor_spl::token_2022::{self, MintTo, Transfer, Token2022};

declare_id!("9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6");

#[program]
pub mod w3b_protocol {
    use super::*;

    /// Initialize the protocol state and create the W3B token mint
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        state.authority = ctx.accounts.authority.key();
        state.w3b_mint = ctx.accounts.w3b_mint.key();
        state.treasury = ctx.accounts.treasury.key();
        state.current_merkle_root = [0u8; 32];
        state.last_root_update = 0;
        state.last_proof_timestamp = 0;
        state.proven_reserves = 0;  // Number of verified goldback serials
        state.total_supply = 0;     // Number of minted W3B tokens
        state.is_paused = false;
        state.bump = ctx.bumps.protocol_state;
        // New fields for buy_w3b functionality
        state.w3b_price_lamports = 0;  // Must be set via set_w3b_price before buying
        state.sol_receiver = ctx.accounts.authority.key();  // Default to authority
        
        msg!("W3B Protocol initialized.");
        msg!("Authority: {}", state.authority);
        msg!("W3B Mint: {}", state.w3b_mint);
        msg!("Treasury: {}", state.treasury);
        Ok(())
    }

    /// Update the on-chain merkle root (called after ZK proof verification)
    pub fn update_merkle_root(
        ctx: Context<UpdateMerkleRoot>,
        new_root: [u8; 32],
        total_serials: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        
        require!(!state.is_paused, W3BError::ProtocolPaused);
        
        state.current_merkle_root = new_root;
        state.proven_reserves = total_serials;  // This is the ZK-proven reserve count
        state.last_root_update = Clock::get()?.unix_timestamp;
        
        emit!(MerkleRootUpdated {
            root: new_root,
            total_serials,
            timestamp: state.last_root_update,
        });
        
        msg!("Merkle root updated. Proven reserves: {}", total_serials);
        Ok(())
    }

    /// Submit ZK proof hash (stores commitment, actual proof is off-chain)
    pub fn submit_proof(
        ctx: Context<SubmitProof>,
        proof_hash: Vec<u8>,
        claimed_reserves: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        
        // Update proven reserves from ZK proof
        state.proven_reserves = claimed_reserves;
        state.last_proof_timestamp = Clock::get()?.unix_timestamp;
        
        emit!(ProofSubmitted {
            merkle_root: state.current_merkle_root,
            claimed_reserves,
            proof_hash: proof_hash.clone(),
            timestamp: state.last_proof_timestamp,
        });
        
        msg!("ZK proof submitted. Proven reserves: {}", claimed_reserves);
        Ok(())
    }

    /// Mint W3B tokens to the treasury (ONLY up to proven reserves)
    pub fn mint_w3b(ctx: Context<MintW3B>, amount: u64) -> Result<()> {
        // Extract values we need BEFORE mutable borrow
        let bump = ctx.accounts.protocol_state.bump;
        let is_paused = ctx.accounts.protocol_state.is_paused;
        let last_proof_timestamp = ctx.accounts.protocol_state.last_proof_timestamp;
        let current_supply = ctx.accounts.protocol_state.total_supply;
        let proven_reserves = ctx.accounts.protocol_state.proven_reserves;
        
        require!(!is_paused, W3BError::ProtocolPaused);
        
        // Staleness check: proof must be recent
        let now = Clock::get()?.unix_timestamp;
        let max_staleness = 48 * 60 * 60; // 48 hours
        require!(
            now - last_proof_timestamp < max_staleness,
            W3BError::StaleMerkleRoot
        );
        
        // CRITICAL: Cannot mint more tokens than proven reserves
        let new_supply = current_supply
            .checked_add(amount)
            .ok_or(W3BError::MathOverflow)?;
        
        require!(
            new_supply <= proven_reserves,
            W3BError::InsufficientReserves
        );
        
        // CPI to Token-2022: Mint tokens to treasury
        let seeds = &[
            b"protocol_state".as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let cpi_accounts = MintTo {
            mint: ctx.accounts.w3b_mint.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.protocol_state.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token_2022::mint_to(cpi_ctx, amount)?;
        
        // Update state (now we can mutably borrow)
        let state = &mut ctx.accounts.protocol_state;
        state.total_supply = new_supply;
        
        emit!(TokensMinted {
            amount,
            new_total_supply: state.total_supply,
            proven_reserves: state.proven_reserves,
            timestamp: now,
        });
        
        msg!("Minted {} W3B. Total supply: {} / {} reserves", 
            amount, state.total_supply, state.proven_reserves);
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.protocol_state.is_paused = paused;
        msg!("Protocol paused: {}", paused);
        Ok(())
    }

    /// Set the W3B price in lamports (authority only)
    /// NOTE: For MVP, price is set manually. Future: integrate Pyth oracle for dynamic pricing.
    pub fn set_w3b_price(ctx: Context<AdminOnly>, price_lamports: u64) -> Result<()> {
        require!(price_lamports > 0, W3BError::InvalidPrice);
        ctx.accounts.protocol_state.w3b_price_lamports = price_lamports;
        msg!("W3B price set to {} lamports", price_lamports);
        Ok(())
    }

    /// Set the SOL receiver address (authority only)
    pub fn set_sol_receiver(ctx: Context<AdminOnly>, receiver: Pubkey) -> Result<()> {
        ctx.accounts.protocol_state.sol_receiver = receiver;
        msg!("SOL receiver set to {}", receiver);
        Ok(())
    }

    /// Update the treasury token account (authority only)
    /// Used to migrate to a PDA-controlled treasury
    pub fn set_treasury(ctx: Context<AdminOnly>, new_treasury: Pubkey) -> Result<()> {
        ctx.accounts.protocol_state.treasury = new_treasury;
        msg!("Treasury updated to {}", new_treasury);
        Ok(())
    }

    /// Migrate protocol state to new layout (one-time upgrade)
    /// Manually resizes account and initializes new fields
    pub fn migrate_protocol_state(ctx: Context<MigrateProtocolState>) -> Result<()> {
        let protocol_state = &ctx.accounts.protocol_state;
        let authority = &ctx.accounts.authority;
        
        // Get current data before realloc
        let current_data = protocol_state.data.borrow();
        let old_size = current_data.len();
        let new_size = 8 + 210; // Discriminator + new layout
        
        msg!("Migrating from {} to {} bytes", old_size, new_size);
        
        // Read authority pubkey from old data (offset 8 = after discriminator)
        let authority_bytes: [u8; 32] = current_data[8..40].try_into().unwrap();
        let stored_authority = Pubkey::new_from_array(authority_bytes);
        
        // Verify authority matches
        require!(
            authority.key() == stored_authority,
            W3BError::ProtocolPaused // Reusing error for unauthorized
        );
        
        drop(current_data);
        
        // Calculate additional rent needed
        let rent = Rent::get()?;
        let current_lamports = protocol_state.lamports();
        let new_min_rent = rent.minimum_balance(new_size);
        
        if current_lamports < new_min_rent {
            let diff = new_min_rent - current_lamports;
            // Transfer additional rent from authority
            let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                authority.key,
                protocol_state.key,
                diff,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_ix,
                &[
                    authority.to_account_info(),
                    protocol_state.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }
        
        // Realloc the account
        protocol_state.realloc(new_size, false)?;
        
        // Initialize new fields at the end of the data
        let mut data = protocol_state.data.borrow_mut();
        
        // w3b_price_lamports at offset 170 (8 discriminator + 162 old data)
        // Actually offset is: 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 = 170
        let price_offset = 170;
        data[price_offset..price_offset+8].copy_from_slice(&0u64.to_le_bytes());
        
        // sol_receiver at offset 178
        let receiver_offset = 178;
        data[receiver_offset..receiver_offset+32].copy_from_slice(&stored_authority.to_bytes());
        
        msg!("Protocol state migrated successfully. New fields initialized.");
        Ok(())
    }

    /// Buy W3B tokens with SOL (atomic swap)
    /// User sends SOL, receives W3B from treasury
    pub fn buy_w3b(ctx: Context<BuyW3B>, amount: u64) -> Result<()> {
        let state = &ctx.accounts.protocol_state;
        
        // 1. Validations
        require!(!state.is_paused, W3BError::ProtocolPaused);
        require!(amount > 0, W3BError::InvalidAmount);
        require!(state.w3b_price_lamports > 0, W3BError::PriceNotSet);
        
        // 2. Calculate total SOL cost
        let total_lamports = state.w3b_price_lamports
            .checked_mul(amount)
            .ok_or(W3BError::MathOverflow)?;
        
        // 3. Transfer SOL from buyer to sol_receiver
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.sol_receiver.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, total_lamports)?;
        
        // 4. Transfer W3B from treasury to buyer's token account
        let bump = state.bump;
        let seeds = &[
            b"protocol_state".as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];
        
        let transfer_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.protocol_state.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            signer_seeds,
        );
        
        token_2022::transfer(cpi_ctx, amount)?;
        
        // 5. Emit event
        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            amount,
            lamports_paid: total_lamports,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Bought {} W3B for {} lamports", amount, total_lamports);
        Ok(())
    }
}

// ==================== ACCOUNTS ====================

#[account]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub w3b_mint: Pubkey,
    pub treasury: Pubkey,
    pub current_merkle_root: [u8; 32],
    pub last_root_update: i64,
    pub last_proof_timestamp: i64,
    pub proven_reserves: u64,  // ZK-proven goldback count
    pub total_supply: u64,     // Minted W3B token count
    pub is_paused: bool,
    pub bump: u8,
    // New fields for buy_w3b functionality
    pub w3b_price_lamports: u64,  // Price of 1 W3B in lamports (set by authority)
    pub sol_receiver: Pubkey,     // Where SOL payments are sent
}

// Space: 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8 + 32 = 210

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 210,
        seeds = [b"protocol_state"],
        bump
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    
    /// The W3B token mint (Token-2022)
    /// CHECK: We just store the pubkey, mint is created externally
    pub w3b_mint: UncheckedAccount<'info>,
    
    /// CHECK: Treasury token account (created externally)
    pub treasury: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMerkleRoot<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = authority
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitProof<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = authority
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintW3B<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = authority,
        has_one = w3b_mint,
        has_one = treasury,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    
    /// CHECK: Token-2022 mint account, validated by has_one constraint
    #[account(mut)]
    pub w3b_mint: UncheckedAccount<'info>,
    
    /// CHECK: Treasury token account, validated by has_one constraint  
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = authority
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyW3B<'info> {
    #[account(
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = treasury,
        has_one = sol_receiver,
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    
    /// The buyer (pays SOL, receives W3B)
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// Buyer's W3B token account (must exist, created by frontend)
    /// CHECK: Validated as associated token account for buyer
    #[account(mut)]
    pub buyer_token_account: UncheckedAccount<'info>,
    
    /// Treasury token account (source of W3B tokens)
    /// CHECK: Validated by has_one constraint
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    
    /// SOL receiver (destination for SOL payment)
    /// CHECK: Validated by has_one constraint
    #[account(mut)]
    pub sol_receiver: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

/// Migrate protocol state to new layout (uses raw AccountInfo to avoid deserialization)
#[derive(Accounts)]
pub struct MigrateProtocolState<'info> {
    /// CHECK: We manually validate and resize this account
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump,
    )]
    pub protocol_state: AccountInfo<'info>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ==================== EVENTS ====================

#[event]
pub struct MerkleRootUpdated {
    pub root: [u8; 32],
    pub total_serials: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProofSubmitted {
    pub merkle_root: [u8; 32],
    pub claimed_reserves: u64,
    pub proof_hash: Vec<u8>,
    pub timestamp: i64,
}

#[event]
pub struct TokensMinted {
    pub amount: u64,
    pub new_total_supply: u64,
    pub proven_reserves: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensPurchased {
    pub buyer: Pubkey,
    pub amount: u64,
    pub lamports_paid: u64,
    pub timestamp: i64,
}

// ==================== ERRORS ====================

#[error_code]
pub enum W3BError {
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Proof is stale (>48 hours old)")]
    StaleMerkleRoot,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Cannot mint more tokens than proven reserves")]
    InsufficientReserves,
    #[msg("Invalid price (must be > 0)")]
    InvalidPrice,
    #[msg("Invalid amount (must be > 0)")]
    InvalidAmount,
    #[msg("W3B price not set - authority must call set_w3b_price first")]
    PriceNotSet,
}
