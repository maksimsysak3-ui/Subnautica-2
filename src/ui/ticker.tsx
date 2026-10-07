// The BottomLine: a sports-network crawl built entirely from this league's own
// world. On the title screen it runs preseason storylines from the real rosters and
// contracts; in a franchise it runs this week's scores and the league's news feed.
import type { ReactNode } from 'react';
import data from '../data/league.json';
import { RAW_TEAMS } from '../core/league';
import type { League } from '../core/types';
import { money } from '../core/contracts';
import { standings, ROUND_NAME, awardRace } from '../core/season';

type RawP = { fn: string; ln: string; pos: string; team: string; ovr: number; apy?: number; exp?: number; pick?: number; age?: number };
const PLAYERS = (data as unknown as { players: RawP[] }).players;
const nick = (abbr: string) => RAW_TEAMS.find(t => t.abbr === abbr)?.nick ?? abbr;

/** Storylines for the title screen, written from the real 2026 rosters. */
export function preseasonHeadlines(): string[] {
  const out: string[] = [];
  const best = (pos: string) => PLAYERS.filter(p => p.pos === pos && p.team).sort((a, b) => b.ovr - a.ovr)[0];
  for (const [pos, label] of [['QB', 'quarterback'], ['WR', 'receiver'], ['EDGE', 'pass rusher'], ['RB', 'running back'], ['CB', 'corner']] as const) {
    const p = best(pos); if (p) out.push(`${p.fn} ${p.ln} opens 2026 as the league's top-rated ${label} at ${p.ovr} overall`);
  }
  const paid = PLAYERS.filter(p => p.apy).sort((a, b) => b.apy! - a.apy!).slice(0, 3);
  for (const p of paid) out.push(`${p.fn} ${p.ln}'s ${money(p.apy!)} a year leads the ${nick(p.team)} payroll`);
  const rookies = PLAYERS.filter(p => p.exp === 0 && p.pick).sort((a, b) => a.pick! - b.pick!).slice(0, 3);
  for (const p of rookies) out.push(`No. ${p.pick} pick ${p.fn} ${p.ln} (${p.pos}) begins his rookie year with the ${nick(p.team)}`);
  const vets = PLAYERS.filter(p => (p.age ?? 0) >= 36 && p.ovr >= 80).sort((a, b) => b.ovr - a.ovr).slice(0, 2);
  for (const p of vets) out.push(`At ${p.age}, ${p.fn} ${p.ln} is still rated ${p.ovr} for the ${nick(p.team)}`);
  out.push('Free agency, the draft and every snap of all 272 games: the 2026 season is yours to run');
  return out;
}

/** "13:00" -> "1:00 PM". */
const kick = (t?: string) => { if (!t) return '1:00 PM'; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m ?? 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };

export interface LiveScore { away: string; home: string; as: number; hs: number; status: string }

/**
 * In a franchise, ESPN BottomLine style: scores (your game live, the rest of the
 * week final or with kickoff times), headlines, injuries, the MVP race, statistical
 * leaders and division leaders, each under its own header.
 */
export function leagueCrawl(L: League, live?: LiveScore): ReactNode[] {
  const out: ReactNode[] = [];
  const sec = (k: string, title: string) => out.push(<span key={'sec-' + k} className="sec">{title}</span>);
  const inSeason = L.phase === 'regular' || L.phase === 'playoffs';
  if (inSeason || live) {
    const wk = L.week;
    let games = L.games.filter(g => g.season === L.season && g.week === wk);
    if (games.length && games.every(g => !g.result) && !live) {
      const prev = L.games.filter(g => g.season === L.season && g.week === wk - 1 && g.result);
      if (prev.length) games = prev;
    }
    const label = (w: number) => (w > 18 ? ROUND_NAME[w] ?? 'Playoffs' : `Week ${w}`);
    sec('s', `NFL · ${label(games[0]?.week ?? wk)}`);
    if (live) out.push(<Score key="live" a={live.away} h={live.home} as={live.as} hs={live.hs} status={live.status} live />);
    for (const g of games) {
      if (live && g.away === live.away && g.home === live.home) continue;
      if (g.result) out.push(<Score key={g.id} a={L.teams[g.away].abbr} h={L.teams[g.home].abbr} as={g.result.as} hs={g.result.hs} status={g.result.ot ? 'Final/OT' : 'Final'} />);
      else out.push(<Score key={g.id} a={L.teams[g.away].abbr} h={L.teams[g.home].abbr} status={`${g.day ?? 'Sun'} ${kick(g.time)}`} />);
    }
  }
  const head = L.news.filter(n => n.kind !== 'injury' && n.kind !== 'game').slice(0, 12);
  if (head.length) { sec('h', 'Headlines'); head.forEach(n => out.push(<em key={'n' + n.id}>{n.text}</em>)); }
  const inj = L.news.filter(n => n.kind === 'injury').slice(0, 6);
  if (inj.length) { sec('i', 'Injury Report'); inj.forEach(n => out.push(<em key={'i' + n.id}>{n.text}</em>)); }
  if (inSeason && Object.values(L.players).some(p => p.stats[L.season]?.gp)) {
    const race = awardRace(L, L.season, 3);
    sec('m', 'MVP Race');
    race.mvp.forEach((x, i) => out.push(<em key={'m' + x.p.id}><b className="rk">{i + 1}</b>{x.p.fn[0]}. {x.p.ln} <span className="dim">{x.p.team} · {x.p.pos}</span></em>));
    const lead = (k: keyof NonNullable<typeof L.players[string]['stats'][number]>, lbl: string) => {
      const p = Object.values(L.players).filter(q => q.stats[L.season]).sort((a, b) => (b.stats[L.season]![k] as number) - (a.stats[L.season]![k] as number))[0];
      if (p) out.push(<em key={'l' + String(k)}>{lbl}: {p.fn[0]}. {p.ln} ({p.team}) <b className="num">{(p.stats[L.season]![k] as number).toLocaleString()}</b></em>);
    };
    sec('l', 'League Leaders');
    lead('py', 'Pass Yds'); lead('ry', 'Rush Yds'); lead('recy', 'Rec Yds'); lead('dsk', 'Sacks'); lead('dint', 'INT');
    const st = standings(L);
    sec('d', 'Division Leaders');
    for (const conf of ['AFC', 'NFC'] as const) for (const div of ['East', 'North', 'South', 'West']) {
      const ts = Object.keys(L.teams).filter(t => L.teams[t].conf === conf && L.teams[t].div === div).sort((a, b) => st[b].pct - st[a].pct || st[b].w - st[a].w);
      const t = ts[0]; if (t) out.push(<em key={'d' + conf + div}>{conf} {div}: <b>{L.teams[t].abbr}</b> {st[t].w}-{st[t].l}{st[t].t ? `-${st[t].t}` : ''}</em>);
    }
  }
  if (!out.length) { sec('p', 'Preseason'); preseasonHeadlines().forEach((h, i) => out.push(<em key={'h' + i}>{h}</em>)); }
  return out;
}

function Score({ a, h, as, hs, status, live }: { a: string; h: string; as?: number; hs?: number; status: string; live?: boolean }) {
  const done = as !== undefined && hs !== undefined;
  const aw = done && as! > hs!, hw = done && hs! > as!;
  return (
    <em className={`score${live ? ' live' : ''}`}>
      <span className={aw ? 'w' : done ? 'l' : ''}>{a}{done && <b>{as}</b>}</span>
      <span className={hw ? 'w' : done ? 'l' : ''}>{h}{done && <b>{hs}</b>}</span>
      <i>{live && <span className="dot" />}{status}</i>
    </em>
  );
}

/** The crawl strip itself. Duration scales with length so it reads at a steady speed. */
export function BottomLine({ tag, items }: { tag: string; items: ReactNode[] }) {
  const dur = Math.max(40, items.length * 5.5);
  return (
    <div className="bottomline">
      <b className="bl-tag"><span className="bl-net">GGN</span>{tag}</b>
      <div className="bl-crawl"><span style={{ '--dur': `${dur}s` } as React.CSSProperties}>{items}{items.map((x, i) => <span key={'dup' + i} style={{ display: 'contents' }}>{x}</span>)}</span></div>
    </div>
  );
}
