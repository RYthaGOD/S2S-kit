use anchor_lang::prelude::*;
use crate::state::{DappRegistry, UserVault};
use crate::errors::ErrorCode;

/// Trustless access check, CPI-able by other programs. Succeeds iff the vault's
/// subscription is paid through the current time AND is subscribed to the provided dApp.
/// Callers MUST pass the dApp they intend to gate — a subscription to dApp A cannot
/// be used to access dApp B.
/// `paid_through == i64::MAX` means an unmetered dApp (always allowed while vault is open).
#[derive(Accounts)]
pub struct VerifyAccess<'info> {
    #[account(
        seeds = [b"vault", user_vault.user.as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// The dApp being accessed. Must match the dApp this vault is subscribed to.
    #[account(
        seeds = [b"dapp", dapp.dapp_id.as_ref()],
        bump = dapp.bump,
        constraint = dapp.key() == user_vault.dapp @ ErrorCode::DappMismatch,
    )]
    pub dapp: Account<'info, DappRegistry>,
}

pub fn handler(ctx: Context<VerifyAccess>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now <= ctx.accounts.user_vault.paid_through, ErrorCode::AccessExpired);
    Ok(())
}
