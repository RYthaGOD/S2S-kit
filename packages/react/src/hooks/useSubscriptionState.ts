import { useState, useEffect } from 'react';

type SubStatus = 'subscribed' | 'unsubscribed' | 'unstaking';

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
                setStatus(data.status);
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
