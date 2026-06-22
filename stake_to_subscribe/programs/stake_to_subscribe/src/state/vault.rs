use anchor_lang::prelude::*;

/// A user's deposit position. One per user (PDA: [b"vault", user]).
///
/// The vault escrows a single LST. The user's *principal value* (denominated in
/// the LST's underlying, SOL) is preserved across harvests: as the LST rate rises
/// the vault holds more value than the principal, and the surplus LST is skimmed
/// as yield. On withdrawal the user receives the LST still held by the vault,
/// which is worth their original principal value at the current rate.
#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub user: Pubkey,
    /// The LST mint this vault holds (set on first deposit; immutable until withdraw).
    pub lst_mint: Pubkey,
    /// The dApp this position subscribes to (yield recipient).
    pub dapp: Pubkey,
    /// LST base units currently escrowed. Decreases as yield is skimmed.
    pub deposited_lst: u64,
    /// SOL-lamport principal value to preserve. target_lst = principal_value * 1e12 / rate.
    pub principal_value: u64,
    /// Lifetime LST skimmed as yield (stats).
    pub cumulative_yield_skimmed: u64,
    /// Lifetime LST routed to the protocol treasury from this vault (the passive-income stream).
    pub protocol_fees_contributed: u64,
    pub active_pass_mint: Pubkey,
    pub deposited_at: i64,
    /// Unix timestamp through which access is paid (trial + yield-funded time).
    /// `i64::MAX` for unmetered dApps. Access is active while `now <= paid_through`.
    pub paid_through: i64,
    pub is_cooling_down: bool,
    pub cooldown_start_time: i64,
    pub last_harvest_at: i64,
    pub bump: u8,
}
