// Runnable check for the sandbox engine (Node strips the TS types):
//   node sdk/s2s-react/src/sandbox.test.ts
import { Sandbox } from "./sandbox.ts";

let fails = 0;
const ok = (label: string, cond: boolean) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  if (!cond) fails++;
};

// 1. Deposit subscribe → instant access, principal preserved through harvests.
{
  const s = new Sandbox({ feeBps: 400, trialDays: 7, priceSolPerMonth: 0.03 });
  s.subscribe(6);
  ok("subscribe grants access immediately", s.state().hasAccess);
  for (let i = 0; i < 24; i++) s.tick();
  const st = s.state();
  ok("still has access after 2 years", st.hasAccess);
  ok("status is ACTIVE (yield carries it)", st.status === "ACTIVE");
  ok("principal preserved (~6 SOL)", Math.abs(st.principalSol - 6) < 1e-6);
  const back = s.withdraw();
  ok("withdraw returns principal-worth of LST", back * st.rate > 5.99);
  // conservation: returned + treasuries == original deposit
  ok("fund conservation holds", Math.abs(back + st.dappTreasuryLst + st.protocolTreasuryLst - 6) < 1e-6);
}

// 2. No-deposit free trial → access during trial, lapses after, no yield.
{
  const s = new Sandbox({ trialDays: 7, apy: 0.074, priceSolPerMonth: 0.03 });
  s.startTrial();
  ok("trial grants access", s.state().hasAccess && s.state().status === "TRIAL");
  s.tick(); // +30 days, well past the 7-day trial, zero yield
  const st = s.state();
  ok("trial lapses to EXPIRED once it runs out with no deposit", st.status === "EXPIRED" && !st.hasAccess);
}

// 3. Under-funded deposit eventually lapses; well-funded stays ACTIVE.
{
  const small = new Sandbox({ trialDays: 0, apy: 0.074, priceSolPerMonth: 0.03 });
  small.subscribe(1); // ~1 SOL: yield << price, should fall behind
  for (let i = 0; i < 24; i++) small.tick();
  ok("under-funded sub falls behind (EXPIRED)", small.state().status === "EXPIRED");

  const big = new Sandbox({ trialDays: 0, apy: 0.074, priceSolPerMonth: 0.03 });
  big.subscribe(8); // comfortably above break-even (~5 SOL)
  for (let i = 0; i < 24; i++) big.tick();
  ok("well-funded sub stays ACTIVE", big.state().status === "ACTIVE");
}

console.log(fails === 0 ? "\nSandbox engine OK." : `\n${fails} check(s) FAILED.`);
process.exit(fails === 0 ? 0 : 1);
