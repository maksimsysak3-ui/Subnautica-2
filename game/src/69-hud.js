// =====================================================================
//  HUD: controls panel (TAB), vitals, key-chip prompts, compass, where you are
// =====================================================================
// The pieces of the HUD are made by the modules that own them (BOTS the health bar, DISGUISE the gear
// tag, MISSION the objective); this file only dresses them as one set and adds what was missing.
(() => {
  const css = document.createElement('style');
  css.textContent = `
  #hud kbd{display:inline-block;min-width:1.4em;padding:1px 7px;margin:0 8px 0 0;border-radius:4px;background:#f0e6d0;color:#121212;font:700 13px Rajdhani,system-ui,sans-serif;letter-spacing:.05em;text-align:center;box-shadow:0 2px 0 rgba(0,0,0,.45);text-shadow:none}
  .hudPrompt{padding:8px 16px;border-radius:6px;background:rgba(10,12,16,.62);backdrop-filter:blur(3px);border:1px solid rgba(255,255,255,.1);letter-spacing:.16em!important;white-space:nowrap}
  #keys{display:none!important}
  #ctl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;grid-template-columns:repeat(3,auto);gap:8px 28px;padding:22px 28px;border-radius:10px;background:rgba(10,12,16,.86);border:1px solid rgba(255,255,255,.1);font-size:14px;letter-spacing:.08em;color:#c8ccd4}
  #ctl.show{display:grid}
  #ctl h3{grid-column:1/-1;margin:0 0 6px;font-size:13px;letter-spacing:.3em;color:#c9a45c;font-weight:600}
  #ctl div{white-space:nowrap}
  #ctlHint{position:absolute;left:24px;bottom:20px;font-size:12px;letter-spacing:.2em;color:rgba(255,255,255,.45)}
  #vitals{position:absolute;left:24px;bottom:22px;width:220px}
  #hpbar{position:static!important;width:100%!important;height:8px!important;border-radius:4px;overflow:hidden;background:rgba(0,0,0,.45)!important;border:1px solid rgba(255,255,255,.14)!important}
  #hpbar i{border-radius:4px}
  #hpcnt{position:static!important;margin-bottom:5px}
  #vitals #stam{width:100%!important;height:6px!important;margin:6px 0 0!important;border-radius:3px;overflow:hidden;background:rgba(0,0,0,.45)!important;border:1px solid rgba(255,255,255,.12)}
  #vitals #stam i{background:linear-gradient(90deg,#c9a45c,#e8d08a)!important}
  #stamLbl{margin-top:6px;font-size:11px;letter-spacing:.25em;color:rgba(255,255,255,.45)}
  #gearTag{position:static!important;margin-top:7px;font-size:12px!important;white-space:nowrap}
  #objPanel{padding:10px 14px;border-radius:6px;background:linear-gradient(90deg,rgba(10,12,16,0),rgba(10,12,16,.6));border-right:2px solid #c9a45c}
  #objPanel:empty{display:none}
  #compass{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:420px;height:30px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent);mask-image:linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)}
  #compass .strip{position:absolute;top:0;left:0;height:100%;white-space:nowrap}
  #compass .t{position:absolute;top:2px;width:1px;height:7px;background:rgba(255,255,255,.4)}
  #compass .c{position:absolute;top:9px;transform:translateX(-50%);font-size:13px;font-weight:700;letter-spacing:.1em;color:#e7e9ee}
  #compass .c.n{color:#e0533d}
  #compass .goal{position:absolute;top:0;transform:translateX(-50%);color:#ffd27a;font-size:12px}
  #compass::after{content:'';position:absolute;left:50%;top:0;width:2px;height:10px;background:#c9a45c;transform:translateX(-1px)}
  #where{position:absolute;left:50%;top:46px;transform:translateX(-50%);font-size:12px;letter-spacing:.3em;color:rgba(255,255,255,.55);white-space:nowrap}
  #ctlHint.pulse{animation:hp 1.2s ease-in-out infinite alternate;color:#e8dcc4}
  @keyframes hp{from{opacity:.45}to{opacity:1}}
  #placeToast{position:absolute;left:50%;top:30%;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .8s;pointer-events:none;text-shadow:0 0 14px #000}
  #placeToast b{display:block;font:700 34px "Malgun Gothic","Noto Sans KR",Rajdhani,sans-serif;letter-spacing:.2em;color:#f4ecdc}
  #placeToast span{font-size:13px;letter-spacing:.45em;color:#c9a45c}
  #feed{top:118px!important}
  `;
  document.head.appendChild(css);
})();

// "[E]  TEXT" → a key chip and the text; used for every interaction prompt
function setPrompt(el, s) {
  if (el._s === s) return; el._s = s;
  el.innerHTML = s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\[([^\]]+)\]\s*/g, '<kbd>$1</kbd>').replace(/&lt;br&gt;/g, '<br>') : '';
  el.style.display = s ? 'block' : 'none';
  el.classList.add('hudPrompt');
}

const HUD = (() => {
  const host = document.getElementById('hud');
  const mk = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; host.appendChild(d); return d; };
  // controls: a tidy panel on TAB (and for the first few seconds of a session)
  const C = [['WASD', 'move'], ['SHIFT', 'sprint · hold breath'], ['SPACE', 'jump'], ['C', 'crouch'], ['Q', 'aim'], ['LMB', 'fire'], ['R', 'reload'], ['1–4', 'weapon slots'], ['B', 'fire mode'], ['Z X', 'lean'], ['V', '1st / 3rd person'], ['E', 'interact · talk · doors'], ['F', 'takedown · horn'], ['H', 'hide weapons'], ['G', 'throw (pick up with E)'], ['U', 'own gear'], ...(MAP.id === 'seoul' ? [['L', 'weapon light']] : []), ['M', 'map'], ['J', 'restart mission'], ['N', 'hostiles on/off'], ['T', 'reset'], ['ESC', 'menu']];
  // the key list lives in the pause menu (ESC → CONTROLS), not on the HUD
  const ctl = { classList: { toggle() { }, add() { }, remove() { } } }, hint = { classList: { toggle() { } } };
  const kl = document.getElementById('keyList'); if (kl) kl.innerHTML = C.map(([k, v]) => `<div><kbd>${k}</kbd>${v}</div>`).join('');
  document.querySelectorAll('#pause .ptab').forEach((b) => b.onclick = () => { document.querySelectorAll('#pause .ptab').forEach((x) => x.classList.toggle('on', x === b)); document.querySelectorAll('#pause .psec').forEach((sec) => { sec.style.display = sec.dataset.ps === b.dataset.pt ? 'grid' : 'none'; }); });
  const opt = (id, on) => { const e = document.getElementById(id); if (e) e.onchange = () => on(e.checked); };
  opt('optCompass', (v) => { comp.style.display = v ? '' : 'none'; where.style.display = v ? '' : 'none'; });
  opt('optMarks', (v) => { HUD.marks = v; });
  // vitals: health, its counter, the gear tag, stacked
  const vit = mk('vitals');
  { const l = document.createElement('div'); l.id = 'stamLbl'; l.textContent = 'STAMINA'; host.appendChild(l); }
  // compass along the top, with the objective's bearing on it
  const comp = mk('compass'), strip = document.createElement('div'); strip.className = 'strip'; comp.appendChild(strip);
  const PX = 2.4, NAMES = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  let h = ''; for (let d = -360; d <= 720; d += 15) { const a = ((d % 360) + 360) % 360; h += NAMES[a] ? `<span class="c${a === 0 ? ' n' : ''}" style="left:${d * PX}px">${NAMES[a]}</span>` : `<i class="t" style="left:${d * PX}px"></i>`; }
  strip.innerHTML = h; const goal = document.createElement('span'); goal.className = 'goal'; goal.textContent = '◆'; comp.appendChild(goal);
  const where = mk('where'), toast = mk('placeToast');
  let shownAt = -1, place = '', toastT = 0, adopted = false, t = 0;
  function region() {
    if (MAP.id === 'seoul') {
      if (SUBWAY.under) { let best = LINE2[0]; for (const s of LINE2) if (Math.abs(P.pos.x - (s.ox ?? 1e9)) < 80) best = s; return [`${best.ko}역`, `${best.en.toUpperCase()} · LINE 2`]; }
      if (DOORS.inside) return ['실내', 'INDOORS'];
      const { x, z } = P.pos;
      if (z > 150) return ['한강공원', 'HANGANG PARK']; if (x > 153) return ['강남', 'GANGNAM']; if (x < -153) return ['아현', 'AHYEON'];
      if (z < -140) return ['남대문시장', 'NAMDAEMUN MARKET']; return ['홍대 · 마포', 'HONGDAE · MAPO'];
    }
    if (MAP.id === 'manor') { const { x, z, y } = P.pos; if (x > -72 && x < 72 && z > -66 && z < 10 && !(Math.abs(x) < 50 && z > -32)) return y > 8.5 ? ['', 'RAVENSCROFT HOUSE · SECOND FLOOR'] : y > 3 ? ['', 'RAVENSCROFT HOUSE · FIRST FLOOR'] : ['', Math.abs(x) > 50 ? 'RAVENSCROFT HOUSE · THE WINGS' : 'RAVENSCROFT HOUSE']; if (x < -95 && z < 10 && z > -70) return ['', 'THE MAZE']; if (x > 85 && z < -30 && z > -155) return ['', 'THE LAKE']; if (z < -70) return ['', 'THE GARDENS']; if (Math.abs(x) > 200 || z > 200) return ['', 'OUTSIDE THE WALLS']; return ['', 'RAVENSCROFT · THE GROUNDS']; }
    if (typeof PALACE !== 'undefined' && P.pos.z < PALACE.z1 && P.pos.x > PALACE.x0 && P.pos.x < PALACE.x1) return ['دار المخزن', 'DAR EL MAKHZEN'];
    let best = null, bd = 45; for (const r of TOWN.plazas) { const d = Math.hypot(clamp(P.pos.x, r.x0, r.x1) - P.pos.x, clamp(P.pos.z, r.z0, r.z1) - P.pos.z); if (d < bd) { bd = d; best = r; } }
    return best ? ['', best.name.toUpperCase()] : ['', 'DAR ESSALAM'];
  }
  return {
    marks: true,
    toggleKeys() { },
    update(dt) {
      t += dt;
      if (mode !== 'range' || !MAP.ready) return;
      if (!adopted) {   // pull the other modules' pieces into the vitals block once they exist
        for (const id of ['hpcnt', 'hpbar', 'stamLbl', 'stam', 'gearTag']) { const e = document.getElementById(id); if (e) vit.appendChild(e); }
        adopted = !!document.getElementById('gearTag');
      }
      if (shownAt < 0) shownAt = performance.now();
      hint.classList.toggle('pulse', performance.now() - shownAt < 12000);   // the TAB hint draws the eye for the first few seconds
      // compass: heading 0 = north (−z), clockwise
      const head = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
      strip.style.transform = `translateX(${210 - head * PX}px)`;
      const g = MISSION.target;
      if (g) { const b = ((Math.atan2(g.x - P.pos.x, -(g.z - P.pos.z)) * 180 / Math.PI) % 360 + 360) % 360; let rel = b - head; rel = ((rel + 540) % 360) - 180; goal.style.display = Math.abs(rel) < 85 ? 'block' : 'none'; goal.style.left = `${210 + rel * PX}px`; } else goal.style.display = 'none';
      // where you are, and a title card when it changes
      if ((t * 4 | 0) !== ((t - dt) * 4 | 0)) {
        const [ko, en] = region(), key = ko + en;
        where.textContent = ko ? `${ko}  ·  ${en}` : en;
        if (key !== place) { if (place) { toast.innerHTML = `${ko ? `<b>${ko}</b>` : ''}<span>${en}</span>`; toast.style.opacity = '1'; toastT = 3; } place = key; }
      }
      if (toastT > 0 && (toastT -= dt) <= 0) toast.style.opacity = '0';
    },
  };
})();
