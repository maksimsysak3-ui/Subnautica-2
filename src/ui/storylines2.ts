// More of the week's drama, each with its own set: a snowstorm over practice, a sponsor
// shoot, a rival GM on TV, a video-game rating, a ring-of-honor night, a grounded team
// plane, a throwback petition, a sign-stealing accusation, a baby on the way, and the
// rookie dinner bill. Every choice moves something real.
import type { ActionCard } from './actions';
import type { Kit } from './storylines';
import { hash } from '../core/rng';
import { userGame } from '../core/season';
import { facilityState, facility } from '../core/facilities';
import { makeWeather } from '../sim/game';
import { Rng } from '../core/rng';

export function storylines2(k: Kit): ActionCard[] {
  const { L, me, roster, hc, wk, fx, resolve } = k;
  const out: ActionCard[] = [];
  if (L.phase !== 'regular') return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0);
  const id = (key: string) => `${key}-${wk}`;
  const g = userGame(L);
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const away = g && g.away === L.user;
  const fund = (m: number) => { const s = facilityState(L); s.funds = Math.max(0, s.funds + m * 1e6); };
  const qb = roster.filter(p => p.pos === 'QB' && !p.injury).sort((a, b) => b.ovr - a.ovr)[0];
  const stars = roster.filter(p => p.ovr >= 82 && !p.injury);

  // Snow on the practice field.
  if (g && L.week >= 11) {
    const wx = makeWeather(L.teams[L.user], { ...g, home: L.user }, new Rng(hash(`${g.id}-prac`)));
    if (!wx.dome && wx.temp <= 36 && r('snow') % 2 === 0) {
      const indoor = facility(L, L.user, 'training') >= 3;
      out.push({ id: id('snow'), kind: 'Weather', scene: 'snow', team: me, headline: 'A snowstorm is rolling in. Where do you practice?',
        body: `Eight inches are forecast by Thursday. ${indoor ? 'Your indoor facility is open.' : 'Your indoor facility is too small for a full practice: you would have to rent a dome across town.'}`,
        choices: [
          { label: 'Practice in the Snow', hint: 'Locker room +2 · Momentum +0.3 · everyone condition −4', run: () => { for (const p of roster) p.cond = Math.max(0, p.cond - 4); resolve(id('snow')); return fx({ locker: 2, momentum: 0.3 }); } },
          { label: indoor ? 'Move Indoors' : 'Rent a Dome ($2M)', hint: indoor ? 'Nothing lost' : 'Facilities budget −$2M', run: () => { if (!indoor) fund(-2); resolve(id('snow')); return indoor ? 'Practice moved indoors.' : 'Facilities budget −$2M'; } },
        ], delegate: { who: hc, role: 'Head Coach', quote: `We play in this. We practice in it.`, run: () => { resolve(id('snow')); fx({ locker: 2, momentum: 0.3 }); } } });
    }
  }

  // A sponsor wants the quarterback for a commercial.
  if (qb && qb.ovr >= 78 && r('ad') % 6 === 0) out.push({ id: id('ad'), kind: 'Sponsor', scene: 'office', p: qb, team: me, headline: `A sponsor wants ${qb.ln} for a national commercial`,
    body: `A sportswear brand wants ${qb.fn} ${qb.ln} for a shoot on Tuesday, his day off. They will put $4M toward the facilities budget. His position coach wants him in the film room.`,
    choices: [
      { label: 'Do the Shoot', hint: 'Facilities budget +$4M · his morale +3 · Momentum −0.3', run: () => { fund(4); resolve(id('ad')); return `Facilities budget +$4M · ${fx({ players: [{ pid: qb.id, delta: 3 }], momentum: -0.3 })}`; } },
      { label: 'After the Season', hint: 'Owner −1 · Momentum +0.2', run: () => { resolve(id('ad')); return fx({ owner: -1, momentum: 0.2 }); } },
    ] });

  // A rival GM takes a shot on TV.
  if (opp && r('gm') % 5 === 0) out.push({ id: id('gm'), kind: 'Media', scene: 'tv', team: opp, headline: `The ${opp.nick} GM just mocked your roster on live TV`,
    body: `"They spent a lot of money to be where they are," he said on the pregame show. The clip is everywhere and your phone hasn't stopped.`,
    choices: [
      { label: 'Fire Back', hint: 'Fans +2 · Locker room +1 · Momentum +0.4 · Owner −1', run: () => { resolve(id('gm')); return fx({ fans: 2, locker: 1, momentum: 0.4, owner: -1 }); } },
      { label: 'Let the Game Answer', hint: 'Owner +1 · Locker room +1', run: () => { resolve(id('gm')); return fx({ owner: 1, locker: 1 }); } },
    ] });

  // Video-game ratings week.
  const snub = stars.filter(p => p.traits.ego >= 60)[r('vg') % Math.max(1, stars.filter(p => p.traits.ego >= 60).length)];
  if (snub && r('vg2') % 6 === 0) out.push({ id: `vg-${snub.id}-${L.season}`, kind: 'Social Media', scene: 'texts', p: snub, team: me, headline: `${snub.ln} is furious about his video game rating`,
    caller: `${snub.fn} ${snub.ln}`, texts: [`You see my rating??`, `Saw it. It's a game.`, `${snub.ovr - 6}. Disrespectful. I'm posting about it.`],
    body: `The new game rated ${snub.fn} ${snub.ln} well below what he thinks he is, and he wants the team to say something.`,
    choices: [
      { label: 'Back Him Publicly', hint: `${snub.ln} morale +5 · Fans +1`, run: () => { resolve(`vg-${snub.id}-${L.season}`); return fx({ players: [{ pid: snub.id, delta: 5 }], fans: 1 }); } },
      { label: 'Tell Him to Earn It', hint: `${snub.ln} morale −3 · Locker room +1`, run: () => { resolve(`vg-${snub.id}-${L.season}`); return fx({ players: [{ pid: snub.id, delta: -3 }], locker: 1 }); } },
    ] });

  // Ring of honor night at home.
  if (g && !away && r('roh') % 7 === 0) out.push({ id: `roh-${L.season}`, kind: 'Ceremony', scene: 'stadium', team: me, headline: `A franchise legend goes into the Ring of Honor this week`,
    body: `The ceremony can be a full halftime show with the old teammates on the field, or a short pregame moment so the players stay locked in.`,
    choices: [
      { label: 'Halftime Ceremony', hint: 'Fans +4 · Momentum +0.3 · Owner +1', run: () => { resolve(`roh-${L.season}`); return fx({ fans: 4, momentum: 0.3, owner: 1 }); } },
      { label: 'Pregame Only', hint: 'Fans +2', run: () => { resolve(`roh-${L.season}`); return fx({ fans: 2 }); } },
    ] });

  // The team plane is grounded.
  if (g && away && r('plane') % 6 === 0) out.push({ id: id('plane'), kind: 'Travel', scene: 'phone', caller: 'Team Travel Director', team: me, headline: 'The team plane is grounded with a mechanical problem',
    body: `The charter can't fly until tomorrow morning. A replacement aircraft is available tonight, at a price.`,
    choices: [
      { label: 'Charter a New Plane', hint: 'Facilities budget −$1.5M', run: () => { fund(-1.5); resolve(id('plane')); return 'Facilities budget −$1.5M'; } },
      { label: 'Fly in the Morning', hint: 'Everyone condition −5 · Momentum −0.3', run: () => { for (const p of roster) p.cond = Math.max(0, p.cond - 5); resolve(id('plane')); return fx({ momentum: -0.3 }); } },
    ] });

  // Throwback uniforms.
  if (r('tb') % 8 === 0) out.push({ id: `tb-${L.season}`, kind: 'Fans', scene: 'tv', team: me, headline: 'Fans are petitioning for the throwback uniforms',
    body: `A petition for the classic uniforms passed 100,000 signatures and the local news is running it every night.`,
    choices: [
      { label: 'Wear the Throwbacks', hint: 'Fans +3 · Owner +1', run: () => { resolve(`tb-${L.season}`); return fx({ fans: 3, owner: 1 }); } },
      { label: 'Not This Year', hint: 'Fans −1', run: () => { resolve(`tb-${L.season}`); return fx({ fans: -1 }); } },
    ] });

  // Sign stealing accusation.
  if (opp && r('signs') % 9 === 0) out.push({ id: id('signs'), kind: 'League Office', scene: 'phone', caller: 'League Office', team: opp, headline: `The ${opp.nick} accused your staff of stealing signals`,
    body: `The league wants to interview your coordinators this week. There is no evidence, but it is a distraction.`,
    choices: [
      { label: 'Cooperate Fully', hint: 'Owner +1 · Momentum −0.2', run: () => { resolve(id('signs')); return fx({ owner: 1, momentum: -0.2 }); } },
      { label: 'Call It Nonsense', hint: 'Fans +1 · Locker room +1 · Owner −1', run: () => { resolve(id('signs')); return fx({ fans: 1, locker: 1, owner: -1 }); } },
    ] });

  // A baby on the way.
  const dad = roster.filter(p => p.age >= 24 && !p.injury && p.ovr >= 72)[r('baby') % Math.max(1, roster.length)];
  if (dad && g && r('baby2') % 9 === 0) out.push({ id: `baby-${dad.id}-${L.season}`, kind: 'Personal', scene: 'texts', p: dad, team: me, caller: `${dad.fn} ${dad.ln}`, texts: [`Coach. Baby's coming. Doctors say Saturday or Sunday.`, `Congratulations! Go be with her.`, `I don't want to let the guys down.`],
    headline: `${dad.ln}'s baby is due on game day`,
    body: `${dad.fn} ${dad.ln} (${dad.pos} ${dad.ovr}) could miss the game if the baby comes on Sunday. He'll do whatever you ask.`,
    choices: [
      { label: 'Family Comes First', hint: `He misses the game · his morale +8 · Locker room +2`, run: () => { dad.injury = { type: 'Personal (family)', weeks: 1 }; resolve(`baby-${dad.id}-${L.season}`); return fx({ players: [{ pid: dad.id, delta: 8 }], locker: 2 }); } },
      { label: 'Fly Him Back After', hint: `He plays · his morale −6`, run: () => { resolve(`baby-${dad.id}-${L.season}`); return fx({ players: [{ pid: dad.id, delta: -6 }] }); } },
    ] });

  // The rookie dinner bill.
  const rook = roster.filter(p => p.exp === 0 && p.draft?.round === 1)[0];
  if (rook && L.week >= 3 && L.week <= 9 && r('dinner') % 4 === 0) out.push({ id: `dinner-${rook.id}`, kind: 'Locker Room', scene: 'locker', p: rook, team: me, headline: `The veterans stuck ${rook.ln} with a $48,000 dinner bill`,
    body: `It's a rookie tradition. ${rook.fn} ${rook.ln} paid it, but his agent called asking whether the team approves.`,
    choices: [
      { label: 'Tradition Stands', hint: `Locker room +2 · ${rook.ln} morale −2`, run: () => { resolve(`dinner-${rook.id}`); return fx({ locker: 2, players: [{ pid: rook.id, delta: -2 }] }); } },
      { label: 'Shut It Down', hint: `Locker room −1 · ${rook.ln} morale +3`, run: () => { resolve(`dinner-${rook.id}`); return fx({ locker: -1, players: [{ pid: rook.id, delta: 3 }] }); } },
    ] });

  return out;
}
