/*═══════ GL CORE ═══════════════════════════════════════════════════════════
  Everything renders through ONE instanced pipeline. A "Mesh" is uploaded once;
  thousands of copies are drawn per frame from a per-instance stream of
  32 bytes (pos+yaw, scale+emissive, tint+flags). No per-object draw calls.
═══════════════════════════════════════════════════════════════════════════*/
const cv=document.getElementById('cv');
const gl=cv.getContext('webgl2',{antialias:false,alpha:false,depth:true,stencil:false,
  powerPreference:'high-performance',desynchronized:true});
if(!gl){document.getElementById('lt').textContent='WebGL2 unsupported';throw new Error('no webgl2');}
const EXT_F16=gl.getExtension('EXT_color_buffer_float')||gl.getExtension('EXT_color_buffer_half_float');
gl.getExtension('OES_texture_float_linear');
const HDR_FMT=EXT_F16?gl.RGBA16F:gl.RGBA8, HDR_TYPE=EXT_F16?gl.HALF_FLOAT:gl.UNSIGNED_BYTE;

function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)+'\n'+
    src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));return s;}
function prog(vs,fs,attrs){const p=gl.createProgram();
  gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
  if(attrs)for(const k in attrs)gl.bindAttribLocation(p,attrs[k],k);
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
  p.u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i);const nm=info.name.replace(/\[0\]$/,'');
    p.u[nm]=gl.getUniformLocation(p,nm);}
  return p;}

const V_COMMON=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;   // rgb + baked AO
layout(location=3) in vec4 aMat;   // emissive, roughness, metallic, windowMask
layout(location=4) in vec4 aIPos;  // x,y,z, yaw
layout(location=5) in vec4 aIScl;  // sx,sy,sz, emissiveBoost
layout(location=6) in vec4 aITint; // tint rgb, flags
`;

//──── main forward shader ───────────────────────────────────────────────────
const MAIN_VS=V_COMMON+`
uniform mat4 uVP, uLightVP;
uniform float uTime;
out vec3 vW, vN, vC; out vec4 vM; out vec4 vLp; out float vAO, vEmB, vFlag;
void main(){
  float c=cos(aIPos.w), s=sin(aIPos.w);
  mat3 R=mat3(c,0.,-s, 0.,1.,0., s,0.,c);
  vec3 p=R*(aPos*aIScl.xyz)+aIPos.xyz;
  vec3 n=normalize(R*(aNrm/max(aIScl.xyz,vec3(1e-4))));
  vW=p; vN=n; vAO=aCol.a; vM=aMat; vEmB=aIScl.w; vFlag=aITint.a;
  vec3 tint=aITint.rgb*2.0;                 // 0.5 = neutral, allows dark & bright tints
  // authored colours are sRGB; lighting must happen in linear space or every
  // surface washes out to pastel.
  vC=pow(aCol.rgb*tint,vec3(2.2));
  vLp=uLightVP*vec4(p+n*0.06,1.0);
  gl_Position=uVP*vec4(p,1.0);
}`;

const MAIN_FS=`#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vW, vN, vC; in vec4 vM, vLp; in float vAO, vEmB, vFlag;
uniform vec3 uEye, uSunDir, uSunCol, uSkyCol, uGndCol, uFogCol;
uniform float uFogD, uNight, uTime;
vec3 lin(vec3 c){return c*c*(c*0.305+0.682)+c*0.013;}   // fast sRGB→linear
float h21(vec2 p){p=fract(p*vec2(127.31,311.7));p+=dot(p,p+37.71);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
/* Procedural surface detail. There are no image textures in this build, so
   every material earns its grain here: ground mottle, roof shingle courses,
   clapboard/brick coursing on walls, and a fine speckle on asphalt. */
float surfaceDetail(vec3 P,vec3 N,float rough,float win){
  if(win>0.4) return 0.0;
  float up=abs(N.y), d=0.0;
  if(up>0.86){
    d =(vn(P.xz*1.55)-0.5)*0.16+(vn(P.xz*0.26)-0.5)*0.20;
    d+=(h21(floor(P.xz*6.5))-0.5)*0.10*smoothstep(0.80,0.95,rough);
    d+=(h21(floor(P.xz*23.0))-0.5)*0.05;
  }else if(up>0.30){
    float c=fract(P.y*5.2);
    d =(smoothstep(0.0,0.10,c)-1.0)*0.24;
    d+=(h21(floor(vec2(P.x*2.2+P.z*2.2,P.y*5.2)))-0.5)*0.15;
  }else{
    float c=fract(P.y*3.4);
    d =(smoothstep(0.0,0.07,c)-1.0)*0.15;
    float t=fract((P.x*N.z-P.z*N.x)*0.85);
    d+=(smoothstep(0.0,0.05,t)-1.0)*0.07;
    d+=(vn(vec2(P.x+P.z,P.y)*2.1)-0.5)*0.10;
  }
  return d;
}
uniform sampler2DShadow uShadow;
uniform vec2 uShadowTx;
// overlay: 0 none. Data channel is fed per-instance through tint flags.
uniform int uOverlay; uniform vec3 uOvA, uOvB;
layout(location=0) out vec4 oCol;

float shadow(vec4 lp,float ndl){
  vec3 q=lp.xyz/lp.w*0.5+0.5;
  if(q.z>1.0||q.x<0.0||q.x>1.0||q.y<0.0||q.y>1.0) return 1.0;
  float bias=max(0.0014*(1.0-ndl),0.00030);
  q.z-=bias;
  float s=0.0;
  // 5-tap rotated poisson — soft edge at low cost
  const vec2 K[5]=vec2[5](vec2(0.,0.),vec2(1.,.7),vec2(-.9,.6),vec2(-.6,-1.),vec2(.8,-.8));
  for(int i=0;i<5;i++) s+=texture(uShadow,vec3(q.xy+K[i]*uShadowTx*1.35,q.z));
  return s*0.2;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}

void main(){
  vec3 N=normalize(vN);
  vec3 V=normalize(uEye-vW);
  vec3 L=uSunDir;
  float ndl=max(dot(N,L),0.0);
  float sh=ndl>0.0?shadow(vLp,ndl):1.0;

  float rough=clamp(vM.y,0.05,1.0), metal=vM.z;
  vec3 alb=vC;
  float det=surfaceDetail(vW,N,rough,vM.w);
  alb*=(1.0+det);
  rough=clamp(rough+det*0.30,0.05,1.0);

  // window emission: lit at night, mirror-ish by day
  float win=vM.w;
  float lightsOn=smoothstep(0.35,0.62,uNight);
  float flick=0.55+0.45*step(0.34,fract(sin(dot(floor(vW.xz*2.7),vec2(12.98,78.23)))*43758.5));
  vec3 winEm=mix(vec3(1.0,0.80,0.50),vec3(0.66,0.82,1.0),step(0.5,flick))*win*lightsOn*flick*2.6;

  // hemispheric ambient + ground bounce
  float hemi=N.y*0.5+0.5;
  vec3 amb=mix(lin(uGndCol),lin(uSkyCol),hemi)*vAO;
  vec3 diff=alb*(amb+uSunCol*ndl*sh);

  // GGX-lite specular
  vec3 H=normalize(L+V);
  float ndh=max(dot(N,H),0.0), ndv=max(dot(N,V),0.0);
  float a=rough*rough, a2=a*a;
  float d=ndh*ndh*(a2-1.0)+1.0; d=a2/(3.14159*d*d+1e-5);
  float f=pow(1.0-max(dot(H,V),0.0),5.0);
  vec3 F0=mix(vec3(0.04),alb,metal);
  vec3 spec=(F0+(1.0-F0)*f)*d*sh*uSunCol*ndl;
  // sky reflection on shallow-facing surfaces (glass, water-ish roofs)
  float fres=pow(1.0-ndv,4.0)*(1.0-rough)*0.6;
  vec3 col=mix(diff,vec3(0.0),metal*0.55)+spec+lin(uSkyCol)*fres*(0.35+win*1.5);

  col+=vM.x*alb*7.0+winEm*3.4+vEmB*alb*9.0;

  // data overlay: flag carries the normalized metric, remapped to a ramp
  if(uOverlay>0){
    vec3 ov=mix(uOvA,uOvB,clamp(vFlag,0.0,1.0));
    float lum=dot(col,vec3(.299,.587,.114));
    col=mix(col,ov*(0.35+lum*0.9),0.78);
  }

  float dep=length(uEye-vW);
  float hgt=exp(-max(vW.y,0.0)*0.028);
  float fg=1.0-exp(-dep*uFogD*hgt);
  float sun=pow(max(dot(normalize(vW-uEye),L),0.0),6.0);
  col=mix(col,lin(uFogCol)+uSunCol*sun*0.30,fg*0.94);

  // alpha carries "ambient fraction" so SSAO only darkens indirect light
  float ambFrac=1.0-clamp(ndl*sh*0.8,0.0,0.85);
  oCol=vec4(col,ambFrac);
}`;

//──── shadow depth-only ─────────────────────────────────────────────────────
const SH_VS=V_COMMON+`
uniform mat4 uVP;
void main(){
  float c=cos(aIPos.w),s=sin(aIPos.w);
  mat3 R=mat3(c,0.,-s, 0.,1.,0., s,0.,c);
  gl_Position=uVP*vec4(R*(aPos*aIScl.xyz)+aIPos.xyz,1.0);
}`;
const SH_FS=`#version 300 es
precision mediump float; void main(){}`;

//──── sky dome ──────────────────────────────────────────────────────────────
const SKY_VS=`#version 300 es
precision highp float; layout(location=0) in vec2 aP; out vec2 vUv;
void main(){vUv=aP;gl_Position=vec4(aP,1.0,1.0);}`;
const SKY_FS=`#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform mat4 uInvVP; uniform vec3 uEye,uSunDir,uSunCol,uZen,uHor,uGnd; uniform float uNight,uTime;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=n2(p)*a;p*=2.07;a*=.5;}return s;}
void main(){
  vec4 hp=uInvVP*vec4(vUv,1.0,1.0); vec3 d=normalize(hp.xyz/hp.w-uEye);
  float h=d.y;
  vec3 zn=pow(uZen,vec3(2.2)), hz=pow(uHor,vec3(2.2)), gd=pow(uGnd,vec3(2.2));
  vec3 sky=mix(hz,zn,pow(clamp(h,0.0,1.0),0.42));
  sky=mix(gd,sky,smoothstep(-0.08,0.02,h));
  float sd=max(dot(d,uSunDir),0.0);
  sky+=uSunCol*pow(sd,10.0)*0.30;                 // glow
  sky+=uSunCol*pow(sd,900.0)*7.0;                 // disc
  // stars
  float st=smoothstep(0.55,1.0,uNight)*smoothstep(0.0,0.25,h);
  vec2 sc=d.xz/max(abs(d.y),0.02)*0.5;
  float sp=pow(hash(floor(sc*260.0)),44.0);
  sky+=vec3(0.75,0.83,1.0)*sp*st*2.6;
  // layered clouds, wind-advected
  if(h>0.005){
    vec2 cp=d.xz/h*0.055;
    float c1=fbm(cp+vec2(uTime*0.0055,uTime*0.0022));
    float c2=fbm(cp*2.1-vec2(uTime*0.010,0.0));
    float c=smoothstep(0.50,0.86,c1*0.72+c2*0.28);
    float lit=0.55+0.45*pow(sd,2.0);
    vec3 cc=pow(mix(vec3(0.62,0.66,0.74),vec3(1.02,0.98,0.93),lit),vec3(2.2))*(1.0-uNight*0.80);
    sky=mix(sky,cc,c*smoothstep(0.005,0.16,h)*0.85);
  }
  o=vec4(sky,1.0);
}`;

//──── water ─────────────────────────────────────────────────────────────────
const WAT_VS=`#version 300 es
precision highp float; layout(location=0) in vec2 aP;
uniform mat4 uVP; uniform float uTime,uLvl; uniform vec2 uOfs; out vec3 vW;
void main(){vec3 p=vec3(aP.x+uOfs.x,uLvl,aP.y+uOfs.y);vW=p;gl_Position=uVP*vec4(p,1.0);}`;
const WAT_FS=`#version 300 es
precision highp float; in vec3 vW; out vec4 o;
uniform vec3 uEye,uSunDir,uSunCol,uSkyCol,uFogCol,uDeep,uShallow; uniform float uTime,uFogD;
float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 p=vW.xz;
  float w=0.0,amp=0.030,fq=0.055;
  for(int i=0;i<4;i++){ w+=(n2(p*fq+vec2(uTime*0.22*float(i+1),uTime*0.17))-0.5)*amp; fq*=2.13; amp*=0.55; }
  vec2 g=vec2(dFdx(w),dFdy(w))*46.0;
  vec3 N=normalize(vec3(-g.x,1.0,-g.y));
  vec3 V=normalize(uEye-vW);
  float fres=pow(1.0-max(dot(N,V),0.0),4.4);
  vec3 R=reflect(-V,N);
  vec3 sc=pow(uSkyCol,vec3(2.2));
  vec3 sky=mix(sc*0.8,sc*1.7,clamp(R.y,0.0,1.0));
  vec3 col=mix(pow(mix(uDeep,uShallow,0.35),vec3(2.2)),sky,clamp(fres*1.5+0.05,0.0,1.0));
  vec3 H=normalize(uSunDir+V);
  col+=uSunCol*pow(max(dot(N,H),0.0),260.0)*2.4;
  col+=uSunCol*pow(max(dot(N,H),0.0),24.0)*0.09;
  float d=length(uEye-vW);
  col=mix(col,pow(uFogCol,vec3(2.2)),1.0-exp(-d*uFogD*0.85));
  o=vec4(col,0.86);
}`;

//──── post: SSAO → bloom → tonemap ──────────────────────────────────────────
const FS_VS=`#version 300 es
precision highp float; layout(location=0) in vec2 aP; out vec2 vUv;
void main(){vUv=aP*0.5+0.5;gl_Position=vec4(aP,0.0,1.0);}`;

const AO_FS=`#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uDepth; uniform mat4 uInvP,uP; uniform vec2 uRes; uniform float uRad,uNear,uFar;
vec3 vpos(vec2 uv){
  float d=texture(uDepth,uv).r*2.0-1.0;
  vec4 c=uInvP*vec4(uv*2.0-1.0,d,1.0); return c.xyz/c.w;
}
void main(){
  vec3 P=vpos(vUv);
  if(-P.z>uFar*0.92){o=vec4(1.0);return;}
  vec3 N=normalize(cross(dFdx(P),dFdy(P)));
  float rnd=fract(sin(dot(vUv*uRes,vec2(12.9898,78.233)))*43758.5453);
  float ang=rnd*6.2831853;
  float occ=0.0; float rad=uRad/max(-P.z*0.10,1.0);
  const int N_S=10;
  for(int i=0;i<N_S;i++){
    float a=ang+float(i)*2.3999632;                       // golden-angle spiral
    float r=rad*sqrt((float(i)+0.6)/float(N_S));
    vec2 uv=vUv+vec2(cos(a),sin(a))*r/uRes*300.0;
    if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) continue;
    vec3 S=vpos(uv); vec3 D=S-P; float L=length(D);
    if(L<1e-4) continue;
    float ndd=max(dot(N,D/L),0.0);
    occ+=ndd*(1.0/(1.0+L*L*0.55))*smoothstep(2.4,0.35,L);
  }
  o=vec4(clamp(1.0-occ/float(N_S)*1.85,0.0,1.0));
}`;

const BLUR_FS=`#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uT; uniform vec2 uDir;
void main(){
  vec4 s=texture(uT,vUv)*0.227027;
  s+=(texture(uT,vUv+uDir*1.3846)+texture(uT,vUv-uDir*1.3846))*0.316216;
  s+=(texture(uT,vUv+uDir*3.2308)+texture(uT,vUv-uDir*3.2308))*0.070270;
  o=s;
}`;

const BRIGHT_FS=`#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uT; uniform float uThr;
void main(){vec3 c=texture(uT,vUv).rgb; float l=dot(c,vec3(.299,.587,.114));
  o=vec4(c*smoothstep(uThr,uThr+0.7,l),1.0);}`;

const COMP_FS=`#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uCol,uAO,uBloom,uDepth;
uniform vec2 uRes; uniform float uExp,uNight,uAOStr,uBloomStr,uTime;
vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
void main(){
  vec4 c=texture(uCol,vUv);
  // 4-tap AO blur (bilateral-ish via depth weight)
  vec2 t=1.5/uRes;
  float ao=(texture(uAO,vUv+vec2(t.x,t.y)).r+texture(uAO,vUv+vec2(-t.x,t.y)).r
           +texture(uAO,vUv+vec2(t.x,-t.y)).r+texture(uAO,vUv+vec2(-t.x,-t.y)).r)*0.25;
  ao=mix(1.0,ao,uAOStr*c.a);
  vec3 col=c.rgb*ao;
  col+=texture(uBloom,vUv).rgb*uBloomStr;
  col*=uExp;
  // cool night grade / warm day grade
  col=mix(col,col*vec3(0.80,0.90,1.22),uNight*0.55);
  col=aces(col);
  // subtle chromatic edge + vignette + film grain
  vec2 d=vUv-0.5; float vig=1.0-dot(d,d)*0.72;
  col*=vig;
  float g=fract(sin(dot(vUv*uRes+uTime,vec2(12.9898,78.233)))*43758.5453);
  col+=(g-0.5)*0.006*(0.35+dot(col,vec3(.33)));
  o=vec4(pow(col,vec3(1.0/2.2)),1.0);
}`;

//──── FXAA ──────────────────────────────────────────────────────────────────
const FXAA_FS=`#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uRes;
float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
  vec2 px=1.0/uRes;
  vec3 mC=texture(uT,vUv).rgb;
  float lM=lum(mC);
  float lNW=lum(texture(uT,vUv+vec2(-px.x,-px.y)).rgb), lNE=lum(texture(uT,vUv+vec2(px.x,-px.y)).rgb);
  float lSW=lum(texture(uT,vUv+vec2(-px.x,px.y)).rgb),  lSE=lum(texture(uT,vUv+vec2(px.x,px.y)).rgb);
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))), lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  if(lMax-lMin<lMax*0.10+0.018){o=vec4(mC,1.0);return;}
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
  float rcp=1.0/(min(abs(dir.x),abs(dir.y))+max((lNW+lNE+lSW+lSE)*0.03125,1.0/128.0));
  dir=clamp(dir*rcp,-8.0,8.0)*px;
  vec3 a=0.5*(texture(uT,vUv+dir*(1.0/3.0-0.5)).rgb+texture(uT,vUv+dir*(2.0/3.0-0.5)).rgb);
  vec3 b=a*0.5+0.25*(texture(uT,vUv-dir*0.5).rgb+texture(uT,vUv+dir*0.5).rgb);
  o=vec4(lum(b)<lMin||lum(b)>lMax?a:b,1.0);
}`;

const P={
  main:prog(MAIN_VS,MAIN_FS), shadow:prog(SH_VS,SH_FS), sky:prog(SKY_VS,SKY_FS),
  water:prog(WAT_VS,WAT_FS), ao:prog(FS_VS,AO_FS), blur:prog(FS_VS,BLUR_FS),
  bright:prog(FS_VS,BRIGHT_FS), comp:prog(FS_VS,COMP_FS), fxaa:prog(FS_VS,FXAA_FS)
};

//──── fullscreen triangle ───────────────────────────────────────────────────
const quadVAO=gl.createVertexArray();
{const b=gl.createBuffer();gl.bindVertexArray(quadVAO);gl.bindBuffer(gl.ARRAY_BUFFER,b);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);}
const drawQuad=()=>{gl.bindVertexArray(quadVAO);gl.drawArrays(gl.TRIANGLES,0,3);};

//──── render targets ────────────────────────────────────────────────────────
function tex(w,h,ifmt,fmt,type,filter,wrap){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap||gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap||gl.CLAMP_TO_EDGE);
  return t;}
function fbo(cols,depth){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  cols.forEach((t,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0));
  if(depth)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return f;}

const SHADOW_SZ=2048;
const RT={};
RT.shadowT=tex(SHADOW_SZ,SHADOW_SZ,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.LINEAR);
gl.bindTexture(gl.TEXTURE_2D,RT.shadowT);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
RT.shadowF=fbo([],RT.shadowT);
gl.bindFramebuffer(gl.FRAMEBUFFER,RT.shadowF);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

let RW=1,RH=1,AOW=1,AOH=1,BW=1,BH=1;
function allocRT(w,h){
  ['colT','depT','aoT','aoF','colF','b0T','b1T','b0F','b1F','ldrT','ldrF'].forEach(k=>{
    if(RT[k]) (k.endsWith('F')?gl.deleteFramebuffer:gl.deleteTexture).call(gl,RT[k]);});
  RW=w;RH=h; AOW=Math.max(2,w>>1);AOH=Math.max(2,h>>1); BW=Math.max(2,w>>2);BH=Math.max(2,h>>2);
  RT.colT=tex(w,h,HDR_FMT,gl.RGBA,HDR_TYPE,gl.LINEAR);
  RT.depT=tex(w,h,gl.DEPTH_COMPONENT24,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,gl.NEAREST);
  RT.colF=fbo([RT.colT],RT.depT);
  RT.aoT=tex(AOW,AOH,gl.R8,gl.RED,gl.UNSIGNED_BYTE,gl.LINEAR); RT.aoF=fbo([RT.aoT]);
  RT.b0T=tex(BW,BH,HDR_FMT,gl.RGBA,HDR_TYPE,gl.LINEAR); RT.b0F=fbo([RT.b0T]);
  RT.b1T=tex(BW,BH,HDR_FMT,gl.RGBA,HDR_TYPE,gl.LINEAR); RT.b1F=fbo([RT.b1T]);
  RT.ldrT=tex(w,h,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,gl.LINEAR); RT.ldrF=fbo([RT.ldrT]);
}

//──── mesh + instance batch ─────────────────────────────────────────────────
// Vertex layout (24B): pos f32x3 | nrm i8x3+pad | col u8x4(rgb,ao) | mat u8x4
const VSTRIDE=24, ISTRIDE=48;
class MeshBuilder{
  constructor(){this.v=[];this.i=[];this.n=0;
    this.min=[1e9,1e9,1e9];this.max=[-1e9,-1e9,-1e9];}
  vert(x,y,z,nx,ny,nz,c,ao,em,rg,mt,win){
    this.v.push(x,y,z,nx,ny,nz,c[0],c[1],c[2],ao,em,rg,mt,win);
    if(x<this.min[0])this.min[0]=x; if(y<this.min[1])this.min[1]=y; if(z<this.min[2])this.min[2]=z;
    if(x>this.max[0])this.max[0]=x; if(y>this.max[1])this.max[1]=y; if(z>this.max[2])this.max[2]=z;
    return this.n++;}
  tri(a,b,c){this.i.push(a,b,c);}
  quad(a,b,c,d){this.i.push(a,b,c,a,c,d);}
  build(){
    const N=this.n, buf=new ArrayBuffer(N*VSTRIDE), f=new Float32Array(buf), b=new Int8Array(buf), u=new Uint8Array(buf);
    for(let k=0;k<N;k++){const s=k*14,o4=k*6,o1=k*24;
      f[o4]=this.v[s];f[o4+1]=this.v[s+1];f[o4+2]=this.v[s+2];
      b[o1+12]=Math.round(clamp(this.v[s+3],-1,1)*127);
      b[o1+13]=Math.round(clamp(this.v[s+4],-1,1)*127);
      b[o1+14]=Math.round(clamp(this.v[s+5],-1,1)*127);
      u[o1+16]=this.v[s+6]*255;u[o1+17]=this.v[s+7]*255;u[o1+18]=this.v[s+8]*255;u[o1+19]=this.v[s+9]*255;
      u[o1+20]=this.v[s+10]*255;u[o1+21]=this.v[s+11]*255;u[o1+22]=this.v[s+12]*255;u[o1+23]=this.v[s+13]*255;}
    const idx=N>65535?new Uint32Array(this.i):new Uint16Array(this.i);
    return {buf,idx,count:this.i.length,type:N>65535?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,
      min:this.min,max:this.max,
      radius:Math.max(Math.hypot(this.max[0],this.max[1],this.max[2]),Math.hypot(this.min[0],this.min[1],this.min[2])),
      tris:this.i.length/3};}
}

/* A Batch owns one static geometry + a dynamic instance stream. Instances are
   written into a Float32Array/Uint8Array view of the same buffer and uploaded
   once per frame with bufferSubData over only the dirty range. */
class Batch{
  constructor(mesh,cap){
    this.mesh=mesh;this.cap=cap;this.count=0;this.tris=mesh.tris;
    this.vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER,mesh.buf,gl.STATIC_DRAW);
    this.ebo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.idx,gl.STATIC_DRAW);
    this.data=new ArrayBuffer(cap*ISTRIDE); this.f=new Float32Array(this.data); this.u=new Uint8Array(this.data);
    this.ibo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.ibo);
    gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ebo);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,VSTRIDE,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.BYTE,true,VSTRIDE,12);
    gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.UNSIGNED_BYTE,true,VSTRIDE,16);
    gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,VSTRIDE,20);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.ibo);
    gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,4,gl.FLOAT,false,ISTRIDE,0);gl.vertexAttribDivisor(4,1);
    gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,4,gl.FLOAT,false,ISTRIDE,16);gl.vertexAttribDivisor(5,1);
    gl.enableVertexAttribArray(6);gl.vertexAttribPointer(6,4,gl.UNSIGNED_BYTE,true,ISTRIDE,32);gl.vertexAttribDivisor(6,1);
    gl.bindVertexArray(null);
  }
  reset(){this.count=0;}
  // tint components are 0..1 where 0.5 == neutral
  push(x,y,z,yaw,sx,sy,sz,tr,tg,tb,flag,emb){
    if(this.count>=this.cap)return false;
    const i=this.count++, f=i*12, u=i*48+32;
    this.f[f]=x;this.f[f+1]=y;this.f[f+2]=z;this.f[f+3]=yaw;
    this.f[f+4]=sx;this.f[f+5]=sy;this.f[f+6]=sz;this.f[f+7]=emb||0;
    this.u[u]=tr*255;this.u[u+1]=tg*255;this.u[u+2]=tb*255;this.u[u+3]=(flag||0)*255;
    return true;}
  flush(){if(!this.count)return;gl.bindBuffer(gl.ARRAY_BUFFER,this.ibo);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.f,0,this.count*12);}
  draw(){if(!this.count)return 0;gl.bindVertexArray(this.vao);
    gl.drawElementsInstanced(gl.TRIANGLES,this.mesh.count,this.mesh.type,0,this.count);
    return this.tris*this.count;}
}
