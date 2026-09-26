/**
 * The Mods screen, from the title menu.
 *
 * Three tabs. Installed lists every mod the player has -- the built-in packs
 * and tools, and their own buildings -- with a switch each. Create is the
 * Blueprint Studio: a tower drawn from a dozen controls, previewed as it
 * changes, saved as a mod of up to eight buildings, or read in from a pasted
 * mod file. Browse offers ready-made blueprints to start from.
 *
 * Buildings join the game's library as the page loads, so switching one on
 * or off takes a reload. The screen says so the moment it matters and offers
 * the reload itself, rather than leaving a switch that seems to do nothing.
 */

import {
  allMods, isEnabled, setEnabled, saveCustom, removeCustom, exportMod, importMod, freshId,
  reloadNeeded, PRESET_BLUEPRINTS, MAX_BUILDINGS, type ModDef,
} from '../sim/mods';
import {
  blueprintSvg, blueprintCapacity, blueprintAsset, cleanBlueprint, DEFAULT_BLUEPRINT,
  BP_SHAPES, BP_FACADES, BP_CROWNS, BP_ZONES, type Blueprint,
} from '../assets/generators/blueprint';
import { WONDERS } from '../assets/generators/wonders';
import { glyph } from './glyphs';
import { ModelView, modelIconHtml } from './model-view';

/** A blueprint's 3D still, keyed by the blueprint itself so an edit renders afresh. */
const bpIcon = (b: Blueprint, size: number): string =>
  modelIconHtml(blueprintAsset(cleanBlueprint(b), 'preview', 'x'), size, `bp:${JSON.stringify(cleanBlueprint(b))}`);

const BACK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const title = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** One building's summary line: height and what it holds. */
function sums(bp: Blueprint): string {
  const c = blueprintCapacity(bp);
  return `${Math.round(c.height)} m · ${c.homes > 0 ? `${c.homes} homes` : `${c.jobs} jobs`} · ${bp.width}×${bp.depth}`;
}

/** The pictures on a mod's card: its buildings, or its tool. */
function thumbs(m: ModDef): HTMLElement {
  const row = el('div', 'mr-mod-thumbs');
  const icons: string[] = m.kind === 'pack' && m.id === 'wonders' ? WONDERS.map((w) => modelIconHtml(w, 52))
    : m.kind === 'buildings' ? (m.buildings ?? []).map((b) => bpIcon(b, 52))
      : [glyph(m.tool === 'photo' ? 'look' : 'partly', 30)];
  for (const svg of icons.slice(0, 6)) {
    const t = el('span', m.kind === 'tool' ? 'mr-mod-thumb is-tool' : 'mr-mod-thumb');
    t.innerHTML = svg;
    row.appendChild(t);
  }
  return row;
}

function kindChip(m: ModDef): HTMLElement {
  const n = m.kind === 'pack' && m.id === 'wonders' ? WONDERS.length : m.buildings?.length ?? 0;
  return el('span', 'mr-mod-chip', m.kind === 'tool' ? 'Tool' : `${n} building${n === 1 ? '' : 's'}`);
}

/** Opens the screen over the title; `onClose` runs when it goes. */
export function openModsPanel(host: HTMLElement, onClose: () => void): void {
  const frame = el('div', 'mr-setup mr-mods');
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-label', 'Mods');
  const head = el('div', 'mr-setup-head');
  const back = el('button', 'mr-square');
  back.setAttribute('aria-label', 'Back');
  back.innerHTML = BACK_SVG;
  const heading = el('h2', '', 'Mods');
  const count = el('span', 'mr-chip is-amber');
  head.append(back, heading, count);

  const tabs = el('div', 'mr-mods-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'mr-mods-list');
  const note = el('p', 'mr-mods-note',
    'Buildings from mods sit in the Landmarks drawer under their own Mods tab, open from the start. Tools appear in the corner of the city.');
  const banner = el('div', 'mr-mods-reload');
  banner.append(el('span', '', 'Building mods changed. They load with the page: save your city, then reload to apply.'));
  const reload = el('button', 'mr-st-btn is-go', 'Reload now');
  reload.addEventListener('click', () => location.reload());
  banner.appendChild(reload);
  const TABS: Array<[string, string, string]> = [
    ['installed', 'Installed', 'mods'], ['create', 'Blueprint Studio', 'develop'], ['browse', 'Browse', 'look'],
  ];
  let on = 0;
  const recount = (): void => {
    const n = allMods().filter((m) => isEnabled(m.id)).length;
    count.textContent = n === 0 ? 'None on' : `${n} on`;
    banner.hidden = !reloadNeeded();
  };

  const paint = (k: number, editing: ModDef | null = null): void => {
    on = k;
    tabs.querySelectorAll('button').forEach((b, j) => {
      b.classList.toggle('is-on', j === k);
      b.setAttribute('aria-selected', String(j === k));
    });
    body.replaceChildren();
    if (k === 0) installed();
    else if (k === 1) studio(editing);
    else browse();
    recount();
  };

  const installed = (): void => {
    for (const m of allMods()) {
      const card = el('div', `mr-mod${isEnabled(m.id) ? ' is-on' : ''}`);
      const words = el('div', 'mr-mod-words');
      const name = el('div', 'mr-mod-name', m.name);
      name.appendChild(el('span', 'mr-mod-by', m.builtin ? 'built in' : `by ${m.author}`));
      const chips = el('div', 'mr-mod-chips');
      chips.appendChild(kindChip(m));
      words.append(name, el('div', 'mr-mod-desc', m.description || 'No description.'), chips, thumbs(m));
      const side = el('div', 'mr-mod-side');
      const sw = el('button', 'mr-switch');
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', String(isEnabled(m.id)));
      sw.setAttribute('aria-label', `${m.name} ${isEnabled(m.id) ? 'on' : 'off'}`);
      sw.addEventListener('click', () => {
        setEnabled(m.id, !isEnabled(m.id));
        paint(0);
      });
      side.appendChild(sw);
      if (!m.builtin) {
        const acts = el('div', 'mr-mod-acts');
        const edit = el('button', 'mr-mod-act', 'Edit');
        edit.addEventListener('click', () => paint(1, m));
        const share = el('button', 'mr-mod-act', 'Copy');
        share.addEventListener('click', () => {
          const text = exportMod(m);
          navigator.clipboard?.writeText(text).then(
            () => { note.textContent = `${m.name} copied as a mod file. Anyone can paste it into the Blueprint Studio.`; },
            () => { note.textContent = text; });
        });
        const del = el('button', 'mr-mod-act is-bad', 'Delete');
        del.addEventListener('click', () => {
          if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'Sure?'; return; }
          removeCustom(m.id);
          paint(0);
        });
        acts.append(edit, share, del);
        side.appendChild(acts);
      }
      card.append(words, side);
      body.appendChild(card);
    }
  };

  /** The Blueprint Studio: one mod, up to eight towers, one of them on the bench. */
  const studio = (editing: ModDef | null): void => {
    const towers: Blueprint[] = editing?.buildings?.map((b) => ({ ...b })) ?? [{ ...DEFAULT_BLUEPRINT }];
    let at = 0;

    const wrap = el('div', 'mr-studio');
    const bench = el('div', 'mr-studio-bench');
    const preview = el('div', 'mr-studio-preview');
    const pic = el('div', 'mr-studio-pic');
    const view = new ModelView();
    if (view.ok) pic.appendChild(view.canvas);
    pic.title = 'Drag to turn it; double-click to stop or start the spin';
    const stats = el('div', 'mr-studio-stats');
    const strip = el('div', 'mr-studio-strip');
    preview.append(pic, stats, strip);
    const controls = el('div', 'mr-studio-controls');
    bench.append(preview, controls);

    const refresh = (): void => {
      const bp = cleanBlueprint(towers[at]);
      if (view.ok) view.show(() => blueprintAsset(bp, 'preview', 'x'));
      else pic.innerHTML = blueprintSvg(bp, 240);
      const c = blueprintCapacity(bp);
      stats.replaceChildren(
        ...[[`${Math.round(c.height)} m`, 'tall'], [`${bp.floors}`, 'storeys'],
          [c.homes > 0 ? `${c.homes}` : `${c.jobs}`, c.homes > 0 ? 'homes' : 'jobs'],
          [`${bp.width}×${bp.depth}`, 'cells']].map(([v, k]) => {
          const s = el('div', 'mr-studio-stat');
          s.append(el('b', '', v), el('span', '', k));
          return s;
        }));
      strip.replaceChildren();
      towers.forEach((t, i) => {
        const b = el('button', `mr-studio-slot${i === at ? ' is-on' : ''}`);
        b.title = t.name;
        b.innerHTML = bpIcon(t, 40);
        b.addEventListener('click', () => { at = i; build(); });
        strip.appendChild(b);
      });
      if (towers.length < MAX_BUILDINGS) {
        const add = el('button', 'mr-studio-slot is-add', '+');
        add.title = 'Add another building to this mod';
        add.addEventListener('click', () => {
          towers.push({ ...cleanBlueprint(towers[at]), name: `Building ${towers.length + 1}` });
          at = towers.length - 1;
          build();
        });
        strip.appendChild(add);
      }
    };

    const set = <K extends keyof Blueprint>(k: K, v: Blueprint[K]): void => {
      towers[at] = { ...towers[at], [k]: v };
      refresh();
    };

    const range = (label: string, k: 'width' | 'depth' | 'floors' | 'floorHeight' | 'taper' | 'twist' | 'podium' | 'bands',
      min: number, max: number, step: number, show: (v: number) => string): HTMLElement => {
      const row = el('label', 'mr-studio-row');
      const input = el('input');
      input.type = 'range';
      input.min = String(min); input.max = String(max); input.step = String(step);
      input.value = String(towers[at][k]);
      const read = el('b', '', show(towers[at][k]));
      input.addEventListener('input', () => {
        const v = Number(input.value);
        read.textContent = show(v);
        set(k, v);
      });
      row.append(el('span', '', label), input, read);
      return row;
    };

    const pick = <K extends 'zone' | 'shape' | 'facade' | 'crown'>(label: string, k: K,
      options: readonly Blueprint[K][]): HTMLElement => {
      const row = el('div', 'mr-studio-row is-pick');
      const seg = el('div', 'mr-seg');
      for (const o of options) {
        const b = el('button', `mr-seg-btn${towers[at][k] === o ? ' is-on' : ''}`, title(String(o)));
        b.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
          set(k, o);
        });
        seg.appendChild(b);
      }
      row.append(el('span', '', label), seg);
      return row;
    };

    const tick = (label: string, k: 'balconies' | 'lit'): HTMLElement => {
      const row = el('label', 'mr-mod-check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = towers[at][k];
      box.addEventListener('change', () => set(k, box.checked));
      row.append(box, document.createTextNode(` ${label}`));
      return row;
    };

    const build = (): void => {
      controls.replaceChildren();
      const bpName = el('input', 'mr-mod-input');
      bpName.maxLength = 40;
      bpName.value = towers[at].name;
      bpName.placeholder = 'Building name';
      bpName.addEventListener('input', () => set('name', bpName.value));
      const colour = el('input', 'mr-studio-colour');
      colour.type = 'color';
      colour.value = cleanBlueprint(towers[at]).colour;
      colour.addEventListener('input', () => set('colour', colour.value));
      const nameRow = el('div', 'mr-studio-name');
      nameRow.append(bpName, colour);

      const acts = el('div', 'mr-mod-acts');
      const dice = el('button', 'mr-mod-act', 'Surprise me');
      dice.addEventListener('click', () => {
        towers[at] = randomBlueprint(towers[at].name);
        build();
      });
      acts.appendChild(dice);
      if (towers.length > 1) {
        const drop = el('button', 'mr-mod-act is-bad', 'Remove building');
        drop.addEventListener('click', () => { towers.splice(at, 1); at = Math.max(0, at - 1); build(); });
        acts.appendChild(drop);
      }

      controls.append(
        el('div', 'mr-mod-label', `Building ${at + 1} of ${towers.length}`), nameRow,
        pick('Use', 'zone', BP_ZONES),
        pick('Plan', 'shape', BP_SHAPES),
        range('Width', 'width', 3, 12, 1, (v) => `${v * 8} m`),
        range('Depth', 'depth', 3, 12, 1, (v) => `${v * 8} m`),
        range('Storeys', 'floors', 3, 90, 1, (v) => `${v}`),
        range('Storey height', 'floorHeight', 3, 5, 0.1, (v) => `${v.toFixed(1)} m`),
        range('Taper', 'taper', 0.45, 1, 0.01, (v) => v >= 0.995 ? 'None' : `${Math.round((1 - v) * 100)}%`),
        range('Twist', 'twist', -1.6, 1.6, 0.02, (v) => `${Math.round(v * 180 / Math.PI)}°`),
        pick('Facade', 'facade', BP_FACADES),
        pick('Crown', 'crown', BP_CROWNS),
        range('Podium', 'podium', 0, 6, 1, (v) => v === 0 ? 'None' : `${v} storeys`),
        range('Plant floors', 'bands', 0, 30, 1, (v) => v === 0 ? 'None' : `every ${v}`),
        tick('Balconies on every storey', 'balconies'),
        tick('Lit crown in the brand colour', 'lit'),
        acts,
      );
      refresh();
    };

    // The mod itself: what the Installed tab lists.
    const form = el('div', 'mr-mod-form');
    const nameIn = el('input', 'mr-mod-input');
    nameIn.placeholder = 'Name your mod';
    nameIn.maxLength = 40;
    nameIn.value = editing?.name ?? '';
    const descIn = el('input', 'mr-mod-input');
    descIn.placeholder = 'What it adds, in a line';
    descIn.maxLength = 200;
    descIn.value = editing?.description ?? '';
    const save = el('button', 'mr-found', editing ? 'Save changes' : 'Save mod');
    const msg = el('p', 'mr-mods-note', '');
    save.addEventListener('click', () => {
      const name = nameIn.value.trim() || towers[0].name;
      const def: ModDef = {
        id: editing?.id ?? freshId(name), name, author: editing?.author ?? 'You', kind: 'buildings',
        description: descIn.value, buildings: towers.map((t) => cleanBlueprint(t)),
      };
      const err = saveCustom(def);
      if (err) { msg.textContent = err; msg.classList.add('is-bad'); return; }
      setEnabled(def.id, true);
      paint(0);
      note.textContent = `${def.name} saved and switched on.`;
    });
    form.append(el('label', 'mr-mod-label', 'Mod'), nameIn, descIn, save, msg);

    wrap.append(bench, form);

    // Or paste one in.
    const imp = el('div', 'mr-mod-form');
    const area = el('textarea', 'mr-code');
    area.placeholder = '{ "name": "My towers", "buildings": [ { "name": "Spire", "floors": 60, "crown": "spire" } ] }';
    area.spellcheck = false;
    const go = el('button', 'mr-st-btn', 'Import mod file');
    const imsg = el('p', 'mr-mods-note',
      'A mod file is plain JSON: a name and up to eight blueprints. Anything else in it is ignored, and every number is kept to what can be built.');
    go.addEventListener('click', () => {
      const got = importMod(area.value);
      if (typeof got === 'string') { imsg.textContent = got; imsg.classList.add('is-bad'); return; }
      const err = saveCustom(got);
      if (err) { imsg.textContent = err; imsg.classList.add('is-bad'); return; }
      setEnabled(got.id, true);
      paint(0);
      note.textContent = `${got.name} imported and switched on.`;
    });
    imp.append(el('div', 'mr-mod-label', 'Import'), area, go, imsg);
    body.append(wrap, imp);
    build();
  };

  const browse = (): void => {
    const have = new Set(allMods().flatMap((m) => m.builtin ? [] : (m.buildings ?? []).map((b) => b.name)));
    const grid = el('div', 'mr-browse');
    for (const p of PRESET_BLUEPRINTS) {
      const card = el('div', 'mr-browse-card');
      const pic = el('div', 'mr-browse-pic');
      pic.innerHTML = bpIcon(p, 120);
      const name = el('div', 'mr-mod-name', p.name);
      const line = el('div', 'mr-mod-desc', `${title(p.zone)} · ${sums(p)}`);
      const acts = el('div', 'mr-mod-acts');
      const add = el('button', 'mr-st-btn is-go', have.has(p.name) ? 'Added' : 'Add');
      add.disabled = have.has(p.name);
      add.addEventListener('click', () => {
        const def: ModDef = { id: freshId(p.name), name: p.name, author: 'Arcus', kind: 'buildings',
          description: `A ${p.floors}-storey ${p.zone} blueprint.`, buildings: [{ ...p }] };
        const err = saveCustom(def);
        if (err) { note.textContent = err; return; }
        setEnabled(def.id, true);
        paint(2);
        note.textContent = `${p.name} added and switched on. Edit it from Installed.`;
      });
      const open = el('button', 'mr-st-btn', 'Open in studio');
      open.addEventListener('click', () => paint(1, {
        id: freshId(p.name), name: p.name, author: 'You', kind: 'buildings', description: '', buildings: [{ ...p }],
      }));
      acts.append(add, open);
      card.append(pic, name, line, acts);
      grid.appendChild(card);
    }
    body.appendChild(grid);
  };

  TABS.forEach(([, label, icon], k) => {
    const b = el('button', 'mr-mods-tab');
    b.setAttribute('role', 'tab');
    b.innerHTML = `<i>${glyph(icon, 16)}</i>`;
    b.append(label);
    b.addEventListener('click', () => paint(k));
    tabs.appendChild(b);
  });
  paint(0);

  frame.append(head, tabs, banner, note, body);
  host.appendChild(frame);
  requestAnimationFrame(() => frame.classList.add('is-open'));

  const keys = (e: KeyboardEvent): void => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); shut(); return; }
    if (!typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      paint((on + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length);
      return;
    }
    // The title list underneath must not see keys meant for this screen.
    e.stopImmediatePropagation();
  };
  const shut = (): void => {
    removeEventListener('keydown', keys, true);
    frame.remove();
    onClose();
  };
  addEventListener('keydown', keys, true);
  back.addEventListener('click', shut);
}

/** A tower nobody asked for, within reason: tall and slim, or low and wide. */
function randomBlueprint(name: string): Blueprint {
  const r = Math.random;
  const any = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const tall = r() < 0.6;
  const hue = Math.floor(r() * 360);
  return cleanBlueprint({
    name, zone: any(BP_ZONES), shape: any(BP_SHAPES), facade: any(BP_FACADES), crown: any(BP_CROWNS),
    width: tall ? 5 + Math.floor(r() * 4) : 7 + Math.floor(r() * 5),
    depth: tall ? 5 + Math.floor(r() * 4) : 6 + Math.floor(r() * 5),
    floors: tall ? 40 + Math.floor(r() * 50) : 8 + Math.floor(r() * 24),
    floorHeight: 3.4 + r() * 1.2, taper: tall ? 0.5 + r() * 0.45 : 0.85 + r() * 0.15,
    twist: r() < 0.5 ? 0 : (r() - 0.5) * 2.4, podium: Math.floor(r() * 5), balconies: r() < 0.3,
    bands: r() < 0.4 ? 0 : 6 + Math.floor(r() * 12), lit: r() < 0.7,
    colour: hsl(hue, 0.55, 0.55),
  });
}

function hsl(h: number, s: number, l: number): string {
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
