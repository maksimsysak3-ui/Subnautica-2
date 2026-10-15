// Weekly moments you play instead of pick: the podium after a loss, the trade-deadline
// grilling, the hype show after a win streak (hot seat); the Monday speech after a beating and
// the star receiver who wants the ball (speech); the stadium naming-rights deal, a veteran's
// pay cut and a star's shoe deal (tug of war). The effects stay the usual levers.
import type { ActionCard } from './actions';
import type { Kit } from './storylines';
import { hash } from '../core/rng';
import { capHit } from '../core/contracts';
import { standings } from '../core/season';
import { roomOf } from './screens/weeklygames';

export function storylines7(k: Kit): ActionCard[] {
  const { L, me, roster, hc, wk, fx, resolve } = k;
  const out: ActionCard[] = [];
  if (L.phase !== 'regular') return out;
  const r = (key: string) => (hash(`${L.seed}-${wk}-${key}`) >>> 0) % 100;
  const id = (key: string) => `${key}-${wk}`;
  const st = standings(L)[L.user];
  const last = L.games.filter(g => g.result && g.season === L.season && (g.home === L.user || g.away === L.user)).sort((a, b) => b.week - a.week)[0];
  const margin = last ? (last.home === L.user ? last.result!.hs - last.result!.as : last.result!.as - last.result!.hs) : 0;
  const lastOpp = last ? L.teams[last.home === L.user ? last.away : last.home] : undefined;
  const qb = roster.filter(p => p.pos === 'QB').sort((a, b) => b.ovr - a.ovr)[0];
  const room = roomOf(roster);
  // Win/loss streak from the most recent games.
  const recent = L.games.filter(g => g.result && g.season === L.season && (g.home === L.user || g.away === L.user)).sort((a, b) => b.week - a.week);
  const won = (g: typeof recent[number]) => (g.home === L.user ? g.result!.hs > g.result!.as : g.result!.as > g.result!.hs);
  let streak = 0; for (const g of recent) { if (recent[0] && won(g) === won(recent[0])) streak++; else break; }
  const winning = recent[0] ? won(recent[0]) : false;

  // 1. The podium after a loss (hot seat).
  if (last && margin < 0 && lastOpp && r('podium') < 45) {
    const cid = id('podium');
    out.push({ id: cid, kind: 'Media', team: me, feature: true, where: 'Media room · Monday', speaker: 'Beat reporters',
      headline: `The podium after losing to the ${lastOpp.nick}`,
      body: `A ${-margin}-point loss. The beat writers have their questions ready, and the clips will run all week.`,
      game: { kind: 'hotseat', stumble: 1, qs: [
        { who: 'Local TV', q: `${qb ? `Is ${qb.ln} still your guy after that?` : 'Is your quarterback still your guy after that?'}`, a: ['He is our quarterback. Period.', 'We evaluate everyone every week.', 'Ask me something about the other 52 guys.'] },
        { who: 'The Athletic', q: `Your defense gave up chunk plays all day. Is that scheme or personnel?`, a: ['That one is on me and the staff.', "It's a little of both. We'll look at the tape.", "Our guys played hard. Next question."] },
        { who: 'Radio', q: `Fans were booing in the fourth quarter. Do you hear that?`, a: ["They've earned the right to be frustrated. We'll fix it.", "I'm focused on what we control.", "They'll be cheering soon enough. Write that down."] },
      ] },
      choices: [
        { label: 'Back your guys', hint: 'Locker room +3 · Fans −1', reply: 'This team is better than that, and I believe in every man in that room.', react: 'The players saw it. Several of them reposted the clip.', run: () => { resolve(cid); return fx({ locker: 3, fans: -1 }); } },
        { label: 'Play it straight', hint: 'Owner +1', reply: "We'll watch the tape, fix it, and move on.", react: 'Nothing for the talk shows to chew on. The owner liked that.', run: () => { resolve(cid); return fx({ owner: 1 }); } },
        { label: 'Fire back', hint: 'Momentum +1 · Fans +2 · Owner −2', reply: "Write whatever you want. We'll see you Sunday.", react: "It went viral. The fans loved it. The owner's office called.", run: () => { resolve(cid); return fx({ momentum: 1, fans: 2, owner: -2 }); } },
      ] });
  }

  // 2. Trade-deadline grilling (hot seat).
  if (L.week >= Math.max(5, L.tradeDeadlineWeek - 2) && L.week <= L.tradeDeadlineWeek && st && r('ddl') < 40) {
    const cid = id('ddl'), sell = st.l > st.w;
    out.push({ id: cid, kind: 'Media', team: me, where: 'Press conference · Wednesday', speaker: 'National insiders',
      headline: sell ? 'Insiders want to know: are you sellers?' : 'Insiders want to know: are you buying?',
      body: `You're ${st.w}-${st.l} with the trade deadline days away. Every answer will be read as a signal by 31 other front offices.`,
      game: { kind: 'hotseat', stumble: 1, qs: [
        { who: 'NFL Network', q: sell ? 'Would you move a veteran for a pick?' : 'Are you looking to add a piece for a playoff run?', a: ["We're always looking to get better. Always.", "We don't comment on trade talks.", sell ? "Nobody's going anywhere." : "We like the guys we have."] },
        { who: 'ESPN', q: `Teams say you've been calling about a pass rusher. True?`, a: ["I make a lot of calls. That's the job.", "I'm not going to get into that.", "Whoever told you that is wrong."] },
      ] },
      choices: [
        { label: 'Open for business', hint: 'Owner +2 · Locker room −2', reply: "If it makes us better, we'll do it.", react: 'Your phone started ringing before you left the podium.', run: () => { resolve(cid); return fx({ owner: 2, locker: -2 }); } },
        { label: 'Poker face', hint: 'No change', reply: "We don't talk about other teams' players or our own.", react: 'The insiders shrugged. Nothing to report.', run: () => { resolve(cid); return 'No change'; } },
        { label: 'Back the room', hint: 'Locker room +3 · Owner −1', reply: "I believe in this group. That's my answer.", react: 'Your captains texted you thank-yous.', run: () => { resolve(cid); return fx({ locker: 3, owner: -1 }); } },
      ] });
  }

  // 3. The hype show after a win streak (hot seat).
  if (winning && streak >= 3 && r('hype') < 45) {
    const cid = id('hype');
    out.push({ id: cid, kind: 'Media', team: me, where: 'National radio · live', speaker: 'Sports talk host',
      headline: `${streak} straight wins: national radio wants you live`,
      body: `The hottest team in the league gets the morning show. The host wants a headline.`,
      game: { kind: 'hotseat', stumble: 1, qs: [
        { who: 'Host', q: 'Best team in football right now. Say it.', a: ["We're the best team in football. Say it with me.", "We're playing good football. That's all I'll say.", "Nobody in our building is talking like that."] },
        { who: 'Host', q: `Super Bowl or bust?`, a: ["Anything less would be a disappointment.", "One week at a time.", "Ask me in January."] },
      ] },
      choices: [
        { label: 'Embrace it', hint: 'Fans +3 · Momentum +1 · Locker room −1', reply: "Yeah, we're coming for it all.", react: 'Bulletin-board material for every opponent. Your fans are ecstatic.', run: () => { resolve(cid); return fx({ fans: 3, momentum: 1, locker: -1 }); } },
        { label: 'One week at a time', hint: 'Locker room +2', reply: 'Next game is the only game.', react: 'The host groaned. Your veterans nodded.', run: () => { resolve(cid); return fx({ locker: 2 }); } },
        { label: 'Downplay it', hint: 'Owner +1 · Fans −1', reply: "We haven't done anything yet.", react: 'Boring radio, smart football.', run: () => { resolve(cid); return fx({ owner: 1, fans: -1 }); } },
      ] });
  }

  // 4. Monday speech after a beating (speech: calm → fiery).
  if (last && margin <= -14 && room.length >= 4 && r('speech') < 60) {
    const cid = id('speech');
    out.push({ id: cid, kind: 'Team Meeting', team: me, feature: true, where: 'Team meeting room · Monday 8:00 AM',
      headline: `After a ${-margin}-point loss, the room is waiting on you`,
      body: `${hc} hands you the floor. Fifty-three guys, heads down. How you pitch it matters more than what you say.`,
      game: { kind: 'speech', faces: room },
      choices: [
        { label: 'Calm and steady', hint: 'Locker room +3', reply: 'One game. We learn from it and we move on together.', react: 'Shoulders came down. The vets took it from there.', run: () => { resolve(cid); return fx({ locker: 3 }); } },
        { label: 'Hold them accountable', hint: 'Locker room +1 · Momentum +1', reply: "That wasn't us, and every one of us owns a piece of it.", react: 'Quiet room. Then a few guys stood up and said their piece.', run: () => { resolve(cid); return fx({ locker: 1, momentum: 1 }); } },
        { label: 'Blow the roof off', hint: 'Momentum +2 · Locker room −2', reply: "That was embarrassing. If you don't want to be here, there's the door.", react: 'Chairs scraped. Practice was the most physical of the year.', run: () => { resolve(cid); return fx({ momentum: 2, locker: -2 }); } },
      ] });
  }

  // 5. The star receiver wants the ball (speech).
  const wr = roster.filter(p => p.pos === 'WR' && p.ovr >= 82).sort((a, b) => b.ovr - a.ovr)[0];
  if (wr && last && margin < 0 && L.week >= 3 && r('wrball') < 30) {
    const cid = id(`wrball-${wr.id}`);
    out.push({ id: cid, kind: 'Locker Room', team: me, p: wr, where: 'Sideline · last Sunday', speaker: `${wr.fn} ${wr.ln}`,
      headline: `${wr.ln} was yelling on the sideline: "Get me the ball"`,
      body: `The cameras caught ${wr.fn} ${wr.ln} screaming at the offensive staff in the fourth quarter. He's in your office now.`,
      game: { kind: 'speech', faces: [wr, ...room.filter(p => p.id !== wr.id).slice(0, 3)] },
      choices: [
        { label: 'Hear him out', hint: `${wr.ln} morale +6 · Locker room −1`, reply: "I hear you. We'll get you more looks.", react: `${wr.ln} left smiling. A few teammates noticed the special treatment.`, run: () => { resolve(cid); return fx({ locker: -1, players: [{ pid: wr.id, delta: 6 }] }); } },
        { label: 'Set the line', hint: `${wr.ln} morale −2 · Locker room +2`, reply: 'Take it up with me, not on TV.', react: 'He nodded and apologized to the coordinator.', run: () => { resolve(cid); return fx({ locker: 2, players: [{ pid: wr.id, delta: -2 }] }); } },
        { label: 'Bench him a series', hint: `${wr.ln} morale −6 · Locker room +3 · Owner +1`, reply: "You sit the first series Sunday. Nobody's bigger than the team.", react: "He was furious. The rest of the room wasn't.", run: () => { resolve(cid); return fx({ locker: 3, owner: 1, players: [{ pid: wr.id, delta: -6 }] }); } },
      ] });
  }

  // 6. Stadium naming rights (tug: your terms → theirs).
  if (L.week >= 4 && r('naming') < 14) {
    const cid = id('naming');
    const brands = ['Apex Freight', 'Northwind Bank', 'Ridgeline Energy', 'Summit Mobile', 'Harbor Insurance'];
    const brand = brands[(hash(L.seed + 'brand') >>> 0) % brands.length];
    out.push({ id: cid, kind: 'Business', team: me, where: 'Owner\'s suite · Thursday', speaker: `${brand} executives`,
      headline: `${brand} wants its name on the stadium`,
      body: `A 15-year naming-rights deal. The owner wants it done, and wants it done well.`,
      game: { kind: 'tug', them: brand, rounds: 4, patience: 3, walk: "We're done here. We'll take this to another market.",
        lines: { push: "That's more than we budgeted. Let me make a call.", strain: "You're testing us. We have other options.", hold: "We can live with that.", give: "Now we're talking. Let's keep going." } },
      choices: [
        { label: 'Record deal', hint: 'Owner +4', reply: 'Fifteen years, top of the market.', react: "The owner called it the best deal in franchise history.", run: () => { resolve(cid); return fx({ owner: 4 }); } },
        { label: 'Fair deal', hint: 'Owner +2', reply: 'Fair money, a good partner.', react: 'Signed by Friday.', run: () => { resolve(cid); return fx({ owner: 2 }); } },
        { label: 'Their terms', hint: 'Owner −1 · Fans +1', reply: 'We left money on the table.', react: 'The fans liked that the old name stays on the tunnel. The owner did not.', run: () => { resolve(cid); return fx({ owner: -1, fans: 1 }); } },
      ] });
  }

  // 7. Veteran pay cut (tug).
  const vet = roster.filter(p => p.age >= 31 && capHit(p.contract, L.season) > 12e6 && p.ovr < 82).sort((a, b) => capHit(b.contract, L.season) - capHit(a.contract, L.season))[0];
  if (vet && L.week >= 2 && r('paycut') < 22) {
    const cid = id(`paycut-${vet.id}`);
    out.push({ id: cid, kind: 'Front Office', team: me, p: vet, where: 'Your office · Tuesday', speaker: `${vet.fn} ${vet.ln}'s agent`,
      headline: `Asking ${vet.ln} to take a pay cut`,
      body: `${vet.fn} ${vet.ln} is 31+, playing like a ${vet.ovr}, and carrying a big cap number. His agent is on the line.`,
      game: { kind: 'tug', them: 'His agent', rounds: 4, patience: 2, walk: "Then cut him. He'll sign somewhere that respects him.",
        lines: { push: "That's a big ask for a veteran who's given you everything.", strain: "You're pushing a proud man out the door.", hold: "We can discuss it.", give: "Okay. That's more reasonable." } },
      choices: [
        { label: 'He takes the cut', hint: `Owner +3 · ${vet.ln} morale −6`, reply: 'He takes the cut.', react: 'He signed, but he did not look at you.', run: () => { resolve(cid); return fx({ owner: 3, players: [{ pid: vet.id, delta: -6 }] }); } },
        { label: 'Restructure', hint: `Owner +1 · ${vet.ln} morale −1`, reply: 'We push money into the future.', react: 'Everyone saved face.', run: () => { resolve(cid); return fx({ owner: 1, players: [{ pid: vet.id, delta: -1 }] }); } },
        { label: 'Keep his deal', hint: `${vet.ln} morale +3 · Owner −2`, reply: "We'll honor the contract.", react: 'The locker room noticed you kept your word.', run: () => { resolve(cid); return fx({ owner: -2, players: [{ pid: vet.id, delta: 3 }] }); } },
      ] });
  }

  // 8. A star's shoe deal clashes with the team's apparel partner (tug).
  const star = roster.filter(p => p.ovr >= 88).sort((a, b) => b.ovr - a.ovr)[0];
  if (star && r('shoe') < 12) {
    const cid = id(`shoe-${star.id}`);
    out.push({ id: cid, kind: 'Business', team: me, p: star, where: 'Conference call · Wednesday', speaker: 'Apparel partner',
      headline: `${star.ln}'s new shoe deal clashes with the team's apparel partner`,
      body: `${star.fn} ${star.ln} signed his own shoe deal. The team's apparel partner says it breaks the exclusivity clause.`,
      game: { kind: 'tug', them: 'The apparel partner', rounds: 3, patience: 3, walk: "Our lawyers will be in touch.",
        lines: { push: "He's under our umbrella like everyone else.", strain: "Exclusivity is the whole point of this deal.", hold: "Let's find something workable.", give: "We appreciate that." } },
      choices: [
        { label: 'He wears his shoes', hint: `${star.ln} morale +5 · Owner −1`, reply: 'He wears what he wants on game day.', react: `${star.ln} posted a thank-you.`, run: () => { resolve(cid); return fx({ owner: -1, players: [{ pid: star.id, delta: 5 }] }); } },
        { label: 'Practice only', hint: `${star.ln} morale +1`, reply: 'His shoes in practice, the team\'s on Sundays.', react: 'Everyone can live with it.', run: () => { resolve(cid); return fx({ players: [{ pid: star.id, delta: 1 }] }); } },
        { label: 'Team gear only', hint: `Owner +2 · ${star.ln} morale −4`, reply: 'Team gear. Contract is a contract.', react: `${star.ln} wasn't happy.`, run: () => { resolve(cid); return fx({ owner: 2, players: [{ pid: star.id, delta: -4 }] }); } },
      ] });
  }
  return out;
}
