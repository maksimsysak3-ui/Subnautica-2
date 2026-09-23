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
  margin: 10px 0 0; font: 900 clamp(64px, 10.5vw, 150px)/.8 var(--display);
  letter-spacing: .015em; text-transform: uppercase; color: var(--ink);
  text-shadow: 0 4px 40px rgba(0,0,0,.55);
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
