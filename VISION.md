# S2S-Kit — Vision

## What it is

**A non-custodial primitive for routing staking yield on Solana.**

You deposit a Liquid Staking Token (jitoSOL, mSOL, bSOL, JupSOL…). You keep 100% of
your principal and can withdraw it any time. The protocol periodically directs only the
**yield** — the LST's appreciation against SOL — to a recipient you choose.

> A standing order funded by your staking rewards, not your balance.

Your capital is never spent, never lent, never at risk of the recipient. Only the
yield moves, and only while you let it.

## Why this is the right framing

Subscriptions were too narrow. The honest, larger idea is **programmable yield routing**:
point the yield you're already earning (and probably ignoring) at the things you value.

- For the **user**: zero new capital, zero principal risk, fully reversible. The "cost"
  is forgone yield — often yield that was sitting idle anyway.
- For the **recipient**: a real, ongoing, on-chain revenue stream that scales with how
  much yield-bearing capital is pointed at them.

## What you can route yield to

| Recipient | What it becomes |
|---|---|
| **Apps** | Subscriptions / gated access (the soulbound Active Pass) — *one module, optional* |
| **Creators** | Patronage funded by yield — "Patreon, but you keep your capital" |
| **DAOs / communities** | Membership dues, treasury contributions from members' yield |
| **Public goods / causes** | *Donate your yield, keep your principal* |
| **Yourself / another wallet** | Personal yield routing to a goal or destination |

Subscriptions are the first app built on the primitive — not the foundation.

## How the mechanism already supports this

The on-chain program is already a yield-routing engine:

1. `deposit` — escrow LST in a non-custodial `UserVault` PDA.
2. `harvest_yield` — skim the appreciation (surplus over preserved principal),
   route a recipient cut to the recipient, take an optional protocol cut.
3. `withdraw` — return the full principal to the user at any time.

Generalizing it is mostly vocabulary: a **Recipient** is any registered destination,
and the access pass / billing clock is an **optional module** that only "gated"
recipients (apps) turn on. Tipping a creator or donating to a cause needs no pass at all.

## Economics & sustainability (decided deliberately, not by default)

The hard truth: a small cut of retail LST yield is tiny per user and only meaningful at
large TVL. So viability does **not** depend on skimming users. The protocol fee is an
**optional switch** (it can default to off). Funding paths, to be chosen as the project
matures:

- **Public-good + ecosystem grants** (Jito, Marinade, Sanctum, Solana Foundation fund LST tooling).
- **B2B**: charge *recipients/dApps* for hosted infra (indexer, keeper, analytics) — not users.
- **Optional protocol fee**, turned on by deployers or future governance if/when it makes sense.

Build the credible, free primitive first. Decide how it pays for itself second.
