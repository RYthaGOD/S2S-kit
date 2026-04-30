use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub dapp: Pubkey,
    pub user: Pubkey,
    pub staked_amount: u64,
    pub active_pass_mint: Pubkey,
    pub staked_at: i64,
    pub is_cooling_down: bool,
    pub cooldown_start_time: i64,
    pub bump: u8,
}
