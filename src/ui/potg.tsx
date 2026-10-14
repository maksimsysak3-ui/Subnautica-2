// Player of the game: a brief sideline interview after the final whistle, the pixel model
// blown up big beside a reporter, a lower third with his line, and two quick answers.
import { useEffect, useRef, useState } from 'react';
import type { GameSim } from '../sim/game';
import type { League, StatLine, Team } from '../core/types';
import { renderRig, POSE, W as RW, H as RH } from './field/rig';
import { kitFor } from './field';
import './potg.css';

const score = (s: StatLine) => s.py * 0.045 + s.ptd * 4 - s.pint * 3 + (s.ry + s.recy) * 0.1 + (s.rtd + s.rectd) * 6 + s.tkl * 0.6 + s.dsk * 4 + s.dint * 5 + s.ff * 3 + s.dtd * 6 + s.fgm * 1.5;
function lineOf(s: StatLine) {
  const b: string[] = [];
  if (s.pa) b.push(`${s.pc}/${s.pa}, ${s.py} yds, ${s.ptd} TD${s.pint ? `, ${s.pint} INT` : ''}`);
  if (s.ra >= 5 || s.rtd) b.push(`${s.ra} car, ${s.ry} yds${s.rtd ? `, ${s.rtd} TD` : ''}`);
  if (s.rec) b.push(`${s.rec} rec, ${s.recy} yds${s.rectd ? `, ${s.rectd} TD` : ''}`);
  if (s.tkl || s.dsk || s.dint) b.push(`${s.tkl} tkl${s.dsk ? `, ${s.dsk} sk` : ''}${s.dint ? `, ${s.dint} INT` : ''}`);
  if (s.fga) b.push(`${s.fgm}/${s.fga} FG`);
  return b.slice(0, 2).join(' · ');
}
export function pickPotg(L: League, sim: GameSim) {
  const win = sim.score[1] >= sim.score[0] ? 1 : 0;
  let best: { id: string; s: StatLine; v: number } | null = null;
  for (const [id, s] of sim.lines) { const p = L.players[id]; if (!p) continue; const side = p.team === sim.sides[1].abbr ? 1 : 0; const v = score(s) * (side === win ? 1.25 : 0.8); if (!best || v > best.v) best = { id, s, v }; }
  return best;
}

export function PlayerOfGame({ L, sim, home, away, onClose }: { L: League; sim: GameSim; home: Team; away: Team; onClose: () => void }) {
  const pick = pickPotg(L, sim);
  const cv = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState(0);
  const p = pick ? L.players[pick.id] : null;
  const team = p && p.team === home.abbr ? home : away, isHome = team === home;
  const won = (isHome ? sim.score[1] > sim.score[0] : sim.score[0] > sim.score[1]);
  const qs = p ? [
    [`${p.fn}, ${pick!.s.ptd + pick!.s.rtd + pick!.s.rectd > 1 ? 'multiple scores tonight' : 'what a night'}. What was working?`,
      won ? `Credit the guys up front and the game plan. We saw what they were giving us and we took it.` : `Doesn't mean much in a loss. We left plays out there and that's on all of us.`],
    [`Where does this team go from here?`, won ? `Enjoy it tonight, back to work tomorrow. We haven't done anything yet.` : `We'll watch the film, get it fixed, and come back swinging next week.`],
  ] : [];
  useEffect(() => {
    if (!p) { onClose(); return; }
    const c = cv.current!, g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
    let raf = 0; const t0 = performance.now();
    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#05070f'); gr.addColorStop(1, '#14301c');
      g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 40; i++) { const x = (i * 97 + t * 6) % c.width, y = (i * 53) % (c.height * 0.5); g.fillStyle = `rgba(255,240,200,${0.08 + (i % 5) * 0.03})`; g.beginPath(); g.arc(x, y, 6 + (i % 4) * 5, 0, 7); g.fill(); }
      const kit = kitFor(team, isHome);
      const bob = Math.round(Math.sin(t * 2) * 2);
      g.drawImage(renderRig(step === 0 ? { ...POSE.stand(), na: 0.2, ne: 2.2, ball: 1 } : POSE.stand(), 'skill', kit, '#a46e4c', p?.num ?? 0, true), 250, -40 + bob, RW * 6.5, RH * 6.5);
      g.drawImage(renderRig(POSE.reach(9, -2), 'civ', { jersey: '#20242e', num: '#20242e', trim: '#20242e', pants: '#2b2f3a', helmet: '#3a2a20', mask: '#3a2a20', socks: '#2b2f3a' }, '#e6c2a2', -1, false), 20, -20, RW * 6, RH * 6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const tm = setInterval(() => setStep(s => s + 1), 4200);
    return () => { cancelAnimationFrame(raf); clearInterval(tm); };
  }, []);
  useEffect(() => { if (step >= qs.length + 1) onClose(); }, [step]);
  if (!p || !pick) return null;
  const qa = qs[Math.min(step, qs.length - 1)];
  return (
    <div className="potg" onClick={onClose}>
      <div className="potg-box" style={{ '--tc': team.colors[0] } as React.CSSProperties}>
        <canvas ref={cv} width={560} height={320} />
        <div className="potg-tag"><b>Player of the Game</b><span>{p.num} {p.fn} {p.ln} · {p.pos} · {team.nick}</span><em>{lineOf(pick.s)}</em></div>
        {qa && <div className="potg-qa" key={step}><p className="q">{qa[0]}</p><p className="a">“{qa[1]}”</p></div>}
        <button className="potg-x" onClick={onClose}>Continue ▸</button>
      </div>
    </div>
  );
}
