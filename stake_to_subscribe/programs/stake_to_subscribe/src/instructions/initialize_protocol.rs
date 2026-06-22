use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token_interface::{
    non_transferable_mint_initialize, NonTransferableMintInitialize, TokenInterface,
};
use anchor_spl::token_2022::spl_token_2022::{
    extension::ExtensionType, instruction::initialize_mint2, state::Mint as MintState,
};
use crate::state::GlobalConfig;
use crate::errors::ErrorCode;

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"global_config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    /// The shared Active Pass mint, created in the handler as a Token-2022 mint
    /// with the NonTransferable extension so every pass is soulbound — it cannot
    /// be sold or moved between wallets.
    /// CHECK: created and initialized in the handler; address is the [b"pass_mint"] PDA.
    #[account(mut, seeds = [b"pass_mint"], bump)]
    pub pass_mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    protocol_fee_bps: u16,
    treasury: Pubkey,
    cooldown_seconds: u64,
) -> Result<()> {
    require!(protocol_fee_bps <= 10_000, ErrorCode::InvalidFee);

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.protocol_fee_bps = protocol_fee_bps;
    config.treasury = treasury;
    config.pass_mint = ctx.accounts.pass_mint.key();
    config.cooldown_seconds = cooldown_seconds;
    config.total_dapps = 0;
    config.total_lsts = 0;
    config.bump = ctx.bumps.config;
    let config_key = config.key();

    // --- Create the non-transferable Token-2022 pass mint ---
    let space = ExtensionType::try_calculate_account_len::<MintState>(&[
        ExtensionType::NonTransferable,
    ])
    .map_err(|_| ErrorCode::MathOverflow)?;
    let lamports = Rent::get()?.minimum_balance(space);

    let mint_seeds: &[&[u8]] = &[b"pass_mint", &[ctx.bumps.pass_mint]];
    let signer_seeds = &[mint_seeds];

    // 1. Allocate the mint account, owned by the (Token-2022) token program.
    create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.pass_mint.to_account_info(),
            },
            signer_seeds,
        ),
        lamports,
        space as u64,
        &ctx.accounts.token_program.key(),
    )?;

    // 2. Initialize the NonTransferable extension (must precede InitializeMint).
    non_transferable_mint_initialize(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        NonTransferableMintInitialize {
            token_program_id: ctx.accounts.token_program.to_account_info(),
            mint: ctx.accounts.pass_mint.to_account_info(),
        },
    ))?;

    // 3. Initialize the mint itself (0 decimals, config PDA as mint authority).
    let ix = initialize_mint2(
        &ctx.accounts.token_program.key(),
        &ctx.accounts.pass_mint.key(),
        &config_key,
        None,
        0,
    )?;
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.pass_mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
    )?;

    Ok(())
}
