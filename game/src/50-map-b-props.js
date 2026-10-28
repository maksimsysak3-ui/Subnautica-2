// =====================================================================
//  WORLD MAP — prop library (every prop is modelled from parts, origin on the floor, front = +Z)
// =====================================================================
const PC = {
  concrete: 0x8d877c, concreteDk: 0x6b665c, concreteLt: 0xa39d90, plaster: 0xb9aa8e, plasterLt: 0xcbbd9f, mud: 0x9e8160, mudDk: 0x7c6446, mudLt: 0xb39672,
  sand: 0x9a8562, sandDk: 0x7e6c4f, wood: 0x7a5534, woodDk: 0x4f3722, woodLt: 0x9c7a50, plywood: 0xb3936a, plywoodDk: 0x8f7450,
  metal: 0x6c7076, metalDk: 0x3a3e44, steel: 0x8e939a, alu: 0xb4b8bd, rust: 0x7a4a2e, olive: 0x4f5638, oliveDk: 0x3a4029, coyote: 0x8a7650, tan: 0xa8916a,
  black: 0x1a1b1e, charcoal: 0x2b2d31, white: 0xdedad0, offwhite: 0xc9c3b4, red: 0x8f2a24, redLt: 0xb5392f, blue: 0x2f4f7a, blueLt: 0x4f79a8, green: 0x3d5a3a,
  yellow: 0xc9a24a, orange: 0xb8662a, fabric: 0x5b5d4a, mattress: 0x6d6a5e, paper: 0xe6e0d0, screen: 0x1d2a38, rubber: 0x141416, glass: 0x9fb8c4,
  brass: 0xb08d47, coffee: 0x2a1a10, leaf: 0x3d4a2a, leafLt: 0x56633a, dry: 0x8a7a4a, brick: 0x8a5a40,
};
const GLOW = { warm: 0xffd8a0, cool: 0xcfe0ff, screen: 0x6fa8d8, green: 0x6fe08a, red: 0xff4a3a, amber: 0xffb347 };

// ---------------- tabletop & small items ----------------
function mug(x, y, z, col = PC.white, ry = 0) {
  W.push(x, y, z, ry);
  W.cyl(0.042, 0.038, 0.095, 0, 0.0475, 0, col, { seg: 12 });
  W.cyl(0.036, 0.036, 0.004, 0, 0.083, 0, PC.coffee, { seg: 12, ao: false });     // coffee surface
  W.torus(0.026, 0.009, 0.046, 0.05, 0, col, { seg: 8, arc: Math.PI, rz: -Math.PI / 2 }); // handle
  W.cyl(0.03, 0.03, 0.003, 0, 0.001, 0, PC.black, { seg: 12 });                   // foot ring
  W.pop();
}
function bottle(x, y, z, col = 0x7fa6b8, h = 0.24, ry = 0) {
  W.push(x, y, z, ry);
  W.cyl(0.034, 0.036, h * 0.72, 0, h * 0.36, 0, col, { seg: 10, layer: 'glass' });
  W.cyl(0.014, 0.034, h * 0.14, 0, h * 0.79, 0, col, { seg: 10, layer: 'glass' });
  W.cyl(0.015, 0.015, h * 0.06, 0, h * 0.89, 0, PC.blueLt, { seg: 8 });
  W.cyl(0.0365, 0.0365, h * 0.18, 0, h * 0.42, 0, PC.white, { seg: 10 });          // label
  W.pop();
}
function can(x, y, z, col = PC.red, ry = 0) {
  W.push(x, y, z, ry);
  W.cyl(0.033, 0.033, 0.12, 0, 0.06, 0, col, { seg: 10, layer: 'metal' });
  W.cyl(0.03, 0.033, 0.008, 0, 0.124, 0, PC.alu, { seg: 10, layer: 'metal' });
  W.box(0.012, 0.002, 0.02, 0.008, 0.129, 0, PC.alu, { layer: 'metal' });
  W.pop();
}
function book(x, y, z, col = PC.blue, ry = 0, w = 0.16, h = 0.03, d = 0.23) {
  W.push(x, y, z, ry);
  W.box(w, h, d, 0, h / 2, 0, col);
  W.box(w - 0.008, h - 0.006, 0.004, 0, h / 2, d / 2 + 0.001, PC.paper);              // page block
  W.box(0.004, h - 0.006, d - 0.01, w / 2 + 0.001, h / 2, 0, PC.paper);
  W.pop();
}
function paperStack(x, y, z, n = 6, ry = 0) {
  W.push(x, y, z, ry);
  for (let i = 0; i < n; i++) W.box(0.21, 0.004, 0.297, mr(-0.01, 0.01), 0.002 + i * 0.004, mr(-0.01, 0.01), PC.paper, { ry: mr(-0.08, 0.08), jit: 0.02 });
  W.box(0.002, 0.003, 0.02, -0.08, n * 0.004 + 0.002, 0.13, PC.steel, { layer: 'metal' }); // staple
  W.pop();
}
function pen(x, y, z, ry = 0, col = PC.blue) { W.push(x, y, z, ry); W.cyl(0.004, 0.004, 0.14, 0, 0.004, 0, col, { rz: Math.PI / 2, seg: 6 }); W.cyl(0.0042, 0.0042, 0.03, 0.055, 0.004, 0, PC.black, { rz: Math.PI / 2, seg: 6 }); W.pop(); }
function laptop(x, y, z, ry = 0, open = 1.9) {
  W.push(x, y, z, ry);
  W.box(0.34, 0.02, 0.24, 0, 0.01, 0, PC.charcoal, { layer: 'metal' });
  W.box(0.3, 0.003, 0.11, 0, 0.0215, -0.03, PC.black);                                 // keyboard
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) W.box(0.018, 0.003, 0.018, -0.135 + c * 0.0245, 0.0235, -0.075 + r * 0.024, 0x2c2e33, { jit: 0 });
  W.box(0.1, 0.002, 0.065, 0, 0.0215, 0.075, 0x2c2e33);                                 // trackpad
  W.push(0, 0.02, -0.12, 0, -(Math.PI - open));
  W.box(0.34, 0.012, 0.23, 0, 0.006, 0.115, PC.charcoal, { layer: 'metal' });
  W.box(0.3, 0.002, 0.19, 0, 0.013, 0.115, GLOW.screen, { layer: 'glow' });
  W.pop();
  W.pop();
}
function monitor(x, y, z, ry = 0, glowCol = GLOW.screen) {
  W.push(x, y, z, ry);
  W.box(0.2, 0.012, 0.16, 0, 0.006, 0, PC.black);
  W.box(0.04, 0.3, 0.03, 0, 0.16, -0.03, PC.black);
  W.box(0.56, 0.34, 0.04, 0, 0.42, 0, PC.black);
  W.box(0.52, 0.3, 0.004, 0, 0.42, 0.021, glowCol, { layer: 'glow' });
  W.box(0.03, 0.006, 0.004, 0.24, 0.27, 0.021, GLOW.green, { layer: 'glow' });
  W.pop();
}
function keyboard(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.44, 0.02, 0.14, 0, 0.01, 0, PC.black, { rx: 0.05 });
  for (let r = 0; r < 5; r++) W.box(0.4, 0.008, 0.018, 0, 0.022, -0.05 + r * 0.025, 0x30333a, { rx: 0.05 });
  W.box(0.06, 0.02, 0.1, 0.32, 0.01, 0.02, PC.black);                                   // mouse pad + mouse
  W.sphere(0.06, 0.03, 0.1, 0.32, 0.03, 0.02, 0x2a2c30, { seg: 8, hseg: 4 });
  W.pop();
}
function radioSet(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.42, 0.22, 0.3, 0, 0.11, 0, PC.olive, { layer: 'metal' });
  W.box(0.4, 0.2, 0.01, 0, 0.11, 0.152, PC.oliveDk);
  W.box(0.14, 0.06, 0.004, -0.1, 0.15, 0.158, GLOW.amber, { layer: 'glow' });            // display
  for (let i = 0; i < 4; i++) W.cyl(0.018, 0.018, 0.025, 0.04 + i * 0.045, 0.1, 0.165, PC.black, { rx: Math.PI / 2, seg: 8 });
  for (let i = 0; i < 6; i++) W.box(0.022, 0.018, 0.01, -0.16 + i * 0.03, 0.06, 0.16, PC.black);
  W.cyl(0.006, 0.006, 0.6, 0.17, 0.52, -0.1, PC.black, { seg: 5 });                       // whip antenna
  W.box(0.05, 0.16, 0.05, -0.27, 0.08, 0.05, PC.black, { rz: 0.2 });                      // handset
  W.cable([-0.26, 0.02, 0.05], [-0.2, 0.02, 0.15], 0.02, 0.004, PC.black, 4);
  W.box(0.03, 0.04, 0.02, 0.02, 0.2, 0.16, GLOW.green, { layer: 'glow' });
  W.pop();
}
function phone(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.075, 0.009, 0.155, 0, 0.0045, 0, PC.black); W.box(0.068, 0.002, 0.14, 0, 0.0095, 0, 0x22324a, { layer: 'glow' }); W.pop(); }
function clipboard(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.23, 0.006, 0.32, 0, 0.003, 0, PC.woodLt); W.box(0.21, 0.004, 0.28, 0, 0.008, -0.01, PC.paper); W.box(0.08, 0.012, 0.03, 0, 0.012, 0.145, PC.steel, { layer: 'metal' }); for (let i = 0; i < 6; i++) W.box(0.15, 0.001, 0.004, -0.01, 0.011, -0.1 + i * 0.03, 0x555555); W.pop(); }
function ammoCan(x, y, z, ry = 0, small = false) {
  const s = small ? 0.75 : 1;
  W.push(x, y, z, ry);
  W.box(0.28 * s, 0.18 * s, 0.14 * s, 0, 0.09 * s, 0, PC.olive, { layer: 'metal' });
  W.box(0.29 * s, 0.02, 0.15 * s, 0, 0.18 * s + 0.01, 0, PC.oliveDk, { layer: 'metal' });
  W.box(0.12 * s, 0.015, 0.02, 0, 0.2 * s + 0.01, 0, PC.black);
  W.box(0.08, 0.025, 0.004, 0, 0.11 * s, 0.071 * s, PC.yellow, { ao: false });            // stencil
  W.pop();
}
function magazine(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.03, 0.022, 0.18, 0, 0.011, 0, PC.black, { ry: 0, rx: 0 }); W.box(0.032, 0.026, 0.02, 0, 0.013, -0.09, PC.charcoal); W.pop(); }
function flashlight(x, y, z, ry = 0) { W.push(x, y, z, ry); W.cyl(0.016, 0.016, 0.16, 0, 0.016, 0, PC.black, { rz: Math.PI / 2, seg: 8, layer: 'metal' }); W.cyl(0.022, 0.016, 0.04, 0.09, 0.022, 0, PC.black, { rz: Math.PI / 2, seg: 8, layer: 'metal' }); W.pop(); }
function helmetProp(x, y, z, ry = 0, col = PC.coyote) { W.push(x, y, z, ry); W.hemi(0.27, 0.2, 0.3, 0, 0, 0, col, { seg: 10 }); W.box(0.06, 0.03, 0.03, 0, 0.13, 0.13, PC.black, { rx: -0.6 }); for (const s of [-1, 1]) W.box(0.01, 0.02, 0.12, s * 0.135, 0.06, 0, PC.black); W.pop(); }
function ashtray(x, y, z) { W.cyl(0.06, 0.05, 0.025, x, y + 0.0125, z, PC.steel, { seg: 10, layer: 'metal' }); W.cyl(0.005, 0.005, 0.05, x + 0.02, y + 0.028, z, PC.white, { rz: 1.4, seg: 5 }); }
function cards(x, y, z) { for (let i = 0; i < 5; i++) W.box(0.063, 0.001, 0.088, x + mr(-0.08, 0.08), y + 0.001 + i * 0.0005, z + mr(-0.05, 0.05), i % 2 ? PC.white : PC.offwhite, { ry: mr(0, 3) }); W.box(0.063, 0.02, 0.088, x + 0.12, y + 0.01, z, PC.redLt); }
function mre(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.16, 0.035, 0.26, 0, 0.0175, 0, PC.tan, { rx: 0.03 }); W.box(0.1, 0.002, 0.06, 0, 0.036, 0.04, PC.black); W.pop(); }
function plate(x, y, z, col = PC.white) { W.cyl(0.12, 0.09, 0.02, x, y + 0.01, z, col, { seg: 14 }); }
function kettle(x, y, z, ry = 0) { W.push(x, y, z, ry); W.cyl(0.08, 0.1, 0.18, 0, 0.09, 0, PC.steel, { seg: 12, layer: 'metal' }); W.cyl(0.03, 0.08, 0.05, 0, 0.205, 0, PC.steel, { seg: 12, layer: 'metal' }); W.torus(0.07, 0.012, 0, 0.23, 0, PC.black, { arc: Math.PI, seg: 8 }); W.cyl(0.012, 0.02, 0.12, 0.12, 0.13, 0, PC.steel, { rz: -0.9, seg: 6, layer: 'metal' }); W.pop(); }
function teapot(x, y, z, ry = 0, col = 0x9a6b3a) { W.push(x, y, z, ry); W.sphere(0.16, 0.13, 0.16, 0, 0.07, 0, col, { seg: 10 }); W.cyl(0.04, 0.05, 0.03, 0, 0.14, 0, col, { seg: 10 }); W.sphere(0.03, 0.02, 0.03, 0, 0.16, 0, PC.black); W.cyl(0.01, 0.018, 0.1, 0.1, 0.1, 0, col, { rz: -0.8, seg: 6 }); W.torus(0.045, 0.01, -0.09, 0.09, 0, col, { arc: Math.PI, rz: Math.PI / 2, seg: 8 }); W.pop(); }
function glassCup(x, y, z) { W.cyl(0.03, 0.025, 0.08, x, y + 0.04, z, 0xc0a060, { seg: 8, layer: 'glass' }); W.cyl(0.026, 0.024, 0.05, x, y + 0.026, z, 0x7a3a12, { seg: 8, ao: false }); }
function bowl(x, y, z, col = PC.offwhite, fill = null) { W.cyl(0.09, 0.05, 0.06, x, y + 0.03, z, col, { seg: 12 }); if (fill) for (let i = 0; i < 5; i++) W.sphere(0.045, 0.04, 0.045, x + mr(-0.03, 0.03), y + 0.06, z + mr(-0.03, 0.03), fill, { seg: 6, hseg: 4 }); }
function coffeeMaker(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.2, 0.04, 0.24, 0, 0.02, 0, PC.black);
  W.box(0.2, 0.34, 0.08, 0, 0.17, -0.08, PC.black);
  W.box(0.2, 0.08, 0.2, 0, 0.3, 0.0, PC.black);
  W.cyl(0.07, 0.075, 0.13, 0, 0.11, 0.03, PC.glass, { seg: 12, layer: 'glass' });
  W.cyl(0.066, 0.07, 0.06, 0, 0.075, 0.03, PC.coffee, { seg: 12 });
  W.box(0.02, 0.012, 0.004, 0.07, 0.25, 0.101, GLOW.red, { layer: 'glow' });
  W.pop();
}
function deskLamp(x, y, z, ry = 0, on = true) {
  W.push(x, y, z, ry);
  W.cyl(0.07, 0.08, 0.02, 0, 0.01, 0, PC.black, { seg: 10, layer: 'metal' });
  W.rod([0, 0.02, 0], [0.04, 0.24, -0.04], 0.008, PC.black, { layer: 'metal' });
  W.rod([0.04, 0.24, -0.04], [0.16, 0.3, 0.03], 0.008, PC.black, { layer: 'metal' });
  W.cone(0.06, 0.1, 0.17, 0.27, 0.04, PC.black, { rz: 0.5, seg: 10, layer: 'metal' });
  if (on) { W.sphere(0.04, 0.04, 0.04, 0.17, 0.235, 0.045, GLOW.warm, { layer: 'glow' }); W.lamp(0.17, 0.2, 0.05, 0xffcf8a, 2.2, 4, { halo: 0.3 }); }
  W.pop();
}
function fireExtinguisher(x, y, z, ry = 0, wall = false) {
  W.push(x, y, z, ry);
  if (wall) W.box(0.12, 0.06, 0.04, 0, 0.55, -0.06, PC.black);
  const y0 = wall ? 0.15 : 0;
  W.cyl(0.075, 0.075, 0.48, 0, y0 + 0.24, 0, PC.redLt, { seg: 12, layer: 'metal' });
  W.hemi(0.15, 0.06, 0.15, 0, y0 + 0.48, 0, PC.redLt, { layer: 'metal' });
  W.box(0.04, 0.06, 0.04, 0, y0 + 0.55, 0, PC.black);
  W.box(0.12, 0.012, 0.03, 0.03, y0 + 0.59, 0, PC.black, { rz: 0.2 });
  W.cable([0.03, y0 + 0.56, 0.02], [0.08, y0 + 0.2, 0.06], 0.02, 0.008, PC.black, 5);
  W.box(0.12, 0.1, 0.002, 0, y0 + 0.28, 0.076, PC.white);
  W.pop();
}
function firstAid(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.3, 0.22, 0.1, 0, 0.11, 0, PC.white); W.box(0.06, 0.14, 0.004, 0, 0.11, 0.051, PC.redLt); W.box(0.14, 0.05, 0.004, 0, 0.11, 0.051, PC.redLt); W.box(0.06, 0.02, 0.02, 0, 0.23, 0, PC.charcoal); W.pop(); }
function wallClock(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.cyl(0.15, 0.15, 0.04, 0, 0, 0, PC.black, { rx: Math.PI / 2, seg: 16 });
  W.cyl(0.135, 0.135, 0.005, 0, 0, 0.022, PC.white, { rx: Math.PI / 2, seg: 16 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; W.box(0.008, i % 3 ? 0.012 : 0.025, 0.003, Math.sin(a) * 0.115, Math.cos(a) * 0.115, 0.026, PC.black, { rz: -a }); }
  W.box(0.008, 0.08, 0.003, 0.02, 0.035, 0.029, PC.black, { rz: -0.6 });
  W.box(0.006, 0.11, 0.003, -0.03, 0.045, 0.031, PC.black, { rz: 0.7 });
  W.box(0.003, 0.12, 0.003, 0, -0.04, 0.033, PC.redLt, { rz: 2.6 });
  W.pop();
}
function poster(x, y, z, ry = 0, w = 0.6, h = 0.85, pal = [PC.offwhite, PC.olive, PC.black, PC.redLt]) {
  W.push(x, y, z, ry);
  W.box(w, h, 0.004, 0, 0, 0, pal[0], { ao: false });
  W.box(w * 0.85, h * 0.12, 0.002, 0, h * 0.36, 0.003, pal[2], { ao: false });
  W.box(w * 0.8, h * 0.42, 0.002, 0, 0.02, 0.003, pal[1], { ao: false });
  for (let i = 0; i < 4; i++) W.box(w * mr(0.4, 0.8), h * 0.02, 0.002, -w * 0.05, -h * 0.25 - i * h * 0.05, 0.003, pal[2], { ao: false });
  W.box(w * 0.2, h * 0.08, 0.002, w * 0.3, -h * 0.4, 0.003, pal[3], { ao: false });
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) W.cyl(0.008, 0.008, 0.006, sx * (w / 2 - 0.02), sy * (h / 2 - 0.02), 0.004, PC.redLt, { rx: Math.PI / 2, seg: 6 });
  W.pop();
}
function mapBoard(x, y, z, ry = 0, w = 1.6, h = 1.1) {
  W.push(x, y, z, ry);
  W.box(w + 0.06, h + 0.06, 0.03, 0, 0, 0, PC.woodDk);
  W.box(w, h, 0.004, 0, 0, 0.017, 0xc8bb92, { ao: false });                          // terrain map
  for (let i = 0; i < 9; i++) W.box(w * mr(0.1, 0.5), 0.005, 0.002, mr(-w / 3, w / 3), mr(-h / 2.5, h / 2.5), 0.02, 0x8a7a5a, { ry: 0, rz: mr(-1, 1), ao: false }); // contour lines
  for (let i = 0; i < 6; i++) W.box(w, 0.002, 0.002, 0, -h / 2 + (i + 1) * h / 7, 0.021, 0x6a6a6a, { ao: false });
  for (let i = 0; i < 8; i++) W.box(0.002, h, 0.002, -w / 2 + (i + 1) * w / 9, 0, 0.021, 0x6a6a6a, { ao: false });
  W.box(w * 0.4, 0.04, 0.003, 0.1, 0.1, 0.022, PC.blue, { rz: 0.3, ao: false });           // river
  for (let i = 0; i < 7; i++) W.cyl(0.012, 0.012, 0.03, mr(-w / 2.4, w / 2.4), mr(-h / 2.4, h / 2.4), 0.03, mpick([PC.redLt, PC.blueLt, PC.yellow]), { rx: Math.PI / 2, seg: 6 });
  for (let i = 0; i < 4; i++) W.box(0.08, 0.05, 0.002, mr(-w / 2.4, w / 2.4), mr(-h / 2.4, h / 2.4), 0.022, PC.yellow, { ao: false }); // sticky notes
  W.pop();
}
function whiteboard(x, y, z, ry = 0, w = 1.4, h = 0.9) {
  W.push(x, y, z, ry);
  W.box(w + 0.04, h + 0.04, 0.025, 0, 0, 0, PC.alu, { layer: 'metal' });
  W.box(w, h, 0.004, 0, 0, 0.014, PC.white, { ao: false });
  for (let i = 0; i < 7; i++) W.box(w * mr(0.2, 0.6), 0.008, 0.002, mr(-0.2, 0.1), h * 0.35 - i * 0.1, 0.017, mpick([PC.blue, PC.black, PC.redLt]), { ao: false });
  W.box(w * 0.3, 0.25, 0.002, w * 0.28, -0.15, 0.017, PC.white, { ao: false });
  W.rod([w * 0.15, -0.28, 0.018], [w * 0.4, -0.05, 0.018], 0.004, PC.redLt);
  W.box(w * 0.8, 0.03, 0.06, 0, -h / 2 - 0.03, 0.03, PC.alu, { layer: 'metal' });          // tray
  pen(-0.2, -h / 2 - 0.015, 0.04, 0, PC.blue); pen(0.05, -h / 2 - 0.015, 0.04, 0.1, PC.redLt);
  W.pop();
}
function corkboard(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(1.0, 0.7, 0.025, 0, 0, 0, PC.woodLt);
  W.box(0.94, 0.64, 0.004, 0, 0, 0.014, 0xa07a50, { ao: false });
  for (let i = 0; i < 9; i++) { const px = mr(-0.38, 0.38), py = mr(-0.25, 0.25); W.box(mr(0.12, 0.2), mr(0.12, 0.2), 0.002, px, py, 0.017 + i * 0.0005, mpick([PC.paper, PC.white, PC.yellow, 0xd8e2f0]), { rz: mr(-0.1, 0.1), ao: false }); W.cyl(0.007, 0.007, 0.01, px, py + 0.06, 0.022, mpick([PC.redLt, PC.blueLt, PC.green]), { rx: Math.PI / 2, seg: 6 }); }
  W.pop();
}
function ceilingLight(x, y, z, ry = 0, len = 1.2, on = true) {
  W.push(x, y, z, ry);
  W.box(len, 0.06, 0.18, 0, -0.03, 0, PC.offwhite, { layer: 'metal' });
  W.box(len - 0.06, 0.012, 0.13, 0, -0.065, 0, on ? GLOW.cool : PC.white, { layer: on ? 'glow' : 'solid' });
  for (const s of [-1, 1]) W.rod([s * len * 0.4, 0, 0], [s * len * 0.4, 0.04, 0], 0.004, PC.steel);
  if (on) W.lamp(0, -0.25, 0, 0xe8eeff, 4.5, 8, { halo: 0.15 });
  W.pop();
}
function bulb(x, y, z, cord = 0.4, col = GLOW.warm, intensity = 3.5, range = 7) {
  W.rod([x, y, z], [x, y - cord, z], 0.004, PC.black);
  W.cyl(0.02, 0.02, 0.04, x, y - cord - 0.02, z, PC.black, { seg: 6 });
  W.sphere(0.07, 0.09, 0.07, x, y - cord - 0.08, z, col, { layer: 'glow' });
  W.lamp(x, y - cord - 0.12, z, col, intensity, range, { halo: 0.5 });
}
function wallSwitch(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.07, 0.11, 0.012, 0, 0, 0, PC.offwhite); W.box(0.016, 0.03, 0.01, 0, 0, 0.01, PC.white); W.pop(); }
function outlet(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.07, 0.11, 0.012, 0, 0, 0, PC.offwhite); for (const s of [-1, 1]) W.box(0.02, 0.025, 0.004, 0, s * 0.025, 0.008, PC.charcoal); W.pop(); }
function trashCan(x, y, z, col = PC.charcoal, fill = true) {
  W.cyl(0.17, 0.14, 0.42, x, 0.21 + y, z, col, { seg: 12, open: true, layer: 'cloth' });
  W.cyl(0.14, 0.14, 0.01, x, y + 0.005, z, col, { seg: 12 });
  W.torus(0.17, 0.012, x, y + 0.42, z, col, { rx: Math.PI / 2, seg: 14 });
  if (fill) { for (let i = 0; i < 4; i++) W.box(0.1, 0.06, 0.1, x + mr(-0.06, 0.06), y + 0.33 + i * 0.02, z + mr(-0.06, 0.06), mpick([PC.paper, PC.white, PC.tan]), { ry: mr(0, 3), rx: mr(-0.4, 0.4) }); can(x + 0.05, y + 0.38, z, PC.red, 0.3); }
}
function fanStand(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.cyl(0.18, 0.2, 0.03, 0, 0.015, 0, PC.offwhite, { seg: 12 });
  W.cyl(0.015, 0.015, 1.0, 0, 0.52, 0, PC.alu, { seg: 6, layer: 'metal' });
  W.box(0.12, 0.14, 0.14, 0, 1.06, -0.05, PC.offwhite);
  W.torus(0.2, 0.012, 0, 1.06, 0.08, PC.alu, { seg: 16 });
  for (let i = 0; i < 8; i++) W.rod([0, 1.06, 0.08], [Math.sin(i * 0.785) * 0.2, 1.06 + Math.cos(i * 0.785) * 0.2, 0.08], 0.003, PC.alu, { ao: false });
  for (let i = 0; i < 3; i++) W.box(0.07, 0.16, 0.01, Math.sin(i * 2.09) * 0.09, 1.06 + Math.cos(i * 2.09) * 0.09, 0.07, PC.blueLt, { rz: -i * 2.09, rx: 0.3 });
  W.pop();
}
function jerrycan(x, y, z, ry = 0, col = PC.olive) {
  W.push(x, y, z, ry);
  W.box(0.17, 0.46, 0.34, 0, 0.23, 0, col, { layer: 'metal' });
  for (const s of [-1, 1]) { W.box(0.004, 0.36, 0.03, s * 0.087, 0.23, 0, col, { rz: 0, ry: 0, rx: 0.75 }); W.box(0.004, 0.36, 0.03, s * 0.087, 0.23, 0, col, { rx: -0.75 }); }
  for (let i = 0; i < 3; i++) W.box(0.04, 0.035, 0.03, 0, 0.475, -0.08 + i * 0.07, col, { layer: 'metal' });
  W.cyl(0.025, 0.025, 0.05, 0, 0.47, 0.13, PC.black, { rx: -0.6, seg: 8 });
  W.pop();
}
function drum(x, y, z, col = PC.blue, ry = 0, onSide = false) {
  W.push(x, y, z, ry, onSide ? Math.PI / 2 : 0);
  const yc = onSide ? 0 : 0.44;
  W.cyl(0.29, 0.29, 0.88, 0, yc, 0, col, { seg: 14, layer: 'metal' });
  for (const h of [-0.29, 0, 0.29, -0.44, 0.44]) W.torus(0.295, 0.016, 0, yc + h, 0, col, { rx: Math.PI / 2, seg: 14, layer: 'metal' });
  W.cyl(0.04, 0.04, 0.012, 0.15, yc + 0.445, 0.05, PC.metalDk, { seg: 6 });
  W.cyl(0.025, 0.025, 0.012, -0.16, yc + 0.445, -0.04, PC.metalDk, { seg: 6 });
  for (let i = 0; i < 3; i++) W.box(0.1, 0.06, 0.01, Math.sin(i * 2) * 0.27, yc + mr(-0.3, 0.3), Math.cos(i * 2) * 0.27, PC.rust, { ry: i * 2, ao: false });
  W.pop();
  if (!onSide) W.solid(0.58, 0.88, 0.58, x, y + 0.44, z, 'metal');
}
function crate(x, y, z, w = 1.0, h = 0.7, d = 0.8, ry = 0, col = PC.woodLt, solid = true) {
  W.push(x, y, z, ry);
  W.box(w, h, d, 0, h / 2, 0, col);
  const t = 0.03, wood = PC.wood;
  for (const s of [-1, 1]) {
    W.box(w + 0.02, 0.07, t, 0, 0.035, s * d / 2, wood); W.box(w + 0.02, 0.07, t, 0, h - 0.035, s * d / 2, wood);
    W.box(0.07, h, t, -w / 2 + 0.035, h / 2, s * d / 2, wood); W.box(0.07, h, t, w / 2 - 0.035, h / 2, s * d / 2, wood);
    W.box(Math.hypot(w, h) - 0.1, 0.06, t * 0.8, 0, h / 2, s * (d / 2 + 0.003), wood, { rz: Math.atan2(h, w) * s });
    W.box(t, 0.07, d + 0.02, s * w / 2, 0.035, 0, wood); W.box(t, 0.07, d + 0.02, s * w / 2, h - 0.035, 0, wood);
  }
  W.box(w * 0.35, 0.08, 0.004, w * 0.15, h * 0.62, d / 2 + 0.018, PC.black, { ao: false });            // stencil
  W.box(w * 0.2, 0.05, 0.004, w * 0.15, h * 0.48, d / 2 + 0.018, PC.black, { ao: false });
  W.pop();
  if (solid) W.solid(w, h, d, x, y + h / 2, z, 'wood', { ry });
}
function pallet(x, y, z, ry = 0, col = PC.woodLt) {
  W.push(x, y, z, ry);
  for (let i = 0; i < 7; i++) W.box(1.2, 0.022, 0.1, 0, 0.133, -0.45 + i * 0.15, col, { jit: 0.12 });
  for (const s of [-1, 0, 1]) { W.box(1.2, 0.09, 0.1, 0, 0.077, s * 0.45, PC.wood); for (const t of [-1, 0, 1]) W.box(0.12, 0.07, 0.12, t * 0.52, 0.035, s * 0.45, PC.woodDk); }
  for (let i = 0; i < 4; i++) W.box(1.2, 0.022, 0.1, 0, 0.011, -0.45 + i * 0.3, col, { jit: 0.12 });
  W.pop();
}
function sandbag(x, y, z, ry = 0, col = PC.tan) {
  W.push(x, y, z, ry);
  W.box(0.6, 0.15, 0.32, 0, 0.075, 0, col, { jit: 0.1 });
  W.sphere(0.6, 0.16, 0.34, 0, 0.1, 0, col, { seg: 8, hseg: 4, jit: 0.1 });
  W.box(0.05, 0.13, 0.33, 0.27, 0.08, 0, col, { jit: 0.1, rz: 0.2 });
  W.pop();
}
// a stacked sandbag wall from a to b (local), staggered courses
function sandbagWall(x0, z0, x1, z1, rows = 3, col = PC.tan) {
  // local +X of each bag runs along the wall
  const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(-(z1 - z0), x1 - x0), n = Math.max(1, Math.round(L / 0.58));
  for (let r = 0; r < rows; r++) for (let i = 0; i < n + (r % 2 ? -1 : 0); i++) {
    const t = (i + 0.5 + (r % 2 ? 0.5 : 0)) / n;
    sandbag(lerp(x0, x1, t), r * 0.14, lerp(z0, z1, t), ang + mr(-0.06, 0.06), col);
  }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  W.solid(L, rows * 0.15, 0.36, cx, rows * 0.075, cz, 'sand', { ry: ang });
}

// ---------------- furniture ----------------
function chairFolding(x, y, z, ry = 0, col = PC.charcoal) {
  W.push(x, y, z, ry);
  W.box(0.42, 0.03, 0.4, 0, 0.45, 0.02, col, { layer: 'metal' });
  W.box(0.42, 0.24, 0.025, 0, 0.75, -0.2, col, { rx: 0.08, layer: 'metal' });
  for (const s of [-1, 1]) {
    W.rod([s * 0.2, 0, 0.2], [s * 0.2, 0.9, -0.22], 0.012, PC.steel, { layer: 'metal' });
    W.rod([s * 0.2, 0, -0.18], [s * 0.2, 0.45, 0.16], 0.012, PC.steel, { layer: 'metal' });
  }
  W.rod([-0.2, 0.08, 0.17], [0.2, 0.08, 0.17], 0.008, PC.steel, { layer: 'metal' });
  W.pop();
}
function chairOffice(x, y, z, ry = 0, col = PC.black) {
  W.push(x, y, z, ry);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; W.box(0.04, 0.03, 0.3, Math.sin(a) * 0.14, 0.06, Math.cos(a) * 0.14, PC.charcoal, { ry: a }); W.sphere(0.05, 0.05, 0.05, Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29, PC.black); }
  W.cyl(0.025, 0.025, 0.36, 0, 0.25, 0, PC.alu, { layer: 'metal', seg: 8 });
  W.box(0.5, 0.08, 0.48, 0, 0.47, 0, col);
  W.box(0.46, 0.55, 0.07, 0, 0.82, -0.24, col, { rx: 0.12 });
  W.box(0.08, 0.2, 0.06, 0, 0.55, -0.22, PC.charcoal);
  for (const s of [-1, 1]) { W.box(0.05, 0.03, 0.26, s * 0.26, 0.68, -0.02, PC.charcoal); W.box(0.03, 0.18, 0.03, s * 0.26, 0.58, -0.04, PC.charcoal); }
  W.pop();
}
function stool(x, y, z, col = PC.woodLt) { W.cyl(0.17, 0.16, 0.04, x, y + 0.46, z, col, { seg: 10 }); for (let i = 0; i < 3; i++) { const a = i * 2.09; W.rod([x + Math.sin(a) * 0.12, y + 0.45, z + Math.cos(a) * 0.12], [x + Math.sin(a) * 0.17, y, z + Math.cos(a) * 0.17], 0.015, PC.wood); } }
function tableFolding(x, y, z, ry = 0, w = 1.8, d = 0.76) {
  W.push(x, y, z, ry);
  W.box(w, 0.04, d, 0, 0.72, 0, PC.offwhite);
  W.box(w - 0.04, 0.05, d - 0.06, 0, 0.68, 0, PC.metalDk, { layer: 'metal' });
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.rod([s * (w / 2 - 0.12), 0, t * (d / 2 - 0.08)], [s * (w / 2 - 0.16), 0.66, t * (d / 2 - 0.08)], 0.014, PC.steel, { layer: 'metal' });
  for (const s of [-1, 1]) W.rod([s * (w / 2 - 0.14), 0.2, -d / 2 + 0.08], [s * (w / 2 - 0.14), 0.2, d / 2 - 0.08], 0.01, PC.steel, { layer: 'metal' });
  W.pop();
  W.solid(w, 0.76, d, x, y + 0.38, z, 'wood', { ry });
}
function desk(x, y, z, ry = 0, w = 1.4, d = 0.75, col = PC.woodLt) {
  W.push(x, y, z, ry);
  W.box(w, 0.04, d, 0, 0.74, 0, col);
  W.box(0.42, 0.7, d - 0.06, w / 2 - 0.23, 0.36, 0, PC.metal, { layer: 'metal' });
  for (let i = 0; i < 3; i++) { W.box(0.38, 0.2, 0.012, w / 2 - 0.23, 0.14 + i * 0.22, d / 2 - 0.025, PC.steel, { layer: 'metal' }); W.box(0.12, 0.02, 0.025, w / 2 - 0.23, 0.2 + i * 0.22, d / 2 - 0.01, PC.black); }
  W.box(0.03, 0.7, d - 0.06, -w / 2 + 0.03, 0.36, 0, PC.metal, { layer: 'metal' });
  W.box(w - 0.5, 0.45, 0.02, -0.21, 0.5, -d / 2 + 0.05, PC.metal, { layer: 'metal' });  // modesty panel
  W.pop();
  W.solid(w, 0.78, d, x, y + 0.39, z, 'wood', { ry });
}
function bunkBed(x, y, z, ry = 0, blanket = PC.olive) {
  W.push(x, y, z, ry);
  const L = 2.0, Wd = 0.9;
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.05, 1.75, 0.05, s * (Wd / 2), 0.875, t * (L / 2), PC.metalDk, { layer: 'metal' });
  for (const hy of [0.42, 1.42]) {
    for (const s of [-1, 1]) W.box(0.04, 0.06, L, s * (Wd / 2), hy, 0, PC.metalDk, { layer: 'metal' });
    for (const t of [-1, 1]) W.box(Wd, 0.06, 0.04, 0, hy, t * L / 2, PC.metalDk, { layer: 'metal' });
    W.box(Wd - 0.06, 0.12, L - 0.06, 0, hy + 0.09, 0, PC.mattress);
    W.box(Wd - 0.04, 0.05, L * 0.62, 0, hy + 0.17, L * 0.15, blanket, { jit: 0.1, rx: mr(-0.02, 0.02) });   // blanket
    W.box(Wd - 0.03, 0.03, 0.12, 0, hy + 0.19, L * 0.15 - L * 0.31 + 0.05, PC.offwhite);                    // folded sheet
    W.box(0.5, 0.1, 0.3, mr(-0.05, 0.05), hy + 0.2, -L / 2 + 0.22, PC.white, { ry: mr(-0.15, 0.15) });     // pillow
    W.sphere(0.5, 0.06, 0.3, 0, hy + 0.24, -L / 2 + 0.22, PC.white, { seg: 8, hseg: 4 });
  }
  for (let i = 0; i < 5; i++) W.box(0.36, 0.03, 0.03, 0, 0.6 + i * 0.22, L / 2 + 0.03, PC.metalDk, { layer: 'metal' }); // ladder rungs
  W.pop();
  W.solid(Wd, 1.75, L, x, y + 0.875, z, 'metal', { ry });
}
function cot(x, y, z, ry = 0, col = PC.olive) {
  W.push(x, y, z, ry);
  W.box(0.7, 0.04, 1.9, 0, 0.42, 0, col);
  for (const s of [-1, 1]) W.box(0.03, 0.03, 1.95, s * 0.36, 0.42, 0, PC.alu, { layer: 'metal' });
  for (const t of [-0.85, 0, 0.85]) { W.rod([-0.36, 0.42, t], [0.36, 0.05, t], 0.012, PC.alu, { layer: 'metal' }); W.rod([0.36, 0.42, t], [-0.36, 0.05, t], 0.012, PC.alu, { layer: 'metal' }); }
  W.box(0.62, 0.06, 1.0, 0, 0.47, 0.3, mpick([PC.oliveDk, PC.coyote, PC.charcoal]), { rx: 0.02 }); // sleeping bag
  W.box(0.45, 0.08, 0.28, 0, 0.48, -0.75, PC.offwhite);
  W.pop();
  W.solid(0.75, 0.5, 1.95, x, y + 0.25, z, 'cloth', { ry });
}
function footlocker(x, y, z, ry = 0, col = PC.olive) { W.push(x, y, z, ry); W.box(0.8, 0.35, 0.45, 0, 0.175, 0, col, { layer: 'metal' }); W.box(0.82, 0.04, 0.47, 0, 0.36, 0, PC.oliveDk, { layer: 'metal' }); for (const s of [-1, 1]) { W.box(0.08, 0.06, 0.02, s * 0.25, 0.3, 0.236, PC.steel, { layer: 'metal' }); W.box(0.02, 0.04, 0.12, s * 0.41, 0.24, 0, PC.black); } W.box(0.22, 0.08, 0.004, 0, 0.18, 0.226, PC.white, { ao: false }); W.pop(); W.solid(0.8, 0.38, 0.45, x, y + 0.19, z, 'metal', { ry }); }
function locker(x, y, z, ry = 0, col = PC.olive, open = false) {
  W.push(x, y, z, ry);
  W.box(0.6, 1.85, 0.5, 0, 0.925, 0, col, { layer: 'metal' });
  for (const s of [-1, 1]) {
    W.box(0.28, 1.75, 0.012, s * 0.145, 0.93, 0.252, col, { layer: 'metal', ry: open && s > 0 ? -1.2 : 0 });
    for (let i = 0; i < 5; i++) W.box(0.16, 0.012, 0.004, s * 0.145, 1.6 + i * 0.035, 0.26, PC.metalDk, { ao: false });
    W.box(0.02, 0.12, 0.02, s * 0.03, 1.0, 0.27, PC.steel, { layer: 'metal' });
  }
  W.box(0.6, 0.06, 0.5, 0, 1.88, 0, PC.oliveDk, { layer: 'metal' });
  W.box(0.08, 0.05, 0.004, -0.14, 1.45, 0.26, PC.white, { ao: false });            // name tape
  W.pop();
  W.solid(0.6, 1.9, 0.5, x, y + 0.95, z, 'metal', { ry });
}
function fileCabinet(x, y, z, ry = 0, col = PC.metal) {
  W.push(x, y, z, ry);
  W.box(0.46, 1.32, 0.62, 0, 0.66, 0, col, { layer: 'metal' });
  for (let i = 0; i < 4; i++) { W.box(0.42, 0.29, 0.015, 0, 0.18 + i * 0.32, 0.312, PC.steel, { layer: 'metal' }); W.box(0.14, 0.025, 0.03, 0, 0.26 + i * 0.32, 0.33, PC.black); W.box(0.08, 0.03, 0.003, 0, 0.3 + i * 0.32, 0.321, PC.white, { ao: false }); }
  W.pop();
  W.solid(0.46, 1.32, 0.62, x, y + 0.66, z, 'metal', { ry });
}
// metal shelving with stocked items; `stock` picks what goes on it
function shelf(x, y, z, ry = 0, w = 1.2, levels = 4, stock = 'supply') {
  W.push(x, y, z, ry);
  const d = 0.45, H = 1.9;
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.035, H, 0.035, s * (w / 2), H / 2, t * (d / 2), PC.metalDk, { layer: 'metal' });
  for (let l = 0; l < levels; l++) {
    const hy = 0.12 + l * ((H - 0.2) / (levels - 1));
    W.box(w, 0.025, d, 0, hy, 0, PC.metal, { layer: 'metal' });
    let cx = -w / 2 + 0.06;
    while (cx < w / 2 - 0.1) {
      const k = stock === 'shop' ? mpick(['box', 'box', 'can', 'bottle', 'bag']) : stock === 'books' ? 'book' : stock === 'pantry' ? mpick(['can', 'box', 'bag', 'jar']) : mpick(['box', 'box', 'ammo', 'mre', 'bag', 'jug']);
      if (k === 'box') { const bw = mr(0.12, 0.3), bh = mr(0.1, 0.3); W.box(bw, bh, mr(0.2, 0.38), cx + bw / 2, hy + 0.0125 + bh / 2, 0, mpick([PC.tan, PC.coyote, PC.offwhite, 0xc8a878, PC.redLt, PC.blueLt, PC.yellow, PC.green])); cx += bw + 0.02; }
      else if (k === 'can') { for (let i = 0; i < 3; i++) can(cx + 0.04 + i * 0.07, hy + 0.0125, mr(-0.1, 0.1), mpick([PC.redLt, PC.green, PC.yellow, PC.blueLt, PC.orange])); cx += 0.22; }
      else if (k === 'bottle') { for (let i = 0; i < 3; i++) bottle(cx + 0.04 + i * 0.075, hy + 0.0125, mr(-0.08, 0.08), mpick([0x7fa6b8, 0x8fb88a, 0xc8a050]), 0.24); cx += 0.24; }
      else if (k === 'ammo') { ammoCan(cx + 0.15, hy + 0.0125, 0, mr(-0.1, 0.1)); cx += 0.33; }
      else if (k === 'mre') { for (let i = 0; i < 3; i++) mre(cx + 0.09, hy + 0.0125 + i * 0.036, 0, mr(-0.2, 0.2)); cx += 0.2; }
      else if (k === 'jug') { W.cyl(0.13, 0.13, 0.3, cx + 0.14, hy + 0.16, 0, 0x7fa6c8, { seg: 10, layer: 'glass' }); cx += 0.3; }
      else if (k === 'jar') { W.cyl(0.05, 0.05, 0.14, cx + 0.05, hy + 0.08, 0, mpick([0xb88a3a, 0x8a3a2a, 0x6a8a3a]), { seg: 8, layer: 'glass' }); cx += 0.12; }
      else if (k === 'book') { const bw = mr(0.025, 0.06), bh = mr(0.18, 0.28); W.box(bw, bh, 0.2, cx + bw / 2, hy + 0.0125 + bh / 2, 0, mpick([PC.redLt, PC.blue, PC.green, PC.black, PC.tan, PC.woodDk]), { rz: mrand() < 0.1 ? 0.2 : 0 }); cx += bw + 0.005; }
      else { const bw = mr(0.2, 0.35); W.sphere(bw, mr(0.12, 0.2), 0.3, cx + bw / 2, hy + 0.08, 0, mpick([PC.olive, PC.coyote, PC.offwhite]), { seg: 8, hseg: 4 }); cx += bw + 0.02; }
    }
  }
  W.pop();
  W.solid(w, H, d, x, y + H / 2, z, 'metal', { ry });
}
function weaponRack(x, y, z, ry = 0, n = 6) {
  W.push(x, y, z, ry);
  W.box(n * 0.18 + 0.1, 0.06, 0.3, 0, 0.12, 0.05, PC.woodDk);
  W.box(n * 0.18 + 0.1, 0.06, 0.08, 0, 1.0, -0.08, PC.woodDk);
  for (const s of [-1, 1]) W.box(0.06, 1.1, 0.3, s * (n * 0.09 + 0.05), 0.55, 0, PC.woodDk);
  for (let i = 0; i < n; i++) {
    const rx = -n * 0.09 + 0.09 + i * 0.18;
    W.push(rx, 0.16, 0.05, 0, -0.08);
    W.box(0.04, 0.12, 0.05, 0, 0.06, 0, PC.black);       // stock
    W.box(0.03, 0.55, 0.035, 0, 0.4, 0, PC.black);       // receiver/handguard
    W.box(0.02, 0.18, 0.06, 0, 0.32, 0.05, PC.charcoal); // magazine
    W.cyl(0.006, 0.006, 0.2, 0, 0.78, 0, PC.black, { seg: 5 });
    W.pop();
  }
  W.pop();
  W.solid(n * 0.18 + 0.16, 1.1, 0.32, x, y + 0.55, z, 'wood', { ry });
}
function fridge(x, y, z, ry = 0, col = PC.white) {
  W.push(x, y, z, ry);
  W.box(0.7, 1.75, 0.68, 0, 0.875, 0, col, { layer: 'metal' });
  W.box(0.68, 1.1, 0.02, 0, 0.6, 0.35, col, { layer: 'metal' });
  W.box(0.68, 0.55, 0.02, 0, 1.45, 0.35, col, { layer: 'metal' });
  for (const hy of [0.9, 1.3]) W.box(0.025, 0.3, 0.03, 0.3, hy, 0.37, PC.charcoal);
  for (let i = 0; i < 5; i++) W.box(0.05, 0.05, 0.005, mr(-0.25, 0.1), mr(1.2, 1.6), 0.362, mpick([PC.redLt, PC.yellow, PC.blueLt, PC.green]), { ao: false }); // magnets
  W.box(0.15, 0.2, 0.003, -0.15, 1.0, 0.362, PC.paper, { ao: false });                  // note
  W.pop();
  W.solid(0.7, 1.75, 0.7, x, y + 0.875, z, 'metal', { ry });
}
function microwave(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.5, 0.3, 0.38, 0, 0.15, 0, PC.offwhite, { layer: 'metal' }); W.box(0.33, 0.22, 0.01, -0.06, 0.15, 0.19, PC.black, { layer: 'glass' }); W.box(0.1, 0.22, 0.01, 0.19, 0.15, 0.19, PC.charcoal); W.box(0.05, 0.015, 0.004, 0.19, 0.22, 0.197, GLOW.green, { layer: 'glow' }); W.pop(); }
function waterCooler(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.32, 0.95, 0.32, 0, 0.475, 0, PC.offwhite, { layer: 'metal' });
  W.box(0.2, 0.08, 0.06, 0, 0.75, 0.17, PC.charcoal);
  for (const s of [-1, 1]) W.box(0.03, 0.03, 0.04, s * 0.05, 0.72, 0.2, s < 0 ? PC.blueLt : PC.redLt);
  W.cyl(0.13, 0.13, 0.36, 0, 1.15, 0, 0x6fa0d0, { seg: 12, layer: 'glass' });
  W.cyl(0.04, 0.13, 0.06, 0, 0.98, 0, 0x6fa0d0, { seg: 12, layer: 'glass' });
  W.pop();
  W.solid(0.32, 1.3, 0.32, x, y + 0.65, z, 'metal');
}
function sink(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.6, 0.85, 0.5, 0, 0.425, 0, PC.offwhite); W.box(0.5, 0.04, 0.38, 0, 0.86, 0.02, PC.steel, { layer: 'metal' }); W.box(0.42, 0.14, 0.3, 0, 0.8, 0.02, PC.metalDk, { layer: 'metal' }); W.rod([0, 0.86, -0.18], [0, 1.08, -0.14], 0.014, PC.alu, { layer: 'metal' }); W.rod([0, 1.08, -0.14], [0, 1.06, 0.0], 0.012, PC.alu, { layer: 'metal' }); for (const s of [-1, 1]) W.cyl(0.02, 0.02, 0.04, s * 0.09, 0.9, -0.17, PC.alu, { layer: 'metal' }); W.pop(); W.solid(0.6, 0.9, 0.5, x, y + 0.45, z, 'wood', { ry }); }
function stove(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.6, 0.9, 0.6, 0, 0.45, 0, PC.white, { layer: 'metal' }); for (const [a, b] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) { W.cyl(0.09, 0.09, 0.02, a, 0.91, b, PC.black, { seg: 12 }); W.torus(0.06, 0.008, a, 0.925, b, PC.charcoal, { rx: Math.PI / 2 }); } W.box(0.5, 0.35, 0.01, 0, 0.45, 0.305, PC.black, { layer: 'glass' }); for (let i = 0; i < 4; i++) W.cyl(0.02, 0.02, 0.03, -0.2 + i * 0.13, 0.82, 0.31, PC.black, { rx: Math.PI / 2, seg: 8 }); W.box(0.45, 0.025, 0.03, 0, 0.68, 0.32, PC.alu, { layer: 'metal' }); W.pop(); W.solid(0.6, 0.92, 0.6, x, y + 0.46, z, 'metal', { ry }); }
function toilet(x, y, z, ry = 0) { W.push(x, y, z, ry); W.cyl(0.16, 0.12, 0.38, 0, 0.19, 0.05, PC.white, { seg: 12 }); W.cyl(0.2, 0.18, 0.06, 0, 0.41, 0.08, PC.white, { seg: 12 }); W.box(0.38, 0.38, 0.16, 0, 0.6, -0.2, PC.white); W.box(0.4, 0.04, 0.18, 0, 0.8, -0.2, PC.white); W.box(0.05, 0.02, 0.03, 0.12, 0.76, -0.1, PC.alu, { layer: 'metal' }); W.pop(); }
function mirror(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.5, 0.7, 0.02, 0, 0, 0, PC.alu, { layer: 'metal' }); W.box(0.46, 0.66, 0.004, 0, 0, 0.012, 0xb8c8d0, { layer: 'metal', ao: false }); W.pop(); }
function boots(x, y, z, ry = 0) { W.push(x, y, z, ry); for (const s of [-1, 1]) { W.box(0.11, 0.06, 0.3, s * 0.07, 0.03, 0.02, PC.black); W.box(0.1, 0.22, 0.13, s * 0.07, 0.14, -0.06, PC.coyote); } W.pop(); }
function backpack(x, y, z, ry = 0, col = PC.coyote) { W.push(x, y, z, ry); W.box(0.36, 0.5, 0.22, 0, 0.25, 0, col, { rx: -0.1 }); W.box(0.3, 0.16, 0.08, 0, 0.18, 0.14, col, { rx: -0.1 }); W.box(0.37, 0.1, 0.24, 0, 0.52, -0.02, col, { rx: 0.1 }); for (const s of [-1, 1]) W.box(0.04, 0.4, 0.02, s * 0.1, 0.3, -0.13, PC.black, { rx: -0.1 }); W.pop(); }
function duffel(x, y, z, ry = 0, col = PC.olive) { W.push(x, y, z, ry); W.cyl(0.18, 0.18, 0.8, 0, 0.17, 0, col, { rz: Math.PI / 2, seg: 10 }); W.torus(0.1, 0.02, 0, 0.36, 0, PC.black, { arc: Math.PI, seg: 6 }); W.pop(); }
function towel(x, y, z, ry = 0, col = PC.offwhite) { W.push(x, y, z, ry); W.box(0.05, 0.02, 0.4, 0, 0, 0, PC.alu, { layer: 'metal' }); W.box(0.03, 0.55, 0.38, 0.01, -0.28, 0, col, { layer: 'cloth' }); W.pop(); }
function rug(x, y, z, w, d, ry = 0, pal = [PC.red, 0x2a3a6a, PC.yellow, PC.offwhite]) {
  W.push(x, y, z, ry);
  W.box(w, 0.012, d, 0, 0.006, 0, pal[0], { ao: false });
  W.box(w - 0.12, 0.014, d - 0.12, 0, 0.007, 0, pal[1], { ao: false });
  W.box(w - 0.3, 0.016, d - 0.3, 0, 0.008, 0, pal[0], { ao: false });
  for (let i = 0; i < 3; i++) W.box((w - 0.4) * (1 - i * 0.28), 0.018, 0.06, 0, 0.009, (i - 1) * d * 0.22, pal[2], { ao: false, ry: 0 });
  W.box(0.3, 0.019, 0.3, 0, 0.009, 0, pal[3], { ry: Math.PI / 4, ao: false });
  for (const s of [-1, 1]) for (let i = 0; i < Math.round(w / 0.06); i++) W.box(0.012, 0.004, 0.06, -w / 2 + 0.03 + i * 0.06, 0.004, s * (d / 2 + 0.03), pal[3], { ao: false }); // fringe
  W.pop();
}
function cushion(x, y, z, ry = 0, col = PC.red) { W.push(x, y, z, ry); W.box(0.6, 0.14, 0.6, 0, 0.07, 0, col, { jit: 0.1 }); W.sphere(0.62, 0.14, 0.62, 0, 0.1, 0, col, { seg: 8, hseg: 4 }); W.pop(); }
function floorCushionSet(x, y, z, ry = 0, len = 3, pal = [PC.red, 0x5a2a4a, PC.yellow]) {
  W.push(x, y, z, ry);
  W.box(len, 0.1, 0.7, 0, 0.05, 0, pal[0]);
  for (let i = 0; i < Math.floor(len / 0.62); i++) W.box(0.56, 0.42, 0.16, -len / 2 + 0.31 + i * 0.62, 0.3, -0.27, pal[i % 2 ? 1 : 2], { rx: -0.2, jit: 0.1 });
  W.pop();
}
function lowTable(x, y, z, ry = 0, w = 1.0, d = 0.6) { W.push(x, y, z, ry); W.box(w, 0.04, d, 0, 0.3, 0, PC.wood); for (const s of [-1, 1]) for (const t of [-1, 1]) W.box(0.05, 0.28, 0.05, s * (w / 2 - 0.05), 0.14, t * (d / 2 - 0.05), PC.woodDk); W.box(w - 0.1, 0.03, 0.03, 0, 0.27, d / 2 - 0.05, PC.woodDk); W.pop(); }
function claypot(x, y, z, s = 1, col = 0x9a5a34) { W.push(x, y, z); W.sphere(0.36 * s, 0.4 * s, 0.36 * s, 0, 0.2 * s, 0, col, { seg: 10 }); W.cyl(0.08 * s, 0.11 * s, 0.1 * s, 0, 0.42 * s, 0, col, { seg: 10 }); W.torus(0.09 * s, 0.015 * s, 0, 0.47 * s, 0, col, { rx: Math.PI / 2, seg: 10 }); W.pop(); }
function basket(x, y, z, fill = null) { W.cyl(0.22, 0.17, 0.24, x, y + 0.12, z, 0xb08a50, { seg: 12 }); for (let i = 0; i < 3; i++) W.torus(0.2 - i * 0.015, 0.008, x, y + 0.06 + i * 0.07, z, 0x8a6a3a, { rx: Math.PI / 2, seg: 12 }); if (fill) for (let i = 0; i < 8; i++) W.sphere(0.08, 0.075, 0.08, x + mr(-0.12, 0.12), y + 0.25, z + mr(-0.12, 0.12), fill, { seg: 6, hseg: 4 }); }
function lantern(x, y, z, on = true) {
  W.rod([x, y + 0.5, z], [x, y + 0.26, z], 0.004, PC.black);
  W.box(0.12, 0.02, 0.12, x, y + 0.25, z, PC.black, { layer: 'metal' });
  W.box(0.14, 0.02, 0.14, x, y + 0.02, z, PC.black, { layer: 'metal' });
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.rod([x + s * 0.06, y + 0.03, z + t * 0.06], [x + s * 0.05, y + 0.24, z + t * 0.05], 0.004, PC.black);
  W.cyl(0.05, 0.05, 0.18, x, y + 0.13, z, on ? GLOW.amber : PC.glass, { seg: 8, layer: on ? 'glow' : 'glass' });
  if (on) W.lamp(x, y + 0.13, z, 0xffb060, 2.5, 6, { flicker: 0.15, halo: 0.6 });
}
function tv(x, y, z, ry = 0) { W.push(x, y, z, ry); W.box(0.9, 0.55, 0.06, 0, 0.35, 0, PC.black); W.box(0.85, 0.5, 0.004, 0, 0.35, 0.031, 0x2a3850, { layer: 'glow' }); W.box(0.3, 0.05, 0.2, 0, 0.025, 0, PC.black); W.box(0.06, 0.08, 0.04, 0, 0.07, -0.02, PC.black); W.pop(); }
function sofa(x, y, z, ry = 0, col = 0x6a5a48, w = 2.0) {
  W.push(x, y, z, ry);
  W.box(w, 0.42, 0.85, 0, 0.21, 0, col);
  W.box(w, 0.5, 0.2, 0, 0.62, -0.33, col);
  for (const s of [-1, 1]) W.box(0.2, 0.6, 0.85, s * (w / 2 - 0.1), 0.3, 0, col);
  for (let i = 0; i < 3; i++) W.box(w / 3 - 0.1, 0.12, 0.62, -w / 3 + i * w / 3, 0.47, 0.08, col, { jit: 0.08 });
  W.box(0.4, 0.3, 0.12, -w / 2 + 0.45, 0.62, -0.18, PC.redLt, { rx: -0.3, rz: 0.2 });
  W.pop();
  W.solid(w, 0.8, 0.9, x, y + 0.4, z, 'cloth', { ry });
}
function wardrobe(x, y, z, ry = 0, col = PC.wood) { W.push(x, y, z, ry); W.box(1.0, 1.9, 0.55, 0, 0.95, 0, col); for (const s of [-1, 1]) { W.box(0.46, 1.7, 0.02, s * 0.245, 1.0, 0.28, col); W.box(0.4, 1.6, 0.01, s * 0.245, 1.0, 0.292, PC.woodDk); W.cyl(0.015, 0.015, 0.04, s * 0.04, 1.0, 0.3, PC.brass, { rx: Math.PI / 2, layer: 'metal' }); } W.box(1.04, 0.06, 0.58, 0, 1.92, 0, PC.woodDk); W.pop(); W.solid(1.0, 1.95, 0.56, x, y + 0.97, z, 'wood', { ry }); }
function bed(x, y, z, ry = 0, blanket = 0x8a3a3a) { W.push(x, y, z, ry); W.box(1.4, 0.3, 2.0, 0, 0.15, 0, PC.wood); W.box(1.35, 0.18, 1.95, 0, 0.39, 0, PC.offwhite); W.box(1.4, 0.06, 1.3, 0, 0.5, 0.3, blanket, { jit: 0.08 }); for (const s of [-1, 1]) W.box(0.55, 0.12, 0.35, s * 0.33, 0.53, -0.75, PC.white); W.box(1.45, 0.9, 0.08, 0, 0.45, -1.0, PC.woodDk); W.pop(); W.solid(1.4, 0.55, 2.0, x, y + 0.27, z, 'wood', { ry }); }

// ---------------- outdoor kit ----------------
function generator(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(2.2, 0.15, 1.1, 0, 0.075, 0, PC.metalDk, { layer: 'metal' });
  W.box(2.0, 1.3, 1.0, 0, 0.8, 0, PC.olive, { layer: 'metal' });
  for (let i = 0; i < 10; i++) W.box(0.02, 0.6, 0.006, -0.9 + i * 0.08, 0.95, 0.503, PC.oliveDk, { ao: false }); // louvres
  W.box(0.5, 0.4, 0.01, 0.6, 0.9, 0.506, PC.charcoal); for (let i = 0; i < 3; i++) W.box(0.06, 0.05, 0.01, 0.45 + i * 0.12, 0.98, 0.512, i === 0 ? GLOW.green : GLOW.amber, { layer: 'glow' });
  W.cyl(0.07, 0.07, 0.6, -0.7, 1.75, -0.2, PC.metalDk, { seg: 8, layer: 'metal' }); W.cyl(0.09, 0.07, 0.08, -0.7, 2.08, -0.2, PC.black, { seg: 8 });  // exhaust
  W.box(0.4, 0.04, 0.9, 0.7, 1.47, 0, PC.oliveDk, { layer: 'metal' });
  W.box(0.15, 0.08, 0.004, -0.5, 0.75, 0.506, PC.yellow, { ao: false });
  W.cable([1.0, 0.4, 0.3], [2.5, 0.02, 1.2], 0.1, 0.02, PC.black, 6);
  W.pop();
  W.solid(2.2, 1.5, 1.1, x, y + 0.75, z, 'metal', { ry });
}
function acUnit(x, y, z, ry = 0) {
  W.push(x, y, z, ry);
  W.box(0.8, 0.6, 0.5, 0, 0.3, 0, PC.offwhite, { layer: 'metal' });
  W.cyl(0.24, 0.24, 0.01, 0, 0.32, 0.252, PC.charcoal, { rx: Math.PI / 2, seg: 14 });
  for (let i = 0; i < 4; i++) W.box(0.46, 0.01, 0.01, 0, 0.32, 0.258, PC.alu, { rz: i * 0.785, layer: 'metal' });
  for (let i = 0; i < 8; i++) W.box(0.008, 0.5, 0.004, 0.33, 0.3, 0.253 - i * 0.0, PC.alu, { ao: false });
  W.rod([-0.3, 0.1, -0.25], [-0.3, 0.1, -0.6], 0.012, PC.alu);
  W.pop();
}
function floodPole(x, y, z, ry = 0, h = 8, lamps = 2, col = 0xfff0d8, power = 30) {
  W.push(x, y, z, ry);
  W.box(0.6, 0.3, 0.6, 0, 0.15, 0, PC.concrete);
  W.cyl(0.09, 0.12, h, 0, h / 2, 0, PC.metal, { seg: 8, layer: 'metal' });
  W.box(lamps * 0.55, 0.08, 0.08, 0, h, 0.1, PC.metalDk, { layer: 'metal' });
  for (let i = 0; i < lamps; i++) {
    const lx = (i - (lamps - 1) / 2) * 0.55;
    W.box(0.42, 0.32, 0.18, lx, h - 0.15, 0.3, PC.metalDk, { rx: 0.5, layer: 'metal' });
    W.box(0.36, 0.26, 0.02, lx, h - 0.2, 0.39, GLOW.cool, { rx: 0.5, layer: 'glow' });
  }
  W.box(0.3, 0.4, 0.2, 0, 1.4, 0.13, PC.metalDk, { layer: 'metal' });             // junction box
  W.rod([0, 1.4, 0.14], [0, 0.1, 0.4], 0.02, PC.black);
  W.lamp(0, h - 0.6, 1.2, col, power, 30, { halo: 1.2 });
  W.pop();
  W.solid(0.3, h, 0.3, x, y + h / 2, z, 'metal');
}
function streetLight(x, y, z, ry = 0, h = 6.5) {
  W.push(x, y, z, ry);
  W.cyl(0.07, 0.1, h, 0, h / 2, 0, PC.metal, { seg: 8, layer: 'metal' });
  W.rod([0, h - 0.1, 0], [0, h + 0.2, 1.2], 0.04, PC.metal, { layer: 'metal' });
  W.box(0.3, 0.1, 0.55, 0, h + 0.2, 1.35, PC.metalDk, { layer: 'metal' });
  W.box(0.24, 0.02, 0.45, 0, h + 0.14, 1.35, GLOW.amber, { layer: 'glow' });
  W.lamp(0, h - 0.4, 1.35, 0xffb870, 18, 22, { halo: 1.1 });
  W.pop();
  W.solid(0.2, h, 0.2, x, y + h / 2, z, 'metal');
}
function powerPole(x, y, z, ry = 0, h = 9) {
  W.push(x, y, z, ry);
  W.cyl(0.11, 0.15, h, 0, h / 2, 0, PC.woodDk, { seg: 7 });
  W.box(2.2, 0.12, 0.12, 0, h - 0.6, 0, PC.woodDk);
  for (const s of [-1, -0.35, 0.35, 1]) { W.cyl(0.04, 0.05, 0.16, s * 1.0, h - 0.45, 0, 0x7a8a6a, { seg: 6, layer: 'glass' }); }
  W.rod([-0.8, h - 0.6, 0], [0, h - 1.4, 0], 0.025, PC.woodDk); W.rod([0.8, h - 0.6, 0], [0, h - 1.4, 0], 0.025, PC.woodDk);
  W.cyl(0.25, 0.25, 0.6, 0.25, h - 2.2, 0, PC.metal, { seg: 10, layer: 'metal' }); // transformer
  W.pop();
  W.solid(0.3, h, 0.3, x, y + h / 2, z, 'wood');
}
function rock(x, y, z, s = 1, col = 0x6b6050) {
  W.push(x, y, z, mr(0, 6));
  for (let i = 0; i < 3; i++) W.sphere(s * mr(0.7, 1.2), s * mr(0.45, 0.8), s * mr(0.6, 1.1), mr(-0.3, 0.3) * s, s * mr(0.1, 0.35), mr(-0.3, 0.3) * s, col, { seg: 5, hseg: 4, ry: mr(0, 6), rx: mr(-0.3, 0.3), jit: 0.12 });
  W.pop();
  if (s > 0.6) W.solid(s * 1.3, s * 0.8, s * 1.3, x, y + s * 0.4, z, 'concrete');
}
function bush(x, y, z, s = 1, col = PC.leaf) {
  W.push(x, y, z, mr(0, 6));
  for (let i = 0; i < 5; i++) W.sphere(s * mr(0.5, 0.9), s * mr(0.35, 0.6), s * mr(0.5, 0.9), mr(-0.4, 0.4) * s, s * mr(0.15, 0.4), mr(-0.4, 0.4) * s, mpick([col, PC.leafLt, PC.dry]), { seg: 6, hseg: 4, jit: 0.15, ao: false });
  W.pop();
}
function palm(x, y, z, h = 7) {
  W.push(x, y, z, mr(0, 6));
  let px = 0, py = 0, lean = mr(0.04, 0.12);
  for (let i = 0; i < 5; i++) { const nx = px + lean * (h / 5), ny = py + h / 5; W.rod([px, py, 0], [nx, ny, 0], 0.16 - i * 0.012, i % 2 ? 0x6b5a40 : 0x5a4a34, { seg: 6 }); px = nx; py = ny; }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, L = mr(2.2, 3.0);
    W.push(px, py, 0, a);
    for (let k = 0; k < 3; k++) { const t0 = k / 3, t1 = (k + 1) / 3; W.box(0.85 - k * 0.2, 0.02, L / 3, 0, 0.3 * Math.sin(t0 * 2.4) - t0 * t0 * 1.2, L * (t0 + t1) / 2, mpick([0x6a8a3a, 0x5a7a34, 0x7a9440]), { layer: 'cloth', rx: -0.4 + t0 * 1.3, ao: false, t: TX.leaf }); }
    W.pop();
  }
  for (let i = 0; i < 2; i++) W.sphere(0.2, 0.3, 0.2, px + mr(-0.2, 0.2), py - 0.25, mr(-0.2, 0.2), 0x7a4a2a, { seg: 5, hseg: 3, lod: 2 }); // date clusters
  W.pop();
  W.solid(0.4, h, 0.4, x, y + h / 2, z, 'wood');
}
function tire(x, y, z, ry = 0, flat = true) { W.push(x, y, z, ry, flat ? Math.PI / 2 : 0); W.torus(0.32, 0.2, 0, flat ? 0 : 0.42, 0, PC.rubber, { seg: 12 }); W.cyl(0.2, 0.2, 0.18, 0, flat ? 0 : 0.42, 0, PC.metalDk, { rx: Math.PI / 2, seg: 10 }); W.pop(); }
function trashPile(x, y, z, n = 10) { for (let i = 0; i < n; i++) { const k = mrand(); const px = x + mr(-0.8, 0.8), pz = z + mr(-0.8, 0.8); if (k < 0.3) can(px, y, pz, mpick([PC.red, PC.green, PC.blueLt]), mr(0, 6)); else if (k < 0.55) W.box(mr(0.15, 0.35), 0.01, mr(0.15, 0.3), px, y + 0.005, pz, mpick([PC.paper, PC.offwhite, PC.tan]), { ry: mr(0, 6) }); else if (k < 0.75) bottle(px, y, pz, mpick([0x7fa6b8, 0x5a8a4a]), 0.24, mr(0, 6)); else W.sphere(0.3, 0.2, 0.3, px, y + 0.08, pz, mpick([PC.black, 0x2a3a2a, 0x3a3a4a]), { seg: 6, hseg: 4 }); } }
function signPost(x, y, z, ry = 0, w = 1.2, h = 0.7, bg = PC.white, fg = PC.redLt, post = 2.0) {
  W.push(x, y, z, ry);
  for (const s of [-1, 1]) W.box(0.06, post + h, 0.06, s * (w / 2 - 0.1), (post + h) / 2, -0.03, PC.metal, { layer: 'metal' });
  W.box(w, h, 0.03, 0, post + h / 2, 0, bg);
  W.box(w - 0.08, h - 0.08, 0.004, 0, post + h / 2, 0.017, bg, { ao: false });
  W.box(w * 0.85, h * 0.18, 0.004, 0, post + h * 0.68, 0.02, fg, { ao: false });
  for (let i = 0; i < 3; i++) W.box(w * mr(0.4, 0.75), h * 0.07, 0.004, 0, post + h * (0.42 - i * 0.12), 0.02, PC.black, { ao: false });
  W.pop();
}
function concreteBarrier(x, y, z, ry = 0, col = PC.concreteLt, stripes = false) {
  W.push(x, y, z, ry);
  W.box(0.6, 0.3, 3.0, 0, 0.15, 0, col);
  W.wedge(0.15, 0.55, 3.0, -0.225, 0.575, 0, col, {});
  W.wedge(0.15, 0.55, 3.0, 0.225, 0.575, 0, col, { ry: Math.PI });
  W.box(0.3, 0.55, 3.0, 0, 0.575, 0, col);
  if (stripes) for (let i = 0; i < 4; i++) W.box(0.31, 0.12, 0.4, 0, 0.7, -1.2 + i * 0.8, i % 2 ? PC.redLt : PC.white, { ao: false });
  for (const s of [-1, 1]) W.box(0.3, 0.08, 0.2, 0, 0.04, s * 1.0, PC.concreteDk);   // forklift slots
  W.pop();
  W.solid(0.6, 0.85, 3.0, x, y + 0.425, z, 'concrete', { ry });
}
function tWall(x, y, z, ry = 0, col = 0x9a9488) {
  W.push(x, y, z, ry);
  W.box(1.5, 0.35, 1.2, 0, 0.175, 0, col);
  W.box(1.5, 3.6, 0.3, 0, 2.15, 0, col);
  W.wedge(1.5, 0.45, 0.4, 0, 0.575, 0.35, col, { ry: Math.PI / 2, rx: 0 });
  W.wedge(1.5, 0.45, 0.4, 0, 0.575, -0.35, col, { ry: -Math.PI / 2 });
  for (const s of [-0.4, 0.4]) W.torus(0.06, 0.02, s, 3.97, 0, PC.rust, { arc: Math.PI, seg: 6 });
  W.box(0.9, 0.18, 0.004, 0.1, 2.5, 0.152, 0x2a2a2a, { ao: false });                           // stencil numbers
  for (let i = 0; i < 3; i++) W.box(0.004, mr(0.2, 0.6), 0.004, mr(-0.6, 0.6), mr(0.8, 3), 0.152, 0x5a564e, { rz: mr(-0.5, 0.5), ao: false }); // cracks
  W.pop();
  W.solid(1.5, 3.95, 0.4, x, y + 1.97, z, 'concrete', { ry });
}
// HESCO bastion unit (1.07 m cube default): fabric-lined welded mesh filled with earth
function hesco(x, y, z, ry = 0, s = 1.07, h = 1.07, col = 0x9a8a62) {
  W.push(x, y, z, ry);
  W.box(s, h, s, 0, h / 2, 0, col, { jit: 0.08 });
  W.box(s * 0.94, 0.06, s * 0.94, 0, h + 0.01, 0, PC.sand, { jit: 0.1 });
  const wire = 0x4a4a46;
  for (const f of [-1, 1]) {
    for (let i = 1; i < 4; i++) { W.box(0.012, h, 0.012, -s / 2 + (i * s) / 4, h / 2, f * (s / 2 + 0.006), wire, { ao: false }); W.box(0.012, h, 0.012, f * (s / 2 + 0.006), h / 2, -s / 2 + (i * s) / 4, wire, { ao: false }); }
    for (let j = 1; j < 4; j++) { W.box(s, 0.012, 0.012, 0, (j * h) / 4, f * (s / 2 + 0.006), wire, { ao: false }); W.box(0.012, 0.012, s, f * (s / 2 + 0.006), (j * h) / 4, 0, wire, { ao: false }); }
  }
  W.pop();
}
function hescoLine(x0, z0, x1, z1, rows = 2, gaps = []) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.07), ang = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, px = lerp(x0, x1, t), pz = lerp(z0, z1, t);
    if (gaps.some(([a, b]) => t * L > a && t * L < b)) continue;
    for (let r = 0; r < rows; r++) hesco(px, r * 1.07, pz, ang + mr(-0.02, 0.02), 1.07, 1.07, mpick([0x9a8a62, 0x8f8058, 0xa39168]));
  }
  // colliders per continuous run
  let start = 0;
  const cuts = [...gaps.map(([a, b]) => [a / L, b / L]), [1, 1]].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of cuts) {
    if (a > start + 1e-3) { const t0 = start, t1 = a, cx = lerp(x0, x1, (t0 + t1) / 2), cz = lerp(z0, z1, (t0 + t1) / 2); W.solid(1.1, rows * 1.07, (t1 - t0) * L, cx, rows * 0.535, cz, 'sand', { ry: ang }); }
    start = Math.max(start, b);
  }
}
function concertina(x0, z0, x1, z1, y = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.35);
  for (let i = 0; i < n; i++) { const t = i / n; W.torus(0.45, 0.012, lerp(x0, x1, t), y + 0.45, lerp(z0, z1, t), 0x8a8a86, { ry: Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2 + 0.25, seg: 10, layer: 'metal', ao: false }); }
}
function camoNet(x, y, z, w, d, h = 3, ry = 0) {
  W.push(x, y, z, ry);
  for (const s of [-1, 1]) for (const t of [-1, 1]) W.cyl(0.04, 0.04, h, s * w / 2, h / 2, t * d / 2, PC.alu, { seg: 6, layer: 'metal' });
  const nx = Math.ceil(w / 1.2), nz = Math.ceil(d / 1.2);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const px = -w / 2 + (i + 0.5) * (w / nx), pz = -d / 2 + (j + 0.5) * (d / nz);
    const sag = Math.sin(((i + 0.5) / nx) * Math.PI) * Math.sin(((j + 0.5) / nz) * Math.PI) * 0.35;
    W.box(w / nx * 1.15, 0.03, d / nz * 1.15, px, h - sag, pz, mpick([PC.olive, PC.oliveDk, PC.coyote, 0x5a5236]), { layer: 'cloth', rx: mr(-0.15, 0.15), rz: mr(-0.15, 0.15), ao: false });
    if (mrand() < 0.4) W.box(0.25, 0.03, 0.2, px + mr(-0.4, 0.4), h - sag - 0.08, pz + mr(-0.4, 0.4), mpick([PC.olive, PC.coyote]), { layer: 'cloth', ry: mr(0, 3), rx: 0.8, ao: false });
  }
  W.pop();
}
