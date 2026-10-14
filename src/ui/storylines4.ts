// More of the week: a viral clip, a rival GM's late-night call, the stadium's flyover
// request, a superstar's sneaker-launch conflict, a weather emergency at practice, a
// film-room discovery about the opponent, and a former player's jersey retirement.
import type { ActionCard } from './actions';
import type { Kit } from './storylines';
import { hash } from '../core/rng';
import { userGame } from '../core/season';

export function storylines4(k: Kit): ActionCard[] {
  const { L, me, roster, hc, gm, wk, fx, resolve } = k;
  const out: ActionCard[] = [];
  if (L.phase !== 'regular') return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0) % 100;
  const id = (key: string) => `${key}-${wk}`;
  const g = userGame(L);
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const star = roster.filter(p => !p.injury).sort((a, b) => b.ovr - a.ovr)[0];
  const young = roster.filter(p => p.age <= 23 && p.ovr >= 70).sort((a, b) => b.ovr - a.ovr)[0];

  if (young && r('viral') < 35) out.push({ id: id('viral'), kind: 'Media', scene: 'texts', team: me, p: young, headline: `${young.ln}'s locker-room dance is all over the internet`,
    texts: ['bro is trending #1 💀', 'league office called about the "mic\'d up" clip', 'jersey sales up 400% overnight'],
    body: `A clip of ${young.fn} ${young.ln} dancing after practice has 20 million views. The marketing team wants a whole campaign around it; ${hc} wants him focused.`,
    choices: [
      { label: 'Lean Into It', hint: 'Fans +4 · Owner +2 · Momentum −0.2', run: () => { resolve(id('viral')); return fx({ fans: 4, owner: 2, momentum: -0.2 }); } },
      { label: 'Keep It In-House', hint: `Locker room +2 · ${young.ln} morale +3`, run: () => { resolve(id('viral')); return fx({ locker: 2, players: [{ pid: young.id, delta: 3 }] }); } },
    ] });

  if (opp && r('film') < 30) out.push({ id: id('film'), kind: 'Film Room', scene: 'film', team: me, headline: `The ${opp.nick} are tipping their blitzes`,
    body: `A quality-control coach found it at 2 a.m.: the ${opp.nick}' nickel corner creeps a half-step before every pressure. Do you build the plan around it or keep it simple?`,
    choices: [
      { label: 'Install a Blitz Beater', hint: 'Momentum +0.6 · Locker room −1 (extra install)', run: () => { resolve(id('film')); return fx({ momentum: 0.6, locker: -1 }); } },
      { label: 'Just a Few Checks', hint: 'Momentum +0.3', run: () => { resolve(id('film')); return fx({ momentum: 0.3 }); } },
    ] });

  if (g && g.home === L.user && r('flyover') < 22) out.push({ id: id('flyover'), kind: 'Gameday', scene: 'stadium', team: me, headline: 'Flyover, fireworks and a sellout. How big do you go?',
    body: `Sunday is a sellout and the stadium team has pitched a military flyover, fireworks at the anthem and a pregame light show. It costs money and a long pregame.`,
    choices: [
      { label: 'Full Spectacle', hint: 'Fans +5 · Owner −1', run: () => { resolve(id('flyover')); return fx({ fans: 5, owner: -1 }); } },
      { label: 'Just the Flyover', hint: 'Fans +2', run: () => { resolve(id('flyover')); return fx({ fans: 2 }); } },
    ] });

  if (star && r('sneaker') < 25) out.push({ id: id('sneaker'), kind: 'Business', scene: 'phone', caller: `${star.fn} ${star.ln}'s agent`, team: me, p: star, headline: `${star.ln}'s shoe launch lands on a practice day`,
    body: `${star.fn} ${star.ln}'s signature shoe launches Wednesday with a downtown event. His agent asks for the afternoon off; ${hc} says Wednesday is the install day.`,
    choices: [
      { label: 'Give Him the Day', hint: `${star.ln} morale +6 · Locker room −2`, run: () => { resolve(id('sneaker')); return fx({ players: [{ pid: star.id, delta: 6 }], locker: -2 }); } },
      { label: 'Move It to Tuesday', hint: `${star.ln} morale +2 · Owner +1`, run: () => { resolve(id('sneaker')); return fx({ players: [{ pid: star.id, delta: 2 }], owner: 1 }); } },
      { label: 'Practice Comes First', hint: `${star.ln} morale −4 · Momentum +0.2`, run: () => { resolve(id('sneaker')); return fx({ players: [{ pid: star.id, delta: -4 }], momentum: 0.2 }); } },
    ] });

  if (r('storm') < 15) out.push({ id: id('storm'), kind: 'Practice', scene: 'snow', team: me, headline: 'Lightning on the radar. Thursday practice is in trouble.',
    body: `A storm cell is rolling in. The indoor facility is booked for a youth camp until 4, and ${hc} doesn't want to lose the two-minute work.`,
    choices: [
      { label: 'Bump the Camp', hint: 'Momentum +0.3 · Fans −2', run: () => { resolve(id('storm')); return fx({ momentum: 0.3, fans: -2 }); } },
      { label: 'Walkthrough Only', hint: 'Condition +3 for everyone · Momentum −0.2', run: () => { for (const p of roster) p.cond = Math.min(100, p.cond + 3); resolve(id('storm')); return fx({ momentum: -0.2 }); } },
    ] });

  if (r('legend') < 12) out.push({ id: id('legend'), kind: 'Community', scene: 'tv', team: me, headline: 'A franchise legend asks to retire his number at halftime',
    body: `One of the greatest players in team history wants his jersey retired this season, in front of the home crowd. ${gm} worries about the halftime routine.`,
    choices: [
      { label: 'Big Ceremony', hint: 'Fans +5 · Locker room +2', run: () => { resolve(id('legend')); return fx({ fans: 5, locker: 2 }); } },
      { label: 'Pregame Tribute', hint: 'Fans +3', run: () => { resolve(id('legend')); return fx({ fans: 3 }); } },
    ] });
  return out;
}
