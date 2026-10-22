import logos from '../data/logos.json';
import { CLUB_META, KIT_EXTRA } from '../data/clubs';
import { ENG } from '../data/sq-eng';
import { ESP } from '../data/sq-esp';
import { GER } from '../data/sq-ger';
import { ITA } from '../data/sq-ita';
import { FRA } from '../data/sq-fra';
import { WORLD } from '../data/sq-world';
import { COUNTRY_NAT, NAT_MIX } from '../data/nations';
import type { Club, Player, Pos, World } from './types';
import { clamp, gauss, hash, makeRng, rand, reseed, rint, weighted, pick, chance } from './rng';
import { fairWage, genName, newPlayerShell, rollPotential, marketValue } from './player';
import { autoPick, bestFormation, defaultTactic } from './tactics';

export const START_SEASON = 2026;
export const LOGO_BASE = 'https://assets.football-logos.cc/logos';
type LogoRow = [string, string, string, string];
const LOGOS = (logos as unknown as { clubs: Record<string, LogoRow>; leagues: Record<string, [string, string]> });
export const logoUrl = (country: string, slug: string, hashv: string, size = 256) => `${LOGO_BASE}/${country}/${size}x${size}/${slug}.${hashv}.png`;
export const leagueLogo = (league: string) => { const l = LOGOS.leagues[league]; return l ? logoUrl(l[0], league, l[1]) : ''; };

export const LEAGUES: { id: string; name: string; short: string; country: string; tier: 1 | 2; color: string; up?: string; relegate: number; ucl: number; uel: number; wealth: number }[] = [
  { id: 'english-premier-league', name: 'Premier League', short: 'EPL', country: 'england', tier: 1, color: '#3d195b', up: 'efl-championship', relegate: 3, ucl: 5, uel: 2, wealth: 1.6 },
  { id: 'la-liga', name: 'LaLiga', short: 'LL', country: 'spain', tier: 1, color: '#ee8707', up: 'la-liga-2', relegate: 3, ucl: 5, uel: 2, wealth: 1.0 },
  { id: 'bundesliga', name: 'Bundesliga', short: 'BL', country: 'germany', tier: 1, color: '#d20515', up: '2-bundesliga', relegate: 2, ucl: 4, uel: 2, wealth: 1.0 },
  { id: 'serie-a', name: 'Serie A', short: 'SA', country: 'italy', tier: 1, color: '#008fd7', up: 'serie-b', relegate: 3, ucl: 4, uel: 2, wealth: 0.95 },
  { id: 'ligue-1', name: 'Ligue 1', short: 'L1', country: 'france', tier: 1, color: '#dae025', up: 'ligue-2', relegate: 2, ucl: 3, uel: 2, wealth: 0.8 },
  { id: 'efl-championship', name: 'Championship', short: 'EFL', country: 'england', tier: 2, color: '#0b2b5c', relegate: 0, ucl: 0, uel: 0, wealth: 0.5 },
  { id: 'la-liga-2', name: 'LaLiga 2', short: 'LL2', country: 'spain', tier: 2, color: '#6d3b8f', relegate: 0, ucl: 0, uel: 0, wealth: 0.3 },
  { id: '2-bundesliga', name: '2. Bundesliga', short: 'BL2', country: 'germany', tier: 2, color: '#8a0a12', relegate: 0, ucl: 0, uel: 0, wealth: 0.35 },
  { id: 'serie-b', name: 'Serie B', short: 'SB', country: 'italy', tier: 2, color: '#1e5b9e', relegate: 0, ucl: 0, uel: 0, wealth: 0.3 },
  { id: 'ligue-2', name: 'Ligue 2', short: 'L2', country: 'france', tier: 2, color: '#0e3e7a', relegate: 0, ucl: 0, uel: 0, wealth: 0.25 },
];
export const WEALTH: Record<string, number> = { england: 1.6, spain: 1.0, germany: 1.0, italy: 0.95, france: 0.8, 'saudi-arabia': 1.5, usa: 0.6, portugal: 0.45, netherlands: 0.45, turkey: 0.55, brazil: 0.35, argentina: 0.25 };

const SQUADS: Record<string, string> = { ...ENG, ...ESP, ...GER, ...ITA, ...FRA, ...WORLD };

/** Squad template: how many of each position a full squad carries. */
const TEMPLATE: [Pos, number][] = [['GK', 3], ['CB', 4], ['RB', 2], ['LB', 2], ['CDM', 2], ['CM', 3], ['CAM', 2], ['RW', 2], ['LW', 2], ['ST', 3]];
const posGroup = (p: Pos): Pos => p === 'RM' ? 'RW' : p === 'LM' ? 'LW' : p;

/** Typical overall of a squad's first-choice players from club reputation. */
export const squadLevel = (rep: number) => 52 + rep * 0.3;

function hashColor(s: string, sat = 60, light = 42) { return `hsl(${hash(s) % 360} ${sat}% ${light}%)`; }

export function createWorld(userClub: string, manager: string, seed = Date.now() % 1e9): World {
  reseed(seed);
  const w: World = {
    version: 1, seed, season: START_SEASON, day: 0, user: userClub, manager, clubs: {}, players: {}, nextPid: 1, comps: {}, fixtures: [], nextFx: 1,
    news: [], nextNews: 1, offers: [], nextOffer: 1, transfers: [], freeAgents: [], board: { confidence: 70, objective: '', objectiveRank: 10, cupTarget: '', warnings: 0 },
    history: [], shortlist: [], awards: [], training: { focus: 'Balanced', intensity: 50 }, settings: { speed: 1, sound: true, cinematics: true },
  };
  for (const [slug, row] of Object.entries(LOGOS.clubs)) {
    const [country, h, cname, league] = row;
    const lg = LEAGUES.find(l => l.id === league);
    const meta = CLUB_META[slug];
    const tier: 0 | 1 | 2 = lg ? lg.tier : 0;
    if (tier === 2 && slug === 'deportivo-la-coruna') continue;
    const rep = meta?.rep ?? (tier === 2 ? 52 + Math.round(rand() * 10) : 55);
    const c1 = meta?.c1 ?? hashColor(slug, 62, 40), c2 = meta?.c2 ?? '#FFFFFF';
    const club: Club = {
      id: slug, name: meta?.name ?? cname, short: meta?.short ?? cname.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), country, league: lg ? league : 'world', rep,
      c1, c2, a1: meta?.a1 ?? c2, a2: meta?.a2 ?? c1, kit: meta?.kit ?? 'plain', stadium: meta?.stadium ?? `${cname} Stadium`, cap: meta?.cap ?? 15000 + Math.round(rand() * 20000),
      logo: logoUrl(country, slug, h), budget: 0, wageBudget: 0, balance: 0, squad: [], tactic: defaultTactic(), youth: clamp(Math.round(rep / 12 + rand() * 3), 2, 10), facilities: clamp(Math.round(rep / 11 + rand() * 2), 2, 10),
      shorts: KIT_EXTRA[slug]?.[0], socks: KIT_EXTRA[slug]?.[1],
      fans: 65, form: [], fin: { tv: 0, gate: 0, prize: 0, merch: 0, transfersIn: 0, transfersOut: 0, wages: 0 }, tier, trophies: [],
    };
    if (tier === 2) club.strength = squadLevel(rep) - 2.5 + gauss() * 1.5;
    w.clubs[slug] = club;
  }
  // real players
  const seen = new Set<string>();
  for (const [slug, text] of Object.entries(SQUADS)) {
    const club = w.clubs[slug];
    if (!club) continue;
    for (const line of text.split('\n')) {
      const [name, pos, yob, nat, ovrS] = line.split('|');
      const ovr = +ovrS;
      if (!name || !ovr || ovr < 40 || seen.has(name)) continue;
      seen.add(name);
      const born = +yob;
      const p = newPlayerShell(w.nextPid++, name, nat, pos as Pos, born, ovr, 0, true, hash(name));
      p.pot = rollPotential(p.ovr, START_SEASON - born, 0);
      sign(w, p, club, true);
    }
  }
  for (const club of Object.values(w.clubs)) if (club.tier !== 2) fillSquad(w, club);
  for (const club of Object.values(w.clubs)) setupFinances(w, club, true);
  for (const club of Object.values(w.clubs)) if (club.tier !== 2) { club.tactic.formation = bestFormation(w, club); club.tactic.roles = []; autoPick(w, club); }
  // a pool of out-of-contract players
  for (let i = 0; i < 60; i++) {
    const nat = pick(['ENG', 'ESP', 'FRA', 'GER', 'ITA', 'BRA', 'ARG', 'NED', 'POR', 'NGA', 'SEN', 'DEN']);
    const pos = weighted(TEMPLATE, t => t[1])[0];
    const age = rint(23, 34);
    const p = genPlayer(w, nat, pos, START_SEASON - age, 62 + Math.round(rand() * 12));
    p.club = null; p.contract = START_SEASON; p.wage = 0;
    w.freeAgents.push(p.id);
  }
  return w;
}

export function genPlayer(w: World, nat: string, pos: Pos, born: number, ovr: number, potBonus = 0): Player {
  const id = w.nextPid++;
  const name = genName(nat);
  const p = newPlayerShell(id, name, nat, pos, born, Math.round(clamp(ovr, 40, 92)), 0, false, (w.seed ^ (id * 2654435761)) >>> 0);
  p.pot = rollPotential(p.ovr, w.season - born, potBonus);
  w.players[id] = p;
  return p;
}

export function natFor(country: string): string {
  const base = COUNTRY_NAT[country] ?? 'ENG';
  const mix = NAT_MIX[base];
  if (!mix) return chance(0.7) ? base : pick(['BRA', 'ARG', 'FRA', 'POR', 'ESP', 'NGA', 'SEN', 'CIV', 'GHA', 'SRB', 'CRO', 'NED']);
  return weighted(mix, m => m[1])[0];
}

/** Top up a club to a full 25-man squad with generated depth and academy players. */
export function fillSquad(w: World, club: Club, size = 25) {
  const level = club.tier === 2 || club.strength ? (club.strength ?? squadLevel(club.rep)) : squadLevel(club.rep);
  const counts: Record<string, number> = {};
  for (const id of club.squad) { const g = posGroup(w.players[id].pos); counts[g] = (counts[g] ?? 0) + 1; }
  const realOvrs = club.squad.map(id => w.players[id].ovr).sort((a, b) => b - a);
  const firstTeam = realOvrs.length >= 11 ? realOvrs[10] : level;
  for (const [pos, n] of TEMPLATE) {
    while ((counts[pos] ?? 0) < n && club.squad.length < size + 2) {
      const have = counts[pos] ?? 0;
      const young = chance(0.35);
      const age = young ? rint(17, 20) : rint(21, 32);
      const starter = have === 0 && realOvrs.length < 11;
      let ovr = (starter ? level : Math.min(level, firstTeam) - 4) + gauss() * 3 - (young ? 6 : 0) - (pos === 'GK' && have >= 1 ? 5 : 0);
      ovr = clamp(ovr, 45, 86);
      const p = genPlayer(w, natFor(club.country), pos, w.season - age, ovr, young ? club.youth * 0.6 : 0);
      sign(w, p, club, true);
      counts[pos] = have + 1;
    }
  }
  while (club.squad.length < size) {
    const pos = weighted(TEMPLATE, t => t[1])[0];
    const age = rint(17, 21);
    const p = genPlayer(w, natFor(club.country), pos, w.season - age, level - 9 + gauss() * 3, club.youth * 0.7);
    sign(w, p, club, true);
  }
}

/** Put a player on a club's books with a sensible contract, wage and shirt number. */
export function sign(w: World, p: Player, club: Club, initial = false, years?: number, wage?: number) {
  w.players[p.id] = p;
  if (p.club && w.clubs[p.club]) { const old = w.clubs[p.club]; old.squad = old.squad.filter(x => x !== p.id); removeFromTactic(old, p.id); }
  w.freeAgents = w.freeAgents.filter(x => x !== p.id);
  p.club = club.id;
  if (!club.squad.includes(p.id)) club.squad.push(p.id);
  const age = w.season - p.born;
  p.contract = w.season + (years ?? (initial ? clamp(Math.round(1 + rand() * (age < 24 ? 4.5 : age < 30 ? 3.5 : 1.6)), 1, 5) : 3));
  p.wage = wage ?? Math.round(fairWage(p, club.rep, w.season) * (initial ? 0.85 + rand() * 0.35 : 1));
  p.num = shirtNumber(w, club, p);
  p.listed = false;
  p.morale = clamp(p.morale + (initial ? 0 : 10), 0, 100);
  if (!p.valueHist.length) p.valueHist.push(marketValue(p, w.season));
}

export function removeFromTactic(club: Club, pid: number) {
  const t = club.tactic;
  const i = t.lineup.indexOf(pid);
  if (i >= 0) t.lineup[i] = -1;
  t.bench = t.bench.filter(x => x !== pid);
}

const PREF: Record<Pos, number[]> = { GK: [1, 13, 31, 25, 99], RB: [2, 22, 12, 24], LB: [3, 12, 23, 26], CB: [4, 5, 6, 15, 16, 24, 32, 33], CDM: [6, 16, 8, 18, 21], CM: [8, 14, 18, 20, 21, 27], CAM: [10, 7, 14, 19, 21], RM: [7, 17, 11], LM: [11, 17, 7], RW: [7, 11, 17, 19, 77], LW: [11, 7, 17, 19, 77], ST: [9, 19, 18, 20, 29, 39] };
function shirtNumber(w: World, club: Club, p: Player) {
  const used = new Set(club.squad.filter(id => id !== p.id).map(id => w.players[id]?.num));
  for (const n of PREF[p.pos]) if (!used.has(n)) return n;
  for (let n = 2; n < 99; n++) if (!used.has(n)) return n;
  return 99;
}

export function setupFinances(w: World, club: Club, initial: boolean) {
  const wealth = LEAGUES.find(l => l.id === club.league)?.wealth ?? WEALTH[club.country] ?? 0.35;
  const wages = club.squad.reduce((s, id) => s + (w.players[id]?.wage ?? 0), 0);
  club.wageBudget = Math.round(wages * (1.06 + club.rep / 900) / 1000) * 1000;
  const r = Math.max(0, club.rep - 50);
  const budget = Math.max(1.5e6, r * r * 52000 * wealth * (0.85 + (hash(club.id + w.season) % 1000) / 1000 * 0.3));
  club.budget = Math.round(budget / 5e5) * 5e5;
  if (initial) club.balance = club.budget * 1.5 + 20e6 * wealth;
}

export function seededFace(p: Player) { return makeRng(hash(p.name) ^ p.id); }
