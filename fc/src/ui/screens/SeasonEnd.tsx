import { useMemo, useState } from 'react';
import { useWorld, mutate, saveNow } from '../store';
import { go } from '../nav';
import { Crest, PlayerCard, TrophySvg } from '../art';
import { Panel } from '../bits';
import { endSeason, table, ord, setObjectives, news } from '../../core/season';
import { LEAGUES } from '../../core/world';
import { TrophyCine } from '../cine';
import { fmtSeason } from '../App';
import { shuffle } from '../../core/rng';

export function SeasonEnd({ onNext }: { onNext?: () => void }) {
  const w = useWorld();
  const [step, setStep] = useState<'review' | 'trophy' | 'awards'>('review');
  const [trophyIdx, setTrophyIdx] = useState(0);
  const u = w.clubs[w.user];
  const won = u.trophies.filter(t => t.season === w.season);
  const [season] = useState(w.season);
  void onNext;
  if (step === 'trophy' && won[trophyIdx]) return <TrophyCine club={u} title={won[trophyIdx].name} onDone={() => { if (trophyIdx + 1 < won.length) setTrophyIdx(trophyIdx + 1); else setStep('review'); }} />;
  if (step === 'awards') {
    const aw = w.awards.filter(a => a.season === season);
    const podium = ["Ballon d'Or", "Ballon d'Or — 2nd", "Ballon d'Or — 3rd"].map(t => aw.find(a => a.title === t)).filter(Boolean);
    return (
      <div className="season-end awards-night">
        <div className="an-bg" />
        <h1>Awards Night <span>{fmtSeason(season)}</span></h1>
        <div className="podium">
          {[1, 0, 2].map(i => { const a = podium[i]; const p = a?.pid ? w.players[a.pid] : undefined; return p ? <div key={i} className={`pod p${i + 1}`}><PlayerCard p={p} club={p.club ? w.clubs[p.club] : undefined} size={i === 0 ? 1.2 : 0.95} /><b>{i === 0 ? "BALLON D'OR" : `${i + 1}${ord(i + 1)}`}</b></div> : null; })}
        </div>
        <div className="aw-list">
          {aw.filter(a => !a.title.startsWith("Ballon d'Or")).map((a, i) => { const p = a.pid ? w.players[a.pid] : undefined; return <div key={i} className="aw"><span>{a.title}</span><b>{p?.name ?? '—'}</b>{p?.club && <Crest club={w.clubs[p.club]} size={20} />}<em>{a.value}</em></div>; })}
        </div>
        <button className="btn-hero" onClick={() => { void saveNow(); go({ s: 'hub' }); }}>Start the {fmtSeason(w.season)} season ▶</button>
      </div>
    );
  }
  const lg = w.comps[u.league];
  const t = lg ? table(w, u.league) : [];
  const pos = t.findIndex(r => r.id === u.id) + 1;
  return (
    <div className="season-end">
      <h1>Season review <span>{fmtSeason(w.season)}</span></h1>
      <div className="se-grid">
        <Panel title="Your season">
          <div className="se-me">
            <Crest club={u} size={110} />
            <div>
              <b className="se-pos">{pos}{ord(pos)}</b>
              <span>in the {lg?.name}</span>
              <span>Objective: {w.board.objective} — {pos <= w.board.objectiveRank ? <b className="pos">achieved</b> : <b className="neg">missed</b>}</span>
              <span>Board confidence {Math.round(w.board.confidence)}%</span>
            </div>
          </div>
          {won.length > 0 && <div className="se-trophies">{won.map((t2, i) => <div key={i}><TrophySvg size={50} /><b>{t2.name}</b></div>)}<button className="btn" onClick={() => { setTrophyIdx(0); setStep('trophy'); }}>Relive the celebrations</button></div>}
        </Panel>
        <Panel title="Champions across Europe">
          <div className="se-champs">
            {LEAGUES.filter(l => l.tier === 1).map(l => { const tt = table(w, l.id); const c = w.clubs[tt[0].id]; return <div key={l.id}><span>{l.name}</span><Crest club={c} size={28} /><b>{c.name}</b><em>{tt[0].pts} pts</em></div>; })}
            {['ucl', 'uel'].map(id => w.comps[id]?.winner && <div key={id}><span>{w.comps[id].name}</span><Crest club={w.clubs[w.comps[id].winner!]} size={28} /><b>{w.clubs[w.comps[id].winner!].name}</b></div>)}
            {Object.values(w.comps).filter(c => c.kind === 'cup' && c.winner).map(c => <div key={c.id}><span>{c.name}</span><Crest club={w.clubs[c.winner!]} size={28} /><b>{w.clubs[c.winner!].name}</b></div>)}
          </div>
        </Panel>
        <Panel title="Relegated">
          <div className="se-champs">
            {LEAGUES.filter(l => l.tier === 1).map(l => { const tt = table(w, l.id); return tt.slice(-l.relegate).map(r => <div key={r.id}><span>{l.short}</span><Crest club={w.clubs[r.id]} size={22} /><b>{w.clubs[r.id].name}</b><em>{r.pts} pts</em></div>); })}
          </div>
        </Panel>
      </div>
      <div className="se-btns">
        <button className="btn-hero" onClick={() => { mutate(endSeason); setStep('awards'); }}>Awards night & new season ▶</button>
      </div>
    </div>
  );
}

export function Sacked() {
  const w = useWorld();
  const old = w.clubs[w.user];
  const offers = useMemo(() => shuffle(Object.values(w.clubs).filter(c => c.tier === 1 && c.id !== w.user && c.rep <= old.rep + 2 && c.rep >= old.rep - 22)).slice(0, 4), [w, old]);
  return (
    <div className="season-end sacked">
      <h1>{old.tier === 2 ? 'Relegated.' : 'Sacked.'}</h1>
      <p className="lead">{old.name} have parted ways with you. Your phone is ringing, though — these clubs want to talk.</p>
      <div className="job-offers">
        {offers.map(c => (
          <button key={c.id} className="job" onClick={() => {
            mutate(x => {
              x.user = c.id; x.sacked = false; x.board = { confidence: 60, objective: '', objectiveRank: 10, cupTarget: '', warnings: 0 };
              setObjectives(x);
              news(x, 'board', `Welcome to ${c.name}`, `You have been appointed manager of ${c.name}. Objective: ${x.board.objective}.`);
            });
            void saveNow(); go({ s: 'hub' });
          }} style={{ ['--c1' as string]: c.c1 }}>
            <Crest club={c} size={80} /><b>{c.name}</b><span>{w.comps[c.league]?.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
