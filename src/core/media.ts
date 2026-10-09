// The media and locker-room layer: fan support, the team's momentum going into the
// next game, and promises made in public (a guaranteed win, a promise to the owner)
// that pay off or backfire once that game is played. Press conferences and weekly
// action cards write here; the game sim and the weekly flow read it.
import type { League, Player } from './types';
import { clamp } from './rng';
import { news, mail } from './season';
import { coachHas } from './coaching';
import { facilityFans } from './facilities';

export interface Promise { kind: 'guarantee' | 'owner' | 'bench'; gid: string; stake: number; text: string; pid?: string }
export interface Media {
  /** Rating points added to the user's whole team next game (-3..+3). Spent when that game is played. */
  momentum: number;
  /** A team that has bulletin-board material on us: they get a bump when we play them. */
  bulletin?: string;
  promises: Promise[];
  /** Storylines a press conference started; they come back as weekly action cards. */
  fallout?: Fallout[];
  /** Season*100+week of the last public guarantee, for diminishing returns. */
  lastGuarantee?: number;
  /** Game ids whose press conference is done (taken or skipped). */
  pressed: string[];
}

export const media = (L: League): Media => ((L as League & { media?: Media }).media ??= { momentum: 0, promises: [], pressed: [] });
export const fans = (L: League) => (L as League & { fans?: number }).fans ?? 60;

export type FalloutKind = 'calledout' | 'praised' | 'fined' | 'media' | 'rally' | 'fans' | 'room' | 'traderequest';
export interface Fallout { kind: FalloutKind; key: number; pid?: string; quote?: string }
const now = (L: League) => L.season * 100 + L.week;
/** Record a storyline (one per kind and player), to surface on the Weekly Hub. */
export function fallout(L: League, f: Omit<Fallout, 'key'>) {
  const m = media(L), list = (m.fallout ??= []);
  if (list.some(x => x.kind === f.kind && x.pid === f.pid && x.key >= now(L) - 1)) return;
  list.push({ ...f, key: now(L) });
  if (list.length > 30) list.splice(0, list.length - 30);
}
/** Storylines still live: started this week or last week. */
export const liveFallout = (L: League) => (media(L).fallout ?? []).filter(f => f.key >= now(L) - 1);

export interface Effects { fans?: number; owner?: number; locker?: number; momentum?: number; players?: { pid: string; delta: number }[] }
export interface Applied { fans: number; owner: number; locker: number; momentum: number; players: { p: Player; delta: number }[] }

/** Apply a bundle of effects to the league, clamped to sane ranges, and report what actually moved. */
export function applyEffects(L: League, e: Effects): Applied {
  const f0 = fans(L), s0 = L.security, m = media(L), m0 = m.momentum;
  (L as League & { fans?: number }).fans = clamp(f0 + (e.fans ?? 0), 0, 100);
  L.security = clamp(L.security + (e.owner ?? 0), 0, 100);
  m.momentum = clamp(m0 + (e.momentum ?? 0), -3, 3);
  const players: Applied['players'] = [];
  if (e.locker) for (const p of Object.values(L.players)) if (p.team === L.user && p.status !== 'RET') p.morale = clamp(p.morale + e.locker * (0.6 + p.traits.ego / 250), 0, 100);
  for (const { pid, delta } of e.players ?? []) {
    const p = L.players[pid];
    if (!p || p.team !== L.user) continue;
    // Big egos feel praise and criticism more.
    const d = Math.round(delta * (0.7 + p.traits.ego / 160));
    p.morale = clamp(p.morale + d, 0, 100);
    players.push({ p, delta: d });
  }
  return { fans: fans(L) - f0, owner: L.security - s0, locker: e.locker ?? 0, momentum: m.momentum - m0, players };
}

export function teamMorale(L: League) {
  const r = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT');
  return r.length ? r.reduce((s, p) => s + p.morale, 0) / r.length : 70;
}

export function promise(L: League, pr: Promise) {
  const m = media(L);
  m.promises = m.promises.filter(x => !(x.kind === pr.kind && x.gid === pr.gid));
  m.promises.push(pr);
}

/** After the week's games: settle promises on games now played, spend momentum, drift fans and the owner. */
export function settleMedia(L: League) {
  const m = media(L);
  const played = (gid: string) => L.games.find(g => g.id === gid && g.result);
  const keep: Promise[] = [];
  for (const pr of m.promises) {
    const g = played(pr.gid);
    if (!g) { if (L.games.some(x => x.id === pr.gid)) keep.push(pr); continue; }
    const r = g.result!, us = g.home === L.user ? r.hs : r.as, them = g.home === L.user ? r.as : r.hs, won = us > them;
    const opp = L.teams[g.home === L.user ? g.away : g.home];
    if (pr.kind === 'guarantee') {
      applyEffects(L, won ? { fans: 1 + pr.stake, owner: 1, locker: 2 } : { fans: -(5 + pr.stake), owner: -(2 + pr.stake), locker: -2 });
      news(L, 'coach', won ? `${L.teams[L.user].coach.name} called his shot and delivered: ${L.teams[L.user].nick} ${us}, ${opp.nick} ${them}.` : `${L.teams[L.user].coach.name}'s guarantee goes up in smoke as the ${opp.nick} win ${them}-${us}.`, [L.user, opp.abbr], { big: true });
    } else if (pr.kind === 'owner') {
      applyEffects(L, { owner: won ? pr.stake : -pr.stake * 1.6 });
      mail(L, 'Owner', won ? 'Promise kept' : 'Promise broken', won ? `You said we would beat the ${opp.nick} and we did. That's the kind of leadership I pay for.` : `You promised me a win against the ${opp.nick}. I'll be remembering that.`);
    } else if (pr.kind === 'bench' && pr.pid) {
      const p = L.players[pr.pid], line = r.box?.players[pr.pid];
      if (p && line) {
        const good = (line.py ?? 0) + (line.ry ?? 0) + (line.recy ?? 0) > 90 || (line.dsk ?? 0) + (line.dint ?? 0) + (line.pd ?? 0) >= 2;
        applyEffects(L, { players: [{ pid: p.id, delta: good ? 6 : -4 }] });
      }
    }
  }
  m.promises = keep;
  const ug = L.games.find(g => g.season === L.season && g.week === L.week && (g.home === L.user || g.away === L.user) && g.result);
  if (ug) {
    m.momentum *= 0.25;   // a little carries over; most is spent on the game it was built for
    if (m.bulletin === (ug.home === L.user ? ug.away : ug.home)) m.bulletin = undefined;
    const r = ug.result!, won = (ug.home === L.user ? r.hs > r.as : r.as > r.hs);
    applyEffects(L, { fans: (won ? 1.5 : -1.5) + (coachHas(L, 'Media Darling') ? 0.5 : 0) + facilityFans(L) });
  }
  // Fans mostly follow the record; words and gestures only nudge them.
  const st = Object.values(L.games).filter(g => g.season === L.season && g.result && (g.home === L.user || g.away === L.user));
  if (st.length) {
    const w = st.filter(g => (g.home === L.user ? g.result!.hs > g.result!.as : g.result!.as > g.result!.hs)).length;
    const base = 40 + (w / st.length) * 40 + (L.phase === 'playoffs' ? 8 : 0);
    (L as League & { fans?: number }).fans = clamp(fans(L) + (base - fans(L)) * 0.12, 0, 100);
  }
  // The owner listens to the stands.
  const f = fans(L);
  if (f < 30) L.security = clamp(L.security - 1, 0, 100); else if (f > 85) L.security = clamp(L.security + 0.5, 0, 100);
  if (m.pressed.length > 60) m.pressed.splice(0, m.pressed.length - 60);
}

/** Momentum and bulletin-board bumps for one side of a game, in rating points. */
export function sideEdge(L: League, abbr: string, opp: string): number {
  const m = (L as League & { media?: Media }).media;
  if (!m) return 0;
  if (abbr === L.user) return m.momentum;
  if (opp === L.user && m.bulletin === abbr) return 1.2;
  return 0;
}
