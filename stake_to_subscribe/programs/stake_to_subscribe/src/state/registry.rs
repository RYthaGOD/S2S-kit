use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct DappRegistry {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub guardian_vote_account: Pubkey,
    pub bump: u8,
}
