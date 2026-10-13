// This week's matchup, presented like a broadcast open: the two programs split the screen in
// their colours with mascots squaring off, then the tale of the tape, the head-to-head battles
// that decide it (from the real depth charts) and each side's keys to the game.
import type { CSSProperties } from 'react';
import { rosterOf, showColor, TOP25, YR, type School, type Player } from './data';
import { showCard } from './PlayerCard';
import { Logo } from './App';

const OFF = ['QB', 'RB', 'WR', 'TE', 'OT', 'G', 'C'], DEF = ['EDGE', 'DT', 'LB', 'CB', 'S'];
const unit = (id: number, ps: string[]) => { const st = rosterOf(id).filter(p => p.st && ps.includes(p.pos)); return st.length ? Math.round(st.reduce((a, p) => a + p.ovr, 0) / st.length) : 0; };
const best = (id: number, pos: string, n = 0) => rosterOf(id).filter(p => p.pos === pos)[n];
const rankOf = (s: School) => { const i = TOP25.indexOf(s); return i >= 0 ? i + 1 : 0; };

export function Matchup({ s, g }: { s: School; g: { o: School; home: boolean; wk: number; conf: boolean } }) {
  const o = g.o, home = g.home ? s : o, away = g.home ? o : s;
  const ca = showColor(away), ch = showColor(home);
  // Line and win probability from the rating gap, with three points for home field.
  const edge = (home.ovr - away.ovr) * 0.9 + 3;
  const wp = Math.round(100 / (1 + Math.exp(-edge / 7)));
  const fav = edge >= 0 ? home : away;
  const tape: [string, number, number][] = [
    ['Overall', away.ovr, home.ovr], ['Offense', unit(away.id, OFF), unit(home.id, OFF)], ['Defense', unit(away.id, DEF), unit(home.id, DEF)],
    ['Special teams', unit(away.id, ['K', 'P']), unit(home.id, ['K', 'P'])], ['Prestige', away.prestige * 20, home.prestige * 20], ['2025 win %', Math.round(away.win * 100), Math.round(home.win * 100)],
  ];
  const battles: [string, Player | undefined, Player | undefined][] = [
    ['Quarterbacks', best(away.id, 'QB'), best(home.id, 'QB')],
    [`${away.abbr} WR1 vs ${home.abbr} CB1`, best(away.id, 'WR'), best(home.id, 'CB')],
    [`${home.abbr} WR1 vs ${away.abbr} CB1`, best(home.id, 'WR'), best(away.id, 'CB')],
    ['In the trenches', best(away.id, 'EDGE'), best(home.id, 'OT')],
  ];
  const keys = (t: School, other: School) => {
    const oOff = unit(t.id, OFF) - unit(other.id, DEF), oDef = unit(t.id, DEF) - unit(other.id, OFF);
    return [
      oOff >= 0 ? `Lean on the ${best(t.id, 'QB')?.ln ?? 'passing'} game: this offense has the edge up front` : `Stay ahead of the chains: the ${other.mascot} defense is the better unit`,
      oDef >= 0 ? `Make ${other.school} one-dimensional early` : `Limit explosives: ${best(other.id, 'WR')?.ln ?? 'their receivers'} can break it open`,
      t === home ? 'Feed off the home crowd on third down' : 'Start fast and take the crowd out of it',
    ];
  };
  const rA = rankOf(away), rH = rankOf(home);
  return (
    <div className="mu" style={{ '--ca': ca, '--ch': ch } as CSSProperties}>
      <section className="mu-stage">
        <div className="mu-half a"><Logo id={away.id} className="mu-bglogo" /></div>
        <div className="mu-half h"><Logo id={home.id} className="mu-bglogo" /></div>
        <div className="mu-slash" />
        <div className="mu-team a">
          <Logo id={away.id} className="mu-logo" />
          <div className="mu-rank">{rA ? `No. ${rA}` : away.conf}</div>
          <div className="mu-name">{away.school}</div>
          <div className="mu-mascot">{away.mascot} · 0-0</div>
        </div>
        <div className="mu-vs"><span>Week {g.wk}</span><b>VS</b><em>{g.conf ? 'Conference game' : 'Non-conference'}</em></div>
        <div className="mu-team h">
          <Logo id={home.id} className="mu-logo" />
          <div className="mu-rank">{rH ? `No. ${rH}` : home.conf}</div>
          <div className="mu-name">{home.school}</div>
          <div className="mu-mascot">{home.mascot} · 0-0</div>
        </div>
        <div className="mu-info">
          <div><span>Kickoff</span><b>Saturday · 3:30 PM</b></div>
          <div><span>Site</span><b>{home.school} home field</b></div>
          <div><span>Line</span><b>{fav.abbr} −{Math.max(1, Math.round(Math.abs(edge) * 2) / 2)}</b></div>
          <div><span>Win probability</span><b>{home.abbr} {wp}% · {away.abbr} {100 - wp}%</b></div>
        </div>
      </section>

      <div className="mu-grid">
        <section className="hc mu-tape">
          <header><h3>Tale of the tape</h3></header>
          <div>{tape.map(([k, a, h]) => (
            <div key={k} className="mu-row">
              <b className={a > h ? 'win' : ''}>{a}</b>
              <div className="mu-bars"><i className="a" style={{ width: `${(a / Math.max(1, a + h)) * 100}%` }} /><i className="h" style={{ width: `${(h / Math.max(1, a + h)) * 100}%` }} /></div>
              <b className={h > a ? 'win' : ''}>{h}</b>
              <span>{k}</span>
            </div>
          ))}</div>
        </section>

        <section className="hc mu-battles">
          <header><h3>Matchups to watch</h3></header>
          <div>{battles.map(([k, a, h]) => (
            <div key={k} className="mu-battle">
              <Duel p={a} side="a" />
              <div className="mu-battle-k"><span>{k}</span><b>VS</b></div>
              <Duel p={h} side="h" />
            </div>
          ))}</div>
        </section>

        <section className="hc mu-keys">
          <header><h3>Keys to the game</h3></header>
          <div className="mu-keycols">
            {[[away, home], [home, away]].map(([t, other]) => (
              <div key={t.id} style={{ '--tc': showColor(t) } as CSSProperties}>
                <h4><Logo id={t.id} size={26} />{t.school}</h4>
                <ol>{keys(t, other).map((k, i) => <li key={i}>{k}</li>)}</ol>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Duel({ p, side }: { p?: Player; side: 'a' | 'h' }) {
  if (!p) return <div className={`mu-duel ${side}`} />;
  return (
    <button className={`mu-duel ${side}`} onClick={() => showCard(p)}>
      <div className="mu-duel-img"><span>{p.pos}</span><b>{p.num}</b></div>
      <div><b>{p.fn} {p.ln}</b><span>{p.pos} · {YR[p.yr]} · #{p.num}</span></div>
      <em>{p.ovr}</em>
    </button>
  );
}
