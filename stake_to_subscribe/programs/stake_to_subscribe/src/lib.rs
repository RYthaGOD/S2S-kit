use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;
pub mod seeker_cpi;

use instructions::*;

declare_id!("StKToSuBSCriBe11111111111111111111111111111");

#[program]
pub mod stake_to_subscribe {
    use super::*;

    pub fn initialize_dapp(
        ctx: Context<InitializeDapp>,
        treasury: Pubkey,
        guardian_vote_account: Pubkey,
    ) -> Result<()> {
        instructions::initialize_dapp::initialize_dapp(ctx, treasury, guardian_vote_account)
    }

    pub fn stake_and_subscribe(ctx: Context<StakeAndSubscribe>, amount: u64) -> Result<()> {
        instructions::stake_and_subscribe::stake_and_subscribe(ctx, amount)
    }

    pub fn initiate_unsubscribe(ctx: Context<InitiateUnsubscribe>) -> Result<()> {
        instructions::initiate_unsubscribe::initiate_unsubscribe(ctx)
    }

    pub fn withdraw_stake(ctx: Context<WithdrawStake>) -> Result<()> {
        instructions::withdraw_stake::withdraw_stake(ctx)
    }

    pub fn claim_yield(ctx: Context<ClaimYield>) -> Result<()> {
        instructions::claim_yield::claim_yield(ctx)
    }

    pub fn treasury_swap_crank(ctx: Context<TreasurySwapCrank>, amount_to_swap: u64, swap_data: Vec<u8>) -> Result<()> {
        instructions::treasury_swap_crank::treasury_swap_crank(ctx, amount_to_swap, swap_data)
    }
}
