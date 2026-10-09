// Draw your own plays. Offense: pick a formation, click to lay down routes, send one
// man in pre-snap motion, mark the primary read. Defense: give each of the eleven an
// assignment (rush, zone drop, blitz path or man on a receiver). Saved plays get play
// art, go into a playbook folder, and the sim runs them.
import { useRef, useState } from 'react';
import type { CustomDefPlay, CustomPlay, League } from '../core/types';
import type { DefSet, OffCall, PassDepth } from '../sim/game';
import { FORMATION, OL_SPOTS, PLAY_ART, PLAY_ALIGN, DEF_ART, type Art, type Align } from './playart';
import { OFF_SETS, DEF_SETS, DEF_SPOTS, defArt, defSummary, books, setCustomCall } from './plays';
import { Modal } from './components';

type Who = CustomPlay['routes'][number]['who'];
type DWho = CustomDefPlay['assigns'][number]['who'];
const WHO: Who[] = ['X', 'Z', 'S', 'TE', 'RB', 'QB'];
const LABEL: Record<Who, string> = { X: 'X Receiver', Z: 'Z Receiver', S: 'Slot', TE: 'Tight End', RB: 'Running Back', QB: 'Quarterback' };
const DLABEL: Record<DWho, string> = { DL0: 'Left End', DL1: 'Left Tackle', DL2: 'Right Tackle', DL3: 'Right End', LB0: 'Will LB', LB1: 'Mike LB', CB0: 'Left Corner', CB1: 'Right Corner', NB: 'Nickel', SS: 'Strong Safety', FS: 'Free Safety' };
const VW = 520, VH = 330;           // view: 7 yards behind the line to 30 downfield, 50 across
const toX = (dy: number) => VW / 2 + (dy / 50) * VW;
const toY = (dx: number) => VH - ((dx + 7) / 37) * VH;
const fromSvg = (x: number, y: number): [number, number] => [Math.round((((VH - y) / VH) * 37 - 7) * 2) / 2, Math.round(((x - VW / 2) / VW) * 50 * 2) / 2];

/** Register saved plays so the field and cards can draw them. */
export function registerPlays(L: League) {
  for (const p of L.customPlays ?? []) { PLAY_ART[p.name] = toArt(p); if (p.set && p.set !== 'Shotgun' && OFF_SETS[p.set]) PLAY_ALIGN[p.name] = OFF_SETS[p.set].align; }
  for (const p of L.customDefPlays ?? []) DEF_ART[p.name] = defArt(p);
}
export function toArt(p: CustomPlay): Art[] {
  const out: Art[] = OL_SPOTS.map(() => ({ who: 'OL', pts: [[p.type === 'run' ? 2 : -1.2, 0]] as [number, number][], kind: 'block' as const }));
  // OL arrows are relative points: shift them to each lineman's lane.
  out.forEach((a, i) => (a.pts = [[a.pts[0][0], OL_SPOTS[i][1]]]));
  for (const r of p.routes) if (r.pts.length || r.motion?.length) out.push({ who: r.who, pts: r.pts, kind: r.block ? 'block' : (p.type === 'run' && (r.who === 'RB' || r.who === 'QB')) ? 'run' : 'route', primary: r.primary, motion: r.motion?.length ? r.motion : undefined });
  return out;
}
const SIM_SLOT = { X: 'X', Z: 'Z', S: 'SLOT', TE: 'TE', RB: 'RB', QB: undefined } as const;
/** How the sim runs a drawn play. */
export function callFor(p: CustomPlay): OffCall {
  const mover = p.routes.find(r => r.motion?.length);
  const motion = mover ? SIM_SLOT[mover.who] : undefined;
  const pers = OFF_SETS[p.set ?? 'Shotgun']?.pers ?? '11';
  if (p.type === 'run') {
    const carrier = p.routes.find(r => r.primary) ?? p.routes.find(r => r.who === 'RB');
    const lat = Math.abs(carrier?.pts[carrier.pts.length - 1]?.[1] ?? 0);
    return { kind: 'run', run: carrier?.who === 'QB' ? 'qb' : lat > 5 ? 'outside' : 'inside', name: p.name, motion, pers };
  }
  const prim = p.routes.find(r => r.primary && r.pts.length) ?? p.routes.find(r => r.pts.length && !r.block) ?? p.routes[0];
  const deep = prim?.pts.length ? Math.max(...prim.pts.map(q => q[0])) : 8;
  const depth: PassDepth = deep <= 1 ? 'screen' : deep <= 6 ? 'quick' : deep <= 11 ? 'short' : deep <= 19 ? 'medium' : 'deep';
  return { kind: 'pass', depth, name: p.name, primary: prim ? SIM_SLOT[prim.who] : undefined, motion, pers };
}
setCustomCall(callFor);

/** Add a saved play to a playbook folder (by folder name in a book). */
function file(L: League, side: 'off' | 'def', name: string, target?: { book: string; folder: string }) {
  const all = books(L);
  for (const b of all) for (const f of b.folders) f.plays = f.plays.filter(p => p !== name);
  const b = all.find(x => x.id === target?.book && x.side === side) ?? all.find(x => x.id === L.activeBook?.[side]) ?? all.find(x => x.side === side);
  if (!b) return;
  let f = b.folders.find(x => x.name === target?.folder);
  if (!f) { f = b.folders.find(x => x.name === 'My Plays'); if (!f) b.folders.push(f = { name: 'My Plays', set: side === 'off' ? 'Shotgun' : 'Nickel', plays: [] }); }
  f.plays.push(name);
}

export function PlayDesigner({ L, close, onSaved, side = 'off', set: set0, target }: { L: League; close: () => void; onSaved: (name: string) => void; side?: 'off' | 'def'; set?: string; target?: { book: string; folder: string } }) {
  const [s, setSide] = useState<'off' | 'def'>(side);
  return (
    <Modal onClose={close} wide>
      <div className="row" style={{ marginBottom: 12 }}><div className="h2">Play Designer</div><div className="spacer" />
        {!target && <><span className={`chip${s === 'off' ? ' on' : ''}`} onClick={() => setSide('off')}>Offense</span><span className={`chip${s === 'def' ? ' on' : ''}`} onClick={() => setSide('def')}>Defense</span></>}</div>
      {s === 'off' ? <OffDesigner L={L} set0={set0} onSaved={n => { file(L, 'off', n, target); onSaved(n); }} />
        : <DefDesigner L={L} set0={set0 as DefSet | undefined} onSaved={n => { file(L, 'def', n, target); onSaved(n); }} />}
    </Modal>
  );
}

function Field({ svg, onClick, children }: { svg: React.RefObject<SVGSVGElement | null>; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <svg ref={svg} viewBox={`0 0 ${VW} ${VH}`} width="100%" onClick={onClick} className="pd-field">
      {[0, 5, 10, 15, 20, 25].map(d => <g key={d}><line x1="0" x2={VW} y1={toY(d)} y2={toY(d)} stroke={d === 0 ? 'rgba(90,160,255,.9)' : 'rgba(255,255,255,.12)'} strokeWidth={d === 0 ? 3 : 1} /><text x="6" y={toY(d) - 4} fill="rgba(255,255,255,.4)" fontSize="11">{d ? `+${d}` : 'LOS'}</text></g>)}
      {children}
    </svg>
  );
}
const pointIn = (svg: SVGSVGElement, e: React.MouseEvent) => { const b = svg.getBoundingClientRect(); return fromSvg(((e.clientX - b.left) / b.width) * VW, ((e.clientY - b.top) / b.height) * VH); };

function OffDesigner({ L, set0, onSaved }: { L: League; set0?: string; onSaved: (n: string) => void }) {
  const [type, setType] = useState<'pass' | 'run'>('pass');
  const [set, setSet] = useState(set0 && OFF_SETS[set0] ? set0 : 'Shotgun');
  const [name, setName] = useState('');
  const [sel, setSel] = useState<Who>('X');
  const [routes, setRoutes] = useState<CustomPlay['routes']>([]);
  const [mode, setMode] = useState<'route' | 'motion'>('route');
  const svg = useRef<SVGSVGElement>(null);
  const al: Align = OFF_SETS[set]?.align ?? FORMATION;
  const route = (w: Who) => routes.find(r => r.who === w);
  const update = (w: Who, f: (r: CustomPlay['routes'][number]) => CustomPlay['routes'][number]) => {
    const cur = route(w) ?? { who: w, pts: [] };
    setRoutes([...routes.filter(r => r.who !== w), f(cur)]);
  };
  const canMotion = sel !== 'QB';
  const click = (e: React.MouseEvent) => {
    const pt = pointIn(svg.current!, e);
    if (mode === 'motion' && canMotion) {
      // Motion stays behind the line (a man moving forward at the snap is illegal),
      // and only one player can be in motion: drawing it for him takes it off anyone else.
      const m: [number, number] = [Math.min(-1, pt[0]), Math.max(-24, Math.min(24, pt[1]))];
      const cur = route(sel) ?? { who: sel, pts: [] };
      setRoutes([...routes.filter(r => r.who !== sel).map(r => (r.motion ? { ...r, motion: undefined } : r)), { ...cur, motion: [...(cur.motion ?? []), m].slice(0, 3) }]);
      return;
    }
    update(sel, r => ({ ...r, pts: [...r.pts, pt].slice(0, 6) }));
  };
  const spot = (w: Who): [number, number] => { const m = route(w)?.motion; return m?.length ? m[m.length - 1] : al[w]; };
  const mover = routes.find(r => r.motion?.length);
  const save = () => {
    const n = name.trim() || `My Play ${(L.customPlays?.length ?? 0) + 1}`;
    const play: CustomPlay = { name: n, type, set, routes: routes.filter(r => r.pts.length || r.motion?.length) };
    if (!play.routes.some(r => r.pts.length)) return;
    if (!play.routes.some(r => r.primary)) play.routes.find(r => r.pts.length)!.primary = true;
    L.customPlays = [...(L.customPlays ?? []).filter(p => p.name !== n), play];
    PLAY_ART[n] = toArt(play);
    if (set !== 'Shotgun') PLAY_ALIGN[n] = al; else delete PLAY_ALIGN[n];
    onSaved(n);
  };
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 230px', alignItems: 'start' }}>
      <Field svg={svg} onClick={click}>
        {OL_SPOTS.map(([x, y], i) => <rect key={i} x={toX(y) - 7} y={toY(x) - 7} width="14" height="14" fill="#0c0f14" stroke="#fff" />)}
        {routes.filter(r => r.motion?.length).map(r => <polyline key={`m-${r.who}`} points={[al[r.who], ...r.motion!].map(([x, y]) => `${toX(y)},${toY(x)}`).join(' ')} fill="none" stroke="#7fd4ff" strokeWidth="2.5" strokeDasharray="4 4" />)}
        {routes.filter(r => r.motion?.length).map(r => { const [x, y] = al[r.who]; return <circle key={`g-${r.who}`} cx={toX(y)} cy={toY(x)} r="9" fill="none" stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />; })}
        {routes.filter(r => r.pts.length).map(r => { const pts = [spot(r.who), ...r.pts]; return <polyline key={r.who} points={pts.map(([x, y]) => `${toX(y)},${toY(x)}`).join(' ')} fill="none" stroke={r.primary ? '#ffd23f' : r.block ? 'rgba(255,255,255,.55)' : '#fff'} strokeWidth={r.primary ? 4 : 3} strokeDasharray={r.block ? '6 5' : undefined} />; })}
        {WHO.map(w => { const [x, y] = spot(w); const on = sel === w; return <g key={w} onClick={e => { e.stopPropagation(); setSel(w); }} style={{ cursor: 'pointer' }}><circle cx={toX(y)} cy={toY(x)} r={on ? 13 : 10} fill={on ? '#ffd23f' : '#0c0f14'} stroke="#fff" strokeWidth="2" /><text x={toX(y)} y={toY(x) + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={on ? '#000' : '#fff'}>{w}</text></g>; })}
      </Field>
      <div className="grid" style={{ gap: 8 }}>
        <label className="pd-l">Formation<select value={set} onChange={e => { setSet(e.target.value); setRoutes([]); }}>{Object.entries(OFF_SETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <div className="small dim">{OFF_SETS[set].note}</div>
        <div className="row" style={{ gap: 6 }}><span className={`chip${type === 'pass' ? ' on' : ''}`} onClick={() => setType('pass')}>Pass</span><span className={`chip${type === 'run' ? ' on' : ''}`} onClick={() => setType('run')}>Run</span></div>
        <div className="up">Selected: {LABEL[sel]}</div>
        <div className="row" style={{ gap: 6 }}>
          <span className={`chip${mode === 'route' ? ' on' : ''}`} onClick={() => setMode('route')}>Route</span>
          <span className={`chip${mode === 'motion' ? ' on' : ''}`} style={canMotion ? undefined : { opacity: 0.4, cursor: 'not-allowed' }} onClick={() => canMotion && setMode('motion')}>Motion</span>
        </div>
        <div className="small dim">{mode === 'motion'
          ? canMotion ? 'Click behind the line to set his motion path (up to three points). His route starts where the motion ends. One man in motion at a time.' : 'The quarterback can\'t go in motion.'
          : 'Click on the field to add route points (up to six). Click a player to switch.'}</div>
        {mover && <div className="small" style={{ color: '#7fd4ff' }}>In motion: {LABEL[mover.who]}</div>}
        <button className="btn sm" onClick={() => mode === 'motion' ? update(sel, r => ({ ...r, motion: r.motion?.slice(0, -1) })) : update(sel, r => ({ ...r, pts: r.pts.slice(0, -1) }))}>Undo Point</button>
        <button className="btn sm" onClick={() => mode === 'motion' ? update(sel, r => ({ ...r, motion: undefined })) : update(sel, r => ({ ...r, pts: [], primary: false }))}>{mode === 'motion' ? 'Clear Motion' : 'Clear Route'}</button>
        <button className="btn sm" onClick={() => setRoutes(routes.map(r => ({ ...r, primary: r.who === sel })))}>{type === 'run' ? 'Make Ball Carrier' : 'Make Primary Read'}</button>
        <button className="btn sm" onClick={() => update(sel, r => ({ ...r, block: !r.block }))}>{route(sel)?.block ? 'Run a Route' : 'Assign to Block'}</button>
        <div className="divider" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Play name" maxLength={24} />
        <button className="btn primary" disabled={!routes.some(r => r.pts.length)} onClick={save}>Save to Playbook</button>
      </div>
    </div>
  );
}

const DWHO = Object.keys(DEF_SPOTS) as DWho[];
const KIND_NOTE: Record<CustomDefPlay['assigns'][number]['kind'], string> = {
  rush: 'Rushes the passer from his spot.', zone: 'Click where he drops. Deeper than 12 yards is a deep zone.', blitz: 'Click his path to the quarterback (up to three points).', man: 'Click the receiver he covers.',
};
function DefDesigner({ L, set0, onSaved }: { L: League; set0?: DefSet; onSaved: (n: string) => void }) {
  const [set, setSet] = useState<DefSet>(set0 && DEF_SETS[set0] ? set0 : 'Nickel');
  const [name, setName] = useState('');
  const [sel, setSel] = useState<DWho>('LB1');
  const base = (w: DWho): CustomDefPlay['assigns'][number] => w.startsWith('DL') ? { who: w, kind: 'rush', pts: [] }
    : w === 'FS' ? { who: w, kind: 'zone', pts: [[16, 0]] } : w === 'SS' ? { who: w, kind: 'zone', pts: [[8, 6]] }
    : w === 'CB0' ? { who: w, kind: 'man', pts: [FORMATION.X] } : w === 'CB1' ? { who: w, kind: 'man', pts: [FORMATION.Z] } : w === 'NB' ? { who: w, kind: 'man', pts: [FORMATION.S] }
    : { who: w, kind: 'zone', pts: [[6, DEF_SPOTS[w][1]]] };
  const [as, setAs] = useState<CustomDefPlay['assigns']>(() => DWHO.map(base));
  const svg = useRef<SVGSVGElement>(null);
  const cur = as.find(a => a.who === sel)!;
  const put = (a: CustomDefPlay['assigns'][number]) => setAs(as.map(x => (x.who === a.who ? a : x)));
  const click = (e: React.MouseEvent) => {
    const pt = pointIn(svg.current!, e);
    if (cur.kind === 'zone') put({ ...cur, pts: [[Math.max(2, pt[0]), pt[1]]] });
    else if (cur.kind === 'blitz') put({ ...cur, pts: [...cur.pts, pt].slice(-3) });
  };
  const play: CustomDefPlay = { name: name.trim() || `My Defense ${(L.customDefPlays?.length ?? 0) + 1}`, set, assigns: as };
  const art = defArt(play);
  const save = () => {
    L.customDefPlays = [...(L.customDefPlays ?? []).filter(p => p.name !== play.name), play];
    DEF_ART[play.name] = art;
    onSaved(play.name);
  };
  const D = (x: number, y: number): [number, number] => [toX(y), toY(x)];
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 230px', alignItems: 'start' }}>
      <Field svg={svg} onClick={click}>
        {OL_SPOTS.map(([x, y], i) => <rect key={i} x={toX(y) - 6} y={toY(x) - 6} width="12" height="12" fill="none" stroke="rgba(255,255,255,.3)" />)}
        {WHO.map(w => { const [x, y] = FORMATION[w]; const target = cur.kind === 'man'; return <g key={w} onClick={e => { if (!target) return; e.stopPropagation(); put({ ...cur, pts: [FORMATION[w]] }); }} style={{ cursor: target ? 'pointer' : 'default' }}><circle cx={toX(y)} cy={toY(x)} r="9" fill={target ? 'rgba(255,255,255,.12)' : 'none'} stroke={target ? '#fff' : 'rgba(255,255,255,.3)'} strokeWidth="1.5" /><text x={toX(y)} y={toY(x) + 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.6)">{w}</text></g>; })}
        {art.map((a, i) => a.kind === 'zone'
          ? <ellipse key={i} cx={toX(a.pts[0][1])} cy={toY(a.pts[0][0])} rx={((a.r ?? 5) / 50) * VW} ry={((a.r ?? 5) / 37) * VH * 0.7} fill={a.pts[0][0] >= 12 ? 'rgba(80,160,255,.25)' : 'rgba(255,210,63,.22)'} stroke={a.pts[0][0] >= 12 ? '#7fb8ff' : '#ffd23f'} />
          : <polyline key={i} points={a.pts.map(([x, y]) => D(x, y).join(',')).join(' ')} fill="none" stroke={a.kind === 'blitz' ? '#ff4d5e' : 'rgba(255,255,255,.75)'} strokeWidth={a.kind === 'blitz' ? 3 : 2} strokeDasharray={a.kind === 'man' ? '5 4' : undefined} />)}
        {DWHO.map(w => { const [x, y] = DEF_SPOTS[w]; const on = sel === w; return <g key={w} onClick={e => { e.stopPropagation(); setSel(w); }} style={{ cursor: 'pointer' }}><path d={`M${toX(y) - 10} ${toY(x) - 9} L${toX(y) + 10} ${toY(x) - 9} L${toX(y)} ${toY(x) + 9} Z`} fill={on ? '#ff4d5e' : '#0c0f14'} stroke="#fff" strokeWidth="1.6" /><text x={toX(y)} y={toY(x) - 1} textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">{w.replace(/\d/, '')}</text></g>; })}
      </Field>
      <div className="grid" style={{ gap: 8 }}>
        <label className="pd-l">Set<select value={set} onChange={e => setSet(e.target.value as DefSet)}>{(Object.keys(DEF_SETS) as DefSet[]).map(k => <option key={k} value={k}>{DEF_SETS[k].label}</option>)}</select></label>
        <div className="small dim">{DEF_SETS[set].note}</div>
        <div className="up">Selected: {DLABEL[sel]}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{(['rush', 'zone', 'blitz', 'man'] as const).map(k => (
          <span key={k} className={`chip${cur.kind === k ? ' on' : ''}`} onClick={() => put(k === cur.kind ? cur : { who: sel, kind: k, pts: k === 'zone' ? [[6, DEF_SPOTS[sel][1]]] : k === 'man' ? [FORMATION.TE] : [] })}>{k === 'rush' ? 'Rush' : k === 'zone' ? 'Zone' : k === 'blitz' ? 'Blitz' : 'Man'}</span>
        ))}</div>
        <div className="small dim">{KIND_NOTE[cur.kind]}</div>
        <div className="pd-sum">{defSummary(play)}</div>
        <button className="btn sm" onClick={() => setAs(DWHO.map(base))}>Reset to Base</button>
        <div className="divider" />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Play name" maxLength={24} />
        <button className="btn primary" onClick={save}>Save to Playbook</button>
      </div>
    </div>
  );
}
