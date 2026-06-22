#!/usr/bin/env bash
# Builds, deploys, and end-to-end-tests S2S-Kit on devnet.
# Requires the Solana + Anchor toolchain (see DEPLOY.md). Run from the repo root.
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ missing '$1' — see DEPLOY.md §0"; exit 1; }; }
need solana
need anchor
need node

echo "▸ cluster → devnet"
solana config set --url devnet >/dev/null

echo "▸ ensuring devnet SOL (airdrop; ignore if rate-limited)"
solana airdrop 2 >/dev/null 2>&1 || true

echo "▸ syncing program keypair + building"
( cd stake_to_subscribe && anchor keys sync && anchor build )

echo "▸ syncing canonical IDL into clients"
cp stake_to_subscribe/target/idl/stake_to_subscribe.json sdk/s2s-react/src/idl.json
cp stake_to_subscribe/target/idl/stake_to_subscribe.json packages/cli/src/idl.json

echo "▸ deploying to devnet"
( cd stake_to_subscribe && anchor deploy --provider.cluster devnet )

echo "▸ running the end-to-end lifecycle test on devnet"
( cd stake_to_subscribe && anchor test --provider.cluster devnet --skip-deploy )

echo "✅ done — program live on devnet and the full lifecycle passed."
echo "   Program ID: $(solana address -k stake_to_subscribe/target/deploy/stake_to_subscribe-keypair.json)"
