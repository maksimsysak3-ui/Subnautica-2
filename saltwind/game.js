
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/* =====================================================================================
   UTILITIES
   ===================================================================================== */
const $=id=>document.getElementById(id);
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let rng=Math.random;const rr=(a,b)=>a+rng()*(b-a),ri=(a,b)=>Math.floor(rr(a,b+1)),pick=a=>a[Math.floor(rng()*a.length)];
function hash(x,y){let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}
// 2D simplex noise
function makeNoise(seed){const r=mulberry(seed),p=new Uint8Array(512),perm=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[perm[i],perm[j]]=[perm[j],perm[i]];}for(let i=0;i<512;i++)p[i]=perm[i&255];
  const g=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]],F=0.5*(Math.sqrt(3)-1),G=(3-Math.sqrt(3))/6;
  const n2=(x,y)=>{const s=(x+y)*F,i=Math.floor(x+s),j=Math.floor(y+s),t=(i+j)*G,x0=x-(i-t),y0=y-(j-t),i1=x0>y0?1:0,j1=1-i1,x1=x0-i1+G,y1=y0-j1+G,x2=x0-1+2*G,y2=y0-1+2*G;
    let n=0;const c=(gx,gy,xx,yy)=>{let tt=0.5-xx*xx-yy*yy;if(tt<0)return 0;tt*=tt;const q=g[p[gx+p[gy]]&7];return tt*tt*(q[0]*xx+q[1]*yy);};
    n+=c(i&255,j&255,x0,y0);n+=c((i+i1)&255,(j+j1)&255,x1,y1);n+=c((i+1)&255,(j+1)&255,x2,y2);return 70*n;};
  return{n2,fbm(x,y,o=4){let a=0,f=1,s=0.5;for(let i=0;i<o;i++){a+=s*n2(x*f,y*f);f*=2.03;s*=0.5;}return a;}};}

/* =====================================================================================
   AUDIO — everything synthesized
   ===================================================================================== */
const AU={c:null,m:null,amb:{},muted:!!store.get('sw.muted',false),
  init(){if(this.c){if(this.c.state==='suspended')this.c.resume();return;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;let c;try{c=this.c=new AC();}catch(e){return;}
    const comp=c.createDynamicsCompressor();comp.connect(c.destination);this.m=c.createGain();this.m.gain.value=this.muted?0:0.8;this.m.connect(comp);
    const len=c.sampleRate*2.5,ir=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.4);}
    this.rev=c.createConvolver();this.rev.buffer=ir;const rg=c.createGain();rg.gain.value=0.35;this.rev.connect(rg);rg.connect(this.m);
    const nb=c.createBuffer(1,c.sampleRate*3,c.sampleRate),nd=nb.getChannelData(0);let b=0;for(let i=0;i<nd.length;i++){const w=Math.random()*2-1;b=0.985*b+0.015*w;nd[i]=b*6+w*0.15;}this.nb=nb;
    const loop=(f,q,type)=>{const s=c.createBufferSource();s.buffer=nb;s.loop=true;const fl=c.createBiquadFilter();fl.type=type||'lowpass';fl.frequency.value=f;fl.Q.value=q||0.5;const g=c.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(this.m);s.start(0,Math.random()*2);return{g,fl};};
    this.amb.waves=loop(520,0.6);this.amb.wind=loop(900,0.4,'bandpass');MUS.start();},
  setMuted(v){this.muted=v;store.set('sw.muted',v);if(this.m)this.m.gain.setTargetAtTime(v?0:0.8,this.c.currentTime,0.1);},
  tone(f,d,o){o=o||{};const c=this.c;if(!c||this.muted)return;const t=c.currentTime+(o.at||0),os=c.createOscillator();os.type=o.type||'sine';os.frequency.setValueAtTime(f,t);if(o.to)os.frequency.exponentialRampToValueAtTime(o.to,t+d);
    const g=c.createGain(),v=o.v||0.1,a=o.a||0.005;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    let n=os;if(o.lp){const fl=c.createBiquadFilter();fl.frequency.value=o.lp;os.connect(fl);n=fl;}n.connect(g);g.connect(o.bus||this.m);if(o.rev){const s=c.createGain();s.gain.value=o.rev;g.connect(s);s.connect(this.rev);}os.start(t);os.stop(t+d+0.05);},
  noise(d,o){o=o||{};const c=this.c;if(!c||this.muted)return;const t=c.currentTime+(o.at||0),s=c.createBufferSource();s.buffer=this.nb;const fl=c.createBiquadFilter();fl.type=o.ft||'bandpass';fl.frequency.value=o.f||800;fl.Q.value=o.q||1;
    const g=c.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(o.v||0.1,t+(o.a||0.005));g.gain.exponentialRampToValueAtTime(0.0001,t+d);s.connect(fl);fl.connect(g);g.connect(this.m);if(o.rev){const r=this.c.createGain();r.gain.value=o.rev;g.connect(r);r.connect(this.rev);}s.start(t,Math.random()*2);s.stop(t+d+0.05);},
  ambient(waves,wind){if(!this.c)return;const t=this.c.currentTime;this.amb.waves.g.gain.setTargetAtTime(this.muted?0:waves,t,0.4);this.amb.wind.g.gain.setTargetAtTime(this.muted?0:wind,t,0.6);this.amb.waves.fl.frequency.setTargetAtTime(380+260*Math.sin(t*0.23)+200*Math.sin(t*0.61),t,0.3);}
};
const SFX={
  click(){AU.tone(420,0.07,{type:'triangle',v:0.05,lp:1800});AU.noise(0.03,{f:2400,v:0.03});},
  place(){AU.tone(140,0.25,{to:70,v:0.22});AU.noise(0.18,{ft:'lowpass',f:900,v:0.18});AU.tone(660,0.5,{at:0.06,v:0.03,rev:0.4});},
  done(){[0,4,7,12].forEach((s,i)=>AU.tone(392*Math.pow(2,s/12),0.9,{at:i*0.09,v:0.05,type:'triangle',rev:0.5}));},
  hammer(){AU.noise(0.06,{f:1800,q:3,v:0.05});AU.tone(900,0.05,{v:0.02,type:'square',lp:2000});},
  chop(){AU.noise(0.08,{f:700,q:2,v:0.05});},
  bell(){[0,0.5].forEach(a=>{AU.tone(523,2.2,{at:a,v:0.06,rev:0.7});AU.tone(1046*1.01,1.6,{at:a,v:0.025,rev:0.6});AU.tone(1568*0.99,1.2,{at:a,v:0.015,rev:0.6});});},
  horn(){[0,1.1].forEach(a=>{[73.4,110,146.8].forEach(f=>AU.tone(f,1.3,{at:a,type:'sawtooth',v:0.07,lp:600,a:0.25,rev:0.5}));});},
  bird(){if(!AU.c)return;const f=rr(2200,3400);for(let i=0;i<ri(2,4);i++)AU.tone(f*rr(0.9,1.1),0.09,{at:i*0.12,to:f*1.25,v:0.012,rev:0.3});},
  gull(){AU.tone(1300,0.35,{to:900,v:0.012,type:'triangle',rev:0.5});AU.tone(1250,0.3,{at:0.32,to:850,v:0.01,type:'triangle',rev:0.5});},
  cricket(){for(let i=0;i<3;i++)AU.tone(4300,0.03,{at:i*0.06,v:0.006,type:'square',lp:6000});},
  arrow(){AU.noise(0.12,{f:2500,q:4,v:0.03});},
  hit(){AU.noise(0.1,{ft:'lowpass',f:600,v:0.1});},
  coins(){for(let i=0;i<4;i++)AU.tone(2200+i*300,0.15,{at:i*0.05,v:0.025,type:'triangle'});},
  goal(){[0,7,12,16,19].forEach((s,i)=>AU.tone(330*Math.pow(2,s/12),1.4,{at:i*0.12,v:0.05,rev:0.6}));}
};
const MUS={on:false,next:0,step:0,season:0,start(){if(this.on)return;this.on=true;this.next=AU.c.currentTime+1;setInterval(()=>this.tick(),120);},
  tick(){const c=AU.c;if(!c||AU.muted)return;if(this.next<c.currentTime-0.5)this.next=c.currentTime+0.1;while(this.next<c.currentTime+0.4){this.play(this.step,this.next);this.step++;this.next+=0.55;}},
  play(s,t){const at=Math.max(0,t-AU.c.currentTime),keys=[50,52,48,45],root=keys[this.season],sc=[0,2,4,7,9,12,14,16],prog=[[0,4,7],[5,9,12],[-3,0,4],[7,11,14]],ch=prog[Math.floor(s/16)%4];
    if(s%16===0)ch.forEach(n=>AU.tone(440*Math.pow(2,(root+n-69+12)/12),8.5,{at,v:0.012,a:2,rev:0.8,type:'triangle'}));
    if(hash(s,7)>0.55){const n=root+24+sc[Math.floor(hash(s,3)*sc.length)];AU.tone(440*Math.pow(2,(n-69)/12),2.2,{at,v:0.022*(0.6+hash(s,9)*0.4),rev:0.7});}}
};

/* =====================================================================================
   RENDERER, SCENE, POST
   ===================================================================================== */
const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,1,0.5,1400);camera.position.set(70,62,78);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=0.08;controls.minDistance=16;controls.maxDistance=230;controls.maxPolarAngle=1.28;controls.minPolarAngle=0.25;
controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};controls.touches={ONE:null,TWO:THREE.TOUCH.DOLLY_ROTATE};controls.screenSpacePanning=false;controls.zoomSpeed=1.1;
const sun=new THREE.DirectionalLight(0xfff1d6,2.6);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-95,right:95,top:95,bottom:-95,near:10,far:700});sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.06;sun.shadow.radius=3;scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight(0xcfe6ff,0x5c6a3a,0.9);scene.add(hemi);
scene.fog=new THREE.Fog(0xbfd8e2,160,560);
// sky dome
const skyU={top:{value:new THREE.Color()},hor:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3()},sunCol:{value:new THREE.Color()},night:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyU,
  vertexShader:`varying vec3 vD;void main(){vD=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 top,hor,sunDir,sunCol;uniform float night;varying vec3 vD;
  float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}
  void main(){float y=max(vD.y,0.);vec3 c=mix(hor,top,pow(y,0.55));float s=max(dot(vD,sunDir),0.);c+=sunCol*(pow(s,600.)*3.+pow(s,10.)*0.25);
  if(night>0.){vec3 q=floor(vD*360.);float st=step(0.9975,h(q))*night*smoothstep(0.05,0.3,vD.y);c+=vec3(st);}
  gl_FragColor=vec4(c,1.);}`}));
scene.add(sky);
// post-processing
const composer=new EffectComposer(renderer);
const renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
let gtao=null;
const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),0.35,0.5,0.92);composer.addPass(bloom);
const gradePass=new ShaderPass({uniforms:{tDiffuse:{value:null},res:{value:new THREE.Vector2(1,1)},amt:{value:1},night:{value:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 res;uniform float amt,night;varying vec2 vUv;
  void main(){float b=smoothstep(.22,.62,abs(vUv.y-.52))*amt*3.2;vec4 acc=vec4(0.);float wsum=0.;
   for(int i=0;i<12;i++){float a=float(i)*2.39996;float r=sqrt(float(i)/12.);vec2 o=vec2(cos(a),sin(a))*r*b/res;float w=1.-r*.5;acc+=texture2D(tDiffuse,vUv+o)*w;wsum+=w;}
   vec3 c=(acc/wsum).rgb;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.12-night*.25);c=(c-.5)*1.05+.5;c*=mix(vec3(1.02,1.0,.96),vec3(.85,.92,1.1),night);
   vec2 v=vUv-.5;c*=1.-dot(v,v)*.55;gl_FragColor=vec4(c,1.);}`});
const outPass=new OutputPass();
composer.addPass(outPass);composer.addPass(gradePass);
let QUALITY=store.get('sw.gfx',matchMedia('(pointer:coarse)').matches?'low':'high');
function setupAO(){if(gtao){composer.removePass(gtao);gtao.dispose&&gtao.dispose();gtao=null;}
  if(QUALITY==='high'){try{gtao=new GTAOPass(scene,camera,innerWidth,innerHeight);gtao.output=GTAOPass.OUTPUT.Default;gtao.blendIntensity=0.85;
    gtao.updateGtaoMaterial({radius:1.6,distanceExponent:1.4,thickness:1.2,scale:1,samples:12});gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:12});
    const orig=gtao.render.bind(gtao);gtao.render=(...a)=>{const wv=water.visible;water.visible=false;orig(...a);water.visible=wv;};composer.insertPass(gtao,1);}catch(e){console.warn('AO unavailable',e);gtao=null;}}
  bloom.enabled=QUALITY==='high';resize();}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  const pr=renderer.getPixelRatio();gradePass.uniforms.res.value.set(w*pr,h*pr);if(gtao)gtao.setSize(w,h);}
window.addEventListener('resize',resize);

/* =====================================================================================
   SHARED MATERIALS (with seasonal snow injected)
   ===================================================================================== */
const SNOW={value:0},RING={value:new THREE.Vector4(0,0,0,0)},RINGC={value:new THREE.Color(1,1,1)},RING2={value:new THREE.Vector4(0,0,0,0)};
function addSnow(mat,opts={}){mat.onBeforeCompile=sh=>{sh.uniforms.uSnow=SNOW;sh.uniforms.uRing=RING;sh.uniforms.uRingC=RINGC;sh.uniforms.uRing2=RING2;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 wpp=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        wpp=instanceMatrix*wpp;
      #endif
      vWP=(modelMatrix*wpp).xyz;`);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform float uSnow;uniform vec4 uRing,uRing2;uniform vec3 uRingC;').replace('#include <color_fragment>',`#include <color_fragment>
      vec3 fN=normalize(cross(dFdx(vWP),dFdy(vWP)));float up=abs(fN.y);
      float sn=uSnow*smoothstep(.55,.85,up)*smoothstep(${opts.snowMin||'0.55'},${opts.snowMin||'0.55'}+.6,vWP.y);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.95,1.),sn);
      ${opts.ring?`if(uRing.w>0.){float d=distance(vWP.xz,uRing.xy);float e=abs(d-uRing.z);diffuseColor.rgb=mix(diffuseColor.rgb,uRingC,(1.-smoothstep(.12,.35,e))*.85*uRing.w);diffuseColor.rgb=mix(diffuseColor.rgb,uRingC,step(d,uRing.z)*.12*uRing.w);}
      if(uRing2.w>0.){float d2=distance(vWP.xz,uRing2.xy);float e2=abs(d2-uRing2.z);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.93,.7),(1.-smoothstep(.1,.28,e2))*.7*uRing2.w);}`:''}`);};
  mat.customProgramCacheKey=()=>'snow'+(opts.ring?'r':'')+(opts.snowMin||'');return mat;}
const M={
  build:addSnow(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.82,metalness:0})),
  win:new THREE.MeshStandardMaterial({color:0x2c3442,emissive:0xffb35a,emissiveIntensity:0,roughness:0.25,metalness:0.1}),
  tree:addSnow(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.9}),{snowMin:'0.0'}),
  trunk:new THREE.MeshStandardMaterial({color:0x6e4b33,flatShading:true,roughness:0.95}),
  rock:addSnow(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.95}),{snowMin:'0.0'}),
  ghost:new THREE.MeshStandardMaterial({color:0x9fe0a0,transparent:true,opacity:0.55,roughness:0.6,emissive:0x2a4a2a,depthWrite:false}),
  ghostBad:new THREE.MeshStandardMaterial({color:0xe0806a,transparent:true,opacity:0.55,roughness:0.6,emissive:0x4a1a10,depthWrite:false}),
  person:new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.8}),
  fire:new THREE.MeshBasicMaterial({color:0xffa040,transparent:true,opacity:0.9}),
  smoke:new THREE.MeshStandardMaterial({color:0xd8d8d8,transparent:true,opacity:0.5,roughness:1,flatShading:true,depthWrite:false}),
  beam:new THREE.MeshBasicMaterial({color:0xfff0b0,transparent:true,opacity:0.18,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),
  cloud:new THREE.MeshStandardMaterial({color:0xffffff,flatShading:true,roughness:1,emissive:0x222222})
};

/* =====================================================================================
   MODEL BUILDER — bevelled low-poly parts merged into one vertex-coloured mesh,
   with baked height AO so every model sits in its own soft shade.
   ===================================================================================== */
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_s=new THREE.Vector3();
const C=c=>new THREE.Color(c);
class MB{constructor(){this.parts=[];this.wins=[];this.extra={};}
  _push(list,g,col,x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){g=g.index?g.toNonIndexed():g;g.deleteAttribute('uv');if(g.attributes.uv2)g.deleteAttribute('uv2');
    _m.compose(_v.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz,'YXZ')),_s.set(sx,sy,sz));g.applyMatrix4(_m);
    const n=g.attributes.position.count,ca=new Float32Array(n*3),cc=C(col);for(let i=0;i<n;i++){ca[i*3]=cc.r;ca[i*3+1]=cc.g;ca[i*3+2]=cc.b;}g.setAttribute('color',new THREE.BufferAttribute(ca,3));list.push(g);return this;}
  box(w,h,d,x,y,z,col,ry=0,bev=0,rx=0,rz=0){return this._push(this.parts,bev?new RoundedBoxGeometry(w,h,d,2,Math.min(bev,w/2.1,h/2.1,d/2.1)):new THREE.BoxGeometry(w,h,d),col,x,y,z,rx,ry,rz);}
  cyl(rt,rb,h,seg,x,y,z,col,rx=0,ry=0,rz=0){return this._push(this.parts,new THREE.CylinderGeometry(rt,rb,h,seg),col,x,y,z,rx,ry,rz);}
  cone(r,h,seg,x,y,z,col,ry=0){return this._push(this.parts,new THREE.ConeGeometry(r,h,seg),col,x,y,z,0,ry,0);}
  ico(r,x,y,z,col,sx=1,sy=1,sz=1,det=0){return this._push(this.parts,new THREE.IcosahedronGeometry(r,det),col,x,y,z,0,0,0,sx,sy,sz);}
  sphere(r,x,y,z,col,ws=8,hs=6,sy=1){return this._push(this.parts,new THREE.SphereGeometry(r,ws,hs),col,x,y,z,0,0,0,1,sy,1);}
  // gable roof: ridge along x, slabs with overhang and thickness, triangular gable infill
  roof(w,d,h,x,y,z,col,ry=0,gable='#e8dcc0'){const half=d/2+0.25,slope=Math.hypot(half,h),ang=Math.atan2(h,half),o=new THREE.Group();
    const cs=Math.cos(ry),sn=Math.sin(ry),P=(lx,lz)=>[x+lx*cs+lz*sn,z-lx*sn+lz*cs];
    for(const sgn of[1,-1]){const[px,pz]=P(0,sgn*half/2);this.box(w+0.5,0.16,slope+0.1,px,y+h/2,pz,col,ry,0,sgn*ang,0);
      const[ex,ez]=P(0,sgn*(half+0.02));this.box(w+0.55,0.1,0.12,ex,y-0.02,ez,'#4a3a2c',ry);}
    const[rx,rz]=P(0,0);this.box(w+0.62,0.2,0.24,rx,y+h+0.02,rz,col,ry,0.05);
    const sh=new THREE.Shape();sh.moveTo(-d/2,0);sh.lineTo(d/2,0);sh.lineTo(0,h-0.08);sh.closePath();
    const eg=new THREE.ExtrudeGeometry(sh,{depth:w-0.02,bevelEnabled:false});eg.translate(0,0,-(w-0.02)/2);
    return this._push(this.parts,eg,gable,x,y,z,0,ry+Math.PI/2,0);}
  hip(w,d,h,x,y,z,col,ry=0){const g=new THREE.ConeGeometry(Math.SQRT1_2,1,4);g.rotateY(Math.PI/4);return this._push(this.parts,g,col,x,y+h/2,z,0,ry,0,w+0.5,h,d+0.5);}
  win(w,h,x,y,z,ry=0,frame='#4a3a2c',shutter=null){const cs=Math.cos(ry),sn=Math.sin(ry);
    this.box(w+0.16,h+0.16,0.1,x,y,z,frame,ry);this._push(this.wins,new THREE.BoxGeometry(w,h,0.06),'#ffffff',x+sn*0.04,y,z+cs*0.04,0,ry,0);
    this.box(w+0.24,0.08,0.18,x+sn*0.06,y-h/2-0.08,z+cs*0.06,frame,ry);
    if(shutter){for(const s of[-1,1]){const ox=s*(w/2+0.17);this.box(0.24,h+0.08,0.06,x+ox*cs+sn*0.05,y,z-ox*sn+cs*0.05,shutter,ry);}}return this;}
  door(w,h,x,y,z,ry=0,col='#5a3b26'){const cs=Math.cos(ry),sn=Math.sin(ry);this.box(w+0.2,h+0.12,0.12,x,y+h/2,z,'#3a2a1e',ry);this.box(w,h,0.1,x+sn*0.04,y+h/2,z+cs*0.04,col,ry);this.box(0.08,0.08,0.06,x+sn*0.1+cs*w*0.3,y+h*0.45,z+cs*0.1-sn*w*0.3,'#d4a94e',ry);return this;}
  build(){const shade=list=>{for(const g of list){const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++){const f=0.66+0.34*smooth(-0.3,2.2,p.getY(i));c.setXYZ(i,c.getX(i)*f,c.getY(i)*f,c.getZ(i)*f);}}};
    shade(this.parts);const body=mergeGeometries(this.parts,false);body.computeBoundingSphere();const win=this.wins.length?mergeGeometries(this.wins,false):null;return{body,win,extra:this.extra};}}

/* ---- palette ---- */
const PAL={walls:['#efe6d2','#ead7b6','#f3ece0','#e3cfae','#dcd3c0'],roofs:['#b5543c','#a24b36','#5d6f8a','#6f7f58','#8f5a3a','#4f5f78'],shut:['#3f7f8f','#b84a3a','#4f6f4a','#7a5f8f','#c49a3a'],
  stone:'#a39e95',stoneD:'#7d776e',wood:'#8a5f3d',woodD:'#5f3f28',woodL:'#b08356',timber:'#5a3e2b'};
function fence(mb,pts,col='#9b7a55'){for(let i=0;i<pts.length-1;i++){const[a,b]=[pts[i],pts[i+1]],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ang=Math.atan2(b[1]-a[1],b[0]-a[0]),n=Math.max(1,Math.round(L/1.1));
  for(let k=0;k<=n;k++){const t=k/n;mb.box(0.12,0.75,0.12,lerp(a[0],b[0],t),0.37,lerp(a[1],b[1],t),col);}
  mb.box(L,0.07,0.06,(a[0]+b[0])/2,0.55,(a[1]+b[1])/2,col,-ang);mb.box(L,0.07,0.06,(a[0]+b[0])/2,0.3,(a[1]+b[1])/2,col,-ang);}}
function foundation(mb,w,d,col=PAL.stone){mb.box(w,1.6,d,0,-0.55,0,col,0,0.08);}
function flowerBox(mb,x,y,z,ry=0){mb.box(0.8,0.18,0.22,x,y,z,PAL.woodD,ry);const cs=['#e8574a','#f2c94c','#f4f4f4','#d76fa8'];for(let i=0;i<4;i++)mb.ico(0.09,x+(i-1.5)*0.18*Math.cos(ry),y+0.15,z-(i-1.5)*0.18*Math.sin(ry),cs[i%4]);mb.ico(0.2,x,y+0.12,z,'#4f7f3a',2,0.6,0.6);}
function barrel(mb,x,z,y=0,col=PAL.wood){mb.cyl(0.26,0.26,0.62,8,x,y+0.31,z,col);mb.cyl(0.275,0.275,0.06,8,x,y+0.12,z,'#555');mb.cyl(0.275,0.275,0.06,8,x,y+0.5,z,'#555');}
function crate(mb,x,z,s=0.55,y=0,ry=0){mb.box(s,s,s,x,y+s/2,z,PAL.woodL,ry,0.03);mb.box(s*1.02,0.06,s*1.02,x,y+s*0.5,z,PAL.woodD,ry);}
function logs(mb,x,z,n=3,ry=0){let k=0;for(let r=0;r<n;r++)for(let i=0;i<n-r;i++){const off=(i-(n-r-1)/2)*0.42;mb.cyl(0.2,0.2,1.6,7,x+Math.cos(ry)*0+off*Math.sin(ry+Math.PI/2)*0,0.2+r*0.36,z+off,k++%2?'#8a5f3d':'#9b6c45',Math.PI/2,ry,0);}}
function person(mb,x,z,shirt='#3f6f9f',hat=null){mb.cyl(0.18,0.26,0.62,6,x,0.33,z,shirt);mb.sphere(0.17,x,0.82,z,'#e8b98f',6,5);if(hat)mb.cyl(0.32,0.32,0.04,8,x,0.95,z,hat).cyl(0.14,0.17,0.16,7,x,1.02,z,hat);}

/* ---- building models (each returns MB) ---- */
function vrand(v){return mulberry(v*977+13);}
const MODEL={
  townhall(v){const mb=new MB();foundation(mb,7.2,5.6);mb.box(6.8,2.4,5.2,0,1.2,0,PAL.stone,0,0.08);mb.box(6.6,2.2,5.0,0,3.5,0,'#efe3c8',0,0.06);
    for(const x of[-3.2,-1.1,1.1,3.2])mb.box(0.2,2.2,0.12,x,3.5,2.56,PAL.timber);mb.box(6.7,0.2,0.14,0,4.55,2.56,PAL.timber).box(6.7,0.2,0.14,0,2.45,2.56,PAL.timber);
    mb.roof(6.6,5.0,2.4,0,4.6,0,'#a24b36');for(const x of[-2.2,0,2.2])mb.win(0.7,0.9,x,3.6,2.56,0,PAL.timber,'#3f7f8f');for(const x of[-2.4,2.4])mb.win(0.6,0.9,x,1.3,2.62,0,'#5a5048');
    mb.door(1.2,1.8,0,0.05,2.62,0,'#6a3f22');mb.box(1.8,0.3,1.0,0,0.05,3.1,PAL.stoneD,0,0.05);
    mb.box(1.8,3.2,1.8,-2.3,6.6,0,'#efe3c8',0,0.05);mb.hip(1.8,1.8,1.8,-2.3,8.2,0,'#5d6f8a');mb.box(1.7,0.9,0.1,-2.3,7.4,0.92,'#f4ecd8');mb.cyl(0.38,0.38,0.06,16,-2.3,7.4,0.98,'#2c2c2c',Math.PI/2);
    mb.cyl(0.04,0.04,2.4,5,-2.3,11,0,'#5a4a3a');mb.box(0.9,0.55,0.04,-1.82,11.7,0,'#b8402f');
    mb.box(0.6,0.5,0.6,3.4,0.25,3.4,PAL.stoneD,0,0.1);mb.ico(0.5,3.4,0.7,3.4,'#4f7f3a',1,1,1,1);barrel(mb,-3.6,2.8);barrel(mb,-3.1,3.3);return mb;},
  house(v){const r=vrand(v),mb=new MB(),wall=PAL.walls[Math.floor(r()*5)],roof=PAL.roofs[Math.floor(r()*6)],sh=PAL.shut[Math.floor(r()*5)],tall=r()<0.35;
    foundation(mb,3.5,2.9);const H=tall?3.2:2.2;mb.box(3.1,H,2.5,0,H/2,0,wall,0,0.07);
    if(r()<0.5){for(const x of[-1.5,1.5])mb.box(0.16,H,0.12,x,H/2,1.26,PAL.timber);mb.box(3.1,0.14,0.12,0,H-0.05,1.26,PAL.timber);}
    mb.roof(3.1,2.5,1.5,0,H,0,roof,0,wall);mb.box(0.45,1.4,0.45,0.85,H+0.95,-0.45,PAL.stone,0,0.04).box(0.55,0.12,0.55,0.85,H+1.68,-0.45,PAL.stoneD);
    mb.door(0.7,1.25,-0.55,0.02,1.26);mb.win(0.55,0.55,0.75,1.15,1.26,0,PAL.timber,sh);mb.win(0.55,0.55,1.56,1.2,0,Math.PI/2,PAL.timber);
    if(tall){mb.win(0.5,0.5,-0.55,2.5,1.26,0,PAL.timber,sh);mb.win(0.5,0.5,0.75,2.5,1.26,0,PAL.timber,sh);}
    flowerBox(mb,0.75,0.72,1.42);mb.box(1,0.18,0.6,-0.55,-0.02,1.6,PAL.stoneD,0,0.04);if(r()<0.5)barrel(mb,-1.9,0.8);
    mb.extra.chimney=[0.85,H+1.8,-0.45];return mb;},
  storehouse(){const mb=new MB();foundation(mb,5.4,3.6,PAL.stoneD);mb.box(5.0,2.4,3.2,0,1.2,0,PAL.woodL,0,0.05);for(let x=-2.3;x<=2.3;x+=0.46)mb.box(0.06,2.3,0.04,x,1.2,1.61,PAL.woodD);
    mb.roof(5.0,3.2,1.6,0,2.4,0,'#7a5a3a',0,PAL.woodL);mb.box(1.8,1.9,0.1,0,0.95,1.62,'#6a4a2c');mb.box(1.9,0.12,0.12,0,1.95,1.64,PAL.woodD);mb.box(0.1,1.9,0.12,0,0.95,1.66,PAL.woodD);
    crate(mb,2.0,2.2);crate(mb,2.5,2.1,0.45,0,0.4);crate(mb,2.2,2.2,0.42,0.55,0.2);barrel(mb,-2.2,2.1);barrel(mb,-2.7,1.8);logs(mb,-2.9,-1.0,3);return mb;},
  woodcutter(){const mb=new MB();foundation(mb,3.0,2.6,PAL.stoneD);mb.box(2.7,2.0,2.3,0,1.0,0,'#9b6c45',0,0.05);for(let y=0.2;y<2;y+=0.32)mb.box(2.75,0.06,2.35,0,y,0,'#7f5536');
    mb.roof(2.7,2.3,1.3,0,2.0,0,'#5f4a3a',0,'#9b6c45');mb.door(0.7,1.2,0.4,0.02,1.16);mb.win(0.5,0.45,-0.6,1.2,1.16);logs(mb,0,2.3,3,Math.PI/2);
    mb.cyl(0.32,0.36,0.5,8,-1.9,0.25,1.8,'#8a5f3d');mb.box(0.06,0.7,0.06,-1.9,0.75,1.8,'#5a3e2b',0,0,0.6);mb.box(0.3,0.16,0.04,-1.72,1.0,1.8,'#9aa0a6',0,0,0.6);return mb;},
  forester(){const mb=new MB();foundation(mb,2.8,2.4,PAL.stoneD);mb.box(2.5,1.9,2.1,0,0.95,0,'#cbb98f',0,0.05);mb.roof(2.5,2.1,1.2,0,1.9,0,'#5f7a4a',0,'#cbb98f');mb.door(0.65,1.15,0,0.02,1.06);
    mb.win(0.45,0.45,0.85,1.15,1.06,0,PAL.timber,'#4f6f4a');for(let i=0;i<3;i++)for(let j=0;j<2;j++){mb.box(0.9,0.18,0.5,-2.2+j*1.1,0.09,-0.9+i*0.75,'#6b4a33');mb.cone(0.16,0.45,5,-2.2+j*1.1,0.4,-0.9+i*0.75,'#5f9a4f');}
    mb.cyl(0.14,0.18,0.3,8,1.6,0.15,1.6,'#7a8a8f');return mb;},
  quarry(){const mb=new MB();mb.cyl(2.2,1.6,0.3,9,0,-0.05,0,'#6f6a64');for(let i=0;i<6;i++){const a=i*1.1;mb.box(0.8,0.6,0.7,Math.cos(a)*1.4,0.25,Math.sin(a)*1.4,i%2?'#b1aca3':'#9a958d',a,0.05);}
    for(const[x,z]of[[-1.6,-1.6],[1.6,-1.6]])mb.box(0.18,3.4,0.18,x,1.7,z,PAL.woodD);mb.box(3.6,0.18,0.18,0,3.4,-1.6,PAL.woodD);mb.box(0.06,1.6,0.06,0.4,2.6,-1.6,'#555');mb.box(0.6,0.5,0.6,0.4,1.55,-1.6,'#a8a39b',0,0.05);
    mb.box(1.2,0.5,0.8,2.4,0.55,1.4,PAL.woodL,0.4,0.05);mb.cyl(0.25,0.25,0.12,8,2.0,0.25,1.75,'#4a3a2c',Math.PI/2,0.4);mb.cyl(0.25,0.25,0.12,8,2.8,0.25,1.05,'#4a3a2c',Math.PI/2,0.4);
    mb.box(1.4,1.4,1.2,-2.6,0.7,1.8,'#c9c0b0',0,0.05);mb.roof(1.4,1.2,0.6,-2.6,1.4,1.8,'#7a5a3a');return mb;},
  berry(){const mb=new MB();foundation(mb,2.6,2.2,PAL.stoneD);mb.box(2.3,1.7,1.9,0,0.85,0,'#e6d2a8',0,0.05);mb.roof(2.3,1.9,1.1,0,1.7,0,'#8f4a5a',0,'#e6d2a8');mb.door(0.6,1.1,-0.4,0.02,0.96);mb.win(0.42,0.42,0.5,1.05,0.96,0,PAL.timber,'#b84a3a');
    for(let i=0;i<3;i++){const x=-1.0+i*0.75;mb.cyl(0.26,0.2,0.32,9,x,0.16,1.6,'#c49a5a');for(let k=0;k<5;k++)mb.ico(0.07,x+Math.cos(k*1.3)*0.13,0.36,1.6+Math.sin(k*1.3)*0.13,i===1?'#3a3f8f':'#c0303a');}return mb;},
  fisher(){const mb=new MB();for(const x of[-1.1,1.1])for(const z of[-0.9,0.9])mb.box(0.16,1.6,0.16,x,0.2,z,PAL.woodD);mb.box(2.6,0.14,2.2,0,1.0,0,PAL.woodL);
    mb.box(2.2,1.6,1.8,0,1.85,0,'#7fa3a8',0,0.04);for(let y=1.2;y<2.6;y+=0.3)mb.box(2.25,0.05,1.85,0,y,0,'#6a8f94');mb.roof(2.2,1.8,1.0,0,2.65,0,'#5d6f8a',0,'#7fa3a8');mb.door(0.6,1.05,0,1.07,0.91);
    mb.box(1.2,0.1,4.2,0,0.55,2.9,PAL.woodL);for(let z=1.5;z<5;z+=1)for(const x of[-0.22,0.22])mb.box(0.12,1.6,0.12,x,-0.1,z,PAL.woodD);
    mb.box(0.08,1.4,0.08,-1.6,0.7,1.2,PAL.woodD).box(0.08,1.4,0.08,-1.6,0.7,2.4,PAL.woodD).box(0.05,0.05,1.3,-1.6,1.35,1.8,'#5a4a3a');for(let i=0;i<4;i++)mb.box(0.06,0.28,0.12,-1.6,1.15,1.35+i*0.28,'#9fb0b8');
    mb.box(0.7,0.25,2.0,0.9,-0.05,3.7,'#b8573a',0,0.1);mb.box(0.55,0.08,1.8,0.9,0.1,3.7,PAL.woodL);mb.extra.dockTip=[0,0,4.8];return mb;},
  farm(){const mb=new MB();foundation(mb,3.4,2.8,PAL.stoneD);mb.box(3.0,2.4,2.4,0,1.2,0,'#a8402f',0,0.05);for(let x=-1.4;x<=1.4;x+=0.35)mb.box(0.04,2.3,0.03,x,1.2,1.21,'#8a3326');
    mb.roof(3.0,2.4,1.5,0,2.4,0,'#4f4a48',0,'#a8402f');mb.box(1.3,1.6,0.1,0,0.8,1.22,'#f0e6d0');mb.box(1.1,1.4,0.1,0,0.8,1.25,'#a8402f');mb.box(1.5,0.08,0.06,0,0.8,1.3,'#f0e6d0',0,0,0,0.85).box(1.5,0.08,0.06,0,0.8,1.3,'#f0e6d0',0,0,0,-0.85);
    mb.win(0.5,0.5,0,2.7,1.0,0,'#f0e6d0');mb.cyl(0.55,0.55,3.2,10,2.2,1.6,-0.4,'#d7d2c6');mb.sphere(0.56,2.2,3.2,-0.4,'#8a8f94',10,5,0.6);
    const fx=-4.9,fz=0,S=3.2;fence(mb,[[fx-S,fz-S],[fx+S,fz-S],[fx+S,fz+S],[fx-S,fz+S],[fx-S,fz-S+1.4]]);mb.box(S*2-0.3,0.08,S*2-0.3,fx,0.02,fz,'#6b4a33');
    mb.extra.field=[fx,fz,S-0.4];return mb;},
  windmill(){const mb=new MB();foundation(mb,3.4,3.4,PAL.stoneD);mb.cyl(1.05,1.55,5.2,8,0,2.6,0,'#e8dcc4');for(let y=0.6;y<5;y+=0.9)mb.cyl(1.55-(y/5.2)*0.5+0.02,1.55-(y/5.2)*0.5+0.04,0.1,8,0,y,0,'#cfc2a6');
    mb.cone(1.35,1.6,8,0,6.0,0,'#6f4a33');mb.door(0.7,1.3,0,0.02,1.5);mb.win(0.4,0.5,0,3.2,1.32);mb.box(0.5,0.5,0.6,0,5.4,1.1,PAL.woodD);
    const s=new MB();s.cyl(0.18,0.18,0.3,8,0,0,0,PAL.woodD,Math.PI/2);for(let i=0;i<4;i++){const a=i*Math.PI/2;s.box(0.16,3.6,0.08,Math.sin(a)*1.85,Math.cos(a)*1.85,0,PAL.woodD,0,0,0,-a);
      s.box(0.75,2.8,0.04,Math.sin(a)*2.0+Math.cos(a)*0.42,Math.cos(a)*2.0-Math.sin(a)*0.42,0.03,'#f2ead8',0,0,0,-a);}
    mb.extra.sails={geo:s.build().body,pos:[0,5.4,1.45]};return mb;},
  bakery(){const mb=new MB();foundation(mb,3.6,3.0);mb.box(3.2,2.3,2.6,0,1.15,0,'#e8d7b8',0,0.06);mb.roof(3.2,2.6,1.4,0,2.3,0,'#b5543c',0,'#e8d7b8');mb.door(0.75,1.3,-0.7,0.02,1.31);
    mb.win(0.9,0.6,0.6,1.1,1.31,0,PAL.timber);mb.box(1.4,0.4,0.5,0.6,1.85,1.4,'#7a2f22',0,0.08);mb.sphere(1.0,-2.1,0.1,0,'#c9a88a',10,6,0.75);mb.box(0.5,0.4,0.1,-2.1,0.35,0.97,'#2a1a14');
    mb.box(0.6,2.4,0.6,0.9,3.2,-0.6,PAL.stone,0,0.05);mb.box(0.72,0.14,0.72,0.9,4.4,-0.6,PAL.stoneD);mb.extra.chimney=[0.9,4.6,-0.6];
    mb.box(0.05,0.6,0.05,-1.7,1.9,1.45,'#3a2a1e');mb.box(0.7,0.45,0.05,-1.7,1.5,1.45,'#d4a94e',0,0.04);return mb;},
  sawmill(){const mb=new MB();mb.box(4.4,0.3,3.0,0,0.05,0,PAL.stoneD,0,0.05);for(const x of[-2,0,2])for(const z of[-1.3,1.3])mb.box(0.2,2.4,0.2,x,1.3,z,PAL.woodD);
    mb.roof(4.4,3.0,1.2,0,2.5,0,'#6f5a46',0,PAL.woodL);mb.box(2.6,0.9,0.8,0,0.65,0,PAL.woodL);mb.cyl(0.55,0.55,0.05,14,0,1.15,0,'#b8bec4',Math.PI/2);
    logs(mb,-3.2,1.5,3,Math.PI/2);for(let i=0;i<6;i++)mb.box(2.0,0.1,0.5,3.0,0.1+i*0.11,1.6,i%2?'#c79a6a':'#b98a5a',0.05);mb.box(1.2,1.6,1.2,2.9,0.8,-1.6,'#9b6c45',0,0.04);mb.roof(1.2,1.2,0.6,2.9,1.6,-1.6,'#6f5a46');return mb;},
  workshop(){const mb=new MB();foundation(mb,3.6,3.0);mb.box(3.2,2.2,2.6,0,1.1,0,PAL.stone,0,0.06);mb.roof(3.2,2.6,1.3,0,2.2,0,'#4f4a48',0,PAL.stone);
    mb.door(0.8,1.3,-0.6,0.02,1.31);mb.win(0.6,0.5,0.7,1.2,1.31,0,'#3a2a1e');mb.box(0.8,3.2,0.8,1.2,2.6,-0.6,PAL.stoneD,0,0.05);mb.extra.chimney=[1.2,4.4,-0.6];
    mb.box(1.6,0.9,1.2,-0.2,0.45,2.1,'#3a2a1e');mb.box(1.6,1.4,0.1,-0.2,1.6,1.5,'#6f5a46');mb.box(0.5,0.3,0.25,0.4,1.0,2.2,'#2c2c2c');mb.box(0.25,0.25,0.25,-0.6,1.0,2.1,'#ff7a2a');
    mb.box(0.8,0.5,0.3,-1.8,0.25,1.8,'#3c3c3c');mb.box(0.3,0.4,0.25,-1.8,0.65,1.8,'#555');return mb;},
  well(){const mb=new MB();mb.cyl(1.0,1.1,0.9,10,0,0.45,0,PAL.stone);mb.cyl(0.8,0.8,0.1,10,0,0.92,0,'#2b4a5a');for(const x of[-0.85,0.85])mb.box(0.14,1.8,0.14,x,1.6,0,PAL.woodD);
    mb.roof(2.0,1.6,0.8,0,2.45,0,'#8f4a3a',0,PAL.woodL);mb.cyl(0.08,0.08,1.7,6,0,2.1,0,PAL.woodD,0,0,Math.PI/2);mb.cyl(0.18,0.15,0.28,8,0.2,1.4,0,PAL.wood);return mb;},
  chapel(){const mb=new MB();foundation(mb,4.2,6.6);mb.box(3.8,3.0,6.2,0,1.5,0,'#f2ece0',0,0.07);mb.roof(6.2,3.8,2.2,0,3.0,0,'#5d6f8a',Math.PI/2,'#f2ece0');
    for(const z of[-1.8,0,1.8])for(const s of[-1,1])mb.win(0.45,1.2,s*1.92,1.8,z,s*Math.PI/2,'#6a6a6a');mb.door(1.0,1.8,0,0.02,3.11,0,'#5a2f22');
    mb.box(1.9,4.2,1.9,0,4.2,2.6,'#f2ece0',0,0.06);mb.cone(1.35,3.2,4,0,7.9,2.6,'#5d6f8a',Math.PI/4);mb.box(0.1,1.0,0.1,0,10.0,2.6,'#d4a94e');mb.box(0.6,0.1,0.1,0,10.2,2.6,'#d4a94e');
    mb.win(0.7,0.7,0,5.0,3.56,0,'#6a6a6a');mb.cyl(0.35,0.35,0.05,12,0,2.7,3.13,'#d4a94e',Math.PI/2);return mb;},
  tavern(){const mb=new MB();foundation(mb,4.2,3.4);mb.box(3.8,2.2,3.0,0,1.1,0,PAL.stone,0,0.06);mb.box(4.0,2.0,3.2,0,3.2,0,'#efe0c0',0,0.06);for(const x of[-1.9,-0.6,0.6,1.9])mb.box(0.16,2.0,0.1,x,3.2,1.61,PAL.timber);
    mb.box(4.05,0.16,0.1,0,2.25,1.62,PAL.timber);mb.roof(4.0,3.2,1.7,0,4.2,0,'#a24b36',0,'#efe0c0');mb.door(0.9,1.4,0.9,0.02,1.51);mb.win(1.0,0.7,-0.8,1.2,1.51,0,PAL.timber);
    for(const x of[-1.25,0,1.25])mb.win(0.55,0.6,x,3.3,1.62,0,PAL.timber,'#b84a3a');mb.box(0.05,0.05,0.9,2.05,2.4,1.9,'#3a2a1e');mb.box(0.05,0.6,0.7,2.05,2.0,2.1,'#2f5f3f',0,0.03);
    barrel(mb,-2.3,1.7);barrel(mb,-2.3,1.0);mb.box(1.6,0.08,0.5,1.0,0.6,2.6,PAL.woodL);mb.box(1.6,0.08,0.3,1.0,0.35,3.1,PAL.woodL);mb.extra.chimney=[-1.2,5.6,-0.6];mb.box(0.5,1.6,0.5,-1.2,4.9,-0.6,PAL.stone,0,0.04);return mb;},
  market(){const mb=new MB();mb.box(6.0,0.15,4.4,0,0.02,0,'#b7ab96',0,0.05);const aw=[['#c0392b','#f4ecd8'],['#2f6f8f','#f4ecd8'],['#c49a3a','#f4ecd8']];
    for(let i=0;i<3;i++){const x=-2+i*2,z=i===1?-0.6:0.6;mb.box(1.6,0.8,1.0,x,0.45,z,PAL.woodL,0,0.03);for(const sx of[-0.75,0.75])mb.box(0.08,1.9,0.08,x+sx,1.0,z-0.45,PAL.woodD);
      for(let k=0;k<5;k++)mb.box(0.36,0.06,1.3,x-0.72+k*0.36,1.95,z+0.05,aw[i][k%2],0,0,0.25);
      const fc=[['#d14a3a','#e57a2a','#f2c94c'],['#7fbf4a','#a8d86a','#5f9a3a'],['#d9a85a','#c49a6a','#e8c88a']][i];for(let k=0;k<6;k++)mb.ico(0.12,x-0.5+(k%3)*0.5,0.95,z-0.2+Math.floor(k/3)*0.35,fc[k%3],1,1,1,0);}
    crate(mb,2.6,1.9);crate(mb,-2.7,-1.8,0.5);barrel(mb,-2.7,1.8);return mb;},
  dock(){const mb=new MB();foundation(mb,3.2,2.8,PAL.stoneD);mb.box(2.8,2.1,2.4,0,1.05,0,'#d8c8a6',0,0.05);mb.roof(2.8,2.4,1.2,0,2.1,0,'#5d6f8a',0,'#d8c8a6');mb.door(0.7,1.2,0.5,0.02,1.21);mb.win(0.5,0.5,-0.6,1.2,1.21,0,PAL.timber,'#3f7f8f');
    for(let z=1.6;z<=9.2;z+=0.5)mb.box(2.2,0.1,0.44,0,0.62,z,(z*2)%2?PAL.woodL:'#a5784c');for(let z=1.8;z<=9.2;z+=1.9)for(const x of[-1.0,1.0])mb.cyl(0.12,0.14,2.4,6,x,-0.4,z,PAL.woodD);
    for(const z of[5,9])for(const x of[-1.0,1.0])mb.cyl(0.13,0.13,0.4,6,x,0.85,z,PAL.woodD);crate(mb,0.6,3.0,0.5,0.66);crate(mb,0.6,3.6,0.45,0.66,0.3);barrel(mb,-0.6,3.4,0.66);
    mb.box(0.16,3.0,0.16,-1.4,1.5,-1.5,PAL.woodD);mb.box(0.12,0.12,2.2,-1.4,2.9,-0.5,PAL.woodD);mb.extra.dockTip=[0,0,10.5];return mb;},
  tower(){const mb=new MB();for(const x of[-1,1])for(const z of[-1,1])mb.box(0.24,5.4,0.24,x*0.95,2.7,z*0.95,PAL.woodD,0,0,z*0.05,-x*0.05);
    for(const y of[1.6,3.2])for(let i=0;i<4;i++){const a=i*Math.PI/2;mb.box(2.0,0.1,0.08,Math.sin(a)*0.95,y,Math.cos(a)*0.95,PAL.wood,a,0,0,0.6);}
    mb.box(2.6,0.2,2.6,0,5.4,0,PAL.woodL,0,0.04);for(let i=0;i<4;i++){const a=i*Math.PI/2;mb.box(2.6,0.6,0.1,Math.sin(a)*1.25,5.8,Math.cos(a)*1.25,PAL.wood,a);}
    for(const x of[-1.15,1.15])for(const z of[-1.15,1.15])mb.box(0.12,1.6,0.12,x,6.3,z,PAL.woodD);mb.hip(2.4,2.4,1.3,0,7.1,0,'#7a3a2c');mb.box(0.05,1.0,0.6,0.3,7.8,0,'#b8402f');
    mb.box(0.5,5.4,0.06,0,2.7,1.05,'#7a5a3a',0,0,0.08);mb.box(1.6,0.6,1.6,0,0.3,0,PAL.stoneD,0,0.1);mb.extra.guard=[0,5.5,0];return mb;},
  barracks(){const mb=new MB();foundation(mb,6.0,3.2);mb.box(5.6,2.2,2.8,0,1.1,0,'#c9b48a',0,0.05);for(let x=-2.6;x<=2.6;x+=1.3)mb.box(0.16,2.2,0.1,x,1.1,1.41,PAL.timber);
    mb.roof(5.6,2.8,1.4,0,2.2,0,'#5a4a3a',0,'#c9b48a');mb.door(0.9,1.4,0,0.02,1.41);for(const x of[-1.9,1.9])mb.win(0.6,0.5,x,1.25,1.41,0,PAL.timber,'#7a3a2c');
    for(const x of[-2,0,2]){mb.box(0.1,1.4,0.1,x,0.7,3.2,PAL.woodD);mb.box(0.8,0.1,0.1,x,1.2,3.2,PAL.woodD);mb.cyl(0.25,0.28,0.7,7,x,1.1,3.2,'#c8b07a');mb.sphere(0.2,x,1.65,3.2,'#c8b07a',6,5);}
    mb.box(0.1,3.0,0.1,3.1,1.5,1.6,PAL.woodD);mb.box(0.8,0.55,0.04,2.7,2.7,1.6,'#2f5a8a');for(let i=0;i<4;i++)mb.box(0.04,1.4,0.04,-3.1,0.7,1.0+i*0.2,'#5a4a3a',0,0,0,0.2);return mb;},
  lighthouse(){const mb=new MB();mb.cyl(2.6,2.9,1.0,10,0,0.2,0,PAL.stoneD);mb.box(2.2,1.5,2.0,2.4,0.75,0,'#efe6d2',0,0.05);mb.roof(2.2,2.0,0.9,2.4,1.5,0,'#a24b36',0,'#efe6d2');
    for(let i=0;i<6;i++){const r0=1.75-i*0.16,r1=1.75-(i+1)*0.16;mb.cyl(r1,r0,1.6,10,0,1.5+i*1.6,0,i%2?'#c0392b':'#f4ecd8');}
    mb.cyl(1.35,1.3,0.25,12,0,11.2,0,'#3a3a3a');for(let i=0;i<10;i++){const a=i/10*TAU;mb.box(0.06,0.6,0.06,Math.cos(a)*1.25,11.6,Math.sin(a)*1.25,'#2c2c2c');}
    mb._push(mb.wins,new THREE.CylinderGeometry(0.75,0.75,1.1,8),'#ffffff',0,11.9,0);mb.cone(0.95,0.9,8,0,12.9,0,'#2c2c2c');mb.door(0.7,1.2,0,0.7,1.6);mb.extra.lamp=[0,11.9,0];return mb;},
  garden(){const mb=new MB();mb.box(4.0,0.08,4.0,0,0.02,0,'#7aa85a');for(let i=0;i<16;i++){const a=i/16*TAU;mb.ico(0.42,Math.cos(a)*1.85,0.32,Math.sin(a)*1.85,'#3f7a35',1,0.8,1,1);}
    mb.cyl(0.6,0.7,0.35,10,0,0.2,0,PAL.stone);mb.cyl(0.5,0.5,0.06,10,0,0.36,0,'#3f8f9f');mb.cyl(0.1,0.12,0.7,6,0,0.6,0,PAL.stone);mb.sphere(0.18,0,1.0,0,PAL.stone,6,4);
    const fc=['#e8574a','#f2c94c','#f4f4f4','#d76fa8','#8a6fd8'];for(let i=0;i<14;i++){const a=i*2.4,r=0.9+(i%3)*0.25;mb.ico(0.1,Math.cos(a)*r,0.15,Math.sin(a)*r,fc[i%5]);}
    mb.box(1.2,0.08,0.4,1.0,0.42,-1.0,PAL.woodL,0.6);for(const s of[-0.45,0.45])mb.box(0.08,0.4,0.36,1.0+Math.cos(0.6)*s,0.2,-1.0-Math.sin(0.6)*s,PAL.woodD,0.6);return mb;},
  scaffold(){const mb=new MB();for(const x of[-1,1])for(const z of[-1,1])mb.box(0.1,2.6,0.1,x,1.3,z,'#b08356');for(const y of[0.9,1.9])for(let i=0;i<4;i++){const a=i*Math.PI/2;mb.box(2.1,0.08,0.3,Math.sin(a)*1,y,Math.cos(a)*1,'#c79a6a',a);}
    mb.box(0.1,2.9,0.1,0,1.2,1.0,'#a5784c',0,0,0.7);return mb;}
};

/* =====================================================================================
   GAME DATA
   ===================================================================================== */
const RES=['wood','stone','planks','tools','fish','berries','wheat','flour','bread','gold'];
const RNAME={wood:'Logs',stone:'Stone',planks:'Planks',tools:'Tools',fish:'Fish',berries:'Berries',wheat:'Wheat',flour:'Flour',bread:'Bread',gold:'Gold'};
const FOOD=['fish','berries','bread'];
const ICON={
  wood:'<circle cx="12" cy="12" r="8.5" fill="#a9784f" stroke="#5a3b26" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="#6b4a33"/><circle cx="12" cy="12" r="2" fill="#6b4a33"/>',
  stone:'<path d="M4 17 7 8l6-3 6 4 1 8-7 3Z" fill="#a39e95" stroke="#4a4640" stroke-width="1.4" stroke-linejoin="round"/><path d="M7 8l5 4 7-3M12 12l1 8" stroke="#6f6a63" fill="none"/>',
  planks:'<g stroke="#5a3b26" stroke-width="1.2"><rect x="3" y="5" width="18" height="4" fill="#c79a6a"/><rect x="3" y="10" width="18" height="4" fill="#b98a5a"/><rect x="3" y="15" width="18" height="4" fill="#c79a6a"/></g>',
  tools:'<path d="M6 19 15 10" stroke="#8a5f3d" stroke-width="2.6" stroke-linecap="round"/><path d="M12 5l6-1 3 3-2 2-3-1-2 2-3-3Z" fill="#b9bfc5" stroke="#4a4f55" stroke-width="1.2" stroke-linejoin="round"/>',
  fish:'<path d="M3 12c4-5 10-6 14-1l4-3v8l-4-3c-4 5-10 4-14-1Z" fill="#8fb8c4" stroke="#3a5a64" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="11" r="1" fill="#1e2e33"/>',
  berries:'<circle cx="9" cy="14" r="4" fill="#c0303a" stroke="#5e1218" stroke-width="1.2"/><circle cx="15.5" cy="14.5" r="3.6" fill="#b02a34" stroke="#5e1218" stroke-width="1.2"/><circle cx="12.5" cy="9" r="3.4" fill="#d0404a" stroke="#5e1218" stroke-width="1.2"/><path d="M12 6c1-2 3-3 5-3" stroke="#4f7f3a" stroke-width="1.6" fill="none"/>',
  wheat:'<path d="M12 21V6" stroke="#8a6a2a" stroke-width="1.4"/><g fill="#e2b84a" stroke="#8a6a2a" stroke-width="1"><ellipse cx="9.5" cy="8" rx="1.6" ry="2.8" transform="rotate(-25 9.5 8)"/><ellipse cx="14.5" cy="8" rx="1.6" ry="2.8" transform="rotate(25 14.5 8)"/><ellipse cx="9.5" cy="12.5" rx="1.6" ry="2.8" transform="rotate(-25 9.5 12.5)"/><ellipse cx="14.5" cy="12.5" rx="1.6" ry="2.8" transform="rotate(25 14.5 12.5)"/><ellipse cx="12" cy="4.5" rx="1.5" ry="2.6"/></g>',
  flour:'<path d="M6 8c0-2 12-2 12 0l1 11c0 2-14 2-14 0Z" fill="#efe6d2" stroke="#7a6a52" stroke-width="1.3"/><path d="M8 7c1-3 7-3 8 0" stroke="#7a6a52" fill="none" stroke-width="1.3"/><path d="M9 14h6" stroke="#b9a888"/>',
  bread:'<path d="M3 15c0-5 4-8 9-8s9 3 9 8c0 2-2 3-4 3H7c-2 0-4-1-4-3Z" fill="#d49a52" stroke="#6b4a26" stroke-width="1.3"/><path d="M8 10l1.5 3M12 9.5v3.5M16 10l-1.5 3" stroke="#8a5a2a" stroke-width="1.2" stroke-linecap="round"/>',
  gold:'<circle cx="12" cy="12" r="8" fill="#e2b84a" stroke="#7a5a16" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="#a8862a"/><path d="M12 9v6" stroke="#7a5a16" stroke-width="1.5"/>',
  people:'<circle cx="9" cy="8" r="3" fill="#e8b98f" stroke="#5a3b26"/><path d="M4 20c0-5 2-7 5-7s5 2 5 7Z" fill="#3f6f9f" stroke="#1e3550"/><circle cx="16" cy="9" r="2.5" fill="#e8b98f" stroke="#5a3b26"/><path d="M12 20c0-4 2-6 4-6s4 2 4 6Z" fill="#9f4f3f" stroke="#4a221a"/>'
};
const ico=k=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
// Building catalogue. fr = footprint radius, w = max workers, pop = villagers needed to unlock, work = labour-seconds to build
const B={
  townhall:{name:'Town Hall',cat:null,fr:4.2,cost:{},w:0,beds:8,hub:true,work:1,desc:'Seat of the settlement. Stores goods and shelters your first settlers.'},
  house:{name:'Cottage',cat:'homes',fr:2.0,cost:{wood:12,stone:4},w:0,beds:4,work:14,pop:0,desc:'A home for four. Spare beds let the village grow.',chain:'Burns logs for warmth in winter'},
  storehouse:{name:'Storehouse',cat:'homes',fr:2.9,cost:{wood:18,stone:8},w:0,hub:true,work:16,pop:0,desc:'Workers drop goods at the nearest store. Build one near distant work sites to save long walks.'},
  well:{name:'Well',cat:'homes',fr:1.3,cost:{stone:10,wood:2},w:0,range:16,work:8,pop:0,desc:'Fresh water. Houses nearby are healthier and fires are put out quickly.'},
  garden:{name:'Garden',cat:'homes',fr:2.2,cost:{wood:4,stone:6},w:0,range:14,work:8,pop:20,desc:'A quiet corner with a fountain. Cheers the houses around it.'},
  woodcutter:{name:'Woodcutter',cat:'food',fr:2.0,cost:{wood:8,stone:2},w:2,range:22,work:10,pop:0,job:{kind:'gather',node:'tree',work:6,out:{wood:3}},desc:'Fells mature trees within reach.',chain:'Trees → Logs'},
  forester:{name:'Forester',cat:'food',fr:1.8,cost:{wood:8},w:1,range:15,work:8,pop:0,job:{kind:'plant',work:3},desc:'Plants saplings that grow into a forest over a few seasons.',chain:'Saplings → Trees'},
  berry:{name:'Gatherer',cat:'food',fr:1.8,cost:{wood:8},w:2,range:16,work:8,pop:0,job:{kind:'gather',node:'bush',work:4,out:{berries:3}},desc:'Picks wild berry bushes nearby. Bushes regrow in a few days and rest in winter.',chain:'Bushes → Berries'},
  fisher:{name:'Fishery',cat:'food',fr:1.9,cost:{wood:10},w:2,work:10,pop:0,coast:true,job:{kind:'site',work:8,out:{fish:4}},desc:'Fishes off its own jetty. Must stand on the shore.',chain:'Sea → Fish'},
  farm:{name:'Farm',cat:'food',fr:6.0,cost:{wood:14,stone:6},w:3,work:18,pop:15,flat:true,job:{kind:'farm'},desc:'Sows in spring, grows in summer, harvests in autumn. Needs flat, fertile ground.',chain:'Field → Wheat (autumn)'},
  quarry:{name:'Quarry',cat:'industry',fr:2.6,cost:{wood:12},w:3,work:12,pop:0,rock:true,job:{kind:'site',work:7,out:{stone:3}},desc:'Cuts stone. Must be built near exposed rock.',chain:'Rock → Stone'},
  sawmill:{name:'Sawmill',cat:'industry',fr:2.6,cost:{wood:16,stone:8},w:2,work:16,pop:15,job:{kind:'process',in:{wood:2},out:{planks:2},work:6},desc:'Saws logs into planks for finer buildings.',chain:'2 Logs → 2 Planks'},
  windmill:{name:'Windmill',cat:'industry',fr:2.0,cost:{wood:20,stone:10,planks:6},w:1,work:20,pop:15,job:{kind:'process',in:{wheat:2},out:{flour:2},work:6},desc:'Grinds wheat into flour. Sails turn with the wind.',chain:'2 Wheat → 2 Flour'},
  bakery:{name:'Bakery',cat:'industry',fr:2.2,cost:{wood:12,stone:12,planks:6},w:2,work:16,pop:25,job:{kind:'process',in:{flour:2,wood:1},out:{bread:4},work:7},desc:'Bakes bread, the most filling food on the island.',chain:'2 Flour + 1 Log → 4 Bread'},
  workshop:{name:'Workshop',cat:'industry',fr:2.2,cost:{wood:12,stone:12,planks:8},w:2,work:18,pop:15,job:{kind:'process',in:{planks:1,stone:1},out:{tools:1},work:8},desc:'Forges tools. Without tools, every worker is slower.',chain:'1 Plank + 1 Stone → 1 Tool'},
  market:{name:'Market',cat:'civic',fr:3.0,cost:{wood:18,stone:10,planks:8},w:2,range:24,work:18,pop:25,job:{kind:'stay'},desc:'Brings every kind of food to the houses in reach, so their variety counts in full.'},
  chapel:{name:'Chapel',cat:'civic',fr:3.0,cost:{wood:20,stone:30,planks:10,gold:20},w:0,range:32,work:30,pop:40,desc:'Faith and fellowship. Gives a large lift to happiness nearby.'},
  tavern:{name:'Tavern',cat:'civic',fr:2.6,cost:{wood:20,stone:10,planks:12},w:1,range:24,work:22,pop:40,job:{kind:'stay',eat:{bread:2}},desc:'Songs, stew and a warm hearth. Serves bread each day to lift spirits.'},
  dock:{name:'Trading Dock',cat:'harbour',fr:2.4,cost:{wood:20,planks:12},w:1,work:20,pop:15,coast:true,pier:true,job:{kind:'stay'},desc:'A merchant ship calls at the start of each season to buy and sell.'},
  lighthouse:{name:'Lighthouse',cat:'harbour',fr:2.8,cost:{stone:40,planks:20,gold:60},w:1,work:40,pop:60,coast:true,job:{kind:'stay'},desc:'Guides settler ships to the island and spots raiders twice as early. A beacon of pride.'},
  tower:{name:'Watchtower',cat:'defense',fr:1.6,cost:{wood:14,stone:16,gold:10},w:1,range:22,work:16,pop:25,job:{kind:'guard'},desc:'A guard with a longbow shoots raiders who come within range.'},
  barracks:{name:'Barracks',cat:'defense',fr:3.1,cost:{wood:20,stone:20,planks:10,tools:6,gold:20},w:6,work:24,pop:40,job:{kind:'militia'},desc:'Trains up to six settlers as militia. They drill here, and fight when the horn sounds.'}
};
const CATS=[['homes','Homes'],['food','Provisions'],['industry','Industry'],['civic','Civic'],['harbour','Harbour'],['defense','Defence']];
const TITLES=[[0,'Camp'],[15,'Hamlet'],[25,'Village'],[40,'Town'],[60,'Harbour Town'],[90,'Free City']];
const SEASONS=['Spring','Summer','Autumn','Winter'];
const DAY=48,SEASON_DAYS=4;
const RESERVE={wood:20,stone:10,planks:4};
const PRICE={wood:1,stone:1.5,planks:3,tools:6,fish:1.5,berries:1,wheat:1.5,flour:2.5,bread:4};
const GOALS=[
  {t:'Raise a woodcutter',f:()=>count('woodcutter'),n:1},
  {t:'Build a fishery or a gatherer for food',f:()=>count('fisher')+count('berry'),n:1},
  {t:'Build two cottages',f:()=>count('house'),n:2},
  {t:'Open a quarry beside the rocks',f:()=>count('quarry'),n:1},
  {t:'Grow to fifteen settlers',f:()=>S.vill.length,n:15},
  {t:'Plant a farm and raise a windmill',f:()=>Math.min(1,count('farm'))+Math.min(1,count('windmill')),n:2},
  {t:'Build a sawmill and a trading dock',f:()=>Math.min(1,count('sawmill'))+Math.min(1,count('dock')),n:2},
  {t:'Bake bread for the village',f:()=>S.stats.bread||0,n:20},
  {t:'Guard the shore with a watchtower',f:()=>count('tower'),n:1},
  {t:'Grow to forty settlers',f:()=>S.vill.length,n:40},
  {t:'Build a chapel',f:()=>count('chapel'),n:1},
  {t:'Light the lighthouse',f:()=>count('lighthouse'),n:1},
  {t:'Become a Free City of ninety souls',f:()=>S.vill.length,n:90}
];

/* =====================================================================================
   WORLD — heightmap island, terrain, water, nature
   ===================================================================================== */
const N=241,HALF=120,WL=0;
let W=null;// world data
const world=new THREE.Group();scene.add(world);
function genWorld(seed){
  rng=mulberry(seed);const nz=makeNoise(seed),H=new Float32Array(N*N),fert=new Float32Array(N*N),forest=new Float32Array(N*N),rock=new Uint8Array(N*N);
  const R0=88+rr(-5,5),warp=rr(0,100);
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){const wx=x-HALF,wz=z-HALF,i=z*N+x;
    const ang=Math.atan2(wz,wx),rad=R0*(1+0.18*nz.n2(Math.cos(ang)*1.3+warp,Math.sin(ang)*1.3)+0.08*nz.n2(Math.cos(ang)*3.1,Math.sin(ang)*3.1+warp));
    const d=Math.hypot(wx,wz)/rad+nz.fbm(wx*0.035+7,wz*0.035,3)*0.12;
    const mask=1-smooth(0.62,1.0,d);
    const hills=Math.max(0,nz.fbm(wx*0.016+31,wz*0.016+17,4)+0.05),ridge=1-Math.abs(nz.n2(wx*0.03+3,wz*0.03-8));
    let h=mask*(1.4+hills*hills*11+ridge*ridge*1.6*smooth(0.25,0.6,hills))-(1-mask)*7;
    if(h>0){h=lerp(h,Math.round(h/1.4)*1.4,0.25);if(h<1.2)h*=0.75;}
    H[i]=h;fert[i]=clamp(0.5+nz.fbm(wx*0.045-50,wz*0.045+9,3)*0.9,0,1);forest[i]=nz.fbm(wx*0.035+90,wz*0.035-40,3)-0.08;}
  for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++){const i=z*N+x,s=Math.max(Math.abs(H[i+1]-H[i-1]),Math.abs(H[i+N]-H[i-N]))/2;if(H[i]>1.2&&(s>1.1||H[i]>9.5||(H[i]>4&&nz.n2(x*0.13,z*0.13)>0.55)))rock[i]=1;}
  W={seed,H,fert,forest,rock,trees:[],bushes:[],fishSpots:[],shore:[]};
  for(let z=2;z<N-2;z+=2)for(let x=2;x<N-2;x+=2){const h=H[z*N+x];if(h>0.15&&h<1.3){let wet=false;for(const[dx,dz]of[[3,0],[-3,0],[0,3],[0,-3]])if(H[(z+dz)*N+x+dx]<-0.3)wet=true;if(wet)W.shore.push([x-HALF,z-HALF]);}}
  return W;}
function hAt(x,z){const fx=clamp(x+HALF,0,N-1.001),fz=clamp(z+HALF,0,N-1.001),x0=Math.floor(fx),z0=Math.floor(fz),tx=fx-x0,tz=fz-z0,H=W.H,i=z0*N+x0;
  return lerp(lerp(H[i],H[i+1],tx),lerp(H[i+N],H[i+N+1],tx),tz);}
const cellIdx=(x,z)=>{const cx=Math.round(x+HALF),cz=Math.round(z+HALF);return(cx<0||cz<0||cx>=N||cz>=N)?-1:cz*N+cx;};
let terrain,water,depthTex;
function buildTerrain(){
  if(terrain){world.remove(terrain);terrain.geometry.dispose();}
  const pos=[],col=[],H=W.H,c=new THREE.Color(),sand=C('#e4d3a0'),sandW=C('#b8a77c'),g1=C('#86b867'),g2=C('#5f9a4f'),g3=C('#4f8443'),dirt=C('#8f7a55'),rk=C('#8f8a83'),rk2=C('#a39e95'),deep=C('#506a6a');
  const tri=(ax,az,bx,bz,cx,cz)=>{const ha=H[az*N+ax],hb=H[bz*N+bx],hc=H[cz*N+cx],hm=(ha+hb+hc)/3,mx=(ax+bx+cx)/3,mz=(az+bz+cz)/3,mi=Math.round(mz)*N+Math.round(mx);
    const sl=Math.max(Math.abs(ha-hb),Math.abs(hb-hc),Math.abs(ha-hc)),j=hash(ax*3+bx,az*5+cz)*0.08-0.04;
    if(hm<-2)c.copy(deep).lerp(sandW,clamp((hm+7)/5,0,1));else if(hm<0.25)c.copy(sandW).lerp(sand,smooth(-2,0.2,hm));else if(hm<1.0)c.copy(sand).lerp(g1,smooth(0.6,1.05,hm));
    else{const f=W.fert[mi];c.copy(g1).lerp(g2,clamp(f*0.9+(hm-1)/14,0,1));if(W.forest[mi]>0.15)c.lerp(g3,0.45);if(f>0.72)c.lerp(dirt,0.12);}
    if(W.rock[mi]||sl>1.6)c.copy(rk).lerp(rk2,hash(ax,az));c.offsetHSL(0,0,j);
    for(const[px,pz,ph]of[[ax,az,ha],[bx,bz,hb],[cx,cz,hc]]){pos.push(px-HALF,ph,pz-HALF);col.push(c.r,c.g,c.b);}};
  for(let z=0;z<N-1;z++)for(let x=0;x<N-1;x++){if((x+z)%2){tri(x,z,x,z+1,x+1,z);tri(x+1,z,x,z+1,x+1,z+1);}else{tri(x,z,x,z+1,x+1,z+1);tri(x,z,x+1,z+1,x+1,z);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  terrain=new THREE.Mesh(g,addSnow(new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.96}),{ring:true,snowMin:'0.35'}));terrain.receiveShadow=true;terrain.castShadow=true;world.add(terrain);
  // depth texture for the water shader
  const d=new Uint8Array(N*N);for(let i=0;i<N*N;i++)d[i]=clamp(Math.round((W.H[i]+10)/20*255),0,255);
  if(depthTex)depthTex.dispose();depthTex=new THREE.DataTexture(d,N,N,THREE.RedFormat,THREE.UnsignedByteType);depthTex.magFilter=depthTex.minFilter=THREE.LinearFilter;depthTex.needsUpdate=true;
  if(water)water.material.uniforms.tDepth.value=depthTex;}
const WU={t:{value:0},tDepth:{value:null},sunDir:{value:new THREE.Vector3()},sunCol:{value:new THREE.Color()},sky:{value:new THREE.Color()},fogC:{value:new THREE.Color()},night:{value:0},camPos:{value:new THREE.Vector3()}};
function buildWater(){const g=new THREE.PlaneGeometry(1400,1400,220,220);g.rotateX(-Math.PI/2);WU.tDepth.value=depthTex;
  water=new THREE.Mesh(g,new THREE.ShaderMaterial({uniforms:WU,transparent:true,
    vertexShader:`uniform float t;varying vec3 vW;varying float vWave;
    void main(){vec3 p=position;float w=sin(p.x*.18+t*1.1)*.09+sin(p.z*.23-t*.9)*.08+sin((p.x+p.z)*.41+t*1.7)*.035;p.y+=w;vWave=w;vec4 wp=modelMatrix*vec4(p,1.);vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader:`uniform float t,night;uniform sampler2D tDepth;uniform vec3 sunDir,sunCol,sky,fogC,camPos;varying vec3 vW;varying float vWave;
    float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
    void main(){vec2 uv=(vW.xz+120.)/240.;float h=-7.;if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)h=mix(texture2D(tDepth,uv).r*20.-10.,-7.,smoothstep(.43,.5,max(abs(uv.x-.5),abs(uv.y-.5))));
     float depth=max(0.,-h+vWave);
     vec3 shallow=vec3(.33,.80,.76),mid=vec3(.10,.50,.60),deep=vec3(.04,.22,.36);
     vec3 col=mix(shallow,mid,smoothstep(.2,2.6,depth));col=mix(col,deep,smoothstep(2.6,9.,depth));
     vec3 n=normalize(vec3(-cos(vW.x*.18+t*1.1)*.016-cos((vW.x+vW.z)*.41+t*1.7)*.014+(vn(vW.xz*.9+t*.3)-.5)*.06,1.,cos(vW.z*.23-t*.9)*.018+(vn(vW.zx*.8-t*.25)-.5)*.06));
     vec3 V=normalize(camPos-vW);float fr=pow(1.-max(dot(n,V),0.),3.);col=mix(col,sky,fr*.55);
     float sp=pow(max(dot(reflect(-sunDir,n),V),0.),180.);col+=sunCol*sp*1.6*(1.-night*.6);
     float foamLine=1.-smoothstep(0.,.55,depth);float bands=smoothstep(.55,.95,sin(depth*9.-t*2.2+vn(vW.xz*.6)*4.))*(1.-smoothstep(0.,1.3,depth));
     float foam=clamp(foamLine*(.55+.45*vn(vW.xz*2.+t))+bands*.55,0.,1.)*step(-9.,h);col=mix(col,vec3(.97,.98,.96),foam*.85);
     col*=mix(1.,.38,night);float a=mix(.62,.96,smoothstep(.1,3.,depth));a=max(a,foam);
     float fd=length(camPos-vW);col=mix(col,fogC,smoothstep(160.,540.,fd));gl_FragColor=vec4(col,a);}`}));
  water.renderOrder=1;water.receiveShadow=false;scene.add(water);}

/* --- nature: instanced trees, bushes, rocks, grass --- */
const NAT={};
function makeTreeGeos(){const leaf=new MB();leaf.ico(1.25,0,2.6,0,'#ffffff',1,0.9,1,1);leaf.ico(0.95,0.5,3.4,0.2,'#f2f2f2',1,1,1,1);leaf.ico(0.8,-0.5,2.2,-0.4,'#e8e8e8',1,0.9,1,0);
  const pine=new MB();for(let i=0;i<3;i++)pine.cone(1.35-i*0.33,1.6,7,0,1.9+i*1.0,0,i%2?'#f0f0f0':'#ffffff');
  const trunk=new THREE.CylinderGeometry(0.16,0.24,2.2,6);trunk.translate(0,1.1,0);
  const bush=new MB();bush.ico(0.6,0,0.45,0,'#ffffff',1.2,0.8,1.1,1);bush.ico(0.45,0.45,0.35,0.2,'#eeeeee',1,0.8,1,1);
  const berry=new THREE.IcosahedronGeometry(0.09,0);
  const rock=new MB();rock.ico(0.7,0,0.25,0,'#ffffff',1.3,0.7,1,0);
  const tuft=new THREE.ConeGeometry(0.12,0.45,4);tuft.translate(0,0.2,0);
  return{leaf:leaf.build().body,pine:pine.build().body,trunk,bush:bush.build().body,berry,rock:rock.build().body,tuft};}
let TG=null;
function buildNature(){
  for(const k in NAT){world.remove(NAT[k]);NAT[k].dispose&&NAT[k].dispose();}
  TG=TG||makeTreeGeos();W.trees=[];W.bushes=[];
  const MAXT=3800;
  for(let z=1;z<N-1;z++)for(let x=1;x<N-1;x++){const i=z*N+x,h=W.H[i];if(h<1.0||W.rock[i])continue;const f=W.forest[i];
    const p=f>0.2?0.4:f>0.08?0.12:0.006;if(rng()<p&&W.trees.length<MAXT){const pine=h>6.5||(h>3.5&&rng()<0.3);
      W.trees.push({x:x-HALF+rr(-0.45,0.45),z:z-HALF+rr(-0.45,0.45),g:rr(0.75,1.15),s:rr(0.75,1.2),pine,alive:true,res:false,fall:0,rot:rr(0,TAU),tint:rng()});}}
  for(let k=0;k<1100;k++){const x=rr(-100,100),z=rr(-100,100),i=cellIdx(x,z);if(i<0)continue;const h=W.H[i];if(h>1.1&&h<6&&!W.rock[i]&&W.forest[i]<0.15)W.bushes.push({x,z,full:1,res:false,regrow:0});}
  NAT.trunk=new THREE.InstancedMesh(TG.trunk,M.trunk,MAXT+400);NAT.leaf=new THREE.InstancedMesh(TG.leaf,M.tree,MAXT+400);NAT.pine=new THREE.InstancedMesh(TG.pine,M.tree,MAXT+400);
  NAT.bush=new THREE.InstancedMesh(TG.bush,M.tree,400);NAT.berry=new THREE.InstancedMesh(TG.berry,new THREE.MeshStandardMaterial({color:0xc4303a,roughness:0.5,flatShading:true}),400*6);
  for(const k of['trunk','leaf','pine','bush'])NAT[k].castShadow=NAT[k].receiveShadow=true;
  // rocks + grass (static decoration)
  const rocks=[],tufts=[];for(let k=0;k<18000&&(rocks.length<600||tufts.length<4200);k++){const x=rr(-115,115),z=rr(-115,115),i=cellIdx(x,z);if(i<0)continue;const h=W.H[i];
    if(W.rock[i]&&rng()<0.6&&rocks.length<600)rocks.push([x,z,rr(0.5,1.6),rng()]);else if(h>-0.5&&h<1.0&&rng()<0.03&&rocks.length<600)rocks.push([x,z,rr(0.3,0.7),rng()]);
    else if(h>1.05&&!W.rock[i]&&tufts.length<4200)tufts.push([x,z,rr(0.7,1.4),rng()]);}
  NAT.rock=new THREE.InstancedMesh(TG.rock,M.rock,rocks.length);NAT.rock.castShadow=NAT.rock.receiveShadow=true;const c=new THREE.Color(),q=new THREE.Quaternion(),e=new THREE.Euler();
  rocks.forEach((r,i)=>{_m.compose(_v.set(r[0],hAt(r[0],r[1])-0.1,r[1]),q.setFromEuler(e.set(r[3]*0.3,r[3]*6,0)),_s.set(r[2],r[2]*rr(0.6,1.1),r[2]));NAT.rock.setMatrixAt(i,_m);NAT.rock.setColorAt(i,c.set('#9a948b').offsetHSL(0,0,(r[3]-0.5)*0.12));});
  NAT.tuft=new THREE.InstancedMesh(TG.tuft,new THREE.MeshStandardMaterial({vertexColors:false,flatShading:true,roughness:1}),tufts.length);NAT.tuft.receiveShadow=true;NAT.tuftData=tufts;
  tufts.forEach((t,i)=>{_m.compose(_v.set(t[0],hAt(t[0],t[1]),t[1]),q.setFromEuler(e.set(0,t[3]*6,0)),_s.set(t[2],t[2]*rr(0.8,1.5),t[2]));NAT.tuft.setMatrixAt(i,_m);NAT.tuft.setColorAt(i,c.set(t[3]<0.06?'#e8d24a':t[3]<0.1?'#f2f2f2':'#6fae55').offsetHSL(0,0,(t[3]-0.5)*0.1));});
  for(const k of['trunk','leaf','pine','bush','berry','rock','tuft'])world.add(NAT[k]);
  refreshTrees(true);refreshBushes();}
const SEASON_LEAF=[['#78b85a','#5f9f48','#9acb63'],['#4f8f3f','#3f7f35','#6aa94f'],['#d98a2f','#c4522f','#e8b23a'],['#6f7f62','#5f6f55','#7a8a6a']];
function refreshTrees(colors){const q=new THREE.Quaternion(),e=new THREE.Euler(),c=new THREE.Color();let nt=0,nl=0,np=0;const ss=Math.floor(S?S.season:0);
  for(const t of W.trees){if(!t.alive&&t.fall<=0)continue;const y=hAt(t.x,t.z)-0.05,sc=t.s*clamp(t.g,0.08,1.15);let tilt=0;if(t.fall>0)tilt=(1-t.fall)*1.5;
    _m.compose(_v.set(t.x,y,t.z),q.setFromEuler(e.set(tilt,t.rot,0)),_s.set(sc,sc,sc));NAT.trunk.setMatrixAt(nt++,_m);
    if(t.pine){NAT.pine.setMatrixAt(np,_m);if(colors)NAT.pine.setColorAt(np,c.set(ss===2?'#3f6a45':'#3f6f45').offsetHSL(0,0,(t.tint-0.5)*0.08));np++;}
    else{NAT.leaf.setMatrixAt(nl,_m);if(colors){const pal=SEASON_LEAF[ss];NAT.leaf.setColorAt(nl,c.set(pal[Math.floor(t.tint*3)]).offsetHSL(0,0,(t.tint-0.5)*0.06));}nl++;}}
  const cap=NAT.trunk.instanceMatrix.count;nt=Math.min(nt,cap);nl=Math.min(nl,cap);np=Math.min(np,cap);NAT.trunk.count=nt;NAT.leaf.count=nl;NAT.pine.count=np;NAT.trunk.instanceMatrix.needsUpdate=NAT.leaf.instanceMatrix.needsUpdate=NAT.pine.instanceMatrix.needsUpdate=true;
  if(colors){if(NAT.leaf.instanceColor)NAT.leaf.instanceColor.needsUpdate=true;if(NAT.pine.instanceColor)NAT.pine.instanceColor.needsUpdate=true;}
  NAT.leaf.computeBoundingSphere();NAT.pine.computeBoundingSphere();NAT.trunk.computeBoundingSphere();}
function refreshBushes(){const q=new THREE.Quaternion(),c=new THREE.Color();let nb=0,nr=0;const winter=S&&S.season===3;
  for(const b of W.bushes){if(b.gone)continue;const y=hAt(b.x,b.z);_m.compose(_v.set(b.x,y,b.z),q.identity(),_s.set(1,1,1));NAT.bush.setMatrixAt(nb,_m);NAT.bush.setColorAt(nb,c.set(winter?'#6a7a5f':'#4f8a3f'));nb++;
    if(b.full>=1&&!winter)for(let k=0;k<6;k++){const a=k*1.1+b.x;_m.compose(_v.set(b.x+Math.cos(a)*0.55,y+0.45+(k%2)*0.25,b.z+Math.sin(a)*0.5),q.identity(),_s.set(1,1,1));NAT.berry.setMatrixAt(nr++,_m);}}
  NAT.bush.count=nb;NAT.berry.count=nr;NAT.bush.instanceMatrix.needsUpdate=NAT.berry.instanceMatrix.needsUpdate=true;if(NAT.bush.instanceColor)NAT.bush.instanceColor.needsUpdate=true;NAT.bush.computeBoundingSphere();NAT.berry.computeBoundingSphere();}
function clearNatureAt(x,z,r){let n=0;for(const t of W.trees)if(t.alive&&(t.x-x)**2+(t.z-z)**2<(r+0.6)**2){t.alive=false;t.fall=0;n++;}
  for(const b of W.bushes)if(!b.gone&&(b.x-x)**2+(b.z-z)**2<(r+0.5)**2)b.gone=true;
  const d=NAT.tuftData;for(let i=0;i<d.length;i++)if((d[i][0]-x)**2+(d[i][1]-z)**2<(r+0.3)**2){_m.makeScale(0,0,0);NAT.tuft.setMatrixAt(i,_m);}NAT.tuft.instanceMatrix.needsUpdate=true;
  refreshTrees(false);refreshBushes();return n;}

/* --- ambient life: clouds, boats, gulls --- */
const AMB={clouds:[],gulls:[],boats:[]};
function buildAmbient(){for(const c of AMB.clouds)scene.remove(c);for(const g of AMB.gulls)scene.remove(g.m);AMB.clouds=[];AMB.gulls=[];
  for(let i=0;i<12;i++){const mb=new MB(),n=ri(4,7);for(let k=0;k<n;k++)mb.ico(rr(2.2,4.2),rr(-6,6),rr(-0.8,1.2),rr(-3,3),'#ffffff',1,0.7,1,1);
    const m=new THREE.Mesh(mb.build().body,M.cloud);m.castShadow=true;m.position.set(rr(-260,260),rr(125,150),rr(-260,260));m.scale.setScalar(1.6);m.userData.v=rr(1.2,2.4);scene.add(m);AMB.clouds.push(m);}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-0.9,0.25,-0.3,0,0.05,0.2, 0,0,0,0.9,0.25,-0.3,0,0.05,0.2],3));gg.computeVertexNormals();
  for(let i=0;i<9;i++){const m=new THREE.Mesh(gg,new THREE.MeshStandardMaterial({color:0xf4f4f0,side:THREE.DoubleSide,flatShading:true}));m.castShadow=true;scene.add(m);AMB.gulls.push({m,r:rr(30,75),h:rr(14,26),sp:rr(0.08,0.16)*(rng()<0.5?1:-1),ph:rr(0,TAU)});}}
function shipModel(kind){const mb=new MB(),pir=kind==='raider';const hull=pir?'#3a2a22':'#7a4a2c',L=pir?9:8;
  mb.box(L,1.1,2.6,0,0.2,0,hull,0,0.35);mb.box(L*0.7,0.5,2.2,0,0.9,0,hull,0,0.2);mb.cone(1.3,2.4,4,L/2+0.6,0.4,0,hull);mb._push(mb.parts,new THREE.ConeGeometry(1.3,2.4,4),hull,L/2+0.6,0.4,0,0,0,-Math.PI/2);
  if(pir){mb.cone(0.3,1.5,5,L/2+1.1,2.0,0,'#c49a3a');for(let i=-3;i<=3;i++){mb.cyl(0.38,0.38,0.08,10,i*1.1,1.0,1.32,i%2?'#b8402f':'#e8dcc0',Math.PI/2);mb.cyl(0.38,0.38,0.08,10,i*1.1,1.0,-1.32,i%2?'#e8dcc0':'#b8402f',Math.PI/2);}}
  mb.cyl(0.13,0.16,7,6,0,4.0,0,'#5a3e2b');const sail=pir?'#b8402f':'#f2ead8';mb.box(0.08,4.2,4.2,0,4.3,0,sail,0,0.05);if(pir)for(let i=0;i<3;i++)mb.box(0.1,0.5,4.25,0,2.8+i*1.4,0,'#e8dcc0');
  else{mb.box(0.06,2.4,2.6,2.6,3.0,0,'#efe6d2');mb.cyl(0.08,0.1,4,6,2.6,2.5,0,'#5a3e2b');mb.box(1.6,1.1,2.0,-2.6,1.6,0,'#9b6c45',0,0.1);}
  const m=new THREE.Mesh(mb.build().body,M.build);m.castShadow=true;return m;}

/* =====================================================================================
   PATHFINDING (A* on a 2-unit grid over land)
   ===================================================================================== */
const PG=2,PN=120;let walk=null;
function buildWalk(){walk=new Uint8Array(PN*PN);for(let j=0;j<PN;j++)for(let i=0;i<PN;i++){const x=i*PG-HALF+1,z=j*PG-HALF+1;walk[j*PN+i]=hAt(x,z)>0.12?1:0;}}
const pc=(x,z)=>[clamp(Math.floor((x+HALF)/PG),0,PN-1),clamp(Math.floor((z+HALF)/PG),0,PN-1)];
const cw=(i,j)=>[i*PG-HALF+1,j*PG-HALF+1];
function nearestWalk(i,j){if(walk[j*PN+i])return[i,j];for(let r=1;r<10;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<PN&&b<PN&&walk[b*PN+a])return[a,b];}return[i,j];}
const PCACHE=new Map();
function los(x0,z0,x1,z1){const d=Math.hypot(x1-x0,z1-z0),n=Math.ceil(d/1.2);for(let k=1;k<n;k++){const t=k/n;if(hAt(lerp(x0,x1,t),lerp(z0,z1,t))<0.1)return false;}return true;}
function findPath(x0,z0,x1,z1){if(los(x0,z0,x1,z1))return[[x1,z1]];
  let[a,b]=pc(x0,z0),[c,d]=pc(x1,z1);[a,b]=nearestWalk(a,b);[c,d]=nearestWalk(c,d);const key=(b*PN+a)*7000+(d*PN+c);
  let cells=PCACHE.get(key);
  if(!cells){const start=b*PN+a,goal=d*PN+c,g=new Float32Array(PN*PN).fill(1e9),from=new Int32Array(PN*PN).fill(-1),open=[[0,start]];g[start]=0;let found=false,iter=0;
    const push=(f,n)=>{open.push([f,n]);let i=open.length-1;while(i>0){const p=(i-1)>>1;if(open[p][0]<=open[i][0])break;[open[p],open[i]]=[open[i],open[p]];i=p;}};
    const pop=()=>{const top=open[0],last=open.pop();if(open.length){open[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<open.length&&open[l][0]<open[m][0])m=l;if(r<open.length&&open[r][0]<open[m][0])m=r;if(m===i)break;[open[m],open[i]]=[open[i],open[m]];i=m;}}return top;};
    while(open.length&&iter++<16000){const[,cur]=pop();if(cur===goal){found=true;break;}const ci=cur%PN,cj=(cur/PN)|0;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=PN||nj>=PN)continue;const nn=nj*PN+ni;if(!walk[nn])continue;
        const ng=g[cur]+(di&&dj?1.414:1);if(ng<g[nn]){g[nn]=ng;from[nn]=cur;push(ng+Math.hypot(c-ni,d-nj),nn);}}}
    cells=[];if(found){let n=goal;while(n!==-1&&n!==start){cells.push(n);n=from[n];}cells.reverse();}
    if(PCACHE.size>3000)PCACHE.clear();PCACHE.set(key,cells);}
  const pts=cells.map(n=>cw(n%PN,(n/PN)|0));pts.push([x1,z1]);
  // string-pull smoothing
  const out=[];let cx=x0,cz=z0,k=0;while(k<pts.length){let far=k;for(let m=pts.length-1;m>k;m--)if(los(cx,cz,pts[m][0],pts[m][1])){far=m;break;}out.push(pts[far]);[cx,cz]=pts[far];k=far+1;}return out;}

/* =====================================================================================
   GAME STATE
   ===================================================================================== */
let S=null;let buildingsGroup=new THREE.Group();scene.add(buildingsGroup);
const fx={smoke:[],fire:[],arrows:[],float:[]};
function newState(seed,diff){return{seed,diff,time:DAY*0.3,day:0,season:0,year:1,stock:{wood:45,stone:24,planks:8,tools:14,fish:40,berries:32,wheat:0,flour:0,bread:0,gold:30},
  build:[],vill:[],raiders:[],nextId:1,happy:62,happyT:62,hungry:0,cold:false,goal:0,stats:{bread:0},raidPenalty:0,nextRaid:diff==='brutal'?16:diff==='normal'?30:1e9,raid:null,merchant:null,
  delta:{},deltaY:{},name:'Saltwind',seen:{},speed:1,lastBirth:0};}
function count(t){let n=0;for(const b of S.build)if(b.type===t&&b.state!=='site')n++;return n;}
function hubs(){return S.build.filter(b=>B[b.type].hub&&b.state==='done');}
function nearestHub(x,z){let best=null,bd=1e9;for(const b of S.build){if(!B[b.type].hub||b.state!=='done')continue;const d=(b.x-x)**2+(b.z-z)**2;if(d<bd){bd=d;best=b;}}return best;}
function beds(){let n=0;for(const b of S.build)if(b.state==='done'&&B[b.type].beds)n+=B[b.type].beds;return n;}
function addStock(r,n){S.stock[r]=(S.stock[r]||0)+n;S.delta[r]=(S.delta[r]||0)+n;if(r==='bread'&&n>0)S.stats.bread+=n;}
function take(r,n){if((S.stock[r]||0)<n)return false;S.stock[r]-=n;S.delta[r]=(S.delta[r]||0)-n;return true;}
function canAfford(cost){for(const k in cost)if((S.stock[k]||0)<cost[k])return false;return true;}

/* ---------------- building meshes ---------------- */
const GEO={};
function geoFor(type,variant){const key=type+(type==='house'?variant%6:'');if(!GEO[key]){const mb=MODEL[type](variant);const g=mb.build();if(type==='farm'){g.body.translate(1.7,0,0);if(g.win)g.win.translate(1.7,0,0);g.extra.field[0]+=1.7;}GEO[key]=g;}return GEO[key];}
function makeBuildingMesh(b){const g=geoFor(b.type,b.var),grp=new THREE.Group();const body=new THREE.Mesh(g.body,M.build);body.castShadow=body.receiveShadow=true;grp.add(body);
  if(g.win){const w=new THREE.Mesh(g.win,M.win);grp.add(w);}
  if(g.extra.sails){const s=new THREE.Mesh(g.extra.sails.geo,M.build);s.position.fromArray(g.extra.sails.pos);s.castShadow=true;grp.add(s);b.sails=s;}
  if(b.type==='lighthouse'){const beam=new THREE.Mesh(new THREE.ConeGeometry(4,40,16,1,true),M.beam);beam.geometry.translate(0,-20,0);beam.rotation.z=Math.PI/2;const piv=new THREE.Group();piv.position.set(0,11.9,0);piv.add(beam);grp.add(piv);b.beam=piv;}
  if(b.type==='farm'){const[fx2,fz2,S2]=g.extra.field;const crops=new THREE.InstancedMesh(new THREE.ConeGeometry(0.12,0.9,4).translate(0,0.45,0),new THREE.MeshStandardMaterial({color:0xd9b54a,flatShading:true,roughness:0.9}),196);
    let k=0;for(let i=0;i<14;i++)for(let j=0;j<14;j++){_m.makeTranslation(fx2-S2+i*(S2*2/13),0,fz2-S2+j*(S2*2/13));crops.setMatrixAt(k++,_m);}crops.castShadow=true;grp.add(crops);b.crops=crops;b.cropBase=crops.instanceMatrix.array.slice();}
  grp.position.set(b.x,b.y,b.z);grp.rotation.y=b.rot;grp.userData.bid=b.id;b.mesh=grp;buildingsGroup.add(grp);
  if(b.state==='site'){const sc=geoFor('scaffold',0);const s=new THREE.Mesh(sc.body,M.build);s.castShadow=true;s.scale.set(B[b.type].fr*0.9,1,B[b.type].fr*0.9);grp.add(s);b.scaf=s;}
  updateBuildVisual(b);}
function updateBuildVisual(b){if(!b.mesh)return;const done=b.state!=='site',p=done?1:clamp(b.progress,0.03,1);
  for(const ch of b.mesh.children){if(ch===b.scaf)continue;ch.scale.y=done?1:Math.max(0.05,p);}
  if(b.scaf){b.scaf.visible=!done;}if(b.state==='ruin')b.mesh.scale.set(1,0.25,1);}
function worldPos(b,local){const c=Math.cos(b.rot),s=Math.sin(b.rot);return[b.x+local[0]*c+local[2]*s,b.y+local[1],b.z-local[0]*s+local[2]*c];}

/* ---------------- placement rules ---------------- */
function waterDir(x,z,r){let best=null,bd=1e9;for(let k=0;k<24;k++){const a=k/24*TAU;for(let d=r*0.6;d<=r+6;d+=1){const px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;if(hAt(px,pz)<-0.6){if(d<bd){bd=d;best=a;}break;}}}return best===null?null:{a:best,d:bd};}
function checkPlace(type,x,z,rot){const T=B[type],fr=T.fr,probs=[];let hmin=1e9,hmax=-1e9;
  if(Math.abs(x)>114||Math.abs(z)>114)return{ok:false,probs:['Off the chart'],y:0,rot};
  if(T.coast){const wd=waterDir(x,z,fr);if(!wd||wd.d>fr+5)probs.push('Must stand on the shore');else rot=-wd.a+Math.PI/2;}
  const pts=[[0,0]];for(let k=0;k<8;k++){const a=k/8*TAU;pts.push([Math.cos(a)*fr,Math.sin(a)*fr],[Math.cos(a)*fr*0.5,Math.sin(a)*fr*0.5]);}
  for(const[dx,dz]of pts){const h=hAt(x+dx,z+dz);hmin=Math.min(hmin,h);hmax=Math.max(hmax,h);}
  const ch=hAt(x,z);if(T.coast){if(ch<0.25)probs.push('Too close to the water');}else if(hmin<0.3)probs.push('Needs dry land');
  if(hmax-hmin>(T.flat?1.0:fr*0.75+0.6))probs.push(T.flat?'Needs flat ground':'Too steep');
  for(const b of S.build){const d=Math.hypot(b.x-x,b.z-z);if(d<B[b.type].fr+fr+0.3)probs.push('Too close to '+B[b.type].name.toLowerCase());if(B[b.type].pier&&b.dockTip){if(Math.hypot(b.dockTip[0]-x,b.dockTip[2]-z)<fr+2)probs.push('Blocks the pier');}}
  if(T.rock){let n=0;for(let dz=-9;dz<=9;dz+=1.5)for(let dx=-9;dx<=9;dx+=1.5){const i=cellIdx(x+dx,z+dz);if(i>=0&&W.rock[i])n++;}if(n<6)probs.push('No rock close enough');}
  if(type==='farm'){let f=0,c2=0;for(let dz=-4;dz<=4;dz+=2)for(let dx=-4;dx<=4;dx+=2){const i=cellIdx(x+dx,z+dz);if(i>=0){f+=W.fert[i];c2++;}}if(f/c2<0.42)probs.push('Soil too poor');}
  if(!canAfford(T.cost))probs.push('Not enough materials');
  return{ok:!probs.length,probs:[...new Set(probs)],y:T.coast?Math.max(ch,0.3):(hmin+hmax)/2*0.4+ch*0.6,rot};}
function placeBuilding(type,x,z,rot,opts={}){const T=B[type];const b={id:S.nextId++,type,x,z,rot,y:opts.y!==undefined?opts.y:hAt(x,z),var:opts.var!==undefined?opts.var:Math.floor(rng()*1000),
  state:opts.done?'done':'site',progress:opts.done?1:0,toCarry:opts.done?{}:{...T.cost},carried:{},hp:100,fire:0,workers:[],want:T.w,timer:0,data:{},status:''};
  if(T.cost.gold&&!opts.done){b.toCarry={...T.cost};delete b.toCarry.gold;}
  if(!opts.done&&!opts.free){for(const k in T.cost)take(k,T.cost[k]);}
  const g=geoFor(type,b.var);if(g.extra.dockTip)b.dockTip=worldPos(b,g.extra.dockTip);if(g.extra.chimney)b.chimney=worldPos(b,g.extra.chimney);if(g.extra.guard)b.guardPos=worldPos(b,g.extra.guard);
  if(type==='farm'){const f=g.extra.field;b.field=worldPos(b,[f[0],0,f[1]]);b.fieldR=f[2];b.data={sown:0,grown:0,harvest:0,cells:0};}
  if(type==='fisher')b.spot=b.dockTip;
  clearNatureAt(x,z,T.fr+(type==='farm'?0.5:0));
  S.build.push(b);makeBuildingMesh(b);return b;}
function demolish(b){if(b.type==='townhall')return;const T=B[b.type];
  if(b.state==='site'){for(const k in T.cost){const back=k==='gold'?T.cost[k]:(b.carried[k]||0)+(b.toCarry[k]||0);addStock(k,back);}}else for(const k in T.cost)if(k!=='gold')addStock(k,Math.floor(T.cost[k]*0.4));
  for(const v of S.vill){if(v.job===b.id){v.job=null;v.state='idle';v.path=null;v.carry=null;}if(v.home===b.id)v.home=null;if(v.site===b.id){v.site=null;v.state='idle';v.carry=null;}}
  if(b.mesh)buildingsGroup.remove(b.mesh);S.build.splice(S.build.indexOf(b),1);if(SEL===b)select(null);assignHomes();}

/* =====================================================================================
   VILLAGERS
   ===================================================================================== */
const SHIRTS=['#3f6f9f','#9f4f3f','#4f7f4f','#8f7a3f','#6f4f8f','#3f8f8f','#b0703a','#5a5a6a'];
function addVillager(x,z){const v={id:S.nextId++,x,z,y:hAt(x,z),home:null,job:null,state:'idle',path:null,pi:0,carry:null,t:rr(0,3),speed:rr(3.0,3.6),shirt:Math.floor(rng()*SHIRTS.length),hat:rng()<0.4,hp:50,face:0,bob:rr(0,TAU)};
  S.vill.push(v);return v;}
function assignHomes(){const cap=new Map();for(const b of S.build)if(b.state==='done'&&B[b.type].beds)cap.set(b.id,B[b.type].beds);
  for(const v of S.vill)if(v.home&&cap.has(v.home)&&cap.get(v.home)>0)cap.set(v.home,cap.get(v.home)-1);else v.home=null;
  for(const v of S.vill)if(!v.home){for(const[id,n]of cap)if(n>0){v.home=id;cap.set(id,n-1);break;}}}
function bById(id){for(const b of S.build)if(b.id===id)return b;return null;}
function goTo(v,x,z){v.path=findPath(v.x,v.z,x,z);v.pi=0;v.tx=x;v.tz=z;}
function arrived(v){return!v.path||v.pi>=v.path.length;}
function stepMove(v,dt,spMul=1){if(arrived(v))return true;const p=v.path[v.pi],dx=p[0]-v.x,dz=p[1]-v.z,d=Math.hypot(dx,dz),sp=v.speed*spMul*(S.season===3?0.9:1)*dt;
  if(d<=sp){v.x=p[0];v.z=p[1];v.pi++;}else{v.x+=dx/d*sp;v.z+=dz/d*sp;v.face=Math.atan2(dx,dz);}v.moving=true;return arrived(v);}
function jobsAssign(){// release extra workers, fill wanted posts from labourers, keep a few labourers for construction
  for(const b of S.build){if(b.state!=='done'){b.workers=[];continue;}b.workers=b.workers.filter(id=>S.vill.some(v=>v.id===id&&v.job===b.id));
    while(b.workers.length>b.want){const id=b.workers.pop(),v=S.vill.find(q=>q.id===id);if(v){v.job=null;v.state='idle';v.path=null;v.carry=null;v.res=null;}}}
  const sites=S.build.some(b=>b.state==='site'||b.hp<100);const keep=sites?Math.min(3,Math.floor(S.vill.length*0.25)):0;
  let free=S.vill.filter(v=>!v.job&&!v.militia);
  if(sites&&free.length<2){const spare=['tower','lighthouse','dock','tavern','market','workshop','bakery','windmill','sawmill','quarry','woodcutter'];for(const t of spare){if(free.length>=2)break;for(const b of S.build){if(b.type!==t||!b.workers.length)continue;const id=b.workers.pop(),v=S.vill.find(q=>q.id===id);if(v){v.job=null;v.state='idle';v.path=null;v.carry=null;releaseRes(v);free.push(v);}if(free.length>=2)break;}}}
  const order=['fisher','berry','farm','woodcutter','quarry','sawmill','windmill','bakery','workshop','forester','market','tavern','dock','tower','lighthouse','barracks'];
  const posts=S.build.filter(b=>b.state==='done'&&B[b.type].w>0&&b.workers.length<b.want).sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type));
  for(const b of posts){while(b.workers.length<b.want&&free.length>keep){const v=free.shift();v.job=b.id;v.state='toJob';v.path=null;v.res=null;v.carry=null;b.workers.push(v.id);}}}
function toolsMul(){return S.stock.tools>0?1:0.6;}
function happyMul(){return S.happy>70?1.15:S.happy<30?0.7:1;}

function releaseRes(v){if(v.res){v.res.res=false;v.res=null;}}
function villagerUpdate(v,dt){v.moving=false;
  if(S.raid&&S.raid.landed&&!v.militia){const th=S.build.find(b=>b.type==='townhall')||S.build[0];if(!th)return;if(v.state!=='hide'){releaseRes(v);v.state='hide';goTo(v,th.x+rr(-3,3),th.z+4+rr(0,2));}stepMove(v,dt,1.35);return;}
  if(v.state==='hide'){v.state='idle';v.path=null;}
  if(v.militia)return militiaUpdate(v,dt);
  const b=v.job?bById(v.job):null;
  if(!b)return labourUpdate(v,dt);
  const J=B[b.type].job;if(!J){v.state='idle';return;}
  const workMul=happyMul()*toolsMul()*(S.season===3?0.85:1);
  switch(v.state){
    case'toJob':case'idle':{if(!v.path)goTo(v,b.x+rr(-1.5,1.5),b.z+B[b.type].fr+0.8);if(stepMove(v,dt)){v.state='atJob';v.t=0;}return;}
    case'atJob':{v.t+=dt;
      if(J.kind==='stay'||J.kind==='guard'){if(J.kind==='guard'&&b.guardPos){v.x=b.guardPos[0];v.z=b.guardPos[2];v.yOff=b.guardPos[1]-hAt(v.x,v.z);}b.status='Staffed';return;}
      if(J.kind==='militia'){v.state='drill';return;}
      if(J.kind==='gather'){const list=J.node==='tree'?W.trees:W.bushes,R=B[b.type].range;let best=null,bd=R*R;
        for(const n of list){if(n.res||n.gone)continue;if(J.node==='tree'&&(!n.alive||n.g<0.95))continue;if(J.node==='bush'&&(n.full<1||S.season===3))continue;const d=(n.x-b.x)**2+(n.z-b.z)**2;if(d<bd){bd=d;best=n;}}
        if(!best){b.status=J.node==='tree'?'No grown trees in reach':S.season===3?'Bushes rest in winter':'No ripe bushes in reach';if(v.t>4){v.t=0;}return;}
        best.res=true;v.res=best;goTo(v,best.x+0.8,best.z+0.6);v.state='toNode';b.status='Working';return;}
      if(J.kind==='site'){const sp=b.spot||[b.x,0,b.z];goTo(v,sp[0]+rr(-0.4,0.4),sp[2]+rr(-0.4,0.4));v.state='toNode';b.status='Working';return;}
      if(J.kind==='plant'){let tries=0,ok=false,px,pz;const R=B[b.type].range;let near=0;for(const t of W.trees)if(t.alive&&(t.x-b.x)**2+(t.z-b.z)**2<R*R)near++;
        if(near>90){b.status='The grove is full';return;}
        while(tries++<20&&!ok){const a=rr(0,TAU),r=rr(3,R);px=b.x+Math.cos(a)*r;pz=b.z+Math.sin(a)*r;const i=cellIdx(px,pz);if(i<0||W.H[i]<1.05||W.rock[i])continue;
          ok=!S.build.some(o=>(o.x-px)**2+(o.z-pz)**2<(B[o.type].fr+1.5)**2)&&!W.trees.some(t=>t.alive&&(t.x-px)**2+(t.z-pz)**2<1.6);}
        if(!ok){b.status='No room to plant';return;}v.plant=[px,pz];goTo(v,px+0.7,pz);v.state='toNode';b.status='Planting';return;}
      if(J.kind==='process'){for(const k in J.in)if((S.stock[k]||0)<J.in[k]+(RESERVE[k]||0)){b.status=(S.stock[k]||0)<J.in[k]?'Waiting for '+RNAME[k].toLowerCase():'Keeping a reserve of '+RNAME[k].toLowerCase();return;}
        const h=nearestHub(b.x,b.z);if(!h)return;goTo(v,h.x,h.z+B[h.type].fr);v.state='fetch';b.status='Working';return;}
      if(J.kind==='farm')return farmWork(v,b,dt);
      return;}
    case'toNode':{if(stepMove(v,dt)){v.state='work';v.t=0;}return;}
    case'work':{v.t+=dt*workMul;v.anim=1;const need=J.kind==='farm'?4:J.work*(b.type==='fisher'&&S.season===3?1.5:1);
      if(J.kind==='gather'&&J.node==='tree'&&Math.random()<dt*1.5&&nearCam(v))SFX.chop();
      if(v.t<need)return;v.anim=0;
      if(J.kind==='plant'){W.trees.push({x:v.plant[0],z:v.plant[1],g:0.08,s:rr(0.8,1.15),pine:hAt(v.plant[0],v.plant[1])>6,alive:true,res:false,fall:0,rot:rr(0,TAU),tint:rng()});refreshTrees(true);goTo(v,b.x,b.z+B[b.type].fr+0.6);v.state='toJob';return;}
      if(J.kind==='gather'){const n=v.res;v.res=null;if(n){n.res=false;if(J.node==='tree'){n.alive=false;n.fall=1;}else{n.full=0;n.regrow=0;refreshBushes();}}}
      if(J.kind==='process'){v.carry={r:Object.keys(J.out)[0],n:J.out[Object.keys(J.out)[0]]};}
      else if(J.out){const r=Object.keys(J.out)[0];v.carry={r,n:J.out[r]};}
      if(Math.random()<0.025)take('tools',1);
      const h=nearestHub(v.x,v.z);if(h){goTo(v,h.x+rr(-1,1),h.z+B[h.type].fr+0.5);v.state='deliver';}return;}
    case'fetch':{if(!stepMove(v,dt))return;for(const k in J.in)if((S.stock[k]||0)<J.in[k]){v.state='atJob';b.status='Waiting for '+RNAME[k].toLowerCase();return;}
      for(const k in J.in)take(k,J.in[k]);v.carry={r:Object.keys(J.in)[0],n:1};goTo(v,b.x,b.z+B[b.type].fr+0.5);v.state='toNode';return;}
    case'deliver':{if(!stepMove(v,dt))return;if(v.carry){addStock(v.carry.r,v.carry.n);floatText(v.x,v.y+2,v.z,'+'+v.carry.n,v.carry.r);v.carry=null;}v.state='atJob';v.t=0;return;}
    case'drill':return;}}
function farmWork(v,b,dt){const d=b.data,s=S.season;
  if(s===0){if(d.sown>=1){b.status='Sown. Waiting for summer';return;}}
  else if(s===1){b.status='Crops growing';v.state='atJob';return;}
  else if(s===2){if(d.grown<=0||d.harvest>=1){b.status=d.grown>0?'Harvest is in':'Nothing was sown';return;}}
  else{b.status='The field rests for winter';return;}
  const a=rr(0,TAU),r=rr(0,b.fieldR);goTo(v,b.field[0]+Math.cos(a)*r,b.field[2]+Math.sin(a)*r);v.state='toNode';v.farm=s;b.status=s===0?'Sowing':'Harvesting';}
function farmDone(v,b){const d=b.data;if(v.farm===0){d.sown=Math.min(1,d.sown+0.08);}else if(v.farm===2){const amt=Math.round(9*d.grown);d.harvest=Math.min(1,d.harvest+0.08);v.carry={r:'wheat',n:Math.max(1,amt)};}}
// patch: farm 'work' completion
const _origVU=villagerUpdate;
function villagerTick(v,dt){const b=v.job?bById(v.job):null;
  if(b&&b.type==='farm'&&v.state==='work'){v.t+=dt*happyMul()*toolsMul();v.anim=1;if(v.t<4)return;v.anim=0;farmDone(v,b);if(v.carry){const h=nearestHub(v.x,v.z);goTo(v,h.x,h.z+B[h.type].fr+0.5);v.state='deliver';}else{v.state='atJob';}return;}
  _origVU(v,dt);}
function labourUpdate(v,dt){// build, repair, carry
  if(v.state==='carry'||v.state==='toSite'||v.state==='building'||v.state==='getMat'){const site=bById(v.site);if(!site){v.state='idle';v.carry=null;v.site=null;}}
  switch(v.state){
    case'getMat':{if(!stepMove(v,dt))return;const site=bById(v.site);const r=v.want;const n=Math.min(5,site.toCarry[r]||0);if(n<=0){v.state='idle';return;}site.toCarry[r]-=n;v.carry={r,n};goTo(v,site.x+rr(-1,1),site.z+B[site.type].fr+0.4);v.state='carry';return;}
    case'carry':{if(!stepMove(v,dt))return;const site=bById(v.site);site.carried[v.carry.r]=(site.carried[v.carry.r]||0)+v.carry.n;v.carry=null;v.state='idle';return;}
    case'toSite':{if(stepMove(v,dt)){v.state='building';v.t=0;}return;}
    case'building':{const site=bById(v.site);v.anim=1;
      if(site.state==='site'){if(remaining(site)>0){v.state='idle';v.anim=0;return;}site.progress+=dt/B[site.type].work*1.0;if(Math.random()<dt*2.2&&nearCam(v))SFX.hammer();updateBuildVisual(site);
        if(site.progress>=1){finishSite(site);v.state='idle';v.anim=0;}}
      else{site.hp=Math.min(100,site.hp+dt*6);if(site.hp>=100){v.state='idle';v.anim=0;}}return;}
    default:{// look for work
      v.t-=dt;if(v.t>0){if(!arrived(v))stepMove(v,dt,0.6);return;}v.t=rr(0.6,1.4);
      const sites=S.build.filter(b=>b.state==='site').sort((a,b2)=>a.id-b2.id);
      for(const s of sites){const rem=remaining(s);const inbound=S.vill.filter(o=>o.site===s.id&&(o.state==='getMat'||o.state==='carry'));
        for(const r in s.toCarry){if(s.toCarry[r]>0&&inbound.filter(o=>o.want===r).length*5<s.toCarry[r]+5){const h=nearestHub(s.x,s.z);if(!h)continue;v.site=s.id;v.want=r;goTo(v,h.x+rr(-1,1),h.z+B[h.type].fr+0.5);v.state='getMat';return;}}
        if(rem<=0){const builders=S.vill.filter(o=>o.site===s.id&&o.state==='building').length;if(builders<4){v.site=s.id;goTo(v,s.x+rr(-1.5,1.5),s.z+B[s.type].fr+0.5);v.state='toSite';return;}}}
      const dmg=S.build.find(b=>b.state==='done'&&b.hp<100&&!S.raid);if(dmg&&(S.stock.wood||0)>=1){take('wood',1);v.site=dmg.id;goTo(v,dmg.x,dmg.z+B[dmg.type].fr+0.5);v.state='toSite';return;}
      v.site=null;const th=S.build.find(b=>b.type==='townhall');if(th&&Math.random()<0.5)goTo(v,th.x+rr(-7,7),th.z+rr(-7,7));}}}
function remaining(s){let n=0;for(const r in s.toCarry)n+=s.toCarry[r];for(const o of S.vill)if(o.site===s.id&&o.carry&&o.state==='carry')n+=o.carry.n;return n;}
function finishSite(s){s.state='done';s.progress=1;s.carried={};if(s.scaf){s.mesh.remove(s.scaf);s.scaf=null;}updateBuildVisual(s);SFX.done();log(B[s.type].name+' completed','build');
  popAnim(s);assignHomes();jobsAssign();if(SEL===s)renderInspector();}
function popAnim(b){b.pop=0.5;}

/* =====================================================================================
   RAIDERS, MILITIA, TOWERS
   ===================================================================================== */
let raidShip=null,merchShip=null;
function scheduleRaid(){if(S.diff==='peaceful')return;const base=S.diff==='brutal'?rr(9,12):rr(14,19);S.nextRaid=S.day+base;}
function startRaid(){const cx=avgX(),cz=avgZ();let best=null,bd=1e9;for(const p of W.shore){const d=(p[0]-cx)**2+(p[1]-cz)**2+rr(0,900);if(d<bd){bd=d;best=p;}}if(!best)return;
  const size=Math.round((2+S.year+S.vill.length/20)*(S.diff==='brutal'?1.6:1));const dir=Math.atan2(best[1],best[0]);
  const lt=count('lighthouse')>0;const far=lt?250:170;
  S.raid={land:best,size,landed:false,eta:lt?40:22,sx:Math.cos(dir)*far,sz:Math.sin(dir)*far,done:false,stolen:0};
  if(!raidShip){raidShip=shipModel('raider');scene.add(raidShip);}raidShip.visible=true;raidShip.position.set(S.raid.sx,0,S.raid.sz);
  banner('Sails on the horizon','A longship approaches from the '+compass(dir)+'. '+size+' raiders.');SFX.horn();log('Raiders sighted to the '+compass(dir),'raid');}
function compass(a){const d=['east','south-east','south','south-west','west','north-west','north','north-east'];return d[((Math.round(a/(Math.PI/4))%8)+8)%8];}
function avgX(){let s=0,n=0;for(const b of S.build){s+=b.x;n++;}return n?s/n:0;}function avgZ(){let s=0,n=0;for(const b of S.build){s+=b.z;n++;}return n?s/n:0;}
function raidUpdate(dt){const R=S.raid;if(!R)return;
  if(!R.landed){R.eta-=dt;const t=clamp(1-R.eta/22,0,1),lx=R.land[0]*1.12,lz=R.land[1]*1.12;
    raidShip.position.x=lerp(R.sx,lx+Math.cos(Math.atan2(lz,lx))*6,smooth(0,1,1-Math.max(0,R.eta)/ (count('lighthouse')?40:22)));raidShip.position.z=lerp(R.sz,lz+Math.sin(Math.atan2(lz,lx))*6,smooth(0,1,1-Math.max(0,R.eta)/(count('lighthouse')?40:22)));
    raidShip.rotation.y=-Math.atan2(lz-R.sz,lx-R.sx);
    if(R.eta<=0){R.landed=true;for(let i=0;i<R.size;i++)S.raiders.push({arson:rng()<(S.diff==='brutal'?0.5:0.3),x:R.land[0]+rr(-2,2),z:R.land[1]+rr(-2,2),y:0,hp:34+S.year*4,state:'go',t:0,path:null,pi:0,speed:rr(3.3,3.9),carry:0,face:0,bob:rr(0,TAU)});
      SFX.horn();log('Raiders have landed!','raid');}return;}
  for(const r of S.raiders)raiderUpdate(r,dt);
  S.raiders=S.raiders.filter(r=>!r.gone&&r.hp>0);
  if(R.landed&&!S.raiders.length&&!R.done){R.done=true;R.leave=0;log(R.stolen?`The raiders fled with ${R.stolen} goods`:'The raiders were driven off','raid');if(!R.stolen)SFX.goal();jobsAssign();}
  if(R.done){R.leave+=dt;raidShip.position.x+=Math.cos(Math.atan2(R.sz,R.sx))*dt*8;raidShip.position.z+=Math.sin(Math.atan2(R.sz,R.sx))*dt*8;if(R.leave>18){raidShip.visible=false;S.raid=null;scheduleRaid();}}}
function raiderUpdate(r,dt){r.moving=false;
  if(r.state==='go'){let tgt=null,bd=1e9;for(const b of S.build){if(b.state==='ruin')continue;const pri=B[b.type].hub?0.35:(r.arson?1:4);const d=((b.x-r.x)**2+(b.z-r.z)**2)*pri;if(d<bd){bd=d;tgt=b;}}
    if(!tgt){r.state='flee';return;}r.tgt=tgt.id;goTo(r,tgt.x+rr(-1,1),tgt.z+B[tgt.type].fr+0.6);r.state='walk';return;}
  if(r.state==='walk'){if(stepMove(r,dt))r.state='attack';return;}
  if(r.state==='attack'){const b=bById(r.tgt);if(!b||b.state==='ruin'){r.state='go';return;}r.anim=1;r.t+=dt;
    if(B[b.type].hub){if(r.t>1.6){r.t=0;const rs=RES.filter(k=>k!=='gold'&&S.stock[k]>0);if(rs.length){const k=pick(rs),n=Math.min(6,S.stock[k]);take(k,n);r.carry+=n;S.raid.stolen+=n;}else if(S.stock.gold>0){const n=Math.min(5,S.stock.gold);take('gold',n);r.carry+=n;S.raid.stolen+=n;}}
      if(r.carry>=24){r.state='flee';}}
    else{b.hp-=dt*(S.diff==='brutal'?5:3.2);if(!b.fire&&b.hp<70)b.fire=1;if(b.hp<=0){ruin(b);r.state='go';}else if(r.t>9){r.t=0;r.arson=false;r.state='go';}}
    return;}
  if(r.state==='flee'){if(!r.path||r.fleeing!==true){r.fleeing=true;goTo(r,S.raid.land[0],S.raid.land[1]);}if(stepMove(r,dt,1.15))r.gone=true;return;}}
function ruin(b){b.state='ruin';b.hp=0;b.fire=0;for(const v of S.vill){if(v.job===b.id){v.job=null;v.state='idle';}if(v.home===b.id)v.home=null;}
  b.workers=[];updateBuildVisual(b);log(B[b.type].name+' was burned','raid');SFX.hit();S.raidPenalty=Math.min(30,S.raidPenalty+10);assignHomes();
  setTimeout(()=>{if(S&&S.build.includes(b)){buildingsGroup.remove(b.mesh);S.build.splice(S.build.indexOf(b),1);}},6000);}
function militiaUpdate(v,dt){const bar=bById(v.job);
  if(S.raid&&S.raid.landed&&S.raiders.length){let tgt=null,bd=1e9;for(const r of S.raiders){const d=(r.x-v.x)**2+(r.z-v.z)**2;if(d<bd){bd=d;tgt=r;}}
    if(!tgt)return;const d=Math.sqrt(bd);if(d>1.6){if(!v.path||v.t<=0){goTo(v,tgt.x,tgt.z);v.t=1.2;}v.t-=dt;stepMove(v,dt,1.25);}else{v.anim=1;tgt.hp-=dt*11;v.hp-=dt*5;if(Math.random()<dt*2)SFX.hit();
      if(v.hp<=0){S.vill.splice(S.vill.indexOf(v),1);log('A militiaman fell defending the village','raid');}}return;}
  v.hp=Math.min(50,v.hp+dt*2);if(bar&&(!v.path||arrived(v))&&Math.random()<dt*0.5)goTo(v,bar.x+rr(-3,3),bar.z+B[bar.type].fr+rr(1,3));stepMove(v,dt,0.6);}
function towersUpdate(dt){if(!S.raiders.length)return;for(const b of S.build){if(b.type!=='tower'||b.state!=='done'||!b.workers.length)continue;b.t2=(b.t2||0)-dt;if(b.t2>0)continue;
  let tgt=null,bd=B.tower.range**2;for(const r of S.raiders){const d=(r.x-b.x)**2+(r.z-b.z)**2;if(d<bd){bd=d;tgt=r;}}if(!tgt)continue;b.t2=1.1;
  fireArrow(b.guardPos||[b.x,b.y+5.5,b.z],[tgt.x,tgt.y+0.8,tgt.z],()=>{tgt.hp-=10;});}}

/* =====================================================================================
   DAILY SIMULATION
   ===================================================================================== */
function computeHappy(){const f={};const houses=S.build.filter(b=>b.state==='done'&&B[b.type].beds);const pop=S.vill.length;
  const kinds=FOOD.filter(k=>S.stock[k]>0).length;const mk=S.build.filter(b=>b.type==='market'&&b.state==='done'&&b.workers.length);
  const cover=(type,range)=>{const src=S.build.filter(b=>b.type===type&&b.state==='done'&&(B[type].w===0||b.workers.length));if(!houses.length||!src.length)return 0;let n=0;for(const h of houses)if(src.some(s=>(s.x-h.x)**2+(s.z-h.z)**2<range*range))n++;return n/houses.length;};
  const mc=cover('market',B.market.range);f.food=kinds===0?-35:kinds===1?0:kinds===2?(6+mc*4):(10+mc*8);
  if(S.hungry>0)f.food-=20;
  const homeless=Math.max(0,pop-beds());f.homes=homeless?-Math.min(25,homeless*3):4;
  f.warmth=S.cold?-18:0;f.faith=Math.round(cover('chapel',B.chapel.range)*14);f.tavern=S.tavernFed?Math.round(cover('tavern',B.tavern.range)*9):0;
  f.water=Math.round(cover('well',B.well.range)*5);f.garden=Math.round(cover('garden',B.garden.range)*6);f.light=count('lighthouse')?5:0;f.safety=-Math.round(S.raidPenalty);
  f.base=48;let t=0;for(const k in f)t+=f[k];S.factors=f;S.happyT=clamp(t,0,100);}
function newDay(){S.day++;const prevSeason=S.season;S.season=Math.floor(S.day/SEASON_DAYS)%4;S.year=Math.floor(S.day/(SEASON_DAYS*4))+1;
  S.deltaY=S.delta;S.delta={};
  // eat
  const pop=S.vill.length;let need=pop,got=0;const order=['bread','fish','berries'];const share=Math.ceil(need/3);
  for(const k of order){const n=Math.min(S.stock[k],share,need-got);take(k,n);got+=n;}for(const k of order){const n=Math.min(S.stock[k],need-got);take(k,n);got+=n;}
  if(got<need){S.hungry++;if(S.hungry>2&&S.hungry%2===1&&pop>0){const v=S.vill[Math.floor(rng()*pop)];if(!v.militia){S.vill.splice(S.vill.indexOf(v),1);log('A settler starved','bad');}}if(S.hungry===1)log('The larders are empty. People go hungry','bad');}else S.hungry=0;
  // warmth
  S.cold=false;if(S.season===3){const houses=S.build.filter(b=>b.state==='done'&&b.type==='house').length+1;if(!take('wood',houses)){S.cold=true;S.stock.wood=0;log('Hearths are cold. The houses need logs','bad');}}
  // tavern
  S.tavernFed=false;const tv=S.build.filter(b=>b.type==='tavern'&&b.state==='done'&&b.workers.length);if(tv.length&&take('bread',2*tv.length))S.tavernFed=true;
  S.raidPenalty=Math.max(0,S.raidPenalty-3);
  // nature
  W.trees=W.trees.filter(t=>t.alive||t.fall>0);
  let tc=false;for(const t of W.trees){if(t.alive&&t.g<1.1&&S.season!==3){t.g=Math.min(1.1,t.g+0.13);tc=true;}}if(tc)refreshTrees(false);
  for(const b of W.bushes){if(b.full<1&&S.season!==3){b.regrow++;if(b.regrow>=2)b.full=1;}}refreshBushes();
  // farms
  for(const b of S.build){if(b.type!=='farm'||b.state!=='done')continue;const d=b.data;
    if(S.season===1&&prevSeason!==1){d.grown=d.sown;}if(S.season===2&&prevSeason!==2){d.harvest=0;}if(S.season===3&&prevSeason!==3){d.sown=0;d.grown=0;d.harvest=0;}updateCrops(b);}
  // growth
  const free=beds()-pop,foodDays=(S.stock.fish+S.stock.berries+S.stock.bread)/Math.max(1,pop);
  const foodNet=(S.deltaY.fish||0)+(S.deltaY.berries||0)+(S.deltaY.bread||0);
  if(free>0&&foodDays>4&&foodNet>=0&&S.happy>45&&rng()<0.3+(S.happy-50)/120){const h=S.build.find(b=>b.state==='done'&&B[b.type].beds)||S.build[0];addVillager(h.x+rr(-2,2),h.z+B[h.type].fr+1);log('A new settler joins the village','good');assignHomes();jobsAssign();}
  if(S.season!==prevSeason){onSeason(prevSeason);}
  if(S.day>=S.nextRaid&&!S.raid)startRaid();
  computeHappy();checkTitle();if(pop===0)lose();}
function onSeason(prev){SNOW_TARGET=S.season===3?1:0;refreshTrees(true);MUS.season=S.season;log(SEASONS[S.season]+' arrives','season');
  if(S.season===0&&S.happy>52){const n=Math.min(4,Math.max(0,beds()-S.vill.length+2));if(n>0){const ts=S.build.find(b=>b.type==='dock'&&b.state==='done');const p=ts?ts.dockTip:S.build[0]?[S.build[0].x,0,S.build[0].z]:[0,0,0];
    for(let i=0;i<n;i++)addVillager(p[0]+rr(-2,2),p[2]+rr(-2,2));log(n+' settlers arrive on the spring ship','good');assignHomes();jobsAssign();}}
  if(S.build.some(b=>b.type==='dock'&&b.state==='done'&&b.workers.length)){S.merchant={days:2};SFX.bell();log('A merchant ship has docked. Open the Trading Dock to trade','good');
    const d=S.build.find(b=>b.type==='dock'&&b.state==='done');if(!merchShip){merchShip=shipModel('merchant');scene.add(merchShip);}merchShip.visible=true;merchShip.position.set(d.dockTip[0]+Math.cos(d.rot)*3,0,d.dockTip[2]-Math.sin(d.rot)*3);merchShip.rotation.y=d.rot-Math.PI/2;}}
let SNOW_TARGET=0;
function updateCrops(b){if(!b.crops)return;const d=b.data,s=S.season,arr=b.crops.instanceMatrix.array,base=b.cropBase;
  const h=s===0?0.15+d.sown*0.25:s===1?0.4+d.grown*0.6:s===2?Math.max(0.05,d.grown*(1-d.harvest)):0.02;
  for(let i=0;i<196;i++){const o=i*16;for(let k=0;k<16;k++)arr[o+k]=base[o+k];arr[o+5]=h*(0.85+hash(i,3)*0.3);}
  b.crops.material.color.set(s===0?'#7fae4f':s===1?(d.grown>0.5?'#c9b54a':'#8fbf55'):'#d9b54a');b.crops.instanceMatrix.needsUpdate=true;}
function checkTitle(){let t='Camp';for(const[n,name]of TITLES)if(S.vill.length>=n)t=name;if(t!==S.title){if(S.title)log('Saltwind is now a '+t.toLowerCase()+'!','goal');S.title=t;buildTiles();}}
function lose(){if(G.mode!=='play')return;G.mode='end';$('endTxt').textContent=`Saltwind lasted ${S.year} year${S.year>1?'s':''} and ${S.day%16} days. The last settlers sailed home.`;$('mEnd').hidden=false;store.set('sw.save',null);}

/* =====================================================================================
   EFFECTS
   ===================================================================================== */
const SMOKE_GEO=new THREE.IcosahedronGeometry(0.35,0),FIRE_GEO=new THREE.ConeGeometry(0.5,1.4,5),ARROW_GEO=new THREE.CylinderGeometry(0.03,0.03,0.9,4).rotateX(Math.PI/2);
function puff(x,y,z,dark){const m=new THREE.Mesh(SMOKE_GEO,M.smoke.clone());m.position.set(x,y,z);m.material.color.set(dark?0x555555:0xdedede);scene.add(m);fx.smoke.push({m,t:0,life:rr(3,4.5),vx:rr(0.2,0.6),vz:rr(-0.2,0.2)});}
function fireArrow(from,to,onHit){const m=new THREE.Mesh(ARROW_GEO,new THREE.MeshStandardMaterial({color:0x5a3e2b}));scene.add(m);fx.arrows.push({m,from,to,t:0,onHit});SFX.arrow();}
const floatLayer=document.createElement('div');floatLayer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:3';document.body.appendChild(floatLayer);
function floatText(x,y,z,txt,res){if(!nearCam({x,z}))return;const el=document.createElement('div');el.innerHTML=(res?ico(res):'')+txt;el.style.cssText='position:absolute;font:600 15px var(--sans);color:#fff6dc;text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.6);display:flex;gap:3px;align-items:center;transition:opacity .4s';
  floatLayer.appendChild(el);fx.float.push({el,x,y:y,z,t:0});}
function nearCam(p){return(p.x-controls.target.x)**2+(p.z-controls.target.z)**2<(camera.position.distanceTo(controls.target)*0.9+20)**2;}
function updateFx(dt){
  for(const s of fx.smoke){s.t+=dt;s.m.position.y+=dt*0.9;s.m.position.x+=s.vx*dt;s.m.position.z+=s.vz*dt;const k=s.t/s.life;s.m.scale.setScalar(0.6+k*2.2);s.m.material.opacity=0.45*(1-k);}
  fx.smoke=fx.smoke.filter(s=>{if(s.t>=s.life){scene.remove(s.m);s.m.material.dispose();return false;}return true;});
  for(const a of fx.arrows){a.t+=dt/0.45;const k=Math.min(1,a.t);a.m.position.set(lerp(a.from[0],a.to[0],k),lerp(a.from[1],a.to[1],k)+Math.sin(k*Math.PI)*2,lerp(a.from[2],a.to[2],k));a.m.lookAt(a.to[0],a.to[1],a.to[2]);
    if(a.t>=1&&!a.hit){a.hit=true;a.onHit&&a.onHit();}}
  fx.arrows=fx.arrows.filter(a=>{if(a.t>=1.15){scene.remove(a.m);return false;}return true;});
  for(const f of fx.float){f.t+=dt;_v.set(f.x,f.y+f.t*1.5,f.z).project(camera);f.el.style.transform=`translate(${(_v.x*0.5+0.5)*innerWidth-10}px,${(-_v.y*0.5+0.5)*innerHeight}px)`;if(f.t>1.3)f.el.style.opacity=0;}
  fx.float=fx.float.filter(f=>{if(f.t>1.8){f.el.remove();return false;}return true;});}
// fires on buildings
const fireMeshes=[];function updateFires(dt){let k=0;for(const b of S.build){if(!b.fire||b.state==='ruin')continue;
  if(!S.raid||S.raid.done){const well=S.build.some(w=>w.type==='well'&&w.state==='done'&&(w.x-b.x)**2+(w.z-b.z)**2<B.well.range**2);b.fire-=dt*(well?0.25:0.08);if(b.fire<=0)b.fire=0;}
  else b.hp-=dt*1.2;if(b.hp<=0&&b.state!=='ruin'){ruin(b);continue;}
  for(let i=0;i<3;i++){let m=fireMeshes[k];if(!m){m=new THREE.Mesh(FIRE_GEO,M.fire);scene.add(m);fireMeshes.push(m);}m.visible=true;m.position.set(b.x+Math.cos(i*2.1)*1.2,b.y+2.2+Math.random()*0.4,b.z+Math.sin(i*2.1)*1.2);m.scale.set(1,0.8+Math.random()*0.6,1);k++;}
  if(Math.random()<dt*6)puff(b.x+rr(-1,1),b.y+3,b.z+rr(-1,1),true);}
  for(;k<fireMeshes.length;k++)fireMeshes[k].visible=false;}

/* =====================================================================================
   PEOPLE RENDERING (instanced)
   ===================================================================================== */
const PEO={};
function buildPeople(){const body=new MB();body.cyl(0.17,0.27,0.66,7,0,0.36,0,'#ffffff');body.box(0.4,0.12,0.3,0,0.12,0,'#ffffff',0,0.04);const bg=body.build().body;
  const head=new THREE.SphereGeometry(0.17,7,5);head.translate(0,0.86,0);const hat=new MB();hat.cyl(0.3,0.3,0.035,9,0,0.98,0,'#ffffff');hat.cyl(0.13,0.16,0.14,8,0,1.06,0,'#ffffff');
  const helm=new MB();helm.sphere(0.2,0,0.95,0,'#ffffff',8,4,0.8);helm.cone(0.05,0.28,5,0.18,1.1,0,'#ffffff');helm.cone(0.05,0.28,5,-0.18,1.1,0,'#ffffff');
  const box=new THREE.BoxGeometry(0.32,0.26,0.32);box.translate(0,1.25,0);
  const mat=c=>new THREE.MeshStandardMaterial({color:c,flatShading:true,roughness:0.8});
  PEO.body=new THREE.InstancedMesh(bg,mat(0xffffff),500);PEO.head=new THREE.InstancedMesh(head,mat(0xe8b98f),500);PEO.hat=new THREE.InstancedMesh(hat.build().body,mat(0xd9c27a),500);
  PEO.helm=new THREE.InstancedMesh(helm.build().body,mat(0x8a8f96),200);PEO.box=new THREE.InstancedMesh(box,mat(0xffffff),500);
  for(const k in PEO){PEO[k].castShadow=true;PEO[k].frustumCulled=false;scene.add(PEO[k]);}}
const RCOL={wood:'#8a5f3d',stone:'#a39e95',planks:'#c79a6a',tools:'#7a8088',fish:'#8fb8c4',berries:'#c0303a',wheat:'#d9b54a',flour:'#efe6d2',bread:'#d49a52',gold:'#e2b84a'};
function drawPeople(t){const q=new THREE.Quaternion(),e=new THREE.Euler(),c=new THREE.Color();let nb=0,nh=0,nhat=0,nbox=0,nhelm=0;
  const put=(p,shirt,helm,hat)=>{const bob=p.moving?Math.abs(Math.sin(t*9+p.bob))*0.12:0,work=p.anim?Math.sin(t*10+p.bob)*0.25:0;const gh=hAt(p.x,p.z);const y=(p.yOff||0)+(gh<0.5?Math.max(gh,0.66):gh)+bob;p.y=y;
    _m.compose(_v.set(p.x,y,p.z),q.setFromEuler(e.set(work*0.5,p.face||0,0)),_s.set(1.3,1.3,1.3));PEO.body.setMatrixAt(nb,_m);PEO.body.setColorAt(nb++,c.set(shirt));PEO.head.setMatrixAt(nh++,_m);
    if(helm)PEO.helm.setMatrixAt(nhelm++,_m);else if(hat)PEO.hat.setMatrixAt(nhat++,_m);
    if(p.carry){PEO.box.setMatrixAt(nbox,_m);PEO.box.setColorAt(nbox++,c.set(typeof p.carry==='number'?'#e2b84a':RCOL[p.carry.r]||'#aaa'));}};
  for(const v of S.vill)put(v,v.militia?'#2f4f7f':SHIRTS[v.shirt],v.militia,v.hat);
  for(const r of S.raiders)put(r,'#7a1f1a',true,false);
  PEO.body.count=nb;PEO.head.count=nh;PEO.hat.count=nhat;PEO.helm.count=nhelm;PEO.box.count=nbox;
  for(const k in PEO){PEO[k].instanceMatrix.needsUpdate=true;if(PEO[k].instanceColor)PEO[k].instanceColor.needsUpdate=true;}}

/* =====================================================================================
   TIME OF DAY / LIGHTING
   ===================================================================================== */
const KEY=[// dayT, top, horizon, sun color, sun intensity, hemi intensity
  [0.00,'#0b1530','#1a2a4a','#8fa8ff',0.25,0.25],[0.20,'#1c2b55','#e58a5a','#ffb07a',0.6,0.4],[0.28,'#5fa8d8','#f6d4a8','#ffd8a8',2.2,0.8],[0.5,'#4f9fdc','#cfe6f0','#fff4e0',2.8,0.95],
  [0.72,'#5aa0d0','#f2cfa0','#ffd09a',2.2,0.8],[0.8,'#2a3a6a','#e8784a','#ff9a5a',0.7,0.45],[0.88,'#0b1530','#1f2c50','#8fa8ff',0.25,0.25],[1.0,'#0b1530','#1a2a4a','#8fa8ff',0.25,0.25]];
const _c1=new THREE.Color(),_c2=new THREE.Color();
function lighting(dayT){let i=0;while(i<KEY.length-2&&KEY[i+1][0]<=dayT)i++;const a=KEY[i],b=KEY[i+1],k=smooth(a[0],b[0],dayT);
  skyU.top.value.copy(_c1.set(a[1])).lerp(_c2.set(b[1]),k);skyU.hor.value.copy(_c1.set(a[2])).lerp(_c2.set(b[2]),k);const sc=new THREE.Color(a[3]).lerp(_c2.set(b[3]),k);
  const ang=(dayT-0.25)*TAU,el=Math.sin(ang),night=clamp(1-smooth(-0.05,0.2,el),0,1);
  const sd=new THREE.Vector3(Math.cos(ang)*0.8,Math.max(0.18,Math.abs(el)),0.45).normalize();if(el<0)sd.x*=-1;
  sun.position.copy(controls.target).addScaledVector(sd,320);sun.target.position.copy(controls.target);sun.color.copy(sc);sun.intensity=lerp(a[4],b[4],k);hemi.intensity=lerp(a[5],b[5],k);
  hemi.color.copy(skyU.top.value).lerp(_c1.set('#ffffff'),0.5);scene.fog.color.copy(skyU.hor.value);skyU.sunDir.value.copy(sd);skyU.sunCol.value.copy(sc);skyU.night.value=night;
  WU.sunDir.value.copy(sd);WU.sunCol.value.copy(sc);WU.sky.value.copy(skyU.hor.value);WU.fogC.value.copy(scene.fog.color);WU.night.value=night;
  M.win.emissiveIntensity=night*2.4+0.05;gradePass.uniforms.night.value=night*0.8;M.cloud.color.set(night>0.5?0x8a94b0:0xffffff).lerp(_c1.set(sc),0.25);
  renderer.toneMappingExposure=lerp(1.0,1.35,night);bloom.strength=0.25+night*0.5;return night;}

/* =====================================================================================
   INPUT — placement & selection
   ===================================================================================== */
let G={mode:'title',place:null,rot:0,hover:null},SEL=null;const mouse={x:0,y:0,on:false};const keys={};
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function groundHit(cx,cy){ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);const o=ray.ray.origin,d=ray.ray.direction;
  let t=0,prevAbove=true;for(let i=0;i<600;i++){const p=_v.copy(o).addScaledVector(d,t);const h=Math.max(hAt(p.x,p.z),-0.2);if(p.y<h){// refine
      let lo=t-0.8,hi=t;for(let k=0;k<10;k++){const m=(lo+hi)/2,pp=o.clone().addScaledVector(d,m);if(pp.y<Math.max(hAt(pp.x,pp.z),-0.2))hi=m;else lo=m;}const hit=o.clone().addScaledVector(d,hi);return hit;}t+=0.8;if(t>900)break;}return null;}
let ghost=null;
function startPlace(type){if(!B[type])return;cancelPlace();select(null);G.place=type;const g=geoFor(type,G.ghostVar=Math.floor(Math.random()*1000));ghost=new THREE.Group();const body=new THREE.Mesh(g.body,M.ghost);ghost.add(body);if(g.extra.sails){const s=new THREE.Mesh(g.extra.sails.geo,M.ghost);s.position.fromArray(g.extra.sails.pos);ghost.add(s);}
  ghost.visible=false;scene.add(ghost);buildTiles();}
function cancelPlace(){if(ghost){scene.remove(ghost);ghost=null;}G.place=null;RING.value.w=0;$('cursorTip').hidden=true;buildTiles();}
function updateGhost(){if(!G.place||!ghost)return;const p=mouse.on?groundHit(mouse.x,mouse.y):null;if(!p){ghost.visible=false;RING.value.w=0;$('cursorTip').hidden=true;return;}
  const x=Math.round(p.x*2)/2,z=Math.round(p.z*2)/2,chk=checkPlace(G.place,x,z,G.rot);G.chk={x,z,...chk};ghost.visible=true;ghost.position.set(x,chk.y,z);ghost.rotation.y=chk.rot;
  for(const ch of ghost.children)ch.material=chk.ok?M.ghost:M.ghostBad;const T=B[G.place];RING.value.set(x,z,T.range||T.fr+0.4,1);RINGC.value.set(chk.ok?'#fff4c8':'#ff9a7a');
  const tip=$('cursorTip');tip.hidden=false;tip.style.left=mouse.x+'px';tip.style.top=mouse.y+'px';
  tip.innerHTML=chk.ok?`<b>${T.name}</b>: click to build${G.place!=='house'?'':' · Shift to keep building'}`:`<b style="color:#a3271f">${chk.probs[0]}</b>`;}
function tryPlace(shift){const c=G.chk;if(!c||!c.ok)return;placeBuilding(G.place,c.x,c.z,c.rot,{y:c.y,var:G.ghostVar});SFX.place();jobsAssign();G.ghostVar=Math.floor(Math.random()*1000);
  if(!shift||!canAfford(B[G.place].cost))cancelPlace();else startPlace(G.place);}
function pickBuilding(cx,cy){ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects(buildingsGroup.children,true);
  for(const h of hits){let o=h.object;while(o&&o.userData.bid===undefined)o=o.parent;if(o)return bById(o.userData.bid);}
  const p=groundHit(cx,cy);if(p){for(const b of S.build)if((b.x-p.x)**2+(b.z-p.z)**2<B[b.type].fr**2)return b;}return null;}
function select(b){SEL=b;if(b){const T=B[b.type];RING2.value.set(b.x,b.z,T.range||T.fr+0.6,1);}else RING2.value.w=0;renderInspector();}
let downAt=null;
canvas.addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.on=true;});
canvas.addEventListener('pointerleave',()=>{mouse.on=false;});
canvas.addEventListener('pointerdown',e=>{AU.init();if(e.button===0)downAt=[e.clientX,e.clientY,performance.now()];if(e.button===2&&G.place){cancelPlace();}});
canvas.addEventListener('pointerup',e=>{if(e.button!==0||!downAt||G.mode!=='play')return;const moved=Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1]);downAt=null;if(moved>6)return;
  mouse.x=e.clientX;mouse.y=e.clientY;mouse.on=true;
  if(G.place){updateGhost();tryPlace(e.shiftKey);return;}const b=pickBuilding(e.clientX,e.clientY);select(b);if(b)SFX.click();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(G.place&&e.shiftKey){G.rot+=Math.sign(e.deltaY)*Math.PI/8;e.preventDefault();}},{passive:false});
window.addEventListener('keydown',e=>{const k=e.code;keys[k]=true;AU.init();
  if(G.mode==='title')return;
  if(k==='Escape'){if(!$('mTrade').hidden||!$('mLedger').hidden||!$('mGuide').hidden){closeModals();return;}if(G.place){cancelPlace();return;}if(SEL){select(null);return;}togglePause();return;}
  if(G.mode!=='play')return;
  if(k==='KeyR'&&G.place){G.rot+=Math.PI/4;}
  if(k==='Space'){e.preventDefault();setSpeed(S.speed===0?(G.lastSpeed||1):0);}
  if(k==='Digit1')setSpeed(1);if(k==='Digit2')setSpeed(2);if(k==='Digit3')setSpeed(4);
  if(k==='KeyL'){openLedger();}
});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});

/* =====================================================================================
   UI
   ===================================================================================== */
let curCat='homes';
function buildTabs(){$('tabs').innerHTML=CATS.map(([k,n])=>`<button class="brassBtn ${k===curCat?'on':''}" data-cat="${k}">${n}</button>`).join('');}
$('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;curCat=b.dataset.cat;SFX.click();buildTabs();buildTiles();});
const THUMB={};
function buildTiles(){if(!S)return;const list=Object.entries(B).filter(([k,T])=>T.cat===curCat);let i=0;
  $('tiles').innerHTML=list.map(([k,T])=>{const locked=S.vill.length<(T.pop||0);i++;return`<button class="tile ${G.place===k?'on':''}" data-b="${k}" ${locked?'aria-disabled="true"':''}><img alt="" src="${THUMB[k]||''}"><div class="n">${T.name}</div>${locked?`<div class="lock">${T.pop} settlers</div>`:''}</button>`;}).join('');}
$('tiles').addEventListener('click',e=>{const t=e.target.closest('[data-b]');if(!t)return;const k=t.dataset.b;if(S.vill.length<(B[k].pop||0)){SFX.click();return;}SFX.click();if(G.place===k)cancelPlace();else startPlace(k);});
$('tiles').addEventListener('pointerover',e=>{const t=e.target.closest('[data-b]');if(!t)return;showTip(t.dataset.b,t);});
$('tiles').addEventListener('pointerout',e=>{if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('[data-b]'))$('tip').hidden=true;});
function showTip(k,el){const T=B[k],tip=$('tip'),r=el.getBoundingClientRect();const locked=S.vill.length<(T.pop||0);
  tip.innerHTML=`<div class="sub">${CATS.find(c=>c[0]===T.cat)[1]}${T.w?` · ${T.w} worker${T.w>1?'s':''}`:''}${T.beds?` · ${T.beds} beds`:''}</div><h3>${T.name}</h3><p>${T.desc}</p>${T.chain?`<div class="chain">${T.chain}</div>`:''}
  <div class="costs">${Object.entries(T.cost).map(([r,n])=>`<span class="${(S.stock[r]||0)<n?'no':''}">${ico(r)}${n}</span>`).join('')}</div>${locked?`<p style="color:#a3271f;margin-bottom:0">Unlocks at ${T.pop} settlers</p>`:''}`;
  tip.hidden=false;const tw=270;tip.style.left=clamp(r.left+r.width/2-tw/2,8,innerWidth-tw-8)+'px';tip.style.top=(r.top-tip.offsetHeight-10)+'px';}
function renderRes(){const el=$('res');const show=['wood','stone','planks','tools','|','fish','berries','wheat','flour','bread','|','gold'];
  el.innerHTML=show.map(k=>k==='|'?'<span class="rs sep"></span>':`<span class="rs" data-r="${k}" title="${RNAME[k]}">${ico(k)}<b id="r_${k}">0</b><span class="d" id="d_${k}"></span></span>`).join('');}
const hudC={};function setH(id,v){if(hudC[id]!==v){hudC[id]=v;const e=$(id);if(e)e.textContent=v;}}
function updHud(){if(!S)return;for(const k of RES){setH('r_'+k,String(Math.floor(S.stock[k]||0)));const d=S.deltaY[k]||0;const e=$('d_'+k);const s=d?(d>0?'+':'')+Math.round(d):'';if(e&&hudC['d'+k]!==s){hudC['d'+k]=s;e.textContent=s;e.className='d '+(d>0?'up':'dn');}}
  if(hudC.popN!==S.vill.length){hudC.popN=S.vill.length;buildTiles();}
  setH('popTxt',S.vill.length+' settlers');setH('homeTxt',beds()+' beds');setH('townTitle',S.title||'Camp');setH('calWhen',SEASONS[S.season]);setH('calSub','Day '+(S.day%SEASON_DAYS+1)+' · Year '+S.year);
  const h=Math.round(S.happy);if(hudC.happy!==h){hudC.happy=h;$('happyNum').textContent=h;$('happyArc').setAttribute('stroke-dashoffset',String(144.5*(1-h/100)));$('happyArc').setAttribute('stroke',h>65?'#9fcf7a':h>40?'#cfa856':'#ef8f74');}
  const g=GOALS[S.goal];if(g){const v=Math.min(g.n,g.f());setH('goalTxt',g.t);$('goalBar').style.width=(v/g.n*100)+'%';if(v>=g.n){S.goal++;SFX.goal();log('Charter fulfilled: '+g.t,'goal');addStock('gold',15);}}
  else setH('goalTxt','The charter is complete. Saltwind thrives.');
  drawDial();}
function drawDial(){const c=$('dial').getContext('2d'),w=116,r=50,dayT=(S.time%DAY)/DAY,sp=(S.day%SEASON_DAYS+dayT)/SEASON_DAYS;c.clearRect(0,0,w,w);c.save();c.translate(58,58);
  const sc=['#8fbf63','#e2b84a','#d9783a','#b9d4e8'];for(let i=0;i<4;i++){c.beginPath();c.arc(0,0,r,-Math.PI/2+i*Math.PI/2+0.04,-Math.PI/2+(i+1)*Math.PI/2-0.04);c.strokeStyle=sc[i];c.globalAlpha=i===S.season?1:0.35;c.lineWidth=7;c.stroke();}c.globalAlpha=1;
  const a=-Math.PI/2+(S.season+sp)*Math.PI/2;c.beginPath();c.arc(Math.cos(a)*r,Math.sin(a)*r,5,0,TAU);c.fillStyle='#f3dc9a';c.fill();c.strokeStyle='#000';c.lineWidth=1;c.stroke();
  const night=skyU.night.value;const g=c.createRadialGradient(0,0,4,0,0,38);g.addColorStop(0,night>0.5?'#1a2a4a':'#f6d79a');g.addColorStop(1,night>0.5?'#0b1530':'#cf8f4a');c.beginPath();c.arc(0,0,38,0,TAU);c.fillStyle=g;c.fill();
  c.strokeStyle='#8f6e2c';c.lineWidth=2;c.stroke();const ha=dayT*TAU+Math.PI/2;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(ha)*30,Math.sin(ha)*30);c.strokeStyle='#2b2016';c.lineWidth=3;c.lineCap='round';c.stroke();
  c.beginPath();c.arc(Math.cos(ha)*30,Math.sin(ha)*30,6,0,TAU);c.fillStyle=night>0.5?'#e8eef8':'#ffd36b';c.fill();c.restore();}
function renderInspector(){const el=$('insp');if(!SEL||!S.build.includes(SEL)){el.hidden=true;return;}const b=SEL,T=B[b.type];el.hidden=false;
  let body='';
  if(b.state==='site'){const tot=Object.values(T.cost).reduce((a,c)=>a+c,0)-(T.cost.gold||0),rem=remaining(b);body+=`<div class="st">Under construction</div><div class="row"><span>Materials</span><b>${tot-rem}/${tot}</b></div><div class="bar"><i style="width:${(1-rem/Math.max(1,tot))*100}%"></i></div><div class="row"><span>Building</span><b>${Math.round(b.progress*100)}%</b></div><div class="bar"><i style="width:${b.progress*100}%"></i></div>`;
    body+=`<div style="font:14px var(--sans);color:rgba(239,226,196,.7)">${S.vill.filter(v=>!v.job).length?'Labourers are on their way.':'Every settler has a post. Free one up to build.'}</div><button class="brassBtn" data-act="demolish">Cancel and refund</button>`;}
  else{if(T.desc)body+=`<div style="font:14px/1.4 var(--sans);color:rgba(239,226,196,.8)">${T.desc}</div>`;
    if(b.fire)body+=`<div class="st warn">On fire!</div>`;else if(b.hp<100)body+=`<div class="st warn">Damaged · ${Math.round(b.hp)}%</div>`;
    if(T.w){body+=`<div class="st ${/Waiting|No |rest|Nothing/.test(b.status)?'warn':''}">${b.workers.length?b.status||'Working':'No workers assigned'}</div>`;
      body+=`<div class="row"><span>${b.type==='barracks'?'Militia':'Workers'}</span><span class="dots">${Array.from({length:T.w},(_,i)=>`<i class="${i<b.workers.length?'on':i<b.want?'want':''}"></i>`).join('')}</span><span><button class="brassBtn mini" data-act="w-">−</button> <button class="brassBtn mini" data-act="w+">+</button></span></div>`;}
    if(T.job&&T.job.in)body+=`<div class="io">${Object.entries(T.job.in).map(([r,n])=>ico(r)+n).join(' + ')} <span style="color:var(--brass)">→</span> ${Object.entries(T.job.out).map(([r,n])=>ico(r)+n).join(' ')}</div>`;
    else if(T.job&&T.job.out)body+=`<div class="io"><span style="color:var(--brass)">Yields</span> ${Object.entries(T.job.out).map(([r,n])=>ico(r)+n).join(' ')} <span style="font-weight:400;color:rgba(239,226,196,.6)">per trip</span></div>`;
    if(T.beds){const res=S.vill.filter(v=>v.home===b.id).length;body+=`<div class="row"><span>Residents</span><b>${res}/${T.beds}</b></div>`;}
    if(b.type==='farm')body+=`<div class="row"><span>Field</span><b>${S.season===0?'Sown '+Math.round(b.data.sown*100)+'%':S.season===1?'Growing':S.season===2?'Harvested '+Math.round(b.data.harvest*100)+'%':'Resting'}</b></div>`;
    if(b.type==='dock')body+=S.merchant?`<button class="brassBtn" data-act="trade">Trade with the merchant</button>`:`<div style="font:14px var(--sans);color:rgba(239,226,196,.7)">Next merchant: start of ${SEASONS[(S.season+1)%4]}${b.workers.length?'':'. Needs a dockhand to trade'}</div>`;
    if(b.type!=='townhall')body+=`<button class="brassBtn" data-act="demolish" style="align-self:flex-start;font-size:14px">Demolish</button>`;}
  el.innerHTML=`<div class="hd"><div><h2>${T.name}</h2><div class="ty">${b.state==='site'?'Building site':(CATS.find(c=>c[0]===T.cat)||['','Settlement'])[1]}</div></div><button class="x" data-act="close" aria-label="Close">×</button></div><div class="rule" style="margin:0 16px 8px"></div><div class="bd">${body}</div>`;}
$('insp').addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a||!SEL)return;const act=a.dataset.act;SFX.click();
  if(act==='close')select(null);else if(act==='w+'){SEL.want=Math.min(B[SEL.type].w,SEL.want+1);jobsAssign();}else if(act==='w-'){SEL.want=Math.max(0,SEL.want-1);jobsAssign();}
  else if(act==='demolish'){if(a.dataset.sure){demolish(SEL);return;}a.dataset.sure='1';a.textContent='Click again to confirm';return;}else if(act==='trade')openTrade();
  if(SEL&&SEL.type==='barracks'){for(const v of S.vill)v.militia=v.job===SEL.id;}renderInspector();});
function log(txt,kind){const el=document.createElement('div');el.className='lg parch';el.innerHTML=(kind==='raid'||kind==='bad'?'<b>✦</b>':'')+txt;const L=$('log');L.prepend(el);while(L.children.length>6)L.lastChild.remove();
  setTimeout(()=>{el.classList.add('fade');setTimeout(()=>el.remove(),1300);},9000);}
function banner(a,b){const el=$('banner');$('banA').textContent=a;$('banB').textContent=b;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function setSpeed(s){if(S.speed)G.lastSpeed=S.speed;S.speed=s;for(const b of document.querySelectorAll('#speeds .brassBtn'))b.classList.toggle('on',+b.dataset.s===s);}
$('speeds').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(b){SFX.click();setSpeed(+b.dataset.s);}});
function openLedger(){const pop=S.vill.length,jobs={};for(const v of S.vill){const b=v.job?bById(v.job):null;const n=v.militia?'Militia':b?B[b.type].name:'Labourers';jobs[n]=(jobs[n]||0)+1;}
  const f=S.factors||{},names={base:'Island life',food:'Food & variety',homes:'Homes',warmth:'Warmth',faith:'Faith',tavern:'The tavern',water:'Fresh water',garden:'Gardens',light:'The lighthouse',safety:'Safety'};
  $('ldTitle').textContent='Saltwind · '+(S.title||'Camp');
  $('ldCols').innerHTML=`<div class="leaf parch"><h4>Stores</h4>${RES.map(k=>`<div class="ln"><span>${ico(k)} ${RNAME[k]}</span><b>${Math.floor(S.stock[k])} <span class="${(S.deltaY[k]||0)>=0?'pos':'neg'}" style="font-weight:400">${S.deltaY[k]?((S.deltaY[k]>0?'+':'')+Math.round(S.deltaY[k])):''}</span></b></div>`).join('')}<div style="font-size:13px;margin-top:6px;opacity:.75">Change over the last day</div></div>
  <div class="leaf parch"><h4>People · ${pop}</h4>${Object.entries(jobs).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div class="ln"><span>${k}</span><b>${n}</b></div>`).join('')}<div class="ln"><span>Beds</span><b>${beds()}</b></div><div class="ln"><span>Food lasts</span><b>${Math.floor((S.stock.fish+S.stock.berries+S.stock.bread)/Math.max(1,pop))} days</b></div></div>
  <div class="leaf parch"><h4>Happiness · ${Math.round(S.happy)}</h4>${Object.entries(f).map(([k,v])=>`<div class="ln"><span>${names[k]||k}</span><b class="${v>0?'pos':v<0?'neg':''}">${v>0?'+':''}${v}</b></div>`).join('')}<div style="font-size:13px;margin-top:6px;opacity:.75">Above 70 work goes faster. Below 30 it slows and no one new arrives.</div></div>`;
  $('mLedger').hidden=false;}
let trade={};
function openTrade(){if(!S.merchant)return;trade={};renderTrade();$('mTrade').hidden=false;}
function renderTrade(){const rows=Object.keys(PRICE);let gold=S.stock.gold;for(const k in trade){const q=trade[k];gold+=q<0?Math.floor(-q*PRICE[k]):-Math.ceil(q*PRICE[k]*1.6);}
  $('tradeRows').innerHTML='<span class="h">Goods</span><span class="h">Sells at</span><span class="h">Buys at</span><span class="h" style="text-align:right">Your order</span>'+rows.map(k=>`<span>${ico(k)} ${RNAME[k]} <span style="opacity:.6">(${Math.floor(S.stock[k])})</span></span><span>${Math.ceil(PRICE[k]*1.6)}</span><span>${PRICE[k]}</span><span class="q"><button class="brassBtn mini" data-t="${k}" data-d="-10">Sell 10</button><b class="${(trade[k]||0)>0?'pos':(trade[k]||0)<0?'neg':''}">${(trade[k]||0)>0?'+':''}${trade[k]||0}</b><button class="brassBtn mini" data-t="${k}" data-d="10">Buy 10</button></span>`).join('');
  $('tradeSum').textContent='Gold after trade: '+gold;$('tradeSum').style.color=gold<0?'#ef8f74':'';$('tDeal').disabled=gold<0;G.tradeGold=gold;}
$('tradeRows').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b)return;const k=b.dataset.t,d=+b.dataset.d;const nq=(trade[k]||0)+d;if(nq<0&&-nq>S.stock[k])return;trade[k]=nq;SFX.click();renderTrade();});
$('tDeal').addEventListener('click',()=>{if(G.tradeGold<0)return;for(const k in trade){if(trade[k]<0)take(k,-trade[k]);else if(trade[k]>0)addStock(k,trade[k]);}S.stock.gold=G.tradeGold;SFX.coins();log('A fair trade with the merchant','good');trade={};closeModals();});
function closeModals(){for(const id of['mTrade','mLedger','mGuide'])$(id).hidden=true;}
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>{SFX.click();closeModals();});
function togglePause(){if(G.mode==='play'){G.mode='pause';G.wasSpeed=S.speed;setSpeed(0);$('mPause').hidden=false;refreshMenu();}else if(G.mode==='pause'){G.mode='play';$('mPause').hidden=true;setSpeed(G.wasSpeed||1);}}
function refreshMenu(){const s='Sound: '+(AU.muted?'off':'on');$('bSound').textContent=s;$('pSound').textContent=s;$('pGfx').textContent='Graphics: '+QUALITY;}

/* =====================================================================================
   SAVE / LOAD
   ===================================================================================== */
function save(){if(!S)return false;const data={v:1,seed:S.seed,diff:S.diff,time:S.time,day:S.day,season:S.season,year:S.year,stock:S.stock,happy:S.happy,goal:S.goal,stats:S.stats,nextRaid:S.nextRaid,nextId:S.nextId,title:S.title,
  build:S.build.filter(b=>b.state!=='ruin').map(b=>({id:b.id,type:b.type,x:b.x,z:b.z,rot:b.rot,y:b.y,var:b.var,state:b.state,progress:b.progress,toCarry:b.toCarry,carried:b.carried,hp:b.hp,want:b.want,data:b.data})),
  vill:S.vill.map(v=>({x:v.x,z:v.z,shirt:v.shirt,hat:v.hat,job:v.job,militia:!!v.militia})),
  trees:W.trees.map(t=>[Math.round(t.x*10),Math.round(t.z*10),Math.round(t.g*100),t.alive?1:0,t.pine?1:0]).filter(t=>t[3])};
  const ok=store.set('sw.save',data);if(ok)log('The settlement has been recorded in the log','good');return ok;}
function load(){const d=store.get('sw.save',null);if(!d)return false;startGame(d.seed,d.diff,d);return true;}

/* =====================================================================================
   GAME FLOW
   ===================================================================================== */
function resetScene(){for(const b of(S?S.build:[]))if(b.mesh)buildingsGroup.remove(b.mesh);for(const s of fx.smoke)scene.remove(s.m);fx.smoke=[];for(const f of fx.float)f.el.remove();fx.float=[];
  if(raidShip)raidShip.visible=false;if(merchShip)merchShip.visible=false;}
function islandSpot(){// a pleasant flat meadow near the middle for the town hall
  let best=null,bs=-1e9;for(let k=0;k<500;k++){const x=rr(-45,45),z=rr(-45,45);let hmin=1e9,hmax=-1e9;for(let a=0;a<8;a++){const h=hAt(x+Math.cos(a)*5,z+Math.sin(a)*5);hmin=Math.min(hmin,h);hmax=Math.max(hmax,h);}
    if(hmin<1.2)continue;let shoreD=1e9;for(const p of W.shore)shoreD=Math.min(shoreD,Math.hypot(p[0]-x,p[1]-z));const score=-(hmax-hmin)*4-Math.abs(shoreD-26)*0.3-Math.hypot(x,z)*0.05;if(score>bs){bs=score;best=[x,z];}}return best||[0,0];}
function startGame(seed,diff,saved){resetScene();S=newState(seed,diff);genWorld(seed);buildTerrain();buildNature();buildWalk();PCACHE.clear();buildAmbient();
  if(saved){Object.assign(S,{time:saved.time,day:saved.day,season:saved.season,year:saved.year,stock:saved.stock,happy:saved.happy,happyT:saved.happy,goal:saved.goal,stats:saved.stats,nextRaid:saved.nextRaid,title:saved.title});
    const alive=new Set(saved.trees.map(t=>t[0]+','+t[1]));W.trees=W.trees.filter(t=>alive.has(Math.round(t.x*10)+','+Math.round(t.z*10)));
    for(const t of saved.trees){const k=t[0]+','+t[1];if(!W.trees.some(q=>Math.round(q.x*10)+','+Math.round(q.z*10)===k))W.trees.push({x:t[0]/10,z:t[1]/10,g:t[2]/100,s:1,pine:!!t[4],alive:true,res:false,fall:0,rot:rr(0,TAU),tint:rng()});else{const q=W.trees.find(q=>Math.round(q.x*10)+','+Math.round(q.z*10)===k);q.g=t[2]/100;}}
    for(const sb of saved.build){const b=placeBuilding(sb.type,sb.x,sb.z,sb.rot,{y:sb.y,var:sb.var,done:sb.state!=='site',free:true});Object.assign(b,{id:sb.id,progress:sb.progress,toCarry:sb.toCarry||{},carried:sb.carried||{},hp:sb.hp,want:sb.want,data:sb.data||b.data});b.mesh.userData.bid=b.id;updateBuildVisual(b);if(b.type==='farm')updateCrops(b);}
    S.nextId=saved.nextId;for(const sv of saved.vill){const v=addVillager(sv.x,sv.z);v.shirt=sv.shirt;v.hat=sv.hat;v.militia=sv.militia;}refreshTrees(true);}
  else{const[x,z]=islandSpot();clearNatureAt(x,z,13);placeBuilding('townhall',x,z,rr(0,TAU),{done:true,y:hAt(x,z)});for(let i=0;i<8;i++)addVillager(x+rr(-4,4),z+5+rr(0,3));
    const p=checkPlace('house',x+9,z,0);if(p.ok){placeBuilding('house',x+9,z,0,{done:true,y:p.y});}}
  S.title=null;checkTitle();assignHomes();jobsAssign();computeHappy();S.happy=S.happyT;SNOW_TARGET=S.season===3?1:0;SNOW.value=SNOW_TARGET;MUS.season=S.season;
  const th=S.build.find(b=>b.type==='townhall');controls.target.set(th.x,th.y,th.z);camera.position.set(th.x+32,th.y+34,th.z+38);
  G.mode='play';$('title').hidden=true;$('hud').hidden=false;$('mEnd').hidden=true;$('mPause').hidden=true;renderRes();buildTabs();buildTiles();setSpeed(1);select(null);for(const k in hudC)delete hudC[k];
  log(saved?'The voyage continues':'Landfall on a new island. Raise a woodcutter first','good');}
function toTitle(){G.mode='title';$('hud').hidden=true;$('title').hidden=false;$('mPause').hidden=true;$('mEnd').hidden=true;cancelPlace();select(null);
  $('bContinue').hidden=!store.get('sw.save',null);refreshMenu();}

/* =====================================================================================
   THUMBNAILS for the build bar (rendered once with the same materials & light)
   ===================================================================================== */
function makeThumbs(){const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(152,124);r.toneMapping=THREE.ACESFilmicToneMapping;
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xdfefff,0x6a5a3a,1.1));const dl=new THREE.DirectionalLight(0xfff0d8,2.4);dl.position.set(5,9,7);sc.add(dl);
  const cam=new THREE.PerspectiveCamera(30,152/124,0.1,200);
  for(const k in B){if(k==='townhall')continue;const g=geoFor(k,3);const grp=new THREE.Group();grp.add(new THREE.Mesh(g.body,M.build));if(g.win)grp.add(new THREE.Mesh(g.win,new THREE.MeshStandardMaterial({color:0x7aa8c0,roughness:0.2})));
    if(g.extra.sails){const s=new THREE.Mesh(g.extra.sails.geo,M.build);s.position.fromArray(g.extra.sails.pos);grp.add(s);}sc.add(grp);
    const bs=new THREE.Box3().setFromObject(grp),ctr=bs.getCenter(new THREE.Vector3()),sz=bs.getSize(new THREE.Vector3()).length();cam.position.set(ctr.x+sz*0.85,ctr.y+sz*0.62,ctr.z+sz*1.05);cam.lookAt(ctr);
    r.render(sc,cam);THUMB[k]=r.domElement.toDataURL();sc.remove(grp);}
  r.dispose();}

/* =====================================================================================
   MAIN LOOP
   ===================================================================================== */
let last=performance.now(),acc=0,frames=0,fpsT=0,ambT=0;
function frame(now){requestAnimationFrame(frame);let dt=Math.min(0.05,(now-last)/1000);last=now;fpsT+=dt;frames++;if(fpsT>1){$('fps').textContent=Math.round(frames/fpsT)+' fps';fpsT=0;frames=0;}
  const playing=G.mode==='play'&&S;const sp=playing?S.speed:G.mode==='title'?1:0;const gdt=dt*sp;
  // camera keys
  if(playing){const f=new THREE.Vector3().subVectors(controls.target,camera.position).setY(0).normalize(),r=new THREE.Vector3(-f.z,0,f.x),pan=dt*camera.position.distanceTo(controls.target)*0.8;let mx=0,mz=0;
    if(keys.KeyW||keys.ArrowUp)mz+=1;if(keys.KeyS||keys.ArrowDown)mz-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;
    if(keys.KeyQ||keys.KeyE){const a=(keys.KeyQ?1:-1)*dt*1.4,o=new THREE.Vector3().subVectors(camera.position,controls.target);o.applyAxisAngle(new THREE.Vector3(0,1,0),a);camera.position.copy(controls.target).add(o);}
    if(mx||mz){const d=f.multiplyScalar(mz*pan).add(r.multiplyScalar(mx*pan));controls.target.add(d);camera.position.add(d);}
    controls.target.x=clamp(controls.target.x,-115,115);controls.target.z=clamp(controls.target.z,-115,115);controls.target.y=lerp(controls.target.y,Math.max(0,hAt(controls.target.x,controls.target.z)),0.1);}
  if(G.mode==='title'){const a=now*0.00003,th=S&&S.build[0]?S.build[0]:{x:0,z:0,y:2},side=innerWidth>900?1:0,ox=Math.cos(a+1.9)*16*side,oz=Math.sin(a+1.9)*16*side;controls.target.set(th.x*0.5+ox,2,th.z*0.5+oz);camera.position.set(th.x*0.4+Math.cos(a)*165,108,th.z*0.4+Math.sin(a)*165);}
  controls.update();
  if(S){// simulation
    if(gdt>0){const steps=Math.ceil(gdt/0.05),h=gdt/steps;for(let i=0;i<steps;i++)simStep(h);}
    // visuals that run in real time
    const dayT=(S.time%DAY)/DAY,night=lighting(dayT);SNOW.value=lerp(SNOW.value,SNOW_TARGET,dt*0.4);
    WU.t.value+=dt;WU.camPos.value.copy(camera.position);const cell=1400/220;water.position.x=Math.round(camera.position.x/cell)*cell;water.position.z=Math.round(camera.position.z/cell)*cell;
    for(const b of S.build){if(b.sails&&b.state==='done')b.sails.rotation.z-=dt*0.9*(sp?1:0.2);if(b.beam){b.beam.visible=night>0.3&&b.state==='done';b.beam.rotation.y+=dt*0.8;}
      if(b.pop>0){b.pop-=dt;const k=b.pop/0.5;b.mesh.scale.set(1+Math.sin(k*Math.PI)*0.06,1+Math.sin(k*Math.PI)*0.1,1+Math.sin(k*Math.PI)*0.06);if(b.pop<=0)b.mesh.scale.set(1,1,1);}
      if(b.chimney&&b.state==='done'&&Math.random()<dt*(S.season===3||night>0.5?1.4:0.5)&&fx.smoke.length<90&&nearCam({x:b.x,z:b.z}))puff(b.chimney[0],b.chimney[1],b.chimney[2]);}
    // falling trees
    let fell=false;for(const t of W.trees)if(t.fall>0){t.fall-=dt*0.9;fell=true;if(t.fall<=0)t.fall=0;}if(fell)refreshTrees(false);
    for(const c of AMB.clouds){c.position.x+=dt*c.userData.v;if(c.position.x>300)c.position.x=-300;}
    for(const g of AMB.gulls){const a=now*0.001*g.sp+g.ph;g.m.position.set(Math.cos(a)*g.r,g.h+Math.sin(a*3)*1.5,Math.sin(a)*g.r);g.m.rotation.set(0,-a+(g.sp>0?0:Math.PI),Math.sin(now*0.012+g.ph)*0.5);g.m.visible=night<0.6;}
    if(merchShip&&merchShip.visible){merchShip.position.y=Math.sin(now*0.0015)*0.15-0.1;merchShip.rotation.z=Math.sin(now*0.001)*0.03;}
    if(raidShip&&raidShip.visible){raidShip.position.y=Math.sin(now*0.0017)*0.2-0.1;}
    updateFx(dt);updateFires(gdt);drawPeople(now*0.001);updateGhost();
    ambT-=dt;if(ambT<=0&&AU.c){ambT=rr(2,6);if(night<0.4){if(Math.random()<0.6)SFX.bird();else SFX.gull();}else SFX.cricket();}
    AU.ambient(0.05+0.03*clamp(camera.position.y/120,0,1),S.season===3?0.035:0.015);
    if(G.mode==='play'){updHud();if(SEL&&Math.random()<dt*3)renderInspector();}}
  composer.render();}
let jobT=0;
function simStep(h){const prevDay=Math.floor(S.time/DAY);S.time+=h;S.happy=lerp(S.happy,S.happyT,h*0.15);
  for(const v of S.vill.slice())villagerTick(v,h);
  raidUpdate(h);towersUpdate(h);
  if(S.merchant){S.merchant.t=(S.merchant.t||0)+h;if(S.merchant.t>DAY*2){S.merchant=null;if(merchShip)merchShip.visible=false;log('The merchant ship sets sail','');}}
  jobT-=h;if(jobT<=0){jobT=2;jobsAssign();for(const b of S.build)if(b.type==='barracks')for(const v of S.vill)v.militia=v.job===b.id;}
  if(Math.floor(S.time/DAY)>prevDay)newDay();}

/* =====================================================================================
   BOOT
   ===================================================================================== */
let tSeed=Math.floor(Math.random()*99999),tDiff='normal';
$('seedIn').value=tSeed;
$('bNew').addEventListener('click',()=>{SFX.click();$('newOpts').hidden=!$('newOpts').hidden;});
$('bReroll').addEventListener('click',()=>{SFX.click();tSeed=Math.floor(Math.random()*99999);$('seedIn').value=tSeed;previewIsland(tSeed);});
$('seedIn').addEventListener('change',()=>{tSeed=parseInt($('seedIn').value,10)||1;previewIsland(tSeed);});
$('diffSeg').addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(!b)return;tDiff=b.dataset.d;for(const x of $('diffSeg').children)x.classList.toggle('on',x===b);SFX.click();});
$('bStart').addEventListener('click',()=>{AU.init();SFX.done();startGame(tSeed,tDiff);});
$('bContinue').addEventListener('click',()=>{AU.init();load();});
$('bGuide').addEventListener('click',()=>{SFX.click();$('mGuide').hidden=false;});$('pGuide').addEventListener('click',()=>{$('mGuide').hidden=false;});
$('bSound').addEventListener('click',()=>{AU.init();AU.setMuted(!AU.muted);refreshMenu();});$('pSound').addEventListener('click',()=>{AU.setMuted(!AU.muted);refreshMenu();});
$('pResume').addEventListener('click',togglePause);$('pSave').addEventListener('click',()=>{save();SFX.done();});$('pQuit').addEventListener('click',()=>{save();toTitle();previewIsland(tSeed);});
$('pGfx').addEventListener('click',()=>{QUALITY=QUALITY==='high'?'low':'high';store.set('sw.gfx',QUALITY);setupAO();refreshMenu();});
$('eTitle').addEventListener('click',()=>{toTitle();previewIsland(tSeed);});
window.addEventListener('beforeunload',()=>{if(G.mode==='play'||G.mode==='pause')save();});
setInterval(()=>{if(G.mode==='play'&&S)save();},90000);
function previewIsland(seed){// title backdrop: generate the chart and a little hamlet for flavour
  resetScene();S=newState(seed,'peaceful');genWorld(seed);buildTerrain();buildNature();buildWalk();PCACHE.clear();buildAmbient();
  const[x,z]=islandSpot();placeBuilding('townhall',x,z,0.5,{done:true,y:hAt(x,z)});
  const extra=[['house',8,2],['house',-7,5],['woodcutter',4,-9],['house',2,9],['well',-3,-6]];for(const[t,dx,dz]of extra){const p=checkPlace(t,x+dx,z+dz,rr(0,TAU));if(p.ok||p.probs.every(q=>q==='Not enough materials'))placeBuilding(t,x+dx,z+dz,p.rot,{done:true,y:p.y,free:true});}
  for(let i=0;i<10;i++)addVillager(x+rr(-6,6),z+rr(-6,6));assignHomes();S.speed=1;}
resize();setupAO();
try{makeThumbs();}catch(e){console.warn('thumbs',e);}
buildPeople();buildWater();previewIsland(tSeed);toTitle();
requestAnimationFrame(t=>{last=t;frame(t);});
window.SW_DEBUG={scene,GEO,MODEL,simStep:h=>simStep(h),jobsAssign,get S(){return S;},get W(){return W;},startGame,save,load,placeBuilding,checkPlace,startRaid,setSpeed,newDay,B,camera,controls,select};
