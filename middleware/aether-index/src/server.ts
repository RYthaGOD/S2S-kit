import fastify from 'fastify';
import { AetherIndex } from './indexer';
import { PublicKey } from '@solana/web3.js';

const app = fastify({ logger: true });
const indexer = new AetherIndex('https://api.mainnet-beta.solana.com');

app.get('/api/verify/:walletAddress/:dappId', async (request, reply) => {
    const { walletAddress, dappId } = request.params as any;

    try {
        const [vaultAddress] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault'), new PublicKey(dappId).toBuffer(), new PublicKey(walletAddress).toBuffer()],
            new PublicKey("StKToSuBSCriBe11111111111111111111111111111")
        );

        const status = indexer.getStatus(vaultAddress.toString());
        
        if (!status) {
            return reply.send({ status: 'unsubscribed', cooldownEndsAt: null });
        }

        if (status.isCoolingDown) {
            const cooldownEndsAt = status.cooldownStartTime + (48 * 60 * 60);
            const now = Math.floor(Date.now() / 1000);
            
            if (now > cooldownEndsAt) {
                return reply.send({ status: 'unsubscribed', cooldownEndsAt: null });
            } else {
                return reply.send({ status: 'unstaking', cooldownEndsAt });
            }
        }

        return reply.send({ status: 'subscribed', cooldownEndsAt: null });

    } catch (err) {
        app.log.error(err);
        return reply.status(500).send({ error: 'Internal Server Error' });
    }
});

const start = async () => {
    try {
        await indexer.start();
        await app.listen({ port: 3000 });
        console.log(`AetherIndex Gateway running at http://localhost:3000`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
