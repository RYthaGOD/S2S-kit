use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    mint_to, transfer_checked, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
};

use crate::state::{DappRegistry, GlobalConfig, LstConfig, UserVault};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(amount: u64, dapp_id: [u8; 32])]
pub struct DepositAndSubscribe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

    #[account(seeds = [b"dapp", dapp_id.as_ref()], bump = dapp.bump)]
    pub dapp: Box<Account<'info, DappRegistry>>,

    #[account(
        seeds = [b"lst", lst_mint.key().as_ref()],
        bump = lst_config.bump,
        constraint = lst_config.enabled @ ErrorCode::LstNotEnabled,
    )]
    pub lst_config: Box<Account<'info, LstConfig>>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub user_vault: Box<Account<'info, UserVault>>,

    /// The LST mint being deposited (must match the allow-listed LstConfig).
    #[account(address = lst_config.mint)]
    pub lst_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Source: the user's LST token account.
    #[account(
        mut,
        token::mint = lst_mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_lst_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Escrow: the vault PDA's associated token account for this LST.
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = lst_mint,
        associated_token::authority = user_vault,
        associated_token::token_program = token_program,
    )]
    pub vault_lst_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The shared non-transferable Active Pass mint (Token-2022).
    #[account(
        mut,
        address = config.pass_mint,
        seeds = [b"pass_mint"],
        bump,
    )]
    pub pass_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Auto-created if missing — devs no longer pre-create the pass ATA.
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = pass_mint,
        associated_token::authority = user,
        associated_token::token_program = pass_token_program,
    )]
    pub user_pass_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Token program that owns the LST (legacy SPL Token or Token-2022).
    pub token_program: Interface<'info, TokenInterface>,
    /// Token-2022 program (owns the Active Pass mint).
    pub pass_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositAndSubscribe>, amount: u64, _dapp_id: [u8; 32]) -> Result<()> {
    require!(amount > 0, ErrorCode::InsufficientStake);

    let clock = Clock::get()?;
    let rate = ctx.accounts.lst_config.rate;
    let dapp_key = ctx.accounts.dapp.key();

    // Value of this deposit in the LST's underlying (SOL lamports).
    let value: u64 = (amount as u128)
        .checked_mul(rate)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(crate::RATE_PRECISION)
        .ok_or(ErrorCode::MathOverflow)?
        .try_into()
        .map_err(|_| ErrorCode::MathOverflow)?;

    // 1. Pull LST from the user into the vault escrow.
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_lst_account.to_account_info(),
                mint: ctx.accounts.lst_mint.to_account_info(),
                to: ctx.accounts.vault_lst_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.lst_mint.decimals,
    )?;

    // Grant the free trial on first subscribe (instant access while yield warms up).
    // Unmetered dApps (price 0) never expire.
    let paid_through = if ctx.accounts.dapp.price_per_period == 0 {
        i64::MAX
    } else {
        clock
            .unix_timestamp
            .checked_add(ctx.accounts.dapp.trial_seconds)
            .ok_or(ErrorCode::MathOverflow)?
    };

    // 2. Initialize or top up the vault.
    let vault = &mut ctx.accounts.user_vault;
    if vault.user == Pubkey::default() {
        vault.user = ctx.accounts.user.key();
        vault.lst_mint = ctx.accounts.lst_mint.key();
        vault.dapp = dapp_key;
        vault.deposited_lst = amount;
        vault.principal_value = value;
        vault.cumulative_yield_skimmed = 0;
        vault.protocol_fees_contributed = 0;
        vault.active_pass_mint = ctx.accounts.pass_mint.key();
        vault.deposited_at = clock.unix_timestamp;
        vault.paid_through = paid_through;
        vault.last_harvest_at = clock.unix_timestamp;
        vault.is_cooling_down = false;
        vault.cooldown_start_time = 0;
        vault.bump = ctx.bumps.user_vault;
    } else {
        // Top-ups must use the same LST and dApp the vault was opened with.
        require_keys_eq!(vault.lst_mint, ctx.accounts.lst_mint.key(), ErrorCode::LstMintMismatch);
        require_keys_eq!(vault.dapp, dapp_key, ErrorCode::DappMismatch);
        vault.deposited_lst = vault.deposited_lst.checked_add(amount).ok_or(ErrorCode::MathOverflow)?;
        vault.principal_value = vault.principal_value.checked_add(value).ok_or(ErrorCode::MathOverflow)?;
    }

    // 3. Gate access on the dApp's minimum principal value.
    require!(
        vault.principal_value >= ctx.accounts.dapp.min_stake_value,
        ErrorCode::InsufficientStake
    );

    // 4. Mint the Active Pass on first subscription.
    if ctx.accounts.user_pass_account.amount == 0 {
        let config_seeds: &[&[u8]] = &[b"global_config", &[ctx.accounts.config.bump]];
        let signer_seeds = &[config_seeds];
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.pass_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.pass_mint.to_account_info(),
                    to: ctx.accounts.user_pass_account.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer_seeds,
            ),
            1,
        )?;
    }

    Ok(())
}
