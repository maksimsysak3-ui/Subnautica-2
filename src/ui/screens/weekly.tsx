// The Weekly Hub card row: tall team-colour cards, one situation each. The focused
// card opens up (bigger photo, the choices, and the staff member you can delegate
// to). Arrow keys move, Enter takes the first choice, X delegates.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { SceneBg, sceneFor, Device } from '../scenes';
const defaultCaller = (c: ActionCard) => (c.kind === 'Trade Call' ? `${c.team.name} GM` : c.kind === 'League Office' ? 'League Office' : c.kind === 'Coaching Staff' ? 'Your coordinator' : c.p ? `${c.p.fn} ${c.p.ln}` : c.kind);
const defaultTexts = (c: ActionCard) => [c.p ? `Coach, it's ${c.p.fn}.` : 'Coach, got a minute?', 'What is going on?', 'We need to talk about this week.'];
import { useApp, app, type Screen } from '../store';
import { Logo, vivid } from '../components';
import { FaceArt } from '../face';
import { NegotiationRoom } from './negotiate';
import { weeklyCards, type ActionCard, type Opener } from '../actions';
import type { Player, Team } from '../../core/types';

export function WeeklyCards() {
  const s = useApp();
  const L = s.league!;
  const cards = useMemo(() => weeklyCards(L), [L, s.v]);
  const [focus, setFocus] = useState(0);
  const [neg, setNeg] = useState<Player | null>(null);
  const f = Math.min(focus, Math.max(0, cards.length - 1));
  const open: Opener = { negotiate: p => setNeg(p), go: (id, extra) => app.go({ id, ...extra } as Screen) };
  const act = (c: ActionCard, i = 0) => { const r = c.choices[i]?.run(open); if (r) app.toast(r); app.touch(); };
  // In a meeting the result is shown in the room instead of a toast.
  const decide = (c: ActionCard, i: number) => {
    let left = false;
    const via: Opener = { negotiate: p => { left = true; closePop(); setNeg(p); }, go: (id, extra) => { left = true; closePop(); open.go(id, extra); } };
    const r = c.choices[i]?.run(via); app.touch();
    return left ? null : (r || '');
  };
  // The week's lead story opens as a breaking-news pop-up, once.
  const wkKey = `${L.season}-${L.phase}-${L.week}`;
  const seen = (L as typeof L & { popSeen?: string }).popSeen;
  const lead = cards.find(c => !c.matchup && ['Holdout', 'Fallout', 'League Office'].includes(c.kind)) ?? cards.find(c => !c.matchup && (c.p || c.scene) && c.feature) ?? cards.find(c => !c.matchup && (c.p || c.scene));
  const [popOpen, setPopOpen] = useState(true);
  // Any card can be opened in its scene; the lead story opens by itself once a week.
  const [picked, setPicked] = useState<ActionCard | null>(null);
  // The lead story is picked once and held, so answering it (which resolves it) doesn't swap
  // the room to another card before you've seen how it went.
  useEffect(() => { if (popOpen && seen !== wkKey && L.phase === 'regular' && lead && !picked) setPicked(lead); }, [wkKey]);
  const pop = picked;
  const closePop = () => { (L as typeof L & { popSeen?: string }).popSeen = wkKey; setPopOpen(false); setPicked(null); };
  const delegate = (c: ActionCard) => { if (!c.delegate) return; c.delegate.run(); app.toast(`Delegated to ${c.delegate.who}`); app.touch(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (neg || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowRight') setFocus(x => Math.min(cards.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setFocus(x => Math.max(0, x - 1));
      else if (e.key === 'Enter' && cards[f]) { if (cards[f].matchup) act(cards[f]); else setPicked(cards[f]); }
      else if ((e.key === 'x' || e.key === 'X') && cards[f]) delegate(cards[f]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  useEffect(() => { document.querySelector('.wc.on')?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); }, [f]);
  return (
    <>
      <div className="wh-row">
        {cards.map((c, i) => <Card key={c.id} c={c} on={i === f} onFocus={() => setFocus(i)} onAct={j => act(c, j)} onOpen={() => (c.matchup ? act(c) : setPicked(c))} onDelegate={() => delegate(c)} />)}
        {!cards.length && <div className="wc empty-card"><h2 className="wc-h">All caught up</h2><p className="wc-b">Nothing in the building needs a decision this week.</p></div>}
      </div>
      {pop && !neg && createPortal(<Meeting key={pop.id} c={pop} decide={j => decide(pop, j)} onClose={closePop} />, document.body)}
      {neg && <NegotiationRoom p={neg} close={() => { setNeg(null); app.touch(); }} />}
    </>
  );
}

function Card({ c, on, onFocus, onAct, onOpen, onDelegate }: { c: ActionCard; on: boolean; onFocus: () => void; onAct: (i: number) => void; onOpen: () => void; onDelegate: () => void }) {
  const t = c.team;
  const stakes = false;
  const big = on && !stakes && !!c.p && (c.feature || c.matchup);
  return (
    <div className={`wc${on ? ' on' : ''}${c.matchup ? ' mu' : ''}${stakes ? ' st' : ''}${stakes && !c.delegate ? ' nd' : ''}`} style={{ '--c1': vivid(t.colors[0]), '--c2': accent(t) } as CSSProperties} onMouseEnter={onFocus} onClick={() => (on ? onOpen() : onFocus())}>
      <div className="wc-bg"><i className="wc-paint" /><i className="wc-swoosh" /><Logo team={t} size={360} style={{ position: 'absolute', left: -80, top: -40, opacity: 0.14 }} /></div>
      <span className="wc-kind">{c.kind}</span>
      {c.p && (big ? <Shot p={c.p} t={t} cls="wc-shot" /> : <Shot p={c.p} t={t} cls="wc-face" />)}
      <div className="wc-text">
        <h2 className="wc-h">{c.headline}</h2>
        <p className="wc-b">{c.body}</p>
        {(c.speaker || c.where) && <p className="wc-who">{c.speaker ?? ''}{c.speaker && c.where ? ' · ' : ''}{c.where ?? ''}</p>}
        {on && (c.matchup
          ? <div className="wc-acts">{c.choices.map((x, i) => <button key={x.label} className={`btn sm${i === 0 ? ' primary' : ''}`} onClick={e => { e.stopPropagation(); onAct(i); }}>{x.label}</button>)}</div>
          : <button className="wc-take" onClick={e => { e.stopPropagation(); onOpen(); }}>{verb(c)} <kbd>⏎</kbd></button>)}
      </div>
      {on && c.delegate && (
        <div className="wc-del" onClick={e => { e.stopPropagation(); onDelegate(); }}>
          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
            <span className="wc-av">{c.delegate.who.split(' ').map(s => s[0]).join('')}</span>
            <div style={{ flex: 1 }}><b>Delegate</b><span>{c.delegate.who} | {c.delegate.role}</span></div>
            <kbd>X</kbd>
          </div>
          <q>{c.delegate.quote}</q>
        </div>
      )}
    </div>
  );
}

/** Headshot cut-out (or the generated portrait) for the cards. */
function Shot({ p, t, cls }: { p: Player; t: Team; cls: string }) {
  const [bad, setBad] = useState(false);
  const url = p.hs && !bad ? p.hs.replace('f_auto,q_auto', 'f_auto,q_auto,w_400') : undefined;
  return <div className={cls}>{url ? <img src={url} alt="" onError={() => setBad(true)} /> : <FaceArt p={p} team={t} size={cls === 'sp-shot' ? 340 : cls === 'wc-shot' ? 260 : 76} />}</div>;
}
/** A team's second colour for the swoosh, lifted when it is black or white. */
function accent(t: Team) { const c = t.colors[1] ?? '#ffd23f'; const n = parseInt(c.slice(1), 16); const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l < 40 || l > 235 ? (t.colors[2] ?? '#c9ced8') : c; }

/** What taking the card means: a meeting, a call, a report to answer. */
function verb(c: ActionCard) { const k = sceneFor(c); return k === 'phone' ? 'Take the call' : k === 'texts' ? 'Answer him' : k === 'tv' ? 'Respond' : k === 'film' ? 'Go to the film room' : k === 'field' ? 'Head to the field' : 'Take the meeting'; }
/** Stakes / results as chips: "Fans +4 · Owner −1" → [Fans +4, Owner −1]. */
const chips = (s?: string) => (s ?? '').split(' · ').map(x => x.trim()).filter(Boolean);
const toneOf = (x: string) => (/[−-]\d|−/.test(x) ? 'neg' : /\+\d/.test(x) ? 'pos' : '');

/** A decision played as a conversation in its set: they talk, you answer, they react, and
 *  you see what it did. Opening a screen (a negotiation, trade talks) leaves the room. */
function Meeting({ c, decide, onClose }: { c: ActionCard; decide: (i: number) => string | null; onClose: () => void }) {
  const t = c.team;
  const scene = sceneFor(c);
  const who = c.speaker ?? c.caller ?? (c.p ? `${c.p.fn} ${c.p.ln}` : defaultCaller(c));
  const spoken = !!c.lines?.length && !c.narr;      // otherwise the situation is narrated
  const lines = c.lines?.length ? c.lines : [c.body];
  const [shown, setShown] = useState(0);            // lines fully on screen
  const [typed, setTyped] = useState(0);            // characters of the line being typed
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState('');
  const [beat, setBeat] = useState(0);              // outcome beats: your line, their reaction, the effects
  const talking = shown < lines.length;
  useEffect(() => {
    if (!talking) return;
    const line = lines[shown];
    if (typed < line.length) { const id = setTimeout(() => setTyped(x => Math.min(line.length, x + 3)), 18); return () => clearTimeout(id); }
    const id = setTimeout(() => { setShown(x => x + 1); setTyped(0); }, 650); return () => clearTimeout(id);
  }, [talking, shown, typed]);
  useEffect(() => { if (pick === null || beat >= 3) return; const id = setTimeout(() => setBeat(b => b + 1), beat === 0 ? 450 : 900); return () => clearTimeout(id); }, [pick, beat]);
  const skipTalk = () => { if (talking) { setShown(lines.length); setTyped(0); } };
  const choose = (i: number) => {
    if (pick !== null) return;
    const r = decide(i);
    if (r === null) return;                          // it opened another screen
    setPick(i); setResult(r); setBeat(0);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); if (talking) skipTalk(); else if (pick !== null && beat >= 2) onClose(); }
      else if (/^[1-4]$/.test(e.key) && !talking && pick === null && c.choices[+e.key - 1]) { e.preventDefault(); e.stopImmediatePropagation(); choose(+e.key - 1); }
    };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  });
  const ch = pick !== null ? c.choices[pick] : null;
  const effects = chips(result && / [+−-]\d/.test(result) ? result : ch?.hint);
  const reaction = ch?.react ?? (result && !/ [+−-]\d/.test(result) ? result : '');
  return (
    <div className="sp mt" style={{ '--c1': vivid(t.colors[0]), '--c2': accent(t) } as CSSProperties} onClick={skipTalk}>
      <i className="sp-bar top" /><i className="sp-bar bot" />
      <div className="sp-bg"><SceneBg kind={scene} caller={c.caller} texts={c.texts} accent={vivid(t.colors[0])} /><Logo team={t} size={720} style={{ position: 'absolute', right: -160, top: -120, opacity: 0.06 }} /></div>
      <div className="mt-in">
        <div className="mt-left">
          {scene === 'phone' || scene === 'texts' ? <div className="sp-devslot"><Device kind={scene} caller={c.caller ?? defaultCaller(c)} texts={c.texts ?? defaultTexts(c)} /></div> : c.p ? <Shot p={c.p} t={t} cls="sp-shot" /> : <div className="mt-badge"><Logo team={t} size={180} /></div>}
          <div className="mt-name">{c.p ? <><b>{c.p.fn} {c.p.ln}</b><span>{c.p.pos} · {c.p.ovr} OVR</span>{c.speaker && !c.speaker.startsWith(`${c.p.fn} ${c.p.ln}`) && <span className="mt-with">Meeting with {c.speaker}</span>}</> : <><b>{who.split(' · ')[0]}</b><span>{c.where ?? c.kind}</span></>}</div>
        </div>
        <div className="mt-talk">
          <div className="sp-tags"><span className="sp-live">{c.kind}</span><span className="sp-kind">{c.where ?? `${t.nick} facility`}</span></div>
          <h1 className="mt-h">{c.headline}</h1>
          <div className="mt-log">
            {lines.slice(0, shown + (talking ? 1 : 0)).map((l, i) => <p key={i} className={spoken ? 'mt-them' : 'mt-narr'}>{spoken && <em>{who.split(' · ')[0]}</em>}{i === shown && talking ? l.slice(0, typed) : l}{i === shown && talking && <i className="sp-caret">▌</i>}</p>)}
            {ch && beat >= 0 && <p className="mt-me"><em>{ch.reply ? 'You' : 'Your call'}</em>{ch.reply ?? ch.label}</p>}
            {ch && beat >= 1 && reaction && <p className={ch.react && spoken ? 'mt-them react' : 'mt-narr'}>{ch.react && spoken && <em>{who.split(' · ')[0]}</em>}{reaction}</p>}
          </div>
          {!talking && pick === null && (
            <div className="mt-choices">{c.choices.map((x, i) => (
              <button key={x.label} className="mt-choice" onClick={e => { e.stopPropagation(); choose(i); }} style={{ animationDelay: `${i * 0.07}s` }}>
                <kbd>{i + 1}</kbd><div><b>{x.reply ? `“${x.reply}”` : x.label}</b>{x.hint && <span className="mt-stakes">{chips(x.hint).map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</span>}</div>
              </button>))}
            </div>)}
          {ch && beat >= 2 && (
            <div className="mt-out">
              <span className="mt-stamp">Decision made · {ch.label}</span>
              {effects.length > 0 && <div className="mt-fx">{effects.map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</div>}
              <button className="btn primary" onClick={e => { e.stopPropagation(); onClose(); }}>Continue <kbd>⏎</kbd></button>
            </div>)}
          {pick === null && <button className="sp-later" onClick={e => { e.stopPropagation(); onClose(); }}>{talking ? 'Skip ▸ click' : 'Decide later'} <kbd>Esc</kbd></button>}
        </div>
      </div>
      <div className="sp-ticker"><span>{scene === 'phone' ? `On the line · ${who}` : scene === 'tv' ? `GGN Sports · ${c.kind} · Developing` : `Live from the ${t.nick} facility · ${c.kind}`}</span></div>
    </div>
  );
}
