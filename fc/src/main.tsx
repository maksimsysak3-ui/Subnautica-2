import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import logos from './data/logos.json';
import { logoUrl } from './core/world';
import './ui/fc.css';
import './ui/fc-theme.css';

const bar = document.getElementById('boot-bar') as HTMLElement | null;
const msg = document.getElementById('boot-msg') as HTMLElement | null;
const set = (k: number, text: string) => { if (bar) bar.style.width = `${Math.round(k * 100)}%`; if (msg) msg.textContent = text; };

/** Warm the cache with the top-flight crests so menus never pop in. */
async function preload() {
  const clubs = Object.entries((logos as unknown as { clubs: Record<string, [string, string, string, string]> }).clubs).filter(([, r]) => r[3] !== 'efl-championship' && !r[3].includes('-2') && r[3] !== 'serie-b' && r[3] !== '2-bundesliga');
  let done = 0;
  set(0.1, 'Loading club crests');
  await Promise.race([
    Promise.all(clubs.map(([slug, r]) => new Promise<void>(res => {
      const img = new Image();
      img.onload = img.onerror = () => { done++; set(0.1 + 0.85 * (done / clubs.length), `Loading club crests ${done}/${clubs.length}`); res(); };
      img.src = logoUrl(r[0], slug, r[1]);
    }))),
    new Promise(res => setTimeout(res, 5000)),
  ]);
  set(1, 'Ready');
}
void preload().then(() => {
  createRoot(document.getElementById('root')!).render(<App />);
  setTimeout(() => document.getElementById('boot')?.classList.add('done'), 120);
});
