// The weekly decisions, each in the format the situation actually happens in: a phone
// call that rings and gets answered, a text thread, a breaking-news broadcast, the film
// room with a play on the projector, a team meeting in front of the whole roster, a
// medical or workout report on a clipboard, or a face-to-face meeting in your office.
// They share one conversation engine (their lines, your answer, their reaction, what it
// did); what changes is the set, the pacing and how the outcome lands.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { SceneBg, sceneFor } from '../scenes';
import { Logo, vivid } from '../components';
import { FaceArt } from '../face';
import { PLAY_ART, PlayDiagram } from '../playart';
import { hash } from '../../core/rng';
import type { ActionCard } from '../actions';
import type { Player, Team } from '../../core/types';
import './weeklypop.css';
import { GameMoment } from './weeklygames';

// ---- shared helpers ------------------------------------------------------------------------
export const defaultCaller = (c: ActionCard) => (c.kind === 'Trade Call' ? `${c.team.name} GM` : c.kind === 'League Office' ? 'League Office' : c.kind === 'Coaching Staff' ? 'Your coordinator' : c.p ? `${c.p.fn} ${c.p.ln}` : c.kind);
export const defaultTexts = (c: ActionCard) => [c.p ? `Coach, it's ${c.p.fn}.` : 'Coach, got a minute?', 'What is going on?', 'We need to talk about this week.'];
/** Headshot cut-out (or the generated portrait). */
export function Shot({ p, t, cls }: { p: Player; t: Team; cls: string }) {
  const [bad, setBad] = useState(false);
  const url = p.hs && !bad ? p.hs.replace('f_auto,q_auto', 'f_auto,q_auto,w_400') : undefined;
  return <div className={cls}>{url ? <img src={url} alt="" onError={() => setBad(true)} /> : <FaceArt p={p} team={t} size={cls === 'sp-shot' ? 340 : cls === 'wc-shot' ? 260 : 76} />}</div>;
}
/** A team's second colour, lifted when it is black or white. */
export function accent(t: Team) { const c = t.colors[1] ?? '#ffd23f'; const n = parseInt(c.slice(1), 16); const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); return l < 40 || l > 235 ? (t.colors[2] ?? '#c9ced8') : c; }
/** Stakes / results as chips: "Fans +4 · Owner −1" → [Fans +4, Owner −1]. */
export const chips = (s?: string) => (s ?? '').split(' · ').map(x => x.trim()).filter(Boolean);
export const toneOf = (x: string) => (/[−-]\d|−/.test(x) ? 'neg' : /\+\d/.test(x) ? 'pos' : '');

export type Format = 'phone' | 'texts' | 'broadcast' | 'film' | 'room' | 'clipboard' | 'office' | 'social' | 'email';
/** Where this decision happens. */
export function formatOf(c: ActionCard): Format {
  const k = c.kind, sc = sceneFor(c), key = c.id.split('-')[0];
  if (/Medical|Injury|Health|Workout/.test(k) || ['inj', 'tough', 'vet', 'workout'].includes(key)) return 'clipboard';
  if (c.post || (k === 'Social Media' && !c.texts)) return 'social';
  if (/League Office|League Discipline|Owner Memo/.test(k) && !c.caller && !c.scene) return 'email';
  if (sc === 'phone') return 'phone';
  if (sc === 'texts') return 'texts';
  if (sc === 'tv' || sc === 'interview') return 'broadcast';
  if (sc === 'film' || /Film|Staff Meeting|Analytics|Scouting|Game Plan/.test(k) || ['trick', 'dcmtg', 'analytics', 'scout'].includes(key)) return 'film';
  if (/Locker Room|Team Meeting|Leadership|Captains|Fallout/.test(k)) return 'room';
  return 'office';
}
/** What taking the card means, in the card row. */
export function verb(c: ActionCard) {
  if (c.game) return ({ hotseat: 'Step up to the podium', speech: 'Address the team', tug: 'Start negotiating' } as const)[c.game.kind];
  return ({ phone: 'Answer the call', texts: 'Read the texts', broadcast: 'Watch the report', film: 'Go to the film room', room: 'Address the team', clipboard: 'Read the report', office: 'Take the meeting', social: 'See the post', email: 'Open the email' } as const)[formatOf(c)];
}

// ---- the conversation engine ---------------------------------------------------------------
type Decide = (i: number) => string | null;
function useTalk(c: ActionCard, decide: Decide, onClose: () => void, ready = true, cps = 3, override?: string[]) {
  const who = c.speaker ?? c.caller ?? (c.p ? `${c.p.fn} ${c.p.ln}` : defaultCaller(c));
  const name = who.split(' · ')[0];
  const spoken = !!c.lines?.length && !c.narr;
  const lines = override ?? (c.lines?.length ? c.lines : [c.body]);
  const [shown, setShown] = useState(0);
  const [typed, setTyped] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState('');
  const [beat, setBeat] = useState(0);
  const talking = ready && shown < lines.length;
  useEffect(() => {
    if (!talking) return;
    const line = lines[shown];
    if (typed < line.length) { const id = setTimeout(() => setTyped(x => Math.min(line.length, x + cps)), 18); return () => clearTimeout(id); }
    const id = setTimeout(() => { setShown(x => x + 1); setTyped(0); }, 650); return () => clearTimeout(id);
  }, [talking, shown, typed]);
  useEffect(() => { if (pick === null || beat >= 3) return; const id = setTimeout(() => setBeat(b => b + 1), beat === 0 ? 500 : 1000); return () => clearTimeout(id); }, [pick, beat]);
  const skip = () => { if (talking) { setShown(lines.length); setTyped(0); } };
  const choose = (i: number) => { if (pick !== null || talking || !ready) return; const r = decide(i); if (r === null) return; setPick(i); setResult(r); setBeat(0); };
  const ch = pick !== null ? c.choices[pick] : null;
  const effects = chips(result && / [+−-]\d/.test(result) ? result : ch?.hint);
  const reaction = ch?.react ?? (result && !/ [+−-]\d/.test(result) ? result : '');
  const tone = effects.reduce((a, e) => a + (toneOf(e) === 'pos' ? 1 : toneOf(e) === 'neg' ? -1 : 0), 0);
  const asking = ready && !talking && pick === null;
  const done = pick !== null && beat >= 2;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); }
      else if ((e.key === 'Enter' || e.key === ' ') && ready) { e.preventDefault(); e.stopImmediatePropagation(); if (talking) skip(); else if (done) onClose(); }
      else if (/^[1-4]$/.test(e.key) && asking && c.choices[+e.key - 1]) { e.preventDefault(); e.stopImmediatePropagation(); choose(+e.key - 1); }
    };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  });
  const line = (i: number) => (i === shown && talking ? lines[i].slice(0, typed) : lines[i]);
  const visible = lines.slice(0, shown + (talking ? 1 : 0)).map((_, i) => i);
  return { who, name, spoken, lines, shown, typed, talking, asking, done, pick, ch, beat, effects, reaction, tone, skip, choose, line, visible };
}
type Talk = ReturnType<typeof useTalk>;

/** The answer buttons, styled per format. */
function Answers({ c, t, cls, quote = true }: { c: ActionCard; t: Talk; cls: string; quote?: boolean }) {
  if (!t.asking) return null;
  return <div className={`${cls}-answers`}>{c.choices.map((x, i) => (
    <button key={x.label} className={`${cls}-answer`} style={{ animationDelay: `${i * 0.08}s` }} onClick={e => { e.stopPropagation(); t.choose(i); }}>
      <kbd>{i + 1}</kbd><span><b>{x.reply && quote ? `“${x.reply}”` : x.reply ?? x.label}</b>{x.hint && <em className="wp-stakes">{chips(x.hint).map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</em>}</span>
    </button>))}</div>;
}
function Effects({ t, label }: { t: Talk; label?: string }) {
  if (!t.done) return null;
  return <div className="wp-fx">{label && <span className="wp-fx-l">{label}</span>}{t.effects.map((h, i) => <i key={h} className={toneOf(h)} style={{ animationDelay: `${i * 0.12}s` }}>{h}</i>)}</div>;
}
function Footer({ t, onClose, children }: { t: Talk; onClose: () => void; children?: ReactNode }) {
  return <div className="wp-foot">{children}{t.done ? <button className="btn primary" onClick={e => { e.stopPropagation(); onClose(); }}>Continue <kbd>⏎</kbd></button> : t.pick === null && <button className="wp-later" onClick={e => { e.stopPropagation(); onClose(); }}>{t.talking ? 'Skip ▸ click' : 'Decide later'} <kbd>Esc</kbd></button>}</div>;
}
const vars = (t: Team) => ({ '--c1': vivid(t.colors[0]), '--c2': accent(t) } as CSSProperties);

// ---- the formats ---------------------------------------------------------------------------
export function WeeklyPop({ c, decide, onClose }: { c: ActionCard; decide: Decide; onClose: () => void }) {
  const f = formatOf(c);
  const P = { c, decide, onClose };
  if (c.game) return <GameMoment {...P} />;
  return f === 'social' ? <SocialPost {...P} /> : f === 'email' ? <Email {...P} /> : f === 'phone' ? <PhoneCall {...P} /> : f === 'texts' ? <TextThread {...P} /> : f === 'broadcast' ? <Broadcast {...P} /> : f === 'film' ? <FilmRoom {...P} /> : f === 'room' ? <TeamRoom {...P} /> : f === 'clipboard' ? <Clipboard {...P} /> : <Office {...P} />;
}
type Props = { c: ActionCard; decide: Decide; onClose: () => void };

/** Incoming call: it rings until you pick up, then a live call with a timer, a voice
 *  waveform and captions; it ends with the line going dead. */
function PhoneCall({ c, decide, onClose }: Props) {
  const [answered, setAnswered] = useState(false);
  const t = useTalk(c, decide, onClose, answered);
  const [secs, setSecs] = useState(0);
  useEffect(() => { if (!answered || t.done) return; const id = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(id); }, [answered, t.done]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (!answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopImmediatePropagation(); setAnswered(true); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); });
  const caller = c.caller ?? t.who;
  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="wp wp-phone" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="phone" accent={vivid(c.team.colors[0])} /></div>
      <div className={`wpp-dev${answered ? ' live' : ' ring'}${t.done ? ' ended' : ''}`}>
        <div className="wpp-scr">
          <span className="wpp-st">{!answered ? 'Incoming call' : t.done ? `Call ended · ${mm}` : mm}</span>
          <div className="wpp-av">{c.p && !c.speaker?.includes('agent') && c.caller !== 'League Office' ? <Shot p={c.p} t={c.team} cls="wpp-face" /> : <Logo team={c.team} size={84} />}{!answered && <><i /><i /><i /></>}</div>
          <b className="wpp-name">{caller}</b>
          <span className="wpp-sub">{c.where ?? 'mobile'}</span>
          {answered && !t.done && <div className={`wpp-wave${t.talking ? ' on' : ''}`}>{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 37) % 600}ms` }} />)}</div>}
          {!answered ? <div className="wpp-btns"><button className="no" onClick={e => { e.stopPropagation(); onClose(); }} aria-label="Decline">✕</button><button className="yes" onClick={e => { e.stopPropagation(); setAnswered(true); }} aria-label="Answer">✆</button></div>
            : !t.done && <div className="wpp-keys">{['mute', 'keypad', 'speaker'].map(k => <i key={k}>{k}</i>)}<button className="end" onClick={e => { e.stopPropagation(); onClose(); }}>✕</button></div>}
        </div>
      </div>
      <div className="wpp-side">
        <div className="wp-kick"><span className="wp-tag red">{c.kind}</span><span className="wp-tag">{answered ? 'On the line' : 'Ringing…'}</span></div>
        <h1 className="wp-h">{c.headline}</h1>
        {answered && <div className="wpp-cc">
          {t.visible.map(i => <p key={i} className={t.spoken ? '' : 'narr'}>{t.spoken && <em>{t.name}</em>}{t.line(i)}</p>)}
          {t.ch && <p className="me"><em>You</em>{t.ch.reply ?? t.ch.label}</p>}
          {t.ch && t.beat >= 1 && t.reaction && <p className={t.spoken ? '' : 'narr'}>{t.spoken && <em>{t.name}</em>}{t.reaction}</p>}
        </div>}
        <Answers c={c} t={t} cls="wpp" />
        <Effects t={t} label="After the call" />
        <Footer t={t} onClose={onClose}>{!answered && <span className="wp-hint">Answer <kbd>⏎</kbd></span>}</Footer>
      </div>
    </div>
  );
}

/** A text thread: bubbles arrive behind typing dots, you answer from quick replies, it
 *  goes Delivered then Read, and the fallout lands as notifications. */
function TextThread({ c, decide, onClose }: Props) {
  const msgs = c.lines?.length ? c.lines : c.texts?.length ? c.texts.filter((_, i) => i % 2 === 0) : [c.body];
  const t = useTalk(c, decide, onClose, true, 6, msgs);
  const from = c.caller ?? t.who;
  return (
    <div className="wp wp-texts" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="texts" accent={vivid(c.team.colors[0])} /></div>
      <div className="wpt-dev">
        <div className="wpt-top"><span className="wpt-back">‹</span><div className="wpt-av">{c.p ? <Shot p={c.p} t={c.team} cls="wpt-face" /> : <Logo team={c.team} size={34} />}</div><b>{from}</b></div>
        <div className="wpt-body">
          <span className="wpt-day">Today {7 + (hash(c.id) % 4)}:{String(10 + (hash(c.id) % 49)).padStart(2, '0')} AM</span>
          {t.lines.slice(0, t.shown + (t.talking ? 1 : 0)).map((m, i) => i === t.shown && t.talking
            ? <p key={i} className="wt-in wt-typing"><i /><i /><i /></p>
            : <p key={i} className="wt-in">{m}</p>)}
          {t.ch && <p className="wt-out">{t.ch.reply ?? t.ch.label}<span className="wpt-rec">{t.beat >= 1 ? 'Read' : 'Delivered'}</span></p>}
          {t.ch && t.beat === 1 && <p className="wt-in wt-typing"><i /><i /><i /></p>}
          {t.ch && t.beat >= 2 && t.reaction && <p className="wt-in">{t.reaction}</p>}
        </div>
        {t.done && <div className="wpt-notes">{t.effects.map((h, i) => <div key={h} className={`wpt-note ${toneOf(h)}`} style={{ animationDelay: `${i * 0.25}s` }}><b>{c.team.nick} HQ</b><span>{h}</span></div>)}</div>}
        <div className="wpt-keys">{t.asking ? c.choices.map((x, i) => <button key={x.label} onClick={e => { e.stopPropagation(); t.choose(i); }}><kbd>{i + 1}</kbd>{x.reply ?? x.label}</button>) : <div className="wpt-input">{t.pick === null ? 'iMessage' : ' '}</div>}</div>
      </div>
      <div className="wpt-side">
        <div className="wp-kick"><span className="wp-tag red">{c.kind}</span><span className="wp-tag">Messages</span></div>
        <h1 className="wp-h">{c.headline}</h1>
        {t.asking && <div className="wpt-stakes">{c.choices.filter(x => x.hint).map(x => <div key={x.label}><b>{x.reply ?? x.label}</b><em className="wp-stakes">{chips(x.hint).map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</em></div>)}</div>}
        <Footer t={t} onClose={onClose} />
      </div>
    </div>
  );
}

const FANS = ['@windycitygridiron', '@sundaysalt', '@capspacecory', '@filmroomfran', '@section114', '@thegmchair'];
/** Breaking news: the banner sweeps in, the anchor reads it, you issue a statement, the
 *  chyron updates with your words and the fans react. */
function Broadcast({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose, true, 4);
  const posts = useMemo(() => {
    const good = [`Love this. That's leadership from the ${c.team.nick}.`, `Finally somebody in that building gets it.`, `This is how you handle it. Respect.`];
    const bad = [`What is this franchise doing?`, `Embarrassing. Again.`, `Sell the team.`];
    const mid = [`We'll see. Talk is cheap until Sunday.`, `Interesting choice...`, `Not sure how I feel about this one.`];
    const pool = t.tone > 0 ? good : t.tone < 0 ? bad : mid;
    const h0 = (hash(c.id) >>> 0) % FANS.length;
    return pool.map((p, i) => ({ who: FANS[(h0 + i) % FANS.length], p, likes: 40 + ((hash(c.id + i) >>> 0) % 900) }));
  }, [t.tone, c.id]);
  return (
    <div className="wp wp-tv" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="tv" accent={vivid(c.team.colors[0])} /></div>
      <div className="wpb-frame">
        <div className="wpb-bug"><b>GGN</b>SPORTS <i>● LIVE</i></div>
        <div className="wpb-break">Breaking news</div>
        <div className="wpb-screen">
          {c.p ? <Shot p={c.p} t={c.team} cls="wpb-shot" /> : <div className="wpb-logo"><Logo team={c.team} size={220} /></div>}
          <div className="wpb-quotes">{t.visible.map(i => <p key={i}>{t.spoken && <em>{t.name}</em>}{t.line(i)}</p>)}</div>
        </div>
        <div className="wpb-chyron"><span className="wpb-team"><Logo team={c.team} size={26} />{c.team.abbr}</span><b>{t.ch && t.beat >= 1 ? (t.ch.reply ? `${c.team.nick} respond: “${t.ch.reply}”` : `${c.team.nick}: ${t.ch.label}`) : c.headline}</b></div>
        <div className="wpb-ticker"><span>{`${c.where ?? 'Developing story'} · ${c.kind} · ${t.effects.length && t.done ? t.effects.join(' · ') : 'More after the break'} · `.repeat(3)}</span></div>
      </div>
      <div className="wpb-side">
        {t.asking && <><h3 className="wpb-ask">Your statement</h3><Answers c={c} t={t} cls="wpb" /></>}
        {t.ch && t.beat >= 1 && <div className="wpb-feed"><h3>Fans react</h3>{posts.map((x, i) => <div key={i} className="wpb-post" style={{ animationDelay: `${0.3 + i * 0.35}s` }}><b>{x.who}</b><p>{x.p}</p><span>♥ {x.likes}</span></div>)}</div>}
        <Effects t={t} label="Fallout" />
        <Footer t={t} onClose={onClose} />
      </div>
    </div>
  );
}

/** The film room: a play on the projector with the telestrator, the coach talking over
 *  it, and your call pinned to the game-plan board. */
function FilmRoom({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose, true, 4);
  const play = useMemo(() => { const keys = Object.keys(PLAY_ART).filter(k => !k.startsWith('PA ')); return keys[(hash(c.id) >>> 0) % keys.length]; }, [c.id]);
  return (
    <div className="wp wp-film" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="film" accent={vivid(c.team.colors[0])} /></div>
      <div className="wpf-screen">
        <div className="wpf-proj"><PlayDiagram name={play} w={560} h={315} pro /><svg className="wpf-tele" viewBox="0 0 560 315"><circle cx={170 + (hash(c.id) % 220)} cy={120 + (hash(c.id) % 60)} r="34" /><path d={`M${210 + (hash(c.id) % 220)} ${150 + (hash(c.id) % 60)} q 60 30 110 10`} /></svg></div>
        <div className="wpf-tc">{`${String(hash(c.id) % 4).padStart(2, '0')}:${String(10 + (hash(c.id) % 49)).padStart(2, '0')}:14 · ${c.team.nick} cut-ups`}</div>
        <div className="wpf-subs">{t.visible.map(i => <p key={i}>{t.spoken && <em>{t.name}: </em>}{t.line(i)}</p>)}</div>
      </div>
      <div className="wpf-board">
        <div className="wp-kick"><span className="wp-tag red">{c.kind}</span><span className="wp-tag">{c.where ?? 'Film room'}</span></div>
        <h1 className="wp-h">{c.headline}</h1>
        {t.asking && <div className="wpf-cards">{c.choices.map((x, i) => (
          <button key={x.label} className="wpf-card" style={{ animationDelay: `${i * 0.08}s`, transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)` }} onClick={e => { e.stopPropagation(); t.choose(i); }}>
            <i className="pin" /><kbd>{i + 1}</kbd><b>{x.label}</b>{x.reply && <span>“{x.reply}”</span>}{x.hint && <em className="wp-stakes">{chips(x.hint).map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</em>}
          </button>))}</div>}
        {t.ch && <div className="wpf-card picked"><i className="pin" /><b>{t.ch.label}</b>{t.ch.reply && <span>“{t.ch.reply}”</span>}{t.beat >= 1 && <span className="wpf-stamp">Game plan</span>}</div>}
        {t.ch && t.beat >= 1 && t.reaction && <p className="wpf-react">{t.spoken && <em>{t.name}: </em>}{t.reaction}</p>}
        <Effects t={t} />
        <Footer t={t} onClose={onClose} />
      </div>
    </div>
  );
}

/** The team meeting: the whole roster in rows, you at the front; they react to what you
 *  say (nods or turned heads) and the room meter moves. */
function TeamRoom({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose, true, 4);
  // The room follows the locker-room number when there is one, the overall fallout otherwise.
  const room = t.effects.find(e => /^Locker room/.test(e));
  const rt = room ? (toneOf(room) === 'pos' ? 1 : toneOf(room) === 'neg' ? -1 : 0) : Math.sign(t.tone);
  const mood = t.ch && t.beat >= 1 ? (rt > 0 ? 'pos' : rt < 0 ? 'neg' : 'mid') : '';
  const seats = useMemo(() => Array.from({ length: 3 }, (_, r) => Array.from({ length: 9 - r }, (_, i) => ((hash(`${c.id}${r}${i}`) >>> 0) % 98) + 1)), [c.id]);
  return (
    <div className="wp wp-room" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="locker" accent={vivid(c.team.colors[0])} /></div>
      <div className="wpr-top">
        <div className="wp-kick"><span className="wp-tag red">{c.kind}</span><span className="wp-tag">{c.where ?? 'Team meeting room'}</span></div>
        <h1 className="wp-h">{c.headline}</h1>
        <div className="wpr-board">{t.visible.map(i => <p key={i}>{t.spoken && <em>{t.name}</em>}{t.line(i)}</p>)}
          {t.ch && <p className="me"><em>You, to the room</em>“{t.ch.reply ?? t.ch.label}”</p>}
          {t.ch && t.beat >= 1 && t.reaction && <p className="react">{t.reaction}</p>}
        </div>
      </div>
      <div className={`wpr-seats ${mood}`}>{seats.map((row, r) => <div key={r} className="wpr-row">{row.map((n, i) => <i key={i} style={{ animationDelay: `${(r * 9 + i) * 0.06}s` }}><b>{n}</b></i>)}</div>)}</div>
      <div className="wpr-bottom">
        {t.asking && <><h3 className="wpr-ask">What do you tell them?</h3><Answers c={c} t={t} cls="wpr" /></>}
        {t.ch && t.beat >= 1 && <div className={`wpr-meter ${mood}`}><span>The room</span><div><i style={{ width: `${50 + rt * 30}%` }} /></div><b>{mood === 'pos' ? 'Bought in' : mood === 'neg' ? 'Tense' : 'Listening'}</b></div>}
        <Effects t={t} />
        <Footer t={t} onClose={onClose} />
      </div>
    </div>
  );
}

// Where an injury shows on the body chart (x, y in a 100 × 200 figure).
const SPOT: [RegExp, number, number][] = [[/concuss|head/i, 50, 18], [/neck/i, 50, 38], [/shoulder|collarbone/i, 30, 50], [/elbow|arm|bicep/i, 22, 78], [/hand|wrist|finger|thumb/i, 18, 104], [/rib|chest|pec/i, 50, 66], [/back|oblique|core/i, 50, 86], [/hip|groin/i, 42, 104], [/hamstring|quad|thigh/i, 40, 124], [/knee|acl|mcl|meniscus/i, 40, 146], [/calf|shin|achilles/i, 40, 166], [/ankle|foot|toe/i, 40, 188]];
/** The report on a clipboard: header, the player, a body chart for injuries, the notes in
 *  pen, your call as a box to tick, and a rubber stamp. */
function Clipboard({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose, true, 5);
  const inj = c.p?.injury;
  const spot = inj ? SPOT.find(([re]) => re.test(inj.type)) : undefined;
  const medical = /Medical|Injury|Health/.test(c.kind) || !!inj;
  return (
    <div className="wp wp-clip" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="field" accent={vivid(c.team.colors[0])} /></div>
      <div className="wpc-board">
        <i className="wpc-clamp" />
        <div className="wpc-paper">
          <div className="wpc-head"><Logo team={c.team} size={30} /><b>{medical ? 'Medical report' : 'Workout report'}</b><span>{c.where ?? c.kind}</span></div>
          {c.p && <div className="wpc-player"><Shot p={c.p} t={c.team} cls="wpc-face" /><div><b>{c.p.fn} {c.p.ln}</b><span>{c.p.pos} · {c.p.ovr} OVR · Age {Math.floor(c.p.age)}</span>{inj && <span className="wpc-inj">{inj.type} · est. {inj.weeks} wk</span>}</div></div>}
          <div className="wpc-grid">
            {medical && <svg className="wpc-body" viewBox="0 0 100 200"><g fill="none" stroke="#3a4a6b" strokeWidth="2"><circle cx="50" cy="18" r="12" /><path d="M50 30 V100 M30 48 H70 M30 48 L18 104 M70 48 L82 104 M50 100 L40 190 M50 100 L60 190" /></g>{spot && <><circle className="wpc-hit" cx={spot[1]} cy={spot[2]} r="9" /><circle cx={spot[1]} cy={spot[2]} r="3.5" fill="#d7263d" /></>}</svg>}
            <div className="wpc-notes">{t.visible.map(i => <p key={i}>{t.line(i)}</p>)}{t.ch && t.beat >= 1 && t.reaction && <p className="react">{t.reaction}</p>}</div>
          </div>
          <div className="wpc-checks">{c.choices.map((x, i) => (
            <button key={x.label} className={`wpc-check${t.pick === i ? ' on' : ''}`} disabled={!t.asking} onClick={e => { e.stopPropagation(); t.choose(i); }}>
              <i>{t.pick === i ? '✓' : ''}</i><span><b>{x.label}</b>{x.hint && <em>{x.hint}</em>}</span>{t.asking && <kbd>{i + 1}</kbd>}
            </button>))}</div>
          {t.ch && t.beat >= 1 && <div className="wpc-stamp">{t.ch.label}</div>}
        </div>
      </div>
      <div className="wpc-side">
        <div className="wp-kick"><span className="wp-tag red">{c.kind}</span></div>
        <h1 className="wp-h">{c.headline}</h1>
        <Effects t={t} label="Outcome" />
        <Footer t={t} onClose={onClose} />
      </div>
    </div>
  );
}

/** Face to face in your office (or the owner's suite): portrait, the conversation, your answer. */
function Office({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose);
  const scene = sceneFor(c);
  const tm = c.team;
  return (
    <div className="sp mt" style={vars(tm)} onClick={t.skip}>
      <i className="sp-bar top" /><i className="sp-bar bot" />
      <div className="sp-bg"><SceneBg kind={scene === 'phone' || scene === 'texts' ? 'office' : scene} accent={vivid(tm.colors[0])} /><Logo team={tm} size={720} style={{ position: 'absolute', right: -160, top: -120, opacity: 0.06 }} /></div>
      <div className="mt-in">
        <div className="mt-left">
          {c.p ? <Shot p={c.p} t={tm} cls="sp-shot" /> : <div className="mt-badge"><Logo team={tm} size={180} /></div>}
          <div className="mt-name">{c.p ? <><b>{c.p.fn} {c.p.ln}</b><span>{c.p.pos} · {c.p.ovr} OVR</span>{c.speaker && !c.speaker.startsWith(`${c.p.fn} ${c.p.ln}`) && <span className="mt-with">Meeting with {c.speaker}</span>}</> : <><b>{t.name}</b><span>{c.where ?? c.kind}</span></>}</div>
        </div>
        <div className="mt-talk">
          <div className="sp-tags"><span className="sp-live">{c.kind}</span><span className="sp-kind">{c.where ?? `${tm.nick} facility`}</span></div>
          <h1 className="mt-h">{c.headline}</h1>
          <div className="mt-log">
            {t.visible.map(i => <p key={i} className={t.spoken ? 'mt-them' : 'mt-narr'}>{t.spoken && <em>{t.name}</em>}{t.line(i)}{i === t.shown && t.talking && <i className="sp-caret">▌</i>}</p>)}
            {t.ch && <p className="mt-me"><em>{t.ch.reply ? 'You' : 'Your call'}</em>{t.ch.reply ?? t.ch.label}</p>}
            {t.ch && t.beat >= 1 && t.reaction && <p className={t.ch.react && t.spoken ? 'mt-them react' : 'mt-narr'}>{t.ch.react && t.spoken && <em>{t.name}</em>}{t.reaction}</p>}
          </div>
          {t.asking && <div className="mt-choices">{c.choices.map((x, i) => (
            <button key={x.label} className="mt-choice" onClick={e => { e.stopPropagation(); t.choose(i); }} style={{ animationDelay: `${i * 0.07}s` }}>
              <kbd>{i + 1}</kbd><div><b>{x.reply ? `“${x.reply}”` : x.label}</b>{x.hint && <span className="mt-stakes">{chips(x.hint).map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</span>}</div>
            </button>))}</div>}
          {t.done && <div className="mt-out"><span className="mt-stamp">Decision made · {t.ch!.label}</span>{t.effects.length > 0 && <div className="mt-fx">{t.effects.map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</div>}<button className="btn primary" onClick={e => { e.stopPropagation(); onClose(); }}>Continue <kbd>⏎</kbd></button></div>}
          {t.pick === null && <button className="sp-later" onClick={e => { e.stopPropagation(); onClose(); }}>{t.talking ? 'Skip ▸ click' : 'Decide later'} <kbd>Esc</kbd></button>}
        </div>
      </div>
      <div className="sp-ticker"><span>{`Live from the ${tm.nick} facility · ${c.kind}`}</span></div>
    </div>
  );
}

/** A social post at the centre of it: the post itself with likes and reposts climbing and
 *  the replies piling up, your PR director in your ear, and the team's response posted. */
function SocialPost({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose, true, 5);
  const post = c.post ?? (c.p ? { handle: `@${c.p.fn.toLowerCase()}${c.p.ln.toLowerCase()}`, name: `${c.p.fn} ${c.p.ln}`, text: c.body } : { handle: `@${c.team.nick.toLowerCase()}`, name: c.team.name, text: c.body });
  const [n, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN(x => Math.min(1, x + 0.02)), 40); return () => clearInterval(id); }, []);
  const base = 4000 + ((hash(c.id) >>> 0) % 60000);
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v)));
  const replies = useMemo(() => [`${c.p ? c.p.ln : 'he'} said what he said 😭`, `this is going to be a long week`, `somebody take his phone away`, `facts. all facts.`].map((x, i) => ({ who: FANS[((hash(c.id) >>> 0) + i) % FANS.length], x })), [c.id]);
  return (
    <div className="wp wp-social" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="texts" accent={vivid(c.team.colors[0])} /></div>
      <div className="wps-feed">
        <div className="wps-post">
          <div className="wps-head">{c.p && post.name.includes(c.p.ln) ? <Shot p={c.p} t={c.team} cls="wps-av" /> : <div className="wps-av"><Logo team={c.team} size={44} /></div>}<div><b>{post.name} <i className="wps-ver">✓</i></b><span>{post.handle} · 2h</span></div></div>
          <p className="wps-text">{post.text}</p>
          <div className="wps-stats"><span>💬 {fmt(base * 0.08 * n)}</span><span>🔁 {fmt(base * 0.3 * n)}</span><span className="hot">♥ {fmt(base * n)}</span><span>📊 {fmt(base * 18 * n)}</span></div>
        </div>
        <div className="wps-replies">{replies.map((r, i) => <div key={i} className="wps-reply" style={{ animationDelay: `${0.8 + i * 0.5}s` }}><b>{r.who}</b><span>{r.x}</span></div>)}
          {t.ch && t.beat >= 1 && <div className="wps-reply team"><b>@{c.team.nick.toLowerCase()} · Official</b><span>{t.ch.reply ?? t.ch.label}</span></div>}
        </div>
      </div>
      <div className="wps-side">
        <div className="wp-kick"><span className="wp-tag red">{c.kind}</span><span className="wp-tag">{c.where ?? 'Trending'}</span></div>
        <h1 className="wp-h">{c.headline}</h1>
        <div className="wpp-cc">{t.visible.map(i => <p key={i} className={t.spoken ? '' : 'narr'}>{t.spoken && <em>{t.name}</em>}{t.line(i)}</p>)}
          {t.ch && t.beat >= 1 && t.reaction && <p className={t.spoken ? '' : 'narr'}>{t.spoken && <em>{t.name}</em>}{t.reaction}</p>}</div>
        <Answers c={c} t={t} cls="wpp" />
        <Effects t={t} label="Fallout" />
        <Footer t={t} onClose={onClose} />
      </div>
    </div>
  );
}

/** An email: the inbox, the notice from the league or the owner typed out, your reply
 *  sent off, and their answer landing in the thread. */
function Email({ c, decide, onClose }: Props) {
  const t = useTalk(c, decide, onClose, true, 7);
  const from = c.speaker ?? (c.kind === 'Owner Memo' ? 'Office of the Owner' : 'League Office');
  const box = ['Inbox', 'Flagged', 'Sent', 'Legal', 'Scouting'];
  const others = [`Travel: itinerary for ${c.team.nick} at …`, 'Equipment: cleat order confirmed', 'Pro scouting: waiver wire report', 'Cap update: weekly ledger'];
  return (
    <div className="wp wp-mail" style={vars(c.team)} onClick={t.skip}>
      <div className="wp-bg"><SceneBg kind="office" accent={vivid(c.team.colors[0])} /></div>
      <div className="wpm-win">
        <div className="wpm-bar"><i /><i /><i /><span>Mail · {c.team.name}</span></div>
        <div className="wpm-body">
          <div className="wpm-side">{box.map((b, i) => <span key={b} className={i === 0 ? 'on' : ''}>{b}{i === 0 && <b>1</b>}</span>)}</div>
          <div className="wpm-list">
            <div className="wpm-item on"><b>{from}</b><span>{c.headline}</span></div>
            {others.map(o => <div key={o} className="wpm-item"><b>{o.split(':')[0]}</b><span>{o.split(':')[1]}</span></div>)}
          </div>
          <div className="wpm-read">
            <div className="wpm-head"><b>{c.headline}</b><span>From: <em>{from}</em> · To: you · {c.where?.replace('Email · ', '') ?? 'Today'}</span></div>
            <div className="wpm-text">{t.visible.map(i => <p key={i}>{t.line(i)}</p>)}{c.kind === 'League Discipline' && !t.talking && <span className="wpm-att">📎 play_video.mp4 · notice.pdf</span>}</div>
            {t.ch && <div className="wpm-sent"><span className="wpm-tag">{t.beat >= 1 ? 'Sent' : 'Sending…'}</span><p>{t.ch.reply ?? t.ch.label}</p></div>}
            {t.ch && t.beat >= 2 && t.reaction && <div className="wpm-re"><b>Re: {c.headline}</b><p>{t.reaction}</p><span>{from}</span></div>}
            {t.asking && <div className="wpm-replies"><span>Reply</span>{c.choices.map((x, i) => (
              <button key={x.label} onClick={e => { e.stopPropagation(); t.choose(i); }} style={{ animationDelay: `${i * 0.08}s` }}><kbd>{i + 1}</kbd><b>{x.reply ?? x.label}</b>{x.hint && <em className="wp-stakes">{chips(x.hint).map(h => <i key={h} className={toneOf(h)}>{h}</i>)}</em>}</button>))}</div>}
            <Effects t={t} label="Result" />
            <Footer t={t} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
