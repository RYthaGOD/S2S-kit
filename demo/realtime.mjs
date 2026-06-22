// Real-time, accelerated demo of S2S-Kit — screen-recordable, no chain, no deps.
//   node demo/realtime.mjs
//
// Real LST yield accrues slowly (~7% APY), so a live demo would show nothing for
// weeks. Because the LST `rate` is a value the protocol authority controls in v1,
// we fast-forward time: each frame is one "month" and the rate ticks up. You watch
// the appreciation get harvested into the protocol + dApp treasuries in real time,
// while the user's principal stays untouched.

import { Protocol, lstToValue, ONE_LST, RATE_PRECISION, fmt } from "./protocol.mjs";

const rate = (x) => BigInt(Math.round(x * Number(RATE_PRECISION)));
const lst = (x) => BigInt(Math.round(x * Number(ONE_LST)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- scenario ---
const APY = 0.074;                 // ~7.4% — a touch above market for a lively demo
const MONTHLY = APY / 12;          // rate increase per simulated month
const MONTHS = 24;                 // 2 years compressed into ~8 seconds
const FRAME_MS = 320;
const SUB_PRICE_PER_DAY = 0.001;   // a 0.03 SOL / 30-day subscription
const DEPOSIT = 6;                 // ~6 SOL: just above the break-even (~5 SOL) for this sub

const p = new Protocol({ feeBps: 400 }); // 4% protocol cut (0 in production by default)
p.addLst("demoSOL", rate(1.0));
p.registerDapp("chat-app", lst(1));
p.fundWallet("alice", lst(DEPOSIT));
p.depositAndSubscribe("alice", "demoSOL", lst(DEPOSIT), "chat-app");
const v = p.vaults.get("alice");
const startTotal = p.totalLst();

// --- terminal rendering (ANSI redraw of a fixed block) ---
const LINES = 11;
let drawn = false;
function draw(rows) {
  if (drawn) process.stdout.write(`\x1b[${LINES}A`);
  for (const row of rows) process.stdout.write(`\x1b[2K${row}\n`);
  drawn = true;
}
const bar = (frac, width = 24) => {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return "█".repeat(n) + "░".repeat(width - n);
};

console.log("\nS2S-Kit — live yield routing (accelerated: 1 frame = 1 month)\n");

let currentRate = 1.0;
for (let month = 1; month <= MONTHS; month++) {
  currentRate *= 1 + MONTHLY;
  p.setRate("demoSOL", rate(currentRate));
  p.harvest("alice"); // the keeper crank

  const r = rate(currentRate);
  const principalNow = lstToValue(v.depositedLst, r);
  const dappValue = lstToValue(p.dapps.get("chat-app").treasury, r);
  const protoValue = lstToValue(p.protocolTreasury, r);
  const daysFunded = Number(dappValue) / Number(ONE_LST) / SUB_PRICE_PER_DAY;
  const daysElapsed = month * 30;
  const sustainable = daysFunded >= daysElapsed;

  draw([
    `  month ${String(month).padStart(2)}/${MONTHS}   demoSOL rate ${currentRate.toFixed(4)}  ${bar((currentRate - 1) / (APY * 2))}`,
    ``,
    `  alice principal     ${fmt(principalNow).padStart(9)} SOL   (locked, untouched)`,
    `  alice LST held      ${fmt(v.depositedLst).padStart(9)} demoSOL`,
    `  yield skimmed (life) ${fmt(v.cumulativeYieldSkimmed).padStart(8)} demoSOL`,
    ``,
    `  → dApp treasury     ${fmt(p.dapps.get("chat-app").treasury).padStart(9)} demoSOL  (~${fmt(dappValue)} SOL)`,
    `  → protocol treasury ${fmt(p.protocolTreasury).padStart(9)} demoSOL  (~${fmt(protoValue)} SOL)`,
    ``,
    `  subscription @ 0.03 SOL/mo  →  yield funded ${daysFunded.toFixed(0)} days vs ${daysElapsed} elapsed`,
    `  ${sustainable ? "  ✅ sustainable — yield covers the sub with buffer" : "  ⚠ shortfall — needs more principal"}`,
  ]);
  await sleep(FRAME_MS);
}

// --- close out: alice withdraws her preserved principal ---
const back = p.withdraw("alice");
const endTotal = p.totalLst();
console.log("");
console.log(`  alice withdraws ${fmt(back)} demoSOL  =  ${fmt(lstToValue(back, rate(currentRate)))} SOL  (her original ${DEPOSIT.toFixed(4)} SOL principal)`);
console.log(`  fund conservation: ${endTotal === startTotal ? "✅ held" : "❌ BROKEN"} (no demoSOL created or destroyed)`);
console.log("");
console.log("  The principal never moved. Only the appreciation did — and it paid the dApp (and a small protocol cut) the whole time.\n");
process.exit(endTotal === startTotal ? 0 : 1);
