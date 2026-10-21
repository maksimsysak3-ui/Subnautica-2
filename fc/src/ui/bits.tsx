import { useEffect, type ReactNode } from 'react';
import type { Club, Player, World } from '../core/types';
import { Crest, Flag, Ovr } from './art';
import { go } from './nav';
import { ageOf, marketValue } from '../core/player';
import { fmtMoney } from '../core/transfers';

export function Modal({ title, onClose, children, wide }: { title?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        {title && <div className="modal-h"><h3>{title}</h3><button className="x" onClick={onClose}>✕</button></div>}
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

export function Panel({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      {(title || right) && <header><h2>{title}</h2>{right && <div className="ph-r">{right}</div>}</header>}
      {children}
    </section>
  );
}

export const ClubName = ({ c, short }: { c: Club; short?: boolean }) => (
  <span className="clubname" onClick={e => { e.stopPropagation(); go({ s: 'club', id: c.id }); }}><Crest club={c} size={18} />{short ? c.short : c.name}</span>
);

export function PName({ p }: { p: Player }) {
  return <span className="pname" onClick={e => { e.stopPropagation(); go({ s: 'player', id: p.id }); }}>{p.name}</span>;
}

export function PlayerLine({ w, p, extra }: { w: World; p: Player; extra?: ReactNode }) {
  const c = p.club ? w.clubs[p.club] : undefined;
  return (
    <div className="pline" onClick={() => go({ s: 'player', id: p.id })}>
      <Ovr v={p.ovr} small />
      <span className="pos-chip">{p.pos}</span>
      <Flag nat={p.nat} h={12} />
      <span className="pl-name">{p.name}</span>
      <span className="muted sm">{ageOf(p, w.season)}y</span>
      {c && <Crest club={c} size={16} />}
      <span className="pl-x">{extra ?? fmtMoney(marketValue(p, w.season))}</span>
    </div>
  );
}

export function Form({ f }: { f: string[] }) {
  return <span className="formrow">{f.slice(-5).map((r, i) => <i key={i} className={`f-${r}`}>{r}</i>)}</span>;
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
