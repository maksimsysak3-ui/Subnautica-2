// Game day. The live engine plays every snap on the animated pixel field; you coach it from a
// call sheet. Offense: pick the play (by type, by formation, or from the coach's sheet ranked for
// this down, distance and field position), then tag it: play-action, motion, and who the first
// read is (your real receivers, with ratings). Defense is built, not picked: a front, a coverage,
// pressure and how many in the box. Live scouting shows what the other sideline has been doing.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { GameSim, type PlayEvent, type OffCall, type DefCall, type DefSet } from '../../src/sim/game';
import { FieldView } from '../../src/ui/field';
import { OFF_LIB, OFF_SETS, DEF_LIB } from '../../src/ui/plays';
import { Notebook } from './Diagram';
import { school, showColor, type School } from './data';
import { gameLeague } from './engine';
import { useDynasty } from './store';
import { Logo } from './App';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ord = (n: number) => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
const spot = (yl: number) => (yl === 50 ? '50' : yl < 50 ? `OWN ${yl}` : `OPP ${100 - yl}`);
type Group = 'Coach\'s sheet' | 'Run game' | 'Quick & screens' | 'Dropback' | 'Shots' | 'Specials';
const GROUPS: Group[] = ['Coach\'s sheet', 'Run game', 'Quick & screens', 'Dropback', 'Shots', 'Specials'];
const groupOf = (c: OffCall): Group => (c.kind === 'run' ? 'Run game' : c.depth === 'quick' || c.depth === 'screen' ? 'Quick & screens' : c.depth === 'deep' ? 'Shots' : 'Dropback');

export function GameDay({ s, opp, home, onClose }: { s: School; opp: School; home: boolean; onClose: () => void }) {
  const d = useDynasty(s.id);
  const ref = useRef<{ sim: GameSim; L: ReturnType<typeof gameLeague>['L']; hA: string; aA: string } | null>(null);
  if (!ref.current) {
    const H = home ? s : opp, A = home ? opp : s;
    const { L, game } = gameLeague(H, A, s.id, d.depth);
    const sim = new GameSim(L, game); sim.autoHalf = true;
    ref.current = { sim, L, hA: game.home, aA: game.away };
  }
  const { sim, L, hA, aA } = ref.current;
  const H = school(home ? s.id : opp.id), A = school(home ? opp.id : s.id);
  const userSide = home ? 1 : 0;
  const [, force] = useState(0);
  const [last, setLast] = useState<PlayEvent | null>(null);
  const [anim, setAnim] = useState(false);
  const [auto, setAuto] = useState<null | 'drive' | 'end'>(null);
  const onOffense = sim.poss === userSide;
  const needsCall = !sim.over && !sim.pending && !auto;
  const step = (oc?: OffCall, dc?: DefCall) => {
    let ev = sim.step(oc, dc);
    while (ev && (ev.type === 'end' || ev.type === 'timeout') && !sim.over) { setLast(ev); ev = sim.step(); }
    if (ev) { setLast(ev); setAnim(true); }
    force(x => x + 1);
  };
  // Kickoffs and extra points run themselves; sims run to the end of the drive or game.
  useEffect(() => {
    if (anim || sim.over) return;
    if (auto) {
      const startPoss = sim.poss; let guard = 0;
      while (!sim.over && guard++ < 500) { sim.step(); if (auto === 'drive' && sim.poss !== startPoss) break; }
      setAuto(null); setLast(sim.events[sim.events.length - 1] ?? null); force(x => x + 1); return;
    }
    if (sim.pending) { const t = setTimeout(() => step(), 500); return () => clearTimeout(t); }
  });
  const live = anim && last && !['end', 'timeout'].includes(last.type) ? last : null;
  const score = (live ? (sim.events[sim.events.indexOf(live) - 1]?.score ?? [0, 0]) : sim.score) as [number, number];
  const ev = last && !['end', 'timeout', 'penalty', 'kneel', 'spike', 'two'].includes(last.type) ? last : null;
  const posTeam = sim.poss === 1 ? H : A;
  return createPortal(
    <div className="gd" style={{ '--ch': showColor(H), '--ca': showColor(A), '--c': showColor(s) } as CSSProperties}>
      <header className="gd-bug">
        <div className="gd-team a"><Logo id={A.id} size={40} /><b>{A.abbr}</b><em>{score[0]}</em>{sim.poss === 0 && <i className="gd-pos" />}</div>
        <div className="gd-mid"><b>{sim.over ? 'FINAL' : `Q${Math.min(sim.q, 4)}${sim.q > 4 ? ' OT' : ''} · ${clock(sim.clock)}`}</b><span>{sim.over ? `${H.school} vs ${A.school}` : `${ord(sim.down)} & ${sim.yl >= 90 && sim.togo >= 100 - sim.yl ? 'Goal' : sim.togo} · ${spot(sim.yl)}`}</span></div>
        <div className="gd-team h">{sim.poss === 1 && <i className="gd-pos" />}<em>{score[1]}</em><b>{H.abbr}</b><Logo id={H.id} size={40} /></div>
        <button className="gd-x" onClick={onClose}>Leave game</button>
      </header>
      <div className="gd-main">
        <div className="gd-field">
          <FieldView ev={ev} home={L.teams[hA]} away={L.teams[aA]} logo={L.teams[hA].logo} playing={anim} onDone={() => setAnim(false)} weather={sim.weather} />
          <div className="gd-text">{live ? <span className="dim">{live.type === 'kickoff' ? 'The kick is away…' : live.type === 'punt' ? 'The punt is away…' : live.type === 'fg' || live.type === 'xp' ? 'The kick is up…' : 'Snap…'}</span> : <b className={last?.big ? 'gold' : ''}>{last?.text ?? `Welcome to ${H.school}. Kickoff is moments away.`}</b>}</div>
        </div>
        <aside className="gd-side">
          <Scouting sim={sim} userSide={userSide} />
          <div className="gd-log"><h4>Play by play</h4>{[...sim.events].reverse().filter(e => e !== live && e.type !== 'end').slice(0, 40).map(e => (
            <div key={e.n} className={e.td ? 'td' : e.turnover ? 'to' : ''}><em>Q{e.q} {clock(e.clock)}</em><span>{e.text}</span></div>
          ))}</div>
        </aside>
      </div>
      <footer className="gd-console">
        {sim.over ? (
          <div className="gd-final"><b>{score[1] > score[0] ? H.school : score[0] > score[1] ? A.school : 'Nobody'} wins {Math.max(...score)}-{Math.min(...score)}</b><button className="cbtn primary" onClick={onClose}>Back to the program</button></div>
        ) : !needsCall || anim ? (
          <div className="gd-wait"><span>{anim ? '' : sim.pending ? 'Special teams…' : ''}</span></div>
        ) : onOffense ? (
          <OffenseSheet sim={sim} L={L} me={onOffense ? posTeam : s} abbr={userSide ? hA : aA} onCall={oc => step(oc)} c={showColor(s)} />
        ) : (
          <DefenseSheet sim={sim} onCall={dc => step(undefined, dc)} c={showColor(s)} />
        )}
        {!sim.over && <div className="gd-sim"><button onClick={() => step()} disabled={!needsCall || anim}>Let the coordinator call it</button><button onClick={() => setAuto('drive')} disabled={anim}>Sim drive</button><button onClick={() => setAuto('end')} disabled={anim}>Sim to end</button></div>}
      </footer>
    </div>,
    document.body,
  );
}

/** What the other sideline has done this game: their run/pass mix on this down, and their coverages. */
function Scouting({ sim, userSide }: { sim: GameSim; userSide: number }) {
  const theirOff = sim.events.filter(e => e.poss !== userSide && ['run', 'pass', 'sack', 'scramble'].includes(e.type));
  const onDown = theirOff.filter(e => e.down === sim.down);
  const pass = (es: PlayEvent[]) => (es.length ? Math.round((es.filter(e => e.type !== 'run').length / es.length) * 100) : 0);
  const theirDef = sim.events.filter(e => e.poss === userSide && e.dcall);
  const cov: Record<string, number> = {};
  for (const e of theirDef) { const k = e.dcall!.replace(/ \(.*\)/, ''); cov[k] = (cov[k] ?? 0) + 1; }
  const topCov = Object.entries(cov).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return (
    <div className="gd-scout">
      <h4>Live scouting</h4>
      <div className="gd-tend"><span>Their offense, {ord(sim.down)} down</span><div className="bar2">{onDown.length ? <><i style={{ width: `${100 - pass(onDown)}%` }} /><em style={{ width: `${pass(onDown)}%` }} /></> : null}</div><small>{onDown.length ? `Run ${100 - pass(onDown)}% · Pass ${pass(onDown)}%` : 'No snaps yet on this down'}</small></div>
      <div className="gd-tend"><span>Their defense has shown</span>{topCov.length ? topCov.map(([k, v]) => <small key={k}>{k}: {Math.round((v / theirDef.length) * 100)}%</small>) : <small>Nothing yet</small>}</div>
    </div>
  );
}

function OffenseSheet({ sim, L, abbr, onCall, c }: { sim: GameSim; L: ReturnType<typeof gameLeague>['L']; me: School; abbr: string; onCall: (c: OffCall) => void; c: string }) {
  const [group, setGroup] = useState<Group>('Coach\'s sheet');
  const [form, setForm] = useState<string>('All');
  const [pa, setPa] = useState(false);
  const [motion, setMotion] = useState<OffCall['motion']>();
  const [primary, setPrimary] = useState<OffCall['primary']>();
  const t = L.teams[abbr];
  const who = (pos: string, i: number) => L.players[t.depth[pos as 'WR']?.[i] ?? ''];
  const slots: [NonNullable<OffCall['primary']>, ReturnType<typeof who>][] = [['X', who('WR', 0)], ['Z', who('WR', 1)], ['SLOT', who('WR', 2)], ['TE', who('TE', 0)], ['RB', who('RB', 0)]];
  // The coach's sheet: every play scored for this exact situation.
  const sit = useMemo(() => {
    const short = sim.togo <= 2, long = sim.togo >= 8, red = sim.yl >= 80, late = (sim.q === 2 || sim.q >= 4) && sim.clock <= 120;
    return (c: OffCall) => {
      let v = 0;
      if (c.kind === 'run') v += short ? 3 : long ? -2 : 1;
      if (c.depth === 'quick') v += red ? 2 : 1;
      if (c.depth === 'screen') v += long && sim.down === 3 ? -1 : 1;
      if (c.depth === 'medium') v += long ? 3 : 1;
      if (c.depth === 'deep') v += sim.down === 1 && !red ? 2 : long ? 1 : -1;
      if (red && c.depth === 'deep') v -= 3;
      if (late && c.kind === 'run') v -= 2;
      return v;
    };
  }, [sim.down, sim.togo, sim.yl, sim.q, sim.clock]);
  const lib = OFF_LIB.filter(p => form === 'All' || p.set === form);
  const list = group === 'Coach\'s sheet' ? [...lib].sort((a, b) => sit(b.call) - sit(a.call)).slice(0, 8) : group === 'Specials' ? [] : lib.filter(p => groupOf(p.call) === group);
  const call = (c: OffCall) => onCall({ ...c, pa: pa && c.kind === 'pass' && c.depth !== 'screen', name: pa && c.kind === 'pass' && c.depth !== 'screen' ? `PA ${c.name}` : c.name, motion: motion ?? c.motion, primary: primary ?? c.primary });
  return (
    <div className="cs-sheet">
      <div className="cs-groups">{GROUPS.map(g => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g}</button>)}
        <select value={form} onChange={e => setForm(e.target.value)}><option value="All">All formations</option>{Object.entries(OFF_SETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>
      <div className="cs-plays">
        {group === 'Specials' ? (
          <>
            <button className="cs-play sp" onClick={() => onCall({ kind: 'punt', name: 'Punt' })}><b>Punt</b><span>Flip the field</span></button>
            <button className="cs-play sp" onClick={() => onCall({ kind: 'fg', name: 'Field Goal' })}><b>Field goal</b><span>{100 - sim.yl + 17} yard try</span></button>
            <button className="cs-play sp" onClick={() => onCall({ kind: 'kneel', name: 'Kneel' })}><b>Kneel</b><span>Run the clock</span></button>
            <button className="cs-play sp" onClick={() => onCall({ kind: 'spike', name: 'Spike' })}><b>Spike</b><span>Stop the clock</span></button>
          </>
        ) : list.map(p => (
          <button key={p.name} className="cs-play" onClick={() => call(p.call)}>
            <div className="cs-art"><Notebook name={p.name} c={c} w={176} h={104} /></div>
            <b>{p.name}</b><span>{OFF_SETS[p.set]?.label ?? p.set} · {p.desc}</span>
            {group === 'Coach\'s sheet' && <em className={sit(p.call) >= 2 ? 'hot' : ''}>{sit(p.call) >= 2 ? 'Top call' : sit(p.call) >= 1 ? 'Good look' : 'Situational'}</em>}
          </button>
        ))}
      </div>
      <div className="cs-tags">
        <label className={`cs-tog${pa ? ' on' : ''}`} onClick={() => setPa(!pa)}><i />Play-action</label>
        <div className="cs-tag"><span>Motion</span><div>{[undefined, 'X', 'Z', 'SLOT', 'TE', 'RB'].map(m => <button key={m ?? 'none'} className={motion === m ? 'on' : ''} onClick={() => setMotion(m as OffCall['motion'])}>{m ?? 'None'}</button>)}</div></div>
        <div className="cs-tag"><span>First read</span><div>{[[undefined, undefined], ...slots].map(([k, p]) => <button key={k ?? 'auto'} className={primary === k ? 'on' : ''} onClick={() => setPrimary(k as OffCall['primary'])}>{k ? <>{k}<em>{p ? `${p.ln} ${p.ovr}` : ''}</em></> : 'By design'}</button>)}</div></div>
      </div>
    </div>
  );
}

const SHELLS: DefCall['shell'][] = ['Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', 'Cover 4', 'Prevent'];
const FRONTS: DefSet[] = ['Base', 'Nickel', 'Dime', 'Goal Line'];
function DefenseSheet({ sim, onCall, c }: { sim: GameSim; onCall: (c: DefCall) => void; c: string }) {
  const [front, setFront] = useState<DefSet>(sim.togo >= 8 ? 'Nickel' : sim.yl <= 5 ? 'Goal Line' : 'Base');
  const [shell, setShell] = useState<DefCall['shell']>('Cover 3');
  const [blitz, setBlitz] = useState(false);
  const [box, setBox] = useState(sim.togo <= 2 ? 8 : 7);
  const presets = DEF_LIB.slice(0, 10);
  return (
    <div className="cs-sheet def">
      <div className="cs-build">
        <div className="cs-tag"><span>Front</span><div>{FRONTS.map(f => <button key={f} className={front === f ? 'on' : ''} onClick={() => setFront(f)}>{f}</button>)}</div></div>
        <div className="cs-tag"><span>Coverage</span><div>{SHELLS.map(c => <button key={c} className={shell === c ? 'on' : ''} onClick={() => setShell(c)}>{c}</button>)}</div></div>
        <div className="cs-tag"><span>Pressure</span><div><button className={!blitz ? 'on' : ''} onClick={() => setBlitz(false)}>Rush four</button><button className={blitz ? 'on' : ''} onClick={() => setBlitz(true)}>Send pressure</button></div></div>
        <div className="cs-tag"><span>In the box: {box}</span><div><input type="range" min={5} max={9} value={box} onChange={e => setBox(Number(e.target.value))} /></div></div>
        <button className="cbtn primary" onClick={() => onCall({ shell, blitz, box, set: front, name: `${front} ${shell}${blitz ? ' Pressure' : ''}` })}>Call it</button>
      </div>
      <div className="cs-plays">{presets.map(p => (
        <button key={p.name} className="cs-play" onClick={() => onCall({ ...p.call, box: p.call.box ?? (p.call.blitz ? 7 : 6), set: p.set, name: p.name })}>
          <div className="cs-art"><Notebook name={p.name} def c={c} w={176} h={104} /></div><b>{p.name}</b><span>{p.set} · {p.desc}</span>
        </button>
      ))}</div>
    </div>
  );
}
