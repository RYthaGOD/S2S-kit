use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");
pub const SKR_STAKING_AUTHORITY: Pubkey = pubkey!("4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw");

use crate::state::{DappRegistry, UserVault};

#[derive(Accounts)]
pub struct InitiateUnsubscribe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"dapp", dapp.authority.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        mut,
        seeds = [b"vault", dapp.key().as_ref(), user.key().as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    pub token_program: Interface<'info, TokenInterface>,
    
    /// CHECK: The official Solana Mobile $SKR Staking Program
    #[account(address = SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault
    #[account(mut, address = SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Authority
    #[account(address = SKR_STAKING_AUTHORITY)]
    pub skr_staking_authority: AccountInfo<'info>,

    /// The Vault's $SKR token account
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,
}

pub fn initiate_unsubscribe(ctx: Context<InitiateUnsubscribe>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    let clock = Clock::get()?;

    vault.is_cooling_down = true;
    vault.cooldown_start_time = clock.unix_timestamp;

    msg!("Initiating 48h cooldown for $SKR unstaking...");
    
    let dapp_key = ctx.accounts.dapp.key();
    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        dapp_key.as_ref(),
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    // Use the UserVault PDA as the 'user' (authority) in the staking program
    let unstake_ix = crate::seeker_cpi::undelegate_ix(
        ctx.accounts.user_vault.key(), // user_stake placeholder
        ctx.accounts.skr_staking_vault.key(), // config
        ctx.accounts.skr_staking_vault.key(), // pool
        ctx.accounts.user_vault.key(), // user (authority)
        ctx.accounts.skr_staking_vault.key(), // vault
        ctx.accounts.skr_mint.key(), // mint
        ctx.accounts.skr_staking_program.key(), // event_authority placeholder
        vault.staked_amount as u128, // shares
    );

    anchor_lang::solana_program::program::invoke_signed(
        &unstake_ix,
        &[
            ctx.accounts.user_vault.to_account_info(), // user_stake & user
            ctx.accounts.skr_staking_vault.to_account_info(), // config, pool, vault
            ctx.accounts.skr_mint.to_account_info(), // mint
            ctx.accounts.skr_staking_program.to_account_info(), // event_authority & program
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds
    )?;

    // NO BURN HERE - User keeps the pass during cooldown
    msg!("Unsubscribe initiated. Access maintained during cooldown.");

    Ok(())
}
