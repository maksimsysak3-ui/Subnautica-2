// Facilities: an aerial view of the team campus. Each building is a facility; it grows
// with its level and lights up in team colours. Select one to see what it does now, what
// the next level adds, and what it costs out of the owner's facilities budget.
import { useState, type CSSProperties } from 'react';
import { useApp, app } from '../store';
import { vivid } from '../components';
import { FACILITIES, facility, facilityState, upgrade, upgradeCost, type FacilityId } from '../../core/facilities';

// Footprints on the 1000 x 560 campus map: x, y, width, depth.
const SPOT: Record<FacilityId, [number, number, number, number]> = {
  stadium: [70, 120, 330, 250], training: [520, 70, 170, 90], strength: [720, 80, 130, 80],
  film: [560, 250, 150, 90], medical: [760, 250, 140, 100], scouting: [470, 420, 130, 70],
};

export function FacilitiesScreen() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const s = facilityState(L);
  const [sel, setSel] = useState<FacilityId>('stadium');
  const c1 = vivid(me.colors[0]), c2 = me.colors[1] ?? '#ffffff';
  const f = FACILITIES.find(x => x.id === sel)!, lvl = facility(L, L.user, sel);
  const total = FACILITIES.reduce((a, x) => a + facility(L, L.user, x.id), 0);
  const rank = Object.keys(L.teams).map(t => ({ t, v: FACILITIES.reduce((a, x) => a + facility(L, t, x.id), 0) })).sort((a, b) => b.v - a.v).findIndex(x => x.t === L.user) + 1;
  const cost = lvl < 5 ? upgradeCost(lvl) : 0;
  return (
    <div className="fc" style={{ '--tc': c1, '--t2': c2 } as CSSProperties}>
      <div className="fc-head">
        <div><span className="up">{me.name} · Team campus</span><div className="h1">Facilities</div><p>Better buildings mean faster development, quicker recoveries, a louder stadium and sharper game plans. Level 3 is league average.</p></div>
        <div className="fc-stats">
          <div><b>${(s.funds / 1e6).toFixed(0)}M</b><span>Facilities budget</span></div>
          <div><b>{total}<i>/30</i></b><span>Campus rating</span></div>
          <div><b>#{rank}</b><span>In the league</span></div>
        </div>
      </div>
      <div className="fc-body">
        <div className="fc-map">
          <svg viewBox="0 0 1000 560" width="100%">
            <defs>
              <linearGradient id="fc-grass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d3a26" /><stop offset="1" stopColor="#0f2016" /></linearGradient>
              <pattern id="fc-mow" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="20" height="40" fill="#fff" opacity=".025" /></pattern>
              <radialGradient id="fc-light" cx=".35" cy=".3" r=".9"><stop offset="0" stopColor="#fff" stopOpacity=".1" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></radialGradient>
            </defs>
            <rect width="1000" height="560" fill="url(#fc-grass)" />
            <rect width="1000" height="560" fill="url(#fc-mow)" />
            {/* Roads and parking. */}
            <path d="M0 400 L1000 400 M440 0 L440 560 M440 220 L1000 220" stroke="#2c3138" strokeWidth="22" />
            <path d="M0 400 L1000 400 M440 0 L440 560 M440 220 L1000 220" stroke="#e8c25a" strokeWidth="1.5" strokeDasharray="14 12" opacity=".5" />
            {[0, 1, 2, 3].map(r => <rect key={r} x={30 + r * 92} y={430} width="80" height="100" rx="3" fill="#1e2228" stroke="#3a4048" strokeDasharray="4 4" />)}
            <rect x="660" y="420" width="300" height="110" rx="4" fill="#1e2228" />
            {FACILITIES.map(x => {
              const [bx, by, w, d] = SPOT[x.id], l = facility(L, L.user, x.id), on = sel === x.id, h = 6 + l * 7;
              return (
                <g key={x.id} className={`fc-b${on ? ' on' : ''}`} onClick={() => setSel(x.id)}>
                  {x.id === 'stadium' ? <>
                    <ellipse cx={bx + w / 2 + 8} cy={by + d / 2 + h} rx={w / 2} ry={d / 2} fill="#000" opacity=".45" />
                    <ellipse cx={bx + w / 2} cy={by + d / 2 + h * 0.5} rx={w / 2} ry={d / 2} fill="#2a2f37" />
                    <ellipse cx={bx + w / 2} cy={by + d / 2} rx={w / 2} ry={d / 2} fill={c1} />
                    <ellipse cx={bx + w / 2} cy={by + d / 2} rx={w / 2} ry={d / 2} fill="url(#fc-light)" />
                    <ellipse cx={bx + w / 2} cy={by + d / 2} rx={w / 2 - 34} ry={d / 2 - 30} fill="#14171d" />
                    <rect x={bx + w / 2 - 92} y={by + d / 2 - 46} width="184" height="92" rx="6" fill="#2f7d3c" />
                    {[...Array(9)].map((_, k) => <rect key={k} x={bx + w / 2 - 80 + k * 20} y={by + d / 2 - 46} width="1.5" height="92" fill="#fff" opacity=".5" />)}
                    {l >= 4 && <rect x={bx + w / 2 - 30} y={by + 14} width="60" height="16" rx="2" fill="#0b0d12" stroke={c2} />}
                  </> : <>
                    <rect x={bx + 10} y={by + h + 6} width={w} height={d} fill="#000" opacity=".45" rx="3" />
                    <rect x={bx} y={by + h} width={w} height={d} fill="#262b33" rx="3" />
                    <rect x={bx} y={by} width={w} height={d} fill={c1} rx="3" />
                    <rect x={bx} y={by} width={w} height={d} fill="url(#fc-light)" rx="3" />
                    {[...Array(Math.floor(w / 26))].map((_, k) => <rect key={k} x={bx + 10 + k * 26} y={by + d - 18} width="14" height="8" fill="#ffe9a6" opacity={0.25 + l * 0.12} />)}
                    {x.id === 'medical' && <path d={`M${bx + w / 2 - 6} ${by + 18} h12 v12 h12 v12 h-12 v12 h-12 v-12 h-12 v-12 h12 z`} fill="#fff" />}
                    {x.id === 'training' && <rect x={bx - 10} y={by + d + h + 14} width={w + 30} height="56" fill="#2f7d3c" stroke="#fff" strokeOpacity=".5" />}
                  </>}
                  <g transform={`translate(${bx + w / 2} ${by - 14})`}>
                    <rect x="-72" y="-16" width="144" height="26" rx="13" fill="#0b0d12" opacity=".85" stroke={on ? '#ffd34d' : 'rgba(255,255,255,.2)'} />
                    <text x="0" y="1" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#fff" letterSpacing="1">{x.name.toUpperCase()}</text>
                  </g>
                  <g transform={`translate(${bx + w / 2 - 28} ${by + (x.id === 'stadium' ? d + h + 14 : d + h + 8)})`}>{[0, 1, 2, 3, 4].map(k => <rect key={k} x={k * 12} y="0" width="9" height="9" rx="2" fill={k < l ? '#ffd34d' : 'rgba(255,255,255,.18)'} />)}</g>
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="fc-detail">
          <span className="ak">Level {lvl} of 5</span>
          <div className="h2">{f.name}</div>
          <div className="fc-pips">{[1, 2, 3, 4, 5].map(k => <i key={k} className={k <= lvl ? 'on' : ''} />)}</div>
          <p>{f.blurb}</p>
          <div className="fc-eff"><span>Now</span><b>{f.effect(lvl)}</b></div>
          {lvl < 5 && <div className="fc-eff next"><span>At level {lvl + 1}</span><b>{f.effect(lvl + 1)}</b></div>}
          {lvl < 5
            ? <button className="btn primary big" disabled={cost > s.funds} onClick={() => { const r = upgrade(L, sel); app.toast(r.ok ? `${f.name} upgraded to level ${lvl + 1}` : r.reason); app.touch(); }}>{cost > s.funds ? `Need $${(cost / 1e6).toFixed(0)}M` : `Upgrade · $${(cost / 1e6).toFixed(0)}M`}</button>
            : <div className="fc-max">State of the art</div>}
          <div className="small mute">The owner adds to the budget every offseason: more for wins, happy fans and his trust in you.</div>
        </aside>
      </div>
      <div className="fc-list">{FACILITIES.map(x => { const l = facility(L, L.user, x.id); return (
        <button key={x.id} className={`fc-row${sel === x.id ? ' on' : ''}`} onClick={() => setSel(x.id)}><b>{x.name}</b><span className="fc-pips sm">{[1, 2, 3, 4, 5].map(k => <i key={k} className={k <= l ? 'on' : ''} />)}</span><em>{x.effect(l)}</em></button>
      ); })}</div>
    </div>
  );
}
