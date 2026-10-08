// Gameday tab: this week's matchup (the pregame show), or the phase banner when
// there is no game. Options tab: save, load, settings, controls.
import { useApp, app, saveLeague } from '../store';
import { userGame } from '../../core/season';
import { autoSpend, setTeamAuto, hasTree, treeOf } from '../../core/archetypes';
import { MatchupPreview } from './preview';
import { GameDay } from './hub';

export function GamedayScreen() {
  const L = useApp().league!;
  const g = (L.phase === 'regular' || L.phase === 'playoffs') ? userGame(L) : undefined;
  if (g && !g.result) return <MatchupPreview gid={g.id} embedded />;
  return <GameDay L={L} />;
}

export function OptionsScreen() {
  const L = useApp().league!;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
      <div className="card">
        <h3>Franchise</h3>
        <div className="list">
          <div className="li" style={{ cursor: 'default', justifyContent: 'space-between' }}><span className="up">League</span><b>{L.name}</b></div>
          <div className="li" style={{ cursor: 'default', justifyContent: 'space-between' }}><span className="up">General Manager</span><b>{L.gm}</b></div>
          <div className="li" style={{ cursor: 'default', justifyContent: 'space-between' }}><span className="up">Season</span><b>{L.season}</b></div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={async () => { const ok = await saveLeague(L); app.toast(ok ? 'Franchise saved' : 'Save failed'); }}>Save Franchise</button>
          <button className="btn" onClick={() => app.go({ id: 'load' })}>Load</button>
          <button className="btn" onClick={() => app.go({ id: 'menu' })}>Main Menu</button>
          <button className="btn" onClick={() => app.go({ id: 'coachcreate' })}>Edit Coach</button>
        </div>
      </div>
      <div className="card">
        <h3>Settings</h3>
        <div className="small dim" style={{ marginBottom: 10 }}>Injury frequency</div>
        <div className="row">{(['Low', 'Normal', 'Realistic'] as const).map(k => <span key={k} className={`chip${(L.injuryLevel ?? 'Normal') === k ? ' on' : ''}`} onClick={() => { L.injuryLevel = k; app.touch(); }}>{k}</span>)}</div>
        <div className="small mute" style={{ marginTop: 8 }}>For the full slider with its effect on current injuries, open League · Injury Report.</div>
        <div className="small dim" style={{ margin: '16px 0 8px' }}>Archetype skill points</div>
        <div className="row">
          {([['Manual', false], ['Auto-Spend', true]] as const).map(([k, v]) => <span key={k} className={`chip${!!(L as typeof L & { autoSkill?: boolean }).autoSkill === v ? ' on' : ''}`} onClick={() => { setTeamAuto(L, v); app.touch(); }}>{k}</span>)}
          <button className="btn sm" onClick={() => {
            let n = 0, players = 0;
            for (const p of Object.values(L.players)) if (p.team === L.user && hasTree(p.pos) && (treeOf(p)?.sp ?? 0) > 0) { const r = autoSpend(L, p); if (r.bought.length) { n += r.bought.length; players++; } }
            app.toast(n ? `${n} upgrades bought for ${players} players` : 'Nothing to spend right now'); app.touch();
          }}>Spend All Now</button>
        </div>
        <div className="small mute" style={{ marginTop: 8 }}>Auto-Spend buys upgrades in tree order as players earn points: Level 1, then Level 2, then both Level 3 trees. You can also switch it on per player on his Archetype tab.</div>
      </div>
      <div className="card">
        <h3>Controls</h3>
        {[['Q / E', 'Previous / next tab'], ['← →', 'Move between action cards'], ['↑ ↓', 'Move through tables'], ['Enter', 'Select'], ['X', 'Delegate to staff'], ['Esc', 'Back']].map(([k, v]) => <div key={k} className="li" style={{ cursor: 'default', justifyContent: 'space-between' }}><kbd className="keycap">{k}</kbd><span>{v}</span></div>)}
      </div>
    </div>
  );
}
