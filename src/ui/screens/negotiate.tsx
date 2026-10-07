// The negotiation room: build a real offer (length, money, guarantees, signing
// bonus, void years), see what it does to the cap year by year and where it ranks
// against the position's top contracts, and go back and forth with his agent.
import { useEffect, useMemo, useRef, useState } from 'react';
import { app, useApp } from '../store';
import { Face, Ovr, Logo, DevBadge } from '../components';
import type { Player } from '../../core/types';
import { capSpace, money, yearsLeft, apy as contractApy, marketValue } from '../../core/contracts';
import { offerScore, type Offer } from '../../core/offseason';
import { agentFor, talkFor, submit, walkAway, capPreview, topContracts, pitch, market, describe, type Verdict } from '../../core/negotiate';
import { news } from '../../core/season';
import { freeNumber } from '../../core/draft';

export function NegotiationRoom({ p, close }: { p: Player; close: () => void }) {
  const L = useApp().league!;
  const extend = p.team === L.user && yearsLeft(p.contract, L.season) >= 1 && !p.contract.years.some(y => y.s === L.season && y.v);
  const agent = agentFor(p);
  const [talk] = useState(() => talkFor(L, p));
  const [, force] = useState(0);
  const d = talk.demand;
  const [o, setO] = useState<Offer>(() => ({ ...d, apy: Math.round(d.apy * 0.9 / 50_000) * 50_000, bonus: d.bonus ?? 0.6, voids: 0 }));
  const [done, setDone] = useState<Verdict | null>(null);
  const set = (k: Partial<Offer>) => setO(x => ({ ...x, ...k }));
  const score = offerScore(L, p, o, L.user);
  const floor = walkAway(L, p);
  // Deal meter: 0 at well under his walk-away number, 1 at the agent's current number.
  const meter = Math.max(0, Math.min(1, (score - (floor - 0.12)) / Math.max(0.01, talk.target - (floor - 0.12))));
  const preview = capPreview(L, p, o, extend);
  const space = capSpace(L, L.user);
  const comps = topContracts(L, p.pos, 6);
  const rank = comps.filter(c => c.apy > o.apy).length + 1;
  const mkt = L.phase === 'freeagency' ? market(L, p) : null;
  const rivals = mkt?.offers.filter(x => x.o.team !== L.user) ?? [];
  const range = { lo: Math.round(d.apy * 0.45 / 50_000) * 50_000, hi: Math.round(d.apy * 1.5 / 50_000) * 50_000 };
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: 1e6, behavior: 'smooth' }); }, [talk.log.length]);

  const send = () => {
    const v = submit(L, p, o, { extend });
    if (v.kind === 'accept') {
      if (!extend) p.num = p.num && !Object.values(L.players).some(q => q !== p && q.team === L.user && q.num === p.num) ? p.num : freeNumber(L, L.user, p.pos);
      news(L, 'sign', `${L.teams[L.user].nick} ${extend ? 'extended' : L.phase === 'resign' ? 're-signed' : 'signed'} ${p.pos} ${p.fn} ${p.ln}: ${o.years} years, ${money(o.apy * o.years)}.`, [L.user], { pid: p.id, big: p.ovr >= 84 });
      setDone(v);
    } else if (v.kind === 'cap') app.toast(v.text);
    if (v.kind === 'walk') setDone(v);
    app.touch(); force(n => n + 1);
  };

  return (
    <div className="modal-bg" onClick={close}>
      <div className="negroom" onClick={e => e.stopPropagation()}>
        <header className="neg-head">
          <div className="row" style={{ gap: 16 }}>
            <div className="neg-face"><Face p={p} size={104} /></div>
            <div>
              <div className="up dim">{extend ? 'Contract Extension' : L.phase === 'freeagency' ? `Free Agency · Day ${L.fa?.day}` : L.phase === 'resign' ? 'Re-sign' : 'Free Agent'}</div>
              <div className="h1" style={{ margin: 0 }}>{p.fn} {p.ln}</div>
              <div className="row small dim" style={{ gap: 8 }}><b>{p.pos}</b>· {Math.floor(p.age)} yrs · {p.arch} <DevBadge d={p.dev} />
                {p.team !== 'FA' && <><Logo team={L.teams[p.team]} size={20} /> {extend ? `Current ${money(contractApy(p.contract))}/yr through ${Math.max(...p.contract.years.filter(y => !y.v).map(y => y.s))}` : ''}</>}
              </div>
            </div>
            <Ovr v={p.ovr} lg />
          </div>
          <div className="spacer" />
          <div className="agent">
            <div className="agent-av">{agent.name.split(' ').map(s => s[0]).join('')}</div>
            <div>
              <div className="up dim">Agent · {agent.agency}</div>
              <div className="h3" style={{ margin: 0 }}>{agent.name}</div>
              <div className="row small" style={{ gap: 8 }}><span className={`style-tag ${agent.style.replace(/\W/g, '')}`}>{agent.style}</span>
                <span className="dim">Patience</span><span className="pips">{Array.from({ length: agent.patience }, (_, i) => <i key={i} className={i < talk.patience ? 'on' : ''} />)}</span></div>
            </div>
          </div>
          <button className="btn ghost sm" onClick={close} style={{ alignSelf: 'flex-start' }}>✕</button>
        </header>

        <div className="neg-body">
          {/* ---- offer builder ---- */}
          <section className="card neg-col">
            <div className="h3">Your Offer</div>
            <div className="up dim">Length</div>
            <div className="row" style={{ gap: 6, margin: '6px 0 14px' }}>{[1, 2, 3, 4, 5, 6].map(y => <span key={y} className={`chip${o.years === y ? ' on' : ''}`} onClick={() => set({ years: y, voids: Math.min(o.voids ?? 0, Math.max(0, 5 - y)) })}>{y} yr</span>)}</div>
            <Slider label="Average per year" v={o.apy} min={range.lo} max={range.hi} step={50_000} fmt={money} on={v => set({ apy: v })} mark={d.apy} />
            <Slider label={`Guaranteed · ${money(o.apy * o.years * o.gtd)}`} v={Math.round(o.gtd * 100)} min={0} max={100} step={1} fmt={v => `${v}%`} on={v => set({ gtd: v / 100 })} mark={Math.round(d.gtd * 100)} />
            <Slider label={`Signing bonus · ${money(o.apy * o.years * o.gtd * (o.bonus ?? 0.55))}`} v={Math.round((o.bonus ?? 0.55) * 100)} min={0} max={100} step={5} fmt={v => `${v}% of gtd`} on={v => set({ bonus: v / 100 })} />
            <div className="up dim" style={{ marginTop: 10 }}>Void years <span className="mute">(spread bonus proration, dead money later)</span></div>
            <div className="row" style={{ gap: 6, margin: '6px 0 14px' }}>{[0, 1, 2, 3].map(v => <span key={v} className={`chip${(o.voids ?? 0) === v ? ' on' : ''}${o.years + v > 5 && v ? ' off' : ''}`} onClick={() => o.years + v <= 5 && set({ voids: v })}>{v}</span>)}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" onClick={() => setO({ ...talk.demand, voids: o.voids })}>Match Their Ask</button>
              <button className="btn sm" onClick={() => set({ apy: Math.round((o.apy + talk.demand.apy) / 2 / 50_000) * 50_000 })}>Split the Difference</button>
            </div>
            <div className="neg-total"><span className="up dim">Total value</span><span className="num">{money(o.apy * o.years)}</span></div>
          </section>

          {/* ---- cap + market ---- */}
          <section className="card neg-col">
            <div className="h3">Cap Impact</div>
            <table className="tbl small"><thead><tr><th>Season</th><th className="r">Base</th><th className="r">Bonus</th><th className="r">Cap Hit</th></tr></thead>
              <tbody>{preview.map(y => <tr key={y.s} style={y.v ? { color: 'var(--warn)' } : undefined}><td>{y.s}{y.v ? ' (void)' : ''}</td><td className="r">{money(y.base)}</td><td className="r">{money(y.bonus)}</td><td className="r"><b>{money(y.hit)}</b></td></tr>)}</tbody></table>
            <div className="row small" style={{ margin: '8px 0 14px' }}><span className="dim">{extend ? 'This season unchanged · space' : `Space after signing (${L.season})`}</span><div className="spacer" />
              <b className={space - (extend ? 0 : preview[0]?.hit ?? 0) < 0 ? 'bad' : 'good'}>{money(space - (extend ? 0 : preview[0]?.hit ?? 0))}</b></div>
            <div className="h3">{p.pos} Market</div>
            <div className="comps">
              {comps.map((c, i) => <div key={c.p.id} className="comp"><span className="small">{i + 1}. {c.p.fn[0]}. {c.p.ln}</span><span className="cbar"><b style={{ width: `${(c.apy / Math.max(comps[0]?.apy ?? 1, o.apy)) * 100}%` }} /></span><span className="small num">{money(c.apy)}</span></div>)}
              <div className="comp you"><span className="small">Your offer</span><span className="cbar"><b style={{ width: `${(o.apy / Math.max(comps[0]?.apy ?? 1, o.apy)) * 100}%` }} /></span><span className="small num">{money(o.apy)}</span></div>
            </div>
            <div className="small dim" style={{ marginTop: 6 }}>{rank <= 6 ? `Would rank No. ${rank} at the position.` : `Market value about ${money(marketValue(p, L.season))}/yr.`}</div>
            {mkt && <>
              <div className="h3" style={{ marginTop: 14 }}>Suitors</div>
              {rivals.length ? <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{rivals.slice(0, 6).map((x, i) => <span key={x.o.team} className={`suitor${i === 0 ? ' lead' : ''}`}><Logo team={L.teams[x.o.team]} size={26} />{i === 0 && <em>Leader</em>}</span>)}</div> : <div className="small dim">No other offers yet.</div>}
              {rivals[0] && <div className="small dim" style={{ marginTop: 6 }}>His agent says the best offer is "in the {money(Math.round(rivals[0].o.apy / 1e6) * 1e6)} range" per year.</div>}
            </>}
          </section>

          {/* ---- the conversation ---- */}
          <section className="card neg-col neg-talk">
            <Gauge v={meter} />
            <div className="small dim c" style={{ marginTop: -6 }}>{meter >= 0.99 ? 'He will sign this' : meter > 0.75 ? 'Close' : meter > 0.45 ? 'Within range' : meter > 0.2 ? 'Far apart' : 'He would be insulted'}</div>
            <div className="up dim" style={{ marginTop: 10 }}>What matters to him</div>
            <div className="motivs">{pitch(L, p, L.user).map(m => <span key={m.k} className={m.good > 0.6 ? 'good' : m.good < 0.35 ? 'bad' : ''}>{m.good > 0.6 ? '▲' : m.good < 0.35 ? '▼' : '●'} {m.k}</span>)}</div>
            <div className="chat" ref={log}>
              {talk.log.map((m, i) => <div key={i} className={`bubble ${m.by}`}>{m.by === 'agent' && <b>{agent.name.split(' ')[1]}: </b>}{m.text}</div>)}
            </div>
            <div className="demand"><span className="up dim">Their number</span><span>{describe(talk.demand)}</span></div>
          </section>
        </div>

        <footer className="row neg-foot">
          <span className="small dim">{talk.closed ? 'Talks have broken down.' : `${talk.patience} offer${talk.patience === 1 ? '' : 's'} before he walks${talk.patience === 1 ? ' — make it count' : ''}`}</span>
          <div className="spacer" />
          <button className="btn ghost" onClick={close}>Leave Table</button>
          <button className="btn primary big" disabled={talk.closed || talk.agreed} onClick={send}>Submit Offer</button>
        </footer>

        {done && (
          <div className={`neg-done ${done.kind}`} onClick={close}>
            <div className="stamp">{done.kind === 'accept' ? 'SIGNED' : 'TALKS OFF'}</div>
            <div className="h2">{done.kind === 'accept' ? `${p.fn} ${p.ln}` : done.text}</div>
            {done.kind === 'accept' && <div className="dim">{describe(o)}</div>}
            <div className="small mute" style={{ marginTop: 14 }}>Click to continue</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Slider({ label, v, min, max, step, fmt, on, mark }: { label: string; v: number; min: number; max: number; step: number; fmt: (v: number) => string; on: (v: number) => void; mark?: number }) {
  return (
    <div className="slider">
      <div className="row"><span className="up dim">{label}</span><div className="spacer" /><b className="num">{fmt(v)}</b></div>
      <div className="track">
        {mark !== undefined && <span className="mark" style={{ left: `${((mark - min) / (max - min)) * 100}%` }} title={`Their ask: ${fmt(mark)}`} />}
        <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(+e.target.value)} />
      </div>
    </div>
  );
}

/** Semicircle deal meter. */
function Gauge({ v }: { v: number }) {
  const a = Math.PI * (1 - v);
  const x = 100 + 80 * Math.cos(a), y = 100 - 80 * Math.sin(a);
  const col = v >= 0.99 ? 'var(--good)' : v > 0.6 ? '#9be15d' : v > 0.35 ? 'var(--warn)' : 'var(--bad)';
  const id = useMemo(() => `g${Math.random().toString(36).slice(2, 7)}`, []);
  return (
    <svg viewBox="0 0 200 112" className="gauge">
      <defs><linearGradient id={id}><stop offset="0" stopColor="#ff4d5e" /><stop offset=".55" stopColor="#ffb020" /><stop offset="1" stopColor="#2fd17b" /></linearGradient></defs>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#232a35" strokeWidth="14" />
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={`url(#${id})`} strokeWidth="14" strokeDasharray={`${251.3 * v} 400`} style={{ transition: 'stroke-dasharray .35s ease' }} />
      <line x1="100" y1="100" x2={x} y2={y} stroke={col} strokeWidth="4" strokeLinecap="round" style={{ transition: 'all .35s ease' }} />
      <circle cx="100" cy="100" r="7" fill={col} />
      <text x="100" y="80" textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff" fontFamily="Barlow Condensed">{Math.round(v * 100)}%</text>
      <text x="100" y="58" textAnchor="middle" fontSize="9" letterSpacing="2" fill="#9aa3b5">DEAL METER</text>
    </svg>
  );
}
