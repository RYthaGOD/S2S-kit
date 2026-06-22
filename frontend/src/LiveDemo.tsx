import { useEffect, useRef, useState } from "react";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync, getAccount,
} from "@solana/spl-token";
import idl from "./idl.json";

const API = import.meta.env.VITE_API_BASE || "";
const RPC = "https://api.devnet.solana.com";
const DEPOSIT = 6;
const ex = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
const fmt = (n: number, d = 4) => n.toFixed(d);

interface LiveCfg {
  programId: string; demoLstMint: string; dappIdHex: string; dapp: string;
  passMint: string; config: string; protocolTreasury: string; dappTreasury: string;
}

function loadBurner(): Keypair {
  const k = localStorage.getItem("s2s_burner");
  if (k) { try { return Keypair.fromSecretKey(new Uint8Array(JSON.parse(k))); } catch {} }
  const kp = Keypair.generate();
  localStorage.setItem("s2s_burner", JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

type Step = "loading" | "idle" | "funding" | "funded" | "depositing" | "active" | "withdrawing" | "done";

export function LiveDemo() {
  const [cfg, setCfg] = useState<LiveCfg | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [msg, setMsg] = useState<string>("");
  const [txs, setTxs] = useState<{ label: string; sig: string }[]>([]);
  const [vault, setVault] = useState<any>(null);
  const [rate, setRate] = useState(1);
  const [dappEarned, setDappEarned] = useState(0);
  const burner = useRef<Keypair>(loadBurner());
  const conn = useRef(new Connection(RPC, "confirmed"));

  const program = useRef<Program | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c: LiveCfg = await (await fetch(`${API}/api/config`)).json();
        setCfg(c);
        const wallet = {
          publicKey: burner.current.publicKey,
          signTransaction: async (tx: any) => { tx.partialSign(burner.current); return tx; },
          signAllTransactions: async (txs: any[]) => { txs.forEach(t => t.partialSign(burner.current)); return txs; },
        };
        program.current = new Program(idl as any, new AnchorProvider(conn.current, wallet as any, { commitment: "confirmed" }));
        setStep("idle");
      } catch (e: any) { setMsg("backend offline — " + (e.message || e)); }
    })();
  }, []);

  const pushTx = (label: string, sig: string) => setTxs(t => [{ label, sig }, ...t].slice(0, 6));
  const pdas = (c: LiveCfg) => {
    const pid = new PublicKey(c.programId);
    const dappId = Array.from(Buffer.from(c.dappIdHex, "hex"));
    const lstMint = new PublicKey(c.demoLstMint);
    const [config] = PublicKey.findProgramAddressSync([Buffer.from("global_config")], pid);
    const [lstConfig] = PublicKey.findProgramAddressSync([Buffer.from("lst"), lstMint.toBuffer()], pid);
    const [userVault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), burner.current.publicKey.toBuffer()], pid);
    return { pid, dappId, lstMint, config, lstConfig, userVault, dapp: new PublicKey(c.dapp), passMint: new PublicKey(c.passMint) };
  };

  async function fund() {
    setStep("funding"); setMsg("requesting test tokens…");
    try {
      await fetch(`${API}/api/faucet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pubkey: burner.current.publicKey.toBase58() }) });
      setMsg(""); setStep("funded");
    } catch (e: any) { setMsg("faucet error: " + (e.message || e)); setStep("idle"); }
  }

  async function deposit() {
    if (!cfg || !program.current) return;
    setStep("depositing"); setMsg("depositing & subscribing…");
    const p = pdas(cfg);
    const userLst = getAssociatedTokenAddressSync(p.lstMint, burner.current.publicKey, false, TOKEN_PROGRAM_ID);
    const vaultLst = getAssociatedTokenAddressSync(p.lstMint, p.userVault, true, TOKEN_PROGRAM_ID);
    const userPass = getAssociatedTokenAddressSync(p.passMint, burner.current.publicKey, false, TOKEN_2022_PROGRAM_ID);
    try {
      const sig = await program.current.methods.depositAndSubscribe(new BN(DEPOSIT * 1e9), p.dappId)
        .accounts({
          user: burner.current.publicKey, config: p.config, dapp: p.dapp, lstConfig: p.lstConfig, userVault: p.userVault,
          lstMint: p.lstMint, userLstAccount: userLst, vaultLstAccount: vaultLst, passMint: p.passMint, userPassAccount: userPass,
          tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        }).rpc();
      pushTx("deposit & subscribe", sig); setMsg(""); setStep("active");
    } catch (e: any) { setMsg("deposit failed: " + (e.message || e)); setStep("funded"); }
  }

  async function withdraw() {
    if (!cfg || !program.current) return;
    setStep("withdrawing"); setMsg("withdrawing principal…");
    const p = pdas(cfg);
    const userLst = getAssociatedTokenAddressSync(p.lstMint, burner.current.publicKey, false, TOKEN_PROGRAM_ID);
    const vaultLst = getAssociatedTokenAddressSync(p.lstMint, p.userVault, true, TOKEN_PROGRAM_ID);
    const userPass = getAssociatedTokenAddressSync(p.passMint, burner.current.publicKey, false, TOKEN_2022_PROGRAM_ID);
    try {
      await program.current.methods.initiateUnsubscribe().accounts({ user: burner.current.publicKey, userVault: p.userVault }).rpc();
      const sig = await program.current.methods.withdraw().accounts({
        user: burner.current.publicKey, config: p.config, userVault: p.userVault, lstMint: p.lstMint,
        vaultLstAccount: vaultLst, userLstAccount: userLst, passMint: p.passMint, userPassAccount: userPass,
        tokenProgram: TOKEN_PROGRAM_ID, passTokenProgram: TOKEN_2022_PROGRAM_ID, systemProgram: SystemProgram.programId,
      }).rpc();
      pushTx("withdraw principal", sig); setMsg(""); setStep("done"); setVault(null);
    } catch (e: any) { setMsg("withdraw failed: " + (e.message || e)); setStep("active"); }
  }

  // poll vault + rate + dApp treasury while active (watch the keeper harvest)
  useEffect(() => {
    if (step !== "active" || !cfg || !program.current) return;
    const p = pdas(cfg);
    let alive = true;
    const poll = async () => {
      try {
        const v = await (program.current as any).account.userVault.fetch(p.userVault);
        const lc = await (program.current as any).account.lstConfig.fetch(p.lstConfig);
        const r = Number(lc.rate.toString()) / 1e12;
        let earned = 0;
        try { earned = Number((await getAccount(conn.current, new PublicKey(cfg.dappTreasury))).amount) / 1e9; } catch {}
        if (alive) { setVault(v); setRate(r); setDappEarned(earned); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [step, cfg]);

  const reset = () => { localStorage.removeItem("s2s_burner"); burner.current = loadBurner(); setTxs([]); setStep("idle"); setVault(null); };

  const principalSol = vault ? (Number(vault.principalValue.toString()) / 1e9) : DEPOSIT;
  const depositedLst = vault ? (Number(vault.depositedLst.toString()) / 1e9) : 0;
  const paidThrough = vault ? Number(vault.paidThrough.toString()) : 0;
  const daysLeft = vault ? Math.max(0, (paidThrough - Date.now() / 1000) / 86400) : 0;

  return (
    <div className="card">
      <h3>Live on devnet · real transactions</h3>

      {step === "loading" && <div className="muted">connecting to backend…</div>}

      {step !== "loading" && (
        <>
          <div className="statusline">
            <span className={"status s-" + (step === "active" ? "ACTIVE" : step === "done" ? "TRIAL" : "UNSUBSCRIBED")}>
              {step.toUpperCase()}
            </span>
            {step === "active" && <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--dim)" }}>rate {fmt(rate)} · keeper harvesting</span>}
          </div>

          <div className={"gate" + (step === "active" ? " open" : "")}>
            {step === "active"
              ? <><div className="lock">🔓</div><div className="premium" style={{ color: "var(--green)" }}>Premium unlocked — live</div>
                  <div className="muted">access funded for {daysLeft.toFixed(1)} more days by your yield</div></>
              : <><div className="lock">🔒</div><div className="premium">{step === "done" ? "Withdrawn — principal returned" : "Premium locked"}</div>
                  <div className="muted">{step === "done" ? "your demoSOL is back in your burner wallet" : "fund a burner wallet, then subscribe with yield"}</div></>}
          </div>

          {(step === "active" || step === "done") && (
            <div className="stats">
              <div className="stat"><div className="k">principal</div><div className="v green">{fmt(principalSol, 2)} SOL</div><div className="muted" style={{ marginTop: 4 }}>preserved</div></div>
              <div className="stat"><div className="k">LST in vault</div><div className="v">{fmt(depositedLst, 3)}</div><div className="muted" style={{ marginTop: 4 }}>shrinks as yield is skimmed</div></div>
              <div className="stat"><div className="k">→ dApp earned</div><div className="v gold">{fmt(dappEarned, 4)}</div><div className="muted" style={{ marginTop: 4 }}>demoSOL, live</div></div>
              <div className="stat"><div className="k">access paid-through</div><div className="v blue">{daysLeft.toFixed(0)}d</div><div className="muted" style={{ marginTop: 4 }}>extends each harvest</div></div>
            </div>
          )}

          {step === "idle" && <button className="btn btn-primary" onClick={fund}>① Start live demo (fund burner)</button>}
          {step === "funding" && <button className="btn btn-primary" disabled>funding…</button>}
          {step === "funded" && <button className="btn btn-primary" onClick={deposit}>② Deposit {DEPOSIT} demoSOL &amp; subscribe</button>}
          {step === "depositing" && <button className="btn btn-primary" disabled>depositing…</button>}
          {step === "active" && <button className="btn btn-ghost" onClick={withdraw}>③ Unsubscribe &amp; withdraw principal</button>}
          {step === "withdrawing" && <button className="btn btn-ghost" disabled>withdrawing…</button>}
          {step === "done" && <button className="btn btn-ghost" onClick={reset}>Run again (new burner)</button>}

          {msg && <p className="muted" style={{ color: msg.includes("fail") || msg.includes("error") ? "#ff5566" : "var(--dim)" }}>{msg}</p>}

          {txs.length > 0 && <div style={{ marginTop: 14 }}>
            {txs.map((t, i) => <div className="kv" key={i}><span className="key">{t.label}</span><a href={ex(t.sig)} target="_blank">{t.sig.slice(0, 8)}… ↗</a></div>)}
          </div>}

          <p className="muted">A throwaway burner wallet runs the real flow on devnet — deposit, the keeper harvests your yield to the dApp, then you reclaim your full principal. No extension needed.</p>
        </>
      )}
    </div>
  );
}
