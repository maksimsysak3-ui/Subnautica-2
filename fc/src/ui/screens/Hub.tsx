import type { ReactNode } from 'react';
import { useWorld } from '../store';
import { go } from '../nav';
import { Crest, Face, PlayerCard, Kit, kitFor } from '../art';
import { Form, ClubName } from '../bits';
import { fmtDate, table, ord } from '../../core/season';
import { teamRatings, slotsOf } from '../../core/tactics';
import { fmtMoney, windowOpen } from '../../core/transfers';
import { dayOf } from '../../core/season';
import type { Club, World } from '../../core/types';
import { tick } from '../sfx';

/** Night-match stadium backdrop drawn in CSS: sky, floodlights, stands and a lit pitch. */
export function Stadium({ c1, c2, children, className }: { c1: string; c2: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`stadium ${className ?? ''}`} style={{ ['--s1' as string]: c1, ['--s2' as string]: c2 }}>
      <div className="st-sky" />
      <div className="st-lights"><i /><i /><i /><i /></div>
      <div className="st-stand" />
      <div className="st-crowd" />
      <div className="st-pitch"><div className="st-lines" /></div>
      <div className="st-haze" />
      {children}
    </div>
  );
}

function Tile({ label, sub, onClick, className, children, accent }: { label: string; sub?: string; onClick?: () => void; className?: string; children?: ReactNode; accent?: string }) {
  return (
    <div className={`tile ${className ?? ''}`} onClick={() => { tick(); onClick?.(); }} style={accent ? { ['--ta' as string]: accent } : undefined}>
      <div className="tile-art">{children}</div>
      <div className="tile-shade" />
      <div className="tile-label"><b>{label}</b>{sub && <span>{sub}</span>}</div>
    </div>
  );
}

export function Hub() {
  const w = useWorld();
  const u = w.clubs[w.user];
  const next = w.fixtures.filter(f => !f.res && (f.home === w.user || f.away === w.user));
  const nx = next[0];
  const last = w.fixtures.filter(f => f.res && (f.home === w.user || f.away === w.user)).slice(-5).reverse();
  const squad = u.squad.map(id => w.players[id]).filter(Boolean);
  const star = [...squad].sort((a, b) => b.ovr - a.ovr)[0];
  const inForm = [...squad].filter(p => p.s.apps > 0).sort((a, b) => b.form - a.form)[0] ?? squad.sort((a, b) => b.pot - a.pot)[0];
  const prospect = [...squad].filter(p => w.season - p.born <= 21).sort((a, b) => b.pot - a.pot)[0];
  const lastDeal = w.transfers[0];
  const dealP = lastDeal ? w.players[lastDeal.pid] : undefined;
  const injured = squad.filter(p => p.inj).length;
  const unread = w.news.filter(n => !n.read).slice(0, 4);
  const deadline = w.day < dayOf(w.season, 9, 1) ? dayOf(w.season, 9, 1) : dayOf(w.season, 2, 2);
  const r = teamRatings(w, u);
  const lgT = w.comps[u.league] ? table(w, u.league) : [];
  const pos = lgT.findIndex(x => x.id === u.id) + 1;
  const scorer = Object.values(w.players).filter(p => p.cs[u.league]?.[1]).sort((a, b) => b.cs[u.league][1] - a.cs[u.league][1])[0];

  return (
    <div className="hub2">
      <div className="hub-tiles">
        {nx ? <NextMatchTile w={w} fxId={nx.id} /> : <Tile label="Season complete" className="t-hero" />}

        <Tile label="Squad Hub" sub={`${squad.length} players · OVR ${r.ovr}${injured ? ` · ${injured} injured` : ''}`} onClick={() => go({ s: 'squad' })} className="t-tall" accent={u.c1}>
          <div className="art-cardfan">
            {inForm && inForm !== star && <div className="cf l"><PlayerCard p={inForm} club={u} size={0.8} /></div>}
            {star && <div className="cf c"><PlayerCard p={star} club={u} size={1} /></div>}
            {prospect && prospect !== star && <div className="cf r"><PlayerCard p={prospect} club={u} size={0.8} /></div>}
          </div>
        </Tile>

        <Tile label="Transfer Hub" sub={windowOpen(w) ? `Window closes ${fmtDate(w, deadline - 1)} · ${fmtMoney(u.budget)}` : `Window closed · ${fmtMoney(u.budget)}`} onClick={() => go({ s: 'transfers' })} accent="#f5c542">
          <div className="art-deal">
            {lastDeal && dealP ? <>
              <Face p={dealP} club={w.clubs[lastDeal.to]} size={110} />
              <div className="ad-txt"><em>{windowOpen(w) ? 'LATEST DEAL' : 'LAST DEAL'}</em><b>{lastDeal.name}</b><span>{w.clubs[lastDeal.from] ? <Crest club={w.clubs[lastDeal.from]} size={22} /> : 'FA'}<i>→</i><Crest club={w.clubs[lastDeal.to]} size={22} /></span><strong>{lastDeal.loan ? 'LOAN' : lastDeal.fee ? fmtMoney(lastDeal.fee) : 'FREE'}</strong></div>
            </> : <div className="ad-txt"><em>TRANSFER MARKET</em><b>Scout the world</b><strong>{fmtMoney(u.budget)}</strong></div>}
          </div>
        </Tile>

        <Tile label={w.comps[u.league]?.name ?? 'League'} sub={pos ? `${pos}${ord(pos)} place` : ''} onClick={() => go({ s: 'comps', id: u.league })} accent="#3b82f6">
          <div className="art-table">
            {lgT.slice(0, pos > 4 ? 3 : 4).map((row, i) => <div key={row.id} className={row.id === u.id ? 'me' : ''}><span>{i + 1}</span><Crest club={w.clubs[row.id]} size={20} /><b>{w.clubs[row.id].short}</b><em>{row.pts}</em></div>)}
            {pos > 4 && <div className="me"><span>{pos}</span><Crest club={u} size={20} /><b>{u.short}</b><em>{lgT[pos - 1].pts}</em></div>}
          </div>
        </Tile>

        <Tile label="Tactics" sub={`${u.tactic.formation} · ${['Ultra defensive', 'Defensive', 'Balanced', 'Attacking', 'All-out attack'][u.tactic.mentality + 2]}`} onClick={() => go({ s: 'tactics' })} accent="#22e3a1">
          <MiniFormation w={w} c={u} />
        </Tile>

        <Tile label="Inbox" sub={`${w.news.filter(n => !n.read).length} unread`} onClick={() => go({ s: 'inbox' })} accent="#a855f7">
          <div className="art-news">{(unread.length ? unread : w.news.slice(0, 4)).map(n => <div key={n.id} className={`k-${n.kind}`}><i />{n.title}</div>)}</div>
        </Tile>

        <Tile label="Board" sub={w.board.objective} onClick={() => go({ s: 'club' })} accent={w.board.confidence < 30 ? '#ef4444' : '#22c55e'}>
          <div className="art-ring">
            <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" className="rg-bg" /><circle cx="60" cy="60" r="50" className="rg-fg" style={{ strokeDasharray: `${w.board.confidence * 3.14} 400`, stroke: w.board.confidence < 30 ? '#ef4444' : w.board.confidence < 60 ? '#eab308' : '#22e3a1' }} /></svg>
            <b>{Math.round(w.board.confidence)}<small>%</small></b><span>CONFIDENCE</span>
          </div>
        </Tile>

        <Tile label="Form" sub={last.length ? 'Last five matches' : 'Season starts soon'} onClick={() => go({ s: 'fixtures' })} accent="#f97316">
          <div className="art-form">
            {last.length ? last.map(f => {
              const home = f.home === w.user; const o = w.clubs[home ? f.away : f.home];
              const gf = home ? f.res!.hg : f.res!.ag, ga = home ? f.res!.ag : f.res!.hg;
              const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
              return <div key={f.id} className={`fr f-${res}`}><Crest club={o} size={30} /><b>{gf}-{ga}</b><i>{res}</i></div>;
            }) : <Kit {...kitFor(u)} num={star?.num ?? 10} name={star?.name.split(' ').slice(-1)[0]} size={130} />}
          </div>
        </Tile>

        <Tile label="Training" sub={`${w.training.focus} focus`} onClick={() => go({ s: 'training' })} accent="#38bdf8">
          <div className="art-train">{prospect && <><Face p={prospect} club={u} size={96} /><div><em>TOP PROSPECT</em><b>{prospect.name}</b><span>{prospect.ovr} → {prospect.pot}</span></div></>}</div>
        </Tile>

        <Tile label="Stats" sub={scorer ? `Golden Boot race` : 'League leaders'} onClick={() => go({ s: 'stats' })} accent="#eab308">
          <div className="art-train">{scorer ? <><Face p={scorer} club={scorer.club ? w.clubs[scorer.club] : undefined} size={96} /><div><em>TOP SCORER</em><b>{scorer.name}</b><span>{scorer.cs[u.league][1]} goals</span></div></> : <div><em>NO GOALS YET</em><b>Kick-off pending</b></div>}</div>
        </Tile>
      </div>

      {next.length > 1 && (
        <div className="hub-strip">
          <h3>Upcoming</h3>
          <div className="strip-row">
            {next.slice(1, 9).map(f => { const home = f.home === w.user; const o = w.clubs[home ? f.away : f.home]; return <div key={f.id} className="strip-card" style={{ ['--c1' as string]: o.c1 }}><span>{fmtDate(w, f.day)}</span><Crest club={o} size={40} /><b>{home ? 'vs' : '@'} {o.short}</b><em>{w.comps[f.comp]?.short}</em></div>; })}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniFormation({ w, c }: { w: World; c: Club }) {
  const slots = slotsOf(c.tactic);
  return (
    <div className="art-form-pitch">
      {slots.map((s, i) => { const p = w.players[c.tactic.lineup[i]]; return <div key={i} className="mf-dot" style={{ left: `${s[2] * 100}%`, top: `${(1 - s[1]) * 86 + 4}%`, background: c.c1, borderColor: c.c2 }}><span>{p?.num ?? ''}</span></div>; })}
    </div>
  );
}

function NextMatchTile({ w, fxId }: { w: World; fxId: number }) {
  const f = w.fixtures.find(x => x.id === fxId)!;
  const h = w.clubs[f.home], a = w.clubs[f.away];
  const comp = w.comps[f.comp];
  const today = f.day === w.day;
  return (
    <div className="tile t-hero" onClick={() => today ? go({ s: 'match', fx: f.id }) : go({ s: 'fixtures' })}>
      <Stadium c1={h.c1} c2={a.c1} className="tile-art">
        <div className="nmh-crests">
          <div><Crest club={h} size={150} /><b>{h.name}</b><span>OVR {teamRatings(w, h).ovr}</span><Form f={h.form} /></div>
          <div className="nmh-vs">VS</div>
          <div><Crest club={a} size={150} /><b>{a.name}</b><span>OVR {teamRatings(w, a).ovr}</span><Form f={a.form} /></div>
        </div>
      </Stadium>
      <div className="tile-shade" />
      <div className="tile-label big">
        <em>{comp?.name} · {f.stage}</em>
        <b>{today ? 'Matchday' : 'Next Match'}</b>
        <span>{fmtDate(w, f.day, true)} · {f.neutral ? 'Neutral venue' : h.stadium}{!today ? ` · in ${f.day - w.day} day${f.day - w.day === 1 ? '' : 's'}` : ''}</span>
      </div>
      {today && <div className="nmh-cta">PLAY ▶</div>}
    </div>
  );
}

export function MiniTable({ w, comp, focus, rows = 7 }: { w: World; comp: string; focus: string; rows?: number }) {
  if (!w.comps[comp]) return null;
  const t = table(w, comp);
  const i = t.findIndex(r => r.id === focus);
  const start = Math.max(0, Math.min(t.length - rows, i - Math.floor(rows / 2)));
  return (
    <table className="tbl mini">
      <thead><tr><th>#</th><th>Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>{t.slice(start, start + rows).map((r, k) => (
        <tr key={r.id} className={r.id === focus ? 'me' : ''}><td>{start + k + 1}</td><td><ClubName c={w.clubs[r.id]} /></td><td>{r.p}</td><td>{r.gf - r.ga}</td><td><b>{r.pts}</b></td></tr>
      ))}</tbody>
    </table>
  );
}
