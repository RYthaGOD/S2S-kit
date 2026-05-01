use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

use crate::state::UserVault;

#[derive(Accounts)]
pub struct InitiateUnsubscribe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// CHECK: The official Solana Mobile $SKR Staking Program
    #[account(address = crate::SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Config
    pub skr_stake_config: AccountInfo<'info>,

    /// CHECK: The official $SKR Guardian Pool
    #[account(mut)]
    pub guardian_pool: AccountInfo<'info>,

    /// CHECK: The User's Stake account within the official SKR protocol
    #[account(mut)]
    pub official_user_stake: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault
    #[account(mut, address = crate::SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<InitiateUnsubscribe>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    let clock = Clock::get()?;

    vault.is_cooling_down = true;
    vault.cooldown_start_time = clock.unix_timestamp;

    msg!("Initiating 48h cooldown for $SKR unstaking from Shared Vault...");
    
    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    let event_authority = crate::seeker_cpi::get_event_authority(&ctx.accounts.skr_staking_program.key());

    // Use the UserVault PDA as the 'user' (authority) in the staking program
    let unstake_ix = crate::seeker_cpi::undelegate_ix(
        ctx.accounts.official_user_stake.key(),
        ctx.accounts.skr_stake_config.key(),
        ctx.accounts.guardian_pool.key(),
        vault.key(), // Authority is our Vault
        ctx.accounts.skr_staking_vault.key(),
        ctx.accounts.skr_mint.key(),
        event_authority,
        ctx.accounts.skr_staking_program.key(),
        vault.shares, // Unstake all shares
    );

    anchor_lang::solana_program::program::invoke_signed(
        &unstake_ix,
        &[
            ctx.accounts.official_user_stake.to_account_info(),
            ctx.accounts.skr_stake_config.to_account_info(),
            ctx.accounts.guardian_pool.to_account_info(),
            vault.to_account_info(),
            ctx.accounts.skr_staking_vault.to_account_info(),
            ctx.accounts.skr_mint.to_account_info(),
            ctx.accounts.skr_staking_program.to_account_info(),
        ],
        signer_seeds
    )?;

    vault.total_shares_unstaking = vault.shares;
    vault.shares = 0;

    // Access maintained during cooldown as per Seeker UX standards
    msg!("Unsubscribe initiated. Shared Access maintained during 48h cooldown.");

    Ok(())
}
