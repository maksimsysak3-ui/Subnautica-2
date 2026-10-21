# Night Range — combat AI (standalone, not in the game yet)

- `core.mjs` — the AI (perception, memory, decisions, tactics, human aim model). No rendering, no three.js.
- `sim.mjs` — headless test bench. `node ai/sim.mjs` (full) or `node ai/sim.mjs quick`. `SEED_OFFSET=100000` re-runs on fresh seeds.
- `lab.template.html` + `build-lab.mjs` → `../ai-lab.html`, a top-down debug view where you can watch it or fight it.
- `last-run.txt` — output of the most recent full run.

## How it works
**It can't cheat.** Decisions read only the agent's own memory. Memory is filled by sight, hearing, being hit or snapped at, and squad callouts (delayed and imprecise). `perceive()` is the only code that touches other agents' true positions.

**Sight** builds up "noticing" over time from distance, light, angle off the gaze (foveal vs peripheral), how much of the body is exposed, motion, stance, suppression and skill. A muzzle flash is visible in the dark. A brief glimpse gives a rough position and draws its attention without confirming the target.

**Hearing** carries footsteps (sprint, run, walk, crouch, each with its own range), gunshots, reloads and impacts. Walls muffle sound, and the position estimate's error grows with distance.

**Beliefs** are kept per enemy: last position and velocity, confidence, and a source (sight, glimpse, gunshot, noise, incoming fire, callout). Uncertainty grows with time, and old information is forgotten.

**Decisions** use utility scoring with hysteresis, re-evaluated every 0.22–0.42 s like human decision latency. The actions are engage, hold an angle, take cover, reload, retreat, flank, suppress, search, roam (clear ground), patrol and idle.

**Tactics:**
- Cover spots must protect against where the threat might be, not just the best guess.
- Runs to cover use exposure-aware pathing, routed behind cover where possible.
- From low cover it peeks and ducks; at high cover it steps out to the edge.
- The squad suppresses with one agent while the other flanks.
- It searches likely hiding spots around the last known position.
- Experienced agents move through shadow and make "listening halts".

**Aim:**
- Reaction delay follows a log-normal distribution and is slower in the dark, when stressed, or when the target is off to the side.
- The flick toward a target is timed by Fitts' law (bigger, farther moves take longer) with a minimum-jerk motion profile and realistic overshoot or undershoot.
- Corrective sub-movements follow, then smooth pursuit with lag.
- Sway uses an Ornstein-Uhlenbeck noise model and gets worse when moving, hurt or suppressed.
- Recoil is fought imperfectly, and there's trigger flinch.
- Bursts follow trigger discipline, and novices spray.

**Profiles** are recruit, operator, veteran and player, varying skill, aggression, discipline and reaction.
