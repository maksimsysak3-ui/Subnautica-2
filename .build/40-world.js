/*═══════ WORLD ════════════════════════════════════════════════════════════*/
const MAP=640, HALF=MAP/2;
const TC=4;                       // terrain cell size (m)
const TN=MAP/TC;                  // terrain verts per side
const GC=8, GN=MAP/GC;            // data-grid cell size / count (land value, pollution…)
const WATER_Y=0;

// ── terrain heightfield ────────────────────────────────────────────────────
const terrainH=new Float32Array((TN+1)*(TN+1));
function terrainAt(x,z){                          // analytic — the mesh samples this
  const nx=(x+HALF)/MAP, nz=(z+HALF)/MAP;
  let h=fbm(nx*3.1+11.3,nz*3.1+7.7,4)*13.0-3.4;
  h+=fbm(nx*9.0,nz*9.0,3)*2.2-1.1;
  // a bay eats into the south-east corner; the shore is a soft noisy curve
  const bay=(nx*0.62+nz*0.85)-1.06+ (fbm(nx*5.0+3.0,nz*5.0,3)-0.5)*0.20;
  h-=smooth(sat(bay*7.0))*16.0;
  // flatten the central buildable plateau so the grid stays workable
  const d=Math.max(Math.abs(nx-0.42),Math.abs(nz-0.40))*2.0;
  h=lerp(h*0.30+1.7,h,sat((d-0.45)*2.1));
  return h;
}
for(let j=0;j<=TN;j++)for(let i=0;i<=TN;i++)
  terrainH[j*(TN+1)+i]=terrainAt(-HALF+i*TC,-HALF+j*TC);
function groundY(x,z){                             // bilinear sample, clamped
  const fx=clamp((x+HALF)/TC,0,TN-0.001), fz=clamp((z+HALF)/TC,0,TN-0.001);
  const i=fx|0,j=fz|0,u=fx-i,v=fz-j,S=TN+1;
  const a=terrainH[j*S+i],b=terrainH[j*S+i+1],c=terrainH[(j+1)*S+i],d=terrainH[(j+1)*S+i+1];
  return lerp(lerp(a,b,u),lerp(c,d,u),v);
}
function buildTerrain(){                           // chunked so culling can drop most of it
  const CH=8, CS=TN/CH, out=[];
  const rock=[.31,.30,.28], sand=[.62,.57,.44], grass=[.190,.235,.132], dry=[.268,.268,.158],
        lush=[.132,.192,.108];
  for(let cj=0;cj<CH;cj++)for(let ci=0;ci<CH;ci++){
    const mb=new MeshBuilder();
    const i0=ci*CS,j0=cj*CS;
    for(let j=j0;j<=j0+CS;j++)for(let i=i0;i<=i0+CS;i++){
      const x=-HALF+i*TC,z=-HALF+j*TC,y=terrainH[j*(TN+1)+i];
      const hl=terrainH[j*(TN+1)+Math.max(0,i-1)],hr=terrainH[j*(TN+1)+Math.min(TN,i+1)];
      const hd=terrainH[Math.max(0,j-1)*(TN+1)+i],hu=terrainH[Math.min(TN,j+1)*(TN+1)+i];
      const nx=(hl-hr)/(2*TC),nz=(hd-hu)/(2*TC),nl=Math.hypot(nx,1,nz);
      const slope=1-1/nl;
      let c=mixc(grass,dry,sat(fbm(x*0.011+40,z*0.011,3)*1.5-0.30));
      c=mixc(c,lush,sat(fbm(x*0.024+91,z*0.024+13,3)*1.7-0.52));
      c=mixc(c,rock,sat(slope*6.0-0.50));
      c=mixc(c,sand,sat((1.9-y)*0.80)*sat(1-slope*4));
      c=jitc(c,rng((i*73856093^j*19349663)>>>0),0.055);
      mb.vert(x,y,z,nx/nl,1/nl,nz/nl,c,1,0,.97,0,0);
    }
    const W=CS+1;
    for(let j=0;j<CS;j++)for(let i=0;i<CS;i++){
      const a=j*W+i;mb.quad(a,a+W,a+W+1,a+1);}
    out.push(mb.build());
  }
  return out;
}

// ── road network ───────────────────────────────────────────────────────────
const RTYPE={
  street:{w:11.0,lanes:2,speed:12,cap:1100,cost:14,name:'Two-Lane Street',sw:2.9,verge:1.4},
  avenue:{w:18.0,lanes:4,speed:17,cap:2800,cost:34,name:'Four-Lane Avenue',sw:3.4,verge:1.8,median:1.6},
};
let NID=0,EID=0;
const nodes=new Map(), edges=new Map();
function addNode(x,z){
  for(const n of nodes.values())if(dist2(n.x,n.z,x,z)<36)return n;   // weld within 6 m
  const n={id:NID++,x,z,y:groundY(x,z),e:[],tl:false};nodes.set(n.id,n);return n;
}
function addEdge(a,b,type,ctrl){
  if(a===b)return null;
  for(const id of a.e){const e=edges.get(id);if(e.a===b.id||e.b===b.id)return e;}
  const e={id:EID++,a:a.id,b:b.id,type,ctrl:ctrl||null,pipe:false,pts:null,len:0,
           lots:[],flow:0,load:0,cong:0};
  sampleEdge(e); edges.set(e.id,e); a.e.push(e.id); b.e.push(e.id);
  return e;
}
function edgePt(e,t){
  const A=nodes.get(e.a),B=nodes.get(e.b);
  if(!e.ctrl)return {x:lerp(A.x,B.x,t),z:lerp(A.z,B.z,t)};
  const it=1-t, w0=it*it, w1=2*it*t, w2=t*t;
  return {x:A.x*w0+e.ctrl.x*w1+B.x*w2, z:A.z*w0+e.ctrl.z*w1+B.z*w2};
}
function edgeTan(e,t){
  const A=nodes.get(e.a),B=nodes.get(e.b);
  if(!e.ctrl){const dx=B.x-A.x,dz=B.z-A.z,l=Math.hypot(dx,dz)||1;return{x:dx/l,z:dz/l};}
  const dx=2*((1-t)*(e.ctrl.x-A.x)+t*(B.x-e.ctrl.x));
  const dz=2*((1-t)*(e.ctrl.z-A.z)+t*(B.z-e.ctrl.z));
  const l=Math.hypot(dx,dz)||1;return{x:dx/l,z:dz/l};
}
function sampleEdge(e){
  const A=nodes.get(e.a),B=nodes.get(e.b);
  const chord=dist(A.x,A.z,B.x,B.z);
  const n=e.ctrl?clamp(Math.round(chord/3.5)+4,6,64):Math.max(2,Math.round(chord/6)+1);
  const pts=[];let len=0,px=0,pz=0;
  for(let i=0;i<n;i++){const t=i/(n-1),p=edgePt(e,t);
    p.y=groundY(p.x,p.z); p.t=t;
    if(i)len+=dist(px,pz,p.x,p.z);
    p.s=len; px=p.x;pz=p.z; pts.push(p);}
  e.pts=pts;e.len=len;
}
function edgeAtLen(e,s){                             // arc-length → point + tangent
  const P=e.pts;let i=1;
  while(i<P.length-1&&P[i].s<s)i++;
  const a=P[i-1],b=P[i],f=(s-a.s)/Math.max(1e-4,b.s-a.s);
  const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;
  return {x:lerp(a.x,b.x,f),z:lerp(a.z,b.z,f),y:lerp(a.y,b.y,f),tx:dx/l,tz:dz/l,t:lerp(a.t,b.t,f)};
}
function removeEdge(e){
  for(const l of e.lots){lots.delete(l.id);}
  const A=nodes.get(e.a),B=nodes.get(e.b);
  if(A)A.e.splice(A.e.indexOf(e.id),1); if(B)B.e.splice(B.e.indexOf(e.id),1);
  edges.delete(e.id);
  for(const n of [A,B])if(n&&!n.e.length)nodes.delete(n.id);
}

// LOT_W / LOT_D are the parcel frontage and depth (see the geometry layer)
// ── zoning lots ────────────────────────────────────────────────────────────
const ZONE={none:0,res:1,com:2,ind:3};
const ZNAME=['Unzoned','Low Residential','Low Commercial','Low Industry'];
const ZCOL=[[.5,.5,.5],[.30,.85,.55],[.35,.70,1.0],[1.0,.72,.28]];
let LID=0; const lots=new Map();
function rebuildLots(e){
  for(const l of e.lots)lots.delete(l.id);
  e.lots.length=0;
  const R=RTYPE[e.type], rw=R.w/2+R.sw+R.verge;
  const step=LOT_W, n=Math.floor((e.len-2)/step);
  if(n<1)return;
  const pad=(e.len-n*step)/2;
  for(let i=0;i<n;i++){
    const s=pad+i*step+step/2, p=edgeAtLen(e,s);
    for(const side of[-1,1]){
      const nx=-p.tz*side, nz=p.tx*side;
      const cx=p.x+nx*(rw+LOT_D/2), cz=p.z+nz*(rw+LOT_D/2);
      if(Math.abs(cx)>HALF-12||Math.abs(cz)>HALF-12)continue;
      const gy=groundY(cx,cz);
      if(gy<1.0)continue;                              // no building below the waterline
      // reject lots that overlap terrain that is too steep
      const slope=Math.abs(groundY(cx+5,cz)-groundY(cx-5,cz))+Math.abs(groundY(cx,cz+5)-groundY(cx,cz-5));
      if(slope>4.2)continue;
      const yaw=Math.atan2(nx,nz)+PI;
      const l={id:LID++,e:e.id,s,side,x:cx,z:cz,y:gy,yaw,zone:0,lvl:0,grow:0,
        pop:0,jobs:0,filled:0,mesh:-1,pow:false,wat:false,sew:false,
        happy:.6,value:.3,poll:0,seed:(LID*2654435761)>>>0,age:0,abandoned:false,tPend:0};
      if(overlapsLot(l))continue;
      lots.set(l.id,l); e.lots.push(l);
    }
  }
}
function overlapsLot(l){
  for(const o of lots.values()){
    if(dist2(o.x,o.z,l.x,l.z)<(LOT_W*0.78)*(LOT_W*0.78))return true;}
  return false;
}
function rebuildAllLots(){for(const e of edges.values())rebuildLots(e);}


/*── ROAD CONSTRUCTION WITH AUTOMATIC JUNCTIONS ─────────────────────────────
  Laying a road across an existing one must create a real junction, and any
  curve that gets cut has to stay the same curve. Quadratic Béziers subdivide
  exactly, so a split segment keeps its geometry instead of snapping straight. */
function segX(ax,az,bx,bz,cx,cz,dx,dz){
  const r1=bx-ax,r2=bz-az,s1=dx-cx,s2=dz-cz;
  const den=r1*s2-r2*s1; if(Math.abs(den)<1e-9)return null;
  const t=((cx-ax)*s2-(cz-az)*s1)/den;
  const u=((cx-ax)*r2-(cz-az)*r1)/den;
  if(t<=0.0001||t>=0.9999||u<=0.0001||u>=0.9999)return null;
  return {t,u,x:ax+r1*t,z:az+r2*t};
}
// control point of the sub-arc t0..t1 of quadratic (A,C,B)
function subCtrl(A,C,B,t0,t1){
  if(!C)return null;
  const w0=(1-t0)*(1-t1), w1=(1-t0)*t1+(1-t1)*t0, w2=t0*t1;
  return {x:A.x*w0+C.x*w1+B.x*w2, z:A.z*w0+C.z*w1+B.z*w2};
}
function saveZoning(e){
  return e.lots.filter(l=>l.zone).map(l=>({x:l.x,z:l.z,zone:l.zone,lvl:l.lvl,mesh:l.mesh,grow:l.grow}));
}
function applyZoning(e,saved){
  if(!saved||!saved.length)return;
  for(const s of saved){
    let best=null,bd=25;
    for(const l of e.lots){const d=dist2(l.x,l.z,s.x,s.z);if(d<bd){bd=d;best=l;}}
    if(best&&!best.zone){best.zone=s.zone;best.lvl=s.lvl;best.mesh=s.mesh;best.grow=s.grow;}}
}
function splitEdgeAtT(e,t){
  if(t<0.02||t>0.98)return nodes.get(t<0.5?e.a:e.b);
  const A=nodes.get(e.a),B=nodes.get(e.b),C=e.ctrl,ty=e.type,pipe=e.pipe;
  const p=edgePt(e,t);
  const saved=saveZoning(e);
  const c1=subCtrl(A,C,B,0,t), c2=subCtrl(A,C,B,t,1);
  removeEdge(e);
  if(!nodes.has(A.id))nodes.set(A.id,A);      // removeEdge prunes orphans; we still need these
  if(!nodes.has(B.id))nodes.set(B.id,B);
  const M=addNode(p.x,p.z);
  const e1=addEdge(A,M,ty,c1), e2=addEdge(M,B,ty,c2);
  for(const ne of [e1,e2])if(ne){ne.pipe=pipe;rebuildLots(ne);applyZoning(ne,saved);}
  return M;
}
function splitEdgeAtLen(e,s){const q=edgeAtLen(e,clamp(s,0,e.len));return splitEdgeAtT(e,q.t);}
// Build a road from A to B, splitting every existing carriageway it crosses.
function addRoad(A,B,type,ctrl){
  const N=ctrl?Math.max(10,Math.round(dist(A.x,A.z,B.x,B.z)/4)):2;
  const P=[];
  for(let i=0;i<N;i++){const t=i/(N-1),it=1-t;
    P.push(ctrl?{x:A.x*it*it+ctrl.x*2*it*t+B.x*t*t,z:A.z*it*it+ctrl.z*2*it*t+B.z*t*t,t}
               :{x:lerp(A.x,B.x,t),z:lerp(A.z,B.z,t),t});}
  const hits=[];
  for(const e of edges.values()){
    if(e.a===A.id||e.b===A.id||e.a===B.id||e.b===B.id)continue;
    for(let i=0;i<e.pts.length-1;i++){
      const q0=e.pts[i],q1=e.pts[i+1];
      for(let k=0;k<P.length-1;k++){
        const r=segX(P[k].x,P[k].z,P[k+1].x,P[k+1].z,q0.x,q0.z,q1.x,q1.z);
        if(!r)continue;
        const gt=lerp(P[k].t,P[k+1].t,r.t);
        hits.push({t:gt,x:r.x,z:r.z});
      }}}
  hits.sort((a,b)=>a.t-b.t);
  const uniq=[];
  for(const h of hits)if(!uniq.length||h.t-uniq[uniq.length-1].t>0.02)uniq.push(h);
  // cut the crossed roads, collecting the junction nodes in order along the new one
  const chain=[{n:A,t:0}];
  for(const h of uniq){
    let tgt=null,bd=1e9;
    for(const e of edges.values()){
      for(const p of e.pts){const d=dist2(p.x,p.z,h.x,h.z);
        if(d<bd&&d<Math.pow(RTYPE[e.type].w,2)){bd=d;tgt=e;}}}
    if(!tgt)continue;
    let bs=0,bq=1e9;
    for(const p of tgt.pts){const d=dist2(p.x,p.z,h.x,h.z);if(d<bq){bq=d;bs=p.s;}}
    const M=splitEdgeAtLen(tgt,bs);
    if(M&&M!==chain[chain.length-1].n)chain.push({n:M,t:h.t});
  }
  chain.push({n:B,t:1});
  const made=[];
  for(let i=0;i<chain.length-1;i++){
    const a=chain[i],b=chain[i+1];
    if(a.n===b.n)continue;
    const c=subCtrl(A,ctrl,B,a.t,b.t);
    const e=addEdge(a.n,b.n,type,c);
    if(e){rebuildLots(e);made.push(e);}}
  return made;
}

// ── data fields (land value, pollution, noise, coverage) ───────────────────
const F={value:new Float32Array(GN*GN),poll:new Float32Array(GN*GN),
         noise:new Float32Array(GN*GN),tmp:new Float32Array(GN*GN)};
const gidx=(x,z)=>{const i=clamp(((x+HALF)/GC)|0,0,GN-1),j=clamp(((z+HALF)/GC)|0,0,GN-1);return j*GN+i;};
function diffuse(f,rate,decay){
  const t=F.tmp;
  for(let j=0;j<GN;j++)for(let i=0;i<GN;i++){
    const k=j*GN+i;
    let s=f[k]*4;
    s+=f[j*GN+Math.max(0,i-1)]+f[j*GN+Math.min(GN-1,i+1)];
    s+=f[Math.max(0,j-1)*GN+i]+f[Math.min(GN-1,j+1)*GN+i];
    t[k]=lerp(f[k],s/8,rate)*decay;}
  f.set(t);
}

// ── utility networks (union-find over nodes) ───────────────────────────────
const UF={p:null,
  init(n){this.p=new Int32Array(n);for(let i=0;i<n;i++)this.p[i]=i;},
  find(a){let r=a;while(this.p[r]!==r)r=this.p[r];while(this.p[a]!==r){const n=this.p[a];this.p[a]=r;a=n;}return r;},
  join(a,b){a=this.find(a);b=this.find(b);if(a!==b)this.p[b]=a;}};
let roadComp=new Map(), pipeComp=new Map();
function rebuildNetworks(){
  const ids=[...nodes.keys()], idx=new Map(); ids.forEach((id,i)=>idx.set(id,i));
  // road connectivity (carries electricity, exactly like a real distribution grid)
  UF.init(ids.length);
  for(const e of edges.values())UF.join(idx.get(e.a),idx.get(e.b));
  for(const b of services.values())if(b.node!=null&&b.def.power>0&&idx.has(b.node)){}
  roadComp=new Map(); ids.forEach((id,i)=>roadComp.set(id,UF.find(i)));
  // pipe connectivity — only edges the player has actually laid pipe under
  UF.init(ids.length);
  for(const e of edges.values())if(e.pipe)UF.join(idx.get(e.a),idx.get(e.b));
  pipeComp=new Map(); ids.forEach((id,i)=>pipeComp.set(id,UF.find(i)));
}

// ── service (player-placed) buildings ──────────────────────────────────────
const SDEF={
  coal :{name:'Coal Power Plant',cost:12000,up:520,power:6400,w:44,d:32,poll:26,noise:14,
         desc:'Cheap, filthy baseload. Feeds the road grid it touches.',cat:'power'},
  wind :{name:'Wind Turbine',cost:3200,up:90,power:640,w:9,d:9,poll:0,noise:4,
         desc:'Clean but weak. Output scales with elevation.',cat:'power'},
  pump :{name:'Water Pumping Station',cost:5200,up:180,water:5200,w:20,d:16,poll:2,noise:5,
         desc:'Pressurises the pipe network. Must touch fresh water.',cat:'water'},
  tower:{name:'Water Tower',cost:2400,up:80,water:1600,w:11,d:11,poll:0,noise:1,
         desc:'Inland storage. Works anywhere on the pipe grid.',cat:'water'},
  sewer:{name:'Sewage Treatment',cost:6800,up:260,sewage:5600,w:26,d:22,poll:18,noise:9,
         desc:'Drains the pipe network. Site it downwind and downstream.',cat:'sewage'},
};
let SVID=0; const services=new Map();
function placeService(kind,x,z,yaw){
  const d=SDEF[kind];
  const s={id:SVID++,kind,def:d,x,z,y:groundY(x,z),yaw,node:null,on:true,anim:0,seed:(SVID*40503)>>>0};
  // attach to the nearest road node within reach — that's the grid connection
  let best=null,bd=1e9;
  for(const n of nodes.values()){const q=dist2(n.x,n.z,x,z);if(q<bd){bd=q;best=n;}}
  if(best&&bd<Math.pow(Math.max(d.w,d.d)*0.75+26,2))s.node=best.id;
  services.set(s.id,s);return s;
}

/*── ROAD MESH ───────────────────────────────────────────────────────────────
  Carriageway, kerbs, footways, lane markings, crossings and properly shaped
  junction polygons are all rebuilt into one mesh whenever the network edits. */
const ASPH=[.128,.132,.142], ASPH2=[.138,.142,.152], KERB=[.50,.50,.49],
      WALK=[.375,.375,.368], LINE=[.86,.86,.82], LINEY=[.84,.70,.16],
      VERGE=[.198,.246,.140];
/* Junction solver.  A junction is not a disc: its corners are where the outer
   edges of neighbouring approaches actually intersect.  Solving those lines
   gives a plate that matches the carriageway exactly — for two perpendicular
   11 m streets it is an 11 m square, not a blob — and tells each approach how
   far back to stop. */
function nodeDirs(n){
  const out=[];
  for(const id of n.e){const e=edges.get(id);if(!e)continue;
    const at=e.a===n.id, t=edgeTan(e,at?0:1);
    const dx=at?t.x:-t.x, dz=at?t.z:-t.z;
    out.push({e,dx,dz,hw:RTYPE[e.type].w/2,sw:RTYPE[e.type].sw,vg:RTYPE[e.type].verge,
              ang:Math.atan2(dz,dx)});}
  out.sort((a,b)=>a.ang-b.ang);
  return out;
}
function shouldCap(n){
  if(n.e.length>2)return true;
  if(n.e.length===2){const d=nodeDirs(n);
    return d[0].dx*d[1].dx+d[0].dz*d[1].dz>-0.965;}
  return false;
}
// corner where approach i's left edge meets approach j's right edge
function edgeCorner(n,a,b,pad){
  const pax=-a.dz,paz=a.dx, pbx=-b.dz,pbz=b.dx;
  const w1=a.hw+(pad||0), w2=b.hw+(pad||0);
  const p1x=n.x+pax*w1, p1z=n.z+paz*w1;
  const p2x=n.x-pbx*w2, p2z=n.z-pbz*w2;
  const den=a.dx*b.dz-a.dz*b.dx;
  if(Math.abs(den)<0.14){                        // (anti)parallel — no true corner
    return {x:(p1x+p2x)/2+a.dx*w1*0.5, z:(p1z+p2z)/2+a.dz*w1*0.5};
  }
  const t=((p2x-p1x)*b.dz-(p2z-p1z)*b.dx)/den;
  const tc=clamp(t,-Math.max(w1,w2)*3.2,Math.max(w1,w2)*3.2);
  return {x:p1x+a.dx*tc, z:p1z+a.dz*tc};
}
const JUNC=new Map();                            // nodeId → {pts, outer, trim}
function solveJunctions(){
  JUNC.clear();
  for(const n of nodes.values()){
    if(!shouldCap(n)){for(const id of n.e){}
      JUNC.set(n.id,{pts:null,outer:null,trim:new Map(n.e.map(id=>[id,0]))});continue;}
    const D=nodeDirs(n), m=D.length, pts=[], outer=[], trim=new Map();
    for(let i=0;i<m;i++){
      const a=D[i], b=D[(i+1)%m];
      pts.push(edgeCorner(n,a,b,0));
      outer.push(edgeCorner(n,a,b,Math.max(a.sw+a.vg,b.sw+b.vg)));
    }
    for(let i=0;i<m;i++){                        // stop each approach behind its corners
      const d=D[i], c0=pts[(i-1+m)%m], c1=pts[i];
      const t0=(c0.x-n.x)*d.dx+(c0.z-n.z)*d.dz;
      const t1=(c1.x-n.x)*d.dx+(c1.z-n.z)*d.dz;
      trim.set(d.e.id,Math.max(0.2,Math.max(t0,t1)));
    }
    JUNC.set(n.id,{pts,outer,trim,dirs:D});
  }
}
function nodeRadius(n){                          // still handy for prop placement
  const j=JUNC.get(n.id); if(!j||!j.pts)return RTYPE.street.w*0.5;
  let r=0; for(const p of j.pts)r=Math.max(r,dist(p.x,p.z,n.x,n.z));
  return r;
}
function buildRoadMesh(){
  const mb=new MeshBuilder(), um=new MeshBuilder();
  const strip=(pts,off0,off1,y,col,rg,ao)=>{
    let prev=null;
    for(const p of pts){
      const nx=-p.tz,nz=p.tx;
      const aI=mb.vert(p.x+nx*off0,p.y+y,p.z+nz*off0,0,1,0,col,ao===undefined?1:ao,0,rg,0,0);
      const bI=mb.vert(p.x+nx*off1,p.y+y,p.z+nz*off1,0,1,0,col,ao===undefined?1:ao,0,rg,0,0);
      if(prev)mb.quad(prev[0],aI,bI,prev[1]);
      prev=[aI,bI];}
  };
  solveJunctions();
  const trimOf=(n,e)=>{const j=JUNC.get(n.id);return j?(j.trim.get(e.id)||0):0;};

  for(const e of edges.values()){
    const T=RTYPE[e.type], hw=T.w/2, sw=T.sw, vg=T.verge;
    const A=nodes.get(e.a),B=nodes.get(e.b);
    const t0=trimOf(A,e),t1=trimOf(B,e);
    if(e.len-t0-t1<0.6)continue;
    const N=Math.max(2,Math.round((e.len-t0-t1)/3.0)+1), P=[];
    for(let i=0;i<N;i++)P.push(edgeAtLen(e,t0+(e.len-t0-t1)*i/(N-1)));
    strip(P,-hw,hw,0.05,ASPH,.93);                                  // carriageway
    for(const s of[-1,1]){
      strip(P,s*hw,s*(hw+0.16),0.05,KERB,.72,.62);                  // kerb face (vertical-ish)
      strip(P,s*(hw+0.02),s*(hw+0.30),0.19,KERB,.68,.9);            // kerb top
      strip(P,s*(hw+0.30),s*(hw+sw),0.185,WALK,.90);                // footway
      strip(P,s*(hw+sw),s*(hw+sw+vg),0.16,VERGE,.98,.9);            // grass verge
    }
    // lane markings
    if(T.lanes>2){
      if(T.median){                                                 // raised central median
        strip(P,-T.median/2,T.median/2,0.05,KERB,.7,.72);
        strip(P,-T.median/2+0.12,T.median/2-0.12,0.19,VERGE,.98,.92);
        for(const s of[-1,1])strip(P,s*(T.median/2-0.02),s*(T.median/2+0.12),0.19,KERB,.68,.9);
      }
      for(const s of[-1,1]){                                        // lane divider, dashed
        let d=t0+1.5;
        while(d<e.len-t1-1.5){
          const q0=edgeAtLen(e,d),q1=edgeAtLen(e,Math.min(d+3.0,e.len-t1-1.5));
          strip([q0,q1],s*(T.w/4)-0.09,s*(T.w/4)+0.09,0.056,LINE,.7); d+=6.4;}
      }
    } else {
      let d=t0+1.5;                                                 // dashed centre line
      while(d<e.len-t1-1.5){
        const q0=edgeAtLen(e,d),q1=edgeAtLen(e,Math.min(d+2.8,e.len-t1-1.5));
        strip([q0,q1],-0.10,0.10,0.056,LINE,.7); d+=6.0;}
    }
    for(const s of[-1,1])strip(P,s*(hw-0.42),s*(hw-0.26),0.056,LINE,.7);   // edge lines
    // stop bars + zebra crossings at junctions
    for(const [nd,tt,sign] of [[A,t0,1],[B,e.len-t1,-1]]){
      if(!shouldCap(nd))continue;
      // zebra sits hard against the junction box; the stop bar goes behind it
      const nz=Math.max(4,Math.round(T.w/2.1));
      for(let k=0;k<nz;k++){
        const a=edgeAtLen(e,tt+sign*(0.35+k*0.80)),b=edgeAtLen(e,tt+sign*(0.35+k*0.80+0.40));
        strip([a,b],-hw+0.35,hw-0.35,0.057,LINE,.7);}
      const sb=0.35+nz*0.80+0.55;
      const q=edgeAtLen(e,tt+sign*sb), q2=edgeAtLen(e,tt+sign*(sb+0.52));
      strip([q,q2],sign>0?0.16:-hw+0.3,sign>0?hw-0.3:-0.16,0.057,LINE,.7);
    }
    if(e.pipe){
      let prev=null;
      for(const p of e.pts){const nx=-p.tz,nz=p.tx;
        const a=um.vert(p.x-nx*1.1,p.y+0.30,p.z-nz*1.1,0,1,0,[.25,.62,.95],1,.5,.4,0,0);
        const b=um.vert(p.x+nx*1.1,p.y+0.30,p.z+nz*1.1,0,1,0,[.25,.62,.95],1,.5,.4,0,0);
        if(prev)um.quad(prev[0],a,b,prev[1]); prev=[a,b];}
    }
  }
  // Convex ground polygon, wound by descending bearing about its centroid so
  // the surface normal always points up. Used for junction plates and corners.
  const flatFan=(pts,yOff,col,ao,rg)=>{
    if(pts.length<3)return;
    let cx=0,cz=0; for(const p of pts){cx+=p.x;cz+=p.z;} cx/=pts.length;cz/=pts.length;
    const ord=pts.slice().sort((a,b)=>
      Math.atan2(b.z-cz,b.x-cx)-Math.atan2(a.z-cz,a.x-cx));
    const ci=mb.vert(cx,groundY(cx,cz)+yOff,cz,0,1,0,col,ao,0,rg,0,0);
    const ri=ord.map(p=>mb.vert(p.x,groundY(p.x,p.z)+yOff,p.z,0,1,0,col,ao,0,rg,0,0));
    for(let k=0;k<ri.length;k++)mb.tri(ci,ri[k],ri[(k+1)%ri.length]);
  };
  for(const n of nodes.values()){
    const j=JUNC.get(n.id); if(!j||!j.pts)continue;
    flatFan(j.pts,0.05,ASPH2,1,.93);
    const D=j.dirs, m=D.length;
    for(let i=0;i<m;i++){
      const a=D[i], b=D[(i+1)%m];
      if(a.dx*b.dx+a.dz*b.dz<-0.86)continue;         // straight through: no corner
      const P=j.pts[i], O=j.outer[i];
      const ta=j.trim.get(a.e.id), tb=j.trim.get(b.e.id);
      const pax=-a.dz,paz=a.dx, pbx=-b.dz,pbz=b.dx;
      // footway ends of each approach, plus the solved outer corner between them
      const Fa={x:n.x+a.dx*ta+pax*(a.hw+a.sw+a.vg), z:n.z+a.dz*ta+paz*(a.hw+a.sw+a.vg)};
      const Fb={x:n.x+b.dx*tb-pbx*(b.hw+b.sw+b.vg), z:n.z+b.dz*tb-pbz*(b.hw+b.sw+b.vg)};
      const Ka={x:n.x+a.dx*ta+pax*a.hw, z:n.z+a.dz*ta+paz*a.hw};
      const Kb={x:n.x+b.dx*tb-pbx*b.hw, z:n.z+b.dz*tb-pbz*b.hw};
      flatFan([P,Ka,Fa,O,Fb,Kb],0.19,WALK,.92,.92);
      flatFan([P,Ka,Fa,O,Fb,Kb],0.05,KERB,.72,.8);   // kerb face under the pavement
    }
  }
  return {road:mb.build(),util:um.build()};
}

/*── ZONE OVERLAY MESH ───────────────────────────────────────────────────────*/
function buildZoneMesh(showEmpty){
  const mb=new MeshBuilder();
  for(const l of lots.values()){
    if(!l.zone&&!showEmpty)continue;
    if(l.zone&&l.lvl>0&&!showEmpty)continue;
    const c=l.zone?ZCOL[l.zone]:[.55,.60,.66];
    const a=l.zone?1:.55;
    const w=LOT_W*0.92,d=LOT_D*0.92;
    const cy=Math.cos(l.yaw),sy=Math.sin(l.yaw);
    const q=(lx,lz)=>[l.x+lx*cy+lz*sy, l.z-lx*sy+lz*cy];
    const P=[q(-w/2,-d/2),q(w/2,-d/2),q(w/2,d/2),q(-w/2,d/2)];
    const idc=P.map(p=>mb.vert(p[0],groundY(p[0],p[1])+0.10,p[1],0,1,0,
      mixc(c,[0,0,0],.55),1,a*0.30,.9,0,0));
    mb.quad(idc[0],idc[1],idc[2],idc[3]);
    const bw=0.42;                                    // bright border
    for(let i=0;i<4;i++){
      const p0=P[i],p1=P[(i+1)%4];
      const dx=p1[0]-p0[0],dz=p1[1]-p0[1],L=Math.hypot(dx,dz);
      const nx=-dz/L*bw,nz=dx/L*bw;
      const v=[[p0[0],p0[1]],[p1[0],p1[1]],[p1[0]+nx,p1[1]+nz],[p0[0]+nx,p0[1]+nz]]
        .map(p=>mb.vert(p[0],groundY(p[0],p[1])+0.11,p[1],0,1,0,c,1,a*0.85,.9,0,0));
      mb.quad(v[0],v[1],v[2],v[3]);}
  }
  return mb.build();
}
