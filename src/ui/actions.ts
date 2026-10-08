// Weekly Hub action cards, the Madden 27 way: each one is a situation in your
// building that wants a decision (a star angling for a new deal, a backup who
// thinks he should start, a trade call), phrased as the question it poses, with
// real choices and a staff member you can hand it to. Cards come from the league
// state, so they appear when the situation exists and go away when it's handled.
import type { League, Player, Pos, Team } from '../core/types';
import { yearsLeft, apy, marketValue, money } from '../core/contracts';
import { autoDepth, rosterOf, teamRatings } from '../core/league';
import { userGame, standings } from '../core/season';
import { hash } from '../core/rng';

export interface Choice { label: string; key?: string; run: (open: Opener) => void }
export interface Delegate { who: string; role: string; quote: string; run: () => void }
export interface ActionCard {
  id: string; kind: string; headline: string; body: string;
  p?: Player; team: Team; feature?: boolean; matchup?: boolean;
  choices: Choice[]; delegate?: Delegate;
}
/** What a choice can ask the UI to open. */
export interface Opener { negotiate: (p: Player) => void; go: (id: string, extra?: Record<string, string>) => void }

const STARTERS: Partial<Record<Pos, number>> = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
const FIRST = ['Caleb', 'Marcus', 'Devin', 'Trent', 'Andre', 'Nolan', 'Isaiah', 'Brett', 'Damon', 'Reggie', 'Colin', 'Jalen'];
const LAST = ['Rourke', 'Whitaker', 'Pruitt', 'Okafor', 'Delgado', 'Castellano', 'Brandt', 'Fairley', 'Mosley', 'Hargrove', 'Vance', 'Ellison'];
/** The user's general manager: a fixed name per franchise. */
export function gmName(L: League) { const h = hash(L.id + L.user) >>> 0; return `${FIRST[h % FIRST.length]} ${LAST[(h >>> 5) % LAST.length]}`; }

const done = (L: League) => ((L as League & { actionsDone?: string[] }).actionsDone ??= []);
const resolve = (L: League, id: string) => { const d = done(L); if (!d.includes(id)) d.push(id); if (d.length > 400) d.splice(0, d.length - 400); };
const mood = (p: Player, d: number) => { p.morale = Math.max(0, Math.min(100, p.morale + d)); };
const city = (t: Team) => t.name.replace(` ${t.nick}`, '');

export function weeklyCards(L: League): ActionCard[] {
  const me = L.teams[L.user];
  const wk = `${L.season}-${L.phase}-${L.week}`;
  const gm = gmName(L), hc = me.coach.name;
  const roster = rosterOf(L, L.user);
  const out: ActionCard[] = [];
  const add = (c: ActionCard) => { if (!done(L).includes(c.id)) out.push(c); };
  const inSeason = L.phase === 'regular' || L.phase === 'playoffs' || L.phase === 'preseason';

  // Contract-year stars who feel underpaid threaten to sit; happy ones want to talk extension.
  const contractYear = roster.filter(p => yearsLeft(p.contract, L.season) === 1 && p.ovr >= 80 && !p.contract.tag).sort((a, b) => b.ovr - a.ovr);
  for (const p of contractYear.slice(0, 2)) {
    const under = apy(p.contract) < marketValue(p, L.season) * 0.7;
    if (under && p.ovr >= 84 && p.morale < 75 && inSeason) add({
      id: `holdout-${p.id}-${L.season}`, kind: 'Contract', headline: `Is ${p.ln} willing to miss games?`, feature: true,
      body: `Frustrated with his current contract, ${p.fn} ${p.ln} (${p.pos} ${p.ovr}) is refusing to participate. He makes ${money(apy(p.contract))} a year; the market says ${money(marketValue(p, L.season))}.`,
      p, team: me,
      choices: [
        { label: 'Negotiate', run: o => o.negotiate(p) },
        { label: 'Hold Firm', run: () => { mood(p, -10); resolve(L, `holdout-${p.id}-${L.season}`); } },
        { label: 'Trade Block', run: () => { L.block = [...new Set([...(L.block ?? []), p.id])]; mood(p, -4); resolve(L, `holdout-${p.id}-${L.season}`); } },
      ],
      delegate: { who: gm, role: 'GM', quote: `We'll put ${p.ln} on the trade block and see what he brings back.`, run: () => { L.block = [...new Set([...(L.block ?? []), p.id])]; resolve(L, `holdout-${p.id}-${L.season}`); } },
    });
    else add({
      id: `extend-${p.id}-${L.season}`, kind: 'Contract', headline: `Will ${city(me)} lock up ${p.ln} long-term?`,
      body: `${p.ln} (${p.pos} ${p.ovr}) is in the last year of his deal and is prepared to negotiate a new one.`,
      p, team: me,
      choices: [{ label: 'Negotiate', run: o => o.negotiate(p) }, { label: 'After the Season', run: () => resolve(L, `extend-${p.id}-${L.season}`) }],
      delegate: { who: gm, role: 'GM', quote: `Let's revisit ${p.ln}'s deal once the season is over.`, run: () => resolve(L, `extend-${p.id}-${L.season}`) },
    });
  }

  // A backup who is as good as the starter ahead of him.
  for (const [pos, n] of Object.entries(STARTERS) as [Pos, number][]) {
    const ids = me.depth[pos] ?? [];
    const starters = ids.slice(0, n).map(id => L.players[id]).filter(Boolean);
    const weakest = starters.slice().sort((a, b) => a.ovr - b.ovr)[0];
    const bench = ids.slice(n).map(id => L.players[id]).find(p => p && !p.injury && p.status === 'ACT' && weakest && p.ovr >= weakest.ovr + 1 && p.ovr >= 74);
    if (!bench || !weakest) continue;
    const id = `depth-${bench.id}-${wk}`;
    add({
      id, kind: 'Depth Chart', headline: `Is ${bench.ln} unhappy with the depth chart?`,
      body: `${bench.ln} (${bench.pos} ${bench.ovr}) feels overlooked and is frustrated he is behind ${weakest.ln} (${weakest.ovr}) in the starting lineup.`,
      p: bench, team: me,
      choices: [
        { label: 'Start Him', run: () => { const d = me.depth[pos]!; const a = d.indexOf(bench.id), b = d.indexOf(weakest.id); if (a >= 0 && b >= 0) [d[a], d[b]] = [d[b], d[a]]; mood(bench, 8); mood(weakest, -6); resolve(L, id); } },
        { label: 'Depth Chart', run: o => o.go('depth') },
        { label: 'Keep Him There', run: () => { mood(bench, -8); resolve(L, id); } },
      ],
      delegate: { who: hc, role: 'Head Coach', quote: `I'll sort the lineup out. Best players play.`, run: () => { autoDepth(L, L.user); resolve(L, id); } },
    });
    break;
  }

  // Injured starters: who steps in.
  if (L.phase === 'regular' || L.phase === 'playoffs') {
    const hurt = roster.concat(Object.values(L.players).filter(p => p.team === L.user && p.status === 'IR')).filter(p => p.injury && p.injury.weeks >= 2 && p.ovr >= 80).sort((a, b) => b.ovr - a.ovr)[0];
    if (hurt) add({
      id: `inj-${hurt.id}-${wk}`, kind: 'Injury', headline: `Who steps up without ${hurt.ln}?`,
      body: `${hurt.fn} ${hurt.ln} (${hurt.pos} ${hurt.ovr}) is out ${hurt.injury!.weeks} weeks with a ${hurt.injury!.type.toLowerCase()}.`,
      p: hurt, team: me,
      choices: [{ label: 'Depth Chart', run: o => o.go('depth') }, { label: 'Free Agents', run: o => o.go('fa') }],
      delegate: { who: hc, role: 'Head Coach', quote: `Next man up. I'll set the depth chart around it.`, run: () => { autoDepth(L, L.user); resolve(L, `inj-${hurt.id}-${wk}`); } },
    });
  }

  // Trade calls.
  const call = L.inbox.find(m => m.action?.kind === 'trade' && !m.read);
  if (call?.action) {
    const o = call.action.offer, want = o.get.players.map(id => L.players[id]).filter(Boolean)[0] ?? o.give.players.map(id => L.players[id]).filter(Boolean)[0];
    const from = L.teams[o.from];
    add({
      id: `trade-${call.id}`, kind: 'Trade Call', headline: want ? `Will you move ${want.ln}?` : `${from.nick} are calling`,
      body: `${from.name} have an offer on the table${want ? ` involving ${want.ln} (${want.pos} ${want.ovr})` : ''}.`,
      p: want, team: want && want.team === L.user ? me : from,
      choices: [{ label: 'Review Offer', run: og => og.go('offers') }, { label: 'Decline', run: () => { call.read = true; } }],
      delegate: { who: gm, role: 'GM', quote: `I'll tell them we're not interested.`, run: () => { call.read = true; } },
    });
  }

  // Roster housekeeping.
  if (roster.length > 53) add({ id: `cut-${wk}`, kind: 'Roster', headline: `Who makes the 53?`, body: `You are carrying ${roster.length} players. ${roster.length - 53} have to go before kickoff.`, team: me,
    choices: [{ label: 'Roster', run: o => o.go('roster') }], delegate: { who: hc, role: 'Head Coach', quote: `Advance and I'll make the cuts from the bottom of the depth chart.`, run: () => resolve(L, `cut-${wk}`) } });
  if (L.coachTree.points > 0) add({ id: `coach-${wk}-${L.coachTree.points}`, kind: 'Coach Tree', headline: `Where does the staff grow next?`, body: `${L.coachTree.points} coach point${L.coachTree.points > 1 ? 's' : ''} to spend on a new ability.`, team: me, choices: [{ label: 'Coach Tree', run: o => o.go('coach') }] });

  // Offseason beats.
  if (L.phase === 'resign') { const n = roster.filter(p => yearsLeft(p.contract, L.season) === 0).length; add({ id: `resign-${L.season}`, kind: 'Re-sign', headline: `Who do you bring back?`, body: `${n} contracts are expiring. Re-sign the core, tag a star, or let them walk.`, team: me, feature: true, choices: [{ label: 'Re-sign Players', run: o => o.go('resign') }] }); }
  if (L.phase === 'freeagency') add({ id: `fa-${wk}-${L.fa?.day}`, kind: 'Free Agency', headline: `Day ${L.fa?.day ?? 1}: who do you chase?`, body: `The best players sign early. Offers weigh money, guarantees, a contender and a role.`, team: me, feature: true, choices: [{ label: 'Free Agents', run: o => o.go('fa') }] });
  if (L.phase === 'draft') add({ id: `draft-${L.season}`, kind: 'Draft', headline: `Who is your pick?`, body: `Your scouts have their board. Trade up, trade down, or take the best player available.`, team: me, feature: true, choices: [{ label: 'Draft Room', run: o => o.go('draft') }] });

  // This week's opponent closes the row.
  const g = inSeason ? userGame(L) : undefined;
  if (g && !g.result) {
    const opp = L.teams[g.home === L.user ? g.away : g.home];
    const star = rosterOf(L, opp.abbr).sort((a, b) => b.ovr - a.ovr)[0];
    const st = standings(L)[opp.abbr];
    out.push({ id: `opp-${g.id}`, kind: 'Gameday', headline: `${opp.nick} week`, matchup: true, team: opp, p: star,
      body: `This week's matchup is against the ${opp.name} (${st.w}-${st.l}${st.t ? `-${st.t}` : ''}, OVR ${teamRatings(L, opp.abbr).ovr}). Their top player is ${star?.pos} ${star?.fn} ${star?.ln} (${star?.ovr}).`,
      choices: [{ label: 'Matchup', run: o => o.go('gameday') }, { label: 'Game Plan', run: o => o.go('plan') }] });
  }
  return out;
}
