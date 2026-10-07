import { useEffect } from 'react';
import { app, saveLeague, useApp, type Screen } from './store';
import { Logo, useTeamTheme, CountUp } from './components';
import { capSpace, money } from '../core/contracts';
import { standings, userGame, weekGames, advance, ROUND_NAME } from '../core/season';
import { MainMenu, NewFranchise, LoadScreen } from './screens/menu';
import { Hub } from './screens/hub';
import { RosterScreen, PlayerScreen, DepthScreen, TeamScreen } from './screens/team';
import { ScheduleScreen, StandingsScreen, StatsScreen, NewsScreen, BoxScreen, HistoryScreen, InboxScreen } from './screens/league';
import { TradeScreen, FreeAgencyScreen, ResignScreen, CapScreen, CoachScreen, PlanScreen } from './screens/office';
import { DraftScreen } from './screens/draft';
import { GameScreen } from './screens/game';

const NAV: { id: Screen['id']; label: string; ic: string; sec?: string }[] = [
  { id: 'hub', label: 'Home', ic: '⌂', sec: 'Franchise' }, { id: 'inbox', label: 'Inbox', ic: '✉' }, { id: 'roster', label: 'Roster', ic: '☰' }, { id: 'depth', label: 'Depth Chart', ic: '⇅' },
  { id: 'plan', label: 'Weekly Strategy', ic: '◎' }, { id: 'coach', label: 'Coach Abilities', ic: '✦' },
  { id: 'trade', label: 'Trade Center', ic: '⇄', sec: 'Front Office' }, { id: 'fa', label: 'Free Agency', ic: '✍' }, { id: 'resign', label: 'Re-sign Players', ic: '↺' }, { id: 'draft', label: 'Draft Room', ic: '◆' }, { id: 'cap', label: 'Salary Cap', ic: '$' },
  { id: 'schedule', label: 'Schedule', ic: '▦', sec: 'League' }, { id: 'standings', label: 'Standings', ic: '≡' }, { id: 'stats', label: 'Stats & Leaders', ic: '▲' }, { id: 'news', label: 'News', ic: '✎' }, { id: 'history', label: 'History & Awards', ic: '♛' },
];

export function App() {
  const s = useApp();
  const L = s.league;
  useTeamTheme(L);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'INPUT') app.backTo(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const sc = s.screen;
  let body;
  if (!L || sc.id === 'menu') body = <MainMenu />;
  else body = null;
  if (sc.id === 'new') body = <NewFranchise />;
  if (sc.id === 'load') body = <LoadScreen />;
  if (body) return <><div className="backdrop" />{body}{s.toast && <div className="toast">{s.toast}</div>}{s.busy && <Busy label={s.busy} />}</>;
  if (sc.id === 'game') return <><div className="backdrop" /><GameScreen gid={sc.gid} />{s.busy && <Busy label={s.busy} />}</>;
  const unread = L!.inbox.filter(m => !m.read).length;
  return (
    <>
      <div className="backdrop" />
      <div className="shell">
        <aside className="side">
          <div className="brand"><Logo team={L!.teams[L!.user]} size={34} /><b>Gridiron<span> GM</span></b></div>
          {NAV.map(n => (
            <div key={n.id}>
              {n.sec && <div className="sec">{n.sec}</div>}
              <button className={`nav${sc.id === n.id ? ' on' : ''}`} onClick={() => app.go({ id: n.id } as Screen)}>
                <span className="ic">{n.ic}</span>{n.label}{n.id === 'inbox' && unread > 0 && <span className="badge">{unread}</span>}
              </button>
            </div>
          ))}
          <div className="sec">Game</div>
          <button className="nav" onClick={async () => { const ok = await saveLeague(L!); app.toast(ok ? 'Saved' : 'Save failed'); }}><span className="ic">⭳</span>Save</button>
          <button className="nav" onClick={() => app.go({ id: 'menu' })}><span className="ic">⏏</span>Main Menu</button>
        </aside>
        <main className="main fade-in" key={JSON.stringify(sc)}>
          <TopBar />
          <Route sc={sc} />
        </main>
      </div>
      {s.toast && <div className="toast">{s.toast}</div>}
      {s.busy && <Busy label={s.busy} />}
    </>
  );
}

function Route({ sc }: { sc: Screen }) {
  switch (sc.id) {
    case 'hub': return <Hub />;
    case 'roster': return <RosterScreen team={sc.team} />;
    case 'team': return <TeamScreen team={sc.team} />;
    case 'player': return <PlayerScreen pid={sc.pid} />;
    case 'depth': return <DepthScreen />;
    case 'plan': return <PlanScreen />;
    case 'schedule': return <ScheduleScreen />;
    case 'standings': return <StandingsScreen />;
    case 'stats': return <StatsScreen />;
    case 'news': return <NewsScreen />;
    case 'inbox': return <InboxScreen />;
    case 'history': return <HistoryScreen />;
    case 'box': return <BoxScreen gid={sc.gid} />;
    case 'trade': return <TradeScreen team={sc.team} want={sc.want} />;
    case 'fa': return <FreeAgencyScreen />;
    case 'resign': return <ResignScreen />;
    case 'draft': return <DraftScreen />;
    case 'coach': return <CoachScreen />;
    case 'cap': return <CapScreen />;
    default: return <Hub />;
  }
}

export function phaseLabel(L: NonNullable<ReturnType<typeof useApp>['league']>) {
  switch (L.phase) {
    case 'preseason': return `${L.season} Preseason`;
    case 'regular': return `${L.season} · Week ${L.week}`;
    case 'playoffs': return `${L.season} · ${ROUND_NAME[L.week]}`;
    case 'resign': return `${L.season} Offseason · Re-signing`;
    case 'freeagency': return `${L.season} Free Agency · Day ${L.fa?.day ?? 1}`;
    case 'draft': return `${L.season} NFL Draft`;
    case 'camp': return `${L.season} Training Camp`;
  }
}

function TopBar() {
  const { league: L } = useApp();
  if (!L) return null;
  const t = L.teams[L.user];
  const st = standings(L)[L.user];
  return (
    <div className="topbar">
      <div>
        <div className="sub">{phaseLabel(L)}</div>
        <div className="row" style={{ gap: 10 }}><span className="h3">{t.name}</span><span className="num dim">{st.w}-{st.l}{st.t ? `-${st.t}` : ''}</span></div>
      </div>
      <div className="spacer" />
      <div className="stat" style={{ textAlign: 'right' }}><span className="k">Cap Space</span><span className={`num ${capSpace(L, L.user) < 0 ? 'bad' : ''}`} style={{ fontSize: 20 }}><CountUp v={capSpace(L, L.user)} fmt={money} /></span></div>
      <AdvanceButton />
    </div>
  );
}

export function AdvanceButton({ big }: { big?: boolean }) {
  const { league: L } = useApp();
  if (!L) return null;
  if (L.fired) return <button className="btn danger" onClick={() => app.go({ id: 'menu' })}>Fired: start over</button>;
  const ug = (L.phase === 'regular' || L.phase === 'playoffs') ? userGame(L) : undefined;
  const cls = `btn primary${big ? ' big' : ''}`;
  const run = (label: string, f: () => Promise<void>) => app.busy(label, async () => { await f(); await saveLeague(L, `${L.id}-auto`); app.touch(); });
  switch (L.phase) {
    case 'preseason': {
      const act = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT').length;
      return <button className={cls} onClick={() => run('Kicking off the season…', () => advance(L))}>{act > 53 ? `Cut to 53 (${act}) & Start` : 'Start Season ▸'}</button>;
    }
    case 'regular': case 'playoffs': {
      if (ug && !ug.result) return (
        <div className="row">
          <button className={cls} onClick={() => app.go({ id: 'game', gid: ug.id })}>▶ Play {ug.home === L.user ? 'vs' : '@'} {L.teams[ug.home === L.user ? ug.away : ug.home].nick}</button>
          <button className="btn" onClick={() => run('Simulating the week…', async () => { await advance(L); })}>Sim Week</button>
        </div>
      );
      const pending = weekGames(L).some(g => !g.result);
      return <button className={cls} onClick={() => run(pending ? 'Simulating…' : 'Advancing…', () => advance(L))}>{L.phase === 'playoffs' && !ug ? (L.week === 22 ? 'Sim Super Bowl ▸' : 'Sim Playoff Round ▸') : 'Advance Week ▸'}</button>;
    }
    case 'resign': return <button className={cls} onClick={() => run('Opening free agency…', () => advance(L))}>Open Free Agency ▸</button>;
    case 'freeagency': return <button className={cls} onClick={() => run('Free agency day…', () => advance(L))}>{(L.fa?.day ?? 1) >= 8 ? 'To the Draft ▸' : `Next FA Day (${L.fa?.day}/8) ▸`}</button>;
    case 'draft': return L.draft?.done ? <button className={cls} onClick={() => run('Opening training camp…', () => advance(L))}>Training Camp ▸</button> : <button className={cls} onClick={() => app.go({ id: 'draft' })}>Enter Draft Room ▸</button>;
    case 'camp': return <button className={cls} onClick={() => run('Final cuts…', () => advance(L))}>Final Cuts & Preseason ▸</button>;
  }
}

function Busy({ label }: { label: string }) {
  return <div className="busy"><div style={{ textAlign: 'center' }}><div className="spin" /><div className="h3">{label}</div></div></div>;
}
