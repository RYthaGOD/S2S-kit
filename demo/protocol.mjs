// Pure-JS model of the S2S-Kit LST subscription vault, mirroring the on-chain
// math in stake_to_subscribe exactly (u64/u128 truncating integer arithmetic).
// Used by the runnable demo (lifecycle.mjs) and the conservation tests.

export const RATE_PRECISION = 1_000_000_000_000n; // 1e12, matches RATE_PRECISION in lib.rs
export const LST_DECIMALS = 9;
export const ONE_LST = 10n ** BigInt(LST_DECIMALS); // 1 LST in base units

/** value (underlying lamports) of `amount` LST at `rate`. Mirrors deposit_and_subscribe. */
export function lstToValue(amount, rate) {
  return (amount * rate) / RATE_PRECISION;
}

/** LST base units needed to back `value` at `rate`. Mirrors harvest_yield target_lst. */
export function valueToLst(value, rate) {
  return (value * RATE_PRECISION) / rate;
}

export class Protocol {
  constructor({ feeBps }) {
    this.feeBps = BigInt(feeBps);
    this.lsts = new Map();        // mint -> { rate }
    this.dapps = new Map();       // id   -> { minStakeValue, treasury: balance }
    this.vaults = new Map();      // user -> vault
    this.protocolTreasury = 0n;   // protocol's LST passive-income balance
    this.wallets = new Map();     // user -> external LST balance
  }

  addLst(mint, initialRate) { this.lsts.set(mint, { rate: BigInt(initialRate) }); }
  setRate(mint, rate) { this.lsts.get(mint).rate = BigInt(rate); }
  registerDapp(id, minStakeValue) { this.dapps.set(id, { minStakeValue: BigInt(minStakeValue), treasury: 0n }); }
  fundWallet(user, amount) { this.wallets.set(user, (this.wallets.get(user) ?? 0n) + BigInt(amount)); }

  depositAndSubscribe(user, mint, amount, dappId) {
    amount = BigInt(amount);
    const lst = this.lsts.get(mint);
    if (!lst) throw new Error("LstNotEnabled");
    const dapp = this.dapps.get(dappId);
    if (!dapp) throw new Error("DappMissing");

    const wallet = this.wallets.get(user) ?? 0n;
    if (wallet < amount) throw new Error("InsufficientFunds");
    this.wallets.set(user, wallet - amount); // pull LST into escrow

    const value = lstToValue(amount, lst.rate);
    let v = this.vaults.get(user);
    if (!v) {
      v = { user, mint, dappId, depositedLst: 0n, principalValue: 0n,
            cumulativeYieldSkimmed: 0n, protocolFeesContributed: 0n, hasPass: false };
      this.vaults.set(user, v);
    } else {
      if (v.mint !== mint) throw new Error("LstMintMismatch");
      if (v.dappId !== dappId) throw new Error("DappMismatch");
    }
    v.depositedLst += amount;
    v.principalValue += value;
    if (v.principalValue < dapp.minStakeValue) throw new Error("InsufficientStake");
    v.hasPass = true; // mint soulbound Active Pass
    return v;
  }

  /** Conservation-correct skim. Returns { skim, protocolFee, dappCut }. Mirrors harvest_yield. */
  harvest(user) {
    const v = this.vaults.get(user);
    const lst = this.lsts.get(v.mint);
    const target = valueToLst(v.principalValue, lst.rate);
    const skim = v.depositedLst > target ? v.depositedLst - target : 0n;
    if (skim === 0n) return { skim: 0n, protocolFee: 0n, dappCut: 0n };

    const protocolFee = (skim * this.feeBps) / 10_000n;
    const dappCut = skim - protocolFee;

    this.protocolTreasury += protocolFee;
    this.dapps.get(v.dappId).treasury += dappCut;
    v.depositedLst = target;
    v.cumulativeYieldSkimmed += skim;
    v.protocolFeesContributed += protocolFee;
    return { skim, protocolFee, dappCut };
  }

  /** Returns escrowed LST to the user and burns the pass. Mirrors withdraw. */
  withdraw(user) {
    const v = this.vaults.get(user);
    const returned = v.depositedLst;
    this.wallets.set(user, (this.wallets.get(user) ?? 0n) + returned);
    v.depositedLst = 0n;
    v.hasPass = false;
    this.vaults.delete(user);
    return returned;
  }

  /** Total LST across every location — must be invariant (no tokens created/destroyed). */
  totalLst() {
    let sum = this.protocolTreasury;
    for (const d of this.dapps.values()) sum += d.treasury;
    for (const w of this.wallets.values()) sum += w;
    for (const v of this.vaults.values()) sum += v.depositedLst;
    return sum;
  }
}

export const fmt = (base) => (Number(base) / Number(ONE_LST)).toFixed(4);
