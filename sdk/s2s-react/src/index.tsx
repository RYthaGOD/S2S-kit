import React, { createContext, useContext, useState, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor';
import {
    getAssociatedTokenAddressSync,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import idl from './idl.json';

const PROGRAM_ID = new PublicKey((idl as any).address);

const seed = (s: string) => Buffer.from(s);
const pda = (seeds: (Buffer | Uint8Array)[]) =>
    PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

const to32 = (idStr: string): Buffer => {
    const buf = Buffer.alloc(32);
    (idStr.length === 64 ? Buffer.from(idStr, 'hex') : Buffer.from(idStr)).copy(buf);
    return buf;
};

export type S2SStatus = 'LOADING' | 'ACTIVE' | 'COOLDOWN' | 'UNSUBSCRIBED';

interface S2SContextState {
    status: S2SStatus;
    /** Deposit an allow-listed LST, subscribe to `dappId`, and mint the soulbound pass. */
    depositAndSubscribe: (lstMint: string, amount: number, dappId: string, lstTokenProgram?: PublicKey) => Promise<{ txid: string }>;
    /** Begin the withdrawal cooldown. */
    initiateUnsubscribe: () => Promise<{ txid: string }>;
    /** After cooldown: reclaim LST principal, burn the pass, close the vault. */
    withdraw: (lstMint: string, lstTokenProgram?: PublicKey) => Promise<{ txid: string }>;
    refresh: () => Promise<void>;
}

const S2SContext = createContext<S2SContextState | null>(null);

export const S2SProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [status, setStatus] = useState<S2SStatus>('LOADING');

    const program = useMemo(() => {
        const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
        return new Program(idl as Idl, provider);
    }, [connection, wallet]);

    const requireWallet = () => {
        if (!wallet.publicKey) throw new Error('Wallet not connected');
        return wallet.publicKey;
    };

    const depositAndSubscribe = async (
        lstMintStr: string,
        amount: number,
        dappId: string,
        lstTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
    ) => {
        const user = requireWallet();
        const lstMint = new PublicKey(lstMintStr);
        const dappIdBuf = to32(dappId);

        const config = pda([seed('global_config')]);
        const passMint = pda([seed('pass_mint')]);
        const dapp = pda([seed('dapp'), dappIdBuf]);
        const lstConfig = pda([seed('lst'), lstMint.toBuffer()]);
        const userVault = pda([seed('vault'), user.toBuffer()]);

        const userLstAccount = getAssociatedTokenAddressSync(lstMint, user, false, lstTokenProgram);
        const vaultLstAccount = getAssociatedTokenAddressSync(lstMint, userVault, true, lstTokenProgram);
        const userPassAccount = getAssociatedTokenAddressSync(passMint, user, false, TOKEN_2022_PROGRAM_ID);

        const txid = await program.methods
            .depositAndSubscribe(new BN(amount), Array.from(dappIdBuf))
            .accounts({
                user,
                config,
                dapp,
                lstConfig,
                userVault,
                lstMint,
                userLstAccount,
                vaultLstAccount,
                passMint,
                userPassAccount,
                tokenProgram: lstTokenProgram,
                passTokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        await refresh();
        return { txid };
    };

    const initiateUnsubscribe = async () => {
        const user = requireWallet();
        const userVault = pda([seed('vault'), user.toBuffer()]);
        const txid = await program.methods
            .initiateUnsubscribe()
            .accounts({ user, userVault })
            .rpc();
        await refresh();
        return { txid };
    };

    const withdraw = async (lstMintStr: string, lstTokenProgram: PublicKey = TOKEN_PROGRAM_ID) => {
        const user = requireWallet();
        const lstMint = new PublicKey(lstMintStr);
        const config = pda([seed('global_config')]);
        const passMint = pda([seed('pass_mint')]);
        const userVault = pda([seed('vault'), user.toBuffer()]);
        const vaultLstAccount = getAssociatedTokenAddressSync(lstMint, userVault, true, lstTokenProgram);
        const userLstAccount = getAssociatedTokenAddressSync(lstMint, user, false, lstTokenProgram);
        const userPassAccount = getAssociatedTokenAddressSync(passMint, user, false, TOKEN_2022_PROGRAM_ID);

        const txid = await program.methods
            .withdraw()
            .accounts({
                user,
                config,
                userVault,
                lstMint,
                vaultLstAccount,
                userLstAccount,
                passMint,
                userPassAccount,
                tokenProgram: lstTokenProgram,
                passTokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        await refresh();
        return { txid };
    };

    const refresh = async () => {
        if (!wallet.publicKey) { setStatus('UNSUBSCRIBED'); return; }
        const userVault = pda([seed('vault'), wallet.publicKey.toBuffer()]);
        const info = await connection.getAccountInfo(userVault);
        if (!info) { setStatus('UNSUBSCRIBED'); return; }
        // is_cooling_down flag lives at: 8 disc + 32*3 + 8*4 + 32 + 8 = 184
        const coolingDown = info.data[8 + 96 + 32 + 32 + 8] === 1;
        setStatus(coolingDown ? 'COOLDOWN' : 'ACTIVE');
    };

    return (
        <S2SContext.Provider value={{ status, depositAndSubscribe, initiateUnsubscribe, withdraw, refresh }}>
            {children}
        </S2SContext.Provider>
    );
};

export const useS2S = () => {
    const ctx = useContext(S2SContext);
    if (!ctx) throw new Error('useS2S must be used within S2SProvider');
    return ctx;
};
