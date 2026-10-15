// The negotiation room: build a real offer (length, money, guarantees, signing
// bonus, void years), see what it does to the cap year by year and where it ranks
// against the position's top contracts, and go back and forth with his agent.
import { useEffect, useRef, useState } from 'react';
import { shownDev } from '../../core/devreveal';
import { createPortal } from 'react-dom';
import { app, useApp } from '../store';
import { Face, Ovr, Logo, DevBadge } from '../components';
import type { Player } from '../../core/types';
import { capSpace, money, yearsLeft, apy as contractApy, marketValue } from '../../core/contracts';
import { offerScore, type Offer } from '../../core/offseason';
import { agentFor, talkFor, submit, walkAway, capPreview, topContracts, pitch, market, describe, readOffer, type Verdict, type NegRead } from '../../core/negotiate';
import './negotiate.css';
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
  const floor = walkAway(L, p);
  // No live meter: you only learn where you stand from how he reacts to what you send.
  const lastMine = [...talk.log].reverse().find(m => m.by === 'you' && m.offer)?.offer;
  const read: NegRead | null = talk.agreed ? 'close' : lastMine ? readOffer(offerScore(L, p, lastMine, L.user), floor, talk.target) : null;
  const sent = talk.log.filter(m => m.by === 'you').length;
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

  // Portal to <body>: screens animate in with transforms, which would trap the modal under the ticker.
  return createPortal(
    <div className="modal-bg" onClick={close}>
      <div className="negroom" onClick={e => e.stopPropagation()}>
        <header className="neg-head">
          <div className="row" style={{ gap: 16 }}>
            <div className="neg-face"><Face p={p} size={120} />{!extend && p.team !== L.user && <span className="neg-em"><FaEmblem size={46} /></span>}</div>
            <div>
              <div className="up dim">{extend ? 'Contract Extension' : L.phase === 'freeagency' ? `Free Agency · Day ${L.fa?.day}` : L.phase === 'resign' ? 'Re-sign' : 'Free Agent'}</div>
              <div className="h1" style={{ margin: 0 }}>{p.fn} {p.ln}</div>
              <div className="row small dim" style={{ gap: 8 }}><b>{p.pos}</b>· {Math.floor(p.age)} yrs · {p.arch} <DevBadge d={shownDev(p)} />
                {p.team !== 'FA' && <><Logo team={L.teams[p.team]} size={20} /> {extend ? `Current ${money(contractApy(p.contract))}/yr through ${Math.max(...p.contract.years.filter(y => !y.v).map(y => y.s))}` : ''}</>}
              </div>
            </div>
            <Ovr v={p.ovr} lg />
            <div className={`neg-mood m-${moodOf(p.morale).k}`}><i>{moodOf(p.morale).icon}</i><span>Mood</span><b>{moodOf(p.morale).t}</b></div>
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
            <div className="h3">What Drives Him</div>
            <div className="neg-why">{pitch(L, p, L.user).map(m => { const f = m.good > 0.6 ? 'good' : m.good < 0.35 ? 'bad' : 'mid'; return (
              <div key={m.k} className={`nw ${f}`}><i>{f === 'good' ? '▲' : f === 'bad' ? '▼' : '●'}</i><div><b>{m.k}</b><span>{whyText(m.k, f, L.teams[L.user].nick)}</span></div></div>); })}</div>
            <div className="h3" style={{ marginTop: 12 }}>Leverage</div>
            <ul className="neg-lev">{leverage(L, p, extend, rivals.length).map((x, i) => <li key={i} className={x.side}>{x.t}</li>)}</ul>
            <div className="h3" style={{ marginTop: 12 }}>Cap Impact</div>
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
            <div className={`neg-read r-${read ?? 'none'}`}>
              <span>{agent.name.split(' ')[1]}'s read</span>
              <div className="neg-pips">{(['insult', 'far', 'range', 'close'] as const).map((r, i) => <i key={r} className={read && i <= ['insult', 'far', 'range', 'close'].indexOf(read) ? 'on' : ''} />)}</div>
              <b>{read ? READ_TEXT[read] : 'Waiting on your first offer'}</b>
              <em>{read === 'close' && !talk.agreed ? 'He could say yes to something like this. Or push for more.' : read === 'range' ? 'There is a deal in this neighborhood.' : read === 'far' ? 'You will need to move a lot.' : read === 'insult' ? 'That one cost you some goodwill.' : talk.agreed ? 'Deal done.' : 'He does not need his full ask, but he will not tell you his bottom line.'}</em>
            </div>
            <div className="chat" ref={log}>
              {talk.log.map((m, i) => <div key={i} className={`bubble ${m.by}`}>{m.by === 'agent' && <b>{agent.name.split(' ')[1]}: </b>}{m.text}</div>)}
            </div>
            <div className="demand"><span className="up dim">Their number</span><span>{describe(talk.demand)}</span></div>
          </section>
        </div>

        <footer className="row neg-foot">
          <span className="small dim">{talk.closed ? 'Talks have broken down.' : `Offers sent: ${sent}. ${talk.patience <= 1 ? 'He is close to walking away. Make it count.' : talk.patience <= 2 ? 'His patience is wearing thin.' : 'Lowballs burn his patience; serious, rising offers do not.'}`}</span>
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
    </div>,
    document.body,
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

const READ_TEXT: Record<NegRead, string> = { insult: 'Insulted', far: 'Far apart', range: 'In range', close: 'Very close' };

function moodOf(m: number) {
  return m >= 80 ? { k: 'great', t: 'Loves it here', icon: '😀' } : m >= 60 ? { k: 'good', t: 'Content', icon: '🙂' } : m >= 45 ? { k: 'mid', t: 'Restless', icon: '😐' } : { k: 'bad', t: 'Unhappy', icon: '😠' };
}

function whyText(k: string, f: 'good' | 'mid' | 'bad', nick: string): string {
  const T: Record<string, [string, string, string]> = {
    'Highest Offer': ['The money talks. Pay him and he signs.', 'The money talks. Pay him and he signs.', 'The money talks. Pay him and he signs.'],
    Contender: [`He sees the ${nick} winning now.`, 'He is not sold you can win now.', `He doesn't think the ${nick} can win.`],
    'Scheme Fit': ['Your system suits his game.', 'Your scheme is a so-so fit.', 'He doesn\'t fit what you run.'],
    'Starting Role': ['He would start for you.', 'He would have to compete for the job.', 'He sees himself as a backup here.'],
    'Big Market': ['He likes the spotlight here.', 'Mid-sized market. He\'s indifferent.', 'He wants a bigger stage.'],
    'Warm Weather': ['Warm weather. He\'s in.', 'The climate is fine.', 'He hates the cold.'],
    Loyalty: ['He wants to stay where he is.', 'Loyalty is on his mind.', 'He has no ties to you.'],
    'Winning Culture': ['He respects your history.', 'Your history is average.', 'Your track record worries him.'],
  };
  const row = T[k] ?? ['Works for you.', 'Neutral.', 'Works against you.'];
  return f === 'good' ? row[0] : f === 'mid' ? row[1] : row[2];
}

function leverage(L: NonNullable<ReturnType<typeof useApp>['league']>, p: Player, extend: boolean, rivals: number) {
  const out: { t: string; side: 'him' | 'you' }[] = [];
  if (rivals) out.push({ t: `${rivals} other team${rivals > 1 ? 's have' : ' has'} an offer in. His agent will use it.`, side: 'him' });
  if (L.phase === 'freeagency' && (L.fa?.day ?? 1) > 2) out.push({ t: `Day ${L.fa?.day} of free agency. The money is drying up.`, side: 'you' });
  if (L.phase === 'regular' && p.team === 'FA') out.push({ t: 'It\'s the season and he is unsigned. He wants a job.', side: 'you' });
  if (p.morale < 45) out.push({ t: 'He is unhappy, so it will cost more to keep him.', side: 'him' });
  else if (p.morale > 80) out.push({ t: 'He loves it here. That buys you a little room.', side: 'you' });
  if (p.age >= 30) out.push({ t: `At ${Math.floor(p.age)}, guarantees and length matter more than the yearly number.`, side: 'you' });
  else if (p.age <= 25 && p.ovr >= 80) out.push({ t: 'Young and ascending. He knows the next deal is the big one.', side: 'him' });
  if (extend) out.push({ t: `He is under contract through ${Math.max(...p.contract.years.filter(y => !y.v).map(y => y.s))}. No rush on his side.`, side: 'him' });
  if (p.ovr >= 86) out.push({ t: 'He is a star at his position and every team knows it.', side: 'him' });
  if (!out.length) out.push({ t: 'Neither side has much leverage. It comes down to the offer.', side: 'you' });
  return out.slice(0, 4);
}

/** An original free agent emblem: a signed contract and pen inside a gold seal. */
export function FaEmblem({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="fa-em">
      <defs><linearGradient id="faG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b8" /><stop offset=".45" stopColor="#f2c230" /><stop offset="1" stopColor="#a87a10" /></linearGradient></defs>
      <circle cx="50" cy="50" r="46" fill="#0d1320" stroke="url(#faG)" strokeWidth="5" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="url(#faG)" strokeWidth="1" strokeDasharray="2 3" opacity=".8" />
      <rect x="30" y="24" width="34" height="44" rx="3" fill="#e9edf5" transform="rotate(-8 47 46)" />
      <g transform="rotate(-8 47 46)" stroke="#8a93a6" strokeWidth="2.2" strokeLinecap="round"><path d="M36 33h22M36 40h22M36 47h16" /><path d="M36 59c4-5 6 3 10-2s5 2 9-1" stroke="#1d3b8a" /></g>
      <path d="M70 26l6 6-22 22-8 2 2-8z" fill="url(#faG)" stroke="#5b4206" strokeWidth="1.2" />
      <text x="50" y="86" textAnchor="middle" fontFamily="var(--head), Impact, sans-serif" fontWeight="900" fontSize="15" letterSpacing="3" fill="url(#faG)">★FA★</text>
    </svg>
  );
}
