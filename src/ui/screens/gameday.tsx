// Gameday tab: this week's matchup (the pregame show), or the phase banner when
// there is no game. Options tab: save, load, settings, controls.
import { useState } from 'react';
import { useApp, app, saveLeague } from '../store';
import { userGame } from '../../core/season';
import { MatchupPreview } from './preview';
import { GameDay } from './hub';
import { aiKey, setAiKey, MODEL } from '../presserAi';

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
      </div>
      <AiCard />
      <div className="card">
        <h3>Controls</h3>
        {[['Q / E', 'Previous / next tab'], ['← →', 'Move between action cards'], ['↑ ↓', 'Move through tables'], ['Enter', 'Select'], ['X', 'Delegate to staff'], ['Esc', 'Back']].map(([k, v]) => <div key={k} className="li" style={{ cursor: 'default', justifyContent: 'space-between' }}><kbd className="keycap">{k}</kbd><span>{v}</span></div>)}
      </div>
    </div>
  );
}

/** Optional Claude-powered press conferences, with the player's own API key. */
function AiCard() {
  const [k, setK] = useState(aiKey());
  const [show, setShow] = useState(false);
  const on = !!aiKey();
  return (
    <div className="card">
      <h3>Press Conference AI</h3>
      <div className="small dim" style={{ marginBottom: 10 }}>Post-game press conferences work offline. Add your own Anthropic API key and Claude ({MODEL}) writes the questions from the game and judges your answers instead.</div>
      <div className="row">
        <input className="input" style={{ flex: 1 }} type={show ? 'text' : 'password'} value={k} placeholder="sk-ant-…" autoComplete="off" spellCheck={false} onChange={e => setK(e.target.value)} />
        <button className="btn" onClick={() => setShow(x => !x)}>{show ? 'Hide' : 'Show'}</button>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={!k.trim() || k.trim() === aiKey()} onClick={() => { setAiKey(k); app.toast('Claude will run your press conferences'); }}>Save Key</button>
        {on && <button className="btn" onClick={() => { setAiKey(''); setK(''); app.toast('Back to the offline press room'); }}>Remove</button>}
        <span className="small mute">{on ? 'Claude: on' : 'Offline'}</span>
      </div>
      <div className="small mute" style={{ marginTop: 8 }}>The key is kept only in this browser and sent only to api.anthropic.com. Usage is billed to your Anthropic account.</div>
    </div>
  );
}
