use anchor_lang::prelude::*;
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface, transfer_checked, TransferChecked};



use crate::state::{UserVault, GlobalConfig};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct WithdrawStake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        close = user,
        seeds = [b"vault", user.key().as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// The Shared Token-2022 Active Pass Mint
    #[account(
        mut,
        address = config.pass_mint,
        seeds = [b"pass_mint"],
        bump,
    )]
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
    #[account(address = crate::SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Config
    pub skr_stake_config: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault
    #[account(mut, address = crate::SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,

    /// CHECK: The User's Stake account within the official SKR protocol
    #[account(mut)]
    pub official_user_stake: AccountInfo<'info>,
}

pub fn handler(ctx: Context<WithdrawStake>) -> Result<()> {
    let vault = &ctx.accounts.user_vault;
    let clock = Clock::get()?;

    // 1. Verify Cooldown
    require!(vault.is_cooling_down, ErrorCode::NotInCooldown);
    let elapsed = clock.unix_timestamp.checked_sub(vault.cooldown_start_time).unwrap();
    require!(elapsed >= 48 * 3600, ErrorCode::CooldownNotFinished); // 48 hours

    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    // 2. Finalize Withdraw on Staking Program via CPI
    msg!("Finalizing withdrawal from official $SKR Staking Protocol...");
    
    let event_authority = crate::seeker_cpi::get_event_authority(&ctx.accounts.skr_staking_program.key());

    let withdraw_ix = crate::seeker_cpi::withdraw_ix(
        ctx.accounts.official_user_stake.key(),
        ctx.accounts.skr_stake_config.key(),
        vault.key(), // Authority in SKR is our Vault
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

    // 3. Burn the Active Pass
    msg!("Burning Active Pass to finalize unsubscription from Shared Vault...");
    let burn_accounts = Burn {
        mint: ctx.accounts.pass_mint.to_account_info(),
        from: ctx.accounts.user_pass_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    burn(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), burn_accounts),
        1
    )?;

    // 4. Transfer $SKR back to User
    ctx.accounts.vault_skr_account.reload()?;
    let amount = ctx.accounts.vault_skr_account.amount;
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.vault_skr_account.to_account_info(),
        mint: ctx.accounts.skr_mint.to_account_info(),
        to: ctx.accounts.user_skr_account.to_account_info(),
        authority: ctx.accounts.user_vault.to_account_info(),
    };
    transfer_checked(
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), transfer_accounts, signer_seeds),
        amount,
        ctx.accounts.skr_mint.decimals
    )?;

    Ok(())
}
