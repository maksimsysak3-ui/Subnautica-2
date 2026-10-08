// Last line of defence: a render error anywhere used to unmount the whole app and
// leave a blank screen. This catches it, shows what broke, and offers a way out.
import { Component, type ReactNode } from 'react';
import { app, saveLeague } from './store';

export class CrashGuard extends Component<{ children: ReactNode; inline?: boolean }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error('[crash]', err); }
  reset = (to?: 'hub' | 'menu') => { if (to) app.replace({ id: to }); this.setState({ err: null }); };
  render() {
    const e = this.state.err;
    if (!e) return this.props.children;
    const L = app.league;
    return (
      <div className={this.props.inline ? 'crash inline' : 'crash'}>
        <div className="card">
          <div className="h2">Something broke on this screen</div>
          <p className="dim">Your franchise is still in memory. Go back to the hub and keep playing; copy the error below and send it over so it can be fixed.</p>
          <pre>{e.message}{'\n'}{(e.stack ?? '').split('\n').slice(1, 6).join('\n')}</pre>
          <div className="row">
            {L && <button className="btn primary" onClick={() => this.reset('hub')}>Back to Hub</button>}
            {L && <button className="btn" onClick={async () => { const ok = await saveLeague(L); app.toast(ok ? 'Franchise saved' : 'Save failed'); }}>Save Franchise</button>}
            <button className="btn ghost" onClick={() => this.reset('menu')}>Main Menu</button>
          </div>
        </div>
      </div>
    );
  }
}
