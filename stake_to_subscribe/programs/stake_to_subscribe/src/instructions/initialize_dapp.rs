use anchor_lang::prelude::*;
use crate::state::DappRegistry;

#[derive(Accounts)]
pub struct InitializeDapp<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + DappRegistry::INIT_SPACE,
        seeds = [b"dapp", authority.key().as_ref()],
        bump
    )]
    pub dapp: Account<'info, DappRegistry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_dapp(
    ctx: Context<InitializeDapp>,
    treasury: Pubkey,
    guardian_vote_account: Pubkey,
) -> Result<()> {
    let dapp = &mut ctx.accounts.dapp;
    dapp.authority = ctx.accounts.authority.key();
    dapp.treasury = treasury;
    dapp.guardian_vote_account = guardian_vote_account;
    dapp.bump = ctx.bumps.dapp;
    Ok(())
}
