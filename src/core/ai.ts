// AI front offices between weeks: health and depth, plugging holes, team mode, trades.
import type { League } from './types';
import { Rng } from './rng';
import { autoDepth } from './league';
import { aiFillHoles } from './freeagency';
import { aiTrades, updateModes } from './trade';

export function aiWeekly(league: League, rng: Rng) {
  if (league.week % 4 === 1) updateModes(league);
  for (const t of Object.keys(league.teams)) {
    // The user's roster is the user's; it only gets an emergency body if a position is empty.
    if (t !== league.user || !Object.values(league.players).some(p => p.team === t && p.pos === 'QB' && p.status === 'ACT' && !p.injury)) aiFillHoles(league, t, rng);
    if (t !== league.user) autoDepth(league, t);
  }
  aiTrades(league, rng);
}
