use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The cooldown period has not finished yet.")]
    CooldownNotFinished,
    #[msg("The vault is not in a cooling down state.")]
    NotInCooldown,
}
