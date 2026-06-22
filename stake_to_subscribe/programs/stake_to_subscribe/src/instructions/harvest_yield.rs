use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::state::{DappRegistry, GlobalConfig, LstConfig, UserVault};
use crate::errors::ErrorCode;

/// Permissionless crank. Skims the LST appreciation accrued since the principal
/// value was set, routing the protocol fee to the treasury and the remainder to
/// the subscribed dApp. Everything is denominated and paid in the LST itself.
///
/// Conservation: `skim = protocol_fee + dapp_cut`, and the vault's escrow is
/// reduced by exactly `skim`. No tokens are created or destroyed.
#[derive(Accounts)]
pub struct HarvestYield<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

    #[account(
        seeds = [b"dapp", dapp.dapp_id.as_ref()],
        bump = dapp.bump,
        constraint = dapp.key() == user_vault.dapp @ ErrorCode::DappMismatch,
    )]
    pub dapp: Box<Account<'info, DappRegistry>>,

    #[account(
        seeds = [b"lst", lst_config.mint.as_ref()],
        bump = lst_config.bump,
        constraint = lst_config.mint == user_vault.lst_mint @ ErrorCode::LstMintMismatch,
    )]
    pub lst_config: Box<Account<'info, LstConfig>>,

    #[account(
        mut,
        seeds = [b"vault", user_vault.user.as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Box<Account<'info, UserVault>>,

    #[account(address = user_vault.lst_mint)]
    pub lst_mint: Box<InterfaceAccount<'info, Mint>>,

    /// Vault escrow (source of the skim).
    #[account(
        mut,
        token::mint = lst_mint,
        token::authority = user_vault,
        token::token_program = token_program,
    )]
    pub vault_lst_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// Protocol treasury's LST account (must be owned by config.treasury).
    #[account(
        mut,
        token::mint = lst_mint,
        token::authority = config.treasury,
        token::token_program = token_program,
    )]
    pub protocol_treasury_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// dApp treasury's LST account (must be owned by dapp.treasury).
    #[account(
        mut,
        token::mint = lst_mint,
        token::authority = dapp.treasury,
        token::token_program = token_program,
    )]
    pub dapp_treasury_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<HarvestYield>) -> Result<()> {
    let rate = ctx.accounts.lst_config.rate;
    let vault = &mut ctx.accounts.user_vault;

    // LST needed to back the principal value at the current rate.
    let target_lst: u64 = (vault.principal_value as u128)
        .checked_mul(crate::RATE_PRECISION)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(rate)
        .ok_or(ErrorCode::MathOverflow)?
        .try_into()
        .map_err(|_| ErrorCode::MathOverflow)?;

    // Surplus over principal = harvestable yield. If the rate has not risen
    // (or fell), there is nothing to skim — principal is left untouched.
    let skim = vault.deposited_lst.saturating_sub(target_lst);
    if skim == 0 {
        return Ok(());
    }

    let protocol_fee = (skim as u128)
        .checked_mul(ctx.accounts.config.protocol_fee_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    let dapp_cut = skim.checked_sub(protocol_fee).ok_or(ErrorCode::MathOverflow)?;

    let user_key = vault.user;
    let vault_seeds: &[&[u8]] = &[b"vault", user_key.as_ref(), &[vault.bump]];
    let signer_seeds = &[vault_seeds];
    let decimals = ctx.accounts.lst_mint.decimals;

    if protocol_fee > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_lst_account.to_account_info(),
                    mint: ctx.accounts.lst_mint.to_account_info(),
                    to: ctx.accounts.protocol_treasury_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            protocol_fee,
            decimals,
        )?;
    }

    if dapp_cut > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_lst_account.to_account_info(),
                    mint: ctx.accounts.lst_mint.to_account_info(),
                    to: ctx.accounts.dapp_treasury_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer_seeds,
            ),
            dapp_cut,
            decimals,
        )?;
    }

    vault.deposited_lst = target_lst;
    vault.cumulative_yield_skimmed = vault.cumulative_yield_skimmed.checked_add(skim).ok_or(ErrorCode::MathOverflow)?;
    vault.protocol_fees_contributed = vault.protocol_fees_contributed.checked_add(protocol_fee).ok_or(ErrorCode::MathOverflow)?;
    vault.last_harvest_at = Clock::get()?.unix_timestamp;

    // Yield buys time: convert the dApp's cut (in SOL value) into paid-up subscription
    // seconds and extend the access clock. Unmetered dApps (price 0) are skipped.
    let dapp = &ctx.accounts.dapp;
    if dapp.price_per_period > 0 && dapp.period_seconds > 0 && vault.paid_through != i64::MAX {
        let cut_value = (dapp_cut as u128)
            .checked_mul(rate)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(crate::RATE_PRECISION)
            .ok_or(ErrorCode::MathOverflow)?;
        let time_bought = cut_value
            .checked_mul(dapp.period_seconds as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(dapp.price_per_period as u128)
            .ok_or(ErrorCode::MathOverflow)? as i64;
        vault.paid_through = vault.paid_through.checked_add(time_bought).ok_or(ErrorCode::MathOverflow)?;
    }

    Ok(())
}
