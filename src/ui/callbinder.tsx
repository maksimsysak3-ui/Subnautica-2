// In-game play calling as one playbook, styled like a sideline tablet: every formation is a tabbed section of the
// same book, plays sit on call-sheet pages (three to a page, two pages to a spread), and you
// flip through with the arrows, the keyboard or the tabs. Hovering a play runs it on the page.
// Situational calls (punt, field goal, kneel, spike) live on their own tab at the back.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { League } from '../core/types';
import type { DefCall, GameSim, OffCall } from '../sim/game';
import { activeBook, offPlay, defPlay, OFF_SETS, DEF_SETS } from './plays';
import { PLAY_ART, PlayDiagram, SpecialDiagram } from './playart';
import './callbinder.css';

interface Cell { kind: 'off' | 'def' | 'sp'; name: string; title: string; desc: string; set?: string; run: () => void; tag: string }
interface PageT { section: number; cells: Cell[] }
const PER = 3;
const memory: Record<string, number> = {};    // the page each side's binder was left open on

export function CallBinder({ L, sim, onOffense, pa, onOff, onDef, onSpecial, color }: { L: League; sim: GameSim; onOffense: boolean; pa: boolean; onOff: (oc: OffCall, set?: string) => void; onDef: (dc: DefCall) => void; onSpecial: (oc: OffCall) => void; color: string }) {
  const side = onOffense ? 'off' : 'def';
  const book = activeBook(L, side);
  const userSide = sim.sides[0].abbr === L.user ? 0 : 1;
  const qbFast = (L.players[sim.sides[userSide].team.depth.QB?.[0] ?? '']?.attrs.SPD ?? 0) >= 78;
  // Sections (formations), then the situational tab; each section paginated three plays a page.
  const { sections, pages } = useMemo(() => {
    const secs: { name: string; note: string; first: number }[] = [];
    const pgs: PageT[] = [];
    const add = (name: string, note: string, cells: Cell[]) => {
      if (!cells.length) return;
      const si = secs.length; secs.push({ name, note, first: pgs.length });
      for (let i = 0; i < cells.length; i += PER) pgs.push({ section: si, cells: cells.slice(i, i + PER) });
      if (pgs.length % 2) pgs.push({ section: si, cells: [] });   // each section starts on a fresh spread
    };
    for (const f of book?.folders ?? []) {
      const cells: Cell[] = [];
      for (const n of f.plays) {
        if (onOffense) {
          const p = offPlay(L, n); if (!p || (p.call.run === 'qb' && !qbFast && n !== 'QB Sneak')) continue;
          const paName = pa && p.call.kind === 'pass' && p.call.depth !== 'screen' && !p.call.pa && PLAY_ART[`PA ${n}`] ? `PA ${n}` : n;
          cells.push({ kind: 'off', name: paName, title: paName, desc: p.desc, set: p.set, tag: p.call.kind === 'run' ? 'Run' : p.call.depth === 'screen' ? 'Screen' : p.call.pa || paName.startsWith('PA ') ? 'Play-action' : p.call.depth === 'deep' ? 'Shot' : 'Pass', run: () => onOff(p.call, p.set) });
        } else {
          const p = defPlay(L, n); if (!p) continue;
          cells.push({ kind: 'def', name: n, title: n, desc: p.desc, set: p.set, tag: p.call.blitz ? 'Pressure' : /Cover [01]/.test(n) ? 'Man' : 'Zone', run: () => onDef(p.call) });
        }
      }
      const note = onOffense ? OFF_SETS[f.set]?.note : DEF_SETS[f.set as keyof typeof DEF_SETS]?.note;
      add(f.name, (note ?? '').split(' · ')[0], cells);
    }
    if (onOffense) {
      const sp: Cell[] = [];
      if (sim.down === 4) { sp.push({ kind: 'sp', name: 'Punt', title: 'Punt', desc: 'Flip the field', tag: 'Special teams', run: () => onSpecial({ kind: 'punt', name: 'Punt' }) }); sp.push({ kind: 'sp', name: 'Field Goal', title: 'Field Goal', desc: `${100 - sim.yl + 17}-yard try`, tag: 'Special teams', run: () => onSpecial({ kind: 'fg', name: 'Field Goal' }) }); }
      const me = sim.sides[0].abbr === L.user ? 0 : 1, lead = sim.score[me] - sim.score[1 - me];
      if ((sim.q >= 4 && lead > 0 && sim.clock < 150) || (sim.q === 2 && sim.clock < 40)) sp.push({ kind: 'sp', name: 'Kneel', title: 'Kneel', desc: 'Victory formation · burn the clock', tag: 'Clock', run: () => onSpecial({ kind: 'kneel', name: 'Kneel' }) });
      if ((sim.q === 2 || sim.q >= 4) && sim.clock < 120 && sim.down < 4) sp.push({ kind: 'sp', name: 'Spike', title: 'Spike', desc: 'Stop the clock', tag: 'Clock', run: () => onSpecial({ kind: 'spike', name: 'Spike' }) });
      add('Situational', sim.down === 4 ? '4th down' : 'Clock', sp);
    }
    return { sections: secs, pages: pgs };
  }, [book, onOffense, pa, sim.down, sim.yl, sim.q, sim.clock < 150, sim.score[0], sim.score[1], qbFast]);
  const single = typeof window !== 'undefined' && window.innerWidth < 860;
  const step = single ? 1 : 2;
  const key = `${side}-${book?.name ?? ''}`;
  const [at, setAt] = useState(() => Math.min(memory[key] ?? 0, Math.max(0, pages.length - 1)));
  const [turn, setTurn] = useState<'' | 'fwd' | 'back'>('');
  const [hover, setHover] = useState<string | null>(null);
  // On 4th down, open straight to the situational tab.
  useEffect(() => { if (onOffense && sim.down === 4) { const s = sections.findIndex(x => x.name === 'Situational'); if (s >= 0) go(sections[s].first); } }, [sim.down, onOffense]);
  const left = Math.floor(at / step) * step;
  const go = (p: number) => {
    const np = Math.max(0, Math.min(pages.length - 1, Math.floor(p / step) * step));
    if (np === left) return;
    setTurn(np > left ? 'fwd' : 'back'); setAt(np); memory[key] = np;
    window.setTimeout(() => setTurn(''), 460);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,textarea')) return; if (e.key === 'ArrowRight') go(left + step); if (e.key === 'ArrowLeft') go(left - step); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  if (!book || !pages.length) return null;
  const cur = pages[left]?.section ?? 0;
  const spread = single ? [pages[left]] : [pages[left], pages[left + 1]];
  const pageNo = (i: number) => i + 1;
  return (
    <div className={`cb${single ? ' one' : ''}`} style={{ '--tc': color } as CSSProperties}>
      <div className="cb-bar">
        <span className="cb-book">{book.name}</span>
        <span className="cb-sec">{sections[cur]?.name}{sections[cur]?.note ? <em> · {sections[cur].note}</em> : null}</span>
        <div className="cb-nav">
          <button onClick={() => go(left - step)} disabled={left === 0} aria-label="Previous page">‹</button>
          <span>{pageNo(left)}{!single && pages[left + 1] ? `–${pageNo(left + 1)}` : ''} / {pages.length}</span>
          <button onClick={() => go(left + step)} disabled={left + step >= pages.length} aria-label="Next page">›</button>
        </div>
      </div>
      <div className="cb-desk">
        <div className={`cb-book-body${turn ? ` turn-${turn}` : ''}`}>
          {spread.map((pg, j) => (
            <div key={`${left}-${j}`} className={`cb-page ${j === 0 ? 'l' : 'r'}`}>
              <div className="cb-head"><span>{sections[pg?.section ?? cur]?.name}</span><i>{pageNo(left + j)}</i></div>
              {pg?.cells.length ? pg.cells.map(c => (
                <button key={c.name} className={`cb-cell k-${c.kind}${hover === c.name ? ' hot' : ''}`} onClick={c.run} onMouseEnter={() => setHover(c.name)} onMouseLeave={() => setHover(h => (h === c.name ? null : h))} onFocus={() => setHover(c.name)}>
                  <div className="cb-art">
                    {c.kind === 'sp' ? <SpecialDiagram kind={c.name as 'Punt'} w={single ? 150 : 210} h={single ? 92 : 120} />
                      : <PlayDiagram name={c.name} def={c.kind === 'def'} w={single ? 150 : 210} h={single ? 92 : 120} pro />}
                  </div>
                  <div className="cb-txt"><b>{c.title}</b><span className={`cb-tag t-${c.tag.toLowerCase().replace(/\W/g, '')}`}>{c.tag}</span><p>{c.desc}</p></div>
                </button>
              )) : <div className="cb-blank">—</div>}
            </div>
          ))}
          {!single && <div className="cb-rings" aria-hidden><i /><i /><i /></div>}
        </div>
        <div className="cb-tabs">
          {sections.map((s, i) => <button key={s.name} className={i === cur ? 'on' : ''} style={{ '--i': i } as CSSProperties} onClick={() => go(s.first)}>{s.name}</button>)}
        </div>
      </div>
    </div>
  );
}
