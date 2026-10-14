// The Stadium Pulse broadcast graphic, laid over the corner of the field: a live crowd-noise
// equalizer that jumps higher and faster as the building gets louder, the reading and its
// state, how this building ranks against the league, and what the noise is doing to the
// visitors right now.
import type { CSSProperties } from 'react';
import type { GameSim } from '../sim/game';
import { crowdRank, pulseLabel } from '../sim/pulse';
import './pulse.css';

const BARS = Array.from({ length: 18 }, (_, i) => ({ d: 0.38 + ((i * 37) % 23) / 40, o: ((i * 53) % 17) / 17, h: 0.45 + ((i * 29) % 11) / 20 }));

export function StadiumPulse({ sim, value, color }: { sim: GameSim; value?: number; color: string }) {
  if (sim.game.neutral) return null;
  const v = Math.round(value ?? sim.pulse);
  const home = sim.sides[1].team, r = crowdRank(sim.league, home.abbr);
  const hurt = Math.max(0, (v - 50) / 50), on = v > 50;
  const state = pulseLabel(v);
  const speed = 1.6 - (v / 100) * 1.05;   // louder = faster
  return (
    <div className={`spx${v >= 90 ? ' max' : v >= 75 ? ' hot' : ''}`} style={{ '--tc': color, '--amp': 0.25 + (v / 100) * 0.75, '--spd': speed } as CSSProperties}
      title="Home crowd noise. Above 50 the visitors' offense plays worse and jumps early more often.">
      <div className="spx-eq" aria-hidden>
        {BARS.map((b, i) => <span key={i} style={{ '--d': b.d, '--o': b.o, '--h': b.h } as CSSProperties} />)}
      </div>
      <div className="spx-body">
        <div className="spx-k">Stadium Pulse</div>
        <div className="spx-v"><b>{v}</b><em>{state}</em></div>
        <div className="spx-r"><i>#{r.rank}</i> loudest of {r.of} {r.label.includes('college') ? 'in college football' : 'in the NFL'}</div>
      </div>
      <div className={`spx-fx${on ? ' on' : ''}`}>{on ? <>Visitors rattled · offense −{(hurt * 2.4).toFixed(1)} · false starts +{Math.round(hurt * 3.5)}%</> : <>Crowd settling · no effect on the visitors</>}</div>
    </div>
  );
}
