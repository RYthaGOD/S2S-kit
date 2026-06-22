// Runnable end-to-end demo of the S2S-Kit LST subscription vault.
//   node demo/lifecycle.mjs
// No dependencies, no chain, no deployment — it runs the same math the on-chain
// program runs and prints a ledger proving (a) fund conservation, (b) user
// principal preservation, and (c) the protocol's passive-income stream.

import { Protocol, lstToValue, valueToLst, ONE_LST, RATE_PRECISION, fmt } from "./protocol.mjs";

const rate = (x) => BigInt(Math.round(x * Number(RATE_PRECISION))); // 1.07 -> 1.07e12
const lst = (x) => BigInt(Math.round(x * Number(ONE_LST)));         // 100  -> 100e9

const line = () => console.log("─".repeat(64));
let failures = 0;
function check(label, cond) {
  console.log(`   ${cond ? "✅" : "❌"} ${label}`);
  if (!cond) failures++;
}

console.log("\nS2S-Kit — LST Subscription Vault — lifecycle demo\n");

// --- Setup: 4% protocol cut, one LST (jitoSOL @ 1.05), one dApp ---------------
const p = new Protocol({ feeBps: 400 });
p.addLst("jitoSOL", rate(1.05));        // 1 jitoSOL currently = 1.05 SOL
p.registerDapp("chat-app", lst(1));     // needs >= 1 SOL of principal value
p.fundWallet("alice", lst(100));
p.fundWallet("bob", lst(40));

console.log("Config:   protocol fee = 4%   |   LST = jitoSOL @ 1.0500   |   dApp = chat-app");
const startTotal = p.totalLst();
console.log(`Float:    total jitoSOL in the system = ${fmt(startTotal)}\n`);

// --- Users deposit & subscribe -----------------------------------------------
const av = p.depositAndSubscribe("alice", "jitoSOL", lst(100), "chat-app");
const bv = p.depositAndSubscribe("bob", "jitoSOL", lst(40), "chat-app");
line();
console.log("DEPOSIT");
console.log(`   alice deposits 100.0000 jitoSOL  → principal value ${fmt(av.principalValue)} SOL, soulbound pass minted`);
console.log(`   bob   deposits  40.0000 jitoSOL  → principal value ${fmt(bv.principalValue)} SOL, soulbound pass minted`);

// --- Time passes: jitoSOL appreciates as staking rewards accrue ---------------
const epochs = [1.06, 1.075, 1.09, 1.11];
line();
console.log("HARVEST (crank skims appreciation each epoch)");
console.log("   epoch  rate     alice→proto  alice→dApp   bob→proto  bob→dApp");
for (const r of epochs) {
  p.setRate("jitoSOL", rate(r));
  const a = p.harvest("alice");
  const b = p.harvest("bob");
  console.log(
    `   ${r.toFixed(3)}  ${r.toFixed(4)}   ${fmt(a.protocolFee).padStart(8)}    ${fmt(a.dappCut).padStart(8)}   ` +
    `${fmt(b.protocolFee).padStart(8)}   ${fmt(b.dappCut).padStart(8)}`
  );
}

// --- Where the money is now ---------------------------------------------------
const finalRate = rate(1.11);
line();
console.log("LEDGER (after harvesting up to rate 1.1100)");
console.log(`   protocol treasury : ${fmt(p.protocolTreasury).padStart(9)} jitoSOL   ← passive income`);
console.log(`   chat-app treasury : ${fmt(p.dapps.get("chat-app").treasury).padStart(9)} jitoSOL   ← pays for users' access`);
console.log(`   alice vault       : ${fmt(av.depositedLst).padStart(9)} jitoSOL   (= ${fmt(lstToValue(av.depositedLst, finalRate))} SOL principal)`);
console.log(`   bob   vault       : ${fmt(bv.depositedLst).padStart(9)} jitoSOL   (= ${fmt(lstToValue(bv.depositedLst, finalRate))} SOL principal)`);

// --- Users unsubscribe & withdraw their preserved principal -------------------
const aliceBack = p.withdraw("alice");
const bobBack = p.withdraw("bob");
line();
console.log("WITHDRAW");
console.log(`   alice receives ${fmt(aliceBack)} jitoSOL  (worth ${fmt(lstToValue(aliceBack, finalRate))} SOL — her original 105.0000 principal)`);
console.log(`   bob   receives ${fmt(bobBack)} jitoSOL  (worth ${fmt(lstToValue(bobBack, finalRate))} SOL — his original 42.0000 principal)`);

// --- Invariants ---------------------------------------------------------------
line();
console.log("INVARIANTS");
const endTotal = p.totalLst();
check("fund conservation: no jitoSOL created or destroyed", endTotal === startTotal);
check("alice principal preserved (>= 105 SOL of value returned)", lstToValue(aliceBack, finalRate) >= lst(105) - 2n);
check("bob principal preserved (>= 42 SOL of value returned)", lstToValue(bobBack, finalRate) >= lst(42) - 2n);
check("protocol earned a positive cut", p.protocolTreasury > 0n);
check("dApp received the larger share (fee is small)", p.dapps.get("chat-app").treasury > p.protocolTreasury);

line();
console.log(failures === 0
  ? "\nAll invariants hold. Users kept their principal; the appreciation paid the dApp and the protocol. ✅\n"
  : `\n${failures} invariant(s) FAILED. ❌\n`);
process.exit(failures === 0 ? 0 : 1);
