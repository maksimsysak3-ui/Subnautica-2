// The live Stadium Pulse meter: how loud the home crowd is right now, the building's rank in
// the league, and what the noise is doing to the visitors. The heartbeat speeds up and the
// rings grow as the building gets louder.
import type { CSSProperties } from 'react';
import type { GameSim } from '../sim/game';
import { crowdRank, pulseLabel } from '../sim/pulse';
import './pulse.css';

export function StadiumPulse({ sim, value, color }: { sim: GameSim; value?: number; color: string }) {
  if (sim.game.neutral) return null;
  const v = Math.round(value ?? sim.pulse), base = sim.pulseBase;
  const home = sim.sides[1].team, r = crowdRank(sim.league, home.abbr);
  const noisy = v > 50;
  const bpm = Math.round(60 + v * 1.2);
  const hurt = Math.max(0, (v - 50) / 50);
  return (
    <div className={`sp${v >= 90 ? ' max' : v >= 78 ? ' hot' : ''}`} style={{ '--tc': color, '--beat': `${60 / bpm}s`, '--v': v / 100 } as CSSProperties} title="Home crowd noise. Above 50 the visitors' offense plays worse and jumps early more often.">
      <div className="sp-heart"><i /><i /><i /><b>{v}</b></div>
      <div className="sp-mid">
        <div className="sp-top"><span>Stadium Pulse</span><em>{pulseLabel(v)}</em></div>
        <div className="sp-bar"><u style={{ width: `${v}%` }} /><s style={{ left: `${base}%` }} /></div>
        <div className="sp-sub">{home.stadium || `${home.name} home`} · loudest building <b>{r.label}</b></div>
      </div>
      <div className={`sp-fx${noisy ? ' on' : ''}`}>
        {noisy ? <><b>Visitors rattled</b><span>False starts +{Math.round(hurt * 3.5)}% · offense −{(hurt * 2.4).toFixed(1)}</span></> : <><b>Crowd settling</b><span>No effect on the visitors</span></>}
      </div>
    </div>
  );
}
