// The Development tab: what a player's dev trait actually does in this game (XP rate,
// offseason growth, ceiling, abilities), how he can climb to the next one, when he is
// at risk of slipping, and how rare each trait is across the league.
import type { CSSProperties } from 'react';
import { useApp } from '../store';
import { DevIcon, vivid } from '../components';
import type { Dev, Player } from '../../core/types';
import { DEV_MULT, ABILITIES } from '../../core/ratings';
import { PEAK } from '../../core/offseason';
import { hasTree, levelDone, LEVEL_OVR } from '../../core/archetypes';

const ORDER: Dev[] = ['Normal', 'Star', 'Superstar', 'X-Factor'];
const GROWTH: Record<Dev, number> = { Normal: 0.7, Star: 1, Superstar: 1.3, 'X-Factor': 1.45 };
const CEIL: Record<Dev, number> = { Normal: 0.6, Star: 0.9, Superstar: 1.15, 'X-Factor': 1.3 };
const TAG: Record<Dev, string> = {
  Normal: 'A steady pro. Improves slowly and leans on coaching and reps.',
  Star: 'A rising player. Gets more out of every practice and every game.',
  Superstar: 'A difference-maker. Grows fast and carries two Superstar abilities into every game.',
  'X-Factor': 'A game-wrecker. The fastest growth in the league, three abilities and an X-Factor zone that takes over games.',
};
const COLOR: Record<Dev, string> = { Normal: '#9aa1ad', Star: '#e0a060', Superstar: '#f2c94c', 'X-Factor': '#ff4d5e' };

export function DevTab({ p }: { p: Player }) {
  const L = useApp().league!;
  const i = ORDER.indexOf(p.dev), next = ORDER[i + 1] as Dev | undefined;
  const counts = ORDER.map(d => Object.values(L.players).filter(x => x.status === 'ACT' && x.dev === d).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const [, end] = PEAK[p.pos];
  const tree = hasTree(p.pos);
  const pct = (v: number, base: number) => `${v >= base ? '+' : ''}${Math.round((v / base - 1) * 100)}%`;
  const how = !next ? 'He is at the top of the ladder. The job now is keeping him there.'
    : tree ? `Finish Level ${i + 1} of his archetype tree${LEVEL_OVR[(i + 1) as 1 | 2 | 3] ? ` (opens at ${LEVEL_OVR[(i + 1) as 1 | 2 | 3]} OVR)` : ''}${next === 'X-Factor' ? ', both Level 3 trees,' : ''} to become a ${next}.${next !== 'X-Factor' ? ` Players who reach 86 OVR also have a 30% chance to move up each offseason.` : ''}`
    : `${next !== 'X-Factor' ? 'Reach 86 OVR for a 30% chance each offseason to move up a tier.' : 'X-Factor is earned through an archetype tree; this position does not have one.'}`;
  return (
    <div className="dvt" style={{ '--dc': COLOR[p.dev] } as CSSProperties}>
      <div className="dvt-hero">
        <div className="dvt-emblem"><DevIcon d={p.dev} size={92} /></div>
        <div className="dvt-id"><span className="up">Development trait</span><b>{p.dev}</b><p>{TAG[p.dev]}</p></div>
      </div>

      <div className="dvt-ladder">{ORDER.map((d, k) => (
        <div key={d} className={`dvt-step${k === i ? ' on' : k < i ? ' done' : ''}`} style={{ '--sc': COLOR[d] } as CSSProperties}>
          <DevIcon d={d} size={38} /><b>{d}</b>
          <span>{k === 0 ? 'Base' : tree ? `Archetype Level ${k}${k === 3 ? ' · both trees' : ''}` : k === 3 ? 'Archetype only' : '86+ OVR chance'}</span>
          {k > 0 && (k <= i ? <i className="ok">Earned</i> : tree ? <i className={levelDone(p, k as 1 | 2 | 3) ? 'ok' : ''}>{levelDone(p, k as 1 | 2 | 3) ? 'Tree complete' : 'Locked'}</i> : <i>Locked</i>)}
        </div>
      ))}</div>

      <div className="dvt-grid">
        <div className="dvt-card">
          <h4>What it does</h4>
          {([
            ['Practice and game XP', `×${DEV_MULT[p.dev].toFixed(2)}`, pct(DEV_MULT[p.dev], DEV_MULT.Star), 'vs Star'],
            ['Offseason growth', `×${GROWTH[p.dev].toFixed(2)}`, pct(GROWTH[p.dev], GROWTH.Star), 'vs Star'],
            ['Ceiling (potential room)', `×${CEIL[p.dev].toFixed(2)}`, pct(CEIL[p.dev], CEIL.Star), 'vs Star'],
            ['Superstar abilities', p.dev === 'X-Factor' ? '3 + X-Factor' : p.dev === 'Superstar' ? '2' : 'None', '', ''],
          ] as const).map(([k, v, d, vs]) => (
            <div key={k} className="dvt-row"><span>{k}</span><b>{v}</b>{d && <em className={d.startsWith('+') ? 'up' : d === '+0%' ? '' : 'dn'}>{d} <small>{vs}</small></em>}</div>
          ))}
        </div>
        <div className="dvt-card">
          <h4>{next ? `Path to ${next}` : 'Holding the crown'}</h4>
          <p>{how}</p>
          <h4 style={{ marginTop: 14 }}>Risk</h4>
          <p>{p.dev === 'Normal' ? 'Nothing to lose.' : `After age ${end + 1} (his position's peak) a ${p.dev} has a 25% chance each offseason to slip a tier.`}{p.age > end + 1 && p.dev !== 'Normal' ? <b className="dvt-warn"> He is past it now.</b> : ''}</p>
        </div>
        <div className="dvt-card">
          <h4>Abilities</h4>
          {p.abil.length || p.xf ? <>
            {p.xf && <div className="dvt-ab xf"><DevIcon d="X-Factor" size={22} /><div><b>{p.xf}</b><span>X-Factor zone ability: switches on after a big play and takes over the next stretch.</span></div></div>}
            {p.abil.map(a => <div key={a} className="dvt-ab"><DevIcon d="Superstar" size={22} /><div><b>{a}</b><span>{ABILITIES[a]?.desc ?? ''}</span></div></div>)}
          </> : <p className="mute">{p.dev === 'Star' ? 'Stars do not carry abilities. Superstars carry two.' : 'Normal players do not carry abilities.'}</p>}
        </div>
        <div className="dvt-card">
          <h4>Across the league</h4>
          {ORDER.map((d, k) => (
            <div key={d} className="dvt-bar"><DevIcon d={d} size={18} /><span>{d}</span><div><i style={{ width: `${(counts[k] / total) * 100}%`, background: COLOR[d] }} /></div><b>{counts[k]}</b><em>{((counts[k] / total) * 100).toFixed(1)}%</em></div>
          ))}
          <div className="small mute" style={{ marginTop: 8 }}>{p.team && L.teams[p.team] ? <>On the <span style={{ color: vivid(L.teams[p.team].colors[0]) }}>{L.teams[p.team].nick}</span>: {Object.values(L.players).filter(x => x.team === p.team && x.status === 'ACT' && x.dev !== 'Normal').length} players with a dev trait.</> : ''}</div>
        </div>
      </div>
    </div>
  );
}
