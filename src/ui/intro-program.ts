/**
 * The studio ident: a raymarched film in WebGL2, self-contained.
 *
 * Everything the ident draws is in `introProgram`, and it references nothing
 * outside itself -- no imports, no module state -- because its source is
 * turned into a Worker with `Function.prototype.toString`. In a Worker it
 * keeps playing at full rate while the main thread builds the city; where a
 * Worker cannot take the canvas, the same function runs on the main thread.
 *
 * Two shots. The arch: nine stones hang in the dark, lit from behind by a
 * light low over open water; they swing into place in pairs, the keystone
 * lowers and locks, light runs down the joints, and a ring of ripples runs out
 * across the water. The camera pushes through the arch into the
 * light. The mark: out of the white, a gold arch-and-keystone emblem turns
 * into place over ARCUS in extruded metal letters, a studio light sweeps
 * across them, and it all sits on a black mirror floor.
 *
 * Built for the slowest shader compilers in the field -- Direct3D, behind
 * ANGLE, on Windows -- which inline every function at every call site and
 * unroll every loop they can: the scene function has exactly three call sites,
 * every loop runs from a zero the compiler cannot see through, and the
 * program is linked asynchronously where the driver allows it, with the clock
 * started only once it is ready.
 *
 * Messages in:  init {canvas, width, height, timeline, freeze?, reduced?}
 *               resize {width, height}, text {bitmap}, skip
 * Messages out: ready, done {error?}
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function introProgram(scope: any): void {
  const SCENE_FS = `#version 300 es
precision highp float;
precision highp int;
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
uniform float uShot;
uniform sampler2D uSdf;
uniform float uHasSdf;
uniform float uLogoA;
uniform float uYaw;
uniform vec3 uSweep;
const float HS = 2.4;
const vec3 LPOS = vec3(0.0, 3.2, -7.5);
const vec3 LCOL = vec3(1.0, 0.80, 0.56);
const float PI = 3.14159265;
// The mark's layout, in the logo shot.
const vec3 EPOS = vec3(0.0, 2.4, 0.0);
const float ESCALE = 1.05;
const float TY = 0.56;
const float TW = 3.5;
int ZERO;

float h1(float n) { return fract(sin(n) * 43758.5453); }
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = ZERO; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float extrude(float d2, float z, float h) { vec2 w = vec2(d2, abs(z) - h); return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)); }

float sdVoussoir(vec3 p, int i) {
  vec2 q = p.xy - vec2(0.0, HS);
  float r = length(q);
  vec4 a = uAng[i]; vec4 rd = uRad[i];
  float g = 0.047;
  float c0 = a.x * q.y - a.y * q.x;
  float c1 = a.z * q.y - a.w * q.x;
  float d2 = max(abs(r - rd.x) - rd.y, max(g - c0, c1 + g));
  return extrude(d2, p.z, rd.z) - 0.035;
}
vec3 local(vec3 p, int i) { return uInv[i] * (p - uPiv[i] - uOff[i]) + uPiv[i]; }

// The emblem: a classical arch -- voussoirs, capitals, a stepped plinth --
// inside a roundel, and the keystone standing proud of it.
float emblemArch(vec2 q) {
  float r = 0.55, w = 0.1;
  float ring = q.y >= 0.0 ? abs(length(q) - r) - w : 1e3;
  // The joints between the stones of the arch, cut through.
  for (int k = ZERO; k < 4; k++) {
    float a = (k < 2 ? 0.1667 + 0.1667 * float(k) : 0.6667 + 0.1667 * float(k - 2)) * PI;
    vec2 dir = vec2(cos(a), sin(a));
    float cut = abs(dir.x * q.y - dir.y * q.x) - 0.012;
    if (dot(dir, q) > 0.0) ring = max(ring, -cut);
  }
  // Room for the keystone.
  ring = max(ring, -(sdBox2(q - vec2(0.0, r), vec2(0.13, 0.2)) - 0.02));
  float piers = sdBox2(vec2(abs(q.x) - r, q.y + 0.27), vec2(w, 0.27));
  float caps = sdBox2(vec2(abs(q.x) - r, q.y + 0.02), vec2(0.16, 0.035));
  float plinth = min(sdBox2(q - vec2(0.0, -0.6), vec2(0.86, 0.04)), sdBox2(q - vec2(0.0, -0.7), vec2(0.98, 0.04)));
  return min(min(ring, piers), min(caps, plinth));
}
float emblemKey(vec2 q) {
  vec2 k = q - vec2(0.0, 0.57);
  float halfw = 0.075 + (k.y + 0.18) / 0.36 * 0.055;
  return max(abs(k.x) - halfw, abs(k.y) - 0.18) * 0.85;
}
float emblemRing(vec2 q) { return abs(length(q - vec2(0.0, -0.06)) - 1.12) - 0.035; }

// x: distance, y: material, z: piece
// materials: 0 floor, 1 plinth/pier, 2 voussoir, 3 keystone, 4 gold, 5 letters
vec3 map(vec3 p) {
  vec3 res = vec3(p.y, 0.0, -1.0);
  if (uShot < 0.5) {
    float st = sdBox(p - vec3(0.0, 0.125, 0.0), vec3(3.9, 0.125, 1.6)) - 0.02;
    st = min(st, sdBox(p - vec3(0.0, 0.375, 0.0), vec3(3.3, 0.125, 1.15)) - 0.02);
    vec3 q = vec3(abs(p.x) - 1.95, p.y, p.z);
    st = min(st, sdBox(q - vec3(0.0, 1.45, 0.0), vec3(0.4, 0.95, 0.42)) - 0.02);
    st = min(st, sdBox(q - vec3(0.0, 2.33, 0.0), vec3(0.5, 0.075, 0.5)) - 0.015);
    st = min(st, sdBox(q - vec3(0.0, 0.62, 0.0), vec3(0.52, 0.12, 0.52)) - 0.015);
    if (st < res.x) res = vec3(st, 1.0, -1.0);
    for (int i = ZERO; i < 9; i++) {
      float dv = sdVoussoir(local(p, i), i);
      if (dv < res.x) res = vec3(dv, i == 4 ? 3.0 : 2.0, float(i));
    }
  } else {
    // The emblem, turned into place about its own axis.
    vec3 e = p - EPOS - vec3(0.0, (1.0 - uLogoA) * 0.25, 0.0);
    float c = cos(uYaw), s = sin(uYaw);
    e = vec3(c * e.x + s * e.z, e.y, -s * e.x + c * e.z) / ESCALE;
    float ea = extrude(emblemArch(e.xy), e.z, 0.09) - 0.02;
    float ek = extrude(emblemKey(e.xy), e.z - 0.03, 0.15) - 0.018;
    float er = extrude(emblemRing(e.xy), e.z, 0.05) - 0.012;
    float em = min(min(ea, ek), er) * ESCALE;
    if (em < res.x) res = vec3(em, 4.0, -1.0);
    // The letters: a distance field in a texture, extruded.
    if (uHasSdf > 0.5) {
      vec2 tuv = vec2(p.x / TW + 0.5, (p.y - TY) / (TW * 0.25) + 0.5);
      vec2 cl = clamp(tuv, 0.002, 0.998);
      float inside = texture(uSdf, cl).r * 40.0 * (TW / 1024.0);
      float outside = length((tuv - cl) * vec2(TW, TW * 0.25));
      float depth = 0.02 + 0.13 * smoothstep(0.0, 1.0, uLogoA);
      float dt = extrude(inside + outside, p.z, depth) - 0.012;
      if (dt < res.x) res = vec3(dt, 5.0, -1.0);
    }
  }
  return res;
}

vec3 normal(vec3 p) {
  vec3 n = vec3(0.0);
  for (int i = ZERO; i < 4; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * map(p + 0.0012 * e).x;
  }
  return normalize(n);
}

vec3 march(vec3 ro, vec3 rd, float maxT, int steps) {
  float t = 0.02;
  for (int i = ZERO; i < 160; i++) {
    if (i >= steps) break;
    vec3 h = map(ro + rd * t);
    if (h.x < 0.0008 * t) return vec3(t, h.y, h.z);
    t += h.x * 0.9;
    if (t > maxT) break;
  }
  return vec3(-1.0);
}

float softShadow(vec3 ro, vec3 rd, float maxT) {
  float res = 1.0, t = 0.03;
  for (int i = ZERO; i < 28; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.03, 0.5);
    if (res < 0.01 || t > maxT) break;
  }
  return clamp(res, 0.0, 1.0);
}

// The water the arch stands in: a surface normal from a few travelling wave
// trains, calmed with distance so the far water is glass rather than noise,
// and ringed by the shock of the keystone landing.
vec3 waterNormal(vec3 p, float dist) {
  float calm = 1.0 / (1.0 + dist * 0.12);
  vec2 q = p.xz;
  float t = uT;
  vec2 g = vec2(0.0);
  g += vec2(0.8, 0.6) * cos(dot(q, vec2(0.8, 0.6)) * 1.3 + t * 1.1) * 0.35;
  g += vec2(-0.5, 0.86) * cos(dot(q, vec2(-0.5, 0.86)) * 2.1 + t * 1.6) * 0.22;
  g += vec2(0.97, -0.24) * cos(dot(q, vec2(0.97, -0.24)) * 3.7 + t * 2.3) * 0.12;
  g += vec2(0.2, 0.98) * cos(dot(q, vec2(0.2, 0.98)) * 6.3 + t * 3.1) * 0.07;
  vec3 e = vec3(0.07, 0.0, 0.0);
  float n0 = noise(vec3(q * 2.4, t * 0.6));
  g += vec2(noise(vec3(q * 2.4 + e.xy, t * 0.6)) - n0, noise(vec3(q * 2.4 + e.yx, t * 0.6)) - n0) * 1.4;
  g *= 0.22 * calm;
  if (uLock > 0.0) {
    float r = length(q);
    float front = uLock * 3.2 + 1.4;
    float ring = sin((r - front) * 9.0) * exp(-pow((r - front) * 1.4, 2.0)) * exp(-uLock * 0.7);
    g += (q / max(r, 0.001)) * ring * 0.18;
  }
  return normalize(vec3(-g.x, 1.0, -g.y));
}

vec3 studio(vec3 r) {
  float box = smoothstep(0.5, 0.78, r.y) * smoothstep(0.95, 0.35, abs(r.x + 0.15));
  float side = exp(-pow((r.x + 0.85) * 3.0, 2.0)) * smoothstep(-0.1, 0.35, r.y) * 0.5;
  float back = pow(max(dot(r, normalize(vec3(0.0, 0.25, -1.0))), 0.0), 5.0) * 0.35 * uGlow;
  return vec3(1.0, 0.95, 0.88) * box * 2.4 + vec3(0.8, 0.72, 0.62) * side + LCOL * back + vec3(0.006);
}

vec3 sky(vec3 rd) {
  if (uShot > 0.5) {
    // A black studio with a warm breath of light behind the mark.
    float g = pow(max(dot(rd, normalize(vec3(0.0, 0.2, -1.0))), 0.0), 6.0);
    return vec3(0.002, 0.002, 0.003) + vec3(0.035, 0.026, 0.016) * g * uGlow;
  }
  vec3 ld = normalize(LPOS - uCam);
  float c = max(dot(rd, ld), 0.0);
  float glow = pow(c, 2400.0) * 40.0 + pow(c, 160.0) * 1.1 + pow(c, 18.0) * 0.05;
  vec3 base = vec3(0.004, 0.005, 0.008) + vec3(0.012, 0.010, 0.008) * (1.0 - abs(rd.y));
  base += LCOL * glow * uGlow;
  // A warm band where the sky meets the water, for the water to hold.
  base += LCOL * 0.07 * exp(-abs(rd.y) * 16.0) * uGlow;
  return base;
}

float jointWave(float s) {
  if (uLock < 0.0) return 0.0;
  float front = uLock * 1.9;
  float head = exp(-pow((s - front) * 5.0, 2.0));
  float trail = step(s, front) * (0.35 + 0.65 * exp(-uLock * 0.9));
  return head * 2.5 + trail * 0.6;
}

// The colour of what a ray hit. The reflection is shaded without shadows or bump.
vec3 shade(vec3 p, vec3 n, vec3 rd, vec3 h, bool bounce, out float wet) {
  float mat = h.y;
  wet = 0.0;
  if (mat > 3.5) {
    // Metal: the studio in it, and the sweeping light's highlight.
    vec3 F0 = mat < 4.5 ? vec3(1.0, 0.74, 0.30) : vec3(0.92, 0.86, 0.74);
    vec3 r = reflect(rd, n);
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 F = F0 + (1.0 - F0) * fres;
    vec3 col = F * studio(r);
    vec3 l = normalize(uSweep - p);
    vec3 hv = normalize(l - rd);
    float nh = max(dot(n, hv), 0.0);
    col += F * (pow(nh, 140.0) * 5.0 + pow(nh, 16.0) * 0.25);
    vec3 kl = normalize(vec3(-0.4, 0.9, 0.6));
    col += F0 * 0.2 * max(dot(n, kl), 0.0) + F0 * 0.08 * max(n.z, 0.0);
    // A brushed face on the letters, so the bevels read as the bright part.
    if (mat > 4.5 && n.z > 0.92) col *= 0.82 + 0.12 * noise(p * vec3(60.0, 2.0, 2.0));
    return col;
  }
  int piece = int(h.z + 0.5);
  vec3 lp = mat > 1.5 ? local(p, piece) : p;
  vec3 alb;
  float emit = 0.0;
  if (mat < 0.5) {
    // Deep water: almost no colour of its own, everything it shows is
    // reflected. What little it has is the green of depth, lit by the light
    // it lets in.
    alb = vec3(0.003, 0.010, 0.013);
    wet = 1.0;
    if (uShot > 0.5) alb = vec3(0.006);
    else {
      vec3 wn = waterNormal(p, length(p - uCam));
      vec3 l = normalize(LPOS - p);
      // The sun's road: the light's own glitter off every wave facing it.
      float glint = pow(max(dot(reflect(rd, wn), l), 0.0), 160.0);
      emit += glint * 16.0 * uGlow;
      // Light scattered up through the water under the arch.
      emit += exp(-length(p.xz - vec2(0.0, -1.0)) * 0.9) * 0.04 * uGlow;
    }
  } else {
    float nn = fbm(lp * 3.1);
    vec3 base = mat > 2.5 ? vec3(0.12, 0.115, 0.12) : vec3(0.50, 0.42, 0.33);
    alb = base * (0.72 + 0.5 * nn) * (0.9 + 0.2 * noise(lp * 23.0));
    if (mat < 1.5) {
      float course = fract((p.y - 0.5) / 0.475);
      float bed = smoothstep(0.0, 0.035, min(course, 1.0 - course));
      float head = fract((p.x + p.z + floor((p.y - 0.5) / 0.475) * 0.37) / 0.62);
      bed *= smoothstep(0.0, 0.03, min(head, 1.0 - head)) * 0.5 + 0.5;
      alb *= 0.55 + 0.45 * bed;
    }
    if (!bounce) {
      vec3 bp = lp * 16.0;
      float b0 = noise(bp);
      vec3 grad = vec3(noise(bp + vec3(0.25, 0, 0)) - b0, noise(bp + vec3(0, 0.25, 0)) - b0, noise(bp + vec3(0, 0, 0.25)) - b0);
      n = normalize(n - grad * 0.28);
    }
    if (mat > 1.5) {
      vec2 q = lp.xy - vec2(0.0, HS);
      float s = abs(atan(q.y, q.x) - 0.5 * PI);
      vec4 a = uAng[piece];
      float c0 = a.x * q.y - a.y * q.x;
      float c1 = a.z * q.y - a.w * q.x;
      emit += exp(-min(abs(c0), abs(c1)) * 26.0) * jointWave(s) * 1.6;
      if (mat > 2.5 && uLock > 0.0) {
        float r = length(q);
        float inset = min(min(abs(c0), abs(c1)), min(abs(r - (uRad[4].x - uRad[4].y)), abs(r - (uRad[4].x + uRad[4].y))));
        float line = exp(-pow((inset - 0.11) * 60.0, 2.0)) * step(0.0, lp.z - uRad[4].z + 0.06);
        emit += line * (1.4 + 3.0 * exp(-uLock * 2.0)) * smoothstep(0.0, 0.25, uLock);
      }
    } else {
      float s = 0.5 * PI + (HS - p.y) / 2.0;
      float edge = min(abs(abs(p.x) - 1.55), abs(abs(p.x) - 2.35));
      emit += exp(-edge * 30.0) * jointWave(s) * step(0.5, p.y) * step(p.y, HS) * 1.2;
    }
  }
  if (uShot > 0.5) return alb * 0.2 + vec3(1.0, 0.72, 0.38) * emit;
  vec3 toL = LPOS - p;
  float dl = length(toL);
  vec3 l = toL / dl;
  float att = 60.0 / (dl * dl + 8.0);
  float sh = bounce ? 1.0 : softShadow(p + n * 0.01, l, dl);
  vec3 col = alb * LCOL * max(dot(n, l), 0.0) * att * sh * uGlow * 2.2;
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0) * max(dot(-rd, l) * 0.5 + 0.5, 0.0);
  col += LCOL * rim * 0.9 * uGlow * (mat < 0.5 ? 0.0 : 1.0) * sh;
  vec3 fl = normalize(vec3(-0.55, 0.65, 0.85));
  col += alb * vec3(0.16, 0.18, 0.24) * (max(dot(n, fl), 0.0) * 0.42 + 0.04);
  col += alb * LCOL * 0.05 * max(-n.y, 0.0) * uGlow;
  col += vec3(1.0, 0.72, 0.38) * emit;
  return col;
}

void main() {
  ZERO = min(int(uT), 0);
  vec2 uv = (gl_FragCoord.xy / uRes) * 2.0 - 1.0;
  float asp = uRes.x / uRes.y;
  vec3 ro = uCam;
  vec3 rd = normalize(uW + uU * uv.x * uTan * asp + uV * uv.y * uTan);
  vec3 acc = vec3(0.0), thr = vec3(1.0);
  float tFirst = 40.0, mask = 0.0;
  vec3 rd0 = rd;
  // One march for the view and one for its reflection in the floor, from a
  // single call site: the compiler inlines the scene once, not twice.
  for (int b = ZERO; b < 2; b++) {
    vec3 h = march(ro, rd, b == 0 ? 40.0 : 25.0, b == 0 ? 150 : 70);
    if (h.x < 0.0) {
      acc += thr * sky(rd);
      if (b == 0 && uShot < 0.5) mask = pow(max(dot(rd, normalize(LPOS - uCam)), 0.0), 220.0) * min(uGlow, 1.4) * 0.7;
      break;
    }
    vec3 p = ro + rd * h.x;
    if (b == 0) tFirst = h.x;
    vec3 n = normal(p);
    float wet;
    acc += thr * shade(p, n, rd, h, b > 0, wet);
    if (h.y > 0.5 || wet <= 0.0 || b > 0) break;
    // The water moves; the studio floor is a mirror.
    vec3 nn = uShot > 0.5 ? vec3(0.0, 1.0, 0.0) : waterNormal(p, h.x);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nn, -rd), 0.0), 5.0);
    thr *= mix(0.12, 0.95, fres) * wet;
    ro = p + nn * 0.02;
    rd = reflect(rd, nn);
  }
  vec3 col = acc;
  if (uShot < 0.5) {
    vec3 ld = normalize(LPOS - uCam);
    float fog = 1.0 - exp(-tFirst * 0.025);
    col = mix(col, vec3(0.006, 0.007, 0.010) + LCOL * 0.012 * uGlow, fog * 0.6);
    col += LCOL * pow(max(dot(rd0, ld), 0.0), 24.0) * 0.05 * (1.0 - exp(-tFirst * 0.09)) * uGlow;
  }
  frag = vec4(col, mask);
}`;

  const POST_FS = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 uRes;
uniform sampler2D uScene;
uniform vec2 uLight;
uniform float uT;
uniform float uFade;
uniform float uBars;
uniform float uFlash;
uniform float uGlow;
uniform float uWhite;
uniform float uShot;
uniform vec3 uCam;
uniform vec3 uU;
uniform vec3 uV;
uniform vec3 uW;
uniform float uTan;

float h1(float n) { return fract(sin(n) * 43758.5453); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  int ZERO = min(int(uT), 0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 cc = uv - 0.5;
  float ca = dot(cc, cc) * 0.006;
  vec3 col;
  col.r = texture(uScene, uv + cc * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - cc * ca).b;

  vec3 b = max(textureLod(uScene, uv, 2.0).rgb - 0.7, 0.0) * 0.4
         + max(textureLod(uScene, uv, 3.0).rgb - 0.55, 0.0) * 0.45
         + max(textureLod(uScene, uv, 4.0).rgb - 0.45, 0.0) * 0.4;
  float asp = uRes.x / uRes.y;
  if (uShot < 0.5) {
    float lr = length((uv - uLight) * vec2(asp, 1.0));
    float seen = textureLod(uScene, uLight, 3.0).a;
    b += vec3(1.0, 0.86, 0.66) * (exp(-lr * lr * 900.0) * 1.4 + exp(-lr * 9.0) * 0.05) * clamp(seen * 3.0, 0.0, 1.0) * uGlow;
    vec2 dir = uv - uLight;
    vec2 s = uv;
    float decay = 1.0, acc = 0.0;
    for (int i = ZERO; i < 56; i++) {
      s -= dir * (0.96 / 56.0);
      acc += textureLod(uScene, s, 1.0).a * decay;
      decay *= 0.962;
    }
    col += vec3(1.0, 0.78, 0.52) * acc / 56.0 * 0.85;
  }
  col += b;

  // Dust in the air, catching the light.
  for (int i = ZERO; i < 60; i++) {
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
    col += vec3(1.0, 0.85, 0.65) * exp(-px * px / (size * size)) * beam * uGlow * (uShot > 0.5 ? 0.12 : 0.35)
         * (0.5 + 0.5 * sin(uT * 1.7 + fi * 3.1));
  }

  col += vec3(1.0, 0.86, 0.62) * uFlash * 0.35;
  col = mix(col, vec3(6.0, 5.4, 4.6), uWhite);
  col = aces(col * 1.05);
  col = pow(col, vec3(1.0 / 2.2));
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
  let fbo: any = null, sceneTex: any = null, sdfTex: any = null;
  let hasSdf = 0;
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

  function shader(src: string, type: number): any {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  }
  function program(fs: string): any {
    const p = gl.createProgram();
    const v = shader(VS, gl.VERTEX_SHADER), f = shader(fs, gl.FRAGMENT_SHADER);
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    return { p, v, f };
  }
  function check(pr: any): void {
    if (!gl.getProgramParameter(pr.p, gl.LINK_STATUS)) {
      throw new Error(`${gl.getShaderInfoLog(pr.f) || ''} ${gl.getProgramInfoLog(pr.p) || ''}`);
    }
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

  /**
   * A signed distance field from the wordmark's coverage: exact Euclidean
   * distances by the separable transform (Felzenszwalb and Huttenlocher), one
   * for the outside and one for the inside, in pixels over 40.
   */
  function distanceField(bitmap: any): Float32Array | null {
    const W = 1024, H = 256;
    let cx: any = null;
    if (typeof OffscreenCanvas !== 'undefined') cx = new OffscreenCanvas(W, H).getContext('2d');
    if (!cx) return null;
    cx.drawImage(bitmap, 0, 0, W, H);
    const px = cx.getImageData(0, 0, W, H).data;
    const INF = 1e12;
    const N = Math.max(W, H);
    const f = new Float32Array(N), d = new Float32Array(N);
    const v = new Int32Array(N), z = new Float32Array(N + 1);
    const pass = (n: number): void => {
      let k = 0;
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
      }
    };
    const edt = (inside: boolean): Float32Array => {
      const g = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) g[i] = (px[i * 4 + 3] > 127) === inside ? 0 : INF;
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < H; y++) f[y] = g[y * W + x];
        pass(H);
        for (let y = 0; y < H; y++) g[y * W + x] = d[y];
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) f[x] = g[y * W + x];
        pass(W);
        for (let x = 0; x < W; x++) g[y * W + x] = d[x];
      }
      return g;
    };
    const out = edt(true), inn = edt(false);
    // `out` is each pixel's distance to the nearest inked pixel, `inn` to the
    // nearest blank one: positive outside the letters, negative in them.
    const sdf = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const s = Math.sqrt(out[i]) - Math.sqrt(inn[i]);
        // Rows top-down in the image; the texture wants them bottom-up.
        sdf[(H - 1 - y) * W + x] = Math.max(-1, Math.min(1, s / 40));
      }
    }
    return sdf;
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

  /** The inverse of a rotation about a unit axis, column-major (R row-major). */
  function rotInv(ax: number[], a: number): number[] {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    const [x, y, z] = ax;
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
    [7.3, [0.0, 2.9, 10.2], [0.0, 2.45, 0.0]],
    [7.8, [0.0, 2.75, 9.4], [0.0, 2.45, 0.0]],
    [8.35, [0.0, 2.3, 0.6], [0.0, 2.3, -5.0]],
    [9.0, [0.0, 2.3, -2.0], [0.0, 2.3, -8.0]],
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
    return {
      pos: [0, 1, 2].map((j) => cr(a[1][j], b[1][j], c[1][j], d[1][j], u)),
      tgt: [0, 1, 2].map((j) => cr(a[2][j], b[2][j], c[2][j], d[2][j], u)),
    };
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
  const off = new Float32Array(27), inv = new Float32Array(81), piv = new Float32Array(27);
  const ang = new Float32Array(36), rad = new Float32Array(36);
  function frame(now: number): void {
    if (finished) return;
    if (start < 0) start = now;
    let t = freeze >= 0 ? freeze : (now - start) / 1000;
    if (tl.reduced && freeze < 0) t = Math.max(t, tl.cut + 1.8);
    const lock = tl.lock;
    const logoShot = t >= tl.cut;

    pieces.forEach((pc, i) => {
      let e: number;
      if (i === 4) {
        e = Math.pow(clamp01((t - tl.keyStart) / (lock - tl.keyStart)), 2.3);
      } else {
        const pair = i < 4 ? i : 8 - i;
        e = 1 - Math.pow(1 - clamp01((t - tl.settle[pair]) / 1.2), 4);
      }
      const bob = Math.sin(t * 0.9 + pc.bob) * 0.1 * (1 - e);
      for (let j = 0; j < 3; j++) off[i * 3 + j] = pc.float[j] * (1 - e) + (j === 1 ? bob : 0);
      const a = (pc.spin * 0.5 + Math.sin(t * 0.25 + pc.bob) * 0.35) * (1 - e) + (i === 4 ? (1 - e) * t * 0.12 : 0);
      inv.set(rotInv(pc.axis, a), i * 9);
      piv.set(pc.piv, i * 3);
      ang.set(pc.ang, i * 4);
      rad.set(pc.rad, i * 4);
    });

    let glow = smooth(0.7, 2.6, t) * 0.55 + smooth(2.6, 6.2, t) * 0.15;
    if (t > lock) glow += 0.8 * Math.exp(-(t - lock) * 3.4) + 0.25 * smooth(lock, lock + 1.5, t);
    const flash = t > lock && !logoShot ? Math.exp(-(t - lock) * 7) : 0;
    // Into the light, then out of it onto the mark.
    const white = logoShot ? 1 - smooth(tl.cut, tl.cut + 0.7, t) : smooth(tl.cut - 0.45, tl.cut, t);

    let cam: { pos: number[]; tgt: number[] };
    if (logoShot) {
      const u = clamp01((t - tl.cut) / (tl.end - tl.cut));
      const e = 1 - Math.pow(1 - u, 2);
      cam = { pos: [0.5 * (1 - e), 1.7 - 0.1 * e, 7.6 - 0.9 * e], tgt: [0, 1.62, 0] };
      glow = 0.9;
    } else {
      cam = camAt(t);
      if (t > lock && t < lock + 0.6) {
        const k = Math.exp(-(t - lock) * 9) * 0.045;
        cam.pos[0] += Math.sin(t * 90) * k;
        cam.pos[1] += Math.cos(t * 77) * k;
      }
    }
    const B = basis(cam.pos, cam.tgt);
    const tanH = Math.tan((38 * Math.PI) / 360);
    const asp = width / height;
    const L = [0, 3.2, -7.5];
    const d = [L[0] - cam.pos[0], L[1] - cam.pos[1], L[2] - cam.pos[2]];
    const z = d[0] * B.w[0] + d[1] * B.w[1] + d[2] * B.w[2];
    const lx = (d[0] * B.u[0] + d[1] * B.u[1] + d[2] * B.u[2]) / (z * tanH * asp) * 0.5 + 0.5;
    const ly = (d[0] * B.v[0] + d[1] * B.v[1] + d[2] * B.v[2]) / (z * tanH) * 0.5 + 0.5;
    const logoA = smooth(tl.cut + 0.15, tl.cut + 1.6, t);
    const yaw = (1 - logoA) * 1.1;
    const sweepU = clamp01((t - tl.cut - 1.3) / 1.6);
    const sweep = [-5 + 10 * sweepU, 2.6, 2.4];

    const sw = Math.max(2, Math.round(width * scale)), sh = Math.max(2, Math.round(height * scale));
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, sw, sh);
    gl.useProgram(sceneProg.p);
    const S = (n: string): any => loc(sceneProg.p, uni.s, n);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    gl.uniform1i(S('uSdf'), 1);
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
    gl.uniform1f(S('uShot'), logoShot ? 1 : 0);
    gl.uniform1f(S('uHasSdf'), hasSdf);
    gl.uniform1f(S('uLogoA'), logoA);
    gl.uniform1f(S('uYaw'), yaw);
    gl.uniform3fv(S('uSweep'), sweep);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.generateMipmap(gl.TEXTURE_2D);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(postProg.p);
    const P = (n: string): any => loc(postProg.p, uni.p, n);
    gl.uniform1i(P('uScene'), 0);
    gl.uniform2f(P('uRes'), width, height);
    gl.uniform2f(P('uLight'), lx, ly);
    gl.uniform1f(P('uT'), t);
    let fade = smooth(0.8, 2.0, t) * (1 - smooth(tl.end - 0.9, tl.end, t));
    if (skipAt >= 0) fade *= 1 - clamp01((now - skipAt) / 450);
    gl.uniform1f(P('uFade'), fade);
    gl.uniform1f(P('uBars'), logoShot ? 0 : 1);
    gl.uniform1f(P('uFlash'), flash);
    gl.uniform1f(P('uGlow'), glow);
    gl.uniform1f(P('uWhite'), white);
    gl.uniform1f(P('uShot'), logoShot ? 1 : 0);
    gl.uniform3fv(P('uCam'), cam.pos);
    gl.uniform3fv(P('uU'), B.u);
    gl.uniform3fv(P('uV'), B.v);
    gl.uniform3fv(P('uW'), B.w);
    gl.uniform1f(P('uTan'), tanH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (freeze < 0) {
      frameTimes.push(now);
      if (frameTimes.length === 30) {
        const per = (frameTimes[29] - frameTimes[5]) / 24;
        if (per > 36 && scale > 0.35) { scale *= 0.72; makeTargets(); }
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
    scale = Math.min(scale, 1600 / width);
    makeTargets();
  }

  /** Waits for the programs to link without blocking, where the driver says how. */
  function whenLinked(then: () => void): void {
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const poll = (): void => {
      if (finished) return;
      if (ext && (!gl.getProgramParameter(sceneProg.p, ext.COMPLETION_STATUS_KHR)
        || !gl.getProgramParameter(postProg.p, ext.COMPLETION_STATUS_KHR))) {
        setTimeout(poll, 30);
        return;
      }
      try {
        check(sceneProg);
        check(postProg);
      } catch (err) {
        finished = true;
        scope.postMessage({ type: 'done', error: String(err) });
        return;
      }
      then();
    };
    poll();
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
        gl.getExtension('KHR_parallel_shader_compile');
        sceneProg = program(SCENE_FS);
        postProg = program(POST_FS);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        sdfTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, sdfTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([1]));
        width = Math.max(2, m.width | 0);
        scale = Math.min(1, 1600 / width);
        resize(m.width, m.height);
        // Black until the programs are ready; the film's clock starts then.
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        whenLinked(() => { scope.postMessage({ type: 'ready' }); raf(frame); });
      } catch (err) {
        finished = true;
        scope.postMessage({ type: 'done', error: String(err) });
      }
    } else if (m.type === 'resize' && gl) {
      resize(m.width, m.height);
    } else if (m.type === 'text' && gl) {
      const sdf = distanceField(m.bitmap);
      if (sdf) {
        gl.bindTexture(gl.TEXTURE_2D, sdfTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1024, 256, 0, gl.RED, gl.FLOAT, sdf);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        hasSdf = 1;
      }
    } else if (m.type === 'skip') {
      if (skipAt < 0) skipAt = performance.now();
      if (!gl || start < 0) { finished = true; scope.postMessage({ type: 'done' }); }
    }
  };
}
