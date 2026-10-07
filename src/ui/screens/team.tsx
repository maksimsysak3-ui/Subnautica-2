import { useState } from 'react';
import { useApp, app } from '../store';
import { Logo, Ovr, Face, Table, Tabs, DevBadge, Jersey, Tilt, Bar, attrColor, PlayerCell, Modal, CountUp, vivid, Grade } from '../components';
import type { Player, Pos, StatLine } from '../../core/types';
import { ATTR_GROUPS, ATTR_NAME, ABILITIES, XFACTOR_DESC, POS_ORDER, POS_NAME, OVR_W } from '../../core/ratings';
import { capHit, capSpace, deadMoney, money, releaseSavings, restructure, yearsLeft, marketValue } from '../../core/contracts';
import { autoDepth, teamRatings, emptyLine } from '../../core/league';
import { release } from '../../core/offseason';
import { NegotiationRoom } from './negotiate';
import { standings } from '../../core/season';
import { scoutedView, draftGrade } from '../../core/draft';

const FILTERS = ['All', 'Offense', 'Defense', 'Special', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'] as const;
const inFilter = (p: Player, f: typeof FILTERS[number]) => {
  const off = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'G', 'C'].includes(p.pos), sp = ['K', 'P', 'LS'].includes(p.pos);
  switch (f) {
    case 'All': return true; case 'Offense': return off; case 'Defense': return !off && !sp; case 'Special': return sp;
    case 'OL': return ['OT', 'G', 'C'].includes(p.pos); case 'DL': return ['EDGE', 'DT'].includes(p.pos); case 'DB': return ['CB', 'S'].includes(p.pos); case 'RB': return p.pos === 'RB' || p.pos === 'FB';
    default: return p.pos === f;
  }
};

export function RosterScreen({ team }: { team?: string }) {
  const L = useApp().league!;
  const abbr = team ?? L.user;
  const [f, setF] = useState<typeof FILTERS[number]>('All');
  const [view, setView] = useState<'Active' | 'Practice Squad' | 'Injured Reserve'>('Active');
  const status = { Active: 'ACT', 'Practice Squad': 'PS', 'Injured Reserve': 'IR' }[view];
  const rows = Object.values(L.players).filter(p => p.team === abbr && p.status === status && inFilter(p, f));
  const act = Object.values(L.players).filter(p => p.team === abbr && p.status === 'ACT').length;
  return (
    <div className="grid">
      <div className="row"><Logo team={L.teams[abbr]} size={46} /><div className="h2">{L.teams[abbr].name} Roster</div><span className={`chip ${act > 53 ? 'on' : ''}`}>{act}/53 active</span><div className="spacer" />
        <Tabs tabs={['Active', 'Practice Squad', 'Injured Reserve'] as const} on={view} set={setView} /></div>
      <div className="row">{FILTERS.map(x => <span key={x} className={`chip${f === x ? ' on' : ''}`} onClick={() => setF(x)}>{x}</span>)}</div>
      <Table rows={rows} rowKey={p => p.id} initial="ovr" onRow={p => app.go({ id: 'player', pid: p.id })} cols={[
        { k: 'name', h: 'Player', get: p => <PlayerCell p={p} />, sort: p => p.ln },
        { k: 'pos', h: 'Pos', get: p => p.pos, sort: p => POS_ORDER.indexOf(p.pos), cls: 'c' },
        { k: 'ovr', h: 'OVR', get: p => <Ovr v={p.ovr} />, sort: p => p.ovr, cls: 'c' },
        { k: 'dev', h: 'Dev', get: p => <DevBadge d={p.dev} />, sort: p => ['Normal', 'Star', 'Superstar', 'X-Factor'].indexOf(p.dev) },
        { k: 'age', h: 'Age', get: p => Math.floor(p.age), sort: p => p.age, cls: 'c' },
        { k: 'exp', h: 'Exp', get: p => p.exp, sort: p => p.exp, cls: 'c' },
        { k: 'spd', h: 'SPD', get: p => p.attrs.SPD, sort: p => p.attrs.SPD, cls: 'c' },
        { k: 'cond', h: 'Cond', get: p => <span style={{ color: p.cond < 70 ? 'var(--warn)' : undefined }}>{Math.round(p.cond)}%</span>, sort: p => p.cond, cls: 'c' },
        { k: 'cap', h: 'Cap Hit', get: p => money(capHit(p.contract, L.season)), sort: p => capHit(p.contract, L.season), cls: 'r' },
        { k: 'yrs', h: 'Yrs', get: p => yearsLeft(p.contract, L.season), sort: p => yearsLeft(p.contract, L.season), cls: 'c' },
      ]} />
    </div>
  );
}

export function TeamScreen({ team }: { team: string }) {
  const L = useApp().league!;
  const t = L.teams[team];
  const r = teamRatings(L, team);
  const st = standings(L)[team];
  const stars = Object.values(L.players).filter(p => p.team === team && p.status === 'ACT').sort((a, b) => b.ovr - a.ovr).slice(0, 8);
  return (
    <div className="grid">
      <div className="card hero" style={{ background: `linear-gradient(120deg, ${t.colors[0]}, #0b1120 70%)` }}>
        <div className="row" style={{ position: 'relative' }}>
          <Logo team={t} size={130} />
          <div><div className="h1">{t.name}</div><div className="dim">{t.conf} {t.div} · {st.w}-{st.l}{st.t ? `-${st.t}` : ''} · HC {t.coach.name} ({t.coach.off} / {t.coach.def})</div>
            <div className="row" style={{ marginTop: 10 }}><span className="chip">OVR {r.ovr}</span><span className="chip">OFF {Math.round(r.off)}</span><span className="chip">DEF {Math.round(r.def)}</span><span className="chip">{t.mode === 'contend' ? 'Contending' : t.mode === 'rebuild' ? 'Rebuilding' : 'Balanced'}</span><span className="chip">Cap {money(capSpace(L, team))}</span></div></div>
          <div className="spacer" />
          {team !== L.user && <button className="btn primary" onClick={() => app.go({ id: 'trade', team })}>Propose Trade</button>}
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))' }}>
        {stars.map(p => <PlayerTile key={p.id} p={p} />)}
      </div>
      <RosterScreen team={team} />
    </div>
  );
}

export function PlayerTile({ p }: { p: Player }) {
  const L = useApp().league!;
  const t = L.teams[p.team];
  return (
    <Tilt max={12} style={{ cursor: 'pointer' }}>
      <div className="card" onClick={() => app.go({ id: 'player', pid: p.id })} style={{ padding: 12, background: t ? `linear-gradient(170deg, ${t.colors[0]}dd, #0b1120 75%)` : undefined, textAlign: 'center' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><Ovr v={p.ovr} /><span className="small dim">{p.pos} #{p.num}</span></div>
        <Face p={p} size={96} style={{ margin: '6px auto', border: '2px solid rgba(255,255,255,.15)' }} />
        <b>{p.fn} {p.ln}</b><div className="small dim">{p.arch}</div>
      </div>
    </Tilt>
  );
}

// ---- player card ---------------------------------------------------------------------------
export function PlayerScreen({ pid }: { pid: string }) {
  const L = useApp().league!;
  const p = L.players[pid];
  const [tab, setTab] = useState<'Ratings' | 'Stats' | 'Contract' | 'Bio'>('Ratings');
  const [modal, setModal] = useState<null | 'release' | 'extend'>(null);
  if (!p) return <div className="empty">Player not found.</div>;
  const t = L.teams[p.team];
  const mine = p.team === L.user;
  const prospect = p.status === 'PROSPECT';
  const sv = prospect ? scoutedView(p) : null;
  const color = t ? t.colors[0] : '#334155';
  const keyAttrs = (Object.entries(OVR_W[p.pos]) as [keyof Player['attrs'], number][]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  return (
    <div className="grid">
      <div className="card hero" style={{ background: `linear-gradient(115deg, ${color} 0%, #0b1120 62%)`, padding: 0 }}>
        <div className="grid" style={{ gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 24, padding: 24, position: 'relative' }}>
          <Tilt max={16}>
            <div style={{ width: 230, height: 300, borderRadius: 18, overflow: 'hidden', position: 'relative', background: `linear-gradient(180deg, ${vivid(color)}, #0b1120)`, border: '2px solid rgba(255,255,255,.18)', boxShadow: '0 25px 60px rgba(0,0,0,.6)' }}>
              <div style={{ position: 'absolute', right: -10, top: -20, font: '900 190px/1 var(--head)', color: 'rgba(255,255,255,.1)' }}>{p.num || ''}</div>
              <Face p={p} size={230} style={{ borderRadius: 0, background: 'transparent', position: 'absolute', bottom: 40, left: 0 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 12px', background: 'linear-gradient(0deg, rgba(0,0,0,.85), transparent)' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}><b className="h3">{p.ln.toUpperCase()}</b>{prospect ? <Grade g={draftGrade(p)} /> : <Ovr v={p.ovr} />}</div>
              </div>
              {t && <Logo team={t} size={44} style={{ position: 'absolute', left: 10, top: 10 }} />}{!t && p.colLogo && <img src={p.colLogo} width={44} height={44} alt="" style={{ position: 'absolute', left: 10, top: 10 }} />}
            </div>
          </Tilt>
          <div style={{ minWidth: 0 }}>
            <div className="up" style={{ color: 'var(--team2)' }}>{POS_NAME[p.pos]} · {p.arch}{t ? ` · ${t.name}` : p.status === 'FA' ? ' · Free Agent' : prospect ? ` · ${p.col} · Prospect #${p.proj}` : ''}</div>
            <div className="h1" style={{ margin: '6px 0' }}>{p.fn} {p.ln}</div>
            <div className="row" style={{ gap: 8 }}>
              {!prospect || sv?.dev ? <DevBadge d={p.dev} /> : <span className="dev Normal">Dev ?</span>}
              <span className="chip">#{p.num}</span><span className="chip">{Math.floor(p.age)} yrs</span><span className="chip">{Math.floor(p.ht / 12)}'{p.ht % 12}" · {p.wt} lb</span><span className="chip">{p.col}</span>
              {p.injury && <span className="chip" style={{ color: 'var(--bad)' }}>✚ {p.injury.type} ({p.injury.season ? 'season' : `${p.injury.weeks}w`})</span>}
            </div>
            <div className="row" style={{ marginTop: 16, gap: 24 }}>
              {prospect ? <div className="stat"><span className="k">Draft Grade</span><span className="v"><Grade g={draftGrade(p)} lg /></span></div> : <div className="stat"><span className="k">Overall</span><span className="v"><CountUp v={p.ovr} /></span></div>}
              <div className="stat"><span className="k">Potential</span><span className="v">{prospect ? (sv!.pot ? (sv!.pot >= 85 ? 'Elite' : sv!.pot >= 78 ? 'High' : 'Medium') : '?') : potentialLabel(p)}</span></div>
              {!prospect && <div className="stat"><span className="k">Condition</span><span className="v">{Math.round(p.cond)}%</span></div>}
              {!prospect && <div className="stat"><span className="k">Morale</span><span className="v">{Math.round(p.morale)}</span></div>}
              {!prospect && <div className="stat"><span className="k">Cap Hit</span><span className="v" style={{ fontSize: 22 }}>{money(capHit(p.contract, L.season))}</span></div>}
            </div>
            {(p.abil.length > 0 || p.xf) && (!prospect || (sv?.lvl ?? 0) >= 3) && (
              <div className="row" style={{ marginTop: 14 }}>
                {p.xf && <span className="chip" title={XFACTOR_DESC[p.xf]} style={{ background: 'linear-gradient(90deg,#7f1d1d,#b91c1c)', color: '#fff', borderColor: '#ef4444' }}>✸ {p.xf}</span>}
                {p.abil.map(a => <span key={a} className="chip" title={ABILITIES[a]?.desc} style={{ color: '#c4b5fd' }}>✦ {a}</span>)}
              </div>
            )}
            <div className="row" style={{ marginTop: 16 }}>
              {mine && !prospect && <>
                <button className="btn sm" onClick={() => setModal('extend')}>Extend</button>
                <button className="btn sm" onClick={() => { const saved = restructure(p, L.season); app.toast(saved > 0 ? `Restructured: ${money(saved)} cap space freed this year` : 'Nothing to restructure'); app.touch(); }}>Restructure</button>
                <button className="btn sm" onClick={() => { p.status = p.status === 'IR' ? 'ACT' : 'IR'; autoDepth(L, L.user); app.touch(); }}>{p.status === 'IR' ? 'Activate from IR' : 'Move to IR'}</button>
                {p.exp <= 3 && <button className="btn sm" onClick={() => { p.status = p.status === 'PS' ? 'ACT' : 'PS'; autoDepth(L, L.user); app.touch(); }}>{p.status === 'PS' ? 'Promote to Active' : 'Practice Squad'}</button>}
                <button className="btn sm danger" onClick={() => setModal('release')}>Release</button>
              </>}
              {!mine && t && <button className="btn sm primary" onClick={() => app.go({ id: 'trade', team: p.team, want: p.id })}>Trade for {p.ln}</button>}
              {p.status === 'FA' && <button className="btn sm primary" onClick={() => app.go({ id: 'fa' })}>Make Offer</button>}
            </div>
          </div>
          {t && p.num > 0 && <Tilt max={18}><div style={{ transform: 'translateZ(30px)' }}><Jersey team={t} num={p.num} name={p.ln} size={210} /></div></Tilt>}
        </div>
      </div>
      <Tabs tabs={['Ratings', 'Stats', 'Contract', 'Bio'] as const} on={tab} set={setTab} />
      {tab === 'Ratings' && (
        <div className="grid g4">
          {ATTR_GROUPS.map(([g, keys]) => (
            <div key={g} className="card">
              <h3>{g}</h3>
              {keys.map(k => {
                const v = p.attrs[k];
                const known = !prospect || (sv!.lvl >= 2 || (sv!.lvl >= 1 && keyAttrs.slice(0, 3).includes(k)));
                const shown = !known ? '??' : prospect && sv!.lvl < 3 ? `${Math.max(20, v - 4)}-${Math.min(99, v + 4)}` : String(v);
                return (
                  <div key={k} style={{ margin: '7px 0', opacity: keyAttrs.includes(k) ? 1 : 0.72 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">{ATTR_NAME[k]}{keyAttrs.includes(k) ? ' ★' : ''}</span><b className="num" style={{ color: known ? attrColor(v) : 'var(--mute)' }}>{shown}</b></div>
                    <Bar v={known ? v : 0} color={attrColor(v)} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {tab === 'Stats' && <StatsTable p={p} />}
      {tab === 'Contract' && <ContractTable p={p} />}
      {tab === 'Bio' && (
        <div className="grid g2">
          <div className="card"><h3>Profile</h3>
            {[['Drafted', p.draft.round ? `${p.draft.year} Round ${p.draft.round}, Pick ${p.draft.pick}${p.draft.team ? ` (${p.draft.team})` : ''}` : p.draft.year ? `${p.draft.year} Undrafted` : '—'], ['Experience', `${p.exp} season${p.exp === 1 ? '' : 's'}`], ['Motivations', p.motiv.join(', ')], ['Work Ethic', p.traits.work], ['Consistency', p.traits.cons], ['Clutch', p.traits.clutch]].map(([k, v]) => <div key={String(k)} className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}><span className="dim">{k}</span><b>{v}</b></div>)}
          </div>
          <div className="card"><h3>Combine</h3>
            {p.combine ? Object.entries({ '40-yd dash': `${p.combine.forty}s`, 'Bench press': `${p.combine.bench} reps`, 'Vertical': `${p.combine.vert}"`, 'Broad jump': `${p.combine.broad}"`, '3-cone': `${p.combine.cone}s`, 'Shuttle': `${p.combine.shuttle}s` }).map(([k, v]) => <div key={k} className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}><span className="dim">{k}</span><b>{v}</b></div>) : <div className="empty">No combine data.</div>}
            <h3 style={{ marginTop: 16 }}>Awards</h3>
            {p.awards.length ? p.awards.map(a => <div key={a} className="small">🏆 {a}</div>) : <div className="small mute">None yet.</div>}
          </div>
        </div>
      )}
      {modal === 'release' && <ReleaseModal p={p} close={() => setModal(null)} />}
      {modal === 'extend' && <NegotiationRoom p={p} close={() => { setModal(null); app.touch(); }} />}
    </div>
  );
}
function potentialLabel(p: Player) {
  const gap = p.pot - p.ovr;
  if (p.age >= 29 || gap <= 1) return 'Maxed';
  return gap >= 10 ? 'Elite' : gap >= 6 ? 'High' : gap >= 3 ? 'Medium' : 'Low';
}

const STAT_COLS: Record<string, [keyof StatLine, string][]> = {
  QB: [['gp', 'GP'], ['pc', 'CMP'], ['pa', 'ATT'], ['py', 'YDS'], ['ptd', 'TD'], ['pint', 'INT'], ['sk', 'SK'], ['ra', 'RUSH'], ['ry', 'RYDS'], ['rtd', 'RTD']],
  RB: [['gp', 'GP'], ['ra', 'ATT'], ['ry', 'YDS'], ['rtd', 'TD'], ['rlng', 'LNG'], ['rec', 'REC'], ['recy', 'RECYDS'], ['rectd', 'RECTD'], ['fuml', 'FUM']],
  WR: [['gp', 'GP'], ['tgt', 'TGT'], ['rec', 'REC'], ['recy', 'YDS'], ['rectd', 'TD'], ['reclng', 'LNG'], ['drop', 'DROP']],
  OL: [['gp', 'GP'], ['gs', 'GS'], ['pancake', 'PANCAKES'], ['sacka', 'SACKS ALLOWED']],
  DEF: [['gp', 'GP'], ['tkl', 'TKL'], ['tfl', 'TFL'], ['dsk', 'SACK'], ['qbh', 'QBH'], ['dint', 'INT'], ['pd', 'PD'], ['ff', 'FF'], ['fr', 'FR'], ['dtd', 'TD']],
  K: [['gp', 'GP'], ['fgm', 'FGM'], ['fga', 'FGA'], ['fglng', 'LNG'], ['xpm', 'XPM'], ['xpa', 'XPA']],
  P: [['gp', 'GP'], ['pun', 'PUNTS'], ['puny', 'YDS']],
};
export function statKind(pos: Pos) { return pos === 'QB' ? 'QB' : pos === 'RB' || pos === 'FB' ? 'RB' : pos === 'WR' || pos === 'TE' ? 'WR' : ['OT', 'G', 'C'].includes(pos) ? 'OL' : pos === 'K' ? 'K' : pos === 'P' ? 'P' : 'DEF'; }
function StatsTable({ p }: { p: Player }) {
  const cols = STAT_COLS[statKind(p.pos)];
  const seasons = Object.keys(p.stats).map(Number).sort((a, b) => b - a);
  const career = emptyLine();
  for (const s of seasons) for (const [k] of cols) (career[k] as number) += p.stats[s][k] as number;
  if (!seasons.length) return <div className="card empty">No NFL stats in this save yet. Real 2023–25 production fed this player's ratings.</div>;
  return (
    <div className="card"><div className="scroll"><table className="tbl"><thead><tr><th>Season</th>{cols.map(([, h]) => <th key={h} className="r">{h}</th>)}</tr></thead>
      <tbody>{seasons.map(s => <tr key={s}><td>{s}</td>{cols.map(([k]) => <td key={k} className="r num">{p.stats[s][k]}</td>)}</tr>)}
        <tr><td><b>Career</b></td>{cols.map(([k]) => <td key={k} className="r num"><b>{career[k]}</b></td>)}</tr></tbody></table></div></div>
  );
}
function ContractTable({ p }: { p: Player }) {
  const L = useApp().league!;
  const c = p.contract;
  if (!c.years.length) return <div className="card empty">No contract. Market value about {money(marketValue(p, L.season))} a year.</div>;
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>{c.rookie && <span className="chip">Rookie deal{c.option ? ' · 5th-year option available' : ''}</span>}{c.tag && <span className="chip">Franchise tag</span>}<span className="chip">Market value {money(marketValue(p, L.season))}/yr</span></div>
      <table className="tbl"><thead><tr><th>Season</th><th className="r">Base</th><th className="r">Prorated Bonus</th><th className="r">Guaranteed</th><th className="r">Cap Hit</th><th className="r">Dead if cut</th><th className="r">Savings if cut</th></tr></thead>
        <tbody>{c.years.map(y => <tr key={y.s}><td>{y.s}{y.v ? ' (void)' : ''}</td><td className="r">{money(y.base)}</td><td className="r">{money(y.bonus)}</td><td className="r">{money(y.gtd)}</td><td className="r"><b>{money(y.base + y.bonus)}</b></td><td className="r bad">{y.s >= L.season ? money(deadMoney(c, y.s).now) : ''}</td><td className="r good">{y.s >= L.season && !y.v ? money(releaseSavings(c, y.s)) : ''}</td></tr>)}</tbody></table>
    </div>
  );
}
function ReleaseModal({ p, close }: { p: Player; close: () => void }) {
  const L = useApp().league!;
  const pre = deadMoney(p.contract, L.season), post = deadMoney(p.contract, L.season, true);
  const go = (june: boolean) => { release(L, p, june); autoDepth(L, L.user); app.toast(`${p.fn} ${p.ln} released`); close(); app.backTo(); app.touch(); };
  return (
    <Modal onClose={close}>
      <div className="h2">Release {p.fn} {p.ln}?</div>
      <div className="grid g2" style={{ margin: '16px 0' }}>
        <div className="card"><h3>Standard</h3><div>Dead money now: <b className="bad">{money(pre.now)}</b></div><div>Cap savings: <b className="good">{money(releaseSavings(p.contract, L.season))}</b></div><button className="btn danger" style={{ marginTop: 12 }} onClick={() => go(false)}>Release</button></div>
        <div className="card"><h3>Post-June 1</h3><div>Dead this year: <b className="bad">{money(post.now)}</b></div><div>Dead next year: <b className="bad">{money(post.next)}</b></div><div>Cap savings: <b className="good">{money(releaseSavings(p.contract, L.season, true))}</b></div><button className="btn danger" style={{ marginTop: 12 }} onClick={() => go(true)}>Release (June 1)</button></div>
      </div>
      <button className="btn ghost" onClick={close}>Cancel</button>
    </Modal>
  );
}
