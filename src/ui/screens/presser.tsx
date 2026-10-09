// The post-game press conference. A pixel press room (step-and-repeat backdrop,
// podium bristling with microphones, a row of photographers) where the coach walks
// in through the flashes and takes the podium; then the press pool asks about the
// game and the player picks one of four answers, each a different stance. Each answer is read (
// Claude), the room reacts, and fans, the locker room, players, the owner and next
// week's momentum move. Headlines go to the News Center.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { app, useApp, saveLeague } from '../store';
import { Logo, vivid } from '../components';
import { paint, pxText, pxWidth } from '../field/pixel';
import type { League } from '../../core/types';
import { news } from '../../core/season';
import { pressContext, pressQuestions, readAnswer, answerOptions, type Answer, type Question, type Verdict, type PressCtx } from '../../core/presser';
import { applyEffects, media, promise, fans, teamMorale, fallout, type Applied } from '../../core/media';
import { yearsLeft } from '../../core/contracts';
import { coachSprites, lookOf, type CoachSprites } from '../coachlook';
import { rivalryTrashTalk } from '../../core/rivalry';

const RW = 160, RH = 90;
const SKINS = ['#f1c7a5', '#e0ac85', '#c68863', '#9a6440', '#6e4428', '#4a2c1a'];

// Photographers from behind, crouched, camera up; and seated reporters (backs of heads).
const SHOOTER = ['....HHH.....', '...HHHHH....', '..KKHHHHKK..', '..KKJJJJKK..', '.JJJJJJJJJJ.', '.JJJJJJJJJJ.', 'JJJJJJJJJJJJ'];
const HEAD = ['.HHHH.', 'HHHHHH', 'HHHHHH', '.JJJJ.', 'JJJJJJ'];
const HEAD_HAND = ['.....S', '.HHHHS', 'HHHHHS', 'HHHHHH', '.JJJJ.', 'JJJJJJ'];

interface Sprites extends CoachSprites { shooters: HTMLCanvasElement[]; heads: HTMLCanvasElement[]; hands: HTMLCanvasElement[] }

function sprites(L: League): Sprites {
  const coach = coachSprites(lookOf(L), L.teams[L.user].colors);
  const crowd = ['#3a3f4a', '#5a4636', '#2e3542', '#4b3f5a', '#30463c', '#55402f', '#373737'];
  const hair = ['#1b1612', '#3a2a1c', '#6b4a2b', '#2a2a2a', '#8a7a62', '#141414'];
  const shooters = crowd.slice(0, 5).map((j, i) => paint(SHOOTER, { H: hair[i % hair.length], J: j, K: '#121418' }));
  const heads = crowd.map((j, i) => paint(HEAD, { H: hair[(i + 2) % hair.length], J: j }));
  const hands = crowd.map((j, i) => paint(HEAD_HAND, { H: hair[(i + 2) % hair.length], J: j, S: SKINS[(i * 3) % SKINS.length] }));
  return { ...coach, shooters, heads, hands };
}

/** The room: drawn once per team into an offscreen canvas. */
function room(L: League): HTMLCanvasElement {
  const t = L.teams[L.user], c0 = vivid(t.colors[0]), c1 = t.colors[1] ?? '#ffffff';
  const c = document.createElement('canvas'); c.width = RW; c.height = RH;
  const g = c.getContext('2d')!;
  // Back wall.
  g.fillStyle = '#14171d'; g.fillRect(0, 0, RW, 60);
  // Step-and-repeat backdrop behind the podium.
  const bx = 26, bw = 108, by = 5, bh = 50;
  g.fillStyle = c0; g.fillRect(bx, by, bw, bh);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(bx, by, bw, bh);
  const tw = pxWidth(t.abbr) + 10;
  for (let r = 0; r < 6; r++) for (let x = bx + 4 + (r % 2 ? tw / 2 : 0); x + pxWidth(t.abbr) < bx + bw - 2; x += tw) {
    g.globalAlpha = (r + Math.round(x / tw)) % 2 ? 0.55 : 0.8;
    pxText(g, t.abbr, x, by + 4 + r * 8, (r + Math.round(x / tw)) % 2 ? c1 : '#ffffff');
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx, by, bw, 1);
  g.fillStyle = '#0b0d11'; g.fillRect(bx - 2, by + bh, bw + 4, 2);
  // Side door (right) and a TV camera on a tripod (left).
  g.fillStyle = '#0d0f13'; g.fillRect(139, 21, 16, 39); g.fillStyle = '#262a33'; g.fillRect(140, 22, 14, 38); g.fillStyle = '#c9a54a'; g.fillRect(141, 40, 1, 3);
  g.fillStyle = '#20242c'; g.fillRect(3, 30, 14, 8); g.fillStyle = '#353b46'; g.fillRect(16, 32, 5, 4); g.fillStyle = '#e23a3a'; g.fillRect(4, 31, 1, 1);
  g.fillStyle = '#2b2f37'; g.fillRect(9, 38, 1, 21); g.fillRect(5, 58, 9, 1);
  // Floor (carpet with a lighter stage).
  g.fillStyle = '#1d2129'; g.fillRect(0, 60, RW, RH - 60);
  g.fillStyle = '#272c37'; g.fillRect(22, 55, 116, 6); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(22, 55, 116, 1);
  g.fillStyle = 'rgba(255,255,255,.04)'; for (let x = 0; x < RW; x += 4) g.fillRect(x, 64 + (x % 8 ? 0 : 1), 2, 1);
  return c;
}

const MIC = ['#e23a3a', '#f2c230', '#2f7de1', '#ffffff', '#1fb36b', '#ff7a1a', '#9b5de5'];
function drawPodium(g: CanvasRenderingContext2D, L: League) {
  const t = L.teams[L.user], c0 = vivid(t.colors[0]), c1 = t.colors[1] ?? '#ffffff';
  // Microphones fanned on the lectern, each with its station flag.
  MIC.forEach((m, i) => {
    const x = 71 + i * 3, y = 42 + (i % 2);
    g.fillStyle = '#16181c'; g.fillRect(x + 1, y + 2, 1, 5);
    g.fillStyle = m; g.fillRect(x, y + 2, 3, 2);
    g.fillStyle = '#0c0d10'; g.fillRect(x, y, 2, 2);
  });
  g.fillStyle = '#0c0e12'; g.fillRect(65, 48, 32, 16);
  g.fillStyle = c0; g.fillRect(66, 49, 30, 14);
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(66, 58, 30, 5);
  g.fillStyle = c1; g.fillRect(66, 49, 30, 1);
  pxText(g, t.abbr, Math.round(81 - pxWidth(t.abbr, 2) / 2), 51, '#ffffff', 2);
}

type Phase = 'walk' | 'loading' | 'ask' | 'judging' | 'react' | 'done';

export function PresserScreen({ gid }: { gid: string }) {
  const L = useApp().league!;
  const g = L.games.find(x => x.id === gid);
  const ctx = useMemo<PressCtx | null>(() => (g?.result ? pressContext(L, g) : null), [gid]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('walk');
  const [qs, setQs] = useState<Question[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const [verdict, setVerdict] = useState<(Verdict & { applied: Applied }) | null>(null);
  const [heads, setHeads] = useState<string[]>([]);
  const [total, setTotal] = useState({ fans: 0, owner: 0, locker: 0, momentum: 0 });
  const prior = useRef({ ducks: 0, recentGuarantee: (media(L).lastGuarantee ?? -99) >= L.season * 100 + L.week - 3 });
  const start = useRef(performance.now());
  const flashes = useRef<{ x: number; y: number; t: number }[]>([]);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const pointing = useRef(0);
  const evasive = useRef(0);
  const typedRef = useRef(0); typedRef.current = typed;

  // ---- canvas -----------------------------------------------------------------------
  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const gx = cv.getContext('2d')!; gx.imageSmoothingEnabled = false;
    const bg = room(L), sp = sprites(L);
    let raf = 0, last = performance.now(), arrived = false;
    const seats = Array.from({ length: 9 }, (_, k) => ({ x: 4 + k * 17 + (k % 2) * 2, y: 66 + (k % 2) * 3, s: k % sp.heads.length }));
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = Math.max(0, (now - start.current) / 1000), ph = phaseRef.current;
      gx.drawImage(bg, 0, 0);
      // The coach: walks from the door to the podium, then stands behind it.
      const WALK = 3.2, x0 = 150, x1 = 81;
      const walking = ph === 'walk' && t < WALK;
      if (walking) {
        const k = Math.min(1, t / WALK), x = x0 + (x1 - x0) * (1 - (1 - k) * (1 - k));
        const fr = sp.walk[Math.floor(t * 7) % 4];
        gx.drawImage(flipCache(fr), Math.round(x - 7), 40);
      } else {
        // The moment he reaches the podium every camera fires at once.
        if (!arrived) { arrived = true; for (let k = 0; k < 5; k++) flashes.current.push({ x: 8 + k * 31 + 5, y: 79, t: now + k * 40 }); }
        const talk = ph === 'react' || ph === 'judging' || pointing.current > now;
        const bob = talk ? Math.round(Math.sin(t * 6) * 0.6) : 0;
        gx.drawImage(talk && Math.floor(t * 1.5) % 3 === 0 ? sp.point : sp.front, 74, 30 + bob);
      }
      drawPodium(gx, L);
      // Seated press: hands go up when a question is coming.
      const asking = ph === 'loading' || (ph === 'ask' && typedRef.current < 6);
      seats.forEach((s, k) => {
        const up = asking && (k * 7 + Math.floor(t * 2)) % 5 === 0;
        gx.drawImage(up ? sp.hands[s.s] : sp.heads[s.s], s.x, s.y - (up ? 1 : 0));
      });
      // Photographers in front, shooting. Flash density peaks during the walk-in.
      const rate = walking ? 9 : ph === 'react' ? 2.2 : 0.7;
      if (Math.random() < rate * dt) { const k = Math.floor(Math.random() * 5); flashes.current.push({ x: 8 + k * 31 + 5, y: 79, t: now }); }
      sp.shooters.forEach((s, k) => gx.drawImage(s, 6 + k * 31, 81 + (k % 2)));
      flashes.current = flashes.current.filter(f => now - f.t < 160);
      for (const f of flashes.current) {
        if (now < f.t) continue;
        const a = 1 - (now - f.t) / 160;
        gx.fillStyle = `rgba(255,255,255,${a})`; gx.fillRect(f.x - 1, f.y - 1, 3, 3);
        gx.fillStyle = `rgba(255,255,255,${a * 0.35})`; gx.fillRect(f.x - 3, f.y - 3, 7, 7); gx.fillRect(f.x - 6, f.y, 13, 1); gx.fillRect(f.x, f.y - 6, 1, 13);
        gx.fillStyle = `rgba(255,250,235,${a * 0.08})`; gx.fillRect(0, 0, RW, RH);
      }
      // Lower third during the walk.
      if (ph === 'walk') {
        const a = Math.min(1, t / 0.4);
        gx.globalAlpha = a;
        gx.fillStyle = 'rgba(8,9,12,.88)'; gx.fillRect(0, 3, 9 + pxWidth('LIVE POST-GAME'), 9);
        gx.fillStyle = '#e23a3a'; gx.fillRect(0, 3, 2, 9);
        pxText(gx, 'LIVE', 5, 5, Math.floor(t * 2) % 2 ? '#ff5a5a' : '#ffffff'); pxText(gx, 'POST-GAME', 5 + pxWidth('LIVE '), 5, '#ffd34d');
        gx.globalAlpha = 1;
      }
      if (ph === 'walk' && t >= WALK + 0.5) setPhase('loading');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gid]);

  // ---- questions ----------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'loading' || !ctx) return;
    const m = media(L);
    if (!m.pressed.includes(gid)) m.pressed.push(gid);
    let live = true;
    const id = setTimeout(() => { if (live) { setQs(pressQuestions(L, ctx)); setI(0); setTyped(0); setPhase('ask'); } }, 700);
    return () => { live = false; clearTimeout(id); };
  }, [phase]);

  // Typewriter for the question.
  const q = qs[i];
  useEffect(() => {
    if (phase !== 'ask' || !q || typed >= q.text.length) return;
    const id = setTimeout(() => setTyped(n => Math.min(q.text.length, n + 2)), 18);
    return () => clearTimeout(id);
  }, [phase, typed, q]);

  const options = useMemo<Answer[]>(() => (ctx && q ? answerOptions(L, ctx, q) : []), [q]);
  const submit = (pick: Answer) => {
    if (!ctx || !q || phase !== 'ask') return;
    const a = pick.text;
    pointing.current = performance.now() + 2500;
    const v: Verdict = readAnswer(L, ctx, q, a, prior.current);
    const applied = applyEffects(L, v.effects);
    const m = media(L);
    if (v.guarantee && ctx.next) { promise(L, { kind: 'guarantee', gid: ctx.next.gid, stake: 2, text: a.slice(0, 120) }); m.lastGuarantee = L.season * 100 + L.week; prior.current.recentGuarantee = true; }
    if (v.tone.some(t => /trash/i.test(t)) && ctx.next) { m.bulletin = ctx.next.abbr; rivalryTrashTalk(L, ctx.next.abbr); }
    if (v.fined) news(L, 'coach', `${ctx.coach} fined $${(50 + Math.round(Math.random() * 4) * 25)},000 for his post-game comments.`, [L.user]);
    if (v.headline) { news(L, 'coach', v.headline, [L.user], { big: !!v.guarantee }); setHeads(h => [...h, v.headline!]); }
    // What was said here comes back on the Weekly Hub.
    const quote = a.length > 110 ? a.slice(0, 107) + '…' : a;
    for (const x of applied.players) {
      if (x.delta <= -6) fallout(L, { kind: 'calledout', pid: x.p.id, quote });
      else if (x.delta >= 6 && yearsLeft(x.p.contract, L.season) <= 2 && x.p.ovr >= 75) fallout(L, { kind: 'praised', pid: x.p.id, quote });
    }
    const has = (re: RegExp) => v.tone.some(t => re.test(t));
    if (v.fined) fallout(L, { kind: 'fined', quote });
    if (has(/evasive|dodg|curt/i)) { evasive.current++; if (evasive.current >= 2) fallout(L, { kind: 'media' }); }
    if (has(/accountab|own/i) && !ctx.won) fallout(L, { kind: 'rally', quote });
    if (has(/fans/i) && applied.fans > 0) fallout(L, { kind: 'fans', quote });
    if (has(/call/i) && !applied.players.length) fallout(L, { kind: 'room', quote });
    setTotal(s => ({ fans: s.fans + applied.fans, owner: s.owner + applied.owner, locker: s.locker + applied.locker, momentum: s.momentum + applied.momentum }));
    setVerdict({ ...v, applied });
    // A follow-up jumps the queue.
    if (v.followup) setQs(list => [...list.slice(0, i + 1), { ...q, text: v.followup!, follow: true }, ...list.slice(i + 1)]);
    setPhase('react');
    app.touch();
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (phase === 'ask' && /^[1-4]$/.test(e.key) && options[+e.key - 1]) { e.preventDefault(); submit(options[+e.key - 1]); }
      else if (phase === 'react' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const next = () => {
    setVerdict(null);
    if (i + 1 >= qs.length) { setPhase('done'); void saveLeague(L, `${L.id}-auto`); return; }
    setI(i + 1); setTyped(0); setPhase('ask');
  };
  const leave = () => { app.replace({ id: 'box', gid }); };

  if (!g || !ctx) return <div className="card empty">No game to talk about.</div>;
  const T = L.teams[L.user], O = L.teams[ctx.them];
  const delta = (k: string, v: number) => v ? <span key={k} className={`ps-d ${v > 0 ? 'up' : 'dn'}`}>{k} {v > 0 ? '▲' : '▼'}{Math.abs(Math.round(v * 10) / 10)}</span> : null;

  return (
    <div className="presser" style={{ '--tc': vivid(T.colors[0]) } as CSSProperties}>
      <div className="ps-stage">
        <canvas ref={canvas} width={RW} height={RH} />
        <div className="ps-score"><Logo team={T} size={22} /><b>{ctx.usPts}</b><span>FINAL{ctx.ot ? ' OT' : ''}</span><b>{ctx.themPts}</b><Logo team={O} size={22} /></div>
        {phase === 'walk' && <button className="ps-skip" onClick={() => { start.current -= 10_000; }}>Skip ▸</button>}
      </div>

      <div className="ps-panel">
        {(phase === 'walk' || phase === 'loading') && <div className="ps-wait"><span className="ps-dot" /> {phase === 'walk' ? `${ctx.coach} is heading to the podium…` : 'The press pool is getting ready…'}</div>}

        {(phase === 'ask' || phase === 'judging' || phase === 'react') && q && (
          <>
            <div className="ps-q">
              <div className="ps-who"><b>{q.reporter}</b><span>{q.outlet}</span>{q.follow && <em>Follow-up</em>}<i>{i + 1} / {qs.length}</i></div>
              <p>{q.text.slice(0, phase === 'ask' ? typed : q.text.length)}{phase === 'ask' && typed < q.text.length && <span className="ps-caret">▌</span>}</p>
            </div>
            {phase !== 'react' ? (
              <div className="ps-a">
                <div className="ps-opts">{options.map((o, k) => (
                  <button key={o.text} className="ps-opt" disabled={phase !== 'ask'} onClick={() => submit(o)}>
                    <kbd>{k + 1}</kbd><span className="ps-ot">{o.tone}</span><span className="ps-ox">“{o.text}”</span>
                  </button>
                ))}</div>
                <div className="small mute" style={{ marginTop: 8 }}>Pick an answer (1–4) · Fans {Math.round(fans(L))} · Locker room {Math.round(teamMorale(L))} · Owner {Math.round(L.security)}</div>
              </div>
            ) : verdict && (
              <div className="ps-r">
                <div className="ps-tones">{verdict.tone.map(t => <span key={t}>{t}</span>)}</div>
                <p>{verdict.reaction}</p>
                <div className="ps-ds">
                  {delta('Fans', verdict.applied.fans)}{delta('Locker room', verdict.applied.locker)}{delta('Owner', verdict.applied.owner)}{delta('Momentum', verdict.applied.momentum)}
                  {verdict.applied.players.map(x => delta(`${x.p.ln} morale`, x.delta))}
                  {verdict.guarantee && <span className="ps-d gold">Guarantee on the line{ctx.next ? ` vs ${L.teams[ctx.next.abbr].nick}` : ''}</span>}
                  {verdict.fined && <span className="ps-d dn">Fine coming</span>}
                </div>
                {verdict.headline && <div className="ps-head"><b>Headline</b>{verdict.headline}</div>}
                <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={next}>{i + 1 >= qs.length ? 'Wrap It Up' : 'Next Question'}</button></div>
              </div>
            )}
          </>
        )}

        {phase === 'done' && (
          <div className="ps-done">
            <div className="up">Press conference over</div>
            <div className="h2">{heads.length ? 'You made headlines' : 'In and out, no fireworks'}</div>
            <div className="ps-ds big">{delta('Fans', total.fans)}{delta('Locker room', total.locker)}{delta('Owner', total.owner)}{delta('Momentum', total.momentum)}{!total.fans && !total.locker && !total.owner && !total.momentum && <span className="ps-d">No change</span>}</div>
            {heads.map(h => <div key={h} className="ps-head"><b>News</b>{h}</div>)}
            {media(L).promises.filter(p => p.kind === 'guarantee').map(p => <div key={p.gid} className="ps-head gold"><b>On the line</b>Your guarantee is settled after the next game. Win and the city loves you; lose and it gets loud.</div>)}
            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" autoFocus onClick={leave}>Leave the Podium</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

const flipped = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
/** The walk sprites face right; the coach walks in from the right, so mirror them. */
function flipCache(c: HTMLCanvasElement) {
  let f = flipped.get(c);
  if (!f) { f = document.createElement('canvas'); f.width = c.width; f.height = c.height; const g = f.getContext('2d')!; g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); flipped.set(c, f); }
  return f;
}

/** The invitation shown on the box score after the user's latest game. */
export function PressInvite({ gid }: { gid: string }) {
  const L = useApp().league!;
  const skip = () => { const m = media(L); if (!m.pressed.includes(gid)) m.pressed.push(gid); app.touch(); };
  return (
    <div className="card ps-invite">
      <div><div className="up">Post-game</div><div className="h3">The press is waiting</div><p className="small dim">Answer the beat reporters in your own words. What you say moves the fans, the locker room, your players and the owner, and can fire up (or hand bulletin-board material to) next week's opponent.</p></div>
      <div className="row"><button className="btn" onClick={skip}>Skip</button><button className="btn primary" onClick={() => app.go({ id: 'presser', gid })}>Take the Podium</button></div>
    </div>
  );
}
