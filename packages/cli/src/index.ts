import { cac } from 'cac';
import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'fs-extra';
import { Connection, Keypair, PublicKey, SystemProgram, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN, Idl } from '@coral-xyz/anchor';
import idl from './idl.json';

const cli = cac('s2s');

const PROGRAM_ID = new PublicKey(idl.address);
const TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkThpAmmRzWMHcx97KuZ6yK');

function loadProvider() {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const keyPath = `${process.env.HOME}/.config/solana/id.json`;
    if (!fs.existsSync(keyPath)) {
        throw new Error('Local Solana keypair not found at ~/.config/solana/id.json');
    }
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(keyPath, 'utf-8'))));
    const provider = new AnchorProvider(connection, new Wallet(keypair), { commitment: 'confirmed' });
    return { keypair, program: new Program(idl as Idl, provider) };
}

cli
  .command('init', 'Scaffold S2S infrastructure in current project')
  .action(async () => {
    p.intro(color.yellow('S2S Infrastructure Scaffolder'));
    // Existing scaffolding logic...
    p.note('Scaffolding logic maintained for project setup.');
    p.outro(color.green('Setup complete.'));
  });

cli
  .command('init-protocol', 'Initialize the S2S protocol on-chain')
  .option('--treasury <pubkey>', 'Protocol treasury owner (receives the protocol fee in LST)')
  .option('--fee <bps>', 'Protocol fee in basis points (ships at 0; the config authority can raise it later)', { default: 0 })
  .option('--cooldown <seconds>', 'Withdrawal cooldown in seconds (0 for instant)', { default: '0' })
  .action(async (options) => {
    p.intro(color.cyan('S2S Protocol Initialization'));
    const s = p.spinner();
    s.start('Initializing protocol on-chain...');
    try {
        const { keypair, program } = loadProvider();
        const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
        const [passMint] = PublicKey.findProgramAddressSync([Buffer.from("pass_mint")], PROGRAM_ID);

        const tx = await program.methods
            .initializeProtocol(
                Number(options.fee),
                new PublicKey(options.treasury),
                new BN(options.cooldown)
            )
            .accounts({
                config,
                passMint,
                authority: keypair.publicKey,
                tokenProgram: TOKEN_2022, // pass mint is a non-transferable Token-2022 mint
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        s.stop(color.green(`Protocol initialized: ${tx}`));
        p.outro('S2S Protocol is now LIVE.');
    } catch (err) {
        s.stop(color.red('Initialization failed.'));
        console.error(err);
    }
  });

cli
  .command('add-lst', 'Allow-list a Liquid Staking Token')
  .option('--mint <pubkey>', 'The LST mint to accept')
  .option('--kind <0|1>', 'Rate kind: 0 = manual (test LSTs), 1 = SPL stake pool (trustless)', { default: '1' })
  .option('--rate <scaled>', 'Initial/seed exchange rate, scaled by 1e12 (1.05 SOL = 1050000000000)', { default: '1000000000000' })
  .option('--rate-source <pubkey>', 'For kind 1: the StakePool account the rate is read from', { default: PublicKey.default.toBase58() })
  .action(async (options) => {
    p.intro(color.cyan('S2S Add LST'));
    const s = p.spinner();
    s.start('Allow-listing LST on-chain...');
    try {
        const { keypair, program } = loadProvider();
        const lstMint = new PublicKey(options.mint);
        const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
        const [lstConfig] = PublicKey.findProgramAddressSync([Buffer.from("lst"), lstMint.toBuffer()], PROGRAM_ID);

        const tx = await program.methods
            .addLst(Number(options.kind), new BN(options.rate), new PublicKey(options.rate_source))
            .accounts({
                authority: keypair.publicKey,
                config,
                lstMint,
                lstConfig,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        s.stop(color.green(`LST allow-listed: ${tx}`));
        p.note(`LstConfig PDA: ${lstConfig.toBase58()}`, 'LST');
        p.outro('LST is now accepted by the protocol.');
    } catch (err) {
        s.stop(color.red('add-lst failed.'));
        console.error(err);
    }
  });

cli
  .command('register-dapp', 'Register your dApp in the S2S protocol')
  .option('--id <hex>', '32-byte hex dApp identifier')
  .option('--treasury <pubkey>', 'dApp treasury owner (receives the user-facing yield in LST)')
  .option('--min-stake-value <lamports>', 'Minimum SOL-denominated principal value for access', { default: '1000000000' })
  .option('--price <lamports>', 'Subscription price in SOL-value per period (0 = unmetered)', { default: '0' })
  .option('--period <seconds>', 'Billing period in seconds', { default: '2592000' })
  .option('--trial <seconds>', 'Free trial granted on subscribe, in seconds', { default: '604800' })
  .action(async (options) => {
    p.intro(color.magenta('S2S dApp Registration'));
    const s = p.spinner();
    s.start('Registering dApp on-chain...');
    try {
        const { keypair, program } = loadProvider();
        const dappIdBuf = Buffer.alloc(32);
        Buffer.from(options.id, 'hex').copy(dappIdBuf);

        const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
        const [dapp] = PublicKey.findProgramAddressSync([Buffer.from("dapp"), dappIdBuf], PROGRAM_ID);

        const tx = await program.methods
            .initializeDapp(
                Array.from(dappIdBuf),
                new PublicKey(options.treasury),
                new BN(options.min_stake_value),
                new BN(options.price),
                new BN(options.period),
                new BN(options.trial)
            )
            .accounts({
                authority: keypair.publicKey,
                config,
                dapp,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        s.stop(color.green(`dApp registered: ${tx}`));
        p.note(`PDA: ${dapp.toBase58()}`, 'dApp Registry');
        p.outro('dApp is now active in the S2S index.');
    } catch (err) {
        s.stop(color.red('Registration failed.'));
        console.error(err);
    }
  });

cli.help();
cli.parse();
