use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, LstConfig};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct UpdateLstRate<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"global_config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"lst", lst_config.mint.as_ref()],
        bump = lst_config.bump
    )]
    pub lst_config: Account<'info, LstConfig>,
}

pub fn handler(ctx: Context<UpdateLstRate>, new_rate: u128) -> Result<()> {
    require!(new_rate > 0, ErrorCode::InvalidRate);
    // Manual push is only allowed for test/fallback LSTs that have no real pool.
    // Real LSTs use `refresh_lst_rate`, which derives the rate trustlessly.
    require!(
        ctx.accounts.lst_config.rate_kind == crate::state::RATE_KIND_MANUAL,
        ErrorCode::RateKindMismatch
    );

    let lst = &mut ctx.accounts.lst_config;
    lst.rate = new_rate;
    lst.last_rate_update = Clock::get()?.unix_timestamp;

    Ok(())
}
