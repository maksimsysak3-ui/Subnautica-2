// Playoff bracket: seven seeds a conference, Wild Card → Divisional → Conference →
// Super Bowl, AFC on the left and NFC on the right. Before the playoffs it shows the
// field "if the season ended today"; during them it fills in round by round with
// scores, and your team's path is lit up.
import type { CSSProperties } from 'react';
import { useApp, app } from '../store';
import { Logo, vivid } from '../components';
import { seeds, standings, ROUND_NAME, REG_WEEKS } from '../../core/season';
import type { Game, League } from '../../core/types';

type Slot = { home?: string; away?: string; game?: Game; bye?: boolean };

function confRounds(L: League, conf: 'AFC' | 'NFC', season: number) {
  const st = standings(L, season), s = seeds(L, conf, st);
  const seedOf = (a?: string) => (a ? s.indexOf(a) + 1 : 0);
  const games = (w: number) => L.games.filter(g => g.season === season && g.week === w && L.teams[g.home].conf === conf && !g.neutral)
    .sort((a, b) => seedOf(a.home) - seedOf(b.home));
  const asSlot = (g: Game): Slot => ({ home: g.home, away: g.away, game: g });
  const wc19 = games(19);
  const wc: Slot[] = [{ home: s[0], bye: true }, ...(wc19.length ? wc19.map(asSlot) : [[1, 6], [2, 5], [3, 4]].map(([h, a]) => ({ home: s[h], away: s[a] })))];
  const div: Slot[] = games(20).map(asSlot); while (div.length < 2) div.push({});
  const cc: Slot[] = games(21).map(asSlot); if (!cc.length) cc.push({});
  return { wc, div, cc, seedOf, st };
}

const winnerOf = (g?: Game) => (g?.result ? (g.result.hs >= g.result.as ? g.home : g.away) : undefined);

export function BracketScreen() {
  const L = useApp().league!;
  // In the offseason, show the playoffs that just finished.
  const inSeason = L.phase === 'regular' || L.phase === 'playoffs';
  const lastSb = L.games.filter(g => g.week === 22 && g.result).sort((a, b) => b.season - a.season)[0];
  const season = inSeason || !lastSb ? L.season : lastSb.season;
  const afc = confRounds(L, 'AFC', season), nfc = confRounds(L, 'NFC', season);
  const sb = L.games.find(g => g.season === season && g.week === 22);
  const champ = winnerOf(sb);
  const live = L.games.some(g => g.season === season && g.week > REG_WEEKS);
  const label = !live ? (L.phase === 'regular' ? `Projected · if the season ended after week ${Math.min(L.week, REG_WEEKS)}` : 'Projected · from last season\'s order') : champ ? 'Final' : ROUND_NAME[L.week] ? `${ROUND_NAME[L.week]} round` : 'Playoffs';
  // Teams on the user's path: every playoff game they are in.
  const mine = (sl: Slot) => sl.home === L.user || sl.away === L.user;
  const col = (title: string, slots: Slot[], r: ReturnType<typeof confRounds>, k: number, side: 'l' | 'r') => (
    <div className={`br-col br-${side}`} style={{ '--d': `${k * 0.12}s` } as CSSProperties}>
      <h5>{title}</h5>
      <div className="br-slots">{slots.map((sl, i) => <Match key={i} L={L} sl={sl} seedOf={r.seedOf} mine={mine(sl)} season={season} />)}</div>
    </div>
  );
  return (
    <div className="br">
      <div className="br-head">
        <div><span className="up">{season} Playoffs</span><div className="h1">Road to the Super Bowl</div><span className="dim small">{label}</span></div>
        {champ && <div className="br-champ" style={{ '--tc': vivid(L.teams[champ].colors[0]) } as CSSProperties}><Logo team={L.teams[champ]} size={54} /><div><span className="up">World Champions</span><b>{L.teams[champ].name}</b></div></div>}
      </div>
      <div className="br-board">
        {col('Wild Card', afc.wc, afc, 0, 'l')}
        {col('Divisional', afc.div, afc, 1, 'l')}
        {col('AFC Championship', afc.cc, afc, 2, 'l')}
        <div className="br-col br-sb" style={{ '--d': '0.36s' } as CSSProperties}>
          <h5>Super Bowl</h5>
          <div className="br-trophy"><svg viewBox="0 0 40 64" width="44" height="70"><path d="M20 2c7 0 12 5 12 13 0 9-5 16-9 20v12h5v4H12v-4h5V35c-4-4-9-11-9-20C8 7 13 2 20 2z" fill="url(#lg)" /><rect x="10" y="53" width="20" height="9" rx="1" fill="#5a5f6a" /><defs><linearGradient id="lg" x1="0" x2="1"><stop offset="0" stopColor="#c99a2e" /><stop offset=".5" stopColor="#fff1b8" /><stop offset="1" stopColor="#b5861f" /></linearGradient></defs></svg></div>
          <div className="br-slots"><Match L={L} sl={sb ? { home: sb.home, away: sb.away, game: sb } : {}} seedOf={a => (a ? (L.teams[a].conf === 'AFC' ? afc : nfc).seedOf(a) : 0)} mine={!!sb && (sb.home === L.user || sb.away === L.user)} season={season} big /></div>
        </div>
        {col('NFC Championship', nfc.cc, nfc, 2, 'r')}
        {col('Divisional', nfc.div, nfc, 1, 'r')}
        {col('Wild Card', nfc.wc, nfc, 0, 'r')}
      </div>
      <div className="br-foot small mute">The top seed in each conference has a bye. After the Wild Card round the best remaining seed plays the lowest. Click a team to open it.</div>
    </div>
  );
}

function Match({ L, sl, seedOf, mine, big, season }: { L: League; sl: Slot; seedOf: (a?: string) => number; mine: boolean; big?: boolean; season: number }) {
  const w = winnerOf(sl.game);
  const thisWeek = sl.game && !sl.game.result && sl.game.week === L.week && sl.game.season === L.season;
  const rows = [sl.home, sl.away].filter(Boolean).sort((a, b) => seedOf(a) - seedOf(b)) as string[];
  const score = (a: string) => (sl.game?.result ? (a === sl.game.home ? sl.game.result.hs : sl.game.result.as) : undefined);
  if (!rows.length) return <div className={`br-m tbd${big ? ' big' : ''}`}><div className="br-t"><span className="br-seed" /><i className="br-logo" /><span className="br-n">TBD</span></div><div className="br-t"><span className="br-seed" /><i className="br-logo" /><span className="br-n">TBD</span></div></div>;
  return (
    <div className={`br-m${mine ? ' mine' : ''}${big ? ' big' : ''}${sl.bye ? ' bye' : ''}${thisWeek ? ' now' : ''}`}>
      {rows.map(a => { const t = L.teams[a]; return (
        <button key={a} className={`br-t${w === a ? ' win' : w ? ' out' : ''}${a === L.user ? ' me' : ''}`} style={{ '--tc': vivid(t.colors[0]) } as CSSProperties} onClick={() => app.go({ id: 'team', team: a })}>
          <span className="br-seed">{seedOf(a) || ''}</span><Logo team={t} size={big ? 30 : 22} /><span className="br-n">{t.nick}</span>
          <span className="br-s">{score(a) ?? (sl.game ? '' : standingsLine(L, a, season))}</span>
        </button>); })}
      {sl.bye && <div className="br-t br-byeline"><span className="br-n">First-round bye</span></div>}
      {thisWeek && <span className="br-now">This week</span>}
      {sl.game?.result && <span className="br-fin">Final{sl.game.result.ot ? '/OT' : ''}</span>}
    </div>
  );
}
const standingsLine = (L: League, a: string, season: number) => { const s = standings(L, season)[a]; return `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}`; };
