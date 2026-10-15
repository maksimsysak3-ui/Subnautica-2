// Dev trait reveal: your rookies whose trait unlocked this week, as sealed cards you flip one
// at a time. The card shakes, cracks open, and the trait lands with its colour.
import type React from 'react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { app } from '../store';
import { Face, DevIcon, DEV_BLURB, vivid } from '../components';
import type { League } from '../../core/types';
import { pendingReveals, markRevealsSeen } from '../../core/devreveal';
import './devreveal.css';

const COLOR = { Normal: '#9aa1ad', Star: '#e0a060', Superstar: '#f2c94c', 'X-Factor': '#ff4d5e' } as const;
const LINE = { Normal: 'A worker. He will have to earn every point.', Star: 'There is something here. He develops faster than most.', Superstar: 'A Superstar. Two abilities and a fast track.', 'X-Factor': 'X-FACTOR. A game-wrecker in the making.' } as const;

export function DevRevealPop({ L }: { L: League }) {
  const list = pendingReveals(L);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [gone, setGone] = useState(false);
  if (!list.length || gone) return null;
  const all = list.every(r => open[r.pid]);
  const close = () => { markRevealsSeen(L); setGone(true); app.touch(); };
  const flipNext = () => { const r = list.find(x => !open[x.pid]); if (r) setOpen(o => ({ ...o, [r.pid]: true })); };
  return createPortal(
    <div className="dr-bg" onKeyDown={e => { if (e.key === 'Enter') (all ? close() : flipNext()); }} tabIndex={-1} ref={el => el?.focus()}>
      <div className="dr">
        <header><span>Player development</span><h2>Dev traits revealed</h2><p>{list.length === 1 ? 'One of your rookies has shown what he is.' : `${list.length} of your rookies have shown what they are.`} Flip the cards.</p></header>
        <div className="dr-cards">{list.map((r, i) => {
          const p = L.players[r.pid], t = L.teams[p.team], on = !!open[r.pid];
          return (
            <button key={r.pid} className={`dr-card${on ? ' on' : ''} d-${r.dev.replace(/\W/g, '')}`} style={{ '--dc': COLOR[r.dev], '--tc': vivid(t?.colors[0] ?? '#334'), animationDelay: `${i * 0.12}s` } as React.CSSProperties}
              onClick={() => setOpen(o => ({ ...o, [r.pid]: true }))}>
              <div className="dr-in">
                <div className="dr-back"><div className="dr-q"><DevIcon d="Hidden" size={70} /></div><b>{p.fn} {p.ln}</b><span>{p.pos} · Rookie</span><em>Click to reveal</em></div>
                <div className="dr-front" title={DEV_BLURB[r.dev]}>
                  <div className="dr-face"><Face p={p} size={96} /></div>
                  <div className="dr-burst" />
                  <DevIcon d={r.dev} size={64} />
                  <b className="dr-dev">{r.dev}</b>
                  <span className="dr-name">{p.fn} {p.ln} · {p.pos}</span>
                  <p>{LINE[r.dev]}</p>
                </div>
              </div>
            </button>);
        })}</div>
        <footer>{all ? <button className="btn primary big" onClick={close}>Continue</button> : <button className="btn big" onClick={flipNext}>Reveal next</button>}</footer>
      </div>
    </div>,
    document.body,
  );
}
