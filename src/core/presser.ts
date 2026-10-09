// Post-game press conference. The beat reporters ask about what actually happened
// (the score, the streak, the quarterback's day, a star's big game, a fumble, an
// injury, next week's opponent) and the coach answers in his own words. Answers are
// read for tone (praise, blame, accountability, swagger, a guarantee, blaming the
// refs, ducking the question) and who they name, and that moves the fan base, the
// locker room, single players' morale, the owner and next week's momentum.
// The coach picks one of four answers per question (answerOptions); readAnswer scores it.
import type { Game, League, Player, StatLine } from './types';
import { Rng, hash } from './rng';
import { standings, userGame } from './season';
import type { Effects } from './media';

export type Topic = 'open' | 'qb' | 'star' | 'goat' | 'injury' | 'streak' | 'pressure' | 'next' | 'playoff' | 'refs' | 'defense' | 'ground' | 'follow';
export interface Question { reporter: string; outlet: string; text: string; topic: Topic; pid?: string; follow?: boolean }
export interface PressCtx {
  gid: string; won: boolean; tied: boolean; us: string; them: string; usPts: number; themPts: number; ot: boolean;
  record: string; streak: number; playoff?: string; division: boolean;
  qb?: { p: Player; l: Partial<StatLine> }; stars: { p: Player; l: Partial<StatLine>; why: string }[];
  goat?: { p: Player; l: Partial<StatLine>; why: string }; hurt: Player[];
  next?: { abbr: string; gid: string; division: boolean };
  coach: string; pens: number; turnovers: number; sacks: number; takeaways: number; rushYds: number;
}
export interface Verdict { reaction: string; tone: string[]; effects: Effects; headline?: string; followup?: string; guarantee?: boolean; fined?: boolean }

const OUTLETS = ['The Athletic', 'ESPN', 'NFL Network', 'Local 5 Sports', 'The Ringer', 'CBS Sports', 'Fox Sports', 'Sports Radio 97.1', 'The Post-Dispatch', 'Bleacher Report', 'Pro Football Talk'];
const REPORTERS = ['Dana Ruiz', 'Mike Kessler', 'Tanya Brooks', 'Greg Holloway', 'Priya Natarajan', 'Sam O\'Neil', 'Lou Castellano', 'Jordan Pike', 'Erin Walsh', 'Marcus Dade', 'Kelly Strand'];
const ROUND: Record<number, string> = { 19: 'Wild Card', 20: 'Divisional', 21: 'Conference Championship', 22: 'Super Bowl' };

function rating(l: Partial<StatLine>) {
  const att = l.pa ?? 0; if (!att) return 0;
  const a = Math.max(0, Math.min(2.375, ((l.pc ?? 0) / att - 0.3) * 5)), b = Math.max(0, Math.min(2.375, ((l.py ?? 0) / att - 3) * 0.25));
  const c = Math.max(0, Math.min(2.375, ((l.ptd ?? 0) / att) * 20)), d = Math.max(0, Math.min(2.375, 2.375 - ((l.pint ?? 0) / att) * 25));
  return ((a + b + c + d) / 6) * 100;
}
const yds = (l: Partial<StatLine>) => (l.py ?? 0) + (l.ry ?? 0) + (l.recy ?? 0);

/** Everything the press room knows about the game. */
export function pressContext(L: League, g: Game): PressCtx {
  const r = g.result!, home = g.home === L.user, us = L.user, them = home ? g.away : g.home;
  const usPts = home ? r.hs : r.as, themPts = home ? r.as : r.hs;
  const st = standings(L)[us];
  const ours = Object.entries(r.box?.players ?? {}).map(([id, l]) => ({ p: L.players[id], l })).filter(x => x.p && x.p.team === us);
  const qb = ours.filter(x => x.p.pos === 'QB').sort((a, b) => (b.l.pa ?? 0) - (a.l.pa ?? 0))[0];
  const why = (l: Partial<StatLine>) => {
    if ((l.py ?? 0) >= 250) return `${l.py} passing yards and ${l.ptd ?? 0} TD`;
    if ((l.ry ?? 0) >= 90) return `${l.ry} rushing yards${l.rtd ? ` and ${l.rtd} TD` : ''}`;
    if ((l.recy ?? 0) >= 85) return `${l.rec} catches for ${l.recy} yards${l.rectd ? ` and ${l.rectd} TD` : ''}`;
    if ((l.dsk ?? 0) >= 1.5) return `${l.dsk} sacks`;
    if ((l.dint ?? 0) >= 1) return `${l.dint} interception${(l.dint ?? 0) > 1 ? 's' : ''}`;
    return '';
  };
  const stars = ours.map(x => ({ ...x, why: why(x.l), score: yds(x.l) + (x.l.ptd ?? 0) * 20 + ((x.l.rtd ?? 0) + (x.l.rectd ?? 0)) * 30 + (x.l.dsk ?? 0) * 45 + (x.l.dint ?? 0) * 60 }))
    .filter(x => x.why && x.p.pos !== 'QB').sort((a, b) => b.score - a.score).slice(0, 2);
  const goats = ours.map(x => ({ ...x, bad: (x.l.fuml ?? 0) * 2 + (x.l.drop ?? 0) * 1.2 + (x.p.pos !== 'QB' ? 0 : 0) })).filter(x => x.bad >= 2).sort((a, b) => b.bad - a.bad);
  const goat = goats[0] ? { p: goats[0].p, l: goats[0].l, why: (goats[0].l.fuml ?? 0) ? `${goats[0].l.fuml} lost fumble${(goats[0].l.fuml ?? 0) > 1 ? 's' : ''}` : `${goats[0].l.drop} drops` } : undefined;
  const hurt = ours.map(x => x.p).filter(p => p.injury && p.injury.weeks >= 1 && p.ovr >= 72).sort((a, b) => b.ovr - a.ovr).slice(0, 1);
  // Streak from the standings string, e.g. "W3" / "L2".
  const sm = /([WLT])(\d+)/.exec(st?.streak ?? '');
  const streak = sm ? (sm[1] === 'W' ? +sm[2] : sm[1] === 'L' ? -sm[2] : 0) : 0;
  const nxt = L.games.filter(x => x.season === L.season && !x.result && (x.home === us || x.away === us)).sort((a, b) => a.week - b.week)[0] ?? (userGame(L)?.result ? undefined : userGame(L));
  const div = (a: string, b: string) => L.teams[a].conf === L.teams[b].conf && L.teams[a].div === L.teams[b].div;
  const box = r.box?.teams[home ? 1 : 0];
  return {
    gid: g.id, won: usPts > themPts, tied: usPts === themPts, us, them, usPts, themPts, ot: r.ot,
    record: st ? `${st.w}-${st.l}${st.t ? `-${st.t}` : ''}` : '', streak, playoff: ROUND[g.week], division: div(us, them),
    qb: qb && (qb.l.pa ?? 0) >= 10 ? qb : undefined, stars, goat, hurt,
    next: nxt ? { abbr: nxt.home === us ? nxt.away : nxt.home, gid: nxt.id, division: div(us, nxt.home === us ? nxt.away : nxt.home) } : undefined,
    coach: L.teams[us].coach.name, pens: box?.pen ?? 0, turnovers: box?.to ?? 0,
    sacks: ours.reduce((a, x) => a + (x.l.dsk ?? 0), 0), takeaways: ours.reduce((a, x) => a + (x.l.dint ?? 0) + (x.l.fr ?? 0), 0), rushYds: ours.reduce((a, x) => a + (x.l.ry ?? 0), 0),
  };
}

/** The questions, in the order a real room asks them: result first, then people, then what's next. */
export function pressQuestions(L: League, c: PressCtx): Question[] {
  const rng = new Rng(hash(c.gid + L.seed + 'press'));
  const used = new Set<number>();
  const who = () => { let i = rng.int(0, REPORTERS.length - 1); while (used.has(i)) i = (i + 1) % REPORTERS.length; used.add(i); return { reporter: REPORTERS[i], outlet: OUTLETS[(i * 7 + rng.int(0, 3)) % OUTLETS.length] }; };
  const T = L.teams[c.them], score = `${c.usPts}-${c.themPts}`, m = Math.abs(c.usPts - c.themPts);
  const q: Question[] = [];
  const pick = (xs: string[]) => xs[rng.int(0, xs.length - 1)];
  // 1. The result.
  q.push({ ...who(), topic: 'open', text: c.playoff && c.won ? `Coach, you're moving on after a ${score} ${c.playoff} win over the ${T.nick}. What did you tell the team in there?`
    : c.playoff ? `Coach, the season ends ${score} against the ${T.nick}. What went wrong today?`
    : c.tied ? `A ${score} tie with the ${T.nick}. How do you feel about walking away with that?`
    : c.won ? pick(m >= 17 ? [`${score} over the ${T.nick}. That was as complete as we've seen this team. Where does it rank for you?`, `Coach, a ${m}-point win over the ${T.nick}. Was this the statement game?`]
      : m <= 3 ? [`Coach, ${score}${c.ot ? ' in overtime' : ''}, that one went down to the wire. What was the difference at the end?`, `A ${score} nail-biter over the ${T.nick}. What were you thinking on that final drive?`]
      : [`Coach, a ${score} win over the ${T.nick}. What did you like most out there?`])
    : pick(m >= 17 ? [`Coach, ${score}. That's about as ugly as it gets. What happened?`, `A ${m}-point loss to the ${T.nick}. Was your team ready to play today?`]
      : [`Coach, ${score} to the ${T.nick}. What was the difference in the game?`, `Close one slipped away, ${score}. What do you take from that?`]) });
  // The rest: whatever this game was about, in a different order each week.
  const pool: Question[] = [];
  if (c.qb) {
    const l = c.qb.l, rt = rating(l), p = c.qb.p;
    if ((l.pint ?? 0) >= 2) pool.push({ ...who(), topic: 'qb', pid: p.id, text: pick([`${p.ln} threw ${l.pint} interceptions today. Is he still your guy under center?`, `${l.pint} picks from ${p.ln}. At what point do you consider a change?`, `Coach, what did you say to ${p.ln} after those interceptions?`]) });
    else if (rt >= 105 && (l.py ?? 0) >= 220) pool.push({ ...who(), topic: 'qb', pid: p.id, text: pick([`${p.fn} ${p.ln} went ${l.pc}-for-${l.pa}, ${l.py} yards and ${l.ptd} touchdown${l.ptd === 1 ? '' : 's'}. Have you ever seen him play better?`, `${l.py} yards and ${l.ptd} scores for ${p.ln}. Is he the best quarterback in the league right now?`, `What's clicking for ${p.ln}? He looked unstoppable out there.`]) });
    else if (rt < 70) pool.push({ ...who(), topic: 'qb', pid: p.id, text: pick([`It was a rough day for ${p.ln}, ${l.pc}-for-${l.pa} for ${l.py} yards. What's going on with your quarterback?`, `${p.ln} never got comfortable today. Is it him or the protection?`]) });
  }
  const s = c.stars[0];
  if (s) pool.push({ ...who(), topic: 'star', pid: s.p.id, text: pick([`${s.p.fn} ${s.p.ln} with ${s.why}. Is he getting the national recognition he deserves?`, `Talk about ${s.p.ln}: ${s.why} today. What makes him so hard to stop?`, `${s.why} for ${s.p.ln}. Did you see that coming this week?`, `Where does ${s.p.ln}'s day rank among the best you've seen from him?`]) });
  if (c.goat) pool.push({ ...who(), topic: 'goat', pid: c.goat.p.id, text: pick([`${c.goat.p.ln} had ${c.goat.why}. Will there be consequences this week?`, `${c.goat.why} from ${c.goat.p.ln}. Does he keep his job on Sunday?`, `What do you say to ${c.goat.p.ln} after ${c.goat.why}?`]) });
  if (c.hurt[0]) pool.push({ ...who(), topic: 'injury', pid: c.hurt[0].id, text: pick([`Any update on ${c.hurt[0].fn} ${c.hurt[0].ln}? How do you replace him?`, `How long is ${c.hurt[0].ln} out, and who steps in?`, `Losing ${c.hurt[0].ln} hurts. What changes without him?`]) });
  if (c.sacks >= 4 || c.takeaways >= 3) pool.push({ ...who(), topic: 'defense', text: pick([`${c.sacks >= 4 ? `${c.sacks} sacks` : `${c.takeaways} takeaways`} today. Is this the best your defense has played?`, `Your defense took over the game. What changed this week?`, `Coach, ${c.takeaways} takeaways and ${c.sacks} sacks. Is this a top-five defense?`]) });
  if (c.rushYds >= 170) pool.push({ ...who(), topic: 'ground', text: pick([`${c.rushYds} rushing yards. Was the plan to run it down their throats?`, `Your line dominated today: ${c.rushYds} yards on the ground. What did you see in their front?`]) });
  if (!c.playoff) {
    if (c.streak >= 3) pool.push({ ...who(), topic: 'streak', text: pick([`That's ${c.streak} straight. At ${c.record}, is this the team to beat?`, `${c.streak} wins in a row. Are you starting to think about January?`, `At ${c.record}, people are calling you contenders. Are they right?`]) });
    else if (c.streak <= -3) pool.push({ ...who(), topic: 'pressure', text: pick([`${-c.streak} losses in a row and the fans are booing. Do you feel your job is in danger?`, `${-c.streak} straight losses. What do you say to the fans who want changes?`, `Is this locker room still with you after ${-c.streak} straight losses?`]) });
    else if (L.security < 35) pool.push({ ...who(), topic: 'pressure', text: pick([`There are reports ownership is losing patience. Have you spoken to them?`, `Do you have the owner's support right now?`]) });
  }
  if (c.pens >= 9) pool.push({ ...who(), topic: 'refs', text: pick([`${c.pens} penalties today. Is that discipline, or did the officials have a bad day?`, `${c.pens} flags. Are you going to send tape to the league?`]) });
  rng.shuffle(pool);
  q.push(...pool.slice(0, 3));
  // Next week, most weeks.
  if (c.next && !(c.playoff && !c.won) && (c.playoff || c.next.division || rng.chance(0.65) || q.length < 3)) {
    const N = L.teams[c.next.abbr];
    q.push({ ...who(), topic: c.playoff ? 'playoff' : 'next', text: c.playoff ? pick([`Next up in the playoffs: the ${N.name}. What's your message to them?`, `The ${N.nick} are next, win or go home. What worries you?`]) : c.next.division ? pick([`Division rival ${N.nick} next week. Anything you want to say to them?`, `It's ${N.nick} week. Does this one mean more?`]) : pick([`The ${N.name} are next. What concerns you about them?`, `What's the key against the ${N.nick} next week?`, `How do you see the ${N.nick} matchup?`]) });
  }
  return q.slice(0, 5);
}

// ---- reading an answer -----------------------------------------------------------------
const W = (xs: string) => xs.split('|');
const PRAISE = W('great|proud|amazing|incredible|unbelievable|special|elite|best|love|credit|deserves|deserve|stepped up|warrior|leader|tremendous|outstanding|fantastic|phenomenal|mvp|pro bowl|all-pro|ridiculous|stud|beast|clutch|trust|believe in');
const BLAME = W('terrible|awful|unacceptable|sloppy|embarrass~|pathetic|disgrace|bad|horrible|garbage|lazy|selfish|benched|bench him|replace|cut him|disappointed|his fault|their fault|soft|weak|not good enough|killed us|cost us');
const OWN = W('on me|my fault|i take|i need to|i have to|we need to|we have to|accountab~|responsib~|own it|learn|improve|get better|coach better|look in the mirror|my job|i didn');
const SWAG = W('best team|nobody can|no one can|can\'t stop|cannot stop|dominate|we run this|unstoppable|super bowl|ring|championship|dynasty|scared|fear|unbeaten|undefeated');
const GUAR = W('guarantee|we will win|we\'re going to win|we are going to win|we\'ll win|we will beat|we\'re gonna win|gonna win|mark my words|promise you');
const REFS = W('ref|refs|referee|officials|officiating|flags|the calls|zebras|rigged');
const FANS = W('fans|city|crowd|supporters|support|faithful|thank');
const TRASH = W('overrated|frauds|fraud|soft|scared|nobody|trash|joke|clowns|pretenders|can\'t wait to|bring it|they talk');
const DUCK = W('no comment|next question|whatever|don\'t know|dunno|not talking|ask him|idk|no idea');
const RESPECT = W('respect|good team|well coached|tough team|credit to them|hats off|tip our cap|dangerous|talented');
const CURSE = W('fuck|shit|damn|bitch|ass|hell no|crap|bullshit');

/** Whole-word (or whole-phrase) matches; a trailing ~ marks a stem that may continue. */
const has = (t: string, ws: string[]) => ws.filter(w => {
  const stem = w.endsWith('~'), body = (stem ? w.slice(0, -1) : w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z'])${body}${stem ? '' : "(?![a-z])"}`, 'i').test(t);
}).map(w => w.replace('~', ''));

/** The sentence of the answer that carries a tone word, for the headline. */
function quote(ans: string, words: string[]) {
  const sents = ans.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const s = sents.find(x => words.some(w => x.toLowerCase().includes(w))) ?? sents[0] ?? ans;
  return s.length > 90 ? s.slice(0, 87).replace(/\s+\S*$/, '') + '…' : s;
}

/** Read one answer. `prior` counts earlier dodges so a second dodge gets punished harder. */
export function readAnswer(L: League, c: PressCtx, q: Question, ans: string, prior: { ducks: number; recentGuarantee?: boolean }): Verdict {
  const t = ans.toLowerCase().trim();
  const words = t.split(/\s+/).filter(Boolean).length;
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status !== 'RET');
  const named = roster.filter(p => p.ln.length > 2 && new RegExp(`\\b${p.ln.toLowerCase()}\\b`).test(t));
  const subject = q.pid ? L.players[q.pid] : undefined;
  const target = named[0] ?? subject;
  const praise = has(t, PRAISE), blame = has(t, BLAME), own = has(t, OWN), swag = has(t, SWAG), guar = has(t, GUAR), refs = has(t, REFS);
  const fansW = has(t, FANS), trash = has(t, TRASH), duck = has(t, DUCK), respect = has(t, RESPECT), curse = has(t, CURSE);
  const opp = L.teams[c.them], nxt = c.next ? L.teams[c.next.abbr] : undefined;
  const e: Required<Pick<Effects, 'fans' | 'owner' | 'locker' | 'momentum'>> & { players: { pid: string; delta: number }[] } = { fans: 0, owner: 0, locker: 0, momentum: 0, players: [] };
  const tone: string[] = [];
  const v: Verdict = { reaction: '', tone, effects: e };
  const lines: string[] = [];

  if (words <= 3 || duck.length) {
    tone.push('Evasive');
    e.fans -= 1.5 + prior.ducks; e.owner -= prior.ducks ? 1 : 0;
    lines.push(prior.ducks ? 'The room groans. That is two dodges in one presser and it will be the story tomorrow.' : 'A few reporters exchange looks. That will not satisfy anyone.');
    if (!q.follow && !prior.ducks) v.followup = q.topic === 'pressure' ? 'Coach, with respect, the fans deserve a real answer. Are you worried about your job?' : q.pid && subject ? `Come on, Coach. A real answer on ${subject.ln}?` : 'Coach, can you give us a little more than that?';
    prior.ducks++;
  }
  if (curse.length) { tone.push('Profane'); e.owner -= 3; e.fans += 0.5; v.fined = true; lines.push('That word is going to cost him. Expect a fine from the league office.'); }
  if (refs.length && (blame.length || has(t, W('bad|terrible|awful|joke|robbed|rigged|blind|horrible')).length)) {
    tone.push('Blames refs'); e.fans += 1; e.owner -= 2.5; v.fined = true; lines.push('Blaming the officials plays well with the fans and badly with the league office.');
  }
  if (praise.length) {
    tone.push('Praise');
    if (target) { e.players.push({ pid: target.id, delta: 7 }); lines.push(`${target.ln} will hear about that, and he will like it.`); }
    else { e.locker += 2; lines.push('The locker room will like hearing that.'); }
    e.fans += 0.5;
  }
  if (blame.length && !refs.length) {
    tone.push('Calls out');
    if (target) { e.players.push({ pid: target.id, delta: -12 }); e.locker -= 1; lines.push(`Calling out ${target.ln} in public. He will not forget it, and the room noticed.`); e.momentum += 0.4; }
    else { e.locker -= 3; e.momentum += 0.6; lines.push('Calling out the whole team: it might light a fire, it might lose the room.'); }
    e.fans += c.won ? -0.5 : 1;
  }
  if (own.length) {
    tone.push('Accountable'); e.locker += 2; e.owner += c.won ? 0 : 1.5; e.fans += 1;
    lines.push(c.won ? 'Humble in a win. The players respect that.' : 'Taking the heat himself. The players will remember he had their backs.');
  }
  if (fansW.length) { tone.push('Fans'); e.fans += 2; lines.push('The fan base eats that up.'); }
  if (guar.length && c.next) {
    tone.push('Guarantee'); v.guarantee = true;
    if (prior.recentGuarantee) { e.fans += 0.5; e.momentum += 0.2; lines.push('Another guarantee? The room has heard this before. It still counts if he loses.'); }
    else { e.fans += 3; e.momentum += 0.6; lines.push(`A guarantee! That will be on every screen in the country. Now he has to back it up${nxt ? ` against the ${nxt.nick}` : ''}.`); }
  } else if (swag.length) {
    tone.push('Swagger'); e.momentum += 0.6; e.fans += c.won ? 1.5 : -1; e.owner += c.won ? 0 : -1;
    lines.push(c.won ? 'Confident. The room buzzes.' : 'Bold talk after a loss. Some will call it confidence, some will call it delusion.');
  }
  const ripsRefs = tone.includes('Blames refs');
  if (trash.length && !ripsRefs) {
    tone.push('Trash talk'); e.momentum += 0.4; e.fans += 1;
    lines.push(`Bulletin-board material. The ${(nxt ?? opp).nick} will have that printed in their locker room.`);
  } else if (respect.length) { tone.push('Respectful'); e.owner += 0.5; lines.push('Classy. Nothing to see for the tabloids.'); }
  if (q.topic === 'pressure' && !duck.length && !own.length && !swag.length && !guar.length && words > 3) { e.owner += 0.5; lines.push('Calm under fire. That helps.'); }
  if (q.topic === 'goat' && subject && !blame.length && !praise.length && words > 5) { e.players.push({ pid: subject.id, delta: 3 }); tone.push('Protects player'); lines.push(`Shielding ${subject.ln}. He needed that.`); }
  if (q.topic === 'qb' && subject && praise.length && (c.qb?.l.pint ?? 0) >= 2) { e.locker += 1; lines.push('Backing his quarterback through a bad day.'); }
  if (!tone.length) { tone.push('Measured'); e.fans += words > 20 ? 0.5 : 0; lines.push(words > 25 ? 'A thoughtful answer. The reporters are scribbling.' : 'Standard coach-speak. Nobody will remember it.'); }

  v.reaction = lines.slice(0, 2).join(' ');
  const coach = c.coach.split(' ').slice(-1)[0];
  const q2 = quote(ans, [...guar, ...trash, ...blame, ...refs, ...curse, ...praise, ...own]);
  v.headline = v.guarantee ? `${coach} guarantees a win: "${q2}"`
    : tone.includes('Blames refs') ? `${coach} rips the officials: "${q2}"`
    : tone.includes('Trash talk') ? `${coach} fires a shot at the ${(nxt ?? opp).nick}: "${q2}"`
    : tone.includes('Calls out') && target ? `${coach} calls out ${target.ln}: "${q2}"`
    : tone.includes('Profane') ? `${coach} loses his cool at the podium`
    : prior.ducks >= 2 ? `${coach} stonewalls reporters after ${c.won ? 'win' : 'loss'}`
    : tone.includes('Praise') && target ? `${coach} on ${target.ln}: "${q2}"`
    : undefined;
  return v;
}

/** The press room is open for the user's most recent played game until he takes or skips it. */
export function pressOpen(L: League, g: Game | undefined, pressed: string[]): boolean {
  if (!g?.result || (g.home !== L.user && g.away !== L.user) || pressed.includes(g.id)) return false;
  const last = L.games.filter(x => x.result && (x.home === L.user || x.away === L.user)).sort((a, b) => b.season - a.season || b.week - a.week)[0];
  return last?.id === g.id;
}

// ---- answer choices ---------------------------------------------------------------------
/** One of the four answers the coach can give, with the tone it is read as. */
export interface Answer { text: string; tone: string }

/** Four answers for this question, each a different stance with different consequences. */
export function answerOptions(L: League, c: PressCtx, q: Question): Answer[] {
  const p = q.pid ? L.players[q.pid] : undefined, ln = p?.ln ?? 'him';
  const nxt = c.next ? L.teams[c.next.abbr].nick : 'them', opp = L.teams[c.them].nick;
  // Several wordings per tone; each game picks its own, so the podium never reads the same twice.
  const A = (tone: string, ...texts: string[]): Answer => ({ tone, text: texts[(hash(`${c.gid}-${q.topic}-${tone}`) >>> 0) % texts.length] });
  switch (q.topic) {
    case 'open': return c.won || c.tied ? [
      A('Praise', `I'm proud of these guys. The whole roster stepped up today, and the credit goes to them.`, `Credit to the players. They stepped up in every phase and I'm proud of them.`, `That was special. I love how this group competed for sixty minutes.`, `Our leaders stepped up today. I'm proud of every guy in that locker room.`),
      A('Fans', `Our fans were incredible today. This city deserves wins like that.`, `Thank you to the fans. That crowd gave us a real edge out there.`, `This city showed up today, and the fans carried us in the fourth quarter.`, `I want to thank our fans. The crowd was rocking from the first snap.`),
      A('Swagger', `Honestly? We're the best team in this league and nobody can stop us when we play like that.`, `When we play like that, nobody can stop us. Simple as that.`, `We're the best team in football. Teams can't stop this offense when it's rolling.`),
      A('Accountable', `We left plays out there. I need to coach better and we have to improve before next week.`, `We won, but we have to get better. I need to clean up a lot of my own decisions.`, `A win's a win, but we left plays out there. We have to improve, and that's my job.`),
    ] : [
      A('Accountable', `That's on me. I have to coach better, and we will learn from it.`, `I own it. I need to put our guys in better spots, and that's my job.`, `That loss is on me. We have to get better this week and it starts with me.`, `Look in the mirror first. I need to coach better, period.`),
      A('Calls out', `That was unacceptable. Sloppy football from everybody, and it will not continue.`, `Not good enough. That was sloppy, and some guys are going to hear about it.`, `I'm disappointed. Too many guys made mistakes that cost us today.`, `That effort was unacceptable. We were soft at the point of attack.`),
      A('Blames refs', `The refs were terrible today. Some of those calls were a joke.`, `I'll say it: the officials decided that game. Those flags were brutal.`, `Ask the refs. Those calls were terrible in a game this close.`),
      A('Respectful', `Credit to them, they're a good team. We'll get back to work tomorrow.`, `Hats off to the ${opp}. They're a well coached team and they earned it.`, `You have to respect what the ${opp} did today. That's a dangerous team.`),
    ];
    case 'qb': return (c.qb?.l.pint ?? 0) >= 2 || rating(c.qb?.l ?? {}) < 70 ? [
      A('Praise', `I believe in ${ln}. He's our leader and I trust him completely.`, `${ln} is our guy. I trust him, and one bad day doesn't change that.`, `I believe in ${ln} more than ever. He's a leader and he'll respond.`),
      A('Calls out', `Those turnovers were unacceptable. ${ln} has to be better or we'll look at changes.`, `${ln} wasn't good enough today, plain and simple. Those throws cost us.`, `I'm disappointed in the decisions. ${ln} knows those mistakes cost us.`),
      A('Accountable', `That's on me. I put ${ln} in bad spots and I need to coach better.`, `I need to call a better game for ${ln}. That's my job, and I own it.`, `We have to protect him better and I have to coach better. That's on me.`),
      A('Evasive', `No comment on that.`, `Next question.`, `I don't know yet. We'll look at the film.`),
    ] : [
      A('Praise', `${ln} was special today. He's playing at an MVP level right now.`, `That's an elite quarterback. ${ln} deserves all the credit he's going to get.`, `${ln} was outstanding. I trust him with every call in the book.`),
      A('Fans', `You could hear our fans on every throw. This city gives him that energy.`, `The crowd was electric. Our fans give ${ln} a lift every Sunday.`, `This city loves ${ln}, and the fans showed it today.`),
      A('Calls out', `I'm a little disappointed, honestly. ${ln} still left throws out there.`, `He played well, but not good enough for our standard. ${ln} knows that.`),
      A('Evasive', `We don't need to talk about one guy. Next question.`, `Whatever. It's a team game.`, `No comment. Ask me about the defense.`),
    ];
    case 'star': return [
      A('Praise', `${ln} is elite. He deserves to be in the MVP conversation, period.`, `I love that kid. ${ln} is a special player and he deserves the recognition.`, `${ln} is a beast. He's one of the best in this league and he's a leader.`, `Credit to ${ln}. Outstanding work all week, and it showed.`),
      A('Fans', `Ask our fans, they know. This city loves the way ${ln} plays.`, `Our fans see it every Sunday. ${ln} plays for this city.`, `The crowd chants his name for a reason. This city has a star in ${ln}.`),
      A('Calls out', `He's talented, but he's not good enough yet. ${ln} has a lot to prove.`, `Nice day, but I'm disappointed in some details. ${ln} isn't a finished product.`),
      A('Evasive', `Whatever. I don't care about individual stats.`, `Next question. We don't do individual awards in here.`, `I don't know, ask him.`),
    ];
    case 'goat': return [
      A('Protects player', `We'll fix it in practice this week. ${ln} is a good player and he will bounce back from this.`, `${ln} is a pro. He'll put this one behind him and be ready next week.`, `Mistakes happen in this game. ${ln} works as hard as anyone and he'll respond.`),
      A('Calls out', `Ball security is everything. What ${ln} did was unacceptable and it cost us.`, `That's not good enough from ${ln}. Those mistakes cost us the game.`, `Unacceptable. ${ln} knows it, and he'll be held to a higher standard.`),
      A('Accountable', `That's on me. We need to improve how we teach it, and that's my job.`, `I own it. If a player keeps making that mistake, I have to coach better.`, `That starts with me. We have to get better at the fundamentals.`),
      A('Evasive', `No comment.`, `Next question.`, `I'm not talking about that.`),
    ];
    case 'injury': return [
      A('Praise', `We'll miss ${ln}, but next man up. I trust the guys behind him.`, `I believe in our depth. The guys behind ${ln} are ready and I trust them.`, `${ln} is a leader and a warrior. The next man up will make him proud.`),
      A('Fans', `Our fans should know ${ln} is a warrior. He'll be back, and this city will be loud for him.`, `Keep ${ln} in your thoughts, fans. This city will give him a hero's welcome back.`),
      A('Accountable', `We need to improve our depth there, and that's my responsibility.`, `Depth is my job. We have to get better behind him, and I own that.`),
      A('Evasive', `I'm not talking about injuries.`, `No comment until the doctors are done.`, `I don't know yet. Next question.`),
    ];
    case 'streak': return [
      A('Swagger', `We're the best team in this league and nobody can stop us right now.`, `Nobody can stop this team when we're rolling. We're the best team in football.`, `Teams can't stop us right now, and they know it.`),
      A('Accountable', `We haven't done anything yet. We have to keep getting better every week.`, `Streaks don't mean much in November. We have to improve or it ends.`, `Nobody's satisfied. We need to get better, and that's my job.`),
      A('Fans', `This one's for our fans. This city deserves a winner.`, `Thank you to the fans. The city feels it, and so do we.`, `Our fans have waited for this. The crowd has been unbelievable.`),
      c.next ? A('Guarantee', `We're not done. I guarantee we will win next week against the ${nxt} too.`, `Mark my words: we will win next week too.`, `I guarantee it keeps going. We will beat the ${nxt}.`) : A('Respectful', `There are a lot of good teams in this league. We respect all of them.`, `Respect to everyone we've played. This league is full of dangerous teams.`),
    ];
    case 'pressure': return [
      A('Accountable', `That's my job and I own it. We need to get better, starting with me.`, `I own every one of those losses. I need to coach better, period.`, `It's on me to fix it, and I will. We have to improve this week.`),
      c.next ? A('Guarantee', `We will win next week. I guarantee it.`, `Mark my words, we will win on Sunday.`, `I promise you we will beat the ${nxt}.`) : A('Swagger', `Nobody can coach this team better than me. I promise you that.`),
      A('Evasive', `I don't know. Ask him.`, `No comment on the owner.`, `Next question.`),
      A('Calls out', `Some of these players are not good enough right now, and changes are coming.`, `Too many guys are playing soft. That's unacceptable, and it will change.`, `I'm disappointed in our effort. Some guys are not good enough right now.`),
    ];
    case 'refs': return [
      A('Blames refs', `The officials were terrible. Some of those flags were a joke.`, `I'd like an explanation from the officials on half those flags. It was a joke.`, `The refs were awful. That officiating took the game out of our hands.`),
      A('Accountable', `That's on us. Discipline is my responsibility and I will fix it.`, `Penalties are on me. We have to be a smarter football team, and that's my job.`),
      A('Evasive', `Whatever. Next question.`, `No comment. I'd get fined.`),
      A('Calls out', `Sloppy, selfish football. That was unacceptable from my players.`, `Those were selfish penalties. Not good enough from veterans who know better.`),
    ];
    case 'defense': return [
      A('Praise', `Our defense was special. That unit deserves all the credit today.`, `I love how the defense played. Outstanding, physical, and they stepped up.`, `Credit to the defense. They were elite from the first snap.`),
      A('Swagger', `Nobody can run on us, and nobody can throw on us. That's the best defense in football.`, `Teams can't stop us when the defense plays like that.`),
      A('Fans', `The crowd was a twelfth defender today. Thank you to our fans.`, `Our fans made it loud on every third down. This city deserves that defense.`),
      A('Accountable', `We still have to get better. I need to make sure we don't get complacent.`, `Good day, but we have to improve on the details. That's my job.`),
    ];
    case 'ground': return [
      A('Praise', `Credit to the offensive line. Those guys were outstanding and they deserve the attention.`, `I'm proud of the big guys up front. They stepped up and controlled the game.`),
      A('Swagger', `When we run it like that, nobody can stop us. We dominate up front.`, `Teams can't stop our run game. Simple as that.`),
      A('Respectful', `Respect to the ${opp} front. That's a talented group, and our guys still won the battle.`, `Hats off to the ${opp}, they're tough. We just found a rhythm.`),
      A('Evasive', `Whatever works. Next question.`, `No comment on the game plan.`),
    ];
    case 'next': case 'playoff': return [
      A('Respectful', `Respect to the ${nxt}. They're a well coached, dangerous team.`, `The ${nxt} are a good team with talented players. We'll have our hands full.`, `Hats off to what the ${nxt} have built. Dangerous, well coached group.`),
      A('Guarantee', `We will win, I guarantee it.`, `Mark my words: we will beat the ${nxt}.`, `I guarantee we will win that game.`),
      A('Trash talk', `Honestly? The ${nxt} are overrated. Bring it.`, `The ${nxt} are pretenders. Bring it on.`, `They talk a lot for a team that's overrated. Bring it.`),
      A('Fans', `Our fans will be loud. This city is ready for it.`, `Fans, bring the noise. This city is ready.`, `The crowd is going to be rocking. Our fans live for weeks like this.`),
    ];
    default: return [
      A('Praise', `I'm proud of this team. They stepped up.`, `Credit to the players. I love this group.`),
      A('Accountable', `We have to get better, and that starts with me.`, `I need to coach better. That's my job.`),
      A('Swagger', `Nobody can stop us when we play our game.`, `We're the best team in this league when we're right.`),
      A('Evasive', `No comment.`, `Next question.`),
    ];
  }
}
