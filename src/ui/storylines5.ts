// Front-office situations played as conversations: an agent across the desk, a star who
// saw his name in a trade report, a leak to a national reporter, a free agent your scouts
// want in for a workout after an injury, captains with a problem in the room, and a quiet
// holdout threat. Each card says who you're meeting, what they say, what you can say back
// and how they take it; the choices move morale, the owner, the fans and the roster for real.
import type { ActionCard } from './actions';
import type { Kit } from './storylines';
import { hash } from '../core/rng';
import { userGame } from '../core/season';
import { apy, marketValue, money, yearsLeft } from '../core/contracts';
import { freeAgents } from '../core/freeagency';
import { holdoutOf } from '../core/holdout';

const AGENT_FIRST = ['Drew', 'Malik', 'Joel', 'Sasha', 'Ron', 'Erin', 'Victor', 'Dana'];
const AGENT_LAST = ['Rosen', 'Fennell', 'Batista', 'Okoye', 'Lindqvist', 'Mercer', 'Haddad', 'Pryce'];
const REPORTERS = ['Adam Pell', 'Ian Rapaport-Hill', 'Dianna Russo', 'Tom Pelissier', 'Jordan Shefter'];

export function storylines5(k: Kit): ActionCard[] {
  const { L, me, roster, hc, gm, wk, fx, resolve } = k;
  const out: ActionCard[] = [];
  if (L.phase !== 'regular') return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0) % 100;
  const id = (key: string) => `${key}-${wk}`;
  const g = userGame(L);
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const others = Object.values(L.teams).filter(t => t.abbr !== L.user);
  const agentOf = (pid: string) => { const h = hash(pid) >>> 0; return `${AGENT_FIRST[h % 8]} ${AGENT_LAST[(h >>> 4) % 8]}`; };
  const reporter = REPORTERS[(hash(wk) >>> 0) % REPORTERS.length];

  // The agent meeting: a contract-year starter's agent comes in with a number.
  const cy = roster.filter(p => yearsLeft(p.contract, L.season) === 1 && p.ovr >= 76 && !p.contract.tag && !holdoutOf(p)).sort((a, b) => b.ovr - a.ovr)[0];
  if (cy && r('agent') < 40) {
    const agent = agentOf(cy.id), ask = marketValue(cy, L.season) * 1.08;
    const cid = `agent-${cy.id}-${L.season}`;
    out.push({ id: cid, kind: 'Agent Meeting', scene: 'office', p: cy, team: me, feature: true, speaker: `${agent} · ${cy.ln}'s agent`, where: 'Your office · Tuesday, 9:40 AM',
      headline: `${cy.ln}'s agent wants a number by Friday`,
      body: `${agent} flew in to talk about ${cy.fn} ${cy.ln} (${cy.pos} ${cy.ovr}), in the last year of his deal at ${money(apy(cy.contract))} a year.`,
      lines: [`I'll be straight with you. ${cy.fn} loves it here, but he's watched guys with worse tape get paid.`, `We're at ${money(ask)} a year. That's the number. I'd like an answer before the trade deadline noise starts.`],
      choices: [
        { label: 'Open talks now', reply: `Let's sit down and get it done.`, react: `Good. I'll have numbers on your desk tonight.`, run: o => { resolve(cid); o.negotiate(cy); } },
        { label: 'After the season', hint: `${cy.ln} morale −5`, reply: `We love him too. We'll handle it in the spring.`, react: `Then the market sets his price in March. I hope you've budgeted for that.`, run: () => { resolve(cid); return fx({ players: [{ pid: cy.id, delta: -5 }] }); } },
        { label: 'Mention the tag', hint: `${cy.ln} morale −9 · Locker room −1`, reply: `If it comes to it, we have the franchise tag.`, react: `You just told my client you'd rather rent him. He'll hear exactly that.`, run: () => { resolve(cid); return fx({ locker: -1, players: [{ pid: cy.id, delta: -9 }] }); } },
      ],
      delegate: { who: gm, role: 'GM', quote: `I'll take the meeting and keep it friendly. No promises.`, run: () => resolve(cid) } });
  }

  // A trade report: his name is out there; he wants to hear it from you.
  const rumored = roster.filter(p => p.ovr >= 78 && !p.injury).sort((a, b) => (hash(`${wk}${a.id}`) >>> 0) - (hash(`${wk}${b.id}`) >>> 0))[0];
  const suitor = others[(hash(`${wk}-suitor`) >>> 0) % others.length];
  if (rumored && suitor && L.week >= 3 && r('rumor5') < 26) {
    const cid = id(`tr-${rumored.id}`);
    out.push({ id: cid, kind: 'Trade Rumor', scene: 'texts', p: rumored, team: suitor, caller: `${rumored.fn} ${rumored.ln}`, where: `Report from ${reporter}`,
      texts: [`${reporter}: Sources say the ${suitor.nick} have called the ${me.nick} about ${rumored.pos} ${rumored.fn} ${rumored.ln}.`, `coach is this real??`, `my phone hasn't stopped`],
      headline: `Report: the ${suitor.nick} called about ${rumored.ln}`,
      body: `${reporter} reported the ${suitor.name} asked about ${rumored.fn} ${rumored.ln}. He wants to hear it from you before practice.`,
      lines: [`Coach, I've got my family texting me. Am I getting moved?`],
      choices: [
        { label: `He's not going anywhere`, hint: `${rumored.ln} morale +6 · Locker room +1`, reply: `You're a big part of what we're building. You're not going anywhere.`, react: `That's all I needed to hear. I'm locked in.`, run: () => { resolve(cid); return fx({ locker: 1, players: [{ pid: rumored.id, delta: 6 }] }); } },
        { label: 'Hear the offer', hint: `Opens trade talks with the ${suitor.nick} · ${rumored.ln} morale −4`, reply: `Teams call. It's my job to listen.`, react: `Yeah. I get it. Business.`, run: o => { resolve(cid); fx({ players: [{ pid: rumored.id, delta: -4 }] }); o.go('trade', { team: suitor.abbr }); } },
        { label: 'No comment', hint: `${rumored.ln} morale −2 · Fans −1`, reply: `I don't talk about rumors. Go have a good practice.`, react: `...Okay. Sure.`, run: () => { resolve(cid); return fx({ fans: -1, players: [{ pid: rumored.id, delta: -2 }] }); } },
      ] });
  }

  // A leak: someone in the building is talking to a national reporter.
  const lastLoss = L.games.filter(x => x.result && x.season === L.season && (x.home === L.user || x.away === L.user)).slice(-1)[0];
  const lost = lastLoss && (lastLoss.home === L.user ? lastLoss.result!.hs < lastLoss.result!.as : lastLoss.result!.as < lastLoss.result!.hs);
  if (lost && r('leak') < 30) {
    const cid = id('leak');
    out.push({ id: cid, kind: 'Locker Room Leak', scene: 'tv', team: me, speaker: reporter, where: 'National pregame show · Sunday morning',
      headline: `A source in your locker room is talking to ${reporter}`,
      body: `An anonymous ${me.nick} player told ${reporter} the game plan is "predictable" and the staff "doesn't listen."`,
      lines: [`Multiple players are frustrated. One told me, quote, "everybody in the league knows what we're running on third down."`, `${hc} has some work to do in that room.`],
      choices: [
        { label: 'Find the source', hint: 'Owner +2 · Locker room −3', reply: `Somebody broke the code. We'll find out who.`, react: `The room goes quiet. Nobody makes eye contact at lunch.`, run: () => { resolve(cid); return fx({ owner: 2, locker: -3 }); } },
        { label: 'Address it as a team', hint: 'Locker room +2 · Momentum +0.2', reply: `If you've got a problem with the plan, my door's open. Say it to me, not to TV.`, react: `Two veterans stop by your office that afternoon. The air clears.`, run: () => { resolve(cid); return fx({ locker: 2, momentum: 0.2 }); } },
        { label: 'Ignore it', hint: 'Fans −2 · Momentum −0.2', reply: `I'm not wasting a week on anonymous quotes.`, react: `The story runs on every show through Wednesday.`, run: () => { resolve(cid); return fx({ fans: -2, momentum: -0.2 }); } },
      ] });
  }

  // A workout: a starter just went down, and the scouts like someone on the street.
  const hurt = roster.filter(p => p.injury && p.ovr >= 72).sort((a, b) => b.ovr - a.ovr)[0];
  const street = hurt ? freeAgents(L).filter(p => p.pos === hurt.pos && !p.injury).sort((a, b) => b.ovr - a.ovr)[0] : undefined;
  if (hurt && street && r('workout') < 55) {
    const cid = `workout-${street.id}-${L.season}`;
    out.push({ id: cid, kind: 'Free-Agent Workout', scene: 'field', p: street, team: me, speaker: `Director of pro scouting`, where: 'Practice field · Tuesday workout',
      headline: `Bring ${street.ln} in for a workout?`,
      body: `With ${hurt.ln} out, your pro scouts want to work out free agent ${street.pos} ${street.fn} ${street.ln} (${street.ovr} OVR, age ${street.age}).`,
      lines: [`${hurt.ln}'s going to miss time. ${street.fn} ${street.ln} is the best ${street.pos} on the street and he's in shape.`, `He'd want a one-year deal. I'd move fast; two other teams have him in this week.`],
      choices: [
        { label: 'Sign him', hint: 'Opens free agency', reply: `Get him a physical. If he passes, sign him.`, react: `On it. I'll have his agent on the phone in ten minutes.`, run: o => { resolve(cid); o.go('fa'); } },
        { label: 'Trust the depth', hint: 'Locker room +1', reply: `Our next man up has earned the shot.`, react: `Fair enough. The guys will like hearing that.`, run: () => { resolve(cid); return fx({ locker: 1 }); } },
      ],
      delegate: { who: gm, role: 'GM', quote: `I'll keep him on the emergency list and call if anything changes.`, run: () => resolve(cid) } });
  }

  // Captains in your office: the young players are coasting.
  const capt = roster.filter(p => p.age >= 29 && p.ovr >= 78).sort((a, b) => b.ovr - a.ovr)[0];
  if (capt && L.week >= 4 && r('captains') < 24) {
    const cid = id('captains');
    out.push({ id: cid, kind: 'Captains Meeting', scene: 'meeting', p: capt, team: me, where: 'Team meeting room · Wednesday',
      headline: `${capt.ln} and the captains have a problem with the young guys`,
      body: `${capt.fn} ${capt.ln} brought the captains in. They say some of the young players are coasting through walkthroughs.`,
      lines: [`Coach, I'm not naming names. But guys are on their phones in walkthroughs and it's showing up on Sundays.`, `We can handle it in the room, or you can. Your call.`],
      choices: [
        { label: 'Let the captains handle it', hint: 'Locker room +3', reply: `It means more coming from you. Handle it your way.`, react: `We will. You'll see a different group Thursday.`, run: () => { resolve(cid); return fx({ locker: 3 }); } },
        { label: 'Full-pads Thursday', hint: 'Momentum +0.3 · Locker room −1', reply: `Thursday's in full pads. They'll get the message.`, react: `That'll do it. Some of them won't like it.`, run: () => { resolve(cid); return fx({ momentum: 0.3, locker: -1 }); } },
        { label: 'Call it out on film', hint: `Momentum +0.2 · ${capt.ln} morale +3 · young players morale −3`, reply: `I'll put it on the screen in front of everybody.`, react: `Good. Nobody wants to be on that tape twice.`, run: () => { resolve(cid); const kids = roster.filter(p => p.age <= 24).slice(0, 6); return fx({ momentum: 0.2, players: [{ pid: capt.id, delta: 3 }, ...kids.map(p => ({ pid: p.id, delta: -3 }))] }); } },
      ] });
  }

  // A holdout threat: an underpaid starter with years left wants a new deal now.
  const under = roster.filter(p => p.ovr >= 82 && yearsLeft(p.contract, L.season) >= 2 && apy(p.contract) < marketValue(p, L.season) * 0.6 && !holdoutOf(p)).sort((a, b) => b.ovr - a.ovr)[0];
  if (under && r('threat') < 22) {
    const agent = agentOf(under.id), cid = `threat-${under.id}-${L.season}`;
    out.push({ id: cid, kind: 'Holdout Threat', scene: 'phone', caller: `${agent} (agent)`, p: under, team: me, speaker: `${agent} · agent`, where: 'Phone call · late Monday night',
      headline: `${under.ln}'s camp is floating a holdout`,
      body: `${under.fn} ${under.ln} (${under.pos} ${under.ovr}) makes ${money(apy(under.contract))} a year with ${yearsLeft(under.contract, L.season)} years left. The market says ${money(marketValue(under, L.season))}.`,
      lines: [`I'm calling as a courtesy. He's the most underpaid ${under.pos} in football and everybody knows it.`, `He'll play this year. Next year, I can't promise he walks into camp without a new deal.`],
      choices: [
        { label: 'Talk extension', reply: `Send me a proposal. We want him here long term.`, react: `That's the right answer. We'll be reasonable.`, run: o => { resolve(cid); o.negotiate(under); } },
        { label: 'He signed the deal', hint: `${under.ln} morale −7 · Owner +1`, reply: `He signed that contract. We expect him to honor it.`, react: `Then we'll talk again in July. It'll be a different conversation.`, run: () => { resolve(cid); return fx({ owner: 1, players: [{ pid: under.id, delta: -7 }] }); } },
      ] });
  }

  // The opponent's coordinator: a rival scout tipped off that they're changing their plan.
  if (opp && L.week >= 2 && r('intel') < 18) {
    const cid = id('intel');
    out.push({ id: cid, kind: 'Rumor', scene: 'phone', caller: 'Assistant coach, ex-' + opp.nick, team: opp, speaker: `A former ${opp.nick} assistant`, where: 'Phone call · Tuesday night',
      headline: `A former ${opp.nick} coach says they're changing their whole plan`,
      body: `A coach who used to work for the ${opp.name} called. He says they're installing a new look just for you.`,
      lines: [`You didn't hear this from me. They've been practicing an empty package all week, five wide.`, `Could be smoke. They know I know people.`],
      choices: [
        { label: 'Prepare for it', hint: 'Momentum +0.4 if it\'s real · −0.2 if it\'s smoke', reply: `We'll get a dime look ready.`, react: `Can't hurt to be ready.`, run: () => { resolve(cid); return fx({ momentum: r('intelreal') < 55 ? 0.4 : -0.2 }); } },
        { label: 'Stick to the plan', reply: `We play our game.`, react: `Suit yourself.`, run: () => { resolve(cid); return 'You stick to the plan'; } },
      ] });
  }
  return out;
}
