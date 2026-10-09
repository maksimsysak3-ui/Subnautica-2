// Play art: one route/assignment library drawn two ways, as the SVG on each
// play-call card and as a pre-snap overlay on the field.
// Coordinates are yards: x downfield from the line of scrimmage, y across the
// field from the ball (+ is the offence's right).

export type Who = 'X' | 'Z' | 'S' | 'TE' | 'RB' | 'QB' | 'OL' | 'DEF';
export interface Art { who: Who; pts: [number, number][]; kind: 'route' | 'block' | 'run' | 'zone' | 'blitz' | 'man'; primary?: boolean; r?: number; /** Pre-snap motion: the player moves along these points before the snap. */ motion?: [number, number][] }
export const FORMATION: Record<Exclude<Who, 'OL' | 'DEF'>, [number, number]> = { X: [0, -19], Z: [0, 19], S: [-1, 11], TE: [0, 4.5], RB: [-6, 0], QB: [-4.5, 0] };
export const OL_SPOTS: [number, number][] = [[-0.6, -4], [-0.6, -2], [-0.6, 0], [-0.6, 2], [-0.6, 4]];

const block = (who: Who, dx = 2, dy = 0): Art => ({ who, pts: [[dx, dy]], kind: 'block' });
const olPush = (dx: number, dy: number): Art[] => OL_SPOTS.map(([, y]) => ({ who: 'OL', pts: [[dx, y + dy]], kind: 'block' as const }));

export const PLAY_ART: Record<string, Art[]> = {
  'Inside Zone': [...olPush(2.5, 0), { who: 'RB', pts: [[-3, 0.5], [3, 1.5], [9, 1]], kind: 'run', primary: true }, block('X', 3), block('Z', 3), block('S', 3, -1), block('TE', 2.5)],
  'Outside Zone': [...olPush(2, 3), { who: 'RB', pts: [[-5, 4], [-1, 9], [6, 11]], kind: 'run', primary: true }, block('X', 3), block('Z', 3, -2), block('S', 2, 2), block('TE', 1.5, 3)],
  'QB Keep': [...olPush(2, 2), { who: 'QB', pts: [[-4, 5], [1, 10], [8, 12]], kind: 'run', primary: true }, { who: 'RB', pts: [[-3, -3]], kind: 'run' }, block('X', 3), block('Z', 3), block('S', 2), block('TE', 2, 2)],
  'Quick Slants': [{ who: 'X', pts: [[3, -19], [7, -14]], kind: 'route', primary: true }, { who: 'Z', pts: [[3, 19], [7, 14]], kind: 'route' }, { who: 'S', pts: [[4, 11], [4, 17]], kind: 'route' }, { who: 'TE', pts: [[2, 7], [3, 10]], kind: 'route' }, block('RB', -1, 1.5), ...olPush(-1, 0)],
  'Curl Flat': [{ who: 'X', pts: [[12, -19], [10, -17]], kind: 'route', primary: true }, { who: 'Z', pts: [[12, 19], [10, 17]], kind: 'route' }, { who: 'S', pts: [[2, 13], [3, 21]], kind: 'route' }, { who: 'TE', pts: [[10, 4.5], [10, 1]], kind: 'route' }, { who: 'RB', pts: [[-4, -6], [1, -12]], kind: 'route' }, ...olPush(-1.2, 0)],
  'Dig': [{ who: 'X', pts: [[13, -19], [13, -5]], kind: 'route', primary: true }, { who: 'Z', pts: [[12, 19], [22, 10]], kind: 'route' }, { who: 'S', pts: [[2, 11], [3, -3]], kind: 'route' }, { who: 'TE', pts: [[7, 4.5], [7, 12]], kind: 'route' }, block('RB', -2, -2), ...olPush(-1.5, 0)],
  'Four Verticals': [{ who: 'X', pts: [[28, -19]], kind: 'route', primary: true }, { who: 'Z', pts: [[28, 19]], kind: 'route' }, { who: 'S', pts: [[28, 9]], kind: 'route' }, { who: 'TE', pts: [[26, 4]], kind: 'route' }, { who: 'RB', pts: [[-3, -4], [2, -9]], kind: 'route' }, ...olPush(-2, 0)],
  'Screen': [...olPush(1, 0), { who: 'RB', pts: [[-4, 7], [-2, 9], [8, 10]], kind: 'route', primary: true }, block('Z', 2, -3), block('S', 3, -2), block('TE', 1, 4), { who: 'X', pts: [[14, -19]], kind: 'route' }],
};
// Play-action variants reuse the pass routes with a run fake drawn in.
for (const k of ['Quick Slants', 'Curl Flat', 'Dig', 'Four Verticals']) PLAY_ART[`PA ${k}`] = [{ who: 'RB', pts: [[-3, 0.5], [-1, 2]], kind: 'run' }, ...PLAY_ART[k].filter(a => a.who !== 'RB')];

/** Defensive calls: zone landmarks (r = radius in yards), man lines, blitz paths. */
export const DEF_ART: Record<string, Art[]> = {
  'Cover 2': [{ who: 'DEF', pts: [[17, -13]], kind: 'zone', r: 10 }, { who: 'DEF', pts: [[17, 13]], kind: 'zone', r: 10 }, ...[-18, -8, 0, 8, 18].map(y => ({ who: 'DEF' as const, pts: [[6, y]] as [number, number][], kind: 'zone' as const, r: 4.5 }))],
  'Cover 3': [-16, 0, 16].map(y => ({ who: 'DEF' as const, pts: [[18, y]] as [number, number][], kind: 'zone' as const, r: 7.5 })).concat([-14, -5, 5, 14].map(y => ({ who: 'DEF' as const, pts: [[6, y]] as [number, number][], kind: 'zone' as const, r: 4.5 }))),
  'Cover 4': [-18, -6, 6, 18].map(y => ({ who: 'DEF' as const, pts: [[18, y]] as [number, number][], kind: 'zone' as const, r: 6 })).concat([-9, 0, 9].map(y => ({ who: 'DEF' as const, pts: [[6, y]] as [number, number][], kind: 'zone' as const, r: 4.5 }))),
  'Cover 1': [{ who: 'DEF', pts: [[20, 0]], kind: 'zone', r: 9 }, ...([[-19, 'X'], [19, 'Z'], [11, 'S'], [4.5, 'TE']] as const).map(([y]) => ({ who: 'DEF' as const, pts: [[5, y], [1, y]] as [number, number][], kind: 'man' as const })), { who: 'DEF', pts: [[6, 0]], kind: 'zone', r: 3.5 }],
  'Cover 1 Blitz': [{ who: 'DEF', pts: [[20, 0]], kind: 'zone', r: 9 }, ...[-19, 19, 11].map(y => ({ who: 'DEF' as const, pts: [[5, y], [1, y]] as [number, number][], kind: 'man' as const })), { who: 'DEF', pts: [[5, -3], [-3, -1]], kind: 'blitz' }],
  'Cover 0 Blitz': [...[-19, 19, 11, 4.5].map(y => ({ who: 'DEF' as const, pts: [[5, y], [1, y]] as [number, number][], kind: 'man' as const })), { who: 'DEF', pts: [[5, -3], [-3, -1]], kind: 'blitz' }, { who: 'DEF', pts: [[5, 3], [-3, 1]], kind: 'blitz' }, { who: 'DEF', pts: [[11, -8], [-3, -2]], kind: 'blitz' }],
  'Prevent': [-20, -8, 4, 16].map(y => ({ who: 'DEF' as const, pts: [[24, y + 2]] as [number, number][], kind: 'zone' as const, r: 7 })).concat([-12, 0, 12].map(y => ({ who: 'DEF' as const, pts: [[10, y]] as [number, number][], kind: 'zone' as const, r: 5 }))),
};
DEF_ART['Cover 1 Man'] = DEF_ART['Cover 1'];

/** Where a player is at the snap: his alignment, or the end of his motion. */
export const snapSpot = (a: Art): [number, number] => a.motion?.length ? a.motion[a.motion.length - 1] : FORMATION[a.who as keyof typeof FORMATION];
export const startOf = (who: Who, i = 0): [number, number] => (who === 'OL' ? OL_SPOTS[i % 5] : who === 'DEF' ? [0, 0] : FORMATION[who]);

/** SVG play diagram for a play-call card. */
export function PlayDiagram({ name, def, w = 150, h = 92 }: { name: string; def?: boolean; w?: number; h?: number }) {
  const art = (def ? DEF_ART : PLAY_ART)[name] ?? [];
  // View: 6 yards behind the line to 26 downfield; 46 yards across.
  const X = (dx: number) => h - ((dx + 6) / 32) * h;
  const Y = (dy: number) => w / 2 + (dy / 46) * w;
  let olIdx = 0;
  const id = `ah${name.replace(/\W/g, '')}${def ? 'd' : ''}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', background: 'linear-gradient(180deg,#1d4d2a,#163d21)' }}>
      <defs>
        <marker id={id} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#fff" /></marker>
        <marker id={`${id}p`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ffd23f" /></marker>
      </defs>
      {[5, 10, 15, 20].map(d => <line key={d} x1="0" x2={w} y1={X(d)} y2={X(d)} stroke="rgba(255,255,255,.08)" />)}
      <line x1="0" x2={w} y1={X(0)} y2={X(0)} stroke="rgba(120,180,255,.7)" strokeWidth="1.5" />
      {/* offence dots */}
      {(['X', 'Z', 'S', 'TE', 'RB', 'QB'] as const).map(k => <circle key={k} cx={Y(FORMATION[k][1])} cy={X(FORMATION[k][0])} r="3" fill="none" stroke="#fff" strokeWidth="1.3" />)}
      {OL_SPOTS.map(([x, y], i) => <rect key={i} x={Y(y) - 2.5} y={X(x) - 2.5} width="5" height="5" fill="none" stroke="#fff" strokeWidth="1.2" />)}
      {art.map((a, i) => {
        if (a.kind === 'zone') { const [x, y] = a.pts[0]; return <ellipse key={i} cx={Y(y)} cy={X(x)} rx={(a.r ?? 5) / 46 * w} ry={(a.r ?? 5) / 32 * h * 0.8} fill={x > 12 ? 'rgba(80,160,255,.28)' : 'rgba(255,210,63,.25)'} stroke={x > 12 ? 'rgba(120,190,255,.7)' : 'rgba(255,210,63,.7)'} />; }
        const start = a.who === 'OL' ? OL_SPOTS[olIdx++ % 5] : a.who === 'DEF' ? a.pts[0] : snapSpot(a);
        const pts = a.who === 'DEF' ? a.pts : [start, ...a.pts];
        const mo = a.motion?.length && a.who !== 'OL' && a.who !== 'DEF' ? [FORMATION[a.who], ...a.motion].map(([x, y], j) => `${j ? 'L' : 'M'}${Y(y).toFixed(1)},${X(x).toFixed(1)}`).join(' ') : '';
        if (pts.length < 2) return mo ? <path key={i} d={mo} fill="none" stroke="#7fd4ff" strokeWidth="1.3" strokeDasharray="2 2" /> : null;
        const d = pts.map(([x, y], j) => `${j ? 'L' : 'M'}${Y(y).toFixed(1)},${X(x).toFixed(1)}`).join(' ');
        const color = a.primary ? '#ffd23f' : a.kind === 'blitz' ? '#ff4d5e' : a.kind === 'man' ? 'rgba(255,255,255,.7)' : a.kind === 'block' ? 'rgba(255,255,255,.55)' : '#fff';
        return <g key={i}>{mo && <path d={mo} fill="none" stroke="#7fd4ff" strokeWidth="1.3" strokeDasharray="2 2" />}<path d={d} fill="none" stroke={color} strokeWidth={a.primary ? 2.2 : 1.5} strokeDasharray={a.kind === 'man' ? '3 3' : a.kind === 'run' && !a.primary ? '2 2' : undefined} markerEnd={a.kind === 'block' ? undefined : `url(#${id}${a.primary ? 'p' : ''})`} /></g>;
      })}
    </svg>
  );
}
