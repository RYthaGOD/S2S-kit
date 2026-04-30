# Stake-to-Subscribe (S2S)

> "The mission is zero acquisition cost. Subscription revenue without user spending."

Stake-to-Subscribe is an elite, autonomous infrastructure for Solana Mobile (Seeker) dApps. It allows users to subscribe to your service by staking **$SKR** tokens into a non-custodial vault, delegating them to a Guardian, and routing the yield to your treasury.

## ⚡ Features

- **Non-Custodial Staking:** Users retain ownership of their principal.
- **Token-2022 Active Pass:** Automated minting of soulbound subscription NFTs.
- **Zero-Acquisition Friction:** Users don't "pay"—they "stake". Total cost to user = 0.
- **Autonomous Treasury:** On-chain cranks for yield harvesting and Jupiter-based compounding.
- **Industrial Futurism UI:** Precision-engineered React components for the Seeker device.

## 🛠️ Integration

### 1. Installation

```bash
npm install @rykiri/stake-to-subscribe
```

### 2. Styles

Import the precision theme in your `_app.tsx` or `main.tsx`:

```tsx
import '@rykiri/stake-to-subscribe/dist/theme.css';
```

### 3. Implementation

```tsx
import { SubscribeButton } from '@rykiri/stake-to-subscribe';

export function MyDapp() {
  const handleStake = async () => {
    // Call the Anchor program's stake_and_subscribe instruction
  };

  const handleUnstake = async () => {
    // Call the Anchor program's unstake_and_withdraw instruction
  };

  return (
    <div className="p-8">
      <h1>Premium Feature</h1>
      <SubscribeButton 
        dappId="MY_DAPP_ID"
        walletAddress={publicKey.toBase58()}
        amount={100}
        onStake={handleStake}
        onUnstake={handleUnstake}
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
