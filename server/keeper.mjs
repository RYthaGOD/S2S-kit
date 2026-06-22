// The keeper crank. On each tick it (1) bumps the demo LST's manual rate to simulate
// staking appreciation, then (2) harvests every live vault so the yield flows to the
// dApp/protocol and each subscriber's paid-through clock advances.
import { seeds, RATE_PRECISION, BN } from "./lib.mjs";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export async function keeperTick(program, authority, lc, log = console.log) {
  const demoLst = new PublicKey(lc.demoLstMint);
  const lstConfig = seeds.lst(demoLst);
  const config = seeds.config();
  const protocolTreasury = new PublicKey(lc.protocolTreasury);
  const dappTreasury = new PublicKey(lc.dappTreasury);

  // 1. simulate appreciation: +0.2% per tick (manual-rate demo LST).
  const cfg = await program.account.lstConfig.fetch(lstConfig);
  const newRate = cfg.rate.mul(new BN(1002)).div(new BN(1000));
  await program.methods.updateLstRate(newRate)
    .accounts({ authority: authority.publicKey, config, lstConfig }).rpc();

  // 2. harvest every vault holding this LST that actually has skimmable yield.
  const vaults = await program.account.userVault.all();
  let harvested = 0;
  for (const v of vaults) {
    const a = v.account;
    if (a.lstMint.toBase58() !== demoLst.toBase58()) continue;
    const target = a.principalValue.mul(RATE_PRECISION).div(newRate); // LST to back principal
    if (a.depositedLst.lte(target)) continue; // no yield yet
    const vaultLst = getAssociatedTokenAddressSync(demoLst, v.publicKey, true);
    try {
      await program.methods.harvestYield().accounts({
        cranker: authority.publicKey, config, dapp: a.dapp, lstConfig,
        userVault: v.publicKey, lstMint: demoLst, vaultLstAccount: vaultLst,
        protocolTreasuryAccount: protocolTreasury, dappTreasuryAccount: dappTreasury,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      harvested++;
    } catch (e) {
      log("  harvest skip", v.publicKey.toBase58().slice(0, 6), String(e.message || e).slice(0, 80));
    }
  }
  return { rate: Number(newRate.toString()) / 1e12, vaults: vaults.length, harvested };
}

export function startKeeper(program, authority, lc, intervalMs = 20000, log = console.log) {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await keeperTick(program, authority, lc, log);
      log(`keeper: rate=${r.rate.toFixed(4)} vaults=${r.vaults} harvested=${r.harvested}`);
    } catch (e) {
      log("keeper error:", String(e.message || e).slice(0, 120));
    } finally {
      busy = false;
    }
  };
  run();
  return setInterval(run, intervalMs);
}
