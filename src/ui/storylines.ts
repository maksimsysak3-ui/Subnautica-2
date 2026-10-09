// Storylines: the week-to-week drama of a real building, beyond contracts and depth.
// Each one only appears when its situation exists (two big egos on a losing team, a
// starter nursing a knock, a player facing the team that traded him), and every choice
// does something real: suspensions sit a player out, morale and the locker room move,
// the coach's fourth-down aggression changes, practice-squad players leave.
import type { League, Player, Team } from '../core/types';
import type { ActionCard } from './actions';
import type { Effects } from '../core/media';
import { hash } from '../core/rng';
import { standings, userGame } from '../core/season';

export interface Kit {
  L: League; me: Team; roster: Player[]; gm: string; hc: string; wk: string;
  fx: (e: Effects) => string; sp: (p: Player, n: number) => void; resolve: (id: string) => void;
}
const STARTER_POS = new Set(['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'S']);
/** Sit a player out: the injury list does the bookkeeping (he misses the next game). */
const suspend = (p: Player, weeks = 1) => { p.injury = { type: 'Suspended (team)', weeks: weeks + 1 }; };

export function storylines(k: Kit): ActionCard[] {
  const { L, me, roster, gm, hc, wk, fx, sp, resolve } = k;
  const out: ActionCard[] = [];
  const inSeason = L.phase === 'regular';
  if (!inSeason) return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0);
  const id = (key: string) => `${key}-${wk}`;
  const starters = roster.filter(p => STARTER_POS.has(p.pos) && !p.injury).sort((a, b) => b.ovr - a.ovr).slice(0, 24);
  const st = standings(L)[L.user];
  const g = userGame(L);
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const losing = st && st.l > st.w + 1;

  // Sideline clash: two big personalities, usually when things are going badly.
  const egos = starters.filter(p => p.traits.ego >= 70);
  if (egos.length >= 2 && (losing || r('clash') % 4 === 0)) {
    const [a, b] = [egos[r('c1') % egos.length], egos[(r('c1') + 1) % egos.length]];
    if (a !== b) out.push({ id: `clash-${a.id}-${b.id}-${L.season}`, kind: 'Locker Room', headline: `${a.ln} and ${b.ln} went at it on the sideline. Who answers for it?`, p: a, team: me, feature: true,
      body: `Cameras caught ${a.fn} ${a.ln} and ${b.fn} ${b.ln} shoving each other after a busted play. It's all over the highlight shows, and the room is waiting to see what you do.`,
      choices: [
        { label: `Suspend ${a.ln}`, hint: `${a.ln} misses a game · morale −10 · Locker room +3`, run: () => { suspend(a); resolve(`clash-${a.id}-${b.id}-${L.season}`); return fx({ players: [{ pid: a.id, delta: -10 }], locker: 3 }); } },
        { label: 'Team Meeting', hint: 'Locker room +1 · Momentum −0.2', run: () => { resolve(`clash-${a.id}-${b.id}-${L.season}`); return fx({ locker: 1, momentum: -0.2 }); } },
        { label: 'Let Them Settle It', hint: `Locker room −2 · both morale +2`, run: () => { resolve(`clash-${a.id}-${b.id}-${L.season}`); return fx({ locker: -2, players: [{ pid: a.id, delta: 2 }, { pid: b.id, delta: 2 }] }); } },
      ], delegate: { who: hc, role: 'Head Coach', quote: `I'll handle it in the meeting room. Nobody's bigger than the team.`, run: () => { resolve(`clash-${a.id}-${b.id}-${L.season}`); fx({ locker: 1, momentum: -0.2 }); } } });
  }

  // Missed curfew on the road trip.
  const young = roster.filter(p => p.age <= 25 && p.traits.ego >= 55 && STARTER_POS.has(p.pos));
  if (young.length && r('curfew') % 5 === 0) {
    const p = young[r('cp') % young.length];
    out.push({ id: `curfew-${p.id}-${L.season}`, kind: 'Discipline', headline: `${p.ln} missed curfew. Does he play Sunday?`, p, team: me,
      body: `Security says ${p.fn} ${p.ln} (${p.pos} ${p.ovr}) came back to the hotel two hours after bed check. Teammates are watching how you handle a starter.`,
      choices: [
        { label: 'Sit Him a Game', hint: `${p.ln} misses a game · Locker room +3 · his morale −8`, run: () => { suspend(p); resolve(`curfew-${p.id}-${L.season}`); return fx({ locker: 3, players: [{ pid: p.id, delta: -8 }] }); } },
        { label: 'Fine Him', hint: `Locker room +1 · his morale −4`, run: () => { resolve(`curfew-${p.id}-${L.season}`); return fx({ locker: 1, players: [{ pid: p.id, delta: -4 }] }); } },
        { label: 'Look Away', hint: `Locker room −3 · his morale +2`, run: () => { resolve(`curfew-${p.id}-${L.season}`); return fx({ locker: -3, players: [{ pid: p.id, delta: 2 }] }); } },
      ], delegate: { who: hc, role: 'Head Coach', quote: `He'll pay the fine and run after practice. He plays.`, run: () => { resolve(`curfew-${p.id}-${L.season}`); fx({ locker: 1, players: [{ pid: p.id, delta: -4 }] }); } } });
  }

  // A starter nursing a knock wants to play.
  const knocked = roster.filter(p => p.injury && p.injury.weeks <= 2 && !p.injury.season && !/Suspended/.test(p.injury.type) && p.ovr >= 78).sort((a, b) => b.ovr - a.ovr)[0];
  const tid = knocked ? `tough-${knocked.id}-${knocked.injury!.type}` : '';
  if (knocked) out.push({ id: tid, kind: 'Medical', headline: `${knocked.ln} wants to play through it. Do you let him?`, p: knocked, team: me, feature: true,
    body: `${knocked.fn} ${knocked.ln} (${knocked.injury!.type}) is listed out, but he's been begging the trainers to clear him. The medical staff says he'd be at maybe 80%.`,
    choices: [
      { label: 'Clear Him', hint: `He plays this week at reduced condition · morale +6 · risk of a longer injury`, run: () => { knocked.injury = undefined; knocked.cond = Math.min(knocked.cond, 72); resolve(tid); return fx({ players: [{ pid: knocked.id, delta: 6 }], locker: 1 }); } },
      { label: 'Protect Him', hint: `He sits · morale −3`, run: () => { resolve(tid); return fx({ players: [{ pid: knocked.id, delta: -3 }] }); } },
    ], delegate: { who: 'Head Trainer', role: 'Medical', quote: `We don't rush guys back. He sits.`, run: () => { resolve(tid); } } });

  // Another team wants your best practice-squad player.
  const ps = roster.filter(p => p.status === 'PS').sort((a, b) => (b.pot + b.ovr) - (a.pot + a.ovr))[0];
  if (ps && r('ps') % 4 === 0) {
    const suitor = Object.values(L.teams).filter(t => t.abbr !== L.user)[r('suitor') % 31];
    out.push({ id: `poachps-${ps.id}-${L.season}`, kind: 'Roster', headline: `The ${suitor.nick} want ${ps.ln} off your practice squad.`, p: ps, team: me,
      body: `${suitor.name} called ${ps.fn} ${ps.ln}'s agent (${ps.pos}, ${ps.ovr} OVR, ${ps.pot} potential). They'll sign him to their 53 unless you promote him first.`,
      choices: [
        { label: 'Promote Him', hint: 'He joins your 53 · morale +8', run: () => { ps.status = 'ACT'; resolve(`poachps-${ps.id}-${L.season}`); return fx({ players: [{ pid: ps.id, delta: 8 }] }); } },
        { label: 'Let Him Go', hint: `He signs with the ${suitor.nick}`, run: () => { ps.team = suitor.abbr; ps.status = 'ACT'; resolve(`poachps-${ps.id}-${L.season}`); return `${ps.ln} signed with the ${suitor.nick}`; } },
      ], delegate: { who: gm, role: 'GM', quote: ps.pot >= 78 ? `He's a keeper. Promoting him.` : `We can't hold everyone. Let him go.`, run: () => { if (ps.pot >= 78) ps.status = 'ACT'; else { ps.team = suitor.abbr; ps.status = 'ACT'; } resolve(`poachps-${ps.id}-${L.season}`); } } });
  }

  // The analytics department makes its pitch.
  if (L.week >= 3 && r('analytics') % 6 === 0) {
    const a = me.coach.aggr;
    out.push({ id: `analytics-${L.season}-${Math.floor(L.week / 6)}`, kind: 'Analytics', headline: `Analytics says you're leaving points on the field. Go for it more?`, team: me,
      body: `Your analytics staff presented a 40-page report: by their model the team should go for it on fourth down far more often. ${hc} is old school. Current aggressiveness: ${Math.round(a * 100)}%.`,
      choices: [
        { label: 'Trust the Numbers', hint: 'Go for it more on 4th down and two-pointers', run: () => { me.coach.aggr = Math.min(0.95, a + 0.15); resolve(`analytics-${L.season}-${Math.floor(L.week / 6)}`); return `Aggressiveness ${Math.round(me.coach.aggr * 100)}%`; } },
        { label: 'Old School', hint: 'Punt and kick more · Owner +1', run: () => { me.coach.aggr = Math.max(0.2, a - 0.1); resolve(`analytics-${L.season}-${Math.floor(L.week / 6)}`); return fx({ owner: 1 }); } },
      ] });
  }

  // The celebration everybody is talking about.
  const scorer = roster.filter(p => ['WR', 'TE', 'RB'].includes(p.pos) && p.traits.ego >= 60).sort((a, b) => b.ovr - a.ovr)[0];
  if (scorer && r('celebrate') % 5 === 1) out.push({ id: `celebrate-${scorer.id}-${L.season}`, kind: 'Viral', headline: `${scorer.ln}'s touchdown dance has 12 million views. And a flag.`, p: scorer, team: me,
    body: `The league fined ${scorer.fn} ${scorer.ln} for his choreographed end-zone celebration, and the clip is everywhere. Fans love it. The league office does not.`,
    choices: [
      { label: 'Let Them Celebrate', hint: 'Fans +3 · Locker room +1 · Owner −1', run: () => { resolve(`celebrate-${scorer.id}-${L.season}`); return fx({ fans: 3, locker: 1, owner: -1 }); } },
      { label: 'Keep It Clean', hint: `Owner +1 · ${scorer.ln} morale −4`, run: () => { resolve(`celebrate-${scorer.id}-${L.season}`); return fx({ owner: 1, players: [{ pid: scorer.id, delta: -4 }] }); } },
    ] });

  // A star's endorsement shoot lands in game week.
  const star = starters[0];
  if (star && r('endorse') % 7 === 2) out.push({ id: `endorse-${star.id}-${L.season}`, kind: 'Business', headline: `${star.ln}'s national commercial shoots Wednesday. Practice day.`, p: star, team: me,
    body: `A shoe company wants ${star.fn} ${star.ln} for a national campaign. The shoot is Wednesday, the team's heaviest practice day.`,
    choices: [
      { label: 'Approve It', hint: `${star.ln} morale +7 · Fans +1 · Momentum −0.3`, run: () => { resolve(`endorse-${star.id}-${L.season}`); return fx({ players: [{ pid: star.id, delta: 7 }], fans: 1, momentum: -0.3 }); } },
      { label: 'After the Season', hint: `${star.ln} morale −4 · Momentum +0.2`, run: () => { resolve(`endorse-${star.id}-${L.season}`); return fx({ players: [{ pid: star.id, delta: -4 }], momentum: 0.2 }); } },
    ] });

  // Revenge game: a player facing the team that drafted him.
  if (opp) {
    const rev = roster.find(p => p.draft.team === opp.abbr && p.exp >= 2 && p.ovr >= 74);
    if (rev) out.push({ id: `revenge-${rev.id}-${g!.id}`, kind: 'Revenge Game', headline: `${rev.ln} faces the ${opp.nick}, the team that let him go.`, p: rev, team: me, feature: true,
      body: `${rev.fn} ${rev.ln} was drafted by the ${opp.name} and hasn't forgotten how it ended. He wants the ball on Sunday.`,
      choices: [
        { label: 'Feature Him', hint: `${rev.ln} morale +6 · +1 skill point · Momentum +0.3`, run: () => { sp(rev, 1); resolve(`revenge-${rev.id}-${g!.id}`); return fx({ players: [{ pid: rev.id, delta: 6 }], momentum: 0.3 }); } },
        { label: 'Business as Usual', hint: 'Locker room +1', run: () => { resolve(`revenge-${rev.id}-${g!.id}`); return fx({ locker: 1 }); } },
      ] });
  }

  // Losing streak: the veterans want a players-only meeting.
  const sm = /L(\d+)/.exec(st?.streak ?? '');
  if (sm && +sm[1] >= 3) {
    const vet = roster.filter(p => p.age >= 29).sort((a, b) => b.ovr - a.ovr)[0];
    if (vet) out.push({ id: `pom-${L.season}-${L.week}`, kind: 'Locker Room', headline: `${vet.ln} called a players-only meeting. Do you stay out of it?`, p: vet, team: me, feature: true,
      body: `${sm[1]} straight losses. ${vet.fn} ${vet.ln} has asked the coaches to clear the room tonight so the players can talk it out.`,
      choices: [
        { label: 'Give Them the Room', hint: 'Locker room +3 · Momentum +0.4', run: () => { resolve(`pom-${L.season}-${L.week}`); return fx({ locker: 3, momentum: 0.4 }); } },
        { label: 'Coaches Stay', hint: 'Owner +1 · Locker room −1', run: () => { resolve(`pom-${L.season}-${L.week}`); return fx({ owner: 1, locker: -1 }); } },
      ] });
  }

  // A franchise legend is in town for a home game.
  if (g && g.home === L.user && r('legend') % 9 === 3) out.push({ id: id('legend'), kind: 'Ceremony', headline: `A franchise legend is in the building Sunday. Halftime ceremony?`, team: me,
    body: `One of the greatest players in ${me.name} history is coming back for the game. The marketing team wants a halftime ceremony on the field.`,
    choices: [
      { label: 'Halftime Ceremony', hint: 'Fans +4 · Momentum +0.3 · Owner +1', run: () => { resolve(id('legend')); return fx({ fans: 4, momentum: 0.3, owner: 1 }); } },
      { label: 'Private Visit', hint: 'Locker room +2', run: () => { resolve(id('legend')); return fx({ locker: 2 }); } },
    ] });

  // A trade-rumor leak about one of your best players.
  const rumored = starters[1 + (r('rumor') % 4)];
  if (rumored && L.week <= 9 && r('rumor') % 6 === 5) out.push({ id: id('rumor'), kind: 'Rumor Mill', headline: `A national report says you're shopping ${rumored.ln}. True?`, p: rumored, team: me,
    body: `An insider reported that ${me.nick} are taking calls on ${rumored.fn} ${rumored.ln} (${rumored.pos} ${rumored.ovr}). His phone hasn't stopped buzzing.`,
    choices: [
      { label: 'Shut It Down', hint: `${rumored.ln} morale +5`, run: () => { resolve(id('rumor')); return fx({ players: [{ pid: rumored.id, delta: 5 }] }); } },
      { label: 'No Comment', hint: `${rumored.ln} morale −5 · trade value talk heats up`, run: () => { resolve(id('rumor')); return fx({ players: [{ pid: rumored.id, delta: -5 }] }); } },
      { label: 'Take the Calls', hint: 'Puts him on the trade block · his morale −8', run: () => { L.block = [...new Set([...(L.block ?? []), rumored.id])]; resolve(id('rumor')); return fx({ players: [{ pid: rumored.id, delta: -8 }] }); } },
    ] });

  // Rookie show night.
  const rookies = roster.filter(p => p.exp === 0);
  if (rookies.length >= 4 && L.week >= 4 && L.week <= 10 && r('rookies') % 5 === 0) out.push({ id: `rookieshow-${L.season}`, kind: 'Team Culture', headline: `The rookies want to put on a talent show. The vets want them to pay for dinner.`, team: me,
    body: `It's rookie week. The veterans expect the ${rookies.length} rookies to pick up a five-figure team dinner tab; the rookies would rather roast the coaches in a talent show.`,
    choices: [
      { label: 'Talent Show', hint: 'Locker room +3 · rookies morale +3', run: () => { resolve(`rookieshow-${L.season}`); return fx({ locker: 3, players: rookies.slice(0, 6).map(p => ({ pid: p.id, delta: 3 })) }); } },
      { label: 'Rookies Pay', hint: 'Locker room +2 · rookies morale −2', run: () => { resolve(`rookieshow-${L.season}`); return fx({ locker: 2, players: rookies.slice(0, 6).map(p => ({ pid: p.id, delta: -2 })) }); } },
    ] });

  // Thanksgiving.
  if (L.week === 12) out.push({ id: `thanks-${L.season}`, kind: 'Holiday', headline: `Thanksgiving week. Host the team for dinner?`, team: me,
    body: `Players far from home don't have family nearby this week. Your staff could host a team Thanksgiving dinner at the facility.`,
    choices: [
      { label: 'Host Dinner', hint: 'Locker room +3 · Fans +1', run: () => { resolve(`thanks-${L.season}`); return fx({ locker: 3, fans: 1 }); } },
      { label: 'Give Them the Day', hint: 'Players rest: condition +5', run: () => { for (const p of roster) p.cond = Math.min(100, p.cond + 5); resolve(`thanks-${L.season}`); return 'Condition +5 for the roster'; } },
    ] });

  // A trick play for this week.
  if (opp && r('trick') % 8 === 4) out.push({ id: id('trick'), kind: 'Game Plan', headline: `Your OC drew up a trick play for the ${opp.nick}. Install it?`, team: me,
    body: `A flea-flicker off a look the ${opp.nick} have struggled with on film. It takes practice reps away from the base offense.`,
    choices: [
      { label: 'Install It', hint: 'Momentum +0.5 · condition −2', run: () => { for (const p of roster) p.cond = Math.max(0, p.cond - 2); resolve(id('trick')); return fx({ momentum: 0.5 }); } },
      { label: 'Stick to the Base', hint: 'Locker room +1', run: () => { resolve(id('trick')); return fx({ locker: 1 }); } },
    ] });

  return out;
}
