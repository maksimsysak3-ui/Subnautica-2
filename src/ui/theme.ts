/**
 * The game's typography and the few global styles it cannot express inline.
 *
 * The type is borrowed from the street, because that is what a city builder is
 * about: Big Shoulders Display, drawn from Chicago's civic signage, for the
 * title and the few headlines; Barlow, drawn from California highway lettering,
 * for everything a player reads; and its condensed cut for the small tracked
 * captions, the way a transit map sets its labels. Everything used to be set in
 * the system monospace, which is the typeface of a debugging console, and made
 * the whole game look like its own developer tools.
 *
 * Loaded from Google Fonts at runtime rather than linked from index.html,
 * because the single-file build keeps only the body of the page. Every stack
 * falls back to a system face, so a blocked font host costs the look and not
 * the layout.
 */

const FONTS = 'https://fonts.googleapis.com/css2?'
  + 'family=Barlow:wght@400;500;600;700'
  + '&family=Barlow+Condensed:wght@500;600;700'
  + '&family=Big+Shoulders+Display:wght@600;800;900'
  + '&display=swap';

/** Brand colours. The HUD's own palette is in skin.ts and draws from these. */
export const BRAND = {
  /** Sodium lamp: the brand accent, for the one primary action on a screen. */
  amber: '#f4b54a',
  amberSoft: 'rgba(244,181,74,.16)',
  /** Information and selection. */
  cyan: '#6fd3ff',
  ink: '#f1f4f8',
  dim: '#9fb0c4',
  faint: '#5f7189',
} as const;

const CSS = `
:root {
  --ui: "Barlow", "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "Barlow", "Segoe UI", system-ui, -apple-system, sans-serif;
  --label: "Barlow Condensed", "Barlow", "Arial Narrow", system-ui, sans-serif;
  --display: "Big Shoulders Display", "Barlow Condensed", Impact, "Arial Narrow", sans-serif;
  --amber: ${BRAND.amber};
  --cyan: ${BRAND.cyan};
  --ink: ${BRAND.ink};
}
html, body { font-family: var(--ui); }
#overlay { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
#overlay button { font-family: inherit; }
#overlay ::selection { background: rgba(244,181,74,.35); }
#overlay :focus-visible { outline: 2px solid ${BRAND.amber}; outline-offset: 2px; }

/* ---- toolbar ---------------------------------------------------------- */
/* Groups sit side by side, split by a hairline rather than boxed, so the bar
   reads as one instrument with sections instead of a row of separate trays. */
.mr-group { position: relative; display: flex; gap: 2px; padding: 0 7px; }
.mr-group + .mr-group::before {
  content: ""; position: absolute; left: 0; top: 9px; bottom: 9px; width: 1px;
  background: linear-gradient(transparent, rgba(160,190,220,.2), transparent);
}
.mr-tile {
  --accent: ${BRAND.dim};
  position: relative; display: grid; place-items: center; flex: none;
  width: 44px; height: 44px; padding: 0; box-sizing: border-box;
  border: 1px solid transparent; border-radius: 11px; background: transparent;
  color: var(--accent); cursor: pointer;
  transition: background .14s ease, border-color .14s ease, transform .1s ease;
}
.mr-tile > svg, .mr-tile > .mr-swatch {
  filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.55)); transition: transform .14s ease;
}
.mr-tile:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.07); }
.mr-tile:hover > svg, .mr-tile:hover > .mr-swatch { transform: translateY(-1px) scale(1.06); }
.mr-tile:active { transform: translateY(1px); }
/* The lit bar under a chosen tool, in the tool's own colour. */
.mr-tile::after {
  content: ""; position: absolute; left: 50%; bottom: 3px; width: 0; height: 2px;
  border-radius: 2px; background: var(--accent); box-shadow: 0 0 8px var(--accent);
  transform: translateX(-50%); transition: width .18s ease;
}
.mr-tile[data-on="1"], .mr-tile.is-open {
  background: color-mix(in srgb, var(--accent) 17%, rgba(8,12,18,.5));
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  box-shadow: inset 0 1px 6px rgba(0,0,0,.35);
}
.mr-tile[data-on="1"]::after, .mr-tile.is-open::after { width: 18px; }
.mr-tile.is-locked { cursor: not-allowed; }
.mr-tile.is-locked > svg, .mr-tile.is-locked > .mr-swatch { opacity: .42; filter: grayscale(1); }
.mr-tile.is-locked:hover > svg { transform: none; }
.mr-badge {
  position: absolute; right: -2px; top: -3px; display: flex; align-items: center; gap: 2px;
  height: 15px; padding: 0 4px 0 3px; border-radius: 8px; pointer-events: none;
  background: #0d131b; border: 1px solid rgba(244,181,74,.6); color: var(--amber);
  font: 700 9px/1 var(--label); letter-spacing: .02em; box-shadow: 0 2px 6px rgba(0,0,0,.5);
}
/* Narrower windows: smaller tiles before the bar wraps onto a second row,
   and the status captions go, keeping the readings themselves. */
@media (max-width: 1240px) {
  .mr-tile { width: 36px; height: 36px; border-radius: 9px; }
  .mr-tile > svg { width: 20px; height: 20px; }
  .mr-tile > .mr-swatch { width: 18px !important; height: 18px !important; }
  .mr-group { padding: 0 4px; gap: 1px; }
  .mr-cell { padding: 0 9px; gap: 6px; }
  .mr-cell > div:first-child { display: none; }
  .mr-dial-text i { display: none; }
}
@media (max-width: 900px) {
  .mr-tile { width: 32px; height: 32px; }
  .mr-tile > svg { width: 18px; height: 18px; }
}
/* Status readings as separate recessed cells, each its own dial. */
.mr-cell {
  display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px;
  border-radius: 9px; background: rgba(4,8,13,.5); white-space: nowrap;
  box-shadow: inset 0 1px 3px rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.04);
}

button.mr-cell { border: 0; cursor: pointer; font: inherit; color: inherit; }
.mr-dial { gap: 9px; padding: 0 14px 0 4px; transition: background .14s ease; }
.mr-dial:hover { background: rgba(244,181,74,.12); }
.mr-dial-ring { position: relative; display: grid; place-items: center; width: 30px; height: 30px; }
.mr-dial-ring svg { position: absolute; inset: 0; }
.mr-dial-ring svg circle[data-arc] { transition: stroke-dashoffset .6s ease; }
.mr-dial-ring b { position: relative; font: 800 14px/1 var(--display); color: var(--amber); }
.mr-dial-text { display: flex; flex-direction: column; gap: 3px; text-align: left; }
.mr-dial-text b { font: 700 12.5px/1 var(--ui); color: ${BRAND.ink}; letter-spacing: .02em; }
.mr-dial-text i { font: 600 9.5px/1 var(--label); font-style: normal; letter-spacing: .1em;
  text-transform: uppercase; color: ${BRAND.faint}; }

/* ---- new city setup ---------------------------------------------------- */
.mr-setup {
  position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; gap: 20px;
  padding: clamp(18px, 4vh, 44px) clamp(16px, 5vw, 80px); box-sizing: border-box;
  background: linear-gradient(180deg, rgba(5,9,15,.74), rgba(5,9,15,.9));
  backdrop-filter: blur(6px); overflow-y: auto; opacity: 0; transition: opacity .35s ease;
  pointer-events: auto;
}
.mr-setup.is-open { opacity: 1; }
.mr-setup-head { display: flex; align-items: center; gap: 14px; }
.mr-setup h2 {
  margin: 0; font: 800 clamp(26px, 3.4vw, 42px)/1 var(--display); letter-spacing: .08em;
  text-transform: uppercase; color: var(--ink);
}
.mr-square {
  flex: none; width: 40px; height: 40px; display: grid; place-items: center; cursor: pointer;
  border-radius: 8px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06);
  color: var(--ink); transition: background .15s, border-color .15s;
}
.mr-square:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.3); }
.mr-name { display: flex; flex-direction: column; gap: 8px; width: min(560px, 100%); }
.mr-name label {
  font: 700 11px/1 var(--label); letter-spacing: .2em; text-transform: uppercase; color: var(--amber);
}
.mr-name-row { display: flex; gap: 8px; }
.mr-name input {
  flex: 1; min-width: 0; padding: 12px 16px; font: 600 20px/1.1 var(--ui); color: var(--ink);
  background: rgba(6,10,17,.82); border: 1px solid rgba(244,181,74,.35); border-radius: 8px; outline: none;
}
.mr-name input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(244,181,74,.15); }
.mr-res-chips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 2px 0 10px; }
.mr-res-chip {
  --tone: #9fb4d6;
  display: flex; align-items: center; gap: 7px; height: 32px; padding: 0 9px; cursor: pointer;
  border-radius: 9px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.03);
  color: ${BRAND.dim}; font: 600 12px/1 var(--ui); text-align: left;
  transition: background .15s, border-color .15s, color .15s;
}
.mr-res-chip:hover { border-color: rgba(255,255,255,.2); color: var(--ink); }
.mr-res-ico { display: inline-flex; color: var(--tone); }
.mr-res-chip.is-on {
  color: var(--ink); border-color: color-mix(in srgb, var(--tone) 60%, transparent);
  background: color-mix(in srgb, var(--tone) 16%, transparent);
}
/* ---- Stats: the phone's accounts app ---------------------------------- */
.mr-st { flex: 1; display: flex; flex-direction: column; min-height: 0; position: relative;
  background: #0d1219; font-variant-numeric: tabular-nums; }
.mr-st-tabs { display: flex; flex-wrap: wrap; gap: 3px; padding: 8px 10px 7px;
  border-bottom: 1px solid rgba(255,255,255,.07); flex-shrink: 0; }
.mr-st-tabs::-webkit-scrollbar { display: none; }
.mr-st-tab { flex-shrink: 0; font: 600 11px/1 var(--label); letter-spacing: .1em; text-transform: uppercase;
  color: #6d8098; background: transparent; border: 1px solid transparent; border-radius: 999px;
  padding: 6px 10px; cursor: pointer; }
.mr-st-tab:hover { color: #a9b8cb; }
.mr-st-tab.is-on { color: #e8eef6; background: rgba(111,211,255,.12); border-color: rgba(111,211,255,.35); }
.mr-st-body { flex: 1; overflow: auto; padding: 4px 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.mr-st-body > * { flex-shrink: 0; }
.mr-st-empty, .mr-st-note { color: #6d8098; font-size: 12px; line-height: 1.45; }
.mr-st-section { margin-top: 10px; font: 700 10.5px/1 var(--label); letter-spacing: .16em; text-transform: uppercase;
  color: #6d8098; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,.06); }
.mr-st-hero { display: flex; flex-direction: column; gap: 4px; padding: 10px 0 4px; }
.mr-st-cap { font: 600 10.5px/1 var(--label); letter-spacing: .14em; text-transform: uppercase; color: #6d8098; }
.mr-st-big { font: 800 34px/1 var(--display); letter-spacing: .02em; color: #e8eef6; }
.mr-st-big.is-good { color: #5fc78c; } .mr-st-big.is-bad { color: #e0685a; }
.mr-st-sub { font-size: 11.5px; color: #8093aa; }
.mr-st-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.mr-st-tile { display: flex; flex-direction: column; gap: 4px; padding: 9px 10px; border-radius: 10px;
  background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.06); min-width: 0; }
.mr-st-val { font: 700 17px/1.1 var(--ui); color: #e8eef6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mr-st-row { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: #a9b8cb; padding: 2px 0; }
.mr-st-row b { font-weight: 600; color: #e8eef6; text-align: right; }
.mr-st-row b.is-warn { color: #e8b454; } .mr-st-row b.is-bad { color: #e0685a; }
.mr-st-comp { display: flex; flex-direction: column; gap: 8px; }
.mr-st-stack { display: flex; gap: 2px; height: 14px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,.05); }
.mr-st-seg { min-width: 2px; }
.mr-st-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; font-size: 11.5px; color: #a9b8cb; }
.mr-st-legend-item { display: flex; align-items: center; gap: 6px; }
.mr-st-legend-item b { margin-left: auto; color: #e8eef6; font-weight: 600; }
.mr-st-sw { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; display: inline-block; }
.mr-st-zone { display: flex; flex-direction: column; gap: 2px; padding: 9px 10px; border-radius: 10px;
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06);
  border-left: 3px solid var(--tone); }
.mr-st-zone-head { display: flex; align-items: center; gap: 7px; padding-bottom: 4px; }
.mr-st-zone-name { font: 700 12px/1 var(--label); letter-spacing: .12em; text-transform: uppercase; color: #e8eef6; }
.mr-st-zone-rate { margin-left: auto; font-weight: 700; color: #e8eef6; font-size: 13px; }
.mr-st-bar-row { display: grid; grid-template-columns: 112px 1fr auto; align-items: center; gap: 8px;
  font-size: 12px; color: #a9b8cb; padding: 3px 0; }
.mr-st-bar-name { display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mr-st-bar-val { color: #e8eef6; font-weight: 600; min-width: 58px; text-align: right; }
.mr-st-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,.06); overflow: hidden; }
.mr-st-fill { height: 100%; border-radius: 3px; min-width: 2px; }
.mr-st-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.mr-st-chip { font: 600 11px/1 var(--ui); color: #8093aa; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.07); border-radius: 999px; padding: 5px 9px; cursor: pointer; }
.mr-st-chip.is-on { color: #0b1016; background: #6fd3ff; border-color: #6fd3ff; }
.mr-st-chart-wrap { display: flex; flex-direction: column; gap: 2px; }
.mr-st-scale { display: flex; justify-content: space-between; font-size: 10.5px; color: #6d8098; }
.mr-st-chart { width: 100%; height: auto; display: block; }
.mr-st-axis { stroke: rgba(255,255,255,.18); stroke-width: 1; }
.mr-st-tick { fill: #6d8098; font: 500 9.5px var(--ui); }
.mr-st-scroll { overflow-x: auto; }
.mr-st-table { width: 100%; border-collapse: collapse; font-size: 11.5px; color: #a9b8cb; }
.mr-st-table th { text-align: right; font: 600 10px/1 var(--label); letter-spacing: .12em; text-transform: uppercase;
  color: #6d8098; padding: 5px 4px; border-bottom: 1px solid rgba(255,255,255,.08); }
.mr-st-table td { text-align: right; padding: 5px 4px; border-bottom: 1px solid rgba(255,255,255,.04); white-space: nowrap; }
.mr-st-table th:first-child, .mr-st-table td:first-child { text-align: left; }
.mr-st-td-name { display: flex; align-items: center; gap: 6px; max-width: 170px; overflow: hidden; text-overflow: ellipsis; }
.mr-st-total td { color: #e8eef6; font-weight: 700; border-top: 1px solid rgba(255,255,255,.14); }
.mr-st-table td.is-good { color: #5fc78c; } .mr-st-table td.is-bad { color: #e0685a; }
.mr-st-tip { position: absolute; z-index: 5; transform: translate(-50%, -100%); pointer-events: none;
  max-width: 240px; padding: 6px 9px; border-radius: 8px; font-size: 11.5px; line-height: 1.35; color: #e8eef6;
  background: rgba(6,9,14,.96); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 8px 20px rgba(0,0,0,.5); }
.mr-dist-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 2px 6px; }
.mr-dist-new, .mr-dist-erase, .mr-dist-paint { font: 700 12px/1 var(--ui); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.mr-dist-new { color: #1a1206; background: #f4b54a; border: 0; }
.mr-dist-erase { color: #e8eef6; background: rgba(224,104,90,.14); border: 1px solid rgba(224,104,90,.4); }
.mr-dist-note { font-size: 12px; color: #8093aa; }
.mr-dist { display: flex; flex-direction: column; gap: 7px; padding: 10px; border-radius: 12px;
  background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.07); border-left: 3px solid var(--tone); }
.mr-dist-title { display: flex; align-items: center; gap: 8px; }
.mr-dist-sw { width: 12px; height: 12px; border-radius: 4px; background: var(--tone); flex-shrink: 0;
  box-shadow: 0 0 10px color-mix(in srgb, var(--tone) 60%, transparent); }
.mr-dist-name { flex: 1; min-width: 0; font: 700 14px/1.2 var(--ui); color: #e8eef6; background: transparent;
  border: 1px solid transparent; border-radius: 6px; padding: 3px 5px; }
.mr-dist-name:hover, .mr-dist-name:focus { border-color: rgba(255,255,255,.18); outline: none; background: rgba(0,0,0,.2); }
.mr-dist-paint { padding: 6px 10px; color: #e8eef6; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); }
.mr-dist-facts { font-size: 11.5px; color: #8093aa; font-variant-numeric: tabular-nums; }
.mr-dist-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.mr-dist-chip { font: 600 11px/1 var(--ui); color: #9fb0c4; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1); border-radius: 999px; padding: 5px 9px; cursor: pointer; }
.mr-dist-chip.is-on { color: #1a1206; background: var(--tone); border-color: var(--tone); }
.mr-district-label { position: absolute; left: 0; top: 0; transform-origin: 0 0; pointer-events: none;
  font: 800 13px/1 var(--display); letter-spacing: .16em; text-transform: uppercase; color: #f1f4f8;
  text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 12px rgba(0,0,0,.6); white-space: nowrap; }
.mr-district-label i { display: block; height: 3px; border-radius: 2px; margin-top: 4px; background: var(--tone); }
.mr-upg { display: flex; flex-direction: column; gap: 7px; padding-bottom: 10px; margin-bottom: 2px;
  border-bottom: 1px solid rgba(255,255,255,.08); }
.mr-upg-head { display: flex; align-items: center; justify-content: space-between; font: 700 11px/1 var(--label);
  letter-spacing: .14em; text-transform: uppercase; color: #e8eef6; }
.mr-upg-pips { display: flex; gap: 4px; }
.mr-upg-pips i { width: 16px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.12); }
.mr-upg-pips i.is-on { background: #f4b54a; box-shadow: 0 0 8px rgba(244,181,74,.5); }
.mr-upg-perks { display: flex; flex-wrap: wrap; gap: 4px; }
.mr-upg-perks span { font: 600 11px/1 var(--ui); color: #9fe0b8; background: rgba(95,199,140,.12);
  border: 1px solid rgba(95,199,140,.28); border-radius: 999px; padding: 4px 8px; }
.mr-upg-perks span.is-cost { color: #f0c987; background: rgba(232,180,84,.1); border-color: rgba(232,180,84,.28); }
.mr-upg-btn { font: 700 12px/1 var(--ui); letter-spacing: .02em; color: #1a1206; background: #f4b54a; border: 0;
  border-radius: 8px; padding: 9px 12px; cursor: pointer; box-shadow: 0 6px 16px rgba(244,181,74,.22); }
.mr-upg-btn:hover:not(:disabled) { filter: brightness(1.08); }
.mr-upg-btn:disabled { background: rgba(255,255,255,.08); color: #6d8098; box-shadow: none; cursor: not-allowed; }
.mr-upg-note { font-size: 11.5px; line-height: 1.4; color: #8093aa; }
.mr-ind { --tone: #f4b54a; display: flex; flex-direction: column; gap: 8px; padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,.08); }
.mr-ind-head { display: flex; align-items: center; gap: 8px; font: 700 11px/1 var(--label);
  letter-spacing: .14em; text-transform: uppercase; color: var(--tone); }
.mr-ind-ico { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px;
  background: color-mix(in srgb, var(--tone) 18%, transparent); }
.mr-ind-figure { display: flex; align-items: baseline; gap: 8px; }
.mr-ind-figure b { font: 800 28px/1 var(--display); color: var(--ink); font-variant-numeric: tabular-nums; }
.mr-ind-figure span { font: 600 12px/1 var(--ui); color: ${BRAND.dim}; }
.mr-ind-rows { display: flex; flex-direction: column; gap: 4px; }
.mr-ind-row { display: flex; justify-content: space-between; gap: 10px; font: 500 12px/1.35 var(--ui); color: ${BRAND.dim}; }
.mr-ind-row b { font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; text-align: right; }
.mr-ind-row.is-warn b { color: #ff9a6a; }
.mr-ind-split { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px;
  font: 600 10.5px/1 var(--label); letter-spacing: .08em; text-transform: uppercase; color: ${BRAND.dim}; }
.mr-ind-split input { accent-color: var(--tone); width: 100%; }
.mr-ind-splitsay { font: 500 11.5px/1.4 var(--ui); color: ${BRAND.dim}; }
.mr-ind-redraw { height: 32px; border-radius: 9px; cursor: pointer; font: 700 12px/1 var(--ui);
  color: var(--ink); background: color-mix(in srgb, var(--tone) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--tone) 55%, transparent); }
.mr-ind-redraw:hover { background: color-mix(in srgb, var(--tone) 28%, transparent); }
.mr-section-label {
  font: 700 11px/1 var(--label); letter-spacing: .16em; text-transform: uppercase; color: var(--amber);
  margin-bottom: 8px;
}
.mr-map-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 1300px) { .mr-map-row { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.mr-map {
  display: flex; flex-direction: column; gap: 4px; padding: 0 0 10px; text-align: left; cursor: pointer;
  background: rgba(14,20,29,.9); border: 1px solid rgba(255,255,255,.1); border-radius: 12px;
  overflow: hidden; color: var(--ink); transition: transform .2s, border-color .2s, box-shadow .2s;
}
.mr-map:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.24); }
.mr-map.is-picked { border-color: var(--amber); box-shadow: 0 0 0 1px var(--amber), 0 12px 30px rgba(0,0,0,.45); }
.mr-map-img {
  display: block; width: 100%; aspect-ratio: 200 / 124; height: auto; background: #1a2430;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.mr-map-name { padding: 6px 12px 0; font: 800 15px/1.1 var(--display); letter-spacing: .06em; text-transform: uppercase; }
.mr-map-tag { padding: 0 12px; font: 500 12px/1.3 var(--ui); color: ${BRAND.dim}; }
.mr-map-res { display: flex; gap: 8px; padding: 4px 12px 0; }
.mr-map-res span { display: inline-flex; }
@media (max-width: 800px) { .mr-map-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 560px) { .mr-map-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.mr-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 900px) { .mr-cards { grid-template-columns: 1fr; } }
.mr-card {
  display: flex; flex-direction: column; padding: 0; overflow: hidden; text-align: left; cursor: pointer;
  border-radius: 12px; background: rgba(14,20,29,.94); border: 1px solid rgba(255,255,255,.09);
  color: inherit; font: inherit; transition: transform .18s ease, border-color .18s, box-shadow .18s;
}
.mr-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.22); }
.mr-card.is-picked {
  border-color: var(--amber); box-shadow: 0 0 0 1px var(--amber), 0 18px 44px rgba(0,0,0,.5);
}
.mr-card-art {
  position: relative; height: clamp(104px, 17vh, 170px); overflow: hidden;
  background: #0b1018 center / cover no-repeat;
  transition: transform .6s cubic-bezier(.2,.7,.2,1), filter .4s;
  filter: saturate(.92) brightness(.92);
}
.mr-card:hover .mr-card-art, .mr-card.is-picked .mr-card-art { transform: scale(1.045); filter: none; }
.mr-card-art::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(120% 90% at 50% 30%, transparent 55%, rgba(5,8,13,.55)),
    linear-gradient(180deg, transparent 38%, rgba(14,20,29,.55) 66%, rgba(14,20,29,.97));
}
.mr-card-title {
  position: absolute; left: 16px; bottom: 12px; z-index: 1; color: var(--ink);
  font: 800 26px/1 var(--display); letter-spacing: .1em; text-transform: uppercase;
  text-shadow: 0 2px 12px rgba(0,0,0,.65);
}
.mr-card-body { display: flex; flex-direction: column; gap: 10px; flex: 1; padding: 12px 16px 16px; }
.mr-card-tag {
  font: 700 11px/1 var(--label); letter-spacing: .16em; text-transform: uppercase; color: var(--amber);
}
.mr-card-blurb { margin: 0; font: 500 13px/1.5 var(--ui); color: ${BRAND.dim}; }
.mr-card ul {
  margin: 0; padding: 0 0 0 16px; display: flex; flex-direction: column; gap: 5px;
  font: 500 12.5px/1.35 var(--ui); color: #cfd9e4;
}
.mr-card li::marker { color: var(--amber); }
.mr-pick {
  margin-top: auto; padding: 10px; border-radius: 8px; text-align: center;
  font: 700 12px/1 var(--label); letter-spacing: .18em; text-transform: uppercase;
  background: rgba(255,255,255,.06); color: ${BRAND.dim}; border: 1px solid rgba(255,255,255,.1);
}
.mr-card.is-picked .mr-pick { background: var(--amber); color: #1d1405; border-color: var(--amber); }
.mr-setup-foot { display: flex; justify-content: flex-end; align-items: center; gap: 16px; flex-wrap: wrap; }
.mr-setup-foot p { margin: 0; font: 500 12.5px/1.4 var(--ui); color: ${BRAND.faint}; }
.mr-found {
  padding: 15px 30px; border: 0; border-radius: 8px; cursor: pointer; background: var(--amber);
  color: #1d1405; font: 800 17px/1 var(--display); letter-spacing: .14em; text-transform: uppercase;
  box-shadow: 0 10px 30px rgba(244,181,74,.3); transition: transform .15s, box-shadow .15s;
}
.mr-found:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(244,181,74,.42); }

/* ---- incident markers ---------------------------------------------------- */
.mr-incident {
  position: absolute; left: 0; top: 0; width: 34px; height: 34px; margin: -40px 0 0 -17px;
  padding: 0; border: 0; background: none; cursor: pointer; pointer-events: auto;
  --tone: #ff7a3d;
}
.mr-incident-icon {
  position: absolute; inset: 0; display: grid; place-items: center; border-radius: 50%;
  background: #0d131b; color: var(--tone); border: 2px solid var(--tone);
  box-shadow: 0 0 14px color-mix(in srgb, var(--tone) 55%, transparent), 0 4px 10px rgba(0,0,0,.5);
}
.mr-incident::after {
  content: ""; position: absolute; left: 50%; top: 100%; width: 2px; height: 8px;
  margin-left: -1px; background: var(--tone);
}
.mr-incident-ring {
  position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--tone); opacity: 0;
}
.mr-incident[data-state="0"] .mr-incident-ring { animation: mr-ping 1.1s ease-out infinite; }
.mr-incident[data-state="1"] .mr-incident-ring { animation: mr-ping 2.2s ease-out infinite; }
@keyframes mr-ping { 0% { transform: scale(1); opacity: .9; } 100% { transform: scale(2.1); opacity: 0; } }
.mr-incident-label {
  position: absolute; left: 50%; top: -24px; transform: translateX(-50%); white-space: nowrap;
  padding: 3px 8px; border-radius: 6px; background: rgba(8,12,18,.88); color: #f1f4f8;
  font: 700 11px/1.2 var(--ui); opacity: 0; transition: opacity .15s; pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--tone) 50%, transparent);
}
.mr-incident:hover .mr-incident-label, .mr-incident[data-state="0"] .mr-incident-label { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .mr-incident-ring { animation: none !important; } }

/* ---- reduce motion (setting, or the system preference) ---------------- */
:root[data-motion="reduce"] *, :root[data-motion="reduce"] *::before, :root[data-motion="reduce"] *::after {
  animation: none !important; transition: none !important;
}

/* ---- budget: taxes and policies ------------------------------------------ */
.mr-sec-head {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 0; margin: 0 0 2px;
  background: none; border: 0; text-align: left; color: ${BRAND.ink};
  font: 700 13px/1.2 var(--display); letter-spacing: .12em; text-transform: uppercase;
}
.mr-sec-toggle { cursor: pointer; pointer-events: auto; }
.mr-sec-sum { font: 600 12px/1 var(--ui); letter-spacing: 0; text-transform: none; color: ${BRAND.dim}; }
.mr-caret { width: 8px; height: 8px; border-right: 2px solid var(--cyan); border-bottom: 2px solid var(--cyan);
  transform: rotate(-45deg); transition: transform .15s; margin: 0 2px; }
.mr-sec-toggle[aria-expanded="true"] .mr-caret { transform: rotate(45deg); }
.mr-note-small { font: 500 11.5px/1.45 var(--ui); color: ${BRAND.faint}; }
.mr-tax { display: flex; flex-direction: column; gap: 9px; }
.mr-tax-row { display: grid; grid-template-columns: 84px 1fr 54px; align-items: center; gap: 10px; }
.mr-tax-name { font: 600 12.5px/1 var(--ui); color: var(--zone-ink, var(--zone)); }
.mr-tax-val { font: 700 13px/1 var(--ui); text-align: right; font-variant-numeric: tabular-nums; }
.mr-tax-track { position: relative; display: block; height: 18px; }
.mr-tax-track::after {
  content: ""; position: absolute; left: var(--neutral); top: 2px; width: 2px; height: 14px;
  margin-left: -1px; background: rgba(255,255,255,.55); border-radius: 1px; pointer-events: none;
}
.mr-range { -webkit-appearance: none; appearance: none; width: 100%; height: 18px; margin: 0;
  background: transparent; cursor: pointer; pointer-events: auto; }
.mr-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--zone) 70%, transparent), rgba(255,255,255,.1)); }
.mr-range::-moz-range-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,.12); }
.mr-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -5px;
  border-radius: 50%; background: #f1f4f8; border: 3px solid var(--zone); box-shadow: 0 2px 6px rgba(0,0,0,.5); }
.mr-range::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #f1f4f8;
  border: 3px solid var(--zone); }
.mr-range:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; border-radius: 4px; }
.mr-policies { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding-top: 12px;
  border-top: 1px solid rgba(160,190,220,.14); }
.mr-policy-list { flex-direction: column; gap: 6px; }
.mr-policy { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; padding: 9px 10px;
  border-radius: 9px; cursor: pointer; pointer-events: auto; background: rgba(255,255,255,.03);
  border: 1px solid transparent; transition: background .12s, border-color .12s; }
.mr-policy:hover { background: rgba(255,255,255,.06); }
.mr-policy.is-on { background: rgba(111,211,255,.09); border-color: rgba(111,211,255,.32); }
.mr-policy.is-pinned { background: rgba(244,181,74,.10); border-color: rgba(244,181,74,.45); cursor: not-allowed; }
.mr-policy-body { display: flex; flex-direction: column; gap: 3px; }
.mr-policy-name { font: 700 13px/1.25 var(--ui); color: ${BRAND.ink}; }
.mr-policy-blurb { font: 500 12px/1.4 var(--ui); color: ${BRAND.dim}; }
.mr-policy-says { font: 600 11.5px/1.4 var(--ui); color: #b9c6d4; }
/* A switch, from a checkbox. */
.mr-switch { -webkit-appearance: none; appearance: none; position: relative; flex: none; width: 34px; height: 20px;
  margin: 2px 0 0; border-radius: 10px; background: rgba(255,255,255,.14); cursor: pointer; transition: background .15s; }
.mr-switch::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px;
  border-radius: 50%; background: #dfe7f0; transition: transform .15s; }
.mr-switch:checked { background: var(--cyan); }
.mr-switch:checked::after { transform: translateX(14px); background: #06121a; }
.mr-switch:disabled { opacity: .75; cursor: not-allowed; }
.mr-policy.is-pinned .mr-switch:checked { background: var(--amber); }

/* ---- notifications -------------------------------------------------------- */
.mr-toasts {
  position: absolute; top: 12px; right: 12px; z-index: 20; display: flex; flex-direction: column;
  gap: 8px; align-items: flex-end; pointer-events: none; width: min(340px, calc(100vw - 24px));
}
.mr-toast {
  --tone: #6fd3ff; position: relative; display: grid; grid-template-columns: 34px 1fr auto;
  align-items: start; column-gap: 11px; width: 100%; box-sizing: border-box; padding: 11px 32px 13px 11px;
  border-radius: 12px; overflow: hidden; cursor: pointer; pointer-events: auto;
  background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 14%, rgba(16,22,31,.96)) 0%, rgba(13,18,26,.96) 55%);
  border: 1px solid color-mix(in srgb, var(--tone) 30%, rgba(255,255,255,.06));
  box-shadow: 0 14px 34px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(14px);
  opacity: 0; transform: translateX(24px) scale(.98);
  transition: opacity .25s ease, transform .3s cubic-bezier(.2,.9,.3,1.1), border-color .15s;
}
.mr-toast.is-in { opacity: 1; transform: none; }
.mr-toast.is-out { opacity: 0; transform: translateX(24px); }
.mr-toast:hover { border-color: color-mix(in srgb, var(--tone) 60%, transparent); }
.mr-toast-badge {
  display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  color: var(--tone); background: color-mix(in srgb, var(--tone) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 35%, transparent);
}
.mr-toast-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.mr-toast-title { font: 700 13.5px/1.25 var(--ui); color: ${BRAND.ink}; letter-spacing: .01em; }
.mr-toast-body { font: 500 12.5px/1.45 var(--ui); color: ${BRAND.dim}; }
.mr-toast-go {
  display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; margin-top: 4px;
  font: 700 10.5px/1 var(--label); letter-spacing: .14em; text-transform: uppercase; color: var(--tone);
}
.mr-toast-fig {
  align-self: center; font: 800 18px/1 var(--display); letter-spacing: .02em; color: var(--tone);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.mr-toast-x {
  position: absolute; top: 7px; right: 7px; display: grid; place-items: center; width: 22px; height: 22px;
  padding: 0; border: 0; border-radius: 6px; background: none; color: ${BRAND.faint}; cursor: pointer;
  opacity: 0; transition: opacity .15s, background .15s;
}
.mr-toast:hover .mr-toast-x, .mr-toast-x:focus-visible { opacity: 1; }
.mr-toast-x:hover { background: rgba(255,255,255,.08); color: ${BRAND.ink}; }
.mr-toast-life {
  position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; background: var(--tone); opacity: .7;
  transform-origin: left; animation: mr-life var(--life) linear forwards;
}
.mr-toast.is-held .mr-toast-life { animation-play-state: paused; }
@keyframes mr-life { from { transform: scaleX(1); } to { transform: scaleX(0); } }

/* The hint above the bar: what the tool in hand does. */
.mr-hint {
  display: inline-flex; align-items: center; gap: 9px; padding: 7px 15px 7px 12px; border-radius: 999px;
  background: rgba(12,17,25,.9); border: 1px solid rgba(160,190,220,.16); color: #dfe7f0;
  font: 600 12.5px/1.3 var(--ui); white-space: nowrap; pointer-events: none;
  box-shadow: 0 8px 22px rgba(0,0,0,.4); backdrop-filter: blur(12px);
}
.mr-hint::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan); }

/* ---- title screen ---------------------------------------------------- */
.mr-menu {
  position: fixed; inset: 0; z-index: 20; pointer-events: none;
  display: grid; grid-template-rows: 1fr auto; opacity: 0;
  transition: opacity .9s ease; color: var(--ink); font: 400 15px/1.5 var(--ui);
}
.mr-menu::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(90deg, rgba(3,6,11,.82) 0%, rgba(4,8,14,.55) 26%, rgba(5,10,18,.12) 50%, rgba(5,10,18,0) 64%),
    linear-gradient(180deg, rgba(2,4,8,.55) 0%, rgba(2,4,8,0) 18%, rgba(2,4,8,0) 72%, rgba(2,4,8,.72) 100%);
}
.mr-news {
  position: absolute; right: clamp(24px, 5vw, 80px); bottom: 84px; width: min(360px, 34vw);
  display: flex; flex-direction: column; gap: 12px; padding: 18px 18px 16px; pointer-events: auto;
  border-radius: 16px; background: rgba(8,12,19,.62); border: 1px solid rgba(255,255,255,.09);
  box-shadow: 0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.07); backdrop-filter: blur(14px);
  animation: mr-news-in .9s .6s cubic-bezier(.2,.9,.3,1) both;
}
@keyframes mr-news-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.mr-news-head { font: 700 11px/1 var(--label); letter-spacing: .3em; text-transform: uppercase; color: var(--amber);
  display: flex; align-items: center; gap: 10px; }
.mr-news-head::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(244,181,74,.5), transparent); }
.mr-news-row { display: grid; grid-template-columns: 30px 1fr; gap: 10px; align-items: start; }
.mr-news-ico { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--amber);
  background: rgba(244,181,74,.1); border: 1px solid rgba(244,181,74,.22); }
.mr-news-row b { display: block; font: 700 13.5px/1.2 var(--ui); color: var(--ink); margin-bottom: 2px; }
.mr-news-row span { display: block; font-size: 12px; line-height: 1.4; color: #93a4b8; }
@media (max-width: 980px), (max-height: 640px) { .mr-news { display: none; } }
.mr-col {
  position: relative; align-self: center; pointer-events: auto;
  display: flex; flex-direction: column; gap: clamp(22px, 4vh, 40px);
  padding: 0 clamp(24px, 6.5vw, 104px); width: min(620px, 100%); box-sizing: border-box;
}
.mr-eyebrow {
  font: 600 12px/1 var(--label); letter-spacing: .34em; text-transform: uppercase;
  color: var(--amber); display: flex; align-items: center; gap: 12px;
}
.mr-eyebrow::before { content: ""; width: 34px; height: 2px; background: var(--amber); }
.mr-title {
  position: relative; isolation: isolate;
  margin: 10px 0 0; font: 900 clamp(64px, 10.5vw, 150px)/.8 var(--display);
  letter-spacing: .04em; text-transform: uppercase; color: var(--ink);
}
/* The title in relief: a gilded face over a stepped extrusion, lit from the
   top left, with its shadow thrown down behind it. */
.mr-title[data-text] { color: transparent; }
.mr-title[data-text]::before, .mr-title[data-text]::after {
  content: attr(data-text); position: absolute; inset: 0; pointer-events: none;
}
.mr-title[data-text]::before {
  color: #4a3210;
  text-shadow:
    1px 1px 0 #9a6c28, 2px 2px 0 #8c6124, 3px 3px 0 #7e5720, 4px 4px 0 #704c1b,
    5px 5px 0 #624217, 6px 6px 0 #543812, 7px 7px 0 #462e0e, 8px 8px 0 #38240a,
    10px 14px 18px rgba(0, 0, 0, .7), 0 24px 60px rgba(0, 0, 0, .55);
}
.mr-title[data-text]::after {
  color: transparent;
  background: linear-gradient(180deg, #fffaf0 0%, #f7e7c0 34%, #d7a750 50%, #b07c2c 56%, #f0d493 76%, #fff4d8 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-stroke: 1px rgba(255, 244, 214, .3);
}
.mr-tag {
  margin: 14px 0 0; max-width: 34ch; font: 500 clamp(15px, 1.35vw, 18px)/1.45 var(--ui);
  color: #c6d2e0; text-shadow: 0 1px 12px rgba(0,0,0,.7);
}
.mr-list { display: flex; flex-direction: column; gap: 2px; margin: 0 0 0 -22px; padding: 0; list-style: none; }
.mr-item {
  position: relative; display: grid; grid-template-columns: 1fr auto; align-items: baseline;
  column-gap: 16px; width: 100%; text-align: left; cursor: pointer;
  padding: 11px 16px 11px 22px; border: 0; border-radius: 3px; background: transparent;
  color: #d5dfeb; font: 700 clamp(19px, 1.9vw, 25px)/1.1 var(--display);
  letter-spacing: .06em; text-transform: uppercase;
  transition: background .18s ease, color .18s ease, padding .22s cubic-bezier(.2,.8,.3,1);
}
.mr-item::before {
  content: ""; position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px;
  background: var(--amber); transform: scaleY(0); transform-origin: center;
  transition: transform .22s cubic-bezier(.2,.8,.3,1);
}
.mr-item .mr-hint {
  grid-column: 1 / -1; font: 500 13px/1.35 var(--ui); letter-spacing: 0; text-transform: none;
  color: var(--dim, ${BRAND.dim}); max-height: 0; opacity: 0; overflow: hidden;
  transition: max-height .25s ease, opacity .2s ease, margin .25s ease;
}
.mr-item .mr-key {
  font: 600 11px/1 var(--label); letter-spacing: .18em; color: ${BRAND.faint};
}
.mr-item:hover, .mr-item.is-active, .mr-item:focus-visible {
  background: linear-gradient(90deg, rgba(244,181,74,.13), rgba(244,181,74,0) 80%);
  color: #fff; padding-left: 28px; outline: none;
}
.mr-item:hover::before, .mr-item.is-active::before, .mr-item:focus-visible::before { transform: scaleY(1); }
.mr-item:hover .mr-hint, .mr-item.is-active .mr-hint, .mr-item:focus-visible .mr-hint {
  max-height: 3em; opacity: 1; margin-top: 5px;
}
.mr-item.is-primary { color: #fff; }
.mr-item.is-primary .mr-key { color: var(--amber); }
.mr-item .mr-x {
  font: 600 13px/1 var(--ui); color: ${BRAND.faint}; padding: 4px 8px; border-radius: 3px;
}
.mr-item .mr-x:hover { color: #ff8a7a; background: rgba(255,120,100,.12); }
.mr-scroll { max-height: min(340px, 42vh); overflow-y: auto; }
.mr-note {
  margin: 0; min-height: 2.8em; max-width: 44ch; color: ${BRAND.dim};
  font: 500 13px/1.45 var(--ui); text-shadow: 0 1px 10px rgba(0,0,0,.7);
}
.mr-code {
  width: 100%; height: 104px; resize: none; padding: 12px 14px; box-sizing: border-box;
  border-radius: 4px; border: 1px solid rgba(244,181,74,.28); background: rgba(6,10,17,.72);
  color: var(--ink); font: 500 12px/1.5 ui-monospace, "SF Mono", Menlo, monospace;
  backdrop-filter: blur(10px); outline: none;
}
.mr-code:focus { border-color: var(--amber); }
.mr-foot {
  position: relative; pointer-events: none; display: flex; justify-content: space-between;
  align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 0 clamp(24px, 6.5vw, 104px) clamp(18px, 3.4vh, 34px);
  font: 600 11px/1.4 var(--label); letter-spacing: .2em; text-transform: uppercase; color: ${BRAND.faint};
}
.mr-foot kbd {
  display: inline-block; min-width: 1.6em; padding: 2px 5px; margin: 0 2px; text-align: center;
  border: 1px solid rgba(255,255,255,.16); border-bottom-width: 2px; border-radius: 3px;
  font: 600 10px/1.2 var(--label); color: #b8c6d6; letter-spacing: .06em;
}
.mr-foot .mr-live { display: inline-flex; align-items: center; gap: 8px; }
.mr-foot .mr-live::before {
  content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--amber);
  box-shadow: 0 0 10px var(--amber); animation: mr-pulse 2.4s ease-in-out infinite;
}

/* ---- mods ---------------------------------------------------------------- */
.mr-mods { background: linear-gradient(180deg, rgba(5,9,15,.93), rgba(5,9,15,.97)); backdrop-filter: blur(14px); }
.mr-chip { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px;
  font: 600 10.5px/1 var(--label); letter-spacing: .18em; text-transform: uppercase; color: #b8c6d6;
  background: rgba(8,12,19,.5); border: 1px solid rgba(255,255,255,.12); }
.mr-chip.is-amber { color: var(--amber); border-color: rgba(244,181,74,.4); background: rgba(244,181,74,.1); }
.mr-mods .mr-setup-head .mr-chip { margin-left: 6px; }
.mr-mods-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: 12px; }
.mr-mods-tab { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; padding: 10px 16px;
  border-radius: 10px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04);
  color: #a9b8cb; font: 700 13px/1 var(--label); letter-spacing: .14em; text-transform: uppercase; }
.mr-mods-tab i { display: inline-flex; }
.mr-mods-tab:hover { color: var(--ink); border-color: rgba(255,255,255,.22); }
.mr-mods-tab.is-on { color: var(--amber); border-color: rgba(244,181,74,.45); background: rgba(244,181,74,.1); }
.mr-mods-body { flex: 1; display: grid; place-items: center; min-height: 320px; }
.mr-mods-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;
  max-width: 460px; padding: 34px 28px; border-radius: 18px; border: 1px dashed rgba(255,255,255,.16);
  background: rgba(8,12,19,.45); }
.mr-mods-art { display: grid; place-items: center; width: 86px; height: 86px; border-radius: 22px; color: var(--amber);
  background: radial-gradient(circle at 50% 35%, rgba(244,181,74,.22), rgba(244,181,74,.04));
  border: 1px solid rgba(244,181,74,.3); }
.mr-mods-empty h3 { margin: 6px 0 0; font: 800 24px/1.1 var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--ink); }
.mr-mods-empty p { margin: 0; color: #93a4b8; font: 500 14px/1.5 var(--ui); }
.mr-mods-empty .mr-found[disabled] { opacity: .45; cursor: not-allowed; filter: grayscale(.6); margin-top: 6px; transform: none; box-shadow: none; }

/* ---- loading screen --------------------------------------------------- */
.mr-load {
  position: fixed; inset: 0; z-index: 30; pointer-events: auto; overflow: hidden;
  display: grid; place-items: end start; background: #05080d; color: var(--ink);
  font: 400 14px/1.5 var(--ui); transition: opacity .9s ease;
}
.mr-load-art {
  position: absolute; inset: 0; background-position: center 38%; background-size: cover;
  animation: mr-drift 30s ease-out forwards; filter: saturate(1.08);
}
.mr-load::after {
  content: ""; position: absolute; inset: 0;
  background:
    linear-gradient(0deg, rgba(3,5,9,.92) 0%, rgba(3,5,9,.55) 30%, rgba(3,5,9,0) 62%),
    linear-gradient(90deg, rgba(3,5,9,.5), rgba(3,5,9,0) 60%);
}
.mr-load-stack {
  position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px;
  padding: 0 clamp(24px, 6.5vw, 104px) clamp(34px, 8vh, 80px); width: min(720px, 100%);
  box-sizing: border-box; opacity: 0;
}
.mr-load.is-typed .mr-load-stack { animation: mr-rise 1.1s cubic-bezier(.16,.84,.28,1) both; }
.mr-load .mr-title { font-size: clamp(56px, 8.5vw, 120px); }
.mr-rail { position: relative; height: 2px; width: min(460px, 100%); background: rgba(255,255,255,.14); overflow: hidden; margin-top: 10px; }
.mr-fill {
  position: absolute; inset: 0 auto 0 0; width: 0%; background: var(--amber);
  box-shadow: 0 0 16px rgba(244,181,74,.8); transition: width .5s cubic-bezier(.3,.8,.4,1);
}
.mr-step { margin: 0; min-height: 1.4em; font: 600 12px/1.4 var(--label); letter-spacing: .24em; text-transform: uppercase; color: ${BRAND.dim}; }
.mr-tip { margin: 6px 0 0; max-width: 52ch; font: 500 14px/1.5 var(--ui); color: #b6c3d2; }
.mr-tip b { color: var(--amber); font: 700 11px/1 var(--label); letter-spacing: .24em; text-transform: uppercase; margin-right: 10px; }

@keyframes mr-drift { from { transform: scale(1.08); } to { transform: scale(1); } }
@keyframes mr-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes mr-pulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .mr-load-art, .mr-foot .mr-live::before { animation: none !important; }
  .mr-load.is-typed .mr-load-stack { animation: none !important; opacity: 1; }
  .mr-item, .mr-item::before { transition: none !important; }
}
@media (max-width: 560px) {
  .mr-menu::before { background: linear-gradient(180deg, rgba(3,6,11,.55), rgba(3,6,11,.25) 40%, rgba(3,6,11,.85)); }
  .mr-foot .mr-keys { display: none; }
}
`;

let installed = false;

/** Adds the fonts and the global styles, once. */
export function installTheme(): void {
  if (installed) return;
  installed = true;
  try {
    const pre = document.createElement('link');
    pre.rel = 'preconnect';
    pre.href = 'https://fonts.gstatic.com';
    pre.crossOrigin = '';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS;
    document.head.append(pre, link);
  } catch {
    // No head to add to is no reason not to boot.
  }
  const style = document.createElement('style');
  style.id = 'meridian-theme';
  style.textContent = CSS;
  document.head.appendChild(style);
}
