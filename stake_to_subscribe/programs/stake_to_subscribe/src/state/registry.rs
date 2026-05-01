use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub protocol_fee_bps: u16,     // 300-500 bps (3-5%)
    pub treasury: Pubkey,
    pub pass_mint: Pubkey,
    pub total_dapps: u64,
    pub global_yield_index: u128,  // High-precision yield accumulator
    pub default_guardian_pool: Pubkey, // Protocol-selected guardian
    pub min_stake_amount: u64,         // Minimum SKR stake
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DappRegistry {
    pub dapp_id: [u8; 32],
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub guardian_vote_account: Pubkey,
    pub bump: u8,
}
