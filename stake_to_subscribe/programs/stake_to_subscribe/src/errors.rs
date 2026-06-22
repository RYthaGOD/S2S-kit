use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: only the protocol authority can perform this action")]
    Unauthorized,
    #[msg("Insufficient principal value: below the dApp's minimum required")]
    InsufficientStake,
    #[msg("Math overflow: calculation resulted in overflow")]
    MathOverflow,
    #[msg("This LST is not enabled in the protocol allowlist")]
    LstNotEnabled,
    #[msg("LST mint does not match the vault's existing LST")]
    LstMintMismatch,
    #[msg("dApp does not match the vault's subscribed dApp")]
    DappMismatch,
    #[msg("Invalid exchange rate")]
    InvalidRate,
    #[msg("Invalid protocol fee (must be <= 10000 bps)")]
    InvalidFee,
    #[msg("Vault is not in cooldown mode")]
    NotInCooldown,
    #[msg("Cooldown period has not finished yet")]
    CooldownNotFinished,
    #[msg("Wrong rate kind for this instruction (manual vs stake-pool)")]
    RateKindMismatch,
    #[msg("Invalid rate source: not the LST's registered stake pool")]
    InvalidRateSource,
    #[msg("Access has expired: the subscription is not paid through the current time")]
    AccessExpired,
}
