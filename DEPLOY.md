# Deploying S2S-Kit to devnet (free) and running it end-to-end

Everything below runs on a machine with the Solana + Anchor toolchain. Devnet SOL is
free, so a full live deployment costs nothing. The program is already written and
type-checks (`cargo check`); these steps build the BPF binary, deploy it, and exercise
the whole lifecycle on-chain.

## 0. Prerequisites (one-time)

```bash
# Rust (you likely have it)
curl https://sh.rustup.rs -sSf | sh

# Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Anchor via avm
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.32.1 && avm use 0.32.1

# Node deps for tests/SDK
npm i -g yarn
```

> On Windows, run all of this inside **WSL2** — Anchor's BPF build is Linux-native.

## 1. Wallet + devnet

```bash
solana-keygen new                 # if you don't have ~/.config/solana/id.json
solana config set --url devnet
solana airdrop 2                  # free devnet SOL (repeat if rate-limited)
```

## 2. Real program ID, build, deploy

```bash
cd stake_to_subscribe
anchor keys sync                  # generates a real program keypair, rewrites declare_id! + Anchor.toml
anchor build                      # compiles the BPF binary + canonical IDL (target/idl/…)
anchor deploy --provider.cluster devnet
```

`anchor build` writes the **canonical IDL** to `target/idl/stake_to_subscribe.json` with the
real program address. Copy it into the clients so they target the deployed program:

```bash
cp target/idl/stake_to_subscribe.json ../sdk/s2s-react/src/idl.json
cp target/idl/stake_to_subscribe.json ../packages/cli/src/idl.json
```

## 3. End-to-end, two ways

**A. The integration test (fastest proof it works):**
```bash
anchor test --provider.cluster devnet --skip-deploy
```
This mints a demo LST, initializes the protocol, allow-lists the LST, registers a dApp,
deposits + subscribes (free trial granted, pass auto-minted), fast-forwards the rate,
harvests (yield → dApp + protocol, paid-through extended), verifies access, then
withdraws the full principal — all on devnet.

**B. The CLI bootstrap (a persistent deployment people can poke at):**
```bash
cd ..
node packages/cli/src/index.ts init-protocol --treasury <YOUR_PUBKEY> --fee 0 --cooldown 0
# demo LST (manual rate) so you can fast-forward yield without a real pool:
node packages/cli/src/index.ts add-lst --mint <DEMO_LST_MINT> --kind 0 --rate 1000000000000
node packages/cli/src/index.ts register-dapp --id 6368617421 --treasury <DAPP_PUBKEY> \
  --price 1000000 --period 2592000 --trial 604800
```

## 4. Showing yield (the "takes time to accrue" problem)

- **Demo LST (kind 0):** push the rate up with `update_lst_rate` to simulate appreciation
  instantly, then call `harvest_yield`. This is how the demo "fast-forwards" time.
- **Real LST (kind 1):** register with `--kind 1 --rate-source <StakePool account>`; a keeper
  calls `refresh_lst_rate` (trustless, reads `total_lamports / pool_token_supply`) then
  `harvest_yield` on a schedule. Real appreciation is slow — for a live demo use a demo LST.

## 5. The keeper (so yield actually flows)

`harvest_yield` (and, for real LSTs, `refresh_lst_rate`) must run on a schedule against each
vault. For devnet, a cron calling the instructions is enough; for mainnet it needs to be a
monitored, SOL-funded service. See `middleware/aether-index` for the account indexer that
finds vaults to crank.

---
The convenience script `scripts/devnet-bootstrap.sh` runs steps 2–3B once the toolchain is
installed (it checks for `solana`/`anchor` and tells you what's missing).
