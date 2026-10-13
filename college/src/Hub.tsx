// The dynasty hub: the frame every season screen lives in. A header in the program's colours
// (logo, mascot, record, ranking), a sidebar of sections and a page for each. This build is the
// frame: rosters, rankings and conferences are real; schedule, recruiting, portal and NIL are
// laid out with sample content until the season systems arrive.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { SCHOOLS, SEASON, TOP25, school, rosterOf, headshot, showColor, YEAR, YR, height, type School } from './data';
import { Logo } from './App';
import { Matchup } from './Matchup';
import { Weekly } from './Weekly';
import { DepthTab, StatsTab } from './Team';
import { RecruitingTab } from './Recruiting';
import { StaffTab } from './Staff';
import { showCard } from './PlayerCard';
import { useDynasty, update } from './store';
import { endWeek } from './recruiting';
import { AwardsTab } from './Awards';
import { playWeek, teamSchedule, postGames, record, rankOf, weekLabel, weekGames, LAST_WEEK, REG_WEEKS, type Season } from './season';

const TABS = ['Home', 'Matchup', 'Weekly', 'Roster', 'Depth Chart', 'Stats', 'Schedule', 'Recruiting', 'Transfer Portal', 'Rankings', 'Conference', 'Awards', 'Staff'];

export function Hub({ team, tab, setTab, back }: { team: number; tab: string; setTab: (t: string) => void; back: () => void }) {
  const s = school(team), c = showColor(s);
  const d = useDynasty(team);
  const se = d.season!;
  const rank = rankOf(team, se) - 1;
  const when = weekLabel(d.week);
  const [busy, setBusy] = useState(false);
  const next = nextGame(s, se, d.week);
  const advance = () => {
    if (d.week >= LAST_WEEK || busy) return;
    setBusy(true);
    // Let the button repaint before the week's games run.
    setTimeout(() => { update(x => { playWeek(x); endWeek(x); }); setBusy(false); }, 30);
  };
  return (
    <div className="hb" style={{ '--c': c, '--c2': s.c2 } as CSSProperties}>
      <div className="hb-top">
        <div className="hb-brand">GRIDIRON <b>COLLEGE{__COLLEGE_3D__ ? " 3D" : ""}</b></div>
        <nav className="pills">{TABS.map(t => <button key={t} className={`pill${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t === 'Weekly' ? 'Weekly' : t === 'Transfer Portal' ? 'Portal' : t}</button>)}</nav>
        <button className="pill ghost" onClick={back}>‹ Main Menu</button>
      </div>
      <main className="hb-main">
        <header className="hb-head">
          <Logo id={s.id} className="hb-head-art" />
          <Logo id={s.id} className="hb-logo" />
          <div className="hb-id">
            <div className="hb-k">{SEASON} · {when} · {s.conf}</div>
            <div className="hb-name">{rank >= 0 && <em>#{rank + 1}</em>}{s.school}</div>
            <div className="hb-sub">{s.mascot}</div>
          </div>
          <div className="spacer" />
          <div className="hb-pills"><div><b>{record(s.id, se).s}</b><span>Record</span></div><div><b>{record(s.id, se, true).s}</b><span>Conf</span></div><div><b>{s.ovr}</b><span>OVR</span></div><div><b className="gold">{'★'.repeat(Math.max(1, Math.round(s.prestige)))}</b><span>Prestige</span></div></div>
          <button className="cbtn primary" onClick={advance} disabled={busy || d.week >= LAST_WEEK}>{busy ? 'Playing the week…' : d.week >= LAST_WEEK ? 'Season complete' : `Advance to ${weekLabel(d.week + 1).toLowerCase()} ›`}</button>
        </header>
        <div className="hb-page" key={tab}>
          {tab === 'Home' && <HomeTab s={s} go={setTab} />}
          {tab === 'Matchup' && (next ? <Matchup s={s} g={next} /> : <Card title="No game this week"><p className="dim">{d.week >= REG_WEEKS ? `${s.school}'s season is over. Follow the rest of the postseason in Rankings and Awards.` : 'Bye week. Rest up.'}</p></Card>)}
          {tab === 'Weekly' && <Weekly s={s} />}
          {tab === 'Roster' && <RosterTab s={s} />}
          {tab === 'Depth Chart' && <DepthTab s={s} />}
          {tab === 'Stats' && <StatsTab s={s} />}
          {tab === 'Schedule' && <ScheduleTab s={s} />}
          {tab === 'Recruiting' && <RecruitingTab s={s} />}
          {tab === 'Transfer Portal' && <PortalTab s={s} />}
          {tab === 'Rankings' && <RankTab s={s} />}
          {tab === 'Conference' && <ConfTab s={s} />}
          {tab === 'Awards' && <AwardsTab s={s} />}
          {tab === 'Staff' && <StaffTab s={s} />}
        </div>
      </main>
    </div>
  );
}

const Card = ({ title, action, children, span }: { title: string; action?: ReactNode; children: ReactNode; span?: number }) => (
  <section className="hc" style={span ? { gridColumn: `span ${span}` } : undefined}><header><h3>{title}</h3>{action}</header>{children}</section>
);
const Hs = ({ p }: { p: ReturnType<typeof rosterOf>[number] }) => <span className="hs">{headshot(p) ? <img src={headshot(p)} alt="" loading="lazy" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : null}</span>;
const Ovr = ({ v }: { v: number }) => <i className={`ovr ${v >= 85 ? 'a' : v >= 75 ? 'b' : 'c'}`}>{v}</i>;

/** This school's remaining regular-season opponents, in order. */
export function opponents(s: School, se?: Season) {
  return teamSchedule(s.id, se).filter((g): g is Extract<typeof g, { bye: false }> => !g.bye).map(g => ({ o: g.o, home: g.home, wk: g.wk, conf: g.conf }));
}
/** The next game this school plays (regular season, title game or playoff), if any. */
export function nextGame(s: School, se: Season, week: number) {
  const w = week + 1;
  const g = weekGames(se, w).find(x => x[0] === s.id || x[1] === s.id);
  if (!g || se.results.some(r => r.w === w && (r.h === s.id || r.a === s.id))) return null;
  const home = g[0] === s.id;
  return { o: school(home ? g[1] : g[0]), home, wk: w, conf: g[2], tag: g[3] };
}

function HomeTab({ s, go }: { s: School; go: (t: string) => void }) {
  const d = useDynasty(s.id), se = d.season!;
  const roster = rosterOf(s.id), sched = teamSchedule(s.id, se).filter(g => !g.bye && g.wk > d.week - 1).slice(0, 4) as Extract<ReturnType<typeof teamSchedule>[number], { bye: false }>[], stars = roster.slice(0, 4);
  return (
    <div className="hgrid">
      <Card title="Team leaders" span={2} action={<button className="lnk" onClick={() => go('Roster')}>Full roster ›</button>}>
        <div className="leaders">{stars.map(p => (
          <button key={p.id} className="leader" onClick={() => showCard(p)}><div className="leader-img">{headshot(p) ? <img src={headshot(p)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /> : null}<span>{p.num}</span></div><b>{p.fn} {p.ln}</b><em>{p.pos} · {YR[p.yr]}</em><Ovr v={p.ovr} /></button>
        ))}</div>
      </Card>
      <Card title="Up next" action={<button className="lnk" onClick={() => go('Schedule')}>Schedule ›</button>}>
        <div className="mini-sched">{sched.map(g => <div key={g.wk}><em>Wk {g.wk}</em><span>{g.home ? 'vs' : '@'}</span><Logo id={g.o.id} size={26} /><b>{g.o.school}</b>{g.res ? <i className={g.won ? 'w' : 'l'}>{g.won ? 'W' : 'L'} {g.us}-{g.them}</i> : <i>{g.o.ovr}</i>}</div>)}</div>
      </Card>
      <Card title="Program goals">
        <ul className="goals"><li><b>Win the {s.conf}</b><span>Athletic director · priority</span></li><li><b>Top-25 recruiting class</b><span>Recruiting · on track</span></li><li><b>Graduate 90% of seniors</b><span>Academics</span></li></ul>
      </Card>
      <Card title="Recruiting snapshot" action={<button className="lnk" onClick={() => go('Recruiting')}>Board ›</button>}>
        <div className="kpis"><div><b>0</b><span>Commits</span></div><div><b>—</b><span>Class rank</span></div><div><b>25</b><span>Scholarships</span></div></div>
      </Card>
      <Card title="Campus news" span={2}>
        <div className="news">
          <div><i>Media</i><b>{s.school} opens fall camp with {roster.filter(p => p.yr >= 4).length} seniors on the roster</b></div>
          <div><i>Poll</i><b>{TOP25.indexOf(s) >= 0 ? `${s.school} starts the season ranked No. ${TOP25.indexOf(s) + 1}` : `${s.school} sits just outside the preseason poll`}</b></div>
          <div><i>Recruiting</i><b>Official visit weekend set for the home opener</b></div>
        </div>
      </Card>
    </div>
  );
}

function RosterTab({ s }: { s: School }) {
  const [pos, setPos] = useState('All');
  const roster = rosterOf(s.id).filter(p => pos === 'All' || p.pos === pos);
  return (
    <>
      <div className="chips">{['All', 'QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K', 'P'].map(p => <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>)}</div>
      <div className="tbl">
        <div className="tr th"><span /><span>Player</span><span>Pos</span><span>Class</span><span>Ht / Wt</span><span>Hometown</span><span>OVR</span></div>
        {roster.map(p => <div key={p.id} className="tr click" onClick={() => showCard(p)}><Hs p={p} /><span><b>{p.fn} {p.ln}</b> <em>#{p.num}</em>{p.st ? <u>Starter</u> : null}</span><span>{p.pos}</span><span>{YEAR[p.yr]}</span><span>{height(p.ht)} / {p.wt}</span><span className="dim">{p.home ?? '—'}</span><span><Ovr v={p.ovr} /></span></div>)}
      </div>
    </>
  );
}

function ScheduleTab({ s }: { s: School }) {
  const se = useDynasty(s.id).season!;
  const post = postGames(s.id, se);
  return (
    <div className="sched">{teamSchedule(s.id, se).map(g => g.bye ? (
      <div key={g.wk} className="sched-row bye"><em>Week {g.wk}</em><b>Bye week</b></div>
    ) : (
      <div key={g.wk} className={`sched-row${g.res ? (g.won ? ' won' : ' lost') : ''}`} style={{ '--tc': showColor(g.o) } as CSSProperties}>
        <em>Week {g.wk}</em><span className="ha">{g.home ? 'HOME' : 'AWAY'}</span><Logo id={g.o.id} size={40} />
        <div><b>{rankOf(g.o.id, se) ? <u>#{rankOf(g.o.id, se)}</u> : null}{g.o.school}</b><span>{g.o.mascot} · {g.o.conf}{g.conf ? ' · Conference game' : ''}</span></div>
        <div className="spacer" /><i>OVR {g.o.ovr}</i>{g.res ? <span className={`score ${g.won ? 'w' : 'l'}`}>{g.won ? 'W' : 'L'} {g.us}-{g.them}{g.res.ot ? ' OT' : ''}</span> : <span className="tbd">Sat · TBD</span>}
      </div>
    ))}
    {post.map(g => { const home = g.h === s.id, o = school(home ? g.a : g.h), us = home ? g.hs : g.as, them = home ? g.as : g.hs; return (
      <div key={`p${g.w}`} className={`sched-row post ${us > them ? 'won' : 'lost'}`} style={{ '--tc': showColor(o) } as CSSProperties}>
        <em>{g.tag ?? weekLabel(g.w)}</em><span className="ha">{home ? 'HOME' : 'NEUTRAL'}</span><Logo id={o.id} size={40} /><div><b>{o.school}</b><span>{weekLabel(g.w)}</span></div><div className="spacer" /><span className={`score ${us > them ? 'w' : 'l'}`}>{us > them ? 'W' : 'L'} {us}-{them}</span>
      </div>); })}
    </div>
  );
}

function PortalTab({ s }: { s: School }) {
  const d = useDynasty(s.id);
  const open = d.week > 13;
  const list = useMemo(() => SCHOOLS.filter(x => x.id !== s.id).flatMap(x => rosterOf(x.id).filter(p => p.yr >= 2 && p.yr <= 4).slice(3, 4)).sort((a, b) => b.ovr - a.ovr).slice(0, 20), [s.id]);
  if (!open) return (
    <section className="hc portal-closed">
      <div><span className="tag">Closed</span><h2>The transfer portal is closed</h2><p>The window opens after the regular season, once the conference championships are played. Until then, focus on your roster and the class of 2027.</p>
      <div className="kpis"><div><b>{Math.max(0, 14 - d.week)}</b><span>Weeks until it opens</span></div><div><b>{rosterOf(s.id).filter(p => p.yr >= 2 && !p.st && p.ovr >= 70).length}</b><span>Backups at risk of leaving</span></div><div><b>0</b><span>Players entered</span></div></div></div>
    </section>
  );
  return (
    <Card title="Transfer portal" action={<span className="tag">Open</span>}>
      <div className="tbl">
        <div className="tr th portal"><span /><span>Player</span><span>From</span><span>Pos</span><span>Class</span><span>OVR</span></div>
        {list.map(p => { const f = school(p.t); return <div key={p.id} className="tr portal click" onClick={() => showCard(p)}><Hs p={p} /><span><b>{p.fn} {p.ln}</b></span><span className="from"><Logo id={f.id} size={20} />{f.school}</span><span>{p.pos}</span><span>{YR[p.yr]}</span><span><Ovr v={p.ovr} /></span></div>; })}
      </div>
    </Card>
  );
}

function RankTab({ s }: { s: School }) {
  const d = useDynasty(s.id), se = d.season!;
  const poll = (se.polls[se.polls.length - 1] ?? []).slice(0, 25), prev = se.polls[se.polls.length - 2];
  return (
    <div className="hgrid">
      <Card title={`AP Top 25 · ${weekLabel(d.week)}`} span={2}>
        <div className="rank">{poll.map((id, i) => { const t = school(id), was = prev ? prev.indexOf(id) : i, mv = was - i; return (
          <div key={id} className={id === s.id ? 'me' : ''} style={{ '--tc': showColor(t) } as CSSProperties}>
            <em>{i + 1}</em><small className={mv > 0 ? 'up' : mv < 0 ? 'dn' : ''}>{prev ? (mv > 0 ? `▲${mv}` : mv < 0 ? `▼${-mv}` : '–') : ''}</small><Logo id={id} size={30} /><b>{t.school}</b><span>{t.conf}</span><div className="spacer" /><i>{record(id, se).s}</i><Ovr v={t.ovr} />
          </div>); })}</div>
      </Card>
      {se.playoff && <Card title="College Football Playoff">
        <div className="rank">{se.playoff.map((id, i) => <div key={id} className={id === s.id ? 'me' : ''} style={{ '--tc': showColor(school(id)) } as CSSProperties}><em>{i + 1}</em><Logo id={id} size={26} /><b>{school(id).school}</b><div className="spacer" /><i>{record(id, se).s}</i>{se.title === id && <u className="champ">Champion</u>}</div>)}</div>
      </Card>}
    </div>
  );
}

function ConfTab({ s }: { s: School }) {
  const se = useDynasty(s.id).season!;
  const members = SCHOOLS.filter(x => x.conf === s.conf).sort((a, b) => { const x = record(a.id, se, true), y = record(b.id, se, true); return (y.w - y.l) - (x.w - x.l) || record(b.id, se).w - record(a.id, se).w || b.ovr - a.ovr; });
  const champ = se.champs?.[s.conf];
  return (
    <Card title={`${s.conf} standings`} action={champ ? <span className="tag">Champion: {school(champ).school}</span> : undefined}>
      <div className="rank">{members.map((t, i) => (
        <div key={t.id} className={t.id === s.id ? 'me' : ''} style={{ '--tc': showColor(t) } as CSSProperties}>
          <em>{i + 1}</em><Logo id={t.id} size={30} /><b>{rankOf(t.id, se) ? <u>#{rankOf(t.id, se)}</u> : null}{t.school}</b><span>{t.mascot}</span><div className="spacer" /><i>{record(t.id, se, true).s} conf</i><i>{record(t.id, se).s}</i><Ovr v={t.ovr} />
        </div>
      ))}</div>
    </Card>
  );
}
