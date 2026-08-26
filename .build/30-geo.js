/*═══════ PROCEDURAL GEOMETRY ═══════════════════════════════════════════════
  No external assets. Every building, vehicle and citizen is generated from a
  seed at load time into a small library of meshes; the world then instances
  them. Vertex colour + baked AO + a material channel (emissive/rough/metal/
  window) carry all surface variety, so there are zero textures to fetch.
═══════════════════════════════════════════════════════════════════════════*/
const G={};

// ── primitives ─────────────────────────────────────────────────────────────
// A box with per-face normals, vertical AO gradient and full material control.
function box(mb,x,y,z,w,h,d,col,o){
  o=o||{}; const em=o.em||0, rg=o.rg===undefined?.72:o.rg, mt=o.mt||0, win=o.win||0;
  const a0=o.ao0===undefined?.55:o.ao0, a1=o.ao1===undefined?1:o.ao1;
  const yaw=o.yaw||0, cy=Math.cos(yaw), sy=Math.sin(yaw);
  const hw=w/2,hd=d/2;
  const T=(lx,lz)=>[x+lx*cy+lz*sy, z-lx*sy+lz*cy];
  const P=[]; // 8 corners
  for(let i=0;i<8;i++){
    const lx=(i&1?hw:-hw), ly=(i&2?h:0), lz=(i&4?hd:-hd);
    const t=T(lx,lz); P.push([t[0],y+ly,t[1], i&2?a1:a0]);}
  const N=[[cy,0,-sy],[-cy,0,sy],[0,1,0],[0,-1,0],[sy,0,cy],[-sy,0,-cy]];
  const F=[[1,3,7,5],[4,6,2,0],[2,6,7,3],[0,1,5,4],[5,7,6,4],[0,2,3,1]];
  const skip=o.skip||0;
  for(let f=0;f<6;f++){
    if(skip&(1<<f))continue;
    const n=N[f], q=F[f], id=[];
    const fc = o.faceCol&&o.faceCol[f] ? o.faceCol[f] : col;
    const fw = (f===2||f===3)?0:win;   // never glaze the roof/floor
    for(const k of q){const p=P[k];id.push(mb.vert(p[0],p[1],p[2],n[0],n[1],n[2],fc,p[3],em,rg,mt,fw));}
    mb.quad(id[0],id[1],id[2],id[3]);
  }
}
// Gable / shed prism roof. ridge=0..1 across width (0.5 = symmetric gable)
function gable(mb,x,y,z,w,h,d,col,o){
  o=o||{}; const yaw=o.yaw||0,cy=Math.cos(yaw),sy=Math.sin(yaw);
  const ridge=o.ridge===undefined?.5:o.ridge, rg=o.rg===undefined?.85:o.rg;
  const hw=w/2,hd=d/2, rx=(ridge-.5)*w;
  const T=(lx,lz)=>[x+lx*cy+lz*sy, z-lx*sy+lz*cy];
  const c=[T(-hw,-hd),T(hw,-hd),T(hw,hd),T(-hw,hd),T(rx,-hd),T(rx,hd)];
  const V=(i,yy,n,a)=>mb.vert(c[i][0],y+yy,c[i][1],n[0],n[1],n[2],col,a,0,rg,0,0);
  const lslope=Math.atan2(h,(ridge)*w), rslope=Math.atan2(h,(1-ridge)*w);
  const nl=[-Math.sin(lslope)*cy,Math.cos(lslope),Math.sin(lslope)*sy];
  const nr=[ Math.sin(rslope)*cy,Math.cos(rslope),-Math.sin(rslope)*sy];
  let a=V(0,0,nl,.75),b=V(3,0,nl,.85),cc=V(5,h,nl,1),dd=V(4,h,nl,1); mb.quad(a,b,cc,dd);
  a=V(1,0,nr,.75);b=V(4,h,nr,1);cc=V(5,h,nr,1);dd=V(2,0,nr,.85); mb.quad(a,b,cc,dd);
  const ne=[sy,0,cy], nw=[-sy,0,-cy], gc=o.gableCol||col;
  const g=(i,yy,n,aa)=>mb.vert(c[i][0],y+yy,c[i][1],n[0],n[1],n[2],gc,aa,0,.75,0,0);
  mb.tri(g(1,0,nw,.7),g(0,0,nw,.7),g(4,h,nw,1));
  mb.tri(g(3,0,ne,.7),g(2,0,ne,.7),g(5,h,ne,1));
}
function cyl(mb,x,y,z,r,h,seg,col,o){
  o=o||{};const rg=o.rg===undefined?.7:o.rg,mt=o.mt||0,em=o.em||0,r2=o.r2===undefined?r:o.r2;
  const a0=o.ao0===undefined?.6:o.ao0,a1=o.ao1===undefined?1:o.ao1;
  const bi=[],ti=[];
  for(let i=0;i<seg;i++){const a=i/seg*TAU,ca=Math.cos(a),sa=Math.sin(a);
    bi.push(mb.vert(x+ca*r,y,z+sa*r,ca,0,sa,col,a0,em,rg,mt,0));
    ti.push(mb.vert(x+ca*r2,y+h,z+sa*r2,ca,0,sa,col,a1,em,rg,mt,0));}
  for(let i=0;i<seg;i++){const j=(i+1)%seg;mb.quad(bi[i],bi[j],ti[j],ti[i]);}
  if(!o.open){const cT=mb.vert(x,y+h,z,0,1,0,col,a1,em,rg,mt,0);
    const ring=[];for(let i=0;i<seg;i++){const a=i/seg*TAU;
      ring.push(mb.vert(x+Math.cos(a)*r2,y+h,z+Math.sin(a)*r2,0,1,0,col,a1,em,rg,mt,0));}
    for(let i=0;i<seg;i++)mb.tri(cT,ring[i],ring[(i+1)%seg]);}
  if(o.capBottom){const cB=mb.vert(x,y,z,0,-1,0,col,a0,em,rg,mt,0);const ring=[];
    for(let i=0;i<seg;i++){const a=i/seg*TAU;
      ring.push(mb.vert(x+Math.cos(a)*r,y,z+Math.sin(a)*r,0,-1,0,col,a0,em,rg,mt,0));}
    for(let i=0;i<seg;i++)mb.tri(cB,ring[(i+1)%seg],ring[i]);}
}
// horizontal quad (ground decals, water, markings)
function plane(mb,x,y,z,w,d,col,o){
  o=o||{};const yaw=o.yaw||0,cy=Math.cos(yaw),sy=Math.sin(yaw),hw=w/2,hd=d/2;
  const em=o.em||0,rg=o.rg===undefined?.9:o.rg,ao=o.ao===undefined?1:o.ao;
  const T=(lx,lz)=>[x+lx*cy+lz*sy,z-lx*sy+lz*cy];
  const c=[T(-hw,-hd),T(hw,-hd),T(hw,hd),T(-hw,hd)];
  const id=c.map(p=>mb.vert(p[0],y,p[1],0,1,0,col,ao,em,rg,0,0));
  mb.quad(id[3],id[2],id[1],id[0]);   // CCW seen from above (matches box top faces)
}
// Recessed window with frame + sill. face: 0=+X 1=-X 2=+Z 3=-Z (before yaw)
function window_(mb,cx,cy_,cz,w,h,face,yaw,fr,gl_,o){
  o=o||{}; const d=0.09;
  const ax=(face<2)?1:0;                     // 1 => window lies on an X face
  const s=(face===0||face===2)?1:-1;
  const off=(lx,lz,ly)=>{const c=Math.cos(yaw),si=Math.sin(yaw);
    return [cx+lx*c+lz*si, cy_+ly, cz-lx*si+lz*c];};
  const bw=ax?d*2:w, bd=ax?w:d*2;
  const px=ax?s*d*0.5:0, pz=ax?0:s*d*0.5;
  let p=off(px,pz,0);
  box(mb,p[0],p[1],p[2],bw+0.16,h+0.16,bd+0.16,fr,{yaw,ao0:.85,ao1:1,rg:.6});
  p=off(ax?s*d*0.9:0, ax?0:s*d*0.9, 0);
  box(mb,p[0],p[1],p[2],ax?0.05:w-0.1, h-0.1, ax?w-0.1:0.05, gl_,
      {yaw,ao0:.95,ao1:1,rg:.06,mt:.55,win:o.win===undefined?1:o.win,em:o.em||0});
  if(o.mullion){ // vertical divider
    p=off(ax?s*d*1.0:0, ax?0:s*d*1.0, 0);
    box(mb,p[0],p[1],p[2],ax?0.07:0.06,h-0.12,ax?0.06:0.07,fr,{yaw,ao0:.9,ao1:1});
  }
  if(o.sill!==false){ p=off(ax?s*d*1.1:0, ax?0:s*d*1.1, -h/2-0.06);
    box(mb,p[0],p[1],p[2],ax?0.16:w+0.24,0.07,ax?w+0.24:0.16,fr,{yaw,ao0:.8,ao1:1});}
}

// ── shared detail parts ────────────────────────────────────────────────────
const PAL={
  siding:[0xefe9dc,0xdccdb2,0xc3d2cd,0xead6bf,0xccd6e0,0xd4c6b6,0xb9c6b0,0xf0e6d6,0xbfb0a0,0xdde4ea,
          0xe6dcc8,0xa8b6ae,0xd8bfa4,0xcfd4d8],
  brick :[0xa25c46,0x8c4f40,0xb46a4e,0x7d4a3e,0xa8644a,0x6f4036,0x9a5f52,0xc07a55],
  roofs :[0x2b3038,0x8c4526,0x22262c,0xa0522d,0x36414b,0x6b4a2c,0x1d2a33,0x2f4034,0xb35c33,0x4a3a2c,
          0x3a2f28,0x7d3f22],
  trim  :[0xf6f2ea,0xe4e0d6,0x2c3138,0xf0e8dc],
  metal :[0xa8b0b6,0x8e989e,0xb8c0c4,0x9aa6ac,0xc0b8a8],
  ind   :[0x9aa2a8,0x8894a0,0xa8a094,0x7e8a94,0xb0a898],
  awning:[0x2f6f5e,0x8a3a3a,0x2c4d7a,0x7a5a2a,0x4a3a6a,0x2a5a4a,0x8a5a2a],
  glassD:[0.10,0.14,0.19], glassN:[0.55,0.62,0.72],
  leaf  :[0x4c7a38,0x5a8c42,0x426e34,0x639344,0x3a6b3a,0x76913c,0x557f3e],
  bark  :[0x4a3b2e,0x3d3226,0x554537],
  car   :[0xd9dde2,0x2b3138,0x8e1f28,0x1f3f6e,0x3a6b4a,0xc9a12a,0x5a5f66,0xa8360f,0xe8e8ea,0x25506e]
};
const pick=(arr,r)=>hex(arr[(r()*arr.length)|0]);

function acUnit(mb,x,y,z,s,r){
  const m=pick(PAL.metal,r);
  box(mb,x,y,z,1.0*s,0.62*s,0.9*s,m,{ao0:.6,rg:.55,mt:.35});
  cyl(mb,x,y+0.62*s,z,0.32*s,0.12*s,10,mixc(m,[0,0,0],.35),{rg:.5,mt:.4});
  for(let i=0;i<4;i++)box(mb,x-0.4*s+i*0.24*s,y+0.05*s,z-0.46*s,0.06*s,0.5*s,0.03*s,mixc(m,[0,0,0],.45),{ao0:.5});
}
function vent(mb,x,y,z,s,r){
  const m=pick(PAL.metal,r);
  cyl(mb,x,y,z,0.15*s,0.5*s,10,m,{rg:.5,mt:.4});
  cyl(mb,x,y+0.5*s,z,0.24*s,0.14*s,10,mixc(m,[1,1,1],.15),{rg:.5,mt:.4});
}
function chimney(mb,x,y,z,w,h,col,r){
  box(mb,x,y,z,w,h,w,col,{ao0:.5,rg:.9});
  box(mb,x,y+h,z,w+0.16,0.14,w+0.16,mixc(col,[1,1,1],.2),{ao0:.9,rg:.85});
  cyl(mb,x,y+h+0.14,z,w*0.22,0.2,8,[.15,.14,.13],{rg:.95});
}
function door(mb,x,y,z,w,h,yaw,col,frame){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  box(mb,x-s*0.05,y+h/2,z-c*0.05,w+0.18,h+0.14,0.14,frame,{yaw,ao0:.8,rg:.6});
  box(mb,x-s*0.10,y+h/2,z-c*0.10,w,h,0.10,col,{yaw,ao0:.75,rg:.45});
  box(mb,x-s*0.16+c*w*0.32,y+h*0.5,z-c*0.16-s*w*0.32,0.07,0.07,0.07,[.85,.75,.35],{yaw,rg:.2,mt:.9});
}
function steps(mb,x,y,z,w,h,d,col,yaw,n){
  n=n||3;for(let i=0;i<n;i++){const t=(i+1)/n;
    box(mb,x,y+h*(i+0.5)/n,z+d*(n-i-0.5)/n*0.0,w,h/n,d*(1-i/n),col,{yaw,ao0:.55,rg:.9});}
}
function railing(mb,x,y,z,len,h,yaw,col){
  const c=Math.cos(yaw),s=Math.sin(yaw),n=Math.max(2,Math.round(len/0.55));
  for(let i=0;i<=n;i++){const t=(i/n-0.5)*len;
    box(mb,x+t*c,y+h/2,z-t*s,0.055,h,0.055,col,{yaw,ao0:.7});}
  box(mb,x,y+h,z,len,0.07,0.09,col,{yaw,ao0:.95});
  box(mb,x,y+h*0.42,z,len,0.05,0.06,col,{yaw,ao0:.9});
}
function fence(mb,x,z,w,d,yaw,col,r,h){
  h=h||0.9; const c=Math.cos(yaw),s=Math.sin(yaw);
  const sides=[[0,-d/2,w,0],[0,d/2,w,0],[-w/2,0,d,PI/2],[w/2,0,d,PI/2]];
  for(const sd of sides){
    if(sd[1]<0&&sd[3]===0)continue;               // leave the street side open
    const lx=sd[0],lz=sd[1],len=sd[2],ry=sd[3];
    const wx=x+lx*c+lz*s, wz=z-lx*s+lz*c, ay=yaw+ry;
    const n=Math.max(2,Math.round(len/0.34));
    for(let i=0;i<n;i++){const t=(i/(n-1)-0.5)*len*0.98;
      box(mb,wx+t*Math.cos(ay),h/2,wz-t*Math.sin(ay),0.075,h*(0.9+r()*0.14),0.05,col,{yaw:ay,ao0:.55});}
    box(mb,wx,h*0.78,wz,len,0.06,0.07,col,{yaw:ay,ao0:.9});
  }
}
function tree(mb,x,y,z,s,r,kind){
  const bark=pick(PAL.bark,r), leaf=jitc(pick(PAL.leaf,r),r,.09);
  const th=(1.45+r()*0.9)*s;
  cyl(mb,x,y,z,0.15*s,th*1.06,6,bark,{r2:0.10*s,rg:.96,ao0:.42});
  if(kind===1){                                   // conifer: overlapping skirts
    const n=5;
    for(let i=0;i<n;i++){const t=i/n;
      cyl(mb,x,y+th*0.30+t*th*1.55,z,(1.02-t*0.86)*0.80*s,th*0.52,8,
        mixc(leaf,[.06,.10,.05],t*0.10),
        {r2:(0.72-t*0.66)*0.60*s,rg:.96,ao0:.62+t*0.26,ao1:.86+t*0.14,capBottom:1});}
  }else{
    // broadleaf: each lobe is two stacked frusta, so the crown reads as a
    // rounded mass rather than the cone a single taper always gives you.
    const n=3+((r()*3)|0);
    for(let i=0;i<n;i++){
      const a=r()*TAU, rr=(0.16+r()*0.34)*s;
      const R=(0.60+r()*0.34)*s, hh=(0.46+r()*0.34)*s;
      const px=x+Math.cos(a)*rr, pz=z+Math.sin(a)*rr, py=y+th*0.72+r()*0.42*s;
      const c=jitc(mixc(leaf,[1,1,1],r()*0.16),r,.06);
      cyl(mb,px,py,pz,R*0.62,hh*0.75,7,c,{r2:R,rg:.96,ao0:.62,ao1:.9,capBottom:1});
      cyl(mb,px,py+hh*0.75,pz,R,hh*0.95,7,mixc(c,[1,1,1],.06),
        {r2:R*0.30,rg:.96,ao0:.9,ao1:1});}
  }
}
function bush(mb,x,y,z,s,r){
  const leaf=jitc(pick(PAL.leaf,r),r,.12);
  for(let i=0;i<2;i++)cyl(mb,x+(r()-.5)*0.3*s,y,z+(r()-.5)*0.3*s,(0.28+r()*0.2)*s,(0.35+r()*0.3)*s,7,
    leaf,{r2:(0.16+r()*0.12)*s,rg:.95,ao0:.5,capBottom:1});
}
function corrugate(mb,x,y,z,w,h,d,col,r,yaw){    // ribbed industrial cladding
  box(mb,x,y+h/2,z,w,h,d,col,{yaw,ao0:.5,rg:.62,mt:.28});
  const c=Math.cos(yaw||0),s=Math.sin(yaw||0),n=Math.max(3,Math.round(w/0.55));
  const rib=mixc(col,[1,1,1],.10);
  for(let i=0;i<n;i++){const t=(i/(n-1)-0.5)*w*0.96;
    box(mb,x+t*c-s*(d/2+0.03),y+h/2,z-t*s-c*(d/2+0.03)*0+ (0),0.09,h*0.98,0.0,rib,{yaw});}
  // front rib strip (thin, cheap, reads as corrugation at distance)
  for(let i=0;i<n;i++){const t=(i/(n-1)-0.5)*w*0.96;
    box(mb,x+t*c+s*(d/2+0.035),y+h/2,z-t*s+c*(d/2+0.035),0.10,h*0.97,0.04,rib,{yaw,ao0:.55,rg:.6,mt:.3});}
}
function rollDoor(mb,x,y,z,w,h,yaw,col){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  box(mb,x+s*0.09,y+h/2,z+c*0.09,w+0.2,h+0.18,0.16,mixc(col,[0,0,0],.35),{yaw,ao0:.6,rg:.6,mt:.3});
  const n=Math.max(4,Math.round(h/0.35));
  for(let i=0;i<n;i++)box(mb,x+s*0.14,y+h*(i+0.5)/n,z+c*0.14,w,h/n*0.86,0.06,
    mixc(col,[1,1,1],i%2?.10:0),{yaw,ao0:.5+i/n*0.4,ao1:.6+i/n*0.4,rg:.5,mt:.45});
}
function signBand(mb,x,y,z,w,h,yaw,col,r){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  box(mb,x,y,z,w,h,0.16,col,{yaw,ao0:.85,rg:.5});
  const n=3+((r()*4)|0), lc=[[1,.86,.5],[.5,.9,1],[1,.55,.6],[.6,1,.72]][(r()*4)|0];
  for(let i=0;i<n;i++){const t=(i/(n-1)-0.5)*w*0.62;
    box(mb,x+t*c+s*0.11,y,z-t*s+c*0.11,w*0.075,h*0.46,0.05,lc,{yaw,em:.85,rg:.3});}
}
function awning(mb,x,y,z,w,dep,yaw,col,r){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const stripe=mixc(col,[1,1,1],.62), n=Math.max(3,Math.round(w/0.5));
  for(let i=0;i<n;i++){const t=(i/n-0.5+0.5/n)*w;
    box(mb,x+t*c+s*dep*0.5,y-0.10,z-t*s+c*dep*0.5,w/n*0.98,0.10,dep,
      i%2?col:stripe,{yaw,ao0:.72,ao1:.98,rg:.85});}
  box(mb,x+s*dep,y-0.20,z+c*dep,w,0.13,0.09,mixc(col,[0,0,0],.3),{yaw,ao0:.9,rg:.8});
  for(const sgn of [-1,1])box(mb,x+sgn*w*0.48*c+s*dep*0.5,y-0.02,z-sgn*w*0.48*s+c*dep*0.5,0.05,0.2,dep,
    mixc(col,[0,0,0],.25),{yaw,ao0:.7});
}
function pipeRun(mb,x,y,z,len,r_,yaw,col){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const seg=6;
  for(let i=0;i<seg;i++){const t=(i/seg-0.5)*len;
    box(mb,x+t*c,y,z-t*s,len/seg,r_*2,r_*2,col,{yaw,ao0:.7,rg:.5,mt:.5});}
  for(let i=0;i<=2;i++){const t=(i/2-0.5)*len*0.9;
    box(mb,x+t*c,y,z-t*s,r_*0.5,r_*2.5,r_*2.5,mixc(col,[0,0,0],.25),{yaw,ao0:.7,rg:.5,mt:.5});}
}

// Arbitrary planar face; the normal comes from Newell's method so hip roofs,
// dormers and chamfers all shade correctly without hand-written normals.
function poly(mb,pts,col,o){
  o=o||{}; const n=pts.length; if(n<3)return;
  let nx=0,ny=0,nz=0;
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];
    nx+=(a[1]-b[1])*(a[2]+b[2]); ny+=(a[2]-b[2])*(a[0]+b[0]); nz+=(a[0]-b[0])*(a[1]+b[1]);}
  const L=Math.hypot(nx,ny,nz)||1; nx/=L;ny/=L;nz/=L;
  const rg=o.rg===undefined?.85:o.rg, em=o.em||0, mt=o.mt||0, ao=o.ao===undefined?1:o.ao;
  const id=pts.map(p=>mb.vert(p[0],p[1],p[2],nx,ny,nz,col,p[3]===undefined?ao:p[3],em,rg,mt,o.win||0));
  for(let i=1;i<n-1;i++)mb.tri(id[0],id[i],id[i+1]);
}
// Hip roof: four pitched planes meeting at a ridge. The staple suburban roof.
function hip(mb,x,y,z,w,d,h,col,o){
  o=o||{}; const yaw=o.yaw||0,cy=Math.cos(yaw),sy=Math.sin(yaw);
  const T=(lx,lz)=>[x+lx*cy+lz*sy, z-lx*sy+lz*cy];
  const alongX=w>=d, rl=Math.max(0.5,(alongX?w-d:d-w)*(o.ridge===undefined?1:o.ridge));
  const hw=w/2,hd=d/2;
  const b=[T(-hw,-hd),T(hw,-hd),T(hw,hd),T(-hw,hd)];
  let r0,r1;
  if(alongX){r0=T(-rl/2,0);r1=T(rl/2,0);}else{r0=T(0,-rl/2);r1=T(0,rl/2);}
  const B=i=>[b[i][0],y,b[i][1],.78], R0=[r0[0],y+h,r0[1],1], R1=[r1[0],y+h,r1[1],1];
  const c2=mixc(col,[0,0,0],.10), c3=mixc(col,[1,1,1],.06);
  // vertex order is reversed relative to the obvious reading: Newell's normal
  // must come out of the roof, not into it.
  if(alongX){
    poly(mb,[R0,R1,B(1),B(0)],c3,{rg:.88});
    poly(mb,[R1,R0,B(3),B(2)],c2,{rg:.88});
    poly(mb,[R0,B(0),B(3)],c2,{rg:.88});
    poly(mb,[R1,B(2),B(1)],c3,{rg:.88});
  }else{
    poly(mb,[R0,B(1),B(0)],c3,{rg:.88});
    poly(mb,[R1,B(3),B(2)],c2,{rg:.88});
    poly(mb,[R0,R1,B(3),B(0)],c2,{rg:.88});
    poly(mb,[R1,R0,B(1),B(2)],c3,{rg:.88});
  }
}
// Flat roof with a parapet, roof deck and a coping band.
function flatRoof(mb,x,y,z,w,d,col,deck,o){
  o=o||{}; const yaw=o.yaw||0, ph=o.h===undefined?0.40:o.h;
  const cap=o.cap||[.52,.52,.51];        // cast-stone coping, never a tint of the wall
  plane(mb,x,y+0.02,z,w,d,deck,{yaw,rg:.97,ao:.78});
  const c=Math.cos(yaw),s=Math.sin(yaw);
  for(const [lx,lz,bw,bd] of [[0,-d/2,w,0.22],[0,d/2,w,0.22],[-w/2,0,0.22,d],[w/2,0,0.22,d]])
    box(mb,x+lx*c+lz*s,y,z-lx*s+lz*c,bw+0.22,ph,bd+0.22,col,{yaw,ao0:.85,ao1:1,rg:.9});
  for(const [lx,lz,bw,bd] of [[0,-d/2,w,0.30],[0,d/2,w,0.30],[-w/2,0,0.30,d],[w/2,0,0.30,d]])
    box(mb,x+lx*c+lz*s,y+ph,z-lx*s+lz*c,bw+0.34,0.07,bd+0.34,cap,{yaw,ao0:1,ao1:1,rg:.85});
}
function hedge(mb,x,z,len,yaw,h,col,r){
  const n=Math.max(2,Math.round(len/0.85));
  for(let i=0;i<n;i++){const t=(i/(n-1)-0.5)*len;
    box(mb,x+t*Math.cos(yaw),0,z-t*Math.sin(yaw),len/n*1.15,h*(0.88+r()*0.2),0.75,
      jitc(col,r,.07),{yaw,ao0:.45,ao1:1,rg:.97});}
}
function parkedCar(mb,x,z,yaw,r){
  const c=hex(PAL.car[(r()*PAL.car.length)|0]);
  box(mb,x,0.34,z,4.2,0.62,1.78,c,{yaw,ao0:.35,ao1:.9,rg:.22,mt:.35});
  box(mb,x-Math.cos(yaw)*0.25,0.96,z+Math.sin(yaw)*0.25,2.2,0.68,1.66,c,{yaw,ao0:.9,ao1:1,rg:.22,mt:.35});
  for(const sd of[-1,1])box(mb,x-Math.cos(yaw)*0.25+Math.sin(yaw)*sd*0.84,0.98,z+Math.sin(yaw)*0.25+Math.cos(yaw)*sd*0.84,
    2.0,0.44,0.05,PAL.glassD,{yaw,ao0:1,rg:.05,mt:.7,win:.5});
  for(const sx of[-1.3,1.3])for(const sz of[-1,1])
    cyl(mb,x+Math.cos(yaw)*sx+Math.sin(yaw)*sz*0.86,0.30,z-Math.sin(yaw)*sx+Math.cos(yaw)*sz*0.86,
      0.30,0.20,8,[.08,.08,.09],{rg:.95,ao0:.4,capBottom:1});
}

/*── LOT GENERATORS ──────────────────────────────────────────────────────────
  Each generator emits an ENTIRE LOT (building + yard + driveway + planting +
  fence) as one mesh, so a whole city block is a handful of instanced draws.
  Local frame: origin at lot centre, ground y=0, the ROAD is toward −Z.       */

const LOT_W=13, LOT_D=21;                 // metres — low-density parcel

function genHouse(seed,lvl){
  const r=rng(seed), mb=new MeshBuilder();
  const q=(lvl-1)/4;
  const wall=jitc(pick(PAL.siding,r),r,.045);
  const trimC=hex(PAL.trim[(r()*PAL.trim.length)|0]);
  const roofC=jitc(pick(PAL.roofs,r),r,.045);
  const stone=[.50,.49,.47];
  const modern=lvl>=5&&r()<0.55;

  // ── site plan ──────────────────────────────────────────────────────────
  const FRONT=-LOT_D/2;                              // kerb edge of the parcel
  const setback=3.4+r()*1.0;
  const bw=7.0+q*2.2+r()*1.2, bd=7.6+q*2.6+r()*1.4;
  const stories=modern?2:(lvl<=2?1:(lvl<=3?(r()<.5?2:1):2));
  const fh=2.72+q*0.14, wallH=stories*fh;
  const bz=FRONT+setback+bd/2;
  const drvSide=r()<.5?-1:1;
  const bx=-drvSide*((LOT_W-bw)/2-1.9);

  plane(mb,0,0.015,0,LOT_W,LOT_D,jitc([.225,.288,.163],r,.05),{rg:.99,ao:.95});
  // driveway from kerb to garage
  const drvX=drvSide*(LOT_W/2-1.9);
  plane(mb,drvX,0.035,FRONT+4.4,3.1,9.0,[.30,.30,.31],{rg:.94,ao:.86});
  // front path
  plane(mb,bx,0.035,FRONT+setback*0.5,1.15,setback,[.56,.55,.52],{rg:.93,ao:.86});

  // ── house body ─────────────────────────────────────────────────────────
  box(mb,bx,0,bz,bw+0.30,0.44,bd+0.30,stone,{ao0:.38,ao1:.66,rg:.96});
  const brickBase=!modern&&r()<0.42;
  if(brickBase){
    const bc=jitc(pick(PAL.brick,r),r,.05);
    box(mb,bx,0.44,bz,bw+0.06,fh*0.96,bd+0.06,bc,{ao0:.52,ao1:.9,rg:.95});
    box(mb,bx,0.44+fh*0.96,bz,bw,wallH-fh*0.96,bd,wall,{ao0:.86,ao1:1,rg:.88});
    box(mb,bx,0.40+fh*0.96,bz,bw+0.18,0.12,bd+0.18,trimC,{ao0:.9,ao1:1,rg:.72});
  } else box(mb,bx,0.44,bz,bw,wallH,bd,wall,{ao0:.52,ao1:1,rg:.88});
  for(const sx of[-1,1])for(const sz of[-1,1])
    box(mb,bx+sx*bw/2,0.44,bz+sz*bd/2,0.15,wallH,0.15,trimC,{ao0:.58,ao1:1,rg:.74});

  // ── roof ───────────────────────────────────────────────────────────────
  const ry=0.44+wallH, ov=0.36+q*0.10;
  if(modern){
    flatRoof(mb,bx,ry,bz,bw,bd,wall,[.40,.40,.41],{h:0.30});
    box(mb,bx,ry-0.1,bz,bw+0.7,0.14,bd+0.7,mixc(wall,[0,0,0],.28),{ao0:.95,ao1:1,rg:.7});
    // a lower single-storey wing gives the modern houses a real silhouette
    const wz=bz+bd/2-1.6;
    box(mb,bx-drvSide*(bw/2+1.5),0.44,wz,3.2,fh,4.6,mixc(wall,[0,0,0],.12),{ao0:.5,ao1:1,rg:.88});
    flatRoof(mb,bx-drvSide*(bw/2+1.5),0.44+fh,wz,3.2,4.6,wall,[.34,.34,.35],{h:0.30});
  } else {
    box(mb,bx,ry,bz,bw+ov*2,0.18,bd+ov*2,trimC,{ao0:.92,ao1:1,rg:.76});  // fascia/soffit
    const pitch=(0.21+r()*0.09)*Math.min(bw,bd);
    if(r()<0.62)hip(mb,bx,ry+0.18,bz,bw+ov*2,bd+ov*2,pitch,roofC,{ridge:0.75});
    else{
      const alongX=r()<0.6;
      if(alongX)gable(mb,bx,ry+0.18,bz,bd+ov*2,pitch,bw+ov*2,roofC,{yaw:PI/2,gableCol:wall});
      else gable(mb,bx,ry+0.18,bz,bw+ov*2,pitch,bd+ov*2,roofC,{gableCol:wall});
      box(mb,bx,ry+0.18+pitch-0.06,bz,alongX?0.26:bw+ov*2,0.13,alongX?bd+ov*2:0.26,
        mixc(roofC,[0,0,0],.28),{ao0:1,ao1:1,rg:.82});
    }
    if(r()<0.5)chimney(mb,bx+(r()<.5?-1:1)*bw*0.32,ry,bz+(r()-.5)*bd*0.3,0.66,pitch+1.0+r()*0.6,
      jitc(pick(PAL.brick,r),r,.05),r);
  }

  // ── openings ───────────────────────────────────────────────────────────
  const glassC=PAL.glassD, ww=modern?1.7:1.10+q*0.18, wh=modern?1.9:1.32+q*0.14;
  const fz=bz-bd/2;
  for(let st=0;st<stories;st++){
    const wy=0.44+st*fh+fh*0.55;
    const nf=modern?2:2+((r()*2)|0);
    for(let i=0;i<nf;i++){
      const off=(i-(nf-1)/2)*(bw/(nf+0.35));
      if(st===0&&Math.abs(off)<1.05)continue;
      window_(mb,bx+off,wy,fz,ww,wh,3,0,trimC,glassC,{mullion:!modern});
      if(!modern&&lvl>=3)for(const sg of[-1,1])
        box(mb,bx+off+sg*(ww/2+0.24),wy,fz-0.03,0.30,wh+0.12,0.07,
          mixc(roofC,[.24,.28,.32],.30),{ao0:.9,ao1:1,rg:.82});
    }
    for(const sx of[-1,1]){const n2=1+((r()*2)|0);
      for(let i=0;i<n2;i++)window_(mb,bx+sx*bw/2,wy,bz+(i-(n2-1)/2)*(bd/(n2+0.55)),
        ww*0.82,wh,sx>0?0:1,0,trimC,glassC,{mullion:!modern});}
    window_(mb,bx+(r()-.5)*bw*0.35,wy,bz+bd/2,ww*(modern?1.3:0.95),wh,2,0,trimC,glassC,{});
  }
  door(mb,bx,0.44,fz,1.05,2.18,0,mixc(roofC,[.55,.22,.16],.45),trimC);
  steps(mb,bx,0,fz-0.6,1.9,0.44,1.2,stone,0,3);

  // ── porch ──────────────────────────────────────────────────────────────
  if(!modern&&r()<0.62){
    const pw=Math.min(bw*0.9,bw-0.5), pd=1.9+r()*0.6, py=0.44+fh*0.90;
    box(mb,bx,0.30,fz-pd/2,pw,0.16,pd,[.60,.58,.54],{ao0:.45,ao1:.78,rg:.94});
    for(const sg of[-1,1])box(mb,bx+sg*(pw/2-0.18),0.46,fz-pd+0.2,0.17,py-0.46,0.17,trimC,{ao0:.6,ao1:1});
    if(pw>4.0)box(mb,bx,0.46,fz-pd+0.2,0.15,py-0.46,0.15,trimC,{ao0:.6,ao1:1});
    box(mb,bx,py,fz-pd/2+0.1,pw+0.4,0.15,pd+0.45,mixc(roofC,[0,0,0],.12),{ao0:.95,ao1:1,rg:.82});
    gable(mb,bx,py+0.15,fz-pd/2+0.1,pd+0.45,0.40,pw+0.4,roofC,{yaw:PI/2,ridge:.14});
    for(const sg of[-1,1])railing(mb,bx+sg*(pw/4+0.35),0.46,fz-pd+0.22,pw/2-0.6,0.94,0,trimC);
    box(mb,bx+0.9,0.44+2.35,fz-0.05,0.15,0.26,0.13,[1,.88,.62],{em:.85,rg:.3});
  }
  if(stories>1&&!modern&&r()<0.42){                      // dormer
    const dw=1.7, dz=fz+0.25;
    box(mb,bx+(r()-.5)*bw*0.3,ry+0.4,dz,dw,1.25,1.5,wall,{ao0:.9,ao1:1,rg:.88});
    gable(mb,bx+(r()-.5)*0,ry+1.65,dz,dw+0.3,0.46,1.7,roofC,{});
    window_(mb,bx,ry+1.02,dz-0.75,0.85,0.85,3,0,trimC,glassC,{});
  }

  // ── garage ─────────────────────────────────────────────────────────────
  const gw=3.3,gd=5.4,gh=2.5;
  const gx=drvX, gz=FRONT+setback+gd/2+0.4;
  if(lvl>=2||r()<0.5){
    box(mb,gx,0,gz,gw+0.24,0.40,gd+0.24,stone,{ao0:.38,ao1:.68,rg:.96});
    box(mb,gx,0.40,gz,gw,gh,gd,wall,{ao0:.52,ao1:1,rg:.88});
    if(modern)flatRoof(mb,gx,0.40+gh,gz,gw,gd,wall,[.34,.34,.35],{h:0.28});
    else{
      box(mb,gx,0.40+gh,gz,gw+0.5,0.15,gd+0.5,trimC,{ao0:.92,ao1:1});
      hip(mb,gx,0.55+gh,gz,gw+0.5,gd+0.5,0.72,roofC,{ridge:.7});}
    rollDoor(mb,gx,0.40,gz-gd/2,gw*0.80,gh*0.80,PI,mixc(trimC,[.55,.55,.58],.55));
    if(r()<0.45)parkedCar(mb,gx,FRONT+3.2,PI/2,r);
  } else if(r()<0.5)parkedCar(mb,drvX,FRONT+4.0,PI/2,r);

  // ── landscaping ────────────────────────────────────────────────────────
  const nb=3+((r()*3)|0);
  for(let i=0;i<nb;i++)bush(mb,bx+(i/(nb-1||1)-0.5)*bw*0.92,0.02,fz-0.85,0.72+r()*0.4,r);
  for(let i=0;i<2+((r()*3)|0);i++)
    bush(mb,(r()-.5)*(LOT_W-1.8),0.02,FRONT+LOT_D*(0.55+r()*0.4),0.6+r()*0.5,r);
  const nt=2+((r()*4)|0);
  for(let i=0;i<nt;i++){
    const tx=(r()-.5)*(LOT_W-2.6), tz=FRONT+1.6+r()*(LOT_D-3.2);
    if(Math.abs(tx-bx)<bw/2+1.1&&Math.abs(tz-bz)<bd/2+1.1)continue;
    if(Math.abs(tx-drvX)<2.0&&tz<FRONT+9.5)continue;
    tree(mb,tx,0,tz,0.95+r()*0.55,r,r()<0.26?1:0);
  }
  if(lvl>=3&&r()<0.62){
    const hc=[.22,.36,.18];
    hedge(mb,0,LOT_D/2-0.7,LOT_W-1.0,0,1.05,hc,r);
    for(const sg of[-1,1])hedge(mb,sg*(LOT_W/2-0.7),(FRONT+LOT_D/2)/1,LOT_D-2.0,PI/2,1.05,hc,r);
  }
  if(lvl>=4&&r()<0.6){                                   // rear patio + shed
    plane(mb,bx,0.035,bz+bd/2+2.0,4.4,3.0,[.52,.50,.47],{rg:.94,ao:.85});
    box(mb,bx+1.6,0.03,bz+bd/2+2.0,1.5,0.72,1.5,[.42,.40,.38],{ao0:.5,rg:.9});
  }
  if(lvl>=3&&r()<0.42){
    const sx2=(r()<.5?-1:1)*(LOT_W/2-1.7);
    box(mb,sx2,0,LOT_D/2-2.0,2.1,2.0,1.9,mixc(wall,[.35,.30,.26],.4),{ao0:.5,ao1:.95,rg:.92});
    gable(mb,sx2,2.0,LOT_D/2-2.0,2.35,0.55,2.1,roofC,{});
  }
  if(lvl>=4)acUnit(mb,bx+bw/2+0.7,0.05,bz+bd*0.25,0.9,r);
  box(mb,-LOT_W/2+1.1,0,FRONT+0.9,0.1,1.0,0.1,[.32,.30,.29],{ao0:.5});
  box(mb,-LOT_W/2+1.1,1.0,FRONT+0.9,0.3,0.24,0.44,[.28,.34,.42],{ao0:.9,rg:.5,mt:.3});
  return mb.build();
}

function genShop(seed,lvl){
  const r=rng(seed), mb=new MeshBuilder();
  const q=(lvl-1)/4;
  const FRONT=-LOT_D/2;
  const glassTower=lvl>=5&&r()<0.6;
  const stories=glassTower?(4+((r()*2)|0)):(lvl<=1?1:lvl<=2?2:lvl<=3?(r()<.5?2:3):3);
  const gh=3.75, fh=3.35;                                 // taller retail ground floor
  const bw=LOT_W-1.6, bd=8.2+q*3.4+r()*1.6;
  const setback=1.5;
  const bz=FRONT+setback+bd/2;
  const bodyRoll=r();
  const body=bodyRoll<0.42?jitc(pick(PAL.brick,r),r,.05)
            :bodyRoll<0.78?jitc(pick(PAL.siding,r),r,.055)
            :jitc(hex([0x4a5560,0x54604f,0x6b5a4a,0x3f4a58][(r()*4)|0]),r,.05);
  const trimC=hex(PAL.trim[(r()*PAL.trim.length)|0]);
  const awC=jitc(pick(PAL.awning,r),r,.06);
  const H=gh+(stories-1)*fh;
  const fz=bz-bd/2;

  plane(mb,0,0.015,0,LOT_W,LOT_D,[.29,.29,.30],{rg:.96,ao:.90});
  plane(mb,0,0.032,FRONT+0.8,LOT_W,1.6,[.46,.46,.45],{rg:.94,ao:.86});

  if(glassTower){
    // curtain-wall block: spandrel bands + continuous glazing, a real skyline piece
    const gcol=[.16,.22,.28];
    box(mb,0,0,bz,bw,H,bd,gcol,{ao0:.5,ao1:1,rg:.18,mt:.6});
    for(let st=0;st<stories;st++){
      const y0=st?gh+(st-1)*fh:0, hgt=st?fh:gh;
      for(const [sx,sz,w2,d2,face] of [[0,-bd/2,bw,0,3],[0,bd/2,bw,0,2],[-bw/2,0,0,bd,1],[bw/2,0,0,bd,0]]){
        const along=w2||d2, n=Math.max(3,Math.round(along/2.1));
        for(let i=0;i<n;i++){
          const off=(i-(n-1)/2)*(along/n);
          const px=sx+(w2?off:0), pz=sz+(d2?off:0);
          box(mb,px,y0+0.30,bz+pz-(d2?0:0)+(sz?0:0)-(sz===0?0:0)+(d2?0:0),
            w2?along/n*0.90:0.10, hgt-0.62, d2?along/n*0.90:0.10,
            PAL.glassD,{ao0:.95,ao1:1,rg:.05,mt:.75,win:1});
        }
        box(mb,sx+(w2?0:0),y0+hgt-0.28,bz+(d2?0:sz),w2?w2+0.16:0.20,0.56,d2?d2+0.16:0.20,
          mixc(body,[0,0,0],.25),{ao0:.9,ao1:1,rg:.55,mt:.3});
      }
    }
    box(mb,0,0,fz,bw*0.7,gh*0.86,0.28,PAL.glassD,{ao0:.95,ao1:1,rg:.05,mt:.7,win:1});
    flatRoof(mb,0,H,bz,bw,bd,mixc(body,[0,0,0],.15),[.40,.40,.41],{h:0.44});
    box(mb,bw*0.2,H+0.05,bz+bd*0.15,3.0,2.6,3.0,mixc(body,[0,0,0],.3),{ao0:.7,ao1:1,rg:.8});
    for(let i=0;i<3;i++)acUnit(mb,(r()-.5)*bw*0.5,H+0.05,bz+(r()-.5)*bd*0.5,1.1,r);
  } else {
    box(mb,0,0,bz,bw,H,bd,body,{ao0:.48,ao1:1,rg:.92});
    // shopfront: bulkhead, glazing bays, mullions, transom, entrance
    box(mb,0,0,fz-0.07,bw,0.62,0.26,mixc(body,[0,0,0],.32),{ao0:.38,ao1:.68,rg:.9});
    const bays=3+((r()*3)|0);
    for(let i=0;i<bays;i++){
      const w=bw/bays, cx=(i-(bays-1)/2)*w;
      if(i===((bays/2)|0)&&bays>2){
        door(mb,cx,0,fz,1.2,2.6,0,mixc(trimC,[.18,.18,.20],.62),trimC);
        box(mb,cx,2.75,fz-0.06,1.45,0.7,0.12,PAL.glassD,{ao0:1,rg:.05,mt:.6,win:1});continue;}
      box(mb,cx,0.62,fz-0.03,w*0.90,gh-1.42,0.10,PAL.glassD,{ao0:.95,ao1:1,rg:.05,mt:.6,win:1});
      for(let m=1;m<3;m++)box(mb,cx+(m/3-0.5)*w*0.90,0.62,fz-0.07,0.08,gh-1.42,0.10,trimC,{ao0:.95,ao1:1});
      box(mb,cx,0.62,fz-0.07,w*0.92,0.10,0.12,trimC,{ao0:1});
      box(mb,cx,gh-0.86,fz-0.07,w*0.92,0.10,0.12,trimC,{ao0:1});
    }
    signBand(mb,0,gh-0.42,fz-0.11,bw*0.96,0.70,0,mixc(body,[0,0,0],.45),r);
    awning(mb,0,gh-0.92,fz,bw*0.9,1.35,0,awC,r);
    for(let st=1;st<stories;st++){
      const wy=gh+(st-1)*fh+fh*0.50, n=Math.max(3,Math.round(bw/2.7));
      for(let i=0;i<n;i++){
        window_(mb,(i-(n-1)/2)*(bw/n),wy,fz,1.25,1.65,3,0,trimC,PAL.glassD,{mullion:1});
        if(lvl>=4&&r()<0.5)                                  // juliet balcony
          box(mb,(i-(n-1)/2)*(bw/n),wy-0.85,fz-0.28,1.5,0.06,0.55,mixc(trimC,[.3,.3,.3],.4),{ao0:.9,rg:.6});
      }
      for(const sx of[-1,1]){const n2=Math.max(2,Math.round(bd/3.4));
        for(let i=0;i<n2;i++)window_(mb,sx*bw/2,wy,bz+(i-(n2-1)/2)*(bd/n2),1.05,1.6,sx>0?0:1,0,trimC,PAL.glassD,{});}
      box(mb,0,gh+(st-1)*fh-0.06,fz-0.08,bw+0.12,0.14,0.16,[.50,.50,.49],{ao0:.95,rg:.8});
    }
    box(mb,0,H,bz,bw+0.20,0.17,bd+0.20,[.50,.50,.49],{ao0:.95,ao1:1,rg:.84});
    // a coloured fascia band under the coping gives the strip real identity
    box(mb,0,H-0.55,bz,bw+0.12,0.55,bd+0.12,awC,{ao0:.9,ao1:1,rg:.7});
    flatRoof(mb,0,H+0.17,bz,bw,bd,mixc(body,[0,0,0],.08),[.40,.40,.41],{h:0.34});
    // rooftop skylights + plant
    for(let i=0;i<2+((r()*3)|0);i++)
      box(mb,(r()-.5)*bw*0.55,H+0.20,bz+(r()-.5)*bd*0.55,1.0,0.24,0.8,
        [.72,.80,.86],{ao0:1,rg:.12,mt:.4,win:.22});
    for(let i=0;i<1+((r()*3)|0);i++)acUnit(mb,(r()-.5)*bw*0.6,H+0.36,bz+(r()-.5)*bd*0.6,1.0+r()*0.4,r);
    for(let i=0;i<2;i++)vent(mb,(r()-.5)*bw*0.7,H+0.36,bz+(r()-.5)*bd*0.7,1,r);
    if(lvl>=3)box(mb,bw*0.26,H+0.36,bz+bd*0.22,1.9,2.2,1.9,mixc(body,[0,0,0],.2),{ao0:.7,ao1:1,rg:.9});
  }

  // ── street furniture & rear service yard ────────────────────────────────
  for(let i=0;i<2;i++){const px=(i?1:-1)*bw*0.3;
    box(mb,px,0.03,FRONT+0.9,1.5,0.44,0.46,[.32,.27,.23],{ao0:.6,rg:.88});
    for(const sd of[-1,1])box(mb,px+sd*0.6,0,FRONT+0.9,0.09,0.44,0.46,[.24,.26,.28],{ao0:.5,mt:.4});}
  for(const sd of[-1,1]){
    cyl(mb,sd*bw*0.44,0.03,FRONT+1.0,0.38,0.62,10,[.38,.36,.34],{rg:.95,ao0:.6});
    bush(mb,sd*bw*0.44,0.65,FRONT+1.0,0.8,r);}
  const yz=LOT_D/2-2.4;
  plane(mb,0,0.034,yz,LOT_W-1.0,4.2,[.24,.24,.25],{rg:.95,ao:.84});
  box(mb,bw*0.28,0,yz,2.0,1.3,1.2,[.20,.40,.32],{ao0:.5,ao1:.9,rg:.78,mt:.25});
  box(mb,bw*0.28,1.3,yz,2.06,0.13,1.26,[.16,.32,.26],{ao0:.95,rg:.72,mt:.3});
  for(let i=0;i<3;i++)plane(mb,-bw*0.34+i*2.4,0.04,yz,0.12,4.0,[.80,.80,.74],{ao:.9});
  if(r()<0.5)parkedCar(mb,-bw*0.22,yz,0,r);
  return mb.build();
}

function genIndustry(seed,lvl){
  const r=rng(seed), mb=new MeshBuilder();
  const q=(lvl-1)/4;
  const FRONT=-LOT_D/2;
  const body=jitc(pick(PAL.ind,r),r,.045);
  const trimC=mixc(body,[0,0,0],.38);
  const roofC=mixc(body,[.22,.24,.28],.6);
  const bw=LOT_W-1.4, bd=9.5+q*3.2+r()*1.6;
  const H=5.0+q*2.8+r()*1.0;
  const bz=FRONT+5.2+bd/2;

  plane(mb,0,0.015,0,LOT_W,LOT_D,[.33,.33,.33],{rg:.97,ao:.90});
  plane(mb,0,0.034,FRONT+2.6,LOT_W,5.2,[.26,.26,.27],{rg:.95,ao:.84});   // hardstand

  corrugate(mb,0,0,bz,bw,H,bd,body,r,0);
  box(mb,0,H,bz,bw+0.36,0.26,bd+0.36,trimC,{ao0:.92,ao1:1,rg:.62,mt:.35});
  gable(mb,0,H+0.26,bz,bw+0.36,1.2+q*0.5,bd+0.36,roofC,{rg:.62,gableCol:body});
  for(const sx of[-1,1]){const n=Math.max(3,Math.round(bd/2.6));
    for(let i=0;i<n;i++)box(mb,sx*(bw/2+0.03),H-1.35,bz+(i-(n-1)/2)*(bd/n),0.09,1.05,bd/n*0.70,
      PAL.glassD,{ao0:1,rg:.1,mt:.5,win:.42});}
  const nf=Math.max(2,Math.round(bw/3.6));
  for(let i=0;i<nf;i++)box(mb,(i-(nf-1)/2)*(bw/nf),H-1.35,bz-bd/2-0.03,bw/nf*0.62,1.0,0.09,
    PAL.glassD,{ao0:1,rg:.1,mt:.5,win:.42});

  // loading dock: raised platform, roll-up doors, bollards, canopy
  const nd=1+(lvl>=3?1:0);
  for(let i=0;i<nd;i++){
    const dx=(i-(nd-1)/2)*(bw*0.44);
    rollDoor(mb,dx,1.05,bz-bd/2,3.4,3.2,PI,mixc(body,[1,1,1],.18));
    box(mb,dx,0,bz-bd/2-1.3,3.9,1.05,2.6,[.40,.39,.38],{ao0:.42,ao1:.78,rg:.95});
    box(mb,dx,1.05,bz-bd/2-1.3,3.9,0.1,2.6,[.28,.27,.26],{ao0:.9,rg:.9});
    box(mb,dx,4.4,bz-bd/2-1.5,4.4,0.16,3.0,trimC,{ao0:.95,rg:.6,mt:.35});
    for(const sd of[-1,1])box(mb,dx+sd*2.0,0.4,bz-bd/2-2.6,0.24,0.85,0.24,[.86,.68,.12],{ao0:.7,rg:.65});}
  door(mb,-bw*0.42,0,bz-bd/2,1.05,2.2,0,trimC,mixc(body,[1,1,1],.32));
  box(mb,-bw*0.42,2.62,bz-bd/2-0.09,0.95,0.2,0.16,[1,.86,.5],{em:.85,rg:.3});

  if(r()<0.72){                                        // stack
    const cx=bw*0.35, cz=bz+bd*0.3, ch=H+3.0+r()*3.0;
    cyl(mb,cx,0,cz,0.58,ch,12,mixc([.70,.69,.66],body,.4),{rg:.86,ao0:.5});
    for(let i=0;i<3;i++)cyl(mb,cx,ch*(0.30+i*0.22),cz,0.66,0.15,12,[.58,.22,.18],{rg:.76,mt:.3});
    cyl(mb,cx,ch,cz,0.66,0.32,12,[.22,.21,.20],{rg:.92});
    box(mb,cx,ch+0.34,cz,0.34,0.34,0.34,[1,.24,.18],{em:.9});}
  if(lvl>=2&&r()<0.68){                                // silo pair + pipe bridge
    const sx=-bw*0.3, sz=bz+bd*0.34;
    for(let i=0;i<2;i++){
      const hh=5.0+r()*1.8;
      cyl(mb,sx+i*2.05,0,sz,0.95,hh,14,[.78,.77,.74],{rg:.6,mt:.25,ao0:.45});
      cyl(mb,sx+i*2.05,hh,sz,0.95,1.0,14,[.62,.61,.58],{r2:0.12,rg:.6,mt:.3});}
    pipeRun(mb,sx+1.0,3.8,sz-1.3,3.8,0.16,0,[.52,.56,.58]);}
  if(lvl>=3){
    for(let i=0;i<2;i++)cyl(mb,-bw*0.32+i*2.4,0,LOT_D/2-2.4,1.05,2.5,14,[.58,.62,.65],{rg:.5,mt:.5,ao0:.5});
    pipeRun(mb,-bw*0.32+1.2,2.7,LOT_D/2-2.4,3.0,0.18,0,[.48,.52,.54]);}
  const cont=[[.68,.26,.18],[.18,.36,.52],[.52,.50,.18],[.28,.42,.32],[.60,.58,.55]];
  for(let i=0;i<1+((r()*3)|0);i++){
    const c=cont[(r()*cont.length)|0], cx=(r()-.5)*(LOT_W-4), cz=LOT_D/2-1.8-r()*2.0;
    const yw=r()<.5?0:PI/2;
    box(mb,cx,0,cz,6.0,2.6,2.4,c,{yaw:yw,ao0:.5,ao1:.95,rg:.68,mt:.3});
    box(mb,cx,2.6,cz,6.1,0.11,2.5,mixc(c,[0,0,0],.28),{yaw:yw,ao0:.95,rg:.62,mt:.35});
    for(let k=0;k<9;k++)box(mb,cx+(yw?0:(k/8-0.5)*5.7),1.3,cz+(yw?(k/8-0.5)*5.7:0),
      yw?2.42:0.10,2.4,yw?0.10:2.42,mixc(c,[1,1,1],.07),{yaw:yw,ao0:.55,ao1:.95,rg:.68,mt:.3});}
  for(const sd of[-1,1]){
    const px=sd*(LOT_W/2-0.8);
    cyl(mb,px,0,FRONT+4.2,0.14,7.0,8,[.40,.42,.44],{rg:.6,mt:.4,ao0:.5});
    box(mb,px,7.0,FRONT+4.2,0.8,0.32,0.5,[.46,.48,.50],{rg:.5,mt:.5});
    box(mb,px,6.84,FRONT+4.4,0.68,0.13,0.4,[1,.94,.72],{em:.42,rg:.2});}
  if(r()<0.6)parkedCar(mb,bw*0.2,FRONT+3.0,0,r);
  fence(mb,0,0,LOT_W-0.5,LOT_D-0.5,0,[.42,.44,.46],r,2.0);
  return mb.build();
}

/*── VEHICLES ────────────────────────────────────────────────────────────────
  Forward is +X. Bodies are tinted per-instance, so one mesh yields a whole
  colour range; glass and lamps ride on the material channel.                */
function wheel(mb,x,y,z,r_,w){
  cyl(mb,x,y,z-w/2,r_,w,10,[.09,.09,.10],{rg:.95,ao0:.55,ao1:.75,capBottom:1});
  cyl(mb,x,y,z-w/2-0.005,r_*0.55,w+0.01,8,[.55,.58,.62],{rg:.35,mt:.85,ao0:.9,ao1:1,capBottom:1});
}
function genCar(seed,kind){
  const r=rng(seed), mb=new MeshBuilder();
  const body=[1,1,1];                                  // white — tinted per instance
  const glass=PAL.glassD, dark=[.13,.13,.14];
  const L=kind===2?4.9:kind===1?4.35:4.1, W=1.82, wr=0.33;
  const bh=kind===2?0.85:0.62, ch=kind===2?0.80:0.72;
  box(mb,0,wr*0.55,0,L,bh,W,body,{ao0:.42,ao1:.95,rg:.20,mt:.35});
  box(mb,0,wr*0.55+bh,0,L*0.60,0.06,W*0.98,body,{ao0:.95,ao1:1,rg:.2,mt:.35});
  // cabin
  const cz=kind===3?-0.35:0.0;                          // pickup: cab forward
  const cl=kind===3?L*0.38:L*0.52;
  box(mb,cz*L*0.2,wr*0.55+bh,0,cl,ch,W*0.86,body,{ao0:.9,ao1:1,rg:.2,mt:.35});
  box(mb,cz*L*0.2,wr*0.55+bh+ch,0,cl*0.9,0.05,W*0.8,mixc(body,[0,0,0],.15),{ao0:1,rg:.25,mt:.4});
  // glazing
  for(const s of[-1,1])box(mb,cz*L*0.2,wr*0.55+bh+ch*0.55,s*W*0.43,cl*0.9,ch*0.62,0.04,glass,
    {ao0:1,rg:.04,mt:.7,win:.5});
  box(mb,cz*L*0.2+cl*0.47,wr*0.55+bh+ch*0.55,0,0.05,ch*0.66,W*0.8,glass,{ao0:1,rg:.04,mt:.7,win:.5});
  box(mb,cz*L*0.2-cl*0.47,wr*0.55+bh+ch*0.52,0,0.05,ch*0.6,W*0.8,glass,{ao0:1,rg:.04,mt:.7,win:.5});
  if(kind===3){ // pickup bed
    box(mb,-L*0.28,wr*0.55+bh,0,L*0.42,0.42,W*0.9,body,{ao0:.9,ao1:1,rg:.25,mt:.3});
    box(mb,-L*0.28,wr*0.55+bh+0.06,0,L*0.36,0.36,W*0.7,dark,{ao0:.6,rg:.85});}
  // bumpers, grille, lamps
  for(const s of[-1,1])box(mb,s*L*0.49,wr*0.55+bh*0.32,0,0.12,0.30,W*0.94,dark,{ao0:.6,rg:.6,mt:.4});
  box(mb,L*0.485,wr*0.55+bh*0.72,0,0.06,0.22,W*0.7,dark,{ao0:.8,rg:.4,mt:.6});
  for(const s of[-1,1]){
    box(mb,L*0.492,wr*0.55+bh*0.75,s*W*0.33,0.05,0.19,0.42,[1,.97,.88],{em:.55,rg:.15});
    box(mb,-L*0.492,wr*0.55+bh*0.78,s*W*0.34,0.05,0.16,0.36,[1,.22,.16],{em:.45,rg:.15});}
  for(const s of[-1,1])box(mb,cz*L*0.2+cl*0.42,wr*0.55+bh+ch*0.62,s*W*0.5,0.16,0.10,0.12,dark,{ao0:.9,mt:.5});
  const wb=L*0.31;
  for(const sx of[-1,1])for(const sz of[-1,1])wheel(mb,sx*wb,wr,sz*(W*0.5+0.03),wr,0.24);
  for(const sx of[-1,1])box(mb,sx*wb,wr*0.98,0,wr*2.3,wr*1.1,W+0.14,mixc(body,[0,0,0],.30),{ao0:.35,ao1:.6,rg:.6});
  return mb.build();
}
function genTruck(seed){
  const r=rng(seed), mb=new MeshBuilder(), body=[1,1,1], dark=[.13,.13,.14];
  const wr=0.46;
  box(mb,2.1,wr*0.5,0,2.6,1.05,2.35,body,{ao0:.45,ao1:.95,rg:.25,mt:.35});
  box(mb,2.2,wr*0.5+1.05,0,2.2,1.55,2.3,body,{ao0:.9,ao1:1,rg:.22,mt:.35});
  for(const s of[-1,1])box(mb,2.2,wr*0.5+1.9,s*1.14,1.9,0.85,0.05,PAL.glassD,{ao0:1,rg:.04,mt:.7,win:.5});
  box(mb,3.26,wr*0.5+1.9,0,0.06,0.95,2.2,PAL.glassD,{ao0:1,rg:.04,mt:.7,win:.5});
  box(mb,-1.5,wr*0.5+0.75,0,5.6,2.55,2.45,[.93,.93,.95],{ao0:.55,ao1:1,rg:.55,mt:.2});
  for(let i=0;i<7;i++)box(mb,-4.2+i*0.9,wr*0.5+0.75,0,0.09,2.5,2.5,[.80,.80,.82],{ao0:.6,ao1:1,rg:.5,mt:.25});
  box(mb,-1.5,wr*0.5+0.4,0,5.7,0.2,2.5,dark,{ao0:.4,rg:.8});
  for(const s of[-1,1])box(mb,3.42,wr*0.5+0.55,s*0.85,0.06,0.24,0.45,[1,.97,.88],{em:.55,rg:.15});
  for(const s of[-1,1])box(mb,-4.3,wr*0.5+0.75,s*1.0,0.06,0.2,0.4,[1,.22,.16],{em:.45});
  for(const sx of[2.3,-0.4,-2.6,-3.6])for(const sz of[-1,1])wheel(mb,sx,wr,sz*1.12,wr,0.28);
  return mb.build();
}
function genBus(seed){
  const mb=new MeshBuilder(), body=[1,1,1], wr=0.42;
  box(mb,0,wr*0.5,0,10.4,2.55,2.55,body,{ao0:.45,ao1:1,rg:.25,mt:.35});
  box(mb,0,wr*0.5+2.55,0,10.2,0.1,2.5,mixc(body,[0,0,0],.12),{ao0:1,rg:.3});
  for(const s of[-1,1])for(let i=0;i<6;i++)
    box(mb,-4.2+i*1.7,wr*0.5+1.72,s*1.27,1.45,0.95,0.05,PAL.glassD,{ao0:1,rg:.04,mt:.7,win:1});
  box(mb,5.22,wr*0.5+1.72,0,0.06,1.15,2.4,PAL.glassD,{ao0:1,rg:.04,mt:.7,win:1});
  box(mb,-5.22,wr*0.5+1.72,0,0.06,1.05,2.4,PAL.glassD,{ao0:1,rg:.04,mt:.7,win:1});
  box(mb,0,wr*0.5+0.6,0,10.5,0.28,2.6,[.13,.13,.15],{ao0:.4,rg:.7});
  box(mb,5.0,wr*0.5+2.2,0,0.5,0.3,1.6,[1,.85,.4],{em:.7,rg:.2});
  for(const s of[-1,1])box(mb,5.28,wr*0.5+0.85,s*1.0,0.05,0.24,0.5,[1,.97,.88],{em:.55});
  for(const sx of[3.5,-2.6,-3.7])for(const sz of[-1,1])wheel(mb,sx,wr,sz*1.2,wr,0.26);
  return mb.build();
}
/*── CITIZENS ────────────────────────────────────────────────────────────────
  Walk cycle without skinning: four baked stride poses; the agent is pushed
  into whichever pose-batch matches its gait phase this frame.               */
function genPed(seed,pose){
  const r=rng(seed), mb=new MeshBuilder();
  const skin=[[.86,.68,.55],[.68,.49,.36],[.45,.32,.24],[.93,.78,.66],[.55,.40,.30]][(r()*5)|0];
  const shirt=[1,1,1];                            // tinted per instance
  const pants=jitc([.24,.27,.34],r,.14);
  const hair=[[.12,.09,.07],[.32,.20,.10],[.55,.44,.28],[.18,.14,.12],[.60,.60,.62]][(r()*5)|0];
  const h=1.62+r()*0.20, s=h/1.7;
  const ph=pose/4*TAU, swing=Math.sin(ph)*0.30, lift=Math.abs(Math.cos(ph))*0.06;
  // legs
  for(const sd of[-1,1]){
    const a=swing*sd;
    const lx=Math.sin(a)*0.22*s;
    box(mb,lx*0.5,0.06*s+lift*s,sd*0.11*s,0.19*s,0.80*s,0.19*s,pants,
      {ao0:.45,ao1:.85,rg:.9,yaw:0});
    box(mb,lx,0.02*s+lift*s,sd*0.11*s,0.30*s,0.10*s,0.20*s,[.15,.14,.16],{ao0:.4,ao1:.7,rg:.7});
  }
  // torso + arms + head
  box(mb,0,0.84*s,0,0.30*s,0.52*s,0.42*s,shirt,{ao0:.8,ao1:1,rg:.85});
  box(mb,0,1.34*s,0,0.26*s,0.10*s,0.36*s,skin,{ao0:.95,ao1:1,rg:.7});
  for(const sd of[-1,1]){
    const a=-swing*sd, ax=Math.sin(a)*0.20*s;
    box(mb,ax,0.86*s,sd*0.25*s,0.15*s,0.46*s,0.15*s,shirt,{ao0:.85,ao1:1,rg:.85});
    box(mb,ax*1.6,0.82*s,sd*0.25*s,0.13*s,0.12*s,0.13*s,skin,{ao0:.85,rg:.7});
  }
  box(mb,0,1.44*s,0,0.24*s,0.26*s,0.24*s,skin,{ao0:1,ao1:1,rg:.65});
  box(mb,0,1.60*s,0,0.27*s,0.11*s,0.27*s,hair,{ao0:1,ao1:1,rg:.85});
  box(mb,0.11*s,1.63*s,0,0.09*s,0.06*s,0.26*s,hair,{ao0:1,rg:.85});
  return mb.build();
}

/*── PROPS & UTILITY STRUCTURES ─────────────────────────────────────────────*/
function genStreetlight(){
  const mb=new MeshBuilder(), m=[.46,.46,.45];
  cyl(mb,0,0,0,0.20,0.22,8,[.35,.35,.36],{rg:.9});
  cyl(mb,0,0.2,0,0.105,6.6,8,m,{r2:0.08,rg:.55,mt:.5,ao0:.5});
  for(let i=0;i<4;i++)box(mb,i*0.26,6.66+i*0.085,0,0.28,0.10,0.10,m,{rg:.55,mt:.5,ao0:.95});
  box(mb,1.06,6.86,0,0.68,0.15,0.28,m,{rg:.55,mt:.5,ao0:1});
  box(mb,1.06,6.75,0,0.56,0.09,0.22,[1,.93,.72],{em:1,rg:.2});
  return mb.build();
}
function genTrafficLight(){
  const mb=new MeshBuilder(), m=[.24,.26,.28];
  cyl(mb,0,0,0,0.22,0.2,8,[.32,.32,.33],{rg:.9});
  cyl(mb,0,0.2,0,0.09,5.2,8,m,{rg:.5,mt:.6,ao0:.5});
  for(let i=0;i<3;i++)box(mb,i*0.4,5.25,0,0.42,0.10,0.10,m,{rg:.5,mt:.6,ao0:.95});
  box(mb,1.25,4.85,0,0.30,0.90,0.28,m,{rg:.6,ao0:1});
  const lc=[[1,.2,.15],[1,.78,.2],[.25,1,.4]];
  for(let i=0;i<3;i++)box(mb,1.11,5.15-i*0.28,0,0.07,0.17,0.17,lc[i],{em:i===2?.9:.12,rg:.2});
  return mb.build();
}
function genPole(){                                   // power distribution pole
  const mb=new MeshBuilder(), w=[.40,.33,.26];
  cyl(mb,0,0,0,0.16,9.0,7,w,{r2:0.12,rg:.95,ao0:.45});
  box(mb,0,8.35,0,0.16,0.16,2.6,w,{ao0:.95,rg:.95});
  box(mb,0,7.55,0,0.14,0.14,2.0,w,{ao0:.9,rg:.95});
  for(const s of[-1,1]){
    for(const y of[8.5,7.7])for(const o of[0.55,1.1])
      cyl(mb,0,y,s*o,0.055,0.24,6,[.35,.42,.50],{rg:.35,mt:.6});
    box(mb,0,7.55,s*0.75,0.28,0.5,0.28,[.42,.45,.48],{ao0:.9,rg:.5,mt:.5});}
  box(mb,0,6.1,0,0.42,0.62,0.36,[.48,.50,.52],{ao0:.85,rg:.6,mt:.4});
  return mb.build();
}
function genHydrant(){
  const mb=new MeshBuilder(), c=[.72,.14,.12];
  cyl(mb,0,0,0,0.20,0.10,8,[.4,.4,.4],{rg:.9});
  cyl(mb,0,0.10,0,0.14,0.62,8,c,{rg:.5,mt:.3,ao0:.6});
  cyl(mb,0,0.72,0,0.17,0.10,8,c,{rg:.5,mt:.3});
  cyl(mb,0,0.82,0,0.10,0.12,8,c,{rg:.5,mt:.3});
  for(const s of[-1,1])cyl(mb,s*0.16,0.42,0,0.07,0.10,6,c,{rg:.5,mt:.3});
  return mb.build();
}
function genWindTurbine(bladeAngle){
  const mb=new MeshBuilder(), w=[.95,.95,.96];
  cyl(mb,0,0,0,2.2,0.5,14,[.62,.62,.63],{rg:.94,ao0:.5});
  cyl(mb,0,0.5,0,1.15,34,14,w,{r2:0.65,rg:.42,mt:.15,ao0:.6});
  box(mb,0,34.5,0.4,2.4,1.9,4.6,w,{ao0:.95,ao1:1,rg:.4,mt:.2});
  cyl(mb,0,35.2,-2.4,0.75,1.1,12,mixc(w,[0,0,0],.15),{rg:.4,mt:.3});
  for(let i=0;i<3;i++){
    const a=bladeAngle+i*TAU/3, ca=Math.cos(a), sa=Math.sin(a);
    for(let k=0;k<5;k++){const t=k/5, t2=(k+1)/5, L=17;
      const y1=35.2+ca*L*t, x1=sa*L*t, y2=35.2+ca*L*t2, x2=sa*L*t2;
      box(mb,(x1+x2)/2,(y1+y2)/2,-2.9,Math.hypot(x2-x1,y2-y1)*0+0.9*(1-t*0.72)+0.25,
        Math.hypot(x2-x1,y2-y1),0.22*(1-t*0.5),w,{yaw:0,ao0:.9,ao1:1,rg:.4});}
  }
  box(mb,0,52,-2.9,0.3,0.3,0.3,[1,.25,.2],{em:.9});
  return mb.build();
}
function genPowerPlant(){
  const mb=new MeshBuilder(), c=[.60,.60,.62], d=[.44,.45,.47];
  plane(mb,0,0.02,0,44,32,[.33,.33,.34],{rg:.96,ao:.86});
  corrugate(mb,-6,0,2,22,11,17,c,rng(7),0);
  box(mb,-6,11,2,22.4,0.4,17.4,d,{ao0:.95,rg:.6,mt:.3});
  gable(mb,-6,11.4,2,22.4,2.6,17.4,mixc(c,[.2,.2,.25],.5),{});
  for(let i=0;i<6;i++)box(mb,-15+i*3.6,8.4,-6.55,2.4,1.6,0.1,PAL.glassD,{ao0:1,rg:.1,mt:.5,win:.8});
  for(const x of[9,15.5]){
    cyl(mb,x,0,-3,3.1,26,16,[.86,.85,.83],{r2:2.5,rg:.85,ao0:.5});
    for(let i=0;i<3;i++)cyl(mb,x,7+i*7,-3,3.3-i*0.2,0.6,16,[.62,.22,.18],{rg:.75});
    cyl(mb,x,26,-3,2.6,0.9,16,[.30,.29,.28],{rg:.9});
    box(mb,x,27,-3,0.4,0.4,0.4,[1,.25,.2],{em:.9});}
  for(let i=0;i<3;i++)cyl(mb,4+i*3,0,11,2.0,7,12,[.68,.70,.72],{rg:.55,mt:.35,ao0:.5});
  pipeRun(mb,7,7.6,11,7,0.3,0,[.52,.56,.58]);
  for(let i=0;i<4;i++)box(mb,-16+i*2.6,0,12,4.4,3.0,7,[.24,.24,.25],{ao0:.4,ao1:.8,rg:.95});
  for(const s of[-1,1])for(const t of[-1,1]){
    cyl(mb,s*20,0,t*13,0.18,9,8,[.44,.46,.48],{rg:.6,mt:.4});
    box(mb,s*20,8.8,t*13,0.9,0.3,0.6,[.9,.88,.6],{em:.38,rg:.2});}
  fence(mb,0,0,44,32,0,[.44,.46,.48],rng(3),2.2);
  return mb.build();
}
function genWaterPump(){
  const mb=new MeshBuilder(), c=[.80,.82,.84];
  plane(mb,0,0.02,0,20,16,[.36,.36,.37],{rg:.96,ao:.88});
  box(mb,-3,0,0,10,4.6,9,c,{ao0:.5,ao1:1,rg:.7});
  box(mb,-3,4.6,0,10.4,0.35,9.4,[.52,.56,.60],{ao0:.95,rg:.6,mt:.3});
  gable(mb,-3,4.95,0,10.4,1.5,9.4,[.34,.42,.50],{});
  for(let i=0;i<4;i++)box(mb,-6.6+i*2.3,3.0,-4.55,1.5,1.2,0.09,PAL.glassD,{ao0:1,rg:.1,mt:.5,win:.85});
  door(mb,-3,0,-4.5,1.2,2.3,0,[.30,.36,.42],[.75,.78,.80]);
  for(let i=0;i<3;i++)cyl(mb,4.5,0,-3+i*3,1.5,3.6,14,[.72,.78,.82],{rg:.45,mt:.4,ao0:.5});
  pipeRun(mb,4.5,4.0,0,7.2,0.3,PI/2,[.35,.55,.72]);
  pipeRun(mb,0,1.2,5.2,14,0.35,0,[.35,.55,.72]);
  for(let i=0;i<3;i++)cyl(mb,-8+i*7,1.2,5.2,0.5,0.9,10,[.30,.48,.66],{rg:.5,mt:.4});
  fence(mb,0,0,20,16,0,[.46,.48,.50],rng(5),1.9);
  return mb.build();
}
function genWaterTower(){
  const mb=new MeshBuilder(), c=[.84,.86,.88];
  for(const sx of[-1,1])for(const sz of[-1,1])
    cyl(mb,sx*2.5,0,sz*2.5,0.24,14,8,[.55,.58,.60],{r2:0.16,rg:.55,mt:.5,ao0:.5});
  for(const y of[4.5,9.5])for(let i=0;i<4;i++){
    const a=i*PI/2, x=Math.cos(a)*2.5, z=Math.sin(a)*2.5;
    box(mb,x*0+ (i%2?0:0),y,0,i%2?0.14:5.2,0.14,i%2?5.2:0.14,[.55,.58,.60],{ao0:.9,rg:.55,mt:.5});}
  cyl(mb,0,14,0,4.4,5.4,16,c,{r2:3.6,rg:.5,mt:.25,ao0:.7});
  cyl(mb,0,12.6,0,3.0,1.4,16,c,{r2:4.4,rg:.5,mt:.25,ao0:.6});
  cyl(mb,0,19.4,0,3.6,1.3,16,mixc(c,[.3,.45,.6],.4),{r2:1.2,rg:.5,mt:.3});
  box(mb,0,20.6,0,0.35,0.35,0.35,[1,.25,.2],{em:.9});
  cyl(mb,0,0,0,0.32,14,8,[.62,.66,.70],{rg:.5,mt:.4,ao0:.5});
  return mb.build();
}
function genSewage(){
  const mb=new MeshBuilder();
  plane(mb,0,0.02,0,26,22,[.34,.34,.35],{rg:.96,ao:.86});
  for(let i=0;i<2;i++)for(let j=0;j<2;j++){
    const x=-6+i*11, z=-5+j*10;
    cyl(mb,x,0,z,4.2,1.9,18,[.60,.60,.58],{rg:.94,ao0:.5});
    cyl(mb,x,1.5,z,3.9,0.4,18,[.26,.34,.30],{rg:.25,mt:.3,em:.03});
    box(mb,x,1.9,z,8.6,0.2,0.5,[.52,.54,.56],{ao0:.95,rg:.6,mt:.4});
    cyl(mb,x,1.9,z,0.36,1.3,8,[.48,.52,.55],{rg:.5,mt:.5});}
  box(mb,8,0,7,6,3.6,5,[.72,.72,.70],{ao0:.5,ao1:1,rg:.8});
  gable(mb,8,3.6,7,6.3,1.2,5.3,[.38,.40,.44],{});
  door(mb,8,0,4.5,1.1,2.2,0,[.34,.36,.40],[.80,.80,.78]);
  pipeRun(mb,0,0.9,-10.5,24,0.4,0,[.50,.42,.30]);
  fence(mb,0,0,26,22,0,[.46,.48,.50],rng(9),1.9);
  return mb.build();
}
