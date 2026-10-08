import type React from 'react';
// Lineup: the depth chart as a formation on the field. Every starting spot is a
// card (tier colour by overall, OVR ring, the next two men up, a unit grade against
// the league's starters at that spot). Pick a card to open its depth drawer, where
// anyone on the roster can be slotted in and is rated at that position.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp, app } from '../store';
import { Face, Logo , vivid } from '../components';
import type { League, Player, Pos } from '../../core/types';
import { autoDepth, activateHealthy, teamRatings, markDepth, unmarkDepth } from '../../core/league';
import { overall, POS_NAME } from '../../core/ratings';
import { schemeFit } from '../../core/offseason';

type Unit = 'Offense' | 'Defense' | 'Special Teams';
/** A spot in the formation: `u` is lateral position in card widths from the ball, `r` the row (depth). */
interface Slot { label: string; pos: Pos; i: number; u: number; r: number; auto?: boolean }

// Real alignments. Offense looks downfield from behind the ball (line of scrimmage at
// the top); the defense is drawn the way it lines up across from that offense.
const OL: Slot[] = [
  { label: 'LT', pos: 'OT', i: 0, u: -2, r: 0 }, { label: 'LG', pos: 'G', i: 0, u: -1, r: 0 }, { label: 'C', pos: 'C', i: 0, u: 0, r: 0 },
  { label: 'RG', pos: 'G', i: 1, u: 1, r: 0 }, { label: 'RT', pos: 'OT', i: 1, u: 2, r: 0 }, { label: 'TE', pos: 'TE', i: 0, u: 3.08, r: 0 },
];
const SHOTGUN_11: Slot[] = [ // 3 WR, 1 TE, 1 RB: the sim's base personnel
  { label: 'X', pos: 'WR', i: 0, u: -5.5, r: 0 }, ...OL, { label: 'Z', pos: 'WR', i: 1, u: 5.5, r: 0.32 },
  { label: 'SLOT', pos: 'WR', i: 2, u: -3.95, r: 0.32 },
  { label: 'QB', pos: 'QB', i: 0, u: 0, r: 1.2 }, { label: 'HB', pos: 'RB', i: 0, u: 1.12, r: 1.2 },
];
const PRO_21: Slot[] = [ // 2 WR, 1 TE, FB + HB under center
  { label: 'X', pos: 'WR', i: 0, u: -5.5, r: 0 }, ...OL, { label: 'Z', pos: 'WR', i: 1, u: 5.5, r: 0.32 },
  { label: 'QB', pos: 'QB', i: 0, u: 0, r: 1.12 }, { label: 'FB', pos: 'FB', i: 0, u: -0.62, r: 2.2 }, { label: 'HB', pos: 'RB', i: 0, u: 0.62, r: 2.2 },
];
const NICKEL: Slot[] = [ // 4-2-5 against three receivers
  { label: 'FS', pos: 'S', i: 0, u: -1.8, r: 0 }, { label: 'SS', pos: 'S', i: 1, u: 1.8, r: 0 },
  { label: 'CB1', pos: 'CB', i: 0, u: -5.5, r: 1 }, { label: 'NCB', pos: 'CB', i: 2, u: -3.95, r: 1.05 }, { label: 'MLB', pos: 'LB', i: 0, u: -0.85, r: 1.1 },
  { label: 'WLB', pos: 'LB', i: 1, u: 0.85, r: 1.1 }, { label: 'CB2', pos: 'CB', i: 1, u: 5.5, r: 1 },
  { label: 'LE', pos: 'EDGE', i: 0, u: -2.6, r: 2.15 }, { label: 'DT', pos: 'DT', i: 0, u: -0.78, r: 2.15 }, { label: 'NT', pos: 'DT', i: 1, u: 0.78, r: 2.15 }, { label: 'RE', pos: 'EDGE', i: 1, u: 3.4, r: 2.15 },
];
const SPECIAL: Slot[] = [
  { label: 'K', pos: 'K', i: 0, u: -3.3, r: 0.4 }, { label: 'P', pos: 'P', i: 0, u: -1.1, r: 0.4 }, { label: 'LS', pos: 'LS', i: 0, u: 1.1, r: 0.4 },
  { label: 'KR', pos: 'WR', i: -1, u: 3.3, r: 0.4, auto: true }, { label: 'PR', pos: 'WR', i: -2, u: 5.5, r: 0.4, auto: true },
];
type Personnel = '11' | '21';
const layoutFor = (unit: Unit, pers: Personnel) => (unit === 'Offense' ? (pers === '11' ? SHOTGUN_11 : PRO_21) : unit === 'Defense' ? NICKEL : SPECIAL);

/** Kick and punt returners, picked the way the game engine picks them. */
function returners(L: League) {
  const pool = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && !p.injury && ['WR', 'RB', 'CB'].includes(p.pos))
    .sort((a, b) => (b.attrs.RET + b.attrs.SPD * 0.3) - (a.attrs.RET + a.attrs.SPD * 0.3));
  return [pool[0], pool[1] ?? pool[0]];
}

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
  const [pers, setPers] = useState<Personnel>('11');
  const [sel, setSel] = useState<Slot | null>(null);
  const [gen, setGen] = useState(0);
  const board = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1100, h: 640 });
  useLayoutEffect(() => {
    const el = board.current!; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const r = teamRatings(L, L.user);
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT');
  const slots = layoutFor(unit, pers);
  const [kr, pr] = returners(L);
  const playerAt = (s: Slot) => (s.auto ? (s.label === 'KR' ? kr : pr) : L.players[t.depth[s.pos]?.[s.i] ?? '']);
  const starters = slots.filter(s => !s.auto).map(playerAt).filter(Boolean);
  const fits = starters.filter(p => schemeFit(L, p, L.user)).length;
  const scheme = unit === 'Defense' ? t.coach.def : t.coach.off;
  const generate = () => { const back = activateHealthy(L, L.user); unmarkDepth(L.teams[L.user]); autoDepth(L, L.user); setGen(g => g + 1); app.touch(); app.toast(back.length ? `Best lineup set · activated ${back.map(p => p.ln).join(', ')} from IR` : 'Best lineup set'); };
  // Size the cards to the board: widest formation is 6.3 card-widths either side of the ball.
  const rows = Math.max(...slots.map(s => s.r)) + 1;
  const pad = 26;
  const cw = Math.max(64, Math.min(150, (size.w / 2 - pad) / 6.45, (size.h - pad * 2 - 30) / (rows * 1.62 + 0.25)));
  const ch = cw * 1.62, U = cw * 1.08;
  const offense = unit === 'Offense', defense = unit === 'Defense';
  const groupH = (rows - 1) * (cw * 1.62 + cw * 0.12) + cw * 1.62;
  const top = Math.max(pad + 18, (size.h - groupH) / 2 - (offense ? cw * 0.5 : 0));
  const yOf = (s: Slot) => top + s.r * (ch + cw * 0.12);
  const losY = offense ? top - 10 : defense ? yOf({ r: 2.15 } as Slot) + ch + 10 : -100;
  const yard = ch / 3.2; // one card height ~ 3.2 yards: draws the yard lines to scale
  return (
    <div className="lineup">
      <div className="lu-main">
        <div className="row lu-top">
          <div className="page-title" style={{ margin: 0 }}>Lineup</div>
          <div className="lu-tabs">{(['Offense', 'Defense', 'Special Teams'] as Unit[]).map(u => <button key={u} className={u === unit ? 'on' : ''} onClick={() => { setUnit(u); setSel(null); }}>{u}</button>)}</div>
          {offense && <div className="lu-pers">{(['11', '21'] as Personnel[]).map(x => <span key={x} className={`chip${pers === x ? ' on' : ''}`} onClick={() => { setPers(x); setSel(null); }}>{x === '11' ? '11 Pers · Shotgun' : '21 Pers · Pro Set'}</span>)}</div>}
          {defense && <div className="lu-pers"><span className="chip on">Nickel 4-2-5</span></div>}
        </div>
        <div ref={board} className="lu-stage">
        <div className="lu-board" key={unit + pers + gen} style={{ '--cw': `${cw}px`, '--yd': `${yard}px`, '--los': `${losY}px` } as React.CSSProperties}>
          <div className="lu-turf" />
          <div className="lu-hash l" /><div className="lu-hash r" />
          {unit !== 'Special Teams' && <div className="lu-los"><span>Line of scrimmage</span></div>}
          {slots.map((s, k) => {
            const p = playerAt(s);
            const ids = t.depth[s.pos] ?? [];
            const starterIdx = new Set(slots.filter(z => z.pos === s.pos && !z.auto).map(z => z.i));
            const backups = s.auto ? [] : ids.map((id, j) => ({ id, j })).filter(x => !starterIdx.has(x.j)).slice(0, 2).map(x => L.players[x.id]).filter(Boolean);
            const v = p ? ratingAt(p, s.pos === 'WR' && s.auto ? p.pos : s.pos) : 0;
            const on = sel?.label === s.label;
            const g = s.auto ? '' : slotGrade(L, s, p);
            return (
              <div key={s.label} className={`lu-slot${on ? ' on' : ''}${s.auto ? ' auto' : ''}`} style={{ left: size.w / 2 + s.u * U - cw / 2, top: yOf(s), width: cw, animationDelay: `${k * 0.03}s` }} onClick={() => !s.auto && setSel(on ? null : s)}>
                <div className={`lu-card ${p ? tierOf(v) : 'empty'}`} style={{ '--tc': p ? vivid(L.teams[p.team]?.colors[0] ?? '#2a3040') : undefined } as React.CSSProperties}>
                  <div className="lu-photo">
                    {p ? <Face p={p} size={140} style={{ width: '100%', height: '100%', borderRadius: 0, background: 'transparent' }} /> : <div className="lu-silhouette" />}
                    {p && <Ring v={v} />}
                    {p && p.dev !== 'Normal' && <span className={`lu-dev ${p.dev.replace(/\W/g, '')}`} title={p.dev}>{p.dev === 'X-Factor' ? '✸' : p.dev === 'Superstar' ? '✦' : '★'}</span>}
                    {p?.injury && <span className="lu-inj" title={p.injury.type}>✚ {p.injury.weeks}w</span>}
                    {p && !s.auto && p.pos !== s.pos && <span className="lu-oop" title={`Natural ${p.pos}`}>{p.pos}</span>}
                  </div>
                  <div className="lu-name">{p ? `${p.fn[0]}. ${p.ln}` : 'Empty'}</div>
                  {s.auto ? <div className="lu-back mute"><span>Auto · best returner</span></div> : <>
                    {backups.map(b => <div key={b.id} className="lu-back"><span>{b.fn[0]}. {b.ln}</span><b>{ratingAt(b, s.pos)}</b></div>)}
                    {Array.from({ length: 2 - backups.length }, (_, i) => <div key={i} className="lu-back mute"><span>—</span></div>)}
                  </>}
                </div>
                <div className="lu-label">{s.label}{g && <span className={`grade ${g[0]}`}>{g}</span>}</div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <aside className="lu-side">
        <div className="lu-coach"><Logo team={t} size={44} /><div><div className="h3" style={{ margin: 0 }}>{t.coach.name}</div><div className="small dim">Head Coach · {t.nick}</div></div></div>
        <div className="lu-head">My Lineup · {roster.length}/53</div>
        <div className="lu-rings"><BigRing v={r.ovr} k="OVR" /><BigRing v={r.off} k="OFF" /><BigRing v={r.def} k="DEF" /></div>
        <button className="lu-gen" onClick={generate}><span>⟳</span>Generate Best Lineup</button>
        <div className="lu-head">Scheme</div>
        <div className="row"><b>{scheme}</b><div className="spacer" />{unit !== 'Special Teams' && <b>{fits}/{starters.length} fit</b>}</div>
        {unit !== 'Special Teams' && <div className="lu-fit"><b style={{ width: `${(fits / Math.max(1, starters.length)) * 100}%` }} /></div>}
        {sel ? <Drawer L={L} slot={sel} slots={slots} onDone={() => app.touch()} /> : <div className="lu-hint">Select a player card to change who lines up there.</div>}
      </aside>
    </div>
  );
}

/** Depth for the selected spot: reorder the position, or slot anyone in. */
function Drawer({ L, slot, slots, onDone }: { L: League; slot: Slot; slots: Slot[]; onDone: () => void }) {
  const t = L.teams[L.user];
  const [others, setOthers] = useState(false);
  const ids = t.depth[slot.pos] ?? [];
  const starters = new Set(slots.filter(z => z.pos === slot.pos && !z.auto).map(z => z.i));
  const list = ids.map(id => L.players[id]).filter(Boolean);
  const pool = useMemo(() => Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && !ids.includes(p.id))
    .map(p => ({ p, v: ratingAt(p, slot.pos) })).sort((a, b) => b.v - a.v).slice(0, 12), [L, slot.pos, ids.join()]);
  const put = (id: string) => {
    const a = ids.filter(x => x !== id);
    a.splice(slot.i, 0, id);
    t.depth[slot.pos] = a; markDepth(t, slot.pos); onDone();
  };
  const move = (j: number, d: number) => { const a = [...ids]; const k = j + d; if (k < 0 || k >= a.length) return; [a[j], a[k]] = [a[k], a[j]]; t.depth[slot.pos] = a; markDepth(t, slot.pos); onDone(); };
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
      <text x="18" y="18.5" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill="#fff" fontFamily="Barlow Condensed">{v}</text>
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
