# City Builder — Technical Plan, Budgets & Hard Caps

Status: planning. Nothing implemented yet.
Scope: a Cities: Skylines–class city builder. Multi-year project, small team.

---

## 0. The honest part first

Read this section before the fun parts.

**What actually kills city-builder clones** (in order of how often it happens):

1. **Agent simulation cost.** Not rendering. Not art. The moment you have
   50k citizens each wanting a path, you are doing tens of thousands of graph
   searches per minute over a graph that keeps changing under you.
2. **Content volume.** CS1 shipped with ~1000 assets. At 2-3k tris + custom
   code per asset, hand-authored, you are looking at 4-16 hours per asset
   including LODs, textures, and gameplay code. 200 assets = roughly a
   person-year. This is the single biggest schedule risk and it is *art*, not code.
3. **Road/network geometry.** Curved roads with correct intersections,
   elevation, bridges, and auto-generated lane graphs is a genuinely hard
   6-12 month subsystem on its own. Most clones die here.
4. **Save/load and determinism.** Bolted on late = rewrite.

**Things that are cheaper than they look:** terrain, zoning, the economy
model, UI, camera, water as a visual.

**Things that are more expensive than they look:** intersections, traffic
lights, path invalidation when a road is deleted mid-path, transit lines,
LOD authoring, and the asset pipeline you asked about.

### Hard caps (be brutal about these)

Set these as build-time asserts, not aspirations. When you exceed them, the
game does not "run a bit slower" — it falls off a cliff.

| Budget | Web (WebGL2) | Web (WebGPU) | Native (Unity/Godot/custom) |
|---|---|---|---|
| Draw calls / frame | 1,500 | 4,000 | 6,000 |
| Triangles / frame | 3–5 M | 8–12 M | 20 M |
| Simulated citizens | 20k | 60k | 150k |
| Concurrently *moving* vehicles | 1.5k | 4k | 10k |
| Path requests served / sec | 300 | 1,000 | 3,000 |
| Sim budget / tick | 6 ms | 6 ms | 6 ms |
| Path budget / tick | 2 ms | 2 ms | 2 ms |
| Total heap | 1.5 GB (JS/WASM ceiling ~4GB, but GC pain well before) | 2 GB | 8 GB |
| Loaded asset prototypes | 400 | 800 | 2,000 |
| Texture memory | 512 MB | 1 GB | 4 GB |
| Save file | 50 MB | 50 MB | 200 MB |
| Map size | 4 km² (17km² tiled) | 9 km² | 25 km² |

Reference point: **CS1 caps agents at 65,536** and it is a native C#/Unity
game with a decade of optimization. If you are on the web, assume you get
**a quarter of that at best.** Design the simulation so that number is a
tunable, not an assumption baked into 40 files.

**Decision you must make in month 1, not month 12:** web or native. It
changes every number above by 3-5x. My recommendation: if this is a
"months-to-years, learn deeply, ship something playable" project — **build
it on the web with WebGPU + TypeScript + WASM for hot loops.** You get
instant distribution, zero install friction, and the constraint forces
better architecture. Accept 20-40k agents as the ceiling and design the
simulation to *fake* the rest convincingly (see §3.4).

### Measured (M0 step 4)

The table above was written from experience, not measurement. This section is
where it gets corrected. Run `?bench` on the live build and paste the table.

| | |
|---|---|
| Buildings in the world | 102,000 (440 × 440 cells at 8 m, three footprint passes) |
| Instance data | 4.7 MiB, 48 bytes each |
| Terrain | 6 km², 576 chunks, 627k vertices, 14.4 MiB |
| Draw calls | 2 for the whole city, plus one per visible terrain chunk |
| Culling | compute shader, one thread per building, two indirect draws |
| Typical survivors | ~20-60k of 102k, depending on altitude |

Frame times: **not yet measured on real hardware.** The only numbers available
so far come from a software rasteriser in CI, which is not representative of
anything. Until `?bench` has been run on a real GPU, treat every millisecond
figure in the budget table as a guess.

What the CI run does establish is correctness rather than speed: the cull pass
reduces 102k instances to ~22k at a street-level camera, splits them across two
LODs, and the frame still renders.

---

## 1. Architecture

### 1.1 Layer cake

```
┌──────────────────────────────────────────────┐
│ UI  (React / immediate-mode) — never touches sim state directly
├──────────────────────────────────────────────┤
│ Presentation: renderer, LOD, instancing, camera, audio
│   reads a *snapshot* of sim state, writes nothing
├──────────────────────────────────────────────┤
│ Simulation (fixed tick, deterministic, no floats-from-time)
│   ├ Networks (roads, rails, pipes, power)
│   ├ Buildings & zoning
│   ├ Agents (citizens, vehicles)
│   ├ Economy / services / land value
│   └ Pathfinding service (async, budgeted)
├──────────────────────────────────────────────┤
│ Data: ECS store, asset registry, save/load
└──────────────────────────────────────────────┘
```

**Rule that saves your life:** the simulation must be able to run headless,
with the renderer deleted. Enforce it with a test that ticks 10,000 frames
with no GPU. If you can't, the layers have leaked.

### 1.2 ECS, and how much of it

Use a **struct-of-arrays ECS**. Not because it's fashionable — because 50k
citizens as JS objects is 50k GC-visible allocations and your frame times
will be a sawtooth.

```ts
// Not this:
class Citizen { home: Building; job: Building; age: number; ... }

// This:
const citizens = {
  count: 0,
  homeId:    new Uint32Array(MAX),
  jobId:     new Uint32Array(MAX),
  age:       new Uint8Array(MAX),
  state:     new Uint8Array(MAX),   // enum
  flags:     new Uint8Array(MAX),
  pathId:    new Uint32Array(MAX),  // index into path pool, 0 = none
}
```

Entity ids are `(index | generation << 24)` so stale references are
detectable. Deletion is swap-remove or a free-list — never `splice`.

This one decision is worth more than every other optimization combined.
Do it on day one; retrofitting it is a rewrite.

### 1.3 Fixed tick, decoupled render

- Sim runs at **10 Hz** (not 60). City builders do not need 60Hz simulation.
- Render at display rate, interpolating vehicle positions between the last
  two sim states.
- Game speed 1x/2x/3x = 10/20/30 sim ticks per second, *not* bigger deltas.
  Bigger deltas break determinism and physics.
- Every tick has a **budget in ms**. Systems that exceed it defer work to
  the next tick. Nothing is allowed to be unbounded.

```
tick():
  networks.update()      // budget 0.5ms  — usually no-op
  pathService.pump(2ms)  // serve N requests from queue
  agents.update()        // budget 3ms   — round-robin buckets
  buildings.update()     // budget 1ms   — 1/16th of buildings per tick
  economy.update()       // budget 0.5ms — runs once per 10 ticks
```

### 1.4 Determinism

Worth it. It gives you: replays, cheap netcode later, save files that are
just "seed + input log" for debugging, and reproducible bug reports.

Cost: no `Math.random()` (use a seeded PCG32 per system), no iteration over
hash maps in nondeterministic order, no float accumulation from wall-clock
time, no reading back GPU results into sim.

---

## 2. Pathfinding — the real problem

This is where the project lives or dies. Budget 4-6 months of iteration.

### 2.1 The graph

Don't path on the road *centerline*. Path on a **lane graph**.

- Each road segment generates N lane nodes per direction.
- Intersections generate **connection edges** between incoming and outgoing
  lanes (this is where left-turn restrictions, lights, and yields live).
- Separate graph layers, connected at transfer points:
  - `ROAD` (cars, buses, trucks)
  - `PEDESTRIAN` (sidewalks, crossings, paths)
  - `TRANSIT` (bus/metro/train lines — edges are *routes*, not geometry)
  - `SERVICE` (fire/police/ambulance — can use restricted lanes)
- Edge cost = `length / speedLimit * congestionMultiplier * typeMask`.

Node counts to expect: a dense 4km² city ≈ **150k-400k lane nodes**. That is
too big for naive A* at 300 requests/sec.

### 2.2 Hierarchical pathfinding (do this, not plain A*)

Partition the map into a fixed grid of **sectors** (e.g. 128m × 128m).

1. **Precompute**, per sector: the set of "gateway" nodes on its boundary,
   and the all-pairs cost between gateways *within* that sector.
2. **High-level search:** A* over the gateway graph. This graph is ~1-2%
   the size of the full one. A cross-city query touches maybe 200 nodes
   instead of 80,000.
3. **Low-level refinement:** only path in detail within the *first* sector.
   Refine subsequent sectors lazily, as the agent enters them.

Result: a cross-map path costs ~5-20µs instead of ~2-10ms. That's the
difference between 300 paths/sec and 50,000.

Reference algorithms worth reading, in order of usefulness to you:
**HPA\*** (Botea 2004) → the base idea. **CH / Contraction Hierarchies** →
faster but painful to update on graph change. **JPS** → grid-only, not
applicable to lane graphs. Start with HPA*.

### 2.3 Invalidation — the part everyone forgets

The player will bulldoze a road with 4,000 vehicles pathing through it.

- Give the graph a **version counter**, and each sector a version too.
- A path stores the sector versions it depends on.
- On road change: bump the affected sectors, recompute *only* those sectors'
  gateway tables (this is why sectors are small), and mark paths touching
  them as `STALE`.
- Stale agents don't all replan on the same tick — push them into the
  replan queue and let the budget drain it over several seconds. A car that
  keeps driving for 0.4s on a doomed path is invisible; a 900ms hitch is not.
- Agents whose *current edge* was deleted: teleport to nearest valid lane
  and replan. Ugly, but everyone does this, including CS.

### 2.4 Budgeted async service

```ts
pathService.request(agentId, from, to, mask, priority) -> ticket
```

- Priority queue: emergency vehicles > player-visible > offscreen.
- A ring buffer of requests, drained under a **strict ms budget** per tick.
- Results written into a **path pool** (flat `Uint32Array` of node ids +
  offsets table), never per-path arrays.
- If the queue backs up beyond N, agents fall back to a **cached
  "typical" path** for their OD pair, or just despawn and respawn at
  destination. The player cannot tell.
- Run it in a **Web Worker / job thread** with SharedArrayBuffer. The graph
  is read-mostly; use double-buffering on rebuild rather than locks.

### 2.5 Caching (huge multiplier)

- **OD cache:** key = `(fromSector, toSector, mask)`. Most trips are
  home→work→home over a small set of sector pairs. Hit rates of 70-90% are
  normal. Cache the high-level gateway path, refine locally per agent.
- **Reverse-path reuse:** the evening commute is the morning path reversed.
- **Path sharing:** 40 citizens leaving the same block for the same
  district get one shared path object, refcounted.

### 2.6 Pedestrians: use flow fields, not A*

For crowds moving to a small set of attractors (transit stops, plazas,
building entrances), compute a **flow field / Dijkstra map** per attractor
over the pedestrian grid, and have each pedestrian just read the gradient.
One field serves 10,000 pedestrians at ~zero per-agent cost. Recompute a
field only when its attractor set or the walkable graph changes.

### 2.7 Traffic movement (separate from pathfinding)

Pathfinding says *which lanes*; the traffic model says *where in the lane*.

- **IDM (Intelligent Driver Model)** for car-following — ~10 lines, produces
  believable acceleration, braking, and traffic waves.
- **MOBIL** for lane changes.
- Lanes as sorted lists of `(vehicleId, distanceAlongLane)`. Each vehicle
  only queries its immediate leader — O(1), not O(n²).
- Intersections: **phase-based traffic lights** (a fixed cycle per
  intersection) plus a simple **reservation** scheme for unsignalized ones.
  Do NOT do full continuous collision avoidance; it's expensive and looks
  worse than you'd think.
- Congestion feedback: each lane tracks rolling average speed; that feeds
  back into edge cost, so future paths route around jams. This one loop is
  where the whole "traffic simulation game" feeling comes from.

---

## 3. Agents & simulation

### 3.1 Don't simulate everyone all the time

The core trick, and CS uses it too:

| Tier | What's simulated | Count |
|---|---|---|
| **Full** | On-screen vehicles/pedestrians: position, path, physics | 1-4k |
| **Coarse** | Off-screen agents: exist on a path with an ETA, position lerped, no collision | 10-20k |
| **Statistical** | Everyone else: citizens are just rows in a building's aggregate — "this house has 4 people, 2 employed at X" — with no agent at all | ∞ |

Promotion/demotion between tiers happens on camera movement and is the main
reason the sim scales. A citizen only becomes a moving agent when its trip
would be *visible* or when it *matters* (it's the truck the factory needs).

### 3.2 Citizen model

Keep it thin. Per citizen: `home, workplace, age band, education, health,
happiness, currentActivity, flags`. That's ~16 bytes. 100k citizens = 1.6MB.
Do not give them names, inventories, or a life story until v2 — that's a
10x memory multiplier for a tooltip.

Agent state machine: `AT_HOME → COMMUTING → AT_WORK → SHOPPING →
COMMUTING → AT_HOME`, driven by a per-citizen schedule offset so the whole
city doesn't leave at once.

### 3.3 Round-robin updating

Never update all agents every tick. Bucket them:

```ts
const bucket = tickCount & 15;         // 16 buckets
for (i = bucket; i < count; i += 16)   // each agent updates at 0.6Hz
```

Position interpolation covers the gap. Emergency/visible agents go in a
"hot" set updated every tick.

### 3.4 Faking convincingly

- Vehicles on distant roads: spawn/despawn at the screen edge with plausible
  density derived from the lane's congestion value. No path, no destination.
- Pedestrians beyond ~300m: not spawned at all.
- Building activity (lights on, smoke, people entering) driven by the
  *statistical* tier, not real agents.

Players judge "aliveness" by density and variety, not by whether the car
they see actually has a job to get to.

---

## 4. Buildings & the asset pipeline

Your instinct — author a heavy, detailed asset with its own code, then bake
many of them into a pack — is right. Here's how to make it not explode.

### 4.1 Triangle budget: be careful with "2-3k+"

2-3k tris per building is a fine *LOD0* target. But:

- 2,000 buildings on screen × 2,500 tris = **5M tris** — that's your entire
  web frame budget on buildings alone, with nothing left for terrain, roads,
  vehicles, trees, or shadows.
- So: 2-3k tris is the *close-up* mesh. **LODs are mandatory, not optional.**

| LOD | Distance | Tris | Notes |
|---|---|---|---|
| LOD0 | 0-80m | 2,000-3,000 | full detail, the one you author |
| LOD1 | 80-250m | 400-600 | auto-decimated |
| LOD2 | 250-600m | 80-150 | auto-decimated, silhouette only |
| IMPOSTOR | 600m+ | 2 (billboard) | baked octahedral atlas |

**Generate LOD1/LOD2 automatically** (meshoptimizer's simplifier, or
Blender's decimate via a headless script) in the build step. Hand-authoring
4 LODs per asset is what turns a 200-asset library into a 4-year project.

Realistic per-asset effort with a good pipeline: **4-8 hours** (model,
UV, one texture set, gameplay config). Without automation: 12-20.

### 4.2 The asset pack format

An asset **prototype** = mesh(es) + material + a JSON descriptor + optional
behavior script. A **pack** = many prototypes in one binary + one manifest.

```
assets/
  src/                          # authoring — never shipped
    residential/
      brick_lowrise_01/
        model.blend
        albedo.png  normal.png  arm.png   # AO/Rough/Metal packed
        asset.json                        # gameplay descriptor
        behavior.ts                       # optional per-asset code
  build/
    packs/
      residential.pack          # binary: meshes + baked LODs
      residential.atlas.ktx2    # BC7/ASTC texture array
      residential.manifest.json # id → offsets, bounds, props
```

`asset.json` — the gameplay half, and the more important one:

```jsonc
{
  "id": "res.brick_lowrise_01",
  "category": "residential",
  "level": 2,                     // wealth/density tier
  "footprint": [2, 3],            // in 8m zoning cells
  "height": 14.5,
  "mesh": "model.glb#Mesh0",
  "props": [                      // sub-meshes instanced separately
    { "id": "prop.ac_unit", "at": [1.2, 12.0, 0.4] },
    { "id": "prop.streetlamp", "at": [-2.0, 0, 1.0] }
  ],
  "attach": {                     // where agents/effects hook in
    "entrance": [0, 0, -1.5],
    "parking":  [[2.5, 0, 1.0]],
    "smoke":    []
  },
  "sim": {
    "households": 8,
    "jobs": 0,
    "powerKW": 12,
    "waterM3": 4,
    "garbagePerWeek": 60,
    "pollution": 0,
    "landValueBonus": 3,
    "upkeep": 40
  },
  "spawn": {                      // when the game may place it
    "requires": ["road_access", "power", "water"],
    "landValue": [20, 60],
    "weight": 1.0
  },
  "behavior": "behavior.ts"       // optional
}
```

### 4.3 Per-asset code — keep it sandboxed and optional

Your "code for 1 asset" idea is good but is the classic place where a
codebase rots. Constrain it:

- An asset behavior is a **pure, small module** implementing a fixed
  interface. It gets a narrow handle, not the world.
- It **cannot** allocate per-frame, cannot query the ECS globally, cannot
  path. It reacts to events.

```ts
export default {
  onPlaced(b: BuildingHandle) { b.emitters.add("chimney_smoke"); },
  onTick(b, dt) { b.setLightsOn(b.time.isNight && b.occupancy > 0); },
  onLevelUp(b, level) { b.swapMesh(`res.brick_lowrise_01.l${level}`); },
  onDemolished(b) {}
}
```

- Behaviors run in the **coarse tick** (once per second), not every frame.
- If a behavior throws, catch it, log the asset id, disable that behavior,
  keep the game running. One bad mod must never crash a 6-hour city.

### 4.4 Rendering buildings: instancing is the whole game

- **One draw call per (prototype, LOD)**, not per building. GPU instancing
  with a per-instance buffer of `mat4 transform + uint variantColor + uint flags`.
- Buildings are static: build the instance buffers once, update only on
  place/demolish/level-up. Keep a dirty-range list; upload sub-ranges.
- Put all textures for a pack in a **texture array** (same dimensions,
  e.g. 1024², BC7/ASTC) so an entire pack renders in a handful of draw calls.
- **Merge distant chunks:** for anything past LOD2, bake a 256m chunk's
  buildings into one static merged mesh, regenerated on a background job
  when the chunk changes. Distant city = ~50 draw calls, not 5,000.
- Colour/material variation via a per-instance hue/roughness tint so 30
  copies of one house don't read as 30 copies.

### 4.5 Streaming & memory

- Packs load lazily by category as zoning unlocks them.
- Meshes go into **one big shared vertex/index buffer** per pack; prototypes
  are `(firstIndex, indexCount, baseVertex)`. This is what makes multi-draw
  indirect possible later.
- Texture memory is the real ceiling. 400 prototypes × (1024² BC7 albedo +
  normal + ARM) ≈ 400 × 2.7MB ≈ **1.1 GB**. Over budget on web. Fix by:
  512² for anything not hero-scale, shared atlases across similar buildings,
  and dropping normal maps on LOD2+.

### 4.6 Hot reload

Non-negotiable for a multi-year project. Watch `assets/src/`, rebuild the
one changed prototype, hot-swap it in a running city. If iterating on a
building takes 90 seconds, you will make 200 buildings. If it takes 3
seconds, you will make 800.

---

## 5. Networks (roads) — the sleeper hard problem

Budget more time than you think. Rough order:

1. **Segments as cubic Bezier / arc splines** with a start node, end node,
   and control points. Snapping to angles and existing nodes.
2. **Mesh generation:** sweep a cross-section profile along the spline;
   subdivide by curvature. Cache per segment; regenerate only the touched
   segments.
3. **Intersections:** the hard part. Given N incoming segments at a node,
   generate the junction polygon, trim each segment back, and fill. Start
   with "cut each road back to a circle and fill with a fan" — ugly but
   works — and improve later.
4. **Lane graph generation:** derive from the profile automatically. This is
   the output pathfinding consumes; it must regenerate incrementally.
5. Elevation, bridges, tunnels — a whole extra project. Defer to year 2.

Suggestion: **flat, right-angle-ish roads only for the first year.** Curves
and elevation triple the complexity of every downstream system.

---

## 6. Roadmap

Each milestone should be *playable*. Never spend 3 months on something you
can't click.

**M0 — Skeleton (1-2 months)**
Camera, terrain (heightmap + chunked mesh), ECS store, fixed tick loop,
save/load, a debug overlay showing every budget in ms. No gameplay.
*Exit test: 10k dummy entities moving, 60fps, headless sim test passes.*

**M1 — Roads (2-3 months)**
Straight-segment roads, node merging, lane graph generation, road mesh.
*Exit test: build a 200-segment grid, lane graph regenerates in <5ms.*

**M2 — Pathfinding (2-3 months)**
Sectored HPA*, worker-threaded, budgeted, invalidation, OD cache.
Debug view that draws a path and its sector hierarchy.
*Exit test: 1,000 paths/sec across a 300k-node graph, no frame over 20ms.*

**M3 — Traffic (2 months)**
IDM + lane changes + traffic lights + congestion feedback into edge cost.
*Exit test: 2,000 vehicles, visible jams that resolve when you add a lane.*

**M4 — Zoning & buildings (2-3 months)**
Zoning grid, demand model, building spawn/despawn/level-up, the asset
pipeline from §4 end to end with ~20 placeholder assets.
*Exit test: draw roads, zone, watch a city grow unattended for 30 min.*

**M5 — Citizens & services (2-3 months)**
Citizen agents, the three-tier sim, jobs, power/water/garbage, happiness.
*Exit test: 20k citizens at 60fps.*

**M6 — Content & polish (open-ended, this is the years part)**
Transit, more assets, districts, policies, sound, UI, tutorial, mod support.

Rough total to something genuinely playable: **12-18 months** of consistent
part-time work. To something people would pay for: 3-4 years or a team.

---

## 7. Tech recommendations

- **Language:** TypeScript for systems + Rust→WASM for pathfinding and
  traffic inner loops. Don't start in WASM; port the hot loop once it's a
  proven bottleneck with a profile to prove it.
- **Renderer:** WebGPU directly, or `three.js` with heavy custom instancing.
  Honestly — write the renderer yourself. Generic scene graphs are the wrong
  shape for "500k static instanced objects" and you'll fight the library.
- **Threading:** Web Workers + SharedArrayBuffer (needs COOP/COEP headers).
- **Assets:** Blender + a Python export script → glTF → custom packer
  (meshoptimizer for simplification + compression, KTX2/Basis for textures).
- **Alternative if the web caps hurt too much:** Godot 4 with C#, or Unity
  with DOTS/Burst. Unity DOTS is genuinely built for exactly this problem
  and would be the pragmatic choice if the goal is the *game* rather than
  the *engine*.

---

## 8. Instrumentation — build this in M0

- Per-system ms, drawn as a stacked graph, always toggleable.
- Counters: entities, agents by tier, path requests queued/served/failed,
  cache hit rate, draw calls, tris, instance buffer uploads.
- A "torture save": a 100k-citizen city checked into the repo, plus a
  benchmark that replays 60s of it and fails CI if any budget regresses.
  Add this before the city gets big, not after.

---

## 9. Ten things to decide before writing code

1. Web or native. (Everything above scales from this.)
2. Max citizens. Pick a number, assert it.
3. Grid-locked or free-form roads. (Grid-locked = 3x less work.)
4. Cell size for zoning (8m is a good default).
5. Is the sim deterministic? (Say yes.)
6. Is the sim headless-runnable? (Say yes.)
7. Sim tick rate (10Hz recommended).
8. Sector size for hierarchical pathfinding (128m).
9. Asset authoring tool — pick one, commit, write the exporter.
10. Whether modding/user assets is a v1 goal. If yes, the pack format and
    behavior sandbox must be public API from day one.

---

## 10. Asset library, as built

The library is 151 procedural assets: 95 zoned buildings, 44 service
buildings across nine branches, and 12 vehicles and crowds. Everything below is
generated from code in `src/assets/generators/` — no modelling package, no
textures, no UV unwrapping. `asset.html` is the viewer; `node
tools/asset-sheet.mjs out.png 0 <filter> [street]` renders a contact sheet
offscreen, which is the only way to review this kind of work in a container
with no GPU.

| zone | count | range |
| --- | --- | --- |
| residential | 35 | farmhouse → 20-storey clad tower |
| commercial | 25 | takeaway row → department store |
| office | 15 | office pavilion → 112 m tower |
| industrial | 20 | craft units → chemical works |
| service | 44 | nine branches, below |
| fleet | 12 | ten road vehicles, pedestrians, cyclists |

Services are the nine branches a city builder needs: fire, police, health,
education, water, power, transport, government and parks, four to five
buildings each. They are held to a different rule from the zoned assets — a
service must not read as housing, which the asset test enforces by failing any
service asset that uses brick, tile, house wall or roof tile at all. Their
vocabulary is the civic one instead: colonnades, barrel roofs, ribbon glazing
between fins, drill towers, tanks, lattice masts and gantries.

Budget: 1,000 triangles minimum for a zoned asset (below that it has not been
detailed and it shows next to its neighbours) and 2,400 for a service, since
services sit alone on their plot with nothing beside them to carry the eye;
12,000 maximum.

The fleet is not zoned and not placed by the player: it is what will sit on
the roads and pavements once traffic exists, kept in the library so it is
reviewed at the same fidelity as everything else. It has its own viewer tab
and deliberately no icon, since it is not something to paint on the map. Car
bodies are lofted through cross-sections rather than assembled from boxes, and
both `PAINT` and `FIGURE` take their colour from a per-part key rather than the
asset seed, so one draw call holds ten cars in ten colours or a crowd in a
dozen coats.

Two tools guard the parts of this that cannot be eyeballed across a hundred
and fifty assets. `node tools/asset-audit.mjs` voxelises each asset and reports
parts hanging in the air with nothing under or beside them, and flat roofs with
nothing standing on them; `dressRoof` fixes the second class by finding the
roof from the mesh rather than being handed coordinates the generator would
have to restate. Three
LODs each, generated by the same function with detail flags off rather than by
decimation — a decimated building loses its window frames first, which is
exactly the thing you can still see at distance.

### 10.1 What each asset is made of

- **Materials** (`MAT` in `src/assets/mesh.ts`): brick, render, concrete,
  corrugated metal, stone, cladding, timber, pitched roof tile, flat roof
  membrane, curtain wall, shopfront glazing, and a single-pane material that
  carries 0..1 coordinates so the shader can put a room behind one window.
  Each picks its colour from a ramp indexed by the building's seed, so a
  street of one prototype is not a street of clones.
- **Tints** (`TINT`): a small palette slot per vertex — brand, accent, door,
  awning, ironwork, timber, planting. This is how one shopfront generator
  makes a green grocer and a red diner.
- **Parts** (`src/assets/parts.ts`): parapets, bands, eaves, chimney stacks,
  shopfronts, awnings, four kinds of sign, window grids, balconies, fire
  escapes, entrances, railings, backyards, frontage furniture.

### 10.2 Rules the library follows

- **No trees, no street planting.** Vegetation is placed in the game, not
  welded into a model that can then never be moved or removed.
- **Every building has a findable way in.** An entrance on the street
  elevation, clear of the frontage furniture, at a size a person could use.
- **Nothing is drawn behind a wall.** These walls have no holes cut in them,
  so glazing sits proud of the face and its frame's shadow does the work of
  the reveal. Getting this wrong once made every window in the library an
  empty frame showing brick.
- **Faces buried inside other solids are not emitted.** Window frames and wall
  slabs skip the face pressed against the wall behind them; it is 17% of the
  heaviest asset for no visual difference.

### 10.3 Zone identity

`src/ui/zones.ts` holds one colour code and one icon per zone, defined once so
the overlay, the toolbar and the demand bars cannot drift apart. Four steps
per zone (deep / base / light / wash) and an isometric icon built from the
same kind of boxes the buildings are. `node tools/zone-icons.mjs` writes them
to `public/zones/` with a legend sheet.

| zone | base |
| --- | --- |
| residential | `#3f9a55` |
| commercial | `#2f7fc1` |
| industrial | `#d09a2c` |
| office | `#2a9d9c` |
