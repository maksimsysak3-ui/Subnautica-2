// FTN charting joined to nflverse play-by-play, reduced to per-player and
// per-team-unit season metrics for the ratings model.
import { readFileSync } from 'node:fs';
import { parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const bool = v => v === 'TRUE' || v === true || v === 1 || v === '1';

function parseCsvLines(text) {
  // FTN files have no quoted commas, so a plain split is safe and fast.
  const lines = text.split('\n');
  const head = lines.shift().split(',');
  return lines.filter(Boolean).map(l => {
    const c = l.split(',');
    return Object.fromEntries(head.map((h, i) => [h, c[i]]));
  });
}

/** Returns { players: Map(gsis -> metrics), teams: Map(team -> unit metrics) } for one season. */
export async function seasonCharting(year) {
  const b = readFileSync(`.cache/play_by_play_${year}.parquet`);
  const pbp = await parquetReadObjects({
    file: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), compressors,
    columns: ['game_id', 'play_id', 'season_type', 'posteam', 'passer_player_id', 'receiver_player_id', 'rusher_player_id', 'pass_attempt', 'rush_attempt', 'sack', 'qb_hit', 'qb_scramble', 'epa', 'yards_gained', 'two_point_attempt'],
  });
  const plays = new Map();
  for (const p of pbp) if (p.season_type === 'REG' && !p.two_point_attempt) plays.set(`${p.game_id}|${p.play_id}`, p);

  const players = new Map();
  const teams = new Map();
  const P = id => {
    let e = players.get(id);
    if (!e) players.set(id, (e = { att: 0, intWorthy: 0, catchable: 0, aimed: 0, faultSack: 0, sacks: 0, tgt: 0, catchableTgt: 0, drops: 0, contested: 0, contestedRec: 0, created: 0 }));
    return e;
  };
  const T = id => {
    let e = teams.get(id);
    if (!e) teams.set(id, (e = { dropbacks: 0, olSacks: 0, hits: 0, rushes: 0, rushEpa: 0, stuffs: 0 }));
    return e;
  };

  const ftn = parseCsvLines(readFileSync(`.cache/ftn_charting_${year}.csv`, 'utf8'));
  for (const f of ftn) {
    const p = plays.get(`${f.nflverse_game_id}|${f.nflverse_play_id}`);
    if (!p || !p.posteam) continue;
    const team = T(p.posteam);
    if (p.pass_attempt || p.sack) {
      team.dropbacks++;
      if (p.qb_hit) team.hits++;
      // Sacks the charting does not pin on the quarterback are the line's.
      if (p.sack && !bool(f.is_qb_fault_sack)) team.olSacks++;
      if (p.passer_player_id) {
        const q = P(p.passer_player_id);
        if (p.sack) { q.sacks++; if (bool(f.is_qb_fault_sack)) q.faultSack++; }
        else if (!bool(f.is_throw_away) && !bool(f.is_trick_play)) {
          q.att++;
          if (bool(f.is_interception_worthy)) q.intWorthy++;
          if (p.receiver_player_id) { q.aimed++; if (bool(f.is_catchable_ball)) q.catchable++; }
        }
      }
      if (p.receiver_player_id && !p.sack) {
        const r = P(p.receiver_player_id);
        r.tgt++;
        if (bool(f.is_catchable_ball)) { r.catchableTgt++; if (bool(f.is_drop)) r.drops++; }
        if (bool(f.is_contested_ball)) { r.contested++; if (p.yards_gained > 0 || bool(f.is_created_reception)) r.contestedRec++; }
        if (bool(f.is_created_reception)) r.created++;
      }
    } else if (p.rush_attempt && !p.qb_scramble && !bool(f.is_qb_sneak)) {
      team.rushes++;
      team.rushEpa += p.epa ?? 0;
      if ((p.yards_gained ?? 0) <= 0) team.stuffs++;
    }
  }
  return { players, teams };
}
