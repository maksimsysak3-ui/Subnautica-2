// The player card: everything about one player, opened from any roster, depth chart or stats
// table. Ratings are grouped the way a coach reads them (his position's key attributes first),
// with last season's stats, bio, and a development outlook to his potential.
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { school, headshot, showColor, YEAR, height, type Player } from './data';
import { profile, statLine, ATTR } from './player';
import { Logo } from './App';

let shown: Player | null = null;
const subs = new Set<() => void>();
export const showCard = (p: Player | null) => { shown = p; subs.forEach(f => f()); };
export function CardHost() {
  const p = useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => shown);
  return p ? createPortal(<PlayerCard p={p} onClose={() => showCard(null)} />, document.body) : null;
}
const tier = (v: number) => (v >= 90 ? 'e' : v >= 80 ? 'a' : v >= 70 ? 'b' : v >= 60 ? 'c' : 'd');

function PlayerCard({ p, onClose }: { p: Player; onClose: () => void }) {
  const s = school(p.t), pr = profile(p), c = showColor(s);
  const [tab, setTab] = useState<'Ratings' | 'Stats' | 'Development' | 'Bio'>('Ratings');
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const stats = statLine(p);
  const yearsLeft = Math.max(0, 4 - p.yr);
  const path = Array.from({ length: yearsLeft + 1 }, (_, i) => Math.round(p.ovr + (pr.pot - p.ovr) * (1 - Math.pow(0.55, i)) * (yearsLeft ? 1 / (1 - Math.pow(0.55, yearsLeft)) : 0)));
  return (
    <div className="pc-back" onClick={onClose}>
      <div className="pc" style={{ '--c': c, '--c2': s.c2 } as CSSProperties} onClick={e => e.stopPropagation()}>
        <header className="pc-head">
          <div className="pc-num">{p.num}</div>
          <div className="pc-shot">{headshot(p) ? <img src={headshot(p)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : null}</div>
          <div className="pc-id">
            <div className="pc-school"><Logo id={s.id} size={22} />{s.school} · #{p.num}</div>
            <div className="pc-fn">{p.fn}</div><div className="pc-ln">{p.ln}</div>
            <div className="pc-tags"><span>{p.pos}</span><span>{pr.arch}</span><span>{YEAR[p.yr]}</span><span className={`dev ${pr.dev}`}>{pr.dev}</span>{p.st ? <span>Starter</span> : null}</div>
          </div>
          <div className="pc-ovr"><b>{p.ovr}</b><span>OVR</span><em>POT {pr.potLabel}</em></div>
          <button className="pc-x" onClick={onClose}>Close</button>
        </header>
        <div className="pc-keys">{pr.keys.map(k => <div key={k} className={`t-${tier(pr.attrs[k])}`}><b>{pr.attrs[k]}</b><span>{k}</span><em>{ATTR[k]}</em></div>)}</div>
        <nav className="pc-tabs">{(['Ratings', 'Stats', 'Development', 'Bio'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
        <div className="pc-body">
          {tab === 'Ratings' && <div className="pc-groups">{pr.groups.map(([g, as]) => (
            <div key={g} className="pc-group"><h4>{g}</h4>{as.map(a => (
              <div key={a} className={`pc-attr${pr.keys.includes(a) ? ' key' : ''}`}><span title={ATTR[a]}>{ATTR[a]}</span><i><em className={`t-${tier(pr.attrs[a])}`} style={{ width: `${pr.attrs[a]}%` }} /></i><b>{pr.attrs[a]}</b></div>
            ))}</div>
          ))}</div>}
          {tab === 'Stats' && (stats.length ? <div className="pc-stats"><h4>2025 season</h4><div>{stats.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}</div></div> : <div className="pc-empty">No recorded stats last season.</div>)}
          {tab === 'Development' && (
            <div className="pc-dev">
              <div className="pc-dev-k"><div><b>{p.ovr}</b><span>Now</span></div><div><b className={p.ovr > (p.b ?? p.ovr) ? 'up' : p.ovr < (p.b ?? p.ovr) ? 'dn' : ''}>{p.ovr - (p.b ?? p.ovr) > 0 ? '+' : ''}{p.ovr - (p.b ?? p.ovr)}</b><span>This season</span></div><div><b>{pr.pot}</b><span>Ceiling</span></div><div><b>{yearsLeft}</b><span>Years of eligibility</span></div><div><b className={`dev ${pr.dev}`}>{pr.dev}</b><span>Development</span></div></div>
              <svg viewBox="0 0 400 140" className="pc-chart">
                {[60, 70, 80, 90].map(v => <g key={v}><line x1="30" x2="390" y1={140 - (v - 50) * 2.6} y2={140 - (v - 50) * 2.6} stroke="rgba(255,255,255,.07)" /><text x="4" y={144 - (v - 50) * 2.6} fill="#687284" fontSize="10">{v}</text></g>)}
                <polyline fill="none" stroke={c} strokeWidth="3" points={path.map((v, i) => `${30 + i * (360 / Math.max(1, path.length - 1))},${140 - (v - 50) * 2.6}`).join(' ')} />
                {path.map((v, i) => <g key={i}><circle cx={30 + i * (360 / Math.max(1, path.length - 1))} cy={140 - (v - 50) * 2.6} r="5" fill={c} /><text x={30 + i * (360 / Math.max(1, path.length - 1))} y={128 - (v - 50) * 2.6} fill="#fff" fontSize="11" textAnchor="middle">{v}</text></g>)}
              </svg>
              <p className="dim">Projected with normal progression. Practice reps, coaching staff and playing time move it up or down.</p>
            </div>
          )}
          {tab === 'Bio' && <div className="pc-bio">{[['Hometown', p.home ?? '—'], ['Height', height(p.ht)], ['Weight', `${p.wt} lbs`], ['Age', `${pr.age}`], ['Class', YEAR[p.yr]], ['Eligibility', `${Math.max(0, 5 - p.yr)} yrs`], ['Jersey', `#${p.num}`], ['Archetype', pr.arch]].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>}
        </div>
      </div>
    </div>
  );
}
