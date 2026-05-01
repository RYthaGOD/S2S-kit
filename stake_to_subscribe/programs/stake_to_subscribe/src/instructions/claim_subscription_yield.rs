use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface, TransferChecked, transfer_checked, TokenAccount};
use crate::state::{DappRegistry, UserVault, GlobalConfig, Subscription};



#[derive(Accounts)]
pub struct ClaimSubscriptionYield<'info> {
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

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    /// The Vault's $SKR token account holding the distributable yield
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The developer's treasury $SKR token account
    #[account(mut, address = dapp.treasury)]
    pub treasury_skr_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<ClaimSubscriptionYield>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    let subscription = &mut ctx.accounts.subscription;
    
    // Calculate Owed Yield using Precision Index
    // Owed = (VaultIndex - LastSubscriptionIndex) / PRECISION
    let owed_precision = vault.accumulated_yield_per_dapp
        .checked_sub(subscription.last_yield_index)
        .unwrap_or(0);
    
    let owed_amount = (owed_precision as u64)
        .checked_div(crate::PRECISION_FACTOR as u64)
        .unwrap_or(0);

    if owed_amount > 0 {
        msg!("Claiming subscription yield: {} lamports", owed_amount);
        
        let user_key = vault.user.key();
        let vault_seeds: &[&[u8]] = &[
            b"vault",
            user_key.as_ref(),
            &[vault.bump],
        ];
        let signer_seeds = &[vault_seeds];

        let transfer_accounts = TransferChecked {
            from: ctx.accounts.vault_skr_account.to_account_info(),
            mint: ctx.accounts.skr_mint.to_account_info(),
            to: ctx.accounts.treasury_skr_account.to_account_info(),
            authority: vault.to_account_info(),
        };
        
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_accounts,
                signer_seeds,
            ),
            owed_amount,
            ctx.accounts.skr_mint.decimals,
        )?;

        // Update the subscription index to the current vault index
        subscription.last_yield_index = vault.accumulated_yield_per_dapp;
        subscription.yield_claimed = subscription.yield_claimed.checked_add(owed_amount).unwrap();
    }

    Ok(())
}
