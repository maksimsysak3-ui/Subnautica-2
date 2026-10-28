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

## Track Builder
A separate 3D circuit editor with a drivable F1 car: `track-builder.html` (one self-contained page, Three.js from a CDN).

**Play:** https://raw.githack.com/maksimsysak3-ui/Subnautica-2/claude/nfl-gm-sim/track-builder.html

- **Build.** Click to lay out a spline track, close it by clicking or dragging onto the start point, then set elevation, width and banking per point. Paint kerbs (flat or raised) and run-off (asphalt, gravel, grass) along either edge, or generate them for every corner. Barriers, grandstands, pit building and forests are placed around the layout automatically.
- **Drive.** Start lights, lap and sector timing, track limits, best laps saved per track. The car is the F4 racer's F1 (body and physics, from `maksimsysak3-ui/F4`) at full size: rigid-body car with raycast suspension, slip-based tyres, gearbox and OFF / SPORT / FULL assists. Chase, far, onboard and TV cameras. Keyboard or gamepad.
- **Dress it.** Design sponsors (16 built in: text, tagline, colours, six layouts, icons) and paint them onto walls of any height along the track. Place 125+ hand-modelled props from a searchable palette: trees, road cars and trucks, billboards, overhead banners, LED screens, ten grandstand types, pit walls and garages, houses, factories, skyscrapers and landmarks. Sponsor props take any sponsor; props are solid to the car.
- **Racing line.** A minimum-curvature line with a speed profile is generated from the layout: green to accelerate, yellow at the limit, red to brake (L to toggle).
- **Keep.** Autosaves in the browser, named saves, JSON export and import, undo and redo.

Source lives in `track/src/` and is stitched into the page by `npm run build:track`.

## Develop
```
npm install
npm run data       # rebuild src/data/league.json from nflverse
npm run dev        # local dev server
npm run build      # single-file build to play/index.html
npm run calibrate  # league-wide sim rates vs real NFL
npx tsx tools/franchise-test.ts 8   # eight full seasons, every phase
```
