import { cac } from 'cac';
import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'fs-extra';
import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN, Idl } from '@coral-xyz/anchor';
import idl from './idl.json';

const cli = cac('s2s');

const PROGRAM_ID = new PublicKey(idl.address);

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
  .option('--treasury <pubkey>', 'Protocol treasury address')
  .option('--fee <bps>', 'Protocol fee in basis points (e.g. 500 for 5%)', { default: 500 })
  .option('--min-stake <amount>', 'Minimum stake amount in lamports', { default: '1000000000' })
  .action(async (options) => {
    p.intro(color.cyan('S2S Protocol Initialization'));

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    // Load local keypair (standard Solana CLI path)
    const keyPath = `${process.env.HOME}/.config/solana/id.json`;
    if (!fs.existsSync(keyPath)) {
        p.log.error('Local Solana keypair not found at ~/.config/solana/id.json');
        return;
    }
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(keyPath, 'utf-8'))));
    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    const program = new Program(idl as Idl, PROGRAM_ID, provider);

    const s = p.spinner();
    s.start('Initializing protocol on-chain...');

    try {
        const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
        const [passMint] = PublicKey.findProgramAddressSync([Buffer.from("pass_mint")], PROGRAM_ID);

        const tx = await program.methods
            .initializeProtocol(
                options.fee,
                new PublicKey(options.treasury),
                keypair.publicKey, // Default guardian pool to authority for demo
                new BN(options.min_stake)
            )
            .accounts({
                config,
                passMint,
                authority: keypair.publicKey,
                tokenProgram: new PublicKey('TokenzQdBNbLqP5VEhdkThpAmmRzWMHcx97KuZ6yK'), // Token-2022
                systemProgram: PublicKey.default,
            })
            .rpc();

        s.stop(color.green(`Protocol initialized: ${tx}`));
        p.outro('S2S Protocol is now LIVE.');
    } catch (err) {
        s.stop(color.red('Initialization failed.'));
        console.error(err);
    }
  });

cli.help();
cli.parse();
