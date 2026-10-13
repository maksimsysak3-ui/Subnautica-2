// College play art, drawn like a coach's notebook: ink on paper, receivers as O's and the line
// as squares, routes numbered in read order (the first read in the school's colour), run paths
// in red pencil, blocks as T-bars, coverage zones as shaded pencil loops and rushers as X's.
// Same play data as the engine, a different hand.
import { PLAY_ART, DEF_ART, OL_SPOTS, alignFor, snapSpot, type Art } from '../../src/ui/playart';

export function Notebook({ name, def, c, w = 176, h = 104 }: { name: string; def?: boolean; c: string; w?: number; h?: number }) {
  const art = (def ? DEF_ART : PLAY_ART)[name] ?? [];
  const al = alignFor(def ? undefined : name);
  const X = (dx: number) => h - 10 - ((dx + 6) / 32) * (h - 14);
  const Y = (dy: number) => w / 2 + (dy / 48) * w;
  const ink = '#1f2430', pencil = '#c0392b';
  let ol = 0;
  const id = `nb${name.replace(/\W/g, '')}${def ? 'd' : ''}`;
  const routes = art.filter(a => a.kind === 'route').sort((a, b) => Number(!!b.primary) - Number(!!a.primary));
  const order = new Map<Art, number>(routes.map((a, i) => [a, i + 1]));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="nb">
      <defs>
        <marker id={`${id}a`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L6,3.5 L0,7" fill="none" stroke={ink} strokeWidth="1.2" /></marker>
        <marker id={`${id}p`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L6,3.5 L0,7" fill="none" stroke={c} strokeWidth="1.6" /></marker>
        <marker id={`${id}r`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L6,3.5 L0,7" fill="none" stroke={pencil} strokeWidth="1.4" /></marker>
        <pattern id={`${id}h`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="4" stroke="rgba(31,36,48,.28)" strokeWidth="1" /></pattern>
      </defs>
      <rect width={w} height={h} fill="#f4efe2" />
      {Array.from({ length: Math.floor(h / 12) }, (_, i) => <line key={i} x1="0" x2={w} y1={8 + i * 12} y2={8 + i * 12} stroke="rgba(70,110,170,.18)" strokeWidth="1" />)}
      <line x1="16" x2="16" y1="0" y2={h} stroke="rgba(200,60,60,.3)" />
      <line x1="6" x2={w - 6} y1={X(0)} y2={X(0)} stroke={ink} strokeWidth="1" strokeDasharray="5 3" opacity=".6" />
      {!def && (['X', 'Z', 'S', 'TE', 'RB', 'QB'] as const).map(k => <circle key={k} cx={Y(al[k][1])} cy={X(al[k][0])} r="3.6" fill="#f4efe2" stroke={ink} strokeWidth="1.4" />)}
      {OL_SPOTS.map(([x, y], i) => <rect key={i} x={Y(y) - 3} y={X(x) - 3} width="6" height="6" fill="#f4efe2" stroke={ink} strokeWidth="1.3" />)}
      {art.map((a, i) => {
        if (a.kind === 'zone') { const [x, y] = a.pts[0]; return <ellipse key={i} cx={Y(y)} cy={X(x)} rx={(a.r ?? 5) / 48 * w} ry={(a.r ?? 5) / 32 * h * 0.7} fill={`url(#${id}h)`} stroke={x > 12 ? ink : c} strokeWidth="1.2" strokeDasharray={x > 12 ? undefined : '3 2'} />; }
        const start = a.who === 'OL' ? OL_SPOTS[ol++ % 5] : a.who === 'DEF' ? a.pts[0] : snapSpot(a, al);
        const pts = a.who === 'DEF' ? a.pts : [start, ...a.pts];
        if (pts.length < 2) return null;
        const d = pts.map(([x, y], j) => `${j ? 'L' : 'M'}${Y(y).toFixed(1)},${X(x).toFixed(1)}`).join(' ');
        const [ex, ey] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
        if (a.kind === 'block') {
          const ang = Math.atan2(X(ex) - X(px), Y(ey) - Y(py)), bx = Y(ey), by = X(ex), nx = Math.cos(ang + Math.PI / 2) * 4, ny = Math.sin(ang + Math.PI / 2) * 4;
          return <g key={i} stroke={ink} strokeWidth="1.2" opacity=".75"><path d={d} fill="none" /><line x1={bx - nx} y1={by - ny} x2={bx + nx} y2={by + ny} /></g>;
        }
        if (a.kind === 'blitz' || (a.who === 'DEF' && a.kind !== 'man')) return <g key={i}><path d={d} fill="none" stroke={pencil} strokeWidth="1.6" markerEnd={`url(#${id}r)`} /><text x={Y(pts[0][1])} y={X(pts[0][0]) + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={pencil}>X</text></g>;
        if (a.kind === 'man') return <path key={i} d={d} fill="none" stroke={ink} strokeWidth="1" strokeDasharray="2 2" opacity=".7" />;
        const run = a.kind === 'run', n = order.get(a);
        const col = run ? pencil : a.primary ? c : ink;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={col} strokeWidth={a.primary ? 2.4 : 1.5} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${id}${run ? 'r' : a.primary ? 'p' : 'a'})`} strokeDasharray={run && !a.primary ? '3 2' : undefined} />
            {n && n <= 4 && <g><circle cx={Y(ey)} cy={X(ex) - 8} r="5.5" fill={n === 1 ? c : '#1f2430'} /><text x={Y(ey)} y={X(ex) - 5.4} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff">{n}</text></g>}
          </g>
        );
      })}
    </svg>
  );
}
