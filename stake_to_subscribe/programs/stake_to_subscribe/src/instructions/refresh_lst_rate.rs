use anchor_lang::prelude::*;
use crate::state::LstConfig;
use crate::errors::ErrorCode;

/// Trustlessly refresh an SPL-stake-pool LST's exchange rate by reading the pool's
/// `total_lamports / pool_token_supply`. Permissionless — it only copies on-chain truth.
#[derive(Accounts)]
pub struct RefreshLstRate<'info> {
    #[account(
        mut,
        seeds = [b"lst", lst_config.mint.as_ref()],
        bump = lst_config.bump
    )]
    pub lst_config: Account<'info, LstConfig>,

    /// CHECK: must be the LST's registered StakePool account, owned by the SPL
    /// Stake Pool program. Validated below before any field is read.
    #[account(
        address = lst_config.rate_source @ ErrorCode::InvalidRateSource,
        owner = crate::SPL_STAKE_POOL_PROGRAM @ ErrorCode::InvalidRateSource,
    )]
    pub stake_pool: AccountInfo<'info>,
}

// Byte offsets of the two fields we need inside an SPL StakePool account (stable
// layout): account_type(1) + 9×Pubkey(32) + stake_withdraw_bump_seed(1) = 290?  No —
// see the running tally below. total_lamports and pool_token_supply are consecutive u64s.
//   account_type            1   @0
//   manager                32   @1
//   staker                 32   @33
//   stake_deposit_authority32   @65
//   stake_withdraw_bump     1   @97
//   validator_list         32   @98
//   reserve_stake          32   @130
//   pool_mint              32   @162
//   manager_fee_account    32   @194
//   token_program_id       32   @226
//   total_lamports          8   @258
//   pool_token_supply       8   @266
const OFF_TOTAL_LAMPORTS: usize = 258;
const OFF_POOL_TOKEN_SUPPLY: usize = 266;

pub fn handler(ctx: Context<RefreshLstRate>) -> Result<()> {
    require!(
        ctx.accounts.lst_config.rate_kind == crate::state::RATE_KIND_SPL_STAKE_POOL,
        ErrorCode::RateKindMismatch
    );

    let data = ctx.accounts.stake_pool.try_borrow_data()?;
    require!(data.len() >= OFF_POOL_TOKEN_SUPPLY + 8, ErrorCode::InvalidRateSource);
    // account_type byte 0: 1 = StakePool (guards against other SPL Stake Pool–owned accounts
    // like ValidatorList being registered as rate_source by mistake).
    require!(data[0] == 1, ErrorCode::InvalidRateSource);

    let total_lamports = u64::from_le_bytes(
        data[OFF_TOTAL_LAMPORTS..OFF_TOTAL_LAMPORTS + 8].try_into().unwrap(),
    );
    let pool_token_supply = u64::from_le_bytes(
        data[OFF_POOL_TOKEN_SUPPLY..OFF_POOL_TOKEN_SUPPLY + 8].try_into().unwrap(),
    );
    require!(pool_token_supply > 0, ErrorCode::InvalidRate);

    // rate = lamports backing per 1 LST token, scaled by RATE_PRECISION.
    let rate = (total_lamports as u128)
        .checked_mul(crate::RATE_PRECISION)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(pool_token_supply as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(rate > 0, ErrorCode::InvalidRate);

    let lst = &mut ctx.accounts.lst_config;
    lst.rate = rate;
    lst.last_rate_update = Clock::get()?.unix_timestamp;

    Ok(())
}
