import { useEffect } from 'react';
import { app, saveLeague, useApp, type Screen } from './store';
import { Logo, useTeamTheme } from './components';
import { capSpace, money } from '../core/contracts';

import { standings, userGame, weekGames, advance, ROUND_NAME } from '../core/season';
import { NewFranchise, LoadScreen } from './screens/menu';
import { MainMenu } from './screens/title';
import { BottomLine, leagueCrawl } from './ticker';
import { Hub } from './screens/hub';
import { RosterScreen, PlayerScreen, TeamScreen } from './screens/team';
import { DepthScreen } from './screens/lineup';
import { ScheduleScreen, StandingsScreen, StatsScreen, NewsScreen, BoxScreen, HistoryScreen, InboxScreen } from './screens/league';
import { FreeAgencyScreen, ResignScreen, CapScreen, CoachScreen, PlanScreen } from './screens/office';
import { TradeScreen, TradeBlock, TradeFinder, TradeOffers, TradeHistory, PickChart } from './screens/trades';
import { TeamStatsScreen, LeagueTeamStats, PowerRankings, ProgressionScreen } from './screens/teamstats';
import { DraftScreen } from './screens/draft';
import { AwardsScreen } from './screens/awards';
import { InjuryScreen } from './screens/injuries';
import { GameScreen } from './screens/game';
import { MatchupPreview } from './screens/preview';
import { GamedayScreen, OptionsScreen } from './screens/gameday';
import { gmName } from './actions';
import { CrashGuard } from './crash';

type Id = Screen['id'];
/** Big tabs across the top; each owns a rail of smaller tabs down the side. */
export const TABS: { label: string; subs: [Id, string][] }[] = [
  { label: 'Gameday', subs: [['gameday', 'Matchup'], ['plan', 'Game Plan'], ['schedule', 'Schedule']] },
  { label: 'Weekly Hub', subs: [['hub', 'Weekly Hub'], ['inbox', 'Inbox'], ['news', 'News Center']] },
  { label: 'Manage Roster', subs: [['roster', 'Roster'], ['depth', 'Depth Chart'], ['trade', 'Trade Center'], ['block', 'Trade Block'], ['finder', 'Trade Finder'], ['offers', 'Offers'], ['resign', 'Re-sign'], ['cap', 'Salary Cap'], ['fa', 'Free Agency'], ['draft', 'Draft Room'], ['scouting', 'Scouting']] },
  { label: 'Coach Central', subs: [['coach', 'Coach Tree'], ['progress', 'Progression'], ['teamstats', 'Team Stats']] },
  { label: 'League', subs: [['standings', 'Standings'], ['injuries', 'Injury Report'], ['stats', 'Player Stats'], ['lgteamstats', 'Team Stats'], ['power', 'Power Rankings'], ['awards', 'Awards'], ['tradehist', 'Transactions'], ['chart', 'Pick Value'], ['history', 'History']] },
  { label: 'Options', subs: [['options', 'Options']] },
];
/** Screens that take the whole width: the side rail becomes a strip of tabs above them. */
const FULL = new Set<Id>(['depth', 'trade']);

const tabOf = (id: Id) => TABS.findIndex(t => t.subs.some(([s]) => s === id));

export function App() {
  const s = useApp();
  const L = s.league;
  useTeamTheme(L);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.key === 'Backspace' || e.key === 'Escape') && !['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && !document.querySelector('.modal-bg')) app.backTo(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const sc = s.screen;
  const overlay = <>{s.toast && <div className="toast">{s.toast}</div>}{s.busy && <Busy label={s.busy} />}</>;
  if (sc.id === 'new') return <><div className="backdrop" /><NewFranchise />{overlay}</>;
  if (sc.id === 'load') return <><div className="backdrop" /><LoadScreen />{overlay}</>;
  if (!L || sc.id === 'menu') return <><div className="backdrop" /><MainMenu />{overlay}</>;
  if (sc.id === 'game') return <><div className="backdrop" /><GameScreen gid={sc.gid} />{overlay}</>;
  if (sc.id === 'preview') return <><CrashGuard><MatchupPreview gid={sc.gid} /></CrashGuard>{overlay}</>;
  // Detail screens keep the tab they were opened from highlighted.
  const ti = tabOf(sc.id);
  const tab = ti >= 0 ? ti : (s.back.map(b => tabOf(b.id)).reverse().find(i => i >= 0) ?? 0);
  const unread = L.inbox.filter(m => !m.read).length;
  const offers = L.inbox.filter(m => m.action?.kind === 'trade').length;
  return (
    <>
      <div className="backdrop" />
      <img className="bg-mark" src={L.teams[L.user].logo} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
      <Masthead><TabBar tab={tab} unread={unread} offers={offers} /></Masthead>
      <div className={`workspace${FULL.has(sc.id) ? ' full' : ''}`}>
        <aside className={`subtabs${FULL.has(sc.id) ? ' h' : ''}`}>
          {TABS[tab].subs.map(([id, label]) => (
            <button key={id} className={`subtab${sc.id === id ? ' on' : ''}`} onClick={() => app.go({ id } as Screen)}>
              {label}{id === 'inbox' && unread > 0 && <span className="badge">{unread}</span>}{id === 'offers' && offers > 0 && <span className="badge">{offers}</span>}
            </button>
          ))}
          <WeekLine />
        </aside>
        <main className="main fade-in" key={JSON.stringify(sc)}><CrashGuard inline><Route sc={sc} /></CrashGuard></main>
      </div>
      <BottomLine tag="News Center" items={leagueCrawl(L)} right={<NextGame />} hints={<><span><kbd>Q</kbd><kbd>E</kbd>Tabs</span><span><kbd>Enter</kbd>Select</span><span><kbd>X</kbd>Delegate</span><span><kbd>Esc</kbd>Back</span><span className="spacer" /><span>{gmName(L)} · General Manager</span></>} />
      {overlay}
    </>
  );
}

/** Top tabs with an underline that glides to the active tab. */
/** Under the tabs: where the season is and who is next. */
function WeekLine() {
  const L = useApp().league!;
  const g = (L.phase === 'regular' || L.phase === 'playoffs') ? userGame(L) : undefined;
  const opp = g ? L.teams[g.home === L.user ? g.away : g.home] : undefined;
  const st = standings(L);
  return (
    <div className="weekline">
      <span>{L.season} · {L.phase === 'regular' ? `Week ${L.week}` : L.phase === 'playoffs' ? ROUND_NAME[L.week] : phaseLabel(L).replace(`${L.season} `, '')}</span>
      {opp && <><Logo team={L.teams[L.user]} size={22} /><Logo team={opp} size={22} /><b>{g!.home === L.user ? 'vs' : '@'} {opp.nick} ({st[opp.abbr].w}-{st[opp.abbr].l}-{st[opp.abbr].t})</b></>}
    </div>
  );
}
function NextGame() {
  const L = useApp().league!;
  const g = (L.phase === 'regular' || L.phase === 'playoffs') ? userGame(L) : undefined;
  if (!g) return <span className="bl-when">{phaseLabel(L)}</span>;
  return <><Logo team={L.teams[g.away]} size={28} /><span className="bl-when"><b>{g.day ?? 'Sun'}</b>{g.result ? `Final ${g.result.as}-${g.result.hs}` : g.time}</span><Logo team={L.teams[g.home]} size={28} /></>;
}

/** The five tabs. Q and E cycle them, the way LB/RB do on a controller. */
function TabBar({ tab, unread, offers }: { tab: number; unread: number; offers: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const d = e.key === 'q' || e.key === 'Q' ? -1 : e.key === 'e' || e.key === 'E' ? 1 : 0;
      if (d) app.go({ id: TABS[(tab + d + TABS.length) % TABS.length].subs[0][0] } as Screen);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [tab]);
  return (
    <nav className="bigtabs">
      <span className="keycap" title="Previous tab">Q</span>
      {TABS.map((t, i) => (
        <button key={t.label} className={`bigtab${i === tab ? ' on' : ''}`} onClick={() => app.go({ id: t.subs[0][0] } as Screen)}>
          {t.label}{i === 0 && unread > 0 && <span className="n">{unread}</span>}{t.label === 'Trades' && offers > 0 && <span className="n">{offers}</span>}
        </button>
      ))}
      <span className="keycap" title="Next tab">E</span>
    </nav>
  );
}

function Route({ sc }: { sc: Screen }) {
  switch (sc.id) {
    case 'hub': return <Hub />;
    case 'gameday': return <GamedayScreen />;
    case 'options': return <OptionsScreen />;
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
    case 'awards': return <AwardsScreen />;
    case 'injuries': return <InjuryScreen />;
    case 'box': return <BoxScreen gid={sc.gid} />;
    case 'trade': return <TradeScreen team={sc.team} want={sc.want} />;
    case 'block': return <TradeBlock />;
    case 'finder': return <TradeFinder />;
    case 'offers': return <TradeOffers />;
    case 'tradehist': return <TradeHistory />;
    case 'chart': return <PickChart />;
    case 'fa': return <FreeAgencyScreen />;
    case 'resign': return <ResignScreen />;
    case 'draft': return <DraftScreen />;
    case 'scouting': return <DraftScreen scouting />;
    case 'coach': return <CoachScreen />;
    case 'cap': return <CapScreen />;
    case 'teamstats': return <TeamStatsScreen />;
    case 'lgteamstats': return <LeagueTeamStats />;
    case 'power': return <PowerRankings />;
    case 'progress': return <ProgressionScreen />;
    default: return <Hub />;
  }
}

export function phaseLabel(L: NonNullable<ReturnType<typeof useApp>['league']>) {
  switch (L.phase) {
    case 'preseason': return `${L.season} Preseason`;
    case 'regular': return `${L.season} Regular Season · Week ${L.week}`;
    case 'playoffs': return `${L.season} Playoffs · ${ROUND_NAME[L.week]}`;
    case 'resign': return `${L.season} Offseason · Re-sign Players`;
    case 'freeagency': return `${L.season} Free Agency · Day ${L.fa?.day ?? 1}`;
    case 'draft': return `${L.season} NFL Draft`;
    case 'camp': return `${L.season} Training Camp`;
  }
}

function Masthead({ children }: { children?: React.ReactNode }) {
  const { league: L } = useApp();
  if (!L) return null;
  const t = L.teams[L.user];
  const st = standings(L)[L.user];
  const div = Object.values(standings(L)).filter(x => L.teams[x.abbr].div === t.div && L.teams[x.abbr].conf === t.conf).sort((a, b) => b.pct - a.pct || b.w - a.w).findIndex(x => x.abbr === L.user) + 1;
  return (
    <header className="masthead" style={{ '--tc': t.colors[0] } as React.CSSProperties}>
      <div className="who">
        <div className="mh-logo"><Logo team={t} size={44} /></div>
        <div><div className="name">{t.nick}</div><div className="meta">{phaseLabel(L)}</div></div>
      </div>
      {children}
      <div className="spacer" />
      <span className="mh-pill" title="Coach points">{L.coachTree.points}<i>CP</i></span>
      <span className="mh-pill" title="Active roster">{Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT').length}/53</span>
      <span className="mh-pill" title="Cap space"><b className={capSpace(L, L.user) < 0 ? 'bad' : ''}>{money(capSpace(L, L.user))}</b></span>
      <span className="mh-coach"><b>{L.coachTree.level}</b><span>{t.coach.name}<i>{st.w}-{st.l}{st.t ? `-${st.t}` : ''} · {div ? `${div}${['', 'st', 'nd', 'rd', 'th'][div]} ${t.conf} ${t.div}` : ''}</i></span></span>
      <AdvanceButton />
    </header>
  );
}

export function AdvanceButton({ big }: { big?: boolean }) {
  const { league: L } = useApp();
  if (!L) return null;
  if (L.fired) return <button className="btn danger" onClick={() => app.go({ id: 'menu' })}>Fired · Start Over</button>;
  const ug = (L.phase === 'regular' || L.phase === 'playoffs') ? userGame(L) : undefined;
  const cls = `btn primary${big ? ' big' : ''}`;
  const run = (label: string, f: () => Promise<void>) => app.busy(label, async () => { await f(); await saveLeague(L, `${L.id}-auto`); app.touch(); });
  switch (L.phase) {
    case 'preseason': {
      const act = Object.values(L.players).filter(p => p.team === L.user && p.status === 'ACT').length;
      return <button className={cls} onClick={() => run('Kicking off the season', () => advance(L))}>{act > 53 ? `Cut to 53 (${act}) & Start` : 'Start Season'}</button>;
    }
    case 'regular': case 'playoffs': {
      if (ug && !ug.result) return (
        <div className="row" style={{ gap: 6 }}>
          <button className={cls} onClick={() => app.go({ id: 'gameday' })}>Play {ug.home === L.user ? 'vs' : '@'} {L.teams[ug.home === L.user ? ug.away : ug.home].abbr}</button>
          <button className="btn" onClick={() => run('Simulating the week', async () => { await advance(L); })}>Sim Week</button>
        </div>
      );
      const pending = weekGames(L).some(g => !g.result);
      return <button className={cls} onClick={() => run(pending ? 'Simulating' : 'Advancing', () => advance(L))}>{L.phase === 'playoffs' && !ug ? (L.week === 22 ? 'Sim Super Bowl' : 'Sim Playoff Round') : 'Advance Week'}</button>;
    }
    case 'resign': return <button className={cls} onClick={() => run('Opening free agency', () => advance(L))}>Open Free Agency</button>;
    case 'freeagency': return <button className={cls} onClick={() => run('Free agency day', () => advance(L))}>{(L.fa?.day ?? 1) >= 8 ? 'To the Draft' : `Next FA Day (${L.fa?.day}/8)`}</button>;
    case 'draft': return L.draft?.done ? <button className={cls} onClick={() => run('Opening training camp', () => advance(L))}>Training Camp</button> : <button className={cls} onClick={() => app.go({ id: 'draft' })}>Enter Draft Room</button>;
    case 'camp': return <button className={cls} onClick={() => run('Final cuts', () => advance(L))}>Final Cuts</button>;
  }
}

function Busy({ label }: { label: string }) {
  return <div className="busy"><div style={{ textAlign: 'center' }}><div className="spin" /><div className="h3">{label}</div></div></div>;
}
