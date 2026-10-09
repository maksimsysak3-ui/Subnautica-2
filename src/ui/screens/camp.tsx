// Training Camp: pick the camp focus, settle the position battles (with the daily camp
// reports), see who stood out, and make the cut-down day decisions yourself.
import type { CSSProperties } from 'react';
import { useApp, app } from '../store';
import { Face, Ovr, vivid } from '../components';
import { campState, decideBattle, setFocus, bubble, keepPlayer, FOCUS, type Focus } from '../../core/camp';
import { release } from '../../core/offseason';
import type { Player } from '../../core/types';

export function CampScreen() {
  const L = useApp().league!;
  const c = campState(L);
  const me = L.teams[L.user];
  if (!c || L.phase !== 'camp') return <div className="card empty">Training camp opens after the draft. Position battles, the camp focus and cut-down day all happen here.</div>;
  const P = (id: string) => L.players[id];
  const active = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT').length;
  const ps = Object.values(L.players).filter(p => p.team === L.user && p.status === 'PS').length;
  const bub = bubble(L);
  const status = (p: Player) => (c.keep.includes(p.id) ? 'keep' : p.status === 'PS' ? 'ps' : 'open');
  return (
    <div className="cp" style={{ '--tc': vivid(me.colors[0]) } as CSSProperties}>
      <div className="cp-head">
        <div><span className="up">{L.season} Training Camp · {me.name}</span><div className="h1">Camp is open</div>
          <p>Set the tone for the season: choose a focus, settle the battles, and decide who makes the 53.</p></div>
        <div className="cp-count"><b className={active > 53 ? 'over' : ''}>{active}</b><span>of 53 active</span><small>{ps} on the practice squad (16 max)</small></div>
      </div>

      <section className="cp-sec">
        <h3>Camp focus <span>{c.focus ? `Locked: ${c.focus}` : 'Choose one'}</span></h3>
        <div className="cp-focus">{(Object.keys(FOCUS) as Focus[]).map(f => (
          <button key={f} className={`cp-f${c.focus === f ? ' on' : ''}`} disabled={!!c.focus} onClick={() => { setFocus(L, f); app.toast(`Camp focus: ${f}`); app.touch(); }}>
            <b>{f}</b><span>{FOCUS[f]}</span>
          </button>
        ))}</div>
      </section>

      <section className="cp-sec">
        <h3>Position battles <span>{c.battles.length ? `${c.battles.filter(b => b.decided).length} of ${c.battles.length} decided` : 'No close battles this year'}</span></h3>
        <div className="cp-battles">{c.battles.map(b => {
          const a = P(b.a), z = P(b.b); if (!a || !z) return null;
          return (
            <div key={b.pos} className="cp-b">
              <div className="cp-bh"><b>{b.pos}</b><span>{b.decided ? `Starter: ${P(b.decided).ln}` : `Camp edge: ${P(b.leader).ln}`}</span></div>
              <div className="cp-vs">{[a, z].map(p => (
                <div key={p.id} className={`cp-pl${b.decided === p.id ? ' won' : b.decided ? ' lost' : ''}`}>
                  <Face p={p} size={74} team={me} /><b>{p.fn[0]}. {p.ln}</b><span>{p.exp === 0 ? 'Rookie' : `${p.exp} yr${p.exp > 1 ? 's' : ''}`} · {Math.floor(p.age)} yrs</span><Ovr v={p.ovr} />
                  {!b.decided && <button className="btn sm" onClick={() => { decideBattle(L, b.pos, p.id); app.toast(`${p.ln} wins the ${b.pos} job`); app.touch(); }}>Name starter</button>}
                </div>
              ))}<i className="cp-x">VS</i></div>
              <ul className="cp-rep">{b.reports.map(r => <li key={r}>{r}</li>)}</ul>
              {!b.decided && <button className="btn ghost sm" onClick={() => { decideBattle(L, b.pos, b.leader); app.toast(`${P(b.leader).ln} earned it in camp`); app.touch(); }}>Let camp decide</button>}
            </div>
          );
        })}</div>
      </section>

      <section className="cp-sec">
        <h3>Camp report <span>Who rose and who slipped</span></h3>
        <div className="cp-so">{c.standouts.map(s => { const p = P(s.pid); if (!p) return null; return (
          <div key={s.pid} className={`cp-s ${s.delta > 0 ? 'up' : 'dn'}`} onClick={() => app.go({ id: 'player', pid: p.id })}><Face p={p} size={40} team={me} /><div><b>{p.fn[0]}. {p.ln}</b><span>{p.pos} · {p.ovr} OVR</span></div><em>{s.delta > 0 ? '+' : ''}{s.delta}</em></div>
        ); })}</div>
      </section>

      <section className="cp-sec">
        <h3>Cut-down day <span>{active > 53 ? `${active - 53} more to move before the opener; anyone you don't decide on is handled by the staff` : 'Roster is at 53 or below'}</span></h3>
        <div className="cp-cut">{bub.map(p => (
          <div key={p.id} className={`cp-c ${status(p)}`}>
            <Face p={p} size={34} team={me} /><b>{p.fn[0]}. {p.ln}</b><span>{p.pos}</span><span>{Math.floor(p.age)} yrs · {p.exp ? `${p.exp} exp` : 'rookie'}</span><Ovr v={p.ovr} /><span className="mute">{p.pot} pot</span>
            <div className="cp-cb">
              <button className={`btn sm${status(p) === 'keep' ? ' primary' : ''}`} onClick={() => { keepPlayer(L, p); app.touch(); }}>Keep</button>
              <button className={`btn sm${status(p) === 'ps' ? ' primary' : ''}`} disabled={p.exp > 3 || (ps >= 16 && p.status !== 'PS')} title={p.exp > 3 ? 'Practice squad is for players with 3 or fewer seasons' : ''} onClick={() => { p.status = 'PS'; app.touch(); }}>Practice squad</button>
              <button className="btn sm ghost" onClick={() => { release(L, p, false); app.toast(`${p.ln} released`); app.touch(); }}>Release</button>
            </div>
          </div>
        ))}</div>
      </section>
    </div>
  );
}
