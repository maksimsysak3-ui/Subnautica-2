// The Trades tab: builder, block, finder, incoming offers, history and the pick chart.
import { useEffect, useRef, useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Table, PlayerCell, Face } from '../components';
import { standings } from '../../core/season';
import { TradeOfferCard } from './league';
import type { Player, TradeOffer } from '../../core/types';
import { capHit, capSpace, money, yearsLeft } from '../../core/contracts';
import { TradeAlert } from '../tradealert';
import { evaluateTrade, executeTrade, noteRejection, patience, pickLabel, pickTradeValue, pickValue, projectedSlot, tradable, whatWouldItTake } from '../../core/trade';
import { gmOf, gmLine, readOf, READ_LABEL, noteFollowup, clearFollowup, dueFollowups, tradeDraft, setTradeDraft, type Read } from '../../core/tradetalk';
import { hash } from '../../core/rng';
import './tradecenter.css';
import combineLogo from '../assets/combine.png';
import { FaceArt } from '../face';
import { positionNeeds } from '../../core/draft';
import { POS_ORDER } from '../../core/ratings';
// ---- the trade center -------------------------------------------------------------------
type Side = { players: string[]; picks: string[] };
const EMPTY: Side = { players: [], picks: [] };
type LG = NonNullable<ReturnType<typeof useApp>['league']>;

/** The Trade Center: three ways in (find a player, shop your own, sit down at the table),
 *  what's waiting on you, and the league's GMs to call. */
export function TradeCenter() {
  const L = useApp().league!;
  const offers = L.inbox.filter(m => m.action?.kind === 'trade' && !m.read).length;
  const calls = dueFollowups(L).length;
  const deadline = L.phase === 'regular' ? (L.week > L.tradeDeadlineWeek ? 'The deadline has passed' : `Deadline after week ${L.tradeDeadlineWeek}`) : L.phase === 'draft' ? 'Draft day: picks are live' : 'Offseason trading is open';
  const others = Object.keys(L.teams).filter(t => t !== L.user).sort((a, b) => L.teams[a].name.localeCompare(L.teams[b].name));
  const tiles: { id: 'finder' | 'block' | 'trade'; t: string; d: string; icon: string }[] = [
    { id: 'finder', t: 'Trade Finder', d: 'Search every roster in the league and go after the player you want.', icon: '⌕' },
    { id: 'block', t: 'Trade Block', d: 'Shop your players and see which teams come calling with packages.', icon: '▤' },
    { id: 'trade', t: 'Make a Trade', d: 'Sit down with any GM and build a deal across the table.', icon: '⇄' },
  ];
  return (
    <div className="tc">
      <header className="tc-head"><div><div className="tc-kicker">Front office</div><h1>Trade Center</h1></div><span className={`tc-dl${L.phase === 'regular' && L.week > L.tradeDeadlineWeek ? ' closed' : ''}`}>{deadline}</span></header>
      <div className="tc-tiles">{tiles.map((x, i) => (
        <button key={x.id} className="tc-tile" style={{ animationDelay: `${i * 0.09}s` }} onClick={() => app.go({ id: x.id } as Parameters<typeof app.go>[0])}>
          <i className="tc-ic">{x.icon}</i><b>{x.t}</b><span>{x.d}</span><em>Open ▸</em>
        </button>))}</div>
      {(offers > 0 || calls > 0) && <button className="tc-alert" onClick={() => app.go({ id: 'offers' })}><b>{offers + calls}</b><span>{offers ? `${offers} offer${offers > 1 ? 's' : ''} waiting on you` : ''}{offers && calls ? ' · ' : ''}{calls ? `${calls} GM call-back${calls > 1 ? 's' : ''} in the weekly hub` : ''}</span><em>Review ▸</em></button>}
      <h3 className="tc-sub">The league's general managers</h3>
      <div className="tc-gms">{others.map((t, i) => { const g = gmOf(L, t), tm = L.teams[t]; return (
        <button key={t} className="tc-gm" style={{ '--tc': tm.colors[0], animationDelay: `${0.2 + i * 0.015}s` } as React.CSSProperties} onClick={() => app.go({ id: 'trade', team: t })}>
          <span className="tc-gmf"><GmFace L={L} team={t} size={40} /><Logo team={tm} size={18} /></span><div><b>{g.name}</b><span>{tm.nick} · {g.label}</span></div>
        </button>); })}</div>
    </div>
  );
}

/** A draft pick: the combine badge, with the round and the draft year on it. */
export function PickEmblem({ L, k, size = 46 }: { L: LG; k: { round: number; season: number; orig: string }; size?: number }) {
  const t = L.teams[k.orig];
  return (
    <span className="pk-em" style={{ width: size, height: size, '--pc': t?.colors[0] ?? '#1d3b8a' } as React.CSSProperties} aria-label={`${k.season} round ${k.round}`}>
      <img src={combineLogo} alt="" draggable={false} />
      <b style={{ fontSize: Math.max(9, size * 0.3) }}>{k.round}</b><i style={{ fontSize: Math.max(7, size * 0.17) }}>'{String(k.season).slice(2)}</i>
    </span>
  );
}

/** The other team's general manager, in a suit and a tie in his team's colour. */
export function GmFace({ L, team, size = 58 }: { L: LG; team: string; size?: number }) {
  const t = L.teams[team];
  const p = { id: `gm-${team}`, face: hash(`${L.seed}-gm-${team}`), pos: 'QB', col: '', status: 'ACT' } as unknown as Player;
  return (
    <div className="gm-face" style={{ width: size, height: size, '--tc': t.colors[0] } as React.CSSProperties}>
      <FaceArt p={p} team={t} size={size} suit />
    </div>
  );
}
const projText = (n: number) => (n <= 10 ? 'Projected top 10' : n <= 20 ? 'Projected mid round' : 'Projected late round');

type Line = { who: 'you' | 'gm'; text: string; read?: Read; counter?: TradeOffer };
/**
 * The trade room: you on the left, them on the right, their GM in the middle. You build a
 * deal and propose it; he answers in his own voice with how close it is (never a number)
 * and, when he can, a counter. Lowball him and he tires of you; walk away from a close
 * counter and he may call back next week.
 */
export function TradeScreen({ team, want }: { team?: string; want?: string }) {
  const L = useApp().league!;
  const others = Object.keys(L.teams).filter(t => t !== L.user).sort((a, b) => L.teams[a].name.localeCompare(L.teams[b].name));
  const draft = tradeDraft(L);
  const [other, setOther] = useState(team && team !== L.user ? team : draft?.to ?? others[0]);
  const [give, setGive] = useState<Side>(draft && draft.to === other ? draft.give : EMPTY);
  const [get, setGet] = useState<Side>(draft && draft.to === other ? draft.get : { players: want ? [want] : [], picks: [] });
  useEffect(() => { if (draft) setTradeDraft(L, undefined); }, []);
  const [log, setLog] = useState<Line[]>([]);
  const [done, setDone] = useState<TradeOffer | null>(null);
  const [shake, setShake] = useState(0);
  const offer: TradeOffer = { from: L.user, to: other, give, get };
  const any = give.players.length + give.picks.length + get.players.length + get.picks.length > 0;
  const gm = gmOf(L, other), tired = patience(L, other);
  const closed = tired >= 4;
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [log.length]);
  const toggle = (side: 'give' | 'get', kind: 'players' | 'picks', id: string) => {
    const [cur, set] = side === 'give' ? [give, setGive] : [get, setGet];
    set({ ...cur, [kind]: cur[kind].includes(id) ? cur[kind].filter(x => x !== id) : [...cur[kind], id] });
  };
  const switchTeam = (t: string) => { setOther(t); setGive(EMPTY); setGet(EMPTY); setLog([]); };
  const hits = (ids: string[]) => ids.reduce((a, id) => a + capHit(L.players[id].contract, L.season), 0);
  const myCapAfter = capSpace(L, L.user) + hits(give.players) - hits(get.players);
  const theirCapAfter = capSpace(L, other) - hits(give.players) + hits(get.players);
  const seed = () => (hash(`${other}-${L.week}-${log.length}`) >>> 0);
  const finish = (o: TradeOffer) => { executeTrade(L, o); clearFollowup(L, o.to); setDone(o); setGive(EMPTY); setGet(EMPTY); app.touch(); };
  const propose = () => {
    const v = evaluateTrade(L, offer, true);
    const you: Line = { who: 'you', text: `${describeSide(L, give)} for ${describeSide(L, get)}.` };
    if (/cap|deadline/.test(v.reason) && !v.accept) { setLog(l => [...l, you, { who: 'gm', text: v.reason }]); setShake(n => n + 1); return; }
    const margin = v.margin ?? 1.1;
    const read = readOf(v.ratio, margin, v.accept);
    if (v.accept) { setLog(l => [...l, you, { who: 'gm', text: gmLine(gm, 'deal', tired, false, seed()), read }]); setTimeout(() => finish(offer), 900); return; }
    noteRejection(L, other);
    if (v.counter) noteFollowup(L, other, v.counter);
    setLog(l => [...l, you, { who: 'gm', text: gmLine(gm, read, tired + 1, !!v.counter, seed()), read, counter: v.counter }]);
    setShake(n => n + 1); app.touch();
  };
  const ask = () => {
    const t = get.players[0];
    if (!t) { setLog(l => [...l, { who: 'gm', text: `Which of my guys are you asking about? Put him on the table.` }]); return; }
    const o = whatWouldItTake(L, L.user, other, t);
    if (o) { setGive(o.give); setLog(l => [...l, { who: 'you', text: `What would it take to get ${L.players[t].ln}?` }, { who: 'gm', text: `For ${L.players[t].ln}? I'd want ${describeSide(L, o.give)}.` }]); }
    else setLog(l => [...l, { who: 'you', text: `What would it take to get ${L.players[t].ln}?` }, { who: 'gm', text: `Honestly? You don't have what it would take.` }]);
  };
  const takeCounter = (c: TradeOffer) => {
    const v = evaluateTrade(L, c);
    if (!v.accept) { setLog(l => [...l, { who: 'gm', text: `That offer's gone. Things changed.` }]); return; }
    setLog(l => [...l, { who: 'you', text: `We'll take your counter.` }, { who: 'gm', text: gmLine(gm, 'deal', 0, false, seed()), read: 'deal' }]);
    setTimeout(() => finish(c), 900);
  };
  const lastRead = [...log].reverse().find(x => x.read)?.read;
  const tm = L.teams[other];
  return (
    <div className="tr2">
      <header className="tr2-top">
        <button className="btn ghost sm" onClick={() => app.go({ id: 'tradecenter' })}>◂ Trade Center</button>
        <h1>Trade Room</h1>
        <div className="tr2-strip">{others.map(t => <button key={t} className={t === other ? 'on' : ''} onClick={() => switchTeam(t)} title={L.teams[t].name}><Logo team={L.teams[t]} size={26} /></button>)}</div>
      </header>
      <div className="tr2-table">
        <section className="tr2-side me"><TeamHead L={L} abbr={L.user} you capAfter={any ? myCapAfter : undefined} /><Tray L={L} title="You send" side={give} onRemove={(k, id) => toggle('give', k, id)} /></section>
        <section className="tr2-gm" style={{ '--tc': tm.colors[0], '--tc2': tm.colors[1] ?? '#fff' } as React.CSSProperties}>
          <div className="tr2-gmh">
            <GmFace L={L} team={other} size={64} />
            <div><b>{gm.name}</b><span>General Manager · {tm.nick}</span><em className={`st-${gm.style}`}>{gm.label}</em></div>
          </div>
          <p className="tr2-blurb">{gm.blurb}</p>
          <div className={`tr2-read r-${lastRead ?? 'none'}`}>
            <span>His read</span>
            <div className="tr2-pips">{(['cold', 'listening', 'interested', 'close', 'deal'] as const).map((r, i) => <i key={r} className={lastRead && i <= ['cold', 'listening', 'interested', 'close', 'deal'].indexOf(lastRead) ? 'on' : ''} />)}</div>
            <b>{lastRead ? READ_LABEL[lastRead] : 'Make him an offer'}</b>
          </div>
          <div className="tr2-log" ref={logRef}>
            {!log.length && <p className="tr2-hint">{tired >= 2 ? `He's already turned you down ${tired} times this week.` : `Put players and picks on the table, then make your pitch.`}</p>}
            {log.map((x, i) => (
              <div key={i} className={`tr2-msg ${x.who}`}>
                <em>{x.who === 'gm' ? gm.name.split(' ')[0] : 'You'}</em><p>{x.text}</p>
                {x.counter && i === log.length - 1 && <div className="tr2-ctr">
                  <div><b>You send</b><span>{describeSide(L, x.counter.give)}</span></div>
                  <div><b>You get</b><span>{describeSide(L, x.counter.get)}</span></div>
                  <div className="tr2-ctr-b"><button className="btn sm primary" onClick={() => takeCounter(x.counter!)}>Accept</button><button className="btn sm" onClick={() => { setGive(x.counter!.give); setGet(x.counter!.get); }}>Load to table</button></div>
                </div>}
              </div>))}
          </div>
          <div key={shake} className={`tr2-acts${shake ? ' shake' : ''}`}>
            <button className="btn primary big" disabled={!any || closed} onClick={propose}>{closed ? 'He\'s not taking your calls' : 'Propose'}</button>
            <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
              <button className="btn sm" disabled={closed} onClick={ask}>What would it take?</button>
              <button className="btn sm ghost" disabled={!any} onClick={() => { setGive(EMPTY); setGet(EMPTY); }}>Clear table</button>
            </div>
          </div>
          {L.phase === 'regular' && <div className="tr2-dl">Deadline after week {L.tradeDeadlineWeek}</div>}
        </section>
        <section className="tr2-side them"><TeamHead L={L} abbr={other} capAfter={any ? theirCapAfter : undefined} /><Tray L={L} title="You receive" side={get} onRemove={(k, id) => toggle('get', k, id)} /></section>
      </div>
      <div className="tr2-boards">
        <Assets L={L} abbr={L.user} sel={give} onToggle={(k, id) => toggle('give', k, id)} />
        <Assets L={L} abbr={other} sel={get} onToggle={(k, id) => toggle('get', k, id)} />
      </div>
      {done && <TradeAlert L={L} offer={done} onClose={() => setDone(null)} />}
    </div>
  );
}

const describeSide = (L: LG, s: Side) =>
  [...s.players.map(id => `${L.players[id].pos} ${L.players[id].fn[0]}. ${L.players[id].ln}`), ...s.picks.map(id => pickLabel(L, L.picks.find(k => k.id === id)!))].join(', ') || 'nothing';

function TeamHead({ L, abbr, you, capAfter }: { L: LG; abbr: string; you?: boolean; capAfter?: number }) {
  const t = L.teams[abbr];
  const st = standings(L)[abbr];
  const needs = Object.entries(positionNeeds(L, abbr)).filter(([p]) => !['FB', 'LS', 'K', 'P'].includes(p)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
  return (
    <div className="tr2-th" style={{ '--tc': t.colors[0], '--tc2': t.colors[1] ?? '#fff' } as React.CSSProperties}>
      <Logo team={t} size={54} />
      <div><span className="up">{you ? 'Your team' : 'Trade partner'} · {st.w}-{st.l}{st.t ? `-${st.t}` : ''}</span><b>{t.name}</b>
        <div className="tr2-tags"><i className={`tt-mode ${t.mode}`}>{t.mode === 'contend' ? 'Contending' : t.mode === 'rebuild' ? 'Rebuilding' : 'Balanced'}</i><i>Needs {needs.join(' · ')}</i></div>
        <span className="tr2-cap">Cap space {money(capSpace(L, abbr))}{capAfter !== undefined && <> → <b className={capAfter < 0 ? 'bad' : 'good'}>{money(capAfter)}</b></>}</span></div>
    </div>
  );
}

function Tray({ L, title, side, onRemove }: { L: LG; title: string; side: Side; onRemove: (k: 'players' | 'picks', id: string) => void }) {
  const players = side.players.map(id => L.players[id]);
  const picks = side.picks.map(id => L.picks.find(k => k.id === id)!).filter(Boolean);
  return (
    <div className="tr2-tray">
      <div className="tr2-tt">{title}<span>{players.length + picks.length || ''}</span></div>
      <div className="tr2-cards">
        {!players.length && !picks.length && <div className="tr2-empty">Pick from the board below</div>}
        {players.map(p => (
          <div key={p.id} className="tr2-card" onClick={() => onRemove('players', p.id)} title="Take off the table">
            <Face p={p} size={52} /><div><span>{p.pos} · {Math.floor(p.age)} yrs</span><b>{p.fn[0]}. {p.ln}</b><em>{money(capHit(p.contract, L.season))} × {yearsLeft(p.contract, L.season)}</em></div><Ovr v={p.ovr} /><i>×</i>
          </div>))}
        {picks.map(k => (
          <div key={k.id} className="tr2-card pick" onClick={() => onRemove('picks', k.id)} title="Take off the table">
            <PickEmblem L={L} k={k} size={50} /><div><span>{k.season} draft</span><b>{pickLabel(L, k)}</b><em>{projText(projectedSlot(L, k))}</em></div><i>×</i>
          </div>))}
      </div>
    </div>
  );
}

function Assets({ L, abbr, sel, onToggle }: { L: LG; abbr: string; sel: Side; onToggle: (k: 'players' | 'picks', id: string) => void }) {
  const [tab, setTab] = useState<'Players' | 'Picks'>('Players');
  const [pos, setPos] = useState('All');
  const [q, setQ] = useState('');
  const players = Object.values(L.players).filter(p => p.team === abbr && (p.status === 'ACT' || p.status === 'IR') && (pos === 'All' || p.pos === pos) && (!q || `${p.fn} ${p.ln}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.ovr - a.ovr);
  const picks = L.picks.filter(k => k.owner === abbr && tradable(L, k)).sort((a, b) => a.season - b.season || a.round - b.round);
  return (
    <div className="tr2-board">
      <div className="tr2-bh"><Logo team={L.teams[abbr]} size={24} /><b>{L.teams[abbr].nick}</b><div className="tr2-seg">{(['Players', 'Picks'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div></div>
      {tab === 'Players' ? <>
        <div className="tr2-pos">{['All', ...POS_ORDER].map(p => <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>)}</div>
        <input className="tr2-q" placeholder="Search players" value={q} onChange={e => setQ(e.target.value)} />
        <div className="tr2-list">{players.map(p => { const on = sel.players.includes(p.id); return (
          <div key={p.id} className={`tr2-row${on ? ' on' : ''}`} onClick={() => onToggle('players', p.id)}>
            <PlayerCell p={p} sub={`${p.pos} · ${Math.floor(p.age)} yrs · ${money(capHit(p.contract, L.season))} × ${yearsLeft(p.contract, L.season)}`} /><div className="spacer" /><Ovr v={p.ovr} /><span className="tr2-add">{on ? '✓' : '+'}</span>
          </div>); })}</div>
      </> : (
        <div className="tr2-list">{picks.map(k => { const on = sel.picks.includes(k.id); return (
          <div key={k.id} className={`tr2-row pick${on ? ' on' : ''}`} onClick={() => onToggle('picks', k.id)}>
            <PickEmblem L={L} k={k} size={42} /><div><b>{pickLabel(L, k)}</b><div className="small mute">{projText(projectedSlot(L, k))}</div></div><div className="spacer" /><span className="tr2-add">{on ? '✓' : '+'}</span>
          </div>); })}{!picks.length && <div className="small dim">No picks.</div>}</div>
      )}
    </div>
  );
}

export function TradeBlock() {
  const L = useApp().league!;
  const block = (L.block ??= []);
  const mine = Object.values(L.players).filter(p => p.team === L.user && (p.status === 'ACT' || p.status === 'IR'));
  const listed = mine.filter(p => block.includes(p.id));
  const toggle = (id: string) => { L.block = block.includes(id) ? block.filter(x => x !== id) : [...block, id]; app.touch(); };
  // Interest: teams that need the position and can build a package for him.
  const interest = (p: Player) => Object.keys(L.teams).filter(t => t !== L.user)
    .map(t => ({ t, need: positionNeeds(L, t)[p.pos] ?? 0, offer: whatWouldItTake(L, t, L.user, p.id) }))
    .filter(x => x.offer && (x.need >= 0.8 || L.teams[x.t].mode === 'contend')).sort((a, b) => b.need - a.need).slice(0, 3);
  return (
    <div className="grid">
      <div><div className="page-title">Trade Block</div><div className="page-sub">Shop players to the league. Teams with a need at the position come back with real packages.</div></div>
      {listed.map(p => (
        <div key={p.id} className="card">
          <h3>{p.pos} {p.fn} {p.ln}<span className="more" onClick={() => toggle(p.id)}>Remove</span></h3>
          <div className="row"><PlayerCell p={p} /><Ovr v={p.ovr} /><span className="small dim">{Math.floor(p.age)} yrs · {money(capHit(p.contract, L.season))} × {yearsLeft(p.contract, L.season)}</span></div>
          <div className="grid g3" style={{ marginTop: 12 }}>{interest(p).map(({ t, offer }) => (
            <div key={t} className="card flat" style={{ background: 'var(--panel2)' }}>
              <div className="row"><Logo team={L.teams[t]} size={30} /><b className="h3">{L.teams[t].nick}</b></div>
              <div className="small" style={{ margin: '8px 0' }}>{[...offer!.give.players.map(id => `${L.players[id].pos} ${L.players[id].ln} (${L.players[id].ovr})`), ...offer!.give.picks.map(id => pickLabel(L, L.picks.find(k => k.id === id)!))].join(', ')}</div>
              <button className="btn sm primary" onClick={() => { const o: TradeOffer = { from: L.user, to: t, give: { players: [p.id], picks: [] }, get: offer!.give }; const v = evaluateTrade(L, o); if (v.accept || v.ratio > (v.margin ?? 1.1) * 0.9) { executeTrade(L, o); L.block = block.filter(x => x !== p.id); app.toast('Trade completed'); app.touch(); } else app.toast(v.reason); }}>Accept Package</button>
            </div>
          ))}{!interest(p).length && <div className="small mute">No serious interest right now.</div>}</div>
        </div>
      ))}
      <div className="card"><h3>Add Players to the Block</h3>
        <Table rows={mine.filter(p => !block.includes(p.id))} rowKey={p => p.id} initial="ovr" onRow={p => toggle(p.id)} cols={[
          { k: 'p', h: 'Player', get: p => <PlayerCell p={p} /> }, { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
          { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
          { k: 'a', h: '', get: () => <span className="slab">+ Block</span> },
        ]} />
      </div>
    </div>
  );
}

export function TradeFinder() {
  const L = useApp().league!;
  const [pos, setPos] = useState('All');
  const [min, setMin] = useState(75);
  const [maxAge, setMaxAge] = useState(40);
  const rows = Object.values(L.players).filter(p => p.team !== L.user && L.teams[p.team] && p.status === 'ACT' && (pos === 'All' || p.pos === pos) && p.ovr >= min && p.age <= maxAge);
  return (
    <div className="grid">
      <div><div className="page-title">Trade Finder</div><div className="page-sub">Every player in the league. Pick one and the builder opens with him loaded.</div></div>
      <div className="row">{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} onClick={() => setPos(p)}>{p}</span>)}</div>
      <div className="row"><span className="up">Min OVR {min}</span><input type="range" min={50} max={95} value={min} onChange={e => setMin(+e.target.value)} /><span className="up">Max age {maxAge}</span><input type="range" min={21} max={40} value={maxAge} onChange={e => setMaxAge(+e.target.value)} /></div>
      <Table rows={rows} rowKey={p => p.id} initial="ovr" onRow={p => app.go({ id: 'trade', team: p.team, want: p.id })} cols={[
        { k: 'p', h: 'Player', get: p => <PlayerCell p={p} /> }, { k: 't', h: 'Team', get: p => <Logo team={L.teams[p.team]} size={24} />, sort: p => p.team },
        { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' }, { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
        { k: 'cap', h: 'Cap Hit', get: p => money(capHit(p.contract, L.season)), sort: p => capHit(p.contract, L.season), cls: 'r' }, { k: 'y', h: 'Yrs', get: p => yearsLeft(p.contract, L.season), cls: 'c' },
        { k: 'm', h: 'Their Mode', get: p => L.teams[p.team].mode },
      ]} />
    </div>
  );
}

export function TradeOffers() {
  const L = useApp().league!;
  const offers = L.inbox.filter(m => m.action?.kind === 'trade');
  return (
    <div className="grid">
      <div><div className="page-title">Trade Offers</div><div className="page-sub">Proposals from other front offices. They expire when you act on them.</div></div>
      {offers.map(m => <div key={m.id} className="card"><h3><Logo team={L.teams[m.action!.offer.from]} size={24} /> {m.subject}</h3><div className="dim">{m.body}</div><TradeOfferCard L={L} offer={m.action!.offer} onDone={() => { m.action = undefined; m.read = true; app.touch(); }} /></div>)}
      {!offers.length && <div className="card empty">No offers on the table. Put players on the trade block to draw interest.</div>}
    </div>
  );
}

export function TradeHistory() {
  const L = useApp().league!;
  const trades = L.news.filter(n => n.kind === 'trade');
  return (
    <div className="grid">
      <div className="page-title">Trade History</div>
      <div className="card">{trades.map(n => <div key={n.id} className="li" style={{ cursor: 'default' }}>{n.teams.map(t => <Logo key={t} team={L.teams[t]} size={28} />)}<div style={{ flex: 1 }}>{n.text}<div className="small mute">{n.season} · week {n.week}</div></div></div>)}{!trades.length && <div className="empty">No trades yet.</div>}</div>
    </div>
  );
}

export function PickChart() {
  const L = useApp().league!;
  const W = 760, H = 240;
  const pts = Array.from({ length: 224 }, (_, i) => `${(i / 223) * W},${H - (pickValue(i + 1) / 3000) * H}`).join(' ');
  const mine = L.picks.filter(k => k.owner === L.user && tradable(L, k)).sort((a, b) => a.season - b.season || a.round - b.round);
  return (
    <div className="grid">
      <div><div className="page-title">Pick Value Chart</div><div className="page-sub">The draft-value scale every trade uses (Jimmy Johnson points). Future picks are discounted and projected from the original team's strength.</div></div>
      <div className="card">
        <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: 'block' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(r => <g key={r}><line x1={((r - 1) * 32 / 223) * W} y1={0} x2={((r - 1) * 32 / 223) * W} y2={H} stroke="#2a3140" /><text x={((r - 1) * 32 / 223) * W + 4} y={H + 18} fill="#7a849a" fontSize="12" fontFamily="var(--head)">ROUND {r}</text></g>)}
          <polyline points={pts} fill="none" stroke="var(--team2)" strokeWidth="3" />
          {mine.filter(k => k.season === L.season + (L.phase === 'draft' ? 0 : 1)).map(k => { const n = projectedSlot(L, k); const x = ((n - 1) / 223) * W, y = H - (pickValue(n) / 3000) * H; return <g key={k.id}><circle cx={x} cy={y} r="6" fill="#fff" /><text x={x + 8} y={y - 8} fill="#fff" fontSize="12">#{n}</text></g>; })}
        </svg>
      </div>
      <div className="card"><h3>Your Picks</h3>
        <table className="tbl"><thead><tr><th>Pick</th><th>Original</th><th className="r">Projected Slot</th><th className="r">Trade Value</th></tr></thead>
          <tbody>{mine.map(k => <tr key={k.id}><td><b>{pickLabel(L, k)}</b></td><td><Logo team={L.teams[k.orig]} size={22} /></td><td className="r">#{projectedSlot(L, k)}</td><td className="r num">{Math.round(pickTradeValue(L, k))}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
