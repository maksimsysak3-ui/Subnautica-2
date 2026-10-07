// Lineup: the depth chart as a formation on the field. Every starting spot is a
// card (tier colour by overall, OVR ring, the next two men up, a unit grade against
// the league's starters at that spot). Pick a card to open its depth drawer, where
// anyone on the roster can be slotted in and is rated at that position.
import { useMemo, useState } from 'react';
import { useApp, app } from '../store';
import { Face, Logo } from '../components';
import type { League, Player, Pos } from '../../core/types';
import { autoDepth, teamRatings } from '../../core/league';
import { overall, POS_NAME } from '../../core/ratings';
import { schemeFit } from '../../core/offseason';

type Unit = 'Offense' | 'Defense' | 'Special Teams';
interface Slot { label: string; pos: Pos; i: number; x: number; y: number }

// Field coordinates in % of the formation board. Offense: line of scrimmage on top
// row, backs below. Defense mirrors it: safeties deep at the top, the line at the bottom.
const OFFENSE: Slot[] = [
  { label: 'WR1', pos: 'WR', i: 0, x: 6, y: 4 }, { label: 'LT', pos: 'OT', i: 0, x: 23.5, y: 4 }, { label: 'LG', pos: 'G', i: 0, x: 35, y: 4 },
  { label: 'C', pos: 'C', i: 0, x: 46.5, y: 4 }, { label: 'RG', pos: 'G', i: 1, x: 58, y: 4 }, { label: 'RT', pos: 'OT', i: 1, x: 69.5, y: 4 },
  { label: 'TE', pos: 'TE', i: 0, x: 81, y: 4 }, { label: 'WR2', pos: 'WR', i: 1, x: 94, y: 4 },
  { label: 'SLOT', pos: 'WR', i: 2, x: 15, y: 37 }, { label: 'QB', pos: 'QB', i: 0, x: 46.5, y: 37 },
  { label: 'FB', pos: 'FB', i: 0, x: 35, y: 68 }, { label: 'HB', pos: 'RB', i: 0, x: 58, y: 68 },
];
const DEFENSE: Slot[] = [
  { label: 'FS', pos: 'S', i: 0, x: 36, y: 4 }, { label: 'SS', pos: 'S', i: 1, x: 58, y: 4 },
  { label: 'CB1', pos: 'CB', i: 0, x: 6, y: 37 }, { label: 'NCB', pos: 'CB', i: 2, x: 19, y: 37 }, { label: 'MLB', pos: 'LB', i: 0, x: 40, y: 37 },
  { label: 'WILL', pos: 'LB', i: 1, x: 54, y: 37 }, { label: 'CB2', pos: 'CB', i: 1, x: 94, y: 37 },
  { label: 'LE', pos: 'EDGE', i: 0, x: 25, y: 69 }, { label: 'DT', pos: 'DT', i: 0, x: 40, y: 69 }, { label: 'NT', pos: 'DT', i: 1, x: 54, y: 69 }, { label: 'RE', pos: 'EDGE', i: 1, x: 69, y: 69 },
];
const SPECIAL: Slot[] = [
  { label: 'K', pos: 'K', i: 0, x: 22, y: 20 }, { label: 'P', pos: 'P', i: 0, x: 40, y: 20 }, { label: 'LS', pos: 'LS', i: 0, x: 58, y: 20 },
];
const LAYOUT: Record<Unit, Slot[]> = { Offense: OFFENSE, Defense: DEFENSE, 'Special Teams': SPECIAL };

const tierOf = (v: number) => (v >= 90 ? 'elite' : v >= 80 ? 'gold' : v >= 70 ? 'silver' : 'bronze');
const GRADES: [number, string][] = [[0.92, 'A+'], [0.84, 'A'], [0.76, 'A-'], [0.66, 'B+'], [0.56, 'B'], [0.46, 'B-'], [0.36, 'C+'], [0.26, 'C'], [0.16, 'C-'], [0.06, 'D']];

/** Where this starter ranks among every team's starter at the same spot. */
function slotGrade(L: League, s: Slot, p?: Player) {
  if (!p) return 'F';
  const all = Object.values(L.teams).map(t => L.players[t.depth[s.pos]?.[s.i] ?? '']?.ovr ?? 0).sort((a, b) => a - b);
  const below = all.filter(v => v < p.ovr).length + all.filter(v => v === p.ovr).length / 2;
  const pct = below / Math.max(1, all.length);
  return GRADES.find(([q]) => pct >= q)?.[1] ?? 'F';
}
/** His rating if he lines up at `pos` (a guard at tackle, a safety at corner…). */
const ratingAt = (p: Player, pos: Pos) => (p.pos === pos ? p.ovr : Math.round(overall(pos, p.attrs)));

export function DepthScreen() {
  const L = useApp().league!;
  const t = L.teams[L.user];
  const [unit, setUnit] = useState<Unit>('Offense');
  const [sel, setSel] = useState<Slot | null>(null);
  const [gen, setGen] = useState(0);
  const r = teamRatings(L, L.user);
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT');
  const slots = LAYOUT[unit];
  const starters = slots.map(s => L.players[t.depth[s.pos]?.[s.i] ?? '']).filter(Boolean);
  const fits = starters.filter(p => schemeFit(L, p, L.user)).length;
  const scheme = unit === 'Defense' ? t.coach.def : t.coach.off;
  const generate = () => { autoDepth(L, L.user); setGen(g => g + 1); app.touch(); app.toast('Best lineup set'); };
  return (
    <div className="lineup">
      <div className="lu-main">
        <div className="row lu-top">
          <div className="page-title" style={{ margin: 0 }}>Lineup</div>
          <div className="lu-tabs">{(['Offense', 'Defense', 'Special Teams'] as Unit[]).map(u => <button key={u} className={u === unit ? 'on' : ''} onClick={() => { setUnit(u); setSel(null); }}>{u}</button>)}</div>
        </div>
        <div className="lu-scroll"><div className={`lu-board ${unit === 'Special Teams' ? 'st' : ''}`} key={unit + gen}>
          <div className="lu-turf" />
          {unit !== 'Special Teams' && <div className="lu-los" style={{ top: unit === 'Offense' ? '30%' : '64%' }} />}
          {slots.map((s, k) => {
            const ids = t.depth[s.pos] ?? [];
            const p = L.players[ids[s.i] ?? ''];
            // The next men up at this position, skipping the other starters there.
            const starterIdx = new Set(LAYOUT[unit].filter(z => z.pos === s.pos).map(z => z.i));
            const backups = ids.map((id, j) => ({ id, j })).filter(x => !starterIdx.has(x.j)).slice(0, 2).map(x => L.players[x.id]).filter(Boolean);
            const v = p ? ratingAt(p, s.pos) : 0;
            const on = sel?.label === s.label;
            return (
              <div key={s.label} className={`lu-slot${on ? ' on' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${k * 0.035}s` }} onClick={() => setSel(on ? null : s)}>
                <div className={`lu-card ${p ? tierOf(v) : 'empty'}`}>
                  <div className="lu-photo">
                    {p ? <Face p={p} size={120} style={{ width: '100%', height: '100%', borderRadius: 0, background: 'transparent' }} /> : <div className="lu-silhouette" />}
                    {p && <Ring v={v} />}
                    {p && p.dev !== 'Normal' && <span className={`lu-dev ${p.dev.replace(/\W/g, '')}`} title={p.dev}>{p.dev === 'X-Factor' ? '✸' : p.dev === 'Superstar' ? '✦' : '★'}</span>}
                    {p?.injury && <span className="lu-inj" title={p.injury.type}>✚ {p.injury.weeks}w</span>}
                    {p && p.pos !== s.pos && <span className="lu-oop" title={`Natural ${p.pos}`}>{p.pos}</span>}
                  </div>
                  <div className="lu-name">{p ? `${p.fn[0]}.${p.ln}` : 'Empty'}</div>
                  {backups.map(b => <div key={b.id} className="lu-back"><span>{b.fn[0]}.{b.ln}</span><b>{ratingAt(b, s.pos)}</b></div>)}
                  {Array.from({ length: 2 - backups.length }, (_, i) => <div key={i} className="lu-back mute"><span>—</span></div>)}
                </div>
                <div className="lu-label">{s.label}<span className={`grade ${slotGrade(L, s, p)[0]}`}>{slotGrade(L, s, p)}</span></div>
              </div>
            );
          })}
        </div></div>
      </div>

      <aside className="lu-side">
        <div className="lu-coach"><Logo team={t} size={44} /><div><div className="h3" style={{ margin: 0 }}>{t.coach.name}</div><div className="small dim">Head Coach · {t.nick}</div></div></div>
        <div className="lu-head">My Lineup: {roster.length}/53 Players</div>
        <div className="lu-rings"><BigRing v={r.ovr} k="OVR" /><BigRing v={r.off} k="OFF" /><BigRing v={r.def} k="DEF" /></div>
        <button className="lu-gen" onClick={generate}><span>⟳</span>Generate Best Lineup</button>
        <div className="lu-head">Scheme</div>
        <div className="row"><b>{scheme}</b><div className="spacer" />{unit !== 'Special Teams' && <b>{fits}/{starters.length} fit</b>}</div>
        {unit !== 'Special Teams' && <div className="lu-fit"><b style={{ width: `${(fits / Math.max(1, starters.length)) * 100}%` }} /></div>}
        <div className="small dim" style={{ marginTop: 4 }}>Starters whose archetype suits the {unit === 'Defense' ? 'defensive' : 'offensive'} scheme play it best.</div>
        {sel ? <Drawer L={L} slot={sel} unit={unit} onDone={() => app.touch()} /> : <div className="lu-hint">Select a card to change who plays there.</div>}
      </aside>
    </div>
  );
}

/** Depth for the selected spot: reorder the position, or slot anyone in. */
function Drawer({ L, slot, unit, onDone }: { L: League; slot: Slot; unit: Unit; onDone: () => void }) {
  const t = L.teams[L.user];
  const [others, setOthers] = useState(false);
  const ids = t.depth[slot.pos] ?? [];
  const starters = new Set(LAYOUT[unit].filter(z => z.pos === slot.pos).map(z => z.i));
  const list = ids.map(id => L.players[id]).filter(Boolean);
  const pool = useMemo(() => Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && !ids.includes(p.id))
    .map(p => ({ p, v: ratingAt(p, slot.pos) })).sort((a, b) => b.v - a.v).slice(0, 12), [L, slot.pos, ids.join()]);
  const put = (id: string) => {
    const a = ids.filter(x => x !== id);
    a.splice(slot.i, 0, id);
    t.depth[slot.pos] = a; onDone();
  };
  const move = (j: number, d: number) => { const a = [...ids]; const k = j + d; if (k < 0 || k >= a.length) return; [a[j], a[k]] = [a[k], a[j]]; t.depth[slot.pos] = a; onDone(); };
  return (
    <div className="lu-drawer">
      <div className="row"><div className="h3" style={{ margin: 0 }}>{slot.label} · {POS_NAME[slot.pos]}</div><div className="spacer" />
        <span className={`chip${others ? '' : ' on'}`} onClick={() => setOthers(false)}>Depth</span><span className={`chip${others ? ' on' : ''}`} onClick={() => setOthers(true)}>Any Position</span></div>
      <div className="lu-list">
        {!others ? list.map((p, j) => (
          <div key={p.id} className={`lu-row${j === slot.i ? ' cur' : ''}`}>
            <span className="lu-rank">{starters.has(j) ? 'ST' : j + 1}</span><Face p={p} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}><b>{p.fn} {p.ln}</b><div className="small mute">{p.pos} · {p.arch}{p.injury ? ` · ✚ ${p.injury.weeks}w` : ''}</div></div>
            <span className={`lu-ovr ${tierOf(ratingAt(p, slot.pos))}`}>{ratingAt(p, slot.pos)}</span>
            <div className="lu-btns"><button onClick={() => move(j, -1)} disabled={j === 0}>▲</button><button onClick={() => move(j, 1)} disabled={j === list.length - 1}>▼</button>{j !== slot.i && <button className="go" onClick={() => put(p.id)}>Start</button>}</div>
          </div>
        )) : pool.map(({ p, v }) => (
          <div key={p.id} className="lu-row">
            <Face p={p} size={34} /><div style={{ minWidth: 0, flex: 1 }}><b>{p.fn} {p.ln}</b><div className="small mute">Natural {p.pos} ({p.ovr}) · as {slot.pos}</div></div>
            <span className={`lu-ovr ${tierOf(v)}`}>{v}</span><div className="lu-btns"><button className="go" onClick={() => put(p.id)}>Start</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Ring({ v }: { v: number }) {
  const c = 2 * Math.PI * 15;
  return (
    <svg className="lu-ring" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15" fill="rgba(5,8,14,.85)" stroke="rgba(255,255,255,.15)" strokeWidth="3" />
      <circle cx="18" cy="18" r="15" fill="none" stroke={v >= 90 ? '#ff5a6e' : v >= 80 ? '#ffd23f' : v >= 70 ? '#d7dee8' : '#e08a3c'} strokeWidth="3" strokeDasharray={`${(v / 99) * c} ${c}`} transform="rotate(-90 18 18)" strokeLinecap="round" />
      <text x="18" y="22.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Barlow Condensed">{v}</text>
    </svg>
  );
}
function BigRing({ v, k }: { v: number; k: string }) {
  const c = 2 * Math.PI * 40;
  return (
    <div className="lu-bigring">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="8" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="url(#lugr)" strokeWidth="8" strokeDasharray={`${(v / 99) * c} ${c}`} transform="rotate(-90 50 50)" strokeLinecap="round" style={{ transition: 'stroke-dasharray .8s ease' }} />
        <defs><linearGradient id="lugr"><stop offset="0" stopColor="#ffd23f" /><stop offset="1" stopColor="#ff9f1c" /></linearGradient></defs>
      </svg>
      <b>{v}</b><span>{k}</span>
    </div>
  );
}
