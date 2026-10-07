// Team statistics from every box score, league team stats, power rankings, progression.
import { useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Table, PlayerCell, DevBadge, Bar } from '../components';
import type { League } from '../../core/types';
import { standings } from '../../core/season';
import { teamRatings } from '../../core/league';
import { xpToLevel } from '../../core/season';

export interface TeamSeason { abbr: string; g: number; pts: number; pa: number; yds: number; pyds: number; ryds: number; ydsA: number; pydsA: number; rydsA: number; fd: number; to: number; take: number; sacks: number; sacked: number; pen: number; peny: number; third: [number, number]; top: number; plays: number }
export function teamSeasonStats(L: League, season = L.season): Record<string, TeamSeason> {
  const out: Record<string, TeamSeason> = {};
  for (const a of Object.keys(L.teams)) out[a] = { abbr: a, g: 0, pts: 0, pa: 0, yds: 0, pyds: 0, ryds: 0, ydsA: 0, pydsA: 0, rydsA: 0, fd: 0, to: 0, take: 0, sacks: 0, sacked: 0, pen: 0, peny: 0, third: [0, 0], top: 0, plays: 0 };
  for (const g of L.games) {
    if (g.season !== season || g.week > 18 || !g.result?.box) continue;
    const b = g.result.box;
    [[g.away, 0, g.result.as, g.result.hs], [g.home, 1, g.result.hs, g.result.as]].forEach(([abbr, i, pf, pa]) => {
      const t = out[abbr as string], me = b.teams[i as number], op = b.teams[1 - (i as number)];
      t.g++; t.pts += pf as number; t.pa += pa as number; t.yds += me.yds; t.pyds += me.pyds; t.ryds += me.ryds; t.ydsA += op.yds; t.pydsA += op.pyds; t.rydsA += op.ryds;
      t.fd += me.fd; t.to += me.to; t.take += op.to; t.sacks += me.sacks; t.sacked += op.sacks; t.pen += me.pen; t.peny += me.peny; t.third[0] += me.third[0]; t.third[1] += me.third[1]; t.top += me.top; t.plays += me.plays;
    });
  }
  return out;
}
const pg = (v: number, g: number) => (g ? v / g : 0);
const COLS: [string, (t: TeamSeason) => number, boolean, (v: number) => string][] = [
  ['Points / G', t => pg(t.pts, t.g), true, v => v.toFixed(1)], ['Allowed / G', t => pg(t.pa, t.g), false, v => v.toFixed(1)],
  ['Yards / G', t => pg(t.yds, t.g), true, v => v.toFixed(1)], ['Pass Yds / G', t => pg(t.pyds, t.g), true, v => v.toFixed(1)], ['Rush Yds / G', t => pg(t.ryds, t.g), true, v => v.toFixed(1)],
  ['Yds Allowed / G', t => pg(t.ydsA, t.g), false, v => v.toFixed(1)], ['Pass Allowed / G', t => pg(t.pydsA, t.g), false, v => v.toFixed(1)], ['Rush Allowed / G', t => pg(t.rydsA, t.g), false, v => v.toFixed(1)],
  ['Turnover Diff', t => t.take - t.to, true, v => (v > 0 ? `+${v}` : `${v}`)], ['Sacks', t => t.sacks, true, v => String(v)], ['Sacks Allowed', t => t.sacked, false, v => String(v)],
  ['3rd Down %', t => (t.third[1] ? (t.third[0] / t.third[1]) * 100 : 0), true, v => `${v.toFixed(1)}%`], ['Penalty Yds / G', t => pg(t.peny, t.g), false, v => v.toFixed(1)],
  ['Possession', t => pg(t.top, t.g), true, v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`],
];
const rankOf = (all: TeamSeason[], f: (t: TeamSeason) => number, hi: boolean, abbr: string) => [...all].sort((a, b) => (hi ? f(b) - f(a) : f(a) - f(b))).findIndex(t => t.abbr === abbr) + 1;
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export function TeamStatsScreen() {
  const L = useApp().league!;
  const all = Object.values(teamSeasonStats(L));
  const me = all.find(t => t.abbr === L.user)!;
  return (
    <div className="grid">
      <div><div className="page-title">Team Stats</div><div className="page-sub">{L.teams[L.user].name} · {L.season} regular season · ranks out of 32</div></div>
      {!me.g && <div className="card empty">No games played yet this season.</div>}
      <div className="grid g4">{COLS.map(([k, f, hi, fmt]) => { const r = rankOf(all, f, hi, L.user); return (
        <div key={k} className="card" style={{ borderTop: `3px solid ${r <= 8 ? 'var(--good)' : r >= 25 ? 'var(--bad)' : 'var(--line2)'}` }}>
          <div className="up">{k}</div><div className="row" style={{ alignItems: 'baseline' }}><span className="num" style={{ fontSize: 34 }}>{fmt(f(me))}</span><div className="spacer" /><span className={`h3 ${r <= 8 ? 'good' : r >= 25 ? 'bad' : 'dim'}`}>{me.g ? ord(r) : '—'}</span></div>
        </div>); })}</div>
    </div>
  );
}

export function LeagueTeamStats() {
  const L = useApp().league!;
  const [view, setView] = useState<'Offense' | 'Defense' | 'Misc'>('Offense');
  const rows = Object.values(teamSeasonStats(L));
  const pick = { Offense: [0, 2, 3, 4, 11, 13], Defense: [1, 5, 6, 7, 9, 8], Misc: [8, 10, 12, 13, 11] }[view];
  return (
    <div className="grid">
      <div className="row"><div className="page-title">League Team Stats</div><div className="spacer" />{(['Offense', 'Defense', 'Misc'] as const).map(v => <span key={v} className={`chip${view === v ? ' on' : ''}`} onClick={() => setView(v)}>{v}</span>)}</div>
      <Table rows={rows} rowKey={t => t.abbr} initial={COLS[pick[0]][0]} desc={COLS[pick[0]][2]} mine={t => t.abbr === L.user} onRow={t => app.go({ id: 'team', team: t.abbr })} cols={[
        { k: 'team', h: 'Team', get: t => <div className="pcell"><Logo team={L.teams[t.abbr]} size={26} /><b>{L.teams[t.abbr].name}</b></div>, sort: t => t.abbr },
        { k: 'g', h: 'G', get: t => t.g, cls: 'c' },
        ...pick.map(i => ({ k: COLS[i][0], h: COLS[i][0], get: (t: typeof rows[number]) => <span className="num">{COLS[i][3](COLS[i][1](t))}</span>, sort: COLS[i][1], cls: 'r' })),
      ]} />
    </div>
  );
}

export function PowerRankings() {
  const L = useApp().league!;
  const st = standings(L);
  const rows = Object.keys(L.teams).map(a => { const r = teamRatings(L, a); const s = st[a]; const gp = s.w + s.l + s.t; return { a, r, s, score: (gp ? s.pct * 60 + (s.pf - s.pa) / gp * 1.2 : 0) + r.ovr * (gp ? 0.4 : 1) }; }).sort((x, y) => y.score - x.score);
  return (
    <div className="grid">
      <div><div className="page-title">Power Rankings</div><div className="page-sub">Record, point differential and roster strength.</div></div>
      <div className="card">{rows.map((x, i) => (
        <div key={x.a} className="li" onClick={() => app.go({ id: 'team', team: x.a })} style={x.a === L.user ? { background: 'color-mix(in srgb, var(--team2) 10%, transparent)' } : undefined}>
          <span className="num" style={{ width: 34, fontSize: 26 }}>{i + 1}</span><Logo team={L.teams[x.a]} size={40} />
          <div style={{ flex: 1 }}><b className="h3">{L.teams[x.a].name}</b><div className="small dim">{x.s.w}-{x.s.l}{x.s.t ? `-${x.s.t}` : ''} · {x.s.pf - x.s.pa >= 0 ? '+' : ''}{x.s.pf - x.s.pa} · {x.s.streak || '—'}</div></div>
          <span className="small mute">OFF {x.r.off} · DEF {x.r.def}</span><Ovr v={x.r.ovr} />
        </div>
      ))}</div>
    </div>
  );
}

export function ProgressionScreen() {
  const L = useApp().league!;
  const rows = Object.values(L.players).filter(p => p.team === L.user && p.status !== 'RET');
  return (
    <div className="grid">
      <div><div className="page-title">Progression</div><div className="page-sub">XP earned from practice and production. Each level raises a player's key ratings, up to his ceiling. Development trait sets the pace.</div></div>
      <Table rows={rows} rowKey={p => p.id} initial="xp" onRow={p => app.go({ id: 'player', pid: p.id })} cols={[
        { k: 'p', h: 'Player', get: p => <PlayerCell p={p} /> }, { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
        { k: 'dev', h: 'Dev', get: p => <DevBadge d={p.dev} />, sort: p => ['Normal', 'Star', 'Superstar', 'X-Factor'].indexOf(p.dev) },
        { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
        { k: 'xp', h: 'XP to Next Level', get: p => <div style={{ width: 160 }}><Bar v={p.xp} max={xpToLevel(p.ovr)} /><div className="small mute">{Math.round(p.xp)} / {xpToLevel(p.ovr)}</div></div>, sort: p => p.xp / xpToLevel(p.ovr) },
        { k: 'room', h: 'Growth Left', get: p => p.age >= 29 || p.pot <= p.ovr ? <span className="mute">Peaked</span> : p.pot - p.ovr >= 8 ? 'High' : p.pot - p.ovr >= 4 ? 'Medium' : 'Low', sort: p => p.pot - p.ovr },
      ]} />
    </div>
  );
}
