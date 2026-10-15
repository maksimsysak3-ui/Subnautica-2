// The people on the other end of a trade. Every front office has a general manager with a
// name and a way of doing business: a shark who wants a premium and has no patience, a
// builder who wants picks and youth, a win-now GM who overpays for proven starters, an old
// school GM who trusts veterans, and a straight shooter. Their style shades what they
// value (see trade.ts) and how they talk. Talks also leave a trail: a close deal you walk
// away from comes back as a call-back the next week.
import type { League, TradeOffer } from './types';
import { hash } from './rng';

export type GmStyle = 'Shark' | 'Builder' | 'WinNow' | 'OldSchool' | 'Straight';
export interface Gm { name: string; style: GmStyle; label: string; blurb: string }

const FIRST = ['Ron', 'Dana', 'Mike', 'Terry', 'Jill', 'Omar', 'Brad', 'Kevin', 'Lou', 'Andre', 'Pete', 'Carla', 'Ted', 'Marcus', 'Joe', 'Nate'];
const LAST = ['Hollister', 'Graves', 'Duquette', 'McCaskey', 'Ferro', 'Whitfield', 'Kessler', 'Pagano', 'Brandt', 'Okafor', 'Lindqvist', 'Sorensen', 'Haas', 'Delacroix', 'Mara', 'Tanaka'];
const STYLE: Record<GmStyle, { label: string; blurb: string }> = {
  Shark: { label: 'The Shark', blurb: 'Wants a premium on every deal and has no patience for lowballs.' },
  Builder: { label: 'The Builder', blurb: 'Pays for picks and young players. Your veterans are worth less to him.' },
  WinNow: { label: 'Win-Now', blurb: 'Will overpay for proven starters. Picks barely move him.' },
  OldSchool: { label: 'Old School', blurb: 'Trusts veterans over draft picks and potential.' },
  Straight: { label: 'Straight Shooter', blurb: 'Fair and quick. Tells you exactly where he stands.' },
};

/** A team's GM: fixed for the franchise, with a style that leans on where the team is. */
export function gmOf(league: League, team: string): Gm {
  const h = hash(`${league.seed}-gm-${team}`) >>> 0;
  const mode = league.teams[team]?.mode;
  const pool: GmStyle[] = mode === 'rebuild' ? ['Builder', 'Builder', 'Shark', 'Straight', 'OldSchool']
    : mode === 'contend' ? ['WinNow', 'WinNow', 'Shark', 'Straight', 'OldSchool'] : ['Straight', 'Shark', 'OldSchool', 'Builder', 'WinNow'];
  const style = pool[(h >>> 7) % pool.length];
  return { name: `${FIRST[h % FIRST.length]} ${LAST[(h >>> 4) % LAST.length]}`, style, ...STYLE[style] };
}

/** How much a GM's style moves his asking line, and how fast his patience goes. */
export const STYLE_MARGIN: Record<GmStyle, number> = { Shark: 1.07, Builder: 1.0, WinNow: 0.98, OldSchool: 1.02, Straight: 1.0 };
export const STYLE_TIRE: Record<GmStyle, number> = { Shark: 0.055, Builder: 0.03, WinNow: 0.025, OldSchool: 0.035, Straight: 0.03 };

/** What an asset is worth to a GM of this style, relative to the neutral value. */
export function styleWeight(style: GmStyle, asset: { pick?: boolean; age?: number; ovr?: number }, incoming: boolean): number {
  if (!incoming) return 1;
  if (asset.pick) return style === 'Builder' ? 1.14 : style === 'WinNow' ? 0.88 : style === 'OldSchool' ? 0.94 : 1;
  const age = asset.age ?? 26, ovr = asset.ovr ?? 70;
  if (style === 'Builder') return age <= 25 ? 1.1 : age >= 29 ? 0.86 : 1;
  if (style === 'WinNow') return ovr >= 78 ? 1.1 : ovr < 70 ? 0.9 : 1;
  if (style === 'OldSchool') return age >= 28 ? 1.06 : age <= 23 ? 0.94 : 1;
  return 1;
}

/** The read on an offer, without numbers: how close their side thinks it is. */
export type Read = 'cold' | 'listening' | 'interested' | 'close' | 'deal';
export function readOf(ratio: number, margin: number, accept: boolean): Read {
  if (accept) return 'deal';
  const r = ratio / margin;
  return r >= 0.93 ? 'close' : r >= 0.8 ? 'interested' : r >= 0.62 ? 'listening' : 'cold';
}
export const READ_LABEL: Record<Read, string> = { cold: 'Not close', listening: 'Listening', interested: 'Interested', close: 'Very close', deal: 'Deal' };

/** What the GM says to a proposal, in his own voice. */
export function gmLine(gm: Gm, read: Read, tired: number, countered: boolean, seed: number): string {
  const pick = (xs: string[]) => xs[seed % xs.length];
  if (read === 'deal') return pick({
    Shark: ['Pleasure doing business. Send the paperwork.', 'Done. Don\'t tell anyone I gave you that.'],
    Builder: ['That works for our timeline. Deal.', 'Done. That helps us build this the right way.'],
    WinNow: ['Done. That gets us over the top.', 'Deal. We\'re going for it.'],
    OldSchool: ['Shake on it. Deal.', 'Good football trade. Done.'],
    Straight: ['That works. Deal.', 'Fair trade. Let\'s do it.'],
  }[gm.style]);
  if (tired >= 3) return pick({
    Shark: ['I\'m hanging up. Call me when you\'re serious.', 'Third lowball today. We\'re done talking this week.'],
    Builder: ['We keep going in circles. Let\'s talk next week.', 'I need you to come up a lot before we talk again.'],
    WinNow: ['I don\'t have time for this. Bring something real.', 'We\'re trying to win now, not play games.'],
    OldSchool: ['Son, you\'re wasting both our time.', 'Come back with a real offer.'],
    Straight: ['We\'re not getting anywhere today.', 'Same offer, same answer.'],
  }[gm.style]);
  const tail = countered ? ' Here\'s what would get it done.' : '';
  const base = read === 'close' ? {
    Shark: ['You\'re in the neighborhood. I need a little more.', 'Close. Sweeten it and I\'ll think about it.'],
    Builder: ['Almost. Throw in a pick and we\'re there.', 'Close. Something young or a pick gets it done.'],
    WinNow: ['Almost there. I need one more piece that helps us now.', 'You\'re close. Don\'t get cheap on me now.'],
    OldSchool: ['We\'re close. Real close.', 'One more piece and we can shake on it.'],
    Straight: ['Very close. A little more and it\'s done.', 'Just short. Add something small.'],
  } : read === 'interested' ? {
    Shark: ['Interesting. Not interesting enough.', 'I\'ll listen. You\'re not there yet.'],
    Builder: ['There\'s a deal here, but not this one.', 'I like the direction. I need more future value.'],
    WinNow: ['I\'m interested. Give me someone who can play this Sunday.', 'Getting there. Make it better.'],
    OldSchool: ['There\'s something here. Keep working.', 'Not bad. Not enough.'],
    Straight: ['We\'re interested. You need to come up some.', 'Not there yet, but we can talk.'],
  } : read === 'listening' ? {
    Shark: ['You\'re going to have to do a lot better.', 'Is this a joke? Try again.'],
    Builder: ['That doesn\'t move the needle for us.', 'Not enough for where we\'re going.'],
    WinNow: ['That doesn\'t help us win now.', 'No. We need real players.'],
    OldSchool: ['That\'s light. Real light.', 'You\'re not even close, friend.'],
    Straight: ['That\'s not enough.', 'Nowhere near. Sorry.'],
  } : {
    Shark: ['Don\'t insult me.', 'You called me for that?'],
    Builder: ['Pass.', 'Not interested at all.'],
    WinNow: ['No chance.', 'Not happening.'],
    OldSchool: ['No sir.', 'Not a chance.'],
    Straight: ['Not interested.', 'No.'],
  };
  return pick(base[gm.style]) + tail;
}

// ---- call-backs: a close deal you didn't finish comes back the next week ------------------
export interface Followup { team: string; offer: TradeOffer; season: number; week: number; id: string }
const followups = (league: League) => ((league as League & { tradeFollowups?: Followup[] }).tradeFollowups ??= []);
/** Remember their counter so the GM can call back with it next week. */
export function noteFollowup(league: League, team: string, offer: TradeOffer) {
  const all = followups(league).filter(f => f.team !== team);
  all.push({ team, offer, season: league.season, week: league.week + 1, id: `fu-${team}-${league.season}-${league.week}` });
  (league as League & { tradeFollowups?: Followup[] }).tradeFollowups = all.slice(-6);
}
export const dueFollowups = (league: League) => followups(league).filter(f => f.season === league.season && f.week <= league.week && f.week >= league.week - 1);
export function clearFollowup(league: League, team: string) {
  (league as League & { tradeFollowups?: Followup[] }).tradeFollowups = followups(league).filter(f => f.team !== team);
}
/** A deal the user wants to pick up in the trade room (from a call or a call-back). */
export const tradeDraft = (league: League) => (league as League & { tradeDraft?: TradeOffer }).tradeDraft;
export function setTradeDraft(league: League, o: TradeOffer | undefined) { (league as League & { tradeDraft?: TradeOffer }).tradeDraft = o; }
