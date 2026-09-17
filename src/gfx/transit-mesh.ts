/**
 * The transit lines, as something you can see.
 *
 * The same ribbon the mains are drawn as, in the same vertex layout and through
 * the same pipeline -- a centreline, a colour, and which way out of the line each
 * corner sits, with the widening done in the shader so a line laid from four
 * hundred metres up is still a line rather than a sub-pixel hairline.
 *
 * ALONG THE ROUTE, NOT BETWEEN THE STOPS. The chord between two stops cuts across
 * blocks, over the river and through buildings. What is drawn is the centreline
 * of every lane the vehicles actually drive, which the simulation works out from
 * the roads and hands over -- so the line on the map is the line on the ground,
 * and a player who moves a road watches the route move with it.
 *
 * OFFSET SIDEWAYS PER LINE, so two routes down the same high street read as two
 * routes. The offset is by index rather than by kind, because the thing a player
 * needs to tell apart is this line from that one.
 */

import { MAIN_VERTEX_FLOATS } from './mains-mesh';
import type { TransitShape } from '../sim';

/** How far above the ground, so it sits on the street rather than in it. */
const LIFT = 0.55;

/** Metres between the centrelines of two lines sharing a street. */
const SPREAD = 1.9;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  // Brightened the same way the mains are: these are drawn over a lit world and
  // a line the colour of its legend swatch disappears into the tarmac.
  const to = (v: number): number => ((v / 255) ** 2.2) * 1.7;
  return [to((n >> 16) & 255), to((n >> 8) & 255), to(n & 255)];
}

export interface TransitMesh {
  vertices: Float32Array<ArrayBuffer>;
  /** Vertices written, which is three times the triangle count. */
  count: number;
}

export function buildTransitMesh(shapes: readonly TransitShape[],
  heightAt: (x: number, z: number) => number,
  into?: Float32Array<ArrayBuffer>): TransitMesh {
  let segments = 0;
  for (const s of shapes) segments += Math.max(0, s.points.length / 2 - 1);

  const need = segments * 6 * MAIN_VERTEX_FLOATS;
  const out = into !== undefined && into.length >= need
    ? into : new Float32Array(Math.max(need, 6 * MAIN_VERTEX_FLOATS));
  let at = 0;

  const put = (x: number, y: number, z: number, c: readonly number[],
    nx: number, nz: number, side: number): void => {
    out[at++] = x; out[at++] = y; out[at++] = z;
    out[at++] = c[0]; out[at++] = c[1]; out[at++] = c[2];
    out[at++] = nx; out[at++] = nz; out[at++] = side;
  };

  for (let si = 0; si < shapes.length; si++) {
    const shape = shapes[si];
    const p = shape.points;
    if (p.length < 4) continue;
    const c = rgb(shape.colour);
    // Alternating either side of the centreline, so a second line on the same
    // street sits beside the first rather than on top of it.
    const push = (si % 2 === 0 ? 1 : -1) * Math.ceil((si + 1) / 2) * SPREAD;
    for (let i = 2; i < p.length; i += 2) {
      const axr = p[i - 2], azr = p[i - 1], bxr = p[i], bzr = p[i + 1];
      let tx = bxr - axr, tz = bzr - azr;
      const len = Math.hypot(tx, tz);
      if (len < 0.01) continue;
      tx /= len; tz /= len;
      const nx = -tz, nz = tx;
      const ax = axr + nx * push, az = azr + nz * push;
      const bx = bxr + nx * push, bz = bzr + nz * push;
      const ay = heightAt(ax, az) + LIFT;
      const by = heightAt(bx, bz) + LIFT;
      put(ax, ay, az, c, nx, nz, -1);
      put(ax, ay, az, c, nx, nz, 1);
      put(bx, by, bz, c, nx, nz, -1);
      put(bx, by, bz, c, nx, nz, -1);
      put(ax, ay, az, c, nx, nz, 1);
      put(bx, by, bz, c, nx, nz, 1);
    }
  }

  return { vertices: out, count: at / MAIN_VERTEX_FLOATS };
}
