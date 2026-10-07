// The Trades tab: builder, block, finder, incoming offers, history and the pick chart.
import { useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Table, PlayerCell } from '../components';
import { TradeOfferCard } from './league';
import type { Player, TradeOffer } from '../../core/types';
import { capHit, capSpace, money, yearsLeft } from '../../core/contracts';
import { evaluateTrade, executeTrade, pickLabel, pickTradeValue, pickValue, playerTradeValue, projectedSlot, whatWouldItTake } from '../../core/trade';
import { positionNeeds } from '../../core/draft';
import { POS_ORDER } from '../../core/ratings';
// ---- trade center ------------------------------------------------------------------------
export function TradeScreen({ team, want }: { team?: string; want?: string }) {
  const L = useApp().league!;
  const others = Object.keys(L.teams).filter(t => t !== L.user).sort();
  const [other, setOther] = useState(team && team !== L.user ? team : others[0]);
  const [give, setGive] = useState<{ players: string[]; picks: string[] }>({ players: [], picks: [] });
  const [get, setGet] = useState<{ players: string[]; picks: string[] }>({ players: want ? [want] : [], picks: [] });
  const [msg, setMsg] = useState('');
  const offer: TradeOffer = { from: L.user, to: other, give, get };
  const verdict = evaluateTrade(L, offer);
  const toggle = (side: 'give' | 'get', kind: 'players' | 'picks', id: string) => {
    const [s, set] = side === 'give' ? [give, setGive] : [get, setGet];
    set({ ...s, [kind]: s[kind].includes(id) ? s[kind].filter(x => x !== id) : [...s[kind], id] });
    setMsg('');
  };
  const column = (abbr: string, side: 'give' | 'get') => {
    const sel = side === 'give' ? give : get;
    const players = Object.values(L.players).filter(p => p.team === abbr && (p.status === 'ACT' || p.status === 'IR')).sort((a, b) => b.ovr - a.ovr);
    const picks = L.picks.filter(k => k.owner === abbr).sort((a, b) => a.season - b.season || a.round - b.round);
    return (
      <div className="card" style={{ minWidth: 0 }}>
        <h3><Logo team={L.teams[abbr]} size={26} />{L.teams[abbr].name}<span className="more">{money(capSpace(L, abbr))} cap</span></h3>
        <div className="up" style={{ margin: '6px 0' }}>Draft picks</div>
        <div className="row" style={{ gap: 6 }}>{picks.map(k => <span key={k.id} className={`chip${sel.picks.includes(k.id) ? ' on' : ''}`} onClick={() => toggle(side, 'picks', k.id)} title={`Value ${Math.round(pickTradeValue(L, k))}`}>{pickLabel(L, k)}</span>)}</div>
        <div className="up" style={{ margin: '12px 0 6px' }}>Players</div>
        <div className="scroll" style={{ maxHeight: 460 }}>{players.map(p => (
          <div key={p.id} className="li" onClick={() => toggle(side, 'players', p.id)} style={{ background: sel.players.includes(p.id) ? 'color-mix(in srgb, var(--team) 25%, transparent)' : undefined, padding: '7px 8px' }}>
            <input type="checkbox" readOnly checked={sel.players.includes(p.id)} /><PlayerCell p={p} sub={`${p.pos} · ${Math.floor(p.age)} yrs · ${money(capHit(p.contract, L.season))} × ${yearsLeft(p.contract, L.season)}`} /><div className="spacer" /><span className="small mute">{Math.round(playerTradeValue(L, p, side === 'give' ? other : L.user))}</span><Ovr v={p.ovr} />
          </div>
        ))}</div>
      </div>
    );
  };
  const pct = Math.max(0, Math.min(1, verdict.ratio / ({ Rookie: 1.0, Pro: 1.1, 'All-Madden': 1.22 }[L.difficulty] * 1.5)));
  return (
    <div className="grid">
      <div className="row"><div className="page-title">Trade Builder</div><select value={other} onChange={e => { setOther(e.target.value); setGet({ players: [], picks: [] }); setMsg(''); }}>{others.map(t => <option key={t} value={t}>{L.teams[t].name}</option>)}</select>
        {L.phase === 'regular' && <span className="chip">Deadline: after week {L.tradeDeadlineWeek}</span>}<div className="spacer" /></div>
      <div className="card" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <div className="row"><div style={{ flex: 1 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="up">Their view of the deal</span><span className="small">{Math.round(verdict.give)} in · {Math.round(verdict.get)} out</span></div>
          <div className="meter" style={{ marginTop: 8 }}><b style={{ left: `${pct * 100}%` }} /></div>
          <div className="small" style={{ marginTop: 8, color: verdict.accept ? 'var(--good)' : 'var(--warn)' }}>{msg || (give.players.length + give.picks.length + get.players.length + get.picks.length ? verdict.reason : 'Pick players and picks on both sides.')}</div>
        </div>
          <button className="btn" onClick={() => { const t = get.players[0]; if (!t) { setMsg('Select one of their players first.'); return; } const o = whatWouldItTake(L, L.user, other, t); if (o) { setGive(o.give); setMsg('Here is what they would want.'); } else setMsg('You do not have enough to get that done.'); }}>What would it take?</button>
          <button className="btn primary" disabled={!verdict.accept} onClick={() => { executeTrade(L, offer); app.toast('Trade completed!'); setGive({ players: [], picks: [] }); setGet({ players: [], picks: [] }); app.touch(); }}>Propose Trade</button>
        </div>
      </div>
      <div className="grid g2">{column(L.user, 'give')}{column(other, 'get')}</div>
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
