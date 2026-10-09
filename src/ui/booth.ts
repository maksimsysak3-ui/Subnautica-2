// The broadcast booth. The play log reads like an official gamebook ("up the middle for 4
// yards"); the booth adds what a TV analyst would say about that snap: the situation it
// came in, what it means for the drive and the score, and how the player's day is going.
// Lines are picked from pools by situation and never repeat within the last several, so
// a long game keeps sounding fresh. Roughly half of all snaps get a line.
import type { GameSim, PlayEvent } from '../sim/game';
import type { League, Player, StatLine } from '../core/types';
import { hash } from '../core/rng';

export const ANALYST = 'Tre Coleman';
export interface BoothMemory { recent: string[]; byN: Map<number, string> }
export const newBooth = (): BoothMemory => ({ recent: [], byN: new Map() });

type Ctx = { n: string; full: string; y: number; team: string; opp: string; d: number; togo: number; q: number; clock: number; lead: number; tot: string; qb?: string; def?: string; streak: number; drive: number; driveYds: number };
type Pool = (c: Ctx) => string;

const ord = (d: number) => ['', 'first', 'second', 'third', 'fourth'][d] ?? '';

// ---- pools ----------------------------------------------------------------------------------
const P: Record<string, Pool[]> = {
  pick6: [c => `Pick six! ${c.def} read it the whole way and the ${c.opp} are in shock.`, c => `You cannot throw that ball. ${c.def} jumped the route and took it to the house.`],
  pick: [c => `${c.def} was sitting on that route. That's a gift for the ${c.team}.`, c => `Bad decision. He stared his man down and ${c.def} made him pay.`, c => `Great disguise by the defense; ${c.qb} never saw ${c.def} rotate over.`, c => `That's a drive-killer. Points off the board for the ${c.opp}.`],
  pickLate: [c => `That could be the ballgame. ${c.def} with the biggest play of his season.`, c => `Oh, what a moment for ${c.def}! The ${c.team} defense delivers when it matters most.`],
  fumble: [c => `Ball's out! The ${c.team} defense has been punching at it all day and it finally came loose.`, c => `He's got to protect the football there. Two hands in traffic.`, c => `Momentum swing. The ${c.opp} gave that one away.`],
  tdLong: [c => `Gone! ${c.n} turns a ${c.y}-yard play into six and this place is going crazy.`, c => `Nobody's catching ${c.n}. ${c.y} yards, and that's a statement.`, c => `One missed tackle and it's over. ${c.n}, ${c.y} yards to the end zone.`],
  tdGoAhead: [c => `And the ${c.team} take the lead! ${c.n} with the go-ahead score.`, c => `Lead change! The ${c.team} answer and now they're in front.`],
  tdLate: [c => `What a time for it. ${c.n} with a score in the fourth quarter when they needed it most.`, c => `Clutch. ${c.n} finds the end zone with ${Math.ceil(c.clock / 60)} minutes left.`],
  tdMulti: [c => `That's number ${c.tot} today for ${c.n}. He is having himself a game.`, c => `${c.n} again! That's ${c.tot} touchdowns, and the ${c.opp} have no answer for him.`],
  tdGoal: [c => `They just wanted it more at the goal line. ${c.n} punches it in.`, c => `Good push up front and ${c.n} falls in. Six points.`],
  td: [c => `Touchdown ${c.team}! ${c.n} finishes off the drive.`, c => `${c.drive} plays, ${c.driveYds} yards, and ${c.n} caps it off.`, c => `Beautiful execution there; ${c.n} was wide open.`, c => `That's how you finish a drive. ${c.n} in the end zone.`],
  mile100r: [c => `${c.n} just went over 100 yards rushing. He's wearing this defense down.`, c => `Century mark for ${c.n}. ${c.tot} on the ground today.`],
  mile100c: [c => `That puts ${c.n} over 100 receiving yards. He's been their go-to guy all day.`, c => `${c.n} crosses the century mark. ${c.tot} receiving yards and counting.`],
  mile300: [c => `${c.qb} is over 300 passing yards. He is dealing.`, c => `300 yards through the air for ${c.qb}, and the ${c.opp} secondary looks gassed.`],
  big: [c => `Big chunk play! ${c.n} picks up ${c.y} and flips the field.`, c => `That's explosive. ${c.y} yards, and the ${c.team} are in business.`, c => `The defense busted that coverage and ${c.n} made them pay.`, c => `${c.n} with the burst. That's ${c.y} yards in a hurry.`],
  sack3: [c => `Drive killer. ${c.def} gets home on third down.`, c => `${c.def} wins off the edge and that's a big third-down stop.`],
  sackMulti: [c => `That's sack number ${c.tot} for ${c.def}. The tackle has no answer for him.`, c => `${c.def} again! He's living in the backfield today.`],
  sack: [c => `${c.def} gets there. The pocket collapsed in a hurry.`, c => `Coverage sack. ${c.qb} had nowhere to go with it.`, c => `Great rush by the front; ${c.def} cleans it up.`],
  fourthYes: [c => `They went for it, and they got it! Gutsy call and it pays off.`, c => `Fourth-down conversion. That's a coach trusting his offense.`],
  fourthNo: [c => `Stopped on fourth down! The ${c.opp} defense holds and gets the ball back.`, c => `They gambled and lost. Turnover on downs.`],
  thirdLong: [c => `Third and ${c.togo}, and they convert. That's a backbreaker for the defense.`, c => `Huge conversion on third and long. ${c.n} found the soft spot in the zone.`, c => `You can't let them convert third and ${c.togo}. That one stings.`],
  third: [c => `Moves the chains on third down. Keeps the drive alive.`, c => `Clutch conversion. ${c.n} knew exactly where the sticks were.`],
  stuffShort: [c => `Stuffed! The defense won at the point of attack on ${ord(c.d)} and short.`, c => `Nowhere to go. The ${c.opp} front filled every gap.`],
  loss: [c => `Penetration right away. Blown up in the backfield.`, c => `Somebody missed a block there and it cost them.`],
  streak: [c => `That's ${c.streak} straight completions for ${c.qb}. He's in a rhythm.`, c => `${c.qb} hasn't missed in a while: ${c.streak} in a row.`],
  longDrive: [c => `${c.drive} plays on this drive already. They're grinding the clock and the defense.`, c => `Methodical. This drive is eating up the clock.`],
  twoMin: [c => `Clock's running. They need to get out of bounds or get set fast.`, c => `Two-minute drill. Every second counts now.`],
  weather: [c => `Tough conditions out there; you can see the footing is a problem.`, c => `The weather is a factor on every snap today.`],
  line: [c => `${c.n} now has ${c.tot} on the day.`, c => `That's been the theme: ${c.n} keeps chipping away. ${c.tot} so far.`, c => `${c.n} is quietly having a strong game. ${c.tot}.`],
  incPress: [c => `Pressure got there before the route did.`, c => `${c.qb} had to get rid of that one early.`],
  drop: [c => `Has to catch that. Right in his hands.`, c => `Drop! That's one he'll want back.`],
};

const sum = (l: Partial<StatLine> | undefined, ...k: (keyof StatLine)[]) => k.reduce((a, x) => a + ((l?.[x] as number | undefined) ?? 0), 0);
const short = (p?: Player) => (p ? `${p.fn[0]}. ${p.ln}` : 'he');

/** What the booth says about this play, or nothing. Stable for a given play. */
export function commentary(L: League, sim: GameSim, ev: PlayEvent, mem: BoothMemory): string | undefined {
  const done = mem.byN.get(ev.n); if (done !== undefined) return done || undefined;
  const say = pick(L, sim, ev, mem);
  mem.byN.set(ev.n, say ?? '');
  return say;
}

function pick(L: League, sim: GameSim, ev: PlayEvent, mem: BoothMemory): string | undefined {
  if (!['run', 'pass', 'sack', 'scramble'].includes(ev.type)) return undefined;
  const P_ = (id?: string) => (id ? L.players[id] : undefined);
  const ball = P_(ev.ids?.ball ?? ev.ids?.target), qb = P_(ev.ids?.qb), def = P_(ev.ids?.def);
  const off = sim.sides[ev.poss], dfs = sim.sides[1 - ev.poss];
  const idx = sim.events.indexOf(ev);
  const prev = idx > 0 ? sim.events[idx - 1] : undefined;
  const before = prev?.score ?? [0, 0];
  const lead = before[ev.poss] - before[1 - ev.poss];
  // This drive so far.
  let drive = 0, driveYds = 0;
  for (let i = idx; i >= 0; i--) { const e = sim.events[i]; if (e.poss !== ev.poss || e.type === 'kickoff' || e.type === 'punt') break; if (['run', 'pass', 'sack', 'scramble'].includes(e.type)) { drive++; driveYds += e.yards; } }
  // Completion streak for this quarterback.
  let streak = 0;
  for (let i = idx; i >= 0; i--) { const e = sim.events[i]; if (e.type !== 'pass' || e.ids?.qb !== ev.ids?.qb) { if (e.poss !== ev.poss) break; continue; } if (e.complete) streak++; else break; }
  const ln = (p?: Player) => sim.lines.get(p?.id ?? '');
  const c: Ctx = { n: short(ball ?? qb), full: ball ? `${ball.fn} ${ball.ln}` : '', y: ev.yards, team: off.team.nick, opp: dfs.team.nick, d: ev.down, togo: ev.togo, q: ev.q, clock: ev.clock, lead, tot: '', qb: short(qb), def: short(def), streak, drive, driveYds };
  const conv = ev.yards >= ev.togo && !ev.turnover;
  const late = ev.q >= 4 && ev.clock <= 420;
  const choose = (key: string, tot?: string | number): string | undefined => {
    const pool = P[key]; if (!pool) return undefined;
    if (tot !== undefined) c.tot = String(tot);
    const start = (hash(`${sim.game.id}-${ev.n}`) >>> 0) % pool.length;
    for (let k = 0; k < pool.length; k++) {
      const id = `${key}${(start + k) % pool.length}`;
      if (mem.recent.includes(id)) continue;
      mem.recent.push(id); if (mem.recent.length > 14) mem.recent.shift();
      return pool[(start + k) % pool.length](c);
    }
    return undefined;
  };
  const roll = ((hash(`b-${sim.game.id}-${ev.n}`) >>> 0) % 100) / 100;

  // Turnovers.
  if (ev.turnover) {
    if (/INTERCEPTED/.test(ev.text)) return ev.td ? choose('pick6') : late && Math.abs(lead) <= 8 ? choose('pickLate') ?? choose('pick') : choose('pick');
    return choose('fumble');
  }
  // Scores.
  if (ev.td) {
    const l = ln(ball ?? qb), tds = sum(l, 'rtd', 'rectd');
    if (ev.yards >= 35) return choose('tdLong');
    if (lead < 0 && lead + 6 > 0) return choose('tdGoAhead') ?? choose('td');
    if (late) return choose('tdLate') ?? choose('td');
    if (tds >= 2) return choose('tdMulti', tds) ?? choose('td');
    if (ev.yl >= 97) return choose('tdGoal') ?? choose('td');
    return choose('td');
  }
  // Milestones crossed on this play.
  if (ball && ev.yards > 0) {
    const l = ln(ball);
    if (ev.type === 'run' && sum(l, 'ry') >= 100 && sum(l, 'ry') - ev.yards < 100) return choose('mile100r', sum(l, 'ry'));
    if (ev.type === 'pass' && ev.complete && sum(l, 'recy') >= 100 && sum(l, 'recy') - ev.yards < 100) return choose('mile100c', sum(l, 'recy'));
  }
  if (qb && ev.type === 'pass' && ev.complete) { const py = sum(ln(qb), 'py'); if (py >= 300 && py - ev.yards < 300) return choose('mile300'); }
  if (ev.yards >= 25) return choose('big');
  if (ev.type === 'sack') {
    const sk = sum(ln(def), 'dsk');
    if (sk >= 2 && roll < 0.7) return choose('sackMulti', sk);
    return ev.down === 3 ? choose('sack3') ?? choose('sack') : roll < 0.6 ? choose('sack') : undefined;
  }
  if (ev.down === 4) return conv ? choose('fourthYes') : choose('fourthNo');
  if (ev.down === 3 && conv) return ev.togo >= 7 ? choose('thirdLong') : roll < 0.6 ? choose('third') : undefined;
  if (ev.type === 'run' && ev.togo <= 2 && ev.yards <= 0 && ev.down >= 3) return choose('stuffShort');
  if (ev.yards <= -2 && ev.type === 'run' && roll < 0.6) return choose('loss');
  if (/DROPPED/.test(ev.text)) return choose('drop');
  if (/off target under pressure|throws it away/.test(ev.text) && roll < 0.45) return choose('incPress');
  if (streak >= 5 && streak % 2 === 1 && roll < 0.8) return choose('streak');
  const gained = ev.yards > 0 && (ev.type !== 'pass' || !!ev.complete);
  if (drive >= 10 && drive % 3 === 1 && gained) return choose('longDrive');
  if ((ev.q === 2 || ev.q >= 4) && ev.clock <= 120 && lead <= 0 && gained && !/out of bounds/.test(ev.text) && roll < 0.5) return choose('twoMin');
  if (sim.weather.precip !== 'none' && roll > 0.93) return choose('weather');
  // Otherwise, now and then, how this player's day is going.
  if (ball && roll < 0.3 && ev.yards > 0) {
    const l = ln(ball);
    const tot = ev.type === 'run' || ev.type === 'scramble' ? `${sum(l, 'ry')} yards on ${sum(l, 'ra')} carries` : `${sum(l, 'rec')} catches for ${sum(l, 'recy')} yards`;
    if (sum(l, 'ra') + sum(l, 'rec') >= 4) return choose('line', tot);
  }
  return undefined;
}

/** Situation tag a broadcast would flash before the snap. */
export function situationTag(sim: GameSim): string | undefined {
  if (sim.over) return undefined;
  const lead = sim.score[sim.poss] - sim.score[1 - sim.poss];
  if ((sim.q === 2 || sim.q >= 4) && sim.clock <= 120 && lead <= 8) return 'Two-Minute Drill';
  if (sim.yl >= 90 && sim.togo >= 100 - sim.yl) return 'Goal to Go';
  if (sim.down === 4) return `4th & ${sim.togo}`;
  if (sim.down === 3 && sim.togo >= 7) return '3rd & Long';
  if (sim.yl >= 80) return 'Red Zone';
  if (sim.down === 3 && sim.togo <= 2) return '3rd & Short';
  return undefined;
}
