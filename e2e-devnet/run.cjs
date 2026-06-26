// End-to-end lifecycle of S2S-Kit against the LIVE devnet deployment.
//   node e2e-devnet/run.cjs
// Uses the Windows-side Node (no WSL needed). Reads the deployed program's IDL
// (copied from anchor build) and the devnet wallet (copied out of WSL).
const anchor = require("@coral-xyz/anchor");
const { Program, AnchorProvider, Wallet, BN } = anchor;
const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint, getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync, mintTo, getAccount,
} = require("@solana/spl-token");
const fs = require("fs");
const path = require("path");

const idl = require("./idl.json");
const RATE = new BN("1000000000000"); // 1e12
const ONE = new BN(1_000_000_000);    // 1 token (9 dec)
const ex = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

(async () => {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(path.join(__dirname, "wallet.json")))));
  const provider = new AnchorProvider(conn, new Wallet(payer), { commitment: "confirmed" });
  const program = new Program(idl, provider);
  const programId = program.programId;
  console.log("program:", programId.toBase58());
  console.log("payer  :", payer.publicKey.toBase58(), "\n");

  // fresh-per-run identities so the script is repeatable
  const user = Keypair.generate();
  const protoOwner = Keypair.generate();
  const dappOwner = Keypair.generate();
  const dappId = Array.from(Keypair.generate().publicKey.toBuffer()); // random 32 bytes

  const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], programId);
  const [passMint] = PublicKey.findProgramAddressSync([Buffer.from("pass_mint")], programId);
  const [dapp] = PublicKey.findProgramAddressSync([Buffer.from("dapp"), Buffer.from(dappId)], programId);
  const [userVault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), user.publicKey.toBuffer()], programId);

  // fund the user a little SOL for rent + fees
  {
    const tx = new anchor.web3.Transaction().add(anchor.web3.SystemProgram.transfer({
      fromPubkey: payer.publicKey, toPubkey: user.publicKey, lamports: 0.15 * LAMPORTS_PER_SOL,
    }));
    await provider.sendAndConfirm(tx);
  }

  // 1. initialize protocol (idempotent: ignore if already live)
  try {
    const sig = await program.methods.initializeProtocol(0, payer.publicKey, new BN(0))
      .accounts({ config, passMint, authority: payer.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc();
    console.log("✓ initialize_protocol", ex(sig));
  } catch (e) {
    console.log("• protocol already initialized (reusing)");
  }

  // 2. demo LST (legacy SPL) + fund the user with 100
  const lstMint = await createMint(conn, payer, payer.publicKey, null, 9, undefined, undefined, TOKEN_PROGRAM_ID);
  const [lstConfig] = PublicKey.findProgramAddressSync([Buffer.from("lst"), lstMint.toBuffer()], programId);
  const userLst = (await getOrCreateAssociatedTokenAccount(conn, payer, lstMint, user.publicKey)).address;
  // protocol treasury must be owned by config.treasury (set to `payer` at init).
  const protoTreasury = (await getOrCreateAssociatedTokenAccount(conn, payer, lstMint, payer.publicKey)).address;
  const dappTreasury = (await getOrCreateAssociatedTokenAccount(conn, payer, lstMint, dappOwner.publicKey)).address;
  await mintTo(conn, payer, lstMint, userLst, payer, BigInt(ONE.muln(100).toString()));
  console.log("✓ demo LST minted:", lstMint.toBase58());

  // 3. allow-list the LST (manual rate 1.0) + register dApp (price 0.001 SOL/30d, 7d trial)
  await program.methods.addLst(0, RATE, PublicKey.default)
    .accounts({ authority: payer.publicKey, config, lstMint, lstConfig, systemProgram: SystemProgram.programId }).rpc();
  await program.methods.initializeDapp(dappId, dappOwner.publicKey, ONE, new BN(1_000_000), new BN(30 * 24 * 3600), new BN(7 * 24 * 3600))
    .accounts({ authority: payer.publicKey, config, dapp, systemProgram: SystemProgram.programId }).rpc();
  console.log("✓ add_lst + initialize_dapp");

  // 4. deposit 10 LST + subscribe (auto-mints pass, grants trial)
  const vaultLst = getAssociatedTokenAddressSync(lstMint, userVault, true);
  const userPass = getAssociatedTokenAddressSync(passMint, user.publicKey, false, TOKEN_2022_PROGRAM_ID);
  {
    const userProvider = new AnchorProvider(conn, new Wallet(user), { commitment: "confirmed" });
    const up = new Program(idl, userProvider);
    const sig = await up.methods.depositAndSubscribe(ONE.muln(10), dappId)
      .accounts({
        user: user.publicKey, config, dapp, lstConfig, userVault, lstMint,
        userLstAccount: userLst, vaultLstAccount: vaultLst, passMint, userPassAccount: userPass,
        tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([user]).rpc();
    console.log("✓ deposit_and_subscribe", ex(sig));
  }
  console.log("  pass balance:", (await getAccount(conn, userPass, undefined, TOKEN_2022_PROGRAM_ID)).amount.toString());
  await program.methods.verifyAccess().accounts({ userVault, dapp }).rpc();
  console.log("✓ verify_access OK (trial active)");

  // 5. simulate appreciation (rate 1.0 -> 1.1) then harvest
  await program.methods.updateLstRate(RATE.muln(110).divn(100)).accounts({ authority: payer.publicKey, config, lstConfig }).rpc();
  const sigH = await program.methods.harvestYield()
    .accounts({
      cranker: payer.publicKey, config, dapp, lstConfig, userVault, lstMint,
      vaultLstAccount: vaultLst, protocolTreasuryAccount: protoTreasury, dappTreasuryAccount: dappTreasury, tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
  console.log("✓ harvest_yield", ex(sigH));
  console.log("  dApp treasury:", (await getAccount(conn, dappTreasury)).amount.toString(), "| protocol:", (await getAccount(conn, protoTreasury)).amount.toString());

  // 6. unsubscribe + withdraw the preserved principal
  {
    const userProvider = new AnchorProvider(conn, new Wallet(user), { commitment: "confirmed" });
    const up = new Program(idl, userProvider);
    await up.methods.initiateUnsubscribe().accounts({ user: user.publicKey, userVault }).signers([user]).rpc();
    const before = (await getAccount(conn, userLst)).amount;
    const sigW = await up.methods.withdraw()
      .accounts({
        user: user.publicKey, config, userVault, lstMint, vaultLstAccount: vaultLst, userLstAccount: userLst,
        passMint, userPassAccount: userPass, tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).signers([user]).rpc();
    const after = (await getAccount(conn, userLst)).amount;
    console.log("✓ withdraw", ex(sigW), "| principal returned:", (after - before).toString(), "LST base units");
  }

  console.log("\n✅ end-to-end lifecycle succeeded on devnet.");
})().catch((e) => { console.error("\n❌", e); process.exit(1); });
