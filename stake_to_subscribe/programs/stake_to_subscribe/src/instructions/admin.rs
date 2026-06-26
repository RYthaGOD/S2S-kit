use anchor_lang::prelude::*;
use crate::state::{GlobalConfig, LstConfig, DappRegistry};
use crate::errors::ErrorCode;

// All of these mutate existing account fields only (no layout change), so they are
// safe to ship to an already-deployed program without an account migration.

/// Transfer the protocol authority (e.g. to a Squads multisig). Gated to the current authority.
#[derive(Accounts)]
pub struct SetAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"global_config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, GlobalConfig>,
}
pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require_keys_neq!(new_authority, Pubkey::default(), ErrorCode::Unauthorized);
    ctx.accounts.config.authority = new_authority;
    Ok(())
}

/// Change the protocol fee (the "fee switch"). Capped for sanity. Gated to authority.
#[derive(Accounts)]
pub struct SetProtocolFee<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"global_config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, GlobalConfig>,
}
pub fn set_protocol_fee(ctx: Context<SetProtocolFee>, new_fee_bps: u16) -> Result<()> {
    require!(new_fee_bps <= crate::MAX_PROTOCOL_FEE_BPS, ErrorCode::InvalidFee);
    ctx.accounts.config.protocol_fee_bps = new_fee_bps;
    Ok(())
}

/// Enable/disable an allow-listed LST. Disabling blocks new deposits but never traps
/// existing vaults (they can still be harvested and withdrawn). Gated to authority.
#[derive(Accounts)]
pub struct SetLstEnabled<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"global_config"],
        bump = config.bump,
        constraint = config.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut, seeds = [b"lst", lst_config.mint.as_ref()], bump = lst_config.bump)]
    pub lst_config: Account<'info, LstConfig>,
}
pub fn set_lst_enabled(ctx: Context<SetLstEnabled>, enabled: bool) -> Result<()> {
    ctx.accounts.lst_config.enabled = enabled;
    Ok(())
}

/// Let a dApp owner update its treasury and billing terms. Gated to the dApp authority.
#[derive(Accounts)]
pub struct UpdateDapp<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"dapp", dapp.dapp_id.as_ref()],
        bump = dapp.bump,
        constraint = dapp.authority == authority.key() @ ErrorCode::Unauthorized,
    )]
    pub dapp: Account<'info, DappRegistry>,
}
pub fn update_dapp(
    ctx: Context<UpdateDapp>,
    treasury: Pubkey,
    min_stake_value: u64,
    price_per_period: u64,
    period_seconds: i64,
    trial_seconds: i64,
) -> Result<()> {
    require!(period_seconds >= 0 && trial_seconds >= 0, ErrorCode::InvalidFee);
    let dapp = &mut ctx.accounts.dapp;
    dapp.treasury = treasury;
    dapp.min_stake_value = min_stake_value;
    dapp.price_per_period = price_per_period;
    dapp.period_seconds = period_seconds;
    dapp.trial_seconds = trial_seconds;
    Ok(())
}
