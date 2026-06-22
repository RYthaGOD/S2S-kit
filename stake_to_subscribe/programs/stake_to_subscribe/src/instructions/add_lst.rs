use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;
use crate::state::{GlobalConfig, LstConfig};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct AddLst<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,

    /// The LST mint being allow-listed.
    pub lst_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + LstConfig::INIT_SPACE,
        seeds = [b"lst", lst_mint.key().as_ref()],
        bump
    )]
    pub lst_config: Account<'info, LstConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AddLst>,
    rate_kind: u8,
    initial_rate: u128,
    rate_source: Pubkey,
) -> Result<()> {
    require!(initial_rate > 0, ErrorCode::InvalidRate);
    require!(
        rate_kind == crate::state::RATE_KIND_MANUAL || rate_kind == crate::state::RATE_KIND_SPL_STAKE_POOL,
        ErrorCode::RateKindMismatch
    );

    let lst = &mut ctx.accounts.lst_config;
    lst.mint = ctx.accounts.lst_mint.key();
    lst.rate = initial_rate;
    lst.rate_kind = rate_kind;
    lst.rate_source = rate_source;
    lst.last_rate_update = Clock::get()?.unix_timestamp;
    lst.enabled = true;
    lst.bump = ctx.bumps.lst_config;

    let config = &mut ctx.accounts.config;
    config.total_lsts = config.total_lsts.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}
