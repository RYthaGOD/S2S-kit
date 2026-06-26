// Full-lifecycle integration test for S2S-Kit (LST yield routing).
//
// Requires the Solana + Anchor toolchain. Run with:
//   anchor test                                  (localnet)
//   anchor test --provider.cluster devnet        (devnet)
//
// It mints a demo LST, initializes the protocol, allow-lists the LST, registers a
// dApp, deposits + subscribes, FAST-FORWARDS the exchange rate to simulate
// appreciation, harvests the yield, and withdraws the preserved principal.
//
// NOTE: authored against the program interface; not executed in the dev environment
// that produced it (no toolchain there). Treat as the canonical e2e once you run it.

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { StakeToSubscribe } from "../target/types/stake_to_subscribe";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

const RATE_PRECISION = new BN("1000000000000"); // 1e12
const ONE = new BN(1_000_000_000); // 1 token (9 decimals)

describe("stake_to_subscribe — LST yield routing", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.stakeToSubscribe as Program<StakeToSubscribe>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  const conn = provider.connection;

  const user = Keypair.generate();
  const protocolTreasuryOwner = Keypair.generate();
  const dappTreasuryOwner = Keypair.generate();
  const dappId = Array.from(Buffer.alloc(32).fill(0).map((_, i) => "chat-app".charCodeAt(i) || 0));

  // PDAs
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], program.programId);
  const [passMint] = PublicKey.findProgramAddressSync([Buffer.from("pass_mint")], program.programId);
  const [dapp] = PublicKey.findProgramAddressSync([Buffer.from("dapp"), Buffer.from(dappId)], program.programId);
  const [userVault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), user.publicKey.toBuffer()], program.programId);

  let lstMint: PublicKey;
  let userLst: PublicKey, vaultLst: PublicKey, userPass: PublicKey;
  let protocolTreasury: PublicKey, dappTreasury: PublicKey;
  let lstConfig: PublicKey;

  it("sets up accounts", async () => {
    await conn.confirmTransaction(await conn.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL));

    // demo LST is a legacy SPL token whose rate we control (stands in for jitoSOL).
    lstMint = await createMint(conn, payer, payer.publicKey, null, 9, undefined, undefined, TOKEN_PROGRAM_ID);
    [lstConfig] = PublicKey.findProgramAddressSync([Buffer.from("lst"), lstMint.toBuffer()], program.programId);

    userLst = (await getOrCreateAssociatedTokenAccount(conn, payer, lstMint, user.publicKey)).address;
    protocolTreasury = (await getOrCreateAssociatedTokenAccount(conn, payer, lstMint, protocolTreasuryOwner.publicKey)).address;
    dappTreasury = (await getOrCreateAssociatedTokenAccount(conn, payer, lstMint, dappTreasuryOwner.publicKey)).address;
    await mintTo(conn, payer, lstMint, userLst, payer, BigInt(ONE.muln(100).toString())); // 100 demoLST

    vaultLst = getAssociatedTokenAddressSync(lstMint, userVault, true);
    // NOT pre-created — deposit_and_subscribe now auto-creates the pass ATA.
    userPass = getAssociatedTokenAddressSync(passMint, user.publicKey, false, TOKEN_2022_PROGRAM_ID);
  });

  it("initializes the protocol (fee 4%, cooldown 0) + allow-lists the LST + registers a dApp", async () => {
    await program.methods
      .initializeProtocol(400, protocolTreasuryOwner.publicKey, new BN(0))
      .accounts({ config, passMint, authority: payer.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc();

    // rate_kind 0 = manual (a test LST with no real stake pool); rate 1.00.
    await program.methods
      .addLst(0, RATE_PRECISION, PublicKey.default)
      .accounts({ authority: payer.publicKey, config, lstMint, lstConfig, systemProgram: SystemProgram.programId })
      .rpc();

    // min 1.0 value · price 0.001 SOL / 30 days · 7-day free trial.
    await program.methods
      .initializeDapp(dappId, dappTreasuryOwner.publicKey, ONE, new BN(1_000_000), new BN(30 * 24 * 3600), new BN(7 * 24 * 3600))
      .accounts({ authority: payer.publicKey, config, dapp, systemProgram: SystemProgram.programId })
      .rpc();
  });

  it("deposits 10 LST and subscribes (mints the soulbound pass)", async () => {
    await program.methods
      .depositAndSubscribe(ONE.muln(10), dappId)
      .accounts({
        user: user.publicKey, config, dapp, lstConfig, userVault, lstMint,
        userLstAccount: userLst, vaultLstAccount: vaultLst, passMint, userPassAccount: userPass,
        tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const vault = await program.account.userVault.fetch(userVault);
    assert.equal(vault.depositedLst.toString(), ONE.muln(10).toString());
    assert.equal((await getAccount(conn, userPass, undefined, TOKEN_2022_PROGRAM_ID)).amount.toString(), "1");
    // free trial granted → access active immediately (verify_access does not throw).
    await program.methods.verifyAccess().accounts({ userVault, dapp }).rpc();
  });

  it("appreciates the LST, harvests yield, and routes it (protocol + dApp), principal preserved", async () => {
    // Fast-forward: rate 1.00 -> 1.10 (a year-plus of appreciation in one tx).
    await program.methods
      .updateLstRate(RATE_PRECISION.muln(110).divn(100))
      .accounts({ authority: payer.publicKey, config, lstConfig })
      .rpc();

    await program.methods
      .harvestYield()
      .accounts({
        cranker: payer.publicKey, config, dapp, lstConfig, userVault, lstMint,
        vaultLstAccount: vaultLst, protocolTreasuryAccount: protocolTreasury,
        dappTreasuryAccount: dappTreasury, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const dappBal = (await getAccount(conn, dappTreasury)).amount;
    const protoBal = (await getAccount(conn, protocolTreasury)).amount;
    // skim = 10 - 10/1.10 ≈ 0.909 LST; fee 4% to protocol, rest to dApp.
    assert.isTrue(dappBal > 0n && protoBal > 0n, "both treasuries received yield");
    assert.isTrue(dappBal > protoBal, "dApp receives the larger share");

    const vault = await program.account.userVault.fetch(userVault);
    // remaining LST is worth the original principal (10 SOL) at the new rate.
    assert.equal(vault.principalValue.toString(), ONE.muln(10).toString());
  });

  it("unsubscribes and withdraws the preserved principal", async () => {
    await program.methods.initiateUnsubscribe().accounts({ user: user.publicKey, userVault }).signers([user]).rpc();

    const before = (await getAccount(conn, userLst)).amount;
    await program.methods
      .withdraw()
      .accounts({
        user: user.publicKey, config, userVault, lstMint, vaultLstAccount: vaultLst,
        userLstAccount: userLst, passMint, userPassAccount: userPass,
        tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const after = (await getAccount(conn, userLst)).amount;
    assert.isTrue(after > before, "principal returned to the user");
    assert.equal((await getAccount(conn, userPass, undefined, TOKEN_2022_PROGRAM_ID)).amount.toString(), "0", "pass burned");
  });
});
