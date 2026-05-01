import React from 'react';
import { S2SProvider, useSubscription, useS2SVault } from '../../sdk/s2s-react/src';

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
  const { status, hasAccess, message, details } = useSubscription();
  const { stakeAndSubscribe, isConnecting } = useS2SVault();

  return (
    <div style={{ background: '#0a0a0c', color: '#e0e0e0', minHeight: '100vh', padding: '40px', fontFamily: 'Inter, system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', margin: 0 }}>S2S <span style={{ color: '#ffaa00' }}>VAULT</span></h1>
          <p style={{ opacity: 0.5, fontSize: '14px' }}>Sovereign Staking Infrastructure for Seeker</p>
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
          <IndustrialCard title="Staking Control">
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', opacity: 0.7 }}>Stake $SKR to unlock the entire Seeker ecosystem.</p>
              <div style={{ fontSize: '48px', fontWeight: 900 }}>100.00 <span style={{ fontSize: '24px', opacity: 0.3 }}>SKR</span></div>
            </div>
            <button 
              onClick={() => stakeAndSubscribe(100, "GLOBAL")}
              disabled={isConnecting}
              style={{
                width: '100%',
                padding: '16px',
                background: '#ffaa00',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'transform 0.1s'
              }}
            >
              INITIALIZE SHARED VAULT
            </button>
          </IndustrialCard>

          <IndustrialCard title="Yield Telemetry">
             <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6, fontSize: '14px' }}>
               <span>Protocol APY</span>
               <span>~22.4%</span>
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6, fontSize: '14px', marginTop: '8px' }}>
               <span>Est. Monthly Yield</span>
               <span>1.86 SKR</span>
             </div>
          </IndustrialCard>
        </section>

        <section>
          <IndustrialCard title="Active Subscriptions">
            <div style={{ opacity: 0.5, textAlign: 'center', padding: '40px' }}>
              {hasAccess ? (
                <div style={{ color: '#e0e0e0', opacity: 1 }}>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <strong>Seeker Mail Pro</strong> - Active
                  </div>
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <strong>Aether VPN</strong> - Active
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <strong>Guardian Analytics</strong> - Active
                  </div>
                </div>
              ) : (
                "Stake to unlock dApps"
              )}
            </div>
          </IndustrialCard>
          
          {details?.isGracePeriod && (
            <div style={{ 
              background: 'linear-gradient(90deg, #ffaa00 0%, #ff6600 100%)',
              padding: '16px',
              borderRadius: '8px',
              color: '#000',
              fontWeight: 700,
              fontSize: '14px'
            }}>
              ⚡ INSTANT ACCESS: You are currently in the 72h grace period. Access will remain active while your first reward epoch finalizes.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export const App = () => (
  <S2SProvider endpoint="http://localhost:3000">
    <Dashboard />
  </S2SProvider>
);
