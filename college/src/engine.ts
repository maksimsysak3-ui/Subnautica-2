// The live-game bridge: builds a two-team league in the shape the game engine and the pixel
// field renderer expect, from the college rosters, ratings (player cards) and your depth chart.
// The engine itself (play-by-play simulation, AI play calling, the animated field) is shared
// with the pro game; everything college-specific is converted here.
import type { League, Player as NflPlayer, Team, Game, Attr, Pos, OffScheme, DefScheme } from '../../src/core/types';
import { app } from '../../src/ui/store';
import { rosterOf, logo, logoDark, showColor, type School, type Player } from './data';
import { profile } from './player';
import { depthOf, STARTS } from './Team';

const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };
const engineCache = new Map<string, NflPlayer>();
const OFF: OffScheme[] = ['Spread', 'West Coast', 'Power Run', 'Wide Zone', 'Vertical'];
const DEF: DefScheme[] = ['4-3 Over', 'Cover 3', 'Two-High', 'Blitz', '3-4 Two-Gap'];

/** A college player as the engine sees him: the card's attributes in the engine's vocabulary. */
function toEngine(p: Player, abbr: string): NflPlayer {
  const a = profile(p).attrs;
  const v = (k: string, d = 50) => a[k] ?? d;
  const attrs = {
    SPD: v('SPD'), ACC: v('ACC'), AGI: v('AGI'), STR: v('STR'), JMP: Math.round((v('AGI') + v('SPD')) / 2) - 4, STA: v('STA'), INJ: v('INJ'), TGH: Math.round((v('STA') + v('STR')) / 2), AWR: v('AWR'),
    CAR: v('CAR'), BCV: v('BCV'), BTK: v('BTK'), TRK: Math.round((v('BTK') + v('STR')) / 2), ELU: v('JKM'),
    CTH: v('CTH'), CIT: v('CIT'), SPC: Math.round((v('CTH') + v('CIT')) / 2), RTE: Math.round((v('SRR') + v('DRR')) / 2), RLS: v('RLS'),
    THP: v('THP'), SAC: v('SAC'), MAC: v('MAC'), DAC: v('DAC'), TUP: v('TUP'), TOR: Math.round((v('MAC') + v('AGI')) / 2) - 4,
    PBK: v('PBK'), RBK: v('RBK'), IBL: v('IBL'), TAK: v('TAK'), HIT: v('POW'), PUR: v('PUR'), PRC: v('PRC'), BSH: v('BSH'), PMV: v('PMV'), FMV: v('FMV'),
    MCV: v('MCV'), ZCV: v('ZCV'), PRS: v('PRS'), KPW: v('KPW'), KAC: v('KAC'), RET: Math.round(v('SPD') * 0.9),
  } as Record<Attr, number>;
  const k = h(p.id);
  return {
    id: p.id, fn: p.fn, ln: p.ln, pos: p.pos as Pos, team: abbr, status: 'ACT', num: p.num, age: 17 + p.yr, born: 0, ht: p.ht, wt: p.wt, col: '', exp: p.yr - 1,
    draft: { year: 0, round: 0, pick: 0, team: '' }, attrs, ovr: p.ovr, pot: profile(p).pot, dev: 'Normal', arch: profile(p).arch, abil: [], contract: { years: [] }, stats: {}, post: {},
    cond: 100, morale: 70, xp: 0, traits: { work: 60, cons: 50 + (k % 30), clutch: 50, ego: 40, prone: 20 + (k % 30) }, motiv: [], awards: [], face: k % 1000, sform: 0,
  } as unknown as NflPlayer;
}

function toTeam(s: School, abbr: string, depth: Record<string, string[]>): Team {
  const k = h(s.school);
  const d: Partial<Record<Pos, string[]>> = {};
  for (const pos of [...Object.keys(STARTS), 'FB']) d[pos as Pos] = depthOf(s, depth, pos).map(p => p.id);
  return {
    abbr, name: s.school, nick: s.mascot, conf: 'AFC', div: s.conf, colors: [showColor(s), s.c2 || '#ffffff'], logo: logo(s.id), logoAlt: logoDark(s.id), wordmark: '',
    stadium: `${s.school} Stadium`, roof: 'outdoor', surface: 'grass',
    coach: { name: `${s.school} HC`, off: OFF[k % OFF.length], def: DEF[(k >>> 5) % DEF.length], aggr: 0.5 + ((k >>> 9) % 30) / 100, rating: 60 + s.prestige * 6, age: 50 },
    depth: d, dead: {}, rollover: 0, mode: 'balanced', plan: { off: 'Balanced', def: 'Balanced', practice: 'Normal' }, market: 2, warm: false, tradition: s.prestige / 5,
  } as Team;
}

/** Build the two-team league for a game, register it for the field renderer, and return it. */
export function gameLeague(home: School, away: School, userTeam: number, userDepth: Record<string, string[]>, show = true): { L: League; game: Game } {
  let ha = home.abbr, aa = away.abbr;
  if (ha === aa) aa = `${aa}2`;
  const players: Record<string, NflPlayer> = {};
  // Engine players are cached per rating (they change only as players develop); each game gets
  // fresh copies so in-game condition never leaks between games.
  const conv = (p: Player, abbr: string) => { const k = `${p.id}:${p.ovr}:${abbr}`; let e = engineCache.get(k); if (!e) engineCache.set(k, e = toEngine(p, abbr)); return { ...e, cond: 100 } as NflPlayer; };
  for (const p of rosterOf(home.id)) players[p.id] = conv(p, ha);
  for (const p of rosterOf(away.id)) players[p.id] = conv(p, aa);
  const teams: Record<string, Team> = {
    [ha]: toTeam(home, ha, home.id === userTeam ? userDepth : {}),
    [aa]: toTeam(away, aa, away.id === userTeam ? userDepth : {}),
  };
  const L = {
    version: 1, id: `college-${home.id}-${away.id}`, name: 'College', season: 2026, week: 1, phase: 'regular', user: home.id === userTeam ? ha : aa, gm: '',
    teams, players, games: [], picks: [], news: [], inbox: [], awards: [], history: [], cap: {}, seed: h(`${home.id}-${away.id}`), counter: 0,
    coachTree: { unlocked: [] }, scoutPoints: 0, security: 70, records: {}, difficulty: 'Pro', tradeDeadlineWeek: 99,
  } as unknown as League;
  const game: Game = { id: `cg-${home.id}-${away.id}`, season: 2026, week: 1, home: ha, away: aa };
  L.games.push(game);
  if (show) app.setLeague(L);
  return { L, game };
}
