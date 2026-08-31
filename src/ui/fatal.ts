/**
 * The screen a user sees when the engine cannot start.
 *
 * Roughly a third of visitors will land here (Firefox before 141, Safari
 * before 18, anything on an old Android). A blank page tells them nothing, so
 * this explains what is missing and what to do about it.
 */

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
  const boot = document.getElementById('boot');
  if (boot) boot.classList.remove('done');

  const host = boot ?? document.body;
  host.innerHTML = '';
  host.style.cssText +=
    ';display:grid;place-content:center;padding:32px;text-align:left;max-width:min(680px,92vw);margin:0 auto;';

  const h = document.createElement('h1');
  h.textContent = TITLES[kind];
  h.style.cssText =
    'font:500 15px/1.4 var(--mono);letter-spacing:.06em;color:var(--err);text-transform:none;margin-bottom:14px;';
  host.appendChild(h);

  const ul = document.createElement('div');
  ul.style.cssText = 'color:var(--fg);font-size:13px;line-height:1.75;';
  for (const line of advice(kind)) {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.cssText = 'margin-bottom:8px;';
    ul.appendChild(p);
  }
  host.appendChild(ul);

  if (detail) {
    const pre = document.createElement('pre');
    pre.textContent = detail;
    pre.style.cssText =
      'margin-top:20px;padding:12px 14px;background:rgba(255,107,122,.07);' +
      'border-left:2px solid var(--err);color:var(--dim);font-size:11px;' +
      'white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;';
    host.appendChild(pre);
  }

  const foot = document.createElement('p');
  foot.innerHTML = 'Reported at <a href="https://github.com/maksimsysak3-ui/Subnautica-2/issues" style="color:var(--accent)">github.com/maksimsysak3-ui/Subnautica-2</a>';
  foot.style.cssText = 'margin-top:22px;color:var(--dim);font-size:11px;';
  host.appendChild(foot);
}
