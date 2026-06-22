import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscriptionState } from '../hooks/useSubscriptionState';
import '../styles/theme.css';

interface SubscribeButtonProps {
    dappId: string;
    walletAddress: string;
    amount: number;
    /** Symbol of the LST being deposited (e.g. "jitoSOL"). */
    tokenSymbol?: string;
    onStake: () => Promise<void>;
    onUnsubscribe: () => Promise<void>;
    onWithdraw: () => Promise<void>;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({ dappId, walletAddress, amount, tokenSymbol = 'LST', onStake, onUnsubscribe, onWithdraw }) => {
    const { status, cooldownEndsAt, isLoading } = useSubscriptionState(walletAddress, dappId);
    const [timeLeft, setTimeLeft] = useState<string>('');

    // Countdown logic for the Cooldown Period
    useEffect(() => {
        if (status !== 'unstaking' || !cooldownEndsAt) return;
        
        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = cooldownEndsAt - now;
            if (remaining <= 0) {
                setTimeLeft('Cooldown Cleared');
                clearInterval(interval);
            } else {
                const h = Math.floor(remaining / 3600);
                const m = Math.floor((remaining % 3600) / 60);
                const s = remaining % 60;
                setTimeLeft(`${h}h ${m}m ${s}s`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [status, cooldownEndsAt]);

    if (isLoading && status === 'unsubscribed') {
        return <div className="s2s-btn s2s-loading"><div className="s2s-spinner" /></div>;
    }

    return (
        <AnimatePresence mode="wait">
            {status === 'unsubscribed' && (
                <motion.button 
                    key="stake"
                    className="s2s-btn s2s-btn-primary"
                    onClick={onStake}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                    Deposit {amount} {tokenSymbol} to Subscribe
                </motion.button>
            )}

            {status === 'subscribed' && (
                <motion.button 
                    key="active"
                    className="s2s-btn s2s-btn-active"
                    onClick={onUnsubscribe}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                >
                    <span className="s2s-pulse-dot" /> Subscribed (Unsubscribe?)
                </motion.button>
            )}

            {status === 'unstaking' && (
                <motion.div 
                    key="cooldown"
                    className="s2s-btn s2s-btn-cooldown"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                >
                    Access Active — Unlocking in: <span className="s2s-mono">{timeLeft}</span>
                </motion.div>
            )}

            {status === 'withdraw_ready' && (
                <motion.button 
                    key="withdraw"
                    className="s2s-btn s2s-btn-withdraw"
                    onClick={onWithdraw}
                    initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.05 }}
                >
                    Withdraw {tokenSymbol} principal & Close Pass
                </motion.button>
            )}
        </AnimatePresence>
    );
};
