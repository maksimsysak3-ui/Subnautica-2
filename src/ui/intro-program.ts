/**
 * The studio ident: a raymarched scene in WebGL2, self-contained.
 *
 * Everything the ident draws is in `introProgram`, and it references nothing
 * outside itself -- no imports, no module state -- because its source is
 * turned into a Worker with `Function.prototype.toString`. In a Worker it
 * keeps playing at full rate while the main thread is busy building the city;
 * where a Worker cannot take the canvas, the same function runs on the main
 * thread instead.
 *
 * The scene: nine stones of an arch hang in the dark, lit from behind. They
 * swing into place in pairs from the springing up, the keystone lowers from
 * above and locks, and the light runs down the joints to the ground. The arch
 * is the studio's mark, and the wordmark rises under it.
 *
 * Messages in:  init {canvas, width, height, timeline, freeze?, reduced?}
 *               resize {width, height}, text {bitmap}, skip
 * Messages out: done
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function introProgram(scope: any): void {
  const SCENE_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uCam;
uniform vec3 uU;
uniform vec3 uV;
uniform vec3 uW;
uniform float uTan;
uniform vec3 uOff[9];
uniform mat3 uInv[9];
uniform vec3 uPiv[9];
uniform vec4 uAng[9];
uniform vec4 uRad[9];
uniform float uLock;
uniform float uGlow;
const float HS = 2.4;
const vec3 LPOS = vec3(0.0, 3.2, -7.5);
const vec3 LCOL = vec3(1.0, 0.80, 0.56);
const float PI = 3.14159265;

float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }

float sdVoussoir(vec3 p, int i) {
  vec2 q = p.xy - vec2(0.0, HS);
  float r = length(q);
  vec4 a = uAng[i]; vec4 rd = uRad[i];
  float g = 0.047;
  float c0 = a.x * q.y - a.y * q.x;
  float c1 = a.z * q.y - a.w * q.x;
  float d2 = max(abs(r - rd.x) - rd.y, max(g - c0, c1 + g));
  vec2 w = vec2(d2, abs(p.z) - rd.z);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - 0.035;
}

vec3 local(vec3 p, int i) { return uInv[i] * (p - uPiv[i] - uOff[i]) + uPiv[i]; }

// x: distance, y: material (0 floor, 1 plinth/pier, 2 voussoir, 3 keystone), z: piece
vec3 map(vec3 p) {
  vec3 res = vec3(p.y, 0.0, -1.0);
  float st = sdBox(p - vec3(0.0, 0.125, 0.0), vec3(3.9, 0.125, 1.6)) - 0.02;
  st = min(st, sdBox(p - vec3(0.0, 0.375, 0.0), vec3(3.3, 0.125, 1.15)) - 0.02);
  for (int s = 0; s < 2; s++) {
    vec3 q = p - vec3(s == 0 ? -1.95 : 1.95, 0.0, 0.0);
    st = min(st, sdBox(q - vec3(0.0, 1.45, 0.0), vec3(0.4, 0.95, 0.42)) - 0.02);
    st = min(st, sdBox(q - vec3(0.0, 2.33, 0.0), vec3(0.5, 0.075, 0.5)) - 0.015);
    st = min(st, sdBox(q - vec3(0.0, 0.62, 0.0), vec3(0.52, 0.12, 0.52)) - 0.015);
  }
  if (st < res.x) res = vec3(st, 1.0, -1.0);
  for (int i = 0; i < 9; i++) {
    float dv = sdVoussoir(local(p, i), i);
    if (dv < res.x) res = vec3(dv, i == 4 ? 3.0 : 2.0, float(i));
  }
  return res;
}

vec3 normal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  float e = 0.0012;
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x
                 + k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

vec3 march(vec3 ro, vec3 rd, float maxT, int steps) {
  float t = 0.02;
  for (int i = 0; i < 160; i++) {
    if (i >= steps) break;
    vec3 h = map(ro + rd * t);
    if (h.x < 0.0008 * t) return vec3(t, h.y, h.z);
    t += h.x * 0.9;
    if (t > maxT) break;
  }
  return vec3(-1.0, -1.0, -1.0);
}

float softShadow(vec3 ro, vec3 rd, float maxT) {
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 28; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.03, 0.5);
    if (res < 0.01 || t > maxT) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 sky(vec3 rd) {
  vec3 ld = normalize(LPOS - uCam);
  float c = max(dot(rd, ld), 0.0);
  float glow = pow(c, 2400.0) * 40.0 + pow(c, 160.0) * 1.1 + pow(c, 18.0) * 0.05;
  vec3 base = vec3(0.004, 0.005, 0.008) + vec3(0.012, 0.010, 0.008) * (1.0 - abs(rd.y));
  return base + LCOL * glow * uGlow;
}

// The light that runs down the joints when the keystone locks, 0..1.
float jointWave(float s) {
  if (uLock < 0.0) return 0.0;
  float front = uLock * 1.9;
  float head = exp(-pow((s - front) * 5.0, 2.0));
  float trail = step(s, front) * (0.35 + 0.65 * exp(-uLock * 0.9));
  return head * 2.5 + trail * 0.6;
}

vec3 stoneAlbedo(vec3 lp, float mat) {
  float n = fbm(lp * 3.1);
  float fine = noise(lp * 23.0);
  vec3 base = mat > 2.5 ? vec3(0.12, 0.115, 0.12) : vec3(0.50, 0.42, 0.33);
  vec3 col = base * (0.72 + 0.5 * n) * (0.9 + 0.2 * fine);
  // Weathering: darker toward the bottom of each stone.
  return col;
}

vec3 shadeHit(vec3 p, vec3 rd, vec3 h, bool cheap, out float wet) {
  float mat = h.y;
  int piece = int(h.z + 0.5);
  vec3 n = normal(p);
  vec3 lp = p;
  if (mat > 1.5) lp = local(p, piece);
  wet = 0.0;
  vec3 alb;
  float emit = 0.0;
  if (mat < 0.5) {
    // Wet slate slabs, a metre and a quarter.
    vec2 cell = floor(p.xz / 1.25);
    vec2 f = fract(p.xz / 1.25);
    float seam = smoothstep(0.0, 0.02, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float v = hash3(vec3(cell, 3.0));
    alb = vec3(0.028, 0.030, 0.034) * (0.7 + 0.6 * v) * (0.5 + 0.5 * seam);
    wet = mix(0.15, 0.85, seam) * (0.6 + 0.4 * noise(p * 1.7));
    // The dust thrown out by the keystone, rolling across the floor.
    if (uLock > 0.0) {
      float r = length(p.xz);
      float ring = exp(-pow((r - uLock * 3.4 - 0.6) * 2.2, 2.0)) * exp(-uLock * 1.1);
      emit += ring * 0.35;
    }
  } else {
    alb = stoneAlbedo(lp, mat);
    if (mat < 1.5) {
      // Coursed masonry on the piers and plinths.
      float course = fract((p.y - 0.5) / 0.475);
      float bed = smoothstep(0.0, 0.035, min(course, 1.0 - course));
      float head = fract((p.x + p.z + floor((p.y - 0.5) / 0.475) * 0.37) / 0.62);
      bed *= smoothstep(0.0, 0.03, min(head, 1.0 - head)) * 0.5 + 0.5;
      alb *= 0.55 + 0.45 * bed;
    }
    if (!cheap) {
      // Tooled surface: a bump from two scales of noise.
      vec3 bp = lp * 16.0;
      float b0 = noise(bp);
      vec3 grad = vec3(noise(bp + vec3(0.25, 0, 0)) - b0, noise(bp + vec3(0, 0.25, 0)) - b0, noise(bp + vec3(0, 0, 0.25)) - b0);
      n = normalize(n - grad * 0.28);
    }
    if (mat > 1.5) {
      // Distance to the nearest joint, for the light that runs down them.
      vec2 q = lp.xy - vec2(0.0, HS);
      float ang = atan(q.y, q.x);
      float s = abs(ang - 0.5 * PI);
      vec4 a = uAng[piece];
      float c0 = a.x * q.y - a.y * q.x;
      float c1 = a.z * q.y - a.w * q.x;
      float dj = min(abs(c0), abs(c1));
      emit += exp(-dj * 26.0) * jointWave(s) * 1.6;
      if (mat > 2.5 && uLock > 0.0) {
        // The keystone's gold inlay: a thin line inset from its face edges.
        float r = length(q);
        float inset = min(min(abs(c0), abs(c1)), min(abs(r - (uRad[4].x - uRad[4].y)), abs(r - (uRad[4].x + uRad[4].y))));
        float line = exp(-pow((inset - 0.11) * 60.0, 2.0)) * step(0.0, lp.z - uRad[4].z + 0.06);
        emit += line * (1.4 + 3.0 * exp(-uLock * 2.0)) * smoothstep(0.0, 0.25, uLock);
      }
    } else {
      // The piers carry the wave on down to the ground.
      float s = 0.5 * PI + (HS - p.y) / 2.0;
      float edge = min(abs(abs(p.x) - 1.55), abs(abs(p.x) - 2.35));
      emit += exp(-edge * 30.0) * jointWave(s) * step(0.5, p.y) * step(p.y, HS) * 1.2;
    }
  }

  // Key light from behind the arch.
  vec3 toL = LPOS - p;
  float dl = length(toL);
  vec3 l = toL / dl;
  float att = 60.0 / (dl * dl + 8.0);
  float sh = cheap ? 1.0 : softShadow(p + n * 0.01, l, dl);
  float dif = max(dot(n, l), 0.0);
  vec3 col = alb * LCOL * dif * att * sh * uGlow * 2.2;
  // Rim: the edge of every stone catches the light it stands against.
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0) * max(dot(-rd, l) * 0.5 + 0.5, 0.0);
  col += LCOL * rim * 0.9 * uGlow * (mat < 0.5 ? 0.0 : 1.0) * sh;
  // Cool fill from the front left, so the faces are not black.
  vec3 fl = normalize(vec3(-0.55, 0.65, 0.85));
  col += alb * vec3(0.16, 0.18, 0.24) * (max(dot(n, fl), 0.0) * 0.42 + 0.04);
  // Warm bounce off the floor.
  col += alb * LCOL * 0.05 * max(-n.y, 0.0) * uGlow;
  col += vec3(1.0, 0.72, 0.38) * emit;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float asp = uRes.x / uRes.y;
  vec3 rd = normalize(uW + uU * uv.x * uTan * asp + uV * uv.y * uTan);
  vec3 ro = uCam;
  vec3 h = march(ro, rd, 40.0, 150);
  vec3 col;
  float mask = 0.0;
  float tHit = 40.0;
  if (h.x < 0.0) {
    col = sky(rd);
    vec3 ld = normalize(LPOS - uCam);
    mask = pow(max(dot(rd, ld), 0.0), 220.0) * min(uGlow, 1.4) * 0.7;
  } else {
    tHit = h.x;
    vec3 p = ro + rd * h.x;
    float wet;
    col = shadeHit(p, rd, h, false, wet);
    if (h.y < 0.5) {
      // Reflection in the wet floor, roughened by the slab grain.
      vec3 n = normalize(vec3((noise(p * 6.0) - 0.5) * 0.06, 1.0, (noise(p * 6.0 + 7.0) - 0.5) * 0.06));
      vec3 rr = reflect(rd, n);
      vec3 h2 = march(p + n * 0.02, rr, 25.0, 70);
      vec3 rc;
      if (h2.x < 0.0) rc = sky(rr);
      else { float w2; rc = shadeHit(p + n * 0.02 + rr * h2.x, rr, h2, true, w2); }
      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
      col += rc * mix(0.08, 0.9, fres) * wet;
    }
  }
  // Air: a little haze, and the glow of the light scattered toward the eye.
  vec3 ld = normalize(LPOS - uCam);
  float fog = 1.0 - exp(-tHit * 0.025);
  col = mix(col, vec3(0.006, 0.007, 0.010), fog * 0.6);
  col += LCOL * pow(max(dot(rd, ld), 0.0), 24.0) * 0.05 * (1.0 - exp(-tHit * 0.09)) * uGlow;
  frag = vec4(col, mask);
}`;

  const POST_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 uRes;
uniform sampler2D uScene;
uniform sampler2D uText;
uniform vec2 uLight;
uniform float uT;
uniform float uFade;
uniform float uBars;
uniform float uTextA;
uniform float uShine;
uniform float uFlash;
uniform float uGlow;
uniform float uHasText;
uniform vec3 uCam;
uniform vec3 uU;
uniform vec3 uV;
uniform vec3 uW;
uniform float uTan;

float h1(float n) { return fract(sin(n) * 43758.5453); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  // A touch of chromatic spread toward the corners, as a lens does.
  vec2 cc = uv - 0.5;
  float ca = dot(cc, cc) * 0.006;
  vec3 col;
  col.r = texture(uScene, uv + cc * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - cc * ca).b;

  // Bloom from the scene's own mips.
  vec3 b = max(textureLod(uScene, uv, 2.0).rgb - 0.7, 0.0) * 0.4
         + max(textureLod(uScene, uv, 3.0).rgb - 0.55, 0.0) * 0.45
         + max(textureLod(uScene, uv, 4.0).rgb - 0.45, 0.0) * 0.4;
  // The light itself: a round hot core and a soft halo, drawn rather than
  // bloomed, so it stays round whatever the target resolution.
  float lr = length((uv - uLight) * vec2(uRes.x / uRes.y, 1.0));
  float seen = textureLod(uScene, uLight, 3.0).a;
  b += vec3(1.0, 0.86, 0.66) * (exp(-lr * lr * 900.0) * 1.4 + exp(-lr * 9.0) * 0.05) * clamp(seen * 3.0, 0.0, 1.0) * uGlow;
  col += b;

  // Shafts of light through the arch: the light's own mask, smeared toward it.
  vec2 dir = uv - uLight;
  vec2 s = uv;
  float decay = 1.0, acc = 0.0;
  for (int i = 0; i < 56; i++) {
    s -= dir * (0.96 / 56.0);
    acc += textureLod(uScene, s, 1.0).a * decay;
    decay *= 0.962;
  }
  col += vec3(1.0, 0.78, 0.52) * acc / 56.0 * 0.85;

  // Dust in the air, catching the light where the beam runs.
  float asp = uRes.x / uRes.y;
  for (int i = 0; i < 70; i++) {
    float fi = float(i);
    vec3 p = vec3(h1(fi * 1.3) * 7.0 - 3.5, mod(h1(fi * 2.1) * 5.5 + uT * (0.05 + h1(fi) * 0.06), 5.5) + 0.3,
                  h1(fi * 3.7) * 7.0 - 3.0);
    p.x += sin(uT * 0.3 + fi) * 0.25;
    p.z += cos(uT * 0.23 + fi * 1.7) * 0.25;
    vec3 d = p - uCam;
    float z = dot(d, uW);
    if (z < 0.3) continue;
    vec2 sp = vec2(dot(d, uU) / (z * uTan * asp), dot(d, uV) / (z * uTan)) * 0.5 + 0.5;
    float px = length((uv - sp) * vec2(asp, 1.0)) * uRes.y;
    float size = clamp(3.2 / z, 0.6, 3.5);
    float beam = 0.15 + 1.8 * exp(-length(p.xy - vec2(0.0, 2.8)) * 0.9) * smoothstep(-4.0, 0.0, p.z);
    col += vec3(1.0, 0.85, 0.65) * exp(-px * px / (size * size)) * beam * uGlow * 0.35 * (0.5 + 0.5 * sin(uT * 1.7 + fi * 3.1));
  }

  col += vec3(1.0, 0.86, 0.62) * uFlash * 0.35;
  col = aces(col * 1.05);
  col = pow(col, vec3(1.0 / 2.2));

  // The wordmark, over a floor darkened to take it.
  col *= 1.0 - smoothstep(0.32, 0.0, uv.y) * 0.75 * clamp(uTextA * 2.0, 0.0, 1.0);
  if (uHasText > 0.5 && uTextA > 0.0) {
    vec2 size = vec2(0.50, 0.50 * asp / 4.0);
    vec2 center = vec2(0.5, 0.125);
    vec2 tuv = (uv - center) / size + 0.5;
    float reveal = smoothstep(tuv.x - 0.12, tuv.x + 0.02, uTextA * 1.15);
    tuv.y -= (1.0 - reveal) * 0.1;
    if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
      float a = texture(uText, vec2(tuv.x, 1.0 - tuv.y)).a * reveal;
      vec3 tc = mix(vec3(0.80, 0.66, 0.42), vec3(0.97, 0.94, 0.88), smoothstep(0.2, 0.75, tuv.y));
      float band = exp(-pow((tuv.x - tuv.y * 0.25 - (uShine * 1.5 - 0.25)) * 9.0, 2.0));
      tc += band * vec3(0.6, 0.5, 0.35);
      col = mix(col, tc, a);
    }
  }

  // Vignette, grain, letterbox, fade.
  col *= 1.0 - dot(cc, cc) * 0.7;
  col += (h1(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uT) - 0.5) * 0.028;
  float bar = uBars * 0.115;
  if (uv.y < bar || uv.y > 1.0 - bar) col = vec3(0.0);
  frag = vec4(max(col, 0.0) * uFade, 1.0);
}`;

  const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  let gl: any = null;
  let canvas: any = null;
  let sceneProg: any = null, postProg: any = null;
  let fbo: any = null, sceneTex: any = null, textTex: any = null;
  let hasText = 0;
  let width = 1, height = 1, scale = 1;
  let start = -1, skipAt = -1;
  let finished = false;
  let freeze = -1;
  let tl: any = null;
  const frameTimes: number[] = [];
  const uni: any = { s: {}, p: {} };

  const raf = (f: (t: number) => void): void => {
    if (typeof scope.requestAnimationFrame === 'function') scope.requestAnimationFrame(f);
    else setTimeout(() => f(performance.now()), 16);
  };

  function compile(src: string, type: number): any {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }
  function program(fs: string): any {
    const p = gl.createProgram();
    gl.attachShader(p, compile(VS, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(fs, gl.FRAGMENT_SHADER));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function loc(p: any, cache: any, name: string): any {
    if (!(name in cache)) cache[name] = gl.getUniformLocation(p, name);
    return cache[name];
  }

  let halfFloat = false;
  function makeTargets(): void {
    const w = Math.max(2, Math.round(width * scale)), h = Math.max(2, Math.round(height * scale));
    if (sceneTex) gl.deleteTexture(sceneTex);
    if (fbo) gl.deleteFramebuffer(fbo);
    sceneTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
    gl.texStorage2D(gl.TEXTURE_2D, levels, halfFloat ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ------------------------------------------------------------ the stones
  const TH = (0.45 * Math.PI) / 4;
  const pieces: any[] = [];
  for (let i = 0; i < 9; i++) {
    let a0: number, a1: number, r0 = 1.55, r1 = 2.35, dz = 0.42;
    if (i < 4) { a0 = i * TH; a1 = a0 + TH; }
    else if (i === 4) { a0 = 0.45 * Math.PI; a1 = 0.55 * Math.PI; r0 = 1.43; r1 = 2.65; dz = 0.47; }
    else { a0 = 0.55 * Math.PI + (i - 5) * TH; a1 = a0 + TH; }
    const rm = (r0 + r1) / 2, hw = (r1 - r0) / 2 - 0.035;
    const am = (a0 + a1) / 2;
    // Where each hangs before it is placed, and how it is turned.
    const seed = (k: number): number => { const s = Math.sin(i * 91.7 + k * 13.1) * 43758.5; return s - Math.floor(s); };
    const side = i < 4 ? 1 : i > 4 ? -1 : 0;
    const float = i === 4 ? [0, 3.4, 0.3] : [side * (1.1 + seed(1) * 1.9), 1.3 + seed(2) * 2.6, -1.4 - seed(3) * 2.8];
    const axis = [seed(4) - 0.5, seed(5) - 0.5, seed(6) - 0.5];
    const al = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    pieces.push({
      piv: [Math.cos(am) * rm, 2.4 + Math.sin(am) * rm, 0],
      ang: [Math.cos(a0), Math.sin(a0), Math.cos(a1), Math.sin(a1)],
      rad: [rm, hw, dz - 0.035, 0],
      float, axis: [axis[0] / al, axis[1] / al, axis[2] / al],
      spin: (i === 4 ? 1.2 : 0.7 + seed(7) * 1.1) * (seed(8) > 0.5 ? 1 : -1),
      bob: seed(9) * 6.28,
    });
  }

  /** Rotation about a unit axis, as a column-major mat3 (the inverse: transposed). */
  function rotInv(ax: number[], a: number): number[] {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    const [x, y, z] = ax;
    // Row-major R, then transposed for the inverse, then written column-major:
    // which is R written row-major.
    return [
      t * x * x + c, t * x * y - s * z, t * x * z + s * y,
      t * x * y + s * z, t * y * y + c, t * y * z - s * x,
      t * x * z - s * y, t * y * z + s * x, t * z * z + c,
    ];
  }

  const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
  const smooth = (a: number, b: number, x: number): number => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };

  // ------------------------------------------------------------ the camera
  const KEYS: Array<[number, number[], number[]]> = [
    [0.0, [2.7, 0.5, 2.3], [1.5, 1.5, 0.0]],
    [0.9, [2.6, 0.55, 2.5], [1.4, 1.6, 0.0]],
    [3.3, [-1.9, 1.3, 5.3], [0.0, 2.4, 0.0]],
    [5.7, [1.0, 3.3, 7.6], [0.0, 4.1, 0.0]],
    [7.7, [0.0, 2.9, 10.2], [0.0, 2.35, 0.0]],
    [12.0, [0.0, 2.85, 9.6], [0.0, 2.35, 0.0]],
  ];
  function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  function camAt(t: number): { pos: number[]; tgt: number[] } {
    let k = 0;
    while (k < KEYS.length - 2 && t > KEYS[k + 1][0]) k++;
    const a = KEYS[Math.max(0, k - 1)], b = KEYS[k], c = KEYS[k + 1], d = KEYS[Math.min(KEYS.length - 1, k + 2)];
    const u0 = clamp01((t - b[0]) / (c[0] - b[0]));
    const u = u0 * u0 * (3 - 2 * u0) * 0.35 + u0 * 0.65;
    const pos = [0, 1, 2].map((j) => cr(a[1][j], b[1][j], c[1][j], d[1][j], u));
    const tgt = [0, 1, 2].map((j) => cr(a[2][j], b[2][j], c[2][j], d[2][j], u));
    return { pos, tgt };
  }
  function basis(pos: number[], tgt: number[]): { u: number[]; v: number[]; w: number[] } {
    const w = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]];
    const wl = Math.hypot(w[0], w[1], w[2]); w[0] /= wl; w[1] /= wl; w[2] /= wl;
    // Right is forward crossed with up.
    let u = [-w[2], 0, w[0]];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = u.map((x) => x / ul);
    const v = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    return { u, v, w };
  }

  // -------------------------------------------------------------- a frame
  function frame(now: number): void {
    if (finished) return;
    if (start < 0) start = now;
    let t = freeze >= 0 ? freeze : (now - start) / 1000;
    if (tl.reduced && freeze < 0) t = Math.max(t, tl.logo);
    const lock = tl.lock;

    // The stones.
    const off = new Float32Array(27), inv = new Float32Array(81), piv = new Float32Array(27);
    const ang = new Float32Array(36), rad = new Float32Array(36);
    pieces.forEach((pc, i) => {
      let e: number;
      if (i === 4) {
        const u = clamp01((t - tl.keyStart) / (lock - tl.keyStart));
        e = Math.pow(u, 2.3);
      } else {
        const pair = i < 4 ? i : 8 - i;
        const s0 = tl.settle[pair], u = clamp01((t - s0) / 1.2);
        e = 1 - Math.pow(1 - u, 4);
      }
      const bob = Math.sin(t * 0.9 + pc.bob) * 0.1 * (1 - e);
      for (let j = 0; j < 3; j++) off[i * 3 + j] = pc.float[j] * (1 - e) + (j === 1 ? bob : 0);
      const a = (pc.spin * 0.5 + Math.sin(t * 0.25 + pc.bob) * 0.35) * (1 - e) + (i === 4 ? (1 - e) * t * 0.12 : 0);
      inv.set(rotInv(pc.axis, a), i * 9);
      piv.set(pc.piv, i * 3);
      ang.set(pc.ang, i * 4);
      rad.set(pc.rad, i * 4);
    });

    // Light: comes up out of the dark, flares on the lock, settles.
    let glow = smooth(0.7, 2.6, t) * 0.55 + smooth(2.6, 6.2, t) * 0.15;
    if (t > lock) glow += 0.8 * Math.exp(-(t - lock) * 3.4) + 0.25 * smooth(lock, lock + 1.5, t);
    const flash = t > lock ? Math.exp(-(t - lock) * 7) : 0;

    // The camera, with a jolt when the keystone lands.
    const cam = camAt(t);
    if (t > lock && t < lock + 0.6) {
      const k = Math.exp(-(t - lock) * 9) * 0.045;
      cam.pos[0] += Math.sin(t * 90) * k;
      cam.pos[1] += Math.cos(t * 77) * k;
    }
    const B = basis(cam.pos, cam.tgt);
    const tanH = Math.tan((38 * Math.PI) / 360);
    const asp = width / height;

    // The light's place on screen, for the shafts.
    const L = [0, 3.2, -7.5];
    const d = [L[0] - cam.pos[0], L[1] - cam.pos[1], L[2] - cam.pos[2]];
    const z = d[0] * B.w[0] + d[1] * B.w[1] + d[2] * B.w[2];
    const lx = (d[0] * B.u[0] + d[1] * B.u[1] + d[2] * B.u[2]) / (z * tanH * asp) * 0.5 + 0.5;
    const ly = (d[0] * B.v[0] + d[1] * B.v[1] + d[2] * B.v[2]) / (z * tanH) * 0.5 + 0.5;

    // Pass 1: the scene, into the half-float target.
    const sw = Math.max(2, Math.round(width * scale)), sh = Math.max(2, Math.round(height * scale));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(sceneProg);
    const S = (n: string): any => loc(sceneProg, uni.s, n);
    gl.uniform2f(S('uRes'), sw, sh);
    gl.uniform1f(S('uT'), t);
    gl.uniform3fv(S('uCam'), cam.pos);
    gl.uniform3fv(S('uU'), B.u);
    gl.uniform3fv(S('uV'), B.v);
    gl.uniform3fv(S('uW'), B.w);
    gl.uniform1f(S('uTan'), tanH);
    gl.uniform3fv(S('uOff[0]'), off);
    gl.uniformMatrix3fv(S('uInv[0]'), false, inv);
    gl.uniform3fv(S('uPiv[0]'), piv);
    gl.uniform4fv(S('uAng[0]'), ang);
    gl.uniform4fv(S('uRad[0]'), rad);
    gl.uniform1f(S('uLock'), t - lock);
    gl.uniform1f(S('uGlow'), glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // Pass 2: light, lens and the wordmark, to the screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(postProg);
    const P = (n: string): any => loc(postProg, uni.p, n);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(P('uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.uniform1i(P('uText'), 1);
    gl.uniform2f(P('uRes'), width, height);
    gl.uniform2f(P('uLight'), lx, ly);
    gl.uniform1f(P('uT'), t);
    let fade = smooth(0.8, 2.0, t) * (1 - smooth(tl.end - 0.9, tl.end, t));
    if (skipAt >= 0) fade *= 1 - clamp01((now - skipAt) / 450);
    gl.uniform1f(P('uFade'), fade);
    gl.uniform1f(P('uBars'), 1 - smooth(tl.logo - 0.6, tl.logo + 0.3, t));
    gl.uniform1f(P('uTextA'), clamp01((t - tl.logo) / 1.3));
    gl.uniform1f(P('uShine'), clamp01((t - tl.logo - 1.0) / 1.2));
    gl.uniform1f(P('uFlash'), flash);
    gl.uniform1f(P('uGlow'), glow);
    gl.uniform1f(P('uHasText'), hasText);
    gl.uniform3fv(P('uCam'), cam.pos);
    gl.uniform3fv(P('uU'), B.u);
    gl.uniform3fv(P('uV'), B.v);
    gl.uniform3fv(P('uW'), B.w);
    gl.uniform1f(P('uTan'), tanH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Keep the frame rate: a slow machine gets a smaller scene target.
    if (freeze < 0) {
      frameTimes.push(now);
      if (frameTimes.length === 30) {
        const per = (frameTimes[29] - frameTimes[5]) / 24;
        if (per > 36 && scale > 0.4) { scale *= 0.72; makeTargets(); }
        frameTimes.length = 0;
      }
    }

    const over = (skipAt >= 0 && now - skipAt > 480) || (freeze < 0 && t >= tl.end + 0.15);
    if (over) { finished = true; scope.postMessage({ type: 'done' }); return; }
    raf(frame);
  }

  function resize(w: number, h: number): void {
    width = Math.max(2, w | 0); height = Math.max(2, h | 0);
    canvas.width = width; canvas.height = height;
    // Cap the scene at about 1600 px across: the post pass restores the edge.
    scale = Math.min(1, 1600 / width);
    makeTargets();
  }

  scope.onmessage = (e: any): void => {
    const m = e.data;
    if (m.type === 'init') {
      try {
        canvas = m.canvas;
        tl = m.timeline;
        freeze = typeof m.freeze === 'number' ? m.freeze : -1;
        gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
        if (!gl) throw new Error('no webgl2');
        halfFloat = !!gl.getExtension('EXT_color_buffer_float');
        sceneProg = program(SCENE_FS);
        postProg = program(POST_FS);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        textTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, textTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        resize(m.width, m.height);
        raf(frame);
      } catch (err) {
        finished = true;
        scope.postMessage({ type: 'done', error: String(err) });
      }
    } else if (m.type === 'resize' && gl) {
      resize(m.width, m.height);
    } else if (m.type === 'text' && gl) {
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m.bitmap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      hasText = 1;
    } else if (m.type === 'skip') {
      if (skipAt < 0) skipAt = performance.now();
    }
  };
}
