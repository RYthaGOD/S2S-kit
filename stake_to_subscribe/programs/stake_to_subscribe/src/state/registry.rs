use anchor_lang::prelude::*;

/// Protocol-wide configuration. One per deployment (PDA: [b"global_config"]).
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,
    /// Protocol's share of harvested yield, in basis points (e.g. 300 = 3%).
    pub protocol_fee_bps: u16,
    /// Owner of the protocol treasury token accounts. Payouts are sent to the
    /// associated token account of this owner for the relevant LST mint.
    pub treasury: Pubkey,
    /// The shared Token-2022 (non-transferable) Active Pass mint.
    pub pass_mint: Pubkey,
    /// Seconds a vault must cool down before principal can be withdrawn.
    pub cooldown_seconds: u64,
    pub total_dapps: u64,
    pub total_lsts: u16,
    pub bump: u8,
}

/// How an LST's exchange rate is sourced.
pub const RATE_KIND_MANUAL: u8 = 0; // authority-pushed (test LSTs / fallback only)
pub const RATE_KIND_SPL_STAKE_POOL: u8 = 1; // trustless: read from an SPL stake-pool account

/// An accepted Liquid Staking Token. One per allow-listed mint (PDA: [b"lst", mint]).
///
/// `rate` is underlying-lamports (SOL) per 1 LST base unit, scaled by `RATE_PRECISION`.
/// For `RATE_KIND_SPL_STAKE_POOL`, `refresh_lst_rate` derives it on-chain from the pool's
/// `total_lamports / pool_token_supply` (trustless). `RATE_KIND_MANUAL` is for test LSTs
/// with no real pool and is only writable by the protocol authority.
#[account]
#[derive(InitSpace)]
pub struct LstConfig {
    pub mint: Pubkey,
    pub rate: u128,
    pub rate_kind: u8,
    /// For SPL stake-pool LSTs: the StakePool state account the rate is read from.
    pub rate_source: Pubkey,
    pub last_rate_update: i64,
    pub enabled: bool,
    pub bump: u8,
}

/// A registered dApp that receives the user-facing share of harvested yield.
/// (PDA: [b"dapp", dapp_id]).
#[account]
#[derive(InitSpace)]
pub struct DappRegistry {
    pub dapp_id: [u8; 32],
    pub authority: Pubkey,
    /// Owner of the dApp treasury token accounts (yield is paid to its ATA).
    pub treasury: Pubkey,
    /// Minimum SOL-denominated principal value required to hold this dApp's pass.
    pub min_stake_value: u64,
    /// Subscription price in SOL-value lamports per `period_seconds`. 0 = unmetered
    /// (access lasts as long as the vault is open).
    pub price_per_period: u64,
    pub period_seconds: i64,
    /// Free-trial granted on first subscribe, in seconds (instant access while yield warms up).
    pub trial_seconds: i64,
    pub bump: u8,
}
