(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(r){if(r.ep)return;r.ep=!0;const i=t(r);fetch(r.href,i)}})();const ie={debug:0,info:1,warn:2,error:3},Be={debug:"#5d6b80",info:"#c9d4e3",warn:"#ffb454",error:"#ff6b7a"},Me=256,V=[];let ve="debug",T=null,X=!1;function Y(s,e,t){if(ie[s]<ie[ve])return;V.push({t:performance.now(),level:s,scope:e,msg:t}),V.length>Me&&V.shift(),X=!0;const n=`[${e}] ${t}`;s==="error"?console.error(n):s==="warn"?console.warn(n):console.log(n)}const g={debug:(s,e)=>Y("debug",s,e),info:(s,e)=>Y("info",s,e),warn:(s,e)=>Y("warn",s,e),error:(s,e)=>Y("error",s,e),setLevel:s=>{ve=s},entries:()=>V};function Ee(s){T=document.createElement("div"),T.style.cssText=["position:absolute","left:0","bottom:0","width:100%","max-height:45%","overflow:hidden","padding:8px 12px","background:rgba(6,9,13,.92)","border-top:1px solid rgba(98,212,255,.18)","font:11px/1.55 var(--mono)","white-space:pre-wrap","display:none","pointer-events:none"].join(";"),s.appendChild(T),addEventListener("keydown",t=>{t.key!=="`"||t.metaKey||t.ctrlKey||T&&(T.style.display=T.style.display==="none"?"block":"none",X=!0)});const e=()=>{T&&X&&T.style.display!=="none"&&(T.innerHTML=V.slice(-40).map(t=>`<span style="color:#3d4757">${(t.t/1e3).toFixed(2).padStart(7)}</span> <span style="color:${Be[t.level]}">[${t.scope}] ${ze(t.msg)}</span>`).join("<br>"),X=!1),requestAnimationFrame(e)};requestAnimationFrame(e)}function ze(s){return s.replace(/[&<>]/g,e=>e==="&"?"&amp;":e==="<"?"&lt;":"&gt;")}const Ce={maxBufferSize:512*1024*1024,maxStorageBufferBindingSize:512*1024*1024,maxTextureDimension2D:8192,maxTextureArrayLayers:256,maxStorageBuffersPerShaderStage:8,maxSampledTexturesPerShaderStage:16,maxComputeWorkgroupStorageSize:16384,maxComputeInvocationsPerWorkgroup:256},Le={maxBufferSize:128*1024*1024,maxStorageBufferBindingSize:128*1024*1024,maxTextureDimension2D:4096};function oe(s){const e={};for(const[t,n]of Object.entries(Ce)){const r=s.limits[t];typeof r=="number"&&(e[t]=Math.min(n,r))}return e}function ae(s){return["timestamp-query","texture-compression-bc","texture-compression-astc","indirect-first-instance"].filter(t=>s.features.has(t))}function ce(s){return`${(s/1024/1024).toFixed(0)} MiB`}function Ue(s,e){const t=s.info;if(t){const n=[t.vendor,t.architecture,t.device,t.description].filter(r=>r&&r.length>0).join(" / ");g.info("caps",`adapter: ${n||"(no info exposed)"}`)}g.info("caps",`features: ${[...e.features].join(", ")||"(none)"}`),g.info("caps",`buffers: max ${ce(e.limits.maxBufferSize)}, storage binding ${ce(e.limits.maxStorageBufferBindingSize)}`),g.info("caps",`textures: ${e.limits.maxTextureDimension2D}px 2D, ${e.limits.maxTextureArrayLayers} array layers`),g.info("caps",`compute: ${e.limits.maxComputeInvocationsPerWorkgroup} invocations/wg, ${e.limits.maxComputeWorkgroupStorageSize}B shared`);for(const[n,r]of Object.entries(Le)){const i=e.limits[n];typeof i=="number"&&i<r&&g.warn("caps",`${n} is ${i}, below the ${r} the design budgets assume`)}e.features.has("timestamp-query")||g.warn("caps","no timestamp-query: GPU timings in the budget HUD will be unavailable")}class I extends Error{constructor(e,t){super(t),this.kind=e,this.name="GpuInitError"}}const le=2;class se{constructor(e,t,n,r,i){this.canvas=e,this.adapter=t,this.device=n,this.context=r,this.format=i}viewport={width:1,height:1,dpr:1};resizeHandlers=new Set;lostHandlers=new Set;observer=null;destroyed=!1;static async create(e){if(!("gpu"in navigator)||!navigator.gpu)throw new I("no-webgpu","navigator.gpu is undefined");const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new I("no-adapter","requestAdapter() returned null");let n;try{n=await t.requestDevice({label:"citysim-device",requiredFeatures:ae(t),requiredLimits:oe(t)})}catch(c){throw new I("no-device",String(c))}const r=e.getContext("webgpu");if(!r)throw new I("no-device",'canvas.getContext("webgpu") returned null');const i=navigator.gpu.getPreferredCanvasFormat(),o=new se(e,t,n,r,i);return Ue(t,n),g.info("gpu",`canvas format: ${i}`),o.configure(),o.watchResize(),o.watchLoss(),o.watchErrors(),o}configure(){this.context.configure({device:this.device,format:this.format,alphaMode:"opaque",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}watchResize(){this.observer=new ResizeObserver(e=>{const t=e[0];t&&this.applySize(t)});try{this.observer.observe(this.canvas,{box:"device-pixel-content-box"})}catch{this.observer.observe(this.canvas)}this.resizeNow()}applySize(e){const t=Math.min(devicePixelRatio||1,le),n=e.devicePixelContentBoxSize?.[0];let r,i;n?(r=n.inlineSize,i=n.blockSize):(r=Math.round(e.contentRect.width*t),i=Math.round(e.contentRect.height*t)),this.setSize(r,i,t)}resizeNow(){const e=Math.min(devicePixelRatio||1,le),t=this.canvas.getBoundingClientRect();this.setSize(Math.round(t.width*e),Math.round(t.height*e),e)}setSize(e,t,n){const r=this.device.limits.maxTextureDimension2D,i=Math.max(1,Math.min(e,r)),o=Math.max(1,Math.min(t,r));if(!(i===this.viewport.width&&o===this.viewport.height)){this.canvas.width=i,this.canvas.height=o,this.viewport.width=i,this.viewport.height=o,this.viewport.dpr=n,g.debug("gpu",`viewport ${i}x${o} @${n}x`);for(const c of this.resizeHandlers)c(this.viewport)}}onResize(e){return this.resizeHandlers.add(e),()=>this.resizeHandlers.delete(e)}watchLoss(){this.device.lost.then(e=>{if(!(this.destroyed||e.reason==="destroyed")){g.error("gpu",`device lost: ${e.reason} -- ${e.message}`);for(const t of this.lostHandlers)t(e)}})}watchErrors(){this.device.addEventListener("uncapturederror",e=>{const t=e.error;g.error("gpu",`uncaptured ${t.constructor.name}: ${t.message}`)})}onLost(e){this.lostHandlers.add(e)}async recover(){g.warn("gpu","attempting device recovery");const e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!e)throw new I("no-adapter","no adapter on recovery");this.adapter=e,this.device=await e.requestDevice({label:"citysim-device (recovered)",requiredFeatures:ae(e),requiredLimits:oe(e)}),this.configure(),this.watchLoss(),this.watchErrors(),g.info("gpu","device recovered")}destroy(){this.destroyed=!0,this.observer?.disconnect(),this.observer=null,this.resizeHandlers.clear(),this.lostHandlers.clear(),this.device.destroy()}}class Te{planes=new Float32Array(24);update(e){const t=this.planes,n=(i,o)=>e[o*4+i],r=(i,o,c,u,f)=>{const a=Math.hypot(o,c,u)||1;t[i]=o/a,t[i+1]=c/a,t[i+2]=u/a,t[i+3]=f/a};r(0,n(3,0)+n(0,0),n(3,1)+n(0,1),n(3,2)+n(0,2),n(3,3)+n(0,3)),r(4,n(3,0)-n(0,0),n(3,1)-n(0,1),n(3,2)-n(0,2),n(3,3)-n(0,3)),r(8,n(3,0)+n(1,0),n(3,1)+n(1,1),n(3,2)+n(1,2),n(3,3)+n(1,3)),r(12,n(3,0)-n(1,0),n(3,1)-n(1,1),n(3,2)-n(1,2),n(3,3)-n(1,3)),r(16,n(2,0),n(2,1),n(2,2),n(2,3)),r(20,n(3,0)-n(2,0),n(3,1)-n(2,1),n(3,2)-n(2,2),n(3,3)-n(2,3))}containsBox(e,t){const n=this.planes;for(let r=0;r<24;r+=4){const i=n[r],o=n[r+1],c=n[r+2],u=i>=0?t[0]:e[0],f=o>=0?t[1]:e[1],a=c>=0?t[2]:e[2];if(i*u+o*f+c*a+n[r+3]<0)return!1}return!0}}const Ge=1e-6;class Oe{constructor(e,t){if(this.scopes=t,this.enabled=e.features.has("timestamp-query"),this.results=new Float64Array(t.length),!this.enabled)return;const n=t.length*2;this.querySet=e.createQuerySet({type:"timestamp",count:n}),this.resolveBuffer=e.createBuffer({label:"timestamp-resolve",size:n*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),this.readBuffer=e.createBuffer({label:"timestamp-read",size:n*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})}enabled;querySet=null;resolveBuffer=null;readBuffer=null;pending=!1;results;writes(e){if(!this.querySet)return;const t=this.scopes.indexOf(e);if(!(t<0))return{querySet:this.querySet,beginningOfPassWriteIndex:t*2,endOfPassWriteIndex:t*2+1}}resolve(e){if(!this.querySet||!this.resolveBuffer||!this.readBuffer||this.pending)return;const t=this.scopes.length*2;e.resolveQuerySet(this.querySet,0,t,this.resolveBuffer,0),e.copyBufferToBuffer(this.resolveBuffer,0,this.readBuffer,0,t*8)}poll(){const e=this.readBuffer;!e||this.pending||(this.pending=!0,e.mapAsync(GPUMapMode.READ).then(()=>{const t=new BigUint64Array(e.getMappedRange().slice(0));for(let n=0;n<this.scopes.length;n++){const r=t[n*2],i=t[n*2+1];this.results[n]=i>r?Number(i-r)*Ge:this.results[n]}e.unmap(),this.pending=!1},()=>{this.pending=!1}))}ms(e){const t=this.scopes.indexOf(e);return t<0?0:this.results[t]}destroy(){this.querySet?.destroy(),this.resolveBuffer?.destroy(),this.readBuffer?.destroy()}}function L(s,e,t){let n=Math.imul(s,374761393)+Math.imul(e,668265263)+Math.imul(t,2246822519)>>>0;return n=Math.imul(n^n>>>13,1274126177)>>>0,((n^n>>>16)>>>0)/4294967296}const ue=s=>s*s*(3-2*s);function Ae(s,e,t){const n=Math.floor(s),r=Math.floor(e),i=ue(s-n),o=ue(e-r),c=L(n,r,t),u=L(n+1,r,t),f=L(n,r+1,t),a=L(n+1,r+1,t);return(c+(u-c)*i)*(1-o)+(f+(a-f)*i)*o}function Z(s,e,t,n){let r=0,i=1,o=0,c=1;for(let u=0;u<t;u++)r+=Ae(s*c,e*c,n+u*31)*i,o+=i,i*=.5,c*=2.03;return r/o}const De={cityGrid:440,terrainSize:6144},Re={cityGrid:90,terrainSize:1536},re={...De};function ke(s){Object.assign(re,s)}const P={get size(){return re.terrainSize},chunk:256,res:32},Ie=P.res+1,we=P.res*P.res*6,ne=6;function U(s,e){const t=.0009090909090909091,n=(Z(s*t,e*t,5,101)-.5)*2,r=(Z(s*t*3.7,e*t*3.7,3,233)-.5)*2,i=Math.min(Math.hypot(s,e)/(P.size*.5),1),o=Math.pow(Math.max(0,(i-.05)/.95),1.05),c=(Z(s/90,e/90,3,909)-.5)*2*2.1;return(n*150+r*34)*o+c}function _e(s,e,t){const r=U(s+2,e)-U(s-2,e),i=U(s,e+2)-U(s,e-2),o=Math.hypot(r,4,i)||1;t[0]=-r/o,t[1]=4/o,t[2]=-i/o}function Fe(){const s=Math.max(1,Math.round(P.size/P.chunk)),e=Ie,t=e*e,n=s*s,r=P.chunk/P.res,i=P.size/2,o=new Float32Array(n*t*ne),c=[],u=[0,0,0];let f=0;for(let d=0;d<s;d++)for(let h=0;h<s;h++){const p=f/ne,b=h*P.chunk-i,m=d*P.chunk-i;let v=1/0,B=-1/0;for(let M=0;M<e;M++)for(let w=0;w<e;w++){const S=b+w*r,E=m+M*r,y=U(S,E);_e(S,E,u),o[f++]=S,o[f++]=y,o[f++]=E,o[f++]=u[0],o[f++]=u[1],o[f++]=u[2],y<v&&(v=y),y>B&&(B=y)}c.push({baseVertex:p,min:[b,v,m],max:[b+P.chunk,B,m+P.chunk]})}const a=new Uint32Array(we);let l=0;for(let d=0;d<P.res;d++)for(let h=0;h<P.res;h++){const p=d*e+h,b=p+1,m=p+e,v=m+1;a[l++]=p,a[l++]=m,a[l++]=b,a[l++]=b,a[l++]=m,a[l++]=v}return{vertices:o,indices:a,chunks:c}}const ye=12,k=8,he=6,$e=.55,qe=4.5;function Ve(){const s=re.cityGrid,e=s/2,t=[],n=new Uint8Array(s*s),r=(a,l)=>a%(he+1)===0||l%(he+1)===0,i=(a,l,d)=>{if(a+d>s||l+d>s)return!1;for(let h=0;h<d;h++)for(let p=0;p<d;p++)if(r(a+p,l+h)||n[(l+h)*s+a+p])return!1;return!0},o=(a,l,d)=>{for(let h=0;h<d;h++)for(let p=0;p<d;p++)n[(l+h)*s+a+p]=1},c=(a,l,d,h)=>{const p=d*k,b=(a-e)*k+p/2,m=(l-e)*k+p/2,v=U(b-p/2,m-p/2),B=U(b+p/2,m-p/2),M=U(b-p/2,m+p/2),w=U(b+p/2,m+p/2),S=Math.min(v,B,M,w);if(Math.max(v,B,M,w)-S>qe)return!1;const E=1-Math.min(h/420,.14),y=(p/2-$e)*E,z=Math.min(h/90,1),C=(L(a,l,11)-.5)*.07;return t.push(b,m,y,y,S-1.2,h+1.2,0,0,.2+z*.34+C,.24+z*.36+C,.3+z*.38+C,1),o(a,l,d),!0},u=(a,l)=>{const d=(a-e)*k,h=(l-e)*k;return Math.max(0,1-Math.hypot(d,h)/(e*k)*3.2)};for(let a=1;a<s-3;a+=3)for(let l=1;l<s-3;l+=3){const d=u(l,a);if(d<=0||L(l,a,7)>Math.pow(d,1.5)*.55||!i(l,a,3))continue;const p=L(l,a,13);c(l,a,3,55+Math.pow(d,2.2)*120*(.3+p))}for(let a=1;a<s-2;a+=2)for(let l=1;l<s-2;l+=2){const d=u(l,a);L(l,a,23)>.16+d*.42||i(l,a,2)&&c(l,a,2,16+L(l,a,29)*26+d*18)}for(let a=0;a<s;a++)for(let l=0;l<s;l++)i(l,a,1)&&(L(l,a,1)<.22||c(l,a,1,6+L(l,a,3)*11));const f=new Float32Array(t.length);return f.set(t),{data:f,count:t.length/ye}}const je=`// Shared camera binding. Every pipeline binds this as group 0.

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
`,Ye=`// GPU-side visibility and LOD selection.
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
`,Ne=`// The terrain surface, and the grid drawn onto it.
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
`,We=`// Instanced buildings, at two levels of detail.
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
`,Q="depth24plus",de=192,He=30,Xe=6,Ke=700,Ze=50*Math.PI/180,J=32;function ee(s){return s.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m,je)}class Qe{constructor(e,t,n){this.gpu=e,this.camera=t,this.stats=n}res=null;cameraData=new Float32Array(de/4);raf=0;startedAt=0;lastFrame=0;unsubscribeResize=null;running=!1;onUpdate=null;frustum=new Te;profiler=null;argsReset=new Uint32Array([He,0,0,0,Xe,0,0,0]);drawnCounts=[0,0];countsPending=!1;build(){const{device:e,format:t}=this.gpu,n=e.createBindGroupLayout({label:"camera-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT|GPUShaderStage.COMPUTE,buffer:{type:"uniform"}}]}),r=e.createBindGroupLayout({label:"instance-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),i=e.createBindGroupLayout({label:"cull-bgl",entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),o={format:Q,depthWriteEnabled:!0,depthCompare:"less"},c=e.createShaderModule({label:"terrain",code:ee(Ne)}),u=e.createRenderPipeline({label:"terrain-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:c,entryPoint:"vs",buffers:[{arrayStride:ne*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"}]}]},fragment:{module:c,entryPoint:"fs",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:o}),f=e.createShaderModule({label:"box",code:ee(We)}),a=e.createPipelineLayout({bindGroupLayouts:[n,r]}),l=(F,K)=>e.createRenderPipeline({label:K,layout:a,vertex:{module:f,entryPoint:F},fragment:{module:f,entryPoint:"fs",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:o}),d=l("vs_solid","box-solid-pipeline"),h=l("vs_impostor","box-impostor-pipeline"),p=e.createComputePipeline({label:"cull-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[n,i]}),compute:{module:e.createShaderModule({label:"cull",code:ee(Ye)}),entryPoint:"main"}}),b=e.createBuffer({label:"camera-uniform",size:de,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),m=e.createBindGroup({label:"camera-bg",layout:n,entries:[{binding:0,resource:{buffer:b}}]}),v=Fe(),B=e.createBuffer({label:"terrain-vertices",size:v.vertices.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(B,0,v.vertices);const M=e.createBuffer({label:"terrain-indices",size:v.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(M,0,v.indices);const w=Ve(),S=e.createBuffer({label:"box-instances",size:w.data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(S,0,w.data);const E=Math.max(w.count,1)*4,y=e.createBuffer({label:"visible-near",size:E,usage:GPUBufferUsage.STORAGE}),z=e.createBuffer({label:"visible-far",size:E,usage:GPUBufferUsage.STORAGE}),C=e.createBuffer({label:"draw-args",size:J,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),O=e.createBuffer({label:"draw-args-read",size:J,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),A=e.createBindGroup({label:"cull-bg",layout:i,entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:y}},{binding:2,resource:{buffer:z}},{binding:3,resource:{buffer:C}}]}),G=(F,K)=>e.createBindGroup({label:K,layout:r,entries:[{binding:0,resource:{buffer:S}},{binding:1,resource:{buffer:F}}]}),D=G(y,"near-bg"),j=G(z,"far-bg"),{depth:x,depthView:xe}=this.createDepth(this.gpu.viewport);this.profiler??=new Oe(e,["cull","draw"]),this.res={terrain:u,solid:d,impostor:h,cull:p,cameraBuffer:b,cameraGroup:m,vertexBuffer:B,indexBuffer:M,chunks:v.chunks,instanceBuffer:S,nearListBuffer:y,farListBuffer:z,drawArgsBuffer:C,drawArgsReadBuffer:O,cullGroup:A,nearGroup:D,farGroup:j,depth:x,depthView:xe,instanceCount:w.count},this.unsubscribeResize?.(),this.unsubscribeResize=this.gpu.onResize(F=>this.onResize(F)),this.camera.groundHeight=U,this.camera.extent=P.size*.5-P.chunk,this.camera.setViewport(this.gpu.viewport.width,this.gpu.viewport.height),this.camera.update();const Pe=w.count*ye*4/1024,Se=v.vertices.byteLength/1024/1024;g.info("render",`terrain ${v.chunks.length} chunks (${Se.toFixed(1)} MiB), ${w.count.toLocaleString()} instances (${(Pe/1024).toFixed(1)} MiB), depth ${Q}`),g.info("render",this.profiler.enabled?"GPU timing available (timestamp-query)":"no timestamp-query: GPU times will read 0")}createDepth(e){const t=this.gpu.device.createTexture({label:"depth",size:{width:e.width,height:e.height},format:Q,usage:GPUTextureUsage.RENDER_ATTACHMENT});return{depth:t,depthView:t.createView()}}onResize(e){if(this.camera.setViewport(e.width,e.height),this.camera.update(),!this.res)return;this.res.depth.destroy();const{depth:t,depthView:n}=this.createDepth(e);this.res.depth=t,this.res.depthView=n}start(e){if(e&&(this.onUpdate=e),this.running)return;this.running=!0,this.startedAt=performance.now(),this.lastFrame=this.startedAt;const t=n=>{this.running&&(this.raf=requestAnimationFrame(t),this.frame(n))};this.raf=requestAnimationFrame(t)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}frame(e){const t=this.res;if(!t)return;const n=Math.min((e-this.lastFrame)/1e3,.1);this.lastFrame=e,this.onUpdate?.(n);const r=performance.now(),{device:i,context:o,viewport:c}=this.gpu,u=this.camera;this.cameraData.set(u.viewProjMatrix,0),this.cameraData[16]=u.eye[0],this.cameraData[17]=u.eye[1],this.cameraData[18]=u.eye[2],this.cameraData[19]=u.far,this.cameraData[20]=(e-this.startedAt)/1e3,this.cameraData[21]=P.size*.5,this.cameraData[22]=Ke,this.cameraData[23]=c.height/(2*Math.tan(Ze/2)),this.frustum.update(u.viewProjMatrix),this.cameraData.set(this.frustum.planes,24),i.queue.writeBuffer(t.cameraBuffer,0,this.cameraData),i.queue.writeBuffer(t.drawArgsBuffer,0,this.argsReset);const f=this.profiler?.writes("draw"),a=i.createCommandEncoder({label:"frame"}),l=this.profiler?.writes("cull"),d=a.beginComputePass(l?{label:"cull",timestampWrites:l}:{label:"cull"});d.setPipeline(t.cull),d.setBindGroup(0,t.cameraGroup),d.setBindGroup(1,t.cullGroup),d.dispatchWorkgroups(Math.ceil(t.instanceCount/64)),d.end();const h=a.beginRenderPass({label:"main",colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:t.depthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"},...f?{timestampWrites:f}:{}});h.setBindGroup(0,t.cameraGroup),h.setPipeline(t.terrain),h.setVertexBuffer(0,t.vertexBuffer),h.setIndexBuffer(t.indexBuffer,"uint32");let p=0;for(const m of t.chunks)this.frustum.containsBox(m.min,m.max)&&(h.drawIndexed(we,1,0,m.baseVertex),p++);h.setPipeline(t.solid),h.setBindGroup(1,t.nearGroup),h.drawIndirect(t.drawArgsBuffer,0),h.setPipeline(t.impostor),h.setBindGroup(1,t.farGroup),h.drawIndirect(t.drawArgsBuffer,16),h.end(),this.countsPending||a.copyBufferToBuffer(t.drawArgsBuffer,0,t.drawArgsReadBuffer,0,J),this.profiler?.resolve(a),i.queue.submit([a.finish()]),this.profiler?.poll(),this.readDrawnCounts(t.drawArgsReadBuffer),this.stats.sample(performance.now()-r),this.stats.set("draws",String(p+2)),this.stats.set("chunks",`${p}/${t.chunks.length}`),this.profiler?.enabled&&(this.stats.set("gpu cull",this.profiler.ms("cull").toFixed(2)),this.stats.set("gpu draw",this.profiler.ms("draw").toFixed(2)));const b=this.drawnCounts[0]+this.drawnCounts[1];this.stats.set("buildings",`${b.toLocaleString()}/${t.instanceCount.toLocaleString()}`),this.stats.set("solid·imp",`${this.drawnCounts[0]}·${this.drawnCounts[1]}`),this.stats.set("zoom",`${u.distance.toFixed(0)}m`),this.stats.set("px",`${c.width}×${c.height}`),this.stats.paint(e)}readDrawnCounts(e){this.countsPending||(this.countsPending=!0,e.mapAsync(GPUMapMode.READ).then(()=>{const t=new Uint32Array(e.getMappedRange().slice(0));this.drawnCounts=[t[1],t[5]],e.unmap(),this.countsPending=!1},()=>{this.countsPending=!1}))}get buildingCount(){return this.res?.instanceCount??0}get drawn(){return this.drawnCounts}gpuMs(e){return this.profiler?.ms(e)??0}teardown(){this.stop(),this.res&&(this.res.depth.destroy(),this.res.cameraBuffer.destroy(),this.res.vertexBuffer.destroy(),this.res.indexBuffer.destroy(),this.res.instanceBuffer.destroy(),this.res.nearListBuffer.destroy(),this.res.farListBuffer.destroy(),this.res.drawArgsBuffer.destroy(),this.res.drawArgsReadBuffer.destroy(),this.res=null)}}function N(){const s=new Float32Array(16);return s[0]=s[5]=s[10]=s[15]=1,s}function Je(s,e,t,n,r){const i=1/Math.tan(e/2),o=1/(n-r);return s[0]=i/t,s[1]=0,s[2]=0,s[3]=0,s[4]=0,s[5]=i,s[6]=0,s[7]=0,s[8]=0,s[9]=0,s[10]=r*o,s[11]=-1,s[12]=0,s[13]=0,s[14]=r*n*o,s[15]=0,s}function et(s,e,t,n){let r=e[0]-t[0],i=e[1]-t[1],o=e[2]-t[2],c=Math.hypot(r,i,o)||1;r/=c,i/=c,o/=c;let u=n[1]*o-n[2]*i,f=n[2]*r-n[0]*o,a=n[0]*i-n[1]*r;c=Math.hypot(u,f,a)||1,u/=c,f/=c,a/=c;const l=i*a-o*f,d=o*u-r*a,h=r*f-i*u;return s[0]=u,s[1]=l,s[2]=r,s[3]=0,s[4]=f,s[5]=d,s[6]=i,s[7]=0,s[8]=a,s[9]=h,s[10]=o,s[11]=0,s[12]=-(u*e[0]+f*e[1]+a*e[2]),s[13]=-(l*e[0]+d*e[1]+h*e[2]),s[14]=-(r*e[0]+i*e[1]+o*e[2]),s[15]=1,s}function tt(s,e,t){for(let n=0;n<4;n++){const r=t[n*4],i=t[n*4+1],o=t[n*4+2],c=t[n*4+3];s[n*4]=e[0]*r+e[4]*i+e[8]*o+e[12]*c,s[n*4+1]=e[1]*r+e[5]*i+e[9]*o+e[13]*c,s[n*4+2]=e[2]*r+e[6]*i+e[10]*o+e[14]*c,s[n*4+3]=e[3]*r+e[7]*i+e[11]*o+e[15]*c}return s}function nt(s,e){const t=e[0],n=e[1],r=e[2],i=e[3],o=e[4],c=e[5],u=e[6],f=e[7],a=e[8],l=e[9],d=e[10],h=e[11],p=e[12],b=e[13],m=e[14],v=e[15],B=t*c-n*o,M=t*u-r*o,w=t*f-i*o,S=n*u-r*c,E=n*f-i*c,y=r*f-i*u,z=a*b-l*p,C=a*m-d*p,O=a*v-h*p,A=l*m-d*b,G=l*v-h*b,D=d*v-h*m,j=B*D-M*G+w*A+S*O-E*C+y*z;if(!j)return!1;const x=1/j;return s[0]=(c*D-u*G+f*A)*x,s[1]=(r*G-n*D-i*A)*x,s[2]=(b*y-m*E+v*S)*x,s[3]=(d*E-l*y-h*S)*x,s[4]=(u*O-o*D-f*C)*x,s[5]=(t*D-r*O+i*C)*x,s[6]=(m*w-p*y-v*M)*x,s[7]=(a*y-d*w+h*M)*x,s[8]=(o*G-c*O+f*z)*x,s[9]=(n*O-t*G-i*z)*x,s[10]=(p*E-b*w+v*B)*x,s[11]=(l*w-a*E-h*B)*x,s[12]=(c*C-o*A-u*z)*x,s[13]=(t*A-n*C+r*z)*x,s[14]=(b*M-p*S-m*B)*x,s[15]=(a*S-l*M+d*B)*x,!0}function fe(s,e,t,n,r){const i=e[3]*t+e[7]*n+e[11]*r+e[15]||1;return s[0]=(e[0]*t+e[4]*n+e[8]*r+e[12])/i,s[1]=(e[1]*t+e[5]*n+e[9]*r+e[13])/i,s[2]=(e[2]*t+e[6]*n+e[10]*r+e[14])/i,s}function _(s,e,t){return s<e?e:s>t?t:s}const st=50*Math.PI/180,rt=[0,1,0],R={minDistance:8,maxDistance:3400,minPitch:12*Math.PI/180,maxPitch:88*Math.PI/180,extent:2900};class it{focus=[0,0,0];distance=120;yaw=Math.PI*.25;pitch=45*Math.PI/180;near=.5;far=6e3;groundHeight=null;extent=R.extent;view=N();proj=N();viewProj=N();invViewProj=N();eye=[0,0,0];aspect=1;scratch=[0,0,0];setViewport(e,t){this.aspect=e/Math.max(t,1)}update(){this.pitch=_(this.pitch,R.minPitch,R.maxPitch),this.distance=_(this.distance,R.minDistance,R.maxDistance),this.focus[0]=_(this.focus[0],-this.extent,this.extent),this.focus[2]=_(this.focus[2],-this.extent,this.extent),this.focus[1]=this.groundHeight?this.groundHeight(this.focus[0],this.focus[2]):0;const e=Math.cos(this.pitch);this.eye[0]=this.focus[0]+this.distance*e*Math.sin(this.yaw),this.eye[1]=this.focus[1]+this.distance*Math.sin(this.pitch),this.eye[2]=this.focus[2]+this.distance*e*Math.cos(this.yaw),this.near=Math.max(.25,this.distance*.01),this.far=this.distance*12+2e3,et(this.view,this.eye,this.focus,rt),Je(this.proj,st,this.aspect,this.near,this.far),tt(this.viewProj,this.proj,this.view),nt(this.invViewProj,this.viewProj)}groundPointAt(e,t,n=[0,0,0]){const r=fe(this.scratch,this.invViewProj,e,t,0),i=r[0],o=r[1],c=r[2],u=fe(this.scratch,this.invViewProj,e,t,1),f=this.focus[1],a=u[1]-o;if(Math.abs(a)<1e-6)return null;const l=(f-o)/a;return l<0||l>1?null:(n[0]=i+(u[0]-i)*l,n[1]=f,n[2]=c+(u[2]-c)*l,n)}panBy(e,t){const n=Math.sin(this.yaw),r=Math.cos(this.yaw);this.focus[0]+=e*r-t*n,this.focus[2]+=-e*n-t*r}zoomBy(e){this.distance=_(this.distance*e,R.minDistance,R.maxDistance)}get viewProjMatrix(){return this.viewProj}}const pe=.006,ot=1.4,W=1.6,me=1.9,at=.0016;class ct{constructor(e,t){this.canvas=e,this.camera=t,this.on(e,"pointerdown",this.onPointerDown),this.on(e,"pointermove",this.onPointerMove),this.on(e,"pointerup",this.onPointerUp),this.on(e,"pointercancel",this.onPointerUp),this.on(e,"wheel",this.onWheel,{passive:!1}),this.on(e,"contextmenu",n=>n.preventDefault()),this.on(window,"keydown",this.onKeyDown),this.on(window,"keyup",this.onKeyUp),this.on(window,"blur",()=>this.keys.clear())}mode="none";pointers=new Map;lastX=0;lastY=0;pinchDistance=0;keys=new Set;grabPoint=[0,0,0];a=[0,0,0];b=[0,0,0];disposers=[];on(e,t,n,r){e.addEventListener(t,n,r),this.disposers.push(()=>e.removeEventListener(t,n,r))}ndc(e,t){const n=this.canvas.getBoundingClientRect();return[(e-n.left)/Math.max(n.width,1)*2-1,1-(t-n.top)/Math.max(n.height,1)*2]}onPointerDown=e=>{if(this.canvas.setPointerCapture(e.pointerId),this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.canvas.focus(),this.pointers.size===2){this.mode="none",this.pinchDistance=this.pointerSpread();return}const t=e.button===1||e.button===2||e.shiftKey||e.altKey;if(this.mode=t?"orbit":"pan",this.lastX=e.clientX,this.lastY=e.clientY,this.mode==="pan"){const[n,r]=this.ndc(e.clientX,e.clientY);this.camera.groundPointAt(n,r,this.grabPoint)||(this.mode="none")}};onPointerMove=e=>{const t=this.pointers.get(e.pointerId);if(t){if(t.x=e.clientX,t.y=e.clientY,this.pointers.size===2){const n=this.pointerSpread();this.pinchDistance>0&&n>0&&(this.camera.zoomBy(_(this.pinchDistance/n,.5,2)),this.camera.update()),this.pinchDistance=n;return}if(this.mode==="orbit"){this.camera.yaw-=(e.clientX-this.lastX)*pe,this.camera.pitch+=(e.clientY-this.lastY)*pe,this.lastX=e.clientX,this.lastY=e.clientY,this.camera.update();return}if(this.mode==="pan"){const[n,r]=this.ndc(e.clientX,e.clientY),i=this.camera.groundPointAt(n,r,this.a);if(!i)return;this.camera.focus[0]+=this.grabPoint[0]-i[0],this.camera.focus[2]+=this.grabPoint[2]-i[2],this.camera.update()}}};onPointerUp=e=>{this.pointers.delete(e.pointerId),this.canvas.hasPointerCapture(e.pointerId)&&this.canvas.releasePointerCapture(e.pointerId),this.pointers.size<2&&(this.pinchDistance=0),this.pointers.size===0&&(this.mode="none")};pointerSpread(){const e=this.pointers.values(),t=e.next().value,n=e.next().value;return!t||!n?0:Math.hypot(t.x-n.x,t.y-n.y)}onWheel=e=>{e.preventDefault();const[t,n]=this.ndc(e.clientX,e.clientY),r=e.deltaMode===1?e.deltaY*33:e.deltaY,i=this.camera.groundPointAt(t,n,this.a);this.camera.zoomBy(Math.exp(r*at)),this.camera.update();const o=this.camera.groundPointAt(t,n,this.b);i&&o&&(this.camera.focus[0]+=i[0]-o[0],this.camera.focus[2]+=i[2]-o[2],this.camera.update())};onKeyDown=e=>{e.metaKey||e.ctrlKey||this.keys.add(e.key.toLowerCase())};onKeyUp=e=>{this.keys.delete(e.key.toLowerCase())};update(e){if(this.keys.size===0)return!1;const t=this.keys,n=this.camera;let r=!1;const i=ot*n.distance*e;let o=0,c=0;return(t.has("a")||t.has("arrowleft"))&&(o-=i),(t.has("d")||t.has("arrowright"))&&(o+=i),(t.has("w")||t.has("arrowup"))&&(c+=i),(t.has("s")||t.has("arrowdown"))&&(c-=i),(o||c)&&(n.panBy(o,c),r=!0),t.has("q")&&(n.yaw+=W*e,r=!0),t.has("e")&&(n.yaw-=W*e,r=!0),t.has("r")&&(n.pitch+=W*e,r=!0),t.has("f")&&(n.pitch-=W*e,r=!0),(t.has("=")||t.has("+"))&&(n.zoomBy(Math.exp(-me*e)),r=!0),(t.has("-")||t.has("_"))&&(n.zoomBy(Math.exp(me*e)),r=!0),r&&n.update(),r}dispose(){for(const e of this.disposers)e();this.disposers=[]}}class lt{el;samples=new Float32Array(120);cursor=0;lastPaint=0;rows=new Map;constructor(e){this.el=document.createElement("div"),this.el.style.cssText=["position:absolute","top:10px","left:12px","padding:8px 11px","background:rgba(6,9,13,.72)","border:1px solid rgba(98,212,255,.16)","border-radius:3px","font:11px/1.6 var(--mono)","color:#8fa3bd","pointer-events:none","white-space:pre","letter-spacing:.02em"].join(";"),e.appendChild(this.el)}sample(e){this.samples[this.cursor]=e,this.cursor=(this.cursor+1)%this.samples.length}set(e,t){this.rows.set(e,t)}paint(e){if(e-this.lastPaint<250)return;this.lastPaint=e;let t=0,n=0;for(const o of this.samples)t+=o,o>n&&(n=o);const r=t/this.samples.length,i=[`${(1e3/Math.max(r,.001)).toFixed(0).padStart(4)} fps`,`${r.toFixed(2).padStart(5)} ms  avg`,`${n.toFixed(2).padStart(5)} ms  peak`];for(const[o,c]of this.rows)i.push(`${c.padStart(5)}  ${o}`);this.el.textContent=i.join(`
`)}}const ut={"no-webgpu":"This browser has no WebGPU","no-adapter":"No compatible GPU found","no-device":"The GPU refused to start","device-lost":"Lost connection to the GPU",internal:"Something broke during startup"};function ht(s){const e=navigator.userAgent,t=/Chrome|Chromium|Edg\//.test(e)&&!/OPR\//.test(e),n=/Firefox\//.test(e),r=/Safari\//.test(e)&&!/Chrome|Chromium|Edg\//.test(e);return s==="no-webgpu"?n?["Firefox ships WebGPU on Windows from version 141. On macOS and Linux it is still behind a flag.","Open about:config and set dom.webgpu.enabled to true, then reload.","Or use Chrome, Edge, or Safari 18+."]:r?["Safari supports WebGPU from version 18 (macOS Sequoia, iOS 18).","On older Safari: Develop → Feature Flags → enable WebGPU."]:t?["Chrome and Edge support WebGPU from version 113, so this is unusual.","Check chrome://gpu — WebGPU may be blocklisted for this GPU or driver.","Updating your graphics driver is the usual fix."]:["Try a recent Chrome, Edge, or Safari 18+."]:s==="no-adapter"?["The browser has WebGPU but could not find a usable GPU.","This is common in virtual machines, remote desktops, and on Linux without a working Vulkan driver.",t?"Check chrome://gpu for the reason it was rejected.":"Check your browser’s GPU diagnostics page."]:s==="device-lost"?["The GPU process crashed or was reset — usually a driver timeout or the machine waking from sleep.","Reloading normally fixes it. If it happens repeatedly, update your graphics driver."]:["Reload to try again. If it keeps happening, the details below are worth reporting."]}function $(s,e){const t=document.getElementById("boot");t&&t.classList.remove("done");const n=t??document.body;n.innerHTML="",n.style.cssText+=";display:grid;place-content:center;padding:32px;text-align:left;max-width:min(680px,92vw);margin:0 auto;";const r=document.createElement("h1");r.textContent=ut[s],r.style.cssText="font:500 15px/1.4 var(--mono);letter-spacing:.06em;color:var(--err);text-transform:none;margin-bottom:14px;",n.appendChild(r);const i=document.createElement("div");i.style.cssText="color:var(--fg);font-size:13px;line-height:1.75;";for(const c of ht(s)){const u=document.createElement("p");u.textContent=c,u.style.cssText="margin-bottom:8px;",i.appendChild(u)}if(n.appendChild(i),e){const c=document.createElement("pre");c.textContent=e,c.style.cssText="margin-top:20px;padding:12px 14px;background:rgba(255,107,122,.07);border-left:2px solid var(--err);color:var(--dim);font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;",n.appendChild(c)}const o=document.createElement("p");o.innerHTML='Reported at <a href="https://github.com/maksimsysak3-ui/Subnautica-2/issues" style="color:var(--accent)">github.com/maksimsysak3-ui/Subnautica-2</a>',o.style.cssText="margin-top:22px;color:var(--dim);font-size:11px;",n.appendChild(o)}const q=[{name:"street",distance:60,pitch:22},{name:"district",distance:260,pitch:30},{name:"downtown",distance:700,pitch:38},{name:"city",distance:1600,pitch:46},{name:"whole map",distance:3200,pitch:58}],te=600,ge=1400;class dt{constructor(e,t,n){this.camera=e,this.renderer=t,this.onFinish=n,this.apply(),g.info("bench",`running ${q.length} stops, about ${((te+ge)*q.length/1e3).toFixed(0)}s`)}index=0;elapsed=0;samples=[];gpuCull=[];gpuDraw=[];results=[];done=!1;apply(){const e=q[this.index];this.camera.focus[0]=0,this.camera.focus[2]=0,this.camera.distance=e.distance,this.camera.pitch=e.pitch*Math.PI/180,this.camera.update()}update(e){if(this.done)return;const t=e*1e3;if(this.elapsed+=t,this.camera.yaw+=e*.25,this.camera.update(),this.elapsed>te&&(this.samples.push(t),this.gpuCull.push(this.renderer.gpuMs("cull")),this.gpuDraw.push(this.renderer.gpuMs("draw"))),!(this.elapsed<te+ge)){if(this.record(),this.index++,this.index>=q.length){this.done=!0,this.onFinish(this.results);return}this.elapsed=0,this.samples=[],this.gpuCull=[],this.gpuDraw=[],this.apply()}}record(){const e=q[this.index],t=o=>o.length?o.reduce((c,u)=>c+u,0)/o.length:0,n=t(this.samples),[r,i]=this.renderer.drawn;this.results.push({name:e.name,distance:e.distance,fps:n>0?1e3/n:0,cpuMs:n,gpuCullMs:t(this.gpuCull),gpuDrawMs:t(this.gpuDraw),drawnNear:r,drawnFar:i})}}function ft(s,e){const t=(r,i)=>r.padStart(i),n=[`citysim benchmark — ${e.toLocaleString()} buildings`,`${navigator.userAgent}`,"","stop        dist    fps   frame   gpu cull   gpu draw    drawn"];for(const r of s)n.push(r.name.padEnd(10)+t(`${r.distance}m`,7)+t(r.fps.toFixed(0),7)+t(`${r.cpuMs.toFixed(1)}ms`,8)+t(r.gpuCullMs?`${r.gpuCullMs.toFixed(2)}ms`:"—",11)+t(r.gpuDrawMs?`${r.gpuDrawMs.toFixed(2)}ms`:"—",11)+t((r.drawnNear+r.drawnFar).toLocaleString(),9));return n.join(`
`)}const be=3;window.__citysimBooted=!0;function H(s){const e=document.getElementById("boot-status");e&&(e.textContent=s)}async function pt(){const s=document.getElementById("overlay"),e=document.getElementById("gpu-canvas");if(!s||!(e instanceof HTMLCanvasElement)){$("internal","index.html is missing #gpu-canvas or #overlay");return}Ee(s),new URLSearchParams(location.search).has("lite")&&(ke(Re),g.info("boot","lite world: reduced city and terrain")),g.info("boot",`citysim starting, ua=${navigator.userAgent}`),g.info("boot",`crossOriginIsolated=${crossOriginIsolated} sharedArrayBuffer=${typeof SharedArrayBuffer<"u"}`),crossOriginIsolated||g.info("boot","not cross-origin isolated (expected): SharedArrayBuffer unavailable"),H("requesting GPU…");let n;try{n=await se.create(e)}catch(a){a instanceof I?(g.error("boot",`${a.kind}: ${a.message}`),$(a.kind,a.message)):(g.error("boot",String(a)),$("internal",a instanceof Error?a.stack??a.message:String(a)));return}H("building the city…");const r=new lt(s);r.set("isolated",crossOriginIsolated?"yes":"no");const i=new it,o=new ct(e,i),c=new Qe(n,i,r);c.build();let u=0;n.onLost(async a=>{if(c.teardown(),a.reason!=="destroyed"){if(++u>be){$("device-lost",`${a.message}

gave up after ${be} attempts`);return}H("recovering GPU…");try{await n.recover(),c.build(),c.start(l=>o.update(l)),H(""),document.getElementById("boot")?.classList.add("done")}catch(l){$("device-lost",String(l))}}}),document.addEventListener("visibilitychange",()=>{document.hidden?c.stop():c.start()});const f=new URLSearchParams(location.search).has("bench")?new dt(i,c,a=>{const l=ft(a,c.buildingCount);for(const d of l.split(`
`))g.info("bench",d);mt(l)}):null;c.start(a=>{o.update(a),f?.update(a)}),e.focus(),document.getElementById("boot")?.classList.add("done"),g.info("boot","running — drag to pan, right-drag to orbit, wheel to zoom")}function mt(s){const e=document.createElement("pre");e.textContent=s+`

(click to copy)`,e.style.cssText=["position:fixed","left:50%","top:50%","transform:translate(-50%,-50%)","padding:18px 22px","background:rgba(6,9,13,.94)","border:1px solid rgba(98,212,255,.22)","border-radius:4px","font:12px/1.6 var(--mono)","color:#c9d4e3","z-index:30","cursor:pointer","white-space:pre","max-width:92vw","overflow:auto"].join(";"),e.addEventListener("click",()=>{navigator.clipboard?.writeText(s),e.remove()}),document.body.appendChild(e)}addEventListener("error",s=>g.error("window",`${s.message} @ ${s.filename}:${s.lineno}`));addEventListener("unhandledrejection",s=>g.error("window",`unhandled rejection: ${String(s.reason)}`));pt();
//# sourceMappingURL=index-C6hKxqWg.js.map
