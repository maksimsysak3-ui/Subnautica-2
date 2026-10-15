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
  // The line: ratings plus home field, the way a book would hang it.
  const homeEdge = g.neutral ? 0 : 1.7;
  const spread = Math.round(((rh.ovr - ra.ovr) * 0.9 + homeEdge) * 2) / 2;               // + means the home team is favoured
  const pHome = 1 / (1 + Math.exp(-spread / 6.2));
  const total = Math.round((44 + (ra.off + rh.off - ra.def - rh.def) * 0.22 - (wx.wind >= 15 && !wx.dome ? 3 : 0) - (wx.precip !== 'none' && !wx.dome ? 2.5 : 0)) * 2) / 2;
  const fav = spread >= 0 ? home : away;
  const keys = gameKeys(L, me, opp, me === home ? rh : ra, me === home ? ra : rh, st);
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

      <section className="pv-line">
        <Form L={L} t={away} s={st[away.abbr]} side="a" />
        <div className="pv-book">
          <div className="pv-odds">
            <div><span>Line</span><b>{Math.abs(spread) < 0.5 ? 'Pick' : `${fav.abbr} −${Math.abs(spread)}`}</b></div>
            <div><span>Over/Under</span><b>{total}</b></div>
            <div><span>Win probability</span><b>{Math.round((me === home ? pHome : 1 - pHome) * 100)}%</b><em>{me.nick}</em></div>
          </div>
          <div className="pv-wp"><i className="a" style={{ width: `${(1 - pHome) * 100}%` }}><Logo team={away} size={18} />{Math.round((1 - pHome) * 100)}%</i><i className="h" style={{ width: `${pHome * 100}%` }}>{Math.round(pHome * 100)}%<Logo team={home} size={18} /></i></div>
        </div>
        <Form L={L} t={home} s={st[home.abbr]} side="h" />
      </section>

      <section className="pv-grid">
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div className="pv-panel pv-keys" style={{ '--d': '0.45s' } as CSSProperties}>
          <h4>Keys to the Game · {me.nick}</h4>
          {keys.map((k, i) => <div key={i} className={`pv-key ${k.tone}`}><b>{i + 1}</b><div><strong>{k.title}</strong><span>{k.text}</span></div></div>)}
        </div>
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

type Ratings = ReturnType<typeof teamRatings>;
type Standing = ReturnType<typeof standings>[string];
/** Recent form: record, the last five, points for and against a game, the streak. */
function Form({ L, t, s, side }: { L: League; t: Team; s: Standing; side: 'a' | 'h' }) {
  const gp = Math.max(1, s.w + s.l + s.t);
  const last = (s.last5 ?? '').split('').slice(-5);
  return (
    <div className={`pv-form ${side}`}>
      <div className="pv-fh"><Logo team={t} size={26} /><b>{t.abbr}</b><span>{s.w}-{s.l}{s.t ? `-${s.t}` : ''}</span></div>
      <div className="pv-l5">{last.length ? last.map((r, i) => <i key={i} className={r === 'W' ? 'w' : r === 'L' ? 'l' : 't'}>{r}</i>) : <em>First game</em>}</div>
      <div className="pv-pp"><span>PF <b>{(s.pf / gp).toFixed(1)}</b></span><span>PA <b>{(s.pa / gp).toFixed(1)}</b></span>{s.streak && <span>Streak <b>{s.streak}</b></span>}</div>
      {void L}
    </div>
  );
}
/** Three keys for your side, from the biggest gaps between the two rosters. */
function gameKeys(L: League, me: Team, opp: Team, m: Ratings, o: Ratings, st: Record<string, Standing>) {
  const qb = (t: Team) => { const id = t.depth.QB?.[0]; return id ? L.players[id] : undefined; };
  const myQb = qb(me), theirQb = qb(opp);
  const cands: { gap: number; title: string; text: string; tone: string }[] = [
    { gap: m.dl - o.ol, title: m.dl >= o.ol ? 'Win up front' : 'Bring extra rushers', text: m.dl >= o.ol ? `Your front (${Math.round(m.dl)}) against their O-line (${Math.round(o.ol)}): a four-man rush should get home.` : `Their O-line (${Math.round(o.ol)}) handles your front (${Math.round(m.dl)}). Pressure has to come from the blitz.`, tone: m.dl >= o.ol ? 'good' : 'warn' },
    { gap: m.ol - o.dl, title: m.ol >= o.dl ? `Keep ${myQb?.ln ?? 'the QB'} clean` : `Get the ball out fast`, text: m.ol >= o.dl ? `Your line (${Math.round(m.ol)}) should win against their rush (${Math.round(o.dl)}). Take shots off play-action.` : `Their rush (${Math.round(o.dl)}) beats your line (${Math.round(m.ol)}). Quick game, screens and a back chipping the edge.`, tone: m.ol >= o.dl ? 'good' : 'warn' },
    { gap: m.db - o.qb, title: m.db >= o.qb ? `Make ${theirQb?.ln ?? 'him'} hold it` : `Keep ${theirQb?.ln ?? 'him'} in front`, text: m.db >= o.qb ? `Your secondary (${Math.round(m.db)}) can sit on routes against a ${Math.round(o.qb)} passer. Mix in man.` : `Their quarterback (${Math.round(o.qb)}) can pick apart your secondary (${Math.round(m.db)}). Two deep and tackle the catch.`, tone: m.db >= o.qb ? 'good' : 'warn' },
    { gap: m.skill - o.lb, title: m.skill >= o.lb ? 'Attack their linebackers' : 'Grind it out', text: m.skill >= o.lb ? `Your skill players (${Math.round(m.skill)}) against their linebackers (${Math.round(o.lb)}): get your backs and tight end in space.` : `Their linebackers (${Math.round(o.lb)}) can run with your playmakers (${Math.round(m.skill)}). Stay ahead of the chains.`, tone: m.skill >= o.lb ? 'good' : 'warn' },
  ];
  const s = st[opp.abbr];
  if (/^W[3-9]/.test(s.streak ?? '')) cands.push({ gap: 7, title: `Stop the streak`, text: `The ${opp.nick} have won ${s.streak!.slice(1)} straight. Start fast and take the crowd out of it.`, tone: 'warn' });
  return cands.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 3);
}
