import { useState } from 'react';
import { useWorld, mutate } from '../store';
import { go } from '../nav';
import { Face, Ovr, Flag } from '../art';
import { Panel } from '../bits';
import { FORMATIONS, ROLES, ROLE_INFO, autoPick, slotRating, slotsOf, teamRatings, available, bestFormation } from '../../core/tactics';
import type { Club, Player, Tactic, World } from '../../core/types';
import { tick } from '../sfx';

export function Tactics() {
  const w = useWorld();
  const u = w.clubs[w.user];
  const t = u.tactic;
  const [sel, setSel] = useState<{ kind: 'slot' | 'bench' | 'res'; id: number; slot?: number } | null>(null);
  const slots = slotsOf(t);
  const r = teamRatings(w, u);
  const xi = new Set(t.lineup);
  const reserves = u.squad.filter(id => !xi.has(id) && !t.bench.includes(id)).map(id => w.players[id]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const swap = (a: { kind: string; id: number; slot?: number }, b: { kind: string; id: number; slot?: number }) => {
    mutate(x => {
      const tt = x.clubs[x.user].tactic;
      const put = (s: { kind: string; id: number; slot?: number }, id: number) => {
        if (s.kind === 'slot') tt.lineup[s.slot!] = id;
        else if (s.kind === 'bench') { const i = tt.bench.indexOf(s.id); if (i >= 0) tt.bench[i] = id; else tt.bench.push(id); }
      };
      put(a, b.id); put(b, a.id);
      tt.bench = tt.bench.filter((id, i, arr) => id >= 0 && arr.indexOf(id) === i && !tt.lineup.includes(id));
      if (tt.bench.length > 9) tt.bench.length = 9;
    });
  };
  const click = (s: { kind: 'slot' | 'bench' | 'res'; id: number; slot?: number }) => {
    tick();
    if (!sel) { setSel(s); return; }
    if (sel.kind === s.kind && sel.id === s.id && sel.slot === s.slot) { setSel(null); return; }
    if (sel.kind === 'res' && s.kind === 'res') { setSel(s); return; }
    swap(sel, s); setSel(null);
  };
  const setT = (f: (t: Tactic) => void) => mutate(x => f(x.clubs[x.user].tactic));
  return (
    <div className="tactics">
      <div className="page-h">
        <h1>Tactics</h1>
        <div className="page-stats"><div><span>ATT</span><b>{r.att}</b></div><div><span>MID</span><b>{r.mid}</b></div><div><span>DEF</span><b>{r.def}</b></div><div><span>Team</span><b>{r.ovr}</b></div></div>
      </div>
      <div className="tac-grid">
        <div className="tac-pitch-wrap">
          <div className="tac-tools">
            <select value={t.formation} onChange={e => mutate(x => { const tt = x.clubs[x.user].tactic; tt.formation = e.target.value; tt.roles = FORMATIONS[e.target.value].map(s => ROLES[s[0]]![0]); autoPick(x, x.clubs[x.user]); })}>
              {Object.keys(FORMATIONS).map(f => <option key={f}>{f}</option>)}
            </select>
            <button className="btn" onClick={() => mutate(x => autoPick(x, x.clubs[x.user]))}>Auto pick XI</button>
            <button className="btn" onClick={() => mutate(x => { const c = x.clubs[x.user]; c.tactic.formation = bestFormation(x, c); c.tactic.roles = []; autoPick(x, c); })}>Suggest formation</button>
            <span className="muted sm">Click two players to swap them.</span>
          </div>
          <div className="tac-pitch">
            <div className="pitch-lines"><i className="half" /><i className="circle" /><i className="box top" /><i className="box bot" /><i className="six top" /><i className="six bot" /></div>
            {slots.map((s, i) => {
              const p = w.players[t.lineup[i]];
              const on = sel?.kind === 'slot' && sel.slot === i;
              const fit = p ? slotRating(p, s[0]) : 0;
              return (
                <div key={i} className={`tac-slot ${on ? 'sel' : ''} ${p && p.pos !== s[0] && !p.alt.includes(s[0]) ? 'oop' : ''}`} style={{ left: `${s[2] * 100}%`, top: `${(1 - s[1]) * 92 + 2}%` }} onClick={() => click({ kind: 'slot', id: p?.id ?? -1, slot: i })}>
                  {p ? <>
                    <div className="ts-face"><Face p={p} club={u} size={46} /></div>
                    <div className="ts-ovr"><Ovr v={Math.round(fit)} small /></div>
                    <b>{p.name.split(' ').slice(-1)[0]}</b>
                    <span className="ts-pos">{s[0]} · {t.roles[i]}</span>
                    {(p.inj || p.ban > 0) && <span className="tag red">{p.inj ? 'INJ' : 'BAN'}</span>}
                    {p.fitness < 75 && <span className="ts-fit" style={{ width: `${p.fitness}%` }} />}
                  </> : <b className="muted">{s[0]}</b>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="tac-side">
          <Panel title="Substitutes">
            <PlayerList w={w} c={u} ids={t.bench} kind="bench" sel={sel} onClick={click} />
          </Panel>
          <Panel title="Reserves">
            <PlayerList w={w} c={u} ids={reserves.map(p => p.id)} kind="res" sel={sel} onClick={click} />
          </Panel>
        </div>
      </div>
      <div className="tac-grid2">
        <Panel title="Player roles">
          <div className="roles">
            {slots.map((s, i) => {
              const p = w.players[t.lineup[i]];
              return (
                <div key={i} className="role-row">
                  <span className="pos-chip">{s[0]}</span><span className="rr-name">{p?.name ?? '—'}</span>
                  <select value={t.roles[i]} onChange={e => setT(tt => { tt.roles[i] = e.target.value; })}>{ROLES[s[0]]!.map(r => <option key={r}>{r}</option>)}</select>
                  <span className="muted sm rr-info">{ROLE_INFO[t.roles[i]]}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Team instructions">
          <Instructions t={t} set={setT} />
        </Panel>
        <Panel title="Set pieces & captain">
          <div className="setp">
            {([['captain', 'Captain'], ['pens', 'Penalties'], ['fks', 'Free kicks'], ['corners', 'Corners']] as const).map(([k, l]) => (
              <label key={k}>{l}<select value={t[k] ?? ''} onChange={e => setT(tt => { tt[k] = +e.target.value; })}>
                {t.lineup.map(id => w.players[id]).filter(Boolean).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function Instructions({ t, set, compact }: { t: Tactic; set: (f: (t: Tactic) => void) => void; compact?: boolean }) {
  const M = ['Ultra defensive', 'Defensive', 'Balanced', 'Attacking', 'All-out attack'];
  return (
    <div className={`instr ${compact ? 'compact' : ''}`}>
      <div className="mentality">{M.map((m, i) => <button key={m} className={t.mentality === i - 2 ? 'on' : ''} onClick={() => set(tt => { tt.mentality = (i - 2) as Tactic['mentality']; })}>{m}</button>)}</div>
      {([['pressing', 'Pressing', 'Stand off', 'Gegenpress'], ['line', 'Defensive line', 'Deep', 'High'], ['width', 'Width', 'Narrow', 'Wide'], ['tempo', 'Tempo', 'Patient', 'Fast'], ['directness', 'Passing', 'Short', 'Direct']] as const).map(([k, l, lo, hi]) => (
        <label key={k} className="slider">
          <span>{l}</span>
          <input type="range" min={0} max={100} value={t[k]} onChange={e => set(tt => { tt[k] = +e.target.value; })} />
          <em>{t[k] < 35 ? lo : t[k] > 65 ? hi : 'Balanced'}</em>
        </label>
      ))}
      <div className="toggles">
        <label><input type="checkbox" checked={t.counter} onChange={e => set(tt => { tt.counter = e.target.checked; })} /> Counter-attack</label>
        <label><input type="checkbox" checked={t.offside} onChange={e => set(tt => { tt.offside = e.target.checked; })} /> Offside trap</label>
        <label><input type="checkbox" checked={t.timeWaste} onChange={e => set(tt => { tt.timeWaste = e.target.checked; })} /> Waste time</label>
      </div>
    </div>
  );
}

function PlayerList({ w, c, ids, kind, sel, onClick }: { w: World; c: Club; ids: number[]; kind: 'bench' | 'res'; sel: { kind: string; id: number } | null; onClick: (s: { kind: 'bench' | 'res'; id: number }) => void }) {
  return (
    <div className="plist">
      {ids.map(id => w.players[id]).filter(Boolean).map((p: Player) => (
        <div key={p.id} className={`pl-row ${sel?.kind === kind && sel.id === p.id ? 'sel' : ''} ${!available(p) ? 'unavail' : ''}`} onClick={() => onClick({ kind, id: p.id })} onDoubleClick={() => go({ s: 'player', id: p.id })}>
          <Ovr v={p.ovr} small /><span className="pos-chip">{p.pos}</span><Flag nat={p.nat} h={11} /><span className="pl-name">{p.name}</span>
          <span className="pl-fit" title="Fitness"><i style={{ width: `${p.fitness}%` }} /></span>
          {p.inj && <span className="tag red">INJ</span>}{p.ban > 0 && <span className="tag yel">BAN</span>}
        </div>
      ))}
      {!ids.length && <p className="muted sm">None</p>}
    </div>
  );
}
void (null as unknown as Club);
