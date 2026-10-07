// Draw your own plays: pick a player, click to lay down his route, mark the
// primary read, name it and save it to the playbook. Saved plays get play art,
// show up in play calling, and the sim runs them (route depth sets the throw;
// the primary read gets the quarterback's first look).
import { useRef, useState } from 'react';
import type { CustomPlay, League } from '../core/types';
import type { OffCall, PassDepth } from '../sim/game';
import { FORMATION, OL_SPOTS, PLAY_ART, type Art } from './playart';
import { Modal } from './components';

type Who = CustomPlay['routes'][number]['who'];
const WHO: Who[] = ['X', 'Z', 'S', 'TE', 'RB', 'QB'];
const LABEL: Record<Who, string> = { X: 'X Receiver', Z: 'Z Receiver', S: 'Slot', TE: 'Tight End', RB: 'Running Back', QB: 'Quarterback' };
const VW = 520, VH = 330;           // view: 7 yards behind the line to 30 downfield, 50 across
const toX = (dy: number) => VW / 2 + (dy / 50) * VW;
const toY = (dx: number) => VH - ((dx + 7) / 37) * VH;
const fromSvg = (x: number, y: number): [number, number] => [Math.round((((VH - y) / VH) * 37 - 7) * 2) / 2, Math.round(((x - VW / 2) / VW) * 50 * 2) / 2];

/** Register saved plays so the field and cards can draw them. */
export function registerPlays(L: League) { for (const p of L.customPlays ?? []) PLAY_ART[p.name] = toArt(p); }
export function toArt(p: CustomPlay): Art[] {
  const out: Art[] = OL_SPOTS.map(() => ({ who: 'OL', pts: [[p.type === 'run' ? 2 : -1.2, 0]] as [number, number][], kind: 'block' as const }));
  // OL arrows are relative points: shift them to each lineman's lane.
  out.forEach((a, i) => (a.pts = [[a.pts[0][0], OL_SPOTS[i][1]]]));
  for (const r of p.routes) if (r.pts.length) out.push({ who: r.who, pts: r.pts, kind: r.block ? 'block' : (p.type === 'run' && (r.who === 'RB' || r.who === 'QB')) ? 'run' : 'route', primary: r.primary });
  return out;
}
/** How the sim runs a drawn play. */
export function callFor(p: CustomPlay): OffCall {
  if (p.type === 'run') {
    const carrier = p.routes.find(r => r.primary) ?? p.routes.find(r => r.who === 'RB');
    const lat = Math.abs(carrier?.pts[carrier.pts.length - 1]?.[1] ?? 0);
    return { kind: 'run', run: carrier?.who === 'QB' ? 'qb' : lat > 5 ? 'outside' : 'inside', name: p.name };
  }
  const prim = p.routes.find(r => r.primary) ?? p.routes[0];
  const deep = Math.max(...(prim?.pts.map(q => q[0]) ?? [8]));
  const depth: PassDepth = deep <= 1 ? 'screen' : deep <= 6 ? 'quick' : deep <= 11 ? 'short' : deep <= 19 ? 'medium' : 'deep';
  const slot = prim ? ({ X: 'X', Z: 'Z', S: 'SLOT', TE: 'TE', RB: 'RB', QB: undefined } as const)[prim.who] : undefined;
  return { kind: 'pass', depth, name: p.name, primary: slot };
}

export function PlayDesigner({ L, close, onSaved }: { L: League; close: () => void; onSaved: (p: CustomPlay) => void }) {
  const [type, setType] = useState<'pass' | 'run'>('pass');
  const [name, setName] = useState('');
  const [sel, setSel] = useState<Who>('X');
  const [routes, setRoutes] = useState<CustomPlay['routes']>([]);
  const svg = useRef<SVGSVGElement>(null);
  const route = (w: Who) => routes.find(r => r.who === w);
  const update = (w: Who, f: (r: CustomPlay['routes'][number]) => CustomPlay['routes'][number]) => {
    const cur = route(w) ?? { who: w, pts: [] };
    setRoutes([...routes.filter(r => r.who !== w), f(cur)]);
  };
  const click = (e: React.MouseEvent) => {
    const b = svg.current!.getBoundingClientRect();
    const pt = fromSvg(((e.clientX - b.left) / b.width) * VW, ((e.clientY - b.top) / b.height) * VH);
    update(sel, r => ({ ...r, pts: [...r.pts, pt].slice(0, 6) }));
  };
  const save = () => {
    const n = name.trim() || `My Play ${(L.customPlays?.length ?? 0) + 1}`;
    const play: CustomPlay = { name: n, type, routes: routes.filter(r => r.pts.length) };
    if (!play.routes.length) return;
    if (!play.routes.some(r => r.primary)) play.routes[0].primary = true;
    L.customPlays = [...(L.customPlays ?? []).filter(p => p.name !== n), play];
    PLAY_ART[n] = toArt(play);
    onSaved(play);
  };
  return (
    <Modal onClose={close} wide>
      <div className="row" style={{ marginBottom: 12 }}><div className="h2">Play Designer</div><div className="spacer" />
        <span className={`chip${type === 'pass' ? ' on' : ''}`} onClick={() => setType('pass')}>Pass</span><span className={`chip${type === 'run' ? ' on' : ''}`} onClick={() => setType('run')}>Run</span></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 210px', alignItems: 'start' }}>
        <svg ref={svg} viewBox={`0 0 ${VW} ${VH}`} width="100%" onClick={click} style={{ display: 'block', cursor: 'crosshair', background: 'linear-gradient(180deg,#1f5530,#18452a)' }}>
          {[0, 5, 10, 15, 20, 25].map(d => <g key={d}><line x1="0" x2={VW} y1={toY(d)} y2={toY(d)} stroke={d === 0 ? 'rgba(90,160,255,.9)' : 'rgba(255,255,255,.12)'} strokeWidth={d === 0 ? 3 : 1} /><text x="6" y={toY(d) - 4} fill="rgba(255,255,255,.4)" fontSize="11">{d ? `+${d}` : 'LOS'}</text></g>)}
          {OL_SPOTS.map(([x, y], i) => <rect key={i} x={toX(y) - 7} y={toY(x) - 7} width="14" height="14" fill="#0c0f14" stroke="#fff" />)}
          {routes.map(r => { const st = FORMATION[r.who]; const pts = [st, ...r.pts]; return <polyline key={r.who} points={pts.map(([x, y]) => `${toX(y)},${toY(x)}`).join(' ')} fill="none" stroke={r.primary ? '#ffd23f' : r.block ? 'rgba(255,255,255,.55)' : '#fff'} strokeWidth={r.primary ? 4 : 3} strokeDasharray={r.block ? '6 5' : undefined} />; })}
          {WHO.map(w => { const [x, y] = FORMATION[w]; const on = sel === w; return <g key={w} onClick={e => { e.stopPropagation(); setSel(w); }} style={{ cursor: 'pointer' }}><circle cx={toX(y)} cy={toY(x)} r={on ? 13 : 10} fill={on ? '#ffd23f' : '#0c0f14'} stroke="#fff" strokeWidth="2" /><text x={toX(y)} y={toY(x) + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={on ? '#000' : '#fff'}>{w}</text></g>; })}
        </svg>
        <div className="grid" style={{ gap: 8 }}>
          <div className="up">Selected: {LABEL[sel]}</div>
          <div className="small dim">Click on the field to add route points (up to six). Click a player to switch.</div>
          <button className="btn sm" onClick={() => update(sel, r => ({ ...r, pts: r.pts.slice(0, -1) }))}>Undo Point</button>
          <button className="btn sm" onClick={() => setRoutes(routes.filter(r => r.who !== sel))}>Clear Route</button>
          <button className="btn sm" onClick={() => setRoutes(routes.map(r => ({ ...r, primary: r.who === sel })))}>{type === 'run' ? 'Make Ball Carrier' : 'Make Primary Read'}</button>
          <button className="btn sm" onClick={() => update(sel, r => ({ ...r, block: !r.block }))}>{route(sel)?.block ? 'Run a Route' : 'Assign to Block'}</button>
          <div className="divider" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Play name" maxLength={24} />
          <button className="btn primary" disabled={!routes.some(r => r.pts.length)} onClick={save}>Save to Playbook</button>
        </div>
      </div>
    </Modal>
  );
}
