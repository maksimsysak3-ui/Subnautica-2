// Depth chart and stats. The depth chart shows every starter on a field diagram and each
// position's full order, which you can change (saved with the dynasty). Stats are last season's
// leaders by category.
import { useState, type CSSProperties } from 'react';
import { rosterOf, headshot, YR, type School, type Player } from './data';
import { profile } from './player';
import { useDynasty, update } from './store';
import { showCard } from './PlayerCard';

export const STARTS: Record<string, number> = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, G: 2, C: 1, EDGE: 2, DT: 2, LB: 2, CB: 2, S: 2, K: 1, P: 1 };
const POSITIONS = Object.keys(STARTS);
/** Depth order for a position: the saved order, then anyone new by rating. */
export function depthOf(s: School, saved: Record<string, string[]>, pos: string): Player[] {
  const all = rosterOf(s.id).filter(p => p.pos === pos);
  const order = saved[pos] ?? [];
  return [...order.map(id => all.find(p => p.id === id)).filter((p): p is Player => !!p), ...all.filter(p => !order.includes(p.id))];
}
const tierC = (v: number) => (v >= 90 ? 'te' : v >= 80 ? 'ta' : v >= 70 ? 'tb' : 'tc');

// Where each starter stands on the diagram (percent of width, percent of height). Offense below
// the line of scrimmage at 50%, defense above it.
const SPOTS: Record<string, [number, number][]> = {
  QB: [[50, 72]], RB: [[50, 86]], WR: [[6, 58], [94, 58], [16, 68]], TE: [[85, 62]], OT: [[26, 58], [74, 58]], G: [[38, 58], [62, 58]], C: [[50, 58]],
  EDGE: [[30, 40], [70, 40]], DT: [[44, 40], [56, 40]], LB: [[38, 28], [62, 28]], CB: [[8, 36], [92, 36]], S: [[36, 12], [64, 12]], K: [[84, 92]], P: [[16, 92]],
};

export function DepthTab({ s }: { s: School }) {
  const d = useDynasty(s.id);
  const [pos, setPos] = useState('QB');
  const list = depthOf(s, d.depth, pos);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const ids = list.map(p => p.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    update(x => { x.depth[pos] = ids; });
  };
  return (
    <div className="dc">
      <section className="hc dc-field-card">
        <header><h3>Starting lineup</h3><span className="tag">Click a player to move him</span></header>
        <div className="dc-field">
          <div className="dc-los" />
          {POSITIONS.flatMap(ps => depthOf(s, d.depth, ps).slice(0, STARTS[ps]).map((p, i) => {
            const [x, y] = SPOTS[ps]?.[i] ?? [50, 50];
            return (
              <button key={p.id} className={`dc-tok${ps === pos ? ' sel' : ''}${['EDGE', 'DT', 'LB', 'CB', 'S'].includes(ps) ? ' def' : ''}`} style={{ left: `${x}%`, top: `${y}%` } as CSSProperties} onClick={() => setPos(ps)}>
                <span className="dc-face">{headshot(p) ? <img src={headshot(p)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <b>{p.num}</b>}<i className={`dc-o ${tierC(p.ovr)}`}>{p.ovr}</i></span>
                <em>{ps} · {p.ln}</em>
              </button>
            );
          }))}
        </div>
      </section>
      <section className="hc dc-list">
        <header><h3>{pos} depth</h3></header>
        <div className="chips">{POSITIONS.map(p => <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>)}</div>
        <div className="dc-rows">{list.map((p, i) => (
          <div key={p.id} className={`dc-row${i < STARTS[pos] ? ' starter' : ''}`}>
            <em>{i < STARTS[pos] ? `${pos}${STARTS[pos] > 1 ? i + 1 : ''}` : i + 1}</em>
            <span className="dc-rface">{headshot(p) ? <img src={headshot(p)} alt="" loading="lazy" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : null}</span>
            <button className="dc-name" onClick={() => showCard(p)}><b>{p.fn} {p.ln}</b><span>#{p.num} · {YR[p.yr]} · {profile(p).arch}</span>
              <div className="dc-keys">{profile(p).keys.slice(0, 4).map(k => <i key={k}><em>{k}</em>{profile(p).attrs[k]}</i>)}</div></button>
            <div className="dc-ovr"><b className={tierC(p.ovr)}>{p.ovr}</b><span className={`dev ${profile(p).dev}`}>{profile(p).dev}</span></div>
            <div className="dc-move"><button disabled={i === 0} onClick={() => move(i, -1)}>Up</button><button disabled={i === list.length - 1} onClick={() => move(i, 1)}>Down</button></div>
          </div>
        ))}</div>
      </section>
    </div>
  );
}

const CATS: { k: string; cols: [string, (p: Player) => number | string][]; sort: (p: Player) => number; when: (p: Player) => boolean }[] = [
  { k: 'Passing', when: p => !!p.s?.[2], sort: p => p.s![3], cols: [['CMP', p => p.s![1]], ['ATT', p => p.s![2]], ['PCT', p => ((p.s![1] / p.s![2]) * 100).toFixed(1)], ['YDS', p => p.s![3]], ['TD', p => p.s![4]], ['INT', p => p.s![5]]] },
  { k: 'Rushing', when: p => !!p.s?.[6], sort: p => p.s![7], cols: [['ATT', p => p.s![6]], ['YDS', p => p.s![7]], ['YPC', p => (p.s![7] / p.s![6]).toFixed(1)], ['TD', p => p.s![8]]] },
  { k: 'Receiving', when: p => !!p.s?.[9], sort: p => p.s![10], cols: [['REC', p => p.s![9]], ['YDS', p => p.s![10]], ['YPR', p => (p.s![10] / p.s![9]).toFixed(1)], ['TD', p => p.s![11]]] },
  { k: 'Defense', when: p => !!(p.s && (p.s[12] || p.s[13] || p.s[14] || p.s[15])), sort: p => p.s![12] * 3 + p.s![13] * 3 + p.s![14] + p.s![15] * 2, cols: [['SACK', p => p.s![12]], ['INT', p => p.s![13]], ['PBU', p => p.s![14]], ['FF', p => p.s![15]]] },
  { k: 'Kicking', when: p => !!p.s?.[17], sort: p => p.s![16], cols: [['FGM', p => p.s![16]], ['FGA', p => p.s![17]], ['PCT', p => ((p.s![16] / p.s![17]) * 100).toFixed(0)]] },
];
export function StatsTab({ s }: { s: School }) {
  const [cat, setCat] = useState('Passing');
  const c = CATS.find(x => x.k === cat)!;
  const rows = rosterOf(s.id).filter(c.when).sort((a, b) => c.sort(b) - c.sort(a));
  return (
    <>
      <div className="pills" style={{ marginBottom: 14 }}>{CATS.map(x => <button key={x.k} className={`pill${cat === x.k ? ' on' : ''}`} onClick={() => setCat(x.k)}>{x.k}</button>)}</div>
      <section className="hc">
        <header><h3>{cat} · 2025 season</h3><span className="tag">Returning players</span></header>
        <div className="st-tbl" style={{ '--n': c.cols.length } as CSSProperties}>
          <div className="st-r th"><span>Player</span><span>Pos</span><span>GP</span>{c.cols.map(([h]) => <span key={h}>{h}</span>)}</div>
          {rows.map(p => <div key={p.id} className="st-r"><button className="dc-name" onClick={() => showCard(p)}><b>{p.fn} {p.ln}</b></button><span>{p.pos}</span><span>{p.s![0]}</span>{c.cols.map(([h, f]) => <span key={h}>{f(p)}</span>)}</div>)}
          {!rows.length && <div className="pc-empty">Nobody on the roster recorded {cat.toLowerCase()} stats last season.</div>}
        </div>
      </section>
    </>
  );
}
