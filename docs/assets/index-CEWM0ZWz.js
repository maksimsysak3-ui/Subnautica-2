(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();const H={debug:0,info:1,warn:2,error:3},de={debug:"#5d6b80",info:"#c9d4e3",warn:"#ffb454",error:"#ff6b7a"},le=256,G=[];let ce="debug",y=null,_=!1;function I(i,e,t){if(H[i]<H[ce])return;G.push({t:performance.now(),level:i,scope:e,msg:t}),G.length>le&&G.shift(),_=!0;const n=`[${e}] ${t}`;i==="error"?console.error(n):i==="warn"?console.warn(n):console.log(n)}const l={debug:(i,e)=>I("debug",i,e),info:(i,e)=>I("info",i,e),warn:(i,e)=>I("warn",i,e),error:(i,e)=>I("error",i,e),setLevel:i=>{ce=i},entries:()=>G};function ue(i){y=document.createElement("div"),y.style.cssText=["position:absolute","left:0","bottom:0","width:100%","max-height:45%","overflow:hidden","padding:8px 12px","background:rgba(6,9,13,.92)","border-top:1px solid rgba(98,212,255,.18)","font:11px/1.55 var(--mono)","white-space:pre-wrap","display:none","pointer-events:none"].join(";"),i.appendChild(y),addEventListener("keydown",t=>{t.key!=="`"||t.metaKey||t.ctrlKey||y&&(y.style.display=y.style.display==="none"?"block":"none",_=!0)});const e=()=>{y&&_&&y.style.display!=="none"&&(y.innerHTML=G.slice(-40).map(t=>`<span style="color:#3d4757">${(t.t/1e3).toFixed(2).padStart(7)}</span> <span style="color:${de[t.level]}">[${t.scope}] ${fe(t.msg)}</span>`).join("<br>"),_=!1),requestAnimationFrame(e)};requestAnimationFrame(e)}function fe(i){return i.replace(/[&<>]/g,e=>e==="&"?"&amp;":e==="<"?"&lt;":"&gt;")}const pe={maxBufferSize:512*1024*1024,maxStorageBufferBindingSize:512*1024*1024,maxTextureDimension2D:8192,maxTextureArrayLayers:256,maxStorageBuffersPerShaderStage:8,maxSampledTexturesPerShaderStage:16,maxComputeWorkgroupStorageSize:16384,maxComputeInvocationsPerWorkgroup:256},me={maxBufferSize:128*1024*1024,maxStorageBufferBindingSize:128*1024*1024,maxTextureDimension2D:4096};function W(i){const e={};for(const[t,n]of Object.entries(pe)){const s=i.limits[t];typeof s=="number"&&(e[t]=Math.min(n,s))}return e}function Z(i){return["timestamp-query","texture-compression-bc","texture-compression-astc","indirect-first-instance"].filter(t=>i.features.has(t))}function J(i){return`${(i/1024/1024).toFixed(0)} MiB`}function ge(i,e){const t=i.info;if(t){const n=[t.vendor,t.architecture,t.device,t.description].filter(s=>s&&s.length>0).join(" / ");l.info("caps",`adapter: ${n||"(no info exposed)"}`)}l.info("caps",`features: ${[...e.features].join(", ")||"(none)"}`),l.info("caps",`buffers: max ${J(e.limits.maxBufferSize)}, storage binding ${J(e.limits.maxStorageBufferBindingSize)}`),l.info("caps",`textures: ${e.limits.maxTextureDimension2D}px 2D, ${e.limits.maxTextureArrayLayers} array layers`),l.info("caps",`compute: ${e.limits.maxComputeInvocationsPerWorkgroup} invocations/wg, ${e.limits.maxComputeWorkgroupStorageSize}B shared`);for(const[n,s]of Object.entries(me)){const r=e.limits[n];typeof r=="number"&&r<s&&l.warn("caps",`${n} is ${r}, below the ${s} the design budgets assume`)}e.features.has("timestamp-query")||l.warn("caps","no timestamp-query: GPU timings in the budget HUD will be unavailable")}class E extends Error{constructor(e,t){super(t),this.kind=e,this.name="GpuInitError"}}const Q=2;class K{constructor(e,t,n,s,r){this.canvas=e,this.adapter=t,this.device=n,this.context=s,this.format=r}viewport={width:1,height:1,dpr:1};resizeHandlers=new Set;lostHandlers=new Set;observer=null;destroyed=!1;static async create(e){if(!("gpu"in navigator)||!navigator.gpu)throw new E("no-webgpu","navigator.gpu is undefined");const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new E("no-adapter","requestAdapter() returned null");let n;try{n=await t.requestDevice({label:"citysim-device",requiredFeatures:Z(t),requiredLimits:W(t)})}catch(a){throw new E("no-device",String(a))}const s=e.getContext("webgpu");if(!s)throw new E("no-device",'canvas.getContext("webgpu") returned null');const r=navigator.gpu.getPreferredCanvasFormat(),o=new K(e,t,n,s,r);return ge(t,n),l.info("gpu",`canvas format: ${r}`),o.configure(),o.watchResize(),o.watchLoss(),o.watchErrors(),o}configure(){this.context.configure({device:this.device,format:this.format,alphaMode:"opaque",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})}watchResize(){this.observer=new ResizeObserver(e=>{const t=e[0];t&&this.applySize(t)});try{this.observer.observe(this.canvas,{box:"device-pixel-content-box"})}catch{this.observer.observe(this.canvas)}this.resizeNow()}applySize(e){const t=Math.min(devicePixelRatio||1,Q),n=e.devicePixelContentBoxSize?.[0];let s,r;n?(s=n.inlineSize,r=n.blockSize):(s=Math.round(e.contentRect.width*t),r=Math.round(e.contentRect.height*t)),this.setSize(s,r,t)}resizeNow(){const e=Math.min(devicePixelRatio||1,Q),t=this.canvas.getBoundingClientRect();this.setSize(Math.round(t.width*e),Math.round(t.height*e),e)}setSize(e,t,n){const s=this.device.limits.maxTextureDimension2D,r=Math.max(1,Math.min(e,s)),o=Math.max(1,Math.min(t,s));if(!(r===this.viewport.width&&o===this.viewport.height)){this.canvas.width=r,this.canvas.height=o,this.viewport.width=r,this.viewport.height=o,this.viewport.dpr=n,l.debug("gpu",`viewport ${r}x${o} @${n}x`);for(const a of this.resizeHandlers)a(this.viewport)}}onResize(e){return this.resizeHandlers.add(e),()=>this.resizeHandlers.delete(e)}watchLoss(){this.device.lost.then(e=>{if(!(this.destroyed||e.reason==="destroyed")){l.error("gpu",`device lost: ${e.reason} -- ${e.message}`);for(const t of this.lostHandlers)t(e)}})}watchErrors(){this.device.addEventListener("uncapturederror",e=>{const t=e.error;l.error("gpu",`uncaptured ${t.constructor.name}: ${t.message}`)})}onLost(e){this.lostHandlers.add(e)}async recover(){l.warn("gpu","attempting device recovery");const e=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!e)throw new E("no-adapter","no adapter on recovery");this.adapter=e,this.device=await e.requestDevice({label:"citysim-device (recovered)",requiredFeatures:Z(e),requiredLimits:W(e)}),this.configure(),this.watchLoss(),this.watchErrors(),l.info("gpu","device recovered")}destroy(){this.destroyed=!0,this.observer?.disconnect(),this.observer=null,this.resizeHandlers.clear(),this.lostHandlers.clear(),this.device.destroy()}}const he=8,M=8,ee=6,N=84,te=.55;function F(i,e,t){let n=i*374761393+e*668265263+t*2246822519>>>0;return n=Math.imul(n^n>>>13,1274126177)>>>0,((n^n>>>16)>>>0)/4294967296}function ve(){const i=N/2,e=[];for(let n=0;n<N;n++)for(let s=0;s<N;s++){if(n%(ee+1)===0||s%(ee+1)===0||F(n,s,1)<.12)continue;const o=(n-i)*M+M/2,a=(s-i)*M+M/2,c=Math.hypot(o,a)/(i*M),d=Math.max(0,1-c*1.35),h=F(n,s,7),u=9+F(n,s,3)*13+d*d*74*(.4+h*.8),f=1-Math.min(u/340,.16),w=(M/2-te)*f,b=(M/2-te)*f,g=Math.min(u/80,1),v=(F(n,s,11)-.5)*.06,x=.2+g*.34+v,S=.24+g*.36+v,z=.3+g*.38+v;e.push(o,a,w,b,u,x,S,z)}const t=new Float32Array(e.length);return t.set(e),{data:t,count:e.length/he}}const we=`// Shared camera binding. Every pipeline binds this as group 0.

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
  return smoothstep(camera.params.y * 0.45, camera.params.y * 1.05, d);
}
`,be=`// The ground plane and its grid.
//
// One quad, no geometry per line. The grid is procedural in the fragment
// shader, with line width derived from screen-space derivatives so a line is
// one pixel wide whether the camera is 8 metres up or 1200. Drawing real line
// geometry would mean thousands of primitives that alias into moire the moment
// you zoom out.
//
// Spacings are the simulation's, not decoration: 8 m is the zoning cell the
// design doc specifies, 64 m is a city block.

#include "common.wgsl"

const CELL  = 8.0;
const BLOCK = 64.0;

struct VSOut {
  @builtin(position) pos   : vec4f,
  @location(0)       world : vec3f,
};

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VSOut {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
    vec2f(-1.0, -1.0), vec2f( 1.0,  1.0), vec2f(-1.0,  1.0),
  );
  let extent = camera.params.y;
  // Anchored under the camera so the plane can never run out from under a
  // panning view, however far the focus travels.
  let p = quad[vi] * extent + camera.eye.xz;

  var out : VSOut;
  out.world = vec3f(p.x, 0.0, p.y);
  out.pos = camera.viewProj * vec4f(out.world, 1.0);
  return out;
}

// Anti-aliased grid: 1 where a line crosses this pixel, 0 between lines.
fn gridLine(xz : vec2f, spacing : f32) -> f32 {
  let c = xz / spacing;
  let d = abs(fract(c - 0.5) - 0.5) / max(fwidth(c), vec2f(1e-6));
  return 1.0 - min(min(d.x, d.y), 1.0);
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let base  = vec3f(0.062, 0.075, 0.094);
  let minor = vec3f(0.118, 0.145, 0.180);
  let major = vec3f(0.200, 0.255, 0.310);
  let axis  = vec3f(0.290, 0.560, 0.720);

  var col = base;
  col = mix(col, minor, gridLine(in.world.xz, CELL) * 0.75);
  col = mix(col, major, gridLine(in.world.xz, BLOCK));

  // The two world axes, so origin is always findable.
  let ax = 1.0 - min(abs(in.world.x) / max(fwidth(in.world.x), 1e-6), 1.0);
  let az = 1.0 - min(abs(in.world.z) / max(fwidth(in.world.z), 1e-6), 1.0);
  col = mix(col, axis, max(ax, az));

  return vec4f(mix(col, SKY, horizonFade(in.world)), 1.0);
}
`,xe=`// Instanced boxes -- the stand-in for buildings.
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
  // x = height, yzw = colour
  form   : vec4f,
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
    local.y * box.form.x,
    box.ground.y + local.z * box.ground.w,
  );

  var out : VSOut;
  out.pos = camera.viewProj * vec4f(world, 1.0);
  out.normal = N[vi / 6u];
  out.world = world;
  out.colour = box.form.yzw;
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
`,Y="depth24plus",ne=96;function ie(i){return i.replace(/^[ \t]*#include\s+"common\.wgsl"[ \t]*$/m,we)}class ye{constructor(e,t,n){this.gpu=e,this.camera=t,this.stats=n}res=null;cameraData=new Float32Array(ne/4);raf=0;startedAt=0;lastFrame=0;unsubscribeResize=null;running=!1;onUpdate=null;build(){const{device:e,format:t}=this.gpu,n=e.createBindGroupLayout({label:"camera-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),s=e.createBindGroupLayout({label:"instance-bgl",entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),r={format:Y,depthWriteEnabled:!0,depthCompare:"less"},o=e.createShaderModule({label:"ground",code:ie(be)}),a=e.createRenderPipeline({label:"ground-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[n]}),vertex:{module:o,entryPoint:"vs"},fragment:{module:o,entryPoint:"fs",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:r}),c=e.createShaderModule({label:"box",code:ie(xe)}),d=e.createRenderPipeline({label:"box-pipeline",layout:e.createPipelineLayout({bindGroupLayouts:[n,s]}),vertex:{module:c,entryPoint:"vs"},fragment:{module:c,entryPoint:"fs",targets:[{format:t}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:r}),h=e.createBuffer({label:"camera-uniform",size:ne,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),m=e.createBindGroup({label:"camera-bg",layout:n,entries:[{binding:0,resource:{buffer:h}}]}),u=ve(),f=e.createBuffer({label:"box-instances",size:u.data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(f,0,u.data);const w=e.createBindGroup({label:"instance-bg",layout:s,entries:[{binding:0,resource:{buffer:f}}]}),{depth:b,depthView:g}=this.createDepth(this.gpu.viewport);this.res={ground:a,boxes:d,cameraBuffer:h,cameraGroup:m,instanceBuffer:f,instanceGroup:w,depth:b,depthView:g,instanceCount:u.count},this.unsubscribeResize?.(),this.unsubscribeResize=this.gpu.onResize(x=>this.onResize(x)),this.camera.setViewport(this.gpu.viewport.width,this.gpu.viewport.height),this.camera.update();const v=u.count*he*4/1024;l.info("render",`${u.count} instances (${v.toFixed(0)} KiB), 2 pipelines, depth ${Y}`)}createDepth(e){const t=this.gpu.device.createTexture({label:"depth",size:{width:e.width,height:e.height},format:Y,usage:GPUTextureUsage.RENDER_ATTACHMENT});return{depth:t,depthView:t.createView()}}onResize(e){if(this.camera.setViewport(e.width,e.height),this.camera.update(),!this.res)return;this.res.depth.destroy();const{depth:t,depthView:n}=this.createDepth(e);this.res.depth=t,this.res.depthView=n}start(e){if(e&&(this.onUpdate=e),this.running)return;this.running=!0,this.startedAt=performance.now(),this.lastFrame=this.startedAt;const t=n=>{this.running&&(this.raf=requestAnimationFrame(t),this.frame(n))};this.raf=requestAnimationFrame(t)}stop(){this.running=!1,cancelAnimationFrame(this.raf)}frame(e){const t=this.res;if(!t)return;const n=Math.min((e-this.lastFrame)/1e3,.1);this.lastFrame=e,this.onUpdate?.(n);const s=performance.now(),{device:r,context:o,viewport:a}=this.gpu,c=this.camera;this.cameraData.set(c.viewProjMatrix,0),this.cameraData[16]=c.eye[0],this.cameraData[17]=c.eye[1],this.cameraData[18]=c.eye[2],this.cameraData[19]=c.far,this.cameraData[20]=(e-this.startedAt)/1e3,this.cameraData[21]=Pe,r.queue.writeBuffer(t.cameraBuffer,0,this.cameraData);const d=r.createCommandEncoder({label:"frame"}),h=d.beginRenderPass({label:"main",colorAttachments:[{view:o.getCurrentTexture().createView(),clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:t.depthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});h.setBindGroup(0,t.cameraGroup),h.setPipeline(t.ground),h.draw(6),h.setPipeline(t.boxes),h.setBindGroup(1,t.instanceGroup),h.draw(30,t.instanceCount),h.end(),r.queue.submit([d.finish()]),this.stats.sample(performance.now()-s),this.stats.set("draws","2"),this.stats.set("instances",String(t.instanceCount)),this.stats.set("tris",String(10*t.instanceCount+2)),this.stats.set("zoom",`${c.distance.toFixed(0)}m`),this.stats.set("px",`${a.width}×${a.height}`),this.stats.paint(e)}teardown(){this.stop(),this.res&&(this.res.depth.destroy(),this.res.cameraBuffer.destroy(),this.res.instanceBuffer.destroy(),this.res=null)}}const Pe=2600;function j(){const i=new Float32Array(16);return i[0]=i[5]=i[10]=i[15]=1,i}function Se(i,e,t,n,s){const r=1/Math.tan(e/2),o=1/(n-s);return i[0]=r/t,i[1]=0,i[2]=0,i[3]=0,i[4]=0,i[5]=r,i[6]=0,i[7]=0,i[8]=0,i[9]=0,i[10]=s*o,i[11]=-1,i[12]=0,i[13]=0,i[14]=s*n*o,i[15]=0,i}function ze(i,e,t,n){let s=e[0]-t[0],r=e[1]-t[1],o=e[2]-t[2],a=Math.hypot(s,r,o)||1;s/=a,r/=a,o/=a;let c=n[1]*o-n[2]*r,d=n[2]*s-n[0]*o,h=n[0]*r-n[1]*s;a=Math.hypot(c,d,h)||1,c/=a,d/=a,h/=a;const m=r*h-o*d,u=o*c-s*h,f=s*d-r*c;return i[0]=c,i[1]=m,i[2]=s,i[3]=0,i[4]=d,i[5]=u,i[6]=r,i[7]=0,i[8]=h,i[9]=f,i[10]=o,i[11]=0,i[12]=-(c*e[0]+d*e[1]+h*e[2]),i[13]=-(m*e[0]+u*e[1]+f*e[2]),i[14]=-(s*e[0]+r*e[1]+o*e[2]),i[15]=1,i}function Me(i,e,t){for(let n=0;n<4;n++){const s=t[n*4],r=t[n*4+1],o=t[n*4+2],a=t[n*4+3];i[n*4]=e[0]*s+e[4]*r+e[8]*o+e[12]*a,i[n*4+1]=e[1]*s+e[5]*r+e[9]*o+e[13]*a,i[n*4+2]=e[2]*s+e[6]*r+e[10]*o+e[14]*a,i[n*4+3]=e[3]*s+e[7]*r+e[11]*o+e[15]*a}return i}function Ee(i,e){const t=e[0],n=e[1],s=e[2],r=e[3],o=e[4],a=e[5],c=e[6],d=e[7],h=e[8],m=e[9],u=e[10],f=e[11],w=e[12],b=e[13],g=e[14],v=e[15],x=t*a-n*o,S=t*c-s*o,z=t*d-r*o,L=n*c-s*a,T=n*d-r*a,B=s*d-r*c,D=h*b-m*w,O=h*g-u*w,A=h*v-f*w,k=m*g-u*b,R=m*v-f*b,$=u*v-f*g,X=x*$-S*R+z*k+L*A-T*O+B*D;if(!X)return!1;const p=1/X;return i[0]=(a*$-c*R+d*k)*p,i[1]=(s*R-n*$-r*k)*p,i[2]=(b*B-g*T+v*L)*p,i[3]=(u*T-m*B-f*L)*p,i[4]=(c*A-o*$-d*O)*p,i[5]=(t*$-s*A+r*O)*p,i[6]=(g*z-w*B-v*S)*p,i[7]=(h*B-u*z+f*S)*p,i[8]=(o*R-a*A+d*D)*p,i[9]=(n*A-t*R-r*D)*p,i[10]=(w*T-b*z+v*x)*p,i[11]=(m*z-h*T-f*x)*p,i[12]=(a*O-o*k-c*D)*p,i[13]=(t*k-n*O+s*D)*p,i[14]=(b*S-w*L-g*x)*p,i[15]=(h*L-m*S+u*x)*p,!0}function se(i,e,t,n,s){const r=e[3]*t+e[7]*n+e[11]*s+e[15]||1;return i[0]=(e[0]*t+e[4]*n+e[8]*s+e[12])/r,i[1]=(e[1]*t+e[5]*n+e[9]*s+e[13])/r,i[2]=(e[2]*t+e[6]*n+e[10]*s+e[14])/r,i}function C(i,e,t){return i<e?e:i>t?t:i}const Ce=50*Math.PI/180,Le=[0,1,0],P={minDistance:8,maxDistance:1200,minPitch:12*Math.PI/180,maxPitch:88*Math.PI/180,extent:2e3};class Te{focus=[0,0,0];distance=120;yaw=Math.PI*.25;pitch=45*Math.PI/180;near=.5;far=6e3;view=j();proj=j();viewProj=j();invViewProj=j();eye=[0,0,0];aspect=1;scratch=[0,0,0];setViewport(e,t){this.aspect=e/Math.max(t,1)}update(){this.pitch=C(this.pitch,P.minPitch,P.maxPitch),this.distance=C(this.distance,P.minDistance,P.maxDistance),this.focus[0]=C(this.focus[0],-2e3,P.extent),this.focus[2]=C(this.focus[2],-2e3,P.extent),this.focus[1]=0;const e=Math.cos(this.pitch);this.eye[0]=this.focus[0]+this.distance*e*Math.sin(this.yaw),this.eye[1]=this.focus[1]+this.distance*Math.sin(this.pitch),this.eye[2]=this.focus[2]+this.distance*e*Math.cos(this.yaw),this.near=Math.max(.25,this.distance*.01),this.far=this.distance*12+2e3,ze(this.view,this.eye,this.focus,Le),Se(this.proj,Ce,this.aspect,this.near,this.far),Me(this.viewProj,this.proj,this.view),Ee(this.invViewProj,this.viewProj)}groundPointAt(e,t,n=[0,0,0]){const s=se(this.scratch,this.invViewProj,e,t,0),r=s[0],o=s[1],a=s[2],c=se(this.scratch,this.invViewProj,e,t,1),d=c[1]-o;if(Math.abs(d)<1e-6)return null;const h=-o/d;return h<0||h>1?null:(n[0]=r+(c[0]-r)*h,n[1]=0,n[2]=a+(c[2]-a)*h,n)}panBy(e,t){const n=Math.sin(this.yaw),s=Math.cos(this.yaw);this.focus[0]+=e*s-t*n,this.focus[2]+=-e*n-t*s}zoomBy(e){this.distance=C(this.distance*e,P.minDistance,P.maxDistance)}get viewProjMatrix(){return this.viewProj}}const re=.006,Be=1.4,q=1.6,oe=1.9,De=.0016;class Oe{constructor(e,t){this.canvas=e,this.camera=t,this.on(e,"pointerdown",this.onPointerDown),this.on(e,"pointermove",this.onPointerMove),this.on(e,"pointerup",this.onPointerUp),this.on(e,"pointercancel",this.onPointerUp),this.on(e,"wheel",this.onWheel,{passive:!1}),this.on(e,"contextmenu",n=>n.preventDefault()),this.on(window,"keydown",this.onKeyDown),this.on(window,"keyup",this.onKeyUp),this.on(window,"blur",()=>this.keys.clear())}mode="none";pointers=new Map;lastX=0;lastY=0;pinchDistance=0;keys=new Set;grabPoint=[0,0,0];a=[0,0,0];b=[0,0,0];disposers=[];on(e,t,n,s){e.addEventListener(t,n,s),this.disposers.push(()=>e.removeEventListener(t,n,s))}ndc(e,t){const n=this.canvas.getBoundingClientRect();return[(e-n.left)/Math.max(n.width,1)*2-1,1-(t-n.top)/Math.max(n.height,1)*2]}onPointerDown=e=>{if(this.canvas.setPointerCapture(e.pointerId),this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.canvas.focus(),this.pointers.size===2){this.mode="none",this.pinchDistance=this.pointerSpread();return}const t=e.button===1||e.button===2||e.shiftKey||e.altKey;if(this.mode=t?"orbit":"pan",this.lastX=e.clientX,this.lastY=e.clientY,this.mode==="pan"){const[n,s]=this.ndc(e.clientX,e.clientY);this.camera.groundPointAt(n,s,this.grabPoint)||(this.mode="none")}};onPointerMove=e=>{const t=this.pointers.get(e.pointerId);if(t){if(t.x=e.clientX,t.y=e.clientY,this.pointers.size===2){const n=this.pointerSpread();this.pinchDistance>0&&n>0&&(this.camera.zoomBy(C(this.pinchDistance/n,.5,2)),this.camera.update()),this.pinchDistance=n;return}if(this.mode==="orbit"){this.camera.yaw-=(e.clientX-this.lastX)*re,this.camera.pitch+=(e.clientY-this.lastY)*re,this.lastX=e.clientX,this.lastY=e.clientY,this.camera.update();return}if(this.mode==="pan"){const[n,s]=this.ndc(e.clientX,e.clientY),r=this.camera.groundPointAt(n,s,this.a);if(!r)return;this.camera.focus[0]+=this.grabPoint[0]-r[0],this.camera.focus[2]+=this.grabPoint[2]-r[2],this.camera.update()}}};onPointerUp=e=>{this.pointers.delete(e.pointerId),this.canvas.hasPointerCapture(e.pointerId)&&this.canvas.releasePointerCapture(e.pointerId),this.pointers.size<2&&(this.pinchDistance=0),this.pointers.size===0&&(this.mode="none")};pointerSpread(){const e=this.pointers.values(),t=e.next().value,n=e.next().value;return!t||!n?0:Math.hypot(t.x-n.x,t.y-n.y)}onWheel=e=>{e.preventDefault();const[t,n]=this.ndc(e.clientX,e.clientY),s=e.deltaMode===1?e.deltaY*33:e.deltaY,r=this.camera.groundPointAt(t,n,this.a);this.camera.zoomBy(Math.exp(s*De)),this.camera.update();const o=this.camera.groundPointAt(t,n,this.b);r&&o&&(this.camera.focus[0]+=r[0]-o[0],this.camera.focus[2]+=r[2]-o[2],this.camera.update())};onKeyDown=e=>{e.metaKey||e.ctrlKey||this.keys.add(e.key.toLowerCase())};onKeyUp=e=>{this.keys.delete(e.key.toLowerCase())};update(e){if(this.keys.size===0)return!1;const t=this.keys,n=this.camera;let s=!1;const r=Be*n.distance*e;let o=0,a=0;return(t.has("a")||t.has("arrowleft"))&&(o-=r),(t.has("d")||t.has("arrowright"))&&(o+=r),(t.has("w")||t.has("arrowup"))&&(a+=r),(t.has("s")||t.has("arrowdown"))&&(a-=r),(o||a)&&(n.panBy(o,a),s=!0),t.has("q")&&(n.yaw+=q*e,s=!0),t.has("e")&&(n.yaw-=q*e,s=!0),t.has("r")&&(n.pitch+=q*e,s=!0),t.has("f")&&(n.pitch-=q*e,s=!0),(t.has("=")||t.has("+"))&&(n.zoomBy(Math.exp(-oe*e)),s=!0),(t.has("-")||t.has("_"))&&(n.zoomBy(Math.exp(oe*e)),s=!0),s&&n.update(),s}dispose(){for(const e of this.disposers)e();this.disposers=[]}}class Ae{el;samples=new Float32Array(120);cursor=0;lastPaint=0;rows=new Map;constructor(e){this.el=document.createElement("div"),this.el.style.cssText=["position:absolute","top:10px","left:12px","padding:8px 11px","background:rgba(6,9,13,.72)","border:1px solid rgba(98,212,255,.16)","border-radius:3px","font:11px/1.6 var(--mono)","color:#8fa3bd","pointer-events:none","white-space:pre","letter-spacing:.02em"].join(";"),e.appendChild(this.el)}sample(e){this.samples[this.cursor]=e,this.cursor=(this.cursor+1)%this.samples.length}set(e,t){this.rows.set(e,t)}paint(e){if(e-this.lastPaint<250)return;this.lastPaint=e;let t=0,n=0;for(const o of this.samples)t+=o,o>n&&(n=o);const s=t/this.samples.length,r=[`${(1e3/Math.max(s,.001)).toFixed(0).padStart(4)} fps`,`${s.toFixed(2).padStart(5)} ms  avg`,`${n.toFixed(2).padStart(5)} ms  peak`];for(const[o,a]of this.rows)r.push(`${a.padStart(5)}  ${o}`);this.el.textContent=r.join(`
`)}}const ke={"no-webgpu":"This browser has no WebGPU","no-adapter":"No compatible GPU found","no-device":"The GPU refused to start","device-lost":"Lost connection to the GPU",internal:"Something broke during startup"};function Re(i){const e=navigator.userAgent,t=/Chrome|Chromium|Edg\//.test(e)&&!/OPR\//.test(e),n=/Firefox\//.test(e),s=/Safari\//.test(e)&&!/Chrome|Chromium|Edg\//.test(e);return i==="no-webgpu"?n?["Firefox ships WebGPU on Windows from version 141. On macOS and Linux it is still behind a flag.","Open about:config and set dom.webgpu.enabled to true, then reload.","Or use Chrome, Edge, or Safari 18+."]:s?["Safari supports WebGPU from version 18 (macOS Sequoia, iOS 18).","On older Safari: Develop → Feature Flags → enable WebGPU."]:t?["Chrome and Edge support WebGPU from version 113, so this is unusual.","Check chrome://gpu — WebGPU may be blocklisted for this GPU or driver.","Updating your graphics driver is the usual fix."]:["Try a recent Chrome, Edge, or Safari 18+."]:i==="no-adapter"?["The browser has WebGPU but could not find a usable GPU.","This is common in virtual machines, remote desktops, and on Linux without a working Vulkan driver.",t?"Check chrome://gpu for the reason it was rejected.":"Check your browser’s GPU diagnostics page."]:i==="device-lost"?["The GPU process crashed or was reset — usually a driver timeout or the machine waking from sleep.","Reloading normally fixes it. If it happens repeatedly, update your graphics driver."]:["Reload to try again. If it keeps happening, the details below are worth reporting."]}function U(i,e){const t=document.getElementById("boot");t&&t.classList.remove("done");const n=t??document.body;n.innerHTML="",n.style.cssText+=";display:grid;place-content:center;padding:32px;text-align:left;max-width:min(680px,92vw);margin:0 auto;";const s=document.createElement("h1");s.textContent=ke[i],s.style.cssText="font:500 15px/1.4 var(--mono);letter-spacing:.06em;color:var(--err);text-transform:none;margin-bottom:14px;",n.appendChild(s);const r=document.createElement("div");r.style.cssText="color:var(--fg);font-size:13px;line-height:1.75;";for(const a of Re(i)){const c=document.createElement("p");c.textContent=a,c.style.cssText="margin-bottom:8px;",r.appendChild(c)}if(n.appendChild(r),e){const a=document.createElement("pre");a.textContent=e,a.style.cssText="margin-top:20px;padding:12px 14px;background:rgba(255,107,122,.07);border-left:2px solid var(--err);color:var(--dim);font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;",n.appendChild(a)}const o=document.createElement("p");o.innerHTML='Reported at <a href="https://github.com/maksimsysak3-ui/Subnautica-2/issues" style="color:var(--accent)">github.com/maksimsysak3-ui/Subnautica-2</a>',o.style.cssText="margin-top:22px;color:var(--dim);font-size:11px;",n.appendChild(o)}const ae=3;window.__citysimBooted=!0;function V(i){const e=document.getElementById("boot-status");e&&(e.textContent=i)}async function $e(){const i=document.getElementById("overlay"),e=document.getElementById("gpu-canvas");if(!i||!(e instanceof HTMLCanvasElement)){U("internal","index.html is missing #gpu-canvas or #overlay");return}ue(i),l.info("boot",`citysim starting, ua=${navigator.userAgent}`),l.info("boot",`crossOriginIsolated=${crossOriginIsolated} sharedArrayBuffer=${typeof SharedArrayBuffer<"u"}`),crossOriginIsolated||l.info("boot","not cross-origin isolated (expected): SharedArrayBuffer unavailable"),V("requesting GPU…");let t;try{t=await K.create(e)}catch(c){c instanceof E?(l.error("boot",`${c.kind}: ${c.message}`),U(c.kind,c.message)):(l.error("boot",String(c)),U("internal",c instanceof Error?c.stack??c.message:String(c)));return}V("building the city…");const n=new Ae(i);n.set("isolated",crossOriginIsolated?"yes":"no");const s=new Te,r=new Oe(e,s),o=new ye(t,s,n);o.build();let a=0;t.onLost(async c=>{if(o.teardown(),c.reason!=="destroyed"){if(++a>ae){U("device-lost",`${c.message}

gave up after ${ae} attempts`);return}V("recovering GPU…");try{await t.recover(),o.build(),o.start(d=>r.update(d)),V(""),document.getElementById("boot")?.classList.add("done")}catch(d){U("device-lost",String(d))}}}),document.addEventListener("visibilitychange",()=>{document.hidden?o.stop():o.start()}),o.start(c=>r.update(c)),e.focus(),document.getElementById("boot")?.classList.add("done"),l.info("boot","running — drag to pan, right-drag to orbit, wheel to zoom")}addEventListener("error",i=>l.error("window",`${i.message} @ ${i.filename}:${i.lineno}`));addEventListener("unhandledrejection",i=>l.error("window",`unhandled rejection: ${String(i.reason)}`));$e();
//# sourceMappingURL=index-CEWM0ZWz.js.map
