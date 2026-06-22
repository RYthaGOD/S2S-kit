import express from "express";
import cors from "cors";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, mintTo,
} from "@solana/spl-token";
import {
  connection, programFor, loadAuthority, readLiveConfig, __dir,
} from "./lib.mjs";
import { startKeeper } from "./keeper.mjs";

const PORT = process.env.PORT || 8080;
const FAUCET_SOL = 0.05;
const FAUCET_LST = 20;
const FAUCET_MAX_PER_HOUR = Number(process.env.FAUCET_MAX_PER_HOUR || 80);

const lc = readLiveConfig();
if (!lc) { console.error("No live-config.json — run `node bootstrap.mjs` first."); process.exit(1); }

const conn = connection();
// The faucet + keeper need a funded authority key (set S2S_KEYPAIR in the host env).
// Without it the site still serves: sandbox demo + read-only live panel work; only the
// live burner faucet is disabled.
let authority = null, program = null;
try { authority = loadAuthority(); program = programFor(conn, authority); }
catch { console.warn("⚠ no S2S_KEYPAIR configured — faucet + keeper disabled (read-only demo)."); }
const demoLst = new PublicKey(lc.demoLstMint);

const app = express();
app.use(cors());
app.use(express.json());

// public demo config for the frontend
app.get("/api/config", (_req, res) => res.json(lc));
app.get("/api/health", (_req, res) => res.json({ ok: true, faucetEnabled: !!authority, authority: authority ? authority.publicKey.toBase58() : null }));

// simple global rate limit so the faucet wallet can't be drained
const hits = [];
const served = new Set();
app.post("/api/faucet", async (req, res) => {
  if (!authority) return res.status(503).json({ error: "faucet not configured (set S2S_KEYPAIR)" });
  try {
    const pubkey = new PublicKey(req.body.pubkey);
    const now = Date.now();
    while (hits.length && now - hits[0] > 3600_000) hits.shift();
    if (hits.length >= FAUCET_MAX_PER_HOUR) return res.status(429).json({ error: "faucet busy, try later" });
    if (served.has(pubkey.toBase58())) return res.json({ ok: true, note: "already funded" });

    hits.push(now);
    served.add(pubkey.toBase58());

    const tx = new Transaction().add(SystemProgram.transfer({
      fromPubkey: authority.publicKey, toPubkey: pubkey, lamports: FAUCET_SOL * LAMPORTS_PER_SOL,
    }));
    await sendAndConfirmTransaction(conn, tx, [authority]);

    const ata = await getOrCreateAssociatedTokenAccount(conn, authority, demoLst, pubkey);
    await mintTo(conn, authority, demoLst, ata.address, authority, BigInt(FAUCET_LST * 1e9));

    res.json({ ok: true, sol: FAUCET_SOL, lst: FAUCET_LST, mint: demoLst.toBase58() });
  } catch (e) {
    console.error("faucet error:", e.message || e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

// serve the built frontend (SPA)
const dist = join(__dir, "..", "frontend", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(join(dist, "index.html")));
} else {
  console.warn("frontend/dist not found — API only");
}

app.listen(PORT, () => {
  console.log(`S2S server on :${PORT}${authority ? ` (authority ${authority.publicKey.toBase58()})` : " (read-only)"}`);
  if (authority && process.env.ENABLE_KEEPER !== "false") {
    startKeeper(program, authority, lc, Number(process.env.KEEPER_INTERVAL_MS || 20000));
  }
});
