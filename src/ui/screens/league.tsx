import type React from 'react';
import { useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Face, Table, Tabs, Ovr, PlayerCell } from '../components';
import { vivid } from '../components';
import { divisionOrder, seeds, standings, ROUND_NAME, REG_WEEKS } from '../../core/season';
import { evaluateTrade, executeTrade, pickLabel } from '../../core/trade';
import type { League, Player, StatLine } from '../../core/types';
import { PressInvite } from './presser';
import { pressOpen } from '../../core/presser';
import { media } from '../../core/media';
import { HighlightReel } from '../reel';

export function ScheduleScreen() {
  const L = useApp().league!;
  const [mine, setMine] = useState(true);
  const games = L.games.filter(g => g.season === L.season && (!mine || g.home === L.user || g.away === L.user)).sort((a, b) => a.week - b.week);
  const weeks = [...new Set(games.map(g => g.week))];
  return (
    <div className="grid">
      <div className="row"><div className="h2">{L.season} Schedule</div><div className="spacer" /><span className={`chip${mine ? ' on' : ''}`} onClick={() => setMine(true)}>My Team</span><span className={`chip${!mine ? ' on' : ''}`} onClick={() => setMine(false)}>League</span></div>
      {mine ? <div className="gcards">{games.map(g => <GameCard key={g.id} g={g} />)}</div>
        : weeks.map(w => (
          <div key={w}>
            <div className="sec-h"><h2 style={{ fontSize: 22 }}>{w > REG_WEEKS ? ROUND_NAME[w] : `Week ${w}`}</h2><div className="line" /></div>
            <div className="gcards">{games.filter(g => g.week === w).map(g => <GameCard key={g.id} g={g} />)}</div>
          </div>
        ))}
    </div>
  );
}

function GameCard({ g }: { g: League['games'][number] }) {
  const L = useApp().league!;
  const r = g.result, a = L.teams[g.away], h = L.teams[g.home];
  const mine = g.home === L.user || g.away === L.user;
  const won = r && ((g.home === L.user && r.hs > r.as) || (g.away === L.user && r.as > r.hs));
  const now = mine && g.week === L.week && !r && (L.phase === 'regular' || L.phase === 'playoffs');
  return (
    <div className={`gcard${now ? ' now' : ''}`} style={{ '--ca': vivid(a.colors[0]), '--ch': vivid(h.colors[0]) } as React.CSSProperties}
      onClick={() => r ? app.go({ id: 'box', gid: g.id }) : now ? app.go({ id: 'game', gid: g.id }) : app.go({ id: 'team', team: mine ? (g.home === L.user ? g.away : g.home) : g.home })}>
      <div className="gc-top"><span>{g.week > REG_WEEKS ? ROUND_NAME[g.week] : `Week ${g.week}`}</span>{mine && r && <b className={won ? 'w' : r.hs === r.as ? 't' : 'l'}>{won ? 'W' : r.hs === r.as ? 'T' : 'L'}</b>}{now && <b className="nx">Next</b>}</div>
      {[a, h].map((t, i) => { const sc = r ? (i ? r.hs : r.as) : undefined; const lose = r && sc! < (i ? r.as : r.hs); return (
        <div key={t.abbr} className={`gc-team${lose ? ' lose' : ''}`}><Logo team={t} size={38} /><span>{t.nick}</span><b>{sc ?? ''}</b></div>
      ); })}
      <div className="gc-foot">{r ? `Final${r.ot ? '/OT' : ''}` : `${g.day ?? ''} ${g.time ?? ''}`}<span>{g.neutral ?? h.stadium}</span></div>
    </div>
  );
}

export function StandingsScreen() {
  const L = useApp().league!;
  const st = standings(L);
  const [view, setView] = useState<'Divisions' | 'Playoff Picture' | 'League'>('Divisions');
  const row = (a: string, seed?: number) => {
    const s = st[a];
    return (
      <tr key={a} className={a === L.user ? 'me' : undefined} onClick={() => app.go({ id: 'team', team: a })}>
        <td><div className="pcell">{seed && <span className="num mute" style={{ width: 16 }}>{seed}</span>}<Logo team={L.teams[a]} size={26} /><b>{L.teams[a].name}</b></div></td>
        <td className="c num">{s.w}</td><td className="c num">{s.l}</td><td className="c num">{s.t}</td><td className="c">{s.pct.toFixed(3).replace(/^0/, '')}</td>
        <td className="c">{s.pf}</td><td className="c">{s.pa}</td><td className={`c ${s.pf - s.pa >= 0 ? 'good' : 'bad'}`}>{s.pf - s.pa > 0 ? '+' : ''}{s.pf - s.pa}</td>
        <td className="c">{s.div[0]}-{s.div[1]}</td><td className="c">{s.conf[0]}-{s.conf[1]}</td><td className="c">{s.streak}</td><td className="c small">{s.last5}</td>
      </tr>
    );
  };
  const head = <thead><tr><th>Team</th><th className="c">W</th><th className="c">L</th><th className="c">T</th><th className="c">PCT</th><th className="c">PF</th><th className="c">PA</th><th className="c">DIFF</th><th className="c">DIV</th><th className="c">CONF</th><th className="c">STRK</th><th className="c">L5</th></tr></thead>;
  return (
    <div className="grid">
      <div className="row"><div className="h2">{L.season} Standings</div><div className="spacer" /><Tabs tabs={['Divisions', 'Playoff Picture', 'League'] as const} on={view} set={setView} /></div>
      {view === 'Divisions' && <div className="grid g2">{['AFC', 'NFC'].flatMap(c => ['East', 'North', 'South', 'West'].map(d => (
        <div key={c + d} className="card" style={{ padding: 10 }}><h3>{c} {d}</h3><table className="tbl">{head}<tbody>{divisionOrder(L, c, d, st).map(a => row(a))}</tbody></table></div>
      )))}</div>}
      {view === 'Playoff Picture' && <div className="grid g2">{['AFC', 'NFC'].map(c => {
        const sd = seeds(L, c, st);
        const hunt = Object.values(L.teams).filter(t => t.conf === c && !sd.includes(t.abbr)).map(t => t.abbr).sort((a, b) => st[b].pct - st[a].pct).slice(0, 4);
        return <div key={c} className="card" style={{ padding: 10 }}><h3>{c} Seeds</h3><table className="tbl">{head}<tbody>{sd.map((a, i) => row(a, i + 1))}</tbody></table><h3 style={{ marginTop: 14 }}>In the Hunt</h3><table className="tbl"><tbody>{hunt.map(a => row(a))}</tbody></table></div>;
      })}</div>}
      {view === 'League' && <div className="card"><table className="tbl">{head}<tbody>{Object.keys(L.teams).sort((a, b) => st[b].pct - st[a].pct || (st[b].pf - st[b].pa) - (st[a].pf - st[a].pa)).map((a, i) => row(a, i + 1))}</tbody></table></div>}
    </div>
  );
}

const LEADERS: [string, keyof StatLine, string?][] = [['Passing Yards', 'py'], ['Passing TDs', 'ptd'], ['Rushing Yards', 'ry'], ['Rushing TDs', 'rtd'], ['Receptions', 'rec'], ['Receiving Yards', 'recy'], ['Receiving TDs', 'rectd'], ['Sacks', 'dsk'], ['Interceptions', 'dint'], ['Tackles', 'tkl'], ['Tackles for Loss', 'tfl'], ['Field Goals', 'fgm']];
export function StatsScreen() {
  const L = useApp().league!;
  const [season, setSeason] = useState(L.season);
  const [cat, setCat] = useState<keyof StatLine | null>(null);
  const seasons = [...new Set(Object.values(L.players).flatMap(p => Object.keys(p.stats).map(Number)))].sort((a, b) => b - a);
  const all = Object.values(L.players).filter(p => p.stats[season]);
  const top = (k: keyof StatLine, n = 5) => all.filter(p => (p.stats[season][k] as number) > 0).sort((a, b) => (b.stats[season][k] as number) - (a.stats[season][k] as number)).slice(0, n);
  return (
    <div className="grid">
      <div className="row"><div className="h2">League Leaders</div><div className="spacer" /><select value={season} onChange={e => setSeason(+e.target.value)}>{(seasons.length ? seasons : [L.season]).map(s => <option key={s}>{s}</option>)}</select></div>
      {!all.length && <div className="card empty">No games played yet this season.</div>}
      {cat ? (
        <div className="card"><div className="row" style={{ marginBottom: 10 }}><button className="btn sm ghost" onClick={() => setCat(null)}>‹ All categories</button><div className="h3">{LEADERS.find(l => l[1] === cat)?.[0]}</div></div>
          <Table rows={top(cat, 100)} rowKey={p => p.id} initial="v" onRow={p => app.go({ id: 'player', pid: p.id })} cols={[{ k: 'p', h: 'Player', get: p => <PlayerCell p={p} sub={`${p.pos} · ${p.team}`} /> }, { k: 't', h: 'Team', get: p => <Logo team={L.teams[p.team]} size={24} /> }, { k: 'gp', h: 'GP', get: p => p.stats[season].gp, cls: 'c' }, { k: 'v', h: 'Total', get: p => <b className="num">{p.stats[season][cat]}</b>, sort: p => p.stats[season][cat] as number, cls: 'r' }]} />
        </div>
      ) : (
        <div className="grid g3">
          <YpcLeaders L={L} season={season} />
          {LEADERS.map(([label, k]) => (
            <div key={k} className="card"><h3>{label}<span className="more" onClick={() => setCat(k)}>Full list ›</span></h3>
              {top(k).map((p, i) => (
                <div key={p.id} className="li" onClick={() => app.go({ id: 'player', pid: p.id })}>
                  <span className="num mute" style={{ width: 14 }}>{i + 1}</span>{i === 0 ? <Face p={p} size={40} /> : <Logo team={L.teams[p.team]} size={24} />}
                  <div style={{ flex: 1 }}><b>{p.fn[0]}. {p.ln}</b> <span className="small mute">{p.team}</span></div><span className="num" style={{ fontSize: i === 0 ? 22 : 16 }}>{p.stats[season][k]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Yards per carry: qualifiers need 6.25 carries per team game, as the NFL requires. */
function YpcLeaders({ L, season }: { L: NonNullable<ReturnType<typeof useApp>['league']>; season: number }) {
  const teamGames = Math.max(1, ...Object.values(L.players).map(p => p.stats[season]?.gp ?? 0));
  const min = Math.max(10, Math.round(teamGames * 6.25));
  const list = Object.values(L.players).filter(p => (p.stats[season]?.ra ?? 0) >= min).map(p => ({ p, v: p.stats[season].ry / p.stats[season].ra })).sort((a, b) => b.v - a.v).slice(0, 5);
  if (!list.length) return null;
  return (
    <div className="card"><h3>Yards per Carry<span className="more" style={{ cursor: 'default' }}>min {min} att</span></h3>
      {list.map(({ p, v }, i) => (
        <div key={p.id} className="li" onClick={() => app.go({ id: 'player', pid: p.id })}>
          <span className="num mute" style={{ width: 14 }}>{i + 1}</span>{i === 0 ? <Face p={p} size={40} /> : <Logo team={L.teams[p.team]} size={24} />}
          <div style={{ flex: 1 }}><b>{p.fn[0]}. {p.ln}</b> <span className="small mute">{p.team} · {p.stats[season].ra} att</span></div><span className="num" style={{ fontSize: i === 0 ? 22 : 16 }}>{v.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export function NewsScreen() {
  const L = useApp().league!;
  const [kind, setKind] = useState<string>('all');
  const kinds = ['all', 'game', 'trade', 'sign', 'injury', 'draft', 'award', 'milestone', 'release', 'coach', 'league'];
  const items = L.news.filter(n => kind === 'all' || n.kind === kind);
  return (
    <div className="grid">
      <div className="row"><div className="h2">League News</div><div className="spacer" />{kinds.map(k => <span key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{k}</span>)}</div>
      <div className="card"><div className="list">{items.map(n => (
        <div key={n.id} className="li" onClick={() => n.pid && L.players[n.pid] && app.go({ id: 'player', pid: n.pid })}>
          {n.pid && L.players[n.pid] ? <Face p={L.players[n.pid]} size={44} /> : n.teams[0] && L.teams[n.teams[0]] ? <Logo team={L.teams[n.teams[0]]} size={40} /> : <span style={{ width: 40 }} />}
          <div style={{ flex: 1 }}><div style={{ fontWeight: n.big ? 800 : 500, fontSize: n.big ? 15 : 14 }}>{n.text}</div><div className="small mute">{n.kind.toUpperCase()} · {n.season}{n.week ? ` · week ${n.week}` : ''}</div></div>
        </div>
      ))}{!items.length && <div className="empty">No news.</div>}</div></div>
    </div>
  );
}

export function InboxScreen() {
  const L = useApp().league!;
  const [open, setOpen] = useState<number | null>(L.inbox[0]?.id ?? null);
  const m = L.inbox.find(x => x.id === open);
  if (m && !m.read) { m.read = true; setTimeout(() => app.touch(), 0); }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(260px,380px) 1fr' }}>
      <div className="card" style={{ padding: 6 }}>{L.inbox.map(x => (
        <div key={x.id} className="li" onClick={() => setOpen(x.id)} style={{ padding: 10, borderRadius: 8, background: x.id === open ? 'rgba(255,255,255,.06)' : undefined }}>
          <span style={{ color: x.read ? 'transparent' : 'var(--team2)' }}>●</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: x.read ? 500 : 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.subject}</div><div className="small mute">{x.from} · {x.season} wk {x.week}</div></div>
        </div>
      ))}{!L.inbox.length && <div className="empty">No messages.</div>}</div>
      <div className="card">{m ? <>
        <div className="up">{m.from}</div><div className="h2" style={{ margin: '6px 0 14px' }}>{m.subject}</div><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.body}</div>
        {m.action?.kind === 'trade' && <TradeOfferCard L={L} offer={m.action.offer} onDone={() => { m.action = undefined; app.touch(); }} />}
      </> : <div className="empty">Select a message.</div>}</div>
    </div>
  );
}
export function TradeOfferCard({ L, offer, onDone }: { L: League; offer: NonNullable<League['inbox'][number]['action']>['offer']; onDone: () => void }) {
  const side = (players: string[], picks: string[]) => <div className="list">{players.map(id => L.players[id] && <div key={id} className="li" onClick={() => app.go({ id: 'player', pid: id })}><PlayerCell p={L.players[id]} /><div className="spacer" /><Ovr v={L.players[id].ovr} /></div>)}{picks.map(id => { const k = L.picks.find(p => p.id === id); return k && <div key={id} className="li">◆ {pickLabel(L, k)}</div>; })}</div>;
  return (
    <div className="grid g2" style={{ marginTop: 18 }}>
      <div className="card"><h3>You receive</h3>{side(offer.give.players, offer.give.picks)}</div>
      <div className="card"><h3>You send</h3>{side(offer.get.players, offer.get.picks)}</div>
      <div className="row span2"><button className="btn primary" onClick={() => {
        const flipped = { from: L.user, to: offer.from, give: offer.get, get: offer.give };
        const v = evaluateTrade(L, flipped);
        if (!v.reason.includes('cap') && !v.reason.includes('deadline')) { executeTrade(L, flipped); app.toast('Trade completed'); onDone(); } else app.toast(v.reason);
      }}>Accept Trade</button><button className="btn" onClick={() => app.go({ id: 'trade', team: offer.from })}>Counter in Trade Center</button><button className="btn ghost" onClick={onDone}>Decline</button></div>
    </div>
  );
}

export function BoxScreen({ gid }: { gid: string }) {
  const L = useApp().league!;
  const g = L.games.find(x => x.id === gid);
  const [reel, setReel] = useState(false);
  if (!g?.result?.box) return <div className="card empty">No box score.</div>;
  const b = g.result.box;
  const teams = [g.away, g.home];
  const ps = (abbr: string, k: keyof StatLine) => Object.entries(b.players).map(([id, l]) => [L.players[id], l] as const).filter(([p, l]) => p && p.team === abbr && (l[k] ?? 0) > 0).sort((a, b2) => (b2[1][k] ?? 0) - (a[1][k] ?? 0));
  const pog = b.pog ? L.players[b.pog] : undefined;
  return (
    <div className="grid">
      {reel && g.result.hl && <HighlightReel L={L} g={g} plays={g.result.hl} onClose={() => setReel(false)} />}
      {!!g.result.hl?.length && <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={() => setReel(true)}>▶ Watch Highlights</button></div>}
      <div className="card hero">
        <div className="row" style={{ justifyContent: 'center', gap: 50, position: 'relative' }}>
          {teams.map((a, i) => <div key={a} style={{ textAlign: 'center' }}><Logo team={L.teams[a]} size={96} /><div className="h3">{L.teams[a].nick}</div><div className="h1">{i ? g.result!.hs : g.result!.as}</div></div>)}
        </div>
        <div style={{ textAlign: 'center', position: 'relative' }} className="dim">{g.week > REG_WEEKS ? ROUND_NAME[g.week] : `Week ${g.week}`} · Final{g.result.ot ? ' (OT)' : ''}</div>
      </div>
      {pressOpen(L, g, media(L).pressed) && <PressInvite gid={g.id} />}
      <div className="grid g2">
        <div className="card"><h3>Scoring by Quarter</h3><table className="tbl"><thead><tr><th>Team</th>{['1', '2', '3', '4', 'OT'].map(q => <th key={q} className="c">{q}</th>)}<th className="c">T</th></tr></thead><tbody>{teams.map((a, i) => <tr key={a}><td><b>{L.teams[a].abbr}</b></td>{b.quarters[i].map((v, j) => <td key={j} className="c">{j === 4 && !g.result!.ot ? '' : v}</td>)}<td className="c"><b>{i ? g.result!.hs : g.result!.as}</b></td></tr>)}</tbody></table>
          <h3 style={{ marginTop: 14 }}>Team Stats</h3>
          <table className="tbl"><tbody>{([['Total yards', 'yds'], ['Passing', 'pyds'], ['Rushing', 'ryds'], ['First downs', 'fd'], ['Turnovers', 'to'], ['Sacks', 'sacks'], ['Penalties', 'pen']] as const).map(([k, f]) => <tr key={k}><td className="c num">{b.teams[0][f]}</td><td className="c dim">{k}</td><td className="c num">{b.teams[1][f]}</td></tr>)}
            <tr><td className="c num">{b.teams[0].third[0]}/{b.teams[0].third[1]}</td><td className="c dim">3rd down</td><td className="c num">{b.teams[1].third[0]}/{b.teams[1].third[1]}</td></tr>
            <tr><td className="c num">{fmtTime(b.teams[0].top)}</td><td className="c dim">Possession</td><td className="c num">{fmtTime(b.teams[1].top)}</td></tr></tbody></table>
        </div>
        <div className="card"><h3>Scoring Plays</h3>{b.scoring.map((s, i) => <div key={i} className="li" style={{ cursor: 'default' }}><Logo team={L.teams[s.team]} size={24} /><span className="small mute" style={{ width: 54 }}>Q{s.q} {fmtTime(s.clock)}</span><span>{s.text}</span></div>)}
          {pog && <><h3 style={{ marginTop: 14 }}>Player of the Game</h3><div className="li" onClick={() => app.go({ id: 'player', pid: pog.id })}><Face p={pog} size={52} /><div><b>{pog.fn} {pog.ln}</b><div className="small dim">{pog.pos} · {pog.team}</div></div></div></>}
        </div>
      </div>
      <div className="grid g2">{teams.map(a => (
        <div key={a} className="card"><h3><Logo team={L.teams[a]} size={22} /> {L.teams[a].nick}</h3>
          {ps(a, 'pa').map(([p, l]) => <div key={p.id} className="small">{p.fn[0]}. {p.ln}: {l.pc}/{l.pa}, {l.py} yds, {l.ptd} TD, {l.pint} INT</div>)}
          {ps(a, 'ra').slice(0, 3).map(([p, l]) => <div key={p.id} className="small">{p.fn[0]}. {p.ln}: {l.ra} car, {l.ry} yds ({l.ra ? ((l.ry ?? 0) / l.ra).toFixed(1) : "0.0"} avg){l.rtd ? `, ${l.rtd} TD` : ''}</div>)}
          {ps(a, 'rec').slice(0, 4).map(([p, l]) => <div key={p.id} className="small">{p.fn[0]}. {p.ln}: {l.rec} rec, {l.recy} yds{l.rectd ? `, ${l.rectd} TD` : ''}</div>)}
          {ps(a, 'tkl').slice(0, 4).map(([p, l]) => <div key={p.id} className="small mute">{p.fn[0]}. {p.ln}: {l.tkl} tkl{l.dsk ? `, ${l.dsk} sk` : ''}{l.dint ? `, ${l.dint} INT` : ''}</div>)}
        </div>
      ))}</div>
    </div>
  );
}
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function HistoryScreen() {
  const L = useApp().league!;
  const P = (id?: string) => (id ? L.players[id] : undefined) as Player | undefined;
  return (
    <div className="grid">
      <div className="h2">History & Awards</div>
      {!L.awards.length && <div className="card empty">Finish a season to start writing history.</div>}
      {[...L.awards].reverse().map(a => (
        <div key={a.season} className="card">
          <div className="row" style={{ marginBottom: 12 }}><div className="h2">{a.season}</div>{a.champion && <><span className="chip" style={{ color: 'var(--gold)' }}>🏆 Champion</span><Logo team={L.teams[a.champion]} size={34} /><b>{L.teams[a.champion].name}</b></>}</div>
          <div className="grid g4">{([['MVP', a.mvp], ['Off. Player', a.opoy], ['Def. Player', a.dpoy], ['Off. Rookie', a.oroy], ['Def. Rookie', a.droy], ['Super Bowl MVP', a.sbMvp]] as const).map(([k, id]) => P(id) && (
            <div key={k} className="li" onClick={() => app.go({ id: 'player', pid: id! })}><Face p={P(id)!} size={44} /><div><div className="up">{k}</div><b>{P(id)!.fn} {P(id)!.ln}</b></div></div>
          ))}</div>
        </div>
      ))}
      {Object.keys(L.records).length > 0 && <div className="card"><h3>League Records Set</h3>{Object.entries(L.records).map(([k, r]) => r.pid && <div key={k} className="small">{k}: {r.v} — {P(r.pid)?.fn} {P(r.pid)?.ln} ({r.season})</div>)}</div>}
    </div>
  );
}
