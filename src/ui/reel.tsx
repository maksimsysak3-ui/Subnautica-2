// Highlight reel: the game's top plays counted down and replayed in the field view, in a
// letterboxed broadcast frame with the play call and the booth's line.
import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Game, League } from '../core/types';
import type { PlayEvent } from '../sim/game';
import { FieldView } from './field';
import { Logo, vivid } from './components';
import { ANALYST } from './booth';
import { highlightScore } from '../sim/highlights';

export function HighlightReel({ L, g, plays, lines, onClose }: { L: League; g: Game; plays: PlayEvent[]; lines?: Map<number, string>; onClose: () => void }) {
  const home = L.teams[g.home], away = L.teams[g.away];
  const order = plays.slice().sort((a, b) => highlightScore(a) - highlightScore(b));   // count down: No. 5 first, the best last
  const [i, setI] = useState(-1);          // -1: title card
  const [phase, setPhase] = useState<'card' | 'play' | 'hold'>('card');
  const ev = order[i];
  useEffect(() => {
    if (i < 0) { const t = setTimeout(() => { setI(0); setPhase('card'); }, 1800); return () => clearTimeout(t); }
    if (phase === 'card') { const t = setTimeout(() => setPhase('play'), 1100); return () => clearTimeout(t); }
    if (phase === 'hold') { const t = setTimeout(() => { if (i + 1 < order.length) { setI(i + 1); setPhase('card'); } else onClose(); }, 2200); return () => clearTimeout(t); }
  }, [i, phase]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.key === 'Escape') onClose(); else if (i + 1 < order.length) { setI(i + 1); setPhase('card'); } else onClose(); };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  });
  const offense = ev ? (ev.poss === 1 ? home : away) : home;
  return createPortal(
    <div className="hr" style={{ '--c': vivid(offense.colors[0]) } as CSSProperties}>
      <i className="pt-bar top" /><i className="pt-bar bot" />
      {i < 0 ? <div className="hr-title"><span>Game Highlights</span><div><Logo team={away} size={64} /><b>{g.result?.as ?? ''}</b><em>Final</em><b>{g.result?.hs ?? ''}</b><Logo team={home} size={64} /></div><small>{order.length} top plays</small></div>
        : ev && <div className="hr-in">
          <div className="hr-field">
            <FieldView key={ev.n} ev={phase === 'card' ? null : ev} home={home} away={away} logo={home.logo} playing={phase === 'play'} onDone={() => setPhase('hold')} />
            {phase === 'card' && <div className="hr-card"><span>No.</span><b>{order.length - i}</b></div>}
          </div>
          <div className="hr-cap">
            <div className="hr-q"><Logo team={offense} size={28} /><span>Q{Math.min(ev.q, 5) === 5 ? 'OT' : ev.q} · {Math.floor(ev.clock / 60)}:{String(ev.clock % 60).padStart(2, '0')}</span><em>No. {order.length - i} of {order.length}</em></div>
            <b className={ev.td ? 'td' : ev.turnover ? 'to' : ''}>{ev.text}</b>
            {lines?.get(ev.n) && <p><i>{ANALYST}</i>{lines.get(ev.n)}</p>}
          </div>
        </div>}
      <span className="pt-skip">Any key: next play · Esc: close</span>
    </div>,
    document.body,
  );
}
