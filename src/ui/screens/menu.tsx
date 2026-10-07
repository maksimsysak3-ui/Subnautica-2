import { useEffect, useMemo, useState } from 'react';
import { app, listSaves, loadLeague, deleteSave, type SaveMeta } from '../store';
import { Logo, Ovr, Tilt, Face, vivid } from '../components';
import { createLeague, RAW_TEAMS, teamRatings } from '../../core/league';
import type { League } from '../../core/types';
import { capSpace, money } from '../../core/contracts';

/** Title screen: a rotating 3D ring of all 32 logos over a receding, lit field. */
export function MainMenu() {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => { listSaves().then(setSaves); }, []);
  const teams = RAW_TEAMS;
  return (
    <div onMouseMove={e => setMouse({ x: e.clientX / window.innerWidth - 0.5, y: e.clientY / window.innerHeight - 0.5 })}
      style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
      <style>{`
        @keyframes ring { from { transform: rotateX(-12deg) rotateY(0deg) } to { transform: rotateX(-12deg) rotateY(-360deg) } }
        @keyframes turf { from { background-position: 0 0 } to { background-position: 0 160px } }
        @keyframes flare { 0%,100% { opacity: .55 } 50% { opacity: .95 } }
        @keyframes titleIn { from { opacity: 0; transform: translateY(30px) scale(.96); letter-spacing: .3em } to { opacity: 1; transform: none; letter-spacing: .04em } }
        .menu-btn { width: 300px; justify-content: flex-start; padding: 16px 22px; font: 700 20px var(--head); letter-spacing: .12em; text-transform: uppercase; border-radius: 14px; background: linear-gradient(90deg, rgba(30,42,70,.9), rgba(16,22,38,.6)); border: 1px solid rgba(150,180,255,.18); transition: transform .2s, background .2s, border-color .2s; }
        .menu-btn:hover { transform: translateX(10px); background: linear-gradient(90deg, rgba(59,130,246,.55), rgba(16,22,38,.6)); border-color: rgba(150,180,255,.5); }
      `}</style>
      {/* receding turf */}
      <div style={{ position: 'absolute', left: '-50%', right: '-50%', bottom: '-30%', height: '80%', transform: 'perspective(600px) rotateX(70deg)', background: 'repeating-linear-gradient(0deg, #1f5a2a 0 80px, #23652f 80px 160px)', animation: 'turf 3s linear infinite', boxShadow: 'inset 0 200px 200px #05070d', opacity: .9 }} />
      <div style={{ position: 'absolute', left: '-50%', right: '-50%', bottom: '-30%', height: '80%', transform: 'perspective(600px) rotateX(70deg)', backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc(10% - 2px), rgba(255,255,255,.35) calc(10% - 2px) 10%)' }} />
      {/* stadium lights */}
      {[12, 30, 70, 88].map((x, i) => <div key={i} style={{ position: 'absolute', top: '6%', left: `${x}%`, width: 220, height: 220, transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(255,255,240,.9), rgba(255,255,220,.25) 25%, transparent 60%)', animation: `flare ${3 + i}s ease-in-out infinite`, filter: 'blur(2px)' }} />)}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, transparent 30%, rgba(3,5,10,.85) 80%)' }} />
      {/* 3D ring of logos */}
      <div style={{ position: 'absolute', top: '16%', left: '50%', width: 0, height: 0, perspective: 1400, transform: `translate(${mouse.x * -30}px, ${mouse.y * -20}px)` }}>
        <div style={{ transformStyle: 'preserve-3d', animation: 'ring 60s linear infinite' }}>
          {teams.map((t, i) => (
            <div key={t.abbr} style={{ position: 'absolute', left: -40, top: -40, width: 80, height: 80, transform: `rotateY(${(i / teams.length) * 360}deg) translateZ(560px)`, backfaceVisibility: 'hidden' }}>
              <img src={t.logo} width={80} height={80} alt="" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,.7))' }} onError={e => { (e.target as HTMLImageElement).src = t.logoAlt; }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', textAlign: 'center', marginTop: '14vh', transform: `translate(${mouse.x * 14}px, ${mouse.y * 10}px)` }}>
        <div className="up" style={{ color: 'var(--gold)', letterSpacing: '.4em', marginBottom: 8 }}>2026 Season · Real Rosters</div>
        <div style={{ font: '900 clamp(54px, 9vw, 120px)/0.9 var(--head)', textTransform: 'uppercase', animation: 'titleIn 1s cubic-bezier(.2,.8,.2,1)', textShadow: '0 10px 40px rgba(0,0,0,.8)', background: 'linear-gradient(180deg, #fff, #b9c7e8)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Gridiron GM</div>
        <div className="dim" style={{ margin: '10px 0 34px', fontSize: 16 }}>Build a dynasty. Every snap simulated.</div>
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
          {saves[0] && <button className="btn menu-btn" style={{ borderColor: 'rgba(245,197,66,.5)' }} onClick={async () => { const l = await loadLeague(saves[0].slot); if (l) { migrate(l); app.setLeague(l); app.replace({ id: 'hub' }); } }}>▶ Continue <span className="dim small" style={{ marginLeft: 'auto', letterSpacing: 0, textTransform: 'none', font: '500 12px var(--body)' }}>{saves[0].team} · {saves[0].season}</span></button>}
          <button className="btn menu-btn" onClick={() => app.go({ id: 'new' })}>✚ New Franchise</button>
          <button className="btn menu-btn" onClick={() => app.go({ id: 'load' })}>⭱ Load Franchise</button>
        </div>
        <div className="mute small" style={{ marginTop: 40 }}>Rosters, contracts and schedule from nflverse public data. Logos load from the ESPN CDN.</div>
      </div>
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
