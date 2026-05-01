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
        constraint = config.authority == authority.key()
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
    guardian_vote_account: Pubkey,
) -> Result<()> {
    let dapp = &mut ctx.accounts.dapp;
    dapp.dapp_id = dapp_id;
    dapp.authority = ctx.accounts.authority.key();
    dapp.treasury = treasury;
    dapp.guardian_vote_account = guardian_vote_account;
    dapp.bump = ctx.bumps.dapp;

    let config = &mut ctx.accounts.config;
    config.total_dapps = config.total_dapps.checked_add(1).unwrap();

    Ok(())
}
