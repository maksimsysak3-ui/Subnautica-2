import { useEffect, useMemo, useState } from 'react';
import type { World } from '../core/types';
import { createWorld, LEAGUES, leagueLogo } from '../core/world';
import { advanceDay, fmtDate, startSeason, news, table, ord } from '../core/season';
import { teamRatings } from '../core/tactics';
import { fmtMoney, windowOpen } from '../core/transfers';
import { useWorld, setWorld, mutate, listSaves, loadSlot, saveNow, setSlot, deleteSlot, bump, type SaveMeta, getWorld } from './store';
import { go, useRoute, useToasts, toast } from './nav';
import { Crest, Stars, PlayerCard } from './art';
import { setSound, tick } from './sfx';
import { Hub } from './screens/Hub';
import { Squad } from './screens/Squad';
import { PlayerScreen } from './screens/Player';
import { Tactics } from './screens/Tactics';
import { Transfers } from './screens/Transfers';
import { Fixtures, Comps } from './screens/Comps';
import { ClubScreen } from './screens/Club';
import { Stats, Inbox, History } from './screens/Misc';
import { MatchDay } from './screens/MatchDay';
import { SeasonEnd, Sacked } from './screens/SeasonEnd';
import { Training } from './screens/Training';

export function App() {
  const [started, setStarted] = useState(false);
  if (!started) return <Title onStart={() => setStarted(true)} />;
  return <Shell />;
}

// ---- title & new career --------------------------------------------------------------------
let previewWorld: World | null = null;
const getPreview = () => (previewWorld ??= createWorld('arsenal', 'x', 12345));

function Title({ onStart }: { onStart: () => void }) {
  const [mode, setMode] = useState<'menu' | 'new' | 'load'>('menu');
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { void listSaves().then(setSaves); }, []);
  const preview = useMemo(getPreview, []);
  const stars = useMemo(() => Object.values(preview.players).filter(p => p.real && p.club).sort((a, b) => b.ovr - a.ovr).slice(0, 12), [preview]);
  useEffect(() => { const t = setInterval(() => setIdx(i => (i + 1) % stars.length), 3200); return () => clearInterval(t); }, [stars.length]);
  const latest = [...saves].sort((a, b) => b.saved - a.saved)[0];
  const resume = async (s: number) => {
    const w = await loadSlot(s);
    if (!w) { toast('Save could not be loaded', 'bad'); return; }
    setSlot(s); setWorld(w); setSound(w.settings.sound); onStart();
  };
  if (mode === 'new') return <NewCareer onBack={() => setMode('menu')} onDone={onStart} saves={saves} />;
  const star = stars[idx];
  const sc = star?.club ? preview.clubs[star.club] : undefined;
  return (
    <div className="title2" style={{ ['--c1' as string]: sc?.c1 ?? '#22e3a1', ['--c2' as string]: sc?.c2 ?? '#fff' }}>
      <div className="bgfx"><i className="b1" /><i className="b2" /><i className="b3" /><div className="streaks" /><div className="grain" /></div>
      <div className="t2-left">
        <div className="t2-brand"><span className="brand-ball" /><h1>PITCH<b>GM</b></h1></div>
        <p className="t2-tag">Real clubs. Real squads. Your dynasty.</p>
        {mode === 'menu' && (
          <div className="t2-menu">
            {latest && (
              <button className="t2-tile primary" onClick={() => resume(latest.slot)}>
                <em>CONTINUE</em><b>{latest.manager}</b><span>{latest.club.replace(/-/g, ' ')} · {fmtSeason(latest.season)}</span>
              </button>
            )}
            <button className="t2-tile" onClick={() => { tick(); setMode('new'); }}><em>CAREER</em><b>New Career</b><span>Take charge of one of 96 clubs across Europe's top five leagues</span></button>
            {saves.length > 0 && <button className="t2-tile" onClick={() => { tick(); setMode('load'); }}><em>SAVES</em><b>Load Career</b><span>{saves.length} saved career{saves.length > 1 ? 's' : ''}</span></button>}
          </div>
        )}
        {mode === 'load' && (
          <div className="save-list">
            {[1, 2, 3].map(s => {
              const m = saves.find(x => x.slot === s);
              return (
                <div key={s} className="save-row">
                  <span className="slot">SLOT {s}</span>
                  {m ? <><b>{m.manager}</b><span>{m.club}</span><span>{fmtSeason(m.season)}</span><button onClick={() => resume(s)}>Load</button><button className="danger" onClick={async () => { await deleteSlot(s); setSaves(await listSaves()); }}>Delete</button></> : <span className="muted">Empty</span>}
                </div>
              );
            })}
            <button className="btn-ghost" onClick={() => setMode('menu')}>Back</button>
          </div>
        )}
      </div>
      <div className="t2-right">
        {sc && <div className="t2-bgcrest" key={'c' + idx}><Crest club={sc} size={560} /></div>}
        {star && <div className="t2-card" key={idx}><PlayerCard p={star} club={sc} size={1.9} /></div>}
        {star && <div className="t2-cap" key={'n' + idx}><em>FEATURED</em><b>{star.name}</b><span>{sc?.name}</span></div>}
        <div className="t2-dots">{stars.map((_, i) => <i key={i} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} />)}</div>
      </div>
      <div className="title-foot">Rosters as of the 2025/26 season · crests via football-logos.cc · flags via flagcdn</div>
    </div>
  );
}
export const fmtSeason = (s: number) => `${s}/${String(s + 1).slice(2)}`;

function NewCareer({ onBack, onDone, saves }: { onBack: () => void; onDone: () => void; saves: SaveMeta[] }) {
  // a throwaway world just to browse the clubs (cheap: ~0.3s)
  const preview = useMemo(getPreview, []);
  const [league, setLeague] = useState(LEAGUES[0].id);
  const [club, setClub] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const clubs = Object.values(preview.clubs).filter(c => c.league === league).sort((a, b) => b.rep - a.rep);
  const sel = club ? preview.clubs[club] : null;
  const freeSlot = [1, 2, 3].find(s => !saves.some(x => x.slot === s)) ?? 1;
  const start = () => {
    if (!club) return;
    setBusy(true);
    setTimeout(() => {
      const w = createWorld(club, name.trim() || 'The Gaffer');
      startSeason(w);
      const c = w.clubs[club];
      news(w, 'board', `Welcome to ${c.name}`, `The board has appointed you as manager. Objective for the season: ${w.board.objective}. Transfer budget: ${fmtMoney(c.budget)}. The summer window is open until 1 September.`);
      setSlot(freeSlot); setWorld(w); void saveNow();
      onDone();
    }, 30);
  };
  return (
    <div className="newcareer">
      <header className="nc-h"><button className="btn-ghost" onClick={onBack}>← Back</button><h2>Choose your club</h2><span /></header>
      <div className="nc-leagues">
        {LEAGUES.filter(l => l.tier === 1).map(l => (
          <button key={l.id} className={l.id === league ? 'on' : ''} onClick={() => { setLeague(l.id); setClub(null); }} style={{ ['--lc' as string]: l.color }}>
            <img src={leagueLogo(l.id)} alt="" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} /><span>{l.name}</span>
          </button>
        ))}
      </div>
      <div className="nc-body">
        <div className="nc-grid">
          {clubs.map(c => {
            const r = teamRatings(preview, c);
            return (
              <button key={c.id} className={`nc-club ${club === c.id ? 'on' : ''}`} onClick={() => { tick(); setClub(c.id); }} style={{ ['--c1' as string]: c.c1, ['--c2' as string]: c.c2 }}>
                <Crest club={c} size={56} />
                <b>{c.name}</b>
                <Stars n={Math.max(1, Math.min(5, Math.round((c.rep - 50) / 9)))} />
                <span className="nc-ovr">OVR {r.ovr}</span>
              </button>
            );
          })}
        </div>
        <aside className="nc-side">
          {sel ? (
            <>
              <div className="nc-hero" style={{ background: `linear-gradient(135deg, ${sel.c1}, ${sel.c2 === '#FFFFFF' ? shadeHex(sel.c1) : sel.c2})` }}>
                <Crest club={sel} size={110} />
                <h3>{sel.name}</h3>
                <span>{sel.stadium} · {sel.cap.toLocaleString()}</span>
              </div>
              <div className="nc-facts">
                {(() => { const r = teamRatings(preview, sel); return <><div><span>ATT</span><b>{r.att}</b></div><div><span>MID</span><b>{r.mid}</b></div><div><span>DEF</span><b>{r.def}</b></div></>; })()}
                <div><span>Budget</span><b>{fmtMoney(sel.budget)}</b></div>
                <div><span>Wage bill</span><b>{fmtMoney(sel.wageBudget)}/wk</b></div>
                <div><span>Prestige</span><b><Stars n={Math.max(1, Math.min(5, Math.round((sel.rep - 50) / 9)))} /></b></div>
              </div>
              <div className="nc-stars">
                {sel.squad.map(id => preview.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 5).map(p => <div key={p.id}><b>{p.ovr}</b> {p.name} <span className="muted">{p.pos}</span></div>)}
              </div>
              <label className="nc-name">Manager name<input value={name} onChange={e => setName(e.target.value)} placeholder="The Gaffer" maxLength={28} /></label>
              <button className="btn-hero" disabled={busy} onClick={start}>{busy ? 'Building the world…' : `Take charge`}</button>
              <p className="muted sm">Saves to slot {freeSlot}.</p>
            </>
          ) : <div className="nc-pick">Pick a club to see the job.</div>}
        </aside>
      </div>
    </div>
  );
}
export function shadeHex(h: string) { const n = parseInt(h.slice(1), 16); const f = (v: number) => Math.round(v * 0.45).toString(16).padStart(2, '0'); return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`; }

// ---- main shell ----------------------------------------------------------------------------------
const NAV: [string, string, () => void][] = [
  ['hub', 'Home', () => go({ s: 'hub' })],
  ['squad', 'Squad', () => go({ s: 'squad' })],
  ['tactics', 'Tactics', () => go({ s: 'tactics' })],
  ['training', 'Training', () => go({ s: 'training' })],
  ['transfers', 'Transfers', () => go({ s: 'transfers' })],
  ['fixtures', 'Fixtures', () => go({ s: 'fixtures' })],
  ['comps', 'Competitions', () => go({ s: 'comps' })],
  ['stats', 'Stats', () => go({ s: 'stats' })],
  ['club', 'Club', () => go({ s: 'club' })],
  ['inbox', 'Inbox', () => go({ s: 'inbox' })],
];

function Shell() {
  const w = useWorld();
  const route = useRoute();
  const [sim, setSim] = useState<string | null>(null);
  const user = w.clubs[w.user];
  const unread = w.news.filter(n => !n.read).length;
  const pendingOffers = w.offers.filter(o => !o.userBuying && o.to === w.user && o.status === 'pending').length;
  const nextFx = w.fixtures.find(f => !f.res && (f.home === w.user || f.away === w.user));
  const todayMatch = nextFx && nextFx.day === w.day;

  const advance = (mode: 'next' | 'day' | 'week') => {
    if (sim) return;
    if (route.s === 'match') return;
    if (todayMatch && nextFx) { go({ s: 'match', fx: nextFx.id }); return; }
    setSim('Simulating…');
    let days = 0;
    const limit = mode === 'day' ? 1 : mode === 'week' ? 7 : 400;
    const stepChunk = () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 40) {
        const wd = getWorld();
        const stop = advanceDay(wd);
        days++;
        if (stop) {
          bump(); setSim(null); void saveNow();
          if (stop.kind === 'match') { go({ s: 'match', fx: stop.fx.id }); return; }
          if (stop.kind === 'seasonEnd') { go({ s: 'seasonEnd' }); return; }
          if (stop.kind === 'sacked') { go({ s: 'sacked' }); return; }
          if (stop.kind === 'event') { toast(stop.text, 'info'); if (stop.text.startsWith('Offer')) go({ s: 'transfers', tab: 'offers' }); return; }
        }
        if (days >= limit) { bump(); setSim(null); void saveNow(); return; }
      }
      setSim(`${fmtDate(getWorld(), getWorld().day, true)}`);
      bump();
      setTimeout(stepChunk, 0);
    };
    setTimeout(stepChunk, 20);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || route.s === 'match') return;
      if (e.key === ' ') { e.preventDefault(); advance('next'); }
      const i = NAV.findIndex(([k2]) => k2 === route.s || (k2 === 'squad' && route.s === 'player'));
      if (e.key === 'q' || e.key === 'Q') NAV[Math.max(0, i - 1)][2]();
      if (e.key === 'e' || e.key === 'E') NAV[Math.min(NAV.length - 1, i + 1)][2]();
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const leaguePos = w.comps[user.league] ? table(w, user.league).findIndex(r => r.id === user.id) + 1 : 0;
  if (route.s === 'match') return <MatchDay fxId={route.fx} />;
  if (route.s === 'seasonEnd') return <SeasonEnd />;
  if (route.s === 'sacked') return <Sacked />;

  const navIdx = NAV.findIndex(([k]) => k === route.s || (k === 'squad' && route.s === 'player'));
  return (
    <div className="shell2" style={{ ['--club' as string]: user.c1, ['--club2' as string]: user.c2 }}>
      <div className="bgfx"><i className="b1" /><i className="b2" /><i className="b3" /><div className="streaks" /><div className="grain" /></div>
      <header className="fc-top">
        <div className="fc-row1">
          <div className="fc-brand" onClick={() => go({ s: 'hub' })}>PITCH<b>GM</b><span>CAREER</span></div>
          <div className="fc-club" onClick={() => go({ s: 'club' })}>
            <Crest club={user} size={42} />
            <div><b>{user.name}</b><span>{w.manager}{leaguePos ? ` · ${leaguePos}${ord(leaguePos)} ${w.comps[user.league]?.short}` : ''}</span></div>
          </div>
          <div className="fc-meta">
            <div><span>{fmtSeason(w.season)}</span><b>{fmtDate(w, w.day, true)}</b>{windowOpen(w) && <em>TRANSFER WINDOW OPEN</em>}</div>
            <div><span>Budget</span><b>{fmtMoney(user.budget)}</b></div>
            <div><span>Board</span><b className={w.board.confidence < 30 ? 'neg' : w.board.confidence > 70 ? 'pos' : ''}>{Math.round(w.board.confidence)}%</b></div>
          </div>
          <div className="fc-go">
            <button className="fc-day" onClick={() => advance('day')} title="Advance one day">+1 DAY</button>
            <button className={`fc-continue ${todayMatch ? 'matchday' : ''}`} onClick={() => advance('next')}><span>{todayMatch ? 'MATCHDAY' : 'CONTINUE'}</span><i>SPACE</i></button>
          </div>
        </div>
        <nav className="fc-tabs">
          <span className="kbd" onClick={() => { const i = Math.max(0, navIdx - 1); NAV[i][2](); }}>Q</span>
          {NAV.map(([k, l, f]) => (
            <button key={k} className={route.s === k || (k === 'squad' && route.s === 'player') ? 'on' : ''} onClick={() => { tick(); f(); }}>
              {l}
              {k === 'inbox' && unread > 0 && <i className="badge">{unread}</i>}
              {k === 'transfers' && pendingOffers > 0 && <i className="badge hot">{pendingOffers}</i>}
            </button>
          ))}
          <span className="kbd" onClick={() => { const i = Math.min(NAV.length - 1, navIdx + 1); NAV[i][2](); }}>E</span>
          <div className="fc-util">
            <button title="Save" onClick={async () => { const ok = await saveNow(); toast(ok ? 'Career saved' : 'Save failed', ok ? 'good' : 'bad'); }}>SAVE</button>
            <button title="Sound" onClick={() => mutate(x => { x.settings.sound = !x.settings.sound; setSound(x.settings.sound); })}>{w.settings.sound ? 'SFX ON' : 'SFX OFF'}</button>
            <button title="Cinematics" onClick={() => mutate(x => { x.settings.cinematics = !x.settings.cinematics; })}>{w.settings.cinematics ? 'CINE ON' : 'CINE OFF'}</button>
          </div>
        </nav>
      </header>
      <main className="fc-main" key={route.s}>
        <Screen w={w} />
      </main>
      {sim && <div className="sim-overlay"><div className="sim-ball" /><b>{sim}</b><span>Results are coming in across Europe</span></div>}
      <Toasts />
    </div>
  );
}

function Screen({ w }: { w: World }) {
  const r = useRoute();
  switch (r.s) {
    case 'squad': return <Squad />;
    case 'player': return <PlayerScreen id={r.id} key={r.id} />;
    case 'tactics': return <Tactics />;
    case 'transfers': return <Transfers tab={r.tab} />;
    case 'fixtures': return <Fixtures />;
    case 'comps': return <Comps id={r.id} />;
    case 'club': return <ClubScreen id={r.id ?? w.user} key={r.id ?? w.user} />;
    case 'stats': return <Stats />;
    case 'inbox': return <Inbox />;
    case 'training': return <Training />;
    case 'history': return <History />;
    default: return <Hub />;
  }
}

function Toasts() {
  const ts = useToasts();
  return <div className="toasts">{ts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>;
}
