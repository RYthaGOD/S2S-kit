// Shared helpers for the S2S devnet demo backend (bootstrap, faucet, keeper).
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Program, AnchorProvider, Wallet, BN } = anchor;

export const __dir = dirname(fileURLToPath(import.meta.url));
export const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
export const RATE_PRECISION = new BN("1000000000000"); // 1e12
export const idl = JSON.parse(readFileSync(join(__dir, "idl.json"), "utf8"));
export const PROGRAM_ID = new PublicKey(idl.address);

/** Authority/cranker keypair: from env S2S_KEYPAIR (JSON array) or a local file. */
export function loadAuthority() {
  if (process.env.S2S_KEYPAIR) {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.S2S_KEYPAIR)));
  }
  const path = process.env.S2S_KEYPAIR_PATH || join(__dir, "..", "e2e-devnet", "wallet.json");
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(path, "utf8"))));
}

export function connection() {
  return new Connection(RPC_URL, "confirmed");
}

export function programFor(conn, keypair) {
  const provider = new AnchorProvider(conn, new Wallet(keypair), { commitment: "confirmed" });
  return new Program(idl, provider);
}

export function dappIdFromString(s) {
  const b = Buffer.alloc(32);
  Buffer.from(s).copy(b);
  return b;
}

export const seeds = {
  config: () => PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID)[0],
  passMint: () => PublicKey.findProgramAddressSync([Buffer.from("pass_mint")], PROGRAM_ID)[0],
  dapp: (idBuf) => PublicKey.findProgramAddressSync([Buffer.from("dapp"), Buffer.from(idBuf)], PROGRAM_ID)[0],
  lst: (mint) => PublicKey.findProgramAddressSync([Buffer.from("lst"), mint.toBuffer()], PROGRAM_ID)[0],
  vault: (user) => PublicKey.findProgramAddressSync([Buffer.from("vault"), user.toBuffer()], PROGRAM_ID)[0],
};

export const LIVE_CONFIG_PATH = join(__dir, "live-config.json");
export function readLiveConfig() {
  return existsSync(LIVE_CONFIG_PATH) ? JSON.parse(readFileSync(LIVE_CONFIG_PATH, "utf8")) : null;
}

export { anchor, BN };
