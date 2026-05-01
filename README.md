# S2S-Kit: Delegated Stake Subscription Protocol
### Non-custodial monetization for the Solana Seeker ecosystem.

S2S-Kit is a framework for implementing stake-based subscriptions on Solana. It enables dApp developers to capture yield from user deposits in the **Official Seeker Staking Protocol** while ensuring users maintain ownership of their principal.

---

## 🏗️ Technical Architecture

The protocol acts as a middleware layer between users and the official Solana Mobile $SKR staking program. It manages a multi-tenant vault system where user funds are delegated to high-yield Guardians via Cross-Program Invocations (CPI).

### 1. Staking and Authorization Flow
When a user stakes, the program initializes a `UserVault` and a `Subscription` account. It then performs a CPI to the Seeker protocol to delegate the user's $SKR to a designated Guardian.

```mermaid
sequenceDiagram
    participant User
    participant SDK
    participant S2S_Program
    participant Seeker_Protocol
    participant Token_2022

    User->>SDK: stake(amount)
    SDK->>S2S_Program: stake_and_subscribe(amount)
    S2S_Program->>S2S_Program: Initialize UserVault & Subscription
    S2S_Program->>Seeker_Protocol: CPI: delegate_stake(amount, guardian)
    S2S_Program->>Token_2022: CPI: mint_to(ActivePass)
    Token_2022-->>User: Non-transferable Mint
    S2S_Program-->>User: Transaction Success
```

### 2. Yield Redirection
Yield is realized when the program harvests delegation rewards from the Seeker protocol. The protocol calculates a global yield index to ensure fair distribution across all integrated dApps.

```mermaid
graph TD
    A[Seeker Delegation Yield] -->|Harvest| B[S2S Shared Vault]
    B -->|Protocol Fee 5%| C[S2S Treasury]
    B -->|Distributable Yield| D{Yield Indexer}
    D -->|Scale: 1e12| E[dApp A Treasury]
    D -->|Scale: 1e12| F[dApp B Treasury]
    D -->|Scale: 1e12| G[dApp N Treasury]
```

### 3. Unsubscription and Cooldown
To prevent yield manipulation and comply with the Seeker protocol's unbonding rules, the protocol enforces a 48-hour cooldown period. During this time, the user's Active Pass remains valid, but the staking principal is transitioning from a delegated to a liquid state.

---

## 🛡️ Protocol Security
*   **Non-Custodial**: Principal control is maintained via the `UserVault` PDA. Withdrawal is only possible to the original user authority after the unbonding period.
*   **Anchor 0.32**: Built using the latest Anchor framework with explicit instruction handlers to prevent namespace shadowing.
*   **Token-2022**: Utilizes the non-transferable extension to ensure subscription passes cannot be traded or moved between wallets.

---
*Built for the Seeker Ecosystem. Licensed under MIT.*
