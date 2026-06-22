import { Connection, PublicKey } from '@solana/web3.js';
import * as borsh from 'borsh';

const STAKE_TO_SUBSCRIBE_PROGRAM_ID = new PublicKey("StKToSuBSCriBe11111111111111111111111111111");

// UserVault Account Schema (matching state/vault.rs, LST model)
class UserVault {
    user: Uint8Array;
    lstMint: Uint8Array;
    dapp: Uint8Array;
    depositedLst: bigint;
    principalValue: bigint;
    cumulativeYieldSkimmed: bigint;
    protocolFeesContributed: bigint;
    activePassMint: Uint8Array;
    depositedAt: bigint;
    paidThrough: bigint;
    isCoolingDown: boolean;
    cooldownStartTime: bigint;
    lastHarvestAt: bigint;
    bump: number;

    constructor(fields: any) {
        this.user = fields.user;
        this.lstMint = fields.lstMint;
        this.dapp = fields.dapp;
        this.depositedLst = fields.depositedLst;
        this.principalValue = fields.principalValue;
        this.cumulativeYieldSkimmed = fields.cumulativeYieldSkimmed;
        this.protocolFeesContributed = fields.protocolFeesContributed;
        this.activePassMint = fields.activePassMint;
        this.depositedAt = fields.depositedAt;
        this.paidThrough = fields.paidThrough;
        this.isCoolingDown = fields.isCoolingDown;
        this.cooldownStartTime = fields.cooldownStartTime;
        this.lastHarvestAt = fields.lastHarvestAt;
        this.bump = fields.bump;
    }
}

const UserVaultSchema = new Map([
    [UserVault, {
        kind: 'struct',
        fields: [
            ['user', [32]],
            ['lstMint', [32]],
            ['dapp', [32]],
            ['depositedLst', 'u64'],
            ['principalValue', 'u64'],
            ['cumulativeYieldSkimmed', 'u64'],
            ['protocolFeesContributed', 'u64'],
            ['activePassMint', [32]],
            ['depositedAt', 'i64'],
            ['paidThrough', 'i64'],
            ['isCoolingDown', 'u8'], // Bool is 1 byte
            ['cooldownStartTime', 'i64'],
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
            filters: [{ dataSize: 202 }] // 8 (disc) + UserVault::INIT_SPACE (194)
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
                lstMint: new PublicKey(decoded.lstMint).toString(),
                dapp: new PublicKey(decoded.dapp).toString(),
                depositedLst: decoded.depositedLst.toString(),
                principalValue: decoded.principalValue.toString(),
                cumulativeYieldSkimmed: decoded.cumulativeYieldSkimmed.toString(),
                protocolFeesContributed: decoded.protocolFeesContributed.toString(),
                depositedAt: Number(decoded.depositedAt),
                paidThrough: Number(decoded.paidThrough),
                active: Number(decoded.paidThrough) >= Math.floor(Date.now() / 1000),
                isCoolingDown: (decoded.isCoolingDown as unknown as number) === 1,
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
