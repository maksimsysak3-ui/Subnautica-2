// The coaching staff: you, three coordinators, a recruiting coordinator, strength coach and the
// position coaches. Each has ratings in the areas that matter for his job, a specialty and a
// contract. (Fictional names; seeded by program so a school's staff is the same every visit.)
import type { CSSProperties } from 'react';
import { showColor, type School } from './data';

const FN = ['Mike', 'Steve', 'Brian', 'Kevin', 'Tony', 'Chris', 'Greg', 'Darrell', 'Jim', 'Mark', 'Ron', 'Todd', 'Shawn', 'Eric', 'Jason', 'Derek', 'Pat', 'Rob', 'Vic', 'Lou'];
const LN = ['Holloway', 'Briggs', 'McKinney', 'Sanders', 'Pruett', 'Callahan', 'Dowling', 'Fuller', 'Grady', 'Hatcher', 'Kellerman', 'Lyle', 'Monroe', 'Nash', 'Orr', 'Pace', 'Quinn', 'Ralston', 'Stroud', 'Tillman'];
const ROLES: [string, string, string[], string[]][] = [
  ['Offensive Coordinator', 'Offense', ['Play calling', 'QB development', 'Recruiting'], ['Spread RPO', 'Pro-style', 'Air Raid', 'Power run', 'Multiple']],
  ['Defensive Coordinator', 'Defense', ['Play calling', 'Front-seven teaching', 'Recruiting'], ['4-2-5', '3-4 multiple', '4-3 over', 'Tampa 2', 'Quarters']],
  ['Special Teams Coordinator', 'Special teams', ['Coverage units', 'Kicking development', 'Recruiting'], ['Aggressive returns', 'Field position']],
  ['Recruiting Coordinator', 'Recruiting', ['Evaluation', 'Closing', 'Relationships'], ['Southeast pipeline', 'Texas pipeline', 'National reach']],
  ['Strength & Conditioning', 'Development', ['Strength gains', 'Speed gains', 'Injury prevention'], ['Olympic lifting', 'Speed-first']],
  ['Quarterbacks Coach', 'QB', ['Technique', 'Development', 'Recruiting'], ['Mechanics', 'Film study']],
  ['Running Backs Coach', 'RB', ['Technique', 'Development', 'Recruiting'], ['Ball security']],
  ['Wide Receivers Coach', 'WR', ['Technique', 'Development', 'Recruiting'], ['Route craft']],
  ['Offensive Line Coach', 'OL', ['Technique', 'Development', 'Recruiting'], ['Zone blocking', 'Gap scheme']],
  ['Defensive Line Coach', 'DL', ['Technique', 'Development', 'Recruiting'], ['Pass-rush plan']],
  ['Linebackers Coach', 'LB', ['Technique', 'Development', 'Recruiting'], ['Run fits']],
  ['Defensive Backs Coach', 'DB', ['Technique', 'Development', 'Recruiting'], ['Press man']],
];
const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

export function StaffTab({ s }: { s: School }) {
  const c = showColor(s);
  const staff = ROLES.map(([role, area, skills, styles], i) => {
    const k = h(`${s.id}-${role}`);
    const base = 46 + s.prestige * 6 + (k % 12) - (i > 4 ? 4 : 0);
    const ratings = skills.map((sk, j) => [sk, Math.max(40, Math.min(97, base + ((k >>> (j * 4)) % 15) - 6))] as const);
    const ovr = Math.round(ratings.reduce((a, [, v]) => a + v, 0) / ratings.length);
    return { role, area, name: `${FN[(k + i * 7) % FN.length]} ${LN[((k >>> 7) + i * 3) % LN.length]}`, ratings, ovr, style: styles[(k >>> 11) % styles.length], yrs: 1 + ((k >>> 13) % 4), pay: Math.round((0.3 + ovr / 100 * (i < 3 ? 2.4 : i < 5 ? 1 : 0.7)) * 10) / 10, age: 34 + ((k >>> 15) % 26) };
  });
  const avg = Math.round(staff.reduce((a, x) => a + x.ovr, 0) / staff.length);
  return (
    <div className="stf" style={{ '--c': c } as CSSProperties}>
      <section className="hc stf-hc">
        <div className="stf-me"><div className="stf-av">HC</div><div><span>Head coach</span><b>You</b><em>{s.school} · Year 1</em></div></div>
        <div className="kpis"><div><b>{avg}</b><span>Staff rating</span></div><div><b>${staff.reduce((a, x) => a + x.pay, 0).toFixed(1)}M</b><span>Staff payroll</span></div><div><b>{staff.filter(x => x.yrs === 1).length}</b><span>Expiring contracts</span></div></div>
      </section>
      <div className="stf-grid">{staff.map(x => (
        <section key={x.role} className="hc stf-card">
          <header><div className="stf-av sm">{x.name.split(' ').map(w => w[0]).join('')}</div><div><span>{x.role}</span><b>{x.name}</b></div><em className={`ovr ${x.ovr >= 85 ? 'a' : x.ovr >= 75 ? 'b' : 'c'}`}>{x.ovr}</em></header>
          <div className="stf-body">
            {x.ratings.map(([k, v]) => <div key={k} className="stf-r"><span>{k}</span><i><em style={{ width: `${v}%` }} /></i><b>{v}</b></div>)}
            <div className="stf-meta"><span>{x.style}</span><span>Age {x.age}</span><span>{x.yrs} yr{x.yrs > 1 ? 's' : ''} · ${x.pay}M</span></div>
          </div>
        </section>
      ))}</div>
    </div>
  );
}
