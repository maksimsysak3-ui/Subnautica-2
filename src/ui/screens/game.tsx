import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, app, saveLeague } from '../store';
import { Logo, Face, Tabs, CountUp } from '../components';
import { FieldView } from '../field';
import { BottomLine, leagueCrawl } from '../ticker';
import { PlayDiagram } from '../playart';
import { PlayDesigner, registerPlays, callFor } from '../playdesigner';
import { GameSim, type DefCall, type OffCall, type PlayEvent, ylText } from '../../sim/game';
import { applyResult, prepTeam, simWeek, advanceWeek, ROUND_NAME, REG_WEEKS, standings } from '../../core/season';
import type { League, StatLine } from '../../core/types';

const OFF_PLAYS: { name: string; call: OffCall; icon: string; desc: string }[] = [
  { name: 'Inside Zone', call: { kind: 'run', run: 'inside', name: 'Inside Zone' }, icon: '⬆', desc: 'Downhill between the tackles' },
  { name: 'Outside Zone', call: { kind: 'run', run: 'outside', name: 'Outside Zone' }, icon: '↗', desc: 'Stretch the edge, cut back' },
  { name: 'QB Keep', call: { kind: 'run', run: 'qb', name: 'QB Keep' }, icon: '⚡', desc: 'Designed quarterback run' },
  { name: 'Quick Slants', call: { kind: 'pass', depth: 'quick', name: 'Quick Slants' }, icon: '↘', desc: 'Ball out fast, beats the blitz' },
  { name: 'Curl Flat', call: { kind: 'pass', depth: 'short', name: 'Curl Flat' }, icon: '↩', desc: 'Short, high-percentage' },
  { name: 'Dig', call: { kind: 'pass', depth: 'medium', name: 'Dig' }, icon: '→', desc: 'Intermediate in-breakers' },
  { name: 'Four Verticals', call: { kind: 'pass', depth: 'deep', name: 'Four Verticals' }, icon: '⇈', desc: 'Take a shot downfield' },
  { name: 'Screen', call: { kind: 'pass', depth: 'screen', name: 'Screen' }, icon: '⤺', desc: 'Let the rush come, dump it off' },
];
const DEF_PLAYS: { name: string; call: Omit<DefCall, 'box'>; desc: string }[] = [
  { name: 'Cover 2', call: { shell: 'Cover 2', blitz: false, name: 'Cover 2' }, desc: 'Two deep safeties, squat corners' },
  { name: 'Cover 3', call: { shell: 'Cover 3', blitz: false, name: 'Cover 3' }, desc: 'Three deep, four under' },
  { name: 'Cover 4', call: { shell: 'Cover 4', blitz: false, name: 'Cover 4' }, desc: 'Quarters: nothing over the top' },
  { name: 'Cover 1 Man', call: { shell: 'Cover 1', blitz: false, name: 'Cover 1' }, desc: 'Man coverage, one robber' },
  { name: 'Cover 1 Blitz', call: { shell: 'Cover 1', blitz: true, name: 'Cover 1 Blitz' }, desc: 'Send five, man behind' },
  { name: 'Cover 0 Blitz', call: { shell: 'Cover 0', blitz: true, name: 'Cover 0 Blitz' }, desc: 'All-out pressure, no help' },
  { name: 'Prevent', call: { shell: 'Prevent', blitz: false, name: 'Prevent' }, desc: 'Keep everything in front' },
];

export function GameScreen({ gid }: { gid: string }) {
  const L = useApp().league!;
  const game = L.games.find(g => g.id === gid)!;
  const simRef = useRef<GameSim | null>(null);
  if (!simRef.current) { prepTeam(L, game.home); prepTeam(L, game.away); simRef.current = new GameSim(L, game); }
  const sim = simRef.current;
  const [, force] = useState(0);
  const [last, setLast] = useState<PlayEvent | null>(null);
  const [anim, setAnim] = useState(false);
  const [coach, setCoach] = useState(true);
  const [pa, setPa] = useState(false);
  const [box, setBox] = useState<'Play-by-Play' | 'Box Score' | 'Drive Chart'>('Play-by-Play');
  const [finished, setFinished] = useState(false);
  const [designing, setDesigning] = useState(false);
  useMemo(() => registerPlays(L), [L]);
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
    if (anim || finished) return;
    const mode = auto.current;
    if (!mode && (coach && !sim.pending)) return;
    if (!mode && !coach) { const t = setTimeout(() => step(), 350); return () => clearTimeout(t); }
    if (mode === 'watch') { const t = setTimeout(() => step(), 250); return () => clearTimeout(t); }
    if (mode) {
      const startPoss = sim.poss, startQ = sim.q;
      let guard = 0;
      while (!sim.over && guard++ < 400) {
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
  const wp = useMemo(() => sim.events.filter(e => e.wp !== undefined).map(e => e.wp!), [sim.events.length]);
  const ev = last;
  const posTeam = sim.poss === 1 ? home : away;
  return (
    <div style={{ padding: '16px 20px 70px', maxWidth: 1500, margin: '0 auto' }}>
      <Scorebug L={L} sim={sim} />
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 360px', marginTop: 14, alignItems: 'start' }}>
        <div className="grid" style={{ gap: 12 }}>
          <div className="card" style={{ padding: 10, background: 'linear-gradient(180deg,#0b1424,#070b14)' }}>
            <FieldView ev={ev && ev.type !== 'end' && ev.type !== 'timeout' && ev.type !== 'penalty' && ev.type !== 'kneel' && ev.type !== 'spike' && ev.type !== 'two' ? ev : null} home={home} away={away} logo={home.logo} playing={anim} onDone={() => setAnim(false)} weather={sim.weather} night={+(game.time ?? '13:00').slice(0, 2) >= 19} />
            <div className="row" style={{ padding: '10px 6px 2px' }}>
              {ev && <><span className="chip">{ev.call ?? ev.type}</span>{ev.dcall && <span className="chip">vs {ev.dcall}</span>}</>}
              <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }} className={ev?.big ? 'gold' : ''}>{ev?.text ?? 'Kickoff is moments away.'}</div>
            </div>
          </div>
          {finished ? <FinalCard L={L} sim={sim} onContinue={finish} /> : needsCall ? (
            <div className="card">
              <div className="row" style={{ marginBottom: 10 }}><Logo team={posTeam} size={26} /><b className="h3">{onOffense ? 'Offensive Play Call' : 'Defensive Play Call'}</b><span className="dim small">{down(sim)} · {ylText(sim.yl)}</span><div className="spacer" />
                {onOffense && <span className={`chip${pa ? ' on' : ''}`} onClick={() => setPa(!pa)}>Play-Action</span>}
                {onOffense && <button className="btn sm" onClick={() => setDesigning(true)}>✎ Draw a Play</button>}
                <button className="btn sm" onClick={() => userCall()}>Coordinator Call (AI)</button></div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(172px,1fr))', gap: 10 }}>
                {onOffense ? <>
                  {OFF_PLAYS.filter(p => p.call.run !== 'qb' || (sim.league.players[sim.sides[userSide].team.depth.QB?.[0] ?? '']?.attrs.SPD ?? 0) >= 78).map(p => <PlayCard key={p.name} title={pa && p.call.kind === 'pass' && p.call.depth !== 'screen' ? `PA ${p.name}` : p.name} icon={p.icon} desc={p.desc} art={pa && p.call.kind === 'pass' && p.call.depth !== 'screen' ? `PA ${p.name}` : p.name} onClick={() => userCall(p.call)} />)}
                  {(L.customPlays ?? []).map(cp => <PlayCard key={`c-${cp.name}`} title={cp.name} icon="✎" desc={`Your ${cp.type} play`} art={cp.name} onClick={() => step(callFor(cp))} />)}
                  {sim.down === 4 && <><PlayCard title="Punt" icon="⤴" desc="Flip the field" onClick={() => step({ kind: 'punt', name: 'Punt' })} /><PlayCard title="Field Goal" icon="⊓" desc={`${100 - sim.yl + 17} yards`} onClick={() => step({ kind: 'fg', name: 'Field Goal' })} /></>}
                  <PlayCard title="Kneel" icon="⤓" desc="Burn the clock" onClick={() => step({ kind: 'kneel', name: 'Kneel' })} />
                  {(sim.q === 2 || sim.q >= 4) && sim.clock < 120 && <PlayCard title="Spike" icon="⏱" desc="Stop the clock" onClick={() => step({ kind: 'spike', name: 'Spike' })} />}
                </> : DEF_PLAYS.map(p => <PlayCard key={p.name} title={p.name} icon={p.call.blitz ? '⚡' : '▣'} desc={p.desc} art={p.call.name} def onClick={() => userCall(undefined, p.call)} />)}
              </div>
            </div>
          ) : (
            <div className="card row" style={{ justifyContent: 'center' }}>{anim ? <span className="dim">…</span> : <button className="btn primary" onClick={() => step()}>Next Play ▸</button>}</div>
          )}
          {designing && <PlayDesigner L={L} close={() => setDesigning(false)} onSaved={cp => { setDesigning(false); app.toast(`${cp.name} added to your playbook`); force(x => x + 1); }} />}
          <div className="card">
            <Tabs tabs={['Play-by-Play', 'Box Score', 'Drive Chart'] as const} on={box} set={setBox} />
            {box === 'Play-by-Play' && <div className="scroll" style={{ maxHeight: 340, border: 0 }}>{[...sim.events].reverse().slice(0, 120).map(e => (
              <div key={e.n} className="li" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <Logo team={e.poss === 1 ? home : away} size={20} /><span className="small mute" style={{ width: 92, flex: 'none' }}>Q{Math.min(e.q, 5) === 5 ? 'OT' : e.q} {clock(e.clock)} {e.type !== 'kickoff' && e.type !== 'xp' && e.type !== 'two' ? `${['', '1st', '2nd', '3rd', '4th'][e.down] ?? ''}&${e.togo}` : ''}</span>
                <span style={{ fontWeight: e.td || e.turnover ? 700 : 400, color: e.td ? 'var(--good)' : e.turnover ? 'var(--bad)' : undefined }}>{e.text}</span>
              </div>
            ))}</div>}
            {box === 'Box Score' && <LiveBox L={L} sim={sim} />}
            {box === 'Drive Chart' && <DriveChart sim={sim} />}
          </div>
        </div>
        <div className="grid" style={{ gap: 12, position: 'sticky', top: 12 }}>
          <div className="card"><h3>Win Probability</h3><WinChart wp={wp} home={home} away={away} /></div>
          <div className="card"><h3>Game Control</h3>
            <div className="row" style={{ marginBottom: 10 }}><span className={`chip${coach ? ' on' : ''}`} onClick={() => setCoach(true)}>Call Plays</span><span className={`chip${!coach ? ' on' : ''}`} onClick={() => setCoach(false)}>Watch (AI Calls)</span></div>
            <div className="grid g2" style={{ gap: 8 }}>
              <button className="btn" disabled={finished} onClick={() => { auto.current = 'drive'; force(x => x + 1); }}>Sim Drive</button>
              <button className="btn" disabled={finished} onClick={() => { auto.current = 'quarter'; force(x => x + 1); }}>Sim Quarter</button>
              <button className="btn" disabled={finished} onClick={() => { auto.current = 'end'; force(x => x + 1); }}>Sim to End</button>
              <button className="btn" onClick={() => app.replace({ id: 'hub' })}>Leave (save later)</button>
            </div>
            <div className="small dim" style={{ marginTop: 10 }}>{sim.weather.dome ? 'Indoors' : `${sim.weather.temp}°F · wind ${sim.weather.wind} mph${sim.weather.precip !== 'none' ? ` · ${sim.weather.precip}` : ''}`} · {game.neutral ?? home.stadium}</div>
          </div>
          <div className="card"><h3>Key Players</h3><KeyPlayers L={L} sim={sim} /></div>
        </div>
      </div>
      <BottomLine tag="BottomLine" items={leagueCrawl(L, { away: away.abbr, home: home.abbr, as: sim.score[0], hs: sim.score[1], status: sim.over ? 'Final' : sim.q > 4 ? `OT ${clock(sim.clock)}` : `Q${sim.q} ${clock(sim.clock)}` })} />
    </div>
  );
}

function Scorebug({ L, sim }: { L: League; sim: GameSim }) {
  const sides = [L.teams[sim.game.away], L.teams[sim.game.home]];
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#060a13' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'stretch' }}>
        {[0, 1].map(i => {
          const t = sides[i];
          const side = i === 0 ? 'row' : 'row-reverse';
          const has = sim.poss === i && !sim.over;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: side as 'row', alignItems: 'center', gap: 14, padding: '12px 18px', background: `linear-gradient(${i === 0 ? '90deg' : '270deg'}, ${t.colors[0]}, ${t.colors[0]}55 70%, transparent)`, gridColumn: i === 0 ? 1 : 3 }}>
              <Logo team={t} size={60} />
              <div style={{ textAlign: i === 0 ? 'left' : 'right' }}><div className="h3">{t.nick}{has && ' ◂'}</div><div style={{ letterSpacing: 3, color: 'var(--team2)' }}>{'▮'.repeat(sim.sides[i].timeouts)}<span className="mute">{'▯'.repeat(Math.max(0, 3 - sim.sides[i].timeouts))}</span></div></div>
              <div style={{ font: '900 54px/1 var(--head)', margin: i === 0 ? '0 0 0 auto' : '0 auto 0 0' }}><CountUp v={sim.score[i]} dur={500} /></div>
            </div>
          );
        })}
        <div style={{ gridColumn: 2, gridRow: 1, padding: '10px 22px', textAlign: 'center', background: '#0b1222', borderLeft: '1px solid var(--line)', borderRight: '1px solid var(--line)', minWidth: 170 }}>
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>{!sim.over && <span className="live-dot" />}<span className="up">{sim.over ? 'Final' : sim.q >= 5 ? 'OT' : `Q${sim.q}`}</span></div>
          <div style={{ font: '800 34px/1.1 var(--head)' }}>{sim.over ? (sim.ot ? 'F/OT' : 'FINAL') : clock(sim.clock)}</div>
          <div className="small" style={{ color: 'var(--warn)', fontWeight: 700 }}>{sim.over ? '' : sim.pending === 'kickoff' ? 'Kickoff' : sim.pending === 'pat' ? 'Extra point' : `${down(sim)} · ${ylText(sim.yl)}`}</div>
        </div>
      </div>
    </div>
  );
}
/** Madden-style play card: the play art on top, name and note below. */
function PlayCard({ title, icon, desc, onClick, art, def }: { title: string; icon: string; desc: string; onClick: () => void; art?: string; def?: boolean }) {
  return (
    <button onClick={onClick} className="playcard">
      {art ? <PlayDiagram name={art} def={def} w={170} h={98} /> : <div style={{ height: 98, display: 'grid', placeItems: 'center', fontSize: 34, background: 'linear-gradient(180deg,#1d4d2a,#163d21)' }}>{icon}</div>}
      <div style={{ padding: '8px 10px 10px' }}><div className="h3" style={{ fontSize: 17 }}>{title}</div><div className="small dim">{desc}</div></div>
    </button>
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
function LiveBox({ L, sim }: { L: League; sim: GameSim }) {
  const rows = (k: keyof StatLine, fmt: (l: StatLine) => string) => [...sim.lines.entries()].filter(([, l]) => (l[k] as number) > 0).sort((a, b) => (b[1][k] as number) - (a[1][k] as number)).slice(0, 6).map(([id, l]) => { const p = L.players[id]; return <div key={id} className="row small" style={{ margin: '3px 0' }}><Logo team={L.teams[p.team]} size={16} /><b style={{ width: 120 }}>{p.fn[0]}. {p.ln}</b><span className="dim">{fmt(l)}</span></div>; });
  return (
    <div className="grid g2">
      <div><div className="up">Passing</div>{rows('pa', l => `${l.pc}/${l.pa}, ${l.py} yds, ${l.ptd} TD, ${l.pint} INT`)}</div>
      <div><div className="up">Rushing</div>{rows('ra', l => `${l.ra} car, ${l.ry} yds (${l.ra ? (l.ry / l.ra).toFixed(1) : '0.0'} avg), ${l.rtd} TD`)}</div>
      <div><div className="up">Receiving</div>{rows('rec', l => `${l.rec} rec, ${l.recy} yds, ${l.rectd} TD`)}</div>
      <div><div className="up">Defense</div>{rows('tkl', l => `${l.tkl} tkl${l.dsk ? `, ${l.dsk} sk` : ''}${l.dint ? `, ${l.dint} INT` : ''}`)}</div>
      <div className="span2"><div className="up">Team</div>{(['away', 'home'] as const).map((s, i) => <div key={s} className="small">{L.teams[i ? sim.game.home : sim.game.away].abbr}: {sim.box[i].yds} yds ({sim.box[i].pyds} pass, {sim.box[i].ryds} rush), {sim.box[i].fd} first downs, {sim.box[i].to} TO, {sim.box[i].pen} pen, 3rd {sim.box[i].third[0]}/{sim.box[i].third[1]}</div>)}</div>
    </div>
  );
}
function DriveChart({ sim }: { sim: GameSim }) {
  const drives: { poss: number; start: number; plays: number; yds: number; result: string }[] = [];
  let cur: typeof drives[number] | null = null;
  for (const e of sim.events) {
    if (!['run', 'pass', 'sack', 'scramble', 'punt', 'fg', 'penalty', 'kneel', 'spike'].includes(e.type)) continue;
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
function KeyPlayers({ L, sim }: { L: League; sim: GameSim }) {
  const score = (l: StatLine) => l.py * 0.04 + l.ptd * 4 + (l.ry + l.recy) * 0.1 + (l.rtd + l.rectd) * 6 + l.dsk * 4 + l.dint * 5 + l.tkl * 0.5;
  const top = [...sim.lines.entries()].sort((a, b) => score(b[1]) - score(a[1])).slice(0, 4);
  return <>{top.map(([id, l]) => { const p = L.players[id]; return <div key={id} className="li" style={{ cursor: 'default' }}><Face p={p} size={40} /><div style={{ flex: 1 }}><b>{p.fn[0]}. {p.ln}</b><div className="small mute">{statLine(p.pos, l)}</div></div>{sim.sides.some(s => s.zoneOn.has(id)) && <span className="chip" style={{ color: '#fff', background: '#b91c1c' }}>ZONE</span>}</div>; })}{!top.length && <div className="empty">—</div>}</>;
}
const statLine = (pos: string, l: StatLine) => pos === 'QB' ? `${l.pc}/${l.pa} ${l.py} yds ${l.ptd} TD` : l.ra >= l.rec && l.ra ? `${l.ra}-${l.ry} ${l.rtd} TD` : l.rec ? `${l.rec}-${l.recy} ${l.rectd} TD` : `${l.tkl} tkl ${l.dsk ? `${l.dsk} sk` : ''}${l.dint ? ` ${l.dint} INT` : ''}`;
function FinalCard({ L, sim, onContinue }: { L: League; sim: GameSim; onContinue: () => void }) {
  const r = sim.result();
  const pog = r.box.pog ? L.players[r.box.pog] : undefined;
  const userWon = (sim.game.home === L.user ? r.hs > r.as : r.as > r.hs);
  return (
    <div className="card hero fade-in" style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative' }}>
        <div className="up" style={{ color: 'var(--gold)' }}>{sim.game.week > REG_WEEKS ? ROUND_NAME[sim.game.week] : `Week ${sim.game.week}`} · Final{r.ot ? ' / OT' : ''}</div>
        <div className="h1" style={{ margin: '8px 0', color: userWon ? 'var(--good)' : r.hs === r.as ? undefined : 'var(--bad)' }}>{userWon ? 'Victory' : r.hs === r.as ? 'Tie' : 'Defeat'}</div>
        {pog && <div className="row" style={{ justifyContent: 'center', margin: '10px 0' }}><Face p={pog} size={64} /><div style={{ textAlign: 'left' }}><div className="up">Player of the Game</div><b className="h3">{pog.fn} {pog.ln}</b></div></div>}
        <button className="btn gold big" onClick={onContinue}>Continue ▸</button>
        <div className="small dim" style={{ marginTop: 8 }}>{L.teams[L.user].nick} now {standings(L)[L.user].w + (userWon ? 1 : 0)}-{standings(L)[L.user].l + (!userWon && r.hs !== r.as ? 1 : 0)}</div>
      </div>
    </div>
  );
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const down = (sim: GameSim) => `${['', '1st', '2nd', '3rd', '4th'][sim.down]} & ${sim.yl + sim.togo >= 100 ? 'Goal' : sim.togo}`;
