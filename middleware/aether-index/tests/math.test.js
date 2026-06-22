// Conservation + correctness tests for the harvest_yield skim math.
// Mirrors the on-chain integer arithmetic in harvest_yield.rs (u64/u128, truncating).
//   node middleware/aether-index/tests/math.test.js
"use strict";

const RATE_PRECISION = 1_000_000_000_000n; // 1e12

const lstToValue = (amount, rate) => (amount * rate) / RATE_PRECISION;
const valueToLst = (value, rate) => (value * RATE_PRECISION) / rate;

/** One harvest. Returns { skim, fee, dappCut, newDeposited }. */
function harvest(depositedLst, principalValue, rate, feeBps) {
  const target = valueToLst(principalValue, rate);
  const skim = depositedLst > target ? depositedLst - target : 0n;
  const fee = (skim * BigInt(feeBps)) / 10_000n;
  const dappCut = skim - fee;
  return { skim, fee, dappCut, newDeposited: depositedLst - skim };
}

let failures = 0;
function assert(label, cond) {
  if (cond) { console.log(`✅ ${label}`); } else { console.log(`❌ ${label}`); failures++; }
}

// 1. Fee + dApp cut always equal the skim (no value leaks in the split).
{
  const dep = 100_000_000_000n; // 100 LST
  const principal = lstToValue(dep, 1_050_000_000_000n); // deposited at 1.05
  const { skim, fee, dappCut } = harvest(dep, principal, 1_120_000_000_000n, 400);
  assert("split conserves: fee + dappCut == skim", fee + dappCut === skim);
  assert("fee is 4% of skim", fee === (skim * 400n) / 10_000n);
}

// 2. Principal is preserved: remaining LST is worth >= the original principal value.
{
  const depositRate = 1_000_000_000_000n; // 1.00
  const dep = 250_000_000_000n;            // 250 LST
  const principal = lstToValue(dep, depositRate); // 250 SOL
  let deposited = dep;
  for (const r of [1_010_000_000_000n, 1_037_000_000_000n, 1_111_000_000_000n]) {
    deposited = harvest(deposited, principal, r, 350).newDeposited;
    const valueNow = lstToValue(deposited, r);
    // value of remaining LST should never fall below principal (allow 1 base-unit truncation).
    assert(`principal preserved at rate ${r}`, valueNow + 1n >= principal);
  }
}

// 3. No appreciation → nothing is skimmed (and a rate drop never touches principal).
{
  const dep = 77_000_000_000n;
  const principal = lstToValue(dep, 1_100_000_000_000n); // deposited at 1.10
  assert("flat rate skims nothing", harvest(dep, principal, 1_100_000_000_000n, 500).skim === 0n);
  assert("rate drop skims nothing", harvest(dep, principal, 1_050_000_000_000n, 500).skim === 0n);
}

// 4. Randomized conservation: across many deposits/rate paths, total LST is invariant.
{
  let ok = true;
  let rng = 123456789n;
  const rand = (n) => { rng = (rng * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); return rng % n; };
  for (let trial = 0; trial < 2000; trial++) {
    const dep = 1_000_000n + rand(500_000_000_000n);
    let rate = RATE_PRECISION + rand(200_000_000_000n); // 1.00 .. 1.20
    const principal = lstToValue(dep, rate);
    let deposited = dep, treasury = 0n, dappT = 0n;
    for (let e = 0; e < 5; e++) {
      rate += rand(50_000_000_000n); // monotonic appreciation
      const { fee, dappCut, newDeposited } = harvest(deposited, principal, rate, 300);
      treasury += fee; dappT += dappCut; deposited = newDeposited;
    }
    if (treasury + dappT + deposited !== dep) { ok = false; break; }
  }
  assert("randomized conservation over 2000 paths: treasury + dApp + vault == deposited", ok);
}

console.log(failures === 0 ? "\nAll math tests passed." : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
