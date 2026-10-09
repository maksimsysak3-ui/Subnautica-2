// Coaching Staff: your four coordinators and coaches under the head coach, what each one
// is doing for the team right now, their contracts against the staff budget, and the
// market of coaches you can hire (who may say no).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp, app } from '../store';
import { vivid } from '../components';
import { coachSprites, randomLook, lookOf } from '../coachlook';
import { hash } from '../../core/rng';
import { money } from '../../core/contracts';
import { ROLES, ROLE_NAME, TRAIT_DESC, STAFF_BUDGET, staffState, staffOf, staffPayroll, schemeFits, staffEffect, interest, hire, fire, extend, type Staff, type StaffRole } from '../../core/staff';

const ROLE_ICON: Record<StaffRole, string> = { OC: 'M3 12c3-6 15-6 18 0-3 6-15 6-18 0z', DC: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z', ST: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v10M7 12h10', SC: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' };
const grade = (r: number) => (r >= 90 ? 'A+' : r >= 85 ? 'A' : r >= 80 ? 'B+' : r >= 75 ? 'B' : r >= 70 ? 'C+' : r >= 65 ? 'C' : 'D');
const tone = (r: number) => (r >= 85 ? '#4ade80' : r >= 75 ? '#a3e635' : r >= 68 ? '#facc15' : '#f87171');

/** Pixel portrait of a coach, from his name (or your own look for the head coach). */
export function StaffFace({ name, colors, size = 56, me }: { name: string; colors: string[]; size?: number; me?: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const L = useApp().league!;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const spr = coachSprites(me ? lookOf(L) : randomLook(hash(name) >>> 0), colors).front;
    c.width = spr.width; c.height = spr.height;
    const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height); g.drawImage(spr, 0, 0);
  }, [name, colors.join(), me]);
  return <canvas ref={cv} className="sf-face" style={{ width: size, height: size }} />;
}

export function StaffScreen() {
  const L = useApp().league!;
  const me = L.teams[L.user];
  const st = staffState(L);
  const crew = staffOf(L, L.user);
  const [role, setRole] = useState<StaffRole | 'All'>('All');
  const [confirm, setConfirm] = useState<StaffRole | null>(null);
  const used = staffPayroll(L, L.user);
  const avg = Math.round(ROLES.reduce((a, r) => a + (crew[r]?.rating ?? 55), 0) / ROLES.length);
  const leagueRank = useMemo(() => {
    const score = (a: string) => ROLES.reduce((s, r) => s + (staffOf(L, a)[r]?.rating ?? 55), 0);
    return Object.keys(L.teams).sort((a, b) => score(b) - score(a)).indexOf(L.user) + 1;
  }, [L, st.market.length, crew.OC?.id, crew.DC?.id, crew.ST?.id, crew.SC?.id]);
  const market = st.market.filter(s => role === 'All' || s.role === role).sort((a, b) => b.rating - a.rating);
  const tc = vivid(me.colors[0]);
  const doHire = (s: Staff) => { const r = hire(L, L.user, s.id); app.toast(r.ok ? `${s.name} is your new ${ROLE_NAME[s.role].toLowerCase()}` : r.reason); app.touch(); };
  return (
    <div className="sf" style={{ '--tc': tc } as CSSProperties}>
      <div className="sf-head">
        <div className="sf-hc"><StaffFace name={me.coach.name} colors={me.colors} size={84} me /><div><span className="up">Head Coach</span><div className="h1">{me.coach.name}</div><div className="sf-chips"><span>{me.coach.off} offense</span><span>{me.coach.def} defense</span><span>Level {L.coachTree.level}</span></div></div></div>
        <div className="sf-stats">
          <div><b style={{ color: tone(avg) }}>{grade(avg)}</b><span>Staff grade</span></div>
          <div><b>#{leagueRank}</b><span>In the league</span></div>
          <div className="sf-budget"><span>Staff budget</span><b>{money(used)} <i>/ {money(STAFF_BUDGET)}</i></b><i className="sf-bar"><em style={{ width: `${Math.min(100, (used / STAFF_BUDGET) * 100)}%`, background: used > STAFF_BUDGET ? '#ef4444' : undefined }} /></i>{st.budget[L.user] ? <small>{money(st.budget[L.user])} owed to fired coaches this year</small> : null}</div>
        </div>
      </div>

      <div className="sf-crew">{ROLES.map(r => {
        const s = crew[r];
        if (!s) return (
          <div key={r} className="sf-card empty">
            <div className="sf-role"><svg viewBox="0 0 24 24" width="16" height="16"><path d={ROLE_ICON[r]} fill="currentColor" /></svg>{ROLE_NAME[r]}</div>
            <div className="sf-vacant"><b>Vacant</b><p>An interim assistant is filling in. {r === 'OC' || r === 'DC' ? `−1 to the ${r === 'OC' ? 'offense' : 'defense'} every game.` : r === 'ST' ? '−1 kicking and punting.' : '−2 weekly recovery.'}</p><button className="btn primary" onClick={() => setRole(r)}>Find a {r}</button></div>
          </div>);
        const fit = schemeFits(L, L.user, s);
        return (
          <div key={r} className="sf-card">
            <div className="sf-role"><svg viewBox="0 0 24 24" width="16" height="16"><path d={ROLE_ICON[r]} fill="currentColor" /></svg>{ROLE_NAME[r]}</div>
            <div className="sf-top">
              <StaffFace name={s.name} colors={me.colors} size={72} />
              <div className="sf-id"><b>{s.name}</b><span>Age {s.age}</span></div>
              <div className="sf-rt" style={{ '--g': tone(s.rating) } as CSSProperties}><b>{s.rating}</b><span>{grade(s.rating)}</span></div>
            </div>
            <div className="sf-tags">
              {s.scheme && <span className={`sf-tag ${fit ? 'ok' : s.trait === 'Scheme Flexible' ? '' : 'no'}`} title={fit ? 'Matches your system' : 'Runs a different system from yours'}>{s.scheme}{fit ? ' ✓' : ''}</span>}
              {s.trait && <span className="sf-tag tr" title={TRAIT_DESC[s.trait]}>★ {s.trait}</span>}
            </div>
            {s.trait && <p className="sf-trait">{TRAIT_DESC[s.trait]}</p>}
            <div className="sf-eff">{staffEffect(L, L.user, s)}</div>
            <div className="sf-con"><span>{money(s.salary)} / yr</span><span>{s.years > 0 ? `${s.years} yr${s.years > 1 ? 's' : ''} left` : 'Expiring'}</span></div>
            {confirm === r
              ? <div className="sf-btns"><button className="btn sm" onClick={() => setConfirm(null)}>Keep him</button><button className="btn sm danger" onClick={() => { fire(L, L.user, r); setConfirm(null); setRole(r); app.toast(`${s.name} fired · ${money(s.salary)} stays on this year's staff budget`); app.touch(); }}>Confirm fire</button></div>
              : <div className="sf-btns"><button className="btn sm" onClick={() => { const x = extend(L, L.user, r); app.toast(x.ok ? `${s.name} extended through ${L.season + s.years - 1}` : x.reason); app.touch(); }}>Extend +2</button><button className="btn sm ghost" onClick={() => setConfirm(r)}>Fire</button></div>}
          </div>
        );
      })}</div>

      <div className="card sf-market">
        <div className="sf-mh"><h3>Coaching market</h3><span className="small mute">{st.market.length} coaches available · hiring replaces whoever holds the job · candidates who say no won't reconsider until next year</span>
          <div className="sf-filter">{(['All', ...ROLES] as const).map(r => <button key={r} className={`chip${role === r ? ' on' : ''}`} onClick={() => setRole(r)}>{r === 'All' ? 'All' : r}</button>)}</div></div>
        <div className="scroll"><table className="tbl sf-tbl"><thead><tr><th>Coach</th><th>Role</th><th className="c">Rating</th><th>Scheme</th><th>Trait</th><th className="c">Age</th><th className="r">Asking</th><th className="c">Interest</th><th /></tr></thead>
          <tbody>{market.map(s => {
            const i = interest(L, L.user, s), no = st.declined.includes(`${L.user}:${s.id}`), fit = schemeFits(L, L.user, s);
            const cur = crew[s.role], better = !cur || s.rating > cur.rating;
            return (
              <tr key={s.id} className={no ? 'dim' : ''}>
                <td><div className="sf-cell"><StaffFace name={s.name} colors={['#3a3f4a', '#9aa1ad']} size={34} /><b>{s.name}</b></div></td>
                <td>{s.role}</td>
                <td className="c"><b style={{ color: tone(s.rating) }}>{s.rating}</b>{cur && <span className={`sf-delta ${better ? 'up' : 'dn'}`}>{s.rating - cur.rating >= 0 ? '+' : ''}{s.rating - cur.rating}</span>}</td>
                <td>{s.scheme ? <span className={`sf-tag ${fit ? 'ok' : ''}`}>{s.scheme}{fit ? ' ✓' : ''}</span> : <span className="mute">—</span>}</td>
                <td>{s.trait ? <span className="sf-tag tr" title={TRAIT_DESC[s.trait]}>{s.trait}</span> : <span className="mute">—</span>}</td>
                <td className="c">{s.age}</td>
                <td className="r">{money(s.salary)} <span className="small mute">× {s.years}</span></td>
                <td className="c">{no ? <span className="sf-int no">Declined</span> : <span className={`sf-int ${i >= 0.65 ? 'hi' : i >= 0.5 ? 'md' : 'lo'}`}>{i >= 0.65 ? 'High' : i >= 0.5 ? 'Medium' : 'Low'}</span>}</td>
                <td className="r"><button className="btn sm primary" disabled={no} onClick={() => doHire(s)}>{cur ? 'Replace' : 'Hire'}</button></td>
              </tr>
            );
          })}</tbody></table></div>
      </div>
    </div>
  );
}
