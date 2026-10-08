// Coach creator: name the head coach and build his look before the season (or any
// time from Options). The preview is the same pixel sprite that walks into the press
// room: front view as he'll stand at the podium, side view walking.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { app, useApp, saveLeague } from '../store';
import { Logo, vivid } from '../components';
import { pxText, pxWidth } from '../field/pixel';
import { coachSprites, lookOf, setLook, randomLook, OPTIONS, SKIN_TONES, HAIR_COLORS, type CoachLook } from '../coachlook';

const W = 72, H = 40;

export function CoachCreateScreen({ first }: { first?: boolean }) {
  const L = useApp().league!;
  const team = L.teams[L.user];
  const original = useMemo(() => ({ name: team.coach.name, look: lookOf(L) }), []);
  const [name, setName] = useState(team.coach.name);
  const [look, set] = useState<CoachLook>(original.look);
  const cv = useRef<HTMLCanvasElement>(null);
  const sprites = useMemo(() => coachSprites(look, team.colors), [look]);

  useEffect(() => {
    const g = cv.current?.getContext('2d'); if (!g) return;
    g.imageSmoothingEnabled = false;
    let raf = 0;
    const loop = (now: number) => {
      const c0 = vivid(team.colors[0]), c1 = team.colors[1] ?? '#fff';
      g.fillStyle = '#101318'; g.fillRect(0, 0, W, H);
      g.fillStyle = c0; g.fillRect(2, 2, 40, 30); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(2, 2, 40, 30);
      for (let r = 0; r < 4; r++) for (let x = 4 + (r % 2 ? 7 : 0); x + pxWidth(team.abbr) < 41; x += 14) { g.globalAlpha = 0.18; pxText(g, team.abbr, x, 4 + r * 7, (r + x) % 2 ? c1 : '#fff'); }
      g.globalAlpha = 1;
      g.fillStyle = '#1d2129'; g.fillRect(0, 32, W, 8);
      g.drawImage(sprites.front, 15, 12);
      // Side view walks back and forth on the right.
      const t = now / 1000, span = 12, ph = (t * 0.3) % 2, k = ph < 1 ? ph : 2 - ph, x = 45 + k * span;
      const f = sprites.walk[Math.floor(t * 7) % 4];
      g.save(); if (ph >= 1) { g.translate(Math.round(x) + f.width, 16); g.scale(-1, 1); g.drawImage(f, 0, 0); } else g.drawImage(f, Math.round(x), 16); g.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sprites]);

  const save = () => {
    team.coach.name = name.trim() || original.name;
    setLook(L, look);
    void saveLeague(L, `${L.id}-auto`);
    app.toast(`Head coach ${team.coach.name}`);
    if (first) app.replace({ id: 'hub' }); else app.backTo();
  };
  const row = <K extends keyof typeof OPTIONS>(k: K, label: string) => (
    <div className="cc-row"><span className="up">{label}</span>
      <div className="cc-opts">{OPTIONS[k].map(v => <button key={v} className={`cc-chip${look[k] === v ? ' on' : ''}`} onClick={() => set({ ...look, [k]: v })}>{v}</button>)}</div></div>
  );
  const swatches = (k: 'skin' | 'hairColor', cols: string[], label: string) => (
    <div className="cc-row"><span className="up">{label}</span>
      <div className="cc-opts">{cols.map((c, i) => <button key={c} aria-label={`${label} ${i + 1}`} className={`cc-sw${look[k] === i ? ' on' : ''}`} style={{ background: c }} onClick={() => set({ ...look, [k]: i })} />)}</div></div>
  );
  return (
    <div className="cc" style={{ '--tc': vivid(team.colors[0]) } as CSSProperties}>
      <div className="cc-head">
        <Logo team={team} size={54} />
        <div><span className="up">{first ? 'Before the season' : 'Coach'}</span><div className="h1">Create Your Head Coach</div></div>
      </div>
      <div className="cc-body">
        <div className="cc-stage">
          <canvas ref={cv} width={W} height={H} />
          <div className="cc-name">{name || original.name}<span>Head Coach · {team.name}</span></div>
        </div>
        <div className="cc-panel">
          <div className="cc-row"><span className="up">Name</span><input value={name} maxLength={28} onChange={e => setName(e.target.value)} placeholder={original.name} /></div>
          {swatches('skin', SKIN_TONES, 'Skin tone')}
          {row('hair', 'Hair')}
          {swatches('hairColor', HAIR_COLORS, 'Hair colour')}
          {row('beard', 'Facial hair')}
          {row('build', 'Build')}
          {row('head', 'Headwear')}
          {row('glasses', 'Glasses')}
          {row('top', 'Sideline outfit')}
          <div className="row" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <div className="row">
              <button className="btn" onClick={() => set(randomLook((Math.random() * 2 ** 31) | 0))}>Randomize</button>
              <button className="btn" onClick={() => { set(original.look); setName(original.name); }}>Reset</button>
            </div>
            <button className="btn primary big" onClick={save}>{first ? 'Start the Season ▸' : 'Save Coach'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
