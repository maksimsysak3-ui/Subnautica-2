// The Archetype tab: the player's style, his three-level skill tree, the goals that
// earn skill points, and the development ladder the tree climbs. Buying a node plays
// a burst on the node and floats the rating gain; finishing a level promotes his dev.
import { useState, type CSSProperties } from 'react';
import { app, useApp } from '../store';
import { DevIcon, vivid } from '../components';
import type { Player } from '../../core/types';
import { ARCHETYPES, archOf, treeOf, treeFor, canBuy, buy, fit, goalsFor, levelDone, LEVEL_OVR, BRANCH_NAME, type Node } from '../../core/archetypes';
import { ATTR_NAME } from '../../core/ratings';

export function ArchetypeTab({ p }: { p: Player }) {
  const L = useApp().league!;
  const t = treeOf(p)!, a = archOf(p)!;
  const mine = p.team === L.user;
  const nodes = treeFor(a);
  const [pop, setPop] = useState<{ id: string; text: string; k: number } | null>(null);
  const [promo, setPromo] = useState<string | null>(null);
  const team = L.teams[p.team];
  const col = team ? vivid(team.colors[0]) : '#3a4558';
  const take = (n: Node) => {
    if (!mine) return;
    const r = buy(L, p, n);
    if (!r) return;
    setPop({ id: n.id, text: `+${n.amt} ${n.attr}`, k: Date.now() });
    if (r.dev) { setPromo(r.dev); setTimeout(() => setPromo(null), 2600); }
    app.touch();
  };
  const goals = goalsFor(p, L.season);
  const lvl = (n: 1 | 2 | 3) => { const ns = nodes.filter(x => x.level === n); return ns.filter(x => t.owned.includes(x.id)).length / ns.length; };
  const devs = ['Normal', 'Star', 'Superstar', 'X-Factor'] as const;
  const node = (n: Node) => {
    const st = canBuy(p, n);
    return (
      <button key={n.id} className={`an ${st}${pop?.id === n.id ? ' pop' : ''}`} onClick={() => take(n)} title={`${ATTR_NAME[n.attr]} +${n.amt} · ${n.cost} SP`} disabled={!mine || st !== 'ok'}>
        <i><b>{n.attr}</b><em>+{n.amt}</em></i>
        <span className="an-cost">{st === 'owned' ? '✓' : st === 'ovr' ? `${LEVEL_OVR[n.level]} OVR` : `${n.cost} SP`}</span>
        {pop?.id === n.id && <span key={pop.k} className="an-float">{pop.text}</span>}
      </button>
    );
  };
  const row = (ns: Node[]) => <div className="an-row">{ns.map((n, i) => <span key={n.id} className="an-cell">{i > 0 && <span className={`an-link${t.owned.includes(n.id) ? ' on' : t.owned.includes(ns[i - 1].id) ? ' open' : ''}`} />}{node(n)}</span>)}</div>;
  return (
    <div className="arch" style={{ '--ac': col } as CSSProperties}>
      <div className="arch-head">
        <div className="arch-emblem"><span>{a.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span></div>
        <div className="arch-id">
          <span className="up">Archetype · {p.pos}</span>
          <div className="h2">{a.name}</div>
          <p>{a.desc}</p>
          <div className="arch-keys">{a.attrs.map(k => <span key={k} title={ATTR_NAME[k]}>{k} <b>{p.attrs[k]}</b></span>)}</div>
        </div>
        <div className="arch-sp"><b>{t.sp}</b><span>Skill Points</span></div>
      </div>

      <div className="arch-ladder">
        {devs.map((d, i) => (
          <div key={d} className={`al-step${devs.indexOf(p.dev) >= i ? ' on' : ''}`}>
            <DevIcon d={d} size={30} /><b>{d}</b>
            {i > 0 && <><span className="al-bar"><i style={{ width: `${lvl(i as 1 | 2 | 3) * 100}%` }} /></span><em>Level {i}{LEVEL_OVR[i as 1 | 2 | 3] ? ` · needs ${LEVEL_OVR[i as 1 | 2 | 3]} OVR` : ''}</em></>}
          </div>
        ))}
      </div>

      {mine && t.owned.length === 0 && (
        <div className="arch-pick">
          <span className="up">Choose his path · locks once you spend a point</span>
          <div className="row">{(ARCHETYPES[p.pos] ?? []).map(x => (
            <button key={x.name} className={`chip${x.name === a.name ? ' on' : ''}`} onClick={() => { t.arch = x.name; p.arch = x.name; app.touch(); }}>{x.name} <span className="mute">{Math.round(fit(p, x))}</span></button>
          ))}</div>
        </div>
      )}

      <div className="arch-grid">
        <div className="arch-tree">
          <section className={`at-lvl${levelDone(p, 1) ? ' done' : ''}`}><header><b>Level 1</b><span>Finish to become a <DevIcon d="Star" size={16} /> Star</span></header>{row(nodes.filter(n => n.level === 1))}</section>
          <section className={`at-lvl${levelDone(p, 2) ? ' done' : ''}`}><header><b>Level 2</b><span>Finish to become a <DevIcon d="Superstar" size={16} /> Superstar · {LEVEL_OVR[2]} OVR to start</span></header>{row(nodes.filter(n => n.level === 2))}</section>
          <section className={`at-lvl l3${levelDone(p, 3) ? ' done' : ''}`}><header><b>Level 3</b><span>Finish both trees to become an <DevIcon d="X-Factor" size={16} /> X-Factor · {LEVEL_OVR[3]} OVR to start</span></header>
            <div className="at-two">{(['A', 'B'] as const).map(b => <div key={b} className="at-branch"><span className="up">Tree {b} · {BRANCH_NAME(a, b)}</span>{row(nodes.filter(n => n.level === 3 && n.branch === b))}</div>)}</div>
          </section>
        </div>
        <aside className="arch-goals">
          <h4>{L.season} Goals</h4>
          {goals.filter(g => !g.game).map(g => { const done = g.cur >= g.target; return (
            <div key={g.id} className={`ag${done ? ' done' : ''}`}><div className="row" style={{ justifyContent: 'space-between' }}><span>{g.label}</span><b>+{g.sp} SP</b></div><span className="ag-bar"><i style={{ width: `${Math.min(100, (g.cur / g.target) * 100)}%` }} /></span><em>{Math.min(g.cur, g.target).toLocaleString()} / {g.target.toLocaleString()}</em></div>
          ); })}
          <h4 style={{ marginTop: 14 }}>Every Game</h4>
          {goals.filter(g => g.game).map(g => <div key={g.id} className="ag game"><span>{g.label}</span><b>+{g.sp} SP</b></div>)}
          {!mine && <div className="small mute" style={{ marginTop: 10 }}>Only your own players can spend skill points.</div>}
        </aside>
      </div>
      {promo && <div className="arch-promo"><DevIcon d={promo as Player['dev']} size={90} /><b>{promo}</b><span>{p.fn} {p.ln}</span></div>}
    </div>
  );
}
