# BLACK MERIDIAN — Architecture & Team Contract

A single-player tactical operator game. You conduct deniable operations alone in
**Meridian Basin**, a fictional modern region, against cartels, insurgents,
syndicates and private military contractors.

## Quality bar

Every system is graded by an independent critic against a reference title.
"Works" is not the bar. The bar is:

| System | Reference | What "winning" means |
|---|---|---|
| Gunplay / weapon depth | Escape From Tarkov | Recoil you learn, attachments that matter, malfunctions, real ballistics |
| Tactical gameplay | Ready or Not | Room clearing has texture; every door is a decision |
| Realism / handling | Ground Branch | Weight, momentum, no arcade concessions |
| Mission freedom | Ghost Recon Wildlands | Multiple genuine approaches, readable open sites |
| Presentation | Modern Warfare | Camera, audio mix, UI polish, cinematic restraint |

## Tech stack

- **TypeScript**, strict mode. `npx tsc --noEmit` must pass before you finish.
- **Three.js r185** (WebGL2), **Vite**.
- **All assets are generated in code.** No binary art, no audio files, no
  external fetches. Low-poly art direction is a deliberate fit for procedural
  meshes; audio is Web Audio synthesis. This is a hard constraint — a CSP
  blocks external hosts, and the game must boot offline.

## Art direction

Low-poly geometry, modern AAA lighting. Flat-shaded faceted meshes, vertex
colours instead of textures, strong silhouettes, restrained palette (desert
ochre, concrete grey, gun-metal, one warm accent `#c8a355`). Readability is a
gameplay feature: the player must parse cover, threat and route at a glance.
Beauty comes from **light, atmosphere and composition**, not polygon count.

## Layout & ownership

Each team owns its directory outright. **Do not edit another team's files.**
If you need something from another system, it goes through `src/core/contracts.ts`.

```
src/core/       engine loop, event bus, contracts, math/RNG   [integration owner]
src/actors/     actor state, limbs, armour, damage model      [integration owner]
src/render/     renderer, post-process chain, quality tiers   [Graphics]
src/fx/         particles, decals, tracers, impacts           [VFX/Graphics]
src/lighting/   sun/moon/sky, shadows, volumetrics, lamps     [Lighting]
src/weather/    precipitation, wind, storm behaviour          [Weather]
src/world/      terrain, sites, buildings, navmesh, cover     [World design]
src/envart/     props, foliage, clutter, decals, biomes       [Environmental art]
src/weapons/    ballistics, recoil, attachments, damage       [Weapon systems]
src/weaponmodels/ procedural weapon meshes                    [Weapon models]
src/anim/       procedural animation, IK, viewmodel           [Animation]
src/audio/      synthesis, mixer, occlusion, reverb           [Audio]
src/ai/         perception, pathing, behaviour                [Enemy AI]
src/tactics/    cover use, suppression, room clearing, morale [Tactical behaviour]
src/missions/   generator, objectives, director               [Mission generation]
src/player/     controller, stance, movement, health          [Player]
src/gear/       armour, drone, breaching, grenades            [Equipment]
src/progression/ XP, skills, unlocks, reputation              [Progression]
src/ui/         HUD, menus, planning map, gunsmith            [UI/UX]
src/story/      factions, lore, briefings, narrative          [Story]
src/perf/       profiler, LOD, culling, instancing            [Performance]
```

## How systems connect

Three rules, no exceptions:

1. **Implement a `System`** (`src/core/engine.ts`). Declare `id`, `order`
   (update order: 0 input → 10 sim → 20 gameplay → 30 anim → 40 audio → 50 ui
   → 60 render) and `initOrder` when startup dependencies differ from update
   order. Use `fixedUpdate` (locked 60 Hz, deterministic) for simulation and
   `update` (per frame) for presentation.

2. **Publish through `services`** (`src/core/contracts.ts`). Register your
   implementation with `services.register('world', this)`. Consume others with
   `services.get('render')`. Never import another team's concrete module.

3. **Talk through `bus`** (`src/core/events.ts`). Cross-system messages are
   typed events. If you need a new one, add it to `GameEvents`. Use `emit` for
   immediate delivery and `post` for deferred (safe during a physics step).

## Determinism

Mission generation, ballistics dispersion and world layout must be reproducible
from a seed. Use `Rng` and `Noise2D` from `src/core/math.ts` — never
`Math.random()` in generation code.

## Performance budgets

Target 60 fps at 1080p on a mid-range GPU. Declare `budgetMs` on your system;
the engine reports overruns via `perf:budgetExceeded`. Instance aggressively,
share materials and geometry, and never allocate `Vector3`s in a hot loop —
use module-scoped scratch objects.

Note: the headless capture harness runs on SwiftShader (software rendering), so
the fps it reports is *not* representative. Judge cost by draw calls, triangle
count and per-system `avgMs` instead.

## Showcase shots

Export shots from **your own directory** as `src/<yourdir>/shots.ts`:

```ts
import type { ShotDef } from '../core/capture-director';
export const shots: ShotDef[] = [ /* ... */ ];
```

The integration owner wires them into the director — this keeps sixteen teams
from editing one file. Every shot pins seed, hour, weather and camera so critics
compare like with like. Capture with:

```
node tools/screenshot.mjs --shots my-shot --out docs/shots/scratch
```

## Definition of done

- `npx tsc --noEmit` passes.
- The game still boots: `node tools/screenshot.mjs --shots env-street-level --out docs/shots/scratch`
  exits 0 with no console errors.
- Your system registers itself and is genuinely exercised in-game — not a
  library nothing calls.
- You report back: what to register in `src/main.ts`, which shots you added,
  and the honest remaining weaknesses in your system.
