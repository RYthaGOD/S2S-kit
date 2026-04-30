use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface};

pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");
pub const SKR_STAKING_AUTHORITY: Pubkey = pubkey!("4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw");

use crate::state::{DappRegistry, UserVault};

#[derive(Accounts)]
pub struct UnstakeAndWithdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"dapp", dapp.authority.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        mut,
        seeds = [b"vault", dapp.key().as_ref(), user.key().as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(mut)]
    pub pass_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user_pass_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    
    /// CHECK: The official Solana Mobile $SKR Staking Program
    #[account(address = SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault
    #[account(mut, address = SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Authority
    #[account(address = SKR_STAKING_AUTHORITY)]
    pub skr_staking_authority: AccountInfo<'info>,

    /// The Vault's $SKR token account (to receive unstaked tokens eventually)
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,
}

pub fn unstake_and_withdraw(ctx: Context<UnstakeAndWithdraw>) -> Result<()> {
    let vault = &mut ctx.accounts.user_vault;
    let clock = Clock::get()?;

    vault.is_cooling_down = true;
    vault.cooldown_start_time = clock.unix_timestamp;

    msg!("Executing CPI to official $SKR Staking Protocol to initiate 48h cooldown...");
    
    let dapp_key = ctx.accounts.dapp.key();
    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        dapp_key.as_ref(),
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    let unstake_ix = solana_program::instruction::Instruction {
        program_id: ctx.accounts.skr_staking_program.key(),
        accounts: vec![
            solana_program::instruction::AccountMeta::new(ctx.accounts.skr_staking_vault.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.vault_skr_account.key(), false),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.skr_staking_authority.key(), false),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.user_vault.key(), true), 
        ],
        // Placeholder discriminator for 'undelegate'
        data: vec![2; 8], 
    };

    anchor_lang::solana_program::program::invoke_signed(
        &unstake_ix,
        &[
            ctx.accounts.skr_staking_vault.to_account_info(),
            ctx.accounts.vault_skr_account.to_account_info(),
            ctx.accounts.skr_staking_authority.to_account_info(),
            ctx.accounts.user_vault.to_account_info(),
            ctx.accounts.skr_staking_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds
    )?;

    let cpi_accounts = Burn {
        mint: ctx.accounts.pass_mint.to_account_info(),
        from: ctx.accounts.user_pass_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    burn(cpi_ctx, 1)?; // Burn 1 Active Pass

    Ok(())
}
