use anchor_lang::prelude::*;
use crate::state::{DappRegistry, GlobalConfig};
use crate::errors::ErrorCode;

#[derive(Accounts)]
#[instruction(dapp_id: [u8; 32])]
pub struct InitializeDapp<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"global_config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + DappRegistry::INIT_SPACE,
        seeds = [b"dapp", dapp_id.as_ref()],
        bump
    )]
    pub dapp: Account<'info, DappRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeDapp>,
    dapp_id: [u8; 32],
    treasury: Pubkey,
    min_stake_value: u64,
    price_per_period: u64,
    period_seconds: i64,
    trial_seconds: i64,
) -> Result<()> {
    require!(period_seconds >= 0 && trial_seconds >= 0, ErrorCode::InvalidFee);

    let dapp = &mut ctx.accounts.dapp;
    dapp.dapp_id = dapp_id;
    dapp.authority = ctx.accounts.authority.key();
    dapp.treasury = treasury;
    dapp.min_stake_value = min_stake_value;
    dapp.price_per_period = price_per_period;
    dapp.period_seconds = period_seconds;
    dapp.trial_seconds = trial_seconds;
    dapp.bump = ctx.bumps.dapp;

    let config = &mut ctx.accounts.config;
    config.total_dapps = config.total_dapps.checked_add(1).ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}
