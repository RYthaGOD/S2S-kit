use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub user: Pubkey,
    pub staked_amount: u64,               // Principal tokens staked
    pub shares: u128,                     // Shares held in SKR protocol
    pub cumulative_yield_harvested: u64,  // Total yield withdrawn so far
    pub accumulated_yield_per_dapp: u128, // Per-vault yield index
    pub active_pass_mint: Pubkey,
    pub staked_at: i64,
    pub is_cooling_down: bool,
    pub cooldown_start_time: i64,
    pub total_shares_unstaking: u128,     // Shares currently in 48h cooldown
    pub last_harvest_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub user: Pubkey,
    pub dapp: Pubkey,
    pub last_yield_index: u128, // The global_yield_index at the time of last claim
    pub yield_claimed: u64,
    pub bump: u8,
}
