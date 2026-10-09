// Halftime: the broadcast's halftime board (score, first-half numbers side by side, top
// performers, the analyst's take) and the user's second-half adjustment.
import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { League, Player } from '../core/types';
import type { GameSim, HalfAdj } from '../sim/game';
import { Logo, Face, vivid } from './components';
import { ANALYST } from './booth';

/** Two team colours too close to tell apart on a bar. */
const clash = (x: string, y: string) => { const n = (c: string) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) || 0); const [p, q] = [n(x), n(y)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 90; };
interface Option { adj: HalfAdj | null; title: string; desc: string }

function options(L: League, sim: GameSim, me: 0 | 1): Option[] {
  const them = (1 - me) as 0 | 1;
  const b = sim.box[me], o = sim.box[them];
  const lead = sim.score[me] - sim.score[them];
  // Their most productive player so far.
  const theirs = [...sim.lines.entries()].map(([id, l]) => ({ p: L.players[id], y: (l.py ?? 0) * 0.5 + (l.ry ?? 0) + (l.recy ?? 0) }))
    .filter(x => x.p && x.p.team === sim.sides[them].abbr).sort((x, y) => y.y - x.y)[0]?.p;
  const ground = b.ryds >= b.pyds * 0.7;
  const out: Option[] = [
    { adj: { name: ground ? 'Pound the Rock' : 'Attack Through the Air', off: 1.5, def: 0 }, title: ground ? 'Pound the Rock' : 'Attack Through the Air', desc: `${ground ? `${b.ryds} rushing yards so far: keep leaning on their front.` : `${b.pyds} passing yards so far: their coverage is giving it up.`} Offense +1.5.` },
  ];
  if (theirs) out.push({ adj: { name: `Take Away ${theirs.ln}`, off: 0, def: 0.3, target: theirs.id }, title: `Take Away ${theirs.ln}`, desc: `${theirs.fn} ${theirs.ln} is hurting you. Bracket him and make someone else beat you: he plays 4 points worse.` });
  if (o.ryds >= 80) out.push({ adj: { name: 'Fix the Run Defense', off: 0, def: 2 }, title: 'Fix the Run Defense', desc: `They ran for ${o.ryds} yards. Load the box and set the edge: defense +2.` });
  if (lead >= 0) out.push({ adj: { name: 'Ball Control', off: -0.5, def: 0.5, secure: true }, title: 'Ball Control', desc: 'Protect the football and shorten the game: about 25% fewer turnovers, slightly safer offense.' });
  if (lead < 0) out.push({ adj: { name: 'Open It Up', off: 2.5, def: -1 }, title: 'Open It Up', desc: `Down ${-lead}. Go no-huddle and take shots: offense +2.5, but the defense loosens (−1).` });
  out.push({ adj: null, title: 'Stay the Course', desc: 'The plan is working. No changes.' });
  return out.slice(0, 4);
}

function take(sim: GameSim): string {
  const [a, h] = sim.sides, [sa, sh] = sim.score;
  const lead = sa === sh ? null : sa > sh ? a : h;
  const yd = (i: 0 | 1) => sim.box[i].yds;
  if (!lead) return `All square at the half, ${sa}-${sh}. Whoever wins the adjustments wins this game.`;
  const li = lead === a ? 0 : 1, m = Math.abs(sa - sh);
  if (m >= 17) return `This one is getting away. The ${lead.team.nick} have ${yd(li)} yards and a ${m}-point cushion.`;
  if (yd(li) < yd((1 - li) as 0 | 1)) return `The ${lead.team.nick} lead, but they've been outgained. That usually doesn't last.`;
  return `The ${lead.team.nick} are up ${m}. ${m <= 7 ? 'One score game, plenty of football left.' : 'They need to keep their foot on the gas.'}`;
}

export function Halftime({ L, sim, onPick }: { L: League; sim: GameSim; onPick: (a: HalfAdj | null) => void }) {
  const me = (sim.sides[0].abbr === L.user ? 0 : 1) as 0 | 1;
  const opts = options(L, sim, me);
  const line = take(sim);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^[1-4]$/.test(e.key) && opts[+e.key - 1]) { e.preventDefault(); e.stopImmediatePropagation(); onPick(opts[+e.key - 1].adj); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  });
  const [a, h] = sim.sides;
  const rows: [string, (i: 0 | 1) => number, (v: number) => string][] = [
    ['Total yards', i => sim.box[i].yds, v => `${v}`], ['Passing', i => sim.box[i].pyds, v => `${v}`], ['Rushing', i => sim.box[i].ryds, v => `${v}`],
    ['First downs', i => sim.box[i].fd, v => `${v}`], ['Turnovers', i => sim.box[i].to, v => `${v}`], ['3rd down', i => sim.box[i].third[0], v => `${v}`],
  ];
  const top = (i: 0 | 1) => [...sim.lines.entries()].map(([id, l]) => ({ p: L.players[id] as Player | undefined, l, y: (l.py ?? 0) * 0.5 + (l.ry ?? 0) + (l.recy ?? 0) + (l.dsk ?? 0) * 30 + (l.dint ?? 0) * 40 }))
    .filter(x => x.p && x.p.team === sim.sides[i].abbr).sort((x, y) => y.y - x.y)[0];
  const line2 = (x: ReturnType<typeof top>) => !x ? '' : x.l.pa ? `${x.l.pc}/${x.l.pa}, ${x.l.py} yds, ${x.l.ptd} TD` : x.l.ra ? `${x.l.ra} car, ${x.l.ry} yds` : x.l.rec ? `${x.l.rec} rec, ${x.l.recy} yds` : `${x.l.tkl} tkl, ${x.l.dsk} sk`;
  return createPortal(
    <div className="ht" style={{ '--a': vivid(a.team.colors[0]), '--h': clash(vivid(a.team.colors[0]), vivid(h.team.colors[0])) ? vivid(h.team.colors[1] ?? '#ffffff') : vivid(h.team.colors[0]) } as CSSProperties}>
      <i className="pt-bar top" /><i className="pt-bar bot" />
      <div className="ht-in">
        <div className="ht-score">
          <div><Logo team={a.team} size={64} /><b>{sim.score[0]}</b></div>
          <span>Halftime</span>
          <div><b>{sim.score[1]}</b><Logo team={h.team} size={64} /></div>
        </div>
        <div className="ht-grid">
          <div className="ht-stats">{rows.map(([k, f, fmt], i) => { const x = f(0), y = f(1), t = Math.max(1, x + y); return (
            <div key={k} className="ht-row" style={{ animationDelay: `${i * 0.08}s` }}><b>{fmt(x)}</b><div className="ht-bar"><i style={{ width: `${(x / t) * 100}%` }} /><em style={{ width: `${(y / t) * 100}%` }} /></div><b>{fmt(y)}</b><span>{k}</span></div>
          ); })}</div>
          <div className="ht-top">{([0, 1] as const).map(i => { const x = top(i); return x?.p ? <div key={i} className="ht-p"><Face p={x.p} size={56} /><div><b>{x.p.fn[0]}. {x.p.ln}</b><span>{sim.sides[i].team.nick} · {line2(x)}</span></div></div> : null; })}</div>
        </div>
        <div className="ht-take"><b>{ANALYST}</b><span>{line}</span></div>
        <h3 className="ht-h">Your second-half adjustment</h3>
        <div className="ht-opts">{opts.map((o, i) => (
          <button key={o.title} className="ht-o" onClick={() => onPick(o.adj)}><kbd>{i + 1}</kbd><b>{o.title}</b><span>{o.desc}</span></button>
        ))}</div>
      </div>
    </div>,
    document.body,
  );
}
