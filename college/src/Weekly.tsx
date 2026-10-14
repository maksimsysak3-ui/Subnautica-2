// Weekly decisions, college style. Six offices to visit (tabs), each with decisions built
// around the real roster. The board itself is clean; opening a decision pops up a retro,
// pixel-art scene and dialogue box (the pixel look lives only in the pop-ups); every choice moves the program meters at the top
// (team chemistry, fan hype, recruiting buzz, booster trust, academics).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { rosterOf, showColor, SCHOOLS, type School, type Player } from './data';
import { useDynasty, update } from './store';

// ---- pixel sprites (12x12; '.' is transparent, c/d are the school's colours) ---------------
const SPR: Record<string, string[]> = {
  ball: ['............', '....bbbb....', '..bbbbbbbb..', '.bbbwbwbwbb.', 'bbbbbbbbbbbb', 'bbwwwwwwwwbb', 'bbbbbbbbbbbb', '.bbbwbwbwbb.', '..bbbbbbbb..', '....bbbb....', '............', '............'],
  phone: ['...kkkkkk...', '...kccccck..', '...kwwwwwk..', '...kwccwwk..', '...kwwwwwk..', '...kwwccwk..', '...kwwwwwk..', '...kwwwwwk..', '...kccccck..', '...kcckcck..', '...kkkkkkk..', '............'],
  mic: ['....kkkk....', '...kwwwwk...', '...kwkwwk...', '...kwwkwk...', '...kwwwwk...', '....kkkk....', '.....kk.....', '..k..kk..k..', '..kk.kk.kk..', '...kkkkkk...', '.....kk.....', '...kkkkkk...'],
  bag: ['....kkkk....', '.....kk.....', '....kyyk....', '...kyyyyk...', '..kyyyyyyk..', '.kyyykkyyyk.', '.kyyykyyyyk.', '.kyyyykkyyk.', '.kyyyyyykyk.', '.kyyykkkyyk.', '..kyyyyyyk..', '...kkkkkk...'],
  book: ['............', '.kkkkkkkkkk.', '.kccccccccck', '.kcwwwwwwwck', '.kcwkkkkwwck', '.kcwwwwwwwck', '.kcwkkkwwwck', '.kcwwwwwwwck', '.kccccccccck', '.kwwwwwwwwwk', '.kkkkkkkkkkk', '............'],
  whistle: ['............', '.....kkkk...', '....kccck...', '..kkkkkkk...', '.kwwwwwwwk..', 'kwwwkkwwwwk.', 'kwwwkkwwwwkk', 'kwwwwwwwwwk.', '.kwwwwwwwk..', '..kkkkkkk...', '............', '............'],
  helmet: ['............', '...kkkkkk...', '..kccccccck.', '.kccwwccccck', '.kcccccccccc', 'kccccccckkkk', 'kcccccck.w.k', 'kccccccck.wk', 'kcccccckkkkk', '.kccccck....', '..kkkkk.....', '............'],
  trophy: ['............', '.kkkkkkkkkk.', 'kyykyyyykyyk', 'kyk.kyyyk.yk', '.kykyyyykyk.', '..kyyyyyyk..', '...kyyyyk...', '....kyyk....', '.....kk.....', '...kkyykk...', '..kyyyyyyk..', '..kkkkkkkk..'],
  house: ['.....kk.....', '....kcck....', '...kcccck...', '..kccccccck.', '.kkkkkkkkkkk', '..kwwwwwwk..', '..kwkkwwwk..', '..kwkkwkwk..', '..kwwwwkwk..', '..kwwwwkwk..', '..kkkkkkkk..', '............'],
  chat: ['............', '.kkkkkkkkkk.', 'kwwwwwwwwwwk', 'kwkkwkkwkkwk', 'kwwwwwwwwwwk', 'kwkkkwkkkwwk', 'kwwwwwwwwwwk', '.kkkwwkkkkk.', '...kwk......', '...kk.......', '............', '............'],
};
const PAL: Record<string, string> = { k: '#0b0d12', w: '#f3f1e8', y: '#f5c443', b: '#8b4a22', s: '#e0ac7e', g: '#3fa34d', r: '#d83a3a' };
export function Sprite({ name, c, d, px = 6 }: { name: string; c: string; d?: string; px?: number }) {
  const rows = SPR[name] ?? SPR.ball;
  return (
    <svg className="spr" width={12 * px} height={12 * px} viewBox="0 0 12 12" shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].map((ch, x) => ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={ch === 'c' ? c : ch === 'd' ? (d ?? c) : PAL[ch]} />))}
    </svg>
  );
}

// ---- decisions ---------------------------------------------------------------------------------
type Meter = 'chem' | 'hype' | 'buzz' | 'boost' | 'acad';
const METERS: [Meter, string][] = [['chem', 'Team chemistry'], ['hype', 'Fan hype'], ['buzz', 'Recruiting buzz'], ['boost', 'Booster trust'], ['acad', 'Academics']];
interface Choice { label: string; fx: Partial<Record<Meter, number>>; result: string }
interface Decision { id: string; tab: string; sprite: string; who: string; title: string; text: string; choices: Choice[] }
const TABS = ['Locker Room', 'Recruiting', 'Campus & Media', 'Boosters & NIL', 'Academics', 'Staff Room'];

function decisions(s: School): Decision[] {
  const r = rosterOf(s.id);
  const pick = (pos: string, i = 0) => r.filter(p => p.pos === pos)[i] ?? r[i];
  const qb = pick('QB'), qb2 = pick('QB', 1), wr = pick('WR'), rb = pick('RB'), lb = pick('LB'), cb = pick('CB'), ol = pick('OT');
  const fr = r.filter(p => p.yr === 1).sort((a, b) => b.ovr - a.ovr)[0] ?? r[r.length - 1];
  const sr = r.filter(p => p.yr >= 4).sort((a, b) => b.ovr - a.ovr)[0] ?? r[0];
  const rival = SCHOOLS.filter(x => x.conf === s.conf && x.id !== s.id).sort((a, b) => b.ovr - a.ovr)[0] ?? SCHOOLS[0];
  const n = (p: Player) => `${p.fn} ${p.ln}`;
  return [
    { id: 'qbbattle', tab: 'Locker Room', sprite: 'helmet', who: 'QB room', title: 'Quarterback competition', text: `${n(qb2)} has outplayed ${n(qb)} in two straight scrimmages. The room is split and everyone is waiting on you.`, choices: [
      { label: `Stick with ${qb.ln}`, fx: { chem: 2, hype: -1 }, result: `${qb.ln} keeps the job. ${qb2.ln} takes it like a pro, for now.` },
      { label: `Open the job up`, fx: { chem: -2, hype: 3 }, result: 'The competition is on. Practice gets very loud this week.' },
      { label: 'Package plays for both', fx: { chem: 1, hype: 1 }, result: `${qb2.ln} gets a red-zone package. Both sides feel heard.` } ] },
    { id: 'captain', tab: 'Locker Room', sprite: 'chat', who: 'Leadership council', title: 'Name a captain', text: `The council wants a fourth captain. ${n(sr)} is the senior voice; ${n(fr)} is the freshman everyone is following.`, choices: [
      { label: sr.ln, fx: { chem: 3 }, result: `${sr.ln} gets the C. The seniors close ranks.` },
      { label: fr.ln, fx: { chem: -1, hype: 2, buzz: 2 }, result: `A freshman captain. Recruits notice; a few seniors grumble.` } ] },
    { id: 'curfew', tab: 'Locker Room', sprite: 'whistle', who: 'Team rules', title: 'Curfew broken', text: `${n(wr)} and two backups missed curfew before the road trip. It is already on social media.`, choices: [
      { label: 'Sit them a half', fx: { chem: 2, hype: -2, acad: 1 }, result: 'They sit the first half. The message lands.' },
      { label: 'Extra conditioning', fx: { chem: 1 }, result: '5 a.m. stadium stairs. Nobody misses curfew again.' },
      { label: 'Handle it quietly', fx: { chem: -2, hype: 1 }, result: 'It blows over, but the room noticed.' } ] },
    { id: 'visit', tab: 'Recruiting', sprite: 'house', who: 'Recruiting office', title: 'Home visit or official visit?', text: 'A five-star tackle from Texas has you in his top three. You can fly out for a home visit Tuesday or host him for the game.', choices: [
      { label: 'Home visit (costs practice time)', fx: { buzz: 4, chem: -1 }, result: 'You sit at his kitchen table for two hours. His mom loves you.' },
      { label: 'Host him on game day', fx: { buzz: 2, hype: 1 }, result: 'He sees the stadium full. Now you have to win.' } ] },
    { id: 'flip', tab: 'Recruiting', sprite: 'phone', who: 'Recruiting coordinator', title: `Flip a ${rival.school} commit?`, text: `A four-star corner committed to ${rival.school} just texted your staff. He wants to talk.`, choices: [
      { label: 'Go after him hard', fx: { buzz: 3, boost: 1, hype: 1 }, result: `The ${rival.mascot} staff is furious. He takes an official visit.` },
      { label: 'Respect the commitment', fx: { buzz: -1, acad: 1 }, result: 'You pass. Coaches around the league respect it.' } ] },
    { id: 'camp', tab: 'Recruiting', sprite: 'ball', who: 'Football operations', title: 'Satellite camp', text: 'You can run a one-day camp in Florida in June, deep in another program\'s footprint.', choices: [
      { label: 'Run the camp', fx: { buzz: 3, boost: -1 }, result: 'Three hundred kids show up. Two sleepers jump onto your board.' },
      { label: 'Stay home', fx: { chem: 1 }, result: 'Your staff gets a rare week off.' } ] },
    { id: 'gameday', tab: 'Campus & Media', sprite: 'mic', who: 'National TV', title: 'Game-day show wants your campus', text: `The big pregame show wants to broadcast from the quad before you play ${rival.school}.`, choices: [
      { label: 'Roll out the red carpet', fx: { hype: 4, buzz: 2, chem: -1 }, result: 'Thirty thousand people on the quad at 7 a.m. The country watches.' },
      { label: 'Keep the focus on football', fx: { chem: 2, hype: -1 }, result: 'They go elsewhere. Your players barely notice.' } ] },
    { id: 'presser', tab: 'Campus & Media', sprite: 'mic', who: 'Press conference', title: 'Bulletin-board question', text: `A reporter asks whether ${rival.school} is still the class of the ${s.conf}.`, choices: [
      { label: '"Not after this year."', fx: { hype: 3, chem: 1, boost: 1 }, result: 'Clip of the week. Their locker room has it on a screen.' },
      { label: '"They have earned that."', fx: { acad: 1, hype: -1 }, result: 'Classy. Boring. The column writes itself.' } ] },
    { id: 'student', tab: 'Campus & Media', sprite: 'chat', who: 'Student section', title: 'Student section request', text: 'The students want the team to walk through the tailgate lots before kickoff.', choices: [
      { label: 'Make it a tradition', fx: { hype: 3, chem: 1 }, result: 'The Walk is born. Students line up three hours early.' },
      { label: 'Too much of a distraction', fx: { hype: -2 }, result: 'The students are disappointed.' } ] },
    { id: 'collective', tab: 'Boosters & NIL', sprite: 'bag', who: 'NIL collective', title: 'The collective has a proposal', text: `The collective will fund a big NIL deal for ${n(rb)} if you help them with a donor dinner.`, choices: [
      { label: 'Host the dinner', fx: { boost: 4, chem: 1, acad: -1 }, result: `${rb.ln}'s deal gets done. The donors leave very happy.` },
      { label: 'Stay out of it', fx: { boost: -2, chem: -1 }, result: 'The collective goes quiet for a while.' } ] },
    { id: 'facility', tab: 'Boosters & NIL', sprite: 'trophy', who: 'Athletic director', title: 'Facilities gift', text: 'A booster offers to pay for a new players\' lounge, if it carries his name.', choices: [
      { label: 'Accept', fx: { boost: 3, buzz: 2 }, result: 'Recruits will tour it on every visit.' },
      { label: 'Ask for weight-room upgrades instead', fx: { boost: 1, chem: 2 }, result: 'Less shiny, more useful. The players approve.' } ] },
    { id: 'nilwr', tab: 'Boosters & NIL', sprite: 'phone', who: 'Agent', title: 'Portal threat', text: `${n(cb)}'s representative says a rival will double his NIL money if he enters the portal.`, choices: [
      { label: 'Match through the collective', fx: { boost: -2, chem: 1 }, result: `${cb.ln} stays. The collective's budget takes a hit.` },
      { label: 'Let the market decide', fx: { chem: -2, boost: 1 }, result: `${cb.ln} is weighing his options.` } ] },
    { id: 'grades', tab: 'Academics', sprite: 'book', who: 'Academic advisor', title: 'Eligibility scare', text: `${n(ol)} is at risk of falling below the GPA line before midterms.`, choices: [
      { label: 'Mandatory study hall', fx: { acad: 3, chem: -1 }, result: 'Nightly study hall. His grades climb.' },
      { label: 'Hire a tutor', fx: { acad: 2, boost: -1 }, result: 'A tutor through the athletic department. Problem handled.' } ] },
    { id: 'gradday', tab: 'Academics', sprite: 'book', who: 'Provost', title: 'Graduation weekend', text: `Two seniors, including ${n(sr)}, graduate the same weekend as a road game.`, choices: [
      { label: 'Fly them back for the ceremony', fx: { acad: 2, chem: 2, boost: -1 }, result: 'They walk the stage, then rejoin the team.' },
      { label: 'Celebrate after the season', fx: { chem: -1 }, result: 'They understand, mostly.' } ] },
    { id: 'coord', tab: 'Staff Room', sprite: 'whistle', who: 'Defensive coordinator', title: 'Scheme change', text: `Your coordinator wants to move ${n(lb)} to edge rusher for the conference schedule.`, choices: [
      { label: 'Trust the coordinator', fx: { chem: 1, hype: 1 }, result: `${lb.ln} starts working at edge. Early returns look good.` },
      { label: 'Keep him at linebacker', fx: { chem: 1 }, result: 'Continuity wins. The coordinator is not thrilled.' } ] },
    { id: 'poach', tab: 'Staff Room', sprite: 'phone', who: 'Front office', title: 'Coordinator being poached', text: 'An NFL team wants your offensive coordinator for its quarterbacks coach job.', choices: [
      { label: 'Raise his salary', fx: { boost: -2, chem: 2 }, result: 'He stays. The quarterbacks are relieved.' },
      { label: 'Wish him well', fx: { chem: -2, buzz: 1 }, result: 'He leaves at the end of the season.' } ] },
  ];
}

const ICON: Record<string, string> = {
  'Locker Room': 'M4 20V6l8-3 8 3v14M9 20v-6h6v6',
  Recruiting: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  'Campus & Media': 'M9 18V6a3 3 0 0 1 6 0v12M5 11a7 7 0 0 0 14 0M12 18v3',
  'Boosters & NIL': 'M12 3v18M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6',
  Academics: 'M2 8l10-5 10 5-10 5zM6 10v6c3 2 9 2 12 0v-6',
  'Staff Room': 'M8 4h8v4H8zM5 8h14v13H5zM9 13h6M9 17h4',
};
const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export function Weekly({ s }: { s: School }) {
  const c = showColor(s);
  const d = useDynasty(s.id);
  const all = useMemo(() => decisions(s), [s.id]);
  const [tab, setTab] = useState(TABS[0]);
  const [open, setOpen] = useState<Decision | null>(null);
  const done = d.decisions, m = d.meters as Record<Meter, number>;
  const list = all.filter(x => x.tab === tab);
  const choose = (dc: Decision, ch: Choice) => update(x => {
    for (const [k, v] of Object.entries(ch.fx) as [Meter, number][]) x.meters[k] = Math.max(0, Math.min(100, (x.meters[k] ?? 50) + v * 3));
    x.decisions[dc.id] = ch.result;
  });
  const left = all.filter(x => !done[x.id]).length;
  return (
    <div className="wk" style={{ '--c': c, '--c2': s.c2 } as CSSProperties}>
      <section className="wk-head">
        <div className="wk-title"><span>{d.week === 0 ? 'Preseason' : `Week ${d.week}`} agenda</span><b>{left} decision{left === 1 ? '' : 's'} waiting</b><em>Every call moves the program. Some can't be undone.</em></div>
        <div className="wk-gauges">{METERS.map(([k, label]) => {
          const v = m[k] ?? 50, r = 26, cir = 2 * Math.PI * r;
          return (
            <div key={k} className="wk-g">
              <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" /><circle cx="32" cy="32" r={r} fill="none" stroke={v >= 70 ? '#4ade80' : v >= 45 ? c : '#f87171'} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(cir * v) / 100} ${cir}`} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dasharray .6s' }} /><text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">{v}</text></svg>
              <span>{label}</span>
            </div>
          );
        })}</div>
      </section>
      <div className="pills wk-tabs">{TABS.map(t => {
        const n = all.filter(x => x.tab === t && !done[x.id]).length;
        return <button key={t} className={`pill${t === tab ? ' on' : ''}`} onClick={() => setTab(t)}>{t}{n ? <em>{n}</em> : null}</button>;
      })}</div>
      <div className="wk-list">{list.map((x, i) => (
        <article key={x.id} className={`wk-card${done[x.id] ? ' done' : ''}`} onClick={() => !done[x.id] && setOpen(x)}>
          <div className="wk-pen"><span className="wk-hex">{TABS.indexOf(x.tab) + 1}</span></div>
          <header><svg viewBox="0 0 24 24" className="wk-ic"><path d={ICON[x.tab]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{x.who}</span><em>{DAY[(i + x.id.length) % 5]}</em></header>
          <b className="wk-t">{x.title}</b>
          <p>{done[x.id] ?? x.text}</p>
          {!done[x.id] && <div className="wk-opts">{x.choices.map(ch => <span key={ch.label}>{ch.label}</span>)}</div>}
          <footer>{done[x.id] ? <span className="wk-stamp">Decided</span> : <button className="cbtn primary sm" onClick={() => setOpen(x)}>Make the call</button>}</footer>
        </article>
      ))}</div>
      {open && createPortal(<div style={{ '--c': c } as CSSProperties}><Popup d={open} c={c} result={done[open.id]} onChoose={ch => choose(open, ch)} onClose={() => setOpen(null)} /></div>, document.body)}
    </div>
  );
}

/** The pixel dialogue: a scene panel, the speaker's line typed out, and the choices. */
function Popup({ d, c, result, onChoose, onClose }: { d: Decision; c: string; result?: string; onChoose: (ch: Choice) => void; onClose: () => void }) {
  const text = result ?? d.text;
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(0); const t = setInterval(() => setShown(n => { if (n >= text.length) { clearInterval(t); return n; } return n + 2; }), 18); return () => clearInterval(t); }, [text]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="px-back" onClick={onClose}>
      <div className="px-box" onClick={e => e.stopPropagation()}>
        <div className="px-scene">
          <div className="px-sky" /><div className="px-ground" />
          <div className="px-hero"><Sprite name={d.sprite} c={c} px={12} /></div>
          {Array.from({ length: 14 }, (_, i) => <i key={i} className="px-star" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 23) % 45}%`, animationDelay: `${i * 0.2}s` }} />)}
        </div>
        <div className="px-dialog">
          <div className="px-who">{d.who}</div>
          <div className="px-title">{d.title}</div>
          <p>{text.slice(0, shown)}<span className="px-caret" /></p>
          {!result ? (
            <div className="px-choices">{d.choices.map(ch => (
              <button key={ch.label} onClick={() => onChoose(ch)}>
                <b>{ch.label}</b>
                <span>{(Object.entries(ch.fx) as [Meter, number][]).map(([k, v]) => `${v > 0 ? '+' : ''}${v * 3} ${METERS.find(x => x[0] === k)![1]}`).join('  ')}</span>
              </button>
            ))}</div>
          ) : <div className="px-choices"><button onClick={onClose}><b>Continue</b></button></div>}
        </div>
      </div>
    </div>
  );
}
