// Facilities: the team campus at night, drawn in isometric 3D. Every building is a
// facility and grows with its level (more floors, lit windows, a glass crown at the top
// level); the stadium bowl gains light towers, a video board and a roof. Select a
// building for its level ladder (what each tier does), the upgrade cost from the
// owner's budget, and how it stacks up against the league.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useApp, app } from '../store';
import { vivid } from '../components';
import { FACILITIES, facility, facilityState, upgrade, upgradeCost, type FacilityId } from '../../core/facilities';
import type { League } from '../../core/types';

const S = 21, OX = 600, OY = 120;   // iso scale and origin
type V = [number, number];
const P = (x: number, y: number, z = 0): V => [OX + (x - y) * 0.866 * S, OY + (x + y) * 0.5 * S - z * S];
const pts = (...v: V[]) => v.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
/** A darker (k < 1) version of any CSS colour. */
const shade = (c: string, k: number) => `color-mix(in srgb, ${c} ${Math.round(k * 100)}%, #000)`;

/** Footprints on the campus grid: x, y, width, depth. */
const LOT: Record<Exclude<FacilityId, 'stadium'>, [number, number, number, number]> = {
  training: [18, 0, 7, 4], strength: [28, 0, 4, 4], film: [18, 8, 5, 4], medical: [27, 8, 5, 5], scouting: [19, 19, 5, 3],
};

/** A building: three lit faces, floors and windows by level, a crown at level five. */
function Building({ id, lvl, c, on, onClick, grow }: { id: FacilityId; lvl: number; c: string; on: boolean; onClick: () => void; grow: boolean }) {
  const [x, y, w, d] = LOT[id as keyof typeof LOT];
  const h = 1.6 + lvl * 1.15, floors = 1 + lvl;
  const top = [P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h)];
  const left = [P(x, y + d), P(x + w, y + d), P(x + w, y + d, h), P(x, y + d, h)];
  const right = [P(x + w, y), P(x + w, y + d), P(x + w, y + d, h), P(x + w, y, h)];
  const wins: ReactNode[] = [];
  for (let f = 0; f < floors; f++) {
    const z0 = 0.5 + f * ((h - 0.6) / floors), z1 = z0 + (h - 0.6) / floors * 0.55;
    for (let j = 0; j < w * 2 - 1; j++) { const a = x + 0.3 + j * 0.5, lit = (j * 7 + f * 3 + lvl) % 5 < 2 + lvl * 0.5;
      wins.push(<polygon key={`l${f}-${j}`} points={pts(P(a, y + d, z0), P(a + 0.3, y + d, z0), P(a + 0.3, y + d, z1), P(a, y + d, z1))} fill={lit ? '#ffe7a3' : '#0d1220'} opacity={lit ? 0.85 : 0.9} />); }
    for (let j = 0; j < d * 2 - 1; j++) { const b = y + 0.3 + j * 0.5, lit = (j * 5 + f * 2 + lvl) % 4 < 1 + lvl * 0.5;
      wins.push(<polygon key={`r${f}-${j}`} points={pts(P(x + w, b, z0), P(x + w, b + 0.3, z0), P(x + w, b + 0.3, z1), P(x + w, b, z1))} fill={lit ? '#ffd889' : '#0b0f1a'} opacity={lit ? 0.7 : 0.9} />); }
  }
  const [cx, cy] = P(x + w / 2, y + d / 2, h);
  return (
    <g className={`fx-b${on ? ' on' : ''}${grow ? ' grow' : ''}`} onClick={onClick} style={{ transformOrigin: `${P(x + w / 2, y + d / 2)[0]}px ${P(x + w / 2, y + d / 2)[1]}px` }}>
      <polygon points={pts(P(x + 0.4, y + d + 0.4), P(x + w + 1.2, y + d + 0.4), P(x + w + 1.2, y + 0.4), P(x + w, y))} fill="#000" opacity=".35" />
      <polygon points={pts(...left)} fill="#232b39" />
      <polygon points={pts(...right)} fill="#171d28" />
      {wins}
      <polygon points={pts(...top)} fill={shade(c, 0.85)} />
      <polygon points={pts(P(x + 0.4, y + 0.4, h), P(x + w - 0.4, y + 0.4, h), P(x + w - 0.4, y + d - 0.4, h), P(x + 0.4, y + d - 0.4, h))} fill={shade(c, 0.55)} />
      {/* Team-colour trim along the roofline. */}
      <polyline points={pts(P(x, y + d, h), P(x + w, y + d, h), P(x + w, y, h))} fill="none" stroke={c} strokeWidth="2.2" />
      {id === 'medical' && <path d={`M${cx - 4} ${cy - 10} h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 z`} fill="#fff" transform={`translate(0 6) scale(1 .6) translate(0 ${cy * 0.66})`} />}
      {lvl >= 4 && <><line x1={cx} y1={cy} x2={cx} y2={cy - 24} stroke="#c8d0dc" strokeWidth="1.5" /><circle className="fx-beacon" cx={cx} cy={cy - 25} r="2.6" fill="#ff4d5e" /></>}
      {lvl >= 5 && <polygon points={pts(P(x + 1, y + 1, h), P(x + w - 1, y + 1, h), P(x + w - 1, y + d - 1, h), P(x + 1, y + d - 1, h), P(x + w / 2, y + d / 2, h + 1.6))} fill="rgba(140,200,255,.35)" stroke="rgba(200,230,255,.6)" />}
    </g>
  );
}

/** The stadium bowl: stands, field, light towers (L3+), video board (L4+), roof (L5). */
function Stadium({ lvl, c, c2, on, onClick, grow }: { lvl: number; c: string; c2: string; on: boolean; onClick: () => void; grow: boolean }) {
  const cx = 7.5, cy = 9, R = 6.4, H = 1.4 + lvl * 0.5;
  const [x0, y0] = P(cx, cy), rx = R * S * 1.2247, ry = R * S * 0.7071;
  const field = [P(cx - 3.2, cy - 1.6, H * 0.15), P(cx + 3.2, cy - 1.6, H * 0.15), P(cx + 3.2, cy + 1.6, H * 0.15), P(cx - 3.2, cy + 1.6, H * 0.15)];
  const tower = (tx: number, ty: number, k: number) => { const [a, b] = P(tx, ty); const [, bt] = P(tx, ty, H + 3.5); return <g key={k}><line x1={a} y1={b} x2={a} y2={bt} stroke="#8a93a3" strokeWidth="2" /><rect x={a - 6} y={bt - 5} width="12" height="5" fill="#fff8dd" className="fx-light" /></g>; };
  return (
    <g className={`fx-b${on ? ' on' : ''}${grow ? ' grow' : ''}`} onClick={onClick} style={{ transformOrigin: `${x0}px ${y0}px` }}>
      <ellipse cx={x0 + 14} cy={y0 + 10} rx={rx} ry={ry} fill="#000" opacity=".4" />
      <path d={`M${x0 - rx} ${y0} A${rx} ${ry} 0 0 0 ${x0 + rx} ${y0} L${x0 + rx} ${y0 - H * S} A${rx} ${ry} 0 0 1 ${x0 - rx} ${y0 - H * S} Z`} fill="#1c2330" />
      {[...Array(lvl + 2)].map((_, i) => <path key={i} d={`M${x0 - rx} ${y0 - (i + 0.5) * (H * S) / (lvl + 2)} A${rx} ${ry} 0 0 0 ${x0 + rx} ${y0 - (i + 0.5) * (H * S) / (lvl + 2)}`} fill="none" stroke={i % 2 ? c : 'rgba(255,255,255,.08)'} strokeOpacity={i % 2 ? 0.55 : 1} strokeWidth="2" />)}
      <ellipse cx={x0} cy={y0 - H * S} rx={rx} ry={ry} fill={shade(c, 0.7)} />
      <ellipse cx={x0} cy={y0 - H * S + 3} rx={rx * 0.78} ry={ry * 0.74} fill="#10151f" />
      <polygon points={pts(...field.map(([a, b]) => [a, b - H * S * 0.85] as V))} fill="#2f8a3e" />
      {[...Array(7)].map((_, i) => { const t = -3.2 + (i + 1) * 0.8; return <line key={i} x1={P(cx + t, cy - 1.6)[0]} y1={P(cx + t, cy - 1.6)[1] - H * S * 0.85 - H * S * 0.15} x2={P(cx + t, cy + 1.6)[0]} y2={P(cx + t, cy + 1.6)[1] - H * S * 0.85 - H * S * 0.15} stroke="#fff" strokeOpacity=".45" strokeWidth=".8" />; })}
      {lvl >= 4 && (() => { const [a, b] = P(cx - 5.4, cy - 3.2, H + 1.6); return <g><rect x={a - 22} y={b - 12} width="44" height="22" rx="2" fill="#05070c" stroke={c2} strokeWidth="1.5" /><rect x={a - 18} y={b - 8} width="36" height="14" fill={c} className="fx-board" /></g>; })()}
      {lvl >= 3 && [tower(cx - R * 0.8, cy - R * 0.8, 0), tower(cx + R * 0.8, cy - R * 0.8, 1), tower(cx - R * 0.8, cy + R * 0.8, 2), tower(cx + R * 0.8, cy + R * 0.8, 3)]}
      {lvl >= 5 && <ellipse cx={x0} cy={y0 - H * S - 10} rx={rx * 0.98} ry={ry * 0.95} fill="rgba(170,210,255,.16)" stroke="rgba(200,230,255,.5)" strokeWidth="1.5" />}
    </g>
  );
}

export function FacilitiesScreen() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const s = facilityState(L);
  const [sel, setSel] = useState<FacilityId>('stadium');
  const [grew, setGrew] = useState<FacilityId | null>(null);
  const c1 = vivid(me.colors[0]), c2 = vivid(me.colors[1] ?? '#ffffff');
  const f = FACILITIES.find(x => x.id === sel)!, lvl = facility(L, L.user, sel);
  const total = FACILITIES.reduce((a, x) => a + facility(L, L.user, x.id), 0);
  const rank = Object.keys(L.teams).map(t => ({ t, v: FACILITIES.reduce((a, x) => a + facility(L, t, x.id), 0) })).sort((a, b) => b.v - a.v).findIndex(x => x.t === L.user) + 1;
  const cost = lvl < 5 ? upgradeCost(lvl) : 0;
  const leagueAvg = (id: FacilityId) => Object.keys(L.teams).reduce((a, t) => a + facility(L, t, id), 0) / Object.keys(L.teams).length;
  const doUpgrade = () => { const r = upgrade(L, sel); if (r.ok) { setGrew(sel); setTimeout(() => setGrew(null), 1600); app.toast(`${f.name} upgraded to level ${lvl + 1}`); } else app.toast(r.reason); app.touch(); };
  return (
    <div className="fx" style={{ '--tc': c1, '--t2': c2 } as CSSProperties}>
      <div className="fx-head">
        <div><span className="up">{me.name} · Team campus</span><div className="h1">Facilities</div><p className="dim">Better buildings mean faster development, quicker recoveries, a louder stadium and sharper game plans. Level 3 is league average.</p></div>
        <div className="fx-stats">
          <div><b>${(s.funds / 1e6).toFixed(0)}M</b><span>Facilities budget</span></div>
          <div><b>{total}<i>/30</i></b><span>Campus rating</span></div>
          <div><b>#{rank}</b><span>In the league</span></div>
        </div>
      </div>
      <div className="fx-body">
        <div className="fx-map">
          <svg viewBox="0 0 1200 720" width="100%">
            <defs>
              <radialGradient id="fx-sky" cx=".5" cy=".1" r="1"><stop offset="0" stopColor="#1a2440" /><stop offset=".6" stopColor="#0a0f1c" /><stop offset="1" stopColor="#05070d" /></radialGradient>
              <linearGradient id="fx-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#173322" /><stop offset="1" stopColor="#0c1d13" /></linearGradient>
            </defs>
            <rect width="1200" height="720" fill="url(#fx-sky)" />
            {[...Array(40)].map((_, i) => <circle key={i} cx={(i * 197) % 1200} cy={(i * 61) % 140} r={i % 3 ? 0.8 : 1.3} fill="#fff" opacity={0.25 + (i % 4) * 0.12} />)}
            {/* The ground: a lit campus lot with roads and parking. */}
            <polygon points={pts(P(-2, -2), P(33, -2), P(33, 26), P(-2, 26))} fill="url(#fx-grass)" />
            <polygon points={pts(P(-2, 16), P(33, 16), P(33, 17.4), P(-2, 17.4))} fill="#222833" />
            <polygon points={pts(P(15, -2), P(16.4, -2), P(16.4, 26), P(15, 26))} fill="#222833" />
            {[...Array(14)].map((_, i) => <polygon key={i} points={pts(P(-1 + i * 2.4, 16.6), P(0 + i * 2.4, 16.6), P(0 + i * 2.4, 16.8), P(-1 + i * 2.4, 16.8))} fill="#e8c25a" opacity=".6" />)}
            {/* Practice fields next to the training center. */}
            {[0, 1].map(k => <g key={k}><polygon points={pts(P(26 + k * 0, 18 + k * 4, 0), P(32, 18 + k * 4), P(32, 21 + k * 4), P(26, 21 + k * 4))} fill="#2a7a37" stroke="#fff" strokeOpacity=".35" />{[...Array(5)].map((_, j) => <line key={j} x1={P(27 + j, 18 + k * 4)[0]} y1={P(27 + j, 18 + k * 4)[1]} x2={P(27 + j, 21 + k * 4)[0]} y2={P(27 + j, 21 + k * 4)[1]} stroke="#fff" strokeOpacity=".3" strokeWidth=".7" />)}</g>)}
            {[...Array(4)].map((_, r) => [...Array(6)].map((_, k) => <polygon key={`${r}-${k}`} points={pts(P(1 + k * 2, 18.5 + r * 1.6), P(2.4 + k * 2, 18.5 + r * 1.6), P(2.4 + k * 2, 19.6 + r * 1.6), P(1 + k * 2, 19.6 + r * 1.6))} fill={(r * 6 + k) % 3 ? '#1a1f28' : shade(c1, 0.6)} opacity=".9" />))}
            {/* Street lights. */}
            {[2, 7, 12, 19, 24, 29].map(x => { const [a, b] = P(x, 15.6); return <g key={x}><line x1={a} y1={b} x2={a} y2={b - 22} stroke="#5a6372" /><circle cx={a} cy={b - 23} r="2.4" fill="#ffe7a3" /><ellipse cx={a} cy={b} rx="16" ry="7" fill="#ffe7a3" opacity=".08" /></g>; })}
            <Stadium lvl={facility(L, L.user, 'stadium')} c={c1} c2={c2} on={sel === 'stadium'} onClick={() => setSel('stadium')} grow={grew === 'stadium'} />
            {(Object.keys(LOT) as (keyof typeof LOT)[]).sort((a, b) => (LOT[a][0] + LOT[a][1]) - (LOT[b][0] + LOT[b][1])).map(id => (
              <Building key={id} id={id} lvl={facility(L, L.user, id)} c={c1} on={sel === id} onClick={() => setSel(id)} grow={grew === id} />
            ))}
            {/* Name pins. */}
            {FACILITIES.map(x => { const [lx, ly] = x.id === 'stadium' ? P(7.5, 9, 4.5 + facility(L, L.user, 'stadium') * 0.5) : (() => { const [a, b, w, d] = LOT[x.id as keyof typeof LOT]; return P(a + w / 2, b + d / 2, 2.6 + facility(L, L.user, x.id) * 1.15); })();
              const on = sel === x.id; return (
              <g key={x.id} className="fx-pin" onClick={() => setSel(x.id)} transform={`translate(${lx} ${ly - 30})`}>
                <rect x={-(x.name.length + 4) * 3.6 - 10} y="-14" width={(x.name.length + 4) * 7.2 + 20} height="24" rx="12" fill={on ? '#ffd34d' : 'rgba(8,10,16,.85)'} stroke={on ? '#ffd34d' : 'rgba(255,255,255,.18)'} />
                <text y="2" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="10.5" fontWeight="800" letterSpacing="1" fill={on ? '#111' : '#fff'}>{x.name.toUpperCase()} · {facility(L, L.user, x.id)}</text>
                <line x1="0" y1="10" x2="0" y2="26" stroke={on ? '#ffd34d' : 'rgba(255,255,255,.3)'} />
              </g>
            ); })}
          </svg>
        </div>
        <aside className="fx-detail">
          <span className="ak">Level {lvl} of 5</span>
          <div className="h2">{f.name}</div>
          <p className="dim">{f.blurb}</p>
          <div className="fx-ladder">{[5, 4, 3, 2, 1].map(k => (
            <div key={k} className={`fx-step${k === lvl ? ' cur' : k < lvl ? ' have' : ''}${k === lvl + 1 ? ' next' : ''}`}>
              <i>{k}</i><div><b>{k === 1 ? 'Outdated' : k === 2 ? 'Below average' : k === 3 ? 'League average' : k === 4 ? 'Top tier' : 'State of the art'}</b><span>{f.effect(k)}</span></div>
              {k === lvl + 1 && <em>${(upgradeCost(lvl) / 1e6).toFixed(0)}M</em>}
            </div>
          ))}</div>
          {lvl < 5
            ? <button className="btn primary big" disabled={cost > s.funds} onClick={doUpgrade}>{cost > s.funds ? `Need $${(cost / 1e6).toFixed(0)}M` : `Build Level ${lvl + 1} · $${(cost / 1e6).toFixed(0)}M`}</button>
            : <div className="fc-max">State of the art</div>}
          <div className="fx-cmp"><span>You</span><i><em style={{ width: `${(lvl / 5) * 100}%` }} /></i><b>{lvl}</b></div>
          <div className="fx-cmp lg"><span>League avg</span><i><em style={{ width: `${(leagueAvg(sel) / 5) * 100}%` }} /></i><b>{leagueAvg(sel).toFixed(1)}</b></div>
          <div className="small mute">The owner adds to the budget every offseason: more for wins, happy fans and his trust in you.</div>
        </aside>
      </div>
      <FacilityStrip L={L} sel={sel} setSel={setSel} />
    </div>
  );
}

function FacilityStrip({ L, sel, setSel }: { L: League; sel: FacilityId; setSel: (f: FacilityId) => void }) {
  return (
    <div className="fx-list">{FACILITIES.map(x => { const l = facility(L, L.user, x.id); return (
      <button key={x.id} className={`fx-row${sel === x.id ? ' on' : ''}`} onClick={() => setSel(x.id)}>
        <b>{x.name}</b><span className="fx-pips">{[1, 2, 3, 4, 5].map(k => <i key={k} className={k <= l ? 'on' : ''} />)}</span><em>{x.effect(l)}</em>
      </button>
    ); })}</div>
  );
}
