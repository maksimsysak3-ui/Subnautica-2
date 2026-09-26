/**
 * The front of the game: a loading screen, then the title.
 *
 * Two different things with two different jobs. The loading screen holds
 * attention while nothing can be touched, so it is a painting -- full bleed,
 * the name over it, a bar that tells the truth about the build, and a tip to
 * read while it runs. The title has to get out of the way of the world behind
 * it, so it is the game's own land at whatever hour the clock has reached,
 * turning slowly, with one column of type down the left.
 *
 * The menu is a list, set large, and it is driven by the keyboard as much as
 * the pointer: arrows move, Enter chooses, Escape goes back.
 */

import { listSaves, readSave, writeSave, deleteSave, fromCode, toCode } from '../sim';
import type { SaveInfo, World } from '../sim';
import { LOADING_ART } from './loading-art';
import { installTheme } from './theme';
import { DIFFICULTIES, describe } from '../sim/difficulty';
import type { DifficultyId } from '../sim/difficulty';
import { glyph } from './glyphs';
import { CARD_SHOTS } from './setup-shots';
import { MAPS } from '../sim/maps';
import { RESOURCES } from '../sim/resources';
import type { MapId } from '../sim/maps';
import { drawMapPreview } from './map-preview';
import { openModsPanel } from './mods-panel';
import { enabledMods } from '../sim/mods';
import { openAchievementsPanel } from './achievements-panel';
import { ACHIEVEMENTS, earnedCount } from '../sim/achievements';

/** What the player chose before founding a city. */
export interface Setup {
  name: string;
  difficulty: DifficultyId;
  map: MapId;
}

/** Names offered for a new city, rerolled with the dice. */
const NAMES = ['Ashford', 'Riverside', 'Kingsmere', 'Harrowgate', 'Millbrook', 'Easton Vale',
  'Northwick', 'Salford', 'Brightwater', 'Oakhollow', 'Fenmarch', 'Stonebridge', 'Larkhill',
  'Port Averly', 'Wexham', 'Calder Cross'];


export interface MenuHooks {
  /** Start on empty land with the road in from the edge, named and set up. */
  onNew: (setup: Setup) => void;
  /** Put a loaded world on the map. */
  onLoad: (world: World, name: string) => void;
  /** The world as it stands, for saving and for sharing. */
  world: () => World;
  /** Let the menu drive the camera and the clock while it is up. */
  cinematic: (on: boolean) => void;
}

/** Read while the land is built. Each one is something the game will not tell you. */
const TIPS: readonly string[] = [
  'Buildings only grow on frontage. A road with nothing zoned beside it is a road to nowhere.',
  'Right-drag orbits and the wheel zooms toward the cursor, so you never have to put a tool down to look around.',
  'Traffic is real. Every car on the road is somebody going somewhere, and a jam costs the city money.',
  'Land value rises near parks, schools and quiet streets, and what grows follows the value.',
  'Pause with Space. The sun, the lit windows and the shadows all stop with the city.',
  'A city travels as text. Copy yours from the title screen and anyone who pastes it lands on your map.',
];

interface Entry {
  label: string;
  hint: string;
  key?: string;
  primary?: boolean;
  run: () => void;
  remove?: () => void;
}

export class Menu {
  private loader: HTMLElement;
  private root: HTMLElement;
  private bar: HTMLElement;
  private step: HTMLElement;
  private body: HTMLElement;
  private note: HTMLElement;
  private opened = false;
  private items: HTMLElement[] = [];
  private active = 0;
  private back: (() => void) | null = null;
  private tipTimer = 0;

  constructor(host: HTMLElement, private hooks: MenuHooks) {
    installTheme();
    this.loader = this.buildLoader();
    host.appendChild(this.loader);
    this.root = this.buildMenu();
    host.appendChild(this.root);

    this.bar = this.loader.querySelector('[data-bar]') as HTMLElement;
    this.step = this.loader.querySelector('[data-step]') as HTMLElement;
    this.body = this.root.querySelector('[data-body]') as HTMLElement;
    this.note = this.root.querySelector('[data-note]') as HTMLElement;
    addEventListener('keydown', this.onKey);
  }

  private buildLoader(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'mr-load';
    const art = document.createElement('div');
    art.className = 'mr-load-art';
    art.style.backgroundImage = `url('${LOADING_ART}')`;
    const stack = document.createElement('div');
    stack.className = 'mr-load-stack';
    stack.innerHTML = '<div class="mr-eyebrow">A city builder</div>'
      + '<h1 class="mr-title" data-text="Civitas">Civitas</h1>'
      + '<div class="mr-rail"><div class="mr-fill" data-bar></div></div>'
      + '<p class="mr-step" data-step></p>'
      + '<p class="mr-tip" data-tip></p>';
    el.append(art, stack);
    let n = Math.floor(Math.random() * TIPS.length);
    const show = (): void => {
      const t = el.querySelector('[data-tip]');
      if (t) t.innerHTML = `<b>Tip</b>${TIPS[n % TIPS.length]}`;
      n++;
    };
    show();
    this.tipTimer = window.setInterval(show, 5200);
    // The lock-up waits for its typeface, briefly: a title that arrives in
    // Arial and then jumps into its own face is the first thing anyone sees.
    const typed = (): void => el.classList.add('is-typed');
    setTimeout(typed, 1200);
    document.fonts?.load('900 64px "Big Shoulders Display"').then(typed, typed);
    return el;
  }

  progress(t: number, label: string): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, t)) * 100)}%`;
    this.step.textContent = label;
  }

  private buildMenu(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'mr-menu';
    const col = document.createElement('div');
    col.className = 'mr-col';
    col.innerHTML = '<header><div class="mr-eyebrow">A city builder</div>'
      + '<h1 class="mr-title" data-text="Civitas">Civitas</h1>'
      + '<p class="mr-tag">Draw the roads and zone the land. The people who arrive decide the rest.</p>'
      + '</header>';
    const body = document.createElement('nav');
    body.dataset.body = '';
    body.setAttribute('aria-label', 'Main menu');
    const note = document.createElement('p');
    note.className = 'mr-note';
    note.dataset.note = '';
    col.append(body, note);
    const foot = document.createElement('footer');
    foot.className = 'mr-foot';
    foot.innerHTML = '<span class="mr-live">Live world · WebGPU</span>'
      + '<span class="mr-keys"><kbd>\u2191</kbd><kbd>\u2193</kbd> choose'
      + ' &nbsp; <kbd>Enter</kbd> open &nbsp; <kbd>Esc</kbd> back</span>';
    el.append(col, this.news(), foot);
    return el;
  }

  /**
   * What changed, on the title screen, for a player coming back to a city: a
   * returning player's first question is what is different, and a list of
   * features they would otherwise only find by accident answers it.
   */
  private news(): HTMLElement {
    const card = document.createElement('aside');
    card.className = 'mr-news';
    card.setAttribute('aria-label', "What's new");
    const head = document.createElement('div');
    head.className = 'mr-news-head';
    head.innerHTML = "<span>What's new</span><em>Autumn update</em>";
    card.appendChild(head);
    const items: Array<[string, string]> = [
      ['Mods', 'Switch on rule changes, build your own, or add a ready-made one from the Mods screen.'],
      ['Achievements', 'Twenty-five of them, kept across every city you run.'],
      ['Loans', 'Borrow from the regional bank for the big projects, and pay it back weekly.'],
      ['Supertalls', 'Twelve landmark skyscrapers, each one a real building type.'],
      ['Landmark prestige', 'Land near a landmark is worth more, and so are its taxes.'],
    ];
    const list = document.createElement('ol');
    list.className = 'mr-news-list';
    items.forEach(([title, text], i) => {
      const li = document.createElement('li');
      li.style.setProperty('--i', String(i));
      const n = document.createElement('span');
      n.className = 'mr-news-n';
      n.textContent = String(i + 1).padStart(2, '0');
      const words = document.createElement('div');
      const t = document.createElement('b');
      t.textContent = title;
      const d = document.createElement('span');
      d.textContent = text;
      words.append(t, d);
      li.append(n, words);
      list.appendChild(li);
    });
    card.appendChild(list);
    return card;
  }

  /** Called once the world is built: the loader fades out over the title. */
  ready(): void {
    if (this.opened) return;
    this.opened = true;
    this.progress(1, 'Ready');
    clearInterval(this.tipTimer);
    this.hooks.cinematic(true);
    this.loader.style.opacity = '0';
    setTimeout(() => this.loader.remove(), 950);
    setTimeout(() => {
      this.show();
      this.root.style.opacity = '1';
    }, 420);
  }

  /** Lays out a list of entries, and whatever Escape should do from here. */
  private list(entries: Entry[], back: (() => void) | null, scroll = false): void {
    this.body.replaceChildren();
    this.back = back;
    const ul = document.createElement('ul');
    ul.className = scroll ? 'mr-list mr-scroll' : 'mr-list';
    this.items = entries.map((e, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = 'mr-item' + (e.primary ? ' is-primary' : '');
      const name = document.createElement('span');
      name.textContent = e.label;
      const key = document.createElement('span');
      key.className = 'mr-key';
      key.textContent = e.key ?? '';
      if (e.remove) {
        key.className = 'mr-x';
        key.textContent = 'Delete';
        key.setAttribute('role', 'button');
        key.title = `Delete ${e.label}`;
        const remove = e.remove;
        key.addEventListener('click', (ev) => { ev.stopPropagation(); remove(); });
      }
      const hint = document.createElement('span');
      hint.className = 'mr-hint';
      hint.textContent = e.hint;
      b.append(name, key, hint);
      b.addEventListener('pointerenter', () => this.focus(i));
      b.addEventListener('focus', () => this.focus(i));
      b.addEventListener('click', e.run);
      li.appendChild(b);
      ul.appendChild(li);
      return b;
    });
    this.body.appendChild(ul);
    this.focus(0);
  }

  private focus(i: number): void {
    if (this.items.length === 0) return;
    this.active = (i + this.items.length) % this.items.length;
    this.items.forEach((b, j) => b.classList.toggle('is-active', j === this.active));
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (!this.opened || this.root.style.pointerEvents === 'none' || !this.root.isConnected) return;
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
      if (e.key === 'Escape' && this.back) { e.preventDefault(); this.back(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.focus(this.active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.focus(this.active - 1); }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.items[this.active]?.click();
    } else if (e.key === 'Escape' && this.back) { e.preventDefault(); this.back(); }
  };

  private show(): void {
    const saves = listSaves();
    const entries: Entry[] = [];
    if (saves.length > 0) {
      const last = saves[0];
      entries.push({ label: 'Continue', key: last.name, primary: true,
        hint: `${last.name} \u2014 ${slotHint(last)}, ${when(last.at)}`,
        run: () => this.open(last.key) });
    }
    entries.push({ label: 'New city', primary: saves.length === 0,
      hint: 'Empty land by the river, with one road in from the edge of the map.',
      run: () => this.showSetup() });
    entries.push({ label: 'Load city', key: saves.length > 0 ? `${saves.length} saved` : '',
      hint: 'Pick up any city saved in this browser.', run: () => this.showLoad() });
    entries.push({ label: 'Share & join',
      hint: 'Send your city to a friend as a code, or paste theirs to visit it.',
      run: () => this.showJoin() });
    entries.push({ label: 'Achievements', key: `${earnedCount()} / ${ACHIEVEMENTS.length}`,
      hint: 'What you have done across every city, and what is left to do.',
      run: () => openAchievementsPanel(this.root, () => this.show()) });
    const modsOn = enabledMods().length;
    entries.push({ label: 'Mods', key: modsOn > 0 ? `${modsOn} on` : '',
      hint: 'Switch on mods that change the rules, make your own, or try ready-made ones.',
      run: () => this.showMods() });
    this.list(entries, null);
    this.note.textContent = saves.length > 0
      ? 'Saves live in this browser. Clearing site data clears them.'
      : '';
  }

  private showLoad(): void {
    const saves = listSaves();
    const entries: Entry[] = saves.map((s) => ({
      label: s.name, hint: `${slotHint(s)} \u00b7 ${when(s.at)}`,
      run: () => this.open(s.key),
      remove: () => { deleteSave(s.key); this.showLoad(); },
    }));
    entries.push({ label: 'Back', hint: 'Return to the title.', run: () => this.show() });
    this.list(entries, () => this.show(), true);
    this.note.textContent = saves.length === 0
      ? 'Nothing saved yet. Cities you save in play, and the autosave, appear here.'
      : 'Saves live in this browser. Clearing site data clears them.';
  }

  private showJoin(): void {
    const box = document.createElement('textarea');
    box.className = 'mr-code';
    box.id = 'mr-city-code';
    box.placeholder = 'Paste a city code here\u2026';
    box.spellcheck = false;
    box.setAttribute('aria-label', 'City code');
    this.list([
      { label: 'Join this city', primary: true, hint: 'Open the city in the code above.',
        run: () => {
          void (async (): Promise<void> => {
            const got = await fromCode(box.value);
            if (got === null) { this.note.textContent = 'That is not a city code. Check it was copied whole.'; return; }
            this.close(() => this.hooks.onLoad(got.world, got.name));
          })();
        } },
      { label: 'Copy my city', hint: 'Turn the city on the map into a code you can send.',
        run: () => {
          void (async (): Promise<void> => {
            const code = await toCode(this.hooks.world(), 'Shared city');
            box.value = code;
            box.select();
            try {
              await navigator.clipboard.writeText(code);
              this.note.textContent = 'Copied. Anyone who pastes that code lands on your map.';
            } catch {
              this.note.textContent = 'The clipboard was refused. The code is selected in the box: copy it from there.';
            }
          })();
        } },
      { label: 'Back', hint: 'Return to the title.', run: () => this.show() },
    ], () => this.show());
    this.body.prepend(box);
    this.note.textContent = 'A city travels as text. There is no server; the code is the whole city.';
    box.focus();
  }

  /**
   * Founding a city: its name and how hard it is to run, chosen together on
   * one screen before the land is handed over.
   */
  private showSetup(): void {
    let pick: DifficultyId = 'standard';
    const el = document.createElement('div');
    el.className = 'mr-setup';
    el.dataset.panel = 'setup';

    const head = document.createElement('div');
    head.className = 'mr-setup-head';
    const back = document.createElement('button');
    back.className = 'mr-square';
    back.setAttribute('aria-label', 'Back');
    back.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
    const title = document.createElement('h2');
    title.textContent = 'Found a city';
    head.append(back, title);

    const nameBox = document.createElement('div');
    nameBox.className = 'mr-name';
    const label = document.createElement('label');
    label.htmlFor = 'mr-city-name';
    label.textContent = 'City name';
    const row = document.createElement('div');
    row.className = 'mr-name-row';
    const field = document.createElement('input');
    field.id = 'mr-city-name';
    field.maxLength = 32;
    field.spellcheck = false;
    field.value = NAMES[Math.floor(Math.random() * NAMES.length)];
    const dice = document.createElement('button');
    dice.className = 'mr-square';
    dice.title = 'Suggest another name';
    dice.setAttribute('aria-label', 'Suggest another name');
    dice.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
      + ' stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3.5"/>'
      + '<circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/>'
      + '<circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/></svg>';
    dice.addEventListener('click', () => {
      let next = field.value;
      while (next === field.value) next = NAMES[Math.floor(Math.random() * NAMES.length)];
      field.value = next;
    });
    row.append(field, dice);
    nameBox.append(label, row);

    // The map: five tiles, each a relief map drawn from that map's own ground.
    let mapPick: MapId = 'vale';
    const maps = document.createElement('div');
    maps.className = 'mr-maps';
    const mapsLabel = document.createElement('div');
    mapsLabel.className = 'mr-section-label';
    mapsLabel.textContent = 'Map';
    const mapRow = document.createElement('div');
    mapRow.className = 'mr-map-row';
    const tiles: HTMLElement[] = [];
    const chooseMap = (id: MapId): void => {
      mapPick = id;
      for (const t of tiles) {
        const on = t.dataset.map === id;
        t.classList.toggle('is-picked', on);
        t.setAttribute('aria-pressed', String(on));
      }
    };
    const pending: Array<() => void> = [];
    for (const mp of MAPS) {
      const tile = document.createElement('button');
      tile.className = 'mr-map';
      tile.dataset.map = mp.id;
      tile.title = mp.blurb;
      const pic = document.createElement('canvas');
      pic.className = 'mr-map-img';
      pic.width = 200; pic.height = 124;
      const nm = document.createElement('div');
      nm.className = 'mr-map-name';
      nm.textContent = mp.name;
      const tg = document.createElement('div');
      tg.className = 'mr-map-tag';
      tg.textContent = mp.tagline;
      // The map's three richest resources, as their icons in their own colours.
      const res = document.createElement('div');
      res.className = 'mr-map-res';
      const best = [...RESOURCES].sort((a, b) => mp.richness[b.id] - mp.richness[a.id]).slice(0, 3);
      for (const r of best) {
        const chip = document.createElement('span');
        chip.style.color = r.ramp[2];
        chip.title = `${r.name}: ${mp.richness[r.id] >= 1.6 ? 'plentiful' : mp.richness[r.id] >= 1 ? 'good' : 'some'}`;
        chip.innerHTML = glyph(r.icon, 15);
        res.appendChild(chip);
      }
      tile.append(pic, nm, tg, res);
      tile.addEventListener('click', () => chooseMap(mp.id));
      mapRow.appendChild(tile);
      tiles.push(tile);
      pending.push(() => drawMapPreview(pic, mp.id));
    }
    maps.append(mapsLabel, mapRow);
    chooseMap(mapPick);
    // One preview a frame: each is some tens of thousands of height samples,
    // and five in one go would hold the screen still as it opens.
    const drawNext = (): void => {
      const job = pending.shift();
      if (job === undefined || !maps.isConnected) return;
      job();
      requestAnimationFrame(drawNext);
    };
    requestAnimationFrame(() => requestAnimationFrame(drawNext));

    const cards = document.createElement('div');
    cards.className = 'mr-cards';
    const all: HTMLElement[] = [];
    const choose = (id: DifficultyId): void => {
      pick = id;
      for (const c of all) c.classList.toggle('is-picked', c.dataset.difficulty === id);
    };
    for (const d of DIFFICULTIES) {
      const card = document.createElement('button');
      card.className = 'mr-card';
      card.dataset.difficulty = d.id;
      const art = document.createElement('div');
      art.className = 'mr-card-art';
      art.style.backgroundImage = `url(${CARD_SHOTS[d.id]})`;
      const name = document.createElement('div');
      name.className = 'mr-card-title';
      name.textContent = d.label;
      const artWrap = document.createElement('div');
      artWrap.style.cssText = 'position:relative;overflow:hidden';
      artWrap.append(art, name);
      const body = document.createElement('div');
      body.className = 'mr-card-body';
      const tag = document.createElement('div');
      tag.className = 'mr-card-tag';
      tag.textContent = d.tagline;
      const blurb = document.createElement('p');
      blurb.className = 'mr-card-blurb';
      blurb.textContent = d.blurb;
      const list = document.createElement('ul');
      for (const line of describe(d)) {
        const li = document.createElement('li');
        li.textContent = line;
        list.appendChild(li);
      }
      const sel = document.createElement('div');
      sel.className = 'mr-pick';
      sel.innerHTML = '<span class="mr-pick-on">Selected</span>';
      body.append(tag, blurb, list, sel);
      card.append(artWrap, body);
      card.addEventListener('click', () => choose(d.id));
      cards.appendChild(card);
      all.push(card);
    }
    const paintPicks = (): void => {
      for (const c of all) {
        const s = c.querySelector('.mr-pick');
        if (s) s.textContent = c.classList.contains('is-picked') ? 'Selected' : 'Select';
      }
    };
    for (const c of all) c.addEventListener('click', paintPicks);
    choose(pick);
    paintPicks();

    const foot = document.createElement('div');
    foot.className = 'mr-setup-foot';
    const note = document.createElement('p');
    note.textContent = 'The map and the difficulty are set for the life of this city.';
    const found = document.createElement('button');
    found.className = 'mr-found';
    found.innerHTML = `<span style="display:inline-flex;vertical-align:-4px;margin-right:10px">${glyph('signature', 20)}</span>Found the city`;
    foot.append(note, found);

    el.append(head, nameBox, maps, cards, foot);
    this.root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-open'));

    const shut = (): void => {
      removeEventListener('keydown', keys, true);
      el.remove();
    };
    const go = (): void => {
      const name = field.value.trim() === '' ? NAMES[0] : field.value.trim();
      shut();
      this.close(() => this.hooks.onNew({ name, difficulty: pick, map: mapPick }));
    };
    const keys = (e: KeyboardEvent): void => {
      // Captured ahead of the title list's own keys, which are underneath.
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); shut(); return; }
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); go(); return; }
      if (e.target === field) return;
      const i = DIFFICULTIES.findIndex((d) => d.id === pick);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const n = (i + (e.key === 'ArrowRight' ? 1 : DIFFICULTIES.length - 1)) % DIFFICULTIES.length;
        choose(DIFFICULTIES[n].id);
        paintPicks();
      }
    };
    addEventListener('keydown', keys, true);
    back.addEventListener('click', shut);
    found.addEventListener('click', go);
    field.focus();
    field.select();
  }

  /** The mods screen: see `mods-panel.ts`. The title's count refreshes on the way out. */
  private showMods(): void {
    openModsPanel(this.root, () => this.show());
  }

  private open(key: string): void {
    const got = readSave(key);
    if (got === null) { this.note.textContent = 'That save will not open. It may be from an older version.'; return; }
    this.close(() => this.hooks.onLoad(got.world, got.name));
  }

  private close(then: () => void): void {
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';
    removeEventListener('keydown', this.onKey);
    this.hooks.cinematic(false);
    setTimeout(() => {
      this.root.remove();
      then();
    }, 520);
  }
}

function slotHint(s: SaveInfo): string {
  const body = `${s.roads} roads, ${s.lots} placed`;
  return s.auto ? `${body} · autosaved` : body;
}

function when(at: number): string {
  if (at === 0) return 'unknown';
  const s = Math.max(0, (Date.now() - at) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/**
 * Saving from inside the game.
 *
 * A prompt rather than a panel: naming a save is the only decision, and a
 * screen built to collect one string is a screen in the way.
 */
export function saveFromGame(world: World, suggested: string,
  say: (text: string) => void, named: (name: string) => void = () => {}): void {
  // A panel, not `window.prompt`.
  //
  // `prompt` is refused outright in a sandboxed iframe -- which is exactly
  // where this game is played most of the time -- and a refused prompt returns
  // null, which is indistinguishable from the player pressing cancel. So
  // saving looked like it worked and quietly did nothing, every time, with no
  // way to tell. This asks for the name itself.
  const back = document.createElement('div');
  back.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:40', 'display:grid', 'place-items:center',
    'background:rgba(4,8,14,.62)', 'backdrop-filter:blur(3px)',
    'font:400 14px/1.5 var(--ui, system-ui, sans-serif)',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'display:flex', 'flex-direction:column', 'gap:12px', 'width:min(400px,90vw)',
    'padding:20px', 'border-radius:14px', 'background:rgba(17,25,37,.96)',
    'border:1px solid rgba(160,205,245,.22)', 'color:#f2f6fb',
    'box-shadow:0 24px 60px rgba(0,0,0,.6)',
  ].join(';');

  const h = document.createElement('div');
  h.textContent = 'Name this city';
  h.style.cssText = 'font:600 15px/1.2 inherit';
  const field = document.createElement('input');
  field.value = suggested;
  field.spellcheck = false;
  field.style.cssText = [
    'width:100%', 'padding:11px 13px', 'border-radius:10px',
    'border:1px solid rgba(160,205,245,.28)', 'background:rgba(8,13,21,.85)',
    'color:#f2f6fb', 'font:500 14px/1.2 inherit', 'outline:none',
  ].join(';');

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px';
  const shut = (): void => { back.remove(); document.removeEventListener('keydown', key); };
  const make = (label: string, primary: boolean, fn: () => void): HTMLElement => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'flex:1', 'padding:10px 14px', 'border-radius:10px', 'cursor:pointer',
      `border:1px solid ${primary ? 'rgba(143,216,255,.45)' : 'rgba(160,205,245,.20)'}`,
      primary ? 'background:rgba(56,142,196,.32)' : 'background:rgba(12,19,30,.7)',
      `color:${primary ? '#f2f6fb' : '#a9bcd2'}`, 'font:600 12px/1 inherit',
    ].join(';');
    b.addEventListener('click', fn);
    return b;
  };
  const commit = (): void => {
    const name = field.value.trim();
    if (name === '') { say('a city needs a name'); return; }
    const why = writeSave(world, name);
    shut();
    if (why !== null) { say(`could not save: ${why}`); return; }
    // Naming the save names the city. They were separate, which meant the two
    // could disagree and the one on screen was always the wrong one.
    named(name);
    say(`saved as \u201c${name}\u201d`);
  };
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { shut(); say('not saved'); }
    if (e.key === 'Enter') commit();
  };
  document.addEventListener('keydown', key);

  row.append(make('Save', true, commit), make('Cancel', false, () => { shut(); say('not saved'); }));
  card.append(h, field, row);
  back.appendChild(card);
  document.body.appendChild(back);
  field.focus();
  field.select();
}
