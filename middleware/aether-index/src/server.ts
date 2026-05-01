import fastify from 'fastify';
import { AetherIndex } from './indexer';
import { PublicKey } from '@solana/web3.js';

const app = fastify({ logger: true });
const indexer = new AetherIndex('https://api.mainnet-beta.solana.com');

const PROGRAM_ID = new PublicKey("StKToSuBSCriBe11111111111111111111111111111");

/**
 * Status check with 72h Grace Period logic
 */
app.get('/api/status', async (request, reply) => {
    const { wallet } = request.query as { wallet: string };

    if (!wallet) {
        return reply.status(400).send({ error: 'Wallet address required' });
    }

    try {
        const userPubkey = new PublicKey(wallet);
        
        // Derive the Shared Vault PDA
        const [vaultAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault'), userPubkey.toBuffer()],
            PROGRAM_ID
        );

        const status = indexer.getStatus(vaultAddress.toString());
        
        if (!status) {
            return reply.send({ 
                status: 'UNSUBSCRIBED', 
                access: false,
                message: 'No shared staking vault detected for this wallet.' 
            });
        }

        const now = Math.floor(Date.now() / 1000);
        const GRACE_PERIOD_SECONDS = 72 * 3600; // 72h Grace Period
        const isWithinGrace = (now - status.stakedAt) < GRACE_PERIOD_SECONDS;

        // Handle Unstaking / Cooldown State
        if (status.isCoolingDown) {
            const COOLDOWN_SECONDS = 48 * 3600;
            const cooldownEndsAt = status.cooldownStartTime + COOLDOWN_SECONDS;
            
            if (now > cooldownEndsAt) {
                return reply.send({ 
                    status: 'EXPIRED', 
                    access: false,
                    message: 'Staking cooldown complete. Subscription has expired.'
                });
            } else {
                return reply.send({ 
                    status: 'UNSTAKING', 
                    access: true, 
                    cooldownEndsAt,
                    message: 'Subscription is in cooldown. Access remains active until withdrawal.'
                });
            }
        }

        // Handle Active State
        return reply.send({ 
            status: 'ACTIVE', 
            access: true, 
            details: {
                isGracePeriod: isWithinGrace,
                stakedAmount: status.stakedAmount,
                stakedAt: status.stakedAt,
                lastHarvestAt: status.lastHarvestAt
            },
            message: isWithinGrace 
                ? 'Access granted via 72h Grace Period.' 
                : 'Access granted via active Shared Vault.'
        });

    } catch (err) {
        app.log.error(err);
        return reply.status(500).send({ error: 'Subscription verification failed.' });
    }
});

const start = async () => {
    try {
        await indexer.start();
        await app.listen({ port: 3000, host: '0.0.0.0' });
        console.log(`S2S Shared Middleware running at http://localhost:3000`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
