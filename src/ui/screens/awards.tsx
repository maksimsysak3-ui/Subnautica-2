// Awards: the live races for the season's honours (who leads, by how much, and the
// numbers behind it), Coach of the Year, and every winner in this league's history.
import { useState } from 'react';
import { useApp, app } from '../store';
import { Face, Logo, Ovr } from '../components';
import type { League, Player } from '../../core/types';
import { awardRace, coachRace, standings, AWARD_NAME, type AwardKey } from '../../core/season';
import { emptyLine } from '../../core/league';

const KEYS: AwardKey[] = ['mvp', 'opoy', 'dpoy', 'oroy', 'droy'];

/** The two or three numbers voters look at for this player. */
export function keyLine(p: Player, season: number) {
  const l = p.stats[season] ?? emptyLine();
  if (p.pos === 'QB') return `${l.pc}/${l.pa} · ${l.py.toLocaleString()} yds · ${l.ptd} TD · ${l.pint} INT`;
  if (p.pos === 'RB') return `${l.ry.toLocaleString()} rush yds · ${l.rtd + l.rectd} TD · ${l.recy} rec yds`;
  if (['WR', 'TE'].includes(p.pos)) return `${l.rec} rec · ${l.recy.toLocaleString()} yds · ${l.rectd} TD`;
  if (['OT', 'G', 'C'].includes(p.pos)) return `${l.gs} starts · ${l.pancake} pancakes · ${l.sacka} sacks allowed`;
  return `${l.tkl} tkl · ${l.dsk} sk · ${l.dint} INT · ${l.ff} FF`;
}

export function AwardsScreen() {
  const L = useApp().league!;
  const [view, setView] = useState<'race' | 'history'>('race');
  return (
    <div className="grid">
      <div className="row"><div className="page-title" style={{ margin: 0 }}>Awards</div><div className="spacer" />
        <span className={`chip${view === 'race' ? ' on' : ''}`} onClick={() => setView('race')}>{L.season} Award Race</span>
        <span className={`chip${view === 'history' ? ' on' : ''}`} onClick={() => setView('history')}>Past Winners</span></div>
      {view === 'race' ? <Race L={L} /> : <History L={L} />}
    </div>
  );
}

function Race({ L }: { L: League }) {
  const race = awardRace(L);
  const coy = coachRace(L).slice(0, 5);
  const st = standings(L);
  const started = Object.values(L.players).some(p => p.stats[L.season]?.gp);
  if (!started) return <div className="card empty">The award races open once the season kicks off.</div>;
  return (
    <div className="aw-grid">
      {KEYS.map(k => {
        const list = race[k];
        const top = list[0]?.score || 1;
        return (
          <div key={k} className={`card aw-card${k === 'mvp' ? ' mvp' : ''}`}>
            <div className="aw-head"><span className="aw-trophy">🏆</span><div><div className="aw-k">{k === 'mvp' ? 'Most Valuable Player' : AWARD_NAME[k]}</div><div className="small dim">Leader after week {Math.max(1, Math.min(L.week, 18))}</div></div></div>
            {list[0] && (() => { const p = list[0].p; const t = L.teams[p.team]; return (
              <div className="aw-leader" style={{ '--tc': t?.colors[0] ?? '#333' } as React.CSSProperties} onClick={() => app.go({ id: 'player', pid: p.id })}>
                <Face p={p} size={86} /><div style={{ minWidth: 0 }}><div className="small dim">{p.pos} · {t?.name}</div><div className="aw-name">{p.fn} <b>{p.ln}</b></div><div className="small">{keyLine(p, L.season)}</div></div>
                <div className="aw-odds"><Ovr v={p.ovr} /><em>Favourite</em></div>
              </div>); })()}
            {list.slice(1).map((x, i) => (
              <div key={x.p.id} className="aw-row" onClick={() => app.go({ id: 'player', pid: x.p.id })}>
                <span className="aw-rank">{i + 2}</span>{L.teams[x.p.team] && <Logo team={L.teams[x.p.team]} size={22} />}
                <div style={{ minWidth: 0, flex: 1 }}><b>{x.p.fn[0]}. {x.p.ln}</b> <span className="small mute">{x.p.pos}</span><div className="small dim">{keyLine(x.p, L.season)}</div></div>
                <span className="aw-bar"><b style={{ width: `${Math.max(4, (x.score / top) * 100)}%` }} /></span>
              </div>
            ))}
          </div>
        );
      })}
      <div className="card aw-card">
        <div className="aw-head"><span className="aw-trophy">📋</span><div><div className="aw-k">Coach of the Year</div><div className="small dim">Wins above what the roster was expected to win</div></div></div>
        {coy.map((t, i) => (
          <div key={t} className="aw-row"><span className="aw-rank">{i + 1}</span><Logo team={L.teams[t]} size={24} /><div style={{ flex: 1 }}><b>{L.teams[t].coach.name}</b><div className="small dim">{L.teams[t].name} · {st[t].w}-{st[t].l}{st[t].t ? `-${st[t].t}` : ''}</div></div></div>
        ))}
      </div>
    </div>
  );
}

function History({ L }: { L: League }) {
  const rows = [...L.awards].sort((a, b) => b.season - a.season);
  const P = (id?: string) => (id ? L.players[id] : undefined);
  const cell = (id?: string) => { const p = P(id); return p ? <span className="aw-cell" onClick={() => app.go({ id: 'player', pid: p.id })}><Face p={p} size={26} /><span><b>{p.fn[0]}. {p.ln}</b><em>{p.pos}</em></span></span> : <span className="mute">—</span>; };
  if (!rows.some(r => r.mvp || r.champion)) return <div className="card empty">No awards have been handed out in this league yet.</div>;
  return (
    <div className="card" style={{ padding: 0 }}><div className="scroll"><table className="tbl aw-tbl">
      <thead><tr><th>Season</th><th>Champion</th><th>MVP</th><th>OPOY</th><th>DPOY</th><th>OROY</th><th>DROY</th><th>Coach</th><th>SB MVP</th></tr></thead>
      <tbody>{rows.map(a => (
        <tr key={a.season}>
          <td className="num" style={{ fontSize: 20 }}>{a.season}</td>
          <td>{a.champion ? <span className="aw-cell"><Logo team={L.teams[a.champion]} size={26} /><b>{L.teams[a.champion].nick}</b></span> : <span className="mute">—</span>}</td>
          <td>{cell(a.mvp)}</td><td>{cell(a.opoy)}</td><td>{cell(a.dpoy)}</td><td>{cell(a.oroy)}</td><td>{cell(a.droy)}</td>
          <td>{a.coy ? <span className="aw-cell"><Logo team={L.teams[a.coy]} size={22} /><b>{L.teams[a.coy].coach.name}</b></span> : <span className="mute">—</span>}</td>
          <td>{cell(a.sbMvp)}</td>
        </tr>))}</tbody>
    </table></div></div>
  );
}
