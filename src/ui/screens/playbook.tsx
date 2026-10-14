// Playbook: one coach's binder. The team-color cover opens on an index; tabbed dividers split it
// into formations (offense) and fronts (defense); every play is an install page with its diagram
// drawn in ink and run like coaching film, plus the coaching notes. Pages turn around the rings
// (arrows, keyboard, swipe, the corner, or a divider tab), two at a time on a desk and one at a
// time on a phone. The inside cover holds the book chooser: which offensive and defensive book
// the binder shows, and which one you call from in games. Formation subs live on each divider.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useApp, app } from '../store';
import { Modal, Face, Logo } from '../components';
import { PlayDiagram } from '../playart';
import { PlayDesigner, registerPlays } from '../playdesigner';
import { books, activeBook, OFF_LIB, DEF_LIB, OFF_SETS, DEF_SETS, offPlay, defPlay, defaultBooks } from '../plays';
import { TEAM_PLAYS } from '../teamplays';
import { PlaySheetArt, offenseSheet, defenseSheet, PERS_NOTE } from '../playsheet';
import type { League, Playbook, Player } from '../../core/types';
import type { DefSet } from '../../sim/game';
import '../playbook.css';

type Side = 'off' | 'def';
type FaceT =
  | { k: 'cover' } | { k: 'inside' } | { k: 'toc' } | { k: 'designer' } | { k: 'back' } | { k: 'paper' }
  | { k: 'notes'; n: number }
  | { k: 'div'; side: Side; fi: number; sec: number }
  | { k: 'play'; side: Side; fi: number; name: string; no: string };
interface Sec { key: string; label: string; kind: Side | 'toc' | 'des'; face: number; color: string; count: number; fi?: number }

const SLOT_POS: Record<'X' | 'Z' | 'SLOT' | 'TE' | 'RB', string[]> = { X: ['WR', 'TE'], Z: ['WR', 'TE'], SLOT: ['WR', 'TE', 'RB', 'FB'], TE: ['TE', 'WR', 'FB'], RB: ['RB', 'FB'] };
const SLOT_NAME = { X: 'X Receiver', Z: 'Z Receiver', SLOT: 'Slot', TE: 'Tight End', RB: 'Running Back' } as const;
const DEFAULT_WHO: Record<string, Partial<Record<keyof typeof SLOT_NAME, string>>> = {
  '10': { TE: 'WR4' }, '12': { SLOT: 'TE2' }, '13': { Z: 'TE2', SLOT: 'TE3' }, '21': { SLOT: 'FB' }, '22': { Z: 'TE2', SLOT: 'FB' },
};
const TAB_OFF = ['#f2cf5b', '#8cc0ea', '#9fd49a', '#f4a99e', '#f7b866', '#c4a6e8', '#82d1c6', '#ead9a8', '#f59fc0', '#b8d36a'];
const TAB_DEF = ['#e46c6c', '#6c8fe0', '#e09a4c', '#57b39a', '#b77fd6', '#d6c25a'];
const keyOf = (f: FaceT) => (f.k === 'play' ? `p-${f.side}-${f.fi}-${f.name}` : f.k === 'div' ? `d-${f.side}-${f.fi}` : f.k === 'notes' ? `n-${f.n}` : f.k);
const isPaper = (f?: FaceT) => !!f && f.k !== 'cover' && f.k !== 'inside' && f.k !== 'back';
const setLabel = (sd: Side, s: string) => (sd === 'off' ? OFF_SETS[s]?.label ?? s : DEF_SETS[s as DefSet]?.label ?? s);
const setNote = (sd: Side, s: string) => (sd === 'off' ? OFF_SETS[s]?.note ?? '' : DEF_SETS[s as DefSet]?.note ?? '');

function useReducedMotion() {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const f = () => setR(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return r;
}
/** The marker font for the handwritten bits, loaded once. */
function useMarkerFont() {
  useEffect(() => {
    if (document.getElementById('pbk-font')) return;
    const l = document.createElement('link');
    l.id = 'pbk-font'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap';
    document.head.appendChild(l);
  }, []);
}

// Page sizes the content is designed at; the binder scales them to fit.
const DESK = { w: 500, h: 690 }, PHONE = { w: 380, h: 660 };
const GAP = 26; // the ring gutter between the two pages

export function PlaybookScreen() {
  const st = useApp();
  const L = st.league!;
  useMarkerFont();
  useMemo(() => registerPlays(L), [L]);
  const all = books(L);
  const [offId, setOffId] = useState(() => activeBook(L, 'off')!.id);
  const [defId, setDefId] = useState(() => activeBook(L, 'def')!.id);
  const off = all.find(b => b.id === offId && b.side === 'off') ?? activeBook(L, 'off')!;
  const dfn = all.find(b => b.id === defId && b.side === 'def') ?? activeBook(L, 'def')!;
  const team = L.teams[L.user];
  const reduced = useReducedMotion();

  // ---- size: two pages on a desk, one on a phone ----
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1200, h: 800 });
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    // Height left for the binder: below the screen header, above the ticker bar.
    const f = () => setBox({ w: el.clientWidth, h: window.innerHeight - Math.max(0, el.getBoundingClientRect().top + window.scrollY) - 190 });
    f(); const ro = new ResizeObserver(f); ro.observe(el); window.addEventListener('resize', f);
    return () => { ro.disconnect(); window.removeEventListener('resize', f); };
  }, []);
  const single = box.w < 860;
  const base = single ? PHONE : DESK;
  const fitW = (box.w - 210 - GAP) / (2 * base.w);
  const k = single ? Math.min(1.25, (box.w - 22) / base.w) : Math.max(Math.min(0.88, fitW), Math.min(1.3, fitW, box.h / base.h));
  const pw = Math.round(base.w * k), ph = Math.round(base.h * k);

  // ---- the pages ----
  const { faces, secs } = useMemo(() => {
    const F: FaceT[] = [{ k: 'cover' }, { k: 'inside' }, { k: 'toc' }];
    const S: Sec[] = [{ key: 'toc', label: 'Index', kind: 'toc', face: 2, color: '#f4efe2', count: 0 }];
    let notes = 0;
    for (const [side, book] of [['off', off], ['def', dfn]] as const) {
      let no = 0;
      book.folders.forEach((fo, fi) => {
        if (!single && F.length % 2 === 1) F.push({ k: 'notes', n: notes++ });
        const pal = side === 'off' ? TAB_OFF : TAB_DEF;
        S.push({ key: `${side}${fi}`, label: fo.name, kind: side, face: F.length, color: pal[fi % pal.length], count: fo.plays.length, fi });
        F.push({ k: 'div', side, fi, sec: S.length - 1 });
        for (const name of fo.plays) F.push({ k: 'play', side, fi, name, no: `${side === 'off' ? 'O' : 'D'}-${++no}` });
      });
    }
    if (!single && F.length % 2 === 1) F.push({ k: 'notes', n: notes++ });
    S.push({ key: 'des', label: 'New Play', kind: 'des', face: F.length, color: '#e8463a', count: 0 });
    F.push({ k: 'designer' });
    return { faces: F, secs: S };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off, dfn, single, st.v]);
  const nSpreads = single ? faces.length : Math.floor(faces.length / 2) + 1;
  const spreadOf = (fi: number) => (single ? fi : Math.ceil(fi / 2));
  const left = (s: number): FaceT | null => (single ? null : s ? faces[2 * s - 1] ?? { k: 'back' } : null);
  const right = (s: number): FaceT => (single ? faces[s] : faces[2 * s] ?? { k: 'back' });
  const pageNo = (f: FaceT) => { const i = faces.indexOf(f); return i >= 2 ? i - 1 : 0; };

  const [spread, setSpread] = useState(0);
  const [flip, setFlip] = useState<null | { from: number; to: number }>(null);
  const cur = Math.min(spread, nSpreads - 1);
  useEffect(() => { if (spread > nSpreads - 1) setSpread(nSpreads - 1); }, [spread, nSpreads]);
  // Keep the same page in view when the layout switches between one and two pages.
  const lastSingle = useRef(single);
  useEffect(() => {
    if (lastSingle.current === single) return;
    lastSingle.current = single;
    setSpread(s => (single ? 2 * s : Math.ceil(s / 2)));
  }, [single]);

  const go = (to: number) => {
    to = Math.max(0, Math.min(nSpreads - 1, to));
    if (flip || to === cur) return;
    if (reduced) { setSpread(to); return; }
    setFlip({ from: cur, to });
  };
  const goFace = (fi: number) => go(spreadOf(fi));
  const goRef = useRef(go); goRef.current = go;
  const curRef = useRef(cur); curRef.current = cur;

  // Keyboard: left and right turn pages, Home and End jump to the covers.
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || document.querySelector('.modal-bg')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goRef.current(curRef.current + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goRef.current(curRef.current - 1); }
      else if (e.key === 'Home') goRef.current(1);
    };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
  }, []);
  // Swipe on touch screens.
  const touch0 = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const p = e.touches[0]; touch0.current = { x: p.clientX, y: p.clientY, t: Date.now() }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch0.current; touch0.current = null; if (!s) return;
    const p = e.changedTouches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - s.t < 900) go(cur + (dx < 0 ? 1 : -1));
  };

  // ---- the turn itself: one or more leaves rotate around the rings ----
  const leafRefs = useRef<(HTMLDivElement | null)[]>([]);
  const castRef = useRef<HTMLDivElement>(null);
  const nLeaves = flip ? Math.min(4, Math.abs(flip.to - flip.from)) : 0;
  useLayoutEffect(() => {
    if (!flip) return;
    const fwd = flip.to > flip.from;
    const dur = nLeaves > 1 ? 560 : 820, stagger = 120;
    const ease = 'cubic-bezier(.45,.05,.25,1)';
    const anims: Animation[] = [];
    for (let j = 0; j < nLeaves; j++) {
      const el = leafRefs.current[j]; if (!el) continue;
      const a = fwd ? 0 : -180, b = fwd ? -180 : 0;
      anims.push(el.animate([
        { transform: `rotateY(${a}deg)`, zIndex: 40 - j },
        { transform: `rotateY(${(a + b) / 2}deg) translateZ(18px)`, zIndex: 40 - j, offset: 0.5 },
        { transform: `rotateY(${(a + b) / 2}deg) translateZ(18px)`, zIndex: 20 + j, offset: 0.5001 },
        { transform: `rotateY(${b}deg)`, zIndex: 20 + j },
      ], { duration: dur, delay: j * stagger, easing: ease, fill: 'both' }));
      el.querySelectorAll('.bnd-shade').forEach(sh => anims.push(sh.animate([{ opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: dur, delay: j * stagger, easing: ease, fill: 'both' })));
    }
    if (castRef.current) anims.push(castRef.current.animate([{ opacity: 0 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: dur + (nLeaves - 1) * stagger, easing: ease, fill: 'both' }));
    let done = false;
    const finish = () => { if (done) return; done = true; setSpread(flip.to); setFlip(null); };
    Promise.all(anims.map(a => a.finished)).then(finish, finish);
    return () => { anims.forEach(a => a.cancel()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  // ---- modals ----
  const [naming, setNaming] = useState<null | { kind: 'book' | 'rename' | 'folder'; side: Side; value: string; set?: string }>(null);
  const [adding, setAdding] = useState<null | { side: Side; fi: number }>(null);
  const [drawing, setDrawing] = useState<null | { side: Side; fi?: number }>(null);
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  useEffect(() => {
    if (!jumpTo) return;
    const i = faces.findIndex(f => f.k === 'play' && f.name === jumpTo);
    setJumpTo(null);
    if (i >= 0) { const s = spreadOf(i); if (reduced) setSpread(s); else if (s !== cur) setFlip({ from: cur, to: s }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces, jumpTo]);
  const bookOf = (sd: Side) => (sd === 'off' ? off : dfn);
  const newId = () => `pb-${Date.now().toString(36)}`;
  const commitName = () => {
    if (!naming) return;
    const v = naming.value.trim(); if (!v) return setNaming(null);
    const book = bookOf(naming.side);
    if (naming.kind === 'book') { const nb: Playbook = { ...JSON.parse(JSON.stringify(book)), id: newId(), name: v }; L.playbooks!.push(nb); (naming.side === 'off' ? setOffId : setDefId)(nb.id); }
    else if (naming.kind === 'rename') book.name = v;
    else if (!book.folders.some(x => x.name === v)) book.folders.push({ name: v, set: naming.set ?? (naming.side === 'off' ? 'Shotgun' : 'Nickel'), plays: [] });
    setNaming(null); app.touch();
  };
  const bookActions = {
    use: (sd: Side) => { const b = bookOf(sd); L.activeBook = { ...L.activeBook, [sd]: b.id }; app.toast(`${b.name} is now your ${sd === 'off' ? 'offensive' : 'defensive'} playbook`); app.touch(); },
    pick: (sd: Side, id: string) => (sd === 'off' ? setOffId : setDefId)(id),
    copy: (sd: Side) => setNaming({ kind: 'book', side: sd, value: `${bookOf(sd).name} (copy)` }),
    rename: (sd: Side) => setNaming({ kind: 'rename', side: sd, value: bookOf(sd).name }),
    template: (sd: Side) => { const d = defaultBooks().find(x => x.side === sd)!; const nb = { ...d, id: newId(), name: `${sd === 'off' ? 'Offense' : 'Defense'} Template` }; L.playbooks!.push(nb); (sd === 'off' ? setOffId : setDefId)(nb.id); app.touch(); },
    del: (sd: Side) => {
      const b = bookOf(sd);
      if (all.filter(x => x.side === sd).length < 2) return;
      L.playbooks = L.playbooks!.filter(x => x.id !== b.id);
      if (L.activeBook?.[sd] === b.id) L.activeBook = { ...L.activeBook, [sd]: L.playbooks.find(x => x.side === sd)!.id };
      (sd === 'off' ? setOffId : setDefId)(activeBook(L, sd)!.id); app.touch();
    },
    folder: (sd: Side) => setNaming({ kind: 'folder', side: sd, value: '', set: sd === 'off' ? 'Shotgun' : 'Nickel' }),
  };

  const ctx: Ctx = {
    L, off, dfn, faces, secs, single, k, pageNo, goFace, reduced, all,
    bookActions, openAdd: (side, fi) => setAdding({ side, fi }), openDraw: (side, fi) => setDrawing({ side, fi }),
    removePlay: (side, fi, name) => { const f = bookOf(side).folders[fi]; f.plays = f.plays.filter(x => x !== name); app.touch(); },
    removeFolder: (side, fi) => { const b = bookOf(side); if (b.folders.length < 2) return; b.folders = b.folders.filter((_, i) => i !== fi); app.touch(); },
  };

  // What is on the desk right now: the two base pages, plus the leaves in flight.
  const fwd = flip ? flip.to > flip.from : true;
  const baseL = !flip ? left(cur) : fwd ? left(flip.from) : left(flip.to);
  const baseR = !flip ? right(cur) : fwd ? right(flip.to) : right(flip.from);
  const leaves: { front: FaceT | null; back: FaceT | null }[] = [];
  if (flip) for (let j = 0; j < nLeaves; j++) {
    const first = j === 0, last = j === nLeaves - 1;
    if (single) leaves.push({ front: fwd ? (first ? faces[flip.from] : { k: 'paper' }) : (last ? faces[flip.to] : { k: 'paper' }), back: (fwd ? flip.from : flip.to) === 0 && (fwd ? first : last) ? { k: 'inside' } : { k: 'paper' } });
    else leaves.push({ front: fwd ? (first ? right(flip.from) : { k: 'paper' }) : (last ? right(flip.to) : { k: 'paper' }), back: fwd ? (last ? left(flip.to) : { k: 'paper' }) : (first ? left(flip.from) : { k: 'paper' }) });
  }
  const closed = cur === 0 && !flip;
  const opening = !!flip && (flip.from === 0 || flip.to === 0);
  const settled = !flip;
  // Page stacks: how much paper is under each side.
  const nPaper = faces.length;
  const leftFi = single ? cur : 2 * cur - 1, stackL = Math.min(9, Math.max(0, leftFi - 1) / 5), stackR = Math.min(9, Math.max(0, nPaper - leftFi - 2) / 5);
  const visFace = single ? cur : 2 * cur;
  const curSec = [...secs].reverse().find(s => s.face <= Math.max(1, visFace)) ?? secs[0];
  const slotH = Math.min(58, (ph - 30) / secs.length);
  const stageW = single ? pw : 2 * pw + GAP;
  const vars = { '--k': k, '--pw': `${pw}px`, '--ph': `${ph}px`, '--gap': `${GAP}px`, '--c1': team.colors[0], '--c2': team.colors[1] ?? '#fff', '--c3': team.colors[2] ?? team.colors[1] ?? '#ccc', '--bw': `${base.w}px`, '--bh': `${base.h}px` } as CSSProperties;
  const pageTitle = (() => { const f = single ? faces[cur] : right(cur); return f.k === 'cover' ? 'Cover' : `Page ${pageNo(single ? faces[cur] : (left(cur) ?? f)) || 1}${single ? '' : `–${pageNo(f) || ''}`}`; })();

  return (
    <div className={`pbk2${single ? ' one' : ''}`} ref={wrap}>
      <div className="pbk2-head">
        <div className="pbk2-title"><b>Playbook</b><span>{off.name} · {dfn.name}</span></div>
        <div className="pbk2-nav">
          {!single && <span className="pbk2-hint"><kbd>←</kbd><kbd>→</kbd> turn · tabs jump</span>}
          <span className="pbk2-where">{closed ? `${off.folders.length + dfn.folders.length} sections · ${off.folders.reduce((a, f) => a + f.plays.length, 0) + dfn.folders.reduce((a, f) => a + f.plays.length, 0)} plays` : `${curSec.label} · ${pageTitle.replace(/–$/, '')}`}</span>
          <button className="pbk2-arrow" aria-label="Previous page" disabled={cur === 0} onClick={() => go(cur - 1)}>‹</button>
          <button className="pbk2-arrow" aria-label="Next page" disabled={cur >= nSpreads - 1} onClick={() => go(cur + 1)}>›</button>
        </div>
      </div>
      {single && (
        <div className="pbk2-strip" role="tablist">
          {secs.map(s => <button key={s.key} role="tab" aria-selected={s === curSec} className={`pbk2-stab${s === curSec ? ' on' : ''}`} style={{ '--tab': s.color } as CSSProperties} onClick={() => goFace(s.face)}>{s.kind === 'off' ? <em>O</em> : s.kind === 'def' ? <em>D</em> : null}{s.label}</button>)}
        </div>
      )}
      <div className="pbk2-desk" style={vars} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className={`bnd${closed ? ' closed' : ''}${opening ? ' opening' : ''}`} style={{ width: stageW, height: ph }}>
          {/* the binder boards behind the paper */}
          {!single && <div className={`bnd-board l${cur === 0 && !flip ? ' gone' : ''}`} />}
          <div className="bnd-board r" />
          {!single && <div className={`bnd-spine${closed ? ' gone' : ''}`}><i /><i /><i /></div>}
          {/* stacks of paper */}
          {!single && cur > 0 && <div className="bnd-stack l" style={{ '--n': stackL } as CSSProperties} />}
          <div className="bnd-stack r" style={{ '--n': stackR } as CSSProperties} />
          {/* the pages lying open */}
          {baseL && <div className="bnd-slot l"><Page key={keyOf(baseL)} f={baseL} side="l" ctx={ctx} active={settled} /></div>}
          <div className="bnd-slot r"><Page key={keyOf(baseR)} f={baseR} side="r" ctx={ctx} active={settled} /><div className="bnd-cast" ref={castRef} /></div>
          {/* leaves in flight */}
          {leaves.map((lf, j) => (
            <div key={`${flip!.from}-${flip!.to}-${j}`} className="bnd-leaf" ref={el => { leafRefs.current[j] = el; }} style={{ transform: `rotateY(${fwd ? 0 : -180}deg)`, zIndex: 40 - j }}>
              <div className="bnd-face front">{lf.front && <Page f={lf.front} side="r" ctx={ctx} active={false} />}<div className="bnd-shade f" /></div>
              <div className="bnd-face back">{lf.back && <Page f={lf.back} side="l" ctx={ctx} active={false} />}<div className="bnd-shade b" /></div>
            </div>
          ))}
          {/* the rings over everything */}
          {!single && !closed && <div className="bnd-rings">{[0.17, 0.5, 0.83].map(y => <i key={y} style={{ top: `${y * 100}%` }} />)}</div>}
          {single && cur > 0 && <div className="bnd-rings one">{[0.12, 0.5, 0.88].map(y => <i key={y} style={{ top: `${y * 100}%` }} />)}</div>}
          {/* divider tabs sticking out of the stacks */}
          {!single && !closed && secs.map((s, i) => {
            const onLeft = s.face <= 2 * cur - 1;
            return <button key={s.key} className={`bnd-tab ${onLeft ? 'l' : 'r'}${s === curSec ? ' on' : ''} ${s.kind}`} style={{ top: 14 + i * slotH, height: slotH - 4, '--tab': s.color } as CSSProperties} onClick={() => goFace(s.face)} title={s.label}>
              <span>{s.kind === 'off' ? <em>O</em> : s.kind === 'def' ? <em>D</em> : null}{s.label}</span>
            </button>;
          })}
          {/* the corners you can grab to turn */}
          {!closed && cur < nSpreads - 1 && <button className="bnd-corner r" aria-label="Turn the page" onClick={() => go(cur + 1)} />}
          {!closed && cur > 0 && !single && <button className="bnd-corner l" aria-label="Turn back" onClick={() => go(cur - 1)} />}
          {closed && <button className="bnd-open" onClick={() => go(1)}>Open the binder</button>}
        </div>
      </div>
      {single && <div className="pbk2-hint">Swipe or tap a tab to turn pages</div>}

      {naming && (
        <Modal onClose={() => setNaming(null)}>
          <div className="h2" style={{ marginBottom: 12 }}>{naming.kind === 'book' ? 'New Playbook' : naming.kind === 'rename' ? 'Rename Playbook' : `New ${naming.side === 'off' ? 'Offensive' : 'Defensive'} Section`}</div>
          <div className="grid" style={{ gap: 10 }}>
            <input autoFocus value={naming.value} maxLength={28} onChange={e => setNaming({ ...naming, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && commitName()} placeholder="Name" />
            {naming.kind === 'folder' && <label className="pd-l">{naming.side === 'off' ? 'Formation' : 'Front'} for new plays<select value={naming.set} onChange={e => setNaming({ ...naming, set: e.target.value })}>
              {naming.side === 'off' ? Object.entries(OFF_SETS).map(([k2, v]) => <option key={k2} value={k2}>{v.label}</option>) : (Object.keys(DEF_SETS) as DefSet[]).map(k2 => <option key={k2} value={k2}>{DEF_SETS[k2].label}</option>)}</select></label>}
            <button className="btn primary" onClick={commitName}>Save</button>
          </div>
        </Modal>
      )}
      {adding && <AddPlays L={L} sd={adding.side} folder={bookOf(adding.side).folders[adding.fi]} close={() => setAdding(null)} />}
      {drawing && (() => {
        const b = bookOf(drawing.side), fo = drawing.fi !== undefined ? b.folders[drawing.fi] : undefined;
        return <PlayDesigner L={L} side={drawing.side} set={fo?.set} target={{ book: b.id, folder: fo?.name ?? 'My Plays' }} close={() => setDrawing(null)}
          onSaved={n => { setDrawing(null); registerPlays(L); app.toast(`${n} filed in ${fo?.name ?? 'My Plays'}`); app.touch(); setJumpTo(n); }} />;
      })()}
    </div>
  );
}

interface Ctx {
  L: League; off: Playbook; dfn: Playbook; faces: FaceT[]; secs: Sec[]; single: boolean; k: number; reduced: boolean; all: Playbook[];
  pageNo: (f: FaceT) => number; goFace: (i: number) => void;
  bookActions: Record<'use' | 'copy' | 'rename' | 'template' | 'del' | 'folder', (sd: Side) => void> & { pick: (sd: Side, id: string) => void };
  openAdd: (side: Side, fi: number) => void; openDraw: (side: Side, fi?: number) => void;
  removePlay: (side: Side, fi: number, name: string) => void; removeFolder: (side: Side, fi: number) => void;
}

/** One face of a sheet, at design size, scaled into its slot. */
function Page({ f, side, ctx, active }: { f: FaceT; side: 'l' | 'r'; ctx: Ctx; active: boolean }) {
  const cls = f.k === 'cover' ? 'cover' : f.k === 'inside' || f.k === 'back' ? 'vinyl' : f.k === 'div' ? 'divc' : 'paper';
  let body: ReactNode = null;
  switch (f.k) {
    case 'cover': body = <Cover ctx={ctx} />; break;
    case 'inside': body = <Inside ctx={ctx} />; break;
    case 'back': body = <div className="pg-back"><span>{ctx.L.teams[ctx.L.user].name}</span></div>; break;
    case 'toc': body = <Toc ctx={ctx} />; break;
    case 'div': body = <Divider f={f} ctx={ctx} active={active} />; break;
    case 'play': body = <PlayPage f={f} ctx={ctx} active={active} />; break;
    case 'notes': body = <Notes />; break;
    case 'designer': body = <Designer ctx={ctx} />; break;
    case 'paper': body = null; break;
  }
  const n = isPaper(f) && f.k !== 'paper' ? ctx.pageNo(f) : 0;
  const color = f.k === 'div' ? ctx.secs[f.sec]?.color : undefined;
  return (
    <div className={`pg ${cls} ${side}`} style={color ? { '--tab': color } as CSSProperties : undefined}>
      <div className="pg-in">{body}</div>
      {(cls === 'paper' || cls === 'divc') && <div className="pg-holes">{[0.12, 0.5, 0.88].map(y => <i key={y} style={{ top: `${y * 100}%` }} />)}</div>}
      {n > 0 && <span className="pg-no">{n}</span>}
    </div>
  );
}

// ---- cover and inside cover ------------------------------------------------------------------
function Cover({ ctx }: { ctx: Ctx }) {
  const L = ctx.L, t = L.teams[L.user];
  return (
    <div className="cv">
      <div className="cv-stitch" />
      <div className="cv-hinge" />
      <div className="cv-top"><span>{L.season} Season</span><span>Install</span></div>
      <div className="cv-plate"><Logo team={t} size={150} /></div>
      <div className="cv-title">Playbook</div>
      <div className="cv-team">{t.name}</div>
      <div className="cv-label">
        <div><b>Offense</b><span>{ctx.off.name}</span></div>
        <div><b>Defense</b><span>{ctx.dfn.name}</span></div>
        <div><b>Head coach</b><span className="hand">{t.coach.name}</span></div>
      </div>
      <div className="cv-conf">Confidential</div>
      <div className="cv-foot">Property of the {t.name}. If found, return to the head coach's office.</div>
      {['tl', 'tr', 'bl', 'br'].map(c => <i key={c} className={`cv-corner ${c}`} />)}
    </div>
  );
}

function Inside({ ctx }: { ctx: Ctx }) {
  const { L, all, bookActions: A } = ctx;
  const sideBlock = (sd: Side) => {
    const mine = all.filter(b => b.side === sd), shown = sd === 'off' ? ctx.off : ctx.dfn;
    return (
      <div className="in-side">
        <div className="in-h">{sd === 'off' ? 'Offense' : 'Defense'}</div>
        <div className="in-books">
          {mine.map(b => (
            <button key={b.id} className={`in-book${b.id === shown.id ? ' on' : ''}`} onClick={() => A.pick(sd, b.id)}>
              <i />
              <span><b>{b.name}</b><small>{b.folders.length} sections · {b.folders.reduce((a, x) => a + x.plays.length, 0)} plays</small></span>
              {L.activeBook?.[sd] === b.id && <em>In games</em>}
            </button>
          ))}
        </div>
        <div className="in-acts">
          {L.activeBook?.[sd] !== shown.id && <button className="in-btn primary" onClick={() => A.use(sd)}>Use in games</button>}
          <button className="in-btn" onClick={() => A.copy(sd)}>Copy</button>
          <button className="in-btn" onClick={() => A.rename(sd)}>Rename</button>
          <button className="in-btn" onClick={() => A.template(sd)}>From template</button>
          <button className="in-btn" onClick={() => A.folder(sd)}>+ Section</button>
          {mine.length > 1 && <button className="in-btn bad" onClick={() => A.del(sd)}>Delete</button>}
        </div>
      </div>
    );
  };
  return (
    <div className="in">
      <div className="in-card">
        <div className="in-title">This binder holds</div>
        <p className="in-p">Pick the book for each side of the ball. The one marked <em>In games</em> is what you call from on game day.</p>
        {sideBlock('off')}
        {sideBlock('def')}
        <div className="in-sig"><span>Approved</span><b className="hand">{L.teams[L.user].coach.name}</b></div>
      </div>
      <div className="in-pocket" />
    </div>
  );
}

// ---- index -------------------------------------------------------------------------------------
function Toc({ ctx }: { ctx: Ctx }) {
  const { L, secs, faces } = ctx;
  const t = L.teams[L.user];
  const row = (s: Sec) => (
    <button key={s.key} className="toc-row" onClick={() => ctx.goFace(s.face)}>
      <i style={{ background: s.color }} />
      <span className="toc-name">{s.label}</span>
      {s.count > 0 && <span className="toc-ct">{s.count} {s.count === 1 ? 'play' : 'plays'}</span>}
      <span className="toc-dots" />
      <span className="toc-pg">{ctx.pageNo(faces[s.face])}</span>
    </button>
  );
  const nOff = ctx.off.folders.reduce((a, f) => a + f.plays.length, 0), nDef = ctx.dfn.folders.reduce((a, f) => a + f.plays.length, 0);
  return (
    <div className="toc sheet">
      <div className="sh-top"><Logo team={t} size={30} /><span>{t.name} · {L.season} Install</span><span className="sh-stamp">Confidential</span></div>
      <div className="toc-h">Contents</div>
      <div className="toc-sub">{nOff} offensive plays · {nDef} defensive calls · {secs.length - 2} sections</div>
      <div className="toc-group"><span>Offense</span><small>{ctx.off.name}</small></div>
      {secs.filter(s => s.kind === 'off').map(row)}
      <div className="toc-group"><span>Defense</span><small>{ctx.dfn.name}</small></div>
      {secs.filter(s => s.kind === 'def').map(row)}
      <div className="toc-group"><span>Workshop</span></div>
      {secs.filter(s => s.kind === 'des').map(row)}
      <div className="toc-key">
        <span><svg width="26" height="10"><path d="M1 5 H20" stroke="#c3122f" strokeWidth="2.4" /><path d="M18 1 L25 5 L18 9 Z" fill="#c3122f" /></svg>Primary read</span>
        <span><svg width="26" height="10"><path d="M1 5 H19 M19 1 V9" stroke="#1b1a17" strokeWidth="1.8" /></svg>Block</span>
        <span><svg width="26" height="10"><path d="M1 5 L4 2 L7 8 L10 2 L13 8 L16 2 L19 8 L22 5" stroke="#1b1a17" strokeWidth="1.4" fill="none" /></svg>Motion</span>
        <span><svg width="26" height="10"><ellipse cx="13" cy="5" rx="11" ry="4" fill="none" stroke="#2a5fa8" /></svg>Zone</span>
      </div>
    </div>
  );
}

// ---- dividers ----------------------------------------------------------------------------------
function Divider({ f, ctx, active }: { f: Extract<FaceT, { k: 'div' }>; ctx: Ctx; active: boolean }) {
  const book = f.side === 'off' ? ctx.off : ctx.dfn, fo = book.folders[f.fi];
  if (!fo) return null;
  const sec = ctx.secs[f.sec];
  const num = ctx.secs.filter(s => s.kind === f.side).indexOf(sec) + 1;
  const pers = f.side === 'off' ? OFF_SETS[fo.set]?.pers : undefined;
  const first = ctx.faces.indexOf(f);
  const w = ctx.single ? 340 : 452;
  const setCall = useMemo(() => (pers ? { kind: 'pass' as const, pers } : undefined), [pers]);
  return (
    <div className="dv sheet">
      <div className="dv-band"><span>{f.side === 'off' ? 'Offense' : 'Defense'} · Section {String(num).padStart(2, '0')}</span><span>{fo.plays.length} {fo.plays.length === 1 ? 'play' : 'plays'}</span></div>
      <div className="dv-title">{fo.name}</div>
      <div className="dv-subt">{setLabel(f.side, fo.set)}{pers ? ` · ${pers} personnel (${PERS_NOTE[pers]})` : ''}</div>
      <div className="dv-art">
        <PlaySheetArt name={`__set:${fo.set}`} def={f.side === 'def'} set={f.side === 'def' ? fo.set as DefSet : undefined} call={setCall} align={OFF_SETS[fo.set]?.align} w={w} ghost={false} active={false} />
        <span className="dv-note hand">{setNote(f.side, fo.set)}</span>
      </div>
      <div className="dv-cols">
        <div className="dv-list">
          <div className="dv-h">In this section</div>
          {fo.plays.slice(0, 9).map((n, i) => <button key={n} className="dv-row" onClick={() => ctx.goFace(first + 1 + i)}><span>{n}</span><i /><b>{ctx.pageNo(ctx.faces[first + 1 + i])}</b></button>)}
          {fo.plays.length > 9 && <div className="dv-more">+ {fo.plays.length - 9} more</div>}
          {!fo.plays.length && <div className="dv-more">Empty. Add plays from the library or draw one.</div>}
        </div>
        {f.side === 'off' && OFF_SETS[fo.set] && <Subs L={ctx.L} set={fo.set} />}
      </div>
      <div className="sh-acts">
        <button className="in-btn primary" onClick={() => ctx.openAdd(f.side, f.fi)}>+ Add plays</button>
        <button className="in-btn" onClick={() => ctx.openDraw(f.side, f.fi)}>✎ Draw a play</button>
        {book.folders.length > 1 && <button className="in-btn bad" onClick={() => ctx.removeFolder(f.side, f.fi)}>Remove section</button>}
      </div>
    </div>
  );
}

/** Formation substitutions: who lines up at each skill spot in this set. */
function Subs({ L, set }: { L: League; set: string }) {
  const def = OFF_SETS[set];
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && ['WR', 'TE', 'RB', 'FB'].includes(p.pos)).sort((a, b) => b.ovr - a.ovr);
  const subs = L.formSubs?.[set] ?? {};
  const setSub = (slot: keyof typeof SLOT_NAME, id: string) => { L.formSubs = { ...L.formSubs, [set]: { ...subs, [slot]: id || undefined } }; app.touch(); };
  const by = (id?: string) => (id ? L.players[id] as Player | undefined : undefined);
  return (
    <div className="dv-subs">
      <div className="dv-h">Personnel · subs</div>
      {(Object.keys(SLOT_NAME) as (keyof typeof SLOT_NAME)[]).map(slot => { const p = by(subs[slot]); return (
        <label key={slot} className="dv-sub">
          {p ? <Face p={p} size={24} /> : <i className="dv-dot">{slot === 'SLOT' ? 'S' : slot === 'TE' ? 'Y' : slot === 'RB' ? 'R' : slot}</i>}
          <span>{SLOT_NAME[slot]}</span>
          <select value={subs[slot] ?? ''} onChange={e => setSub(slot, e.target.value)}>
            <option value="">Depth chart{DEFAULT_WHO[def.pers]?.[slot] ? ` (${DEFAULT_WHO[def.pers]![slot]})` : ''}</option>
            {roster.filter(x => SLOT_POS[slot].includes(x.pos)).map(x => <option key={x.id} value={x.id}>{x.pos} {x.fn[0]}. {x.ln} ({x.ovr})</option>)}
          </select>
        </label>
      ); })}
    </div>
  );
}

// ---- a play ------------------------------------------------------------------------------------
// Where a play lives on the call sheet, and the marker note a coach scrawls next to its name.
const SITS = ['1st & 10', '2nd & long', '2nd & short', '3rd & short', '3rd & long', 'Red zone', 'Goal line', '2-minute'] as const;
type Sit = typeof SITS[number];
function situations(sd: Side, set: string, call?: { kind: string; run?: string; depth?: string; pa?: boolean }, d?: { shell: string; blitz: boolean }): Sit[] {
  if (set === 'Goal Line') return sd === 'off' ? ['3rd & short', 'Goal line'] : ['Goal line', '3rd & short'];
  if (sd === 'off' && call) {
    if (call.kind === 'run') return call.run === 'qb' ? ['2nd & short', '3rd & short', 'Red zone'] : call.run === 'outside' ? ['1st & 10', '2nd & short', 'Red zone'] : ['1st & 10', '2nd & short', '3rd & short', 'Goal line'];
    if (call.pa) return ['1st & 10', '2nd & short', 'Red zone'];
    return ({ screen: ['2nd & long', '3rd & long'], quick: ['2nd & long', '3rd & short', 'Red zone', '2-minute'], short: ['1st & 10', '2nd & long', '2-minute'], medium: ['2nd & long', '3rd & long', '2-minute'], deep: ['1st & 10', '2nd & short'] } as Record<string, Sit[]>)[call.depth ?? 'short'] ?? ['1st & 10'];
  }
  if (!d) return [];
  if (d.blitz) return d.shell === 'Cover 0' ? ['3rd & short', 'Goal line', 'Red zone'] : ['2nd & long', '3rd & long', '3rd & short'];
  return ({ 'Cover 2': ['2nd & long', '2-minute', 'Red zone'], 'Cover 3': ['1st & 10', '2nd & short'], 'Cover 4': ['3rd & long', '2-minute', '1st & 10'], 'Cover 1': ['1st & 10', '3rd & short', 'Red zone'], Prevent: ['2-minute'] } as Record<string, Sit[]>)[d.shell] ?? ['1st & 10'];
}
function scrawl(sd: Side, set: string, call?: { kind: string; run?: string; depth?: string; pa?: boolean }, d?: { shell: string; blitz: boolean }, desc = ''): string {
  if (sd === 'off' && call) {
    if (set === 'Goal Line') return 'Punch it in!';
    if (call.kind === 'run') return call.run === 'qb' ? 'Read it, then go!' : call.run === 'outside' ? 'Get to the edge!' : 'Pad level. Downhill!';
    if (call.pa) return 'Sell the fake!';
    if (call.depth === 'screen') return 'Let them come!';
    if (call.depth === 'deep') return 'Shot! Look off the safety';
    if (/man|rub/i.test(desc)) return 'Man beater';
    return call.depth === 'quick' ? 'Ball out on time!' : 'Zone beater';
  }
  if (!d) return '';
  if (d.blitz) return d.shell === 'Cover 0' ? 'No help! Win now' : 'Disguise, then go!';
  return ({ 'Cover 2': 'Re-route #1!', 'Cover 3': 'Keep it in front', 'Cover 4': 'Cap the verts', 'Cover 1': 'Press, trail, rally', Prevent: 'Nothing deep!' } as Record<string, string>)[d.shell] ?? '';
}

function PlayPage({ f, ctx, active }: { f: Extract<FaceT, { k: 'play' }>; ctx: Ctx; active: boolean }) {
  const { L } = ctx;
  const book = f.side === 'off' ? ctx.off : ctx.dfn, fo = book.folders[f.fi];
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const info = useMemo(() => (f.side === 'off' ? offPlay(L, f.name) : undefined), [L, f.name, f.side]);
  const dinfo = useMemo(() => (f.side === 'def' ? defPlay(L, f.name) : undefined), [L, f.name, f.side]);
  const set = info?.set ?? dinfo?.set ?? fo?.set ?? '';
  const sheet = useMemo(() => (f.side === 'off' ? offenseSheet(f.name, info?.call, info?.desc ?? '') : dinfo ? defenseSheet(f.name, dinfo.call, dinfo.set, dinfo.desc) : null), [f.name, f.side, info, dinfo]);
  const base = f.side === 'off' ? TEAM_PLAYS.get(f.name)?.base : undefined;
  const desc = info?.desc ?? dinfo?.desc ?? '';
  const pers = info?.call.pers;
  const w = ctx.single ? 340 : 452;
  const auto = active && !ctx.reduced;
  const filmOn = active && (auto || run > 0);
  const sits = situations(f.side, set, info?.call, dinfo?.call);
  const callTag = info ? (info.call.kind === 'run' ? 'Run' : info.call.pa ? 'Play-action' : info.call.depth === 'screen' ? 'Screen' : 'Pass') : dinfo?.call.blitz ? 'Pressure' : 'Coverage';
  return (
    <div className={`pp sheet ${f.side}`}>
      <div className="sh-top"><span>{f.side === 'off' ? 'Offense' : 'Defense'} · {fo?.name ?? ''}</span><span className="pp-no">{f.no}</span></div>
      <div className="pp-head">
        <div className="pp-name">{f.name}</div>
        <div className="pp-sit hand">{scrawl(f.side, set, info?.call, dinfo?.call, desc)}</div>
      </div>
      <div className="pp-tags">
        <span className={`pp-tag k ${callTag.toLowerCase().replace(/\W/g, '')}`}>{callTag}</span>
        <span className="pp-tag">{f.side === 'off' ? `Form: ${setLabel('off', set)}` : `Front: ${setLabel('def', set)}`}</span>
        {pers && <span className="pp-tag">{pers} pers · {PERS_NOTE[pers]}</span>}
        {dinfo && <span className="pp-tag">{dinfo.call.box} in box</span>}
        {base && base !== f.name && <span className="pp-tag dim">Concept: {base}</span>}
      </div>
      <div className={`pp-art${playing ? ' playing' : ''}`}>
        <PlaySheetArt name={f.name} def={f.side === 'def'} set={dinfo?.set} call={info?.call} w={w} active={filmOn} run={run} onFilm={setPlaying} />
        <button className="pp-run" onClick={() => setRun(r => r + 1)} disabled={!active}>{playing ? '● Rolling' : '▶ Run play'}</button>
      </div>
      <div className="pp-desc">{desc}{sheet?.protection ? <> · <b>{sheet.protection}</b></> : null}</div>
      {sheet && (
        <div className="pp-cols">
          <div className="pp-box">
            <div className="pp-h">{sheet.reads.length ? 'Progression' : 'Assignments'}</div>
            {sheet.reads.map(r => <div key={r.n} className={`pp-read${r.primary ? ' one' : ''}`}><i>{r.n}</i><b>{r.who}</b><span>{r.route}</span></div>)}
            {(sheet.reads.length ? sheet.assign.slice(0, Math.max(0, 6 - sheet.reads.length)) : sheet.assign).map((a, i) => <div key={i} className="pp-asg"><b>{a.who}</b><span>{a.job}</span></div>)}
            {!sheet.reads.length && !sheet.assign.length && <div className="pp-asg"><span>{sheet.kind}</span></div>}
          </div>
          <div className="pp-notes">
            <div className="pp-h">Coaching points</div>
            {sheet.notes.map(n => <p key={n.h}><b>{n.h}:</b> {n.t}</p>)}
          </div>
        </div>
      )}
      <div className="pp-sits">
        <div className="pp-h">Call sheet</div>
        <div className="pp-grid">{SITS.map(x => { const on = sits.includes(x); return <span key={x} className={on ? 'on' : ''}>{x}{on && <b>✓</b>}</span>; })}</div>
      </div>
      <div className="pp-foot">
        <span>{book.name}</span>
        <button className="pp-x" onClick={() => ctx.removePlay(f.side, f.fi, f.name)}>Remove from section</button>
      </div>
    </div>
  );
}

function Notes() {
  return <div className="nt sheet"><div className="nt-h">Notes</div><div className="nt-lines" /></div>;
}

function Designer({ ctx }: { ctx: Ctx }) {
  const { L } = ctx;
  const mine = [...(L.customPlays ?? []).map(p => ({ n: p.name, d: `${p.type === 'run' ? 'Run' : 'Pass'} · ${OFF_SETS[p.set ?? 'Shotgun']?.label ?? p.set}`, side: 'off' as Side })), ...(L.customDefPlays ?? []).map(p => ({ n: p.name, d: `Defense · ${DEF_SETS[p.set].label}`, side: 'def' as Side }))];
  const at = (n: string) => ctx.faces.findIndex(f => f.k === 'play' && f.name === n);
  return (
    <div className="ds sheet">
      <div className="sh-top"><span>Workshop</span><span className="pp-no">New</span></div>
      <div className="ds-h">Draw a new play</div>
      <p className="ds-p">Lay down routes, blocks and motion on the grid, mark the primary read, and the play is filed in this binder and called in games like any other.</p>
      <div className="ds-grid">
        <button className="ds-card" onClick={() => ctx.openDraw('off')}>
          <svg viewBox="0 0 120 70"><line x1="0" x2="120" y1="48" y2="48" stroke="#b9b1a0" strokeDasharray="3 3" />{[40, 50, 60, 70, 80].map(x => <circle key={x} cx={x} cy="54" r="4" fill="#fff" stroke="#1b1a17" />)}<circle cx="14" cy="54" r="4" fill="#fff" stroke="#1b1a17" /><path d="M14 50 V22 L34 10" fill="none" stroke="#c3122f" strokeWidth="2" /><path d="M30 8 L37 8 L33 14Z" fill="#c3122f" /><circle cx="104" cy="54" r="4" fill="#fff" stroke="#1b1a17" /><path d="M104 50 V30 H86" fill="none" stroke="#1b1a17" strokeWidth="1.6" /></svg>
          <b>Offensive play</b><span>Routes, runs, blocks, motion</span>
        </button>
        <button className="ds-card" onClick={() => ctx.openDraw('def')}>
          <svg viewBox="0 0 120 70"><line x1="0" x2="120" y1="54" y2="54" stroke="#b9b1a0" strokeDasharray="3 3" />{['E', 'T', 'T', 'E'].map((l, i) => <text key={i} x={42 + i * 12} y="49" fontSize="10" fontWeight="800" textAnchor="middle">{l}</text>)}<ellipse cx="30" cy="20" rx="18" ry="8" fill="rgba(42,95,168,.15)" stroke="#2a5fa8" /><ellipse cx="90" cy="20" rx="18" ry="8" fill="rgba(42,95,168,.15)" stroke="#2a5fa8" /><path d="M60 36 L62 50" stroke="#c3122f" strokeWidth="2" /><text x="60" y="34" fontSize="10" fontWeight="800" textAnchor="middle">M</text></svg>
          <b>Defensive call</b><span>Rush, zone drops, blitz, man</span>
        </button>
      </div>
      <div className="dv-h" style={{ marginTop: 18 }}>Your drawn plays</div>
      <div className="ds-list">
        {mine.length ? mine.slice(0, 10).map(p => { const i = at(p.n); return (
          <button key={p.n} className="dv-row" disabled={i < 0} onClick={() => i >= 0 && ctx.goFace(i)}><span>{p.n} <small>{p.d}</small></span><i /><b>{i >= 0 ? ctx.pageNo(ctx.faces[i]) : '—'}</b></button>
        ); }) : <div className="dv-more">Nothing drawn yet. Your first play goes in "My Plays".</div>}
      </div>
      <div className="ds-scrawl hand">Draw it up, then rep it in practice.</div>
    </div>
  );
}

/** The library: tick plays in or out of a section. */
function AddPlays({ L, sd, folder, close }: { L: League; sd: Side; folder: Playbook['folders'][number]; close: () => void }) {
  const pool = sd === 'off'
    ? [...OFF_LIB.map(p => ({ name: p.name, set: p.set, desc: p.desc })), ...(L.customPlays ?? []).map(p => ({ name: p.name, set: p.set ?? 'Shotgun', desc: `Your ${p.type} play` }))]
    : [...DEF_LIB.map(p => ({ name: p.name, set: p.set as string, desc: p.desc })), ...(L.customDefPlays ?? []).map(p => ({ name: p.name, set: p.set as string, desc: 'Your defense' }))];
  const sets = [...new Set(pool.map(p => p.set))];
  return (
    <Modal onClose={close} wide>
      <div className="row" style={{ marginBottom: 12 }}><div className="h2">Add Plays to {folder.name}</div><div className="spacer" /><button className="btn sm" onClick={close}>Done</button></div>
      <div className="scroll" style={{ maxHeight: '64vh', border: 0 }}>
        {sets.map(s => (
          <div key={s} style={{ marginBottom: 14 }}>
            <div className="up" style={{ marginBottom: 8 }}>{setLabel(sd, s)}</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
              {pool.filter(p => p.set === s).map(p => { const has = folder.plays.includes(p.name); return (
                <button key={p.name} className={`playcard pbk2-pick${has ? ' on' : ''}`} onClick={() => { folder.plays = has ? folder.plays.filter(x => x !== p.name) : [...folder.plays, p.name]; app.touch(); }}>
                  <PlayDiagram name={p.name} def={sd === 'def'} w={150} h={80} />
                  <div style={{ padding: '6px 8px 8px' }}><b style={{ font: '700 14px var(--head)', textTransform: 'uppercase' }}>{p.name}</b><div className="small dim">{has ? '✓ In section' : p.desc}</div></div>
                </button>
              ); })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
