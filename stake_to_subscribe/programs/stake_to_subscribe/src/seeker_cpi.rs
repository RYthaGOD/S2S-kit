use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

// Official Seeker Staking Program Instructions Discriminators
pub const DELEGATE_STAKE_DISCRIMINATOR: [u8; 8] = [72, 234, 151, 107, 12, 33, 110, 196];
pub const UNDELEGATE_DISCRIMINATOR: [u8; 8] = [77, 107, 13, 240, 203, 120, 212, 248];
pub const WITHDRAW_DISCRIMINATOR: [u8; 8] = [183, 18, 205, 147, 151, 217, 78, 248];

pub fn get_event_authority(program_id: &Pubkey) -> Pubkey {
    let (event_authority, _bump) = Pubkey::find_program_address(&[b"__event_authority"], program_id);
    event_authority
}

pub fn delegate_stake_ix(
    user_stake: Pubkey,
    stake_config: Pubkey,
    guardian_pool: Pubkey,
    authority: Pubkey,
    vault: Pubkey,
    mint: Pubkey,
    event_authority: Pubkey,
    staking_program: Pubkey,
    amount: u64,
) -> Instruction {
    let mut data = DELEGATE_STAKE_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&amount.to_le_bytes());

    Instruction {
        program_id: staking_program,
        accounts: vec![
            AccountMeta::new(user_stake, false),
            AccountMeta::new_readonly(stake_config, false),
            AccountMeta::new(guardian_pool, false),
            AccountMeta::new_readonly(authority, true),
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
        ],
        data,
    }
}

pub fn undelegate_ix(
    user_stake: Pubkey,
    stake_config: Pubkey,
    guardian_pool: Pubkey,
    authority: Pubkey,
    vault: Pubkey,
    mint: Pubkey,
    event_authority: Pubkey,
    staking_program: Pubkey,
    shares: u128,
) -> Instruction {
    let mut data = UNDELEGATE_DISCRIMINATOR.to_vec();
    data.extend_from_slice(&shares.to_le_bytes());

    Instruction {
        program_id: staking_program,
        accounts: vec![
            AccountMeta::new(user_stake, false),
            AccountMeta::new_readonly(stake_config, false),
            AccountMeta::new(guardian_pool, false),
            AccountMeta::new_readonly(authority, true),
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(event_authority, false),
            AccountMeta::new_readonly(anchor_lang::solana_program::system_program::ID, false),
            AccountMeta::new_readonly(anchor_spl::token::ID, false),
        ],
        data,
    }
}

pub fn withdraw_ix(
    user_stake: Pubkey,
    stake_config: Pubkey,
    authority: Pubkey,
    vault: Pubkey,
    destination: Pubkey,
    token_program: Pubkey,
    event_authority: Pubkey,
    staking_program: Pubkey,
) -> Instruction {
    let data = WITHDRAW_DISCRIMINATOR.to_vec();

    Instruction {
        program_id: staking_program,
        accounts: vec![
            AccountMeta::new(user_stake, false),
            AccountMeta::new_readonly(stake_config, false),
            AccountMeta::new_readonly(authority, true),
            AccountMeta::new(vault, false),
            AccountMeta::new(destination, false),
            AccountMeta::new_readonly(token_program, false),
            AccountMeta::new_readonly(event_authority, false),
        ],
        data,
    }
}
