// Injury Report, the way the league publishes it each week: game status, body part,
// Wednesday-to-Friday practice participation and the expected return. "This Week"
// puts your report next to your opponent's; "League" lists every team.
import { useState } from 'react';
import { useApp, app } from '../store';
import { Face, Logo, Ovr } from '../components';
import type { League, Player, Pos } from '../../core/types';
import { userGame, REG_WEEKS } from '../../core/season';
import { POS_ORDER } from '../../core/ratings';

type Status = 'Season-Ending' | 'IR' | 'Out' | 'Questionable';
const STARTERS: Partial<Record<Pos, number>> = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
const PART: [RegExp, string][] = [[/ACL|MCL|Knee/i, 'Knee'], [/Achilles/i, 'Achilles'], [/Leg/i, 'Leg'], [/Pectoral/i, 'Pectoral'], [/Ankle/i, 'Ankle'], [/Hand/i, 'Hand'], [/Rib/i, 'Ribs'],
  [/Hamstring/i, 'Hamstring'], [/Concussion/i, 'Head'], [/Shoulder|Stinger/i, 'Shoulder'], [/Hip/i, 'Hip'], [/Cramp/i, 'Calf'], [/Strain/i, 'Groin']];
const bodyPart = (type: string) => PART.find(([re]) => re.test(type))?.[1] ?? type;

export interface ReportRow { p: Player; status: Status; part: string; detail: string; practice: [string, string, string]; back: string; starter: boolean }

/** Who is on the report: everyone hurt, plus healthy players worn down enough to be listed. */
export function injuryReport(L: League, team: string): ReportRow[] {
  const roster = Object.values(L.players).filter(p => p.team === team && (p.status === 'ACT' || p.status === 'IR'));
  const starter = (p: Player) => roster.filter(q => q.pos === p.pos && q.ovr > p.ovr).length < (STARTERS[p.pos] ?? 0);
  const inSeason = L.phase === 'regular' || L.phase === 'playoffs';
  const rows: ReportRow[] = [];
  for (const p of roster) {
    const inj = p.injury;
    if (inj) {
      const status: Status = inj.season ? 'Season-Ending' : p.status === 'IR' ? 'IR' : 'Out';
      // A player due back next week starts working back in on Thursday.
      const practice: [string, string, string] = inj.weeks <= 1 && !inj.season ? ['DNP', 'LP', 'LP'] : ['DNP', 'DNP', 'DNP'];
      const ret = L.week + inj.weeks; // back for the game after his remaining weeks
      const back = inj.season ? 'Next season' : !inSeason ? `${inj.weeks} wk${inj.weeks > 1 ? 's' : ''}` : ret > REG_WEEKS + 4 ? 'Next season' : ret > REG_WEEKS ? 'Playoffs' : `Week ${ret}`;
      rows.push({ p, status, part: bodyPart(inj.type), detail: inj.type, practice, back, starter: starter(p) });
    } else if (inSeason && p.cond < 72) {
      // Not hurt, but beaten up from the workload: listed, and he plays.
      rows.push({ p, status: 'Questionable', part: p.cond < 60 ? 'Knee' : 'Not injury related', detail: `Wear and tear (${Math.round(p.cond)}% fresh)`, practice: p.cond < 60 ? ['DNP', 'LP', 'FP'] : ['LP', 'LP', 'FP'], back: 'Game-time', starter: starter(p) });
    }
  }
  const order: Record<Status, number> = { 'Season-Ending': 0, IR: 1, Out: 2, Questionable: 3 };
  return rows.sort((a, b) => Number(b.starter) - Number(a.starter) || order[a.status] - order[b.status] || b.p.ovr - a.p.ovr);
}

const LEVEL_MULT = { Low: 0.45, Normal: 0.85, Realistic: 1.7 } as const;
const LEVEL_TIP = { Low: 'About a third of the NFL rate', Normal: 'Somewhat below the NFL rate (default)', Realistic: 'NFL injury rates' } as const;
/** Change the injury slider; lowering it also shortens injuries already on the books. */
function setLevel(L: League, level: 'Low' | 'Normal' | 'Realistic') {
  const ratio = LEVEL_MULT[level] / LEVEL_MULT[L.injuryLevel ?? 'Normal'];
  L.injuryLevel = level;
  if (ratio < 1) for (const p of Object.values(L.players)) if (p.injury && !p.injury.season) p.injury.weeks = Math.max(1, Math.round(p.injury.weeks * ratio));
  app.touch();
  app.toast(`Injury frequency: ${level}${ratio < 1 ? ' · current injuries shortened' : ''}`);
}

export function InjuryScreen() {
  const L = useApp().league!;
  const [view, setView] = useState<'week' | 'league'>('week');
  const [pos, setPos] = useState('All');
  const [startersOnly, setStartersOnly] = useState(false);
  const g = userGame(L);
  const opp = g ? (g.home === L.user ? g.away : g.home) : undefined;
  const all = Object.keys(L.teams).map(t => ({ t, rows: injuryReport(L, t) }));
  const out = all.reduce((a, x) => a + x.rows.filter(r => r.status !== 'Questionable').length, 0);
  const ir = all.reduce((a, x) => a + x.rows.filter(r => r.status === 'IR' || r.status === 'Season-Ending').length, 0);
  const hurtStarters = (rows: ReportRow[]) => rows.filter(r => r.starter && r.status !== 'Questionable');
  const worst = [...all].sort((a, b) => hurtStarters(b.rows).reduce((s, r) => s + r.p.ovr, 0) - hurtStarters(a.rows).reduce((s, r) => s + r.p.ovr, 0))
    .filter(x => hurtStarters(x.rows).length).slice(0, 3);
  const filt = (rows: ReportRow[]) => rows.filter(r => (pos === 'All' || r.p.pos === pos) && (!startersOnly || r.starter));
  return (
    <div className="grid">
      <div className="row"><div className="page-title" style={{ margin: 0 }}>Injury Report</div>
        <span className="small dim">{L.phase === 'regular' || L.phase === 'playoffs' ? `Week ${L.week}` : L.season}</span><div className="spacer" />
        <span className="small dim" style={{ marginRight: 2 }}>Injuries</span>
        {(['Low', 'Normal', 'Realistic'] as const).map(l => <span key={l} className={`chip${(L.injuryLevel ?? 'Normal') === l ? ' on' : ''}`} title={LEVEL_TIP[l]} onClick={() => setLevel(L, l)}>{l}</span>)}
        <span style={{ width: 14 }} />
        <span className={`chip${view === 'week' ? ' on' : ''}`} onClick={() => setView('week')}>This Week</span>
        <span className={`chip${view === 'league' ? ' on' : ''}`} onClick={() => setView('league')}>League</span></div>
      <div className="ir-sum">
        <div><b>{out}</b><span>Players out league-wide</span></div>
        <div><b>{ir}</b><span>On injured reserve</span></div>
        <div><b>{hurtStarters(injuryReport(L, L.user)).length}</b><span>{L.teams[L.user].nick} starters out</span></div>
        <div className="ir-worst"><span>Hit hardest</span>{worst.map(w => <em key={w.t}><Logo team={L.teams[w.t]} size={22} />{L.teams[w.t].abbr} <b>{hurtStarters(w.rows).length}</b></em>)}</div>
      </div>
      <div className="row" style={{ gap: 4 }}>{['All', ...POS_ORDER].map(p => <span key={p} className={`chip${pos === p ? ' on' : ''}`} style={{ padding: '2px 8px' }} onClick={() => setPos(p)}>{p}</span>)}
        <div className="spacer" /><span className={`chip${startersOnly ? ' on' : ''}`} onClick={() => setStartersOnly(!startersOnly)}>Starters only</span></div>
      {view === 'week' ? (
        <div className={`grid ${opp ? 'g2' : ''}`} style={{ alignItems: 'start' }}>
          <TeamReport L={L} team={L.user} rows={filt(injuryReport(L, L.user))} />
          {opp && <TeamReport L={L} team={opp} rows={filt(injuryReport(L, opp))} label={`${g!.home === L.user ? 'vs' : '@'} opponent`} />}
        </div>
      ) : (
        <div className="ir-league">{all.filter(x => filt(x.rows).length).sort((a, b) => L.teams[a.t].name.localeCompare(L.teams[b.t].name)).map(x => <TeamReport key={x.t} L={L} team={x.t} rows={filt(x.rows)} compact />)}</div>
      )}
    </div>
  );
}

function TeamReport({ L, team, rows, label, compact }: { L: League; team: string; rows: ReportRow[]; label?: string; compact?: boolean }) {
  const t = L.teams[team];
  return (
    <div className="card ir-card" style={{ '--tc': t.colors[0] } as React.CSSProperties}>
      <div className="ir-head"><Logo team={t} size={compact ? 30 : 40} /><div><div className="ir-team">{t.name}</div>{label && <div className="small dim">{label}</div>}</div><div className="spacer" />
        <span className="small dim">{rows.filter(r => r.status !== 'Questionable').length} out · {rows.filter(r => r.status === 'Questionable').length} questionable</span></div>
      {!rows.length ? <div className="ir-clean">No players listed. Fully healthy.</div> : (
        <table className="tbl ir-tbl"><thead><tr><th>Player</th><th>Injury</th>{!compact && <><th className="c">Wed</th><th className="c">Thu</th><th className="c">Fri</th></>}<th>Status</th><th className="r">Return</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.p.id} onClick={() => app.go({ id: 'player', pid: r.p.id })}>
              <td><span className="ir-pl"><Face p={r.p} size={compact ? 26 : 32} /><span><b>{r.p.fn[0]}. {r.p.ln}</b><em>{r.p.pos}{r.starter && <i className="ir-st">Starter</i>}</em></span>{!compact && <Ovr v={r.p.ovr} />}</span></td>
              <td><b>{r.part}</b><div className="small mute">{r.detail}</div></td>
              {!compact && r.practice.map((x, i) => <td key={i} className="c"><span className={`ir-pr ${x}`}>{x}</span></td>)}
              <td><span className={`ir-status ${r.status.replace(/\W/g, '')}`}>{r.status}</span></td>
              <td className="r small">{r.back}</td>
            </tr>))}</tbody></table>
      )}
    </div>
  );
}
