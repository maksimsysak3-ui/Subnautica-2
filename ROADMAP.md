# SALT & TIDE — Roadmap

**Current: v1.0** — a hand-written WebGL2 coastal life-sim in a single self-contained
HTML file. Sailing, first-person helm, seasonal fishing with a skill-based fight,
region sea-monsters, a 3D home port + trade hub, a chaptered campaign with reputation,
an R&D tech tree, boat maintenance, tides & currents.

This roadmap is grouped by size. Version tags are a suggestion, not a promise.
Each item notes what it touches so we can pick one up cold tomorrow.

---

## 🔧 Minor — patches, bug fixes, QoL (v1.0.x)

1. **Fight-mechanic polish & fixes** *(bugfix/QoL)*
   Handle reeling up (Space) mid-fight cleanly — offer "cut the line" instead of a
   silent abandon; stop a fight being dropped without feedback on region change; add a
   sharper "HOOKED!" cue and a reel sound that rises with tension.

2. **Make Sonar actually do something** *(bugfix — dead feature)*
   The Sonar upgrade / research node only says "sees depth bands" today. Render the
   fish's preferred depth-band guides underwater and off-screen fish arrows so it pays off.

3. **Save safety & settings** *(QoL)*
   Schema-version the save, add "Reset save" to pause, guard against corrupt data, and a
   Settings panel: volume slider, screen-shake intensity, reduce-motion, colourblind-safe palette.

4. **Balance pass** *(improvement)*
   Tune RP gain vs. tree cost, monster threat ramp, current strength, and the fish
   size/season weighting so the early game isn't punishing and the (now much harder) late
   goals feel fair. Also re-check fuel economy against the bigger, denser maps.

5. **Hold & market QoL** *(QoL)*
   Sort the hold, one-tap "sell all" / "sell all but new records", stack duplicate fish,
   and show total hold value at a glance.

6. **Monster mesh cleanup** *(polish/bugfix)*
   Brighten and re-silhouette the Verge angler (too dark to read), smooth the shark, and
   add emissive eyes/lure so all four read clearly at distance.

7. **First-time tutorial hints** *(QoL/onboarding)*
   Contextual one-shot tips on the first fish, first storm, first "the deep stirs",
   first dock — so new players learn the many systems gradually.

8. **Compass & nav readability** *(minor addition)*
   Add a distance-to-next-port marker, wind indicator on the compass, and a subtle
   "riding the current / fighting it" tint so navigation reads at a glance.

---

## ⚓ Medium — content upgrades & better systems (v1.x)

9. **Tackle & Rigs crafting** *(bigger upgrade — feeds the fight)*
   Craftable rods / reels / lines / hooks / bait with a **strength-vs-stretch** tradeoff:
   light line = more bites but snaps on the big runs, heavy line survives but spooks the
   wary. A loadout screen; matches straight into the tension/fight and season/depth.

10. **Shoals, sandbars & tide windows** *(gameplay depth)*
    Low tide exposes shoals you can run aground on, and opens/closes specific fishing
    spots — reading the tide chart becomes real seamanship, not just a bite modifier.

11. **Menu / HUD / map overhaul v2** *(polish + UX)*
    Unify panel styling with animated transitions, a proper zoomable world-map screen
    showing your position, route and charted ports, and a cleaner, less crowded top HUD.

12. **Home-port depth II** *(content upgrade to original feature)*
    More structures (shipyard for at-home repairs, tavern for crew & rumours, gardens/
    statues), building paint/style customization, and a "manage" camera you can pan
    around your growing harbour.

13. **Weather & sea overhaul** *(gameplay + spectacle)*
    Real wind you tack into/against, rogue waves, lightning strikes that can hit your
    mast, and season set-pieces — winter ice floes, summer heat-shimmer, autumn fog banks.

14. **Living economy & rival captains** *(economy overhaul)*
    Prices react to your trades (flood a market and it crashes), rival trader boats
    compete for contracts and routes, timed contracts with penalties, and a risk/reward
    black market.

15. **Fish behaviour & AI upgrade** *(makes the world feel alive)*
    Real bait-balls and schooling, predators chasing prey, day/night feeding patterns,
    and fish that learn to avoid a lure you've spooked them with.

16. **Audio & music pass** *(polish)*
    A fuller synthesized soundtrack that shifts by region/season/danger, better SFX for
    reeling, snapping, storms and the monster, and an ambient layer per coast.

---

## 🌊 Major — giant content drops & overhauls (v2.0+)

17. **Deep-Sea Monster Hunts** *(headline endgame)*
    Go on the offensive: multi-phase boss fights against each coast's leviathan that
    demand the right gear, bait, weather **and** season lined up — harpoon/gaff mechanics,
    the monster fighting back, huge rewards and mounted trophies at your home port.

18. **A 5th region + true ending — "The Sunken Deep"** *(giant content drop)*
    A hidden post-Verge abyss with unique bioluminescent fish, its own apex horror,
    environmental hazards (pressure, dark, no compass), and a story climax with a real ending.

19. **Crew & a bigger vessel** *(systems overhaul)*
    Hire named crew with perks, morale and wages; assign roles (spotter, engineer, cook)
    that unlock abilities; and graduate from the skiff to a multi-deck trawler.

20. **First-person "walk the boat & port"** *(major mode)*
    Step off the helm and walk your deck and home harbour in first person — talk to
    characters and crew, operate structures, inspect your catch and trophies up close.

21. **Procedural world & New Game+** *(replayability overhaul)*
    Procedurally generated islets, ports and coast layouts for fresh voyages, plus a
    New Game+ that carries research/prestige into a tougher, richer run.

22. **Records, photo mode & cosmetics** *(meta layer)*
    A cinematic photo mode, a global/records leaderboard for biggest catches, and
    unlockable cosmetics — boat skins, sails, flags, figureheads and lighthouse styles.

---

### Suggested order for tomorrow
Start with a **Minor patch batch** (1–4: fight fixes, sonar payoff, save/settings,
balance) to harden 1.0 into a solid **v1.0.1**, then pick **one Medium** to headline the
day — **#9 Tackle & Rigs** is the highest-leverage since it deepens the fight you already
built. Save a **Major** (**#17 Monster Hunts** or **#18 the 5th region**) for when we
want a big content day.
