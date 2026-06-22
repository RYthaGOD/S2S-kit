import React from 'react';
import { S2SProvider, useS2S } from '../../sdk/s2s-react/src';

// Demo configuration — point these at your deployed protocol + allow-listed LST.
const LST_MINT = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn'; // jitoSOL
const LST_SYMBOL = 'jitoSOL';
const DAPP_ID = 'chat-app';
const DEPOSIT = 100;

const IndustrialCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div style={{
    background: 'rgba(20, 20, 25, 0.8)',
    border: '1px solid rgba(255, 170, 0, 0.2)',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
    marginBottom: '24px'
  }}>
    <h3 style={{ color: '#ffaa00', textTransform: 'uppercase', fontSize: '12px', letterSpacing: '2px', marginBottom: '16px' }}>{title}</h3>
    {children}
  </div>
);

const Dashboard = () => {
  const { status, depositAndSubscribe, initiateUnsubscribe, withdraw } = useS2S();
  const hasAccess = status === 'ACTIVE' || status === 'COOLDOWN';

  return (
    <div style={{ background: '#0a0a0c', color: '#e0e0e0', minHeight: '100vh', padding: '40px', fontFamily: 'Inter, system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', margin: 0 }}>S2S <span style={{ color: '#ffaa00' }}>VAULT</span></h1>
          <p style={{ opacity: 0.5, fontSize: '14px' }}>LST Subscription Infrastructure on Solana</p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{
             padding: '8px 16px',
             borderRadius: '20px',
             background: hasAccess ? 'rgba(0, 255, 100, 0.1)' : 'rgba(255, 50, 50, 0.1)',
             border: `1px solid ${hasAccess ? '#00ff64' : '#ff3232'}`,
             color: hasAccess ? '#00ff64' : '#ff3232',
             fontSize: '12px',
             fontWeight: 700
           }}>
             {status}
           </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        <section>
          <IndustrialCard title="Deposit Control">
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', opacity: 0.7 }}>Deposit {LST_SYMBOL} to unlock access. You keep your principal — only the yield is routed.</p>
              <div style={{ fontSize: '48px', fontWeight: 900 }}>{DEPOSIT.toFixed(2)} <span style={{ fontSize: '24px', opacity: 0.3 }}>{LST_SYMBOL}</span></div>
            </div>
            <button
              onClick={() => depositAndSubscribe(LST_MINT, DEPOSIT, DAPP_ID)}
              disabled={hasAccess}
              style={{
                width: '100%',
                padding: '16px',
                background: '#ffaa00',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 900,
                cursor: hasAccess ? 'not-allowed' : 'pointer',
                opacity: hasAccess ? 0.4 : 1,
                transition: 'transform 0.1s'
              }}
            >
              DEPOSIT &amp; SUBSCRIBE
            </button>
          </IndustrialCard>

          <IndustrialCard title="Subscription Lifecycle">
             <div style={{ display: 'flex', gap: '12px' }}>
               <button onClick={() => initiateUnsubscribe()} disabled={status !== 'ACTIVE'} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer' }}>Unsubscribe</button>
               <button onClick={() => withdraw(LST_MINT)} disabled={status !== 'COOLDOWN'} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#ff6600', border: '1px solid rgba(255,102,0,0.4)', borderRadius: '8px', cursor: 'pointer' }}>Withdraw principal</button>
             </div>
             <p style={{ opacity: 0.5, fontSize: '12px', marginTop: '12px' }}>Yield (the {LST_SYMBOL} appreciation) is harvested by a permissionless crank and split between the protocol and the dApp.</p>
          </IndustrialCard>
        </section>

        <section>
          <IndustrialCard title="Active Subscriptions">
            <div style={{ opacity: 0.5, textAlign: 'center', padding: '40px' }}>
              {hasAccess ? (
                <div style={{ color: '#e0e0e0', opacity: 1 }}>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <strong>Mail Pro</strong> - Active
                  </div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <strong>Aether VPN</strong> - Active
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <strong>Analytics</strong> - Active
                  </div>
                </div>
              ) : (
                `Deposit ${LST_SYMBOL} to unlock dApps`
              )}
            </div>
          </IndustrialCard>

          {status === 'COOLDOWN' && (
            <div style={{
              background: 'linear-gradient(90deg, #ffaa00 0%, #ff6600 100%)',
              padding: '16px',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 700,
              fontSize: '14px'
            }}>
              ⏳ COOLDOWN: access remains active until your withdrawal cooldown finishes, then you can reclaim your principal.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export const App = () => (
  <S2SProvider>
    <Dashboard />
  </S2SProvider>
);
