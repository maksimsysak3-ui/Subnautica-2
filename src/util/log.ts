/**
 * Leveled logging with an on-screen ring buffer.
 *
 * Everything that happens during boot goes through here so that a user on a
 * machine we cannot reach can hit the console key and read what went wrong.
 */

export type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const COLOR: Record<Level, string> = {
  debug: '#5d6b80',
  info: '#c9d4e3',
  warn: '#ffb454',
  error: '#ff6b7a',
};

export interface Entry {
  t: number;
  level: Level;
  scope: string;
  msg: string;
}

const RING = 256;
const entries: Entry[] = [];
let minLevel: Level = 'debug';
let el: HTMLElement | null = null;
let dirty = false;

function push(level: Level, scope: string, msg: string): void {
  if (ORDER[level] < ORDER[minLevel]) return;
  entries.push({ t: performance.now(), level, scope, msg });
  if (entries.length > RING) entries.shift();
  dirty = true;

  const line = `[${scope}] ${msg}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (scope: string, msg: string) => push('debug', scope, msg),
  info: (scope: string, msg: string) => push('info', scope, msg),
  warn: (scope: string, msg: string) => push('warn', scope, msg),
  error: (scope: string, msg: string) => push('error', scope, msg),
  setLevel: (l: Level) => { minLevel = l; },
  entries: (): readonly Entry[] => entries,
};

/** Mounts a hidden console panel, toggled with the backtick key. */
export function mountConsole(parent: HTMLElement): void {
  el = document.createElement('div');
  el.style.cssText = [
    'position:absolute', 'left:0', 'bottom:0', 'width:100%', 'max-height:45%',
    'overflow:hidden', 'padding:8px 12px', 'background:rgba(6,9,13,.92)',
    'border-top:1px solid rgba(98,212,255,.18)', 'font:11px/1.55 var(--mono)',
    'white-space:pre-wrap', 'display:none', 'pointer-events:none',
  ].join(';');
  parent.appendChild(el);

  addEventListener('keydown', (e) => {
    if (e.key !== '`' || e.metaKey || e.ctrlKey) return;
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    dirty = true;
  });

  const paint = () => {
    if (el && dirty && el.style.display !== 'none') {
      el.innerHTML = entries
        .slice(-40)
        .map((e) => {
          const t = (e.t / 1000).toFixed(2).padStart(7);
          return `<span style="color:#3d4757">${t}</span> <span style="color:${COLOR[e.level]}">[${e.scope}] ${escape(e.msg)}</span>`;
        })
        .join('<br>');
      dirty = false;
    }
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}
