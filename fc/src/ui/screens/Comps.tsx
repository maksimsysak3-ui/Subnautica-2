import { useState } from 'react';
import { useWorld } from '../store';
import { go } from '../nav';
import { Crest } from '../art';
import { Panel, Tabs, ClubName, Form, Empty } from '../bits';
import { fmtDate, table } from '../../core/season';
import { LEAGUES } from '../../core/world';
import type { Competition, Fixture, World } from '../../core/types';

export function Fixtures() {
  const w = useWorld();
  const [mode, setMode] = useState<'mine' | 'all'>('mine');
  const mine = w.fixtures.filter(f => f.home === w.user || f.away === w.user);
  const nearDays = [...new Set(w.fixtures.filter(f => Math.abs(f.day - w.day) <= 7).map(f => f.day))].sort((a, b) => a - b);
  return (
    <div>
      <div className="page-h"><h1>Fixtures & Results</h1></div>
      <Tabs tabs={[['mine', 'My club'], ['all', 'Around Europe']]} value={mode} onChange={setMode} />
      {mode === 'mine' ? (
        <Panel>
          <div className="fx-list">{mine.map(f => <FxRow key={f.id} w={w} f={f} />)}</div>
        </Panel>
      ) : (
        nearDays.map(d => (
          <Panel key={d} title={fmtDate(w, d, true)}>
            <div className="fx-list">{w.fixtures.filter(f => f.day === d).map(f => <FxRow key={f.id} w={w} f={f} comp />)}</div>
          </Panel>
        ))
      )}
    </div>
  );
}

export function FxRow({ w, f, comp }: { w: World; f: Fixture; comp?: boolean }) {
  const h = w.clubs[f.home], a = w.clubs[f.away];
  const me = f.home === w.user || f.away === w.user;
  return (
    <div className={`fx-row ${me ? 'me' : ''} ${f.day === w.day && !f.res ? 'today' : ''}`} onClick={() => me && (f.res || f.day === w.day) ? go({ s: 'match', fx: f.id }) : undefined}>
      <span className="fx-date">{fmtDate(w, f.day)}</span>
      <span className="fx-comp" style={{ background: w.comps[f.comp]?.color }}>{w.comps[f.comp]?.short}</span>
      <span className="fx-h"><ClubName c={h} /></span>
      <span className="fx-s">{f.res ? <b>{f.res.hg} - {f.res.ag}{f.res.pens ? <small> ({f.res.pens[0]}-{f.res.pens[1]}p)</small> : null}</b> : <span className="muted">v</span>}</span>
      <span className="fx-a"><ClubName c={a} /></span>
      {comp !== false && <span className="fx-stage muted sm">{f.stage}</span>}
    </div>
  );
}

export function Comps({ id }: { id?: string }) {
  const w = useWorld();
  const u = w.clubs[w.user];
  const [cid, setCid] = useState(id ?? u.league);
  const comp = w.comps[cid];
  const list = Object.values(w.comps);
  return (
    <div>
      <div className="page-h"><h1>Competitions</h1></div>
      <div className="comp-pick">
        {list.map(c => <button key={c.id} className={c.id === cid ? 'on' : ''} style={{ ['--cc' as string]: c.color }} onClick={() => setCid(c.id)}>{c.logo && <img src={c.logo} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />}{c.name}</button>)}
      </div>
      {comp ? (comp.kind === 'league' ? <LeagueView w={w} comp={comp} /> : comp.kind === 'europe' ? <EuropeView w={w} comp={comp} /> : <CupView w={w} comp={comp} />) : <Empty>Not available.</Empty>}
    </div>
  );
}

function LeagueView({ w, comp }: { w: World; comp: Competition }) {
  const lg = LEAGUES.find(l => l.id === comp.id)!;
  const t = table(w, comp.id);
  const n = t.length;
  const played = w.fixtures.filter(f => f.comp === comp.id && f.res);
  const rounds = [...new Set(w.fixtures.filter(f => f.comp === comp.id).map(f => f.stage))];
  const curRound = rounds.find(r => w.fixtures.some(f => f.comp === comp.id && f.stage === r && !f.res)) ?? rounds[rounds.length - 1];
  const [round, setRound] = useState(curRound);
  const scorers = Object.values(w.players).filter(p => p.cs[comp.id]?.[1]).sort((a, b) => b.cs[comp.id][1] - a.cs[comp.id][1]).slice(0, 10);
  return (
    <div className="league-grid">
      <Panel title={comp.name} right={<span className="muted sm">{played.length} matches played</span>}>
        <table className="tbl league">
          <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead>
          <tbody>{t.map((r, i) => {
            const zone = i < lg.ucl ? 'ucl' : i < lg.ucl + lg.uel ? 'uel' : i >= n - lg.relegate ? 'rel' : '';
            return (
              <tr key={r.id} className={`${r.id === w.user ? 'me' : ''} z-${zone}`}>
                <td><span className="zone-bar" />{i + 1}</td><td><ClubName c={w.clubs[r.id]} /></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td><td>{r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}</td><td><b>{r.pts}</b></td><td><Form f={r.form} /></td>
              </tr>
            );
          })}</tbody>
        </table>
        <div className="legend"><span className="z-ucl">Champions League</span><span className="z-uel">Europa League</span><span className="z-rel">Relegation</span></div>
      </Panel>
      <div>
        <Panel title="Fixtures" right={<select value={round} onChange={e => setRound(e.target.value)}>{rounds.map(r => <option key={r}>{r}</option>)}</select>}>
          <div className="fx-list">{w.fixtures.filter(f => f.comp === comp.id && f.stage === round).map(f => <FxRow key={f.id} w={w} f={f} comp={false} />)}</div>
        </Panel>
        <Panel title="Top scorers">
          {scorers.map((p, i) => <div key={p.id} className="scorer" onClick={() => go({ s: 'player', id: p.id })}><span className="rank">{i + 1}</span>{p.club && <Crest club={w.clubs[p.club]} size={18} />}<span>{p.name}</span><b>{p.cs[comp.id][1]}</b></div>)}
          {!scorers.length && <Empty>No goals yet.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

function EuropeView({ w, comp }: { w: World; comp: Competition }) {
  const t = table(w, comp.id, 'League Phase');
  const rounds = ['Knockout Play-off', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
  const scorers = Object.values(w.players).filter(p => p.cs[comp.id]?.[1]).sort((a, b) => b.cs[comp.id][1] - a.cs[comp.id][1]).slice(0, 8);
  return (
    <div className="league-grid">
      <Panel title="League phase" right={comp.winner ? <span className="champ">🏆 {w.clubs[comp.winner].name}</span> : null}>
        <table className="tbl league">
          <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>{t.map((r, i) => (
            <tr key={r.id} className={`${r.id === w.user ? 'me' : ''} ${i < 8 ? 'z-ucl' : i < 24 ? 'z-uel' : 'z-out'}`}>
              <td><span className="zone-bar" />{i + 1}</td><td><ClubName c={w.clubs[r.id]} /></td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf - r.ga}</td><td><b>{r.pts}</b></td>
            </tr>
          ))}</tbody>
        </table>
        <div className="legend"><span className="z-ucl">Round of 16</span><span className="z-uel">Knockout play-off</span><span className="z-out">Eliminated</span></div>
      </Panel>
      <div>
        <Panel title="Knockouts">
          <Bracket w={w} comp={comp} rounds={rounds} />
        </Panel>
        <Panel title="Top scorers">
          {scorers.map((p, i) => <div key={p.id} className="scorer" onClick={() => go({ s: 'player', id: p.id })}><span className="rank">{i + 1}</span>{p.club && <Crest club={w.clubs[p.club]} size={18} />}<span>{p.name}</span><b>{p.cs[comp.id][1]}</b></div>)}
          {!scorers.length && <Empty>No goals yet.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

function CupView({ w, comp }: { w: World; comp: Competition }) {
  return (
    <Panel title={comp.name} right={comp.winner ? <span className="champ">🏆 {w.clubs[comp.winner].name}</span> : null}>
      <Bracket w={w} comp={comp} rounds={['Preliminary Round', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']} />
    </Panel>
  );
}

function Bracket({ w, comp, rounds }: { w: World; comp: Competition; rounds: string[] }) {
  const present = rounds.filter(r => comp.ties.some(t => t.round === r));
  if (!present.length) return <Empty>The draw has not been made yet.</Empty>;
  return (
    <div className="bracket">
      {present.map(r => (
        <div key={r} className="br-col">
          <h4>{r}</h4>
          {comp.ties.filter(t => t.round === r).map(t => {
            const fxs = t.fx.map(id => w.fixtures.find(f => f.id === id)!).filter(Boolean);
            const goals = (club: string) => fxs.reduce((s, f) => s + (f.res ? (f.home === club ? f.res.hg : f.res.ag) : 0), 0);
            const any = fxs.some(f => f.res);
            return (
              <div key={t.id} className="tie">
                {[t.a, t.b].map(c => (
                  <div key={c} className={`tie-t ${t.winner === c ? 'win' : t.winner ? 'lose' : ''} ${c === w.user ? 'me' : ''}`}>
                    <Crest club={w.clubs[c]} size={18} /><span>{w.clubs[c].short}</span><b>{any ? goals(c) : ''}</b>
                  </div>
                ))}
                <span className="tie-d muted sm">{fmtDate(w, fxs[0].day)}{fxs[1] ? ` / ${fmtDate(w, fxs[1].day)}` : ''}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
