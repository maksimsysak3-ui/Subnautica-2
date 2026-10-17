// In-game play calling, laid out like a console play-call screen: a strip of formations across
// the top, every play in the formation as a big tile underneath, and an info bar that reads
// out the play you're on. Arrow keys flip formations; hovering a tile draws its routes.
// Situational calls (punt, field goal, kneel, spike) are the last formation.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { League } from '../core/types';
import type { DefCall, GameSim, OffCall } from '../sim/game';
import { books, activeBook, offPlay, defPlay, OFF_SETS, DEF_SETS, OFF_LIB, DEF_LIB } from './plays';
import { PLAY_ART, PlayDiagram, SpecialDiagram } from './playart';
import './callbinder.css';

interface Cell { kind: 'off' | 'def' | 'sp'; name: string; title: string; desc: string; set?: string; run: () => void; tag: string }
const memory: Record<string, string> = {};    // the formation each side's binder was left open on

export function CallBinder({ L, sim, onOffense, pa, onOff, onDef, onSpecial, color }: { L: League; sim: GameSim; onOffense: boolean; pa: boolean; onOff: (oc: OffCall, set?: string) => void; onDef: (dc: DefCall) => void; onSpecial: (oc: OffCall) => void; color: string }) {
  const side = onOffense ? 'off' : 'def';
  books(L);   // make sure the playbooks exist (a new franchise may not have opened the Playbook tab yet)
  const book = activeBook(L, side);
  const userSide = sim.sides[0].abbr === L.user ? 0 : 1;
  const qbFast = (L.players[sim.sides[userSide].team.depth.QB?.[0] ?? '']?.attrs.SPD ?? 0) >= 78;
  // One section per formation, then the situational calls.
  const sections = useMemo(() => {
    const secs: { name: string; note: string; cells: Cell[] }[] = [];
    const add = (name: string, note: string, cells: Cell[]) => { if (cells.length) secs.push({ name, note, cells }); };
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
    // The base install: every library play the book doesn't already carry, so the whole
    // concept list is always one click away.
    { const inBook = new Set((book?.folders ?? []).flatMap(f => f.plays)), base: Cell[] = [];
      if (onOffense) for (const lp of OFF_LIB) { if (inBook.has(lp.name) || (lp.call.run === 'qb' && !qbFast)) continue; const p = offPlay(L, lp.name)!;
        base.push({ kind: 'off', name: lp.name, title: lp.name, desc: p.desc, set: p.set, tag: p.call.kind === 'run' ? 'Run' : p.call.depth === 'screen' ? 'Screen' : p.call.pa ? 'Play-action' : p.call.depth === 'deep' ? 'Shot' : 'Pass', run: () => onOff({ ...p.call, name: p.call.name ?? lp.name }, p.set) }); }
      else for (const lp of DEF_LIB) { if (inBook.has(lp.name)) continue; const p = defPlay(L, lp.name)!;
        base.push({ kind: 'def', name: lp.name, title: lp.name, desc: p.desc, set: p.set, tag: p.call.blitz ? 'Pressure' : /Cover [01]/.test(lp.name) ? 'Man' : 'Zone', run: () => onDef(p.call) }); }
      add('Base', 'The full base install', base); }
    if (onOffense) {
      const sp: Cell[] = [];
      if (sim.down === 4) { sp.push({ kind: 'sp', name: 'Punt', title: 'Punt', desc: 'Flip the field', tag: 'Special teams', run: () => onSpecial({ kind: 'punt', name: 'Punt' }) }); sp.push({ kind: 'sp', name: 'Field Goal', title: 'Field Goal', desc: `${100 - sim.yl + 17}-yard try`, tag: 'Special teams', run: () => onSpecial({ kind: 'fg', name: 'Field Goal' }) }); }
      const me = sim.sides[0].abbr === L.user ? 0 : 1, lead = sim.score[me] - sim.score[1 - me];
      if ((sim.q >= 4 && lead > 0 && sim.clock < 150) || (sim.q === 2 && sim.clock < 40)) sp.push({ kind: 'sp', name: 'Kneel', title: 'Kneel', desc: 'Victory formation · burn the clock', tag: 'Clock', run: () => onSpecial({ kind: 'kneel', name: 'Kneel' }) });
      if ((sim.q === 2 || sim.q >= 4) && sim.clock < 120 && sim.down < 4) sp.push({ kind: 'sp', name: 'Spike', title: 'Spike', desc: 'Stop the clock', tag: 'Clock', run: () => onSpecial({ kind: 'spike', name: 'Spike' }) });
      add('Situational', sim.down === 4 ? '4th down' : 'Clock', sp);
    }
    return secs;
  }, [book, onOffense, pa, sim.down, sim.yl, sim.q, sim.clock < 150, sim.score[0], sim.score[1], qbFast]);
  const key = `${side}-${book?.name ?? ''}`;
  const [name, setName] = useState(() => memory[key] ?? sections[0]?.name ?? '');
  const [dir, setDir] = useState<'' | 'fwd' | 'back'>('');
  const [hover, setHover] = useState<string | null>(null);
  const cur = Math.max(0, sections.findIndex(x => x.name === name));
  const go = (i: number) => {
    const n = Math.max(0, Math.min(sections.length - 1, i));
    if (n === cur || !sections[n]) return;
    setDir(n > cur ? 'fwd' : 'back'); setName(sections[n].name); memory[key] = sections[n].name; setHover(null);
  };
  // On 4th down, open straight to the situational calls.
  useEffect(() => { if (onOffense && sim.down === 4) { const s = sections.findIndex(x => x.name === 'Situational'); if (s >= 0) go(s); } }, [sim.down, onOffense]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,textarea')) return; if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  if (!sections.length) return null;
  const sec = sections[cur];
  const info = sec.cells.find(c => c.name === hover);
  return (
    <div className="cb" style={{ '--tc': color } as CSSProperties}>
      <div className="cb-bar">
        <span className="cb-book">{book?.name ?? 'Playbook'}</span>
        <button className="cb-arrow" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="Previous formation">‹</button>
        <div className="cb-forms">{sections.map((s, i) => <button key={s.name} className={`${i === cur ? 'on' : ''}${s.name === 'Situational' ? ' sit' : ''}`} onClick={() => go(i)}>{s.name}</button>)}</div>
        <button className="cb-arrow" onClick={() => go(cur + 1)} disabled={cur === sections.length - 1} aria-label="Next formation">›</button>
      </div>
      <div className="cb-sheet">
        <div className="cb-sh"><b>{sec.name}</b>{sec.note && <em>{sec.note}</em>}<span>{sec.cells.length} plays</span></div>
        <div key={sec.name} className={`cb-grid d-${dir || 'none'}`}>
          {sec.cells.map((c, i) => (
            <button key={c.name} style={{ '--i': i } as CSSProperties} className={`cb-tile k-${c.kind}${hover === c.name ? ' hot' : ''}`} onClick={c.run}
              onMouseEnter={() => setHover(c.name)} onMouseLeave={() => setHover(h => (h === c.name ? null : h))} onFocus={() => setHover(c.name)}>
              <div className="cb-art">
                {c.kind === 'sp' ? <SpecialDiagram kind={c.name as 'Punt'} w={240} h={150} /> : <PlayDiagram name={c.name} def={c.kind === 'def'} w={240} h={150} pro />}
                <span className={`cb-tag t-${c.tag.toLowerCase().replace(/\W/g, '')}`}>{c.tag}</span>
              </div>
              <div className="cb-name">{c.title}</div>
            </button>
          ))}
        </div>
        <div className="cb-info">{info ? <><span className={`cb-dot t-${info.tag.toLowerCase().replace(/\W/g, '')}`} /><b>{info.title}</b><p>{info.desc}</p></> : <p className="dim">Hover a play to read it. Click to call it. ← → to change formation.</p>}</div>
      </div>
    </div>
  );
}
