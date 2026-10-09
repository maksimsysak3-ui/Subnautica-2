// Practice: plan Wednesday, Thursday and Friday (a drill and pads for each), then the
// week plays out day by day on the practice field: each day's grade, its top
// performers (and any rating that ticks up), dings and injuries, and the official
// injury report (DNP / Limited / Full, then Questionable, Doubtful or Out by Friday).
import { useEffect, useState, type CSSProperties } from 'react';
import { useApp, app } from '../store';
import { Logo, Face, vivid } from '../components';
import { DRILLS, DAYS, practiceWeek, runDay, type Drill, type Pads, type PracticeReport } from '../../core/practice';
import type { League, Pos } from '../../core/types';
import { POS_NAME, ATTR_NAME } from '../../core/ratings';

const GROUPS: Pos[] = ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'EDGE', 'DT', 'LB', 'CB', 'S'];

export function PracticeScreen({ then, gid }: { then?: 'play'; gid?: string }) {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const w = practiceWeek(L);
  const [day, setDay] = useState(0);
  const [running, setRunning] = useState(false);
  const g = L.games.find(x => x.season === L.season && x.week === L.week && (x.home === L.user || x.away === L.user));
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const c1 = vivid(me.colors[0]);
  const set = (k: number, patch: Partial<(typeof w.sessions)[number]>) => { w.sessions[k] = { ...w.sessions[k], ...patch }; app.touch(); };
  // Day by day: the field runs for a beat, then that day's report lands.
  useEffect(() => {
    if (!running) return;
    if (w.done) { setRunning(false); return; }
    const t = setTimeout(() => { runDay(L); app.touch(); }, 1900);
    return () => clearTimeout(t);
  }, [running, w.day]);
  const off = !g || !!g.result || (L.phase !== 'regular' && L.phase !== 'playoffs' && L.phase !== 'preseason');
  const started = w.day > 0 || running;
  const kickoff = () => app.replace({ id: 'game', gid: gid ?? g!.id });
  return (
    <div className="pr" style={{ '--tc': c1 } as CSSProperties}>
      <div className="pr-head">
        <div><span className="up">{me.name} · Week {L.week}</span><div className="h1">Practice</div>
          <p className="dim">Three periods before {opp ? `the ${opp.nick}` : 'Sunday'}. Installs sharpen a unit, red-zone and two-minute work help in those spots, ball security cuts turnovers. Full pads teach more but wear players down and can cost you someone.</p></div>
        {opp && <div className="pr-opp"><span>This week</span><div><Logo team={opp} size={54} /><b>{g!.home === L.user ? 'vs' : '@'} {opp.nick}</b></div></div>}
      </div>
      {off ? <div className="card dim">No practice to plan right now: the week's game is done or it's the offseason.</div> : !started ? (
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
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            {then && <button className="btn" onClick={() => { while (!practiceWeek(L).done && runDay(L)) { /* all days */ } kickoff(); }}>Skip to Kickoff</button>}
            <button className="btn primary big" onClick={() => setRunning(true)}>Start the Week ▸</button>
          </div>
        </>
      ) : (
        <>
          <div className="pr-report">
            {DAYS.map((d, i) => { const r = w.report[i]; return r ? <DayCard key={d} L={L} r={r} i={i} />
              : i === w.day && running ? <div key={d} className="pr-rcard live"><span className="pr-dn">{d}</span><MiniField c={c1} /><b>{DRILLS[w.sessions[i].drill].name}</b><p className="dim">Practice in session…</p></div>
              : <div key={d} className="pr-rcard wait"><span className="pr-dn">{d}</span><b>{DRILLS[w.sessions[i].drill].name}</b><p className="dim">Up next</p></div>; })}
          </div>
          {w.done && <div className="pr-after">
            <div className="card"><h3>Official Injury Report</h3><InjuryReport L={L} /></div>
            <div className="card pr-edge">
              <h3>Sunday edge</h3>
              {([['Offense', w.edge.off, 0.9], ['Defense', w.edge.def, 0.9], ['Red zone', w.edge.rz, 1], ['Two-minute', w.edge.late, 1], ['Ball security', w.edge.ball, 0.3], ['Pass rush', w.edge.rush, 0.3], ['Tackling', w.edge.tackle, 0.25]] as const).filter(([, v]) => v > 0).map(([k, v, max]) => (
                <div key={k} className="pr-bar"><span>{k}</span><i><em style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i><b>{Math.round((v / max) * 100)}%</b></div>
              ))}
              <div className="small dim" style={{ marginTop: 8 }}>Applies to this week's game only.</div>
              {then && g && !g.result && <button className="btn primary big" style={{ width: '100%', marginTop: 14 }} onClick={kickoff}>Continue to Kickoff ▸</button>}
            </div>
          </div>}
        </>
      )}
    </div>
  );
}

function DayCard({ L, r, i }: { L: League; r: PracticeReport; i: number }) {
  return (
    <div className="pr-rcard">
      <span className="pr-dn">{r.day}</span><b><i className="pr-mono sm">{DRILLS[r.drill].icon}</i>{DRILLS[r.drill].name}</b>
      <i className={`pr-grade g${r.grade[0]}`} style={{ animationDelay: `${0.2 + i * 0.05}s` }}>{r.grade}</i>
      <p>{r.note}</p>
      <div className="pr-tops"><span>Top performers</span>{r.top.map(t => { const p = L.players[t.pid]; return p ? (
        <div key={t.pid} className="pr-top"><Face p={p} size={34} /><div><b>{p.fn[0]}. {p.ln}</b><em>{p.pos}</em></div>
          {t.to > t.from ? <strong className="up1">{t.from} → {t.to}</strong> : t.attr ? <strong className="up1 a">+1 {ATTR_NAME[t.attr as keyof typeof ATTR_NAME] ?? t.attr}</strong> : <small>+{t.xp} XP</small>}</div>
      ) : null; })}</div>
      {r.dinged && <div className="pr-hurt warn"><span>Injury report</span>{r.dinged}</div>}
      {r.hurt && <div className="pr-hurt"><span>Hurt in practice</span>{r.hurt}</div>}
    </div>
  );
}

/** The week's official injury report for both teams: participation by day and game status. */
export function InjuryReport({ L, compact }: { L: League; compact?: boolean }) {
  const w = practiceWeek(L);
  const teams = [...new Set(w.injuries.map(l => l.team))].sort(t => (t === L.user ? -1 : 1));
  if (!w.injuries.length) return <div className="small mute">Nobody on the injury report this week.</div>;
  const short = { DNP: 'DNP', Limited: 'LP', Full: 'FP' } as const;
  return (
    <div className={`ir${compact ? ' compact' : ''}`}>
      {teams.map(t => (
        <div key={t} className="ir-team">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}><Logo team={L.teams[t]} size={22} /><span className="up">{L.teams[t].nick}</span></div>
          {!compact && <div className="ir-row head"><span>Player</span><span>Injury</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Game status</span></div>}
          {w.injuries.filter(l => l.team === t).sort((a, b) => (L.players[b.pid]?.ovr ?? 0) - (L.players[a.pid]?.ovr ?? 0)).map(l => { const p = L.players[l.pid]; if (!p) return null; return (
            <div key={l.pid} className="ir-row">
              <span><b>{p.pos}</b> {p.fn[0]}. {p.ln}</span>
              <span>{l.isNew ? <em className="ir-new">New</em> : null}{l.injury}</span>
              {!compact && [0, 1, 2].map(d => <span key={d} className={`ir-p ${l.part[d] ?? ''}`}>{l.part[d] ? short[l.part[d]] : '—'}</span>)}
              <span>{l.status ? <i className={`ir-s ${l.status}`}>{l.status}</i> : <i className="ir-s ok">No designation</i>}</span>
            </div>
          ); })}
        </div>
      ))}
    </div>
  );
}

function MiniField({ c }: { c: string }) {
  return (
    <div className="pr-field mini">
      {Array.from({ length: 14 }, (_, i) => <i key={i} className={`pr-pl ${i % 2 ? 'b' : 'a'}`} style={{ left: `${8 + (i % 7) * 13}%`, top: `${i < 7 ? 30 : 62}%`, animationDelay: `${-(i * 0.37)}s`, background: i % 2 ? '#e8ecf2' : c } as CSSProperties} />)}
      {Array.from({ length: 5 }, (_, i) => <em key={i} className="pr-cone" style={{ left: `${12 + i * 18}%`, top: i % 2 ? '14%' : '80%' }} />)}
    </div>
  );
}
