// Animated sets for the weekly story pop-ups. Each decision happens somewhere: an
// incoming call, a text thread, the TV desk, the locker room, the owner's boardroom,
// the film room, a snowy practice field, the stadium, the GM's office at night. All
// drawn in CSS: no images, nothing to download.
import type { CSSProperties } from 'react';
import type { ActionCard } from './actions';

export type SceneKind = 'phone' | 'texts' | 'tv' | 'locker' | 'boardroom' | 'film' | 'field' | 'snow' | 'stadium' | 'office';

/** Where a card's decision happens, by its kind when the card doesn't say. */
export function sceneFor(c: ActionCard): SceneKind {
  if (c.scene) return c.scene;
  const k = c.kind;
  if (/Trade|League Office|Coaching Staff/.test(k)) return 'phone';
  if (/Social|Discipline/.test(k)) return 'texts';
  if (/Media|Fans|Pro Bowl|Hot Streak/.test(k)) return 'tv';
  if (/Locker|Fallout|Mentorship|Player|Depth/.test(k)) return 'locker';
  if (/Owner/.test(k)) return 'boardroom';
  if (/Film|Scouting|Gameday|Rivalry|Short Week|Game Plan/.test(k)) return 'film';
  if (/Practice|Rookie|Health|Injury|Bye/.test(k)) return 'field';
  if (/Community|Milestone/.test(k)) return 'stadium';
  return 'office';
}

const Skyline = () => (
  <div className="sc-sky">{Array.from({ length: 16 }, (_, i) => (
    <i key={i} style={{ left: `${i * 6.4}%`, height: `${30 + ((i * 37) % 55)}%`, width: `${4 + (i % 3) * 1.6}%` } as CSSProperties}>
      {Array.from({ length: 6 }, (_, j) => <b key={j} style={{ top: `${10 + j * 14}%`, opacity: (i * 7 + j * 3) % 5 < 2 ? 0.9 : 0.15 }} />)}
    </i>
  ))}</div>
);

export function SceneBg({ kind, caller, texts, accent }: { kind: SceneKind; caller?: string; texts?: string[]; accent: string }) {
  const st = { '--a': accent } as CSSProperties;
  switch (kind) {
    case 'phone':
    case 'texts': return <div className="sc sc-phonebg" style={st}><Skyline /><div className="sc-bokeh">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 31) % 100}%`, top: `${(i * 47) % 80}%`, animationDelay: `${-i * 0.7}s` }} />)}</div></div>;
    case 'tv': return (
      <div className="sc sc-tv" style={st}>
        <div className="sc-set"><i className="sc-desk" /><i className="sc-wall" />{Array.from({ length: 6 }, (_, i) => <b key={i} style={{ left: `${8 + i * 15}%` }} />)}</div>
        <div className="sc-scan" />
        <div className="sc-onair">● On air</div>
      </div>
    );
    case 'locker': return (
      <div className="sc sc-locker" style={st}>
        <div className="sc-lockers">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.05}s` }}><b>{(i * 7 + 3) % 99}</b></i>)}</div>
        <div className="sc-bench" />
        <div className="sc-lamp" />
      </div>
    );
    case 'boardroom': return (
      <div className="sc sc-board" style={st}>
        <Skyline />
        <div className="sc-table" />{Array.from({ length: 6 }, (_, i) => <i key={i} className="sc-chair" style={{ left: `${20 + i * 11}%` }} />)}
      </div>
    );
    case 'film': return (
      <div className="sc sc-film" style={st}>
        <div className="sc-screen"><svg viewBox="0 0 200 110"><g stroke="#fff" strokeWidth="1.5" fill="none" className="sc-routes"><path d="M20 90 L20 40 L50 30" /><path d="M60 90 L70 50 L110 50" /><path d="M140 90 L150 30" /><path d="M180 90 L160 60 L175 40" /></g><g fill="none" stroke="#ff6b6b" strokeWidth="1.2"><circle cx="45" cy="45" r="6" /><circle cx="150" cy="40" r="6" /></g></svg></div>
        <div className="sc-beam" />{Array.from({ length: 18 }, (_, i) => <i key={i} className="sc-dust" style={{ left: `${30 + (i * 13) % 50}%`, top: `${20 + (i * 29) % 60}%`, animationDelay: `${-i * 0.6}s` }} />)}
      </div>
    );
    case 'snow':
    case 'field': return (
      <div className={`sc sc-field${kind === 'snow' ? ' snow' : ''}`} style={st}>
        <div className="sc-turf" />
        {Array.from({ length: kind === 'snow' ? 70 : 0 }, (_, i) => <i key={i} className="sc-flake" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.31) % 6}s`, animationDuration: `${4 + (i % 5)}s` }} />)}
        {Array.from({ length: 6 }, (_, i) => <em key={i} className="sc-cone" style={{ left: `${15 + i * 14}%` }} />)}
      </div>
    );
    case 'stadium': return (
      <div className="sc sc-stadium" style={st}>
        <div className="sc-bowl" />{Array.from({ length: 40 }, (_, i) => <i key={i} className="sc-flash" style={{ left: `${(i * 23) % 100}%`, top: `${30 + (i * 17) % 35}%`, animationDelay: `${(i * 0.37) % 3}s` }} />)}
        <div className="sc-lights"><b /><b /><b /><b /></div>
      </div>
    );
    default: return (
      <div className="sc sc-office" style={st}>
        <Skyline />
        <div className="sc-desk2" /><div className="sc-glow" />
      </div>
    );
  }
}

/** The handset for calls and texts, in the pop-up where a headshot would go. */
export function Device({ kind, caller, texts }: { kind: 'phone' | 'texts'; caller?: string; texts?: string[] }) {
  return kind === 'phone' ? (
    <div className="sc-dev ring"><div className="sc-scr">
      <span className="sc-inc">Incoming call</span><b>{caller ?? 'Unknown'}</b><span>mobile</span>
      <div className="sc-pulse"><i /><i /><i /></div>
      <div className="sc-btns"><em className="no" /><em className="yes" /></div>
    </div></div>
  ) : (
    <div className="sc-dev"><div className="sc-scr chat">
      <span className="sc-inc">{caller ?? 'Messages'}</span>
      {(texts ?? ['You up?', 'We need to talk.']).map((t, i) => <p key={i} className={i % 2 ? 'me' : ''} style={{ animationDelay: `${0.5 + i * 0.9}s` }}>{t}</p>)}
      <p className="typing" style={{ animationDelay: `${0.5 + (texts?.length ?? 2) * 0.9}s` }}><i /><i /><i /></p>
    </div></div>
  );
}
