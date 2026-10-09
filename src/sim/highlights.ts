// The plays worth replaying: touchdowns, turnovers, explosive gains, fourth-down calls,
// third-down sacks and late scores. Returns the top ones in game order.
import type { PlayEvent } from './game';

export function highlightScore(e: PlayEvent): number {
  if (!['run', 'pass', 'sack', 'scramble'].includes(e.type)) return 0;
  let s = 0;
  if (e.td) s += 10 + Math.min(10, e.yards / 6);
  if (e.turnover) s += 9;
  if (e.yards >= 20) s += e.yards / 4;
  if (e.down === 4) s += e.yards >= e.togo && !e.turnover ? 5 : 4;
  if (e.type === 'sack') s += e.down === 3 ? 4 : 2;
  if (e.q >= 4 && e.clock <= 300 && (e.td || e.turnover)) s += 6;
  return s;
}
export function pickHighlights(events: PlayEvent[], n = 5): PlayEvent[] {
  return events.map(e => ({ e, s: highlightScore(e) })).filter(x => x.s >= 6).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.e).sort((a, b) => a.n - b.n);
}
