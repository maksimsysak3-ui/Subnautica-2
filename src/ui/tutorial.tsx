// The opening tutorial: a guided tour over the real interface. Each step dims the
// screen, cuts a spotlight around the part it explains and puts a short card next to
// it. Shown once (on the first franchise, or the first load after this build), and
// replayable from Options. Arrow keys / Enter move, Esc skips.
import { useEffect, useLayoutEffect, useState } from 'react';
import { app } from './store';

interface Step { title: string; body: string; target?: string; pick?: 'first' | 'last'; nth?: number; screen?: string }
const STEPS: Step[] = [
  { title: 'Welcome to the front office', body: 'You run the whole franchise: roster, contracts, the draft, the coaching staff, game plans, and what you say to the press. Here is a 60-second tour. Use ← → or the buttons; Esc skips.' },
  { title: 'The five tabs', target: '.bigtabs', body: 'Gameday, Weekly Hub, Manage Roster, Coach Central and League. Press Q / E to flip between them from anywhere.' },
  { title: 'Weekly actions', target: '.wc', pick: 'first', screen: 'hub', body: 'Every week your building throws decisions at you: holdouts, unhappy backups, rivalry week, the owner, the media. Each choice spells out its stakes. Enter takes the highlighted choice, X hands it to your staff.' },
  { title: 'Your status', target: '.mh-pill, .mh-coach, .masthead .who', pick: 'first', body: 'Your team and where the season stands. On wider screens the header also shows coach level and record, coach points, roster count (53 max in season) and cap space. Red cap space means you must cut or trade before the season can move on.' },
  { title: 'Advance the season', target: '.masthead button', pick: 'last', body: 'This button always does the next thing: start the season, play or sim this week, move through free agency and the draft.' },
  { title: 'Gameday', target: '.bigtab', nth: 0, body: 'Watch the pregame matchup, set your game plan, then play the game call by call in the pixel broadcast, or sim it. After each game you can take the podium: what you say moves fans, players and the owner.' },
  { title: 'Manage Roster', target: '.bigtab', nth: 2, body: 'Depth chart (untouched positions are kept sorted for you), trades (draft picks have real value), free agency, re-signing, the cap and the draft room.' },
  { title: 'Coach Central', target: '.bigtab', nth: 3, body: 'Spend coach points on your coaching tree. Open any of your players to find his Archetype tree: he earns skill points by hitting goals, and finishing levels upgrades him to Star, Superstar and X-Factor. Auto-spend is there if you would rather not.' },
  { title: 'Sub-screens', target: '.subtabs', body: 'Each tab has its own screens down here, like Inbox and News under Weekly Hub.' },
  { title: 'News and shortcuts', target: '.hints', body: 'The ticker carries league news; the bar lists the keys. Esc always goes back.' },
  { title: 'You are on the clock', body: 'Save from Options any time (the game also autosaves each week), and replay this tour from there. Good luck, coach.' },
];
const KEY = 'gg-tutorial-v1';
export const tutorialSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked */ } };

let open: ((v: boolean) => void) | null = null;
/** Start the tour (used by Options → Replay Tutorial). */
export function startTutorial() { open?.(true); }

function find(s: Step): Element | null {
  if (!s.target) return null;
  const all = [...document.querySelectorAll(s.target)].filter(e => (e as HTMLElement).offsetParent !== null);
  return s.nth !== undefined ? all[s.nth] ?? null : s.pick === 'last' ? all[all.length - 1] ?? null : all[0] ?? null;
}

export function Tutorial() {
  const [on, setOn] = useState(() => !tutorialSeen());
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => { open = v => { setI(0); setOn(v); }; return () => { open = null; }; }, []);
  const step = STEPS[i];
  useEffect(() => { if (on && step.screen) app.go({ id: step.screen } as never); }, [on, i]);
  useLayoutEffect(() => {
    if (!on) return;
    let raf = 0;
    const tick = () => { const el = find(step); if (el && i > 0) { el.scrollIntoView({ block: 'nearest' }); } setRect(el ? el.getBoundingClientRect() : null); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, i]);
  const close = () => { markSeen(); setOn(false); };
  const next = () => (i + 1 < STEPS.length ? setI(i + 1) : close());
  const prev = () => setI(Math.max(0, i - 1));
  useEffect(() => {
    if (!on) return;
    const k = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = { ArrowRight: next, Enter: next, ' ': next, ArrowLeft: prev, Escape: close };
      if (map[e.key]) { e.preventDefault(); e.stopImmediatePropagation(); map[e.key](); }
      else if (['q', 'Q', 'e', 'E', 'x', 'X', 'Backspace'].includes(e.key)) { e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  if (!on) return null;
  const pad = 8, vw = window.innerWidth, vh = window.innerHeight;
  const hole = rect ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const cardW = Math.min(380, vw - 32);
  let pos: React.CSSProperties = { left: (vw - cardW) / 2, top: vh * 0.3 };
  if (hole) {
    const below = hole.top + hole.height + 14, above = hole.top - 14;
    const left = Math.max(16, Math.min(vw - cardW - 16, hole.left + hole.width / 2 - cardW / 2));
    pos = below + 220 < vh ? { left, top: below } : { left, top: Math.max(16, above - 220) };
  }
  return (
    <div className="tut" role="dialog" aria-label="Tutorial">
      {hole ? <div className="tut-hole" style={hole} /> : <div className="tut-dim" />}
      <div className="tut-card" style={{ ...pos, width: cardW }}>
        <div className="tut-step">{i + 1} / {STEPS.length}</div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tut-dots">{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" onClick={close}>Skip</button>
          <div className="row">{i > 0 && <button className="btn" onClick={prev}>Back</button>}<button className="btn primary" onClick={next}>{i + 1 < STEPS.length ? 'Next' : "Let's go"}</button></div>
        </div>
      </div>
    </div>
  );
}
