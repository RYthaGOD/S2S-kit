// One-time devnet bootstrap: ensure protocol is initialized, create a PERSISTENT demo
// LST + dApp the live demo reuses, and write live-config.json.
//   node bootstrap.mjs
import {
  connection, programFor, loadAuthority, seeds, dappIdFromString, RATE_PRECISION,
  LIVE_CONFIG_PATH, readLiveConfig, PROGRAM_ID, BN,
} from "./lib.mjs";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { writeFileSync } from "node:fs";

const DAPP_NAME = "s2s-live-demo";
const ONE = new BN(1_000_000_000);

(async () => {
  const conn = connection();
  const authority = loadAuthority();
  const program = programFor(conn, authority);
  const config = seeds.config();
  const passMint = seeds.passMint();
  console.log("authority:", authority.publicKey.toBase58());

  // 1. protocol (idempotent)
  try {
    await program.methods.initializeProtocol(0, authority.publicKey, new BN(0))
      .accounts({ config, passMint, authority: authority.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId })
      .rpc();
    console.log("✓ protocol initialized");
  } catch { console.log("• protocol already initialized"); }

  // 2. persistent demo LST (reuse if already created)
  const prev = readLiveConfig();
  let demoLst;
  if (prev?.demoLstMint && (await conn.getAccountInfo(new PublicKey(prev.demoLstMint)))) {
    demoLst = new PublicKey(prev.demoLstMint);
    console.log("• reusing demo LST", demoLst.toBase58());
  } else {
    demoLst = await createMint(conn, authority, authority.publicKey, null, 9, undefined, undefined, TOKEN_PROGRAM_ID);
    console.log("✓ demo LST created", demoLst.toBase58());
  }
  const lstConfig = seeds.lst(demoLst);

  // 3. allow-list it (manual rate 1.0), idempotent
  try {
    await program.methods.addLst(0, RATE_PRECISION, PublicKey.default)
      .accounts({ authority: authority.publicKey, config, lstMint: demoLst, lstConfig, systemProgram: SystemProgram.programId }).rpc();
    console.log("✓ LST allow-listed");
  } catch { console.log("• LST already allow-listed"); }

  // 4. treasuries (authority-owned ATAs for the demo LST)
  const protocolTreasury = (await getOrCreateAssociatedTokenAccount(conn, authority, demoLst, authority.publicKey)).address;

  // 5. persistent dApp (fixed id), price 0.001 SOL / 30d, 7-day trial, idempotent
  const dappIdBuf = dappIdFromString(DAPP_NAME);
  const dapp = seeds.dapp(dappIdBuf);
  try {
    await program.methods.initializeDapp(Array.from(dappIdBuf), authority.publicKey, ONE, new BN(1_000_000), new BN(30 * 24 * 3600), new BN(7 * 24 * 3600))
      .accounts({ authority: authority.publicKey, config, dapp, systemProgram: SystemProgram.programId }).rpc();
    console.log("✓ dApp registered");
  } catch { console.log("• dApp already registered"); }
  const dappTreasury = protocolTreasury; // same owner (authority) for the demo

  const liveConfig = {
    programId: PROGRAM_ID.toBase58(),
    rpc: process.env.RPC_URL || "https://api.devnet.solana.com",
    demoLstMint: demoLst.toBase58(),
    demoLstSymbol: "demoSOL",
    dappName: DAPP_NAME,
    dappIdHex: Buffer.from(dappIdBuf).toString("hex"),
    dapp: dapp.toBase58(),
    passMint: passMint.toBase58(),
    config: config.toBase58(),
    treasury: authority.publicKey.toBase58(),
    protocolTreasury: protocolTreasury.toBase58(),
    dappTreasury: dappTreasury.toBase58(),
  };
  writeFileSync(LIVE_CONFIG_PATH, JSON.stringify(liveConfig, null, 2));
  console.log("\n✅ wrote live-config.json\n", liveConfig);
})().catch((e) => { console.error("❌", e); process.exit(1); });
