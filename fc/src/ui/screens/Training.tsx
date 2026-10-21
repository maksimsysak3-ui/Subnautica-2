import { useWorld, mutate } from '../store';
import { go } from '../nav';
import { Face, Ovr, Bar } from '../art';
import { Panel } from '../bits';
import { GROUPS, type Player } from '../../core/types';
import { ageOf } from '../../core/player';
import { potRange } from './Squad';

const FOCUS: [string, string][] = [['Balanced', 'Even spread of work across the squad.'], ['Attacking', 'Finishing drills, combinations in the final third.'], ['Defending', 'Shape, pressing triggers and one-on-one defending.'], ['Fitness', 'Conditioning: faster recovery between games.'], ['Tactical', 'Familiarity with roles and instructions.'], ['Set pieces', 'Corners, free kicks and penalties.']];

export function Training() {
  const w = useWorld();
  const u = w.clubs[w.user];
  const ps = u.squad.map(id => w.players[id]).filter(Boolean).sort((a, b) => ageOf(a, w.season) - ageOf(b, w.season));
  const inten = w.training.intensity;
  return (
    <div>
      <div className="page-h"><h1>Training Ground</h1><div className="page-stats"><div><span>Facilities</span><b>{u.facilities}/10</b></div><div><span>Academy</span><b>{u.youth}/10</b></div></div></div>
      <div className="train-grid">
        <Panel title="Weekly focus">
          <div className="focus-list">
            {FOCUS.map(([f, d]) => <button key={f} className={w.training.focus === f ? 'on' : ''} onClick={() => mutate(x => { x.training.focus = f; })}><b>{f}</b><span>{d}</span></button>)}
          </div>
          <label className="slider big"><span>Intensity</span><input type="range" min={0} max={100} value={inten} onChange={e => mutate(x => { x.training.intensity = +e.target.value; })} /><em>{inten < 35 ? 'Light — fresher legs, slower growth' : inten > 65 ? 'Hard — faster growth, tired legs' : 'Normal'}</em></label>
        </Panel>
        <Panel title="Individual development plans">
          <div className="dev-list">
            {ps.map((p: Player) => (
              <div key={p.id} className="dev-row">
                <Face p={p} club={u} size={30} />
                <span className="pl-name" onClick={() => go({ s: 'player', id: p.id })}>{p.name}</span>
                <span className="muted sm">{ageOf(p, w.season)}y · {p.pos}</span>
                <Ovr v={p.ovr} small /><span className="muted sm">→ {potRange(w, p)}</span>
                <span className="dev-bar"><Bar v={p.ovr} max={Math.max(p.pot, p.ovr + 1)} color="#38bdf8" /></span>
                <select value={p.devFocus ?? ''} onChange={e => mutate(x => { x.players[p.id].devFocus = (e.target.value || undefined) as Player['devFocus']; })}>
                  <option value="">Balanced</option>{Object.keys(GROUPS).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
