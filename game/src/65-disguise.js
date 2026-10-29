// =====================================================================
//  Disguise: hide your weapons, take the clothes off a fallen militiaman or a knocked-out civilian
// =====================================================================
// The AI reads it through a single number on the player agent (`disguise`, 0..1): how much a uniform
// or plain clothes slow recognition. Close up (under ~3 m) nobody is fooled; shooting, being made by
// a sentry or running about with a rifle in civilian clothes blows your cover for a while.
const DISGUISE = (() => {
  P.holstered = false; P.disguise = null; P.blownUntil = -99;
  let own = null, t = 0;
  const host = document.getElementById('hud');
  const tag = document.createElement('div'); tag.style.cssText = 'position:absolute;left:24px;bottom:122px;font-size:12px;letter-spacing:.15em;color:rgba(255,255,255,.6)'; tag.id = 'gearTag'; host.appendChild(tag);
  const prompt = document.createElement('div'); prompt.style.cssText = 'position:absolute;left:50%;top:60%;transform:translateX(-50%);font-size:15px;letter-spacing:.22em;color:#e8dcc4;text-shadow:0 0 8px #000;display:none'; host.appendChild(prompt);

  function wear(kit, type, team = 'red') {
    if (!own) own = cfg;
    cfg = { ...kit }; rebuild();
    P.disguise = type; P.disguiseTeam = team; P.blownUntil = -99;
    audio.pouch(); feed(`<span class="s">${type === 'militia' ? `${BOTS.FACTIONS[team].name.split(' · ').pop()} CLOTHES ON — THEY FOOL ${BOTS.FACTIONS[team].name.split(' · ').pop()} ONLY · WALK, DON’T RUN` : 'CIVILIAN CLOTHES ON — HIDE YOUR WEAPONS (H)'}</span>`);
  }
  function ownGear() {
    if (!own) return;
    cfg = own; own = null; rebuild(); P.disguise = null;
    feed('<span class="m">BACK IN YOUR OWN GEAR</span>');
  }
  // how much your clothes buy you right now (0 = they see you for what you are)
  // A disguise holds while you act the part. What gives you away: running, sneaking (crouched), a weapon
  // raised, and — for a civilian — a weapon out at all, or wandering where civilians have no business.
  function level() {
    if (!P.disguise || t < P.blownUntil) return 0;
    const running = P.sprintT > 0.5, sneaking = P.crouch, aiming = P.ads, restricted = inRestricted();
    if (P.disguise === 'militia') return (P.holstered ? 0.97 : aiming ? (WD().scope ? 0.25 : 0.4) : 0.92) * (running ? 0.62 : 1) * (sneaking ? 0.55 : 1);
    if (!P.holstered) return 0;   // a civilian with a rifle out is no civilian
    return 0.97 * (running ? 0.66 : 1) * (sneaking ? 0.5 : 1) * (restricted ? 0.3 : 1);
  }
  // what one side makes of you: their own men's clothes fool them; a rival's clothes make you a target
  function levelFor(team) { if (P.disguise === 'militia' && P.disguiseTeam !== team) return 0; return level(); }
  // places a civilian has no reason to be (each map lists its own)
  function inRestricted() { for (const r of (TOWN.restricted || [])) if (P.pos.x > r.x0 && P.pos.x < r.x1 && P.pos.z > r.z0 && P.pos.z < r.z1 && (r.y0 === undefined || P.pos.y > r.y0)) return true; return false; }
  function blow(why) {
    if (!P.disguise) return;
    if (t >= P.blownUntil) feed(`<span class="m">COVER BLOWN${why === 'shot' ? ' — THEY HEARD YOU' : ''}</span>`);
    P.blownUntil = t + 20;
  }
  function toggleHolster(force) {
    const on = force ?? !P.holstered;
    if (on === P.holstered || P.dead || (!on && SCOOTER.riding)) return;
    if (on) { P.holstered = true; P.reload = null; P.burst = 0; P.trigger = false; aimKey.down = aimKey.toggled = false; if (gun && gun.mag) gun.mag.visible = true; audio.holster(); }
    else { P.holstered = false; P.swap = { t: 0.26, to: P.w, done: true, k: 1 }; audio.draw(); }
  }
  // fallen militia and knocked-out (or dead) civilians within reach
  function nearestBody() {
    let best = null, bd = 2.2;
    for (const b of [...BOTS.bodies(), ...NPCS.bodies()]) { const d = Math.hypot(b.x - P.pos.x, b.z - P.pos.z); if (d < bd && Math.abs(b.y - P.pos.y) < 1.2) { bd = d; best = b; } }
    return best;
  }
  function interact() {
    if (SCOOTER.riding) { SCOOTER.interact(); return; }
    if (MISSION.interact()) return;
    if (SCOOTER.interact()) return;
    const b = nearestBody();
    if (b && !b.taken) { b.taken = true; b.mark(); wear(b.kit, b.type, b.team); return; }
    if (THROW.pickup()) return;
    if (DOORS.interact()) return;
    NPCS.talk();
  }
  // silent takedown from behind (militia) / knockout (civilian)
  function takedown() {
    if (SCOOTER.horn()) return;
    if (P.dead || P.reload) return;
    if (BOTS.takedown(P.pos, P.yaw)) { audio.fleshHit(1); P.shake = Math.min(1.5, P.shake + 0.5); return; }
    if (NPCS.knockout(P.pos, P.yaw)) { audio.fleshHit(1); P.shake = Math.min(1.5, P.shake + 0.4); }
  }
  function update(dt) {
    t += dt;
    if (mode !== 'range') return;
    const blown = P.disguise && t < P.blownUntil;
    const lv = level(), cover = !P.disguise ? '' : lv > 0.9 ? 'SOLID' : lv > 0.6 ? 'SHAKY' : lv > 0 ? 'THIN' : 'NONE';
    tag.innerHTML = (P.disguise ? `DISGUISE: <b style="color:${blown ? '#d0503a' : '#c9d4c0'}">${P.disguise === 'militia' ? BOTS.FACTIONS[P.disguiseTeam || 'red'].name.split(' · ').pop() : 'CIVILIAN'}</b> · COVER <b style="color:${lv > 0.9 ? '#9fd08a' : lv > 0.6 ? '#ffcc33' : '#e8432e'}">${cover}</b>` : 'OWN GEAR')
      + (SCOOTER.riding ? ` · <b style="color:#e8dcc4">SCOOTER ${Math.round(Math.hypot(SCOOTER.riding.vx, SCOOTER.riding.vz) * 3.6)} KM/H</b>` : P.holstered ? ' · WEAPONS HIDDEN' : '') + (blown ? ` · <b style="color:#d0503a">COVER BLOWN ${Math.ceil(P.blownUntil - t)}</b>` : '');
    let pr = '';
    const b = nearestBody();
    if (b && !b.taken) pr = `[E]  TAKE ${b.type === 'militia' ? 'UNIFORM' : 'CLOTHES'}`;
    else if (BOTS.canTakedown(P.pos, P.yaw) && !SCOOTER.riding) pr = '[F]  SILENT TAKEDOWN';
    else { const talk = SCOOTER.riding ? '' : NPCS.promptTalk(), ko = !SCOOTER.riding && NPCS.canKnockout(P.pos, P.yaw) ? '[F]  KNOCK OUT' : ''; pr = SCOOTER.prompt() || THROW.prompt() || DOORS.prompt() || [talk, ko].filter(Boolean).join('     '); }
    if (!pr && THROW.held) pr = `[G]  THROW THE ${THROW.held}`;
    setPrompt(prompt, pr);
  }
  return { update, interact, takedown, toggleHolster, ownGear, level, levelFor, blow, get worn() { return !!own; }, get blown() { return !!P.disguise && t < P.blownUntil; } };
})();
