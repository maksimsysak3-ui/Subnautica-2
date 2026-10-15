// More of the building's week, each in the medium it arrives in: a league fine for a hit
// (an email from the league office), the owner's memo after a losing stretch, a
// tampering inquiry, a player texting about the contract incentive he's chasing, an
// opponent calling out your player on social media, and a former player ripping the
// team on national TV. The effects are the usual levers (morale, the room, the owner,
// the fans, momentum) and nothing more than the card says.
import type { ActionCard } from './actions';
import type { Kit } from './storylines';
import { hash } from '../core/rng';
import { userGame, standings } from '../core/season';

export function storylines6(k: Kit): ActionCard[] {
  const { L, me, roster, hc, wk, fx, resolve } = k;
  const out: ActionCard[] = [];
  if (L.phase !== 'regular') return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0) % 100;
  const id = (key: string) => `${key}-${wk}`;
  const g = userGame(L);
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const st = standings(L)[L.user];
  const pick = <T,>(xs: T[], key: string) => xs[(hash(`${wk}-${key}`) >>> 0) % Math.max(1, xs.length)];

  // A fine for a hit: the league's letter, and what you do about it.
  const hitter = pick(roster.filter(p => ['S', 'LB', 'CB', 'EDGE'].includes(p.pos) && p.ovr >= 70 && !p.injury), 'hitter');
  if (hitter && L.week >= 2 && r('hitfine') < 22) {
    const amt = 25 + (hash(`${wk}${hitter.id}`) % 4) * 15, cid = id(`hitfine-${hitter.id}`);
    out.push({ id: cid, kind: 'League Discipline', team: me, p: hitter, speaker: 'NFL Football Operations', where: 'Email · Wednesday 4:02 PM',
      headline: `The league fined ${hitter.ln} $${amt},000 for a hit`,
      body: `${hitter.fn} ${hitter.ln} was fined $${amt},000 for a hit on a defenseless receiver. He can appeal.`,
      lines: [`This letter serves as notice that ${hitter.fn} ${hitter.ln} has been fined $${amt},000 for unnecessary roughness (Rule 12, Section 2) on a defenseless player.`, `The club may file an appeal within three business days. Video of the play is attached.`],
      choices: [
        { label: 'Back his appeal', hint: `${hitter.ln} morale +4 · Fans +1`, reply: `We'll be appealing. Our player hit him shoulder to chest and within the rules.`, react: `Your appeal has been received and assigned a hearing officer.`, run: () => { resolve(cid); return fx({ fans: 1, players: [{ pid: hitter.id, delta: 4 }] }); } },
        { label: 'Cover the fine', hint: `${hitter.ln} morale +6 · Owner −2`, reply: `The club will take care of it.`, react: `Noted. Clubs may not reimburse fines; this has been forwarded to compliance.`, run: () => { resolve(cid); return fx({ owner: -2, players: [{ pid: hitter.id, delta: 6 }] }); } },
        { label: 'Tell him to clean it up', hint: `${hitter.ln} morale −3 · Owner +1`, reply: `No appeal. We'll address it internally.`, react: `Thank you for your cooperation.`, run: () => { resolve(cid); return fx({ owner: 1, players: [{ pid: hitter.id, delta: -3 }] }); } },
      ] });
  }

  // The owner's memo after a losing stretch.
  if (st && st.l >= st.w + 2 && L.week >= 5 && r('memo') < 35) {
    const cid = id('memo');
    out.push({ id: cid, kind: 'Owner Memo', team: me, speaker: 'Office of the Owner', where: 'Email · Monday 6:30 AM',
      headline: `The owner sent a memo: "We need to talk about where this is going"`,
      body: `You're ${st.w}-${st.l}. Season-ticket renewals are down and the owner wants to know what changes.`,
      lines: [`I've been patient. ${st.w}-${st.l} isn't what we sold our season-ticket holders.`, `Renewals are down eleven percent. I want to hear what changes, and I want to hear it this week.`],
      choices: [
        { label: 'Promise changes', hint: 'Owner +3 · Locker room −2', reply: `You'll see changes this week, starting with practice.`, react: `Good. I'll be at practice Thursday.`, run: () => { resolve(cid); return fx({ owner: 3, locker: -2 }); } },
        { label: 'Defend the process', hint: 'Owner −2 · Locker room +2', reply: `This group is closer than the record says. I'm asking you to trust it.`, react: `I'll give it time. Not a lot of it.`, run: () => { resolve(cid); return fx({ owner: -2, locker: 2 }); } },
        { label: 'Ask for a meeting', hint: 'Owner +1', reply: `I'd rather walk you through it in person. Tomorrow?`, react: `My office, 8 AM.`, run: () => { resolve(cid); return fx({ owner: 1 }); } },
      ] });
  }

  // A tampering inquiry: somebody saw your staff talking to a player under contract.
  if (L.week >= 6 && r('tamper') < 10) {
    const cid = id('tamper');
    out.push({ id: cid, kind: 'League Office', team: me, speaker: 'League office · investigations', where: 'Email · Thursday 11:18 AM',
      headline: 'The league is asking about a conversation your staff had',
      body: `A rival club reported that a member of your staff spoke to one of their players about next season.`,
      lines: [`We are reviewing a report that a member of your football staff discussed future employment with a player under contract to another club.`, `Please provide a written account and any related communications by Friday.`],
      choices: [
        { label: 'Cooperate fully', hint: 'Owner −1', reply: `We'll cooperate fully and send everything we have.`, react: `Thank you. We expect to close this quickly.`, run: () => { resolve(cid); return fx({ owner: -1 }); } },
        { label: 'Deny it', hint: 'Owner +1 now · risk of a bigger story', reply: `Nothing improper happened. It was a hello at a charity event.`, react: `We'll note your response. The review remains open.`, run: () => { resolve(cid); return fx({ owner: 1, momentum: r('tamperbad') < 40 ? -0.3 : 0 }); } },
      ] });
  }

  // A player chasing an incentive texts you late in the season.
  const chaser = pick(roster.filter(p => ['WR', 'TE', 'RB'].includes(p.pos) && p.ovr >= 74), 'chaser');
  if (chaser && L.week >= 13 && r('incent') < 25) {
    const cid = `incent-${chaser.id}-${L.season}`;
    out.push({ id: cid, kind: 'Contract Incentive', scene: 'texts', team: me, p: chaser, caller: `${chaser.fn} ${chaser.ln}`,
      headline: `${chaser.ln} is close to a contract incentive`,
      body: `${chaser.fn} ${chaser.ln} is a handful of catches from a $500,000 incentive with a few games left.`,
      lines: [`coach can I be honest with you`, `I'm 6 catches from my incentive. that's real money for my family`, `not asking for anything crazy. just don't forget about me`],
      choices: [
        { label: 'Get him the ball', hint: `${chaser.ln} morale +6 · Locker room −1`, reply: `We'll get you some looks. Earn it.`, react: `appreciate you coach 🙏`, run: () => { resolve(cid); return fx({ locker: -1, players: [{ pid: chaser.id, delta: 6 }] }); } },
        { label: 'The plan comes first', hint: `${chaser.ln} morale −4 · Locker room +1`, reply: `The ball goes where the defense tells it. You know that.`, react: `ok. understood`, run: () => { resolve(cid); return fx({ locker: 1, players: [{ pid: chaser.id, delta: -4 }] }); } },
      ] });
  }

  // An opponent calls out your player online.
  const target = pick(roster.filter(p => p.ovr >= 80 && !p.injury), 'target');
  if (opp && target && r('trash') < 26) {
    const cid = id('trash');
    const talker = `${opp.nick.toLowerCase()}${(hash(opp.abbr) % 90) + 10}`;
    out.push({ id: cid, kind: 'Social Media', team: opp, p: target, speaker: 'Your PR director', where: 'Social media · Tuesday night',
      post: { handle: `@${talker}`, name: `${opp.name} player`, text: `${target.ln} is the most overrated ${target.pos} in the league and Sunday I'm going to show everybody. Book it. 🔒` },
      headline: `A ${opp.nick} player called ${target.ln} overrated online`,
      body: `A ${opp.name} player went after ${target.fn} ${target.ln} on social media. It's everywhere.`,
      lines: [`It's got a million views. ${target.ln} wants to respond.`, `How do we play it?`],
      choices: [
        { label: 'Bulletin board', hint: 'Momentum +0.3 · Locker room +1', reply: `Print it. Put it on every locker. Nobody says a word.`, react: `Love it. Quiet and mean.`, run: () => { resolve(cid); return fx({ momentum: 0.3, locker: 1 }); } },
        { label: `Let ${target.ln} fire back`, hint: `Fans +2 · ${target.ln} morale +3 · Momentum −0.1`, reply: `Let him have some fun with it. Keep it clean.`, react: `Oh, he will.`, run: () => { resolve(cid); return fx({ fans: 2, momentum: -0.1, players: [{ pid: target.id, delta: 3 }] }); } },
        { label: 'Ignore it', reply: `We don't respond to that.`, react: `Copy. Radio silence.`, run: () => { resolve(cid); return 'Nobody says a word'; } },
      ] });
  }

  // A former player rips the team on national TV.
  if (st && st.l >= 3 && r('excritic') < 22) {
    const cid = id('excritic');
    out.push({ id: cid, kind: 'Media', scene: 'tv', team: me, speaker: 'Former player, now an analyst', where: 'National pregame show',
      headline: `A former ${me.nick} star ripped the team on national TV`,
      body: `A franchise great, now an analyst, says the team has "no identity" and questions ${hc}.`,
      lines: [`I love this franchise. That's why I'm saying it: there's no identity. I don't know what they want to be.`, `And at some point you have to look at the head coach.`],
      choices: [
        { label: 'Fire back', hint: 'Fans +2 · Owner −1', reply: `He's welcome to come watch practice. He'd see the identity.`, react: `The clip runs on every show for two days.`, run: () => { resolve(cid); return fx({ fans: 2, owner: -1 }); } },
        { label: 'High road', hint: 'Owner +1', reply: `He's earned the right to his opinion. We'll answer on Sunday.`, react: `Measured. The story dies by Wednesday.`, run: () => { resolve(cid); return fx({ owner: 1 }); } },
        { label: 'Invite him in', hint: 'Fans +1 · Locker room +1', reply: `Come talk to the team. They'd love to hear from you.`, react: `He shows up Thursday. The players eat it up.`, run: () => { resolve(cid); return fx({ fans: 1, locker: 1 }); } },
      ] });
  }
  return out;
}
