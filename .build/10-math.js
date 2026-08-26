'use strict';
/*═══════════════════════════════════════════════════════════════════════════
  METROPOLIS — a single-file city-builder engine.
  Layers:  math → GL core → procedural geometry → world graph → simulation → UI
═══════════════════════════════════════════════════════════════════════════*/

//──── math ──────────────────────────────────────────────────────────────────
const PI=Math.PI, TAU=PI*2, D2R=PI/180;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const sat=v=>v<0?0:v>1?1:v;
const dampf=(cur,tgt,rate,dt)=>lerp(cur,tgt,1-Math.exp(-rate*dt));
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
const angLerp=(a,b,t)=>{let d=((b-a+PI)%TAU+TAU)%TAU-PI;return a+d*t;};

// deterministic PRNG (mulberry32) — every asset is reproducible from a seed
function rng(seed){let a=(seed|0)+0x6D2B79F5;return function(){
  a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const hash2=(x,y)=>{let h=Math.imul(x*374761393+y*668265263,1274126177);h^=h>>>13;return((h>>>0)/4294967296);};

// value noise for terrain / land-value fields
function noise2(x,y){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const u=smooth(xf),v=smooth(yf);
  return lerp(lerp(hash2(xi,yi),hash2(xi+1,yi),u),lerp(hash2(xi,yi+1),hash2(xi+1,yi+1),u),v);
}
function fbm(x,y,oct=4){let s=0,a=.5,f=1;for(let i=0;i<oct;i++){s+=noise2(x*f,y*f)*a;f*=2.03;a*=.5;}return s;}

//──── mat4 (column-major, Float32Array) ─────────────────────────────────────
const M4={
  id:()=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(o,a,b){
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],
          a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    for(let i=0;i<4;i++){const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
      o[i*4]=b0*a00+b1*a10+b2*a20+b3*a30; o[i*4+1]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[i*4+2]=b0*a02+b1*a12+b2*a22+b3*a32; o[i*4+3]=b0*a03+b1*a13+b2*a23+b3*a33;}
    return o;},
  persp(o,fov,asp,n,f){const t=1/Math.tan(fov/2);o.fill(0);
    o[0]=t/asp;o[5]=t;o[11]=-1;o[10]=(f+n)/(n-f);o[14]=2*f*n/(n-f);return o;},
  ortho(o,l,r,b,t,n,f){o.fill(0);o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);
    o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);o[15]=1;return o;},
  look(o,ex,ey,ez,cx,cy,cz,ux,uy,uz){
    let zx=ex-cx,zy=ey-cy,zz=ez-cz;let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=uy*zz-uz*zy,xy=uz*zx-ux*zz,xz=ux*zy-uy*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0; o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0; o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
    o[12]=-(xx*ex+xy*ey+xz*ez);o[13]=-(yx*ex+yy*ey+yz*ez);o[14]=-(zx*ex+zy*ey+zz*ez);o[15]=1;return o;},
  inv(o,m){
    const a=m[0],b=m[1],c=m[2],d=m[3],e=m[4],f=m[5],g=m[6],h=m[7],
          i=m[8],j=m[9],k=m[10],l=m[11],n=m[12],p=m[13],q=m[14],r=m[15];
    const t0=a*f-b*e,t1=a*g-c*e,t2=a*h-d*e,t3=b*g-c*f,t4=b*h-d*f,t5=c*h-d*g,
          t6=i*p-j*n,t7=i*q-k*n,t8=i*r-l*n,t9=j*q-k*p,t10=j*r-l*p,t11=k*r-l*q;
    let det=t0*t11-t1*t10+t2*t9+t3*t8-t4*t7+t5*t6; if(!det)return null; det=1/det;
    o[0]=(f*t11-g*t10+h*t9)*det;  o[1]=(c*t10-b*t11-d*t9)*det;
    o[2]=(p*t5-q*t4+r*t3)*det;    o[3]=(k*t4-j*t5-l*t3)*det;
    o[4]=(g*t8-e*t11-h*t7)*det;   o[5]=(a*t11-c*t8+d*t7)*det;
    o[6]=(q*t2-n*t5-r*t1)*det;    o[7]=(i*t5-k*t2+l*t1)*det;
    o[8]=(e*t10-f*t8+h*t6)*det;   o[9]=(b*t8-a*t10-d*t6)*det;
    o[10]=(n*t4-p*t2+r*t0)*det;   o[11]=(j*t2-i*t4-l*t0)*det;
    o[12]=(f*t7-e*t9-g*t6)*det;   o[13]=(a*t9-b*t7+c*t6)*det;
    o[14]=(p*t1-n*t3-q*t0)*det;   o[15]=(i*t3-j*t1+k*t0)*det;return o;},
  // TRS with a Y-rotation only (all city objects are yaw-aligned) — fast path
  trsY(o,x,y,z,yaw,sx,sy,sz){
    const c=Math.cos(yaw),s=Math.sin(yaw);
    o[0]=c*sx;o[1]=0;o[2]=-s*sx;o[3]=0;
    o[4]=0;o[5]=sy;o[6]=0;o[7]=0;
    o[8]=s*sz;o[9]=0;o[10]=c*sz;o[11]=0;
    o[12]=x;o[13]=y;o[14]=z;o[15]=1;return o;}
};

//──── frustum (6 planes from a view-projection matrix) ──────────────────────
class Frustum{
  constructor(){this.p=new Float32Array(24);}
  set(m){const p=this.p;
    for(let i=0;i<3;i++){const s=i*2;
      p[s*4]=m[3]+m[i];p[s*4+1]=m[7]+m[4+i];p[s*4+2]=m[11]+m[8+i];p[s*4+3]=m[15]+m[12+i];
      p[(s+1)*4]=m[3]-m[i];p[(s+1)*4+1]=m[7]-m[4+i];p[(s+1)*4+2]=m[11]-m[8+i];p[(s+1)*4+3]=m[15]-m[12+i];}
    for(let i=0;i<6;i++){const o=i*4,l=Math.hypot(p[o],p[o+1],p[o+2])||1;
      p[o]/=l;p[o+1]/=l;p[o+2]/=l;p[o+3]/=l;}}
  sphere(x,y,z,r){const p=this.p;
    for(let i=0;i<6;i++){const o=i*4;if(p[o]*x+p[o+1]*y+p[o+2]*z+p[o+3]<-r)return false;}return true;}
}

//──── misc helpers ──────────────────────────────────────────────────────────
const fmt=n=>{n=Math.round(n);
  if(Math.abs(n)>=1e9)return(n/1e9).toFixed(2)+'B';
  if(Math.abs(n)>=1e6)return(n/1e6).toFixed(2)+'M';
  if(Math.abs(n)>=1e4)return(n/1e3).toFixed(1)+'k';
  return n.toLocaleString('en-US');};
const money=n=>(n<0?'-₡':'₡')+fmt(Math.abs(n));
const pct=v=>Math.round(v*100)+'%';
const hex=h=>[((h>>16)&255)/255,((h>>8)&255)/255,(h&255)/255];
// perceptual mix in gamma-ish space; keeps procedural palettes from muddying
function mixc(a,b,t){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];}
function jitc(c,r,f){return [sat(c[0]+(r()-.5)*f),sat(c[1]+(r()-.5)*f),sat(c[2]+(r()-.5)*f)];}
