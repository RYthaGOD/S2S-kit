use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface, TokenAccount};
use crate::state::{DappRegistry, UserVault, GlobalConfig, Subscription};


#[derive(Accounts)]
pub struct ClaimYield<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"dapp", dapp.dapp_id.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        mut,
        seeds = [b"vault", user_vault.user.as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [b"subscription", user_vault.user.as_ref(), dapp.key().as_ref()],
        bump = subscription.bump
    )]
    pub subscription: Account<'info, Subscription>,

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

    /// CHECK: The official $SKR Staking Vault (Token Account)
    #[account(mut, address = crate::SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    /// The Vault's $SKR token account
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ClaimYield>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    
    // 1. Calculate Profit in Shares
    let total_shares = vault.shares;
    let profit_shares = total_shares.checked_div(20).unwrap_or(0); // Stub: 5% yield realization

    if profit_shares > 0 {
        msg!("Realizing profit: Unstaking {} shares from SKR protocol...", profit_shares);
        
        let user_key = vault.user.key();
        let vault_seeds: &[&[u8]] = &[
            b"vault",
            user_key.as_ref(),
            &[vault.bump],
        ];
        let signer_seeds = &[vault_seeds];

        let event_authority = crate::seeker_cpi::get_event_authority(&ctx.accounts.skr_staking_program.key());

        let unstake_ix = crate::seeker_cpi::undelegate_ix(
            ctx.accounts.official_user_stake.key(),
            ctx.accounts.skr_stake_config.key(),
            ctx.accounts.guardian_pool.key(),
            vault.key(), // Authority is our Vault
            ctx.accounts.skr_staking_vault.key(),
            ctx.accounts.skr_mint.key(),
            event_authority,
            ctx.accounts.skr_staking_program.key(),
            profit_shares,
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

        vault.total_shares_unstaking = vault.total_shares_unstaking.checked_add(profit_shares).unwrap();
        vault.shares = vault.shares.checked_sub(profit_shares).unwrap();
        vault.last_harvest_at = Clock::get()?.unix_timestamp;
    }

    Ok(())
}
