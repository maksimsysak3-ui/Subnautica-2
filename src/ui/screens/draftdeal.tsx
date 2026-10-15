// Draft-day dealing inside the draft room. On the clock, the phones ring with teams that want
// your slot. Off the clock, you can call the team that is picking and try to jump them. The
// AI clock pauses while you're on the phone (the draft screen guards on `dealing`).
import type React from 'react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { League, Pick, TradeOffer } from '../../core/types';
import { draftCalls, evaluateTrade, executeTrade, noteRejection, patience, pickLabel, pickTradeValue, tradable } from '../../core/trade';
import { gmOf, gmLine, readOf, READ_LABEL } from '../../core/tradetalk';
import { hash } from '../../core/rng';
import { app } from '../store';
import { Logo } from '../components';
import { PickEmblem, GmFace } from './trades';

const label = (L: League, k: Pick) => (k.no && k.season === L.season ? `No. ${k.no}` : pickLabel(L, k));
const findPick = (L: League, id: string) => L.picks.find(k => k.id === id)!;

/** Teams calling to move up into your slot. */
export function DraftCalls({ L, order, cursor }: { L: League; order: Pick[]; cursor: number }) {
  const calls = useMemo(() => draftCalls(L, order, cursor), [cursor, order[cursor]?.owner]);
  const [gone, setGone] = useState<string[]>([]);
  const live = calls.filter(c => !gone.includes(c.to));
  if (!live.length) return null;
  const accept = (o: TradeOffer) => {
    executeTrade(L, o);
    app.toast(`Traded down: ${label(L, findPick(L, o.give.picks[0]))} to the ${L.teams[o.to].nick}.`);
    app.touch();
  };
  return (
    <div className="dd-calls">
      <div className="dd-ring"><i>☎</i><b>{live.length} team{live.length > 1 ? 's' : ''} calling about your pick</b></div>
      {live.map((o, i) => { const g = gmOf(L, o.to); return (
        <div key={o.to} className="dd-call" style={{ animationDelay: `${i * 0.12}s` }}>
          <span className="tc-gmf"><GmFace L={L} team={o.to} size={42} /><Logo team={L.teams[o.to]} size={18} /></span>
          <div className="dd-who"><b>{g.name}</b><span>{L.teams[o.to].nick} · {g.label}</span></div>
          <div className="dd-pk">{o.get.picks.map(id => { const k = findPick(L, id); return <span key={id}><PickEmblem L={L} k={k} size={28} /><em>{label(L, k)}</em></span>; })}</div>
          <div className="dd-btns"><button className="btn sm primary" onClick={() => accept(o)}>Trade down</button><button className="btn sm ghost" onClick={() => setGone(x => [...x, o.to])}>Hang up</button></div>
        </div>); })}
    </div>
  );
}

/** Call the team on the clock and try to jump them. */
export function TradeUp({ L, pick, close }: { L: League; pick: Pick; close: (traded: boolean) => void }) {
  const owner = pick.owner, gm = gmOf(L, owner);
  const mine = L.picks.filter(k => k.owner === L.user && tradable(L, k) && k.season <= L.season + 2).sort((a, b) => a.season - b.season || (a.no ?? a.round * 32) - (b.no ?? b.round * 32));
  const [sel, setSel] = useState<string[]>([]);
  const [line, setLine] = useState<{ text: string; read?: keyof typeof READ_LABEL } | null>(null);
  const offer: TradeOffer = { from: L.user, to: owner, give: { players: [], picks: sel }, get: { players: [], picks: [pick.id] } };
  const tired = patience(L, owner);
  const suggest = () => {
    // Ask the engine itself: add your most valuable picks one at a time until his side
    // would say yes (his GM style decides what he values), then drop anything not needed.
    const pool = mine.map(k => ({ k, v: pickTradeValue(L, k, owner) })).sort((a, b) => b.v - a.v);
    const ok = (ids: string[]) => evaluateTrade(L, { ...offer, give: { players: [], picks: ids } }).accept;
    let out: string[] = [];
    for (const x of pool) { if (out.length >= 6) break; out.push(x.k.id); if (ok(out)) break; }
    if (ok(out)) for (const id of [...out]) { const less = out.filter(x => x !== id); if (less.length && ok(less)) out = less; }
    else app.toast(`Nothing you own gets the ${L.teams[owner].nick} to move.`);
    setSel(out);
  };
  const propose = () => {
    const v = evaluateTrade(L, offer);
    if (v.accept) {
      setLine({ text: gmLine(gm, 'deal', 0, false, hash(pick.id) >>> 0), read: 'deal' });
      setTimeout(() => { executeTrade(L, offer); app.toast(`You moved up to No. ${pick.no}. You're on the clock.`); app.touch(); close(true); }, 900);
      return;
    }
    noteRejection(L, owner);
    const read = readOf(v.ratio, v.margin ?? 1.1, false);
    setLine({ text: /used|deadline|cap/.test(v.reason) ? v.reason : gmLine(gm, read, tired + 1, false, (hash(pick.id + sel.join()) >>> 0)), read });
  };
  return createPortal(
    <div className="modal-bg" onClick={() => close(false)}>
      <div className="dd-up" onClick={e => e.stopPropagation()} style={{ '--tc': L.teams[owner].colors[0] } as React.CSSProperties}>
        <header><span className="tc-gmf"><GmFace L={L} team={owner} size={60} /><Logo team={L.teams[owner]} size={24} /></span><div><span className="up">Trade up · the {L.teams[owner].nick} are on the clock</span><b>{gm.name}</b><em>{gm.label} · {gm.blurb}</em></div><button className="btn ghost sm" onClick={() => close(false)}>✕</button></header>
        <div className="dd-target"><PickEmblem L={L} k={pick} size={64} /><div><span>You want</span><b>Pick No. {pick.no}</b><em>Round {pick.round}</em></div></div>
        <div className="dd-sub">Your picks <button className="btn sm ghost" onClick={suggest}>Suggest a package</button></div>
        <div className="dd-mine">{mine.map(k => { const on = sel.includes(k.id); return (
          <button key={k.id} className={on ? 'on' : ''} onClick={() => setSel(s => (on ? s.filter(x => x !== k.id) : [...s, k.id]))}><PickEmblem L={L} k={k} size={40} /><span>{label(L, k)}</span></button>); })}
          {!mine.length && <div className="small dim">You have no picks left to deal.</div>}</div>
        {line && <div className={`dd-line r-${line.read ?? 'none'}`}><em>{gm.name.split(' ')[0]}</em><p>{line.text}</p>{line.read && <b>{READ_LABEL[line.read]}</b>}</div>}
        <footer><span className="small dim">{tired >= 4 ? 'He is done taking your calls today.' : 'The clock is paused while you talk.'}</span><div className="spacer" /><button className="btn ghost" onClick={() => close(false)}>Back to the board</button><button className="btn primary" disabled={!sel.length || tired >= 4} onClick={propose}>Make the offer</button></footer>
      </div>
    </div>,
    document.body,
  );
}
