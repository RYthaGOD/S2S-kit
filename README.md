# Stake-to-Subscribe (S2S)

Stake-to-Subscribe is an infrastructure for Solana Mobile (Seeker) dApps. It allows users to subscribe to services by staking **$SKR** tokens into a non-custodial vault, delegating them to a Guardian, and routing the yield to the developer treasury.

## ⚡ Features

- **Non-Custodial Staking:** Users retain ownership of their principal.
- **Token-2022 Active Pass:** Automatic minting of non-transferable subscription passes.
- **Zero-Cost Subscriptions:** Users subscribe via opportunity cost rather than capital spend.
- **Automated Treasury:** On-chain mechanisms for yield harvesting and distribution.
- **React Components:** Pre-built UI components for the Seeker device.

## 🛠️ Integration

### ⚡ Quick Start

Forge your S2S infrastructure with a single command:

```bash
npx @s2s-kit/cli init
```

### 2. Styles

Import the precision theme in your `_app.tsx` or `main.tsx`:

```tsx
import '@s2s-kit/react/theme.css';
```

### 3. Implementation

```tsx
import { SubscribeButton } from '@s2s-kit/react';

export function MyDapp() {
  const handleStake = async () => {
    // Call the Anchor program's stake_and_subscribe instruction
  };

  const handleUnsubscribe = async () => {
    // Call 'initiate_unsubscribe' (starts 48h cooldown)
  };

  const handleWithdraw = async () => {
    // Call 'withdraw_stake' (final burn + return $SKR)
  };

  return (
    <div className="p-8">
      <h1>Premium Feature</h1>
      <SubscribeButton 
        dappId="MY_DAPP_ID"
        walletAddress={publicKey.toBase58()}
        amount={100}
        onStake={handleStake}
        onUnsubscribe={handleUnsubscribe}
        onWithdraw={handleWithdraw}
      />
    </div>
  );
}
```

## 🏗️ Architecture

- **On-Chain:** Anchor program managing $SKR delegation to Seeker Guardians.
- **Middleware:** AetherIndex Fastify server for sub-millisecond status verification and grace-period management.
- **Yield Capture:** 95% of yield to the dApp developer, 5% protocol infrastructure fee.

## 🚀 Deployment

1. **Configure Treasury:** Run `initialize_dapp` with your wallet.
2. **Setup Middleware:** Deploy AetherIndex to Railway/Vercel.
3. **Verified Build:** Use `solana-verify` for trustless auditing.

---

Built by **Rykiri** for the Solana Mobile Ecosystem.
