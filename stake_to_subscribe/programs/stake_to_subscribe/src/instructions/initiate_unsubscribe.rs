use anchor_lang::prelude::*;
use crate::state::UserVault;

#[derive(Accounts)]
pub struct InitiateUnsubscribe<'info> {
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = user_vault.bump,
        constraint = user_vault.user == user.key(),
    )]
    pub user_vault: Account<'info, UserVault>,
}

pub fn handler(ctx: Context<InitiateUnsubscribe>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    vault.is_cooling_down = true;
    vault.cooldown_start_time = Clock::get()?.unix_timestamp;

    msg!("Unsubscribe initiated. Access remains valid during the cooldown window.");
    Ok(())
}
