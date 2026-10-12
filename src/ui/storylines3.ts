// The rooms and the cameras: team meetings, position-group rooms, captains' councils and
// the media obligations around them (national sit-downs, local radio, a documentary crew,
// a rookie's first big interview). Each only shows up when its situation exists.
import type { ActionCard } from './actions';
import type { Kit } from './storylines';
import { hash } from '../core/rng';
import { standings, userGame } from '../core/season';

export function storylines3(k: Kit): ActionCard[] {
  const { L, me, roster, hc, gm, wk, fx, sp, resolve } = k;
  const out: ActionCard[] = [];
  if (L.phase !== 'regular') return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0);
  const id = (key: string) => `${key}-${wk}`;
  const st = standings(L)[L.user];
  const g = userGame(L);
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const healthy = roster.filter(p => !p.injury);
  const best = (f: (p: (typeof roster)[number]) => boolean) => healthy.filter(f).sort((a, b) => b.ovr - a.ovr)[0];
  const lastTwo = L.games.filter(x => x.result && x.season === L.season && (x.home === L.user || x.away === L.user)).slice(-2);
  const lost = (x: (typeof lastTwo)[number]) => { const mine = x.home === L.user ? x.result!.hs : x.result!.as, theirs = x.home === L.user ? x.result!.as : x.result!.hs; return mine < theirs; };
  const skid = lastTwo.length === 2 && lastTwo.every(lost);

  // The team meeting after a losing streak.
  if (skid) out.push({ id: id('mtg'), kind: 'Team Meeting', scene: 'meeting', team: me, feature: true, headline: 'Two straight losses. What does Monday\'s team meeting sound like?',
    body: `${hc} has the whole roster in the auditorium at 8 a.m. and has asked whether you want to speak first. Everyone already knows what the film looks like.`,
    choices: [
      { label: 'Fire Them Up', hint: 'Locker room +3 · Momentum +0.3', run: () => { resolve(id('mtg')); return fx({ locker: 3, momentum: 0.3 }); } },
      { label: 'Put the Film On', hint: 'Momentum +0.5 · Locker room −1', run: () => { resolve(id('mtg')); return fx({ momentum: 0.5, locker: -1 }); } },
      { label: 'Let the Captains Talk', hint: 'Locker room +2 · Owner +1', run: () => { resolve(id('mtg')); return fx({ locker: 2, owner: 1 }); } },
    ], delegate: { who: hc, role: 'Head Coach', quote: 'I\'ll handle my room.', run: () => { resolve(id('mtg')); fx({ locker: 2, momentum: 0.2 }); } } });

  // The leadership council picks an extra captain.
  const vets = healthy.filter(p => p.exp >= 5 && p.ovr >= 78).sort((a, b) => b.traits.work - a.traits.work).slice(0, 2);
  if (vets.length === 2 && L.week >= 4 && L.week <= 8 && r('capt') % 5 === 0) {
    const [a, b] = vets;
    out.push({ id: `capt-${L.season}`, kind: 'Leadership Council', scene: 'meeting', team: me, p: a, headline: 'The leadership council wants a new captain. Two names keep coming up.',
      body: `${a.pos} ${a.fn} ${a.ln} and ${b.pos} ${b.fn} ${b.ln} both have the room's respect. The council will go with whoever you back.`,
      choices: [
        { label: `Back ${a.ln}`, hint: `${a.ln} morale +6 · ${b.ln} morale −2 · Locker room +1`, run: () => { resolve(`capt-${L.season}`); return fx({ players: [{ pid: a.id, delta: 6 }, { pid: b.id, delta: -2 }], locker: 1 }); } },
        { label: `Back ${b.ln}`, hint: `${b.ln} morale +6 · ${a.ln} morale −2 · Locker room +1`, run: () => { resolve(`capt-${L.season}`); return fx({ players: [{ pid: b.id, delta: 6 }, { pid: a.id, delta: -2 }], locker: 1 }); } },
      ] });
  }

  // The receiver room wants the ball.
  const wr = best(p => p.pos === 'WR' && p.traits.ego >= 60 && p.ovr >= 78);
  if (wr && r('wrroom') % 6 === 0) out.push({ id: id('wrroom'), kind: 'Position Room', scene: 'meeting', p: wr, team: me, headline: `${wr.ln} spoke up in the receivers' meeting about his targets`,
    body: `In front of the whole room, ${wr.fn} ${wr.ln} said he can't win if the ball never comes his way. The position coach wants to know if you're backing him or the game plan.`,
    choices: [
      { label: 'More Targets This Week', hint: `${wr.ln} morale +6 · Locker room −1`, run: () => { resolve(id('wrroom')); return fx({ players: [{ pid: wr.id, delta: 6 }], locker: -1 }); } },
      { label: 'The Plan Is the Plan', hint: `${wr.ln} morale −4 · Locker room +2`, run: () => { resolve(id('wrroom')); return fx({ players: [{ pid: wr.id, delta: -4 }], locker: 2 }); } },
    ] });

  // The quarterback room: the backup wants work.
  const qbs = healthy.filter(p => p.pos === 'QB').sort((a, b) => b.ovr - a.ovr);
  if (qbs.length >= 2 && qbs[1].age <= 25 && r('qbroom') % 7 === 0) {
    const [qb1, qb2] = qbs;
    out.push({ id: id('qbroom'), kind: 'Position Room', scene: 'meeting', p: qb2, team: me, headline: `${qb2.ln} wants scout-team reps against the starters`,
      body: `Backup ${qb2.fn} ${qb2.ln} (${qb2.ovr} OVR) asked the quarterbacks coach for more live work. It would come out of ${qb1.ln}'s reps.`,
      choices: [
        { label: 'Give Him the Reps', hint: `${qb2.ln} grows faster, +1 skill point · ${qb1.ln} morale −2`, run: () => { qb2.xp += 450; sp(qb2, 1); resolve(id('qbroom')); return fx({ players: [{ pid: qb2.id, delta: 4 }, { pid: qb1.id, delta: -2 }] }); } },
        { label: 'Starter Gets the Work', hint: `${qb1.ln} morale +2 · ${qb2.ln} morale −3 · Momentum +0.2`, run: () => { resolve(id('qbroom')); return fx({ players: [{ pid: qb1.id, delta: 2 }, { pid: qb2.id, delta: -3 }], momentum: 0.2 }); } },
      ] });
  }

  // Rookie seminar.
  const rookies = roster.filter(p => p.exp === 0);
  if (rookies.length >= 4 && L.week >= 2 && L.week <= 6 && r('rookie') % 5 === 0) out.push({ id: `rksem-${L.season}`, kind: 'Rookie Program', scene: 'meeting', team: me, headline: 'Do the rookies sit through a money-management seminar on their day off?',
    body: `Player engagement has a financial adviser booked for Tuesday. ${rookies.length} first-year players would be required to attend.`,
    choices: [
      { label: 'Make It Mandatory', hint: 'Rookies morale −2 · Owner +2', run: () => { resolve(`rksem-${L.season}`); return fx({ owner: 2, players: rookies.map(p => ({ pid: p.id, delta: -2 })) }); } },
      { label: 'Make It Optional', hint: 'Rookies morale +2', run: () => { resolve(`rksem-${L.season}`); return fx({ players: rookies.map(p => ({ pid: p.id, delta: 2 })) }); } },
    ] });

  // A national sit-down interview with the GM.
  const hot = st && st.l >= st.w + 2;
  if ((hot || r('natl') % 7 === 0) && L.week >= 3) out.push({ id: id('natl'), kind: 'Interview', scene: 'interview', team: me, caller: gm, headline: hot ? 'A national reporter asks you on camera: is your coach safe?' : 'A national network wants a sit-down on your rebuild',
    body: hot ? `The interview is taped and will air before Sunday. Every answer about ${hc} becomes a headline.` : `The segment runs Sunday morning. They want to know how this roster gets to a championship.`,
    choices: hot ? [
      { label: 'Full Vote of Confidence', hint: 'Locker room +2 · Owner −1', run: () => { resolve(id('natl')); return fx({ locker: 2, owner: -1 }); } },
      { label: 'Everyone Is Evaluated', hint: 'Owner +2 · Locker room −2', run: () => { resolve(id('natl')); return fx({ owner: 2, locker: -2 }); } },
      { label: 'Decline the Question', hint: 'Fans −1', run: () => { resolve(id('natl')); return fx({ fans: -1 }); } },
    ] : [
      { label: 'Promise the Playoffs', hint: 'Fans +3 · Owner +1 · Momentum +0.2', run: () => { resolve(id('natl')); return fx({ fans: 3, owner: 1, momentum: 0.2 }); } },
      { label: 'Talk About the Process', hint: 'Owner +2', run: () => { resolve(id('natl')); return fx({ owner: 2 }); } },
    ] });

  // The star's one-on-one interview turns to his contract.
  const star = best(p => p.ovr >= 85 && p.contract.years.filter(y => y.s > L.season && !y.v).length <= 1);
  if (star && r('starint') % 6 === 0) out.push({ id: `starint-${star.id}-${L.season}`, kind: 'Interview', scene: 'interview', p: star, team: me, headline: `In a sit-down interview, ${star.ln} was asked if this is his last year here`,
    body: `${star.fn} ${star.ln} is in the last year of his deal. He smiled and said "ask the front office." The network wants your answer for the same segment.`,
    choices: [
      { label: '"He\'s Our Guy"', hint: `${star.ln} morale +6 · Fans +2`, run: () => { resolve(`starint-${star.id}-${L.season}`); return fx({ players: [{ pid: star.id, delta: 6 }], fans: 2 }); } },
      { label: 'No Contract Talk In Season', hint: `${star.ln} morale −3 · Owner +1`, run: () => { resolve(`starint-${star.id}-${L.season}`); return fx({ players: [{ pid: star.id, delta: -3 }], owner: 1 }); } },
    ] });

  // A rookie's first big interview after a big game.
  const breakout = healthy.filter(p => p.exp === 0 && p.ovr >= 70).sort((a, b) => b.ovr - a.ovr)[0];
  if (breakout && r('rkint') % 5 === 0) out.push({ id: `rkint-${breakout.id}-${L.season}`, kind: 'Interview', scene: 'interview', p: breakout, team: me, headline: `Every network wants ${breakout.ln}. Do you let the rookie do the circuit?`,
    body: `${breakout.fn} ${breakout.ln} is the rookie everyone is talking about. Three shows want him this week, including a live studio hit.`,
    choices: [
      { label: 'Let Him Shine', hint: `Fans +3 · ${breakout.ln} morale +4 · Momentum −0.2`, run: () => { resolve(`rkint-${breakout.id}-${L.season}`); return fx({ fans: 3, players: [{ pid: breakout.id, delta: 4 }], momentum: -0.2 }); } },
      { label: 'Shield Him', hint: `${breakout.ln} morale −1 · Momentum +0.2`, run: () => { resolve(`rkint-${breakout.id}-${L.season}`); return fx({ players: [{ pid: breakout.id, delta: -1 }], momentum: 0.2 }); } },
    ] });

  // Local sports radio call-in.
  if (st && r('radio') % 8 === 0) out.push({ id: id('radio'), kind: 'Interview', scene: 'interview', caller: 'Sports Radio', team: me, headline: 'The local radio show wants you live on the call-in hour',
    body: `It's the most listened-to show in town, and the phone lines are already full. ${st.w > st.l ? 'The callers are in a good mood.' : 'The callers are not happy.'}`,
    choices: [
      { label: 'Take the Calls', hint: st.w > st.l ? 'Fans +3' : 'Fans +2 · Owner −1', run: () => { resolve(id('radio')); return fx(st.w > st.l ? { fans: 3 } : { fans: 2, owner: -1 }); } },
      { label: 'Send a Statement', hint: 'Fans −1', run: () => { resolve(id('radio')); return fx({ fans: -1 }); } },
    ] });

  // The documentary crew.
  if (L.week <= 4 && r('doc') % 6 === 0) out.push({ id: `doc-${L.season}`, kind: 'Media', scene: 'interview', team: me, headline: 'A documentary crew wants all-access for the rest of the season',
    body: `Cameras in meetings, the locker room and the draft room. The league loves it and the owner likes the exposure. ${hc} hates the idea.`,
    choices: [
      { label: 'Open the Doors', hint: 'Fans +4 · Owner +2 · Locker room −2', run: () => { resolve(`doc-${L.season}`); return fx({ fans: 4, owner: 2, locker: -2 }); } },
      { label: 'Closed Building', hint: 'Locker room +1 · Owner −1', run: () => { resolve(`doc-${L.season}`); return fx({ locker: 1, owner: -1 }); } },
    ] });

  // A player's podcast clip.
  const pod = best(p => p.traits.ego >= 70 && p.ovr >= 74);
  if (pod && opp && r('pod') % 7 === 0) out.push({ id: id('pod'), kind: 'Media', scene: 'interview', p: pod, team: me, headline: `${pod.ln} called the ${opp.nick} "overrated" on his podcast`,
    body: `${pod.fn} ${pod.ln}'s weekly podcast clip is all over the internet, and the ${opp.nick} have it on their locker room screen.`,
    choices: [
      { label: 'Fine Him', hint: `${pod.ln} morale −5 · Owner +1 · Locker room +1`, run: () => { resolve(id('pod')); return fx({ players: [{ pid: pod.id, delta: -5 }], owner: 1, locker: 1 }); } },
      { label: 'Let Him Talk', hint: `${pod.ln} morale +3 · Fans +1 · Momentum +0.2`, run: () => { resolve(id('pod')); return fx({ players: [{ pid: pod.id, delta: 3 }], fans: 1, momentum: 0.2 }); } },
    ] });

  // The defensive staff wants to change the plan.
  if (opp && r('dcmtg') % 6 === 0) out.push({ id: id('dcmtg'), kind: 'Staff Meeting', scene: 'meeting', team: me, headline: `The defensive staff wants a whole new plan for the ${opp.nick}`,
    body: `The coordinator spent all night on a pressure-heavy package for this week. It's aggressive and the players would have three days to learn it.`,
    choices: [
      { label: 'Install It', hint: 'Momentum +0.4 · everyone condition −3', run: () => { for (const p of roster) p.cond = Math.max(0, p.cond - 3); resolve(id('dcmtg')); return fx({ momentum: 0.4 }); } },
      { label: 'Keep It Simple', hint: 'Locker room +1', run: () => { resolve(id('dcmtg')); return fx({ locker: 1 }); } },
    ] });

  return out;
}
