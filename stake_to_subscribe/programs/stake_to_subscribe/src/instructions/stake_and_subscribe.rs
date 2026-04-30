use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;
use anchor_spl::token_interface::{mint_to, transfer_checked, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked};

pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");
pub const SKR_STAKING_AUTHORITY: Pubkey = pubkey!("4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw");

use crate::state::{DappRegistry, UserVault};

#[derive(Accounts)]
pub struct StakeAndSubscribe<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut, seeds = [b"dapp", dapp.authority.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        init,
        payer = user,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [b"vault", dapp.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    /// The user's $SKR token account
    #[account(mut)]
    pub user_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The Vault's $SKR token account to hold the escrowed tokens
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The Token-2022 Active Pass Mint
    #[account(mut)]
    pub pass_mint: InterfaceAccount<'info, Mint>,

    /// The user's Active Pass token account
    #[account(mut)]
    pub user_pass_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    
    /// CHECK: The official Solana Mobile $SKR Staking Program
    #[account(address = SKR_STAKING_PROGRAM)]
    pub skr_staking_program: AccountInfo<'info>,

    /// CHECK: The official $SKR Staking Vault
    #[account(mut, address = SKR_STAKING_VAULT)]
    pub skr_staking_vault: AccountInfo<'info>,
}

pub fn stake_and_subscribe(ctx: Context<StakeAndSubscribe>, amount: u64) -> Result<()> {
    // 1. Set up Vault State
    let vault = &mut ctx.accounts.user_vault;
    vault.dapp = ctx.accounts.dapp.key();
    vault.user = ctx.accounts.user.key();
    vault.staked_amount = amount;
    vault.active_pass_mint = ctx.accounts.pass_mint.key();
    vault.staked_at = Clock::get()?.unix_timestamp;
    vault.is_cooling_down = false;
    vault.cooldown_start_time = 0;
    vault.bump = ctx.bumps.user_vault;

    let dapp_key = ctx.accounts.dapp.key();
    let user_key = ctx.accounts.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        dapp_key.as_ref(),
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    // 2. Transfer $SKR from User to Vault
    let transfer_cpi_accounts = TransferChecked {
        from: ctx.accounts.user_skr_account.to_account_info(),
        mint: ctx.accounts.skr_mint.to_account_info(),
        to: ctx.accounts.vault_skr_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let transfer_cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_cpi_accounts,
    );
    transfer_checked(transfer_cpi_ctx, amount, ctx.accounts.skr_mint.decimals)?;

    // 3. Delegate to the Official $SKR Staking Program via CPI
    msg!("Executing CPI to official $SKR Staking Protocol...");
    let delegate_ix = solana_program::instruction::Instruction {
        program_id: ctx.accounts.skr_staking_program.key(),
        accounts: vec![
            solana_program::instruction::AccountMeta::new(ctx.accounts.vault_skr_account.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.skr_staking_vault.key(), false),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.user_vault.key(), true), // Vault PDA is authority
            // Add other accounts required by the official IDL
        ],
        // Placeholder discriminator for 'delegate' - update with official IDL bytes
        data: vec![0; 8], 
    };

    anchor_lang::solana_program::program::invoke_signed(
        &delegate_ix,
        &[
            ctx.accounts.vault_skr_account.to_account_info(),
            ctx.accounts.skr_staking_vault.to_account_info(),
            ctx.accounts.user_vault.to_account_info(),
            ctx.accounts.skr_staking_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds
    )?;

    // 4. Mint the Active Pass (Token-2022)
    let mint_cpi_accounts = MintTo {
        mint: ctx.accounts.pass_mint.to_account_info(),
        to: ctx.accounts.user_pass_account.to_account_info(),
        authority: ctx.accounts.user_vault.to_account_info(), // Vault needs to be mint authority
    };
    let mint_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(), 
        mint_cpi_accounts, 
        signer_seeds
    );
    mint_to(mint_cpi_ctx, 1)?; // Mint 1 non-fungible Active Pass

    Ok(())
}
