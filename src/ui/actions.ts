// Weekly Hub action cards, the Madden 27 way: each one is a situation in your
// building that wants a decision (a star angling for a new deal, a backup who
// thinks he should start, a trade call), phrased as the question it poses, with
// real choices and a staff member you can hand it to. Cards come from the league
// state, so they appear when the situation exists and go away when it's handled.
import type { League, Player, Pos, Team } from '../core/types';
import { yearsLeft, apy, marketValue, money } from '../core/contracts';
import { autoDepth, rosterOf, teamRatings, markDepth, unmarkDepth } from '../core/league';
import { userGame, standings, mail } from '../core/season';
import { hash } from '../core/rng';
import { media, applyEffects, promise, fans, teamMorale, fallout, liveFallout } from '../core/media';
import { pressOpen } from '../core/presser';
import { treeOf, hasTree } from '../core/archetypes';
import { staffOf, staffState } from '../core/staff';

/** A choice; `hint` spells out the stakes, and `run` may return a line for the toast. */
export interface Choice { label: string; key?: string; hint?: string; run: (open: Opener) => void | string }
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
        { label: 'Start Him', run: () => { const d = me.depth[pos]!; const a = d.indexOf(bench.id), b = d.indexOf(weakest.id); if (a >= 0 && b >= 0) [d[a], d[b]] = [d[b], d[a]]; markDepth(me, pos); mood(bench, 8); mood(weakest, -6); resolve(L, id); } },
        { label: 'Depth Chart', run: o => o.go('depth') },
        { label: 'Keep Him There', run: () => { mood(bench, -8); resolve(L, id); } },
      ],
      delegate: { who: hc, role: 'Head Coach', quote: `I'll sort the lineup out. Best players play.`, run: () => { unmarkDepth(me); autoDepth(L, L.user); resolve(L, id); } },
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
      delegate: { who: hc, role: 'Head Coach', quote: `Next man up. I'll set the depth chart around it.`, run: () => { unmarkDepth(me); autoDepth(L, L.user); resolve(L, `inj-${hurt.id}-${wk}`); } },
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

  // ---- stakes: the locker room, the fans, the owner, rivals and promises -------------
  const ug = inSeason ? userGame(L) : undefined;
  const nextG = ug && !ug.result ? ug : undefined;
  const opp = nextG ? L.teams[nextG.home === L.user ? nextG.away : nextG.home] : undefined;
  const m = media(L);
  const fx = (e: Parameters<typeof applyEffects>[1]) => { const a = applyEffects(L, e); const bits = [['Fans', a.fans], ['Owner', a.owner], ['Momentum', a.momentum]].filter(([, v]) => v).map(([k, v]) => `${k} ${(v as number) > 0 ? '+' : ''}${Math.round((v as number) * 10) / 10}`); return [...bits, ...(e.locker ? [`Locker room ${e.locker > 0 ? '+' : ''}${e.locker}`] : []), ...a.players.map(x => `${x.p.ln} morale ${x.delta > 0 ? '+' : ''}${x.delta}`)].join(' · '); };
  const sp = (p: Player, n: number) => { const t = treeOf(p); if (t) t.sp += n; };

  // The press room after the last game.
  const lastG = L.games.filter(x => x.result && x.season === L.season && (x.home === L.user || x.away === L.user)).sort((a, b) => b.week - a.week)[0];
  if (lastG && pressOpen(L, lastG, m.pressed)) {
    const r = lastG.result!, us = lastG.home === L.user ? r.hs : r.as, them = lastG.home === L.user ? r.as : r.hs;
    const o = L.teams[lastG.home === L.user ? lastG.away : lastG.home];
    add({ id: `press-${lastG.id}`, kind: 'Media', feature: us < them, headline: us > them ? `What do you tell the press?` : `Will you face the cameras?`,
      body: `${us > them ? 'Win' : us < them ? 'Loss' : 'Tie'}, ${us}-${them} against the ${o.nick}. The beat reporters are waiting at the podium, and what you say will be on every screen tonight.`,
      team: me, choices: [
        { label: 'Take the Podium', hint: 'Answer in your own words: fans, players, owner and momentum all react', run: og => og.go('presser', { gid: lastG.id }) },
        { label: 'Skip It', hint: 'Fans −1: the city notices', run: () => { m.pressed.push(lastG.id); return fx({ fans: -1 }); } },
      ],
      delegate: { who: me.coach.off, role: 'Off. Coordinator', quote: `I'll handle the cameras. Nothing quotable, I promise.`, run: () => { m.pressed.push(lastG.id); } } });
  }

  // Fallout from what you said at the podium.
  for (const f of liveFallout(L)) {
    const fid = `fo-${f.kind}-${f.pid ?? ''}-${f.key}`;
    const p = f.pid ? L.players[f.pid] : undefined;
    if (f.pid && (!p || p.team !== L.user)) continue;
    const said = f.quote ? `You said: "${f.quote}" ` : '';
    const done = () => resolve(L, fid);
    if (f.kind === 'calledout' && p) add({ id: fid, kind: 'Fallout', feature: true, headline: `${p.ln} is in your office`, p, team: me,
      body: `${said}${p.fn} ${p.ln} heard it, and so did every reporter. He wants to know where he stands.${p.traits.ego >= 70 ? ' He has a big ego and his agent is already making calls.' : ''}`,
      choices: [
        { label: 'Apologize Publicly', hint: `${p.ln} morale +9 · Fans −1 · Owner −1 (looks weak)`, run: () => { done(); return fx({ players: [{ pid: p.id, delta: 9 }], fans: -1, owner: -1 }); } },
        { label: 'Talk It Out Privately', hint: `${p.ln} morale +5`, run: () => { done(); return fx({ players: [{ pid: p.id, delta: 5 }] }); } },
        { label: 'Stand By It', hint: `${p.ln} morale −5 · Momentum +0.5 · he may ask out`, run: () => { done(); const r = fx({ players: [{ pid: p.id, delta: -5 }], momentum: 0.5 }); if (p.morale < 40 || p.traits.ego >= 75) fallout(L, { kind: 'traderequest', pid: p.id }); return r; } },
      ],
      delegate: { who: hc, role: 'Head Coach', quote: `I'll smooth it over with him.`, run: () => { done(); fx({ players: [{ pid: p.id, delta: 3 }] }); } } });
    else if (f.kind === 'traderequest' && p) add({ id: fid, kind: 'Fallout', feature: true, headline: `${p.ln} wants out`, p, team: me,
      body: `${p.fn} ${p.ln} (${p.pos} ${p.ovr}) has formally requested a trade. The story is everywhere and the locker room is picking sides.`,
      choices: [
        { label: 'Trade Block', hint: 'Shop him · Locker room +1', run: () => { L.block = [...new Set([...(L.block ?? []), p.id])]; done(); return fx({ locker: 1 }); } },
        { label: 'Refuse', hint: `${p.ln} morale −8 · Locker room −2`, run: () => { done(); return fx({ players: [{ pid: p.id, delta: -8 }], locker: -2 }); } },
        { label: 'Make Peace', hint: `${p.ln} morale +12 · Owner −2`, run: () => { done(); return fx({ players: [{ pid: p.id, delta: 12 }], owner: -2 }); } },
      ] });
    else if (f.kind === 'praised' && p) add({ id: fid, kind: 'Fallout', headline: `${p.ln}'s agent heard you`, p, team: me,
      body: `${said}${p.fn} ${p.ln}'s agent wants him paid like the player you described, and he'd like to talk now.`,
      choices: [
        { label: 'Negotiate', run: o => { done(); o.negotiate(p); } },
        { label: 'After the Season', hint: `${p.ln} morale −4`, run: () => { done(); return fx({ players: [{ pid: p.id, delta: -4 }] }); } },
      ],
      delegate: { who: gm, role: 'GM', quote: `I'll keep his agent warm until the season's over.`, run: () => { done(); fx({ players: [{ pid: p.id, delta: -2 }] }); } } });
    else if (f.kind === 'fined') {
      const amt = 50 + (hash(fid) >>> 0) % 4 * 25, win = (hash(fid + 'appeal') >>> 0) % 3 === 0;
      add({ id: fid, kind: 'League Office', headline: `The league fined you $${amt},000`, team: me,
        body: `${said}The league office reviewed your comments and issued a fine. The owner has seen the letter.`,
        choices: [
          { label: 'Pay Quietly', hint: 'Owner −1', run: () => { done(); return fx({ owner: -1 }); } },
          { label: 'Appeal', hint: 'One in three appeals win · lose: Owner −3', run: () => { done(); return win ? `Appeal won, fine overturned. ${fx({ owner: 1, fans: 1 })}` : `Appeal denied. ${fx({ owner: -3 })}`; } },
          { label: 'Double Down', hint: 'Fans +3 · Owner −4 · Momentum +0.5', run: () => { done(); return fx({ fans: 3, owner: -4, momentum: 0.5 }); } },
        ] });
    }
    else if (f.kind === 'media') add({ id: fid, kind: 'Media', headline: `Is the media turning on you?`, team: me,
      body: `After a stonewalled press conference, columnists are calling you "arrogant" and "out of touch". Talk radio is piling on.`,
      choices: [
        { label: 'Sit-Down Interview', hint: 'Fans +4 · Owner +1', run: () => { done(); return fx({ fans: 4, owner: 1 }); } },
        { label: 'Us Against the World', hint: 'Momentum +0.7 · Locker room +2 · Fans −2', run: () => { done(); return fx({ momentum: 0.7, locker: 2, fans: -2 }); } },
      ] });
    else if (f.kind === 'rally') add({ id: fid, kind: 'Locker Room', headline: `The players have your back`, team: me,
      body: `${said}Your players saw you take the hit for them. The captains want to turn it into something.`,
      choices: [
        { label: 'Captains Meeting', hint: 'Locker room +3 · Momentum +0.6', run: () => { done(); return fx({ locker: 3, momentum: 0.6 }); } },
        { label: 'Extra Film Session', hint: 'Momentum +0.9 · Locker room −1', run: () => { done(); return fx({ momentum: 0.9, locker: -1 }); } },
      ] });
    else if (f.kind === 'fans') add({ id: fid, kind: 'Fans', headline: `The fans want to see you`, team: me,
      body: `${said}The quote went viral. Supporters are organizing a rally outside the facility before the next game.`,
      choices: [
        { label: 'Show Up', hint: 'Fans +4 · Momentum +0.4', run: () => { done(); return fx({ fans: 4, momentum: 0.4 }); } },
        { label: 'Send the Players', hint: 'Fans +2 · Locker room +1', run: () => { done(); return fx({ fans: 2, locker: 1 }); } },
        { label: 'Stay Focused', hint: 'Nothing', run: () => { done(); } },
      ] });
    else if (f.kind === 'room') add({ id: fid, kind: 'Locker Room', feature: true, headline: `The veterans didn't like that`, team: me,
      body: `${said}Calling out the whole team in public didn't sit well with the leaders in the room. They want a word.`,
      choices: [
        { label: 'Hear Them Out', hint: 'Locker room +3 · Owner −1', run: () => { done(); return fx({ locker: 3, owner: -1 }); } },
        { label: 'My Team, My Rules', hint: 'Locker room −3 · Momentum +0.8 · Owner +1', run: () => { done(); return fx({ locker: -3, momentum: 0.8, owner: 1 }); } },
      ] });
  }

  // A guarantee hanging over this week.
  const guar = nextG && m.promises.find(x => x.kind === 'guarantee' && x.gid === nextG.id);
  if (guar && opp) add({ id: `guar-${nextG!.id}`, kind: 'Media', feature: true, headline: `Can you back up the guarantee?`, team: opp,
    body: `"${guar.text}" Your words are on a loop on every sports show. Win and the city is yours; lose against the ${opp.nick} and it gets loud.`,
    choices: [
      { label: 'Rally the Team', hint: 'Momentum +0.8', run: () => { resolve(L, `guar-${nextG!.id}`); return fx({ momentum: 0.8 }); } },
      { label: 'Walk It Back', hint: 'Cancels the guarantee · Fans −3', run: () => { m.promises = m.promises.filter(x => x !== guar); resolve(L, `guar-${nextG!.id}`); return fx({ fans: -3 }); } },
    ] });

  // Bulletin-board material.
  if (opp && m.bulletin === opp.abbr) add({ id: `bb-${nextG!.id}`, kind: 'Rivalry', headline: `The ${opp.nick} printed your quote`, team: opp,
    body: `Your words are taped up in the ${opp.nick} locker room. Their players have been asked about it all week. They will be extra motivated on Sunday.`,
    choices: [
      { label: 'Double Down', hint: 'Momentum +0.8 · Fans +2 · they stay fired up', run: () => { resolve(L, `bb-${nextG!.id}`); return fx({ momentum: 0.8, fans: 2 }); } },
      { label: 'Walk It Back', hint: 'Takes the edge off them · Fans −1', run: () => { m.bulletin = undefined; resolve(L, `bb-${nextG!.id}`); return fx({ fans: -1 }); } },
    ] });

  // Rivalry week.
  if (opp && L.phase === 'regular' && opp.conf === me.conf && opp.div === me.div && m.bulletin !== opp.abbr) add({ id: `rival-${nextG!.id}`, kind: 'Rivalry', feature: true, headline: `How do you handle ${opp.nick} week?`, team: opp,
    body: `Division games count double in the standings race, and this rivalry runs deep. How you set the tone this week matters.`,
    choices: [
      { label: 'Fire Up the Room', hint: 'Momentum +1.2 · Fans +2 · gives the ' + opp.nick + ' bulletin-board material', run: () => { m.bulletin = opp.abbr; resolve(L, `rival-${nextG!.id}`); return fx({ momentum: 1.2, fans: 2 }); } },
      { label: 'Business as Usual', hint: 'Momentum +0.4', run: () => { resolve(L, `rival-${nextG!.id}`); return fx({ momentum: 0.4 }); } },
    ],
    delegate: { who: hc, role: 'Head Coach', quote: `Same preparation as any week. We'll be ready.`, run: () => { resolve(L, `rival-${nextG!.id}`); fx({ momentum: 0.4 }); } } });

  // The owner wants a statement.
  if (nextG && opp && L.security < 50 && !m.promises.some(x => x.kind === 'owner')) add({ id: `owner-${nextG.id}`, kind: 'Owner', feature: true, headline: `Will you promise the owner a win?`, team: me,
    body: `Job security is down to ${Math.round(L.security)}. The owner wants to hear, in person, that you'll beat the ${opp.nick} on Sunday.`,
    choices: [
      { label: 'Promise a Win', hint: 'Owner +2 now · win: +4 · loss: −6', run: () => { promise(L, { kind: 'owner', gid: nextG.id, stake: 4, text: '' }); resolve(L, `owner-${nextG.id}`); return fx({ owner: 2 }); } },
      { label: 'Ask for Patience', hint: 'Owner −2 · no risk', run: () => { resolve(L, `owner-${nextG.id}`); return fx({ owner: -2 }); } },
      { label: 'Show the Plan', hint: 'Owner +1 · Locker room −1 (long hours)', run: () => { resolve(L, `owner-${nextG.id}`); return fx({ owner: 1, locker: -1 }); } },
    ],
    delegate: { who: gm, role: 'GM', quote: `I'll talk to ownership. No promises.`, run: () => { resolve(L, `owner-${nextG.id}`); fx({ owner: -1 }); } } });

  // The locker room is splitting.
  const tm = teamMorale(L);
  if (inSeason && tm < 60) add({ id: `locker-${wk}`, kind: 'Locker Room', feature: tm < 50, headline: `Is the locker room fracturing?`, team: me,
    body: `Team morale is ${Math.round(tm)}. Players are grumbling in the media and the leaders are worried. Unhappy players play worse and ask for more money.`,
    choices: [
      { label: 'Players-Only Meeting', hint: 'Locker room +4 · Momentum +0.5', run: () => { resolve(L, `locker-${wk}`); return fx({ locker: 4, momentum: 0.5 }); } },
      { label: 'Team Dinner', hint: 'Locker room +3 · Fans +1', run: () => { resolve(L, `locker-${wk}`); return fx({ locker: 3, fans: 1 }); } },
      { label: 'Crack Down', hint: 'Locker room −2 · Owner +2 · Momentum +0.6', run: () => { resolve(L, `locker-${wk}`); return fx({ locker: -2, owner: 2, momentum: 0.6 }); } },
    ],
    delegate: { who: hc, role: 'Head Coach', quote: `I'll get the captains together.`, run: () => { resolve(L, `locker-${wk}`); fx({ locker: 2 }); } } });

  // The fans are turning.
  const fz = fans(L);
  if (inSeason && fz < 42) add({ id: `fans-${wk}`, kind: 'Fans', headline: `How do you win the city back?`, team: me,
    body: `Fan support has fallen to ${Math.round(fz)}. Empty seats hurt home-field advantage, and the owner reads the comments.`,
    choices: [
      { label: 'Community Day', hint: 'Fans +5 · players worn down (condition −4)', run: () => { for (const p of roster) p.cond = Math.max(0, p.cond - 4); resolve(L, `fans-${wk}`); return fx({ fans: 5 }); } },
      { label: 'Discount Tickets', hint: 'Fans +7 · Owner −3', run: () => { resolve(L, `fans-${wk}`); return fx({ fans: 7, owner: -3 }); } },
      { label: 'Ignore the Noise', hint: 'Nothing changes', run: () => { resolve(L, `fans-${wk}`); } },
    ] });

  // A star wants the ball.
  const diva = inSeason && L.phase === 'regular' ? roster.filter(p => ['WR', 'TE', 'RB'].includes(p.pos) && p.ovr >= 82 && p.traits.ego >= 70 && p.morale < 80).sort((a, b) => b.traits.ego - a.traits.ego)[0] : undefined;
  if (diva) add({ id: `diva-${diva.id}-${L.season}-${Math.floor(L.week / 6)}`, kind: 'Player', headline: `Does ${diva.ln} get more touches?`, p: diva, team: me,
    body: `${diva.fn} ${diva.ln} (${diva.pos} ${diva.ovr}) told reporters he's "open every play". He wants the offense built around him.`,
    choices: [
      { label: 'Feed Him', hint: `${diva.ln} morale +10 · Locker room −1`, run: () => { resolve(L, `diva-${diva.id}-${L.season}-${Math.floor(L.week / 6)}`); return fx({ players: [{ pid: diva.id, delta: 10 }], locker: -1 }); } },
      { label: 'Talk Privately', hint: `${diva.ln} morale +4`, run: () => { resolve(L, `diva-${diva.id}-${L.season}-${Math.floor(L.week / 6)}`); return fx({ players: [{ pid: diva.id, delta: 4 }] }); } },
      { label: 'Team Comes First', hint: `${diva.ln} morale −8 · Owner +1 · Locker room +1`, run: () => { resolve(L, `diva-${diva.id}-${L.season}-${Math.floor(L.week / 6)}`); return fx({ players: [{ pid: diva.id, delta: -8 }], owner: 1, locker: 1 }); } },
    ] });

  // Milestone chase late in the season.
  if (L.phase === 'regular' && L.week >= 13) {
    const MS: [keyof Player['stats'][number], number, string, number][] = [['ry', 1000, 'rushing yards', 160], ['recy', 1000, 'receiving yards', 160], ['py', 4000, 'passing yards', 320], ['dsk', 10, 'sacks', 2.5]];
    for (const p of roster) {
      const st = p.stats[L.season]; if (!st) continue;
      const hit = MS.find(([k, t, , w]) => (st[k] as number) < t && t - (st[k] as number) <= w);
      if (!hit) continue;
      const [k, t, label] = hit, left = t - (st[k] as number), id = `ms-${p.id}-${k}-${L.season}`;
      add({ id, kind: 'Milestone', headline: `Does ${p.ln} get his ${t.toLocaleString()}?`, p, team: me,
        body: `${p.fn} ${p.ln} is ${Math.round(left * 10) / 10} ${label} short of ${t.toLocaleString()} on the season. He knows it, the fans know it.`,
        choices: [
          { label: 'Feature Him', hint: `${p.ln} morale +8 · Fans +1 · +1 skill point · offense more predictable (Momentum −0.3)`, run: () => { sp(p, 1); resolve(L, id); return fx({ players: [{ pid: p.id, delta: 8 }], fans: 1, momentum: -0.3 }); } },
          { label: 'Team First', hint: `Locker room +1 · ${p.ln} morale −3`, run: () => { resolve(L, id); return fx({ locker: 1, players: [{ pid: p.id, delta: -3 }] }); } },
        ] });
      break;
    }
  }

  // A rookie pushing for snaps.
  if (inSeason) {
    const rook = roster.filter(p => p.exp === 0 && p.ovr >= 68 && hasTree(p.pos) && !(me.depth[p.pos] ?? []).slice(0, STARTERS[p.pos] ?? 1).includes(p.id)).sort((a, b) => b.ovr - a.ovr)[0];
    if (rook) {
      const id = `rook-${rook.id}-${L.season}`;
      add({ id, kind: 'Rookie', headline: `Is ${rook.ln} ready for a bigger role?`, p: rook, team: me,
        body: `The rookie ${rook.pos} (${rook.ovr} OVR, ${rook.pot} potential) has been the talk of practice. The coaches think he's close.`,
        choices: [
          { label: 'Mentor Program', hint: '+2 skill points for his archetype tree', run: () => { sp(rook, 2); resolve(L, id); return `${rook.ln} +2 skill points`; } },
          { label: 'Start Him', hint: `Moves him into the lineup · ${rook.ln} morale +10 · +1 skill point`, run: () => { const d = me.depth[rook.pos]!, n = STARTERS[rook.pos] ?? 1, a = d.indexOf(rook.id); if (a > 0) { d.splice(a, 1); d.splice(n - 1, 0, rook.id); markDepth(me, rook.pos); } sp(rook, 1); resolve(L, id); return fx({ players: [{ pid: rook.id, delta: 10 }] }); } },
          { label: 'Not Yet', hint: `${rook.ln} morale −4`, run: () => { resolve(L, id); return fx({ players: [{ pid: rook.id, delta: -4 }] }); } },
        ],
        delegate: { who: hc, role: 'Head Coach', quote: `I'll put him with the veterans. He'll learn.`, run: () => { sp(rook, 1); resolve(L, id); } } });
    }
  }

  // A worn-down veteran.
  if (inSeason && nextG) {
    const vet = roster.filter(p => p.age >= 30 && p.ovr >= 78 && p.cond < 78 && !p.injury).sort((a, b) => a.cond - b.cond)[0];
    if (vet) add({ id: `vet-${vet.id}-${wk}`, kind: 'Health', headline: `Do you rest ${vet.ln} this week?`, p: vet, team: me,
      body: `${vet.fn} ${vet.ln} (${vet.age}) is at ${Math.round(vet.cond)}% condition. Tired legs play slower and get hurt more.`,
      choices: [
        { label: 'Light Week', hint: 'Condition +18 · Momentum −0.4 (less practice)', run: () => { vet.cond = Math.min(100, vet.cond + 18); resolve(L, `vet-${vet.id}-${wk}`); return fx({ momentum: -0.4 }); } },
        { label: 'Play Through It', hint: `${vet.ln} morale +3 · he stays worn`, run: () => { resolve(L, `vet-${vet.id}-${wk}`); return fx({ players: [{ pid: vet.id, delta: 3 }] }); } },
      ],
      delegate: { who: 'Head Trainer', role: 'Medical', quote: `We'll manage his reps and keep him fresh.`, run: () => { vet.cond = Math.min(100, vet.cond + 10); resolve(L, `vet-${vet.id}-${wk}`); } } });
  }

  // Trade deadline.
  if (L.phase === 'regular' && L.week === L.tradeDeadlineWeek) {
    const st = standings(L)[L.user];
    add({ id: `deadline-${L.season}`, kind: 'Trade Deadline', feature: true, headline: st.w >= st.l ? `Do you buy at the deadline?` : `Is it time to sell?`, team: me,
      body: `This is the last week to make trades. At ${st.w}-${st.l}, ${st.w >= st.l ? 'one more piece could swing a playoff run' : 'veterans on expiring deals could bring back picks'}.`,
      choices: [{ label: 'Trade Center', run: o => o.go('trade') }, { label: 'Trade Block', run: o => o.go('block') }, { label: 'Stand Pat', hint: 'Locker room +1', run: () => { resolve(L, `deadline-${L.season}`); return fx({ locker: 1 }); } }] });
  }

  // ---- the rest of the week: situations that come and go ---------------------------
  const pool: ActionCard[] = [];
  const pid = (k: string) => `${k}-${wk}`;
  const h = (k: string) => hash(`${L.seed}-${wk}-${k}`) >>> 0;
  const byeWeek = L.phase === 'regular' && !ug;

  // Bye week.
  if (byeWeek) add({ id: pid('bye'), kind: 'Bye Week', feature: true, headline: `How do you use the bye?`, team: me,
    body: `No game this week. Bodies are sore, the playbook could use work, and the room could use a breather.`,
    choices: [
      { label: 'Full Rest', hint: 'Every player condition +15', run: () => { for (const p of roster) p.cond = Math.min(100, p.cond + 15); resolve(L, pid('bye')); return 'The team is fresh'; } },
      { label: 'Install New Plays', hint: 'Momentum +0.9 for the next game', run: () => { resolve(L, pid('bye')); return fx({ momentum: 0.9 }); } },
      { label: 'Team Retreat', hint: 'Locker room +4 · Fans +1', run: () => { resolve(L, pid('bye')); return fx({ locker: 4, fans: 1 }); } },
    ],
    delegate: { who: hc, role: 'Head Coach', quote: `Rest first, then a couple of install days.`, run: () => { for (const p of roster) p.cond = Math.min(100, p.cond + 8); resolve(L, pid('bye')); fx({ momentum: 0.4 }); } } });

  // Short week (Thursday / Wednesday game).
  if (nextG && opp && (nextG.day === 'Thu' || nextG.day === 'Wed')) add({ id: pid('short'), kind: 'Short Week', headline: `Short week: how do you prepare?`, team: opp,
    body: `${nextG.day === 'Thu' ? 'Thursday' : 'Wednesday'} night against the ${opp.nick}, with three days to recover and prepare. You can't do everything.`,
    choices: [
      { label: 'Walkthroughs Only', hint: 'Condition +8 for everyone · Momentum −0.3', run: () => { for (const p of roster) p.cond = Math.min(100, p.cond + 8); resolve(L, pid('short')); return fx({ momentum: -0.3 }); } },
      { label: 'Full Game Plan', hint: 'Momentum +0.4 · players stay tired', run: () => { resolve(L, pid('short')); return fx({ momentum: 0.4 }); } },
    ] });

  // Film study: pick a focus that sets this week's defensive plan.
  if (nextG && opp && L.phase === 'regular') {
    const ost = standings(L)[opp.abbr]; const gp = ost.w + ost.l + ost.t;
    pool.push({ id: pid('film'), kind: 'Film Room', headline: `What did the film show on the ${opp.nick}?`, team: opp,
      body: `Your staff broke down the ${opp.nick} (${gp ? `${(ost.pf / gp).toFixed(1)} points a game` : 'no games yet'}). Where do you put the focus this week?`,
      choices: [
        { label: 'Stop the Run', hint: 'Defensive plan: Stop the Run · Momentum +0.3', run: () => { me.plan.def = 'Stop the Run'; resolve(L, pid('film')); return `Plan set: Stop the Run · ${fx({ momentum: 0.3 })}`; } },
        { label: 'Stop the Pass', hint: 'Defensive plan: Stop the Pass · Momentum +0.3', run: () => { me.plan.def = 'Stop the Pass'; resolve(L, pid('film')); return `Plan set: Stop the Pass · ${fx({ momentum: 0.3 })}`; } },
        { label: 'Self-Scout', hint: 'Fix your own tells: Momentum +0.5', run: () => { resolve(L, pid('film')); return fx({ momentum: 0.5 }); } },
      ] });
  }

  // A veteran offers to mentor a young player at his position.
  if (inSeason) {
    const vet = roster.filter(p => p.age >= 30 && p.ovr >= 80 && hasTree(p.pos)).sort((a, b) => b.ovr - a.ovr)[0];
    const kid = vet && roster.filter(p => p.pos === vet.pos && p.age <= 24 && p.id !== vet.id).sort((a, b) => b.pot - a.pot)[0];
    if (vet && kid) pool.push({ id: `mentor-${kid.id}-${L.season}`, kind: 'Mentorship', headline: `Will ${vet.ln} take ${kid.ln} under his wing?`, p: kid, team: me,
      body: `${vet.fn} ${vet.ln} (${vet.age}, ${vet.ovr} OVR) has offered to mentor ${kid.fn} ${kid.ln} (${kid.age}, ${kid.pot} potential). It costs the veteran some of his own prep time.`,
      choices: [
        { label: 'Make It Official', hint: `${kid.ln} +2 skill points and faster growth · ${vet.ln} morale +4, condition −5`, run: () => { sp(kid, 2); kid.xp += 400; vet.cond = Math.max(0, vet.cond - 5); resolve(L, `mentor-${kid.id}-${L.season}`); return fx({ players: [{ pid: vet.id, delta: 4 }, { pid: kid.id, delta: 4 }] }); } },
        { label: 'Not This Year', hint: `${vet.ln} morale −2`, run: () => { resolve(L, `mentor-${kid.id}-${L.season}`); return fx({ players: [{ pid: vet.id, delta: -2 }] }); } },
      ] });
  }

  // Social media flap.
  if (inSeason) {
    const loud = roster.filter(p => p.traits.ego >= 72 && p.ovr >= 75).sort((a, b) => (h(a.id) % 97) - (h(b.id) % 97))[0];
    if (loud) pool.push({ id: pid(`post-${loud.id}`), kind: 'Social Media', headline: `What do you do about ${loud.ln}'s post?`, p: loud, team: me,
      body: `${loud.fn} ${loud.ln} posted a late-night rant about his role and "people upstairs". It has a million views and every reporter wants a reaction.`,
      choices: [
        { label: 'Fine Him', hint: `${loud.ln} morale −7 · Owner +2 · Locker room +1`, run: () => { resolve(L, pid(`post-${loud.id}`)); return fx({ players: [{ pid: loud.id, delta: -7 }], owner: 2, locker: 1 }); } },
        { label: 'Defend Him', hint: `${loud.ln} morale +5 · Fans −2 · Owner −1`, run: () => { resolve(L, pid(`post-${loud.id}`)); return fx({ players: [{ pid: loud.id, delta: 5 }], fans: -2, owner: -1 }); } },
        { label: 'Handle It In-House', hint: `${loud.ln} morale +1 · nothing public`, run: () => { resolve(L, pid(`post-${loud.id}`)); return fx({ players: [{ pid: loud.id, delta: 1 }] }); } },
      ] });
  }

  // Your coordinator is wanted elsewhere (after a hot run).
  const myStreak = /W(\d+)/.exec(standings(L)[L.user]?.streak ?? '');
  if (L.phase === 'regular' && myStreak && +myStreak[1] >= 4) add({ id: `poach-${L.season}`, kind: 'Coaching Staff', headline: `Do you let your coordinator interview?`, team: me,
    body: `${+myStreak[1]} straight wins and other teams have noticed. A rival wants to talk to your offensive coordinator about their head coaching job.`,
    choices: [
      { label: 'Block It', hint: 'Keeps the staff together · Owner +1 · Locker room −1', run: () => { resolve(L, `poach-${L.season}`); return fx({ owner: 1, locker: -1 }); } },
      { label: 'Give Him a Raise', hint: 'Owner −3 · Locker room +2 · Momentum +0.3 · OC +$0.5M, +1 year', run: () => { resolve(L, `poach-${L.season}`); const oc = staffOf(L, L.user).OC; if (oc) { oc.salary += 500_000; oc.years++; } return fx({ owner: -3, locker: 2, momentum: 0.3 }); } },
      { label: 'Let Him Interview', hint: 'Locker room +1 · Momentum −0.4 · Likely to lose him this offseason', run: () => { resolve(L, `poach-${L.season}`); staffState(L).mayLeave = staffOf(L, L.user).OC?.id; return fx({ locker: 1, momentum: -0.4 }); } },
    ] });

  // Pro Bowl voting.
  if (L.phase === 'regular' && L.week >= 13 && L.week <= 15) {
    const star = roster.slice().sort((a, b) => b.ovr - a.ovr)[0];
    if (star) add({ id: `probowl-${L.season}`, kind: 'Pro Bowl', headline: `Do you campaign for ${star.ln}?`, p: star, team: me,
      body: `Pro Bowl voting closes soon. A push from the team could get ${star.fn} ${star.ln} and a couple of teammates in.`,
      choices: [
        { label: 'Full Campaign', hint: `${star.ln} morale +6 · Fans +2 · Locker room +1`, run: () => { resolve(L, `probowl-${L.season}`); return fx({ players: [{ pid: star.id, delta: 6 }], fans: 2, locker: 1 }); } },
        { label: 'Let the Play Speak', hint: 'No change', run: () => { resolve(L, `probowl-${L.season}`); } },
      ] });
  }

  // A hot streak: three straight big games.
  if (L.phase === 'regular' && L.week >= 4) {
    const big = (p: Player, w: number) => { const g = L.games.find(x => x.season === L.season && x.week === w && (x.home === L.user || x.away === L.user)); const l = g?.result?.box?.players[p.id]; return !!l && ((l.py ?? 0) >= 280 || (l.ry ?? 0) >= 90 || (l.recy ?? 0) >= 90 || (l.dsk ?? 0) >= 2 || (l.dint ?? 0) >= 1); };
    const hot = roster.find(p => [1, 2, 3].every(k => big(p, L.week - k)));
    if (hot) add({ id: `hot-${hot.id}-${L.week}`, kind: 'Hot Streak', headline: `Is ${hot.ln} the hottest player in football?`, p: hot, team: me,
      body: `Three straight huge games for ${hot.fn} ${hot.ln}. Highlights everywhere, national talk shows calling.`,
      choices: [
        { label: 'Ride the Hot Hand', hint: `${hot.ln} morale +6 · +1 skill point · Momentum +0.4`, run: () => { sp(hot, 1); resolve(L, `hot-${hot.id}-${L.week}`); return fx({ players: [{ pid: hot.id, delta: 6 }], momentum: 0.4 }); } },
        { label: 'Keep Him Humble', hint: 'Locker room +2', run: () => { resolve(L, `hot-${hot.id}-${L.week}`); return fx({ locker: 2 }); } },
      ] });
  }

  // Scouting trip.
  if (L.phase === 'regular' && L.week >= 6) pool.push({ id: pid('scout'), kind: 'Scouting', headline: `Where do the scouts go this weekend?`, team: me,
    body: `A marquee college game is on Saturday, with three first-round prospects on the field. Your pro scouts would rather stay on next week's opponent.`,
    choices: [
      { label: 'College Game', hint: '+70 scouting points for the draft', run: () => { L.scoutPoints += 70; resolve(L, pid('scout')); return '+70 scouting points'; } },
      { label: 'Pro Advance Work', hint: 'Momentum +0.4', run: () => { resolve(L, pid('scout')); return fx({ momentum: 0.4 }); } },
    ] });

  // Community and charity.
  if (inSeason) pool.push({ id: pid('charity'), kind: 'Community', headline: `Will the team visit the children's hospital?`, team: me,
    body: `The players want to spend Tuesday, their day off, at the children's hospital. The trainers would rather they rested.`,
    choices: [
      { label: 'Whole Team Goes', hint: 'Fans +3 · Locker room +2 · condition −3', run: () => { for (const p of roster) p.cond = Math.max(0, p.cond - 3); resolve(L, pid('charity')); return fx({ fans: 3, locker: 2 }); } },
      { label: 'Captains Go', hint: 'Fans +1 · Locker room +1', run: () => { resolve(L, pid('charity')); return fx({ fans: 1, locker: 1 }); } },
    ] });

  // A practice standout at the bottom of the roster.
  if (inSeason) {
    const deep = roster.filter(p => p.age <= 25 && p.pot - p.ovr >= 10 && p.ovr < 70 && hasTree(p.pos)).sort((a, b) => b.pot - a.pot)[0];
    if (deep) pool.push({ id: `standout-${deep.id}-${L.season}`, kind: 'Practice', headline: `Has ${deep.ln} earned a look?`, p: deep, team: me,
      body: `${deep.fn} ${deep.ln} (${deep.pos}, ${deep.ovr} OVR, ${deep.pot} potential) has been the best player at practice for two weeks.`,
      choices: [
        { label: 'Extra Reps', hint: `${deep.ln} faster growth and +1 skill point · morale +5`, run: () => { deep.xp += 600; sp(deep, 1); resolve(L, `standout-${deep.id}-${L.season}`); return fx({ players: [{ pid: deep.id, delta: 5 }] }); } },
        { label: 'Stay the Course', hint: `${deep.ln} morale −3`, run: () => { resolve(L, `standout-${deep.id}-${L.season}`); return fx({ players: [{ pid: deep.id, delta: -3 }] }); } },
      ] });
  }

  // A couple of the situational cards a week, so the row stays a hand and not a pile.
  pool.filter(c => !done(L).includes(c.id)).sort((a, b) => h(a.id) - h(b.id)).slice(0, 2).forEach(c => out.push(c));

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
  // What you said at the podium leads the row; the opponent card closes it.
  const rank = (c: ActionCard) => (c.matchup ? 9 : ['Fallout', 'League Office'].includes(c.kind) ? 0 : c.kind === 'Media' ? 1 : 5);
  return curate(L, wk, out).map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map(x => x.c);
}

// ---- the weekly deck ------------------------------------------------------------------------
// Every situation above can exist for weeks on end; showing all of them every week made the
// hub a wall of the same nine questions. The curator picks a short deck instead: the
// matchup, anything urgent, and at most three other decisions, favouring kinds and players
// you haven't heard about lately. A card can't come back for a few weeks after it's shown,
// and one you skip twice is handled by your staff (their default call) so it stops nagging.
const URGENT = new Set(['Fallout', 'League Office', 'Trade Deadline']);
const DECK_SIZE = 3;
interface DeckMemory { wk: string; ids: string[]; idx: number; shown: Record<string, number>; seenAt: Record<string, number>; kindAt: Record<string, number>; pidAt: Record<string, number> }
const deckMem = (L: League) => ((L as League & { actionDeck?: DeckMemory }).actionDeck ??= { wk: '', ids: [], idx: 0, shown: {}, seenAt: {}, kindAt: {}, pidAt: {} });

function curate(L: League, wk: string, out: ActionCard[]): ActionCard[] {
  const m = deckMem(L);
  if (m.wk !== wk) {
    m.wk = wk; m.idx++;
    // Cards skipped twice: the staff takes them.
    const handled: string[] = [];
    for (const c of out) {
      if (c.matchup || URGENT.has(c.kind) || (m.shown[c.id] ?? 0) < 2) continue;
      if (c.delegate) { c.delegate.run(); handled.push(`${c.headline} — ${c.delegate.who} (${c.delegate.role}): "${c.delegate.quote}"`); }
      resolve(L, c.id);
    }
    if (handled.length) mail(L, 'Front Office', `Your staff handled ${handled.length} open item${handled.length > 1 ? 's' : ''}`, handled.join('\n'));
    const live = out.filter(c => !done(L).includes(c.id));
    const ago = (at: number | undefined) => (at === undefined ? 99 : m.idx - at);
    const score = (c: ActionCard) => {
      if (c.kind === 'Coach Tree' && (L.coachTree.points < 3 || ago(m.kindAt[c.kind]) < 4)) return -1;
      if (ago(m.seenAt[c.id]) < 4) return -1;                 // just saw this exact card
      if (c.p && ago(m.pidAt[c.p.id]) < 2) return -1;         // his storyline needs a rest
      const novelty = Math.min(8, ago(m.kindAt[c.kind]));
      return (c.feature ? 2 : 0) + novelty + ((hash(`${wk}-${c.id}`) >>> 0) % 100) / 40;
    };
    const keep = live.filter(c => c.matchup || URGENT.has(c.kind));
    const kinds = new Set<string>(), pids = new Set<string>();
    for (const { c } of live.filter(c => !c.matchup && !URGENT.has(c.kind)).map(c => ({ c, v: score(c) })).filter(x => x.v >= 0).sort((a, b) => b.v - a.v)) {
      if (keep.filter(k => !k.matchup && !URGENT.has(k.kind)).length >= DECK_SIZE) break;
      if (kinds.has(c.kind) || (c.p && pids.has(c.p.id))) continue;   // one of each kind, one per player
      keep.push(c); kinds.add(c.kind); if (c.p) pids.add(c.p.id);
    }
    m.ids = keep.map(c => c.id);
    for (const c of keep) { m.shown[c.id] = (m.shown[c.id] ?? 0) + 1; m.seenAt[c.id] = m.idx; m.kindAt[c.kind] = m.idx; if (c.p && !c.matchup) m.pidAt[c.p.id] = m.idx; }
  }
  // Within the week the deck is fixed; urgent cards that appear mid-week (press fallout) join it.
  return out.filter(c => m.ids.includes(c.id) || URGENT.has(c.kind));
}
