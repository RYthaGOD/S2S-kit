use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};

pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");

use crate::state::{DappRegistry, UserVault};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct WithdrawStake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"dapp", dapp.authority.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        mut,
        close = user,
        seeds = [b"vault", dapp.key().as_ref(), user.key().as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// The Token-2022 Active Pass Mint
    #[account(mut)]
    pub pass_mint: InterfaceAccount<'info, Mint>,

    /// The user's Active Pass token account to burn from
    #[account(mut)]
    pub user_pass_account: InterfaceAccount<'info, TokenAccount>,

    /// The user's $SKR token account to receive tokens
    #[account(mut)]
    pub user_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The Vault's $SKR token account
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    
    /// CHECK: The official Solana Mobile $SKR Staking Program
    #[account(address = SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault
    #[account(mut, address = SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,
}

pub fn withdraw_stake(ctx: Context<WithdrawStake>) -> Result<()> {
    let vault = &ctx.accounts.user_vault;
    let clock = Clock::get()?;

    // 1. Verify Cooldown
    require!(vault.is_cooling_down, ErrorCode::NotInCooldown);
    let elapsed = clock.unix_timestamp.checked_sub(vault.cooldown_start_time).unwrap();
    require!(elapsed >= 48 * 3600, ErrorCode::CooldownNotFinished); // 48 hours

    let dapp_key = ctx.accounts.dapp.key();
    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        dapp_key.as_ref(),
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    // 2. Finalize Withdraw on Staking Program via CPI
    msg!("Finalizing withdrawal from official $SKR Staking Protocol...");
    
    let withdraw_ix = crate::seeker_cpi::withdraw_ix(
        ctx.accounts.user_vault.key(), // user_stake placeholder
        ctx.accounts.skr_staking_vault.key(), // stake_config
        ctx.accounts.user_vault.key(), // user (authority)
        ctx.accounts.skr_staking_vault.key(), // stake_vault
        ctx.accounts.vault_skr_account.key(), // user_token_account
        ctx.accounts.token_program.key(),
        ctx.accounts.skr_staking_program.key(), // event_authority placeholder
    );

    anchor_lang::solana_program::program::invoke_signed(
        &withdraw_ix,
        &[
            ctx.accounts.user_vault.to_account_info(),
            ctx.accounts.skr_staking_vault.to_account_info(),
            ctx.accounts.vault_skr_account.to_account_info(),
            ctx.accounts.skr_staking_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds
    )?;

    // 3. Burn the Active Pass
    msg!("Burning Active Pass to finalize unsubscription...");
    let burn_accounts = Burn {
        mint: ctx.accounts.pass_mint.to_account_info(),
        from: ctx.accounts.user_pass_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        burn_accounts,
    );
    burn(burn_ctx, 1)?;

    // 4. Transfer $SKR back to User
    ctx.accounts.vault_skr_account.reload()?;
    let amount = ctx.accounts.vault_skr_account.amount;
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault_skr_account.to_account_info(),
        mint: ctx.accounts.skr_mint.to_account_info(),
        to: ctx.accounts.user_skr_account.to_account_info(),
        authority: ctx.accounts.user_vault.to_account_info(),
    };
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer_seeds,
    );
    transfer_checked(transfer_ctx, amount, ctx.accounts.skr_mint.decimals)?;

    Ok(())
}
