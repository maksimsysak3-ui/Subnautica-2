// Prime-time cold open. Night games, the playoffs and rivalry weeks start like a network
// broadcast: the show open with a light sweep across the title, the venue and weather,
// both teams slamming in, starting lineups introduced one by one ("Joe Burrow, LSU"),
// and a tale of the tape. The play-by-play voice opens the broadcast (spoken aloud if the
// commentary voice is on). Any key or click skips ahead; Esc skips the whole open.
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Game, League, Player, Team } from '../core/types';
import type { Weather } from '../sim/game';
import { Logo, Face, vivid } from './components';
import { standings, ROUND_NAME } from '../core/season';
import { teamRatings } from '../core/league';
import { speak, voiceOn } from './voice';
import { hash } from '../core/rng';
import { ShowLogo, showMark } from './showlogo';
import { heat, heatLevel } from '../core/rivalry';

export const PLAY_BY_PLAY = 'Mike Dalton';
const SHOW: Record<string, string> = { Thu: 'Thursday Night Football', Mon: 'Monday Night Football', SunN: 'Sunday Night Football', Sat: 'Saturday Showcase' };

/** Which show this game is, if any: night games, playoffs, or a big rivalry week. */
export function showFor(L: League, g: Game): string | undefined {
  if (g.week > 18) return g.week === 22 ? 'Super Bowl' : `${ROUND_NAME[g.week]} Round`;
  const night = +(g.time ?? '13:00').slice(0, 2) >= 19;
  const hour = +(g.time ?? '13:00').slice(0, 2);
  if (g.day === 'Thu' && !night) return 'Thanksgiving Football';
  if (g.day === 'Thu' || g.day === 'Mon') return SHOW[g.day];
  if (g.day === 'Sun' && night) return SHOW.SunN;
  if (g.day === 'Sun' && hour < 11) return 'International Series';
  if (g.day === 'Wed' || g.day === 'Fri') return `${g.day === 'Wed' ? 'Wednesday' : 'Friday'} Night Football`;
  if (g.day === 'Sat') return SHOW.Sat;
  if (heat(L, g.home, g.away) >= 55) return 'Rivalry Game';
  return undefined;
}

const LINEUP: [string, number][] = [['QB', 0], ['RB', 0], ['WR', 0], ['WR', 1], ['TE', 0], ['EDGE', 0], ['LB', 0], ['CB', 0]];
function starters(L: League, t: Team): Player[] {
  return LINEUP.map(([pos, i]) => L.players[t.depth[pos as keyof Team['depth']]?.[i] ?? '']).filter((p): p is Player => !!p && !p.injury);
}

export function PrimeIntro({ L, g, weather, onDone }: { L: League; g: Game; weather: Weather; onDone: () => void }) {
  const show = showFor(L, g)!;
  const away = L.teams[g.away], home = L.teams[g.home];
  const st = standings(L);
  const rec = (t: Team) => { const s = st[t.abbr]; return `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}`; };
  const ppg = (t: Team) => { const s = st[t.abbr]; const gp = s.w + s.l + s.t; return gp ? (s.pf / gp).toFixed(1) : '—'; };
  const ra = teamRatings(L, away.abbr), rh = teamRatings(L, home.abbr);
  const lines = [starters(L, away), starters(L, home)];
  // Stages: 0 open, 1 matchup, 2 away lineup, 3 home lineup, 4 tale of the tape.
  const [stage, setStage] = useState(0);
  const [k, setK] = useState(0);   // which player in a lineup
  const venue = g.neutral ?? home.stadium;
  const wx = weather.dome ? 'Indoors' : `${weather.temp}°, ${weather.precip !== 'none' ? weather.precip : weather.wind >= 15 ? `wind ${weather.wind} mph` : 'clear'}`;
  const night = +(g.time ?? '13:00').slice(0, 2) >= 19;
  const opener = [
    `Good ${night ? 'evening' : 'afternoon'}, everybody, and welcome to ${show}. The ${away.name} and the ${home.name}, live from ${venue}.`,
    `${night ? 'Under the lights' : 'It is a big one'} at ${venue}. ${away.nick} at ${home.nick}, and it's ${show}.`,
    `Hello again, everyone. ${show} brings us ${away.nick} versus ${home.nick}. What a setting.`,
  ][(hash(g.id) >>> 0) % 3];
  useEffect(() => { if (voiceOn()) speak(opener); }, []);
  // The open runs itself; lineups tick player by player.
  useEffect(() => {
    if (stage === 2 || stage === 3) {
      const list = lines[stage - 2];
      const t = setTimeout(() => { if (k + 1 < list.length) setK(k + 1); else { setK(0); setStage(stage + 1); } }, 620);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => (stage < 4 ? setStage(stage + 1) : onDone()), [3400, 2600, 0, 0, 4200][stage]);
    return () => clearTimeout(t);
  }, [stage, k]);
  const next = () => { if (stage === 2 || stage === 3) { setK(0); setStage(stage + 1); } else if (stage < 4) setStage(stage + 1); else onDone(); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === 'Escape') onDone(); else next(); };
    window.addEventListener('keydown', key, true); return () => window.removeEventListener('keydown', key, true);
  });
  const team = stage === 3 ? home : away;
  const col = (t: Team) => vivid(t.colors[0]);
  return createPortal(
    <div className="pt" onClick={next} style={{ '--a': col(away), '--h': col(home) } as CSSProperties}>
      <i className="pt-bar top" /><i className="pt-bar bot" />
      <div className="pt-lights"><i /><i /><i /></div>
      {stage === 0 && <div className="pt-open">
        {showMark(show) ? <ShowLogo mark={showMark(show)!} size={Math.min(360, window.innerHeight * 0.55)} />
          : <><span className="pt-net">GGN Sports presents</span><h1 className="pt-title"><span>{show}</span></h1></>}
        <div className="pt-venue">{venue} · {wx}</div>
      </div>}
      {stage === 1 && <div className="pt-vs">
        <div className="pt-side a"><Logo team={away} size={190} /><b>{away.name}</b><span>{rec(away)}</span></div>
        <div className="pt-x">VS</div>
        <div className="pt-side h"><Logo team={home} size={190} /><b>{home.name}</b><span>{rec(home)}</span></div>
      </div>}
      {(stage === 2 || stage === 3) && <div className="pt-line" style={{ '--c': col(team) } as CSSProperties}>
        <div className="pt-lh"><Logo team={team} size={54} /><div><span>Starting lineup</span><b>{team.name}</b></div></div>
        <div className="pt-cards">{lines[stage - 2].map((p, i) => (
          <div key={p.id} className={`pt-card${i === k ? ' on' : i < k ? ' done' : ''}`}>
            <Face p={p} size={140} team={team} />
            <div className="pt-cn"><b>{p.fn} {p.ln}</b><span>{p.pos} · {p.col}</span></div>
          </div>
        ))}</div>
        {lines[stage - 2][k] && <div className="pt-intro" key={lines[stage - 2][k].id}><b>{lines[stage - 2][k].fn} {lines[stage - 2][k].ln}</b><span>{lines[stage - 2][k].col}</span></div>}
      </div>}
      {stage === 4 && <div className="pt-tape">
        <h2>Tale of the Tape</h2>
        {([['Record', rec(away), rec(home)], ['Overall', ra.ovr, rh.ovr], ['Offense', Math.round(ra.off), Math.round(rh.off)], ['Defense', Math.round(ra.def), Math.round(rh.def)], ['Points / game', ppg(away), ppg(home)]] as const).map(([lbl, x, y], i) => (
          <div key={lbl} className="pt-row" style={{ animationDelay: `${i * 0.12}s` }}><b className="a">{x}</b><span>{lbl}</span><b className="h">{y}</b></div>
        ))}
        {heat(L, g.home, g.away) >= 25 && <div className="pt-heat" style={{ animationDelay: '.7s' }}><span>Rivalry · {heatLevel(heat(L, g.home, g.away))}</span><i><em style={{ width: `${heat(L, g.home, g.away)}%` }} /></i></div>}
        <div className="pt-teams"><Logo team={away} size={44} /><span>{away.nick}</span><i /><span>{home.nick}</span><Logo team={home} size={44} /></div>
      </div>}
      <div className="pt-cap"><b>{PLAY_BY_PLAY}</b><span>{opener}</span></div>
      <span className="pt-skip">Click or any key to advance · Esc to skip</span>
    </div>,
    document.body,
  );
}
