# citysim

A city-building simulation engine on WebGPU. Written in TypeScript, no
rendering framework — the renderer is hand-written because a generic scene
graph is the wrong shape for "half a million static instanced objects".

**Plan and budgets:** [`planning/CITY-SIM-DESIGN.md`](planning/CITY-SIM-DESIGN.md)
— performance hard caps, hierarchical pathfinding, agent tiering, the asset
pack pipeline, and the milestone roadmap.

**Status: M0 step 1 — boot path.** There is no game yet. What exists is a
device that comes up, survives resize and GPU loss, and draws three instanced
triangles through a depth buffer to prove the rendering path works.

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
| `npm run test:gpu` | headless offscreen render test (needs Playwright + Chromium) |

Press <kbd>`</kbd> in the app for the log console. The overlay top-left is the
frame budget readout.

## Publishing

The built site is committed to [`docs/`](docs/), so it can be served straight
from this branch with no CI involved. Two ways to turn it on, pick one:

**A. From the branch (no Actions needed).**
Settings → Pages → Source: *Deploy from a branch* → branch
`claude/cities-skylines-planning-y2elhr`, folder `/docs` → Save.
Re-run `npm run build` and commit `docs/` whenever you want the live site to
move.

**B. Via Actions (`.github/workflows/pages.yml`, already committed).**
Settings → Pages → Source: *GitHub Actions*, then run the workflow. It is
`workflow_dispatch` only right now, because `deploy-pages` fails while the
source is set to a branch — add a `push:` trigger once you have switched.

Note: a repo serves exactly one Pages site. This repo's Pages is currently
pointed at the `claude/f1-cinematic-menus-uz1gac` branch, so either option
above replaces what is published there today.

Either way the URL is `https://maksimsysak3-ui.github.io/Subnautica-2/`. If you
rename the repo, change `BASE` in `vite.config.ts` to match.

### The cross-origin isolation problem

The simulation will share its world state with worker threads through
`SharedArrayBuffer`, which browsers only expose on a **cross-origin isolated**
page. That needs two response headers:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages does not let you set response headers. So
[`public/coi-serviceworker.js`](public/coi-serviceworker.js) installs a service
worker that adds them to every response. First visit loads unisolated,
registers the worker, and reloads once; every visit after is isolated from the
start. The app checks `crossOriginIsolated` at boot and logs loudly if it is
false.

The cost: with `require-corp`, every cross-origin subresource must send CORP
headers or be blocked. **Keep everything self-hosted** — no CDN fonts, no
remote images — and it never comes up.

## Layout

```
src/
  main.ts              boot, error handling, device-loss recovery
  gfx/
    device.ts          adapter/device, canvas config, resize, loss recovery
    caps.ts            limit negotiation + budget checks
    renderer.ts        frame loop, the single render pass
    shaders/tri.wgsl   step-1 proof shader
  ui/
    stats.ts           frame budget overlay
    fatal.ts           "your browser can't run this" screen
  util/log.ts          leveled log + in-page console
tools/gpu-smoke.mjs    headless render-and-readback test
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
- **The proof shader uses a storage buffer indexed by `instance_index`.** That
  is exactly how buildings get drawn later — one call, N instances. Proving the
  path now is cheaper than discovering it is broken at 100k instances.
- **One `beginRenderPass` per frame, pipelines built once.** The two rules the
  renderer will be held to forever, established while there is nothing to
  refactor.

## Next

M0 step 2: camera (orbit/pan/zoom with zoom-to-cursor) and a view-projection
uniform. Then chunked heightmap terrain, then 100k instanced cubes as the
scaling test.
