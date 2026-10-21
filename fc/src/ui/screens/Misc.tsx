import { useState } from 'react';
import { useWorld, mutate } from '../store';
import { go } from '../nav';
import { Crest, Face, Flag } from '../art';
import { Panel, Tabs, Empty, ClubName } from '../bits';
import { fmtDate } from '../../core/season';
import { LEAGUES } from '../../core/world';
import type { Player } from '../../core/types';

export function Stats() {
  const w = useWorld();
  const [scope, setScope] = useState('all');
  const [cat, setCat] = useState<'g' | 'a' | 'ga' | 'rt' | 'cs' | 'xg'>('g');
  const val = (p: Player): number => {
    if (scope === 'all') {
      const s = p.s;
      return cat === 'g' ? s.goals : cat === 'a' ? s.assists : cat === 'ga' ? s.goals + s.assists : cat === 'rt' ? (s.apps >= 8 ? s.ratingSum / s.apps : 0) : cat === 'cs' ? (p.pos === 'GK' ? s.cleanSheets : 0) : s.xg;
    }
    const c = p.cs[scope];
    if (!c) return 0;
    return cat === 'g' ? c[1] : cat === 'a' ? c[2] : cat === 'ga' ? c[1] + c[2] : cat === 'rt' ? (p.s.apps >= 8 ? p.s.ratingSum / p.s.apps : 0) : cat === 'cs' ? (p.pos === 'GK' ? p.s.cleanSheets : 0) : p.s.xg;
  };
  const list = Object.values(w.players).map(p => [p, val(p)] as const).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 40);
  return (
    <div>
      <div className="page-h"><h1>Statistics</h1></div>
      <div className="toolbar">
        <select value={scope} onChange={e => setScope(e.target.value)}><option value="all">All competitions</option>{Object.values(w.comps).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <Tabs tabs={[['g', 'Goals'], ['a', 'Assists'], ['ga', 'G+A'], ['rt', 'Avg rating'], ['xg', 'xG'], ['cs', 'Clean sheets']]} value={cat} onChange={setCat} />
      </div>
      <Panel>
        {!list.length && <Empty>No data yet. Play some matches.</Empty>}
        <div className="leaders">
          {list.map(([p, v], i) => (
            <div key={p.id} className={`leader ${i < 3 ? 'top' : ''}`} onClick={() => go({ s: 'player', id: p.id })}>
              <span className="rank">{i + 1}</span>
              <Face p={p} club={p.club ? w.clubs[p.club] : undefined} size={i < 3 ? 44 : 28} />
              <Flag nat={p.nat} h={11} />
              <span className="ld-name">{p.name}</span>
              {p.club && <ClubName c={w.clubs[p.club]} short />}
              <b>{cat === 'rt' || cat === 'xg' ? v.toFixed(2) : v}</b>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function Inbox() {
  const w = useWorld();
  const [sel, setSel] = useState<number | null>(w.news[0]?.id ?? null);
  const n = w.news.find(x => x.id === sel);
  return (
    <div>
      <div className="page-h"><h1>Inbox</h1><button className="btn" onClick={() => mutate(x => x.news.forEach(m => { m.read = true; }))}>Mark all read</button></div>
      <div className="inbox">
        <div className="ib-list">
          {w.news.map(m => (
            <div key={m.id} className={`ib-item ${m.read ? '' : 'unread'} ${sel === m.id ? 'sel' : ''} k-${m.kind}`} onClick={() => { setSel(m.id); mutate(x => { const it = x.news.find(y => y.id === m.id); if (it) it.read = true; }, false); }}>
              <i /><div><b>{m.title}</b><span>{fmtDate({ season: m.season }, m.day)} · {m.kind}</span></div>
            </div>
          ))}
          {!w.news.length && <Empty>Nothing yet.</Empty>}
        </div>
        <div className="ib-body">
          {n ? (
            <>
              <span className={`ib-kind k-${n.kind}`}>{n.kind.toUpperCase()}</span>
              <h2>{n.title}</h2>
              <span className="muted">{fmtDate({ season: n.season }, n.day, true)}</span>
              {n.pid && w.players[n.pid] && <div className="ib-player" onClick={() => go({ s: 'player', id: n.pid! })}><Face p={w.players[n.pid]} club={w.players[n.pid].club ? w.clubs[w.players[n.pid].club!] : undefined} size={80} /><b>{w.players[n.pid].name}</b></div>}
              <p className="ib-text">{n.body}</p>
              {n.offerId && <button className="btn primary" onClick={() => go({ s: 'transfers', tab: 'offers' })}>Respond to offer</button>}
            </>
          ) : <Empty>Select a message.</Empty>}
        </div>
      </div>
    </div>
  );
}

export function History() {
  const w = useWorld();
  return (
    <div>
      <div className="page-h"><h1>History</h1></div>
      {!w.history.length && <Empty>Complete a season to start writing history.</Empty>}
      {[...w.history].reverse().map(h => (
        <Panel key={h.season} title={`${h.season}/${String(h.season + 1).slice(2)}`} right={h.userFinish ? <span>Your finish: {h.userFinish}</span> : null}>
          <div className="hist">
            {LEAGUES.filter(l => l.tier === 1).map(l => h.champions[l.id] && <div key={l.id}><span>{l.name}</span><Crest club={w.clubs[h.champions[l.id]]} size={20} /><b>{w.clubs[h.champions[l.id]].name}</b></div>)}
            {Object.entries(h.cups).map(([c, id]) => <div key={c}><span>{c === 'ucl' ? 'Champions League' : c === 'uel' ? 'Europa League' : c.replace('cup-', 'Cup · ')}</span><Crest club={w.clubs[id]} size={20} /><b>{w.clubs[id].name}</b></div>)}
          </div>
          <div className="awards">{w.awards.filter(a => a.season === h.season).map((a, i) => <div key={i}><span>{a.title}</span><b>{a.name ?? (a.pid && w.players[a.pid]?.name)}</b>{a.value && <em>{a.value}</em>}</div>)}</div>
        </Panel>
      ))}
    </div>
  );
}
