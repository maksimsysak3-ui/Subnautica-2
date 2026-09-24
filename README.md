# Meridian

A city builder on WebGPU. Draw the roads and zone the land; the people who
arrive decide the rest. Written in TypeScript with a hand-written renderer,
because a generic scene graph is the wrong shape for "a hundred thousand
instanced buildings, culled on the GPU every frame".

**Plan and budgets:** [`planning/CITY-SIM-DESIGN.md`](planning/CITY-SIM-DESIGN.md).
**Asset viewer:** [`/asset.html`](https://maksimsysak3-ui.github.io/Subnautica-2/asset.html).

### What is in it

- **A real simulation.** Citizens with homes, jobs and routines; traffic on a
  lane graph with junctions; power, water, sewage and rubbish on networks
  that follow the streets; buildings that grow, level up, fail and get
  condemned when nobody supplies them; an economy with taxes, ordinances,
  trade and a block grant that tapers off as the town finds its feet.
- **A linear HDR renderer.** Every surface writes linear light; one post
  chain is the camera: screen-space ambient occlusion, a six-level bloom,
  the ACES filmic curve, a time-of-day grade, FXAA and a light sharpen. Sun
  shadows fitted to the view, a lit cloud deck, a day and night cycle in
  which windows, signs, lamps and headlights are real emissive light.
- **Five hundred and forty assets**, all but the imported vehicles generated rather than
  modelled, each with three levels of detail and baked occlusion. The tall
  stock is built from single forms -- tapering glass shafts, a twisting
  tower, rippling balcony towers, masonry pier towers whose piers rise past
  the roof -- rather than boxes stacked on boxes.
- **Streets that look lived in**: kerbs, footways, crossings, lamp columns
  and avenue trees planted down every footway wide enough to take one,
  always clear of the carriageway.
- **Guided start**: a First Steps card walks a new town through housing,
  power, water, sewage and work, and the city says when homes are going
  without supply.
- **Feel**: an eased, cursor-anchored zoom and momentum on the camera, which
  also keeps itself out of buildings; a synthesised soundscape of wind,
  town hum, traffic, rain, birds and crickets; sounds for building.

Needs Chrome/Edge 113+, Safari 18+, or Firefox 141+ on Windows. Anything else
gets an explanation instead of a blank page.

## Play it

<https://maksimsysak3-ui.github.io/Subnautica-2/>

Needs Chrome/Edge 113+, Safari 18+, or Firefox 141+ on Windows. Anything else
gets an explanation instead of a blank page.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | Does |
|---|---|
| `npm run dev` | dev server, hot reload, COOP/COEP headers set |
| `npm run build` | typecheck + build into `docs/` |
| `npm run preview` | serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | typecheck, then every test below |
| `npm run test:assets` | asset invariants: lot overflow, budget, LOD ladder |
| `node tools/single-file.mjs index out.html` | the whole game as one self-contained HTML file |
| `npm run test:frustum` | culling correctness, no GPU needed |
| `npm run test:census` | every draw slice holds its instances; edits reserve what a fresh build does |
| `npm run test:trees` | no street tree stands in, or spreads its crown over, a carriageway |
| `npm run assets:sheet` | render every asset to one contact sheet |
| `npm run test:gpu` | headless offscreen render test (needs Playwright + Chromium) |
| `npm run test:deploy` | boots the built site under both Pages layouts, and from a stale cache |

### Controls

| | |
|---|---|
| drag | pan -- the ground stays under the cursor, and carries on if you let go moving |
| right-drag / shift-drag | orbit |
| wheel / pinch | zoom toward the cursor, eased |
| W A S D / arrows | pan |
| Q E | rotate · R F pitch · +/− zoom |
| Space, 1–4 | pause, and the three speeds |
| <kbd>`</kbd> | log console |

On the title screen, the arrow keys move through the menu, Enter chooses and
Esc goes back.

`?bench` flies a fixed route and prints frame times; `?lite` builds a reduced
world for weak GPUs and for CI.

## Publishing

The built site is committed to [`docs/`](docs/), so it can be served straight
from this branch with no CI involved. Two ways to turn it on, pick one:

**A. From the branch (no Actions needed).**
Settings → Pages → Source: *Deploy from a branch* → branch
`claude/cities-skylines-planning-y2elhr`. Either folder works: `/docs` serves
the build directly, and `/` lands on the repo root, which detects that it has
no runnable bundle and forwards to `./docs/`. Re-run `npm run build` and commit
`docs/` whenever you want the live site to move.

**B. Via Actions (`.github/workflows/pages.yml`, already committed).**
Settings → Pages → Source: *GitHub Actions*, then run the workflow. It is
`workflow_dispatch` only right now, because `deploy-pages` fails while the
source is set to a branch — add a `push:` trigger once you have switched.

Note: a repo serves exactly one Pages site. This repo's Pages is currently
pointed at the `claude/f1-cinematic-menus-uz1gac` branch, so either option
above replaces what is published there today.

Either way the URL is `https://maksimsysak3-ui.github.io/Subnautica-2/`. Asset
paths are relative, so renaming the repo needs no config change.

### Cache

GitHub Pages serves HTML with a ten-minute `max-age` and offers no way to
change it, so a visitor can sit on a copy from before the last deploy — which
looks exactly like the deploy having failed. Each build stamps an id into
`index.html` and writes the same id to `version.json`; the page fetches that
with `no-store` on load and, if the ids disagree, reloads itself once through a
cache-busting URL. Nobody has to be told to hard-reload.

### The cross-origin isolation problem (deferred on purpose)

The simulation will eventually share world state with worker threads through
`SharedArrayBuffer`, which browsers only expose on a **cross-origin isolated**
page — needing `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` response headers that GitHub Pages
will not let you set. The usual workaround is a service worker that adds them
itself.

That worker is written and parked at
[`src/workers/coi-serviceworker.js.txt`](src/workers/coi-serviceworker.js.txt),
**not registered**. It was wired up early, before any code needed it, and it
put a caching layer in front of every request that went on to serve a stale
copy of the app after a deploy — a live bug in exchange for a feature nothing
used yet. It comes back at M2 when the pathfinding worker needs it, with a
version check so a redeploy can't be masked.

Until then `crossOriginIsolated` is false and the app logs that at boot as
expected, not as a warning. `index.html` also unregisters any service worker
still lingering on the origin from the earlier build.

## Layout

```
src/
  main.ts              boot, error handling, device-loss recovery
  gfx/
    device.ts          adapter/device, canvas config, resize, loss recovery
    caps.ts            limit negotiation + budget checks
    camera.ts          orbit rig, ray-to-ground unprojection
    frustum.ts         plane extraction + AABB test
    profiler.ts        GPU timestamp queries
    renderer.ts        frame loop, compute cull, the single render pass
    post.ts            the camera: AO, bloom chain, ACES, grade, FXAA
    shaders/           surfaces write linear light; post.wgsl tonemaps once
  bench.ts             fixed-route benchmark behind ?bench
  assets/
    mesh.ts            boxes, gables, cylinders, windows; bakes vertex AO
    types.ts           asset descriptor: footprint, sim costs, LOD builder
    generators/        residential, commercial, industrial, services, fleet
    generators/signature-*  the landmarks: nine per theme, plus their own kit
    generators/towers.ts    single-form towers on a lofting kit: taper, twist, wave, piers
  asset-viewer.ts      the /asset.html preview page
  input/controls.ts    pointer, wheel, touch and keyboard; eased zoom, momentum
  math/m4.ts           mat4 / vec3, column-major, allocation-free
  sim/
    config.ts          world size; ?lite shrinks it
    hash.ts            deterministic hash, value noise, fBm
    terrain.ts         heightfield and the chunked mesh built from it
    city.ts            the spawner: frontages, lots, planting, avenue trees
    agents/            the simulation: people, traffic, utilities, economy, growth
  ui/
    stats.ts           frame budget overlay
    fatal.ts           "your browser can't run this" screen
    theme.ts           typefaces, tokens and the title-screen styles
    menu.ts            loading screen and title
    first-steps.ts     the guided start
    ambience.ts        the synthesised soundscape
  util/log.ts          leveled log + in-page console
tools/                 headless GPU and deployment tests
planning/              design docs
docs/                  built site (committed, served by Pages)
```
