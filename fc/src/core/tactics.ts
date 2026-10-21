import type { Club, Player, Pos, Tactic, World } from './types';
import { familiarity, posOvr } from './player';

/** Slot = [position, x (0 own goal .. 1 opponent goal), y (0 left touchline .. 1 right)] */
export type Slot = [Pos, number, number];
export const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['CM', .42, .3], ['CDM', .36, .5], ['CM', .42, .7], ['LW', .66, .14], ['ST', .72, .5], ['RW', .66, .86]],
  '4-2-3-1': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['CDM', .37, .38], ['CDM', .37, .62], ['LM', .56, .16], ['CAM', .56, .5], ['RM', .56, .84], ['ST', .72, .5]],
  '4-4-2': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['LM', .46, .14], ['CM', .42, .38], ['CM', .42, .62], ['RM', .46, .86], ['ST', .7, .38], ['ST', .7, .62]],
  '4-1-2-1-2': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['CDM', .35, .5], ['CM', .44, .3], ['CM', .44, .7], ['CAM', .56, .5], ['ST', .7, .38], ['ST', .7, .62]],
  '4-1-4-1': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['CDM', .35, .5], ['LM', .5, .14], ['CM', .47, .36], ['CM', .47, .64], ['RM', .5, .86], ['ST', .72, .5]],
  '3-5-2': [['GK', .04, .5], ['CB', .21, .28], ['CB', .2, .5], ['CB', .21, .72], ['LM', .45, .1], ['CDM', .36, .5], ['CM', .45, .32], ['CM', .45, .68], ['RM', .45, .9], ['ST', .7, .38], ['ST', .7, .62]],
  '3-4-3': [['GK', .04, .5], ['CB', .21, .28], ['CB', .2, .5], ['CB', .21, .72], ['LM', .44, .12], ['CM', .41, .38], ['CM', .41, .62], ['RM', .44, .88], ['LW', .66, .2], ['ST', .72, .5], ['RW', .66, .8]],
  '5-3-2': [['GK', .04, .5], ['LB', .27, .08], ['CB', .2, .3], ['CB', .19, .5], ['CB', .2, .7], ['RB', .27, .92], ['CM', .43, .3], ['CDM', .38, .5], ['CM', .43, .7], ['ST', .68, .38], ['ST', .68, .62]],
  '4-2-2-2': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['CDM', .37, .38], ['CDM', .37, .62], ['CAM', .55, .25], ['CAM', .55, .75], ['ST', .71, .38], ['ST', .71, .62]],
  '4-3-2-1': [['GK', .04, .5], ['LB', .25, .14], ['CB', .21, .37], ['CB', .21, .63], ['RB', .25, .86], ['CM', .41, .28], ['CDM', .37, .5], ['CM', .41, .72], ['CAM', .58, .33], ['CAM', .58, .67], ['ST', .72, .5]],
};

export const ROLES: Partial<Record<Pos, string[]>> = {
  GK: ['Goalkeeper', 'Sweeper Keeper'],
  CB: ['Defender', 'Ball-Playing CB', 'Stopper'],
  RB: ['Full-Back', 'Wing-Back', 'Inverted Full-Back'], LB: ['Full-Back', 'Wing-Back', 'Inverted Full-Back'],
  CDM: ['Holding', 'Deep-Lying Playmaker', 'Ball Winner'],
  CM: ['Box-to-Box', 'Playmaker', 'Mezzala', 'Holding'],
  CAM: ['Playmaker', 'Shadow Striker', 'Half-Winger'],
  RM: ['Wide Midfielder', 'Winger', 'Inside Forward'], LM: ['Wide Midfielder', 'Winger', 'Inside Forward'],
  RW: ['Winger', 'Inside Forward', 'Wide Playmaker'], LW: ['Winger', 'Inside Forward', 'Wide Playmaker'],
  ST: ['Advanced Forward', 'Target Forward', 'Poacher', 'False 9', 'Pressing Forward'],
};
export const ROLE_INFO: Record<string, string> = {
  'Goalkeeper': 'Stays on his line and distributes safely.',
  'Sweeper Keeper': 'Starts attacks with his feet and sweeps behind a high line.',
  'Defender': 'Solid, simple defending.', 'Ball-Playing CB': 'Steps into midfield and breaks lines with passes.', 'Stopper': 'Aggressively steps out to win the ball early.',
  'Full-Back': 'Balanced: defends first, supports wide.', 'Wing-Back': 'Bombs forward and delivers crosses.', 'Inverted Full-Back': 'Tucks into midfield in possession.',
  'Holding': 'Screens the back line and keeps it simple.', 'Deep-Lying Playmaker': 'Dictates tempo from deep with long passes.', 'Ball Winner': 'Hunts the ball and breaks up play.',
  'Box-to-Box': 'Covers every blade of grass, arrives late in the box.', 'Playmaker': 'Looks for the killer pass between the lines.', 'Mezzala': 'Drifts into the half-space to create and shoot.',
  'Shadow Striker': 'Runs beyond the striker to score.', 'Half-Winger': 'Roams wide from a central spot.',
  'Wide Midfielder': 'Works the flank both ways.', 'Winger': 'Stays wide, beats his man and crosses.', 'Inside Forward': 'Cuts inside onto his stronger foot to shoot.', 'Wide Playmaker': 'Drifts inside to create.',
  'Advanced Forward': 'Leads the line and runs in behind.', 'Target Forward': 'Wins headers and holds the ball up.', 'Poacher': 'Lives on the shoulder of the last defender.', 'False 9': 'Drops deep to link play.', 'Pressing Forward': 'Leads the press from the front.',
};

export const slotsOf = (t: Tactic) => FORMATIONS[t.formation] ?? FORMATIONS['4-3-3'];

export function defaultTactic(formation = '4-3-3'): Tactic {
  return { formation, lineup: [], bench: [], roles: FORMATIONS[formation].map(s => ROLES[s[0]]![0]), mentality: 0, pressing: 50, line: 50, width: 50, tempo: 50, directness: 40, counter: false, offside: false, timeWaste: false };
}

export const available = (p: Player) => !p.inj && p.ban <= 0;

/** Effective rating of a player in a slot (position familiarity, fitness). */
export function slotRating(p: Player, slot: Pos) {
  const base = p.pos === slot ? p.ovr : Math.max(posOvr(p.attrs, slot), 0) * familiarity(p, slot);
  return base;
}

/** Greedy best XI for a formation, strongest slots first; then a bench of 9 covering positions. */
export function autoPick(world: World, club: Club, keepFormation = true): void {
  const t = club.tactic;
  if (!keepFormation) t.formation = bestFormation(world, club);
  const slots = slotsOf(t);
  const pool = club.squad.map(id => world.players[id]).filter(p => p && available(p) && !(p.loan && p.club !== club.id));
  const used = new Set<number>();
  const lineup: number[] = new Array(slots.length).fill(-1);
  const order = slots.map((s, i) => i).sort((a, b) => (slots[a][0] === 'GK' ? -1 : 0) - (slots[b][0] === 'GK' ? -1 : 0));
  for (const i of order) {
    const pos = slots[i][0];
    let best: Player | null = null, bv = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const v = slotRating(p, pos) * (0.82 + Math.min(p.fitness, 100) * 0.0018);
      if (v > bv) { bv = v; best = p; }
    }
    if (best) { lineup[i] = best.id; used.add(best.id); }
  }
  t.lineup = lineup.filter(x => x >= 0).length === slots.length ? lineup : lineup.map(x => x);
  const rest = pool.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  const bench: number[] = [];
  const gk = rest.find(p => p.pos === 'GK');
  if (gk) bench.push(gk.id);
  for (const p of rest) { if (bench.length >= 9) break; if (!bench.includes(p.id)) bench.push(p.id); }
  t.bench = bench;
  if (t.roles.length !== slots.length) t.roles = slots.map(s => ROLES[s[0]]![0]);
  const xi = t.lineup.map(id => world.players[id]).filter(Boolean);
  const byOvr = [...xi].sort((a, b) => b.ovr - a.ovr);
  if (!t.captain || !t.lineup.includes(t.captain)) t.captain = [...xi].sort((a, b) => (b.ovr + (b.born < 1996 ? 4 : 0)) - (a.ovr + (a.born < 1996 ? 4 : 0)))[0]?.id;
  const shooter = [...xi].filter(p => p.pos !== 'GK').sort((a, b) => b.attrs[7] + b.attrs[2] - a.attrs[7] - a.attrs[2])[0];
  if (!t.pens || !t.lineup.includes(t.pens)) t.pens = shooter?.id;
  const fk = [...xi].filter(p => p.pos !== 'GK').sort((a, b) => b.attrs[13] + b.attrs[12] - a.attrs[13] - a.attrs[12])[0];
  if (!t.fks || !t.lineup.includes(t.fks)) t.fks = fk?.id;
  const cr = [...xi].filter(p => p.pos !== 'GK').sort((a, b) => b.attrs[9] + b.attrs[12] - a.attrs[9] - a.attrs[12])[0];
  if (!t.corners || !t.lineup.includes(t.corners)) t.corners = cr?.id;
  void byOvr;
}

/** Pick the formation that gets the most rating out of the squad. */
export function bestFormation(world: World, club: Club): string {
  const pool = club.squad.map(id => world.players[id]).filter(p => p && available(p));
  let best = '4-3-3', bv = -1;
  for (const [name, slots] of Object.entries(FORMATIONS)) {
    const used = new Set<number>();
    let tot = 0;
    for (const [pos] of slots) {
      let b: Player | null = null, v = -1;
      for (const p of pool) { if (used.has(p.id)) continue; const r = slotRating(p, pos); if (r > v) { v = r; b = p; } }
      if (b) { used.add(b.id); tot += v; }
    }
    const bias = name === '4-3-3' || name === '4-2-3-1' ? 3 : name === '4-4-2' ? 1 : 0;
    if (tot + bias > bv) { bv = tot + bias; best = name; }
  }
  return best;
}

/** Team strength summary for previews and quick sims. */
export function teamRatings(world: World, club: Club) {
  const slots = slotsOf(club.tactic);
  let att = 0, mid = 0, def = 0, na = 0, nm = 0, nd = 0, gk = 60;
  club.tactic.lineup.forEach((id, i) => {
    const p = world.players[id];
    if (!p) return;
    const pos = slots[i][0];
    const r = slotRating(p, pos) * (0.85 + p.fitness * 0.0015);
    if (pos === 'GK') gk = r;
    else if (pos === 'ST' || pos === 'LW' || pos === 'RW' || pos === 'CAM') { att += r; na++; }
    else if (pos === 'CB' || pos === 'LB' || pos === 'RB') { def += r; nd++; }
    else { mid += r; nm++; }
  });
  const A = na ? att / na : 60, M = nm ? mid / nm : 60, D = nd ? (def / nd) * 0.8 + gk * 0.2 : 60;
  return { att: Math.round(A), mid: Math.round(M), def: Math.round(D), ovr: Math.round(A * 0.33 + M * 0.33 + D * 0.34), gk: Math.round(gk) };
}
