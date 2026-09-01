import{l as y,m as D,c as T,b as de,p as fe,d as pe,i as me,t as X,e as ge,G as be,a as ve}from"./m4-Du0sUTFU.js";function S(r,e,t){let n=Math.imul(r,374761393)+Math.imul(e,668265263)+Math.imul(t,2246822519)>>>0;return n=Math.imul(n^n>>>13,1274126177)>>>0,((n^n>>>16)>>>0)/4294967296}const K=r=>r*r*(3-2*r);function we(r,e,t){const n=Math.floor(r),s=Math.floor(e),o=K(r-n),a=K(e-s),l=S(n,s,t),u=S(n+1,s,t),p=S(n,s+1,t),i=S(n+1,s+1,t);return(l+(u-l)*o)*(1-a)+(p+(i-p)*o)*a}function F(r,e,t,n){let s=0,o=1,a=0,l=1;for(let u=0;u<t;u++)s+=we(r*l,e*l,n+u*31)*o,a+=o,o*=.5,l*=2.03;return s/a}class ye{planes=new Float32Array(24);update(e){const t=this.planes,n=(o,a)=>e[a*4+o],s=(o,a,l,u,p)=>{const i=Math.hypot(a,l,u)||1;t[o]=a/i,t[o+1]=l/i,t[o+2]=u/i,t[o+3]=p/i};s(0,n(3,0)+n(0,0),n(3,1)+n(0,1),n(3,2)+n(0,2),n(3,3)+n(0,3)),s(4,n(3,0)-n(0,0),n(3,1)-n(0,1),n(3,2)-n(0,2),n(3,3)-n(0,3)),s(8,n(3,0)+n(1,0),n(3,1)+n(1,1),n(3,2)+n(1,2),n(3,3)+n(1,3)),s(12,n(3,0)-n(1,0),n(3,1)-n(1,1),n(3,2)-n(1,2),n(3,3)-n(1,3)),s(16,n(2,0),n(2,1),n(2,2),n(2,3)),s(20,n(3,0)-n(2,0),n(3,1)-n(2,1),n(3,2)-n(2,2),n(3,3)-n(2,3))}containsBox(e,t){const n=this.planes;for(let s=0;s<24;s+=4){const o=n[s],a=n[s+1],l=n[s+2],u=o>=0?t[0]:e[0],p=a>=0?t[1]:e[1],i=l>=0?t[2]:e[2];if(o*u+a*p+l*i+n[s+3]<0)return!1}return!0}}const xe=1e-6;class Pe{constructor(e,t){if(this.scopes=t,this.enabled=e.features.has("timestamp-query"),this.results=new Float64Array(t.length),!this.enabled)return;const n=t.length*2;this.querySet=e.createQuerySet({type:"timestamp",count:n}),this.resolveBuffer=e.createBuffer({label:"timestamp-resolve",size:n*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),this.readBuffer=e.createBuffer({label:"timestamp-read",size:n*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})}enabled;querySet=null;resolveBuffer=null;readBuffer=null;pending=!1;results;writes(e){if(!this.querySet)return;const t=this.scopes.indexOf(e);if(!(t<0))return{querySet:this.querySet,beginningOfPassWriteIndex:t*2,endOfPassWriteIndex:t*2+1}}resolve(e){if(!this.querySet||!this.resolveBuffer||!this.readBuffer||this.pending)return;const t=this.scopes.length*2;e.resolveQuerySet(this.querySet,0,t,this.resolveBuffer,0),e.copyBufferToBuffer(this.resolveBuffer,0,this.readBuffer,0,t*8)}poll(){const e=this.readBuffer;!e||this.pending||(this.pending=!0,e.mapAsync(GPUMapMode.READ).then(()=>{const t=new BigUint64Array(e.getMappedRange().slice(0));for(let n=0;n<this.scopes.length;n++){const s=t[n*2],o=t[n*2+1];this.results[n]=o>s?Number(o-s)*xe:this.results[n]}e.unmap(),this.pending=!1},()=>{this.pending=!1}))}ms(e){const t=this.scopes.indexOf(e);return t<0?0:this.results[t]}destroy(){this.querySet?.destroy(),this.resolveBuffer?.destroy(),this.readBuffer?.destroy()}}const Se={cityGrid:440,terrainSize:6144},Be={cityGrid:90,terrainSize:1536},N={...Se};function Ee(r){Object.assign(N,r)}const g={get size(){return N.terrainSize},chunk:256,res:32},Me=g.res+1,ne=g.res*g.res*6,q=6;function B(r,e){const t=.0009090909090909091,n=(F(r*t,e*t,5,101)-.5)*2,s=(F(r*t*3.7,e*t*3.7,3,233)-.5)*2,o=Math.min(Math.hypot(r,e)/(g.size*.5),1),a=Math.pow(Math.max(0,(o-.05)/.95),1.05),l=(F(r/90,e/90,3,909)-.5)*2*2.1;return(n*150+s*34)*a+l}function Ce(r,e,t){const s=B(r+2,e)-B(r-2,e),o=B(r,e+2)-B(r,e-2),a=Math.hypot(s,4,o)||1;t[0]=-s/a,t[1]=4/a,t[2]=-o/a}function Ue(){const r=Math.max(1,Math.round(g.size/g.chunk)),e=Me,t=e*e,n=r*r,s=g.chunk/g.res,o=g.size/2,a=new Float32Array(n*t*q),l=[],u=[0,0,0];let p=0;for(let d=0;d<r;d++)for(let h=0;h<r;h++){const f=p/q,b=h*g.chunk-o,m=d*g.chunk-o;let v=1/0,E=-1/0;for(let M=0;M<e;M++)for(let w=0;w<e;w++){const P=b+w*s,C=m+M*s,x=B(P,C);Ce(P,C,u),a[p++]=P,a[p++]=x,a[p++]=C,a[p++]=u[0],a[p++]=u[1],a[p++]=u[2],x<v&&(v=x),x>E&&(E=x)}l.push({baseVertex:f,min:[b,v,m],max:[b+g.chunk,E,m+g.chunk]})}const i=new Uint32Array(ne);let c=0;for(let d=0;d<g.res;d++)for(let h=0;h<g.res;h++){const f=d*e+h,b=f+1,m=f+e,v=m+1;i[c++]=f,i[c++]=m,i[c++]=b,i[c++]=b,i[c++]=m,i[c++]=v}return{vertices:a,indices:i,chunks:l}}const se=12,z=8,H=6,Ge=.55,Le=4.5;function ze(){const r=N.cityGrid,e=r/2,t=[],n=new Uint8Array(r*r),s=(i,c)=>i%(H+1)===0||c%(H+1)===0,o=(i,c,d)=>{if(i+d>r||c+d>r)return!1;for(let h=0;h<d;h++)for(let f=0;f<d;f++)if(s(i+f,c+h)||n[(c+h)*r+i+f])return!1;return!0},a=(i,c,d)=>{for(let h=0;h<d;h++)for(let f=0;f<d;f++)n[(c+h)*r+i+f]=1},l=(i,c,d,h)=>{const f=d*z,b=(i-e)*z+f/2,m=(c-e)*z+f/2,v=B(b-f/2,m-f/2),E=B(b+f/2,m-f/2),M=B(b-f/2,m+f/2),w=B(b+f/2,m+f/2),P=Math.min(v,E,M,w);if(Math.max(v,E,M,w)-P>Le)return!1;const C=1-Math.min(h/420,.14),x=(f/2-Ge)*C,U=Math.min(h/90,1),L=(S(i,c,11)-.5)*.07;return t.push(b,m,x,x,P-1.2,h+1.2,0,0,.2+U*.34+L,.24+U*.36+L,.3+U*.38+L,1),a(i,c,d),!0},u=(i,c)=>{const d=(i-e)*z,h=(c-e)*z;return Math.max(0,1-Math.hypot(d,h)/(e*z)*3.2)};for(let i=1;i<r-3;i+=3)for(let c=1;c<r-3;c+=3){const d=u(c,i);if(d<=0||S(c,i,7)>Math.pow(d,1.5)*.55||!o(c,i,3))continue;const f=S(c,i,13);l(c,i,3,55+Math.pow(d,2.2)*120*(.3+f))}for(let i=1;i<r-2;i+=2)for(let c=1;c<r-2;c+=2){const d=u(c,i);S(c,i,23)>.16+d*.42||o(c,i,2)&&l(c,i,2,16+S(c,i,29)*26+d*18)}for(let i=0;i<r;i++)for(let c=0;c<r;c++)o(c,i,1)&&(S(c,i,1)<.22||l(c,i,1,6+S(c,i,3)*11));const p=new Float32Array(t.length);return p.set(t),{data:p,count:t.length/se}}const Te=`// Shared camera binding. Every pipeline binds this as group 0.

struct Camera {
  viewProj : mat4x4f,
  eye      : vec4f,        // xyz = eye position, w = far plane
  // x = time, y = ground extent, z = near/far LOD split in metres,
  // w = viewportHeight / (2 * tan(fovY / 2)), which converts a size in metres
  // at a given distance into a size in pixels
  params   : vec4f,
  planes   : array<vec4f, 6>,   // frustum, for the culling pass
};

@group(0) @binding(0) var<uniform> camera : Camera;

const SKY = vec3f(0.043, 0.055, 0.075);

// Distance fade into the background colour, so the world dissolves at the
// horizon instead of ending at a visible edge.
fn horizonFade(worldPos : vec3f) -> f32 {
  let d = length(worldPos.xz - camera.eye.xz);
  return smoothstep(camera.params.y * 0.75, camera.params.y * 1.75, d);
}
`,Oe=`// GPU-side visibility and LOD selection.
//
// One thread per building. Each tests its own bounding box against the frustum
// and, if it survives, appends its index to one of two lists -- near, drawn as
// solid boxes, and far, drawn as billboards. The lists feed indirect draws, so
// the CPU never learns how many survived and never stalls to find out.
//
// This is the shape the real building renderer needs: at 100k instances,
// culling on the CPU means touching 100k structs every frame in JavaScript,
// and uploading the survivors is a megabyte of traffic per frame.
//
// A third outcome is silent: buildings whose projected height is under a pixel
// or two are dropped entirely. Detail culling like this is usually worth more
// than the LOD split, because a distant city is mostly buildings too small to
// resolve.

#include "common.wgsl"

struct Box {
  ground : vec4f,   // xy centre, zw half extents
  form   : vec4f,   // x base height, y building height
  tint   : vec4f,
};

// Matches GPURenderPassEncoder.drawIndirect's expected layout.
struct DrawArgs {
  vertexCount   : u32,
  instanceCount : atomic<u32>,
  firstVertex   : u32,
  firstInstance : u32,
};

@group(1) @binding(0) var<storage, read>       boxes    : array<Box>;
@group(1) @binding(1) var<storage, read_write> nearList : array<u32>;
@group(1) @binding(2) var<storage, read_write> farList  : array<u32>;
@group(1) @binding(3) var<storage, read_write> args     : array<DrawArgs, 2>;

fn visible(lo : vec3f, hi : vec3f) -> bool {
  for (var i = 0u; i < 6u; i++) {
    let p = camera.planes[i];
    // The corner furthest along the plane normal. If that one is behind the
    // plane, all eight are.
    let c = vec3f(
      select(lo.x, hi.x, p.x >= 0.0),
      select(lo.y, hi.y, p.y >= 0.0),
      select(lo.z, hi.z, p.z >= 0.0),
    );
    if (dot(p.xyz, c) + p.w < 0.0) { return false; }
  }
  return true;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&boxes)) { return; }

  let b = boxes[i];
  let lo = vec3f(b.ground.x - b.ground.z, b.form.x, b.ground.y - b.ground.w);
  let hi = vec3f(b.ground.x + b.ground.z, b.form.x + b.form.y, b.ground.y + b.ground.w);
  if (!visible(lo, hi)) { return; }

  let centre = vec3f(b.ground.x, b.form.x + b.form.y * 0.5, b.ground.y);
  let dist = max(length(centre - camera.eye.xyz), 0.001);

  // params.w is viewportHeight / (2 * tan(fovY / 2)): height in metres times
  // this over distance gives height in pixels.
  let pixels = b.form.y * camera.params.w / dist;
  if (pixels < MIN_PIXELS) { return; }

  if (dist < camera.params.z) {
    let slot = atomicAdd(&args[0].instanceCount, 1u);
    nearList[slot] = i;
  } else {
    let slot = atomicAdd(&args[1].instanceCount, 1u);
    farList[slot] = i;
  }
}

const MIN_PIXELS = 2.0;
`,ke=`// The terrain surface, and the grid drawn onto it.
//
// The grid is procedural rather than geometry: line width comes from
// screen-space derivatives, so a line stays one pixel wide whether the camera
// is 8 metres up or 1200. Drawing real lines would mean thousands of
// primitives that alias into moire on zoom-out.
//
// Spacings are the simulation's, not decoration: 8 m is the zoning cell the
// design doc specifies, 64 m is a city block. The city generator places
// buildings on the same grid, so ground and buildings agree by construction.

#include "common.wgsl"

const CELL  = 8.0;
const BLOCK = 64.0;

struct VSOut {
  @builtin(position) pos    : vec4f,
  @location(0)       world  : vec3f,
  @location(1)       normal : vec3f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.pos = camera.viewProj * vec4f(position, 1.0);
  return out;
}

// Anti-aliased grid: 1 where a line crosses this pixel, 0 between lines.
fn gridLine(xz : vec2f, spacing : f32) -> f32 {
  let c = xz / spacing;
  let d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2f(1e-6));
  return 1.0 - min(min(d.x, d.y), 1.0);
}

// Fades a grid out once its cells shrink towards pixel size. Without this the
// 8 m cells turn the whole map into grey mush the moment you zoom out -- the
// lines are still individually correct, there are just far too many of them.
fn densityFade(xz : vec2f, spacing : f32) -> f32 {
  let metresPerPixel = max(max(fwidth(xz.x), fwidth(xz.y)), 1e-6);
  return smoothstep(3.0, 14.0, spacing / metresPerPixel);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let sun = normalize(vec3f(0.45, 0.78, 0.32));

  // Grass in the flats, rock on the steep faces -- slope is the only input, so
  // it stays consistent when the player reshapes the ground later.
  let slope = 1.0 - clamp(n.y, 0.0, 1.0);
  let flat  = vec3f(0.074, 0.092, 0.104);
  let steep = vec3f(0.104, 0.098, 0.092);
  var col = mix(flat, steep, smoothstep(0.08, 0.42, slope));

  // The grid fades out on steep ground, where it would only read as noise.
  let gridStrength = 1.0 - smoothstep(0.10, 0.34, slope);
  let minor = vec3f(0.128, 0.155, 0.190);
  let major = vec3f(0.210, 0.265, 0.320);
  col = mix(col, minor, gridLine(in.world.xz, CELL) * 0.62 * gridStrength
                        * densityFade(in.world.xz, CELL));
  col = mix(col, major, gridLine(in.world.xz, BLOCK) * gridStrength
                        * densityFade(in.world.xz, BLOCK));

  // The world axes. Faded by the same density term as the grid: at grazing
  // angles a pixel covers hundreds of metres, so "within one pixel of x = 0"
  // becomes true across the whole horizon and the axis smears into a band.
  let ax = 1.0 - min(abs(in.world.x) / max(fwidth(in.world.x), 1e-6), 1.0);
  let az = 1.0 - min(abs(in.world.z) / max(fwidth(in.world.z), 1e-6), 1.0);
  col = mix(col, vec3f(0.290, 0.560, 0.720),
            max(ax, az) * gridStrength * densityFade(in.world.xz, CELL));

  let direct = max(dot(n, sun), 0.0) * 0.75;
  let hemi = mix(0.30, 0.52, n.y * 0.5 + 0.5);
  col = col * (direct + hemi) * 2.0;

  return vec4f(mix(col, SKY, horizonFade(in.world)), 1.0);
}
`,Ae=`// Instanced buildings, at two levels of detail.
//
// vs_solid draws the near ones as five-faced boxes. vs_impostor draws the far
// ones as a single camera-facing quad: at that distance a building is a few
// pixels wide and the silhouette is all that survives, so five faces of
// shading is work thrown away. Which list an instance lands in is decided by
// the culling pass in cull.wgsl, not here.
//
// Original note, still true of the near path:
// Instanced boxes -- the stand-in for buildings.
//
// This is the draw path the real building renderer will use, proved at a
// scale where mistakes are still cheap: one pipeline, one draw call, N
// instances, all per-instance data read from a storage buffer indexed by
// @builtin(instance_index). Swapping the hardcoded cube for a mesh out of an
// asset pack does not change the shape of any of this.
//
// The bottom face is omitted: 30 vertices instead of 36, and it is never
// visible on something standing on the ground.

#include "common.wgsl"

struct Box {
  // xy = centre on the ground plane, zw = half extents
  ground : vec4f,
  // x = base height (the terrain under it), y = building height
  form   : vec4f,
  // rgb = colour
  tint   : vec4f,
};

@group(1) @binding(0) var<storage, read> boxes : array<Box>;
// Indices chosen by the culling pass. The draw is indirect, so its length is
// only ever known on the GPU.
@group(1) @binding(1) var<storage, read> visible : array<u32>;

struct VSOut {
  @builtin(position) pos    : vec4f,
  @location(0)       normal : vec3f,
  @location(1)       world  : vec3f,
  @location(2)       colour : vec3f,
  @location(3)       up     : f32,   // 0 at the base, 1 at the roof
};

@vertex
fn vs_solid(@builtin(vertex_index) vi : u32,
      @builtin(instance_index) ii : u32) -> VSOut {
  // Five faces, two triangles each, wound counter-clockwise from outside.
  var P = array<vec3f, 30>(
    // +X
    vec3f( 1.0, 0.0,  1.0), vec3f( 1.0, 0.0, -1.0), vec3f( 1.0, 1.0, -1.0),
    vec3f( 1.0, 0.0,  1.0), vec3f( 1.0, 1.0, -1.0), vec3f( 1.0, 1.0,  1.0),
    // -X
    vec3f(-1.0, 0.0, -1.0), vec3f(-1.0, 0.0,  1.0), vec3f(-1.0, 1.0,  1.0),
    vec3f(-1.0, 0.0, -1.0), vec3f(-1.0, 1.0,  1.0), vec3f(-1.0, 1.0, -1.0),
    // +Z
    vec3f(-1.0, 0.0,  1.0), vec3f( 1.0, 0.0,  1.0), vec3f( 1.0, 1.0,  1.0),
    vec3f(-1.0, 0.0,  1.0), vec3f( 1.0, 1.0,  1.0), vec3f(-1.0, 1.0,  1.0),
    // -Z
    vec3f( 1.0, 0.0, -1.0), vec3f(-1.0, 0.0, -1.0), vec3f(-1.0, 1.0, -1.0),
    vec3f( 1.0, 0.0, -1.0), vec3f(-1.0, 1.0, -1.0), vec3f( 1.0, 1.0, -1.0),
    // +Y (roof)
    vec3f(-1.0, 1.0,  1.0), vec3f( 1.0, 1.0,  1.0), vec3f( 1.0, 1.0, -1.0),
    vec3f(-1.0, 1.0,  1.0), vec3f( 1.0, 1.0, -1.0), vec3f(-1.0, 1.0, -1.0),
  );
  var N = array<vec3f, 5>(
    vec3f(1.0, 0.0, 0.0), vec3f(-1.0, 0.0, 0.0),
    vec3f(0.0, 0.0, 1.0), vec3f(0.0, 0.0, -1.0),
    vec3f(0.0, 1.0, 0.0),
  );

  let box = boxes[visible[ii]];
  let local = P[vi];

  let world = vec3f(
    box.ground.x + local.x * box.ground.z,
    box.form.x + local.y * box.form.y,
    box.ground.y + local.z * box.ground.w,
  );

  var out : VSOut;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  out.normal = N[vi / 6u];
  out.world = world;
  out.colour = box.tint.rgb;
  out.up = local.y;
  return out;
}

// Far LOD: one quad, turned to face the camera about the vertical axis, sized
// to the building's footprint and height. Six vertices instead of thirty.
@vertex
fn vs_impostor(@builtin(vertex_index) vi : u32,
               @builtin(instance_index) ii : u32) -> VSOut {
  var Q = array<vec2f, 6>(
    vec2f(-1.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
    vec2f(-1.0, 0.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0),
  );

  let box = boxes[visible[ii]];
  let base = vec3f(box.ground.x, box.form.x, box.ground.y);

  // Yaw-only billboard: keeps verticals vertical, which a fully camera-facing
  // quad would not, and buildings read wrong the moment their edges lean.
  let toEye = normalize(vec3f(camera.eye.x - base.x, 0.0, camera.eye.z - base.z));
  let right = vec3f(-toEye.z, 0.0, toEye.x);
  let halfW = max(box.ground.z, box.ground.w);

  let q = Q[vi];
  let world = base + right * (q.x * halfW) + vec3f(0.0, q.y * box.form.y, 0.0);

  var out : VSOut;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  // Face the light as an average of the box's sides, so the LOD switch does
  // not show up as a brightness pop.
  out.normal = toEye;
  out.world = world;
  out.colour = box.tint.rgb;
  out.up = q.y;
  return out;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let sun = normalize(vec3f(0.45, 0.78, 0.32));
  let n = normalize(in.normal);

  // Lambert, plus a cheap sky/ground hemisphere term so the shaded sides do
  // not go flat black.
  let direct = max(dot(n, sun), 0.0) * 0.85;
  let hemi = mix(0.16, 0.34, n.y * 0.5 + 0.5);

  // Slight vertical gradient reads as height without any texture work.
  let vertical = mix(0.86, 1.06, in.up);

  var col = in.colour * (direct + hemi) * vertical;
  col = mix(col, SKY, horizonFade(in.world));
  return vec4f(col, 1.0);
}
`,V="depth24plus",Z=192,De=30,Re=6,_e=700,Ie=50*Math.PI/180,$=32;function Y(r){return r.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m,Te)}class Fe{constructor(e,t,n){this.gpu=e,this.camera=t,this.stats=n}res=null;cameraData=new Float32Array(Z/4);raf=0;startedAt=0;lastFrame=0;unsubscribeResize=null;running=!1;onUpdate=null;frustum=new ye;profiler=null;argsReset=new Uint32Array([De,0,0,0,Re,0,0,0]);drawnCounts=[0,0];countsPending=!1;build(){const{device:e,format:t}=this.gpu,n=e.createBindGroupLayout({label:"camera-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT|GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]}),s=e.createBindGroupLayout({label:"instance-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),o=e.createBindGroupLayout({label:"cull-bgl",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),a={format:V,depthWriteEnabled:!0,depthCompare:"less"},l=e.createShaderModule({label:"terrain",code:Y(ke)}),u=e.createRenderPipeline({label:"terrain-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:l,entryPoint:"vs",buffers:[{arrayStride:q*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:l,entryPoint:"fs",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:a}),p=e.createShaderModule({label:"box",code:Y(Ae)}),i=e.createPipelineLayout({bindGroupLayouts:[n,s]}),c=(O,I)=>e.createRenderPipeline({label:I,layout:i,vertex:{module:p,entryPoint:O},fragment:{module:p,entryPoint:"fs",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:a}),d=c("vs_solid","box-solid-pipeline"),h=c("vs_impostor","box-impostor-pipeline"),f=e.createComputePipeline({label:"cull-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[n,o]}),compute:{module:e.createShaderModule({label:"cull",code:Y(Oe)}),entryPoint:"main"}}),b=e.createBuffer({label:"camera-uniform",size:Z,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),m=e.createBindGroup({label:"camera-bg",layout:n,entries:[{binding:0,resource:{buffer:b}}]}),v=Ue(),E=e.createBuffer({label:"terrain-vertices",size:v.vertices.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(E,0,v.vertices);const M=e.createBuffer({label:"terrain-indices",size:v.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(M,0,v.indices);const w=ze(),P=e.createBuffer({label:"box-instances",size:w.data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(P,0,w.data);const C=Math.max(w.count,1)*4,x=e.createBuffer({label:"visible-near",size:C,usage:GPUBufferUsage.STORAGE}),U=e.createBuffer({label:"visible-far",size:C,usage:GPUBufferUsage.STORAGE}),L=e.createBuffer({label:"draw-args",size:$,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),ie=e.createBuffer({label:"draw-args-read",size:$,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),re=e.createBindGroup({label:"cull-bg",layout:o,entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:x}},{binding:2,resource:{buffer:U}},{binding:3,resource:{buffer:L}}]}),W=(O,I)=>e.createBindGroup({label:I,layout:s,entries:[{binding:0,resource:{buffer:P}},{binding:1,resource:{buffer:O}}]}),oe=W(x,"near-bg"),ae=W(U,"far-bg"),{depth:ce,depthView:le}=this.createDepth(this.gpu.viewport);this.profiler??=new Pe(e,["cull","draw"]),this.res={terrain:u,solid:d,impostor:h,cull:f,cameraBuffer:b,cameraGroup:m,vertexBuffer:E,indexBuffer:M,chunks:v.chunks,instanceBuffer:P,nearListBuffer:x,farListBuffer:U,drawArgsBuffer:L,drawArgsReadBuffer:ie,cullGroup:re,nearGroup:oe,farGroup:ae,depth:ce,depthView:le,instanceCount:w.count},this.unsubscribeResize?.(),this.unsubscribeResize=this.gpu.onResize(O=>this.onResize(O)),this.camera.groundHeight=B,this.camera.extent=g.size*.5-g.chunk,this.camera.setViewport(this.gpu.viewport.width,this.gpu.viewport.height),this.camera.update();const ue=w.count*se*4/1024,he=v.vertices.byteLength/1024/1024;y.info("render",`terrain ${v.chunks.length} chunks (${he.toFixed(1)} MiB), ${w.count.toLocaleString()} instances (${(ue/1024).toFixed(1)} MiB), depth ${V}`),y.info("render",this.profiler.enabled?"GPU timing available (timestamp-query)":"no timestamp-query: GPU times will read 0")}createDepth(e){const t=this.gpu.device.createTexture({label:"depth",size:{width:e.width,height:e.height},format:V,usage:GPUTextureUsage.RENDER_ATTACHMENT});return{depth:t,depthView:t.createView()}}onResize(e){if(this.camera.setViewport(e.width,e.height),this.camera.update(),!this.res)return;this.res.depth.destroy();const{depth:t,depthView:n}=this.createDepth(e);this.res.depth=t,this.res.depthView=n}start(e){if(e&&(this.onUpdate=e),this.running)return;this.running=!0,this.startedAt=performance.now(),this.lastFrame=this.startedAt;const t=n=>{this.running&&(this.raf=requestAnimationFrame(t),this.frame(n))};this.raf=requestAnimationFrame(t)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}frame(e){const t=this.res;if(!t)return;const n=Math.min((e-this.lastFrame)/1e3,.1);this.lastFrame=e,this.onUpdate?.(n);const s=performance.now(),{device:o,context:a,viewport:l}=this.gpu,u=this.camera;this.cameraData.set(u.viewProjMatrix,0),this.cameraData[16]=u.eye[0],this.cameraData[17]=u.eye[1],this.cameraData[18]=u.eye[2],this.cameraData[19]=u.far,this.cameraData[20]=(e-this.startedAt)/1e3,this.cameraData[21]=g.size*.5,this.cameraData[22]=_e,this.cameraData[23]=l.height/(2*Math.tan(Ie/2)),this.frustum.update(u.viewProjMatrix),this.cameraData.set(this.frustum.planes,24),o.queue.writeBuffer(t.cameraBuffer,0,this.cameraData),o.queue.writeBuffer(t.drawArgsBuffer,0,this.argsReset);const p=this.profiler?.writes("draw"),i=o.createCommandEncoder({label:"frame"}),c=this.profiler?.writes("cull"),d=i.beginComputePass(c?{label:"cull",timestampWrites:c}:{label:"cull"});d.setPipeline(t.cull),d.setBindGroup(0,t.cameraGroup),d.setBindGroup(1,t.cullGroup),d.dispatchWorkgroups(Math.ceil(t.instanceCount/64)),d.end();const h=i.beginRenderPass({label:"main",colorAttachments:[{view:a.getCurrentTexture().createView(),clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:t.depthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"},...p?{timestampWrites:p}:{}});h.setBindGroup(0,t.cameraGroup),h.setPipeline(t.terrain),h.setVertexBuffer(0,t.vertexBuffer),h.setIndexBuffer(t.indexBuffer,"uint32");let f=0;for(const m of t.chunks)this.frustum.containsBox(m.min,m.max)&&(h.drawIndexed(ne,1,0,m.baseVertex),f++);h.setPipeline(t.solid),h.setBindGroup(1,t.nearGroup),h.drawIndirect(t.drawArgsBuffer,0),h.setPipeline(t.impostor),h.setBindGroup(1,t.farGroup),h.drawIndirect(t.drawArgsBuffer,16),h.end(),this.countsPending||i.copyBufferToBuffer(t.drawArgsBuffer,0,t.drawArgsReadBuffer,0,$),this.profiler?.resolve(i),o.queue.submit([i.finish()]),this.profiler?.poll(),this.readDrawnCounts(t.drawArgsReadBuffer),this.stats.sample(performance.now()-s),this.stats.set("draws",String(f+2)),this.stats.set("chunks",`${f}/${t.chunks.length}`),this.profiler?.enabled&&(this.stats.set("gpu cull",this.profiler.ms("cull").toFixed(2)),this.stats.set("gpu draw",this.profiler.ms("draw").toFixed(2)));const b=this.drawnCounts[0]+this.drawnCounts[1];this.stats.set("buildings",`${b.toLocaleString()}/${t.instanceCount.toLocaleString()}`),this.stats.set("solid·imp",`${this.drawnCounts[0]}·${this.drawnCounts[1]}`),this.stats.set("zoom",`${u.distance.toFixed(0)}m`),this.stats.set("px",`${l.width}×${l.height}`),this.stats.paint(e)}readDrawnCounts(e){this.countsPending||(this.countsPending=!0,e.mapAsync(GPUMapMode.READ).then(()=>{const t=new Uint32Array(e.getMappedRange().slice(0));this.drawnCounts=[t[1],t[5]],e.unmap(),this.countsPending=!1},()=>{this.countsPending=!1}))}get buildingCount(){return this.res?.instanceCount??0}get drawn(){return this.drawnCounts}gpuMs(e){return this.profiler?.ms(e)??0}teardown(){this.stop(),this.res&&(this.res.depth.destroy(),this.res.cameraBuffer.destroy(),this.res.vertexBuffer.destroy(),this.res.indexBuffer.destroy(),this.res.instanceBuffer.destroy(),this.res.nearListBuffer.destroy(),this.res.farListBuffer.destroy(),this.res.drawArgsBuffer.destroy(),this.res.drawArgsReadBuffer.destroy(),this.res=null)}}const Ve=50*Math.PI/180,$e=[0,1,0],G={minDistance:8,maxDistance:3400,minPitch:12*Math.PI/180,maxPitch:88*Math.PI/180,extent:2900};class Ye{focus=[0,0,0];distance=120;yaw=Math.PI*.25;pitch=45*Math.PI/180;near=.5;far=6e3;groundHeight=null;extent=G.extent;view=D();proj=D();viewProj=D();invViewProj=D();eye=[0,0,0];aspect=1;scratch=[0,0,0];setViewport(e,t){this.aspect=e/Math.max(t,1)}update(){this.pitch=T(this.pitch,G.minPitch,G.maxPitch),this.distance=T(this.distance,G.minDistance,G.maxDistance),this.focus[0]=T(this.focus[0],-this.extent,this.extent),this.focus[2]=T(this.focus[2],-this.extent,this.extent),this.focus[1]=this.groundHeight?this.groundHeight(this.focus[0],this.focus[2]):0;const e=Math.cos(this.pitch);this.eye[0]=this.focus[0]+this.distance*e*Math.sin(this.yaw),this.eye[1]=this.focus[1]+this.distance*Math.sin(this.pitch),this.eye[2]=this.focus[2]+this.distance*e*Math.cos(this.yaw),this.near=Math.max(.25,this.distance*.01),this.far=this.distance*12+2e3,de(this.view,this.eye,this.focus,$e),fe(this.proj,Ve,this.aspect,this.near,this.far),pe(this.viewProj,this.proj,this.view),me(this.invViewProj,this.viewProj)}groundPointAt(e,t,n=[0,0,0]){const s=X(this.scratch,this.invViewProj,e,t,0),o=s[0],a=s[1],l=s[2],u=X(this.scratch,this.invViewProj,e,t,1),p=this.focus[1],i=u[1]-a;if(Math.abs(i)<1e-6)return null;const c=(p-a)/i;return c<0||c>1?null:(n[0]=o+(u[0]-o)*c,n[1]=p,n[2]=l+(u[2]-l)*c,n)}panBy(e,t){const n=Math.sin(this.yaw),s=Math.cos(this.yaw);this.focus[0]+=e*s-t*n,this.focus[2]+=-e*n-t*s}zoomBy(e){this.distance=T(this.distance*e,G.minDistance,G.maxDistance)}get viewProjMatrix(){return this.viewProj}}const Q=.006,je=1.4,R=1.6,J=1.9,qe=.0016;class Ne{constructor(e,t){this.canvas=e,this.camera=t,this.on(e,"pointerdown",this.onPointerDown),this.on(e,"pointermove",this.onPointerMove),this.on(e,"pointerup",this.onPointerUp),this.on(e,"pointercancel",this.onPointerUp),this.on(e,"wheel",this.onWheel,{passive:!1}),this.on(e,"contextmenu",n=>n.preventDefault()),this.on(window,"keydown",this.onKeyDown),this.on(window,"keyup",this.onKeyUp),this.on(window,"blur",()=>this.keys.clear())}mode="none";pointers=new Map;lastX=0;lastY=0;pinchDistance=0;keys=new Set;grabPoint=[0,0,0];a=[0,0,0];b=[0,0,0];disposers=[];on(e,t,n,s){e.addEventListener(t,n,s),this.disposers.push(()=>e.removeEventListener(t,n,s))}ndc(e,t){const n=this.canvas.getBoundingClientRect();return[(e-n.left)/Math.max(n.width,1)*2-1,1-(t-n.top)/Math.max(n.height,1)*2]}onPointerDown=e=>{if(this.canvas.setPointerCapture(e.pointerId),this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.canvas.focus(),this.pointers.size===2){this.mode="none",this.pinchDistance=this.pointerSpread();return}const t=e.button===1||e.button===2||e.shiftKey||e.altKey;if(this.mode=t?"orbit":"pan",this.lastX=e.clientX,this.lastY=e.clientY,this.mode==="pan"){const[n,s]=this.ndc(e.clientX,e.clientY);this.camera.groundPointAt(n,s,this.grabPoint)||(this.mode="none")}};onPointerMove=e=>{const t=this.pointers.get(e.pointerId);if(t){if(t.x=e.clientX,t.y=e.clientY,this.pointers.size===2){const n=this.pointerSpread();this.pinchDistance>0&&n>0&&(this.camera.zoomBy(T(this.pinchDistance/n,.5,2)),this.camera.update()),this.pinchDistance=n;return}if(this.mode==="orbit"){this.camera.yaw-=(e.clientX-this.lastX)*Q,this.camera.pitch+=(e.clientY-this.lastY)*Q,this.lastX=e.clientX,this.lastY=e.clientY,this.camera.update();return}if(this.mode==="pan"){const[n,s]=this.ndc(e.clientX,e.clientY),o=this.camera.groundPointAt(n,s,this.a);if(!o)return;this.camera.focus[0]+=this.grabPoint[0]-o[0],this.camera.focus[2]+=this.grabPoint[2]-o[2],this.camera.update()}}};onPointerUp=e=>{this.pointers.delete(e.pointerId),this.canvas.hasPointerCapture(e.pointerId)&&this.canvas.releasePointerCapture(e.pointerId),this.pointers.size<2&&(this.pinchDistance=0),this.pointers.size===0&&(this.mode="none")};pointerSpread(){const e=this.pointers.values(),t=e.next().value,n=e.next().value;return!t||!n?0:Math.hypot(t.x-n.x,t.y-n.y)}onWheel=e=>{e.preventDefault();const[t,n]=this.ndc(e.clientX,e.clientY),s=e.deltaMode===1?e.deltaY*33:e.deltaY,o=this.camera.groundPointAt(t,n,this.a);this.camera.zoomBy(Math.exp(s*qe)),this.camera.update();const a=this.camera.groundPointAt(t,n,this.b);o&&a&&(this.camera.focus[0]+=o[0]-a[0],this.camera.focus[2]+=o[2]-a[2],this.camera.update())};onKeyDown=e=>{e.metaKey||e.ctrlKey||this.keys.add(e.key.toLowerCase())};onKeyUp=e=>{this.keys.delete(e.key.toLowerCase())};update(e){if(this.keys.size===0)return!1;const t=this.keys,n=this.camera;let s=!1;const o=je*n.distance*e;let a=0,l=0;return(t.has("a")||t.has("arrowleft"))&&(a-=o),(t.has("d")||t.has("arrowright"))&&(a+=o),(t.has("w")||t.has("arrowup"))&&(l+=o),(t.has("s")||t.has("arrowdown"))&&(l-=o),(a||l)&&(n.panBy(a,l),s=!0),t.has("q")&&(n.yaw+=R*e,s=!0),t.has("e")&&(n.yaw-=R*e,s=!0),t.has("r")&&(n.pitch+=R*e,s=!0),t.has("f")&&(n.pitch-=R*e,s=!0),(t.has("=")||t.has("+"))&&(n.zoomBy(Math.exp(-J*e)),s=!0),(t.has("-")||t.has("_"))&&(n.zoomBy(Math.exp(J*e)),s=!0),s&&n.update(),s}dispose(){for(const e of this.disposers)e();this.disposers=[]}}class We{el;samples=new Float32Array(120);cursor=0;lastPaint=0;rows=new Map;constructor(e){this.el=document.createElement("div"),this.el.style.cssText=["position:absolute","top:10px","left:12px","padding:8px 11px","background:rgba(6,9,13,.72)","border:1px solid rgba(98,212,255,.16)","border-radius:3px","font:11px/1.6 var(--mono)","color:#8fa3bd","pointer-events:none","white-space:pre","letter-spacing:.02em"].join(";"),e.appendChild(this.el)}sample(e){this.samples[this.cursor]=e,this.cursor=(this.cursor+1)%this.samples.length}set(e,t){this.rows.set(e,t)}paint(e){if(e-this.lastPaint<250)return;this.lastPaint=e;let t=0,n=0;for(const a of this.samples)t+=a,a>n&&(n=a);const s=t/this.samples.length,o=[`${(1e3/Math.max(s,.001)).toFixed(0).padStart(4)} fps`,`${s.toFixed(2).padStart(5)} ms  avg`,`${n.toFixed(2).padStart(5)} ms  peak`];for(const[a,l]of this.rows)o.push(`${l.padStart(5)}  ${a}`);this.el.textContent=o.join(`
`)}}const Xe={"no-webgpu":"This browser has no WebGPU","no-adapter":"No compatible GPU found","no-device":"The GPU refused to start","device-lost":"Lost connection to the GPU",internal:"Something broke during startup"};function Ke(r){const e=navigator.userAgent,t=/Chrome|Chromium|Edg\//.test(e)&&!/OPR\//.test(e),n=/Firefox\//.test(e),s=/Safari\//.test(e)&&!/Chrome|Chromium|Edg\//.test(e);return r==="no-webgpu"?n?["Firefox ships WebGPU on Windows from version 141. On macOS and Linux it is still behind a flag.","Open about:config and set dom.webgpu.enabled to true, then reload.","Or use Chrome, Edge, or Safari 18+."]:s?["Safari supports WebGPU from version 18 (macOS Sequoia, iOS 18).","On older Safari: Develop → Feature Flags → enable WebGPU."]:t?["Chrome and Edge support WebGPU from version 113, so this is unusual.","Check chrome://gpu — WebGPU may be blocklisted for this GPU or driver.","Updating your graphics driver is the usual fix."]:["Try a recent Chrome, Edge, or Safari 18+."]:r==="no-adapter"?["The browser has WebGPU but could not find a usable GPU.","This is common in virtual machines, remote desktops, and on Linux without a working Vulkan driver.",t?"Check chrome://gpu for the reason it was rejected.":"Check your browser’s GPU diagnostics page."]:r==="device-lost"?["The GPU process crashed or was reset — usually a driver timeout or the machine waking from sleep.","Reloading normally fixes it. If it happens repeatedly, update your graphics driver."]:["Reload to try again. If it keeps happening, the details below are worth reporting."]}function k(r,e){const t=document.getElementById("boot");t&&t.classList.remove("done");const n=t??document.body;n.innerHTML="",n.style.cssText+=";display:grid;place-content:center;padding:32px;text-align:left;max-width:min(680px,92vw);margin:0 auto;";const s=document.createElement("h1");s.textContent=Xe[r],s.style.cssText="font:500 15px/1.4 var(--mono);letter-spacing:.06em;color:var(--err);text-transform:none;margin-bottom:14px;",n.appendChild(s);const o=document.createElement("div");o.style.cssText="color:var(--fg);font-size:13px;line-height:1.75;";for(const l of Ke(r)){const u=document.createElement("p");u.textContent=l,u.style.cssText="margin-bottom:8px;",o.appendChild(u)}if(n.appendChild(o),e){const l=document.createElement("pre");l.textContent=e,l.style.cssText="margin-top:20px;padding:12px 14px;background:rgba(255,107,122,.07);border-left:2px solid var(--err);color:var(--dim);font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;",n.appendChild(l)}const a=document.createElement("p");a.innerHTML='Reported at <a href="https://github.com/maksimsysak3-ui/Subnautica-2/issues" style="color:var(--accent)">github.com/maksimsysak3-ui/Subnautica-2</a>',a.style.cssText="margin-top:22px;color:var(--dim);font-size:11px;",n.appendChild(a)}const A=[{name:"street",distance:60,pitch:22},{name:"district",distance:260,pitch:30},{name:"downtown",distance:700,pitch:38},{name:"city",distance:1600,pitch:46},{name:"whole map",distance:3200,pitch:58}],j=600,ee=1400;class He{constructor(e,t,n){this.camera=e,this.renderer=t,this.onFinish=n,this.apply(),y.info("bench",`running ${A.length} stops, about ${((j+ee)*A.length/1e3).toFixed(0)}s`)}index=0;elapsed=0;samples=[];gpuCull=[];gpuDraw=[];results=[];done=!1;apply(){const e=A[this.index];this.camera.focus[0]=0,this.camera.focus[2]=0,this.camera.distance=e.distance,this.camera.pitch=e.pitch*Math.PI/180,this.camera.update()}update(e){if(this.done)return;const t=e*1e3;if(this.elapsed+=t,this.camera.yaw+=e*.25,this.camera.update(),this.elapsed>j&&(this.samples.push(t),this.gpuCull.push(this.renderer.gpuMs("cull")),this.gpuDraw.push(this.renderer.gpuMs("draw"))),!(this.elapsed<j+ee)){if(this.record(),this.index++,this.index>=A.length){this.done=!0,this.onFinish(this.results);return}this.elapsed=0,this.samples=[],this.gpuCull=[],this.gpuDraw=[],this.apply()}}record(){const e=A[this.index],t=a=>a.length?a.reduce((l,u)=>l+u,0)/a.length:0,n=t(this.samples),[s,o]=this.renderer.drawn;this.results.push({name:e.name,distance:e.distance,fps:n>0?1e3/n:0,cpuMs:n,gpuCullMs:t(this.gpuCull),gpuDrawMs:t(this.gpuDraw),drawnNear:s,drawnFar:o})}}function Ze(r,e){const t=(s,o)=>s.padStart(o),n=[`citysim benchmark — ${e.toLocaleString()} buildings`,`${navigator.userAgent}`,"","stop        dist    fps   frame   gpu cull   gpu draw    drawn"];for(const s of r)n.push(s.name.padEnd(10)+t(`${s.distance}m`,7)+t(s.fps.toFixed(0),7)+t(`${s.cpuMs.toFixed(1)}ms`,8)+t(s.gpuCullMs?`${s.gpuCullMs.toFixed(2)}ms`:"—",11)+t(s.gpuDrawMs?`${s.gpuDrawMs.toFixed(2)}ms`:"—",11)+t((s.drawnNear+s.drawnFar).toLocaleString(),9));return n.join(`
`)}const te=3;window.__citysimBooted=!0;function _(r){const e=document.getElementById("boot-status");e&&(e.textContent=r)}async function Qe(){const r=document.getElementById("overlay"),e=document.getElementById("gpu-canvas");if(!r||!(e instanceof HTMLCanvasElement)){k("internal","index.html is missing #gpu-canvas or #overlay");return}ge(r),new URLSearchParams(location.search).has("lite")&&(Ee(Be),y.info("boot","lite world: reduced city and terrain")),y.info("boot",`citysim starting, ua=${navigator.userAgent}`),y.info("boot",`crossOriginIsolated=${crossOriginIsolated} sharedArrayBuffer=${typeof SharedArrayBuffer<"u"}`),crossOriginIsolated||y.info("boot","not cross-origin isolated (expected): SharedArrayBuffer unavailable"),_("requesting GPU…");let n;try{n=await be.create(e)}catch(i){i instanceof ve?(y.error("boot",`${i.kind}: ${i.message}`),k(i.kind,i.message)):(y.error("boot",String(i)),k("internal",i instanceof Error?i.stack??i.message:String(i)));return}_("building the city…");const s=new We(r);s.set("isolated",crossOriginIsolated?"yes":"no");const o=new Ye,a=new Ne(e,o),l=new Fe(n,o,s);l.build();let u=0;n.onLost(async i=>{if(l.teardown(),i.reason!=="destroyed"){if(++u>te){k("device-lost",`${i.message}

gave up after ${te} attempts`);return}_("recovering GPU…");try{await n.recover(),l.build(),l.start(c=>a.update(c)),_(""),document.getElementById("boot")?.classList.add("done")}catch(c){k("device-lost",String(c))}}}),document.addEventListener("visibilitychange",()=>{document.hidden?l.stop():l.start()});const p=new URLSearchParams(location.search).has("bench")?new He(o,l,i=>{const c=Ze(i,l.buildingCount);for(const d of c.split(`
`))y.info("bench",d);Je(c)}):null;l.start(i=>{a.update(i),p?.update(i)}),e.focus(),document.getElementById("boot")?.classList.add("done"),y.info("boot","running — drag to pan, right-drag to orbit, wheel to zoom")}function Je(r){const e=document.createElement("pre");e.textContent=r+`

(click to copy)`,e.style.cssText=["position:fixed","left:50%","top:50%","transform:translate(-50%,-50%)","padding:18px 22px","background:rgba(6,9,13,.94)","border:1px solid rgba(98,212,255,.22)","border-radius:4px","font:12px/1.6 var(--mono)","color:#c9d4e3","z-index:30","cursor:pointer","white-space:pre","max-width:92vw","overflow:auto"].join(";"),e.addEventListener("click",()=>{navigator.clipboard?.writeText(r),e.remove()}),document.body.appendChild(e)}addEventListener("error",r=>y.error("window",`${r.message} @ ${r.filename}:${r.lineno}`));addEventListener("unhandledrejection",r=>y.error("window",`unhandled rejection: ${String(r.reason)}`));Qe();
//# sourceMappingURL=main-bXPE82Or.js.map
