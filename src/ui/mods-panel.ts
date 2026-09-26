/**
 * The Mods screen, from the title menu.
 *
 * Three tabs. Installed lists every mod the player has -- the built-in ones and
 * their own -- with a switch each; Create builds a mod from sliders, or reads
 * one pasted in; Browse offers ready-made mods to add. Mods apply when a city
 * is founded or loaded, which the screen says, because a switch that did
 * nothing to the city in front of you would read as broken.
 */

import {
  allMods, isEnabled, setEnabled, saveCustom, removeCustom, exportMod, importMod,
  PRESET_MODS, MOD_KNOBS, KNOB_LABEL, type ModDef, type ModKnob,
} from '../sim/mods';
import { glyph } from './glyphs';

const BACK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
  + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** What a mod does, as short chips: "Tax income ×1.5". */
function chips(m: ModDef): HTMLElement {
  const row = el('div', 'mr-mod-chips');
  for (const k of MOD_KNOBS) {
    const v = m.effects[k];
    if (v === undefined || v === 1) continue;
    const c = el('span', `mr-mod-chip ${goodFor(k, v) ? 'is-good' : 'is-hard'}`,
      `${KNOB_LABEL[k]} ×${v >= 10 ? Math.round(v) : +v.toFixed(2)}`);
    row.appendChild(c);
  }
  if (m.unlockAll) row.appendChild(el('span', 'mr-mod-chip is-good', 'Everything unlocked'));
  return row;
}

/** Whether a multiplier makes the game easier: costs down, income, arrivals, experience up. */
function goodFor(k: ModKnob, v: number): boolean {
  return k === 'build' || k === 'upkeep' ? v < 1 : v > 1;
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
  const title = el('h2', '', 'Mods');
  const count = el('span', 'mr-chip is-amber');
  head.append(back, title, count);

  const tabs = el('div', 'mr-mods-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'mr-mods-list');
  const note = el('p', 'mr-mods-note', 'Mods apply when a city is founded or loaded. Turn them on here, then start or open a city.');
  const TABS: Array<[string, string, string]> = [
    ['installed', 'Installed', 'mods'], ['create', 'Create', 'develop'], ['browse', 'Browse', 'look'],
  ];
  let on = 0;
  const recount = (): void => {
    const n = allMods().filter((m) => isEnabled(m.id)).length;
    count.textContent = n === 0 ? 'None on' : `${n} on`;
  };

  const paint = (k: number): void => {
    on = k;
    tabs.querySelectorAll('button').forEach((b, j) => {
      b.classList.toggle('is-on', j === k);
      b.setAttribute('aria-selected', String(j === k));
    });
    body.replaceChildren();
    if (k === 0) installed();
    else if (k === 1) create(null);
    else browse();
    recount();
  };

  const installed = (): void => {
    for (const m of allMods()) {
      const card = el('div', `mr-mod${isEnabled(m.id) ? ' is-on' : ''}`);
      const words = el('div', 'mr-mod-words');
      const name = el('div', 'mr-mod-name', m.name);
      name.appendChild(el('span', 'mr-mod-by', m.builtin ? 'built in' : `by ${m.author}`));
      words.append(name, el('div', 'mr-mod-desc', m.description || 'No description.'), chips(m));
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
        edit.addEventListener('click', () => { on = 1; paint(1); body.replaceChildren(); create(m); });
        const share = el('button', 'mr-mod-act', 'Copy');
        share.addEventListener('click', () => {
          const text = exportMod(m);
          navigator.clipboard?.writeText(text).then(
            () => { note.textContent = `${m.name} copied as a mod file. Anyone can paste it into Create.`; },
            () => { note.textContent = text; });
        });
        const del = el('button', 'mr-mod-act is-bad', 'Delete');
        del.addEventListener('click', () => { removeCustom(m.id); paint(0); });
        acts.append(edit, share, del);
        side.appendChild(acts);
      }
      card.append(words, side);
      body.appendChild(card);
    }
  };

  const create = (editing: ModDef | null): void => {
    tabs.querySelectorAll('button').forEach((b, j) => b.classList.toggle('is-on', j === 1));
    const form = el('div', 'mr-mod-form');
    const nameIn = el('input', 'mr-mod-input');
    nameIn.placeholder = 'Name your mod';
    nameIn.maxLength = 40;
    nameIn.value = editing?.name ?? '';
    const descIn = el('input', 'mr-mod-input');
    descIn.placeholder = 'What it does, in a line';
    descIn.maxLength = 200;
    descIn.value = editing?.description ?? '';
    form.append(el('label', 'mr-mod-label', 'Name'), nameIn, el('label', 'mr-mod-label', 'Description'), descIn);

    // Each knob on a log slider, so halving and doubling are the same distance.
    const values: Partial<Record<ModKnob, number>> = { ...(editing?.effects ?? {}) };
    const grid = el('div', 'mr-mod-knobs');
    for (const k of MOD_KNOBS) {
      const row = el('div', 'mr-mod-knob');
      const lab = el('span', '', KNOB_LABEL[k]);
      const range = el('input');
      range.type = 'range';
      range.min = '-3'; range.max = '3'; range.step = '0.05';
      const read = el('b', '');
      const set = (v: number): void => {
        read.textContent = `×${v >= 10 ? Math.round(v) : +v.toFixed(2)}`;
        read.className = v === 1 ? '' : goodFor(k, v) ? 'is-good' : 'is-hard';
      };
      const start = values[k] ?? 1;
      range.value = String(Math.log2(start));
      set(start);
      range.addEventListener('input', () => {
        let v = Math.pow(2, Number(range.value));
        if (Math.abs(v - 1) < 0.04) v = 1;
        values[k] = v;
        set(v);
      });
      row.append(lab, range, read);
      grid.appendChild(row);
    }
    const unlock = el('label', 'mr-mod-check');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = editing?.unlockAll === true;
    unlock.append(box, document.createTextNode(' Unlock every level, building and landmark, and all the land'));
    const save = el('button', 'mr-found', editing ? 'Save changes' : 'Save mod');
    const msg = el('p', 'mr-mods-note', '');
    save.addEventListener('click', () => {
      const effects: Partial<Record<ModKnob, number>> = {};
      for (const k of MOD_KNOBS) if (values[k] !== undefined && values[k] !== 1) effects[k] = values[k];
      const def: ModDef = {
        id: editing?.id ?? '', name: nameIn.value, author: editing?.author ?? 'You',
        description: descIn.value, effects, ...(box.checked ? { unlockAll: true } : {}),
      };
      if (def.id === '') def.id = `custom-${nameIn.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'mod'}`;
      const err = saveCustom(def);
      if (err) { msg.textContent = err; msg.classList.add('is-bad'); return; }
      setEnabled(def.id, true);
      paint(0);
      note.textContent = `${def.name} saved and switched on.`;
    });
    form.append(el('div', 'mr-mod-label', 'Effects'), grid, unlock, save, msg);

    // Or paste one in.
    const imp = el('div', 'mr-mod-form');
    const area = el('textarea', 'mr-code');
    area.placeholder = '{ "name": "My mod", "effects": { "income": 1.5, "upkeep": 0.8 } }';
    area.spellcheck = false;
    const go = el('button', 'mr-st-btn', 'Import mod file');
    const imsg = el('p', 'mr-mods-note', 'A mod file is plain JSON: a name, and multipliers for funds, build, upkeep, income, growth and xp.');
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
    body.append(form, imp);
    nameIn.focus();
  };

  const browse = (): void => {
    const have = new Set(allMods().map((m) => m.name));
    for (const p of PRESET_MODS) {
      const card = el('div', 'mr-mod');
      const words = el('div', 'mr-mod-words');
      const name = el('div', 'mr-mod-name', p.name);
      name.appendChild(el('span', 'mr-mod-by', `by ${p.author}`));
      words.append(name, el('div', 'mr-mod-desc', p.description), chips(p));
      const side = el('div', 'mr-mod-side');
      const add = el('button', 'mr-st-btn is-go', have.has(p.name) ? 'Added' : 'Add');
      add.disabled = have.has(p.name);
      add.addEventListener('click', () => {
        const err = saveCustom({ ...p, id: p.id.replace('preset-', 'custom-') });
        if (err) { note.textContent = err; return; }
        paint(2);
        note.textContent = `${p.name} added to Installed. Switch it on there.`;
      });
      side.appendChild(add);
      card.append(words, side);
      body.appendChild(card);
    }
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

  frame.append(head, tabs, note, body);
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
