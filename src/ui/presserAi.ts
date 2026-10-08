// Optional: let Claude run the press room. The player brings their own Anthropic API
// key (Options → Press Conference AI); it is kept in this browser's localStorage and
// sent only to the Anthropic API. Claude writes the questions from the game and reads
// each answer; every number it returns is clamped before it touches the league, and
// any failure falls back to the offline reader in core/presser.ts.
import type { League } from '../core/types';
import type { PressCtx, Question, Verdict, Topic } from '../core/presser';
import { fans, teamMorale } from '../core/media';

const KEY = 'gg-claude-key';
export const MODEL = 'claude-opus-5-5';
export const aiKey = () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export const setAiKey = (k: string) => { try { if (k) localStorage.setItem(KEY, k.trim()); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

async function client() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: aiKey(), dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 45_000 });
}

const SYSTEM = `You run the post-game press conference in an NFL general-manager simulation game. The player is the head coach at the podium and types answers. You play the press pool: sharp, realistic beat reporters from real-sounding outlets. Ground every question in the game facts you are given (score, quarterback line, standout players, mistakes, injuries, streaks, the next opponent). When judging an answer, act like the league ecosystem: fans, the locker room, individual players (big egos react more), the owner, and the next opponent. Reward specific, honest, emotionally intelligent answers; punish dodging, throwing players under the bus without cause, blaming officials, profanity, and bold guarantees that the team might not back up (a guarantee is a gamble, not free). Keep every reaction to one or two vivid sentences.`;

function facts(L: League, c: PressCtx) {
  const T = (a: string) => L.teams[a];
  const pl = (p: { id: string; fn: string; ln: string; pos: string; ovr: number; morale: number; traits: { ego: number } }) => `${p.fn} ${p.ln} [id ${p.id}] ${p.pos} ${p.ovr} OVR, morale ${Math.round(p.morale)}, ego ${p.traits.ego}`;
  return [
    `Coach: ${c.coach}, ${T(c.us).name}. Record ${c.record}. Streak ${c.streak > 0 ? `W${c.streak}` : c.streak < 0 ? `L${-c.streak}` : 'none'}.`,
    `Result: ${c.won ? 'WON' : c.tied ? 'TIED' : 'LOST'} ${c.usPts}-${c.themPts} vs ${T(c.them).name}${c.ot ? ' in overtime' : ''}${c.playoff ? ` (${c.playoff})` : ''}${c.division ? ', division game' : ''}. Penalties ${c.pens}, turnovers ${c.turnovers}.`,
    c.qb ? `QB ${pl(c.qb.p)}: ${c.qb.l.pc}/${c.qb.l.pa}, ${c.qb.l.py} yds, ${c.qb.l.ptd ?? 0} TD, ${c.qb.l.pint ?? 0} INT.` : '',
    ...c.stars.map(s => `Standout ${pl(s.p)}: ${s.why}.`),
    c.goat ? `Struggled: ${pl(c.goat.p)}: ${c.goat.why}.` : '',
    ...c.hurt.map(p => `Injured: ${pl(p)}: ${p.injury?.type}, out ${p.injury?.weeks} weeks.`),
    c.next ? `Next opponent: ${T(c.next.abbr).name}${c.next.division ? ' (division rival)' : ''}.` : 'No next game this season.',
    `Fan support ${Math.round(fans(L))}/100, owner job security ${Math.round(L.security)}/100, locker room morale ${Math.round(teamMorale(L))}/100.`,
  ].filter(Boolean).join('\n');
}

const TOPICS: Topic[] = ['open', 'qb', 'star', 'goat', 'injury', 'streak', 'pressure', 'next', 'playoff', 'refs'];
const QSCHEMA = {
  type: 'object', additionalProperties: false, required: ['questions'],
  properties: { questions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['reporter', 'outlet', 'text', 'topic', 'player_id'],
    properties: { reporter: { type: 'string' }, outlet: { type: 'string' }, text: { type: 'string' }, topic: { type: 'string', enum: TOPICS }, player_id: { anyOf: [{ type: 'string' }, { type: 'null' }] } } } } },
};
const VSCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['reaction', 'tone', 'headline', 'fans', 'owner', 'locker', 'momentum', 'players', 'guarantee', 'fined', 'followup'],
  properties: {
    reaction: { type: 'string' }, tone: { type: 'array', items: { type: 'string' } }, headline: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    fans: { type: 'integer' }, owner: { type: 'integer' }, locker: { type: 'integer' }, momentum: { type: 'integer' },
    players: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['player_id', 'delta'], properties: { player_id: { type: 'string' }, delta: { type: 'integer' } } } },
    guarantee: { type: 'boolean' }, fined: { type: 'boolean' }, followup: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
};

async function ask<T>(prompt: string, schema: object, maxTokens: number): Promise<T> {
  const c = await client();
  const res = await c.beta.messages.create({
    model: MODEL, max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this one');
  const text = res.content.map(b => (b.type === 'text' ? b.text : '')).join('');
  return JSON.parse(text) as T;
}

const cl = (v: unknown, a: number, b: number) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
const mine = (L: League, id: unknown) => typeof id === 'string' && L.players[id]?.team === L.user ? id : undefined;

export async function aiQuestions(L: League, c: PressCtx): Promise<Question[]> {
  const r = await ask<{ questions: { reporter: string; outlet: string; text: string; topic: Topic; player_id: string | null }[] }>(
    `${facts(L, c)}\n\nWrite the 4 or 5 questions the press pool asks, in the order a real room would (result first, then people, then what's next). Use player_id only for players listed above with an id; otherwise null.`, QSCHEMA, 3000);
  const qs = r.questions.filter(q => q.text?.trim()).slice(0, 5).map(q => ({ reporter: q.reporter.slice(0, 40), outlet: q.outlet.slice(0, 40), text: q.text.slice(0, 400), topic: TOPICS.includes(q.topic) ? q.topic : 'open' as Topic, pid: mine(L, q.player_id) }));
  if (qs.length < 3) throw new Error('too few questions');
  return qs;
}

export async function aiVerdict(L: League, c: PressCtx, q: Question, answer: string, history: { q: string; a: string }[]): Promise<Verdict> {
  const prev = history.map(h => `Q: ${h.q}\nA: ${h.a}`).join('\n\n');
  const r = await ask<{ reaction: string; tone: string[]; headline: string | null; fans: number; owner: number; locker: number; momentum: number; players: { player_id: string; delta: number }[]; guarantee: boolean; fined: boolean; followup: string | null }>(
    `${facts(L, c)}\n\n${prev ? `Earlier in this press conference:\n${prev}\n\n` : ''}Question from ${q.reporter} (${q.outlet}): ${q.text}\nCoach's answer: """${answer.slice(0, 1200)}"""\n\nJudge the answer. Scales: fans, owner, locker -5..5; momentum -2..2 (rating edge for the next game); players: morale changes -15..15 for players with ids above who were praised, criticised or affected; guarantee true only if the coach guaranteed winning the next game; fined true for profanity or attacking officials; tone 1-3 short labels; headline: a tabloid headline if the answer is newsworthy, else null; followup: a pointed follow-up only if he dodged or said something explosive, else null.`, VSCHEMA, 2000);
  return {
    reaction: String(r.reaction).slice(0, 300), tone: (r.tone ?? []).slice(0, 3).map(t => String(t).slice(0, 24)),
    headline: r.headline ? String(r.headline).slice(0, 120) : undefined, followup: q.follow || !r.followup ? undefined : String(r.followup).slice(0, 300),
    guarantee: !!r.guarantee && !!c.next, fined: !!r.fined,
    effects: { fans: cl(r.fans, -5, 5), owner: cl(r.owner, -5, 5), locker: cl(r.locker, -5, 5), momentum: cl(r.momentum, -2, 2),
      players: (r.players ?? []).map(x => ({ pid: mine(L, x.player_id)!, delta: cl(x.delta, -15, 15) })).filter(x => x.pid).slice(0, 3) },
  };
}
