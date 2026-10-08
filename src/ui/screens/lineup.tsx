import type React from 'react';
// Depth chart: the starters laid out in their real formation on a broadcast-style
// field, one clean card per spot (player art on team colour, overall, position, name,
// archetype, a league grade for the spot). Select a card and the side panel becomes
// that spot's depth list: reorder it, or slot anyone on the roster in, rated at that
// position. With nothing selected, the panel lists the unit's starters.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp, app } from '../store';
import { Logo, vivid, DevIcon } from '../components';
import { FaceArt } from '../face';
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
  const backupsOf = (s: Slot) => { const ids = t.depth[s.pos] ?? [], st = new Set(slots.filter(z => z.pos === s.pos && !z.auto).map(z => z.i)); const b = ids.map((id, j) => ({ id, j })).filter(x => !st.has(x.j)).slice(0, 2).map(x => L.players[x.id]); return [b[0], b[1]]; };
  const fits = starters.filter(p => schemeFit(L, p, L.user)).length;
  const scheme = unit === 'Defense' ? t.coach.def : t.coach.off;
  const generate = () => { const back = activateHealthy(L, L.user); unmarkDepth(L.teams[L.user]); autoDepth(L, L.user); setGen(g => g + 1); app.touch(); app.toast(back.length ? `Best lineup set · activated ${back.map(p => p.ln).join(', ')} from IR` : 'Best lineup set'); };
  // Card size from the board: the widest formation is ~6.4 card widths either side of the ball.
  const rows = Math.max(...slots.map(s => s.r)) + 1;
  const pad = 24;
  // Wideouts are packed in next to the formation (order kept, a small split from the
  // core) instead of at true splits, so the cards can be much bigger.
  const packed = new Map<number, number>();
  for (const sgn of [-1, 1]) {
    const side = [...new Set(slots.filter(z => Math.sign(z.u) === sgn).map(z => Math.abs(z.u)))].sort((x, y) => x - y);
    const core = side.filter(v => v <= 3.1), m = core.length ? core[core.length - 1] : 0;
    let prev = m;
    for (const v of side) if (v > 3.1) { prev = Math.max(prev + 1, m + 1.25); packed.set(sgn * v, sgn * prev); }
  }
  const du = (u: number) => packed.get(u) ?? u;
  const maxU = Math.max(...slots.map(s => Math.abs(du(s.u))));
  const cw = Math.max(72, Math.min(140, (size.w / 2 - pad) / (maxU * 1.06 + 0.55), (size.h - pad * 2 - 20) / (rows * 1.72 + 0.3)));
  const ch = cw * 1.62, U = cw * 1.08;
  const offense = unit === 'Offense', defense = unit === 'Defense';
  const groupH = (rows - 1) * (ch + cw * 0.08) + ch;
  const top = Math.max(pad + 16, (size.h - groupH) / 2);
  const yOf = (s: Slot) => top + s.r * (ch + cw * 0.08);
  const losY = offense ? top - 9 : defense ? yOf({ r: 2.15 } as Slot) + ch + 9 : -100;
  const yard = ch / 3.2;
  const unitGrade = (k: Slot[]) => { const gs = k.filter(s => !s.auto).map(s => slotGrade(L, s, playerAt(s))); const pts = gs.map(g => GRADES.findIndex(([, x]) => x === g)).map(i => (i < 0 ? 10 : i)); const avg = pts.reduce((a, b) => a + b, 0) / Math.max(1, pts.length); return GRADES[Math.min(GRADES.length - 1, Math.round(avg))][1]; };
  return (
    <div className="dc">
      <div className="dc-main">
        <div className="dc-top">
          <div className="dc-title"><span className="up">Manage Roster</span><b>Depth Chart</b></div>
          <div className="dc-units">{(['Offense', 'Defense', 'Special Teams'] as Unit[]).map(u => <button key={u} className={u === unit ? 'on' : ''} onClick={() => { setUnit(u); setSel(null); }}>{u}</button>)}</div>
          <div className="spacer" />
          {offense && <div className="dc-seg">{(['11', '21'] as Personnel[]).map(x => <button key={x} className={pers === x ? 'on' : ''} onClick={() => { setPers(x); setSel(null); }}>{x === '11' ? 'Shotgun · 11' : 'Pro Set · 21'}</button>)}</div>}
          {defense && <div className="dc-seg"><button className="on">Nickel 4-2-5</button></div>}
        </div>
        <div ref={board} className="dc-stage">
          <div className="dc-board" key={unit + pers + gen} style={{ '--cw': `${cw}px`, '--yd': `${yard}px`, '--los': `${losY}px` } as React.CSSProperties}>
            <div className="dc-turf" />
            {unit !== 'Special Teams' && <div className="dc-los"><span>LOS</span></div>}
            {slots.map((s, k) => {
              const p = playerAt(s);
              const v = p ? ratingAt(p, s.auto ? p.pos : s.pos) : 0;
              const on = sel?.label === s.label;
              const g = s.auto ? '' : slotGrade(L, s, p);
              return (
                <div key={s.label} className={`md-slot${on ? ' on' : ''}`} style={{ left: size.w / 2 + du(s.u) * U - cw / 2, top: yOf(s), width: cw, animationDelay: `${k * 0.025}s` } as React.CSSProperties}>
                  <button className={`md-card ${p ? tierOf(v) : 'empty'}${s.auto ? ' auto' : ''}`} onClick={() => !s.auto && setSel(on ? null : s)} title={p ? `${p.fn} ${p.ln} · ${p.pos} ${p.ovr}` : 'Empty'}>
                    <div className="md-art">
                      {p ? <Shot p={p} /> : <div className="dc-empty">+</div>}
                      {p && p.dev !== 'Normal' && <span className="md-dev"><DevIcon d={p.dev} size={Math.round(cw * 0.15)} /></span>}
                      {p && <b className="md-ovr">{v}</b>}
                      {p?.injury && <span className="md-inj">OUT</span>}
                      {p && !s.auto && p.pos !== s.pos && <span className="md-oop">{p.pos}</span>}
                    </div>
                    <div className="md-depth">
                      <div className="md-st">{p ? `${p.fn[0]}.${p.ln}` : 'Empty'}</div>
                      {s.auto ? <div className="md-bk"><span>Auto returner</span></div> : backupsOf(s).map((b, j) => b
                        ? <div key={b.id} className="md-bk"><span>{b.fn[0]}.{b.ln}</span><b>{ratingAt(b, s.pos)}</b></div>
                        : <div key={j} className="md-bk"><span>—</span></div>)}
                    </div>
                  </button>
                  <div className="md-label"><b>{s.label}</b>{g && <span>| {g}</span>}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="dc-side">
        <div className="dc-team"><Logo team={t} size={40} /><div><b>{t.name}</b><span>HC {t.coach.name} · {roster.length}/53</span></div></div>
        <div className="dc-tiles">{([['OVR', r.ovr], ['OFF', r.off], ['DEF', r.def]] as const).map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div>
        <button className="btn primary dc-auto" onClick={generate}>Auto · Best Lineup</button>
        {unit !== 'Special Teams' && <div className="dc-fit"><div className="row" style={{ justifyContent: 'space-between' }}><span className="up">{scheme}</span><b>{fits}/{starters.length} scheme fits</b></div><div className="dc-bar"><i style={{ width: `${(fits / Math.max(1, starters.length)) * 100}%` }} /></div></div>}
        {sel ? <Drawer L={L} slot={sel} slots={slots} onDone={() => app.touch()} onClose={() => setSel(null)} /> : (
          <div className="dc-list">
            <div className="dc-lh"><span className="up">{unit} starters</span><span className="up">Unit grade <b className={`dc-grade g${unitGrade(slots)[0]}`}>{unitGrade(slots)}</b></span></div>
            {slots.map(s => { const p = playerAt(s); const g = s.auto ? '' : slotGrade(L, s, p); const v = p ? ratingAt(p, s.auto ? p.pos : s.pos) : 0; return (
              <div key={s.label} className={`dc-row${s.auto ? ' auto' : ''}`} onClick={() => !s.auto && setSel(s)}>
                <span className="dc-rl">{s.label}</span>
                <span className="dc-rn">{p ? `${p.fn[0]}. ${p.ln}` : 'Empty'}{p?.injury && <em> OUT</em>}</span>
                <b className={`dc-rv ${p ? tierOf(v) : ''}`}>{p ? v : '—'}</b>
                {g ? <i className={`dc-grade g${g[0]}`}>{g}</i> : <i />}
              </div>
            ); })}
            <div className="small mute" style={{ marginTop: 10 }}>Select a card or a row to edit that spot. Positions you never edit are kept sorted for you every week.</div>
          </div>
        )}
      </aside>
    </div>
  );
}

/** Player art for a card: the real headshot when it loads, the drawn face otherwise. */
function Shot({ p }: { p: Player }) {
  const [bad, setBad] = useState(false);
  const t = app.league?.teams[p.team];
  return p.hs && !bad
    ? <img className="dc-img" src={p.hs.replace('f_auto,q_auto', 'f_auto,q_auto,w_200')} alt="" loading="lazy" onError={() => setBad(true)} />
    : <div className="dc-img svg"><FaceArt p={p} team={t} size={120} /></div>;
}

/** Depth for the selected spot: reorder the position, or slot anyone in. */
function Drawer({ L, slot, slots, onDone, onClose }: { L: League; slot: Slot; slots: Slot[]; onDone: () => void; onClose: () => void }) {
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
  const row = (p: Player, v: number, rank: string, cur: boolean, ctrl: React.ReactNode, sub: string) => (
    <div key={p.id} className={`dc-drow${cur ? ' cur' : ''}`}>
      <span className="dc-rank">{rank}</span>
      <div className="dc-thumb" style={{ '--tc': vivid(L.teams[p.team]?.colors[0] ?? '#2a3040') } as React.CSSProperties}><Shot p={p} /></div>
      <div className="dc-dn" title={`${p.fn} ${p.ln}`}><b>{p.fn[0]}. {p.ln}</b><span>{sub}</span></div>
      <b className={`dc-rv ${tierOf(v)}`}>{v}</b>
      <div className="dc-ctrl">{ctrl}</div>
    </div>
  );
  return (
    <div className="dc-drawer">
      <div className="dc-dh"><div><span className="up">Depth · {POS_NAME[slot.pos]}</span><b>{slot.label}</b></div><button className="btn sm" onClick={onClose}>Done</button></div>
      <div className="dc-seg full"><button className={others ? '' : 'on'} onClick={() => setOthers(false)}>{slot.pos} Depth</button><button className={others ? 'on' : ''} onClick={() => setOthers(true)}>Any Position</button></div>
      <div className="dc-dlist">
        {!others ? list.map((p, j) => row(p, ratingAt(p, slot.pos), starters.has(j) ? 'ST' : String(j + 1), j === slot.i,
          <><button onClick={() => move(j, -1)} disabled={j === 0} aria-label="Move up">▲</button><button onClick={() => move(j, 1)} disabled={j === list.length - 1} aria-label="Move down">▼</button>{j !== slot.i && <button className="go" onClick={() => put(p.id)}>Start</button>}</>,
          p.injury ? `OUT ${p.injury.weeks}w · ${p.injury.type}` : `${p.pos} · ${Math.floor(p.age)} · ${p.arch}`))
          : pool.map(({ p, v }) => row(p, v, '', false, <button className="go" onClick={() => put(p.id)}>Start</button>, `${p.pos} ${p.ovr} · plays ${slot.pos} at ${v}`))}
      </div>
    </div>
  );
}
