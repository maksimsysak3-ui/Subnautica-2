// Awards: the live races during the season (who leads each trophy right now, with his numbers),
// then the winners after championship week, the Heisman ceremony card and the All-America team.
import { useState, type CSSProperties } from 'react';
import { headshot, school, showColor, YR, type School } from './data';
import { Logo } from './App';
import { useDynasty } from './store';
import { AWARDS, race, playerById, CCG_WEEK } from './season';
import { showCard } from './PlayerCard';

const Face = ({ id }: { id: string }) => { const p = playerById(id); const u = p && headshot(p); return <span className="aw-face">{u ? <img src={u} alt="" loading="lazy" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : <b>{p?.num}</b>}</span>; };

export function AwardsTab({ s }: { s: School }) {
  const d = useDynasty(s.id), se = d.season!;
  const done = !!se.awards;
  const [view, setView] = useState<'awards' | 'aa'>('awards');
  if (d.week === 0) return (
    <section className="hc aw-empty"><h2>Award season starts with kickoff</h2><p>Every trophy race updates after each week from real game production. Winners are announced after championship week; the All-America team with them.</p></section>
  );
  const heis = done ? se.awards!.find(a => a.id === 'heisman')! : null;
  return (
    <div className="aw">
      <div className="pills" style={{ marginBottom: 14 }}>
        <button className={`pill${view === 'awards' ? ' on' : ''}`} onClick={() => setView('awards')}>{done ? 'Winners' : 'Award races'}</button>
        <button className={`pill${view === 'aa' ? ' on' : ''}`} onClick={() => setView('aa')} disabled={!done}>All-America team</button>
        {!done && <span className="tag" style={{ marginLeft: 8 }}>Winners announced after {CCG_WEEK > d.week ? `week ${CCG_WEEK}` : 'championship week'}</span>}
      </div>
      {view === 'awards' && heis && (() => { const p = playerById(heis.winner)!, t = school(heis.team); return (
        <section className="aw-hero" style={{ '--tc': showColor(t) } as CSSProperties}>
          <div className="aw-trophy"><i /><em /></div>
          <div className="aw-hero-id">
            <span className="aw-k">{heis.name} · {se.polls.length - 1 >= CCG_WEEK ? 'Winner' : ''}</span>
            <button className="aw-name" onClick={() => showCard(p)}>{p.fn} {p.ln}</button>
            <span className="aw-sub"><Logo id={t.id} size={22} /> {t.school} · {p.pos} · {YR[p.yr]}</span>
            <b className="aw-line">{heis.line}</b>
            <div className="aw-fin">{heis.finalists.slice(1).map(f => { const q = playerById(f.id)!; return <button key={f.id} onClick={() => showCard(q)}><Face id={f.id} /><span>{q.fn} {q.ln}<em>{school(f.team).abbr} · {f.line}</em></span></button>; })}</div>
          </div>
          <Face id={heis.winner} />
        </section>); })()}
      {view === 'awards' && (
        <div className="aw-grid">{AWARDS.filter(a => !(done && a.id === 'heisman')).map(a => {
          const rows = done ? se.awards!.find(x => x.id === a.id)!.finalists : race(se, a, 5);
          const top = (rows[0] as { v?: number } | undefined)?.v ?? 1;
          return (
            <section key={a.id} className="aw-card">
              <header><div className="aw-medal" /><div><h4>{a.name}</h4><span>{a.desc}</span></div></header>
              {rows.map((r, i) => { const p = playerById(r.id)!, t = school(r.team); return (
                <button key={r.id} className={`aw-row${i === 0 ? ' lead' : ''}${t.id === s.id ? ' mine' : ''}`} onClick={() => showCard(p)} style={{ '--tc': showColor(t) } as CSSProperties}>
                  <em>{i === 0 && done ? 'W' : i + 1}</em><Face id={r.id} /><span className="aw-who"><b>{p.fn} {p.ln}</b><small><Logo id={t.id} size={14} />{t.abbr} · {p.pos} · {r.line}</small></span>
                  {!done && 'v' in r && <i className="aw-bar"><u style={{ width: `${Math.max(8, Math.min(100, ((r as { v: number }).v / top) * 100))}%` }} /></i>}
                </button>); })}
              {!rows.length && <p className="dim">No qualifying players yet.</p>}
            </section>);
        })}</div>
      )}
      {view === 'aa' && se.allAmerica && (
        <section className="hc"><header><h3>All-America first team</h3></header>
          <div className="aa">{se.allAmerica.map(x => { const p = playerById(x.id)!, t = school(x.team); return (
            <button key={x.id} className={`aa-p${t.id === s.id ? ' mine' : ''}`} onClick={() => showCard(p)} style={{ '--tc': showColor(t) } as CSSProperties}><em>{x.pos}</em><Face id={x.id} /><b>{p.fn} {p.ln}</b><small><Logo id={t.id} size={14} />{t.school}</small><i>{p.ovr}</i></button>); })}</div>
        </section>
      )}
    </div>
  );
}
