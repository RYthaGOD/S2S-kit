// In-memory model of the S2S vault for the instant (no-wallet) demo.
// Identical to the verified engine in sdk/s2s-react/src/sandbox.ts.

export type S2SStatus = "UNSUBSCRIBED" | "TRIAL" | "ACTIVE" | "EXPIRED" | "COOLDOWN";

export interface SandboxOptions {
  feeBps?: number;
  apy?: number;
  trialDays?: number;
  priceSolPerMonth?: number;
}

export interface SandboxState {
  status: S2SStatus;
  hasAccess: boolean;
  rate: number;
  monthsElapsed: number;
  principalSol: number;
  depositedLst: number;
  dappTreasuryLst: number;
  protocolTreasuryLst: number;
  daysFunded: number;
  daysElapsed: number;
}

const DEFAULTS: Required<SandboxOptions> = { feeBps: 400, apy: 0.074, trialDays: 7, priceSolPerMonth: 0.03 };

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

  constructor(opts: SandboxOptions = {}) { this.o = { ...DEFAULTS, ...opts }; }

  private get daysElapsedTotal() { return this.monthsElapsed * 30; }
  private get daysSinceSub() { return this.daysElapsedTotal - this.subscribedAtDay; }
  private get coverageDays() { return this.o.trialDays + this.yieldFundedDays; }

  subscribe(amountLst: number) {
    this.depositedLst = amountLst;
    this.principalSol = amountLst * this.rate;
    this.subscribed = true;
    this.coolingDown = false;
    this.subscribedAtDay = this.daysElapsedTotal;
    this.yieldFundedDays = 0;
  }
  startTrial() { this.subscribe(0); }

  tick() {
    if (!this.subscribed || this.coolingDown) return;
    this.monthsElapsed += 1;
    this.rate *= 1 + this.o.apy / 12;
    this.harvest();
  }

  private harvest() {
    const target = this.principalSol / this.rate;
    const skim = Math.max(0, this.depositedLst - target);
    if (skim <= 0) return;
    const fee = (skim * this.o.feeBps) / 10000;
    const dappCut = skim - fee;
    this.protocolTreasuryLst += fee;
    this.dappTreasuryLst += dappCut;
    this.depositedLst = target;
    this.yieldFundedDays += (dappCut * this.rate) / (this.o.priceSolPerMonth / 30);
  }

  unsubscribe() { if (this.subscribed) this.coolingDown = true; }
  withdraw() {
    const back = this.depositedLst;
    this.depositedLst = 0; this.subscribed = false; this.coolingDown = false;
    return back;
  }

  state(): SandboxState {
    const hasAccess = this.subscribed && !this.coolingDown && this.coverageDays >= this.daysSinceSub;
    let status: S2SStatus;
    if (!this.subscribed) status = "UNSUBSCRIBED";
    else if (this.coolingDown) status = "COOLDOWN";
    else if (!hasAccess) status = "EXPIRED";
    else if (this.daysSinceSub < this.o.trialDays) status = "TRIAL";
    else status = "ACTIVE";
    return {
      status, hasAccess, rate: this.rate, monthsElapsed: this.monthsElapsed,
      principalSol: this.principalSol, depositedLst: this.depositedLst,
      dappTreasuryLst: this.dappTreasuryLst, protocolTreasuryLst: this.protocolTreasuryLst,
      daysFunded: this.coverageDays, daysElapsed: this.daysSinceSub,
    };
  }
}
