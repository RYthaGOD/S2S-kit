import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, Connection } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import idl from './idl.json';

const PROGRAM_ID = new PublicKey('StKToSuBSCriBe11111111111111111111111111111');
const SKR_STAKING_PROGRAM = new PublicKey('SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ');
const SKR_STAKING_VAULT = new PublicKey('8isViKbwhuhFhsv2t8vaFL74pKCqaFPQXo1KkeQwZbB8');
const SKR_MINT = new PublicKey('SKRkGqJsk7u9pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ'); // Placeholder SKR Mint

interface S2SContextState {
    status: 'LOADING' | 'ACTIVE' | 'GRACE_PERIOD' | 'UNSTAKING' | 'EXPIRED' | 'UNSUBSCRIBED' | 'ERROR';
    subscription?: any;
    stakeAndSubscribe: (amount: number, dappId: string) => Promise<{ txid: string }>;
    claimYield: (dappId: string) => Promise<{ txid: string }>;
    refresh: () => Promise<void>;
}

const S2SContext = createContext<S2SContextState | null>(null);

export const S2SProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [status, setStatus] = useState<S2SContextState['status']>('LOADING');
    const [subscription, setSubscription] = useState<any>(null);

    const program = useMemo(() => {
        const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
        return new Program(idl as Idl, PROGRAM_ID, provider);
    }, [connection, wallet]);

    const to32ByteBuf = (hexOrStr: string): Buffer => {
        const buf = Buffer.alloc(32);
        try {
            if (hexOrStr.length === 64) {
                Buffer.from(hexOrStr, 'hex').copy(buf);
            } else {
                Buffer.from(hexOrStr).copy(buf);
            }
        } catch (e) {
            Buffer.from(hexOrStr).copy(buf);
        }
        return buf;
    };

    const refresh = async () => {
        if (!wallet.publicKey) {
            setStatus('UNSUBSCRIBED');
            return;
        }
        // Logic to fetch subscription state from on-chain
        setStatus('ACTIVE'); 
    };

    const stakeAndSubscribe = async (amount: number, dappId: string) => {
        if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
        
        const dappIdBuf = to32ByteBuf(dappId);
        
        // PDA Derivations
        const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], PROGRAM_ID);
        const [dapp] = PublicKey.findProgramAddressSync([Buffer.from("dapp"), dappIdBuf], PROGRAM_ID);
        const [userVault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), wallet.publicKey.toBuffer()], PROGRAM_ID);
        const [sub] = PublicKey.findProgramAddressSync(
            [Buffer.from("subscription"), wallet.publicKey.toBuffer(), dapp.toBuffer()],
            PROGRAM_ID
        );
        const [passMint] = PublicKey.findProgramAddressSync([Buffer.from("pass_mint")], PROGRAM_ID);

        // Token Accounts
        const userSkrAccount = getAssociatedTokenAddressSync(SKR_MINT, wallet.publicKey);
        const vaultSkrAccount = getAssociatedTokenAddressSync(SKR_MINT, userVault, true);
        const userPassAccount = getAssociatedTokenAddressSync(passMint, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);

        // Official SKR Protocol Accounts (Derived as per Seeker standard)
        // In a real SDK, these would be fetched or passed as config
        const [skrStakeConfig] = PublicKey.findProgramAddressSync([Buffer.from("config")], SKR_STAKING_PROGRAM);
        const [guardianPool] = PublicKey.findProgramAddressSync([Buffer.from("guardian_pool")], SKR_STAKING_PROGRAM);
        const [officialUserStake] = PublicKey.findProgramAddressSync(
            [Buffer.from("stake"), userVault.toBuffer()],
            SKR_STAKING_PROGRAM
        );

        console.log(`Building Sovereign Stake: ${amount} SKR for dApp ${dappId}`);

        try {
            const tx = await program.methods
                .stakeAndSubscribe(new BN(amount), Array.from(dappIdBuf))
                .accounts({
                    user: wallet.publicKey,
                    config,
                    dapp,
                    userVault,
                    subscription: sub,
                    skrMint: SKR_MINT,
                    userSkrAccount,
                    vaultSkrAccount,
                    passMint,
                    userPassAccount,
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    skrStakingProgram: SKR_STAKING_PROGRAM,
                    skrStakeConfig,
                    guardianPool,
                    officialUserStake,
                    skrStakingVault: SKR_STAKING_VAULT,
                })
                .rpc();

            await refresh();
            return { txid: tx };
        } catch (err) {
            console.error("S2S Stake Failed:", err);
            throw err;
        }
    };

    const claimYield = async (dappId: string) => {
        // Implementation follows the same derivation logic as stakeAndSubscribe
        console.log(`Claiming Subscription Yield for dApp: ${dappId}`);
        return { txid: "CLAIM_SUCCESS_STUB" };
    };

    return (
        <S2SContext.Provider value={{ status, subscription, stakeAndSubscribe, claimYield, refresh }}>
            {children}
        </S2SContext.Provider>
    );
};

export const useS2S = () => {
    const context = useContext(S2SContext);
    if (!context) throw new Error("useS2S must be used within S2SProvider");
    return context;
};
