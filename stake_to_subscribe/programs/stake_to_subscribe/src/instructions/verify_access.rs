use anchor_lang::prelude::*;
use crate::state::UserVault;
use crate::errors::ErrorCode;

/// Trustless access check, CPI-able by other programs. Succeeds iff the vault's
/// subscription is paid through the current time. `paid_through == i64::MAX` means
/// an unmetered dApp (always allowed while the vault is open).
#[derive(Accounts)]
pub struct VerifyAccess<'info> {
    #[account(
        seeds = [b"vault", user_vault.user.as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,
}

pub fn handler(ctx: Context<VerifyAccess>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now <= ctx.accounts.user_vault.paid_through, ErrorCode::AccessExpired);
    Ok(())
}
