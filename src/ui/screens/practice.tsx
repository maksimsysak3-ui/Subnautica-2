// Practice: plan Wednesday, Thursday and Friday (a drill and pads for each), run the
// week on the practice field, and read the report: a grade per day, who stood out,
// anyone who got dinged, and the edge it buys on Sunday.
import { useEffect, useState, type CSSProperties } from 'react';
import { useApp, app } from '../store';
import { Logo, vivid } from '../components';
import { DRILLS, DAYS, practiceWeek, runPractice, type Drill, type Pads } from '../../core/practice';
import type { Pos } from '../../core/types';
import { POS_NAME } from '../../core/ratings';

const GROUPS: Pos[] = ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'EDGE', 'DT', 'LB', 'CB', 'S'];

export function PracticeScreen() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const w = practiceWeek(L);
  const [day, setDay] = useState(0);
  const [running, setRunning] = useState(false);
  const g = L.games.find(x => x.season === L.season && x.week === L.week && (x.home === L.user || x.away === L.user));
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const c1 = vivid(me.colors[0]);
  const set = (k: number, patch: Partial<(typeof w.sessions)[number]>) => { w.sessions[k] = { ...w.sessions[k], ...patch }; app.touch(); };
  useEffect(() => { if (!running) return; const t = setTimeout(() => { runPractice(L); setRunning(false); app.touch(); }, 2600); return () => clearTimeout(t); }, [running]);
  const off = !g || !!g.result || (L.phase !== 'regular' && L.phase !== 'playoffs' && L.phase !== 'preseason');
  return (
    <div className="pr" style={{ '--tc': c1 } as CSSProperties}>
      <div className="pr-head">
        <div><span className="up">{me.name} · Week {L.week}</span><div className="h1">Practice</div>
          <p className="dim">Three periods this week. Each drill carries into Sunday: installs sharpen a unit, red-zone and two-minute work help in those spots, ball security cuts turnovers. Full pads teach more but wear players down and can cost you someone.</p></div>
        {opp && <div className="pr-opp"><span>This week</span><div><Logo team={opp} size={54} /><b>{g!.home === L.user ? 'vs' : '@'} {opp.nick}</b></div></div>}
      </div>
      {off ? <div className="card dim">No practice to plan right now: the week's game is done or it's the offseason.</div> : running ? <PracticeField c={c1} /> : !w.done ? (
        <>
          <div className="pr-days">{DAYS.map((d, k) => { const s = w.sessions[k], dr = DRILLS[s.drill]; return (
            <button key={d} className={`pr-day${day === k ? ' on' : ''}`} onClick={() => setDay(k)}>
              <span className="pr-dn">{d}</span>
              <i className="pr-mono">{dr.icon}</i>
              <b>{dr.name}{s.drill === 'position' && s.group ? ` · ${s.group}` : ''}</b>
              <em>{dr.desc}</em>
              <div className="pr-pads" onClick={e => e.stopPropagation()}>{(['Shells', 'Full Pads'] as Pads[]).map(p => <span key={p} className={s.pads === p ? 'on' : ''} onClick={() => set(k, { pads: p })}>{p}</span>)}</div>
            </button>
          ); })}</div>
          <div className="pr-pick">
            <h3>{DAYS[day]}: choose the period</h3>
            <div className="pr-drills">{(Object.keys(DRILLS) as Drill[]).map(k => (
              <button key={k} className={`pr-drill${w.sessions[day].drill === k ? ' on' : ''}`} onClick={() => set(day, { drill: k, group: k === 'position' ? w.sessions[day].group ?? 'WR' : undefined })}>
                <i className="pr-mono">{DRILLS[k].icon}</i><b>{DRILLS[k].name}</b><span>{DRILLS[k].desc}</span>
              </button>
            ))}</div>
            {w.sessions[day].drill === 'position' && <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>{GROUPS.map(p => <span key={p} className={`chip${w.sessions[day].group === p ? ' on' : ''}`} title={POS_NAME[p]} onClick={() => set(day, { group: p })}>{p}</span>)}</div>}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="btn primary big" onClick={() => setRunning(true)}>Run the Week of Practice ▸</button></div>
        </>
      ) : (
        <div className="pr-report">
          {w.report.map((r, i) => (
            <div key={r.day} className="pr-rcard" style={{ animationDelay: `${i * 0.15}s` }}>
              <span className="pr-dn">{r.day}</span><b><i className="pr-mono sm">{DRILLS[r.drill].icon}</i>{DRILLS[r.drill].name}</b>
              <i className={`pr-grade g${r.grade[0]}`} style={{ animationDelay: `${0.3 + i * 0.15}s` }}>{r.grade}</i>
              <p>{r.note}</p>
              {r.star && <div className="pr-star"><span>Practice standout</span>{r.star}</div>}
              {r.hurt && <div className="pr-hurt"><span>Injury</span>{r.hurt}</div>}
            </div>
          ))}
          <div className="card pr-edge">
            <h3>Sunday edge</h3>
            {([['Offense', w.edge.off, 0.9], ['Defense', w.edge.def, 0.9], ['Red zone', w.edge.rz, 1], ['Two-minute', w.edge.late, 1], ['Ball security', w.edge.ball, 0.3], ['Pass rush', w.edge.rush, 0.3], ['Tackling', w.edge.tackle, 0.25]] as const).filter(([, v]) => v > 0).map(([k, v, max]) => (
              <div key={k} className="pr-bar"><span>{k}</span><i><em style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i><b>{Math.round((v / max) * 100)}%</b></div>
            ))}
            <div className="small dim" style={{ marginTop: 8 }}>Applies to this week's game only. Next week starts fresh.</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The practice field while the week runs: units doing drills, cones, a coach's whistle. */
function PracticeField({ c }: { c: string }) {
  return (
    <div className="pr-field">
      {Array.from({ length: 22 }, (_, i) => <i key={i} className={`pr-pl ${i % 2 ? 'b' : 'a'}`} style={{ left: `${8 + (i % 11) * 8}%`, top: `${i < 11 ? 34 : 58}%`, animationDelay: `${-(i * 0.37)}s`, background: i % 2 ? '#e8ecf2' : c } as CSSProperties} />)}
      {Array.from({ length: 8 }, (_, i) => <em key={i} className="pr-cone" style={{ left: `${12 + i * 11}%`, top: i % 2 ? '22%' : '76%' }} />)}
      <div className="pr-fcap"><b>Practice in session</b><span>Wednesday · Thursday · Friday</span></div>
    </div>
  );
}
