use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::state::{DappRegistry, UserVault};
use anchor_lang::solana_program::pubkey;

pub const PROTOCOL_TREASURY: Pubkey = pubkey!("jawKuQ3xtcYoAuqE9jyG2H35sv2pWJSzsyjoNpsxG38");
pub const SKR_STAKING_PROGRAM: Pubkey = pubkey!("SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ");
pub const SKR_STAKING_VAULT: Pubkey = pubkey!("8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8");
pub const SKR_STAKING_AUTHORITY: Pubkey = pubkey!("4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw");

#[derive(Accounts)]
pub struct ClaimYield<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(mut, seeds = [b"dapp", dapp.authority.as_ref()], bump = dapp.bump)]
    pub dapp: Account<'info, DappRegistry>,

    #[account(
        mut,
        seeds = [b"vault", dapp.key().as_ref(), user_vault.user.as_ref()],
        bump = user_vault.bump
    )]
    pub user_vault: Account<'info, UserVault>,

    /// CHECK: The SPL Token mint for $SKR
    pub skr_mint: InterfaceAccount<'info, Mint>,

    /// The Vault's $SKR token account (holding staked amount + accumulated yield)
    #[account(mut)]
    pub vault_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The developer's treasury $SKR token account
    #[account(mut)]
    pub treasury_skr_account: InterfaceAccount<'info, TokenAccount>,

    /// The protocol's master treasury $SKR token account for the 5% tax
    #[account(mut)]
    pub protocol_skr_account: InterfaceAccount<'info, TokenAccount>,

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
}

pub fn claim_yield(ctx: Context<ClaimYield>) -> Result<()> {
    let vault = &ctx.accounts.user_vault;
    let vault_skr_account = &ctx.accounts.vault_skr_account;
    
    let principal = vault.staked_amount;
    let current_balance = vault_skr_account.amount;

    msg!("Executing CPI to official $SKR Staking Protocol to harvest yield...");
    
    let dapp_key = ctx.accounts.dapp.key();
    let user_key = vault.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        dapp_key.as_ref(),
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    let claim_ix = solana_program::instruction::Instruction {
        program_id: ctx.accounts.skr_staking_program.key(),
        accounts: vec![
            solana_program::instruction::AccountMeta::new(ctx.accounts.skr_staking_vault.key(), false),
            solana_program::instruction::AccountMeta::new(ctx.accounts.vault_skr_account.key(), false),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.skr_staking_authority.key(), false),
            solana_program::instruction::AccountMeta::new_readonly(ctx.accounts.user_vault.key(), true), // Vault is authority for its stake
        ],
        // Placeholder discriminator for 'claim_rewards'
        data: vec![1; 8], 
    };

    anchor_lang::solana_program::program::invoke_signed(
        &claim_ix,
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

    if current_balance <= principal {
        msg!("No yield to claim yet.");
        return Ok(());
    }
    
    let yield_amount = current_balance.checked_sub(principal).unwrap();
    
    // 5% Protocol Tax
    let protocol_fee = yield_amount.checked_mul(5).unwrap().checked_div(100).unwrap();
    let dapp_yield = yield_amount.checked_sub(protocol_fee).unwrap();

    let dapp_key = ctx.accounts.dapp.key();
    let user_key = vault.user.key();
    let vault_seeds: &[&[u8]] = &[
        b"vault",
        dapp_key.as_ref(),
        user_key.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[vault_seeds];

    // Transfer 95% to the dApp Developer
    let transfer_dapp_accounts = TransferChecked {
        from: ctx.accounts.vault_skr_account.to_account_info(),
        mint: ctx.accounts.skr_mint.to_account_info(),
        to: ctx.accounts.treasury_skr_account.to_account_info(),
        authority: ctx.accounts.user_vault.to_account_info(),
    };
    let transfer_dapp_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_dapp_accounts,
        signer_seeds,
    );
    transfer_checked(transfer_dapp_ctx, dapp_yield, ctx.accounts.skr_mint.decimals)?;

    // Transfer 5% to the Protocol Master Wallet
    if protocol_fee > 0 {
        let transfer_protocol_accounts = TransferChecked {
            from: ctx.accounts.vault_skr_account.to_account_info(),
            mint: ctx.accounts.skr_mint.to_account_info(),
            to: ctx.accounts.protocol_skr_account.to_account_info(),
            authority: ctx.accounts.user_vault.to_account_info(),
        };
        let transfer_protocol_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_protocol_accounts,
            signer_seeds,
        );
        transfer_checked(transfer_protocol_ctx, protocol_fee, ctx.accounts.skr_mint.decimals)?;
    }

    Ok(())
}
