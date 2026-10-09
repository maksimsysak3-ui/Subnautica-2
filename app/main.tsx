import { createRoot } from 'react-dom/client';
import { App } from '../src/ui/App';
import { CrashGuard } from '../src/ui/crash';
import { installUiSounds } from '../src/ui/sfx';
import { RAW_TEAMS } from '../src/core/league';
import '../src/ui/styles.css';
import '../src/ui/theme.css';

const bar = document.getElementById('boot-bar') as HTMLElement | null;
const msg = document.getElementById('boot-msg') as HTMLElement | null;
const set = (k: number, text: string) => { if (bar) bar.style.width = `${Math.round(k * 100)}%`; if (msg) msg.textContent = text; };

/** Warm the browser cache with every team logo so menus never pop in. */
async function preload() {
  set(0.15, 'Loading 2026 rosters…');
  let done = 0;
  await Promise.race([
    Promise.all(RAW_TEAMS.map(t => new Promise<void>(res => {
      const img = new Image();
      img.onload = img.onerror = () => { done++; set(0.15 + 0.8 * (done / RAW_TEAMS.length), `Loading team logos ${done}/${RAW_TEAMS.length}`); res(); };
      img.src = t.logo;
    }))),
    new Promise(res => setTimeout(res, 6000)),
  ]);
  set(1, 'Ready');
}
preload().then(() => {
  createRoot(document.getElementById('root')!).render(<CrashGuard><App /></CrashGuard>);
  installUiSounds();
  setTimeout(() => document.getElementById('boot')?.classList.add('done'), 150);
  setTimeout(() => document.getElementById('boot')?.remove(), 900);
});
