use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");
pub const SKR_STAKING_AUTHORITY: Pubkey = pubkey!("4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw");

pub fn delegate_stake_ix(
    user_stake: Pubkey,
    stake_config: Pubkey,
    guardian_pool: Pubkey,
    payer: Pubkey,
    user: Pubkey,
    user_token_account: Pubkey,
    stake_vault: Pubkey,
    mint: Pubkey,
    token_program: Pubkey,
    system_program: Pubkey,
    event_authority: Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = vec![206, 176, 202, 18, 200, 209, 179, 108]; // 'stake' discriminator
    data.extend_from_slice(&amount.to_le_bytes());
    Instruction {
        program_id: SKR_STAKING_PROGRAM,
        accounts: vec![
            AccountMeta::new(user_stake, false),
            AccountMeta::new(stake_config, false),
            AccountMeta::new(guardian_pool, false),
            AccountMeta::new(payer, true),
            AccountMeta::new(user, true),
            AccountMeta::new(user_token_account, false),
            AccountMeta::new(stake_vault, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(token_program, false),
            AccountMeta::new_readonly(system_program, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(SKR_STAKING_PROGRAM, false),
        ],
        data,
    }
}

pub fn claim_rewards_ix(
    guardian_pool: Pubkey,
    stake_config: Pubkey,
    authority: Pubkey,
    stake_vault: Pubkey,
    destination: Pubkey,
    mint: Pubkey,
    token_program: Pubkey,
    event_authority: Pubkey,
) -> Instruction {
    Instruction {
        program_id: SKR_STAKING_PROGRAM,
        accounts: vec![
            AccountMeta::new(guardian_pool, false),
            AccountMeta::new(stake_config, false),
            AccountMeta::new_readonly(authority, true),
            AccountMeta::new(stake_vault, false),
            AccountMeta::new(destination, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(token_program, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(SKR_STAKING_PROGRAM, false),
        ],
        data: vec![227, 163, 154, 139, 29, 195, 57, 85], // 'claim_guardian_commission' discriminator
    }
}

pub fn undelegate_ix(
    user_stake: Pubkey,
    stake_config: Pubkey,
    guardian_pool: Pubkey,
    user: Pubkey,
    stake_vault: Pubkey,
    mint: Pubkey,
    event_authority: Pubkey,
    shares: u128,
) -> Instruction {
    let mut data = vec![90, 95, 107, 42, 205, 124, 50, 225]; // 'unstake' discriminator
    data.extend_from_slice(&shares.to_le_bytes());
    Instruction {
        program_id: SKR_STAKING_PROGRAM,
        accounts: vec![
            AccountMeta::new(user_stake, false),
            AccountMeta::new(stake_config, false),
            AccountMeta::new(guardian_pool, false),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(stake_vault, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(SKR_STAKING_PROGRAM, false),
        ],
        data,
    }
}

pub fn withdraw_ix(
    user_stake: Pubkey,
    stake_config: Pubkey,
    user: Pubkey,
    stake_vault: Pubkey,
    user_token_account: Pubkey,
    token_program: Pubkey,
    event_authority: Pubkey,
) -> Instruction {
    Instruction {
        program_id: SKR_STAKING_PROGRAM,
        accounts: vec![
            AccountMeta::new(user_stake, false),
            AccountMeta::new(stake_config, false),
            AccountMeta::new_readonly(user, true),
            AccountMeta::new(stake_vault, false),
            AccountMeta::new(user_token_account, false),
            AccountMeta::new_readonly(token_program, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(SKR_STAKING_PROGRAM, false),
        ],
        data: vec![183, 18, 70, 156, 148, 109, 161, 34], // 'withdraw' discriminator
    }
}
