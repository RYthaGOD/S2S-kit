use anchor_lang::prelude::*;
use anchor_spl::token_interface::{mint_to, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked, transfer_checked};

use crate::state::{DappRegistry, UserVault, GlobalConfig, Subscription};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(amount: u64, dapp_id: [u8; 32])]
pub struct StakeAndSubscribe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"dapp", dapp_id.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Subscription::INIT_SPACE,
        seeds = [b"subscription", user.key().as_ref(), dapp.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    /// The user's $SKR token account
    #[account(mut)]
    pub user_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The Vault's $SKR token account to hold the escrowed tokens
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The Shared Token-2022 Active Pass Mint
    #[account(
        mut,
        address = config.pass_mint,
        seeds = [b"pass_mint"],
        bump,
    )]
    pub pass_mint: InterfaceAccount<'info, Mint>,

    /// The user's Active Pass token account
    #[account(mut)]
    pub user_pass_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    
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
}

pub fn handler(ctx: Context<StakeAndSubscribe>, amount: u64, _dapp_id: [u8; 32]) -> Result<()> {
    let clock = Clock::get()?;
    let config = &ctx.accounts.config;
    
    // 1. Initialize Subscription
    let subscription = &mut ctx.accounts.subscription;
    if subscription.user == Pubkey::default() {
        subscription.user = ctx.accounts.user.key();
        subscription.dapp = ctx.accounts.dapp.key();
        subscription.yield_claimed = 0;
        subscription.last_yield_index = config.global_yield_index;
        subscription.bump = ctx.bumps.subscription;
    }

    // 2. Set up Vault State
    let vault = &mut ctx.accounts.user_vault;
    if vault.user == Pubkey::default() {
        vault.user = ctx.accounts.user.key();
        vault.staked_amount = amount;
        vault.active_pass_mint = ctx.accounts.pass_mint.key();
        vault.staked_at = clock.unix_timestamp;
        vault.last_harvest_at = clock.unix_timestamp;
        vault.cumulative_yield_harvested = 0;
        vault.is_cooling_down = false;
        vault.cooldown_start_time = 0;
        vault.bump = ctx.bumps.user_vault;
    } else if amount > 0 {
        let total_stake = vault.staked_amount.checked_add(amount).unwrap();
        require!(total_stake >= config.min_stake_amount, ErrorCode::InsufficientStake);
        vault.staked_amount = total_stake;
    }

    // 2b. Check dApp-specific minimum
    require!(vault.staked_amount >= ctx.accounts.dapp.min_stake_amount, ErrorCode::InsufficientStake);

    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        user_key.as_ref(),
        &[vault.bump],
    ];
    let vault_signer_seeds = &[vault_seeds];

    let config_seeds: &[&[u8]] = &[
        b"global_config",
        &[config.bump],
    ];
    let config_signer_seeds = &[config_seeds];

    // 3. Transfer $SKR from User to Vault
    if amount > 0 {
        let transfer_cpi_accounts = TransferChecked {
            from: ctx.accounts.user_skr_account.to_account_info(),
            mint: ctx.accounts.skr_mint.to_account_info(),
            to: ctx.accounts.vault_skr_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_cpi_accounts),
            amount,
            ctx.accounts.skr_mint.decimals
        )?;

        // 4. Delegate to the Official $SKR Staking Program
        let event_authority = crate::seeker_cpi::get_event_authority(&ctx.accounts.skr_staking_program.key());

        let stake_ix = crate::seeker_cpi::delegate_stake_ix(
            ctx.accounts.official_user_stake.key(),
            ctx.accounts.skr_stake_config.key(),
            ctx.accounts.guardian_pool.key(),
            vault.key(), // Authority in SKR is our Vault
            ctx.accounts.skr_staking_vault.key(),
            ctx.accounts.skr_mint.key(),
            event_authority,
            ctx.accounts.skr_staking_program.key(),
            amount,
        );

        anchor_lang::solana_program::program::invoke_signed(
            &stake_ix,
            &[
                ctx.accounts.official_user_stake.to_account_info(),
                ctx.accounts.skr_stake_config.to_account_info(),
                ctx.accounts.guardian_pool.to_account_info(),
                vault.to_account_info(),
                ctx.accounts.skr_staking_vault.to_account_info(),
                ctx.accounts.skr_mint.to_account_info(),
                ctx.accounts.skr_staking_program.to_account_info(),
            ],
            vault_signer_seeds
        )?;
    }

    // 5. Mint Active Pass
    if ctx.accounts.user_pass_account.amount == 0 {
        let mint_cpi_accounts = MintTo {
            mint: ctx.accounts.pass_mint.to_account_info(),
            to: ctx.accounts.user_pass_account.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        mint_to(
            CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), mint_cpi_accounts, config_signer_seeds),
            1
        )?;
    }

    Ok(())
}
