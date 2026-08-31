# citysim

A city-building simulation engine on WebGPU. Written in TypeScript, no
rendering framework — the renderer is hand-written because a generic scene
graph is the wrong shape for "half a million static instanced objects".

**Plan and budgets:** [`planning/CITY-SIM-DESIGN.md`](planning/CITY-SIM-DESIGN.md)
— performance hard caps, hierarchical pathfinding, agent tiering, the asset
pack pipeline, and the milestone roadmap.

**Status: M0 step 3 — terrain.** There is no game yet. What exists is a device
that comes up and survives resize and GPU loss, an orbit camera riding a
2 km × 2 km heightfield drawn as 256 frustum-culled chunks, and ~4,500
instanced buildings sitting on the terrain in a single draw call — the draw
path the real building renderer will use, proved at a scale where mistakes are
still cheap.

---

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
| `npm run test:frustum` | culling correctness, no GPU needed |
| `npm run test:gpu` | headless offscreen render test (needs Playwright + Chromium) |
| `npm run test:deploy` | boots the built site under both Pages layouts, and from a stale cache |

### Controls

| | |
|---|---|
| drag | pan — the ground stays under the cursor |
| right-drag / shift-drag | orbit |
| wheel / pinch | zoom toward the cursor |
| W A S D / arrows | pan |
| Q E | rotate · R F pitch · +/− zoom |
| <kbd>`</kbd> | log console |

The overlay top-left is the frame budget readout.

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
    renderer.ts        frame loop, the single render pass
    shaders/           common.wgsl, terrain.wgsl, box.wgsl
  input/controls.ts    pointer, wheel, touch and keyboard camera control
  math/m4.ts           mat4 / vec3, column-major, allocation-free
  sim/
    hash.ts            deterministic hash, value noise, fBm
    terrain.ts         heightfield and the chunked mesh built from it
    city.ts            deterministic placeholder city layout
  ui/
    stats.ts           frame budget overlay
    fatal.ts           "your browser can't run this" screen
  util/log.ts          leveled log + in-page console
tools/                 headless GPU and deployment tests
planning/              design docs
docs/                  built site (committed, served by Pages)
```

## Why the first commit looks like this

The triangle is throwaway. The other ~600 lines are not:

- **`caps.ts` asks for raised limits.** WebGPU hands you conservative defaults
  unless you request more, and requesting more than the adapter has is a hard
  failure — so it asks for `min(want, have)` on every limit and warns when a
  machine falls under the design budgets.
- **`device.ts` recovers from device loss.** Drivers time out, laptops sleep,
  browsers reset the GPU process under memory pressure. This is a program
  people leave open for hours; losing the device *will* happen and a permanent
  black canvas is not an acceptable answer.
- **Resize uses `device-pixel-content-box`.** The difference between a crisp
  canvas and a subtly blurry one under fractional display scaling.
- **Boxes are drawn from a storage buffer indexed by `instance_index`.** That
  is exactly how buildings get drawn later — one call, N instances. Proving the
  path now is cheaper than discovering it is broken at 100k.
- **The grid is procedural, not geometry.** Line width comes from screen-space
  derivatives, so a line stays one pixel wide from 8 m up to 1200 m. Real line
  geometry would be thousands of primitives that alias into moiré on zoom-out.
- **Panning and zooming share one primitive:** where the cursor ray meets the
  ground. That same unprojection becomes road dragging, zoning, and bulldoze.
- **Terrain chunks share one vertex buffer and one index buffer.** Chunk
  topology is identical, so indices are written once and each chunk draws with
  its own `baseVertex` — the layout that makes multi-draw indirect possible
  later without reshuffling anything.
- **The grid fades by screen density.** Correct lines are not enough: at
  altitude the 8 m cells are individually right and collectively grey mush, so
  each spacing fades out as its cells approach pixel size.
- **One `beginRenderPass` per frame, pipelines built once.** The two rules the
  renderer will be held to forever, established while there is nothing to
  refactor.

## Next

M0 step 4, the scaling test: 100k instances with LOD selection, which is where
the budgets in the design doc meet reality. Then M1 — roads.
