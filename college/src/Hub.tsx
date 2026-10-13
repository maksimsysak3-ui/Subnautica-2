// The dynasty hub: the frame every season screen lives in. A header in the program's colours
// (logo, mascot, record, ranking), a sidebar of sections and a page for each. This build is the
// frame: rosters, rankings and conferences are real; schedule, recruiting, portal and NIL are
// laid out with sample content until the season systems arrive.
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { SCHOOLS, SEASON, TOP25, school, rosterOf, headshot, showColor, YEAR, YR, height, type School } from './data';
import { Mascot } from './art';
import { Logo } from './App';

const TABS: [string, string][] = [['Home', '⌂'], ['Roster', '☰'], ['Depth Chart', '▤'], ['Schedule', '▦'], ['Recruiting', '★'], ['Transfer Portal', '⇄'], ['NIL', '$'], ['Rankings', '#'], ['Conference', '◆'], ['Coach', '◉']];
const rand = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function Hub({ team, tab, setTab, back }: { team: number; tab: string; setTab: (t: string) => void; back: () => void }) {
  const s = school(team), c = showColor(s), rank = TOP25.indexOf(s);
  return (
    <div className="hb" style={{ '--c': c, '--c2': s.c2 } as CSSProperties}>
      <div className="hb-top">
        <div className="hb-brand">GRIDIRON <b>COLLEGE</b></div>
        <nav className="pills">{TABS.map(([t, ic]) => <button key={t} className={`pill${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}><i>{ic}</i>{t}</button>)}</nav>
        <button className="pill ghost" onClick={back}>‹ Main Menu</button>
      </div>
      <main className="hb-main">
        <header className="hb-head">
          <div className="hb-head-art"><Mascot s={s} size={170} /></div>
          <Logo id={s.id} className="hb-logo" />
          <div className="hb-id">
            <div className="hb-k">{SEASON} · Preseason · {s.conf}</div>
            <div className="hb-name">{rank >= 0 && <em>#{rank + 1}</em>}{s.school}</div>
            <div className="hb-sub">{s.mascot}</div>
          </div>
          <div className="spacer" />
          <div className="hb-pills"><div><b>0-0</b><span>Record</span></div><div><b>0-0</b><span>Conf</span></div><div><b>{s.ovr}</b><span>OVR</span></div><div><b className="gold">{'★'.repeat(Math.max(1, Math.round(s.prestige)))}</b><span>Prestige</span></div></div>
          <button className="cbtn primary">Advance ›</button>
        </header>
        <div className="hb-page" key={tab}>
          {tab === 'Home' && <HomeTab s={s} go={setTab} />}
          {tab === 'Roster' && <RosterTab s={s} />}
          {tab === 'Depth Chart' && <DepthTab s={s} />}
          {tab === 'Schedule' && <ScheduleTab s={s} />}
          {tab === 'Recruiting' && <RecruitTab s={s} />}
          {tab === 'Transfer Portal' && <PortalTab s={s} />}
          {tab === 'NIL' && <NilTab s={s} />}
          {tab === 'Rankings' && <RankTab s={s} />}
          {tab === 'Conference' && <ConfTab s={s} />}
          {tab === 'Coach' && <CoachTab s={s} />}
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
const Stars = ({ n }: { n: number }) => <span className="gold">{'★'.repeat(n)}<span className="dimstar">{'★'.repeat(5 - n)}</span></span>;

function opponents(s: School) {
  const r = rand(s.id * 7 + 3);
  const conf = SCHOOLS.filter(x => x.conf === s.conf && x.id !== s.id).sort(() => r() - 0.5).slice(0, 8);
  const non = SCHOOLS.filter(x => x.conf !== s.conf).sort(() => r() - 0.5).slice(0, 4);
  return [...non.slice(0, 3), ...conf.slice(0, 4), non[3], ...conf.slice(4)].slice(0, 12).map((o, i) => ({ o, home: (i + s.id) % 2 === 0, wk: i + 1, conf: o.conf === s.conf }));
}

function HomeTab({ s, go }: { s: School; go: (t: string) => void }) {
  const roster = rosterOf(s.id), sched = opponents(s).slice(0, 4), stars = roster.filter(p => p.hs).slice(0, 4);
  return (
    <div className="hgrid">
      <Card title="Team leaders" span={2} action={<button className="lnk" onClick={() => go('Roster')}>Full roster ›</button>}>
        <div className="leaders">{stars.map(p => (
          <div key={p.id} className="leader"><div className="leader-img"><img src={headshot(p)} alt="" onError={e => ((e.target as HTMLImageElement).style.visibility = 'hidden')} /><span>{p.num}</span></div><b>{p.fn} {p.ln}</b><em>{p.pos} · {YR[p.yr]}</em><Ovr v={p.ovr} /></div>
        ))}</div>
      </Card>
      <Card title="Up next" action={<button className="lnk" onClick={() => go('Schedule')}>Schedule ›</button>}>
        <div className="mini-sched">{sched.map(g => <div key={g.wk}><em>Wk {g.wk}</em><span>{g.home ? 'vs' : '@'}</span><Logo id={g.o.id} size={26} /><b>{g.o.school}</b><i>{g.o.ovr}</i></div>)}</div>
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
        {roster.map(p => <div key={p.id} className="tr"><Hs p={p} /><span><b>{p.fn} {p.ln}</b> <em>#{p.num}</em>{p.st ? <u>Starter</u> : null}</span><span>{p.pos}</span><span>{YEAR[p.yr]}</span><span>{height(p.ht)} / {p.wt}</span><span className="dim">{p.home ?? '—'}</span><span><Ovr v={p.ovr} /></span></div>)}
      </div>
    </>
  );
}

function DepthTab({ s }: { s: School }) {
  const roster = rosterOf(s.id);
  const groups: [string, string[]][] = [['Offense', ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C']], ['Defense', ['EDGE', 'DT', 'LB', 'CB', 'S']], ['Special teams', ['K', 'P']]];
  return (
    <div className="depth">{groups.map(([g, ps]) => (
      <Card key={g} title={g}>
        <div className="depth-grid">{ps.map(pos => (
          <div key={pos} className="depth-col"><h4>{pos}</h4>{roster.filter(p => p.pos === pos).slice(0, 4).map((p, i) => <div key={p.id} className={i === 0 ? 'first' : ''}><Hs p={p} /><span>{p.ln}</span><Ovr v={p.ovr} /></div>)}</div>
        ))}</div>
      </Card>
    ))}</div>
  );
}

function ScheduleTab({ s }: { s: School }) {
  return (
    <div className="sched">{opponents(s).map(g => (
      <div key={g.wk} className="sched-row" style={{ '--tc': showColor(g.o) } as CSSProperties}>
        <em>Week {g.wk}</em><span className="ha">{g.home ? 'HOME' : 'AWAY'}</span><Logo id={g.o.id} size={40} />
        <div><b>{g.o.school}</b><span>{g.o.mascot} · {g.o.conf}{g.conf ? ' · Conference game' : ''}</span></div>
        <div className="spacer" /><i>OVR {g.o.ovr}</i><span className="tbd">Sat · TBD</span>
      </div>
    ))}</div>
  );
}

const FN = ['Jaylen', 'Marcus', 'Tre', 'Kendrick', 'Cole', 'Brady', 'Isaiah', 'Dominic', 'Xavier', 'Camden', 'Malik', 'Trey', 'Jordan', 'Elijah', 'Gavin', 'Josiah'];
const LN = ['Whitfield', 'Okoro', 'Banks', 'Hollins', 'McCray', 'Pruitt', 'Delacroix', 'Sutton', 'Ivory', 'Kincaid', 'Abernathy', 'Rollins', 'Vance', 'Tate', 'Ashby', 'Boykin'];
const ST = ['TX', 'FL', 'GA', 'CA', 'OH', 'AL', 'LA', 'NC', 'PA', 'MI', 'TN', 'AZ'];
function recruits(seed: number, n = 14) {
  const r = rand(seed);
  return Array.from({ length: n }, (_, i) => ({ id: i, fn: FN[Math.floor(r() * FN.length)], ln: LN[Math.floor(r() * LN.length)], pos: ['QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'LB', 'CB', 'S'][Math.floor(r() * 10)], st: ST[Math.floor(r() * ST.length)], stars: Math.max(2, 5 - Math.floor(i / 3)), int: Math.round(20 + r() * 75) }));
}
function RecruitTab({ s }: { s: School }) {
  const list = useMemo(() => recruits(s.id), [s.id]);
  return (
    <div className="hgrid">
      <Card title="Recruiting board" span={2} action={<span className="tag">Sample prospects</span>}>
        <div className="tbl">
          <div className="tr th rec"><span>Prospect</span><span>Pos</span><span>Home</span><span>Rating</span><span>Interest</span><span /></div>
          {list.map(p => <div key={p.id} className="tr rec"><span><b>{p.fn} {p.ln}</b></span><span>{p.pos}</span><span>{p.st}</span><span><Stars n={p.stars} /></span><span><div className="bar"><i style={{ width: `${p.int}%` }} /></div></span><span><button className="cbtn sm">Scout</button></span></div>)}
        </div>
      </Card>
      <Card title="Weekly hours"><div className="kpis"><div><b>50</b><span>Hours left</span></div><div><b>0</b><span>Visits</span></div><div><b>0</b><span>Offers</span></div></div></Card>
    </div>
  );
}

function PortalTab({ s }: { s: School }) {
  const list = useMemo(() => SCHOOLS.filter(x => x.id !== s.id).flatMap(x => rosterOf(x.id).filter(p => p.hs && p.yr >= 2 && p.yr <= 4).slice(3, 4)).sort((a, b) => b.ovr - a.ovr).slice(0, 14), [s.id]);
  return (
    <Card title="Transfer portal" action={<span className="tag">Window opens in December</span>}>
      <div className="tbl">
        <div className="tr th portal"><span /><span>Player</span><span>From</span><span>Pos</span><span>Class</span><span>OVR</span></div>
        {list.map(p => { const f = school(p.t); return <div key={p.id} className="tr portal"><Hs p={p} /><span><b>{p.fn} {p.ln}</b></span><span className="from"><Logo id={f.id} size={20} />{f.school}</span><span>{p.pos}</span><span>{YR[p.yr]}</span><span><Ovr v={p.ovr} /></span></div>; })}
      </div>
    </Card>
  );
}

function NilTab({ s }: { s: School }) {
  const top = rosterOf(s.id).filter(p => p.hs).slice(0, 6);
  const pool = Math.round((s.prestige * 3 + s.ovr / 20) * 10) / 10;
  return (
    <div className="hgrid">
      <Card title="Collective"><div className="kpis"><div><b>${pool}M</b><span>Budget</span></div><div><b>${(pool * 0.4).toFixed(1)}M</b><span>Committed</span></div><div><b>{Math.round(s.prestige * 2)}</b><span>Boosters</span></div></div></Card>
      <Card title="Top deals" span={2}>
        <div className="nil">{top.map((p, i) => <div key={p.id}><Hs p={p} /><b>{p.fn} {p.ln}</b><em>{p.pos}</em><span>${Math.round((pool * 1000 * (0.18 - i * 0.02)))}K / yr</span></div>)}</div>
      </Card>
    </div>
  );
}

function RankTab({ s }: { s: School }) {
  return (
    <Card title="AP Top 25 · Preseason">
      <div className="rank">{TOP25.map((t, i) => (
        <div key={t.id} className={t.id === s.id ? 'me' : ''} style={{ '--tc': showColor(t) } as CSSProperties}>
          <em>{i + 1}</em><Logo id={t.id} size={30} /><b>{t.school}</b><span>{t.conf}</span><div className="spacer" /><i>0-0</i><Ovr v={t.ovr} />
        </div>
      ))}</div>
    </Card>
  );
}

function ConfTab({ s }: { s: School }) {
  const members = SCHOOLS.filter(x => x.conf === s.conf).sort((a, b) => b.ovr - a.ovr);
  return (
    <Card title={`${s.conf} standings`}>
      <div className="rank">{members.map((t, i) => (
        <div key={t.id} className={t.id === s.id ? 'me' : ''} style={{ '--tc': showColor(t) } as CSSProperties}>
          <em>{i + 1}</em><Logo id={t.id} size={30} /><b>{t.school}</b><span>{t.mascot}</span><div className="spacer" /><i>0-0 conf</i><i>0-0</i><Ovr v={t.ovr} />
        </div>
      ))}</div>
    </Card>
  );
}

function CoachTab({ s }: { s: School }) {
  return (
    <div className="hgrid">
      <Card title="Head coach" span={2}>
        <div className="coach"><div className="coach-av"><Mascot s={s} size={120} /></div><div><b>You</b><span>Head Coach · {s.school}</span><div className="kpis"><div><b>1</b><span>Season</span></div><div><b>0-0</b><span>Career</span></div><div><b>B</b><span>Job security</span></div></div></div></div>
      </Card>
      <Card title="Staff"><ul className="goals"><li><b>Offensive coordinator</b><span>Open</span></li><li><b>Defensive coordinator</b><span>Open</span></li><li><b>Recruiting coordinator</b><span>Open</span></li></ul></Card>
      <Card title="Skill tree"><div className="tree">{['Recruiter', 'Motivator', 'Tactician', 'Developer'].map(t => <div key={t}><i>◆</i><span>{t}</span></div>)}</div></Card>
    </div>
  );
}
