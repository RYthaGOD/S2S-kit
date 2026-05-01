use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    token_metadata_initialize, Mint, TokenInterface, TokenMetadataInitialize,
};
use crate::state::GlobalConfig;

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

    /// The Shared Token-2022 Active Pass Mint
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = config,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = config,
        extensions::metadata_pointer::metadata_address = pass_mint,
        seeds = [b"pass_mint"],
        bump,
    )]
    pub pass_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeProtocol>,
    protocol_fee_bps: u16,
    treasury: Pubkey,
    default_guardian_pool: Pubkey,
    min_stake_amount: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.protocol_fee_bps = protocol_fee_bps;
    config.treasury = treasury;
    config.pass_mint = ctx.accounts.pass_mint.key();
    config.total_dapps = 0;
    config.global_yield_index = 0;
    config.default_guardian_pool = default_guardian_pool;
    config.min_stake_amount = min_stake_amount;
    config.bump = ctx.bumps.config;

    // Initialize Metadata in the Mint
    msg!("Initializing Token-2022 Metadata for Active Pass...");
    let config_seeds: &[&[u8]] = &[
        b"global_config",
        &[config.bump],
    ];
    let signer_seeds = &[config_seeds];

    let metadata_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TokenMetadataInitialize {
            program_id: ctx.accounts.token_program.to_account_info(),
            mint: ctx.accounts.pass_mint.to_account_info(),
            metadata: ctx.accounts.pass_mint.to_account_info(),
            mint_authority: ctx.accounts.config.to_account_info(),
            update_authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    );

    token_metadata_initialize(
        metadata_ctx,
        "S2S Active Pass".to_string(),
        "S2S".to_string(),
        "https://s2s-kit.xyz/metadata/pass.json".to_string(),
    )?;

    Ok(())
}
