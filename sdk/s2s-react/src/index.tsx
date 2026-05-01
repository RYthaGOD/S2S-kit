import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

interface S2SContextState {
    status: 'LOADING' | 'ACTIVE' | 'GRACE_PERIOD' | 'UNSTAKING' | 'EXPIRED' | 'UNSUBSCRIBED' | 'ERROR';
    hasAccess: boolean;
    details: any | null;
    message: string;
    refresh: () => Promise<void>;
}

const S2SContext = createContext<S2SContextState | undefined>(undefined);

export const S2SProvider: React.FC<{ children: React.ReactNode; endpoint: string }> = ({ children, endpoint }) => {
    const { publicKey } = useWallet();
    const [state, setState] = useState<S2SContextState>({
        status: 'LOADING',
        hasAccess: false,
        details: null,
        message: 'Initializing...',
        refresh: async () => {}
    });

    const checkStatus = async () => {
        if (!publicKey) {
            setState(s => ({ ...s, status: 'UNSUBSCRIBED', hasAccess: false, message: 'Wallet not connected' }));
            return;
        }

        try {
            const response = await fetch(`${endpoint}/api/status?wallet=${publicKey.toString()}`);
            const data = await response.json();

            setState({
                status: data.status,
                hasAccess: data.access,
                details: data.details || null,
                message: data.message,
                refresh: checkStatus
            });
        } catch (err) {
            console.error('S2S Verification Error:', err);
            setState(s => ({ ...s, status: 'ERROR', message: 'Verification server unreachable' }));
        }
    };

    useEffect(() => {
        checkStatus();
    }, [publicKey]);

    return (
        <S2SContext.Provider value={state}>
            {children}
        </S2SContext.Provider>
    );
};

export const useSubscription = () => {
    const context = useContext(S2SContext);
    if (!context) {
        throw new Error('useSubscription must be used within an S2SProvider');
    }
    return context;
};

/**
 * Vault Operations Hook
 * Provides methods for staking and claiming yield
 */
export const useS2SVault = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { refresh } = useSubscription();

    const stakeAndSubscribe = async (amount: number, dappId: string) => {
        if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
        
        console.log(`Initiating S2S Stake: ${amount} SKR for dApp ${dappId}`);
        // In production, this uses @coral-xyz/anchor to build the stake_and_subscribe instruction
        // utilizing the S2S program ID and derived PDAs.
        // The SDK abstracts the complex SKR-protocol account mappings.
        
        // Mocking the transaction success for Phase 2 scaffolding
        return { txid: "STAKE_SUCCESS_STUB" };
    };

    const claimYield = async (dappId: string) => {
        if (!wallet.publicKey) throw new Error("Wallet not connected");
        console.log(`Claiming Yield for dApp: ${dappId}`);
        // Calls the on-chain claim_subscription_yield instruction
        return { txid: "CLAIM_SUCCESS_STUB" };
    };

    return {
        stakeAndSubscribe,
        claimYield,
        isConnecting: wallet.connecting
    };
};
