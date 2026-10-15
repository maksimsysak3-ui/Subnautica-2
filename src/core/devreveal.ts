// Hidden development traits. A rookie's dev trait is a secret (to you and to him) until he has
// earned enough XP in practice and games to show what he is. Then it's revealed, once, with
// some ceremony (the weekly hub plays the reveal for your own players).
import type { Dev, League, Player } from './types';

/** Earned XP needed to reveal: about half a season for a starter, most of one for a backup. */
export const DEV_REVEAL_XP = 450;
export type ShownDev = Dev | 'Hidden';
export const shownDev = (p: Player): ShownDev => (p.devHidden ? 'Hidden' : p.dev);
export const devRank = (d: ShownDev) => ({ Hidden: -1, Normal: 0, Star: 1, Superstar: 2, 'X-Factor': 3 }[d]);

export interface DevReveal { pid: string; dev: Dev; season: number; week: number; seen?: boolean }
const reveals = (league: League) => ((league as League & { devReveals?: DevReveal[] }).devReveals ??= []);
export const pendingReveals = (league: League) => reveals(league).filter(r => !r.seen && league.players[r.pid]?.team === league.user);
export const markRevealsSeen = (league: League) => { for (const r of reveals(league)) r.seen = true; };
export const revealProgress = (p: Player) => Math.min(1, (p.devXp ?? 0) / DEV_REVEAL_XP);

/**
 * Called when banked XP is about to be spent: whatever he earned since the last spend counts
 * toward the reveal.
 */
export function trackDevXp(league: League | undefined, p: Player) {
  const earned = Math.max(0, p.xp - (p.xpLeft ?? 0));
  if (!p.devHidden) return;
  p.devXp = (p.devXp ?? 0) + earned;
  if (p.devXp < DEV_REVEAL_XP) return;
  p.devHidden = false;
  if (league) {
    const list = reveals(league);
    list.push({ pid: p.id, dev: p.dev, season: league.season, week: league.week });
    if (list.length > 80) list.splice(0, list.length - 80);
  }
}
