use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized: only authority can perform this action")]
    Unauthorized,
    #[msg("Insufficient stake amount: below minimum required")]
    InsufficientStake,
    #[msg("Math overflow: calculation resulted in overflow")]
    MathOverflow,
    #[msg("Invalid vault: incorrect vault account")]
    InvalidVault,
    #[msg("Cooldown period not completed")]
    CooldownNotCompleted,
    #[msg("Vault is not in cooldown mode")]
    NotInCooldown,
    #[msg("Cooldown period has not finished yet")]
    CooldownNotFinished,
}
