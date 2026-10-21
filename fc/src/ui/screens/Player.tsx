import { useState } from 'react';
import { useWorld, mutate } from '../store';
import { go, back, toast } from '../nav';
import { Crest, Face, Flag, Ovr, PlayerCard, Stars, Bar, Kit, kitFor } from '../art';
import { Panel, Modal, ClubName } from '../bits';
import { potRange } from './Squad';
import { A, ATTRS, GROUPS, type Player, type World } from '../../core/types';
import { ageOf, marketValue, posOvr, ALL_POS, faceStats } from '../../core/player';
import { askingPrice, completeTransfer, contractDemand, evaluateBid, fmtMoney, interest, negotiate, releasePlayer, windowOpen, type Demand } from '../../core/transfers';
import { natName } from '../../data/nations';
import { news } from '../../core/season';
import { SigningCine } from '../cine';
import { roundMoney } from '../../core/player';

export function PlayerScreen({ id }: { id: number }) {
  const w = useWorld();
  const p = w.players[id];
  const [modal, setModal] = useState<null | 'bid' | 'loan' | 'renew' | 'release' | 'sign'>(null);
  const [cine, setCine] = useState<{ fee: number; loan?: boolean } | null>(null);
  if (!p) return <Panel><p>This player has retired.</p><button onClick={back}>Back</button></Panel>;
  const club = p.club ? w.clubs[p.club] : undefined;
  const mine = p.club === w.user;
  const u = w.clubs[w.user];
  const age = ageOf(p, w.season);
  const val = marketValue(p, w.season);
  const shortlisted = w.shortlist.includes(p.id);
  const fs = faceStats(p);
  return (
    <div className="player-page">
      <div className="pp-hero" style={{ ['--c1' as string]: club?.c1 ?? '#334', ['--c2' as string]: club?.c2 ?? '#889' }}>
        <div className="pp-bg">{club && <Crest club={club} size={380} className="pp-bgcrest" />}</div>
        <button className="btn-ghost pp-back" onClick={back}>← Back</button>
        <div className="pp-card"><PlayerCard p={p} club={club} size={1.15} /></div>
        <div className="pp-info">
          <div className="pp-num">{p.num}</div>
          <h1>{p.name}</h1>
          <div className="pp-sub">
            {club ? <ClubName c={club} /> : <span className="tag">Free agent</span>}
            <span><Flag nat={p.nat} h={14} /> {natName(p.nat)}</span>
            <span>{age} yrs</span><span>{p.height} cm</span><span>{p.foot === 'R' ? 'Right' : 'Left'} foot</span>
          </div>
          <div className="pp-facts">
            <div><span>Position</span><b>{p.pos}{p.alt.length ? <small> · {p.alt.join(', ')}</small> : null}</b></div>
            <div><span>Potential</span><b>{potRange(w, p)}</b></div>
            <div><span>Value</span><b>{fmtMoney(val)}</b></div>
            <div><span>Wage</span><b>{fmtMoney(p.wage)}/wk</b></div>
            <div><span>Contract</span><b>{p.club ? `June ${p.contract + 1}` : '—'}</b></div>
            <div><span>Weak foot</span><b><Stars n={p.wf} /></b></div>
            <div><span>Skill moves</span><b><Stars n={p.sm} /></b></div>
            <div><span>Form</span><b className={p.form >= 7.2 ? 'pos' : p.form < 6.3 ? 'neg' : ''}>{p.form.toFixed(2)}</b></div>
          </div>
          {p.traits.length > 0 && <div className="traits">{p.traits.map(t => <span key={t} className="trait">{t}</span>)}</div>}
          <div className="pp-actions">
            {mine ? (
              <>
                <button className="btn" onClick={() => setModal('renew')}>Renew contract</button>
                <button className="btn" onClick={() => mutate(x => { x.players[id].listed = !x.players[id].listed; })}>{p.listed ? 'Remove from list' : 'Transfer list'}</button>
                <select className="btn" value={p.devFocus ?? ''} onChange={e => mutate(x => { x.players[id].devFocus = (e.target.value || undefined) as Player['devFocus']; })}>
                  <option value="">Development: balanced</option>
                  {Object.keys(GROUPS).map(g => <option key={g} value={g}>Focus: {g}</option>)}
                </select>
                <button className="btn danger" onClick={() => setModal('release')}>Release</button>
              </>
            ) : (
              <>
                <button className="btn primary" disabled={!windowOpen(w) && !!p.club} onClick={() => setModal(p.club ? 'bid' : 'sign')}>{p.club ? 'Make offer' : 'Offer contract'}</button>
                {p.club && <button className="btn" disabled={!windowOpen(w)} onClick={() => setModal('loan')}>Loan offer</button>}
                <button className="btn" onClick={() => mutate(x => { x.shortlist = shortlisted ? x.shortlist.filter(s => s !== id) : [...x.shortlist, id]; })}>{shortlisted ? '★ Shortlisted' : '☆ Shortlist'}</button>
                {!p.scouted && <button className="btn" onClick={() => { if (u.balance < 50000) return; mutate(x => { x.players[id].scouted = true; x.clubs[x.user].balance -= 50000; }); toast(`Scout report on ${p.name} complete (€50K)`, 'good'); }}>Scout (€50K)</button>}
                {!windowOpen(w) && p.club && <span className="muted sm">Transfer window closed</span>}
              </>
            )}
          </div>
        </div>
        <div className="pp-kit">{club && <Kit {...kitFor(club)} num={p.num} name={p.name.split(' ').slice(-1)[0]} size={150} />}</div>
      </div>

      <div className="pp-grid">
        <Panel title="Attributes">
          <div className="attr-groups">
            {(p.pos === 'GK' ? (['GK', 'PAC', 'PAS', 'PHY'] as const) : (['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const)).map(g => {
              const idx = g === 'GK' ? [29, 30, 31, 32, 33, A.rea] : GROUPS[g];
              const tot = fs.find(f => f[0] === g)?.[1] ?? Math.round(idx.reduce((s, i) => s + p.attrs[i], 0) / idx.length);
              return (
                <div key={g} className="ag">
                  <h4>{g === 'GK' ? 'Goalkeeping' : g}<b>{Math.round(tot)}</b></h4>
                  {idx.map(i => <div key={i} className="attr"><span>{ATTRS[i]}</span><Bar v={p.attrs[i]} /><b className={attrCls(p.attrs[i])}>{Math.round(p.attrs[i])}</b></div>)}
                </div>
              );
            })}
          </div>
        </Panel>
        <div className="pp-side">
          <Panel title="Positions">
            <PosMap p={p} />
          </Panel>
          <Panel title={`${w.season}/${String(w.season + 1).slice(2)} season`}>
            <div className="sstats">
              <div><b>{p.s.apps}</b><span>Apps</span></div><div><b>{p.s.goals}</b><span>Goals</span></div><div><b>{p.s.assists}</b><span>Assists</span></div>
              <div><b>{p.s.apps ? (p.s.ratingSum / p.s.apps).toFixed(2) : '-'}</b><span>Avg rating</span></div>
              {p.pos === 'GK' ? <div><b>{p.s.cleanSheets}</b><span>Clean sheets</span></div> : <div><b>{p.s.xg.toFixed(1)}</b><span>xG</span></div>}
              <div><b>{p.s.motm}</b><span>MotM</span></div>
            </div>
            <div className="comp-split">{Object.entries(p.cs).map(([c, v]) => <div key={c}><span>{w.comps[c]?.short ?? c}</span><b>{v[0]} apps · {v[1]} G · {v[2]} A</b></div>)}</div>
          </Panel>
          <Panel title="Market value">
            <Spark vals={[...p.valueHist, val]} />
            {!mine && p.club && <p className="muted sm">Asking price around <b>{fmtMoney(askingPrice(w, p))}</b>. {interest(w, p, u).reason}.</p>}
          </Panel>
        </div>
      </div>
      {p.career.length > 0 && (
        <Panel title="Career">
          <table className="tbl"><thead><tr><th>Season</th><th>Club</th><th>Apps</th><th>Goals</th><th>Assists</th><th>Avg</th><th>OVR</th></tr></thead>
            <tbody>{[...p.career].reverse().map((c, i) => <tr key={i}><td>{c.season}/{String(c.season + 1).slice(2)}</td><td>{w.clubs[c.club] ? <ClubName c={w.clubs[c.club]} /> : c.club}</td><td>{c.apps}</td><td>{c.goals}</td><td>{c.assists}</td><td>{c.rating.toFixed(2)}</td><td>{c.ovr}</td></tr>)}</tbody></table>
        </Panel>
      )}
      {modal === 'bid' && <BidModal w={w} p={p} onClose={() => setModal(null)} onSigned={fee => { setModal(null); setCine({ fee }); }} />}
      {modal === 'loan' && <BidModal w={w} p={p} loan onClose={() => setModal(null)} onSigned={fee => { setModal(null); setCine({ fee, loan: true }); }} />}
      {modal === 'sign' && <ContractModal w={w} p={p} fee={0} onClose={() => setModal(null)} onDone={() => { setModal(null); setCine({ fee: 0 }); }} />}
      {modal === 'renew' && <ContractModal w={w} p={p} fee={0} renew onClose={() => setModal(null)} onDone={() => setModal(null)} />}
      {modal === 'release' && (
        <Modal title={`Release ${p.name}?`} onClose={() => setModal(null)}>
          <p>Terminating his contract costs half of his remaining wages: <b>{fmtMoney(p.wage * 52 * Math.max(0, p.contract - w.season) * 0.5)}</b>.</p>
          <div className="modal-actions"><button className="btn" onClick={() => setModal(null)}>Cancel</button><button className="btn danger" onClick={() => { mutate(x => { releasePlayer(x, x.players[id]); }); setModal(null); go({ s: 'squad' }); }}>Release</button></div>
        </Modal>
      )}
      {cine && <SigningCine p={p} club={u} fee={cine.fee} loan={cine.loan} onDone={() => setCine(null)} />}
    </div>
  );
}
const attrCls = (v: number) => v >= 85 ? 'a-elite' : v >= 75 ? 'a-good' : v >= 65 ? 'a-ok' : v >= 50 ? 'a-avg' : 'a-low';

function PosMap({ p }: { p: Player }) {
  const spots: [string, number, number][] = [['ST', 50, 12], ['LW', 16, 18], ['RW', 84, 18], ['CAM', 50, 32], ['LM', 14, 44], ['CM', 50, 48], ['RM', 86, 44], ['CDM', 50, 62], ['LB', 14, 74], ['CB', 50, 80], ['RB', 86, 74], ['GK', 50, 94]];
  return (
    <div className="posmap">
      <div className="pm-pitch" />
      {spots.map(([pos, x, y]) => {
        const v = pos === 'GK' && p.pos !== 'GK' ? 25 : p.pos === 'GK' && pos !== 'GK' ? 30 : posOvr(p.attrs, pos as Player['pos']);
        const native = p.pos === pos, alt = p.alt.includes(pos as Player['pos']);
        return <div key={pos} className={`pm-spot ${native ? 'native' : alt ? 'alt' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}><b>{v}</b><span>{pos}</span></div>;
      })}
    </div>
  );
}
void ALL_POS;

function Spark({ vals }: { vals: number[] }) {
  if (vals.length < 2) vals = [vals[0], vals[0]];
  const max = Math.max(...vals), min = Math.min(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 300},${70 - ((v - min) / Math.max(1, max - min)) * 60}`).join(' ');
  return (
    <svg viewBox="0 0 300 80" className="spark"><polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
      <text x="0" y="78" className="sp-l">{fmtMoney(vals[0])}</text><text x="300" y="12" textAnchor="end" className="sp-l">{fmtMoney(vals[vals.length - 1])}</text></svg>
  );
}

// ---- negotiation --------------------------------------------------------------------------
function BidModal({ w, p, loan, onClose, onSigned }: { w: World; p: Player; loan?: boolean; onClose: () => void; onSigned: (fee: number) => void }) {
  const u = w.clubs[w.user];
  const ask = askingPrice(w, p);
  const [fee, setFee] = useState(loan ? 0 : roundMoney(ask * 0.85));
  const [msg, setMsg] = useState<string>('');
  const [agreed, setAgreed] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const it = interest(w, p, u);
  const submit = () => {
    if (!loan && fee > u.budget) { setMsg(`You only have ${fmtMoney(u.budget)} to spend.`); return; }
    const r = evaluateBid(w, p, fee, u, loan);
    setTries(t => t + 1);
    if (r.status === 'accepted') { setAgreed(fee); setMsg(`${r.reason}. Now agree personal terms.`); }
    else if (r.status === 'countered') { setMsg(`${r.reason} They would accept ${fmtMoney(r.counter!)}.`); setFee(r.counter!); }
    else setMsg(r.reason);
    if (tries >= 3 && r.status !== 'accepted') { setMsg(`${w.clubs[p.club!].name} have ended negotiations for now.`); }
  };
  if (agreed !== null) return <ContractModal w={w} p={p} fee={agreed} loan={loan} onClose={onClose} onDone={() => onSigned(agreed)} />;
  return (
    <Modal title={loan ? `Loan offer for ${p.name}` : `Transfer offer for ${p.name}`} onClose={onClose}>
      <div className="neg">
        <div className="neg-head"><Face p={p} club={w.clubs[p.club!]} size={70} /><div><b>{p.name}</b><span>{w.clubs[p.club!].name} · valued {fmtMoney(marketValue(p, w.season))}</span><span className={it.ok ? 'pos' : 'neg'}>Player: {it.reason}</span></div></div>
        {!loan && (
          <div className="fee-input">
            <button onClick={() => setFee(f => Math.max(0, roundMoney(f - Math.max(250000, f * 0.05))))}>−</button>
            <input value={fmtMoney(fee)} readOnly />
            <button onClick={() => setFee(f => roundMoney(f + Math.max(250000, f * 0.05)))}>+</button>
          </div>
        )}
        {!loan && <input type="range" min={0} max={Math.max(ask * 2, 1e6)} step={Math.max(100000, Math.round(ask / 200))} value={fee} onChange={e => setFee(roundMoney(+e.target.value))} />}
        {loan && <p>Season-long loan. You pay his full wages ({fmtMoney(p.wage)}/wk).</p>}
        <div className="kv"><div><span>Your budget</span><b>{fmtMoney(u.budget)}</b></div>{p.release ? <div><span>Release clause</span><b>{fmtMoney(p.release)}</b></div> : null}</div>
        {msg && <div className="neg-msg">{msg}</div>}
        <div className="modal-actions"><button className="btn" onClick={onClose}>Walk away</button><button className="btn primary" disabled={!it.ok || tries > 3} onClick={submit}>Submit offer</button></div>
        {!it.ok && <p className="neg sm">{p.name} is not interested in joining {u.name}.</p>}
      </div>
    </Modal>
  );
}

function ContractModal({ w, p, fee, loan, renew, onClose, onDone }: { w: World; p: Player; fee: number; loan?: boolean; renew?: boolean; onClose: () => void; onDone: () => void }) {
  const u = w.clubs[w.user];
  const [role, setRole] = useState<Player['role']>(p.role ?? (p.ovr >= 80 ? 'First' : 'Rotation'));
  const demand: Demand = contractDemand(w, p, u, role);
  const [wage, setWage] = useState(Math.round(demand.wage * 0.9 / 500) * 500);
  const [years, setYears] = useState(demand.years);
  const [bonus, setBonus] = useState(demand.bonus);
  const [clause, setClause] = useState<number>(0);
  const [patience, setPatience] = useState(4);
  const [msg, setMsg] = useState(renew ? `${p.name}'s agent wants around ${fmtMoney(demand.wage)} a week.` : `Fee agreed${fee ? ` at ${fmtMoney(fee)}` : ''}. His agent asks for ${fmtMoney(demand.wage)} a week as a ${role} player.`);
  const wageRoom = u.wageBudget - u.squad.reduce((s, id) => s + (w.players[id]?.wage ?? 0), 0) + (renew ? p.wage : 0);
  const submit = () => {
    if (loan) {
      mutate(x => { completeTransfer(x, x.players[p.id], x.clubs[x.user], 0, undefined, undefined, true); news(x, 'transfer', `${p.name} joins on loan`, `${p.name} arrives on a season-long loan from ${w.clubs[p.club!].name}.`, { pid: p.id }); });
      onDone(); return;
    }
    if (wage > wageRoom * 1.02 && !renew) { setMsg(`That would break the wage budget (room: ${fmtMoney(wageRoom)}/wk).`); return; }
    const r = negotiate(w, p, u, { wage, years, role, bonus }, demand);
    if (r.accept) {
      mutate(x => {
        const pl = x.players[p.id];
        if (renew) { pl.wage = wage; pl.contract = x.season + years; pl.role = role; pl.morale = Math.min(100, pl.morale + 8); x.clubs[x.user].balance -= bonus; news(x, 'contract', `${pl.name} signs a new deal`, `${pl.name} commits his future until June ${pl.contract + 1} on ${fmtMoney(wage)}/wk.`, { pid: pl.id }); }
        else {
          const from = pl.club ? x.clubs[pl.club].name : 'free agency';
          completeTransfer(x, pl, x.clubs[x.user], fee, wage, years, false, role);
          x.clubs[x.user].balance -= bonus;
          news(x, 'transfer', `Here we go! ${pl.name} signs`, `${pl.name} joins from ${from}${fee ? ` for ${fmtMoney(fee)}` : ' on a free transfer'}, signing until June ${pl.contract + 1}.`, { pid: pl.id });
        }
        if (clause > 0) x.players[p.id].release = clause;
      });
      onDone();
      return;
    }
    const left = patience + r.patience;
    setPatience(left);
    setMsg(left <= 0 ? 'The agent has walked out of talks.' : r.text);
  };
  return (
    <Modal title={renew ? `Contract talks: ${p.name}` : loan ? `Loan terms: ${p.name}` : `Personal terms: ${p.name}`} onClose={onClose}>
      <div className="neg">
        <div className="neg-head"><Face p={p} club={p.club ? w.clubs[p.club] : undefined} size={70} /><div><b>{p.name}</b><span>Demand: {fmtMoney(demand.wage)}/wk · {demand.years} yrs</span><span>Agent patience: {'●'.repeat(Math.max(0, patience))}{'○'.repeat(Math.max(0, 4 - patience))}</span></div></div>
        {!loan && <>
          <label>Squad role<select value={role} onChange={e => setRole(e.target.value as Player['role'])}>{['Key', 'First', 'Rotation', 'Prospect', 'Backup'].map(r => <option key={r}>{r}</option>)}</select></label>
          <label>Weekly wage <b>{fmtMoney(wage)}</b><input type="range" min={Math.round(demand.wage * 0.5)} max={Math.round(demand.wage * 1.6)} step={500} value={wage} onChange={e => setWage(+e.target.value)} /></label>
          <label>Contract length <b>{years} year{years > 1 ? 's' : ''}</b><input type="range" min={1} max={5} value={years} onChange={e => setYears(+e.target.value)} /></label>
          <label>Signing bonus <b>{fmtMoney(bonus)}</b><input type="range" min={0} max={demand.bonus * 3} step={Math.max(10000, Math.round(demand.bonus / 30))} value={bonus} onChange={e => setBonus(+e.target.value)} /></label>
          <label>Release clause <b>{clause ? fmtMoney(clause) : 'None'}</b><input type="range" min={0} max={Math.round(marketValue(p, w.season) * 4)} step={1e6} value={clause} onChange={e => setClause(+e.target.value)} /></label>
          <p className="muted sm">Wage room: {fmtMoney(wageRoom)}/wk. A release clause makes the deal more attractive but lets rivals trigger it.</p>
        </>}
        <div className="neg-msg">{msg}</div>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={patience <= 0} onClick={submit}>{loan ? 'Complete loan' : 'Offer contract'}</button></div>
      </div>
    </Modal>
  );
}
void Ovr;
