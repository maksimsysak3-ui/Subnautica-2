// The team areas on the far sideline: players standing in two loose rows between the 30s
// (helmets on or in hand), coaches with headsets out front, a few staff. They face the play,
// shift their weight, and come off their feet when their team scores or makes a big play.
import { renderRig, POSE, AX, AY, type Build, type RigPose } from './rig';
import type { Kit } from './pixel';

interface Person { team: 0 | 1; x: number; y: number; build: Build; skin: string; coach: boolean; phase: number }
const SKIN = ['#e8c4a8', '#c99a76', '#a46e4c', '#7b4b31', '#5a3522'];

/** The people in each team area (away 0 on the 40-50 side, home 1 on the other), stable per matchup. */
export function sidelineCrew(seed: number): Person[] {
  let s = seed % 2147483647 || 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: Person[] = [];
  // Team areas match the painted benches: away 38-60, home 60-82 (field x).
  for (const [team, x0, x1] of [[0, 38, 59], [1, 61, 82]] as const) {
    for (let k = 0; k < 18; k++) {
      const row = k % 3 === 0 ? -0.75 : -0.5;   // a back row, and the men leaning on the front
      out.push({ team, x: x0 + 1 + rnd() * (x1 - x0 - 2), y: row - rnd() * 0.12, build: rnd() < 0.3 ? 'line' : 'skill', skin: SKIN[Math.floor(rnd() * SKIN.length)], coach: false, phase: rnd() * 6 });
    }
    for (let k = 0; k < 3; k++) out.push({ team, x: x0 + 4 + k * ((x1 - x0 - 8) / 2) + (rnd() - 0.5) * 2, y: -0.22, build: 'civ', skin: SKIN[Math.floor(rnd() * SKIN.length)], coach: true, phase: rnd() * 6 });
  }
  return out;
}

const coachKit = (k: Kit): Kit => ({ ...k, jersey: k.jersey === '#f3f3f1' ? k.num : k.jersey, pants: '#cbb68c', socks: '#3a3a3a', helmet: '#1a1a1a' });

/**
 * Queue the sideline people into the depth-sorted draw list.
 * `cheer[team]` is 0..1: how hard that team's sideline is celebrating right now.
 */
export function queueSideline(list: { y: number; draw: () => void }[], g: CanvasRenderingContext2D, crew: Person[], kits: readonly [Kit, Kit], ballX: number, now: number,
  cheer: [number, number], sx: (x: number) => number, sy: (y: number) => number, vw: number, scale: number) {
  const t = now / 1000;
  for (const p of crew) {
    const px = sx(p.x), py = sy(p.y);
    if (px < -24 || px > vw + 24) continue;
    const ch = cheer[p.team];
    let rig: RigPose;
    if (ch > 0 && !p.coach && ((t * 1.3 + p.phase) % 1) < ch) rig = POSE.jump(((t * 1.6 + p.phase) % 1));
    else if (ch > 0) rig = { ...POSE.stand(), na: 2.9, ne: 0.3, fa: 2.7, fe: 0.4 };      // arms up
    else rig = POSE.stand(Math.sin(t * 1.1 + p.phase));
    if (p.coach && ch === 0) rig = { ...rig, na: 1.2, ne: 1.4 };                       // hand to the headset
    const kit = p.coach ? coachKit(kits[p.team]) : kits[p.team];
    const flip = ballX < p.x;
    list.push({ y: p.y, draw: () => {
      const img = renderRig(rig, p.build, kit, p.skin, null, flip);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(Math.round(px - 5), py - 1, 10, 2);
      g.drawImage(img, Math.round(px - AX * scale), Math.round(py - AY * scale), Math.round(img.width * scale), Math.round(img.height * scale));
      if (p.coach) { g.fillStyle = '#111'; g.fillRect(Math.round(px + (flip ? -3 : 2)), Math.round(py - AY * scale + 4), 1, 2); }   // headset mic
    } });
  }
}
