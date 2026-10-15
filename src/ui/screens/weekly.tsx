// The Weekly Hub card row: tall team-colour cards, one situation each. The focused
// card opens up (bigger photo, the choices, and the staff member you can delegate
// to). Arrow keys move, Enter takes the first choice, X delegates.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { WeeklyPop, Shot, accent, verb } from './weeklypop';
import { useApp, app, type Screen } from '../store';
import { Logo, vivid } from '../components';
import { NegotiationRoom } from './negotiate';
import { weeklyCards, type ActionCard, type Opener } from '../actions';
import type { Player } from '../../core/types';

export function WeeklyCards() {
  const s = useApp();
  const L = s.league!;
  const cards = useMemo(() => weeklyCards(L), [L, s.v]);
  const [focus, setFocus] = useState(0);
  const [neg, setNeg] = useState<Player | null>(null);
  const f = Math.min(focus, Math.max(0, cards.length - 1));
  const open: Opener = { negotiate: p => setNeg(p), go: (id, extra) => app.go({ id, ...extra } as Screen) };
  const act = (c: ActionCard, i = 0) => { const r = c.choices[i]?.run(open); if (r) app.toast(r); app.touch(); };
  // In a meeting the result is shown in the room instead of a toast.
  const decide = (c: ActionCard, i: number) => {
    let left = false;
    const via: Opener = { negotiate: p => { left = true; closePop(); setNeg(p); }, go: (id, extra) => { left = true; closePop(); open.go(id, extra); } };
    const r = c.choices[i]?.run(via); app.touch();
    return left ? null : (r || '');
  };
  // The week's lead story opens as a breaking-news pop-up, once.
  const wkKey = `${L.season}-${L.phase}-${L.week}`;
  const seen = (L as typeof L & { popSeen?: string }).popSeen;
  const lead = cards.find(c => !c.matchup && ['Holdout', 'Fallout', 'League Office'].includes(c.kind)) ?? cards.find(c => !c.matchup && (c.p || c.scene) && c.feature) ?? cards.find(c => !c.matchup && (c.p || c.scene));
  const [popOpen, setPopOpen] = useState(true);
  // Any card can be opened in its scene; the lead story opens by itself once a week.
  const [picked, setPicked] = useState<ActionCard | null>(null);
  // The lead story is picked once and held, so answering it (which resolves it) doesn't swap
  // the room to another card before you've seen how it went.
  useEffect(() => { if (popOpen && seen !== wkKey && L.phase === 'regular' && lead && !picked) setPicked(lead); }, [wkKey]);
  const pop = picked;
  const closePop = () => { (L as typeof L & { popSeen?: string }).popSeen = wkKey; setPopOpen(false); setPicked(null); };
  const delegate = (c: ActionCard) => { if (!c.delegate) return; c.delegate.run(); app.toast(`Delegated to ${c.delegate.who}`); app.touch(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (neg || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowRight') setFocus(x => Math.min(cards.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setFocus(x => Math.max(0, x - 1));
      else if (e.key === 'Enter' && cards[f]) { if (cards[f].matchup) act(cards[f]); else setPicked(cards[f]); }
      else if ((e.key === 'x' || e.key === 'X') && cards[f]) delegate(cards[f]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  useEffect(() => { document.querySelector('.wc.on')?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); }, [f]);
  return (
    <>
      <div className="wh-row">
        {cards.map((c, i) => <Card key={c.id} c={c} on={i === f} onFocus={() => setFocus(i)} onAct={j => act(c, j)} onOpen={() => (c.matchup ? act(c) : setPicked(c))} onDelegate={() => delegate(c)} />)}
        {!cards.length && <div className="wc empty-card"><h2 className="wc-h">All caught up</h2><p className="wc-b">Nothing in the building needs a decision this week.</p></div>}
      </div>
      {pop && !neg && createPortal(<WeeklyPop key={pop.id} c={pop} decide={j => decide(pop, j)} onClose={closePop} />, document.body)}
      {neg && <NegotiationRoom p={neg} close={() => { setNeg(null); app.touch(); }} />}
    </>
  );
}

function Card({ c, on, onFocus, onAct, onOpen, onDelegate }: { c: ActionCard; on: boolean; onFocus: () => void; onAct: (i: number) => void; onOpen: () => void; onDelegate: () => void }) {
  const t = c.team;
  const stakes = false;
  const big = on && !stakes && !!c.p && (c.feature || c.matchup);
  return (
    <div className={`wc${on ? ' on' : ''}${c.matchup ? ' mu' : ''}${stakes ? ' st' : ''}${stakes && !c.delegate ? ' nd' : ''}`} style={{ '--c1': vivid(t.colors[0]), '--c2': accent(t) } as CSSProperties} onMouseEnter={onFocus} onClick={() => (on ? onOpen() : onFocus())}>
      <div className="wc-bg"><i className="wc-paint" /><i className="wc-swoosh" /><Logo team={t} size={360} style={{ position: 'absolute', left: -80, top: -40, opacity: 0.14 }} /></div>
      <span className="wc-kind">{c.kind}</span>
      {c.p && (big ? <Shot p={c.p} t={t} cls="wc-shot" /> : <Shot p={c.p} t={t} cls="wc-face" />)}
      <div className="wc-text">
        <h2 className="wc-h">{c.headline}</h2>
        <p className="wc-b">{c.body}</p>
        {(c.speaker || c.where) && <p className="wc-who">{c.speaker ?? ''}{c.speaker && c.where ? ' · ' : ''}{c.where ?? ''}</p>}
        {on && (c.matchup
          ? <div className="wc-acts">{c.choices.map((x, i) => <button key={x.label} className={`btn sm${i === 0 ? ' primary' : ''}`} onClick={e => { e.stopPropagation(); onAct(i); }}>{x.label}</button>)}</div>
          : <button className="wc-take" onClick={e => { e.stopPropagation(); onOpen(); }}>{verb(c)} <kbd>⏎</kbd></button>)}
      </div>
      {on && c.delegate && (
        <div className="wc-del" onClick={e => { e.stopPropagation(); onDelegate(); }}>
          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
            <span className="wc-av">{c.delegate.who.split(' ').map(s => s[0]).join('')}</span>
            <div style={{ flex: 1 }}><b>Delegate</b><span>{c.delegate.who} | {c.delegate.role}</span></div>
            <kbd>X</kbd>
          </div>
          <q>{c.delegate.quote}</q>
        </div>
      )}
    </div>
  );
}
