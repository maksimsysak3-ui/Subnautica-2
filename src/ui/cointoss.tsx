// The opening coin toss at midfield: the visiting captain calls it in the air, the winner chooses
// to receive or defer. Shared by the NFL and college game screens; the screen tells the sim who
// receives first through GameSim.setToss.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import './cointoss.css';

export interface TossTeam { name: string; abbr: string; color: string }
type Call = 'Heads' | 'Tails';
type Phase = 'call' | 'air' | 'choose' | 'done';

/** `teams` is [away, home]. `onDone` gets the side that receives the opening kickoff. */
export function CoinToss({ teams, userSide, onDone }: { teams: [TossTeam, TossTeam]; userSide: 0 | 1; onDone: (receiver: 0 | 1) => void }) {
  const [phase, setPhase] = useState<Phase>('call');
  const [call, setCall] = useState<Call | null>(null);
  const [face, setFace] = useState<Call>('Heads');
  const [spin, setSpin] = useState(0);
  const timers = useRef<number[]>([]);
  const raf = useRef(0);
  useEffect(() => () => { timers.current.forEach(clearTimeout); cancelAnimationFrame(raf.current); }, []);
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const flip = (c: Call) => {
    const res: Call = Math.random() < 0.5 ? 'Heads' : 'Tails';
    setCall(c); setFace(res); setPhase('air');
    // Whole turns plus a half turn for tails, so the coin lands on the right face.
    const to = 360 * 7 + (res === 'Tails' ? 180 : 0), t0 = performance.now(), dur = reduced ? 1 : 2000;
    const tick = (now: number) => { const k = Math.min(1, (now - t0) / dur); setSpin(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    later(reduced ? 200 : 2100, () => setPhase('choose'));
  };
  // The visitors call it: when that's the CPU, it calls after a beat.
  useEffect(() => {
    if (userSide === 0) return;
    later(900, () => flip(Math.random() < 0.5 ? 'Heads' : 'Tails'));
  }, []);

  const winner: 0 | 1 = call === face ? 0 : 1;
  const userWon = winner === userSide;
  const finish = (receiver: 0 | 1) => { setPhase('done'); later(reduced ? 0 : 320, () => onDone(receiver)); };
  // The CPU almost always defers, like real coaches; once in a while it takes the ball.
  const cpuReceives = useRef(Math.random() < 0.18).current;
  const W = teams[winner], O = teams[1 - winner];

  return (
    <div className={`ct${phase === 'done' ? ' out' : ''}`} role="dialog" aria-label="Coin toss" style={{ '--ca': teams[0].color, '--ch': teams[1].color } as CSSProperties}>
      <div className="ct-card">
        <div className="ct-kick">Opening coin toss · Midfield</div>
        <div className="ct-caps">
          <div className="ct-cap a"><i /><b>{teams[0].abbr}</b><span>Visitors{userSide === 0 ? ' · You' : ''}</span></div>
          <div className="ct-stage">
            <div className={`ct-arc${phase === 'air' && !reduced ? ' go' : ''}`}>
              <Coin angle={spin} />
            </div>
            <div className="ct-shadow" />
          </div>
          <div className="ct-cap h"><i /><b>{teams[1].abbr}</b><span>Home{userSide === 1 ? ' · You' : ''}</span></div>
        </div>
        <div className="ct-ref">
          {phase === 'call' && (userSide === 0
            ? <><p>The referee hands you the call. <b>{teams[0].abbr}</b>, call it in the air.</p>
                <div className="ct-btns"><button onClick={() => flip('Heads')}>Heads</button><button onClick={() => flip('Tails')}>Tails</button></div></>
            : <p><b>{teams[0].name}</b> will call the toss…</p>)}
          {phase === 'air' && <p><b>{teams[0].abbr}</b> calls <b>{call}</b>.</p>}
          {(phase === 'choose' || phase === 'done') && <>
            <p className="ct-res"><span>{face}.</span> <b style={{ boxShadow: `inset 0 -3px 0 ${W.color}` }}>{W.name}</b> win the toss.</p>
            {userWon ? <>
              <p>Your choice, captain.</p>
              <div className="ct-btns">
                <button onClick={() => finish(userSide)}>Receive<small>Take the ball now</small></button>
                <button onClick={() => finish((1 - userSide) as 0 | 1)}>Defer<small>Get it to open the second half</small></button>
              </div>
            </> : <>
              <p>{W.name} {cpuReceives ? 'elect to receive.' : <>defer to the second half. <b>{O.name}</b> will receive.</>}</p>
              <div className="ct-btns"><button onClick={() => finish(cpuReceives ? winner : (1 - winner) as 0 | 1)}>To kickoff</button></div>
            </>}
          </>}
        </div>
      </div>
    </div>
  );
}

/** The coin end over end: the face foreshortens through edge-on (where its milled rim shows) and
 *  turns over to the other side. `angle` is in degrees; 0 is heads up. */
const D = 112;   // coin diameter, px (matches .ct-arc)
function Coin({ angle }: { angle: number }) {
  const a = (angle * Math.PI) / 180, c = Math.cos(a), sq = Math.max(0.04, Math.abs(c));
  const rim = Math.sin(a) * 7;   // how much edge shows, and on which side
  return (
    <div className="ct-coin">
      {/* The milled edge between the face and its offset copy: a capsule as tall as the face plus the rim. */}
      <div className="ct-rim" style={{ top: (D - D * sq) / 2 + Math.min(0, rim), height: D * sq + Math.abs(rim), borderRadius: `50% / ${(D * sq) / 2}px` }} />
      <div className="ct-face" style={{ transform: `scaleY(${sq})`, filter: `brightness(${0.75 + 0.25 * sq})` }}><CoinFace side={c >= 0 ? 'Heads' : 'Tails'} /></div>
    </div>
  );
}

/** One face of the toss coin: reeded rim, lettered ring, struck emblem. */
function CoinFace({ side }: { side: Call }) {
  const id = `cf${side}`;
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={`${id}m`} cx="35%" cy="28%" r="80%"><stop offset="0" stopColor="#fff6c8" /><stop offset=".35" stopColor="#f1cd5a" /><stop offset=".75" stopColor="#c6941f" /><stop offset="1" stopColor="#8a5f0c" /></radialGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7dc7c" /><stop offset=".5" stopColor="#d9a93a" /><stop offset="1" stopColor="#a87717" /></linearGradient>
        <path id={`${id}r`} d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" />
      </defs>
      <circle cx="50" cy="50" r="49" fill="#7a530a" />
      <circle cx="50" cy="50" r="47.5" fill={`url(#${id}m)`} />
      {Array.from({ length: 90 }, (_, i) => { const a = (i / 90) * Math.PI * 2; return <line key={i} x1={50 + Math.cos(a) * 44.5} y1={50 + Math.sin(a) * 44.5} x2={50 + Math.cos(a) * 47.5} y2={50 + Math.sin(a) * 47.5} stroke="rgba(90,60,5,.55)" strokeWidth=".9" />; })}
      <circle cx="50" cy="50" r="43" fill={`url(#${id}f)`} stroke="#8a5f0c" strokeWidth="1" />
      <circle cx="50" cy="50" r="29" fill="none" stroke="rgba(110,75,8,.55)" strokeWidth=".8" />
      <circle cx="50" cy="50" r="40.5" fill="none" stroke="rgba(255,240,180,.55)" strokeWidth=".6" />
      <text fontFamily="'Barlow Condensed', Inter, sans-serif" fontWeight="800" fontSize="7" fill="#6b4705">
        <textPath href={`#${id}r`} textLength={2 * Math.PI * 35 - 4} lengthAdjust="spacing">{side === 'Heads' ? 'HEADS ★ OPENING TOSS ★ HEADS ★ GAME DAY ★' : 'TAILS ★ OPENING TOSS ★ TAILS ★ GAME DAY ★'}</textPath>
      </text>
      <g transform="translate(50 50)" fill="#7a530a" stroke="#fff3c0" strokeWidth=".5" strokeOpacity=".6">
        {side === 'Heads' ? (
          // A football, laces up.
          <g transform="rotate(-35)">
            <path d="M-19,0 C-12,-11 12,-11 19,0 C12,11 -12,11 -19,0 Z" />
            <path d="M-8,0 H8" stroke="#ffe9a0" strokeWidth="1.6" strokeOpacity="1" />
            {[-6, -3, 0, 3, 6].map(x => <path key={x} d={`M${x},-2.6 V2.6`} stroke="#ffe9a0" strokeWidth="1.3" strokeOpacity="1" />)}
            <path d="M-15,-4 C-14,-1 -14,1 -15,4 M15,-4 C14,-1 14,1 15,4" fill="none" stroke="#ffe9a0" strokeWidth="1.1" strokeOpacity="1" />
          </g>
        ) : (
          // Goalposts.
          <g fill="none" stroke="#7a530a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M-13,-17 V-3 H13 V-17 M0,-3 V18" />
            <path d="M-13,-17 V-3 H13 V-17 M0,-3 V18" stroke="#ffe9a0" strokeWidth="1" />
            <path d="M-9,18 H9" strokeWidth="3" />
          </g>
        )}
      </g>
      <ellipse cx="38" cy="30" rx="20" ry="10" fill="rgba(255,255,255,.18)" transform="rotate(-30 38 30)" />
    </svg>
  );
}
