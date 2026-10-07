import { useEffect, useMemo, useState } from 'react';
import { app, listSaves, loadLeague, deleteSave, type SaveMeta } from '../store';
import { Logo, Ovr, Tilt, Face, vivid } from '../components';
import data from '../../data/league.json';
import { createLeague, RAW_TEAMS, teamRatings } from '../../core/league';
import type { League } from '../../core/types';
import { capSpace, money } from '../../core/contracts';

/**
 * Title screen. Plays a short intro once per visit (stadium lights bang on, a
 * spiralling football crosses the screen and slams the title in), then a
 * broadcast-style main menu: big keyboard-driven menu, a rotating cover athlete,
 * light sweeps over a living field and a ticker of the league's best.
 */
let introSeen = false;
const RAW_PLAYERS = (data as unknown as { players: { id: string; fn: string; ln: string; pos: string; team: string; ovr: number; hs?: string; num?: number }[] }).players;
// One cover athlete per marquee position, best first.
const COVER = (() => {
  const out: typeof RAW_PLAYERS = [];
  for (const pos of ['QB', 'WR', 'EDGE', 'RB', 'DT', 'TE', 'CB']) {
    const p = RAW_PLAYERS.filter(q => q.pos === pos && q.team && q.team !== 'FA').sort((a, b) => b.ovr - a.ovr)[0];
    if (p) out.push(p);
  }
  return out.sort((a, b) => b.ovr - a.ovr);
})();
const TICKER = ['QB', 'RB', 'WR', 'TE', 'OT', 'EDGE', 'DT', 'LB', 'CB', 'S', 'K'].map(pos => {
  const p = RAW_PLAYERS.filter(q => q.pos === pos && q.team).sort((a, b) => b.ovr - a.ovr)[0];
  return p ? `${pos} ${p.fn[0]}. ${p.ln} · ${p.team} · ${p.ovr}` : '';
}).filter(Boolean);

export function MainMenu() {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  // 'intro' plays the cold open; 'quick' is the short entrance on later visits; 'skip' jumps to the end.
  const [mode, setMode] = useState<'intro' | 'quick' | 'skip'>(introSeen ? 'quick' : 'intro');
  const [playing, setPlaying] = useState(!introSeen);
  const skip = () => { introSeen = true; setPlaying(false); setMode('skip'); };
  const [sel, setSel] = useState(0);
  const [cover, setCover] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => { listSaves().then(setSaves); }, []);
  useEffect(() => { if (!playing) return; const t = setTimeout(() => { introSeen = true; setPlaying(false); }, 2900); return () => clearTimeout(t); }, [playing]);
  useEffect(() => { const t = setInterval(() => setCover(c => (c + 1) % COVER.length), 5200); return () => clearInterval(t); }, []);
  const items = useMemo(() => [
    ...(saves[0] ? [{ k: 'Continue', sub: `${saves[0].team} · ${saves[0].season} · ${saves[0].phase}`, go: async () => { const l = await loadLeague(saves[0].slot); if (l) { migrate(l); app.setLeague(l); app.replace({ id: 'hub' }); } } }] : []),
    { k: 'New Franchise', sub: 'Pick a team. Real rosters, contracts and cap.', go: async () => app.go({ id: 'new' }) },
    { k: 'Load Franchise', sub: `${saves.length} saved franchise${saves.length === 1 ? '' : 's'}`, go: async () => app.go({ id: 'load' }) },
  ], [saves]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (playing) { skip(); return; }
      if (e.key === 'ArrowDown') setSel(i => (i + 1) % items.length);
      else if (e.key === 'ArrowUp') setSel(i => (i - 1 + items.length) % items.length);
      else if (e.key === 'Enter') items[sel]?.go();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [items, sel, playing]);
  const c = COVER[cover];
  const ct = RAW_TEAMS.find(t => t.abbr === c?.team);
  const col = ct?.colors[0] ?? '#1d4ed8', col2 = ct?.colors[2] ?? ct?.colors[1] ?? '#f5c542';
  return (
    <div className={`title ${mode}`} onClick={() => { if (playing) skip(); }}
      onMouseMove={e => setMouse({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 })}>
      <div className="t-field" /><div className="t-lines" />
      <div className="t-beams">{[0, 1, 2, 3].map(i => <i key={i} style={{ left: `${10 + i * 26}%`, animationDelay: `${-i * 1.7}s` }} />)}</div>
      <div className="t-lights">{[8, 30, 70, 92].map((x, i) => <i key={i} style={{ left: `${x}%`, '--i': i } as React.CSSProperties} />)}</div>
      <div className="t-dust">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.73) % 9}s`, animationDuration: `${7 + (i % 5)}s` }} />)}</div>
      {/* Logo ring, far behind */}
      <div className="t-ring" style={{ transform: `translate(${mouse.x * -24}px, ${mouse.y * -14}px)` }}>
        <div>{RAW_TEAMS.map((t, i) => <img key={t.abbr} src={t.logo} alt="" style={{ transform: `rotateY(${(i / RAW_TEAMS.length) * 360}deg) translateZ(620px)` }} onError={e => { (e.target as HTMLImageElement).src = t.logoAlt; }} />)}</div>
      </div>
      <div className="t-vignette" />

      {/* Intro: the ball, the hit, the flash */}
      <div className="t-ball"><svg viewBox="0 0 120 70"><defs><radialGradient id="tb" cx=".35" cy=".35"><stop offset="0" stopColor="#c46f33" /><stop offset="1" stopColor="#5d2a0c" /></radialGradient></defs><ellipse cx="60" cy="35" rx="56" ry="31" fill="url(#tb)" /><path d="M30 35h60" stroke="#fff" strokeWidth="3" /><path d="M42 29v12M50 29v12M58 29v12M66 29v12M74 29v12" stroke="#fff" strokeWidth="2.4" /><path d="M14 22c10 4 10 22 0 26M106 22c-10 4-10 22 0 26" stroke="#fff" strokeWidth="3" fill="none" /></svg></div>
      <div className="t-flash" /><div className="t-shock" />

      <div className="t-stage" style={{ transform: `translate(${mouse.x * 10}px, ${mouse.y * 6}px)` }}>
        <div className="t-brand">
          <div className="t-kicker">2026 Season · Real Rosters · Real Contracts</div>
          <h1 className="t-title"><span>Gridiron</span><span>GM</span></h1>
          <nav className="t-menu">
            {items.map((it, i) => (
              <button key={it.k} className={`t-item${i === sel ? ' on' : ''}`} style={{ '--i': i } as React.CSSProperties} onMouseEnter={() => setSel(i)} onClick={() => it.go()}>
                <em>{String(i + 1).padStart(2, '0')}</em><b>{it.k}</b><small>{it.sub}</small>
              </button>
            ))}
          </nav>
          <div className="t-hint">↑ ↓ to choose · Enter to select</div>
        </div>
        {c && (
          <div className="t-cover" style={{ '--c1': col, '--c2': col2 } as React.CSSProperties}>
            <div className="t-cover-in" key={c.id}>
              {ct && <img className="t-cover-logo" src={ct.logo} alt="" onError={e => { (e.target as HTMLImageElement).src = ct.logoAlt; }} />}
              <div className="t-cover-num">{c.num ?? ''}</div>
              {/* Helmet silhouette in team colours: shows when the headshot cannot load. */}
              <svg className="t-cover-helmet" viewBox="0 0 200 170"><path d="M40 120C20 60 60 10 120 12c46 2 72 40 70 84l-4 18H128l-6 20H70l-6-14z" fill="var(--c1)" stroke="rgba(255,255,255,.35)" strokeWidth="3" /><path d="M96 12c6 30 8 70 6 108" stroke="var(--c2)" strokeWidth="9" fill="none" /><path d="M128 114h66M140 114v34M160 114v30M128 130h60" stroke="#ddd" strokeWidth="6" fill="none" /><circle cx="70" cy="86" r="9" fill="rgba(0,0,0,.5)" /></svg>
              {c.hs && <img className="t-cover-hs" src={c.hs} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />}
              <div className="t-cover-meta">
                <div className="up">Cover Athlete</div>
                <div className="t-cover-name"><span>{c.fn}</span>{c.ln}</div>
                <div className="row" style={{ gap: 10 }}><span className="t-cover-pos">{c.pos} · {ct?.nick}</span><Ovr v={c.ovr} lg /></div>
              </div>
            </div>
            <div className="t-dots">{COVER.map((_, i) => <i key={i} className={i === cover ? 'on' : ''} onClick={() => setCover(i)} />)}</div>
          </div>
        )}
      </div>
      <div className="t-ticker"><b>League Leaders</b><div><span>{[...TICKER, ...TICKER].join('     •     ')}</span></div></div>
      {playing && <div className="t-skip">Click or press any key to skip</div>}
    </div>
  );
}
export function migrate(l: League) { l.version ??= 1; }

const DIFFS = [
  ['Rookie', 'Trades accepted at fair value, forgiving owner.'],
  ['Pro', 'AI wants to win trades by ~10%. The standard experience.'],
  ['All-Madden', 'AI drives hard bargains (+22%), demanding owner.'],
] as const;

/** Team select on 3D cards, sorted by overall with filters. */
export function NewFranchise() {
  const preview = useMemo(() => createLeague('KC', 'preview', { seed: 7 }), []);
  const [team, setTeam] = useState<string>('KC');
  const [gm, setGm] = useState('');
  const [diff, setDiff] = useState<League['difficulty']>('Pro');
  const [conf, setConf] = useState<'ALL' | 'AFC' | 'NFC'>('ALL');
  const rows = Object.values(preview.teams).map(t => ({ t, r: teamRatings(preview, t.abbr), cap: capSpace(preview, t.abbr), qb: preview.players[t.depth.QB?.[0] ?? ''], star: Object.values(preview.players).filter(p => p.team === t.abbr && p.status === 'ACT').sort((a, b) => b.ovr - a.ovr)[0] }))
    .filter(x => conf === 'ALL' || x.t.conf === conf).sort((a, b) => b.r.ovr - a.r.ovr);
  const sel = rows.find(x => x.t.abbr === team) ?? rows[0];
  const start = () => app.busy('Building your franchise…', () => {
    const l = createLeague(team, gm || 'You', { difficulty: diff });
    app.setLeague(l);
    app.replace({ id: 'hub' });
  });
  return (
    <div style={{ padding: '28px 32px 60px', maxWidth: 1500, margin: '0 auto' }} className="fade-in">
      <div className="row" style={{ marginBottom: 18 }}>
        <button className="btn ghost" onClick={() => app.backTo()}>‹ Back</button>
        <div className="h1">Choose Your Team</div>
        <div className="spacer" />
        {(['ALL', 'AFC', 'NFC'] as const).map(c => <span key={c} className={`chip${conf === c ? ' on' : ''}`} onClick={() => setConf(c)}>{c}</span>)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px', alignItems: 'start' }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {rows.map(({ t, r }) => (
            <Tilt key={t.abbr} max={14} style={{ cursor: 'pointer' }}>
              <div onClick={() => setTeam(t.abbr)} className="card" style={{ padding: 14, height: '100%', borderColor: team === t.abbr ? vivid(t.colors[0]) : undefined, background: `linear-gradient(160deg, ${t.colors[0]}ee, #0b1120 78%)`, boxShadow: team === t.abbr ? `0 0 0 2px ${vivid(t.colors[0])}, 0 20px 50px rgba(0,0,0,.5)` : undefined, transform: 'translateZ(0)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}><Logo team={t as never} size={58} style={{ transform: 'translateZ(40px)' }} /><Ovr v={r.ovr} /></div>
                <div className="h3" style={{ marginTop: 8 }}>{t.name}</div>
                <div className="small dim">{t.conf} {t.div}</div>
                <div className="row small" style={{ marginTop: 6, gap: 8 }}><span>OFF <b>{Math.round(r.off)}</b></span><span>DEF <b>{Math.round(r.def)}</b></span></div>
              </div>
            </Tilt>
          ))}
        </div>
        {sel && (
          <div className="card hero" style={{ position: 'sticky', top: 20, background: `linear-gradient(160deg, ${sel.t.colors[0]}, #0b1120 70%)` }}>
            <div className="row"><Logo team={sel.t as never} size={96} /><div><div className="h2">{sel.t.name}</div><div className="dim">{sel.t.stadium}</div><div className="small dim">HC {sel.t.coach.name} · {sel.t.coach.off} / {sel.t.coach.def}</div></div></div>
            <div className="grid g3" style={{ margin: '18px 0' }}>
              <div className="stat"><span className="k">Overall</span><span className="v">{sel.r.ovr}</span></div>
              <div className="stat"><span className="k">Cap Room</span><span className="v" style={{ fontSize: 22 }}>{money(sel.cap)}</span></div>
              <div className="stat"><span className="k">Market</span><span className="v" style={{ fontSize: 22 }}>{['', 'Small', 'Mid', 'Big'][sel.t.market]}</span></div>
            </div>
            {[sel.qb, sel.star].filter(Boolean).map((p, i) => p && (
              <div className="li" key={i} style={{ cursor: 'default' }}><Face p={p} size={46} team={sel.t} /><div><div className="up">{i === 0 ? 'Quarterback' : 'Best Player'}</div><b>{p.fn} {p.ln}</b> <span className="dim small">{p.pos}</span></div><div className="spacer" /><Ovr v={p.ovr} /></div>
            ))}
            <div className="divider" />
            <div className="up" style={{ marginBottom: 6 }}>Your name</div>
            <input value={gm} onChange={e => setGm(e.target.value)} placeholder="General Manager" style={{ width: '100%' }} maxLength={30} />
            <div className="up" style={{ margin: '14px 0 6px' }}>Difficulty</div>
            {DIFFS.map(([d, desc]) => <div key={d} className={`li`} onClick={() => setDiff(d)} style={{ borderRadius: 10, padding: 10, background: diff === d ? 'rgba(255,255,255,.08)' : undefined }}><span className={`chip${diff === d ? ' on' : ''}`}>{d}</span><span className="small dim">{desc}</span></div>)}
            <button className="btn gold big" style={{ width: '100%', marginTop: 16 }} onClick={start}>Take Control ▸</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function LoadScreen() {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const refresh = () => listSaves().then(setSaves);
  useEffect(() => { refresh(); }, []);
  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }} className="fade-in">
      <div className="row" style={{ marginBottom: 18 }}><button className="btn ghost" onClick={() => app.backTo()}>‹ Back</button><div className="h1">Load Franchise</div></div>
      <div className="card">
        {!saves ? <div className="empty">Loading…</div> : !saves.length ? <div className="empty">No saved franchises yet.</div> : saves.map(s => (
          <div key={s.slot} className="li">
            <div style={{ flex: 1 }}><div className="h3">{s.name}{s.slot.endsWith('-auto') ? ' (autosave)' : ''}</div><div className="small dim">{s.team} · {s.season} · {s.phase} {s.phase === 'regular' ? `week ${s.week}` : ''} · {new Date(s.saved).toLocaleString()}</div></div>
            <button className="btn primary sm" onClick={async () => { const l = await loadLeague(s.slot); if (l) { migrate(l); app.setLeague(l); app.replace({ id: 'hub' }); } }}>Load</button>
            <button className="btn danger sm" onClick={async () => { if (confirm('Delete this save?')) { await deleteSave(s.slot); refresh(); } }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
