import { useState } from 'react';
import { useWorld } from '../store';
import { go } from '../nav';
import { Flag, Ovr, Face, PlayerCard, Bar } from '../art';
import { Panel, Tabs } from '../bits';
import { ageOf, marketValue } from '../../core/player';
import { fmtMoney } from '../../core/transfers';
import type { Player, World } from '../../core/types';

type View = 'overview' | 'stats' | 'contracts' | 'cards';
const GROUP: Record<string, string[]> = { all: [], gk: ['GK'], def: ['CB', 'RB', 'LB'], mid: ['CDM', 'CM', 'CAM', 'RM', 'LM'], att: ['RW', 'LW', 'ST'] };
const POS_ORDER = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'ST'];

export function potRange(w: World, p: Player): string {
  if (p.club === w.user || p.scouted) return String(p.pot);
  const spread = ageOf(p, w.season) <= 23 ? 4 : 2;
  return `${Math.max(p.ovr, p.pot - spread)}-${p.pot + Math.max(0, spread - 1)}`;
}

export function Squad() {
  const w = useWorld();
  const u = w.clubs[w.user];
  const [view, setView] = useState<View>('overview');
  const [grp, setGrp] = useState('all');
  const [sort, setSort] = useState<[string, number]>(['pos', 1]);
  let ps = u.squad.map(id => w.players[id]).filter(Boolean);
  if (grp !== 'all') ps = ps.filter(p => GROUP[grp].includes(p.pos));
  const key = (p: Player): number | string => {
    switch (sort[0]) {
      case 'pos': return POS_ORDER.indexOf(p.pos) * 100 - p.ovr;
      case 'name': return p.name; case 'age': return ageOf(p, w.season); case 'ovr': return -p.ovr; case 'pot': return -p.pot;
      case 'val': return -marketValue(p, w.season); case 'wage': return -p.wage; case 'con': return p.contract; case 'fit': return -p.fitness; case 'mor': return -p.morale;
      case 'apps': return -p.s.apps; case 'g': return -p.s.goals; case 'a': return -p.s.assists; case 'rt': return -(p.s.apps ? p.s.ratingSum / p.s.apps : 0); case 'form': return -p.form;
      default: return 0;
    }
  };
  ps.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * sort[1]; });
  const H = ({ k, l, t }: { k: string; l: string; t?: string }) => <th className={`sortable ${sort[0] === k ? 'on' : ''}`} title={t} onClick={() => setSort([k, sort[0] === k ? -sort[1] : 1])}>{l}</th>;
  const wageBill = u.squad.reduce((s, id) => s + (w.players[id]?.wage ?? 0), 0);
  const value = u.squad.reduce((s, id) => s + (w.players[id] ? marketValue(w.players[id], w.season) : 0), 0);
  return (
    <div>
      <div className="page-h">
        <h1>Squad <span className="muted">{u.squad.length} players</span></h1>
        <div className="page-stats"><div><span>Squad value</span><b>{fmtMoney(value)}</b></div><div><span>Wage bill</span><b>{fmtMoney(wageBill)}/wk</b></div><div><span>Avg age</span><b>{(u.squad.reduce((s, id) => s + ageOf(w.players[id], w.season), 0) / u.squad.length).toFixed(1)}</b></div></div>
      </div>
      <div className="toolbar">
        <Tabs tabs={[['overview', 'Overview'], ['stats', 'Season stats'], ['contracts', 'Contracts'], ['cards', 'Cards']]} value={view} onChange={setView} />
        <Tabs tabs={[['all', 'All'], ['gk', 'GK'], ['def', 'DEF'], ['mid', 'MID'], ['att', 'ATT']]} value={grp} onChange={setGrp} />
      </div>
      {view === 'cards' ? (
        <div className="card-grid">{ps.map(p => <PlayerCard key={p.id} p={p} club={u} size={0.9} onClick={() => go({ s: 'player', id: p.id })} />)}</div>
      ) : (
        <Panel>
          <div className="tbl-wrap">
            <table className="tbl squad">
              <thead><tr>
                <th>#</th><H k="name" l="Player" /><H k="pos" l="Pos" /><H k="age" l="Age" /><H k="ovr" l="OVR" /><H k="pot" l="POT" />
                {view === 'overview' && <><H k="form" l="Form" /><H k="fit" l="Fitness" /><H k="mor" l="Morale" /><H k="val" l="Value" /><th>Status</th></>}
                {view === 'stats' && <><H k="apps" l="Apps" /><H k="g" l="G" /><H k="a" l="A" /><H k="rt" l="Avg" /><th>xG</th><th>MotM</th><th>CS</th><th>YC</th><th>RC</th></>}
                {view === 'contracts' && <><H k="wage" l="Wage" /><H k="con" l="Expires" /><H k="val" l="Value" /><th>Role</th><th>Release clause</th></>}
              </tr></thead>
              <tbody>
                {ps.map(p => (
                  <tr key={p.id} onClick={() => go({ s: 'player', id: p.id })} className={p.inj ? 'inj' : ''}>
                    <td className="num">{p.num}</td>
                    <td className="nm"><Face p={p} club={u} size={26} /><Flag nat={p.nat} h={11} /><span>{p.name}</span>{p.loan && <span className="tag blu">LOAN</span>}{p.listed && <span className="tag yel">LIST</span>}{p.youth && <span className="tag grn">YTH</span>}</td>
                    <td><span className="pos-chip">{p.pos}</span></td>
                    <td>{ageOf(p, w.season)}</td>
                    <td><Ovr v={p.ovr} small /></td>
                    <td className="muted">{potRange(w, p)}</td>
                    {view === 'overview' && <>
                      <td><span className={`formchip ${p.form >= 7.2 ? 'hot' : p.form < 6.3 ? 'cold' : ''}`}>{p.form.toFixed(1)}</span></td>
                      <td><Bar v={p.fitness} max={100} /></td>
                      <td><Bar v={p.morale} max={100} color={p.morale >= 70 ? '#22c55e' : p.morale >= 45 ? '#eab308' : '#ef4444'} /></td>
                      <td>{fmtMoney(marketValue(p, w.season))}</td>
                      <td className="sm">{p.inj ? <span className="tag red">{p.inj.name} · {Math.ceil(p.inj.days / 7)}w</span> : p.ban > 0 ? <span className="tag yel">Banned {p.ban}</span> : <span className="muted">Available</span>}</td>
                    </>}
                    {view === 'stats' && <>
                      <td>{p.s.apps}<span className="muted sm"> ({p.s.starts})</span></td><td>{p.s.goals}</td><td>{p.s.assists}</td>
                      <td>{p.s.apps ? (p.s.ratingSum / p.s.apps).toFixed(2) : '-'}</td><td>{p.s.xg.toFixed(1)}</td><td>{p.s.motm}</td><td>{p.s.cleanSheets}</td><td>{p.s.yellows}</td><td>{p.s.reds}</td>
                    </>}
                    {view === 'contracts' && <>
                      <td>{fmtMoney(p.wage)}/wk</td>
                      <td className={p.contract <= w.season ? 'neg' : p.contract === w.season + 1 ? 'warn' : ''}>June {p.contract + 1}</td>
                      <td>{fmtMoney(marketValue(p, w.season))}</td>
                      <td>{p.role ?? '—'}</td>
                      <td>{p.release ? fmtMoney(p.release) : '—'}</td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
