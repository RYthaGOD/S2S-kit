// Verifies the live burner lifecycle against the PERSISTENT demo (what the frontend does):
// fund a burner → deposit & subscribe → keeper harvest → withdraw.
import { connection, programFor, loadAuthority, readLiveConfig, seeds, RATE_PRECISION, BN } from "./lib.mjs";
import { keeperTick } from "./keeper.mjs";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync, mintTo, getAccount,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";

const lc = readLiveConfig();
const conn = connection();
const authority = loadAuthority();
const burner = Keypair.generate();
const lstMint = new PublicKey(lc.demoLstMint);
const dappId = Array.from(Buffer.from(lc.dappIdHex, "hex"));

(async () => {
  console.log("burner:", burner.publicKey.toBase58());
  // 1. fund the burner (faucet equivalent)
  await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({
    fromPubkey: authority.publicKey, toPubkey: burner.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })), [authority]);
  const userLst = (await getOrCreateAssociatedTokenAccount(conn, authority, lstMint, burner.publicKey)).address;
  await mintTo(conn, authority, lstMint, userLst, authority, BigInt(20e9));
  console.log("✓ funded burner: 0.05 SOL + 20 demoSOL");

  // 2. deposit & subscribe as the burner (frontend logic)
  const program = programFor(conn, burner);
  const config = seeds.config(), lstConfig = seeds.lst(lstMint), userVault = seeds.vault(burner.publicKey);
  const dapp = new PublicKey(lc.dapp), passMint = new PublicKey(lc.passMint);
  const vaultLst = getAssociatedTokenAddressSync(lstMint, userVault, true);
  const userPass = getAssociatedTokenAddressSync(passMint, burner.publicKey, false, TOKEN_2022_PROGRAM_ID);

  await program.methods.depositAndSubscribe(new BN(6e9), dappId).accounts({
    user: burner.publicKey, config, dapp, lstConfig, userVault, lstMint,
    userLstAccount: userLst, vaultLstAccount: vaultLst, passMint, userPassAccount: userPass,
    tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }).rpc();
  await program.methods.verifyAccess().accounts({ userVault, dapp }).rpc();
  console.log("✓ deposited 6 demoSOL + subscribed (trial active, pass minted)");

  // 3. keeper harvests (bump rate + skim)
  const authProgram = programFor(conn, authority);
  await keeperTick(authProgram, authority, lc, () => {});
  await keeperTick(authProgram, authority, lc, () => {});
  const v = await authProgram.account.userVault.fetch(userVault);
  const earned = Number((await getAccount(conn, new PublicKey(lc.dappTreasury))).amount) / 1e9;
  console.log(`✓ keeper harvested → vault LST ${(Number(v.depositedLst)/1e9).toFixed(4)}, paid_through ${new Date(Number(v.paidThrough)*1000).toISOString().slice(0,10)}, dApp treasury ${earned.toFixed(4)} demoSOL`);

  // 4. withdraw principal
  await program.methods.initiateUnsubscribe().accounts({ user: burner.publicKey, userVault }).rpc();
  await program.methods.withdraw().accounts({
    user: burner.publicKey, config, userVault, lstMint, vaultLstAccount: vaultLst, userLstAccount: userLst,
    passMint, userPassAccount: userPass, tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }).rpc();
  const back = Number((await getAccount(conn, userLst)).amount) / 1e9;
  console.log(`✓ withdrew — burner now holds ${back.toFixed(4)} demoSOL (principal preserved)`);
  console.log("\n✅ live burner lifecycle works against the persistent demo.");
})().catch((e) => { console.error("❌", e.message || e); process.exit(1); });
