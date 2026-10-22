import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorld, mutate, getWorld, saveNow } from '../store';
import { go } from '../nav';
import { Crest, Face, Ovr } from '../art';
import { Form } from '../bits';
import { Panel, Tabs } from '../bits';
import { Match, type Action, type LP, PITCH_L, PITCH_W } from '../../core/engine';
import { recordResult, matchOpts, fmtDate } from '../../core/season';
import { autoPick, teamRatings, FORMATIONS, slotRating } from '../../core/tactics';
import type { Club, Fixture, MatchResult, World } from '../../core/types';
import { Instructions } from './Tactics';
import { GoalCine, MatchIntro, TrophyCine } from '../cine';
import { startCrowd, stopCrowd, roar, groan, whistle, setSound } from '../sfx';
import { luminance } from '../art';
import { Broadcast, LW, LH } from '../broadcast';

type Phase = 'preview' | 'intro' | 'live' | 'done';

export function MatchDay({ fxId }: { fxId: number }) {
  const w = useWorld();
  const fx = w.fixtures.find(f => f.id === fxId)!;
  const [phase, setPhase] = useState<Phase>(fx.res ? 'done' : 'preview');
  const [match, setMatch] = useState<Match | null>(null);
  const [trophy, setTrophy] = useState<string | null>(null);
  const userSide: 0 | 1 = fx.home === w.user ? 0 : 1;
  useEffect(() => { setSound(w.settings.sound); return () => stopCrowd(); }, [w.settings.sound]);

  const finish = useCallback((m: Match) => {
    const res = m.result();
    mutate(x => {
      m.commit(res);
      recordResult(x, x.fixtures.find(f => f.id === fxId)!, res);
    });
    void saveNow();
    stopCrowd();
    const f = getWorld().fixtures.find(x => x.id === fxId)!;
    const comp = getWorld().comps[f.comp];
    if (comp?.winner === getWorld().user && f.stage === 'Final') setTrophy(comp.name);
    setPhase('done');
  }, [fxId]);

  const begin = (live: boolean) => {
    const wd = getWorld();
    const f = wd.fixtures.find(x => x.id === fxId)!;
    for (const id of [f.home, f.away]) if (id !== wd.user) autoPick(wd, wd.clubs[id]);
    const m = new Match(wd, f, { ...matchOpts(wd, f), userSide, live });
    setMatch(m);
    if (live) setPhase(wd.settings.cinematics ? 'intro' : 'live');
    else { m.simToEnd(); finish(m); }
  };

  const home = w.clubs[fx.home], away = w.clubs[fx.away];
  if (trophy) return <TrophyCine club={w.clubs[w.user]} title={trophy} players={squadForCine(w)} onDone={() => setTrophy(null)} />;
  if (phase === 'preview') return <Preview w={w} fx={fx} onLive={() => begin(true)} onSim={() => begin(false)} />;
  if (phase === 'intro' && match) return <MatchIntro home={home} away={away} comp={w.comps[fx.comp]?.name ?? ''} stage={fx.stage} stadium={fx.neutral ? 'Neutral venue' : home.stadium} homeXI={match.onPitch(0).map(l => l.p)} awayXI={match.onPitch(1).map(l => l.p)} onDone={() => setPhase('live')} />;
  if (phase === 'live' && match) return <Live m={match} userSide={userSide} onEnd={() => finish(match)} />;
  return <Summary w={w} fx={w.fixtures.find(f => f.id === fxId)!} />;
}

// ---- preview -------------------------------------------------------------------------------
function Preview({ w, fx, onLive, onSim }: { w: World; fx: Fixture; onLive: () => void; onSim: () => void }) {
  const h = w.clubs[fx.home], a = w.clubs[fx.away];
  const rh = teamRatings(w, h), ra = teamRatings(w, a);
  const comp = w.comps[fx.comp];
  const diff = rh.ovr - ra.ovr + (fx.neutral ? 0 : 2);
  const ph = 1 / (1 + Math.exp(-diff / 4.5)) * 0.78, pd = 0.26 - Math.min(0.12, Math.abs(diff) * 0.01);
  const pHome = Math.round(ph * 100), pDraw = Math.round(pd * 100), pAway = 100 - pHome - pDraw;
  const odds = (p: number) => (100 / Math.max(3, p) * 0.93).toFixed(2);
  const agg = matchOpts(w, fx).aggregate;
  const Team = ({ c }: { c: Club }) => {
    const ids = c.tactic.lineup;
    return (
      <div className="pv-team">
        <div className="pv-th"><Crest club={c} size={64} /><div><b>{c.name}</b><span>{c.tactic.formation} · OVR {teamRatings(w, c).ovr}</span><Form f={c.form} /></div></div>
        <div className="pv-xi">{ids.map(id => w.players[id]).filter(Boolean).map(p => <div key={p.id} className="pv-p"><Ovr v={p.ovr} small /><span className="pos-chip">{p.pos}</span><span>{p.name}</span>{p.fitness < 80 && <span className="muted sm">{Math.round(p.fitness)}%</span>}</div>)}</div>
        <div className="pv-out">{c.squad.map(id => w.players[id]).filter(p => p && (p.inj || p.ban > 0)).map(p => <span key={p.id} className="tag red">{p.name.split(' ').slice(-1)} {p.inj ? '(inj)' : '(ban)'}</span>)}</div>
      </div>
    );
  };
  return (
    <div className="preview" style={{ ['--h' as string]: h.c1, ['--a' as string]: a.c1 }}>
      <div className="pv-hero">
        <div className="pv-comp">{comp?.name} · {fx.stage}{agg ? ` · First leg ${agg[1]}-${agg[0]}` : ''}</div>
        <div className="pv-row">
          <Crest club={h} size={120} /><div className="pv-mid"><span>{fmtDate(w, fx.day, true)}</span><b>VS</b><span>{fx.neutral ? 'Neutral venue' : `${h.stadium} · ${h.cap.toLocaleString()}`}</span></div><Crest club={a} size={120} />
        </div>
        <div className="pv-odds"><div><span>Home</span><b>{odds(pHome)}</b></div><div><span>Draw</span><b>{odds(pDraw)}</b></div><div><span>Away</span><b>{odds(pAway)}</b></div></div>
        <div className="pv-bars">{(['att', 'mid', 'def'] as const).map(k => <div key={k} className="cmp"><b>{rh[k]}</b><span className="cmp-bar"><i style={{ width: `${rh[k] / (rh[k] + ra[k]) * 100}%` }} /></span><span className="cmp-l">{k.toUpperCase()}</span><b>{ra[k]}</b></div>)}</div>
        <div className="pv-btns">
          <button className="btn-hero" onClick={onLive}>▶ PLAY MATCH</button>
          <button className="btn-ghost" onClick={onSim}>Quick sim</button>
          <button className="btn-ghost" onClick={() => go({ s: 'tactics' })}>Tactics</button>
          <button className="btn-ghost" onClick={() => go({ s: 'hub' })}>Back</button>
        </div>
      </div>
      <div className="pv-teams"><Team c={h} /><Team c={a} /></div>
    </div>
  );
}

// ---- live match --------------------------------------------------------------------------------
const SPEEDS = [0.085, 0.045, 0.022, 0.009];
const LONG = new Set(['long', 'cross', 'clear', 'miss', 'post', 'save', 'goal', 'block', 'through']);

interface Anim { a: Action; t0: number; ms: number }
function Live({ m, userSide, onEnd }: { m: Match; userSide: 0 | 1; onEnd: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);
  const rerender = () => force(x => x + 1);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [tab, setTab] = useState<'comm' | 'stats' | 'team' | 'tac'>('comm');
  const [goal, setGoal] = useState<Action | null>(null);
  const [ht, setHt] = useState(false);
  const [subOut, setSubOut] = useState<number | null>(null);
  const [camMode, setCamMode] = useState<'25d' | 'tac'>('25d');
  const camRef = useRef(camMode); camRef.current = camMode;
  const st = useRef({ celebUntil: 0, queue: [] as Action[], cur: null as Anim | null, ball: [52.5, 34] as [number, number], bh: 0, pos: new Map<number, [number, number]>(), last: performance.now(), half: 1, paused: false, goal: false, ht: false, speed: 1, ended: false, flash: 0, replay: [] as Action[] });
  st.current.paused = paused || !!goal || ht; st.current.speed = speed;
  const clubs = m.clubs;
  const kit = useMemo(() => {
    const h = clubs[0], a = clubs[1];
    const away = Math.abs(luminance(h.c1) - luminance(a.c1)) < 0.18 || h.c1.toLowerCase() === a.c1.toLowerCase();
    return [{ c1: h.c1, c2: h.c2, gk: '#1ed760' }, away ? { c1: a.a1, c2: a.a2, gk: '#f97316', away: true } : { c1: a.c1, c2: a.c2, gk: '#f97316' }];
  }, [clubs]);
  const bc = useMemo(() => new Broadcast(m, kit), [m, kit]);

  useEffect(() => { startCrowd(); whistle(); return () => stopCrowd(); }, []);

  useEffect(() => {
    const canvas = cv.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const S = st.current;
    for (const l of m.lps) if (l.on) S.pos.set(l.id, m.shapePos(l));
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
      const celebrating = now < S.celebUntil;
      if (!S.paused && !S.ended && !celebrating) {
        if (!S.cur) {
          if (!S.queue.length && !m.done) {
            const acts = m.step();
            S.queue.push(...acts);
            if (m.half !== S.half) { S.half = m.half; if (m.half === 2) { S.ht = true; whistle(true); setHt(true); } }
            if (acts.some(a => a.type === 'sub' || a.type === 'card')) rerender();
          }
          const a = S.queue.shift();
          if (a) {
            const k = SPEEDS[S.speed];
            const ms = Math.max(60, a.dur * 1000 * k * (a.type === 'goal' || a.type === 'save' || a.type === 'miss' || a.type === 'post' ? 1.6 : 1) * (a.type === 'sub' || a.type === 'card' || a.type === 'whistle' || a.type === 'kickoff' ? 0.4 : 1));
            S.cur = { a, t0: now, ms };
            bc.onAction(a);
            S.replay.push(a); if (S.replay.length > 8) S.replay.shift();
            if (a.type === 'save' || a.type === 'miss' || a.type === 'post' || a.type === 'block') { if (a.big || a.type === 'post') roar(0.35); }
            if (a.type === 'foul') whistle();
          } else if (m.done) { S.ended = true; whistle(true); setTimeout(onEnd, 1800); }
        }
        if (S.cur) {
          const { a, t0, ms } = S.cur;
          const k = Math.min(1, (now - t0) / ms);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          S.ball = [a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e];
          S.bh = LONG.has(a.type) ? Math.sin(Math.PI * k) * (a.type === 'cross' || a.type === 'long' || a.type === 'clear' ? 6 : a.type === 'through' ? 1.5 : 1.2) : 0;
          if (k >= 1) {
            if (a.type === 'goal') {
              S.goal = true; S.flash = 1; roar(1);
              if (camRef.current === '25d' && getWorld().settings.cinematics) { bc.startCelebration(a); S.celebUntil = now + 3300; setTimeout(() => setGoal(a), 3300); }
              else setGoal(a);
            }
            else if (a.type === 'miss' && a.big) groan();
            S.cur = null;
            if (a.type === 'goal' || a.type === 'red' as string) rerender();
            if (Math.random() < 0.12) rerender();
          }
        }
      }
      // players drift toward their shape
      const poss = S.cur ? (S.cur.a.type === 'intercept' || S.cur.a.type === 'tackle' || S.cur.a.type === 'clear' ? S.cur.a.side : m.side) : m.side;
      for (const l of m.lps) {
        if (!l.on || l.off) { S.pos.delete(l.id); continue; }
        let tgt = m.shapePos(l, S.ball, poss as 0 | 1);
        const a = S.cur?.a;
        if (a && a.pid === l.id && a.type !== 'save') tgt = (a.type === 'dribble' || a.type === 'carry') ? S.ball : a.from;
        if (a && a.pid2 === l.id && (a.type === 'pass' || a.type === 'long' || a.type === 'through' || a.type === 'cross')) tgt = a.to;
        if (a && a.pid2 === l.id && (a.type === 'save')) tgt = a.to;
        const cur = S.pos.get(l.id) ?? tgt;
        const sp = Math.min(1, dt * (a && (a.pid === l.id || a.pid2 === l.id) ? 6 : 1.8) * (1 + S.speed * 0.6));
        S.pos.set(l.id, [cur[0] + (tgt[0] - cur[0]) * sp, cur[1] + (tgt[1] - cur[1]) * sp]);
      }
      if (camRef.current === '25d') {
        if (canvas.width !== LW) { canvas.width = LW; canvas.height = LH; }
        bc.frame(ctx, S.ball, S.bh * 0.7, S.cur?.a ?? null, l => m.shapePos(l, S.ball, poss as 0 | 1), dt);
      } else {
        if (canvas.width === LW) { const r = canvas.getBoundingClientRect(); canvas.width = r.width * devicePixelRatio; canvas.height = r.height * devicePixelRatio; }
        draw(ctx, canvas, m, S, kit, now);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const ro = () => { if (camRef.current === '25d') return; const r = canvas.getBoundingClientRect(); canvas.width = r.width * devicePixelRatio; canvas.height = r.height * devicePixelRatio; };
    ro(); window.addEventListener('resize', ro);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', ro); };
  }, [m, kit, onEnd, bc]);

  const setTac = (f: (t: typeof m.tac[0]) => void) => { f(m.tac[userSide]); rerender(); };
  const comm = m.commentary.slice(-60).reverse();
  const scorers = (side: 0 | 1) => m.events.filter(e => (e.type === 'goal' || e.type === 'pen') && e.side === side).map(e => `${m.byId.get(e.pid)?.p.name.split(' ').slice(-1)[0]} ${e.min}'${e.type === 'pen' ? ' (P)' : ''}`);
  const goalLp = goal ? m.byId.get(goal.pid) : undefined;
  const astLp = goal?.pid2 ? m.byId.get(goal.pid2) : undefined;
  const injuredMine = m.onPitch(userSide).find(l => (l as LP & { needsSub?: boolean }).needsSub);
  const agg = m.opts.aggregate;
  return (
    <div className="live" style={{ ['--h' as string]: kit[0].c1, ['--a' as string]: kit[1].c1 }}>
      <div className="sb">
        <div className="sb-team h"><Crest club={clubs[0]} size={34} /><b>{clubs[0].short}</b></div>
        <div className="sb-score"><b>{m.score[0]}</b><span>-</span><b>{m.score[1]}</b></div>
        <div className="sb-team a"><b>{clubs[1].short}</b><Crest club={clubs[1]} size={34} /></div>
        <div className="sb-clock">{m.done ? 'FT' : m.clock()}</div>
        {agg && <div className="sb-agg">Agg {m.score[0] + agg[0]}-{m.score[1] + agg[1]}</div>}
        <div className="sb-scorers"><span>{scorers(0).join(', ')}</span><span>{scorers(1).join(', ')}</span></div>
      </div>
      <div className="live-grid">
        <div className="live-pitch">
          <div className={`persp ${camMode === '25d' ? 'bcast' : ''}`}><canvas ref={cv} /></div>
          <div className="ticker">{comm[0]?.text}</div>
          <div className="live-ctrl">
            <button onClick={() => setPaused(p => !p)}>{paused ? '▶ Resume' : '❚❚ Pause'}</button>
            <button className={camMode === '25d' ? 'on' : ''} onClick={() => setCamMode(c => c === '25d' ? 'tac' : '25d')}>{camMode === '25d' ? 'Broadcast cam' : 'Tactical cam'}</button>
            {['1x', '2x', '4x', '10x'].map((s, i) => <button key={s} className={speed === i ? 'on' : ''} onClick={() => setSpeed(i)}>{s}</button>)}
            <button onClick={() => { while (!m.done) m.step(); st.current.queue = []; st.current.cur = null; rerender(); }}>Sim to end</button>
          </div>
          {injuredMine && <div className="inj-alert">{injuredMine.p.name} is injured. <button onClick={() => { setPaused(true); setTab('team'); setSubOut(injuredMine.id); }}>Make a substitution</button></div>}
        </div>
        <div className="live-side">
          <Tabs tabs={[['comm', 'Commentary'], ['stats', 'Stats'], ['team', `Team (${5 - m.subsUsed[userSide]} subs)`], ['tac', 'Tactics']]} value={tab} onChange={setTab} />
          {tab === 'comm' && <div className="comm">{comm.map((c, i) => <div key={i} className={`cm k-${c.kind ?? ''}`}><b>{Math.floor(c.t / 60) + 1}'</b><span>{c.text}</span></div>)}</div>}
          {tab === 'stats' && <StatsCompare r={{ ...m.result(), hg: m.score[0], ag: m.score[1] }} />}
          {tab === 'team' && (
            <div className="live-team">
              <p className="muted sm">{subOut ? 'Now pick a substitute.' : 'Pick a player to take off.'}</p>
              {m.onPitch(userSide).map(l => (
                <div key={l.id} className={`lt-row ${subOut === l.id ? 'sel' : ''}`} onClick={() => setSubOut(subOut === l.id ? null : l.id)}>
                  <span className="pos-chip">{l.pos}</span><span className="lt-n">{l.p.name}</span>
                  <span className="lt-e"><i style={{ width: `${l.energy}%`, background: l.energy > 65 ? '#22c55e' : l.energy > 45 ? '#eab308' : '#ef4444' }} /></span>
                  <b className="lt-r">{Math.max(3, Math.min(10, l.rating)).toFixed(1)}</b>{l.yellow && <i className="ycard" />}
                </div>
              ))}
              <h4>Bench</h4>
              {m.bench(userSide).map(l => (
                <div key={l.id} className={`lt-row bench ${subOut ? 'can' : ''}`} onClick={() => { if (subOut && m.subsUsed[userSide] < 5) { m.substitute(userSide, subOut, l.id); setSubOut(null); setPaused(false); rerender(); } }}>
                  <span className="pos-chip">{l.p.pos}</span><span className="lt-n">{l.p.name}</span><Ovr v={subOut ? Math.round(slotRating(l.p, m.byId.get(subOut)!.pos)) : l.p.ovr} small />
                </div>
              ))}
            </div>
          )}
          {tab === 'tac' && (
            <div className="live-tac">
              <label>Formation <select value={m.tac[userSide].formation} onChange={e => { m.setFormation(userSide, e.target.value); rerender(); }}>{Object.keys(FORMATIONS).map(f => <option key={f}>{f}</option>)}</select></label>
              <Instructions t={m.tac[userSide]} set={setTac} compact />
            </div>
          )}
        </div>
      </div>
      {goal && <GoalCine scorer={goalLp?.p} assist={astLp?.p} mates={m.onPitch(goal.side).filter(l => l.pos !== 'GK').slice(0, 4).map(l => l.p)} club={clubs[goal.side]} minute={m.clock()} score={`${clubs[0].short} ${m.score[0]}-${m.score[1]} ${clubs[1].short}`} onDone={() => { st.current.goal = false; setGoal(null); }} />}
      {ht && (
        <div className="ht-overlay">
          <div className="ht-box">
            <h2>Half-time</h2>
            <div className="ht-score"><Crest club={clubs[0]} size={50} /><b>{m.score[0]} - {m.score[1]}</b><Crest club={clubs[1]} size={50} /></div>
            <StatsCompare r={{ ...m.result(), hg: m.score[0], ag: m.score[1] }} />
            <p className="muted">Use the Team and Tactics tabs to make changes, then kick off the second half.</p>
            <button className="btn-hero" onClick={() => { st.current.ht = false; setHt(false); whistle(); }}>Second half ▶</button>
            <button className="btn-ghost" onClick={() => { setTab('tac'); }}>Tactics</button>
          </div>
        </div>
      )}
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, m: Match, S: { ball: [number, number]; bh: number; pos: Map<number, [number, number]>; cur: Anim | null; flash: number }, kit: { c1: string; c2: string; gk: string }[], now: number) {
  const W = cv.width, H = cv.height;
  const pad = 0.04;
  const sx = (W * (1 - pad * 2)) / PITCH_L, sy = (H * (1 - pad * 2)) / PITCH_W;
  const X = (x: number) => W * pad + x * sx, Y = (y: number) => H * pad + y * sy;
  // grass
  ctx.fillStyle = '#1d6b2e'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#227a35' : '#1f7231'; ctx.fillRect(X(i * PITCH_L / 14), Y(0), sx * PITCH_L / 14 + 1, sy * PITCH_W); }
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.7); grad.addColorStop(0, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // lines
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.5, W / 600);
  ctx.strokeRect(X(0), Y(0), PITCH_L * sx, PITCH_W * sy);
  ctx.beginPath(); ctx.moveTo(X(52.5), Y(0)); ctx.lineTo(X(52.5), Y(68)); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(X(52.5), Y(34), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2); ctx.stroke();
  for (const side of [0, 1]) {
    const x0 = side ? 105 - 16.5 : 0, x1 = side ? 105 - 5.5 : 0;
    ctx.strokeRect(X(x0), Y(34 - 20.16), 16.5 * sx, 40.32 * sy);
    ctx.strokeRect(X(x1), Y(34 - 9.16), 5.5 * sx, 18.32 * sy);
    ctx.beginPath(); ctx.arc(X(side ? 94 : 11), Y(34), 1.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(X(side ? 94 : 11), Y(34), 9.15 * sx, 9.15 * sy, 0, side ? Math.PI * 0.62 : -Math.PI * 0.38, side ? Math.PI * 1.38 : Math.PI * 0.38); ctx.stroke();
    // goal
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(X(side ? 105 : -2.2), Y(34 - 3.66), 2.2 * sx, 7.32 * sy);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(X(side ? 105 : -2.2), Y(34 - 3.66), 2.2 * sx, 7.32 * sy); ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  }
  ctx.beginPath(); ctx.arc(X(52.5), Y(34), 2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  // players
  const r = Math.max(7, sx * 1.65);
  const order = [...m.lps].filter(l => l.on && !l.off && S.pos.has(l.id)).sort((a, b) => S.pos.get(a.id)![1] - S.pos.get(b.id)![1]);
  const carrier = S.cur?.a.pid;
  for (const l of order) {
    const [x, y] = S.pos.get(l.id)!;
    const k = kit[l.side];
    const isGk = l.pos === 'GK';
    ctx.beginPath(); ctx.ellipse(X(x) + r * 0.25, Y(y) + r * 0.7, r * 0.95, r * 0.45, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, 7);
    ctx.fillStyle = isGk ? k.gk : k.c1; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.28); ctx.strokeStyle = isGk ? '#111' : k.c2; ctx.stroke();
    if (l.id === carrier) { ctx.beginPath(); ctx.arc(X(x), Y(y), r * 1.55, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = luminance(isGk ? k.gk : k.c1) > 0.6 ? '#111' : '#fff';
    ctx.font = `800 ${Math.round(r * 1.05)}px "Barlow Condensed", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(l.p.num), X(x), Y(y) + 0.5);
    if (l.id === carrier || l.id === S.cur?.a.pid2) {
      ctx.font = `700 ${Math.round(r * 0.95)}px Inter, sans-serif`; ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const nm = l.p.name.split(' ').slice(-1)[0];
      const tw = ctx.measureText(nm).width + 8;
      ctx.fillRect(X(x) - tw / 2, Y(y) - r * 2.9, tw, r * 1.35); ctx.fillStyle = '#fff'; ctx.fillText(nm, X(x), Y(y) - r * 2.2);
    }
  }
  // ball
  const [bx, by] = S.ball;
  ctx.beginPath(); ctx.ellipse(X(bx), Y(by) + 2, r * 0.55, r * 0.3, 0, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  const lift = S.bh * sy * 0.9;
  ctx.beginPath(); ctx.arc(X(bx), Y(by) - lift, r * (0.5 + S.bh * 0.04), 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.stroke();
  if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${S.flash * 0.5})`; ctx.fillRect(0, 0, W, H); S.flash = Math.max(0, S.flash - 0.03); }
  void now;
}

// ---- summary -------------------------------------------------------------------------------
export function StatsCompare({ r }: { r: MatchResult }) {
  const s = r.stats;
  const rows: [string, number, number, boolean?][] = [['Possession %', s.poss[0], s.poss[1]], ['Shots', s.shots[0], s.shots[1]], ['On target', s.sot[0], s.sot[1]], ['xG', s.xg[0], s.xg[1], true], ['Passes', s.passes[0], s.passes[1]], ['Pass accuracy %', s.passes[0] ? Math.round(s.passAcc[0] / s.passes[0] * 100) : 0, s.passes[1] ? Math.round(s.passAcc[1] / s.passes[1] * 100) : 0], ['Corners', s.corners[0], s.corners[1]], ['Fouls', s.fouls[0], s.fouls[1]], ['Offsides', s.offsides[0], s.offsides[1]], ['Yellow cards', s.yellows[0], s.yellows[1]], ['Saves', s.saves[0], s.saves[1]]];
  return (
    <div className="stcmp">
      {rows.map(([l, a, b, dec]) => (
        <div key={l} className="stc">
          <b>{dec ? a.toFixed(2) : a}</b>
          <div className="stc-mid"><span>{l}</span><div className="stc-bar"><i className="h" style={{ width: `${a + b ? a / (a + b) * 100 : 50}%` }} /><i className="a" style={{ width: `${a + b ? b / (a + b) * 100 : 50}%` }} /></div></div>
          <b>{dec ? b.toFixed(2) : b}</b>
        </div>
      ))}
    </div>
  );
}

function Summary({ w, fx }: { w: World; fx: Fixture }) {
  const r = fx.res!;
  const h = w.clubs[fx.home], a = w.clubs[fx.away];
  const motm = w.players[r.motm];
  const evs = r.events.filter(e => e.type !== 'save');
  const Ratings = ({ side }: { side: 0 | 1 }) => (
    <div className="rt-list">
      {r.lineups[side].map(id => w.players[id]).filter(Boolean).sort((x, y) => (r.ratings[y.id] ?? 0) - (r.ratings[x.id] ?? 0)).map(p => (
        <div key={p.id} className="rt-row" onClick={() => go({ s: 'player', id: p.id })}><span className="pos-chip">{p.pos}</span><span>{p.name}</span><b className={`rt ${(r.ratings[p.id] ?? 6) >= 7.5 ? 'hi' : (r.ratings[p.id] ?? 6) < 6 ? 'lo' : ''}`}>{(r.ratings[p.id] ?? 6).toFixed(1)}</b></div>
      ))}
    </div>
  );
  return (
    <div className="summary" style={{ ['--h' as string]: h.c1, ['--a' as string]: a.c1 }}>
      <div className="sum-hero">
        <span className="sum-comp">{w.comps[fx.comp]?.name} · {fx.stage} · Full-time</span>
        <div className="sum-row">
          <div className="sum-t"><Crest club={h} size={100} /><b>{h.name}</b></div>
          <div className="sum-score">{r.hg} - {r.ag}{r.pens && <small>({r.pens[0]}-{r.pens[1]} pens)</small>}{r.et && !r.pens && <small>after extra time</small>}</div>
          <div className="sum-t"><Crest club={a} size={100} /><b>{a.name}</b></div>
        </div>
        <div className="sum-events">
          {evs.map((e, i) => (
            <div key={i} className={`ev ${e.side ? 'a' : 'h'} t-${e.type}`}>
              <b>{e.min}'</b>
              <i className={`ev-ic ${e.type}`} />
              <span>{w.players[e.pid]?.name}{e.type === 'sub' ? ` ↔ ${w.players[e.pid2!]?.name}` : e.pid2 && (e.type === 'goal') ? ` (${w.players[e.pid2]?.name.split(' ').slice(-1)})` : ''}{e.type === 'pen' ? ' (pen)' : ''}{e.type === 'miss' ? ' (missed pen)' : ''}</span>
            </div>
          ))}
        </div>
        {r.att && <span className="muted sm">Attendance {r.att.toLocaleString()}</span>}
      </div>
      <div className="sum-grid">
        <Panel title="Match stats"><StatsCompare r={r} /></Panel>
        <Panel title={`${h.short} ratings`}><Ratings side={0} /></Panel>
        <Panel title={`${a.short} ratings`}><Ratings side={1} /></Panel>
        {motm && <Panel title="Player of the match" className="motm"><Face p={motm} club={motm.club ? w.clubs[motm.club] : undefined} size={110} /><b>{motm.name}</b><span className="rt hi">{r.ratings[motm.id]?.toFixed(1)}</span></Panel>}
      </div>
      <div className="sum-btns"><button className="btn-hero" onClick={() => go({ s: 'hub' })}>Continue</button></div>
    </div>
  );
}

export function squadForCine(w: World) {
  const u = w.clubs[w.user];
  const cap = w.players[u.tactic.captain ?? -1];
  const rest = u.squad.map(id => w.players[id]).filter(p => p && p !== cap && p.pos !== 'GK').sort((a, b) => b.ovr - a.ovr);
  return (cap ? [cap, ...rest] : rest).slice(0, 5);
}
