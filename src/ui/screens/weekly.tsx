// The Weekly Hub card row: tall team-colour cards, one situation each. The focused
// card opens up (bigger photo, the choices, and the staff member you can delegate
// to). Arrow keys move, Enter takes the first choice, X delegates.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
  // The week's lead story opens as a breaking-news pop-up, once.
  const wkKey = `${L.season}-${L.phase}-${L.week}`;
  const seen = (L as typeof L & { popSeen?: string }).popSeen;
  const lead = cards.find(c => !c.matchup && c.p && ['Holdout', 'Fallout', 'League Office'].includes(c.kind)) ?? cards.find(c => !c.matchup && c.p && c.feature) ?? cards.find(c => !c.matchup && c.p);
  const [popOpen, setPopOpen] = useState(true);
  const pop = popOpen && seen !== wkKey && L.phase === 'regular' ? lead : undefined;
  const closePop = () => { (L as typeof L & { popSeen?: string }).popSeen = wkKey; setPopOpen(false); };
  const delegate = (c: ActionCard) => { if (!c.delegate) return; c.delegate.run(); app.toast(`Delegated to ${c.delegate.who}`); app.touch(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (neg || ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'ArrowRight') setFocus(x => Math.min(cards.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setFocus(x => Math.max(0, x - 1));
      else if (e.key === 'Enter' && cards[f]) act(cards[f]);
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
        {cards.map((c, i) => <Card key={c.id} c={c} on={i === f} onFocus={() => setFocus(i)} onAct={j => act(c, j)} onDelegate={() => delegate(c)} />)}
        {!cards.length && <div className="wc empty-card"><h2 className="wc-h">All caught up</h2><p className="wc-b">Nothing in the building needs a decision this week.</p></div>}
      </div>
      {pop && !neg && createPortal(<StoryPop c={pop} onAct={j => { closePop(); act(pop, j); }} onLater={closePop} />, document.body)}
      {neg && <NegotiationRoom p={neg} close={() => { setNeg(null); app.touch(); }} />}
    </>
  );
}

function Card({ c, on, onFocus, onAct, onDelegate }: { c: ActionCard; on: boolean; onFocus: () => void; onAct: (i: number) => void; onDelegate: () => void }) {
  const t = c.team;
  const stakes = on && c.choices.some(x => x.hint);
  const big = on && !stakes && !!c.p && (c.feature || c.matchup);
  return (
    <div className={`wc${on ? ' on' : ''}${c.matchup ? ' mu' : ''}${stakes ? ' st' : ''}${stakes && !c.delegate ? ' nd' : ''}`} style={{ '--c1': vivid(t.colors[0]), '--c2': accent(t) } as CSSProperties} onMouseEnter={onFocus} onClick={() => (on ? onAct(0) : onFocus())}>
      <div className="wc-bg"><i className="wc-paint" /><i className="wc-swoosh" /><Logo team={t} size={360} style={{ position: 'absolute', left: -80, top: -40, opacity: 0.14 }} /></div>
      <span className="wc-kind">{c.kind}</span>
      {c.p && (big ? <Shot p={c.p} t={t} cls="wc-shot" /> : <Shot p={c.p} t={t} cls="wc-face" />)}
      <div className="wc-text">
        <h2 className="wc-h">{c.headline}</h2>
        <p className="wc-b">{c.body}</p>
        {on && <div className="wc-acts">{c.choices.map((x, i) => <button key={x.label} title={x.hint} className={`btn sm${i === 0 ? ' primary' : ''}`} onClick={e => { e.stopPropagation(); onAct(i); }}>{x.label}</button>)}</div>}
        {on && c.choices.some(x => x.hint) && <ul className="wc-stakes">{c.choices.filter(x => x.hint).map(x => <li key={x.label}><b>{x.label}</b>{x.hint}</li>)}</ul>}
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

/** Breaking-news pop-up for the week's lead story: letterbox, portrait, typed headline, the decision. */
function StoryPop({ c, onAct, onLater }: { c: ActionCard; onAct: (i: number) => void; onLater: () => void }) {
  const t = c.team;
  const [n, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN(x => (x >= c.headline.length ? x : x + 2)), 22); return () => clearInterval(id); }, [c.headline]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onLater(); } else if (/^[1-4]$/.test(e.key) && c.choices[+e.key - 1]) { e.preventDefault(); e.stopImmediatePropagation(); onAct(+e.key - 1); } };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  });
  return (
    <div className="sp" style={{ '--c1': vivid(t.colors[0]), '--c2': accent(t) } as CSSProperties}>
      <i className="sp-bar top" /><i className="sp-bar bot" />
      <div className="sp-bg"><Logo team={t} size={720} style={{ position: 'absolute', right: -160, top: -120, opacity: 0.08 }} /></div>
      <div className="sp-in">
        {c.p && <Shot p={c.p} t={t} cls="sp-shot" />}
        <div className="sp-text">
          <div className="sp-tags"><span className="sp-live">Breaking</span><span className="sp-kind">{c.kind}</span></div>
          <h1 className="sp-h">{c.headline.slice(0, n)}<i className="sp-caret">▌</i></h1>
          <p className="sp-b">{c.body}</p>
          <div className="sp-choices">{c.choices.map((x, i) => <button key={x.label} className={`sp-choice${i === 0 ? ' first' : ''}`} onClick={() => onAct(i)}><kbd>{i + 1}</kbd><b>{x.label}</b>{x.hint && <span>{x.hint}</span>}</button>)}</div>
          <button className="sp-later" onClick={onLater}>Decide later <kbd>Esc</kbd></button>
        </div>
      </div>
      <div className="sp-ticker"><span>Live from the {t.nick} facility · {c.kind} · Your call</span></div>
    </div>
  );
}
