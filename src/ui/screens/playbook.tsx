// Playbook: the user's playbooks as folders. One book per side is active in games.
// Folders hold plays (one per formation by default); open a folder to add or remove
// plays, draw new ones straight into it, and set the formation's substitutions.
import { useState } from 'react';
import { useApp, app } from '../store';
import { Modal, Face, Tabs } from '../components';
import { PlayDiagram } from '../playart';
import { PlayDesigner, registerPlays } from '../playdesigner';
import { books, activeBook, OFF_LIB, DEF_LIB, OFF_SETS, DEF_SETS, offPlay, defPlay, defaultBooks } from '../plays';
import type { League, Playbook, Player } from '../../core/types';
import type { DefSet } from '../../sim/game';

type Side = 'Offense' | 'Defense';
const SLOT_POS: Record<'X' | 'Z' | 'SLOT' | 'TE' | 'RB', string[]> = { X: ['WR', 'TE'], Z: ['WR', 'TE'], SLOT: ['WR', 'TE', 'RB', 'FB'], TE: ['TE', 'WR', 'FB'], RB: ['RB', 'FB'] };
const SLOT_NAME = { X: 'X Receiver', Z: 'Z Receiver', SLOT: 'Slot', TE: 'Tight End', RB: 'Running Back' } as const;
/** Who each slot is by default in a personnel grouping. */
const DEFAULT_WHO: Record<string, Partial<Record<keyof typeof SLOT_NAME, string>>> = {
  '10': { TE: 'WR4' }, '12': { SLOT: 'TE2' }, '13': { Z: 'TE2', SLOT: 'TE3' }, '21': { SLOT: 'FB' }, '22': { Z: 'TE2', SLOT: 'FB' },
};

export function PlaybookScreen() {
  const L = useApp().league!;
  const [side, setSide] = useState<Side>('Offense');
  const sd = side === 'Offense' ? 'off' : 'def';
  const all = books(L).filter(b => b.side === sd);
  const act = activeBook(L, sd)!;
  const [bookId, setBookId] = useState(act.id);
  const book = all.find(b => b.id === bookId) ?? act;
  const [open, setOpen] = useState<string | null>(null);
  const [naming, setNaming] = useState<null | { kind: 'book' | 'rename' | 'folder'; value: string; set?: string }>(null);
  const f = book.folders.find(x => x.name === open);
  const touch = () => app.touch();
  const newId = () => `pb-${Date.now().toString(36)}`;
  const commitName = () => {
    if (!naming) return;
    const v = naming.value.trim(); if (!v) return setNaming(null);
    if (naming.kind === 'book') { const nb: Playbook = { ...JSON.parse(JSON.stringify(book)), id: newId(), name: v }; L.playbooks!.push(nb); setBookId(nb.id); }
    else if (naming.kind === 'rename') book.name = v;
    else if (!book.folders.some(x => x.name === v)) book.folders.push({ name: v, set: naming.set ?? (sd === 'off' ? 'Shotgun' : 'Nickel'), plays: [] });
    setNaming(null); touch();
  };
  return (
    <div className="pbk">
      <div className="pbk-head">
        <div><span className="up">Coach Central</span><div className="h1">Playbook</div><p className="dim">Your active book is what you call from in games: pick a formation folder, then the play. Folders, plays and substitutions are all yours to change.</p></div>
        <Tabs tabs={['Offense', 'Defense'] as const} on={side} set={t => { setSide(t); setOpen(null); const a = activeBook(L, t === 'Offense' ? 'off' : 'def'); if (a) setBookId(a.id); }} />
      </div>
      <div className="pbk-books">
        {all.map(b => (
          <button key={b.id} className={`pbk-book${b.id === book.id ? ' on' : ''}`} onClick={() => { setBookId(b.id); setOpen(null); }}>
            <i>{b.name.slice(0, 1)}</i><div><b>{b.name}</b><span>{b.folders.length} folders · {b.folders.reduce((a, x) => a + x.plays.length, 0)} plays</span></div>
            {L.activeBook?.[sd] === b.id && <em>Active</em>}
          </button>
        ))}
        <div className="pbk-actions">
          {L.activeBook?.[sd] !== book.id && <button className="btn sm primary" onClick={() => { L.activeBook = { ...L.activeBook, [sd]: book.id }; app.toast(`${book.name} is now your ${side.toLowerCase()} playbook`); touch(); }}>Use in Games</button>}
          <button className="btn sm" onClick={() => setNaming({ kind: 'book', value: `${book.name} (copy)` })}>Copy Book</button>
          <button className="btn sm" onClick={() => setNaming({ kind: 'rename', value: book.name })}>Rename</button>
          <button className="btn sm" onClick={() => { const d = defaultBooks().find(x => x.side === sd)!; const nb = { ...d, id: newId(), name: `${side} Template` }; L.playbooks!.push(nb); setBookId(nb.id); touch(); }}>New From Template</button>
          {all.length > 1 && <button className="btn sm" onClick={() => { L.playbooks = L.playbooks!.filter(b => b.id !== book.id); if (L.activeBook?.[sd] === book.id) L.activeBook = { ...L.activeBook, [sd]: L.playbooks.find(b => b.side === sd)!.id }; setBookId(activeBook(L, sd)!.id); touch(); }}>Delete</button>}
        </div>
      </div>
      {!f ? (
        <div className="pb-folders big">
          {book.folders.map((x, i) => (
            <button key={x.name} className="pb-folder" style={{ animationDelay: `${i * 0.04}s` }} onClick={() => setOpen(x.name)}>
              <i className="pb-tab">{x.name}</i>
              <div className="pb-peek">{x.plays.slice(0, 2).map(n => <PlayDiagram key={n} name={n} def={sd === 'def'} w={130} h={66} />)}</div>
              <b>{x.name}</b><span>{x.plays.length} plays · {sd === 'off' ? OFF_SETS[x.set]?.note ?? x.set : DEF_SETS[x.set as DefSet]?.note ?? x.set}</span>
            </button>
          ))}
          <button className="pb-folder add" onClick={() => setNaming({ kind: 'folder', value: '', set: sd === 'off' ? 'Shotgun' : 'Nickel' })}><i className="pb-tab">New</i><b>+ New Folder</b><span>Group plays your way</span></button>
        </div>
      ) : <FolderView L={L} book={book} folder={f} sd={sd} back={() => setOpen(null)} />}
      {naming && (
        <Modal onClose={() => setNaming(null)}>
          <div className="h2" style={{ marginBottom: 12 }}>{naming.kind === 'book' ? 'New Playbook' : naming.kind === 'rename' ? 'Rename Playbook' : 'New Folder'}</div>
          <div className="grid" style={{ gap: 10 }}>
            <input autoFocus value={naming.value} maxLength={28} onChange={e => setNaming({ ...naming, value: e.target.value })} onKeyDown={e => e.key === 'Enter' && commitName()} placeholder="Name" />
            {naming.kind === 'folder' && <label className="pd-l">Formation for new plays<select value={naming.set} onChange={e => setNaming({ ...naming, set: e.target.value })}>
              {sd === 'off' ? Object.entries(OFF_SETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>) : (Object.keys(DEF_SETS) as DefSet[]).map(k => <option key={k} value={k}>{DEF_SETS[k].label}</option>)}</select></label>}
            <button className="btn primary" onClick={commitName}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FolderView({ L, book, folder, sd, back }: { L: League; book: Playbook; folder: Playbook['folders'][number]; sd: 'off' | 'def'; back: () => void }) {
  const [adding, setAdding] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const touch = () => app.touch();
  const info = (n: string) => sd === 'off' ? offPlay(L, n) : defPlay(L, n);
  const pool = sd === 'off'
    ? [...OFF_LIB.map(p => ({ name: p.name, set: p.set, desc: p.desc })), ...(L.customPlays ?? []).map(p => ({ name: p.name, set: p.set ?? 'Shotgun', desc: `Your ${p.type} play` }))]
    : [...DEF_LIB.map(p => ({ name: p.name, set: p.set as string, desc: p.desc })), ...(L.customDefPlays ?? []).map(p => ({ name: p.name, set: p.set as string, desc: 'Your defense' }))];
  const sets = [...new Set(pool.map(p => p.set))];
  return (
    <div className="pbk-folder">
      <div className="pb-open">
        <button className="btn sm" onClick={back}>◂ {book.name}</button>
        <b>{folder.name}</b><span className="dim small">{folder.plays.length} plays</span><div className="spacer" />
        <button className="btn sm" onClick={() => setAdding(true)}>+ Add Plays</button>
        <button className="btn sm primary" onClick={() => setDrawing(true)}>✎ Draw New Play</button>
        {book.folders.length > 1 && <button className="btn sm" onClick={() => { book.folders = book.folders.filter(x => x !== folder); back(); touch(); }}>Delete Folder</button>}
      </div>
      <div className="grid" style={{ gridTemplateColumns: sd === 'off' ? 'minmax(0,1fr) 300px' : '1fr', alignItems: 'start', gap: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          {folder.plays.map(n => { const p = info(n); return (
            <div key={n} className="playcard pbk-card">
              <PlayDiagram name={n} def={sd === 'def'} w={180} h={100} />
              <div style={{ padding: '8px 10px 10px' }}><div className="h3" style={{ fontSize: 16 }}>{n}</div><div className="small dim">{p?.desc ?? ''}</div></div>
              <button className="pbk-x" title="Remove from folder" onClick={() => { folder.plays = folder.plays.filter(x => x !== n); touch(); }}>×</button>
            </div>
          ); })}
          {!folder.plays.length && <div className="dim">Empty folder. Add plays from the library or draw your own.</div>}
        </div>
        {sd === 'off' && <Subs L={L} set={folder.set} />}
      </div>
      {adding && (
        <Modal onClose={() => setAdding(false)} wide>
          <div className="row" style={{ marginBottom: 12 }}><div className="h2">Add Plays to {folder.name}</div><div className="spacer" /><button className="btn sm" onClick={() => setAdding(false)}>Done</button></div>
          <div className="scroll" style={{ maxHeight: '64vh', border: 0 }}>
            {sets.map(s => (
              <div key={s} style={{ marginBottom: 14 }}>
                <div className="up" style={{ marginBottom: 8 }}>{sd === 'off' ? OFF_SETS[s]?.label ?? s : DEF_SETS[s as DefSet]?.label ?? s}</div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
                  {pool.filter(p => p.set === s).map(p => { const has = folder.plays.includes(p.name); return (
                    <button key={p.name} className={`playcard pbk-pick${has ? ' on' : ''}`} onClick={() => { folder.plays = has ? folder.plays.filter(x => x !== p.name) : [...folder.plays, p.name]; touch(); }}>
                      <PlayDiagram name={p.name} def={sd === 'def'} w={150} h={80} />
                      <div style={{ padding: '6px 8px 8px' }}><b style={{ font: '700 14px var(--head)', textTransform: 'uppercase' }}>{p.name}</b><div className="small dim">{has ? '✓ In folder' : p.desc}</div></div>
                    </button>
                  ); })}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {drawing && <PlayDesigner L={L} side={sd} set={folder.set} target={{ book: book.id, folder: folder.name }} close={() => setDrawing(false)} onSaved={n => { setDrawing(false); registerPlays(L); app.toast(`${n} saved to ${folder.name}`); touch(); }} />}
    </div>
  );
}

/** Formation substitutions: who lines up at each skill slot in this set. */
function Subs({ L, set }: { L: League; set: string }) {
  const def = OFF_SETS[set];
  const roster = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT' && ['WR', 'TE', 'RB', 'FB'].includes(p.pos)).sort((a, b) => b.ovr - a.ovr);
  const subs = L.formSubs?.[set] ?? {};
  const setSub = (slot: keyof typeof SLOT_NAME, id: string) => {
    L.formSubs = { ...L.formSubs, [set]: { ...subs, [slot]: id || undefined } };
    app.touch();
  };
  if (!def) return null;
  const by = (id?: string) => (id ? L.players[id] as Player | undefined : undefined);
  return (
    <div className="card pbk-subs">
      <h3>Substitutions · {def.label}</h3>
      <div className="small dim" style={{ marginBottom: 10 }}>{def.note}. Leave a spot on Depth Chart to use your normal order.</div>
      {(Object.keys(SLOT_NAME) as (keyof typeof SLOT_NAME)[]).map(slot => { const p = by(subs[slot]); return (
        <div key={slot} className="pbk-sub">
          {p ? <Face p={p} size={34} /> : <i className="pbk-dot">{slot === 'SLOT' ? 'S' : slot}</i>}
          <div><b>{SLOT_NAME[slot]}</b><span>{p ? `${p.pos} · ${p.ovr} OVR` : `Depth chart${DEFAULT_WHO[def.pers]?.[slot] ? ` (${DEFAULT_WHO[def.pers]![slot]})` : ''}`}</span></div>
          <select value={subs[slot] ?? ''} onChange={e => setSub(slot, e.target.value)}>
            <option value="">Depth chart</option>
            {roster.filter(x => SLOT_POS[slot].includes(x.pos)).map(x => <option key={x.id} value={x.id}>{x.pos} {x.fn[0]}. {x.ln} ({x.ovr})</option>)}
          </select>
        </div>
      ); })}
    </div>
  );
}
