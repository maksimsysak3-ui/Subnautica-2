/**
 * The resources view's picker: one chip a resource, each with its icon.
 *
 * Mounted into the view's card. Picking one repaints the map in that
 * resource's own colours; the rows under the headline list every resource at
 * once, so the chips choose what to look at rather than what to know about.
 */

import { RESOURCES } from '../sim/resources';
import type { ResourceId } from '../sim/resources';
import { glyph } from './glyphs';

export function resourcePicker(onPick: (id: ResourceId) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'mr-res-chips';
  root.dataset.show = 'grid';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Resource shown on the map');
  const chips: HTMLButtonElement[] = [];
  const pick = (id: ResourceId): void => {
    for (const c of chips) {
      const on = c.dataset.res === id;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-checked', String(on));
    }
    onPick(id);
  };
  for (const r of RESOURCES) {
    const b = document.createElement('button');
    b.className = 'mr-res-chip';
    b.dataset.res = r.id;
    b.setAttribute('role', 'radio');
    b.style.setProperty('--tone', r.ramp[2]);
    b.title = r.blurb;
    b.innerHTML = `<span class="mr-res-ico">${glyph(r.icon, 16)}</span><span>${r.name}</span>`;
    b.addEventListener('click', () => pick(r.id));
    chips.push(b);
    root.appendChild(b);
  }
  chips[0].classList.add('is-on');
  chips[0].setAttribute('aria-checked', 'true');
  return root;
}
