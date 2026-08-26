/*═══════ ASSET LIBRARY ════════════════════════════════════════════════════*/
const A={house:[],shop:[],ind:[],veh:[],ped:[],prop:{},svc:{},terr:[],road:null,util:null,zone:null};
const VARIANTS=4;
let allBatches=[];
let dynBatches=[];
function mkBatch(mesh,cap){const b=new Batch(mesh,cap);allBatches.push(b);return b;}
// dynBatches = everything repopulated every frame (statics are uploaded once)
function refreshDyn(){dynBatches=allBatches.filter(b=>b!==A.road&&b!==A.util&&b!==A.zone&&A.terr.indexOf(b)<0);}

function buildAssets(step){
  const tasks=[];
  for(let lvl=1;lvl<=5;lvl++){
    tasks.push(()=>{A.house[lvl]=[];for(let v=0;v<VARIANTS;v++)
      A.house[lvl].push(mkBatch(genHouse(lvl*977+v*131+7,lvl),420));});
    tasks.push(()=>{A.shop[lvl]=[];for(let v=0;v<VARIANTS;v++)
      A.shop[lvl].push(mkBatch(genShop(lvl*613+v*241+3,lvl),320));});
    tasks.push(()=>{A.ind[lvl]=[];for(let v=0;v<VARIANTS;v++)
      A.ind[lvl].push(mkBatch(genIndustry(lvl*449+v*317+5,lvl),260));});
  }
  tasks.push(()=>{for(let k=0;k<4;k++)A.veh.push(mkBatch(genCar(1000+k*77,k),MAXVEH));
    A.veh.push(mkBatch(genTruck(2001),300)); A.veh.push(mkBatch(genBus(3001),200));});
  tasks.push(()=>{for(let p=0;p<4;p++)for(let v=0;v<2;v++)
    A.ped.push(mkBatch(genPed(500+v*91,p),MAXPED));});
  tasks.push(()=>{
    A.prop.lamp=mkBatch(genStreetlight(),2600);
    A.prop.tl=mkBatch(genTrafficLight(),900);
    A.prop.pole=mkBatch(genPole(),1400);
    A.prop.hyd=mkBatch(genHydrant(),900);
    const tm=[0,1,2].map(k=>{const mb=new MeshBuilder();tree(mb,0,0,0,1.15+k*0.22,rng(90+k*13),k===2?1:0);return mb.build();});
    A.prop.tree=tm.map(m=>mkBatch(m,3200));
  });
  tasks.push(()=>{
    A.svc.coal=mkBatch(genPowerPlant(),12);
    A.svc.pump=mkBatch(genWaterPump(),24);
    A.svc.tower=mkBatch(genWaterTower(),40);
    A.svc.sewer=mkBatch(genSewage(),20);
    A.svc.wind=[];for(let i=0;i<6;i++)A.svc.wind.push(mkBatch(genWindTurbine(i/6*TAU/3),90));
  });
  tasks.push(()=>{A.terr=buildTerrain().map(m=>{
    const b=mkBatch(m,1);b.push(0,0,0,0,1,1,1,.5,.5,.5,0,0);b.flush();return b;});});
  let i=0;
  return function next(){
    if(i>=tasks.length)return true;
    tasks[i++](); step(i/tasks.length);
    return false;};
}
function rebuildRoadBatch(){
  const {road,util}=buildRoadMesh();
  if(A.road){gl.deleteBuffer(A.road.vbo);gl.deleteBuffer(A.road.ebo);gl.deleteBuffer(A.road.ibo);
    gl.deleteVertexArray(A.road.vao);allBatches.splice(allBatches.indexOf(A.road),1);}
  if(A.util){gl.deleteBuffer(A.util.vbo);gl.deleteBuffer(A.util.ebo);gl.deleteBuffer(A.util.ibo);
    gl.deleteVertexArray(A.util.vao);allBatches.splice(allBatches.indexOf(A.util),1);}
  A.road=mkBatch(road,1); A.road.push(0,0,0,0,1,1,1,.5,.5,.5,0,0); A.road.flush();
  A.util=mkBatch(util,1); A.util.push(0,0,0,0,1,1,1,.5,.5,.5,0,0); A.util.flush();
}
function rebuildZoneBatch(showEmpty){
  const m=buildZoneMesh(showEmpty);
  if(A.zone){gl.deleteBuffer(A.zone.vbo);gl.deleteBuffer(A.zone.ebo);gl.deleteBuffer(A.zone.ibo);
    gl.deleteVertexArray(A.zone.vao);allBatches.splice(allBatches.indexOf(A.zone),1);}
  A.zone=m.count?mkBatch(m,1):null;
  if(A.zone){A.zone.push(0,0,0,0,1,1,1,.5,.5,.5,0,0);A.zone.flush();}
}

/*═══════ CAMERA ═══════════════════════════════════════════════════════════*/
const CAM={tx:0,tz:0,ty:0,dist:150,yaw:0.7,pitch:0.92,
  dTx:0,dTz:0,dDist:150,dYaw:0.7,dPitch:0.92,
  ex:0,ey:0,ez:0,fov:47*D2R,near:1.2,far:1900,
  vp:M4.id(),view:M4.id(),proj:M4.id(),invVP:M4.id(),invP:M4.id(),fr:new Frustum()};
function camUpdate(dt){
  CAM.dist=clamp(CAM.dist,14,760);
  CAM.pitch=clamp(CAM.pitch,0.16,1.50);
  CAM.tx=clamp(CAM.tx,-HALF+30,HALF-30); CAM.tz=clamp(CAM.tz,-HALF+30,HALF-30);
  const k=1-Math.exp(-16*dt);
  CAM.dTx=lerp(CAM.dTx,CAM.tx,k); CAM.dTz=lerp(CAM.dTz,CAM.tz,k);
  CAM.dDist=lerp(CAM.dDist,CAM.dist,k); CAM.dYaw=angLerp(CAM.dYaw,CAM.yaw,k);
  CAM.dPitch=lerp(CAM.dPitch,CAM.pitch,k);
  CAM.ty=lerp(CAM.ty,groundY(CAM.dTx,CAM.dTz),1-Math.exp(-6*dt));
  const cp=Math.cos(CAM.dPitch),sp=Math.sin(CAM.dPitch);
  CAM.ex=CAM.dTx+Math.sin(CAM.dYaw)*cp*CAM.dDist;
  CAM.ey=CAM.ty+sp*CAM.dDist;
  CAM.ez=CAM.dTz+Math.cos(CAM.dYaw)*cp*CAM.dDist;
  CAM.near=clamp(CAM.dDist*0.02,0.4,7); CAM.far=CAM.dDist*8+2200;
  M4.persp(CAM.proj,CAM.fov,cv.width/cv.height,CAM.near,CAM.far);
  M4.look(CAM.view,CAM.ex,CAM.ey,CAM.ez,CAM.dTx,CAM.ty,CAM.dTz,0,1,0);
  M4.mul(CAM.vp,CAM.proj,CAM.view);
  M4.inv(CAM.invVP,CAM.vp); M4.inv(CAM.invP,CAM.proj);
  CAM.fr.set(CAM.vp);
}
function screenRay(mx,my){
  const nx=mx/cv.clientWidth*2-1, ny=1-my/cv.clientHeight*2;
  const p=[nx,ny,1,1], o=new Float32Array(4);
  for(let i=0;i<4;i++)o[i]=CAM.invVP[i]*p[0]+CAM.invVP[4+i]*p[1]+CAM.invVP[8+i]*p[2]+CAM.invVP[12+i]*p[3];
  const wx=o[0]/o[3],wy=o[1]/o[3],wz=o[2]/o[3];
  let dx=wx-CAM.ex,dy=wy-CAM.ey,dz=wz-CAM.ez;const l=Math.hypot(dx,dy,dz);
  return {ox:CAM.ex,oy:CAM.ey,oz:CAM.ez,dx:dx/l,dy:dy/l,dz:dz/l};
}
function rayGround(r){                                 // march the heightfield, then refine
  let t=0.1,pt=0,ph=0;
  const maxT=CAM.far;
  let py=r.oy-groundY(r.ox,r.oz);
  for(let i=0;i<220;i++){
    const step=Math.max(1.6,t*0.035);
    const nt=t+step;
    const x=r.ox+r.dx*nt,y=r.oy+r.dy*nt,z=r.oz+r.dz*nt;
    if(Math.abs(x)>HALF+80||Math.abs(z)>HALF+80||nt>maxT)break;
    const h=groundY(x,z), d=y-h;
    if(d<0){
      let lo=t,hi=nt;
      for(let k=0;k<24;k++){const m=(lo+hi)/2;
        const mx2=r.ox+r.dx*m,my=r.oy+r.dy*m,mz=r.oz+r.dz*m;
        if(my-groundY(mx2,mz)<0)hi=m;else lo=m;}
      const m=(lo+hi)/2;
      return {x:r.ox+r.dx*m,y:r.oy+r.dy*m,z:r.oz+r.dz*m,hit:true};}
    t=nt;
  }
  if(Math.abs(r.dy)>1e-4){const m=(0-r.oy)/r.dy;
    if(m>0)return{x:r.ox+r.dx*m,y:0,z:r.oz+r.dz*m,hit:false};}
  return null;
}

/*═══════ SKY / LIGHTING ═══════════════════════════════════════════════════*/
const SUN={dir:new Float32Array(3),col:new Float32Array(3),sky:new Float32Array(3),
  gnd:new Float32Array(3),fog:new Float32Array(3),zen:new Float32Array(3),hor:new Float32Array(3),night:0};
function updateSun(hour){
  const a=(hour/24)*TAU-PI/2;
  const el=Math.sin(a)*0.92+0.06;
  const az=hour*0.26+0.7;
  const d=[Math.cos(az)*Math.max(0.001,Math.cos(a))*0.7, Math.max(-0.35,el), Math.sin(az)*Math.max(0.001,Math.cos(a))*0.7];
  const L=Math.hypot(d[0],d[1],d[2]);
  SUN.dir[0]=d[0]/L;SUN.dir[1]=Math.max(0.045,d[1]/L);SUN.dir[2]=d[2]/L;
  const night=sat((0.10-el)*3.4);
  SUN.night=night;
  const dusk=sat(1-Math.abs(el-0.10)*6.5);
  const day=[2.72,2.55,2.24], gold=[3.10,1.52,0.68], moon=[0.09,0.12,0.24];
  let c=mixc(day,gold,dusk); c=mixc(c,moon,night);
  SUN.col.set(c);
  const zenD=[0.24,0.44,0.86], zenN=[0.020,0.032,0.075];
  const horD=[0.66,0.78,0.93], horN=[0.045,0.060,0.115], horDusk=[0.95,0.55,0.32];
  let z=mixc(zenD,zenN,night), h=mixc(mixc(horD,horDusk,dusk*0.85),horN,night);
  SUN.zen.set(z);SUN.hor.set(h);
  SUN.sky.set(mixc(mixc([0.34,0.44,0.64],[0.44,0.32,0.28],dusk*0.6),[0.08,0.10,0.17],night));
  SUN.gnd.set(mixc([0.19,0.18,0.15],[0.05,0.055,0.07],night));
  SUN.fog.set(mixc(mixc([0.60,0.70,0.85],[0.82,0.56,0.42],dusk*0.7),[0.04,0.05,0.09],night));
}

/*═══════ RENDER ═══════════════════════════════════════════════════════════*/
const OVCOL={none:[[0,0,0],[0,0,0]],
  power:[[.55,.10,.10],[1,.85,.25]], water:[[.35,.10,.05],[.25,.70,1]],
  sewage:[[.45,.12,.08],[.45,.85,.45]], traffic:[[.25,.95,.45],[1,.15,.15]],
  value:[[.15,.25,.55],[1,.85,.25]], pollution:[[.35,.85,.45],[.75,.25,.15]]};
let overlay='none';
const lightVP=M4.id(), lightProj=M4.id(), lightView=M4.id();
const STAT={draws:0,tris:0,inst:0,frame:0};
function setLightMatrix(){
  const r=clamp(CAM.dDist*0.85+70,110,420);
  const cx=CAM.dTx+Math.sin(CAM.dYaw)*r*0.22, cz=CAM.dTz+Math.cos(CAM.dYaw)*r*0.22;
  const cy=groundY(cx,cz);
  const D=SUN.dir, dd=r*2.4;
  M4.look(lightView,cx+D[0]*dd,cy+D[1]*dd,cz+D[2]*dd,cx,cy,cz,0,1,0);
  M4.ortho(lightProj,-r,r,-r,r,1,dd*2.3);
  M4.mul(lightVP,lightProj,lightView);
}
function drawBatches(list,p){
  for(const b of list){if(!b||!b.count)continue;
    b.flush(); STAT.tris+=b.draw(); STAT.draws++; STAT.inst+=b.count;}
}

/*── static prop & vegetation placement ─────────────────────────────────────*/
let props=[], forest=null, forestN=0;
function buildProps(){
  props=[];
  for(const e of edges.values()){
    const T=RTYPE[e.type], hw=T.w/2;
    const nLamp=Math.max(0,Math.floor(e.len/32));
    for(let i=0;i<=nLamp;i++){
      const s=(i+0.5)*(e.len/(nLamp+1)); if(s<6||s>e.len-6)continue;
      const p=edgeAtLen(e,s), sd=(i%2)?1:-1;
      const off=hw+T.sw*0.52;
      props.push({t:0,x:p.x-p.tz*off*sd,y:p.y+0.20,z:p.z+p.tx*off*sd,
        yaw:Math.atan2(p.tz*sd,p.tx*sd)+PI});
    }
    if(e.len>50){const p=edgeAtLen(e,e.len*0.5),off=hw+T.sw*0.35;
      props.push({t:3,x:p.x+p.tz*off,y:p.y+0.2,z:p.z-p.tx*off,yaw:0});}
    // street trees in the verge — every 11 m, both sides, staggered
    const nT=Math.max(0,Math.floor(e.len/11));
    for(let i=0;i<=nT;i++){
      const s=(i+0.5)*(e.len/(nT+1)); if(s<6||s>e.len-6)continue;
      for(const sd of[-1,1]){
        const p=edgeAtLen(e,s), off=(hw+T.sw+T.verge*0.55)*sd;
        const j=(hash2(i*31+(sd>0?7:3),e.id)-0.5)*1.6;
        props.push({t:4,x:p.x-p.tz*off+p.tx*j,y:p.y+0.16,z:p.z+p.tx*off+p.tz*j,
          yaw:hash2(i,sd)*TAU,v:((hash2(i*7,sd*3+e.id)*3)|0)%3,
          sc:0.52+hash2(i*13,sd)*0.30});
      }
    }
  }
  for(const n of nodes.values()){
    if(n.e.length<3)continue;
    const r=nodeRadius(n)+1.4;
    for(const d of nodeDirs(n)){
      const T=RTYPE[d.e.type],hw=T.w/2;
      const px=-d.dz,pz=d.dx;
      props.push({t:1,x:n.x+d.dx*r-px*(hw+T.sw*0.6),y:n.y+0.2,z:n.z+d.dz*r-pz*(hw+T.sw*0.6),
        yaw:Math.atan2(-d.dx,-d.dz)});
    }
  }
}
function buildForest(){
  const list=[];
  for(let i=0;i<9000;i++){
    const x=(Math.random()-0.5)*(MAP-24), z=(Math.random()-0.5)*(MAP-24);
    const y=groundY(x,z); if(y<1.6)continue;
    const d=fbm(x*0.0055+7,z*0.0055+3,4);
    if(Math.random()>d*1.5-0.28)continue;
    list.push(x,y,z,Math.random()*TAU,0.62+Math.random()*0.62,(Math.random()*3)|0);
  }
  forest=new Float32Array(list); forestN=list.length/6;
}
function forestBlocked(x,z){
  for(const e of edges.values()){
    for(const p of e.pts)if(dist2(p.x,p.z,x,z)<420)return true;}
  return false;
}
function pruneForest(){
  const out=[];
  for(let i=0;i<forestN;i++){
    const x=forest[i*6],z=forest[i*6+2];
    let blocked=false;
    for(const l of lots.values())if(dist2(l.x,l.z,x,z)<(LOT_W*0.72)**2){blocked=true;break;}
    if(!blocked)for(const e of edges.values()){
      if(dist2(nodes.get(e.a).x,nodes.get(e.a).z,x,z)>(e.len+40)**2)continue;
      for(const p of e.pts)if(dist2(p.x,p.z,x,z)<340){blocked=true;break;}
      if(blocked)break;}
    if(!blocked)for(const s of services.values())
      if(Math.abs(s.x-x)<s.def.w/2+3&&Math.abs(s.z-z)<s.def.d/2+3){blocked=true;break;}
    if(!blocked)for(let k=0;k<6;k++)out.push(forest[i*6+k]);
  }
  forest=new Float32Array(out); forestN=out.length/6;
}

/*── per-frame instancing (cull + LOD) ──────────────────────────────────────*/
let selLot=null, selSvc=null, hoverLot=null;
const LOD_BLD=340, PED_D=170, VEH_D=520, LAMP_D=300, TREE_D=560;
function ovValue(kind,o){
  switch(overlay){
    case 'power':  return o.pow?1:0;
    case 'water':  return o.wat?1:0;
    case 'sewage': return o.sew?1:0;
    case 'value':  return o.value||0;
    case 'pollution': return sat((o.poll||0)*0.055);
    case 'traffic':return o.cong||0;
    default:return 0;}
}
function populate(dt,timeSec){
  for(const b of dynBatches)b.reset();
  const fr=CAM.fr, ex=CAM.ex,ey=CAM.ey,ez=CAM.ez;
  // ── buildings ──
  for(const l of lots.values()){
    if(!l.lvl)continue;
    const d=Math.hypot(l.x-ex,l.z-ez);
    const rad=LOT_W*0.9+8;
    if(!fr.sphere(l.x,l.y+5,l.z,rad))continue;
    const lib=l.zone===1?A.house:l.zone===2?A.shop:A.ind;
    const set=lib[l.lvl]; if(!set)continue;
    if(l.mesh<0)l.mesh=(l.seed>>>3)%set.length;
    const b=set[l.mesh];
    const g=l.grow>=1?1:smooth(sat(l.grow));
    const sy=0.14+g*0.86, sxz=0.55+g*0.45;
    const sel=(selLot===l)?0.45:0;
    const f=ovValue(0,l);
    let t=[0.5,0.5,0.5];
    if(l.abandoned)t=[0.33,0.30,0.28];
    b.push(l.x,l.y,l.z,l.yaw,sxz,sy,sxz,t[0],t[1],t[2],f,sel);
  }
  // ── vehicles ──
  for(let i=0;i<VEH.n;i++){
    const d=Math.hypot(VEH.x[i]-ex,VEH.z[i]-ez);
    if(d>VEH_D)continue;
    if(!fr.sphere(VEH.x[i],VEH.y[i]+1,VEH.z[i],4.6))continue;
    const b=A.veh[VEH.kind[i]]; if(!b)continue;
    b.push(VEH.x[i],VEH.y[i],VEH.z[i],VEH.yaw[i],1,1,1,
      VEH.tint[i*3]/510,VEH.tint[i*3+1]/510,VEH.tint[i*3+2]/510,
      overlay==='traffic'?(edges.get(VEH.edge[i])||{cong:0}).cong:0,
      VEH.brake[i]>0.5?0.12:0);
  }
  // ── citizens ──
  for(let i=0;i<PED.n;i++){
    const d=Math.hypot(PED.x[i]-ex,PED.z[i]-ez);
    if(d>PED_D)continue;
    if(!fr.sphere(PED.x[i],PED.y[i]+0.9,PED.z[i],1.4))continue;
    const pose=((PED.ph[i]/(PI/2))|0)&3;
    const b=A.ped[pose*2+(PED.seedv[i]&1)];
    const bob=Math.abs(Math.sin(PED.ph[i]))*0.035;
    b.push(PED.x[i],PED.y[i]+bob,PED.z[i],PED.yaw[i],1,1,1,
      PED.tint[i*3]/510,PED.tint[i*3+1]/510,PED.tint[i*3+2]/510,0,0);
  }
  // ── props ──
  const lampOn=SUN.night>0.34?1:0;
  for(const p of props){
    const d=Math.hypot(p.x-ex,p.z-ez);
    if(p.t===4){ if(d>TREE_D)continue; if(!fr.sphere(p.x,p.y+3,p.z,5))continue;
      A.prop.tree[p.v].push(p.x,p.y,p.z,p.yaw,p.sc,p.sc,p.sc,.5,.5,.5,0,0); continue;}
    if(d>LAMP_D)continue;
    if(!fr.sphere(p.x,p.y+4,p.z,9))continue;
    const b=p.t===0?A.prop.lamp:p.t===1?A.prop.tl:p.t===2?A.prop.pole:A.prop.hyd;
    b.push(p.x,p.y,p.z,p.yaw,1,1,1,.5,.5,.5,0,p.t===0?lampOn*0.32:0);
  }
  // ── ambient forest ──
  for(let i=0;i<forestN;i++){
    const x=forest[i*6],y=forest[i*6+1],z=forest[i*6+2];
    const d=Math.hypot(x-ex,z-ez); if(d>TREE_D)continue;
    if(!fr.sphere(x,y+4,z,7))continue;
    const s=forest[i*6+4];
    A.prop.tree[forest[i*6+5]|0].push(x,y,z,forest[i*6+3],s,s,s,.5,.5,.5,0,0);
  }
  // ── service buildings ──
  for(const s of services.values()){
    if(!fr.sphere(s.x,s.y+10,s.z,Math.max(s.def.w,s.def.d)*0.8+22))continue;
    const sel=(selSvc===s)?0.4:0;
    if(s.kind==='wind'){
      const idx=((timeSec*1.9+s.seed*0.37)|0)%6;
      A.svc.wind[idx].push(s.x,s.y,s.z,s.yaw,1,1,1,.5,.5,.5,0,sel);
    }else A.svc[s.kind].push(s.x,s.y,s.z,s.yaw,1,1,1,.5,.5,.5,0,sel);
  }
}

/*── frame ──────────────────────────────────────────────────────────────────*/
function renderScene(pass){
  const isShadow=pass==='shadow';
  const p=isShadow?P.shadow:P.main;
  gl.useProgram(p);
  if(isShadow)gl.uniformMatrix4fv(p.u.uVP,false,lightVP);
  else{
    gl.uniformMatrix4fv(p.u.uVP,false,CAM.vp);
    gl.uniformMatrix4fv(p.u.uLightVP,false,lightVP);
    gl.uniform3f(p.u.uEye,CAM.ex,CAM.ey,CAM.ez);
    gl.uniform3fv(p.u.uSunDir,SUN.dir); gl.uniform3fv(p.u.uSunCol,SUN.col);
    gl.uniform3fv(p.u.uSkyCol,SUN.sky); gl.uniform3fv(p.u.uGndCol,SUN.gnd);
    gl.uniform3fv(p.u.uFogCol,SUN.fog);
    gl.uniform1f(p.u.uFogD,FOGD());
    gl.uniform1f(p.u.uNight,SUN.night); gl.uniform1f(p.u.uTime,STAT.time||0);
    gl.uniform1i(p.u.uOverlay,overlay==='none'?0:1);
    const oc=OVCOL[overlay]||OVCOL.none;
    gl.uniform3fv(p.u.uOvA,oc[0]); gl.uniform3fv(p.u.uOvB,oc[1]);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.shadowT);
    gl.uniform1i(p.u.uShadow,0);
    gl.uniform2f(p.u.uShadowTx,1/SHADOW_SZ,1/SHADOW_SZ);
  }
  if(!isShadow){
    gl.uniform1i(p.u.uOverlay,0);
    drawBatches(A.terr,p);
    if(A.road)drawBatches([A.road],p);
    if(A.zone)drawBatches([A.zone],p);
    if(A.util&&(overlay==='water'||overlay==='sewage'))drawBatches([A.util],p);
    gl.uniform1i(p.u.uOverlay,overlay==='none'?0:1);
  }
  drawBatches(dynBatches,p);
}
