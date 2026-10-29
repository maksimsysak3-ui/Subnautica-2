// =====================================================================
//  Cutscenes: letterbox, a camera on rails, subtitles
// =====================================================================
// A cutscene is a list of shots. Each shot moves the camera from `from` to `to` while it looks from
// `look` to `look2` (or keeps `look`), over `dur` seconds with an ease, and may carry a subtitle line
// ('NAME: words'). The world keeps living (people walk, rain falls); you don't move and nobody shoots.
// Space / E / Enter skips. Missions start with one, and big moments inside them get their own.
const CINEMA = (() => {
  let shots = null, i = 0, t = 0, done = null, el = null;
  const ease = (x) => x * x * (3 - 2 * x), lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  function ui() {
    if (el) return el;
    el = document.createElement('div');
    el.innerHTML = `<div class="cb" style="top:0"></div><div class="cb" style="bottom:0"></div><div class="cs"></div><div class="ck"><kbd>SPACE</kbd> SKIP</div>`;
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;display:none';
    const css = document.createElement('style');
    css.textContent = `.cb{position:absolute;left:0;right:0;height:0;background:#000;transition:height .6s ease}.cine .cb{height:11vh}
      .cs{position:absolute;left:50%;bottom:14vh;transform:translateX(-50%);width:min(820px,88vw);text-align:center;font:500 20px/1.45 Rajdhani,system-ui,sans-serif;color:#f4ecdc;text-shadow:0 2px 8px #000;letter-spacing:.04em;opacity:0;transition:opacity .35s}
      .cs b{color:#c9a45c;letter-spacing:.2em;font-size:14px;display:block;margin-bottom:2px}
      .ck{position:absolute;right:28px;bottom:4vh;color:rgba(255,255,255,.5);font:600 12px Rajdhani,sans-serif;letter-spacing:.25em}.ck kbd{background:#f0e6d0;color:#111;border-radius:4px;padding:1px 6px;margin-right:6px}
      body.cine #hud{opacity:0;transition:opacity .4s}`;
    document.head.appendChild(css); document.body.appendChild(el); return el;
  }
  function look(s, k) { const to = s.look2 ? lerp3(s.look, s.look2, k) : s.look; return to; }
  function apply() {
    const s = shots[i], k = ease(Math.min(1, t / s.dur)), p = s.to ? lerp3(s.from, s.to, k) : s.from, L = look(s, k);
    const dx = L[0] - p[0], dy = L[1] - p[1], dz = L[2] - p[2], h = Math.hypot(dx, dz);
    DBGCAM.on = true; DBGCAM.pos.set(p[0], p[1], p[2]); DBGCAM.yaw = Math.atan2(-dx, -dz); DBGCAM.pitch = Math.atan2(dy, h); DBGCAM.fov = s.fov || 50;
  }
  function line(s) {
    const c = ui().querySelector('.cs');
    if (!s.say) { c.style.opacity = '0'; return; }
    const [who, ...rest] = s.say.split(': '); c.innerHTML = rest.length ? `<b>${who}</b>${rest.join(': ')}` : who; c.style.opacity = '1';
  }
  function finish() {
    if (!shots) return;
    shots = null; DBGCAM.on = false; document.body.classList.remove('cine'); ui().classList.remove('cine'); ui().style.display = 'none'; ui().querySelector('.cs').style.opacity = '0';
    const d = done; done = null; d?.();
  }
  return {
    get active() { return !!shots; },
    play(list, onDone) {
      if (!list || !list.length) { onDone?.(); return; }
      shots = list; i = 0; t = 0; done = onDone;
      ui().style.display = 'block'; requestAnimationFrame(() => ui().classList.add('cine')); document.body.classList.add('cine');
      for (const k in keys) keys[k] = false; P.vel.set(0, 0, 0); P.trigger = false;
      BOTS.hold(list.reduce((a, s) => a + s.dur, 0) + 2);
      line(shots[0]); apply();
    },
    update(dt) {
      if (!shots) return;
      t += dt;
      if (t >= shots[i].dur) { i++; t = 0; if (i >= shots.length) { finish(); return; } line(shots[i]); }
      apply();
    },
    skip() { if (!shots) return false; finish(); return true; },
  };
})();
