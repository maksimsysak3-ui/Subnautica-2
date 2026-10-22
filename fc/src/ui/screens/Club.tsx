import { useWorld, mutate } from '../store';
import { go, toast } from '../nav';
import { Crest, Kit, kitFor, Stars, Ovr, Flag, TrophySvg } from '../art';
import { Panel } from '../bits';
import { teamRatings } from '../../core/tactics';
import { fmtMoney } from '../../core/transfers';
import { ageOf, marketValue } from '../../core/player';
import { table, ord } from '../../core/season';
import { shadeHex } from '../App';

export function ClubScreen({ id }: { id: string }) {
  const w = useWorld();
  const c = w.clubs[id];
  const mine = id === w.user;
  const r = teamRatings(w, c);
  const squad = c.squad.map(i => w.players[i]).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const pos = w.comps[c.league] ? table(w, c.league).findIndex(x => x.id === id) + 1 : 0;
  const trophies = c.trophies.reduce<Record<string, number>>((m, t) => { m[t.name] = (m[t.name] ?? 0) + 1; return m; }, {});
  const value = squad.reduce((s, p) => s + marketValue(p, w.season), 0);
  const f = c.fin;
  const income = f.tv + f.gate + f.prize + f.merch + f.transfersOut;
  const spend = f.wages + f.transfersIn;
  const upgrade = (k: 'facilities' | 'youth') => {
    const lvl = c[k];
    const cost = 4e6 * lvl * lvl;
    if (lvl >= 10) return toast('Already world class', 'info');
    if (c.balance < cost) return toast(`Need ${fmtMoney(cost)} in the bank`, 'bad');
    mutate(x => { x.clubs[id][k]++; x.clubs[id].balance -= cost; });
    toast(`${k === 'youth' ? 'Academy' : 'Training ground'} upgraded`, 'good');
  };
  return (
    <div className="club-page">
      <div className="club-hero" style={{ background: `linear-gradient(120deg, ${c.c1} 0%, ${c.c2 === '#FFFFFF' || c.c2 === c.c1 ? shadeHex(c.c1) : c.c2} 120%)` }}>
        <Crest club={c} size={150} />
        <div className="ch-info">
          <h1>{c.name}</h1>
          <span>{c.stadium} · capacity {c.cap.toLocaleString()}</span>
          <div className="ch-facts">
            <div><span>League</span><b>{w.comps[c.league]?.name ?? (c.tier === 2 ? 'Second tier' : 'Rest of world')}{pos ? ` · ${pos}${ord(pos)}` : ''}</b></div>
            <div><span>Prestige</span><b><Stars n={Math.max(1, Math.min(5, Math.round((c.rep - 50) / 9)))} /></b></div>
            <div><span>Team OVR</span><b>{r.ovr}</b></div>
            <div><span>Squad value</span><b>{fmtMoney(value)}</b></div>
          </div>
        </div>
        <div className="ch-kits"><Kit {...kitFor(c)} size={110} num={10} /><Kit {...kitFor(c, true)} size={90} num={10} /></div>
      </div>
      <div className="club-grid">
        <Panel title="Squad">
          <div className="plist">
            {squad.map(p => (
              <div key={p.id} className="pl-row" onClick={() => go({ s: 'player', id: p.id })}>
                <Ovr v={p.ovr} small /><span className="pos-chip">{p.pos}</span><Flag nat={p.nat} h={11} /><span className="pl-name">{p.name}</span><span className="muted sm">{ageOf(p, w.season)}</span><span className="pl-x">{fmtMoney(marketValue(p, w.season))}</span>
              </div>
            ))}
          </div>
        </Panel>
        <div>
          <Panel title="Trophy cabinet">
            {Object.keys(trophies).length ? <div className="cabinet">{Object.entries(trophies).map(([n, k]) => <div key={n}><TrophySvg size={40} /><b>{k}×</b><span>{n}</span></div>)}</div> : <p className="muted">No trophies won in this save yet.</p>}
          </Panel>
          {mine && (
            <>
              <Panel title="Finances this season">
                <div className="fin">
                  {([['TV & commercial', f.tv], ['Matchday', f.gate], ['Prize money', f.prize], ['Merchandise', f.merch], ['Player sales', f.transfersOut]] as const).map(([l, v]) => <div key={l} className="fin-row"><span>{l}</span><span className="fin-bar"><i style={{ width: `${income ? v / income * 100 : 0}%` }} /></span><b className="pos">{fmtMoney(v)}</b></div>)}
                  {([['Wages', f.wages], ['Player purchases', f.transfersIn]] as const).map(([l, v]) => <div key={l} className="fin-row"><span>{l}</span><span className="fin-bar neg"><i style={{ width: `${spend ? v / Math.max(income, spend) * 100 : 0}%` }} /></span><b className="neg">-{fmtMoney(v)}</b></div>)}
                  <div className="fin-row tot"><span>Bank balance</span><span /><b>{fmtMoney(c.balance)}</b></div>
                </div>
              </Panel>
              <Panel title="Infrastructure">
                <div className="infra">
                  <div><span>Training facilities</span><b><Stars n={Math.round(c.facilities / 2)} /></b><button className="btn" onClick={() => upgrade('facilities')}>Upgrade · {fmtMoney(4e6 * c.facilities * c.facilities)}</button><p className="muted sm">Faster player development and recovery.</p></div>
                  <div><span>Youth academy</span><b><Stars n={Math.round(c.youth / 2)} /></b><button className="btn" onClick={() => upgrade('youth')}>Upgrade · {fmtMoney(4e6 * c.youth * c.youth)}</button><p className="muted sm">Better graduates every summer.</p></div>
                  <div><span>Transfer budget</span><b>{fmtMoney(c.budget)}</b><button className="btn" onClick={() => { if (c.budget < 5e6) return toast('Not enough budget', 'bad'); mutate(x => { x.clubs[id].budget -= 5e6; x.clubs[id].wageBudget += Math.round(5e6 / 52 / 2 / 1000) * 1000; }); toast('Moved €5M into the wage budget', 'good'); }}>Move €5M to wages</button><p className="muted sm">Every €5M of transfer budget buys about {fmtMoney(5e6 / 104)}/wk of wages.</p></div>
                </div>
              </Panel>
              <Panel title="History"><button className="btn" onClick={() => go({ s: 'history' })}>Seasons, champions & awards</button></Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
