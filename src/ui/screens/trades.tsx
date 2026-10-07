// The Trades tab: builder, block, finder, incoming offers, history and the pick chart.
import { useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Table, PlayerCell, Face } from '../components';
import { standings } from '../../core/season';
import { TradeOfferCard } from './league';
import type { Player, TradeOffer } from '../../core/types';
import { capHit, capSpace, money, yearsLeft } from '../../core/contracts';
import { evaluateTrade, executeTrade, pickLabel, pickTradeValue, pickValue, playerTradeValue, projectedSlot, whatWouldItTake } from '../../core/trade';
import { positionNeeds } from '../../core/draft';
import { POS_ORDER } from '../../core/ratings';
// ---- trade center ------------------------------------------------------------------------
type Side = { players: string[]; picks: string[] };
const EMPTY: Side = { players: [], picks: [] };
/**
 * The trade table: both front offices face off across the deal. A tug-of-war gauge
 * shows how their side values it as you build, the tray shows exactly what moves
 * with cap impact for both teams, and each team's assets sit below.
 */
export function TradeScreen({ team, want }: { team?: string; want?: string }) {
  const L = useApp().league!;
  const others = Object.keys(L.teams).filter(t => t !== L.user).sort((a, b) => L.teams[a].name.localeCompare(L.teams[b].name));
  const [other, setOther] = useState(team && team !== L.user ? team : others[0]);
  const [give, setGive] = useState<Side>(EMPTY);
  const [get, setGet] = useState<Side>({ players: want ? [want] : [], picks: [] });
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState<null | { me: Side; them: Side; other: string }>(null);
  const [shake, setShake] = useState(0);
  const offer: TradeOffer = { from: L.user, to: other, give, get };
  const verdict = evaluateTrade(L, offer);
  const any = give.players.length + give.picks.length + get.players.length + get.picks.length > 0;
  const margin = { Rookie: 1.0, Pro: 1.1, 'All-Madden': 1.22 }[L.difficulty];
  // Gauge: 0 = they laugh, 0.5 = their asking line, 1 = they jump at it.
  const g = !any ? 0.5 : Math.max(0.02, Math.min(0.98, 0.5 + Math.log(Math.max(0.05, verdict.ratio) / margin) * 0.9));
  const toggle = (side: 'give' | 'get', kind: 'players' | 'picks', id: string) => {
    const [cur, set] = side === 'give' ? [give, setGive] : [get, setGet];
    set({ ...cur, [kind]: cur[kind].includes(id) ? cur[kind].filter(x => x !== id) : [...cur[kind], id] });
    setMsg('');
  };
  const switchTeam = (t: string) => { setOther(t); setGet(EMPTY); setMsg(''); };
  const cycle = (d: number) => switchTeam(others[(others.indexOf(other) + d + others.length) % others.length]);
  const hits = (ids: string[]) => ids.reduce((a, id) => a + capHit(L.players[id].contract, L.season), 0);
  const myCapAfter = capSpace(L, L.user) + hits(give.players) - hits(get.players);
  const theirCapAfter = capSpace(L, other) - hits(give.players) + hits(get.players);
  const propose = () => {
    if (!verdict.accept) { setShake(n => n + 1); setMsg(verdict.reason); return; }
    executeTrade(L, offer);
    setDone({ me: give, them: get, other });
    setGive(EMPTY); setGet(EMPTY); setMsg(''); app.touch();
  };
  const ask = () => {
    const t = get.players[0];
    if (!t) { setMsg('Select one of their players first.'); return; }
    const o = whatWouldItTake(L, L.user, other, t);
    if (o) { setGive(o.give); setMsg('Their front office came back with this.'); } else setMsg('You do not have the assets to get that done.');
  };
  return (
    <div className="grid trade">
      {/* ---- face-off header ---- */}
      <div className="tt-head">
        <TeamPlate L={L} abbr={L.user} side="left" capAfter={any ? myCapAfter : undefined} />
        <div className="tt-mid">
          <div className="tt-vs">VS</div>
          <div key={shake} className={`tt-gauge${shake ? ' shake' : ''}`}>
            <div className="tt-track"><i className="tt-line" /><b style={{ left: `${g * 100}%` }} /></div>
            <div className="row small" style={{ justifyContent: 'space-between' }}><span className="mute">Insulting</span><span className="mute">Fair</span><span className="mute">Steal for them</span></div>
          </div>
          <div className={`tt-verdict ${!any ? '' : verdict.accept ? 'good' : g > 0.42 ? 'warn' : 'bad'}`}>{msg || (any ? verdict.reason : 'Build a deal from the boards below.')}</div>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn sm" onClick={ask}>What Would It Take?</button>
            <button className="btn sm ghost" disabled={!any} onClick={() => { setGive(EMPTY); setGet(EMPTY); setMsg(''); }}>Clear</button>
          </div>
          <button className={`btn primary big tt-propose${verdict.accept && any ? ' ready' : ''}`} disabled={!any} onClick={propose}>Propose Trade</button>
          {L.phase === 'regular' && <div className="small mute c">Deadline after week {L.tradeDeadlineWeek}</div>}
        </div>
        <TeamPlate L={L} abbr={other} side="right" capAfter={any ? theirCapAfter : undefined} onPrev={() => cycle(-1)} onNext={() => cycle(1)} />
      </div>
      <div className="tt-strip">{others.map(t => <button key={t} className={t === other ? 'on' : ''} onClick={() => switchTeam(t)} title={L.teams[t].name}><Logo team={L.teams[t]} size={28} /></button>)}</div>

      {/* ---- the deal tray ---- */}
      <div className="tt-tray">
        <Tray L={L} title="You Send" side={give} forTeam={other} onRemove={(k, id) => toggle('give', k, id)} />
        <div className="tt-arrows"><span>⇄</span></div>
        <Tray L={L} title="You Receive" side={get} forTeam={L.user} onRemove={(k, id) => toggle('get', k, id)} />
      </div>

      {/* ---- asset boards ---- */}
      <div className="grid g2">
        <Assets L={L} abbr={L.user} sel={give} valueFor={other} onToggle={(k, id) => toggle('give', k, id)} />
        <Assets L={L} abbr={other} sel={get} valueFor={L.user} onToggle={(k, id) => toggle('get', k, id)} />
      </div>

      {done && (
        <div className="tt-done" onClick={() => setDone(null)}>
          <div className="tt-done-logos"><span className="l"><Logo team={L.teams[L.user]} size={110} /></span><span className="hs">🤝</span><span className="r"><Logo team={L.teams[done.other]} size={110} /></span></div>
          <div className="tt-done-title">Trade Accepted</div>
          <div className="dim">{describeSide(L, done.me)} <b>→</b> {L.teams[done.other].nick}</div>
          <div className="dim">{describeSide(L, done.them)} <b>→</b> {L.teams[L.user].nick}</div>
          <div className="small mute" style={{ marginTop: 16 }}>Click to continue</div>
        </div>
      )}
    </div>
  );
}

const describeSide = (L: NonNullable<ReturnType<typeof useApp>['league']>, s: Side) =>
  [...s.players.map(id => `${L.players[id].pos} ${L.players[id].fn[0]}. ${L.players[id].ln}`), ...s.picks.map(id => pickLabel(L, L.picks.find(k => k.id === id)!))].join(', ') || 'Nothing';

function TeamPlate({ L, abbr, side, capAfter, onPrev, onNext }: { L: NonNullable<ReturnType<typeof useApp>['league']>; abbr: string; side: 'left' | 'right'; capAfter?: number; onPrev?: () => void; onNext?: () => void }) {
  const t = L.teams[abbr];
  const st = standings(L)[abbr];
  const needs = Object.entries(positionNeeds(L, abbr)).filter(([p]) => !['FB', 'LS', 'K', 'P'].includes(p)).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);
  return (
    <div className={`tt-plate ${side}`} style={{ '--tc': t.colors[0], '--tc2': t.colors[1] } as React.CSSProperties}>
      <div className="tt-logo"><Logo team={t} size={92} /></div>
      <div className="tt-info">
        <div className="up">{side === 'left' ? 'Your Team' : 'Trade Partner'} · {st.w}-{st.l}{st.t ? `-${st.t}` : ''}</div>
        <div className="tt-name">{t.name}</div>
        <div className="row small" style={{ gap: 8, justifyContent: side === 'right' ? 'flex-end' : undefined }}>
          <span className={`tt-mode ${t.mode}`}>{t.mode === 'contend' ? 'Contending' : t.mode === 'rebuild' ? 'Rebuilding' : 'Balanced'}</span>
          <span>Needs {needs.join(' · ')}</span>
        </div>
        <div className="small" style={{ marginTop: 4 }}>Cap {money(capSpace(L, abbr))}{capAfter !== undefined && <> → <b className={capAfter < 0 ? 'bad' : 'good'}>{money(capAfter)}</b></>}</div>
      </div>
      {onPrev && <div className="tt-cycle"><button className="btn sm ghost" onClick={onPrev}>◀</button><button className="btn sm ghost" onClick={onNext}>▶</button></div>}
    </div>
  );
}

function Tray({ L, title, side, forTeam, onRemove }: { L: NonNullable<ReturnType<typeof useApp>['league']>; title: string; side: Side; forTeam: string; onRemove: (k: 'players' | 'picks', id: string) => void }) {
  const players = side.players.map(id => L.players[id]);
  const picks = side.picks.map(id => L.picks.find(k => k.id === id)!).filter(Boolean);
  const total = players.reduce((a, p) => a + playerTradeValue(L, p, forTeam), 0) + picks.reduce((a, k) => a + pickTradeValue(L, k, forTeam), 0);
  return (
    <div className="card tt-side">
      <div className="row"><div className="h3" style={{ margin: 0 }}>{title}</div><div className="spacer" /><span className="small dim">Value <b>{Math.round(total)}</b></span></div>
      <div className="tt-cards">
        {!players.length && !picks.length && <div className="tt-empty">Nothing yet</div>}
        {players.map(p => (
          <div key={p.id} className="tt-card" onClick={() => onRemove('players', p.id)} title="Remove">
            <Face p={p} size={58} /><div style={{ minWidth: 0 }}><div className="small dim">{p.pos} · {Math.floor(p.age)} yrs</div><b>{p.fn[0]}. {p.ln}</b><div className="small mute">{money(capHit(p.contract, L.season))} × {yearsLeft(p.contract, L.season)}</div></div><Ovr v={p.ovr} /><i>×</i>
          </div>
        ))}
        {picks.map(k => (
          <div key={k.id} className="tt-card pick" onClick={() => onRemove('picks', k.id)} title="Remove">
            <div className="tt-pick"><span>R{k.round}</span></div><div><b>{pickLabel(L, k)}</b><div className="small mute">Proj. #{projectedSlot(L, k)} · value {Math.round(pickTradeValue(L, k, forTeam))}</div></div><i>×</i>
          </div>
        ))}
      </div>
    </div>
  );
}

function Assets({ L, abbr, sel, valueFor, onToggle }: { L: NonNullable<ReturnType<typeof useApp>['league']>; abbr: string; sel: Side; valueFor: string; onToggle: (k: 'players' | 'picks', id: string) => void }) {
  const [tab, setTab] = useState<'Players' | 'Picks'>('Players');
  const [pos, setPos] = useState('All');
  const [q, setQ] = useState('');
  const players = Object.values(L.players).filter(p => p.team === abbr && (p.status === 'ACT' || p.status === 'IR') && (pos === 'All' || p.pos === pos) && (!q || `${p.fn} ${p.ln}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.ovr - a.ovr);
  const picks = L.picks.filter(k => k.owner === abbr).sort((a, b) => a.season - b.season || a.round - b.round);
  const maxV = Math.max(1, ...players.map(p => playerTradeValue(L, p, valueFor)));
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div className="row"><Logo team={L.teams[abbr]} size={26} /><div className="h3" style={{ margin: 0 }}>{L.teams[abbr].nick}</div><div className="spacer" />
        {(['Players', 'Picks'] as const).map(t => <span key={t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</span>)}</div>
      {tab === 'Players' ? <>
        <div className="row" style={{ gap: 4, margin: '10px 0', flexWrap: 'wrap' }}>{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} style={{ padding: '2px 7px' }} onClick={() => setPos(p)}>{p}</span>)}</div>
        <input placeholder="Search players" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
        <div className="scroll" style={{ maxHeight: 420 }}>{players.map(p => { const v = playerTradeValue(L, p, valueFor); const on = sel.players.includes(p.id); return (
          <div key={p.id} className={`li tt-row${on ? ' on' : ''}`} onClick={() => onToggle('players', p.id)}>
            <PlayerCell p={p} sub={`${p.pos} · ${Math.floor(p.age)} yrs · ${money(capHit(p.contract, L.season))} × ${yearsLeft(p.contract, L.season)}`} /><div className="spacer" />
            <span className="tt-val"><b style={{ width: `${(v / maxV) * 100}%` }} /></span><span className="small mute" style={{ width: 34, textAlign: 'right' }}>{Math.round(v)}</span><Ovr v={p.ovr} />
          </div>); })}</div>
      </> : (
        <div className="tt-picks">{picks.map(k => (
          <div key={k.id} className={`tt-pickrow${sel.picks.includes(k.id) ? ' on' : ''}`} onClick={() => onToggle('picks', k.id)}>
            <div className="tt-pick"><span>R{k.round}</span></div><div><b>{pickLabel(L, k)}</b><div className="small mute">Projected #{projectedSlot(L, k)} · {Math.round(pickValue(projectedSlot(L, k)))} chart pts</div></div><div className="spacer" /><b className="num">{Math.round(pickTradeValue(L, k, valueFor))}</b>
          </div>))}{!picks.length && <div className="small dim">No picks.</div>}</div>
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
          <div className="row"><PlayerCell p={p} /><Ovr v={p.ovr} /><span className="small dim">{Math.floor(p.age)} yrs · {money(capHit(p.contract, L.season))} × {yearsLeft(p.contract, L.season)} · value {Math.round(playerTradeValue(L, p))}</span></div>
          <div className="grid g3" style={{ marginTop: 12 }}>{interest(p).map(({ t, offer }) => (
            <div key={t} className="card flat" style={{ background: 'var(--panel2)' }}>
              <div className="row"><Logo team={L.teams[t]} size={30} /><b className="h3">{L.teams[t].nick}</b></div>
              <div className="small" style={{ margin: '8px 0' }}>{[...offer!.give.players.map(id => `${L.players[id].pos} ${L.players[id].ln} (${L.players[id].ovr})`), ...offer!.give.picks.map(id => pickLabel(L, L.picks.find(k => k.id === id)!))].join(', ')}</div>
              <button className="btn sm primary" onClick={() => { const o: TradeOffer = { from: L.user, to: t, give: { players: [p.id], picks: [] }, get: offer!.give }; const v = evaluateTrade(L, o); if (v.accept || v.ratio > 0.9) { executeTrade(L, o); L.block = block.filter(x => x !== p.id); app.toast('Trade completed'); app.touch(); } else app.toast(v.reason); }}>Accept Package</button>
            </div>
          ))}{!interest(p).length && <div className="small mute">No serious interest right now.</div>}</div>
        </div>
      ))}
      <div className="card"><h3>Add Players to the Block</h3>
        <Table rows={mine.filter(p => !block.includes(p.id))} rowKey={p => p.id} initial="ovr" onRow={p => toggle(p.id)} cols={[
          { k: 'p', h: 'Player', get: p => <PlayerCell p={p} /> }, { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
          { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' }, { k: 'v', h: 'Trade Value', get: p => Math.round(playerTradeValue(L, p)), sort: p => playerTradeValue(L, p), cls: 'r' },
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
        { k: 'v', h: 'Value', get: p => Math.round(playerTradeValue(L, p, L.user)), sort: p => playerTradeValue(L, p, L.user), cls: 'r' },
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
  const mine = L.picks.filter(k => k.owner === L.user).sort((a, b) => a.season - b.season || a.round - b.round);
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
