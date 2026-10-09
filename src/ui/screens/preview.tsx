// Pregame show: the two marks face off in 3D, then the tale of the tape. Key
// matchups pair real players against each other with the attributes that decide
// the battle, and say who has the edge. Weather comes from the same seed the game
// engine uses, so what the preview promises is what the game delivers.
import type { CSSProperties } from 'react';
import { useApp, app, saveLeague } from '../store';
import { Logo, Portrait, vivid } from '../components';
import { standings, advance, ROUND_NAME } from '../../core/season';
import { teamRatings } from '../../core/league';
import { makeWeather } from '../../sim/game';
import { Rng, hash } from '../../core/rng';
import { ATTR_NAME } from '../../core/ratings';
import { practiceWeek } from '../../core/practice';
import { InjuryReport } from './practice';
import type { League, Player, Pos, Team, Attrs } from '../../core/types';

const starter = (L: League, t: Team, pos: Pos, i = 0): Player | undefined => {
  const id = t.depth[pos]?.[i]; const p = id ? L.players[id] : undefined;
  return p && !p.injury ? p : (t.depth[pos] ?? []).map(x => L.players[x]).find(q => q && !q.injury);
};
const best = (L: League, t: Team, ...pos: Pos[]) => pos.flatMap(ps => (t.depth[ps] ?? []).slice(0, 2).map(id => L.players[id])).filter(p => p && !p.injury).sort((a, b) => b.ovr - a.ovr)[0];

interface Duel { title: string; a?: Player; b?: Player; ka: (keyof Attrs)[]; kb: (keyof Attrs)[] }

export function MatchupPreview({ gid, embedded }: { gid: string; embedded?: boolean }) {
  const L = useApp().league!;
  const g = L.games.find(x => x.id === gid);
  if (!g) return <div className="empty">Game not found.</div>;
  const away = L.teams[g.away], home = L.teams[g.home];
  const me = g.home === L.user ? home : away, opp = me === home ? away : home;
  const st = standings(L);
  const ra = teamRatings(L, away.abbr), rh = teamRatings(L, home.abbr);
  const wx = makeWeather(home, g, new Rng(hash(g.id + L.seed)));
  const duels: Duel[] = [
    { title: `${me.nick} pass game`, a: best(L, me, 'WR'), b: starter(L, opp, 'CB'), ka: ['RTE', 'SPD', 'CTH'], kb: ['MCV', 'SPD', 'ZCV'] },
    { title: 'In the trenches', a: starter(L, me, 'QB'), b: best(L, opp, 'EDGE', 'DT'), ka: ['TUP', 'AWR', 'THP'], kb: ['FMV', 'PMV', 'BSH'] },
    { title: `${opp.nick} pass game`, a: best(L, opp, 'WR'), b: starter(L, me, 'CB'), ka: ['RTE', 'SPD', 'CTH'], kb: ['MCV', 'SPD', 'ZCV'] },
    { title: 'On the ground', a: starter(L, opp, 'RB'), b: best(L, me, 'LB'), ka: ['BCV', 'ELU', 'BTK'], kb: ['TAK', 'PUR', 'PRC'] },
  ];
  const out = [me, opp].map(t => Object.values(L.players).filter(p => p.team === t.abbr && p.injury && p.ovr >= 75).sort((a, b) => b.ovr - a.ovr).slice(0, 4));
  const rows: [string, number, number][] = [['Overall', ra.ovr, rh.ovr], ['Offense', ra.off, rh.off], ['Defense', ra.def, rh.def], ['Quarterback', ra.qb, rh.qb], ['O-Line', ra.ol, rh.ol], ['D-Line', ra.dl, rh.dl], ['Secondary', ra.db, rh.db]];
  const when = g.week > 18 ? ROUND_NAME[g.week] : `Week ${g.week}`;
  // The week of practice comes first, day by day, unless it has already been run.
  const play = () => (practiceWeek(L).done || g.week !== L.week ? app.replace({ id: 'game', gid }) : app.go({ id: 'practice', then: 'play', gid }));
  const sim = () => app.busy('Simulating the week', async () => { await advance(L); await saveLeague(L, `${L.id}-auto`); app.replace({ id: 'box', gid }); });
  return (
    <div className={`pv${embedded ? ' embedded' : ''}`} style={{ '--ca': vivid(away.colors[0]), '--ch': vivid(home.colors[0]) } as CSSProperties}>
      <div className="pv-bg"><i className="a" /><i className="h" /></div>
      <header className="pv-top">
        {embedded ? <div /> : <button className="btn ghost sm" onClick={() => app.backTo()}>Back</button>}
        <div className="pv-when"><b>{when}</b><span>{g.day} {g.time} · {g.neutral ?? home.stadium}</span><span>{wx.dome ? 'Indoors' : `${wx.temp}°F · Wind ${wx.wind} mph${wx.precip !== 'none' ? ` · ${wx.precip}` : ''}`}</span></div>
        <div className="row"><button className="btn" onClick={sim}>Sim Game</button><button className="btn primary big" onClick={play}>Play Game</button></div>
      </header>

      <section className="pv-face">
        {[away, home].map((t, i) => (
          <div key={t.abbr} className={`pv-team ${i ? 'h' : 'a'}`}>
            <Logo3D team={t} size={230} />
            <div className="pv-name"><span>{t.name.replace(` ${t.nick}`, '')}</span><b>{t.nick}</b></div>
            <div className="pv-rec">{st[t.abbr].w}-{st[t.abbr].l}{st[t.abbr].t ? `-${st[t.abbr].t}` : ''} · {i ? 'Home' : 'Away'}</div>
          </div>
        ))}
        <div className="pv-vs">VS</div>
      </section>

      <section className="pv-grid">
        <div className="pv-panel" style={{ '--d': '0.5s' } as CSSProperties}>
          <h4>Tale of the Tape</h4>
          {rows.map(([k, a, h]) => (
            <div key={k} className="pv-row">
              <b className={a > h ? 'win' : ''}>{Math.round(a)}</b>
              <div className="pv-bars"><i className="a" style={{ width: `${Math.max(4, (a - 50) * 2)}%` }} /><span>{k}</span><i className="h" style={{ width: `${Math.max(4, (h - 50) * 2)}%` }} /></div>
              <b className={h > a ? 'win' : ''}>{Math.round(h)}</b>
            </div>
          ))}
        </div>
        <div className="pv-panel pv-duels" style={{ '--d': '0.65s' } as CSSProperties}>
          <h4>Key Matchups</h4>
          {duels.map(d => d.a && d.b && <DuelRow key={d.title} d={d} />)}
        </div>
        <div className="pv-panel" style={{ '--d': '0.8s' } as CSSProperties}>
          <h4>Injury Report</h4>
          {practiceWeek(L).done && g.week === L.week ? <InjuryReport L={L} compact /> : [me, opp].map((t, i) => (
            <div key={t.abbr} style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}><Logo team={t} size={22} /><span className="up">{t.nick}</span></div>
              {out[i].length ? out[i].map(p => <div key={p.id} className="pv-out"><span>{p.pos}</span><b>{p.fn[0]}. {p.ln}</b><em>{p.injury!.type} · {p.injury!.weeks} wk</em></div>) : <div className="small mute">No key players out.</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DuelRow({ d }: { d: Duel }) {
  const a = d.a!, b = d.b!;
  const sa = d.ka.reduce((s, k) => s + a.attrs[k], 0) / d.ka.length, sb = d.kb.reduce((s, k) => s + b.attrs[k], 0) / d.kb.length;
  const edge = sa - sb;
  return (
    <div className="pv-duel">
      <div className="pv-dt">{d.title}<span className={Math.abs(edge) < 2 ? '' : edge > 0 ? 'l' : 'r'}>{Math.abs(edge) < 2 ? 'Even' : `Edge ${edge > 0 ? a.ln : b.ln}`}</span></div>
      <div className="pv-dm">
        <Portrait p={a} size={76} onClick={() => app.go({ id: 'player', pid: a.id })} />
        <div className="pv-dn"><b>{a.fn[0]}. {a.ln}</b><span>{a.pos}</span>{d.ka.map(k => <em key={k} title={ATTR_NAME[k]}>{k} <b>{a.attrs[k]}</b></em>)}</div>
        <div className="pv-dn r"><b>{b.fn[0]}. {b.ln}</b><span>{b.pos}</span>{d.kb.map(k => <em key={k} title={ATTR_NAME[k]}>{k} <b>{b.attrs[k]}</b></em>)}</div>
        <Portrait p={b} size={76} onClick={() => app.go({ id: 'player', pid: b.id })} />
      </div>
      <div className="pv-edge"><i style={{ left: `${50 - Math.max(-48, Math.min(48, edge * 3))}%` }} /></div>
    </div>
  );
}

/** A team mark with real depth: stacked layers form the extrusion, the face catches a moving light. */
function Logo3D({ team, size }: { team: Team; size: number }) {
  return (
    <div className="logo3d" style={{ width: size, height: size }}>
      <div className="l3-spin">
        {Array.from({ length: 14 }, (_, i) => <Logo key={i} team={team} size={size} style={{ position: 'absolute', inset: 0, transform: `translateZ(${-i * 1.6}px)`, filter: `brightness(${i ? 0.32 - i * 0.012 : 1}) ${i ? '' : 'drop-shadow(0 0 1px rgba(255,255,255,.4))'}` }} />)}
      </div>
    </div>
  );
}
