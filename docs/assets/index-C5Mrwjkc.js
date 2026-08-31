(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))t(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&t(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function t(i){if(i.ep)return;i.ep=!0;const r=n(i);fetch(i.href,r)}})();const ee={debug:0,info:1,warn:2,error:3},ve={debug:"#5d6b80",info:"#c9d4e3",warn:"#ffb454",error:"#ff6b7a"},we=256,_=[];let me="debug",L=null,H=!1;function V(s,e,n){if(ee[s]<ee[me])return;_.push({t:performance.now(),level:s,scope:e,msg:n}),_.length>we&&_.shift(),H=!0;const t=`[${e}] ${n}`;s==="error"?console.error(t):s==="warn"?console.warn(t):console.log(t)}const p={debug:(s,e)=>V("debug",s,e),info:(s,e)=>V("info",s,e),warn:(s,e)=>V("warn",s,e),error:(s,e)=>V("error",s,e),setLevel:s=>{me=s},entries:()=>_};function xe(s){L=document.createElement("div"),L.style.cssText=["position:absolute","left:0","bottom:0","width:100%","max-height:45%","overflow:hidden","padding:8px 12px","background:rgba(6,9,13,.92)","border-top:1px solid rgba(98,212,255,.18)","font:11px/1.55 var(--mono)","white-space:pre-wrap","display:none","pointer-events:none"].join(";"),s.appendChild(L),addEventListener("keydown",n=>{n.key!=="`"||n.metaKey||n.ctrlKey||L&&(L.style.display=L.style.display==="none"?"block":"none",H=!0)});const e=()=>{L&&H&&L.style.display!=="none"&&(L.innerHTML=_.slice(-40).map(n=>`<span style="color:#3d4757">${(n.t/1e3).toFixed(2).padStart(7)}</span> <span style="color:${ve[n.level]}">[${n.scope}] ${be(n.msg)}</span>`).join("<br>"),H=!1),requestAnimationFrame(e)};requestAnimationFrame(e)}function be(s){return s.replace(/[&<>]/g,e=>e==="&"?"&amp;":e==="<"?"&lt;":"&gt;")}const ye={maxBufferSize:512*1024*1024,maxStorageBufferBindingSize:512*1024*1024,maxTextureDimension2D:8192,maxTextureArrayLayers:256,maxStorageBuffersPerShaderStage:8,maxSampledTexturesPerShaderStage:16,maxComputeWorkgroupStorageSize:16384,maxComputeInvocationsPerWorkgroup:256},Pe={maxBufferSize:128*1024*1024,maxStorageBufferBindingSize:128*1024*1024,maxTextureDimension2D:4096};function te(s){const e={};for(const[n,t]of Object.entries(ye)){const i=s.limits[n];typeof i=="number"&&(e[n]=Math.min(t,i))}return e}function ne(s){return["timestamp-query","texture-compression-bc","texture-compression-astc","indirect-first-instance"].filter(n=>s.features.has(n))}function se(s){return`${(s/1024/1024).toFixed(0)} MiB`}function Se(s,e){const n=s.info;if(n){const t=[n.vendor,n.architecture,n.device,n.description].filter(i=>i&&i.length>0).join(" / ");p.info("caps",`adapter: ${t||"(no info exposed)"}`)}p.info("caps",`features: ${[...e.features].join(", ")||"(none)"}`),p.info("caps",`buffers: max ${se(e.limits.maxBufferSize)}, storage binding ${se(e.limits.maxStorageBufferBindingSize)}`),p.info("caps",`textures: ${e.limits.maxTextureDimension2D}px 2D, ${e.limits.maxTextureArrayLayers} array layers`),p.info("caps",`compute: ${e.limits.maxComputeInvocationsPerWorkgroup} invocations/wg, ${e.limits.maxComputeWorkgroupStorageSize}B shared`);for(const[t,i]of Object.entries(Pe)){const r=e.limits[t];typeof r=="number"&&r<i&&p.warn("caps",`${t} is ${r}, below the ${i} the design budgets assume`)}e.features.has("timestamp-query")||p.warn("caps","no timestamp-query: GPU timings in the budget HUD will be unavailable")}class A extends Error{constructor(e,n){super(n),this.kind=e,this.name="GpuInitError"}}const ie=2;class J{constructor(e,n,t,i,r){this.canvas=e,this.adapter=n,this.device=t,this.context=i,this.format=r}viewport={width:1,height:1,dpr:1};resizeHandlers=new Set;lostHandlers=new Set;observer=null;destroyed=!1;static async create(e){if(!("gpu"in navigator)||!navigator.gpu)throw new A("no-webgpu","navigator.gpu is undefined");const n=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!n)throw new A("no-adapter","requestAdapter() returned null");let t;try{t=await n.requestDevice({label:"citysim-device",requiredFeatures:ne(n),requiredLimits:te(n)})}catch(a){throw new A("no-device",String(a))}const i=e.getContext("webgpu");if(!i)throw new A("no-device",'canvas.getContext("webgpu") returned null');const r=navigator.gpu.getPreferredCanvasFormat(),o=new J(e,n,t,i,r);return Se(n,t),p.info("gpu",`canvas format: ${r}`),o.configure(),o.watchResize(),o.watchLoss(),o.watchErrors(),o}configure(){this.context.configure({device:this.device,format:this.format,alphaMode:"opaque",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}watchResize(){this.observer=new ResizeObserver(e=>{const n=e[0];n&&this.applySize(n)});try{this.observer.observe(this.canvas,{box:"device-pixel-content-box"})}catch{this.observer.observe(this.canvas)}this.resizeNow()}applySize(e){const n=Math.min(devicePixelRatio||1,ie),t=e.devicePixelContentBoxSize?.[0];let i,r;t?(i=t.inlineSize,r=t.blockSize):(i=Math.round(e.contentRect.width*n),r=Math.round(e.contentRect.height*n)),this.setSize(i,r,n)}resizeNow(){const e=Math.min(devicePixelRatio||1,ie),n=this.canvas.getBoundingClientRect();this.setSize(Math.round(n.width*e),Math.round(n.height*e),e)}setSize(e,n,t){const i=this.device.limits.maxTextureDimension2D,r=Math.max(1,Math.min(e,i)),o=Math.max(1,Math.min(n,i));if(!(r===this.viewport.width&&o===this.viewport.height)){this.canvas.width=r,this.canvas.height=o,this.viewport.width=r,this.viewport.height=o,this.viewport.dpr=t,p.debug("gpu",`viewport ${r}x${o} @${t}x`);for(const a of this.resizeHandlers)a(this.viewport)}}onResize(e){return this.resizeHandlers.add(e),()=>this.resizeHandlers.delete(e)}watchLoss(){this.device.lost.then(e=>{if(!(this.destroyed||e.reason==="destroyed")){p.error("gpu",`device lost: ${e.reason} -- ${e.message}`);for(const n of this.lostHandlers)n(e)}})}watchErrors(){this.device.addEventListener("uncapturederror",e=>{const n=e.error;p.error("gpu",`uncaptured ${n.constructor.name}: ${n.message}`)})}onLost(e){this.lostHandlers.add(e)}async recover(){p.warn("gpu","attempting device recovery");const e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!e)throw new A("no-adapter","no adapter on recovery");this.adapter=e,this.device=await e.requestDevice({label:"citysim-device (recovered)",requiredFeatures:ne(e),requiredLimits:te(e)}),this.configure(),this.watchLoss(),this.watchErrors(),p.info("gpu","device recovered")}destroy(){this.destroyed=!0,this.observer?.disconnect(),this.observer=null,this.resizeHandlers.clear(),this.lostHandlers.clear(),this.device.destroy()}}class ze{planes=new Float32Array(24);update(e){const n=this.planes,t=(r,o)=>e[o*4+r],i=(r,o,a,c,l)=>{const h=Math.hypot(o,a,c)||1;n[r]=o/h,n[r+1]=a/h,n[r+2]=c/h,n[r+3]=l/h};i(0,t(3,0)+t(0,0),t(3,1)+t(0,1),t(3,2)+t(0,2),t(3,3)+t(0,3)),i(4,t(3,0)-t(0,0),t(3,1)-t(0,1),t(3,2)-t(0,2),t(3,3)-t(0,3)),i(8,t(3,0)+t(1,0),t(3,1)+t(1,1),t(3,2)+t(1,2),t(3,3)+t(1,3)),i(12,t(3,0)-t(1,0),t(3,1)-t(1,1),t(3,2)-t(1,2),t(3,3)-t(1,3)),i(16,t(2,0),t(2,1),t(2,2),t(2,3)),i(20,t(3,0)-t(2,0),t(3,1)-t(2,1),t(3,2)-t(2,2),t(3,3)-t(2,3))}containsBox(e,n){const t=this.planes;for(let i=0;i<24;i+=4){const r=t[i],o=t[i+1],a=t[i+2],c=r>=0?n[0]:e[0],l=o>=0?n[1]:e[1],h=a>=0?n[2]:e[2];if(r*c+o*l+a*h+t[i+3]<0)return!1}return!0}}function T(s,e,n){let t=Math.imul(s,374761393)+Math.imul(e,668265263)+Math.imul(n,2246822519)>>>0;return t=Math.imul(t^t>>>13,1274126177)>>>0,((t^t>>>16)>>>0)/4294967296}const re=s=>s*s*(3-2*s);function Ee(s,e,n){const t=Math.floor(s),i=Math.floor(e),r=re(s-t),o=re(e-i),a=T(t,i,n),c=T(t+1,i,n),l=T(t,i+1,n),h=T(t+1,i+1,n);return(a+(c-a)*r)*(1-o)+(l+(h-l)*r)*o}function oe(s,e,n,t){let i=0,r=1,o=0,a=1;for(let c=0;c<n;c++)i+=Ee(s*a,e*a,t+c*31)*r,o+=r,r*=.5,a*=2.03;return i/o}const b={size:2048,chunk:128,res:32},j=b.size/b.chunk,Me=b.res+1,W=b.res*b.res*6,Z=6;function C(s,e){const n=.0015625,t=(oe(s*n,e*n,5,101)-.5)*2,i=(oe(s*n*3.7,e*n*3.7,3,233)-.5)*2,r=Math.min(Math.hypot(s,e)/(b.size*.5),1),o=Math.pow(Math.max(0,(r-.05)/.95),1.05);return(t*98+i*24)*o}function Ce(s,e,n){const i=C(s+2,e)-C(s-2,e),r=C(s,e+2)-C(s,e-2),o=Math.hypot(i,4,r)||1;n[0]=-i/o,n[1]=4/o,n[2]=-r/o}function Be(){const s=Me,e=s*s,n=j*j,t=b.chunk/b.res,i=b.size/2,r=new Float32Array(n*e*Z),o=[],a=[0,0,0];let c=0;for(let d=0;d<j;d++)for(let u=0;u<j;u++){const m=c/Z,g=u*b.chunk-i,f=d*b.chunk-i;let v=1/0,z=-1/0;for(let y=0;y<s;y++)for(let S=0;S<s;S++){const E=g+S*t,M=f+y*t,w=C(E,M);Ce(E,M,a),r[c++]=E,r[c++]=w,r[c++]=M,r[c++]=a[0],r[c++]=a[1],r[c++]=a[2],w<v&&(v=w),w>z&&(z=w)}o.push({baseVertex:m,min:[g,v,f],max:[g+b.chunk,z,f+b.chunk]})}const l=new Uint32Array(W);let h=0;for(let d=0;d<b.res;d++)for(let u=0;u<b.res;u++){const m=d*s+u,g=m+1,f=m+s,v=f+1;l[h++]=m,l[h++]=f,l[h++]=g,l[h++]=g,l[h++]=f,l[h++]=v}return{vertices:r,indices:l,chunks:o}}const ge=12,P=8,ae=6,K=84,ce=.55;function Le(){const s=K/2,e=[];for(let t=0;t<K;t++)for(let i=0;i<K;i++){if(t%(ae+1)===0||i%(ae+1)===0||T(t,i,1)<.12)continue;const o=(t-s)*P+P/2,a=(i-s)*P+P/2,c=C(o-P/2,a-P/2),l=C(o+P/2,a-P/2),h=C(o-P/2,a+P/2),d=C(o+P/2,a+P/2),u=Math.min(c,l,h,d);if(Math.max(c,l,h,d)-u>4.5)continue;const g=Math.hypot(o,a)/(s*P),f=Math.max(0,1-g*1.35),v=T(t,i,7),y=9+T(t,i,3)*13+f*f*74*(.4+v*.8),S=1-Math.min(y/340,.16),E=(P/2-ce)*S,M=(P/2-ce)*S,w=Math.min(y/80,1),B=(T(t,i,11)-.5)*.06,D=.2+w*.34+B,O=.24+w*.36+B,U=.3+w*.38+B;e.push(o,a,E,M,u-1.2,y+1.2,0,0,D,O,U,1)}const n=new Float32Array(e.length);return n.set(e),{data:n,count:e.length/ge}}const ke=`// Shared camera binding. Every pipeline binds this as group 0.

struct Camera {
  viewProj : mat4x4f,
  eye      : vec4f,   // xyz = eye position, w = far plane
  params   : vec4f,   // x = time, y = ground extent, z,w = unused
};

@group(0) @binding(0) var<uniform> camera : Camera;

const SKY = vec3f(0.043, 0.055, 0.075);

// Distance fade into the background colour, so the world dissolves at the
// horizon instead of ending at a visible edge.
fn horizonFade(worldPos : vec3f) -> f32 {
  let d = length(worldPos.xz - camera.eye.xz);
  return smoothstep(camera.params.y * 0.75, camera.params.y * 1.75, d);
}
`,Te=`// The terrain surface, and the grid drawn onto it.
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
`,De=`// Instanced boxes -- the stand-in for buildings.
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

struct VSOut {
  @builtin(position) pos    : vec4f,
  @location(0)       normal : vec3f,
  @location(1)       world  : vec3f,
  @location(2)       colour : vec3f,
  @location(3)       up     : f32,   // 0 at the base, 1 at the roof
};

@vertex
fn vs(@builtin(vertex_index) vi : u32,
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

  let box = boxes[ii];
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
`,X="depth24plus",he=96;function le(s){return s.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m,ke)}class Oe{constructor(e,n,t){this.gpu=e,this.camera=n,this.stats=t}res=null;cameraData=new Float32Array(he/4);raf=0;startedAt=0;lastFrame=0;unsubscribeResize=null;running=!1;onUpdate=null;frustum=new ze;build(){const{device:e,format:n}=this.gpu,t=e.createBindGroupLayout({label:"camera-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),i=e.createBindGroupLayout({label:"instance-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),r={format:X,depthWriteEnabled:!0,depthCompare:"less"},o=e.createShaderModule({label:"terrain",code:le(Te)}),a=e.createRenderPipeline({label:"terrain-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[t]}),vertex:{module:o,entryPoint:"vs",buffers:[{arrayStride:Z*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:o,entryPoint:"fs",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:r}),c=e.createShaderModule({label:"box",code:le(De)}),l=e.createRenderPipeline({label:"box-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[t,i]}),vertex:{module:c,entryPoint:"vs"},fragment:{module:c,entryPoint:"fs",targets:[{format:n}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:r}),h=e.createBuffer({label:"camera-uniform",size:he,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),d=e.createBindGroup({label:"camera-bg",layout:t,entries:[{binding:0,resource:{buffer:h}}]}),u=Be(),m=e.createBuffer({label:"terrain-vertices",size:u.vertices.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(m,0,u.vertices);const g=e.createBuffer({label:"terrain-indices",size:u.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(g,0,u.indices);const f=Le(),v=e.createBuffer({label:"box-instances",size:f.data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(v,0,f.data);const z=e.createBindGroup({label:"instance-bg",layout:i,entries:[{binding:0,resource:{buffer:v}}]}),{depth:y,depthView:S}=this.createDepth(this.gpu.viewport);this.res={terrain:a,boxes:l,cameraBuffer:h,cameraGroup:d,vertexBuffer:m,indexBuffer:g,chunks:u.chunks,instanceBuffer:v,instanceGroup:z,depth:y,depthView:S,instanceCount:f.count},this.unsubscribeResize?.(),this.unsubscribeResize=this.gpu.onResize(w=>this.onResize(w)),this.camera.groundHeight=C,this.camera.setViewport(this.gpu.viewport.width,this.gpu.viewport.height),this.camera.update();const E=f.count*ge*4/1024,M=u.vertices.byteLength/1024/1024;p.info("render",`terrain ${u.chunks.length} chunks (${M.toFixed(1)} MiB), ${f.count} instances (${E.toFixed(0)} KiB), depth ${X}`)}createDepth(e){const n=this.gpu.device.createTexture({label:"depth",size:{width:e.width,height:e.height},format:X,usage:GPUTextureUsage.RENDER_ATTACHMENT});return{depth:n,depthView:n.createView()}}onResize(e){if(this.camera.setViewport(e.width,e.height),this.camera.update(),!this.res)return;this.res.depth.destroy();const{depth:n,depthView:t}=this.createDepth(e);this.res.depth=n,this.res.depthView=t}start(e){if(e&&(this.onUpdate=e),this.running)return;this.running=!0,this.startedAt=performance.now(),this.lastFrame=this.startedAt;const n=t=>{this.running&&(this.raf=requestAnimationFrame(n),this.frame(t))};this.raf=requestAnimationFrame(n)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}frame(e){const n=this.res;if(!n)return;const t=Math.min((e-this.lastFrame)/1e3,.1);this.lastFrame=e,this.onUpdate?.(t);const i=performance.now(),{device:r,context:o,viewport:a}=this.gpu,c=this.camera;this.cameraData.set(c.viewProjMatrix,0),this.cameraData[16]=c.eye[0],this.cameraData[17]=c.eye[1],this.cameraData[18]=c.eye[2],this.cameraData[19]=c.far,this.cameraData[20]=(e-this.startedAt)/1e3,this.cameraData[21]=b.size*.5,r.queue.writeBuffer(n.cameraBuffer,0,this.cameraData);const l=r.createCommandEncoder({label:"frame"}),h=l.beginRenderPass({label:"main",colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:n.depthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});h.setBindGroup(0,n.cameraGroup),this.frustum.update(c.viewProjMatrix),h.setPipeline(n.terrain),h.setVertexBuffer(0,n.vertexBuffer),h.setIndexBuffer(n.indexBuffer,"uint32");let d=0;for(const u of n.chunks)this.frustum.containsBox(u.min,u.max)&&(h.drawIndexed(W,1,0,u.baseVertex),d++);h.setPipeline(n.boxes),h.setBindGroup(1,n.instanceGroup),h.draw(30,n.instanceCount),h.end(),r.queue.submit([l.finish()]),this.stats.sample(performance.now()-i),this.stats.set("draws",String(d+1)),this.stats.set("chunks",`${d}/${n.chunks.length}`),this.stats.set("instances",String(n.instanceCount)),this.stats.set("tris",String(10*n.instanceCount+d*(W/3))),this.stats.set("zoom",`${c.distance.toFixed(0)}m`),this.stats.set("px",`${a.width}×${a.height}`),this.stats.paint(e)}teardown(){this.stop(),this.res&&(this.res.depth.destroy(),this.res.cameraBuffer.destroy(),this.res.vertexBuffer.destroy(),this.res.indexBuffer.destroy(),this.res.instanceBuffer.destroy(),this.res=null)}}function q(){const s=new Float32Array(16);return s[0]=s[5]=s[10]=s[15]=1,s}function Ue(s,e,n,t,i){const r=1/Math.tan(e/2),o=1/(t-i);return s[0]=r/n,s[1]=0,s[2]=0,s[3]=0,s[4]=0,s[5]=r,s[6]=0,s[7]=0,s[8]=0,s[9]=0,s[10]=i*o,s[11]=-1,s[12]=0,s[13]=0,s[14]=i*t*o,s[15]=0,s}function Ae(s,e,n,t){let i=e[0]-n[0],r=e[1]-n[1],o=e[2]-n[2],a=Math.hypot(i,r,o)||1;i/=a,r/=a,o/=a;let c=t[1]*o-t[2]*r,l=t[2]*i-t[0]*o,h=t[0]*r-t[1]*i;a=Math.hypot(c,l,h)||1,c/=a,l/=a,h/=a;const d=r*h-o*l,u=o*c-i*h,m=i*l-r*c;return s[0]=c,s[1]=d,s[2]=i,s[3]=0,s[4]=l,s[5]=u,s[6]=r,s[7]=0,s[8]=h,s[9]=m,s[10]=o,s[11]=0,s[12]=-(c*e[0]+l*e[1]+h*e[2]),s[13]=-(d*e[0]+u*e[1]+m*e[2]),s[14]=-(i*e[0]+r*e[1]+o*e[2]),s[15]=1,s}function Re(s,e,n){for(let t=0;t<4;t++){const i=n[t*4],r=n[t*4+1],o=n[t*4+2],a=n[t*4+3];s[t*4]=e[0]*i+e[4]*r+e[8]*o+e[12]*a,s[t*4+1]=e[1]*i+e[5]*r+e[9]*o+e[13]*a,s[t*4+2]=e[2]*i+e[6]*r+e[10]*o+e[14]*a,s[t*4+3]=e[3]*i+e[7]*r+e[11]*o+e[15]*a}return s}function Ge(s,e){const n=e[0],t=e[1],i=e[2],r=e[3],o=e[4],a=e[5],c=e[6],l=e[7],h=e[8],d=e[9],u=e[10],m=e[11],g=e[12],f=e[13],v=e[14],z=e[15],y=n*a-t*o,S=n*c-i*o,E=n*l-r*o,M=t*c-i*a,w=t*l-r*a,B=i*l-r*c,D=h*f-d*g,O=h*v-u*g,U=h*z-m*g,G=d*v-u*f,$=d*z-m*f,F=u*z-m*v,Q=y*F-S*$+E*G+M*U-w*O+B*D;if(!Q)return!1;const x=1/Q;return s[0]=(a*F-c*$+l*G)*x,s[1]=(i*$-t*F-r*G)*x,s[2]=(f*B-v*w+z*M)*x,s[3]=(u*w-d*B-m*M)*x,s[4]=(c*U-o*F-l*O)*x,s[5]=(n*F-i*U+r*O)*x,s[6]=(v*E-g*B-z*S)*x,s[7]=(h*B-u*E+m*S)*x,s[8]=(o*$-a*U+l*D)*x,s[9]=(t*U-n*$-r*D)*x,s[10]=(g*w-f*E+z*y)*x,s[11]=(d*E-h*w-m*y)*x,s[12]=(a*O-o*G-c*D)*x,s[13]=(n*G-t*O+i*D)*x,s[14]=(f*S-g*M-v*y)*x,s[15]=(h*M-d*S+u*y)*x,!0}function de(s,e,n,t,i){const r=e[3]*n+e[7]*t+e[11]*i+e[15]||1;return s[0]=(e[0]*n+e[4]*t+e[8]*i+e[12])/r,s[1]=(e[1]*n+e[5]*t+e[9]*i+e[13])/r,s[2]=(e[2]*n+e[6]*t+e[10]*i+e[14])/r,s}function R(s,e,n){return s<e?e:s>n?n:s}const $e=50*Math.PI/180,Fe=[0,1,0],k={minDistance:8,maxDistance:1200,minPitch:12*Math.PI/180,maxPitch:88*Math.PI/180,extent:950};class Ie{focus=[0,0,0];distance=120;yaw=Math.PI*.25;pitch=45*Math.PI/180;near=.5;far=6e3;groundHeight=null;view=q();proj=q();viewProj=q();invViewProj=q();eye=[0,0,0];aspect=1;scratch=[0,0,0];setViewport(e,n){this.aspect=e/Math.max(n,1)}update(){this.pitch=R(this.pitch,k.minPitch,k.maxPitch),this.distance=R(this.distance,k.minDistance,k.maxDistance),this.focus[0]=R(this.focus[0],-950,k.extent),this.focus[2]=R(this.focus[2],-950,k.extent),this.focus[1]=this.groundHeight?this.groundHeight(this.focus[0],this.focus[2]):0;const e=Math.cos(this.pitch);this.eye[0]=this.focus[0]+this.distance*e*Math.sin(this.yaw),this.eye[1]=this.focus[1]+this.distance*Math.sin(this.pitch),this.eye[2]=this.focus[2]+this.distance*e*Math.cos(this.yaw),this.near=Math.max(.25,this.distance*.01),this.far=this.distance*12+2e3,Ae(this.view,this.eye,this.focus,Fe),Ue(this.proj,$e,this.aspect,this.near,this.far),Re(this.viewProj,this.proj,this.view),Ge(this.invViewProj,this.viewProj)}groundPointAt(e,n,t=[0,0,0]){const i=de(this.scratch,this.invViewProj,e,n,0),r=i[0],o=i[1],a=i[2],c=de(this.scratch,this.invViewProj,e,n,1),l=this.focus[1],h=c[1]-o;if(Math.abs(h)<1e-6)return null;const d=(l-o)/h;return d<0||d>1?null:(t[0]=r+(c[0]-r)*d,t[1]=l,t[2]=a+(c[2]-a)*d,t)}panBy(e,n){const t=Math.sin(this.yaw),i=Math.cos(this.yaw);this.focus[0]+=e*i-n*t,this.focus[2]+=-e*t-n*i}zoomBy(e){this.distance=R(this.distance*e,k.minDistance,k.maxDistance)}get viewProjMatrix(){return this.viewProj}}const ue=.006,_e=1.4,N=1.6,fe=1.9,Ve=.0016;class je{constructor(e,n){this.canvas=e,this.camera=n,this.on(e,"pointerdown",this.onPointerDown),this.on(e,"pointermove",this.onPointerMove),this.on(e,"pointerup",this.onPointerUp),this.on(e,"pointercancel",this.onPointerUp),this.on(e,"wheel",this.onWheel,{passive:!1}),this.on(e,"contextmenu",t=>t.preventDefault()),this.on(window,"keydown",this.onKeyDown),this.on(window,"keyup",this.onKeyUp),this.on(window,"blur",()=>this.keys.clear())}mode="none";pointers=new Map;lastX=0;lastY=0;pinchDistance=0;keys=new Set;grabPoint=[0,0,0];a=[0,0,0];b=[0,0,0];disposers=[];on(e,n,t,i){e.addEventListener(n,t,i),this.disposers.push(()=>e.removeEventListener(n,t,i))}ndc(e,n){const t=this.canvas.getBoundingClientRect();return[(e-t.left)/Math.max(t.width,1)*2-1,1-(n-t.top)/Math.max(t.height,1)*2]}onPointerDown=e=>{if(this.canvas.setPointerCapture(e.pointerId),this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.canvas.focus(),this.pointers.size===2){this.mode="none",this.pinchDistance=this.pointerSpread();return}const n=e.button===1||e.button===2||e.shiftKey||e.altKey;if(this.mode=n?"orbit":"pan",this.lastX=e.clientX,this.lastY=e.clientY,this.mode==="pan"){const[t,i]=this.ndc(e.clientX,e.clientY);this.camera.groundPointAt(t,i,this.grabPoint)||(this.mode="none")}};onPointerMove=e=>{const n=this.pointers.get(e.pointerId);if(n){if(n.x=e.clientX,n.y=e.clientY,this.pointers.size===2){const t=this.pointerSpread();this.pinchDistance>0&&t>0&&(this.camera.zoomBy(R(this.pinchDistance/t,.5,2)),this.camera.update()),this.pinchDistance=t;return}if(this.mode==="orbit"){this.camera.yaw-=(e.clientX-this.lastX)*ue,this.camera.pitch+=(e.clientY-this.lastY)*ue,this.lastX=e.clientX,this.lastY=e.clientY,this.camera.update();return}if(this.mode==="pan"){const[t,i]=this.ndc(e.clientX,e.clientY),r=this.camera.groundPointAt(t,i,this.a);if(!r)return;this.camera.focus[0]+=this.grabPoint[0]-r[0],this.camera.focus[2]+=this.grabPoint[2]-r[2],this.camera.update()}}};onPointerUp=e=>{this.pointers.delete(e.pointerId),this.canvas.hasPointerCapture(e.pointerId)&&this.canvas.releasePointerCapture(e.pointerId),this.pointers.size<2&&(this.pinchDistance=0),this.pointers.size===0&&(this.mode="none")};pointerSpread(){const e=this.pointers.values(),n=e.next().value,t=e.next().value;return!n||!t?0:Math.hypot(n.x-t.x,n.y-t.y)}onWheel=e=>{e.preventDefault();const[n,t]=this.ndc(e.clientX,e.clientY),i=e.deltaMode===1?e.deltaY*33:e.deltaY,r=this.camera.groundPointAt(n,t,this.a);this.camera.zoomBy(Math.exp(i*Ve)),this.camera.update();const o=this.camera.groundPointAt(n,t,this.b);r&&o&&(this.camera.focus[0]+=r[0]-o[0],this.camera.focus[2]+=r[2]-o[2],this.camera.update())};onKeyDown=e=>{e.metaKey||e.ctrlKey||this.keys.add(e.key.toLowerCase())};onKeyUp=e=>{this.keys.delete(e.key.toLowerCase())};update(e){if(this.keys.size===0)return!1;const n=this.keys,t=this.camera;let i=!1;const r=_e*t.distance*e;let o=0,a=0;return(n.has("a")||n.has("arrowleft"))&&(o-=r),(n.has("d")||n.has("arrowright"))&&(o+=r),(n.has("w")||n.has("arrowup"))&&(a+=r),(n.has("s")||n.has("arrowdown"))&&(a-=r),(o||a)&&(t.panBy(o,a),i=!0),n.has("q")&&(t.yaw+=N*e,i=!0),n.has("e")&&(t.yaw-=N*e,i=!0),n.has("r")&&(t.pitch+=N*e,i=!0),n.has("f")&&(t.pitch-=N*e,i=!0),(n.has("=")||n.has("+"))&&(t.zoomBy(Math.exp(-fe*e)),i=!0),(n.has("-")||n.has("_"))&&(t.zoomBy(Math.exp(fe*e)),i=!0),i&&t.update(),i}dispose(){for(const e of this.disposers)e();this.disposers=[]}}class qe{el;samples=new Float32Array(120);cursor=0;lastPaint=0;rows=new Map;constructor(e){this.el=document.createElement("div"),this.el.style.cssText=["position:absolute","top:10px","left:12px","padding:8px 11px","background:rgba(6,9,13,.72)","border:1px solid rgba(98,212,255,.16)","border-radius:3px","font:11px/1.6 var(--mono)","color:#8fa3bd","pointer-events:none","white-space:pre","letter-spacing:.02em"].join(";"),e.appendChild(this.el)}sample(e){this.samples[this.cursor]=e,this.cursor=(this.cursor+1)%this.samples.length}set(e,n){this.rows.set(e,n)}paint(e){if(e-this.lastPaint<250)return;this.lastPaint=e;let n=0,t=0;for(const o of this.samples)n+=o,o>t&&(t=o);const i=n/this.samples.length,r=[`${(1e3/Math.max(i,.001)).toFixed(0).padStart(4)} fps`,`${i.toFixed(2).padStart(5)} ms  avg`,`${t.toFixed(2).padStart(5)} ms  peak`];for(const[o,a]of this.rows)r.push(`${a.padStart(5)}  ${o}`);this.el.textContent=r.join(`
`)}}const Ne={"no-webgpu":"This browser has no WebGPU","no-adapter":"No compatible GPU found","no-device":"The GPU refused to start","device-lost":"Lost connection to the GPU",internal:"Something broke during startup"};function Ye(s){const e=navigator.userAgent,n=/Chrome|Chromium|Edg\//.test(e)&&!/OPR\//.test(e),t=/Firefox\//.test(e),i=/Safari\//.test(e)&&!/Chrome|Chromium|Edg\//.test(e);return s==="no-webgpu"?t?["Firefox ships WebGPU on Windows from version 141. On macOS and Linux it is still behind a flag.","Open about:config and set dom.webgpu.enabled to true, then reload.","Or use Chrome, Edge, or Safari 18+."]:i?["Safari supports WebGPU from version 18 (macOS Sequoia, iOS 18).","On older Safari: Develop → Feature Flags → enable WebGPU."]:n?["Chrome and Edge support WebGPU from version 113, so this is unusual.","Check chrome://gpu — WebGPU may be blocklisted for this GPU or driver.","Updating your graphics driver is the usual fix."]:["Try a recent Chrome, Edge, or Safari 18+."]:s==="no-adapter"?["The browser has WebGPU but could not find a usable GPU.","This is common in virtual machines, remote desktops, and on Linux without a working Vulkan driver.",n?"Check chrome://gpu for the reason it was rejected.":"Check your browser’s GPU diagnostics page."]:s==="device-lost"?["The GPU process crashed or was reset — usually a driver timeout or the machine waking from sleep.","Reloading normally fixes it. If it happens repeatedly, update your graphics driver."]:["Reload to try again. If it keeps happening, the details below are worth reporting."]}function I(s,e){const n=document.getElementById("boot");n&&n.classList.remove("done");const t=n??document.body;t.innerHTML="",t.style.cssText+=";display:grid;place-content:center;padding:32px;text-align:left;max-width:min(680px,92vw);margin:0 auto;";const i=document.createElement("h1");i.textContent=Ne[s],i.style.cssText="font:500 15px/1.4 var(--mono);letter-spacing:.06em;color:var(--err);text-transform:none;margin-bottom:14px;",t.appendChild(i);const r=document.createElement("div");r.style.cssText="color:var(--fg);font-size:13px;line-height:1.75;";for(const a of Ye(s)){const c=document.createElement("p");c.textContent=a,c.style.cssText="margin-bottom:8px;",r.appendChild(c)}if(t.appendChild(r),e){const a=document.createElement("pre");a.textContent=e,a.style.cssText="margin-top:20px;padding:12px 14px;background:rgba(255,107,122,.07);border-left:2px solid var(--err);color:var(--dim);font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;",t.appendChild(a)}const o=document.createElement("p");o.innerHTML='Reported at <a href="https://github.com/maksimsysak3-ui/Subnautica-2/issues" style="color:var(--accent)">github.com/maksimsysak3-ui/Subnautica-2</a>',o.style.cssText="margin-top:22px;color:var(--dim);font-size:11px;",t.appendChild(o)}const pe=3;window.__citysimBooted=!0;function Y(s){const e=document.getElementById("boot-status");e&&(e.textContent=s)}async function He(){const s=document.getElementById("overlay"),e=document.getElementById("gpu-canvas");if(!s||!(e instanceof HTMLCanvasElement)){I("internal","index.html is missing #gpu-canvas or #overlay");return}xe(s),p.info("boot",`citysim starting, ua=${navigator.userAgent}`),p.info("boot",`crossOriginIsolated=${crossOriginIsolated} sharedArrayBuffer=${typeof SharedArrayBuffer<"u"}`),crossOriginIsolated||p.info("boot","not cross-origin isolated (expected): SharedArrayBuffer unavailable"),Y("requesting GPU…");let n;try{n=await J.create(e)}catch(c){c instanceof A?(p.error("boot",`${c.kind}: ${c.message}`),I(c.kind,c.message)):(p.error("boot",String(c)),I("internal",c instanceof Error?c.stack??c.message:String(c)));return}Y("building the city…");const t=new qe(s);t.set("isolated",crossOriginIsolated?"yes":"no");const i=new Ie,r=new je(e,i),o=new Oe(n,i,t);o.build();let a=0;n.onLost(async c=>{if(o.teardown(),c.reason!=="destroyed"){if(++a>pe){I("device-lost",`${c.message}

gave up after ${pe} attempts`);return}Y("recovering GPU…");try{await n.recover(),o.build(),o.start(l=>r.update(l)),Y(""),document.getElementById("boot")?.classList.add("done")}catch(l){I("device-lost",String(l))}}}),document.addEventListener("visibilitychange",()=>{document.hidden?o.stop():o.start()}),o.start(c=>r.update(c)),e.focus(),document.getElementById("boot")?.classList.add("done"),p.info("boot","running — drag to pan, right-drag to orbit, wheel to zoom")}addEventListener("error",s=>p.error("window",`${s.message} @ ${s.filename}:${s.lineno}`));addEventListener("unhandledrejection",s=>p.error("window",`unhandled rejection: ${String(s.reason)}`));He();
//# sourceMappingURL=index-C5Mrwjkc.js.map
