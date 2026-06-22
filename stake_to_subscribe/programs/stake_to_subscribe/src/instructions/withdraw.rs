use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn, transfer_checked, Burn, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::state::{GlobalConfig, UserVault};
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(seeds = [b"global_config"], bump = config.bump)]
    pub config: Box<Account<'info, GlobalConfig>>,

    #[account(
        mut,
        close = user,
        seeds = [b"vault", user.key().as_ref()],
        bump = user_vault.bump,
        constraint = user_vault.user == user.key(),
    )]
    pub user_vault: Box<Account<'info, UserVault>>,

    #[account(address = user_vault.lst_mint)]
    pub lst_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = lst_mint,
        token::authority = user_vault,
        token::token_program = token_program,
    )]
    pub vault_lst_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = lst_mint,
        token::authority = user,
        token::token_program = token_program,
    )]
    pub user_lst_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// The shared non-transferable Active Pass mint (Token-2022).
    #[account(
        mut,
        address = config.pass_mint,
        seeds = [b"pass_mint"],
        bump,
    )]
    pub pass_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = pass_mint,
        token::authority = user,
        token::token_program = pass_token_program,
    )]
    pub user_pass_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub pass_token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let vault = &ctx.accounts.user_vault;
    let clock = Clock::get()?;

    // 1. Enforce the withdrawal cooldown.
    require!(vault.is_cooling_down, ErrorCode::NotInCooldown);
    let elapsed = clock
        .unix_timestamp
        .checked_sub(vault.cooldown_start_time)
        .ok_or(ErrorCode::MathOverflow)?;
    require!(
        elapsed >= ctx.accounts.config.cooldown_seconds as i64,
        ErrorCode::CooldownNotFinished
    );

    let user_key = vault.user;
    let vault_seeds: &[&[u8]] = &[b"vault", user_key.as_ref(), &[vault.bump]];
    let signer_seeds = &[vault_seeds];

    // 2. Return the full LST balance still escrowed (the user's preserved principal,
    //    plus any appreciation not yet harvested).
    let amount = ctx.accounts.vault_lst_account.amount;
    if amount > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_lst_account.to_account_info(),
                    mint: ctx.accounts.lst_mint.to_account_info(),
                    to: ctx.accounts.user_lst_account.to_account_info(),
                    authority: ctx.accounts.user_vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            ctx.accounts.lst_mint.decimals,
        )?;
    }

    // 3. Burn the Active Pass to finalize the unsubscription.
    burn(
        CpiContext::new(
            ctx.accounts.pass_token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.pass_mint.to_account_info(),
                from: ctx.accounts.user_pass_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1,
    )?;

    Ok(())
}
