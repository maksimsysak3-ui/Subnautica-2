import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, app, saveLeague } from '../store';
import { Logo, Face, Tabs, CountUp } from '../components';
import { FieldView } from '../field';
import { BottomLine, leagueCrawl } from '../ticker';
import { PlayDesigner, registerPlays } from '../playdesigner';
import { books, subsFor } from '../plays';
import { GameSim, type DefCall, type OffCall, type PlayEvent, ylText } from '../../sim/game';
import { applyResult, prepTeam, simWeek, advanceWeek, ROUND_NAME, REG_WEEKS, standings } from '../../core/season';
import type { League, StatLine } from '../../core/types';
import { commentary, newBooth, situationTag, ANALYST } from '../booth';
import { PrimeIntro, showFor } from '../primetime';
import { CoinToss } from '../cointoss';
import { Halftime } from '../halftime';
import { HighlightReel } from '../reel';
import { pickHighlights } from '../../sim/highlights';
import { sfx } from '../sfx';
import { PlayerOfGame } from '../potg';
import { StadiumPulse } from '../pulse';
import { CallBinder } from '../callbinder';
import { practiceWeek } from '../../core/practice';
import './gamescreen.css';

export function GameScreen({ gid }: { gid: string }) {
  const L = useApp().league!;
  const game = L.games.find(g => g.id === gid)!;
  const simRef = useRef<GameSim | null>(null);
  if (!simRef.current) { prepTeam(L, game.home); prepTeam(L, game.away); simRef.current = new GameSim(L, game); simRef.current.autoHalf = false; }
  const sim = simRef.current;
  const [, force] = useState(0);
  const [last, setLast] = useState<PlayEvent | null>(null);
  const booth = useRef(newBooth());
  const [intro, setIntro] = useState(() => !!showFor(L, game) && sim.events.length === 0);
  const [toss, setToss] = useState(() => sim.events.length === 0);
  const [anim, setAnim] = useState(false);
  const [potgSeen, setPotgSeen] = useState(false);
  // Stadium sounds for what just happened.
  useEffect(() => { if (!last || anim || auto.current && auto.current !== 'watch') return; if (last.td) sfx.crowd(); else if (last.turnover) sfx.groan(); else if (last.type === 'end' || last.type === 'kickoff' && last.n === 0) sfx.whistle(); }, [last?.n, anim]);
  const [coach, setCoach] = useState(true);
  const [pa, setPa] = useState(false);
  const [railTab, setRailTab] = useState<'Drive' | 'Stats' | 'Log'>('Drive');
  const [finished, setFinished] = useState(false);
  const [designing, setDesigning] = useState(false);
  useMemo(() => { registerPlays(L); books(L); }, [L]);
  // Kickoff: the game-time decisions from the injury report are revealed.
  useEffect(() => {
    const w = practiceWeek(L);
    if (!w.done || sim.events.length) return;
    const calls = w.injuries.filter(l => l.status === 'Questionable' || l.status === 'Doubtful').map(l => { const p = L.players[l.pid]; return p ? `${L.teams[l.team].abbr} ${p.pos} ${p.ln} (${l.status?.toLowerCase()}) is ${l.plays ? 'ACTIVE' : 'INACTIVE'}` : ''; }).filter(Boolean);
    if (calls.length) setTimeout(() => app.toast(`Game-time decisions: ${calls.join(' · ')}`), 600);
  }, []);
  const auto = useRef<null | 'drive' | 'quarter' | 'end' | 'watch'>(null);
  const home = L.teams[game.home], away = L.teams[game.away];
  const userSide = game.home === L.user ? 1 : 0;
  const onOffense = sim.poss === userSide;
  const needsCall = coach && !sim.over && !sim.pending && !auto.current;

  const step = (oc?: OffCall, dc?: DefCall) => {
    let ev = sim.step(oc, dc);
    // Skip quiet administrative events when animating.
    while (ev && (ev.type === 'end' || ev.type === 'timeout') && !sim.over && !auto.current) { setLast(ev); ev = sim.step(); }
    if (ev) { setLast(ev); setAnim(true); }
    force(x => x + 1);
    if (sim.over) setFinished(true);
  };
  const userCall = (oc?: OffCall, dc?: Omit<DefCall, 'box'>) => {
    if (onOffense) step(oc ? { ...oc, pa: oc.kind === 'pass' && oc.depth !== 'screen' ? pa : false, name: pa && oc.kind === 'pass' ? `PA ${oc.name}` : oc.name } : undefined);
    else step(undefined, dc ? { ...dc, box: dc.shell === 'Prevent' ? 6 : dc.blitz ? 7 : 6 } : undefined);
  };
  // Auto-advance for "watch" and sim modes.
  useEffect(() => {
    if (intro || toss || anim || finished || sim.halfPending) return;
    const mode = auto.current;
    if (!mode && (coach && !sim.pending)) return;
    if (!mode && !coach) { const t = setTimeout(() => step(), 350); return () => clearTimeout(t); }
    if (mode === 'watch') { const t = setTimeout(() => step(), 250); return () => clearTimeout(t); }
    if (mode) {
      const startPoss = sim.poss, startQ = sim.q;
      let guard = 0;
      const me = (sim.sides[0].abbr === L.user ? 0 : 1) as 0 | 1;
      while (!sim.over && guard++ < 400) {
        if (sim.halfPending) { if (mode === 'end') sim.setHalf(me, sim.aiHalf(me)); else break; }
        sim.step();
        if (mode === 'drive' && sim.poss !== startPoss) break;
        if (mode === 'quarter' && sim.q !== startQ) break;
      }
      auto.current = null;
      setLast(sim.events[sim.events.length - 1]); force(x => x + 1);
      if (sim.over) setFinished(true);
    } else if (sim.pending) { const t = setTimeout(() => step(), 400); return () => clearTimeout(t); }
  });
  const finish = () => app.busy('Wrapping up the week…', async () => {
    applyResult(L, game, sim);
    simWeek(L);
    advanceWeek(L);
    await saveLeague(L, `${L.id}-auto`);
    app.replace({ id: 'box', gid: game.id });
  });
  // The booth: the latest line from the last few snaps.
  if (last) commentary(L, sim, last, booth.current);
  const recentEv = [...sim.events].reverse().slice(0, 3).find(e => booth.current.byN.get(e.n) && !(anim && e.n === last?.n));
  const recentSay = recentEv ? { n: recentEv.n, text: booth.current.byN.get(recentEv.n)! } : null;
  const ev = last;
  const shown = useRef(new Map<string, StatLine>());
  // While a play animates, nothing gives away the result: the scorebug, text, log and booth
  // all hold the pre-snap picture until the replay finishes.
  const live = anim && ev && ev.type !== 'end' && ev.type !== 'timeout' ? ev : null;
  const before = live ? (sim.events[sim.events.indexOf(live) - 1]?.score ?? [0, 0]) as [number, number] : null;
  const posTeam = sim.poss === 1 ? home : away;
  // The crowd meter only moves once the play has been shown.
  const shownPulse = (anim && last ? sim.events[sim.events.indexOf(last) - 1]?.pulse : [...sim.events].reverse().find(e => e.pulse !== undefined)?.pulse) ?? sim.pulseBase * 0.6;
  // Stat lines freeze at the snap so the sidebar can't spoil the play being animated.
  if (!live) shown.current = new Map([...sim.lines].map(([k, v]) => [k, { ...v }]));
  // Nothing on the screen gets ahead of the play being shown: win probability, the drives and
  // the team stats all hold the pre-snap picture until it finishes.
  const wp = useMemo(() => sim.events.filter(e => e !== live && e.wp !== undefined).map(e => e.wp!), [sim.events.length, live?.n]);
  const shownBox = useRef(sim.box.map(b => ({ ...b, third: [...b.third] })) as typeof sim.box);
  if (!live) shownBox.current = sim.box.map(b => ({ ...b, third: [...b.third] })) as typeof sim.box;
  // The field and the play call can't both fill the screen: when it's your call the page
  // glides to the binder, and at the snap it glides back up to the field.
  const callUp = needsCall && !anim && !finished;
  useEffect(() => {
    const el = document.querySelector(callUp ? '.gs-call' : '.gs-stage');
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (callUp ? r.bottom > window.innerHeight || r.top < 0 : r.top < 0 || r.top > window.innerHeight * 0.3) el.scrollIntoView({ behavior: 'smooth', block: callUp ? 'end' : 'start' });
  }, [callUp, anim]);
  // The current drive: everything since the ball last changed hands.
  const drive = (() => {
    const evs = sim.events.filter(e => e !== live && ['run', 'pass', 'sack', 'scramble', 'penalty', 'kneel', 'spike', 'punt', 'fg'].includes(e.type));
    const lastPoss = evs[evs.length - 1]?.poss;
    let i = evs.length - 1; while (i >= 0 && evs[i].poss === lastPoss) i--;
    const d = evs.slice(i + 1);
    return { team: lastPoss === undefined ? null : lastPoss === 1 ? home : away, plays: d.length, yds: d.reduce((a, e) => a + (e.type === 'punt' || e.type === 'fg' ? 0 : e.yards), 0), start: d[0]?.yl, list: d.slice(-6).reverse() };
  })();
  const cur = wp[wp.length - 1] ?? 0.5;
  const myWp = userSide === 1 ? cur : 1 - cur;
  const me = L.teams[L.user];
  return (
    <div className="gs" style={{ '--hc': home.colors[0], '--ac': away.colors[0], '--mc': me.colors[0] } as React.CSSProperties}>
      {sim.halfPending && !intro && <Halftime L={L} sim={sim} onPick={a => { sim.setHalf((sim.sides[0].abbr === L.user ? 0 : 1) as 0 | 1, a); if (a) app.toast(`Halftime adjustment: ${a.name}`); force(x => x + 1); }} />}
      {intro && <PrimeIntro L={L} g={game} weather={sim.weather} onDone={() => setIntro(false)} />}
      {toss && !intro && <CoinToss teams={[{ name: away.nick, abbr: away.abbr, color: away.colors[0] }, { name: home.nick, abbr: home.abbr, color: home.colors[0] }]} userSide={userSide as 0 | 1} onDone={r => { sim.setToss(r); setToss(false); force(x => x + 1); }} />}
      <Scorebug L={L} sim={sim} pre={live} score={before} wp={cur} />
      <div className="gs-main">
        <div className="gs-col">
          <div className="gs-stage">
            <FieldView ev={ev && ev.type !== 'end' && ev.type !== 'timeout' && ev.type !== 'two' ? ev : null} home={home} away={away} logo={home.logo} playing={anim} huddle={!anim && !sim.over && !sim.pending ? { yl: sim.yl, poss: sim.poss as 0 | 1, down: sim.down, togo: sim.togo } : null} onDone={() => setAnim(false)} weather={sim.weather} night={+(game.time ?? '13:00').slice(0, 2) >= 19} pulse={shownPulse} overlay={<StadiumPulse sim={sim} value={shownPulse} color={home.colors[0]} />} />
          </div>
          <div className={`gs-third${live ? '' : ev?.td ? ' td' : ev?.turnover ? ' to' : ev?.big ? ' big' : ''}`} key={`l${ev?.n}`}>
            <span className="gs-third-team"><Logo team={ev ? (ev.poss === 1 ? home : away) : home} size={28} /></span>
            <div className="gs-third-txt">
              {ev && (ev.call || ev.dcall) && <div className="gs-calls">{ev.call && <span>{ev.call}</span>}{ev.dcall && <em>vs {ev.dcall}</em>}</div>}
              {live ? <b className="dim">{live.type === 'kickoff' ? 'The kick is away…' : live.type === 'punt' ? 'The punt is away…' : live.type === 'fg' || live.type === 'xp' ? 'The kick is up…' : 'The ball is snapped…'}</b>
                : <b className="reveal">{ev?.text ?? 'Kickoff is moments away.'}</b>}
            </div>
            {!live && !finished && !ev?.td && ev?.type !== 'xp' && situationTag(sim) && <span className="gs-sit">{situationTag(sim)}</span>}
          </div>
          {!live && ev && ev.poss === userSide && sim.defAdjust && (ev.type === 'run' || ev.type === 'pass' || ev.type === 'sack' || ev.type === 'scramble') && <div className="gs-adj" key={`a${ev.n}`}><b>Defense adjusts</b><span>{sim.defAdjust}</span></div>}
          {recentSay && <div className="gs-booth" key={recentSay.n}><i>🎙</i><b>{ANALYST}</b><span>{recentSay.text}</span></div>}
          {finished && !potgSeen && <PlayerOfGame L={L} sim={sim} home={home} away={away} onClose={() => setPotgSeen(true)} />}
          {finished ? <FinalCard L={L} sim={sim} onContinue={finish} lines={booth.current.byN} /> : needsCall && !anim ? (
            <section className="gs-call">
              <header className="gs-call-h">
                <div className="gs-side"><Logo team={posTeam} size={30} /><div><b>{onOffense ? 'Offense' : 'Defense'}</b><span>{down(sim)} · {ylText(sim.yl)}</span></div></div>
                <div className="gs-seg">
                  {onOffense && <button className={pa ? 'on' : ''} onClick={() => setPa(!pa)}>Play-action</button>}
                  <button onClick={() => setDesigning(true)}>✎ Draw a play</button>
                  <button onClick={() => userCall()}>Coordinator call</button>
                </div>
              </header>
              <CallBinder L={L} sim={sim} onOffense={onOffense} pa={pa} color={me.colors[0]}
                onOff={(oc, set) => step({ ...oc, pa: oc.kind === 'pass' && oc.depth !== 'screen' ? pa || oc.pa : false, name: pa && oc.kind === 'pass' && oc.depth !== 'screen' && !oc.pa ? `PA ${oc.name}` : oc.name, subs: set ? subsFor(L, set) : undefined })}
                onDef={dc => step(undefined, dc)} onSpecial={oc => step(oc)} />
            </section>
          ) : (
            <div className="gs-wait">{anim ? <span className="gs-live"><i />Live</span> : <button className="btn primary big" onClick={() => step()}>Next play ▸</button>}</div>
          )}
          {designing && <PlayDesigner L={L} side={onOffense ? 'off' : 'def'} close={() => setDesigning(false)} onSaved={n => { setDesigning(false); app.toast(`${n} added to your playbook`); force(x => x + 1); }} />}
        </div>
        <aside className="gs-rail">
          <div className="gs-dock">
            <div className="gs-seg full"><button className={coach ? 'on' : ''} onClick={() => setCoach(true)}>Call plays</button><button className={!coach ? 'on' : ''} onClick={() => setCoach(false)}>Watch</button></div>
            <button className="gs-to" disabled={finished || anim || sim.sides[userSide].timeouts <= 0} title="Stop the clock" onClick={() => { const e = sim.callTimeout(userSide as 0 | 1); if (e) { setLast(e); force(x => x + 1); app.toast(e.text); } }}>
              <span>Timeout</span><i className="gs-pips">{[0, 1, 2].map(k => <b key={k} className={k < sim.sides[userSide].timeouts ? 'on' : ''} />)}</i>
            </button>
            <div className="gs-sims"><span>Sim</span>{([['drive', 'Drive'], ['quarter', 'Quarter'], ['end', 'To end']] as const).map(([k, l]) => <button key={k} disabled={finished} onClick={() => { auto.current = k; force(x => x + 1); }}>{l}</button>)}</div>
            <button className="gs-leave" onClick={() => app.replace({ id: 'hub' })}>Leave game</button>
          </div>
          <div className="gs-wp">
            <div className="gs-wp-top"><span>Win probability</span><b style={{ color: myWp >= 0.5 ? '#7ff0b0' : '#ff9b9b' }}>{Math.round(myWp * 100)}%</b><em>{me.nick}</em></div>
            <WinChart wp={wp} home={home} away={away} />
          </div>
          <div className="gs-panel">
            <Tabs tabs={['Drive', 'Stats', 'Log'] as const} on={railTab} set={setRailTab} />
            {railTab === 'Drive' && <div className="gs-drive">
              {drive.team ? <div className="gs-drive-h"><Logo team={drive.team} size={22} /><b>{drive.team.nick} drive</b><span>{drive.plays} plays · {drive.yds} yds{drive.start !== undefined ? ` · from ${ylText(drive.start)}` : ''}</span></div> : <div className="small mute">No drive yet.</div>}
              {drive.list.map(e => <div key={e.n} className={`gs-dp${e.td ? ' td' : e.turnover ? ' to' : ''}`}><span>{['', '1st', '2nd', '3rd', '4th'][e.down] ?? ''}&{e.togo}</span><p>{e.text}</p></div>)}
              <div className="gs-sub">All drives</div><DriveChart sim={sim} hide={live} />
            </div>}
            {railTab === 'Stats' && <div className="gs-stats"><TeamCompare L={L} sim={sim} box={shownBox.current} /><div className="gs-sub">Key players</div><KeyPlayers L={L} sim={sim} lines={shown.current} /><div className="gs-sub">Box score</div><LiveBox L={L} sim={sim} lines={shown.current} box={shownBox.current} /></div>}
            {railTab === 'Log' && <div className="gs-log">{[...sim.events].reverse().filter(e => e !== live).slice(0, 120).map(e => (
              <div key={e.n} className={`gs-lr${e.td ? ' td' : e.turnover ? ' to' : ''}`}>
                <Logo team={e.poss === 1 ? home : away} size={18} /><span>Q{Math.min(e.q, 5) === 5 ? 'OT' : e.q} {clock(e.clock)}</span>
                <p>{e.text}{booth.current.byN.get(e.n) ? <em>{booth.current.byN.get(e.n)}</em> : null}</p>
              </div>))}</div>}
          </div>
          <div className="gs-wx">{sim.weather.dome ? 'Indoors' : `${sim.weather.temp}°F · wind ${sim.weather.wind} mph${sim.weather.precip !== 'none' ? ` · ${sim.weather.precip}` : ''}`} · {game.neutral ?? home.stadium}</div>
        </aside>
      </div>
      <BottomLine tag="BottomLine" items={leagueCrawl(L, { away: away.abbr, home: home.abbr, as: sim.score[0], hs: sim.score[1], status: sim.over ? 'Final' : sim.q > 4 ? `OT ${clock(sim.clock)}` : `Q${sim.q} ${clock(sim.clock)}` })} />
    </div>
  );
}

/** Team stats side by side, as broadcast comparison bars. */
function TeamCompare({ L, sim, box }: { L: League; sim: GameSim; box: GameSim['box'] }) {
  const [a, h] = box;
  const rows: [string, number, number, string?][] = [['Total yards', a.yds, h.yds], ['Passing', a.pyds, h.pyds], ['Rushing', a.ryds, h.ryds], ['First downs', a.fd, h.fd], ['3rd down', a.third[0], h.third[0], `${a.third[0]}/${a.third[1]} · ${h.third[0]}/${h.third[1]}`], ['Turnovers', a.to, h.to], ['Penalties', a.pen, h.pen]];
  const ta = L.teams[sim.game.away], th = L.teams[sim.game.home];
  return <div className="gs-cmp"><div className="gs-cmp-h"><span><Logo team={ta} size={18} />{ta.abbr}</span><span>{th.abbr}<Logo team={th} size={18} /></span></div>
    {rows.map(([k, x, y, note]) => { const t = Math.max(1, x + y); return (
      <div key={k} className="gs-cmp-r"><b>{note ? note.split(' · ')[0] : x}</b><div><i className="a" style={{ width: `${(x / t) * 100}%` }} /><span>{k}</span><i className="h" style={{ width: `${(y / t) * 100}%` }} /></div><b>{note ? note.split(' · ')[1] : y}</b></div>); })}
  </div>;
}

function Scorebug({ L, sim, pre, score, wp }: { L: League; sim: GameSim; pre?: PlayEvent | null; score?: [number, number] | null; wp: number }) {
  const sc = score ?? sim.score;
  const sides = [L.teams[sim.game.away], L.teams[sim.game.home]];
  const poss = pre ? pre.poss : sim.poss;
  const status = pre ? (pre.type === 'kickoff' ? 'Kickoff' : pre.type === 'xp' || pre.type === 'two' ? 'Extra point' : `${down(pre)}`) : sim.over ? '' : sim.pending === 'kickoff' ? 'Kickoff' : sim.pending === 'pat' ? 'Extra point' : down(sim);
  const spot = pre ? (pre.type === 'kickoff' || pre.type === 'xp' ? '' : ylText(pre.yl)) : sim.over || sim.pending ? '' : ylText(sim.yl);
  return (
    <div className="gs-bug">
      {[0, 1].map(i => {
        const t = sides[i], has = poss === i && (!!pre || !sim.over);
        return (
          <div key={i} className={`gs-bt ${i ? 'h' : 'a'}${has ? ' has' : ''}`} style={{ '--tc': t.colors[0], '--tc2': t.colors[1] ?? '#fff' } as React.CSSProperties}>
            <Logo team={t} size={46} />
            <div className="gs-bn"><b>{t.abbr}</b><span>{t.nick}</span><i className="gs-pips">{[0, 1, 2].map(k => <b key={k} className={k < sim.sides[i].timeouts ? 'on' : ''} />)}</i></div>
            {has && <span className="gs-ball" title="Possession">●</span>}
            <div className="gs-score"><CountUp v={sc[i]} dur={500} /></div>
          </div>
        );
      })}
      <div className="gs-bc">
        <div className="gs-q">{(pre || !sim.over) && <span className="live-dot" />}{pre ? (pre.q >= 5 ? 'OT' : `Q${pre.q}`) : sim.over ? 'Final' : sim.q >= 5 ? 'OT' : `Q${sim.q}`}</div>
        <div className="gs-clock">{pre ? clock(pre.clock) : sim.over ? (sim.ot ? 'F/OT' : 'FINAL') : clock(sim.clock)}</div>
        {status && <div className="gs-dd"><b>{status}</b>{spot && <span>{spot}</span>}</div>}
      </div>
      <div className="gs-wpbar"><i className="a" style={{ width: `${(1 - wp) * 100}%` }} /><i className="h" style={{ width: `${wp * 100}%` }} /></div>
    </div>
  );
}
function WinChart({ wp, home, away }: { wp: number[]; home: { abbr: string; colors: string[] }; away: { abbr: string; colors: string[] } }) {
  const w = 320, h = 120;
  const pts = wp.map((v, i) => `${(i / Math.max(1, wp.length - 1)) * w},${h - v * h}`).join(' ');
  const cur = wp[wp.length - 1] ?? 0.5;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: 'block' }}>
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,.15)" strokeDasharray="4 4" />
        <polyline points={pts} fill="none" stroke="var(--team2)" strokeWidth="2.5" />
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#wpg)" opacity=".35" />
        <defs><linearGradient id="wpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={home.colors[0]} /><stop offset="1" stopColor={away.colors[0]} /></linearGradient></defs>
      </svg>
      <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{away.abbr} {Math.round((1 - cur) * 100)}%</span><span className="small">{home.abbr} {Math.round(cur * 100)}%</span></div>
    </div>
  );
}
function LiveBox({ L, sim, lines, box }: { L: League; sim: GameSim; lines: Map<string, StatLine>; box: GameSim['box'] }) {
  const rows = (k: keyof StatLine, fmt: (l: StatLine) => string) => [...lines.entries()].filter(([, l]) => (l[k] as number) > 0).sort((a, b) => (b[1][k] as number) - (a[1][k] as number)).slice(0, 6).map(([id, l]) => { const p = L.players[id]; return <div key={id} className="row small" style={{ margin: '3px 0' }}><Logo team={L.teams[p.team]} size={16} /><b style={{ width: 120 }}>{p.fn[0]}. {p.ln}</b><span className="dim">{fmt(l)}</span></div>; });
  return (
    <div className="grid g2">
      <div><div className="up">Passing</div>{rows('pa', l => `${l.pc}/${l.pa}, ${l.py} yds, ${l.ptd} TD, ${l.pint} INT`)}</div>
      <div><div className="up">Rushing</div>{rows('ra', l => `${l.ra} car, ${l.ry} yds (${l.ra ? (l.ry / l.ra).toFixed(1) : '0.0'} avg), ${l.rtd} TD`)}</div>
      <div><div className="up">Receiving</div>{rows('rec', l => `${l.rec} rec, ${l.recy} yds, ${l.rectd} TD`)}</div>
      <div><div className="up">Defense</div>{rows('tkl', l => `${l.tkl} tkl${l.dsk ? `, ${l.dsk} sk` : ''}${l.dint ? `, ${l.dint} INT` : ''}`)}</div>
      <div className="span2"><div className="up">Team</div>{(['away', 'home'] as const).map((s, i) => <div key={s} className="small">{L.teams[i ? sim.game.home : sim.game.away].abbr}: {box[i].yds} yds ({box[i].pyds} pass, {box[i].ryds} rush), {box[i].fd} first downs, {box[i].to} TO, {box[i].pen} pen, 3rd {box[i].third[0]}/{box[i].third[1]}</div>)}</div>
    </div>
  );
}
function DriveChart({ sim, hide }: { sim: GameSim; hide?: PlayEvent | null }) {
  const drives: { poss: number; start: number; plays: number; yds: number; result: string }[] = [];
  let cur: typeof drives[number] | null = null;
  for (const e of sim.events) {
    if (e === hide || !['run', 'pass', 'sack', 'scramble', 'punt', 'fg', 'penalty', 'kneel', 'spike'].includes(e.type)) continue;
    if (!cur || cur.poss !== e.poss) { cur = { poss: e.poss, start: e.yl, plays: 0, yds: 0, result: '' }; drives.push(cur); }
    cur.plays++; cur.yds += e.type === 'punt' || e.type === 'fg' ? 0 : e.yards;
    cur.result = e.td ? 'TD' : e.type === 'fg' ? (e.turnover ? 'Missed FG' : 'FG') : e.type === 'punt' ? 'Punt' : e.turnover ? 'Turnover' : '…';
  }
  const L = sim.league;
  return <div className="list">{drives.map((d, i) => { const t = L.teams[d.poss ? sim.game.home : sim.game.away]; return (
    <div key={i} className="row" style={{ margin: '4px 0' }}><Logo team={t} size={18} /><span className="small" style={{ width: 70 }}>{ylText(d.start)}</span>
      <div style={{ flex: 1, height: 10, background: '#141c30', borderRadius: 6, position: 'relative' }}><div style={{ position: 'absolute', left: `${d.start}%`, width: `${Math.max(1, Math.min(100 - d.start, Math.max(0, d.yds)))}%`, top: 0, bottom: 0, background: t.colors[0], borderRadius: 6 }} /></div>
      <span className="small" style={{ width: 70, textAlign: 'right', color: d.result === 'TD' ? 'var(--good)' : d.result === 'Turnover' ? 'var(--bad)' : undefined }}>{d.result} · {d.plays}p</span></div>); })}</div>;
}
function KeyPlayers({ L, sim, lines }: { L: League; sim: GameSim; lines: Map<string, StatLine> }) {
  const score = (l: StatLine) => l.py * 0.04 + l.ptd * 4 + (l.ry + l.recy) * 0.1 + (l.rtd + l.rectd) * 6 + l.dsk * 4 + l.dint * 5 + l.tkl * 0.5;
  const top = [...lines.entries()].sort((a, b) => score(b[1]) - score(a[1])).slice(0, 4);
  return <>{top.map(([id, l]) => { const p = L.players[id]; return <div key={id} className="li" style={{ cursor: 'default' }}><Face p={p} size={40} /><div style={{ flex: 1 }}><b>{p.fn[0]}. {p.ln}</b><div className="small mute">{statLine(p.pos, l)}</div></div>{sim.sides.some(s => s.zoneOn.has(id)) && <span className="chip" style={{ color: '#fff', background: '#b91c1c' }}>ZONE</span>}</div>; })}{!top.length && <div className="empty">—</div>}</>;
}
const statLine = (pos: string, l: StatLine) => pos === 'QB' ? `${l.pc}/${l.pa} ${l.py} yds ${l.ptd} TD` : l.ra >= l.rec && l.ra ? `${l.ra}-${l.ry} ${l.rtd} TD` : l.rec ? `${l.rec}-${l.recy} ${l.rectd} TD` : `${l.tkl} tkl ${l.dsk ? `${l.dsk} sk` : ''}${l.dint ? ` ${l.dint} INT` : ''}`;
function FinalCard({ L, sim, onContinue, lines }: { L: League; sim: GameSim; onContinue: () => void; lines: Map<number, string> }) {
  const r = sim.result();
  const [reel, setReel] = useState(false);
  const plays = pickHighlights(sim.events);
  const pog = r.box.pog ? L.players[r.box.pog] : undefined;
  const userWon = (sim.game.home === L.user ? r.hs > r.as : r.as > r.hs);
  return (
    <div className="card hero fade-in" style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative' }}>
        <div className="up" style={{ color: 'var(--gold)' }}>{sim.game.week > REG_WEEKS ? ROUND_NAME[sim.game.week] : `Week ${sim.game.week}`} · Final{r.ot ? ' / OT' : ''}</div>
        <div className="h1" style={{ margin: '8px 0', color: userWon ? 'var(--good)' : r.hs === r.as ? undefined : 'var(--bad)' }}>{userWon ? 'Victory' : r.hs === r.as ? 'Tie' : 'Defeat'}</div>
        {pog && <div className="row" style={{ justifyContent: 'center', margin: '10px 0' }}><Face p={pog} size={64} /><div style={{ textAlign: 'left' }}><div className="up">Player of the Game</div><b className="h3">{pog.fn} {pog.ln}</b></div></div>}
        <div className="row" style={{ justifyContent: 'center' }}>{plays.length > 0 && <button className="btn big" onClick={() => setReel(true)}>▶ Watch Highlights</button>}<button className="btn gold big" onClick={onContinue}>Continue ▸</button></div>
        {reel && <HighlightReel L={L} g={{ ...sim.game, result: { hs: r.hs, as: r.as, ot: r.ot } }} plays={plays} lines={lines} onClose={() => setReel(false)} />}
        <div className="small dim" style={{ marginTop: 8 }}>{L.teams[L.user].nick} now {standings(L)[L.user].w + (userWon ? 1 : 0)}-{standings(L)[L.user].l + (!userWon && r.hs !== r.as ? 1 : 0)}</div>
      </div>
    </div>
  );
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const down = (sim: { down: number; yl: number; togo: number }) => `${['', '1st', '2nd', '3rd', '4th'][sim.down]} & ${sim.yl + sim.togo >= 100 ? 'Goal' : sim.togo}`;

