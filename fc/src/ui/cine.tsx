import { useEffect, useRef, useState } from 'react';
import type { Club, Player } from '../core/types';
import { Crest, Face, PlayerCard, TrophySvg, Kit, kitFor } from './art';
import { fmtMoney } from '../core/transfers';
import { sting, roar, whistle } from './sfx';

/** "Here we go!" unveiling: the new signing in the club's kit. */
export function SigningCine({ p, club, fee, loan, onDone }: { p: Player; club: Club; fee: number; loan?: boolean; onDone: () => void }) {
  useEffect(() => { sting(); const t = setTimeout(onDone, 7000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="cine signing" onClick={onDone} style={{ ['--c1' as string]: club.c1, ['--c2' as string]: club.c2 }}>
      <div className="sg-rays" />
      <div className="sg-crest"><Crest club={club} size={420} /></div>
      <div className="sg-hwg">HERE WE GO!</div>
      <div className="sg-main">
        <div className="sg-card"><PlayerCard p={p} club={club} size={1.3} /></div>
        <div className="sg-text">
          <span className="sg-kicker">{loan ? 'Loan signing' : fee ? 'Official · Transfer' : 'Official · Free transfer'}</span>
          <h1>{p.name}</h1>
          <div className="sg-meta"><Crest club={club} size={34} /><b>{club.name}</b></div>
          <div className="sg-fee">{loan ? 'Season-long loan' : fee ? fmtMoney(fee) : 'Free'}</div>
          <div className="sg-kit"><Kit {...kitFor(club)} num={p.num} name={p.name.split(' ').slice(-1)[0]} size={130} /></div>
        </div>
      </div>
      <div className="cine-skip">Click to continue</div>
    </div>
  );
}

/** Pre-match walkout: competition, stadium, crests slam, line-ups. */
export function MatchIntro({ home, away, comp, stage, stadium, homeXI, awayXI, onDone }: { home: Club; away: Club; comp: string; stage: string; stadium: string; homeXI: Player[]; awayXI: Player[]; onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const ts = [setTimeout(() => setPhase(1), 900), setTimeout(() => setPhase(2), 2600), setTimeout(() => { setPhase(3); }, 6800), setTimeout(onDone, 7600)];
    return () => ts.forEach(clearTimeout);
  }, [onDone]);
  return (
    <div className={`cine intro ph${phase}`} onClick={onDone} style={{ ['--h' as string]: home.c1, ['--a' as string]: away.c1 }}>
      <div className="in-lights" />
      <div className="in-comp"><span>{comp}</span><b>{stage}</b><em>{stadium}</em></div>
      <div className="in-crests">
        <div className="in-h"><Crest club={home} size={170} /><b>{home.name}</b></div>
        <div className="in-vs">VS</div>
        <div className="in-a"><Crest club={away} size={170} /><b>{away.name}</b></div>
      </div>
      <div className="in-xi">
        <div className="in-col h">{homeXI.map((p, i) => <div key={p.id} style={{ animationDelay: `${i * 70}ms` }}><b>{p.num}</b>{p.name}<span>{p.pos}</span></div>)}</div>
        <div className="in-col a">{awayXI.map((p, i) => <div key={p.id} style={{ animationDelay: `${i * 70}ms` }}><b>{p.num}</b>{p.name}<span>{p.pos}</span></div>)}</div>
      </div>
      <div className="cine-skip">Click to skip</div>
    </div>
  );
}

/** Goal celebration overlay. */
export function GoalCine({ scorer, assist, club, minute, score, onDone, own }: { scorer?: Player; assist?: Player; club: Club; minute: string; score: string; own?: boolean; onDone: () => void }) {
  useEffect(() => { roar(1); const t = setTimeout(onDone, 4200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="cine goal" onClick={onDone} style={{ ['--c1' as string]: club.c1, ['--c2' as string]: club.c2 }}>
      <div className="gl-stripes"><i /><i /><i /></div>
      <div className="gl-word">{own ? 'GOAL' : 'GOAL!'}</div>
      <div className="gl-card">
        {scorer && <Face p={scorer} club={club} size={130} />}
        <div>
          <span className="gl-min">{minute}</span>
          <h2>{scorer?.name ?? 'Goal'}</h2>
          {assist && <span className="gl-ast">Assist · {assist.name}</span>}
          <div className="gl-score"><Crest club={club} size={30} /> {score}</div>
        </div>
      </div>
    </div>
  );
}

/** Trophy lift with confetti. */
export function TrophyCine({ club, title, onDone }: { club: Club; title: string; onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    whistle(true); setTimeout(() => sting(), 600);
    const cv = ref.current!; const ctx = cv.getContext('2d')!;
    const W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    const cols = [club.c1, club.c2, '#f5c542', '#ffffff'];
    const parts = Array.from({ length: 260 }, () => ({ x: Math.random() * W, y: -Math.random() * H, vy: 1.5 + Math.random() * 3, vx: (Math.random() - 0.5) * 1.5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2, c: cols[Math.floor(Math.random() * cols.length)], s: 5 + Math.random() * 7 }));
    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) { p.y += p.vy; p.x += p.vx + Math.sin(p.y / 40); p.r += p.vr; if (p.y > H + 20) { p.y = -10; p.x = Math.random() * W; } ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [club]);
  return (
    <div className="cine trophy" style={{ ['--c1' as string]: club.c1, ['--c2' as string]: club.c2 }}>
      <canvas ref={ref} className="confetti" />
      <div className="tr-glow" />
      <div className="tr-cup"><TrophySvg size={200} /></div>
      <div className="tr-text"><span>CHAMPIONS</span><h1>{title}</h1><div><Crest club={club} size={60} /><b>{club.name}</b></div></div>
      <button className="btn-hero" onClick={onDone}>Continue</button>
    </div>
  );
}
