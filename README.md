# Gridiron GM

An NFL franchise sim in the browser: real 2026 rosters, contracts, coaches and schedule,
Madden-style ratings built from real stats, and a play-by-play engine calibrated to NFL averages.

**Play:** https://raw.githack.com/maksimsysak3-ui/Subnautica-2/claude/nfl-gm-sim/play/index.html

## What is in it
- **Real league.** 2026 rosters, contracts (with void years), head coaches, stadiums and the schedule, from nflverse public data. Team logos and player headshots load from the NFL/ESPN CDNs.
- **Ratings from data.** Every player's overall comes from three seasons of box score, Next Gen Stats, PFR advanced stats and FTN charting, each metric scored against that season's elite and shrunk for small samples. Madden-style attributes, archetypes, development traits, Superstar abilities and X-Factors are built from each player's own stat profile. `tools/overrides.json` holds manual adjusters; an optional PFF grades CSV can be dropped into `.cache/pff_grades.csv`.
- **Play-by-play engine.** Pass rush vs protection, every route vs its defender, QB reads, accuracy by depth, YAC, run blocking vs the box, real clock and penalty rules, weather, injuries, Wear & Tear, X-Factor zones. 20 league rates (points, completion %, sack %, YPC, penalties, FG % ...) sit within tolerance of 2023-25 NFL averages (`npm run calibrate`).
- **Franchise.** Call plays live on a 3D field or sim; weekly strategy and practice; stat-driven XP growth; breakout and dud seasons; standings with tiebreakers; 14-team playoffs; awards and records; owner job security; coach ability tree.
- **Front office.** Trades valued on a draft-chart scale (picks matter), AI trades and offers; re-signing, franchise tags, restructures, post-June 1 cuts; multi-day free agency with player motivations; scouting, combine and a live draft day with AI boards; training camp, cutdowns, retirements, Hall of Fame, coaching carousel and NFL-formula schedules. A quantile anchor keeps the rating scale stable across decades.

## Develop
```
npm install
npm run data       # rebuild src/data/league.json from nflverse
npm run dev        # local dev server
npm run build      # single-file build to play/index.html
npm run calibrate  # league-wide sim rates vs real NFL
npx tsx tools/franchise-test.ts 8   # eight full seasons, every phase
```
