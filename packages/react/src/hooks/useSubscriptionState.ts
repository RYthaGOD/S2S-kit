import { useState, useEffect } from 'react';

type SubStatus = 'subscribed' | 'unsubscribed' | 'unstaking' | 'withdraw_ready';

export function useSubscriptionState(walletAddress: string, dappId: string) {
    const [status, setStatus] = useState<SubStatus>('unsubscribed');
    const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!walletAddress) return;

        const checkStatus = async () => {
            setIsLoading(true);
            try {
                // In production, point to the AetherIndex API URL
                const res = await fetch(`http://localhost:3000/api/verify/${walletAddress}/${dappId}`);
                const data = await res.json();
                
                let currentStatus = data.status;
                const now = Math.floor(Date.now() / 1000);
                
                if (currentStatus === 'unstaking' && data.cooldownEndsAt && now >= data.cooldownEndsAt) {
                    currentStatus = 'withdraw_ready';
                }
                
                setStatus(currentStatus);
                setCooldownEndsAt(data.cooldownEndsAt);
            } catch (e) {
                console.error('Failed to verify subscription status:', e);
            } finally {
                setIsLoading(false);
            }
        };

        checkStatus();
        // Poll every 10 seconds for seamless UI updates
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, [walletAddress, dappId]);

    return { status, cooldownEndsAt, isLoading };
}
