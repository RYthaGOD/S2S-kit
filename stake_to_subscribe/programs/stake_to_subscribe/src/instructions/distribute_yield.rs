use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface, TransferChecked, transfer_checked, TokenAccount};
use crate::state::{UserVault, GlobalConfig};



#[derive(Accounts)]
pub struct DistributeYield<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"vault", user_vault.user.as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// CHECK: The official Solana Mobile $SKR Staking Program
    #[account(address = crate::SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Config
    pub skr_stake_config: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault (Token Account)
    #[account(mut, address = crate::SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,

    /// CHECK: The User's Stake account within the official SKR protocol
    #[account(mut)]
    pub official_user_stake: AccountInfo<'info>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    /// The Vault's $SKR token account to receive withdrawn yield
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The protocol's master treasury $SKR token account
    #[account(mut, address = config.treasury)]
    pub protocol_skr_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<DistributeYield>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    let config = &ctx.accounts.config;
    
    // 1. Finalize Withdrawal from SKR protocol
    msg!("Finalizing yield withdrawal from SKR protocol...");
    
    let user_key = vault.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    let event_authority = crate::seeker_cpi::get_event_authority(&ctx.accounts.skr_staking_program.key());

    let withdraw_ix = crate::seeker_cpi::withdraw_ix(
        ctx.accounts.official_user_stake.key(),
        ctx.accounts.skr_stake_config.key(),
        vault.key(), // Authority in SKR protocol is our Vault
        ctx.accounts.skr_staking_vault.key(),
        ctx.accounts.vault_skr_account.key(),
        ctx.accounts.token_program.key(),
        event_authority,
        ctx.accounts.skr_staking_program.key(),
    );

    anchor_lang::solana_program::program::invoke_signed(
        &withdraw_ix,
        &[
            ctx.accounts.official_user_stake.to_account_info(),
            ctx.accounts.skr_stake_config.to_account_info(),
            vault.to_account_info(),
            ctx.accounts.skr_staking_vault.to_account_info(),
            ctx.accounts.vault_skr_account.to_account_info(),
            ctx.accounts.skr_staking_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds
    )?;

    ctx.accounts.vault_skr_account.reload()?;
    let total_withdrawn = ctx.accounts.vault_skr_account.amount;

    if total_withdrawn > 0 {
        // 2. Protocol Fee (3-5%)
        let protocol_fee = total_withdrawn
            .checked_mul(config.protocol_fee_bps as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let distributable_yield = total_withdrawn.checked_sub(protocol_fee).unwrap();

        // 3. Update the Per-Vault Yield Index (Precision-Hardened)
        let yield_per_dapp = (distributable_yield as u128)
            .checked_mul(crate::PRECISION_FACTOR)
            .unwrap()
            .checked_div(config.total_dapps as u128)
            .unwrap_or(0);
        
        vault.accumulated_yield_per_dapp = vault.accumulated_yield_per_dapp
            .checked_add(yield_per_dapp).unwrap();

        // 4. Transfer Protocol Fee
        if protocol_fee > 0 {
            let transfer_protocol_accounts = TransferChecked {
                from: ctx.accounts.vault_skr_account.to_account_info(),
                mint: ctx.accounts.skr_mint.to_account_info(),
                to: ctx.accounts.protocol_skr_account.to_account_info(),
                authority: vault.to_account_info(),
            };
            transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_protocol_accounts,
                    signer_seeds,
                ),
                protocol_fee,
                ctx.accounts.skr_mint.decimals,
            )?;
        }

        vault.total_shares_unstaking = 0;
        vault.cumulative_yield_harvested = vault.cumulative_yield_harvested.checked_add(total_withdrawn).unwrap();
    }

    Ok(())
}
