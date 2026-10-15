// Interactive weekly moments: instead of picking an answer from a list, you play the scene and
// how you play it decides which way it goes.
//   Hot Seat: the podium. Reporters fire questions on a shot clock; each answer leans you
//             toward one stance, a stumble (time runs out) toward the safe one.
//   Speech:   the locker room. Drag a tone dial from calm to fiery and watch the faces in the
//             room react live; deliver when it feels right.
//   Tug:      a negotiation as a tug of war. Push, hold or give each round; the other side
//             answers, and where the rope ends up is the deal you get.
// Each ends by calling the card's own choice, so the effects are the card's.
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { vivid } from '../components';
import { FaceArt } from '../face';
import { hash } from '../../core/rng';
import { app } from '../store';
import type { ActionCard, GameSpec } from '../actions';
import type { Player } from '../../core/types';
import { chips, toneOf, accent } from './weeklypop';
import './weeklygames.css';

type Props = { c: ActionCard; decide: (i: number) => string | null; onClose: () => void };
const vars = (c: ActionCard) => ({ '--c1': vivid(c.team.colors[0]), '--c2': accent(c.team) } as React.CSSProperties);

/** The outcome panel shared by all three: what you said, how it landed, the effects. */
function Outcome({ c, i, result, onClose, lead }: { c: ActionCard; i: number; result: string; onClose: () => void; lead: string }) {
  const ch = c.choices[i];
  const fx = chips(result && / [+−-]\d/.test(result) ? result : ch.hint);
  return (
    <div className="wg-out">
      <span className="wg-k">{lead}</span>
      <b>{ch.label}</b>
      {ch.reply && <p className="wg-say">“{ch.reply}”</p>}
      {ch.react && <p className="wg-react">{ch.react}</p>}
      <div className="wg-fx">{fx.map((h, k) => <i key={h} className={toneOf(h)} style={{ animationDelay: `${0.3 + k * 0.12}s` }}>{h}</i>)}</div>
      <button className="btn primary" onClick={onClose}>Continue</button>
    </div>
  );
}
function useFinish(decide: Props['decide']) {
  const [out, setOut] = useState<{ i: number; r: string } | null>(null);
  const finish = (i: number) => { if (out) return; const r = decide(i); if (r === null) return; setOut({ i, r: r || '' }); app.touch(); };
  return { out, finish };
}
function useEsc(onClose: () => void) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); });
}

export function GameMoment(P: Props) {
  const g = P.c.game!;
  return g.kind === 'hotseat' ? <HotSeat {...P} g={g} /> : g.kind === 'speech' ? <Speech {...P} g={g} /> : <Tug {...P} g={g} />;
}

// ---- Hot Seat ------------------------------------------------------------------------------
function HotSeat({ c, decide, onClose, g }: Props & { g: Extract<GameSpec, { kind: 'hotseat' }> }) {
  useEsc(onClose);
  const { out, finish } = useFinish(decide);
  const [q, setQ] = useState(-1);                   // -1: walking to the podium
  const [score, setScore] = useState<number[]>(c.choices.map(() => 0));
  const [clock, setClock] = useState(1);
  const [said, setSaid] = useState<string[]>([]);
  const [flash, setFlash] = useState(0);
  const T = 7;
  useEffect(() => { const id = setInterval(() => setFlash(f => f + 1), 900); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (q < 0 || q >= g.qs.length || out) return;
    setClock(1);
    const t0 = performance.now();
    const id = setInterval(() => { const k = 1 - (performance.now() - t0) / (T * 1000); setClock(Math.max(0, k)); if (k <= 0) { clearInterval(id); answer(-1); } }, 60);
    return () => clearInterval(id);
  }, [q]);
  const answer = (j: number) => {
    if (q < 0 || q >= g.qs.length) return;
    const s = [...score]; const lean = j < 0 ? g.stumble ?? 1 : j; s[lean] += j < 0 ? 0.6 : 1 + clock * 0.3; setScore(s);
    setSaid(x => [...x, j < 0 ? '…(you hesitate, and the room notices)' : g.qs[q].a[j]]);
    if (q + 1 >= g.qs.length) { const best = s.indexOf(Math.max(...s)); setTimeout(() => finish(best), 700); }
    setQ(q + 1);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (/^[1-3]$/.test(e.key) && q >= 0 && q < g.qs.length) { e.preventDefault(); e.stopImmediatePropagation(); answer(+e.key - 1); } else if ((e.key === 'Enter' || e.key === ' ') && q < 0) { e.preventDefault(); e.stopImmediatePropagation(); setQ(0); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); });
  const cur = g.qs[q];
  const total = score.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="wg wg-hot" style={vars(c)}>
      <div className="wg-flashes">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} className={(flash + i * 7) % 5 === 0 ? 'on' : ''} style={{ left: `${8 + i * 16}%`, top: `${12 + ((i * 37) % 40)}%` }} />)}</div>
      <div className="wg-panel">
        <div className="wg-kick"><span className="wg-tag">{c.kind}</span><span>{c.where ?? 'Media room'}</span></div>
        <h1>{c.headline}</h1>
        {q < 0 && <div className="wg-intro"><p>{c.body}</p><p className="dim">{g.qs.length} questions. Each one is on a shot clock. Hesitate and it reads as a non-answer.</p><button className="btn primary big" onClick={() => setQ(0)}>Step up to the podium</button></div>}
        {cur && !out && <div className="wg-q" key={q}>
          <div className="wg-rep"><span>{cur.who ?? 'Reporter'}</span><p>{cur.q}</p></div>
          <div className="wg-clock"><i style={{ width: `${clock * 100}%`, background: clock < 0.3 ? '#ff6b6b' : clock < 0.6 ? '#ffd166' : '#3ddc84' }} /></div>
          <div className="wg-ans">{cur.a.map((a, j) => <button key={j} onClick={() => answer(j)} style={{ animationDelay: `${j * 0.07}s` }}><kbd>{j + 1}</kbd>{a}</button>)}</div>
          <div className="wg-prog">Question {q + 1} of {g.qs.length}</div>
        </div>}
        {q >= 0 && !out && <div className="wg-lean">{c.choices.map((ch, j) => <div key={j}><span>{ch.label}</span><i><b style={{ width: `${(score[j] / total) * 100}%` }} /></i></div>)}</div>}
        {said.length > 0 && !out && <div className="wg-said">{said.slice(-2).map((s, i) => <p key={said.length - 2 + i}>“{s}”</p>)}</div>}
        {out && <Outcome c={c} i={out.i} result={out.r} onClose={onClose} lead="How it played" />}
      </div>
    </div>
  );
}

// ---- Speech -------------------------------------------------------------------------------
function Speech({ c, decide, onClose, g }: Props & { g: Extract<GameSpec, { kind: 'speech' }> }) {
  useEsc(onClose);
  const { out, finish } = useFinish(decide);
  const [tone, setTone] = useState(50);
  const room = g.faces.slice(0, 6);
  // Each player in the room has his own taste for how he wants to be talked to.
  const prefs = useMemo(() => room.map(p => 20 + ((hash(p.id + c.id) >>> 0) % 61) + (p.age >= 30 ? -12 : 8)), [c.id]);
  const react = (pref: number) => { const d = Math.abs(tone - pref); return d < 14 ? 'fired' : d < 30 ? 'nod' : d < 48 ? 'meh' : 'off'; };
  const meter = Math.round(room.reduce((a, _, i) => a + Math.max(0, 100 - Math.abs(tone - prefs[i]) * 1.8), 0) / Math.max(1, room.length));
  const idx = Math.min(c.choices.length - 1, Math.floor((tone / 100.01) * c.choices.length));
  const label = tone < 25 ? 'Calm' : tone < 50 ? 'Measured' : tone < 75 ? 'Firm' : 'Fiery';
  return (
    <div className="wg wg-speech" style={vars(c)}>
      <div className="wg-panel wide">
        <div className="wg-kick"><span className="wg-tag">{c.kind}</span><span>{c.where ?? 'Locker room'}</span></div>
        <h1>{c.headline}</h1>
        {!out ? <>
          <p className="wg-body">{c.body}</p>
          <div className="wg-room">{room.map((p, i) => { const r = react(prefs[i]); return (
            <div key={p.id} className={`wg-guy r-${r}`} style={{ '--tc': vivid(c.team.colors[0]) } as React.CSSProperties}>
              <div className="wg-gface"><FaceArt p={p} team={c.team} size={64} /></div>
              <span>{p.ln}</span><em>{r === 'fired' ? '🔥' : r === 'nod' ? '👍' : r === 'meh' ? '😐' : '🙄'}</em>
            </div>); })}</div>
          <div className="wg-dial">
            <span>Calm</span>
            <input type="range" min={0} max={100} value={tone} onChange={e => setTone(+e.target.value)} style={{ '--v': `${tone}%` } as React.CSSProperties} />
            <span>Fiery</span>
          </div>
          <div className="wg-read"><b>{label}</b><span>The room: <i className={meter >= 65 ? 'good' : meter >= 40 ? '' : 'bad'}>{meter >= 65 ? 'with you' : meter >= 40 ? 'split' : 'losing them'}</i></span><span className="wg-plan">You'll go with: <b>{c.choices[idx].label}</b></span></div>
          <button className="btn primary big" onClick={() => finish(idx)}>Deliver it</button>
        </> : <Outcome c={c} i={out.i} result={out.r} onClose={onClose} lead={`You went ${label.toLowerCase()}`} />}
      </div>
    </div>
  );
}

// ---- Tug of war ---------------------------------------------------------------------------
function Tug({ c, decide, onClose, g }: Props & { g: Extract<GameSpec, { kind: 'tug' }> }) {
  useEsc(onClose);
  const { out, finish } = useFinish(decide);
  const R = g.rounds ?? 4;
  const [pos, setPos] = useState(50);              // 0: their terms … 100: your terms
  const [round, setRound] = useState(0);
  const [patience, setPatience] = useState(g.patience ?? 3);
  const [log, setLog] = useState<{ you: string; them: string }[]>([]);
  const [jolt, setJolt] = useState(0);
  const seed = hash(c.id) >>> 0;
  const move = (m: 'push' | 'hold' | 'give') => {
    if (out || round >= R) return;
    const roll = ((seed >>> (round * 3)) % 100) / 100;
    let d = m === 'push' ? 9 + roll * 9 : m === 'hold' ? 2 + roll * 4 : -(7 + roll * 6);
    let p2 = patience;
    if (m === 'push' && pos > 55) { p2 -= 1; d *= 0.8; }
    if (m === 'give') p2 = Math.min(g.patience ?? 3, p2 + 1);
    const np = Math.max(0, Math.min(100, pos + d - (m === 'hold' ? 0 : roll * 3)));
    const them = p2 <= 0 ? g.walk : m === 'push' ? (np > 70 ? g.lines.strain : g.lines.push) : m === 'hold' ? g.lines.hold : g.lines.give;
    setLog(l => [...l, { you: m === 'push' ? 'You push harder.' : m === 'hold' ? 'You hold your ground.' : 'You give a little.', them }]);
    setPos(np); setPatience(p2); setJolt(j => j + 1);
    const last = round + 1 >= R || p2 <= 0;
    setRound(round + 1);
    if (last) {
      // Where the rope ends is the deal: your terms, the middle, or theirs. If they walk, it's theirs.
      const n = c.choices.length;
      const i = p2 <= 0 ? n - 1 : np >= 62 ? 0 : np >= 38 ? Math.min(1, n - 1) : n - 1;
      setTimeout(() => finish(i), 900);
    }
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { const m = ({ '1': 'push', '2': 'hold', '3': 'give' } as const)[e.key as '1']; if (m) { e.preventDefault(); e.stopImmediatePropagation(); move(m); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); });
  return (
    <div className="wg wg-tug" style={vars(c)}>
      <div className="wg-panel wide">
        <div className="wg-kick"><span className="wg-tag">{c.kind}</span><span>{c.where ?? 'Conference room'}</span></div>
        <h1>{c.headline}</h1>
        {!out ? <>
          <p className="wg-body">{c.body}</p>
          <div className="wg-sides"><div><span>Their terms</span><b>{c.choices[c.choices.length - 1].label}</b></div><div className="r"><span>Your terms</span><b>{c.choices[0].label}</b></div></div>
          <div className="wg-rope"><div className="wg-zone" /><div key={jolt} className="wg-knot" style={{ left: `${pos}%` }} /></div>
          <div className="wg-meta"><span>Round {Math.min(round + 1, R)} of {R}</span><span>{g.them}'s patience <i className="wg-pat">{Array.from({ length: g.patience ?? 3 }, (_, i) => <b key={i} className={i < patience ? 'on' : ''} />)}</i></span></div>
          <div className="wg-moves">
            <button onClick={() => move('push')} disabled={round >= R}><kbd>1</kbd><b>Push</b><span>Big gain, costs patience when you're ahead</span></button>
            <button onClick={() => move('hold')} disabled={round >= R}><kbd>2</kbd><b>Hold</b><span>Small gain, no risk</span></button>
            <button onClick={() => move('give')} disabled={round >= R}><kbd>3</kbd><b>Give</b><span>Lose ground, rebuild patience</span></button>
          </div>
          <div className="wg-log">{log.slice(-3).map((l, i) => <div key={log.length - 3 + i}><span>{l.you}</span><p><em>{g.them}:</em> {l.them}</p></div>)}</div>
        </> : <Outcome c={c} i={out.i} result={out.r} onClose={onClose} lead="The deal" />}
      </div>
    </div>
  );
}

/** The faces for a speech: starters first, captains-ish (older, good) on top. */
export const roomOf = (roster: Player[]) => [...roster].filter(p => p.status === 'ACT').sort((a, b) => (b.ovr + b.age) - (a.ovr + a.age)).slice(0, 6);
