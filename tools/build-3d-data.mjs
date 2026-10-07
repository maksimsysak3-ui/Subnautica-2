// Compact team + starter data for the standalone 3D game (app3d/data.json).
import { readFileSync, writeFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('src/data/league.json', 'utf8'));
const NEED = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 3, S: 2, K: 1, P: 1 };
const teams = d.teams.map(t => {
  const ps = d.players.filter(p => p.team === t.abbr);
  const roster = {};
  for (const [pos, n] of Object.entries(NEED)) roster[pos] = ps.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, n).map(p => ({ n: `${p.fn[0]}. ${p.ln}`, num: p.num ?? 0, ovr: p.ovr }));
  return { abbr: t.abbr, name: t.name, nick: t.nick, c: t.colors, logo: t.logo, roster };
});
writeFileSync('app3d/data.json', JSON.stringify({ teams }));
console.log('teams', teams.length, 'bytes', JSON.stringify({ teams }).length);
