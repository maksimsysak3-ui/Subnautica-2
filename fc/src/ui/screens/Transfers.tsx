import { useMemo, useState } from 'react';
import { useWorld, mutate } from '../store';
import { go, toast } from '../nav';
import { Crest, Face, Flag, Ovr } from '../art';
import { Panel, Tabs, ClubName, Empty } from '../bits';
import { ageOf, marketValue } from '../../core/player';
import { askingPrice, fmtMoney, interest, respondOffer, windowOpen } from '../../core/transfers';
import { LEAGUES } from '../../core/world';
import { potRange } from './Squad';
import { fmtDate, dayOf } from '../../core/season';
import type { Player, World } from '../../core/types';

type Tab = 'search' | 'shortlist' | 'offers' | 'free' | 'news';
export function Transfers({ tab: t0 }: { tab?: string }) {
  const w = useWorld();
  const [tab, setTab] = useState<Tab>((t0 as Tab) ?? 'search');
  const u = w.clubs[w.user];
  const open = windowOpen(w);
  const deadline = w.day < dayOf(w.season, 9, 1) ? dayOf(w.season, 9, 1) : dayOf(w.season, 2, 2);
  const incoming = w.offers.filter(o => !o.userBuying && o.to === w.user && o.status === 'pending');
  return (
    <div>
      <div className="page-h">
        <h1>Transfer Hub</h1>
        <div className="page-stats">
          <div><span>Window</span><b className={open ? 'pos' : 'neg'}>{open ? `Open · closes ${fmtDate(w, deadline - 1)}` : 'Closed'}</b></div>
          <div><span>Budget</span><b>{fmtMoney(u.budget)}</b></div>
          <div><span>Wage room</span><b>{fmtMoney(u.wageBudget - u.squad.reduce((s, id) => s + (w.players[id]?.wage ?? 0), 0))}/wk</b></div>
        </div>
      </div>
      <Tabs tabs={[['search', 'Scout & search'], ['shortlist', `Shortlist (${w.shortlist.length})`], ['offers', `Offers${incoming.length ? ` (${incoming.length})` : ''}`], ['free', 'Free agents'], ['news', 'Deals & rumours']]} value={tab} onChange={setTab} />
      {tab === 'search' && <Search w={w} />}
      {tab === 'shortlist' && <PlayerTable w={w} ps={w.shortlist.map(id => w.players[id]).filter(Boolean)} />}
      {tab === 'free' && <PlayerTable w={w} ps={w.freeAgents.map(id => w.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr)} />}
      {tab === 'offers' && <Offers w={w} />}
      {tab === 'news' && <Deals w={w} />}
    </div>
  );
}

function Search({ w }: { w: World }) {
  const [q, setQ] = useState('');
  const [pos, setPos] = useState('');
  const [lg, setLg] = useState('');
  const [age, setAge] = useState<[number, number]>([16, 40]);
  const [minOvr, setMinOvr] = useState(70);
  const [maxVal, setMaxVal] = useState(0);
  const [onlyKeen, setOnlyKeen] = useState(false);
  const u = w.clubs[w.user];
  const res = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out: Player[] = [];
    for (const p of Object.values(w.players)) {
      if (p.club === w.user) continue;
      if (ql && !p.name.toLowerCase().includes(ql)) continue;
      if (pos && p.pos !== pos && !p.alt.includes(pos as Player['pos'])) continue;
      if (lg && (!p.club || w.clubs[p.club].league !== lg)) continue;
      const a = ageOf(p, w.season); if (a < age[0] || a > age[1]) continue;
      if (p.ovr < minOvr && !(ql && p.ovr >= 40)) continue;
      if (maxVal && marketValue(p, w.season) > maxVal) continue;
      out.push(p);
    }
    out.sort((a, b) => b.ovr - a.ovr || b.pot - a.pot);
    return out.slice(0, 300).filter(p => !onlyKeen || interest(w, p, u).ok).slice(0, 120);
  }, [w, q, pos, lg, age, minOvr, maxVal, onlyKeen, u]);
  return (
    <>
      <div className="filters">
        <input placeholder="Search name…" value={q} onChange={e => setQ(e.target.value)} />
        <select value={pos} onChange={e => setPos(e.target.value)}><option value="">Any position</option>{['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST'].map(x => <option key={x}>{x}</option>)}</select>
        <select value={lg} onChange={e => setLg(e.target.value)}><option value="">Any league</option>{LEAGUES.filter(l => l.tier === 1).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}<option value="world">Rest of world</option></select>
        <label>Age {age[0]}-{age[1]}<input type="range" min={16} max={40} value={age[1]} onChange={e => setAge([age[0], +e.target.value])} /></label>
        <label>Min OVR {minOvr}<input type="range" min={45} max={90} value={minOvr} onChange={e => setMinOvr(+e.target.value)} /></label>
        <select value={maxVal} onChange={e => setMaxVal(+e.target.value)}><option value={0}>Any value</option>{[2e6, 5e6, 10e6, 20e6, 40e6, 70e6, 100e6].map(v => <option key={v} value={v}>≤ {fmtMoney(v)}</option>)}</select>
        <label className="chk"><input type="checkbox" checked={onlyKeen} onChange={e => setOnlyKeen(e.target.checked)} /> Interested only</label>
        <button className="btn" onClick={() => { setAge([16, 21]); setMinOvr(60); }}>Wonderkids</button>
      </div>
      <PlayerTable w={w} ps={res} />
    </>
  );
}

function PlayerTable({ w, ps }: { w: World; ps: Player[] }) {
  const u = w.clubs[w.user];
  if (!ps.length) return <Empty>No players match.</Empty>;
  return (
    <Panel>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th>Club</th><th>Value</th><th>Asking</th><th>Wage</th><th>Contract</th><th>Interest</th><th /></tr></thead>
          <tbody>{ps.map(p => {
            const c = p.club ? w.clubs[p.club] : null;
            const it = interest(w, p, u);
            const sl = w.shortlist.includes(p.id);
            return (
              <tr key={p.id} onClick={() => go({ s: 'player', id: p.id })}>
                <td className="nm"><Face p={p} club={c ?? undefined} size={26} /><Flag nat={p.nat} h={11} /><span>{p.name}</span></td>
                <td><span className="pos-chip">{p.pos}</span></td><td>{ageOf(p, w.season)}</td><td><Ovr v={p.ovr} small /></td><td className="muted">{potRange(w, p)}</td>
                <td>{c ? <ClubName c={c} short /> : <span className="muted">Free</span>}</td>
                <td>{fmtMoney(marketValue(p, w.season))}</td><td>{c ? fmtMoney(askingPrice(w, p)) : '—'}</td><td>{fmtMoney(p.wage)}</td><td>{c ? p.contract + 1 : '—'}</td>
                <td><span className={`int ${it.score > 10 ? 'hi' : it.ok ? 'mid' : 'lo'}`}>{it.score > 10 ? 'Keen' : it.ok ? 'Open' : 'No'}</span></td>
                <td><button className="star" onClick={e => { e.stopPropagation(); mutate(x => { x.shortlist = sl ? x.shortlist.filter(s => s !== p.id) : [...x.shortlist, p.id]; }); }}>{sl ? '★' : '☆'}</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function Offers({ w }: { w: World }) {
  const incoming = w.offers.filter(o => !o.userBuying && o.to === w.user).slice().reverse();
  const [counter, setCounter] = useState<Record<number, number>>({});
  return (
    <Panel title="Incoming bids">
      {!incoming.length && <Empty>No clubs have bid for your players yet.</Empty>}
      {incoming.map(o => {
        const p = w.players[o.pid]; const c = w.clubs[o.from];
        if (!p) return null;
        const ctr = counter[o.id] ?? Math.round(o.fee * 1.25 / 1e5) * 1e5;
        return (
          <div key={o.id} className={`offer ${o.status}`}>
            <Crest club={c} size={40} />
            <div className="of-main"><b>{c.name}</b> bid <b>{fmtMoney(o.fee)}</b> for <span className="pname" onClick={() => go({ s: 'player', id: p.id })}>{p.name}</span><span className="muted sm"> · value {fmtMoney(marketValue(p, w.season))} · {fmtDate(w, o.day)}</span></div>
            {o.status === 'pending' ? (
              <div className="of-act">
                <button className="btn primary" onClick={() => { let msg = ''; mutate(x => { msg = respondOffer(x, x.offers.find(y => y.id === o.id)!, 'accept'); }); toast(msg, 'good'); }}>Accept</button>
                <label className="cur-in">€<input type="number" step={0.5} value={ctr / 1e6} onChange={e => setCounter({ ...counter, [o.id]: Math.round(+e.target.value * 1e6) })} />M</label>
                <button className="btn" onClick={() => { let msg = ''; mutate(x => { msg = respondOffer(x, x.offers.find(y => y.id === o.id)!, 'counter', ctr); }); toast(msg); }}>Counter</button>
                <button className="btn danger" onClick={() => { let msg = ''; mutate(x => { msg = respondOffer(x, x.offers.find(y => y.id === o.id)!, 'reject'); }); toast(msg); }}>Reject</button>
              </div>
            ) : <span className={`tag ${o.status === 'done' ? 'grn' : 'red'}`}>{o.status}</span>}
          </div>
        );
      })}
    </Panel>
  );
}

function Deals({ w }: { w: World }) {
  const season = w.transfers.filter(t => t.season === w.season);
  const big = [...season].sort((a, b) => b.fee - a.fee).slice(0, 10);
  const spend = new Map<string, number>();
  for (const t of season) { spend.set(t.to, (spend.get(t.to) ?? 0) + t.fee); }
  const spenders = [...spend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div className="deals-grid">
      <Panel title="Biggest deals this season">
        {big.map((t, i) => (
          <div key={i} className="deal">
            <span className="rank">{i + 1}</span>
            <span className="pname" onClick={() => w.players[t.pid] && go({ s: 'player', id: t.pid })}>{t.name}</span>
            {w.clubs[t.from] ? <Crest club={w.clubs[t.from]} size={22} /> : <span>FA</span>}<span className="arrow">→</span><Crest club={w.clubs[t.to]} size={22} />
            <b>{fmtMoney(t.fee)}</b>
          </div>
        ))}
        {!big.length && <Empty>No deals yet.</Empty>}
      </Panel>
      <Panel title="Top spenders">
        {spenders.map(([id, v]) => <div key={id} className="deal"><ClubName c={w.clubs[id]} /><b>{fmtMoney(v)}</b></div>)}
      </Panel>
      <Panel title="Latest">
        <div className="ticker-list long">
          {w.transfers.slice(0, 40).map((t, i) => (
            <div key={i} className="tk-row"><span className="muted sm">{fmtDate(w, t.day)}</span><span className="tk-name">{t.name}</span>{w.clubs[t.from] ? <Crest club={w.clubs[t.from]} size={16} /> : <span className="muted sm">FA</span>}<span className="arrow">→</span><Crest club={w.clubs[t.to]} size={16} /><b>{t.loan ? 'Loan' : t.fee ? fmtMoney(t.fee) : 'Free'}</b></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
