// The strip above Madden's roster and draft spreadsheets: the highlighted player's
// photo on his team (or school) colours, the name large, the bio line, and the
// ratings that drive his position.
import { useState, type CSSProperties } from 'react';
import type { Player } from '../core/types';
import { OVR_W, ATTR_NAME, POS_NAME } from '../core/ratings';
import { capHit, money, yearsLeft } from '../core/contracts';
import { scoutedView, draftGrade, prospectLevel } from '../core/draft';
import { app } from './store';
import { Logo, DevIcon, Grade, vivid, tier, attrColor } from './components';
import { FaceArt } from './face';

export function PlayerBanner({ p, prospect }: { p: Player; prospect?: boolean }) {
  const L = app.league!;
  const t = L.teams[p.team];
  const [bad, setBad] = useState<string | null>(null);
  const url = p.hs && bad !== p.id ? p.hs.replace('f_auto,q_auto', 'f_auto,q_auto,w_400') : undefined;
  const c = prospect ? vivid(L.teams[L.user].colors[0]) : t ? vivid(t.colors[0]) : '#2a3040';
  const keys = (Object.entries(OVR_W[p.pos]) as [keyof Player['attrs'], number][]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  const sv = prospect ? scoutedView(p) : null;
  const ht = `${Math.floor(p.ht / 12)}'${p.ht % 12}"`;
  return (
    <div className="pb" style={{ '--pc': c } as CSSProperties}>
      <div className="pb-art">
        {prospect && p.colLogo ? <img className="pb-mark" src={p.colLogo} alt="" /> : t && <Logo team={t} size={220} style={{ position: 'absolute', left: -30, top: -30, opacity: 0.22 }} />}
        {prospect && <span className="pb-draft">{p.draft.year} Draft</span>}
        <div className="pb-shot">{url ? <img src={url} alt="" onError={() => setBad(p.id)} /> : <FaceArt p={p} team={t} size={170} />}</div>
      </div>
      <div className="pb-id">
        <span className="pb-fn">{p.fn}</span>
        <b className="pb-ln">{p.ln}</b>
        <div className="pb-bio">
          <span>{p.pos}</span><span>{ht}</span><span>{p.wt} lbs</span><span>{prospect ? `${prospectLevel(L, p).ageNow} yrs${prospectLevel(L, p).yearsOut ? ` · ${prospectLevel(L, p).label}` : ''}` : `Age ${Math.floor(p.age)}`}</span><span>{p.col}</span>
          {!prospect && <span>{p.exp ? `${p.exp} yrs exp` : 'Rookie'}</span>}
        </div>
        <div className="pb-tags">
          {prospect ? <><Grade g={draftGrade(p)} /><span className="pb-tag">Rank #{p.proj}</span>{(p.scout ?? 0) >= 1 && <span className="pb-tag">{p.arch}</span>}{(p.scout ?? 0) >= 3 && <span className="pb-tag dv"><DevIcon d={p.dev} size={16} />{p.dev}</span>}{p.combine && <span className="pb-tag">40: {p.combine.forty.toFixed(2)}</span>}</>
            : <><span className={`ovr ${tier(p.ovr)}`}>{p.ovr}</span><span className="pb-tag">{POS_NAME[p.pos]}</span><span className="pb-tag">{p.arch}</span><span className="pb-tag dv"><DevIcon d={p.dev} size={16} />{p.dev}</span>
              {p.team !== 'FA' && <span className="pb-tag">{money(capHit(p.contract, L.season))} · {yearsLeft(p.contract, L.season)} yr{yearsLeft(p.contract, L.season) === 1 ? '' : 's'}</span>}
              {p.injury && <span className="pb-tag bad">{p.injury.type} · {p.injury.weeks} wk</span>}</>}
        </div>
      </div>
      <div className="pb-attrs">
        {keys.map(k => {
          const known = !prospect || (sv?.lvl ?? 0) >= 2;
          return <div key={k} title={ATTR_NAME[k]}><span>{k}</span><b style={{ color: known ? attrColor(p.attrs[k]) : 'var(--mute)' }}>{known ? p.attrs[k] : '??'}</b><i><em style={{ width: `${known ? p.attrs[k] : 0}%`, background: known ? attrColor(p.attrs[k]) : undefined }} /></i></div>;
        })}
      </div>
    </div>
  );
}
