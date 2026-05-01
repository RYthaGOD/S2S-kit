import { Connection, PublicKey } from '@solana/web3.js';
import * as borsh from 'borsh';

const STAKE_TO_SUBSCRIBE_PROGRAM_ID = new PublicKey("StKToSuBSCriBe11111111111111111111111111111");

// UserVault Account Schema (matching Rust struct)
class UserVault {
    user: Uint8Array;
    stakedAmount: bigint;
    shares: bigint;
    cumulativeYieldHarvested: bigint;
    accumulatedYieldPerDapp: bigint;
    activePassMint: Uint8Array;
    stakedAt: bigint;
    isCoolingDown: boolean;
    cooldownStartTime: bigint;
    totalSharesUnstaking: bigint;
    lastHarvestAt: bigint;
    bump: number;

    constructor(fields: any) {
        this.user = fields.user;
        this.stakedAmount = fields.stakedAmount;
        this.shares = fields.shares;
        this.cumulativeYieldHarvested = fields.cumulativeYieldHarvested;
        this.accumulatedYieldPerDapp = fields.accumulatedYieldPerDapp;
        this.activePassMint = fields.activePassMint;
        this.stakedAt = fields.stakedAt;
        this.isCoolingDown = fields.isCoolingDown;
        this.cooldownStartTime = fields.cooldownStartTime;
        this.totalSharesUnstaking = fields.totalSharesUnstaking;
        this.lastHarvestAt = fields.lastHarvestAt;
        this.bump = fields.bump;
    }
}

const UserVaultSchema = new Map([
    [UserVault, {
        kind: 'struct',
        fields: [
            ['user', [32]],
            ['stakedAmount', 'u64'],
            ['shares', 'u128'],
            ['cumulativeYieldHarvested', 'u64'],
            ['accumulatedYieldPerDapp', 'u128'],
            ['activePassMint', [32]],
            ['stakedAt', 'i64'],
            ['isCoolingDown', 'u8'], // Bool is 1 byte
            ['cooldownStartTime', 'i64'],
            ['totalSharesUnstaking', 'u128'],
            ['lastHarvestAt', 'i64'],
            ['bump', 'u8'],
        ]
    }]
]);

export class AetherIndex {
    private connection: Connection;
    private vaultStatusCache: Map<string, any>;

    constructor(rpcUrl: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.vaultStatusCache = new Map();
    }

    public async start() {
        console.log("Starting AetherIndex - Listening to Stake-to-Subscribe program...");
        
        // Initial fetch of all vaults
        const accounts = await this.connection.getProgramAccounts(STAKE_TO_SUBSCRIBE_PROGRAM_ID, {
            filters: [{ dataSize: 184 }] // 8 (disc) + UserVault::INIT_SPACE
        });

        for (const account of accounts) {
            this.updateCache(account.pubkey, account.account.data);
        }

        // Real-time updates
        this.connection.onProgramAccountChange(
            STAKE_TO_SUBSCRIBE_PROGRAM_ID,
            (updatedAccountInfo, context) => {
                this.updateCache(updatedAccountInfo.accountId, updatedAccountInfo.accountInfo.data);
            },
            'confirmed'
        );
    }

    private updateCache(pubkey: PublicKey, data: Buffer) {
        try {
            // Anchor account discriminator is first 8 bytes
            const accountData = data.slice(8);
            const decoded = borsh.deserialize(UserVaultSchema, UserVault, accountData);
            
            this.vaultStatusCache.set(pubkey.toString(), {
                stakedAmount: Number(decoded.stakedAmount),
                shares: decoded.shares.toString(),
                stakedAt: Number(decoded.stakedAt),
                isCoolingDown: decoded.isCoolingDown === 1,
                cooldownStartTime: Number(decoded.cooldownStartTime),
                lastHarvestAt: Number(decoded.lastHarvestAt)
            });
            
            console.log(`Updated cache for vault: ${pubkey.toString()}`);
        } catch (err) {
            console.error(`Failed to decode vault ${pubkey.toString()}:`, err);
        }
    }

    public getStatus(vaultAddress: string): any {
        return this.vaultStatusCache.get(vaultAddress) || null;
    }
}
