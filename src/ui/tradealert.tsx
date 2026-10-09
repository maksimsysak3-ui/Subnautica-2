// Trade alert: the broadcast's breaking-news treatment for a completed deal. A red
// "TRADE" slam, both teams' logos from the sides, then each player and pick crossing to
// his new team, with a wipe in the new team's colours.
import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { League, TradeOffer } from '../core/types';
import { Logo, Face, vivid } from './components';
import { pickLabel } from '../core/trade';
import { sfx } from './sfx';

export function TradeAlert({ L, offer, onClose }: { L: League; offer: TradeOffer; onClose: () => void }) {
  const a = L.teams[offer.from], b = L.teams[offer.to];
  useEffect(() => { sfx.confirm(); const t = setTimeout(onClose, 7000); const k = () => onClose(); window.addEventListener('keydown', k); return () => { clearTimeout(t); window.removeEventListener('keydown', k); }; }, []);
  const side = (ids: string[], picks: string[], to: typeof a, dir: 'r' | 'l') => [
    ...ids.map((id, i) => { const p = L.players[id]; return (
      <div key={id} className={`ta-item ${dir}`} style={{ animationDelay: `${1.2 + i * 0.22}s` }}>
        <div className="ta-face" style={{ '--c': vivid(to.colors[0]) } as CSSProperties}><Face p={p} size={86} team={to} /></div>
        <div><b>{p.fn} {p.ln}</b><span>{p.pos} · {p.ovr} OVR · age {Math.floor(p.age)}</span></div>
      </div>
    ); }),
    ...picks.map((id, i) => { const k = L.picks.find(x => x.id === id); return k ? (
      <div key={id} className={`ta-item pick ${dir}`} style={{ animationDelay: `${1.2 + (ids.length + i) * 0.22}s` }}>
        <div className="ta-chip">R{k.round}</div><div><b>{pickLabel(L, k)}</b><span>Draft pick</span></div>
      </div>
    ) : null; }),
  ];
  return createPortal(
    <div className="ta" onClick={onClose} style={{ '--a': vivid(a.colors[0]), '--b': vivid(b.colors[0]) } as CSSProperties}>
      <i className="pt-bar top" /><i className="pt-bar bot" />
      <div className="ta-wipe a" /><div className="ta-wipe b" />
      <div className="ta-slam"><span>Breaking</span><b>Trade</b></div>
      <div className="ta-teams">
        <div className="ta-team l"><Logo team={a} size={130} /><b>{a.name}</b><em>receive</em></div>
        <div className="ta-swap">⇄</div>
        <div className="ta-team r"><Logo team={b} size={130} /><b>{b.name}</b><em>receive</em></div>
      </div>
      <div className="ta-lists">
        <div className="ta-col">{side(offer.get.players, offer.get.picks, a, 'l')}</div>
        <div className="ta-col">{side(offer.give.players, offer.give.picks, b, 'r')}</div>
      </div>
      <div className="ta-ticker"><b>Trade alert</b><span>The {a.nick} and {b.nick} have agreed to a deal, pending physicals.</span></div>
      <span className="pt-skip">Click or any key to continue</span>
    </div>,
    document.body,
  );
}
