use anchor_lang::prelude::*;
pub use instructions::*;

pub mod instructions;
pub mod state;
pub mod seeker_cpi;
pub mod errors;

declare_id!("StKToSuBSCriBe11111111111111111111111111111");

pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");
pub const PRECISION_FACTOR: u128 = 1_000_000_000_000; // 1e12

#[program]
pub mod stake_to_subscribe {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        protocol_fee_bps: u16,
        treasury: Pubkey,
        default_guardian_pool: Pubkey,
        min_stake_amount: u64,
    ) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, protocol_fee_bps, treasury, default_guardian_pool, min_stake_amount)
    }

    pub fn initialize_dapp(
        ctx: Context<InitializeDapp>,
        dapp_id: [u8; 32],
        treasury: Pubkey,
        guardian_vote_account: Pubkey,
    ) -> Result<()> {
        instructions::initialize_dapp::handler(ctx, dapp_id, treasury, guardian_vote_account)
    }

    pub fn stake_and_subscribe(ctx: Context<StakeAndSubscribe>, amount: u64, dapp_id: [u8; 32]) -> Result<()> {
        instructions::stake_and_subscribe::handler(ctx, amount, dapp_id)
    }

    pub fn initiate_unsubscribe(ctx: Context<InitiateUnsubscribe>) -> Result<()> {
        instructions::initiate_unsubscribe::handler(ctx)
    }

    pub fn withdraw_stake(ctx: Context<WithdrawStake>) -> Result<()> {
        instructions::withdraw_stake::handler(ctx)
    }

    pub fn claim_yield(ctx: Context<ClaimYield>) -> Result<()> {
        instructions::claim_yield::handler(ctx)
    }

    pub fn distribute_yield(ctx: Context<DistributeYield>) -> Result<()> {
        instructions::distribute_yield::handler(ctx)
    }

    pub fn claim_subscription_yield(ctx: Context<ClaimSubscriptionYield>) -> Result<()> {
        instructions::claim_subscription_yield::handler(ctx)
    }

    pub fn treasury_swap_crank(ctx: Context<TreasurySwapCrank>, amount_to_swap: u64, swap_data: Vec<u8>) -> Result<()> {
        instructions::treasury_swap_crank::handler(ctx, amount_to_swap, swap_data)
    }
}
