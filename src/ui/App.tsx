import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { app, saveLeague, useApp, type Screen } from './store';
import { Logo, useTeamTheme, CountUp } from './components';
import { capSpace, money } from '../core/contracts';
import { teamRatings } from '../core/league';
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
import { CrashGuard } from './crash';
import { Badge, Icon, type IconName } from './icons';

type Id = Screen['id'];
/** Big tabs across the top; each owns a rail of smaller tabs down the side. */
export const TABS: { label: string; subs: [Id, string][] }[] = [
  { label: 'Home', subs: [['hub', 'Overview'], ['inbox', 'Inbox'], ['news', 'League News'], ['plan', 'Weekly Strategy']] },
  { label: 'My Team', subs: [['roster', 'Roster'], ['depth', 'Lineup'], ['teamstats', 'Team Stats'], ['progress', 'Progression'], ['coach', 'Coach Abilities'], ['resign', 'Re-sign'], ['cap', 'Salary Cap']] },
  { label: 'Trades', subs: [['trade', 'Trade Builder'], ['block', 'Trade Block'], ['finder', 'Trade Finder'], ['offers', 'Offers'], ['tradehist', 'Trade History'], ['chart', 'Pick Value Chart']] },
  { label: 'Personnel', subs: [['fa', 'Free Agency'], ['draft', 'Draft Room'], ['scouting', 'Scouting']] },
  { label: 'League', subs: [['schedule', 'Schedule'], ['standings', 'Standings'], ['injuries', 'Injury Report'], ['stats', 'Player Stats'], ['lgteamstats', 'Team Stats'], ['power', 'Power Rankings'], ['awards', 'Awards'], ['history', 'History']] },
];
/** Screens that take the whole width: the side rail becomes a strip of tabs above them. */
const FULL = new Set<Id>(['depth', 'trade']);
const TAB_ICON: IconName[] = ['home', 'helmet', 'trade', 'contract', 'league'];
const SUB_ICON: Partial<Record<Id, IconName>> = {
  hub: 'home', inbox: 'inbox', news: 'news', plan: 'strategy', roster: 'roster', depth: 'lineup', teamstats: 'stats', progress: 'progress', coach: 'whistle', resign: 'sign', cap: 'cap',
  trade: 'trade', block: 'block', finder: 'finder', offers: 'offers', tradehist: 'history', chart: 'chart', fa: 'contract', draft: 'draft', scouting: 'scout',
  schedule: 'calendar', standings: 'standings', injuries: 'injury', stats: 'stats', lgteamstats: 'chart', power: 'power', awards: 'trophy', history: 'history',
};
const tabOf = (id: Id) => TABS.findIndex(t => t.subs.some(([s]) => s === id));

export function App() {
  const s = useApp();
  const L = s.league;
  useTeamTheme(L);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Backspace' && !['INPUT', 'SELECT'].includes((e.target as HTMLElement).tagName)) app.backTo(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const sc = s.screen;
  const overlay = <>{s.toast && <div className="toast">{s.toast}</div>}{s.busy && <Busy label={s.busy} />}</>;
  if (sc.id === 'new') return <><div className="backdrop" /><NewFranchise />{overlay}</>;
  if (sc.id === 'load') return <><div className="backdrop" /><LoadScreen />{overlay}</>;
  if (!L || sc.id === 'menu') return <><div className="backdrop" /><MainMenu />{overlay}</>;
  if (sc.id === 'game') return <><div className="backdrop" /><GameScreen gid={sc.gid} />{overlay}</>;
  // Detail screens keep the tab they were opened from highlighted.
  const ti = tabOf(sc.id);
  const tab = ti >= 0 ? ti : (s.back.map(b => tabOf(b.id)).reverse().find(i => i >= 0) ?? 0);
  const unread = L.inbox.filter(m => !m.read).length;
  const offers = L.inbox.filter(m => m.action?.kind === 'trade').length;
  return (
    <>
      <div className="backdrop" /><div className="grain" />
      <img className="bg-mark" src={L.teams[L.user].logo} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
      <Masthead />
      <TabBar tab={tab} unread={unread} offers={offers} onSave={async () => { const ok = await saveLeague(L); app.toast(ok ? 'Franchise saved' : 'Save failed'); }} />
      <div className={`workspace${FULL.has(sc.id) ? ' full' : ''}`}>
        <aside className={`subtabs${FULL.has(sc.id) ? ' h' : ''}`}>
          {TABS[tab].subs.map(([id, label]) => (
            <button key={id} className={`subtab${sc.id === id ? ' on' : ''}`} onClick={() => app.go({ id } as Screen)}>
              {SUB_ICON[id] && <Icon n={SUB_ICON[id]!} size={16} />}{label}{id === 'inbox' && unread > 0 && <span className="badge">{unread}</span>}{id === 'offers' && offers > 0 && <span className="badge">{offers}</span>}
            </button>
          ))}
        </aside>
        <main className="main fade-in" key={JSON.stringify(sc)}><CrashGuard inline><Route sc={sc} /></CrashGuard></main>
      </div>
      <BottomLine tag="BottomLine" items={leagueCrawl(L)} />
      {overlay}
    </>
  );
}

/** Top tabs with an underline that glides to the active tab. */
function TabBar({ tab, unread, offers, onSave }: { tab: number; unread: number; offers: number; onSave: () => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bar, setBar] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const measure = () => { const b = refs.current[tab]; if (b) setBar({ x: b.offsetLeft, w: b.offsetWidth }); };
    measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure);
  }, [tab]);
  return (
    <nav className="bigtabs">
      {TABS.map((t, i) => (
        <button key={t.label} ref={el => { refs.current[i] = el; }} className={`bigtab${i === tab ? ' on' : ''}`} onClick={() => app.go({ id: t.subs[0][0] } as Screen)}>
          <Badge n={TAB_ICON[i]} size={34} tone={i === tab ? 'team' : 'steel'} />{t.label}{t.label === 'Home' && unread > 0 && <span className="n">{unread}</span>}{t.label === 'Trades' && offers > 0 && <span className="n">{offers}</span>}
        </button>
      ))}
      <i className="tabbar" style={{ transform: `translateX(${bar.x}px)`, width: bar.w }} />
      <div className="spacer" />
      <button className="navbtn" onClick={onSave}><Icon n="save" size={15} />Save</button>
      <button className="navbtn" onClick={() => app.go({ id: 'menu' })}><Icon n="menu" size={15} />Menu</button>
    </nav>
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

function Masthead() {
  const { league: L } = useApp();
  if (!L) return null;
  const t = L.teams[L.user];
  const st = standings(L)[L.user];
  const r = teamRatings(L, L.user);
  const div = Object.values(standings(L)).filter(x => L.teams[x.abbr].div === t.div && L.teams[x.abbr].conf === t.conf).sort((a, b) => b.pct - a.pct || b.w - a.w).findIndex(x => x.abbr === L.user) + 1;
  return (
    <header className="masthead" style={{ '--tc': t.colors[0] } as React.CSSProperties}>
      <div className="who">
        <div className="mh-logo"><Logo team={t} size={78} /></div>
        <div><div className="meta">{phaseLabel(L)}</div><div className="name">{t.name}</div><div className="meta sub">GM {L.gm} · HC {t.coach.name}</div></div>
      </div>
      <div className="mh-stats">
        <div><b>{st.w}-{st.l}{st.t ? `-${st.t}` : ''}</b><span>Record</span></div>
        <div><b>{div ? `${div}${['', 'st', 'nd', 'rd', 'th'][div]}` : '—'}</b><span>{t.conf} {t.div}</span></div>
        <div><b>{r.ovr}</b><span>Team OVR</span></div>
        <div><b className={capSpace(L, L.user) < 0 ? 'bad' : ''}><CountUp v={capSpace(L, L.user)} fmt={money} /></b><span>Cap Space</span></div>
      </div>
      <div className="spacer" />
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
          <button className={cls} onClick={() => app.go({ id: 'game', gid: ug.id })}>Play {ug.home === L.user ? 'vs' : '@'} {L.teams[ug.home === L.user ? ug.away : ug.home].abbr}</button>
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
