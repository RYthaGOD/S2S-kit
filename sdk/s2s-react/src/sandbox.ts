// Dependency-free, in-memory model of the S2S vault — powers the SDK's `sandbox`
// mode so a developer can trial the full flow with no wallet, no chain, no money.
//
// It mirrors the on-chain math (harvest_yield skim + the proposed paid_through
// billing clock). Values are plain numbers (a UI approximation); the canonical,
// conservation-proven integer math lives in demo/protocol.mjs.

export type S2SStatus = "LOADING" | "UNSUBSCRIBED" | "TRIAL" | "ACTIVE" | "EXPIRED" | "COOLDOWN";

export interface SandboxOptions {
  feeBps?: number;          // protocol cut of yield (production default 0)
  apy?: number;             // LST staking APY, e.g. 0.074
  trialDays?: number;       // free-trial grace granted on subscribe / startTrial
  priceSolPerMonth?: number;// the dApp's subscription price, in SOL value
}

export interface SandboxState {
  status: S2SStatus;
  hasAccess: boolean;
  rate: number;             // LST exchange rate (SOL per LST)
  monthsElapsed: number;
  principalSol: number;     // preserved principal value
  depositedLst: number;     // LST still escrowed
  dappTreasuryLst: number;  // yield routed to the dApp
  protocolTreasuryLst: number;
  daysFunded: number;       // trial + yield-funded access, in days
  daysElapsed: number;      // since subscribe
}

const DEFAULTS: Required<SandboxOptions> = {
  feeBps: 0,
  apy: 0.074,
  trialDays: 7,
  priceSolPerMonth: 0.03,
};

export class Sandbox {
  private o: Required<SandboxOptions>;
  private rate = 1.0;
  private monthsElapsed = 0;
  private subscribed = false;
  private coolingDown = false;
  private depositedLst = 0;
  private principalSol = 0;
  private dappTreasuryLst = 0;
  private protocolTreasuryLst = 0;
  private subscribedAtDay = 0;
  private yieldFundedDays = 0;

  constructor(opts: SandboxOptions = {}) {
    this.o = { ...DEFAULTS, ...opts };
  }

  private get daysElapsedTotal() {
    return this.monthsElapsed * 30;
  }
  private get daysSinceSub() {
    return this.daysElapsedTotal - this.subscribedAtDay;
  }
  private get coverageDays() {
    return this.o.trialDays + this.yieldFundedDays;
  }

  /** Deposit `amountLst` and subscribe (grants the free trial immediately). */
  subscribe(amountLst: number) {
    this.depositedLst = amountLst;
    this.principalSol = amountLst * this.rate;
    this.subscribed = true;
    this.coolingDown = false;
    this.subscribedAtDay = this.daysElapsedTotal;
    this.yieldFundedDays = 0;
  }

  /** Start a no-deposit free trial — access for `trialDays`, then deposit to keep it. */
  startTrial() {
    this.subscribe(0);
  }

  /** Advance one accelerated "month": the LST appreciates, then the crank harvests. */
  tick() {
    if (!this.subscribed || this.coolingDown) return;
    this.monthsElapsed += 1;
    this.rate *= 1 + this.o.apy / 12;
    this.harvest();
  }

  private harvest() {
    const target = this.principalSol / this.rate; // LST needed to back principal
    const skim = Math.max(0, this.depositedLst - target);
    if (skim <= 0) return;
    const fee = (skim * this.o.feeBps) / 10000;
    const dappCut = skim - fee;
    this.protocolTreasuryLst += fee;
    this.dappTreasuryLst += dappCut;
    this.depositedLst = target;
    const dappCutSol = dappCut * this.rate;
    this.yieldFundedDays += dappCutSol / (this.o.priceSolPerMonth / 30);
  }

  unsubscribe() {
    if (this.subscribed) this.coolingDown = true;
  }

  /** Reclaim the escrowed LST principal and reset. Returns LST returned. */
  withdraw() {
    const back = this.depositedLst;
    this.depositedLst = 0;
    this.subscribed = false;
    this.coolingDown = false;
    return back;
  }

  state(): SandboxState {
    const hasAccess =
      this.subscribed && !this.coolingDown && this.coverageDays >= this.daysSinceSub;
    let status: S2SStatus;
    if (!this.subscribed) status = "UNSUBSCRIBED";
    else if (this.coolingDown) status = "COOLDOWN";
    else if (!hasAccess) status = "EXPIRED";
    else if (this.daysSinceSub < this.o.trialDays) status = "TRIAL";
    else status = "ACTIVE";

    return {
      status,
      hasAccess,
      rate: this.rate,
      monthsElapsed: this.monthsElapsed,
      principalSol: this.principalSol,
      depositedLst: this.depositedLst,
      dappTreasuryLst: this.dappTreasuryLst,
      protocolTreasuryLst: this.protocolTreasuryLst,
      daysFunded: this.coverageDays,
      daysElapsed: this.daysSinceSub,
    };
  }
}
