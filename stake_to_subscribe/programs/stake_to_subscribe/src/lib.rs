use anchor_lang::prelude::*;
pub use instructions::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("7EeAMD5jwS2Zi5GbwkiuqJvQMK4yDT2qTdMh5HrjatbD");

/// Fixed-point scale for LST exchange rates. `rate` is underlying-lamports per
/// 1 LST base unit, multiplied by this factor. A 1:1 peg is `RATE_PRECISION`.
pub const RATE_PRECISION: u128 = 1_000_000_000_000; // 1e12

/// The SPL Stake Pool program. `refresh_lst_rate` reads an LST's exchange rate
/// trustlessly from a StakePool account owned by this program (covers jitoSOL,
/// bSOL, JupSOL, INF and most SPL-stake-pool LSTs).
pub const SPL_STAKE_POOL_PROGRAM: Pubkey = pubkey!("SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy");

/// Hard cap on the protocol fee the authority can ever set (10%). A sanity bound
/// so even a compromised authority cannot set a confiscatory fee.
pub const MAX_PROTOCOL_FEE_BPS: u16 = 1_000;

#[program]
pub mod stake_to_subscribe {
    use super::*;

    /// One-time protocol setup. Creates the global config and the shared,
    /// non-transferable Token-2022 Active Pass mint.
    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        protocol_fee_bps: u16,
        treasury: Pubkey,
        cooldown_seconds: u64,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, protocol_fee_bps, treasury, cooldown_seconds)
    }

    /// Add an LST to the protocol allowlist. `rate_kind`: 0 = manual (test LSTs),
    /// 1 = SPL stake pool (trustless, rate read from `rate_source`).
    pub fn add_lst(
        ctx: Context<AddLst>,
        rate_kind: u8,
        initial_rate: u128,
        rate_source: Pubkey,
    ) -> Result<()> {
        instructions::add_lst::handler(ctx, rate_kind, initial_rate, rate_source)
    }

    /// Authority push of a manual LST's rate (test/fallback LSTs only).
    pub fn update_lst_rate(ctx: Context<UpdateLstRate>, new_rate: u128) -> Result<()> {
        instructions::update_lst_rate::handler(ctx, new_rate)
    }

    /// Permissionless trustless refresh of an SPL-stake-pool LST's rate, read from
    /// the pool's total_lamports / pool_token_supply.
    pub fn refresh_lst_rate(ctx: Context<RefreshLstRate>) -> Result<()> {
        instructions::refresh_lst_rate::handler(ctx)
    }

    /// Register a dApp. `price_per_period`/`period_seconds` meter the subscription
    /// (0 price = unmetered); `trial_seconds` is the free trial granted on subscribe.
    pub fn initialize_dapp(
        ctx: Context<InitializeDapp>,
        dapp_id: [u8; 32],
        treasury: Pubkey,
        min_stake_value: u64,
        price_per_period: u64,
        period_seconds: i64,
        trial_seconds: i64,
    ) -> Result<()> {
        instructions::initialize_dapp::handler(
            ctx, dapp_id, treasury, min_stake_value, price_per_period, period_seconds, trial_seconds,
        )
    }

    /// Deposit an allow-listed LST, subscribe to a dApp, and mint the Active Pass.
    pub fn deposit_and_subscribe(
        ctx: Context<DepositAndSubscribe>,
        amount: u64,
        dapp_id: [u8; 32],
    ) -> Result<()> {
        instructions::deposit_and_subscribe::handler(ctx, amount, dapp_id)
    }

    /// Permissionless crank: skim LST appreciation since the last harvest, send the
    /// protocol fee to the treasury and the remainder to the subscribed dApp, and
    /// extend the subscriber's paid-through clock by the value routed.
    pub fn harvest_yield(ctx: Context<HarvestYield>) -> Result<()> {
        instructions::harvest_yield::handler(ctx)
    }

    /// Trustless access check (CPI-able): errors unless the vault is paid through now.
    pub fn verify_access(ctx: Context<VerifyAccess>) -> Result<()> {
        instructions::verify_access::handler(ctx)
    }

    // --- Governance / admin (all gated; no account layout changes) ---

    /// Transfer the protocol authority (e.g. to a multisig).
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::admin::set_authority(ctx, new_authority)
    }

    /// Set the protocol fee in bps (the fee switch), capped at MAX_PROTOCOL_FEE_BPS.
    pub fn set_protocol_fee(ctx: Context<SetProtocolFee>, new_fee_bps: u16) -> Result<()> {
        instructions::admin::set_protocol_fee(ctx, new_fee_bps)
    }

    /// Enable or disable an allow-listed LST (disabling never traps existing vaults).
    pub fn set_lst_enabled(ctx: Context<SetLstEnabled>, enabled: bool) -> Result<()> {
        instructions::admin::set_lst_enabled(ctx, enabled)
    }

    /// dApp owner updates its treasury and billing terms.
    pub fn update_dapp(
        ctx: Context<UpdateDapp>,
        treasury: Pubkey,
        min_stake_value: u64,
        price_per_period: u64,
        period_seconds: i64,
        trial_seconds: i64,
    ) -> Result<()> {
        instructions::admin::update_dapp(ctx, treasury, min_stake_value, price_per_period, period_seconds, trial_seconds)
    }

    /// Begin the withdrawal cooldown for the user's principal.
    pub fn initiate_unsubscribe(ctx: Context<InitiateUnsubscribe>) -> Result<()> {
        instructions::initiate_unsubscribe::handler(ctx)
    }

    /// After cooldown: return the user's LST principal, burn the pass, close the vault.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw::handler(ctx)
    }
}
