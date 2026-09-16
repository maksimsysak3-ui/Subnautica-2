/**
 * The mains, as something you can see.
 *
 * A heatmap says a district has water. It does not say where the pipe runs, which
 * is the thing the player just drew and the thing they need to look at to find the
 * gap in it. So the laid cells are turned into actual lines along the streets, one
 * per utility, in the utility's own colour.
 *
 * THREE LINES, NOT ONE. Power, water and sewage are offset sideways from the
 * centre of the street so a road carrying all three shows all three, side by side,
 * the way a service trench actually looks. One line drawn three times in the same
 * place is one line in whichever colour won the depth test.
 *
 * A RIBBON PER NEIGHBOUR PAIR. Each laid cell emits a segment to its east and
 * south neighbours when those carry the same utility, which draws every connection
 * exactly once and needs no path finding: the grid already knows what is joined to
 * what. Corners come out as two segments meeting at a cell centre, which at a
 * metre wide reads as a corner.
 */

import { Main, MAIN_KINDS, MAIN_COLOURS } from '../sim/mains';
import type { Mains } from '../sim/mains';
import type { RoadGraph, Along } from '../sim/roadgraph';

/** Floats per vertex: position, then colour. */
export const MAIN_VERTEX_FLOATS = 6;

/** How wide a main is drawn, in metres. */
const WIDTH = 1.15;

/** How far above the ground, so it sits on the street rather than in it. */
const LIFT = 0.28;

/** Sideways offset per utility, in metres, so all three fit in one street. */
const OFFSET: Record<number, number> = {
  [Main.POWER]: -2.3, [Main.WATER]: 0, [Main.SEWAGE]: 2.3,
};

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  // Brightened rather than exact: these are drawn over a world that an underground
  // view has darkened to slate, and a pipe the colour of its legend swatch
  // disappears into it.
  const to = (v: number): number => ((v / 255) ** 2.2) * 1.5;
  return [to((n >> 16) & 255), to((n >> 8) & 255), to(n & 255)];
}

export interface MainsMesh {
  vertices: Float32Array<ArrayBuffer>;
  /** Vertices actually written, which is three times the triangle count. */
  count: number;
}

/**
 * Builds the lines for a utility laid on the map.
 *
 * ALONG THE ROADS' OWN CENTRELINES, not along the cells. The first version walked
 * the cell grid and drew a segment between every laid pair of neighbours, which on
 * a street three cells wide drew a ladder: two rails down the road and a rung
 * across it every eight metres. A main is one line down the middle of a street, so
 * it is drawn from the thing that knows where the middle of the street is.
 *
 * `only` picks the utility. Zero draws all three, offset sideways from each other
 * the way a service trench really is.
 */
export function buildMainsMesh(mains: Mains, net: RoadGraph,
  heightAt: (x: number, z: number) => number,
  only = 0, into?: Float32Array<ArrayBuffer>): MainsMesh {
  const kinds = only === 0 ? MAIN_KINDS : MAIN_KINDS.filter((k) => k === only);

  // Every run of consecutive samples whose cell carries the main, per link. Found
  // first so the buffer is allocated once at the right size.
  const runs: Array<{ kind: number; pts: Along[] }> = [];
  for (const kind of kinds) {
    for (const link of net.links) {
      const pts = net.samples(link);
      let run: Along[] = [];
      for (const p of pts) {
        if (mains.laidAt(p.x, p.z, kind)) {
          run.push(p);
          continue;
        }
        if (run.length > 1) runs.push({ kind, pts: run });
        run = [];
      }
      if (run.length > 1) runs.push({ kind, pts: run });
    }
  }

  let segments = 0;
  for (const r of runs) segments += r.pts.length - 1;

  const need = segments * 6 * MAIN_VERTEX_FLOATS;
  const out = into !== undefined && into.length >= need
    ? into : new Float32Array(Math.max(need, 6 * MAIN_VERTEX_FLOATS));
  let at = 0;

  const put = (x: number, y: number, z: number, c: readonly number[]): void => {
    out[at++] = x; out[at++] = y; out[at++] = z;
    out[at++] = c[0]; out[at++] = c[1]; out[at++] = c[2];
  };

  for (const r of runs) {
    const c = rgb(MAIN_COLOURS[r.kind] ?? '#ffffff');
    const push = OFFSET[r.kind] ?? 0;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      // The tangent comes with the sample, so the offset and the width are
      // perpendicular to the road rather than to the chord -- which is what keeps
      // three parallel mains parallel round a bend.
      const anx = -a.tz, anz = a.tx;
      const bnx = -b.tz, bnz = b.tx;
      const ax = a.x + anx * push, az = a.z + anz * push;
      const bx = b.x + bnx * push, bz = b.z + bnz * push;
      const ahx = anx * (WIDTH / 2), ahz = anz * (WIDTH / 2);
      const bhx = bnx * (WIDTH / 2), bhz = bnz * (WIDTH / 2);
      const ay = heightAt(ax, az) + LIFT;
      const by = heightAt(bx, bz) + LIFT;
      put(ax - ahx, ay, az - ahz, c);
      put(ax + ahx, ay, az + ahz, c);
      put(bx - bhx, by, bz - bhz, c);
      put(bx - bhx, by, bz - bhz, c);
      put(ax + ahx, ay, az + ahz, c);
      put(bx + bhx, by, bz + bhz, c);
    }
  }

  return { vertices: out, count: at / MAIN_VERTEX_FLOATS };
}
