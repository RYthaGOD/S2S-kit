import { useEffect, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { Sandbox, SandboxState } from "./sandbox";
import { LiveDemo } from "./LiveDemo";

const PROGRAM_ID = "7EeAMD5jwS2Zi5GbwkiuqJvQMK4yDT2qTdMh5HrjatbD";
const RPC = "https://api.devnet.solana.com";
const explorer = (kind: string, id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
const DEPOSIT = 6; // jitoSOL
const fmt = (n: number, d = 4) => n.toFixed(d);

// ---- live devnet panel: read the deployed GlobalConfig ----
interface LiveConfig { feeBps: number; passMint: string; totalDapps: number; totalLsts: number; }

function useLiveConfig() {
  const [state, setState] = useState<{ ok: boolean; loading: boolean; cfg?: LiveConfig }>({ ok: false, loading: true });
  useEffect(() => {
    (async () => {
      try {
        const conn = new Connection(RPC, "confirmed");
        const programId = new PublicKey(PROGRAM_ID);
        const seed = new TextEncoder().encode("global_config");
        const [config] = PublicKey.findProgramAddressSync([seed], programId);
        const info = await conn.getAccountInfo(config);
        if (!info) { setState({ ok: false, loading: false }); return; }
        const d = new Uint8Array(info.data);
        const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
        const cfg: LiveConfig = {
          feeBps: dv.getUint16(40, true),
          passMint: new PublicKey(d.subarray(74, 106)).toBase58(),
          totalDapps: Number(dv.getBigUint64(114, true)),
          totalLsts: dv.getUint16(122, true),
        };
        setState({ ok: true, loading: false, cfg });
      } catch {
        setState({ ok: false, loading: false });
      }
    })();
  }, []);
  return state;
}

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

function LivePanel() {
  const { ok, loading, cfg } = useLiveConfig();
  return (
    <div className="card">
      <h3>Live on devnet</h3>
      <div className="statusline">
        <span className={"dot" + (ok ? "" : " red")} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
          {loading ? "querying chain…" : ok ? "program responding" : "unreachable"}
        </span>
      </div>
      <div className="kv"><span className="key">program</span><a href={explorer("address", PROGRAM_ID)} target="_blank">{short(PROGRAM_ID)} ↗</a></div>
      {cfg && <>
        <div className="kv"><span className="key">protocol fee</span><span>{(cfg.feeBps / 100).toFixed(2)}%</span></div>
        <div className="kv"><span className="key">soulbound pass</span><a href={explorer("address", cfg.passMint)} target="_blank">{short(cfg.passMint)} ↗</a></div>
        <div className="kv"><span className="key">registered dApps</span><span>{cfg.totalDapps}</span></div>
        <div className="kv"><span className="key">allow-listed LSTs</span><span>{cfg.totalLsts}</span></div>
      </>}
      <p className="muted">
        These values are read live from the deployed Anchor program on Solana devnet —
        the same protocol the interactive demo simulates. The pass mint uses Token-2022's
        NonTransferable extension (soulbound).
      </p>
    </div>
  );
}

// ---- interactive (no-wallet) demo, powered by the verified sandbox engine ----
function Demo() {
  const engine = useRef(new Sandbox({ feeBps: 400, apy: 0.074, trialDays: 7, priceSolPerMonth: 0.03 }));
  const [s, setS] = useState<SandboxState>(engine.current.state());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      engine.current.tick();
      const st = engine.current.state();
      setS(st);
      if (st.monthsElapsed >= 36) setRunning(false);
    }, 700);
    return () => clearInterval(id);
  }, [running]);

  const subscribe = () => { engine.current.subscribe(DEPOSIT); setS(engine.current.state()); setRunning(true); };
  const exit = () => {
    engine.current.withdraw();
    engine.current = new Sandbox({ feeBps: 400, apy: 0.074, trialDays: 7, priceSolPerMonth: 0.03 });
    setRunning(false); setS(engine.current.state());
  };

  const subscribed = s.status !== "UNSUBSCRIBED";
  const maxDapp = 1.2;

  return (
    <div className="card">
      <h3>Try it · instant, no wallet</h3>
      <div className="statusline">
        <span className={"status s-" + s.status}>{s.status}</span>
        {subscribed && <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--dim)" }}>
          month {s.monthsElapsed} · jitoSOL rate {fmt(s.rate)}
        </span>}
      </div>

      <div className={"gate" + (s.hasAccess ? " open" : "")}>
        {s.hasAccess
          ? <><div className="lock">🔓</div><div className="premium" style={{ color: "var(--green)" }}>Premium unlocked</div>
              <div className="muted">Your staking yield is paying for this — principal untouched.</div></>
          : <><div className="lock">🔒</div><div className="premium">Premium locked</div>
              <div className="muted">Subscribe with yield to unlock.</div></>}
      </div>

      <div className="stats">
        <div className="stat"><div className="k">your principal</div><div className="v green">{fmt(subscribed ? s.principalSol : DEPOSIT, 2)} SOL</div><div className="muted" style={{ marginTop: 4 }}>locked · returned in full</div></div>
        <div className="stat"><div className="k">access funded</div><div className="v blue">{Math.round(s.daysFunded)}d</div><div className="muted" style={{ marginTop: 4 }}>vs {Math.round(s.daysElapsed)}d elapsed</div></div>
        <div className="stat"><div className="k">→ dApp earned</div><div className="v gold">{fmt(s.dappTreasuryLst)}</div><div className="bar"><div style={{ width: `${Math.min(100, (s.dappTreasuryLst / maxDapp) * 100)}%` }} /></div></div>
        <div className="stat"><div className="k">→ protocol cut</div><div className="v">{fmt(s.protocolTreasuryLst)}</div><div className="muted" style={{ marginTop: 4 }}>4% · ships at 0</div></div>
      </div>

      {!subscribed
        ? <button className="btn btn-primary" onClick={subscribe}>Subscribe with {DEPOSIT} jitoSOL</button>
        : <div className="row">
            <button className="btn btn-ghost" onClick={() => setRunning(r => !r)}>{running ? "Pause time" : "Resume time"}</button>
            <button className="btn btn-ghost" onClick={exit}>Unsubscribe &amp; withdraw</button>
          </div>}
      <p className="muted">Time is accelerated (1 tick ≈ 1 month) so you can watch the yield accrue. The math mirrors the on-chain program exactly.</p>
    </div>
  );
}

export function App() {
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  return (
    <div className="wrap">
      <nav className="nav">
        <div className="logo">S2S<span>.KIT</span></div>
        <a className="pill" href={explorer("address", PROGRAM_ID)} target="_blank"><span className="dot" /> Live on devnet</a>
      </nav>

      <header className="hero">
        <h1>Spend your <em>yield</em>,<br />not your money.</h1>
        <p>Non-custodial staking-yield routing on Solana — keep your principal.</p>
      </header>

      <div className="toggle">
        <button className={mode === "sandbox" ? "on" : ""} onClick={() => setMode("sandbox")}>⚡ Sandbox · instant</button>
        <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>🔗 Live devnet · real tx</button>
      </div>

      <div className="grid">
        {mode === "sandbox" ? <Demo /> : <LiveDemo />}
        <LivePanel />
      </div>

      <div className="foot">
        S2S-Kit · deposit an LST, route the appreciation to apps / creators / DAOs, withdraw your principal anytime.
      </div>
    </div>
  );
}
