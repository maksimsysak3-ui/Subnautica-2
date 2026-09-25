/**
 * The development tree: what a city can learn to build, and in what order.
 *
 * Built from the library rather than written out by hand. Every service
 * building in the game belongs to a branch and has a price, and those two facts
 * are enough to lay out a tree that is complete by construction: a building
 * that exists is reachable, a building that is added appears, and there is no
 * second list to keep in step with the first. What is authored here is the
 * *shape* -- which branch a player starts with, how a branch is tiered, and what
 * each tier costs in stars.
 *
 * THE SHAPE.
 *
 *   Every branch opens with a root node holding its cheapest building or two.
 *   Three of those roots -- power, water and sewage -- are open from the first
 *   minute, because a city that cannot switch the lights on is not a game.
 *
 *   After the root, a branch runs outward in tiers of rising price. A tier is
 *   one node holding one or two buildings, and it needs the tier before it.
 *
 *   Landmarks are not in the tree. They are handed over by levelling up, which
 *   is the other half of the progression and the reason a level-up is worth
 *   watching.
 */

import { ASSETS } from '../assets/registry';
import { BRANCHES } from '../assets/types';
import { buildingPrice } from './costs';
import type { AssetDef } from '../assets/types';

export interface TechNode {
  id: string;
  /** Service branch this belongs to. */
  branch: string;
  name: string;
  /** Stars to buy it. Zero for the roots a city starts with. */
  cost: number;
  /** Nodes that must be bought first. */
  needs: string[];
  /** Asset ids it hands over. */
  assets: string[];
  /** Column in the branch's own layout, and which row of that column. */
  tier: number;
  row: number;
  blurb: string;
  /** True for the three a city begins with. */
  free: boolean;
}

/** Branches a city can switch on before it has earned anything. */
const FREE_ROOTS = new Set(['power', 'water', 'sewage']);

/** What a tier costs in stars, by how far along the branch it is. */
const TIER_COST = [0, 1, 2, 2, 3, 3, 4, 4, 5];

/** Human names for the branches, since the asset data uses lowercase keys. */
export const BRANCH_LABEL: Record<string, string> = {
  power: 'Electricity', water: 'Water', sewage: 'Sewage', fire: 'Fire',
  police: 'Police', health: 'Healthcare', education: 'Education',
  transport: 'Transport', government: 'Government', parks: 'Parks',
  deathcare: 'Deathcare', post: 'Post',
};

/** The order the branches are shown in: the necessities first. */
/**
 * The city level each branch opens at.
 *
 * Stars say which buildings of a branch a city has learned; the level says
 * whether the city is big enough to run that branch at all. Supply first --
 * a town needs power, water and drains before it needs anything -- then the
 * services a growing town is judged on in the order it is judged on them,
 * and last the ones that only a real city runs: its buses and trams, its
 * government, its post.
 */
export const BRANCH_LEVEL: Record<string, number> = {
  power: 1, water: 1, sewage: 1,
  fire: 2,
  health: 3, parks: 3,
  police: 4,
  education: 5,
  deathcare: 6,
  transport: 8,
  government: 9, post: 9,
};

/** The level a branch opens at. */
export function branchLevel(branch: string): number {
  return BRANCH_LEVEL[branch] ?? 1;
}

export const BRANCH_ORDER = [
  'power', 'water', 'sewage', 'fire', 'police', 'health', 'education',
  'transport', 'parks', 'government', 'deathcare', 'post',
];

/**
 * How wide each tier of a branch is.
 *
 * One root, then it fans: two ways out of the basics, two or three past that.
 * A tree that is a single line is a list with circles drawn on it -- there is
 * no choice in it, so there is nothing to look at and nothing to decide. The
 * fan is the whole point: a city that wants a hospital and a city that wants a
 * university spend their stars in different places and end up different.
 */
const FAN = [1, 2, 2, 3, 3, 3];

/** Splits a branch's buildings into tiers of rising width. */
function tiersOf(count: number): number[][] {
  const order: number[] = [];
  for (let i = 0; i < count; i++) order.push(i);
  const tiers: number[][] = [];
  let at = 0;
  for (let t = 0; at < count; t++) {
    const width = Math.min(FAN[Math.min(t, FAN.length - 1)], count - at);
    tiers.push(order.slice(at, at + width));
    at += width;
  }
  return tiers;
}

// Services added after saves existed stay outside the tree: a node is named by
// its place in its branch, so slotting a new building in renumbers every node
// after it and a saved city would find it had bought something else.
const OUTSIDE_TREE = new Set(['svc.waste.landfill', 'svc.parks.community', 'svc.parks.youth']);

function build(): TechNode[] {
  const byBranch = new Map<string, AssetDef[]>();
  for (const a of ASSETS) {
    if (a.zone !== 'service' || a.branch === undefined) continue;
    // Outside the tree, so adding it renumbered nothing a save had bought:
    // it is the town's first rubbish answer and open from the start.
    if (OUTSIDE_TREE.has(a.id)) continue;
    const list = byBranch.get(a.branch) ?? [];
    list.push(a);
    byBranch.set(a.branch, list);
  }

  const nodes: TechNode[] = [];
  for (const branch of BRANCHES) {
    const list = (byBranch.get(branch) ?? [])
      .sort((a, b) => buildingPrice(a) - buildingPrice(b));
    if (list.length === 0) continue;

    // A fan rather than a chain: the tiers get wider, and each node hangs off
    // one in the tier before it.
    const tiers = tiersOf(list.length);
    let previousIds: string[] = [];
    for (let t = 0; t < tiers.length; t++) {
      const row = tiers[t];
      const ids: string[] = [];
      for (let k = 0; k < row.length; k++) {
        const def = list[row[k]];
        const id = `${branch}.${t}.${k}`;
        const free = t === 0 && FREE_ROOTS.has(branch);
        // Hung off the parent above it, so a wide tier spreads over the one
        // before it rather than everything hanging off the same node.
        const parent = previousIds.length === 0 ? []
          : [previousIds[Math.min(previousIds.length - 1,
            Math.floor((k * previousIds.length) / row.length))]];
        nodes.push({
          id,
          branch,
          name: t === 0
            ? `Basic ${BRANCH_LABEL[branch]?.toLowerCase() ?? branch} services`
            : def.name,
          cost: t === 0 ? (free ? 0 : 1)
            : (TIER_COST[Math.min(t, TIER_COST.length - 1)] ?? 5),
          needs: parent,
          assets: [def.id],
          tier: t,
          row: k,
          blurb: t === 0
            ? `Everything a city needs to start ${verbFor(branch)}.`
            : def.note,
          free,
        });
        ids.push(id);
      }
      previousIds = ids;
    }
  }
  return nodes;
}

function verbFor(branch: string): string {
  switch (branch) {
    case 'power': return 'generating and distributing electricity';
    case 'water': return 'drawing and pumping water';
    case 'sewage': return 'taking its waste away';
    case 'fire': return 'putting fires out';
    case 'police': return 'keeping order';
    case 'health': return 'treating the sick';
    case 'education': return 'teaching its children';
    case 'transport': return 'moving people about';
    case 'parks': return 'giving people somewhere to go';
    case 'government': return 'governing itself';
    case 'deathcare': return 'burying its dead';
    case 'post': return 'delivering the post';
    default: return 'running this service';
  }
}

export const TECH: TechNode[] = build();

/** One node by id. */
export const TECH_BY_ID = new Map(TECH.map((n) => [n.id, n]));

/** Which node hands over an asset, for the tools that ask whether it is open. */
export const NODE_OF_ASSET = new Map<string, TechNode>();
for (const n of TECH) for (const a of n.assets) NODE_OF_ASSET.set(a, n);

/**
 * The landmarks a level hands over.
 *
 * Signature buildings, cheapest first, spread over the levels: two a level from
 * the second, so there is always something new on the other side of a level-up
 * and a player who is chasing one knows roughly how far away it is.
 */
const LANDMARKS: string[] = ASSETS
  .filter((a) => a.signature === true)
  .sort((a, b) => buildingPrice(a) - buildingPrice(b))
  .map((a) => a.id);

/** How many landmarks each level hands over. */
const PER_LEVEL = 2;

export function landmarksForLevel(level: number): string[] {
  if (level < 2) return [];
  const start = (level - 2) * PER_LEVEL;
  return LANDMARKS.slice(start, start + PER_LEVEL);
}

/** Every landmark a city of this level has been given. */
export function landmarksUpTo(level: number): string[] {
  return LANDMARKS.slice(0, Math.max(0, (level - 1) * PER_LEVEL));
}

/** How many landmarks there are, for the readout. */
export const LANDMARK_COUNT = LANDMARKS.length;
