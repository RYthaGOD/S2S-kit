import { Connection, PublicKey } from '@solana/web3.js';

const STAKE_TO_SUBSCRIBE_PROGRAM_ID = new PublicKey("StKToSuBSCriBe11111111111111111111111111111");

export class AetherIndex {
    private connection: Connection;
    private vaultStatusCache: Map<string, any>;

    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.vaultStatusCache = new Map();
    }

    public async start() {
        console.log("Starting AetherIndex - Listening to Stake-to-Subscribe program...");
        this.connection.onProgramAccountChange(
            STAKE_TO_SUBSCRIBE_PROGRAM_ID,
            (updatedAccountInfo, context) => {
                const address = updatedAccountInfo.accountId.toString();
                console.log(`Detected state change for vault: ${address}`);
                
                // In production, decode Borsh buffer here.
                // For scaffolding, we stub the unstake event.
                this.vaultStatusCache.set(address, {
                    isCoolingDown: true,
                    cooldownStartTime: Math.floor(Date.now() / 1000)
                });
            },
            'confirmed'
        );
    }

    public getStatus(vaultAddress: string): any {
        return this.vaultStatusCache.get(vaultAddress) || null;
    }
}
