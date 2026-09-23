/**
 * The screen a user sees when the engine cannot start.
 *
 * Roughly a third of visitors will land here (Firefox before 141, Safari
 * before 18, anything on an old Android). A blank page tells them nothing, so
 * this explains what is missing and what to do about it.
 */

import { installTheme } from './theme';
import { LOADING_ART } from './loading-art';

export type FatalKind = 'no-webgpu' | 'no-adapter' | 'no-device' | 'device-lost' | 'internal';

const TITLES: Record<FatalKind, string> = {
  'no-webgpu': 'This browser has no WebGPU',
  'no-adapter': 'No compatible GPU found',
  'no-device': 'The GPU refused to start',
  'device-lost': 'Lost connection to the GPU',
  internal: 'Something broke during startup',
};

/** Best-effort, per-browser advice. Detection is coarse on purpose. */
function advice(kind: FatalKind): string[] {
  const ua = navigator.userAgent;
  const chromium = /Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua);
  const firefox = /Firefox\//.test(ua);
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);

  if (kind === 'no-webgpu') {
    if (firefox) {
      return [
        'Firefox ships WebGPU on Windows from version 141. On macOS and Linux it is still behind a flag.',
        'Open about:config and set dom.webgpu.enabled to true, then reload.',
        'Or use Chrome, Edge, or Safari 18+.',
      ];
    }
    if (safari) {
      return [
        'Safari supports WebGPU from version 18 (macOS Sequoia, iOS 18).',
        'On older Safari: Develop → Feature Flags → enable WebGPU.',
      ];
    }
    if (chromium) {
      return [
        'Chrome and Edge support WebGPU from version 113, so this is unusual.',
        'Check chrome://gpu — WebGPU may be blocklisted for this GPU or driver.',
        'Updating your graphics driver is the usual fix.',
      ];
    }
    return ['Try a recent Chrome, Edge, or Safari 18+.'];
  }

  if (kind === 'no-adapter') {
    return [
      'The browser has WebGPU but could not find a usable GPU.',
      'This is common in virtual machines, remote desktops, and on Linux without a working Vulkan driver.',
      chromium ? 'Check chrome://gpu for the reason it was rejected.' : 'Check your browser’s GPU diagnostics page.',
    ];
  }

  if (kind === 'device-lost') {
    return [
      'The GPU process crashed or was reset — usually a driver timeout or the machine waking from sleep.',
      'Reloading normally fixes it. If it happens repeatedly, update your graphics driver.',
    ];
  }

  return ['Reload to try again. If it keeps happening, the details below are worth reporting.'];
}

export function fatal(kind: FatalKind, detail?: string): void {
  installTheme();
  const boot = document.getElementById('boot');
  if (boot) boot.classList.remove('done');
  // Anything the loader or the menu already put up would sit over this.
  for (const el of Array.from(document.querySelectorAll('.mr-load, .mr-menu'))) el.remove();

  const host = boot ?? document.body;
  host.innerHTML = '';
  host.style.cssText += ';display:grid;place-items:end start;place-content:end start;padding:0;text-align:left;gap:0;'
    + `background:#05080d url('${LOADING_ART}') center 38% / cover no-repeat;`;

  const scrim = document.createElement('div');
  scrim.style.cssText = 'position:absolute;inset:0;background:linear-gradient(0deg,'
    + 'rgba(3,5,9,.96) 0%,rgba(3,5,9,.78) 45%,rgba(3,5,9,.35) 100%)';
  host.appendChild(scrim);

  const col = document.createElement('div');
  col.style.cssText = 'position:relative;display:flex;flex-direction:column;gap:14px;'
    + 'padding:0 clamp(24px,6.5vw,104px) clamp(34px,8vh,80px);max-width:min(720px,100%);'
    + 'box-sizing:border-box;color:#dbe4ee;font:500 15px/1.6 var(--ui)';
  col.innerHTML = '<div class="mr-eyebrow">A city builder</div>'
    + '<h1 class="mr-title" style="font-size:clamp(52px,8vw,110px);letter-spacing:.015em;color:var(--ink)">Meridian</h1>';

  const h = document.createElement('h2');
  h.textContent = TITLES[kind];
  h.style.cssText = 'margin:8px 0 0;font:700 22px/1.2 var(--display);letter-spacing:.06em;'
    + 'text-transform:uppercase;color:#ff9c7a';
  col.appendChild(h);

  for (const line of advice(kind)) {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.cssText = 'margin:0;max-width:60ch';
    col.appendChild(p);
  }

  if (detail) {
    const pre = document.createElement('pre');
    pre.textContent = detail;
    pre.style.cssText = 'margin:8px 0 0;padding:12px 14px;background:rgba(255,120,100,.08);'
      + 'border-left:2px solid #ff9c7a;color:#9fb0c4;font:12px/1.5 ui-monospace,Menlo,monospace;'
      + 'white-space:pre-wrap;word-break:break-word;max-height:26vh;overflow:auto';
    col.appendChild(pre);
  }

  const foot = document.createElement('p');
  foot.innerHTML = 'Report it at <a href="https://github.com/maksimsysak3-ui/Subnautica-2/issues"'
    + ' style="color:var(--amber)" target="_blank" rel="noopener">github.com/maksimsysak3-ui/Subnautica-2</a>';
  foot.style.cssText = 'margin:6px 0 0;color:#7d8fa5;font-size:13px';
  col.appendChild(foot);
  host.appendChild(col);
}
