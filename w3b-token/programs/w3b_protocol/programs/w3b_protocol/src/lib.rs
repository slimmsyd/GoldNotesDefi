use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::rent::Rent;
use anchor_spl::token_2022::{self, MintTo, Transfer, Burn, Token2022};
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("9xZaf2jccNqsfStFKqcXS9ubKfcZcqNbCmgPuHDLLtd6");

#[program]
pub mod w3b_protocol {
    use super::*;

    // ==================== ADMIN / MIGRATION ====================

    /// Initialize the protocol V2 (New Deployment)
    pub fn initialize_v2(ctx: Context<InitializeV2>) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        state.authority = ctx.accounts.authority.key();
        state.operator = ctx.accounts.authority.key(); // Default operator = admin
        state.w3b_mint = ctx.accounts.w3b_mint.key();
        state.treasury = ctx.accounts.treasury.key();
        state.sol_receiver = ctx.accounts.authority.key();

        state.current_merkle_root = [0u8; 32];
        state.proven_reserves = 0;
        state.total_supply = 0;
        state.total_burned = 0;
        state.yield_apy_bps = 0;
        state.total_yield_distributed = 0;
        state.last_yield_distribution = 0;
        
        state.is_paused = false;
        state.bump = ctx.bumps.protocol_state;

        msg!("W3B Protocol V2 Initialized");
        Ok(())
    }

    /// Set the Operator key (Admin only)
    pub fn set_operator(ctx: Context<AdminOnly>, new_operator: Pubkey) -> Result<()> {
        ctx.accounts.protocol_state.operator = new_operator;
        msg!("Operator updated to {}", new_operator);
        Ok(())
    }

    /// Migration: Upgrade V1 State to V2 (Admin only)
    pub fn migrate_v2(ctx: Context<MigrateV2>) -> Result<()> {
        let protocol_state = &ctx.accounts.protocol_state;
        let authority = &ctx.accounts.authority;

        // 0. Validate authority by reading raw bytes (authority = first Pubkey after 8-byte discriminator)
        {
            let data = protocol_state.try_borrow_data()?;
            require!(data.len() >= 40, W3BError::Unauthorized);
            let stored_authority = Pubkey::try_from(&data[8..40])
                .map_err(|_| error!(W3BError::Unauthorized))?;
            require!(stored_authority == authority.key(), W3BError::Unauthorized);
        }

        // 1. Resize account
        // V1 size: 218 bytes (approx) -> V2 size: ~400 bytes
        // We reserve extra space (512 bytes total) to avoid future resizing
        let new_size = 512;
        
        let rent = Rent::get()?;
        let current_lamports = protocol_state.lamports();
        let new_min_rent = rent.minimum_balance(new_size);

        if current_lamports < new_min_rent {
            let diff = new_min_rent - current_lamports;
            let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                authority.key,
                protocol_state.key,
                diff,
            );
            invoke(
                &transfer_ix,
                &[
                    authority.to_account_info(),
                    protocol_state.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        protocol_state.realloc(new_size, false)?;

        // 2. Initialize new fields manually (unsafe byte manipulation required for migration)
        // Note: In a real migration we'd deserialize, modify, serialize. 
        // For simplicity here we assume the expansion leaves new bytes as 0, 
        // and we just need to set the `operator` if it's not set.
        // HOWEVER, since we can't easily write raw bytes in Anchor without unsafe,
        // we'll rely on a follow-up `set_operator` call to fix the operator key 
        // if the zero-initialization relies on `Pubkey::default()`.
        
        msg!("Protocol state resized to {} bytes for V2", new_size);
        Ok(())
    }

    /// Fix V2 Layout: Remap V1 field offsets to V2 positions (Admin only, one-time)
    /// V1 inserted `operator` between authority and w3b_mint, shifting all offsets.
    /// This reads V1 data and writes it to V2 positions in the same buffer.
    pub fn fix_v2_layout(ctx: Context<MigrateV2>) -> Result<()> {
        let protocol_state = &ctx.accounts.protocol_state;
        let authority = &ctx.accounts.authority;

        // Validate authority (first 32 bytes after 8-byte discriminator)
        let authority_key;
        let w3b_mint;
        let treasury;
        let merkle_root: [u8; 32];
        let last_root_update: [u8; 8];
        let last_proof_timestamp: [u8; 8];
        let proven_reserves: [u8; 8];
        let total_supply: [u8; 8];
        let is_paused: u8;
        let bump: u8;
        let w3b_price_lamports: [u8; 8];
        let sol_receiver;

        {
            let data = protocol_state.try_borrow_data()?;
            require!(data.len() >= 218, W3BError::Unauthorized);

            // Read authority and validate
            authority_key = Pubkey::try_from(&data[8..40])
                .map_err(|_| error!(W3BError::Unauthorized))?;
            require!(authority_key == authority.key(), W3BError::Unauthorized);

            // Read all V1 fields at V1 offsets
            w3b_mint = Pubkey::try_from(&data[40..72]).unwrap();
            treasury = Pubkey::try_from(&data[72..104]).unwrap();

            let mut mr = [0u8; 32];
            mr.copy_from_slice(&data[104..136]);
            merkle_root = mr;

            let mut buf8 = [0u8; 8];
            buf8.copy_from_slice(&data[136..144]);
            last_root_update = buf8;

            buf8.copy_from_slice(&data[144..152]);
            last_proof_timestamp = buf8;

            buf8.copy_from_slice(&data[152..160]);
            proven_reserves = buf8;

            buf8.copy_from_slice(&data[160..168]);
            total_supply = buf8;

            is_paused = data[168];
            bump = data[169];

            buf8.copy_from_slice(&data[170..178]);
            w3b_price_lamports = buf8;

            sol_receiver = Pubkey::try_from(&data[178..210]).unwrap();
        }

        // Now write V2 layout (borrow mutably)
        {
            let mut data = protocol_state.try_borrow_mut_data()?;

            // Zero-fill data region (preserve 8-byte discriminator)
            for byte in data[8..].iter_mut() {
                *byte = 0;
            }

            // V2 offsets:
            // [8..40]    authority
            data[8..40].copy_from_slice(&authority_key.to_bytes());
            // [40..72]   operator = authority (will be overridden by set_operator later)
            data[40..72].copy_from_slice(&authority_key.to_bytes());
            // [72..104]  w3b_mint
            data[72..104].copy_from_slice(&w3b_mint.to_bytes());
            // [104..136] treasury
            data[104..136].copy_from_slice(&treasury.to_bytes());
            // [136..144] total_supply
            data[136..144].copy_from_slice(&total_supply);
            // [144..152] total_burned = 0 (already zeroed)
            // [152..184] current_merkle_root
            data[152..184].copy_from_slice(&merkle_root);
            // [184..192] proven_reserves
            data[184..192].copy_from_slice(&proven_reserves);
            // [192..200] last_root_update
            data[192..200].copy_from_slice(&last_root_update);
            // [200..208] last_proof_timestamp
            data[200..208].copy_from_slice(&last_proof_timestamp);
            // [208..216] w3b_price_lamports
            data[208..216].copy_from_slice(&w3b_price_lamports);
            // [216..248] sol_receiver
            data[216..248].copy_from_slice(&sol_receiver.to_bytes());
            // [248..250] yield_apy_bps = 0 (already zeroed)
            // [250..258] total_yield_distributed = 0 (already zeroed)
            // [258..266] last_yield_distribution = 0 (already zeroed)
            // [266]      is_paused
            data[266] = is_paused;
            // [267]      bump
            data[267] = bump;
            // [268..332] _reserved = 0 (already zeroed)
        }

        msg!("V2 layout fix applied: data remapped from V1 offsets to V2");
        Ok(())
    }

    // ==================== OPERATOR OPS (TIER 1 HARDENING) ====================

    /// Update Merkle Root (Operator)
    pub fn update_merkle_root(
        ctx: Context<OperatorOnly>,
        new_root: [u8; 32],
        total_serials: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_state.is_paused, W3BError::ProtocolPaused);

        let state = &mut ctx.accounts.protocol_state;
        state.current_merkle_root = new_root;
        state.proven_reserves = total_serials;
        state.last_root_update = Clock::get()?.unix_timestamp;

        emit!(MerkleRootUpdated {
            root: new_root,
            total_serials,
            timestamp: state.last_root_update,
        });

        Ok(())
    }

    /// Submit Proof (Operator) - Now Validates Logic!
    pub fn submit_proof(
        ctx: Context<OperatorOnly>,
        proof_hash: Vec<u8>,
        claimed_reserves: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        
        // CRitICAL CHECK: Claim must match what we already know from the Merkle update
        require!(
            claimed_reserves == state.proven_reserves,
            W3BError::ReserveCountMismatch
        );

        state.last_proof_timestamp = Clock::get()?.unix_timestamp;

        emit!(ProofSubmitted {
            merkle_root: state.current_merkle_root,
            claimed_reserves,
            proof_hash,
            timestamp: state.last_proof_timestamp,
        });

        Ok(())
    }

    /// Set Price with Bounds (Operator)
    pub fn set_w3b_price(ctx: Context<OperatorOnly>, price_lamports: u64) -> Result<()> {
        require!(price_lamports > 0, W3BError::InvalidPrice);
        
        let state = &mut ctx.accounts.protocol_state;
        let current = state.w3b_price_lamports;

        // Bounds Check: Max 20% swing allowed automatically
        if current > 0 {
            let max_change = current / 5; // 20%
            let diff = if price_lamports > current {
                price_lamports - current
            } else {
                current - price_lamports
            };
            require!(diff <= max_change, W3BError::PriceChangeExceedsLimit);
        }

        state.w3b_price_lamports = price_lamports;
        msg!("Price set to {} (Operator)", price_lamports);
        Ok(())
    }

    /// Mint W3B (Operator) - Typed Accounts
    pub fn mint_w3b(ctx: Context<MintW3B>, amount: u64) -> Result<()> {
        let state = &ctx.accounts.protocol_state;
        require!(!state.is_paused, W3BError::ProtocolPaused);
        
        // 1. Staleness Check
        let now = Clock::get()?.unix_timestamp;
        require!(
            now - state.last_proof_timestamp < 48 * 3600,
            W3BError::StaleMerkleRoot
        );

        // 2. Reserve Check
        let new_supply = state.total_supply.checked_add(amount).ok_or(W3BError::MathOverflow)?;
        require!(new_supply <= state.proven_reserves, W3BError::InsufficientReserves);

        // 3. CPI Mint
        let seeds = &[b"protocol_state".as_ref(), &[state.bump]];
        let signer = &[&seeds[..]];

        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.w3b_mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.protocol_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        // 4. Update State
        let state_mut = &mut ctx.accounts.protocol_state;
        state_mut.total_supply = new_supply;
        
        emit!(TokensMinted { amount, new_total_supply: new_supply, timestamp: now });
        Ok(())
    }

    // ==================== PUBLIC OPS (POINTS + REDEMPTION) ====================

    /// Initialize User Profile (Public)
    pub fn init_user_profile(ctx: Context<InitUserProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.user_profile;
        profile.user = ctx.accounts.user.key();
        profile.points = 0;
        profile.tier = 0; // Bronze
        profile.total_volume = 0;
        profile.total_redeemed = 0;
        profile.bump = ctx.bumps.user_profile;
        Ok(())
    }

    /// Buy W3B (Public) - Awards Points!
    pub fn buy_w3b(ctx: Context<BuyW3B>, amount: u64) -> Result<()> {
        let state = &ctx.accounts.protocol_state;
        require!(!state.is_paused, W3BError::ProtocolPaused);
        require!(state.w3b_price_lamports > 0, W3BError::PriceNotSet);

        // Rate limiting: max 1000 W3B per transaction
        require!(amount <= 1000, W3BError::ExceedsTransactionCap);

        let cost = state.w3b_price_lamports.checked_mul(amount).ok_or(W3BError::MathOverflow)?;

        // 1. Transfer SOL
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.sol_receiver.to_account_info(),
                },
            ),
            cost,
        )?;

        // 2. Transfer W3B
        let seeds = &[b"protocol_state".as_ref(), &[state.bump]];
        let signer = &[&seeds[..]];

        token_2022::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.protocol_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        // 3. Award Points (Check if profile exists)
        if let Some(profile) = &mut ctx.accounts.user_profile {
            profile.points = profile.points.saturating_add(amount); // 1 pt per W3B
            profile.total_volume = profile.total_volume.saturating_add(amount);
            
            // Tier Logic? (Simple version)
            if profile.points > 2000 { profile.tier = 3; } // Platinum
            else if profile.points > 500 { profile.tier = 2; } // Gold
            else if profile.points > 100 { profile.tier = 1; } // Silver
        }

        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            amount,
            lamports_paid: cost,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Burn to Redeem (Public) - Starts Redemption Flow
    pub fn burn_w3b(ctx: Context<BurnW3B>, amount: u64, request_id: u64) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;
        require!(!state.is_paused, W3BError::ProtocolPaused);

        // 1. Burn Tokens
        token_2022::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.w3b_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // 2. Update Protocol Stats
        state.total_supply = state.total_supply.checked_sub(amount).ok_or(W3BError::MathOverflow)?;
        state.total_burned = state.total_burned.checked_add(amount).ok_or(W3BError::MathOverflow)?;

        // 3. Create Redemption Request
        let req = &mut ctx.accounts.redemption_request;
        req.user = ctx.accounts.user.key();
        req.request_id = request_id;
        req.amount = amount;
        req.status = 0; // Pending
        req.created_at = Clock::get()?.unix_timestamp;
        req.bump = ctx.bumps.redemption_request;

        // 4. Points & Profile
        if let Some(profile) = &mut ctx.accounts.user_profile {
            // Double points for redemption!
            let points = amount.checked_mul(2).unwrap_or(amount);
            profile.points = profile.points.saturating_add(points);
            profile.total_redeemed = profile.total_redeemed.saturating_add(amount);
        }

        emit!(TokensBurned {
            user: ctx.accounts.user.key(),
            amount,
            request_id,
            timestamp: req.created_at,
        });

        msg!("Redemption Request #{} created for {} W3B", request_id, amount);
        Ok(())
    }

    /// Award Points Manually (Operator) - For off-chain purchases (e.g. Shop)
    pub fn award_points(ctx: Context<AwardPoints>, amount: u64) -> Result<()> {
        let profile = &mut ctx.accounts.user_profile;
        profile.points = profile.points.saturating_add(amount);
        msg!("Awarded {} points to {}", amount, profile.user);
        Ok(())
    }

    // ==================== P2P FULFILLMENT ====================

    /// Claim a pending redemption order (Public — race-to-accept)
    pub fn claim_redemption(ctx: Context<ClaimRedemption>) -> Result<()> {
        let req = &mut ctx.accounts.redemption_request;

        // Only pending orders can be claimed
        require!(req.status == 0, W3BError::InvalidRedemptionStatus);

        req.status = 1; // Claimed
        req.fulfiller = ctx.accounts.fulfiller.key();
        req.claimed_at = Clock::get()?.unix_timestamp;

        emit!(RedemptionClaimed {
            request_id: req.request_id,
            fulfiller: ctx.accounts.fulfiller.key(),
            timestamp: req.claimed_at,
        });

        msg!(
            "Redemption #{} claimed by {}",
            req.request_id,
            ctx.accounts.fulfiller.key()
        );
        Ok(())
    }

    /// Confirm delivery of a claimed redemption (Admin/Operator)
    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        let req = &mut ctx.accounts.redemption_request;

        // Only claimed orders can be confirmed
        require!(req.status == 1, W3BError::InvalidRedemptionStatus);

        req.status = 3; // Confirmed
        req.confirmed_at = Clock::get()?.unix_timestamp;

        // Reward the fulfiller — 5 points per order fulfilled + update stats
        if let Some(fulfiller_profile) = &mut ctx.accounts.fulfiller_profile {
            fulfiller_profile.points = fulfiller_profile.points.saturating_add(5);
            fulfiller_profile.total_fulfilled = fulfiller_profile.total_fulfilled.saturating_add(1);
        }

        emit!(RedemptionConfirmed {
            request_id: req.request_id,
            fulfiller: req.fulfiller,
            timestamp: req.confirmed_at,
        });

        msg!("Redemption #{} confirmed — delivery complete", req.request_id);
        Ok(())
    }

    /// Cancel a redemption order (Admin only)
    pub fn cancel_redemption(ctx: Context<CancelRedemption>) -> Result<()> {
        let req = &mut ctx.accounts.redemption_request;

        // Can only cancel Pending (0) or Claimed (1) orders
        require!(
            req.status == 0 || req.status == 1,
            W3BError::InvalidRedemptionStatus
        );

        req.status = 4; // Cancelled

        emit!(RedemptionCancelled {
            request_id: req.request_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Redemption #{} cancelled", req.request_id);
        Ok(())
    }

    // ==================== ADMIN OPS ====================

    /// Close ProtocolState PDA (Admin only) — enables clean-slate reinit
    pub fn close_protocol_state(_ctx: Context<CloseProtocolState>) -> Result<()> {
        msg!("Protocol state closed — ready for fresh initialization");
        Ok(())
    }

    pub fn set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        ctx.accounts.protocol_state.is_paused = paused;
        Ok(())
    }

    pub fn set_sol_receiver(ctx: Context<AdminOnly>, receiver: Pubkey) -> Result<()> {
        ctx.accounts.protocol_state.sol_receiver = receiver;
        Ok(())
    }

    pub fn set_treasury(ctx: Context<AdminOnly>, treasury: Pubkey) -> Result<()> {
        ctx.accounts.protocol_state.treasury = treasury;
        Ok(())
    }
    
    pub fn set_w3b_price_admin(ctx: Context<AdminOnly>, price: u64) -> Result<()> {
        ctx.accounts.protocol_state.w3b_price_lamports = price; // Unbounded override
        Ok(())
    }

    // ==================== YIELD OPS ====================

    /// Set yield APY rate in basis points (Admin only)
    pub fn set_yield_rate(ctx: Context<AdminOnly>, apy_bps: u16) -> Result<()> {
        ctx.accounts.protocol_state.yield_apy_bps = apy_bps;

        emit!(YieldRateUpdated {
            apy_bps,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Yield rate set to {} bps", apy_bps);
        Ok(())
    }

    /// Record that yield was distributed off-chain (Operator)
    pub fn record_yield_distribution(ctx: Context<OperatorOnly>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.protocol_state;

        state.total_yield_distributed = state
            .total_yield_distributed
            .checked_add(amount)
            .ok_or(W3BError::MathOverflow)?;
        state.last_yield_distribution = Clock::get()?.unix_timestamp;

        emit!(YieldDistributed {
            amount,
            new_total: state.total_yield_distributed,
            timestamp: state.last_yield_distribution,
        });

        msg!("Yield distribution recorded: {} W3B", amount);
        Ok(())
    }
}

// ==================== STRUCTS & ACCOUNTS ====================

#[account]
pub struct ProtocolState {
    pub authority: Pubkey,
    pub operator: Pubkey,       // NEW: Hot wallet for auto-ops
    pub w3b_mint: Pubkey,
    pub treasury: Pubkey,
    pub total_supply: u64,
    pub total_burned: u64,      // NEW: Track burns
    
    pub current_merkle_root: [u8; 32],
    pub proven_reserves: u64,
    pub last_root_update: i64,
    pub last_proof_timestamp: i64,
    
    pub w3b_price_lamports: u64,
    pub sol_receiver: Pubkey,
    
    // Yield & Future
    pub yield_apy_bps: u16,             // APY in basis points (350 = 3.5%)
    pub total_yield_distributed: u64,   // Total W3B distributed as yield
    pub last_yield_distribution: i64,   // Timestamp of last yield distribution
    
    pub is_paused: bool,
    pub bump: u8,
    
    pub _reserved: [u8; 64],    // Padding for V3
}

#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub total_volume: u64,
    pub points: u64,
    pub tier: u8,              // 0=Bronze, 1=Silver, 2=Gold, 3=Platinum
    pub total_redeemed: u64,
    pub total_fulfilled: u64,
    pub fulfiller_rewards: u64,
    pub bump: u8,
    pub _reserved: [u8; 32],  // Future expansion without migration
}

#[account]
pub struct RedemptionRequest {
    pub user: Pubkey,
    pub request_id: u64,
    pub amount: u64,
    pub status: u8, // 0=Pending, 1=Claimed, 2=Shipped, 3=Confirmed
    pub fulfiller: Pubkey,
    pub created_at: i64,
    pub claimed_at: i64,
    pub confirmed_at: i64,
    pub bump: u8,
}

// ==================== CONTEXTS ====================

#[derive(Accounts)]
pub struct InitializeV2<'info> {
    #[account(init, payer = authority, space = 8 + 512, seeds = [b"protocol_state"], bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    /// Token-2022 mint (validated as a real mint account)
    pub w3b_mint: InterfaceAccount<'info, Mint>,
    /// Treasury token account (validated as a real token account)
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct MigrateV2<'info> {
    /// CHECK: Manual resize — AccountInfo used because deserialization may fail mid-migration.
    /// Authority is validated inside the instruction body by reading raw bytes.
    #[account(mut, seeds = [b"protocol_state"], bump)]
    pub protocol_state: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OperatorOnly<'info> {
    #[account(mut, seeds = [b"protocol_state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(
        constraint = operator.key() == protocol_state.operator 
                  || operator.key() == protocol_state.authority
                  @ W3BError::Unauthorized
    )]
    pub operator: Signer<'info>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [b"protocol_state"], bump = protocol_state.bump, has_one = authority)]
    pub protocol_state: Account<'info, ProtocolState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseProtocolState<'info> {
    #[account(
        mut,
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = authority,
        close = authority
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintW3B<'info> {
    #[account(
        mut, 
        seeds = [b"protocol_state"], 
        bump = protocol_state.bump,
        has_one = w3b_mint,
        has_one = treasury
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    
    #[account(mut)] 
    pub w3b_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        token::mint = protocol_state.w3b_mint,
        constraint = treasury.owner == protocol_state.key()
    )] 
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token2022>,

    /// Operator or authority signs
    #[account(
        constraint = operator.key() == protocol_state.operator
                  || operator.key() == protocol_state.authority
                  @ W3BError::Unauthorized
    )]
    pub operator: Signer<'info>,
}

#[derive(Accounts)]
pub struct BuyW3B<'info> {
    #[account(
        mut, 
        seeds = [b"protocol_state"], 
        bump = protocol_state.bump,
        has_one = treasury, // matches protocol_state.treasury == treasury.key()
        has_one = sol_receiver
    )]
    pub protocol_state: Account<'info, ProtocolState>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        token::mint = protocol_state.w3b_mint,
        token::authority = buyer
    )]
    pub buyer_token_account: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = treasury.owner == protocol_state.key(),
        token::mint = protocol_state.w3b_mint
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Validated via protocol_state.sol_receiver
    #[account(mut)]
    pub sol_receiver: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    
    // Optional Points
    #[account(
        mut, 
        seeds = [b"user_profile", buyer.key().as_ref()], 
        bump = user_profile.bump
    )]
    pub user_profile: Option<Account<'info, UserProfile>>,
}

#[derive(Accounts)]
pub struct InitUserProfile<'info> {
    #[account(
        init, 
        payer = user, 
        space = 8 + 128, 
        seeds = [b"user_profile", user.key().as_ref()], 
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, request_id: u64)]
pub struct BurnW3B<'info> {
    #[account(mut, seeds = [b"protocol_state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        token::mint = w3b_mint,
        token::authority = user
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = w3b_mint.key() == protocol_state.w3b_mint @ W3BError::Unauthorized)]
    pub w3b_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        init,
        payer = user,
        space = 8 + 128,
        seeds = [b"redemption", user.key().as_ref(), request_id.to_le_bytes().as_ref()],
        bump
    )]
    pub redemption_request: Account<'info, RedemptionRequest>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    
    #[account(mut, seeds = [b"user_profile", user.key().as_ref()], bump = user_profile.bump)]
    pub user_profile: Option<Account<'info, UserProfile>>,
}

#[derive(Accounts)]
pub struct AwardPoints<'info> {
    #[account(seeds = [b"protocol_state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,
    #[account(mut, seeds = [b"user_profile", user.key().as_ref()], bump = user_profile.bump)]
    pub user_profile: Account<'info, UserProfile>,
    /// CHECK: User only needed for seed derivation
    pub user: UncheckedAccount<'info>,
    
    // Operator can award points
    #[account(
        constraint = operator.key() == protocol_state.operator 
                  || operator.key() == protocol_state.authority
    )]
    pub operator: Signer<'info>,
}

// ==================== P2P FULFILLMENT CONTEXTS ====================

#[derive(Accounts)]
pub struct ClaimRedemption<'info> {
    #[account(seeds = [b"protocol_state"], bump = protocol_state.bump)]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"redemption", redemption_request.user.as_ref(), redemption_request.request_id.to_le_bytes().as_ref()],
        bump = redemption_request.bump,
        constraint = redemption_request.status == 0 @ W3BError::InvalidRedemptionStatus
    )]
    pub redemption_request: Account<'info, RedemptionRequest>,

    /// The fulfiller claiming this order
    #[account(mut)]
    pub fulfiller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    #[account(
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"redemption", redemption_request.user.as_ref(), redemption_request.request_id.to_le_bytes().as_ref()],
        bump = redemption_request.bump,
        constraint = redemption_request.status == 1 @ W3BError::InvalidRedemptionStatus
    )]
    pub redemption_request: Account<'info, RedemptionRequest>,

    /// Fulfiller's profile (optional — for reward points)
    #[account(
        mut,
        seeds = [b"user_profile", redemption_request.fulfiller.as_ref()],
        bump = fulfiller_profile.bump
    )]
    pub fulfiller_profile: Option<Account<'info, UserProfile>>,

    /// Admin or Operator signs
    #[account(
        constraint = signer.key() == protocol_state.authority
                  || signer.key() == protocol_state.operator
                  @ W3BError::Unauthorized
    )]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelRedemption<'info> {
    #[account(
        seeds = [b"protocol_state"],
        bump = protocol_state.bump,
        has_one = authority
    )]
    pub protocol_state: Account<'info, ProtocolState>,

    #[account(
        mut,
        seeds = [b"redemption", redemption_request.user.as_ref(), redemption_request.request_id.to_le_bytes().as_ref()],
        bump = redemption_request.bump,
    )]
    pub redemption_request: Account<'info, RedemptionRequest>,

    /// Only admin can cancel
    pub authority: Signer<'info>,
}

// ==================== EVENTS & ERRORS ====================

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
    pub timestamp: i64,
}

#[event]
pub struct TokensPurchased {
    pub buyer: Pubkey,
    pub amount: u64,
    pub lamports_paid: u64,
    pub timestamp: i64,
}

#[event]
pub struct TokensBurned {
    pub user: Pubkey,
    pub amount: u64,
    pub request_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct RedemptionClaimed {
    pub request_id: u64,
    pub fulfiller: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RedemptionConfirmed {
    pub request_id: u64,
    pub fulfiller: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RedemptionCancelled {
    pub request_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct YieldRateUpdated {
    pub apy_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct YieldDistributed {
    pub amount: u64,
    pub new_total: u64,
    pub timestamp: i64,
}

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
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Price change exceeds 20% limit")]
    PriceChangeExceedsLimit,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Reserve count does not match Merkle root")]
    ReserveCountMismatch,
    #[msg("Price not set")]
    PriceNotSet,
    #[msg("Invalid redemption status for this operation")]
    InvalidRedemptionStatus,
    #[msg("Purchase exceeds per-transaction cap of 1000 W3B")]
    ExceedsTransactionCap,
}
