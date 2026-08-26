/*═══════ SIMULATION ═══════════════════════════════════════════════════════*/
const SIM={
  cash:120000, t:0, day:0, hour:8, speed:1, month:0, year:1,
  pop:0, popCap:0, jobs:0, jobsFilled:0, unemp:0, homeless:0,
  powProd:0, powUse:0, watProd:0, watUse:0, sewCap:0, sewUse:0,
  demand:{r:.85,c:.35,i:.45}, happy:.72, income:0, upkeep:0, netIncome:0,
  tax:{r:.09,c:.09,i:.10}, built:0, abandoned:0, traffic:0, avgValue:.3, avgPoll:0,
  edu:.4, health:.5, tier:'HAMLET', history:[]
};
const LVLPOP=[0,4,7,11,16,22], LVLJOB_C=[0,5,9,14,20,28], LVLJOB_I=[0,8,14,22,32,44];
const TIERS=[[0,'HAMLET'],[350,'VILLAGE'],[1200,'TOWN'],[3500,'BOROUGH'],[9000,'CITY'],[20000,'METROPOLIS'],[45000,'MEGALOPOLIS']];

//──── growth / decay of zoned parcels ───────────────────────────────────────
function lotDemand(z){return z===1?SIM.demand.r:z===2?SIM.demand.c:SIM.demand.i;}
function lotServices(l){
  const e=edges.get(l.e); if(!e)return false;
  return l.pow&&l.wat&&l.sew;
}
function updateLotUtilities(){
  // a parcel draws power from the road grid it fronts and water from the pipe
  // under that same road — precisely the Cities-style coupling.
  const powRoots=new Set(), watRoots=new Set(), sewRoots=new Set();
  SIM.powProd=0;SIM.watProd=0;SIM.sewCap=0;
  for(const s of services.values()){
    if(!s.on||s.node==null)continue;
    const d=s.def;
    if(d.power){ let out=d.power;
      if(s.kind==='wind')out=d.power*(0.45+sat((groundY(s.x,s.z)-2)/26)*0.85);
      SIM.powProd+=out; powRoots.add(roadComp.get(s.node)); }
    if(d.water){ SIM.watProd+=d.water;
      const pc=pipeComp.get(s.node); if(pc!==undefined)watRoots.add(pc);
      // a source only pressurises pipe if its own frontage has pipe laid
      }
    if(d.sewage){ SIM.sewCap+=d.sewage;
      const pc=pipeComp.get(s.node); if(pc!==undefined)sewRoots.add(pc); }
  }
  const powOK=SIM.powProd>=SIM.powUse*0.985, watOK=SIM.watProd>=SIM.watUse*0.985,
        sewOK=SIM.sewCap>=SIM.sewUse*0.985;
  for(const l of lots.values()){
    const e=edges.get(l.e); if(!e){l.pow=l.wat=l.sew=false;continue;}
    const rc=roadComp.get(e.a);
    l.pow=powOK&&powRoots.has(rc);
    const pcc=e.pipe?pipeComp.get(e.a):undefined;
    l.wat=watOK&&pcc!==undefined&&watRoots.has(pcc);
    l.sew=sewOK&&pcc!==undefined&&sewRoots.has(pcc);
  }
}
function growthTick(dt){
  const cand=[]; let starving=0;
  for(const l of lots.values()){
    if(l.grow>0&&l.grow<1){l.grow=Math.min(1,l.grow+dt*0.9);}
    if(!l.zone)continue;
    const svc=lotServices(l);
    if(!svc){ l.tPend+=dt;
      if(l.lvl>0&&l.tPend>26){l.lvl=0;l.grow=0;l.abandoned=true;l.pop=0;l.jobs=0;l.filled=0;dirty.zone=1;dirty.build=1;}
      starving++; continue; }
    l.tPend=0;l.abandoned=false;
    if(l.lvl===0)cand.push(l);
    else{ // slow upgrade toward what the land value supports
      l.age+=dt;
      const target=1+Math.floor(sat(l.value*1.35+lotDemand(l.zone)*0.30)*4.4);
      if(l.age>10&&l.lvl<Math.min(5,target)&&lotDemand(l.zone)>0.24){
        l.lvl++;l.age=0;l.grow=0.35;l.mesh=-1;dirty.build=1;}
    }
  }
  SIM.starving=starving;
  if(!cand.length)return;
  // build at a rate proportional to demand — never more than a few per tick
  for(const z of [1,2,3]){
    const d=lotDemand(z); if(d<0.12)continue;
    let budget=Math.ceil(d*7.0);
    for(let k=0;k<cand.length&&budget>0;k++){
      const l=cand[(Math.random()*cand.length)|0];
      if(l.zone!==z||l.lvl>0)continue;
      l.lvl=1+((Math.random()*sat(l.value*2.2)*2.2)|0);
      l.lvl=clamp(l.lvl,1,5); l.grow=0.02; l.mesh=-1; l.age=0;
      SIM.built++; budget--; dirty.build=1; dirty.zone=1;
    }
  }
}

//──── fields: land value, pollution, noise ─────────────────────────────────
function fieldTick(){
  F.poll.fill(0); F.noise.fill(0);
  for(const s of services.values()){
    if(!s.on)continue;
    const k=gidx(s.x,s.z);
    F.poll[k]+=s.def.poll*0.5; F.noise[k]+=s.def.noise*0.4;
  }
  for(const l of lots.values()){
    if(!l.lvl)continue;
    const k=gidx(l.x,l.z);
    if(l.zone===3){F.poll[k]+=1.6+l.lvl*0.55;F.noise[k]+=1.1+l.lvl*0.3;}
    else if(l.zone===2)F.noise[k]+=0.5+l.lvl*0.18;
  }
  for(const e of edges.values()){
    const k=gidx((nodes.get(e.a).x+nodes.get(e.b).x)/2,(nodes.get(e.a).z+nodes.get(e.b).z)/2);
    F.noise[k]+=e.cong*2.4; F.poll[k]+=e.cong*0.9;
  }
  for(let i=0;i<3;i++){diffuse(F.poll,.62,.985);diffuse(F.noise,.55,.972);}
  // land value: amenity from water/greenery, penalised by pollution & noise
  let vs=0,vn=0,ps=0;
  for(let j=0;j<GN;j++)for(let i=0;i<GN;i++){
    const k=j*GN+i, x=-HALF+i*GC+GC/2, z=-HALF+j*GC+GC/2;
    const gy=groundY(x,z);
    let v=0.26+sat((gy-1)/26)*0.13;
    let nearWater=0;
    for(let s=1;s<=4;s++){ if(groundY(x+s*14,z+s*14)<WATER_Y+0.5){nearWater=1-s/5;break;} }
    v+=nearWater*0.26;
    v+=sat(F.value[k])*0.0;
    v-=sat(F.poll[k]*0.055)*0.42;
    v-=sat(F.noise[k]*0.05)*0.16;
    F.value[k]=clamp(v,0.02,1);
    vs+=F.value[k];vn++;ps+=F.poll[k];
  }
  SIM.avgValue=vs/vn; SIM.avgPoll=ps/vn;
  for(const l of lots.values()){
    const k=gidx(l.x,l.z);
    let v=F.value[k];
    if(l.zone===2)v+=0.06;                             // commercial likes footfall
    if(l.zone===3)v=Math.max(0.12,v*0.7+0.10);         // industry cares less
    l.value=lerp(l.value,clamp(v,0.02,1),0.25);
    l.poll=F.poll[k];
  }
}

//──── monthly economy ──────────────────────────────────────────────────────
function statsTick(){
  let pop=0,cap=0,jobs=0,pw=0,wt=0,sw=0,rTax=0,cTax=0,iTax=0,hs=0,hn=0,built=0,ab=0;
  for(const l of lots.values()){
    if(!l.lvl){if(l.abandoned)ab++;continue;}
    built++;
    const q=l.grow>=1?1:l.grow;
    if(l.zone===1){
      const c=LVLPOP[l.lvl]*q; cap+=c; l.pop=c; pop+=c;
      pw+=c*3.1; wt+=c*2.3; sw+=c*2.0;
      rTax+=c*11*SIM.tax.r*(0.55+l.value);
      hs+=l.happy*c; hn+=c;
    }else if(l.zone===2){
      const j=LVLJOB_C[l.lvl]*q; jobs+=j; l.jobs=j;
      pw+=j*4.4; wt+=j*2.9; sw+=j*2.4;
      cTax+=j*15*SIM.tax.c*(0.5+l.value);
    }else{
      const j=LVLJOB_I[l.lvl]*q; jobs+=j; l.jobs=j;
      pw+=j*7.2; wt+=j*5.1; sw+=j*4.6;
      iTax+=j*13*SIM.tax.i*(0.6+l.value*0.5);
    }
  }
  SIM.popCap=cap; SIM.pop=Math.round(lerp(SIM.pop,cap,0.42));
  SIM.jobs=jobs; SIM.built=built; SIM.abandoned=ab;
  SIM.jobsFilled=Math.min(jobs,Math.round(SIM.pop*0.55));
  const wf=Math.max(1,SIM.pop*0.55);
  SIM.unemp=clamp(1-SIM.jobsFilled/wf,0,1);
  SIM.powUse=pw; SIM.watUse=wt; SIM.sewUse=sw;

  let up=0;
  for(const e of edges.values())up+=e.len*RTYPE[e.type].cost*0.035;
  for(const s of services.values())if(s.on)up+=s.def.up;
  SIM.income=rTax+cTax+iTax; SIM.upkeep=up;
  SIM.netIncome=SIM.income-SIM.upkeep;

  // happiness: services, congestion, pollution, employment
  let hap=0.52;
  hap+=0.16*(SIM.powProd>=SIM.powUse?1:-1.4);
  hap+=0.13*(SIM.watProd>=SIM.watUse?1:-1.5);
  hap+=0.11*(SIM.sewCap>=SIM.sewUse?1:-1.5);
  hap-=SIM.traffic*0.22;
  hap-=sat(SIM.avgPoll*0.06)*0.24;
  hap-=SIM.unemp*0.26;
  hap+=sat(SIM.avgValue-0.3)*0.24;
  SIM.happy=clamp(lerp(SIM.happy,clamp(hap,0,1),0.3),0,1);
  for(const l of lots.values())if(l.zone===1&&l.lvl)
    l.happy=clamp(SIM.happy*0.7+l.value*0.4-sat(l.poll*0.05)*0.4,0,1);

  // demand model — the RCI engine
  const jobsPer=SIM.pop>0?SIM.jobs/Math.max(1,SIM.pop*0.55):2;
  SIM.demand.r=clamp(0.28+sat(jobsPer-0.72)*0.9+SIM.happy*0.35-sat(SIM.pop/(SIM.popCap+1)-0.94)*0.2
                     -sat(SIM.unemp-0.1)*1.1,0,1);
  SIM.demand.c=clamp(sat(SIM.pop/900)*0.35+0.16+sat(0.85-jobsPer)*0.55*sat(SIM.pop/220)
                     -sat(SIM.unemp-0.16)*0.5,0,1);
  SIM.demand.i=clamp(0.20+SIM.demand.c*0.55+sat(SIM.unemp-0.05)*0.85-sat(SIM.avgValue-0.55)*0.4,0,1);
  const tp=TIERS.filter(t=>SIM.pop>=t[0]); SIM.tier=tp[tp.length-1][1];
  SIM.history.push({p:SIM.pop,c:SIM.cash,h:SIM.happy}); if(SIM.history.length>240)SIM.history.shift();
}

/*═══════ AGENTS ═══════════════════════════════════════════════════════════
  Two-tier design: aggregate maths drive the economy, while a bounded pool of
  individually-pathed vehicles and pedestrians provides the visible city and
  feeds congestion back into it. Pool size is the perf dial, not population. */
const MAXVEH=1400, MAXPED=1100;
const VEH={n:0,edge:new Int32Array(MAXVEH),s:new Float32Array(MAXVEH),dir:new Int8Array(MAXVEH),
  spd:new Float32Array(MAXVEH),tgt:new Float32Array(MAXVEH),lane:new Float32Array(MAXVEH),
  kind:new Uint8Array(MAXVEH),tint:new Uint8Array(MAXVEH*3),path:[],pi:new Int32Array(MAXVEH),
  wait:new Float32Array(MAXVEH),home:new Int32Array(MAXVEH),dest:new Int32Array(MAXVEH),
  x:new Float32Array(MAXVEH),z:new Float32Array(MAXVEH),y:new Float32Array(MAXVEH),
  yaw:new Float32Array(MAXVEH),brake:new Float32Array(MAXVEH)};
const PED={n:0,edge:new Int32Array(MAXPED),s:new Float32Array(MAXPED),dir:new Int8Array(MAXPED),
  spd:new Float32Array(MAXPED),side:new Int8Array(MAXPED),path:[],pi:new Int32Array(MAXPED),
  tint:new Uint8Array(MAXPED*3),ph:new Float32Array(MAXPED),seedv:new Uint8Array(MAXPED),
  x:new Float32Array(MAXPED),z:new Float32Array(MAXPED),y:new Float32Array(MAXPED),yaw:new Float32Array(MAXPED)};

//──── A* over the road graph, with an LRU path cache ───────────────────────
const pathCache=new Map(); const PC_MAX=4000;
function findPath(sn,tn){
  if(sn===tn)return [];
  const key=sn*100003+tn; const hit=pathCache.get(key);
  if(hit!==undefined){pathCache.delete(key);pathCache.set(key,hit);return hit;}
  const T=nodes.get(tn); if(!T)return null;
  const open=[sn], g=new Map([[sn,0]]), f=new Map([[sn,0]]), from=new Map();
  const seen=new Set(); let guard=0;
  while(open.length&&guard++<9000){
    let bi=0,bf=1e18;
    for(let i=0;i<open.length;i++){const v=f.get(open[i]);if(v<bf){bf=v;bi=i;}}
    const cur=open.splice(bi,1)[0];
    if(cur===tn){
      const out=[];let c=cur;
      while(from.has(c)){const p=from.get(c);out.push(p.e);c=p.n;}
      out.reverse();
      if(pathCache.size>=PC_MAX)pathCache.delete(pathCache.keys().next().value);
      pathCache.set(key,out);return out;}
    seen.add(cur);
    const N=nodes.get(cur); if(!N)continue;
    for(const eid of N.e){
      const e=edges.get(eid); if(!e)continue;
      const nx=e.a===cur?e.b:e.a;
      if(seen.has(nx))continue;
      const T2=RTYPE[e.type];
      const cost=e.len/T2.speed*(1+e.cong*2.4);
      const ng=g.get(cur)+cost;
      if(g.has(nx)&&ng>=g.get(nx))continue;
      g.set(nx,ng); from.set(nx,{n:cur,e:eid});
      const NN=nodes.get(nx);
      f.set(nx,ng+dist(NN.x,NN.z,T.x,T.z)/16);
      if(!open.includes(nx))open.push(nx);}
  }
  if(pathCache.size>=PC_MAX)pathCache.delete(pathCache.keys().next().value);
  pathCache.set(key,null); return null;
}
function lotNode(l){const e=edges.get(l.e);if(!e)return null;
  return l.s<e.len/2?e.a:e.b;}

//──── spawn / despawn ──────────────────────────────────────────────────────
let resLots=[],workLots=[];
function refreshLotIndex(){
  resLots=[];workLots=[];
  for(const l of lots.values()){
    if(!l.lvl||l.grow<0.9)continue;
    if(l.zone===1)resLots.push(l); else workLots.push(l);}
}
function spawnVehicle(){
  if(VEH.n>=MAXVEH||!resLots.length||!workLots.length)return;
  const a=resLots[(Math.random()*resLots.length)|0], b=workLots[(Math.random()*workLots.length)|0];
  const na=lotNode(a),nb=lotNode(b); if(na==null||nb==null||na===nb)return;
  const p=findPath(na,nb); if(!p||!p.length)return;
  const i=VEH.n++;
  VEH.path[i]=p; VEH.pi[i]=0;
  const e=edges.get(p[0]); if(!e){VEH.n--;return;}
  VEH.edge[i]=p[0]; VEH.dir[i]=e.a===na?1:-1; VEH.s[i]=0;
  const kind=Math.random()<0.055?4:Math.random()<0.09?5:(Math.random()*4)|0;
  VEH.kind[i]=kind;
  const c=PAL.car[(Math.random()*PAL.car.length)|0];
  VEH.tint[i*3]=(c>>16)&255;VEH.tint[i*3+1]=(c>>8)&255;VEH.tint[i*3+2]=c&255;
  VEH.spd[i]=0; VEH.tgt[i]=RTYPE[e.type].speed*(0.82+Math.random()*0.3);
  VEH.lane[i]=1; VEH.wait[i]=0; VEH.brake[i]=0; VEH.dest[i]=nb; VEH.home[i]=na;
}
function killVeh(i){
  const n=--VEH.n; if(i===n){VEH.path[n]=null;return;}
  for(const k of['edge','s','dir','spd','tgt','lane','kind','pi','wait','home','dest','x','z','y','yaw','brake'])
    VEH[k][i]=VEH[k][n];
  VEH.tint[i*3]=VEH.tint[n*3];VEH.tint[i*3+1]=VEH.tint[n*3+1];VEH.tint[i*3+2]=VEH.tint[n*3+2];
  VEH.path[i]=VEH.path[n]; VEH.path[n]=null;
}
function spawnPed(){
  if(PED.n>=MAXPED)return;
  const pool=resLots.length?resLots:workLots; if(!pool.length)return;
  const a=pool[(Math.random()*pool.length)|0];
  const e=edges.get(a.e); if(!e)return;
  const i=PED.n++;
  const dst=(Math.random()<.5?workLots:resLots);
  const b=dst.length?dst[(Math.random()*dst.length)|0]:a;
  const na=lotNode(a),nb=lotNode(b);
  let p=(na!=null&&nb!=null&&na!==nb)?findPath(na,nb):null;
  if(!p||!p.length){PED.edge[i]=a.e;PED.dir[i]=Math.random()<.5?1:-1;PED.path[i]=null;}
  else{PED.path[i]=p;PED.pi[i]=0;PED.edge[i]=p[0];
    const e0=edges.get(p[0]);PED.dir[i]=e0.a===na?1:-1;}
  PED.s[i]=Math.random()*e.len; PED.side[i]=Math.random()<.5?1:-1;
  PED.spd[i]=1.15+Math.random()*0.55; PED.ph[i]=Math.random()*TAU;
  PED.seedv[i]=(Math.random()*32)|0;
  const shirts=[0xd94f4f,0x4f7fd9,0x53b06a,0xd9b24f,0x8a5fd9,0xe0e0e2,0x2f3540,0xd97f3f];
  const c=shirts[(Math.random()*shirts.length)|0];
  PED.tint[i*3]=(c>>16)&255;PED.tint[i*3+1]=(c>>8)&255;PED.tint[i*3+2]=c&255;
}
function killPed(i){
  const n=--PED.n; if(i===n){PED.path[n]=null;return;}
  for(const k of['edge','s','dir','spd','side','pi','ph','seedv','x','z','y','yaw'])PED[k][i]=PED[k][n];
  PED.tint[i*3]=PED.tint[n*3];PED.tint[i*3+1]=PED.tint[n*3+1];PED.tint[i*3+2]=PED.tint[n*3+2];
  PED.path[i]=PED.path[n];PED.path[n]=null;
}

//──── traffic step ─────────────────────────────────────────────────────────
const edgeVeh=new Map();                              // edgeId|dir → sorted indices
function trafficTick(dt){
  edgeVeh.clear();
  for(let i=0;i<VEH.n;i++){
    const k=VEH.edge[i]*2+(VEH.dir[i]>0?0:1);
    let a=edgeVeh.get(k); if(!a){a=[];edgeVeh.set(k,a);} a.push(i);}
  for(const a of edgeVeh.values())a.sort((p,q)=>VEH.s[p]-VEH.s[q]);

  // per-edge congestion from occupancy (decays so it reads as a rolling average)
  for(const e of edges.values()){e.load=0;}
  for(let i=0;i<VEH.n;i++){const e=edges.get(VEH.edge[i]);if(e)e.load++;}
  let tot=0,cnt=0;
  for(const e of edges.values()){
    const cap=Math.max(2,e.len/9*RTYPE[e.type].lanes);
    e.cong=lerp(e.cong,sat(e.load/cap),0.10); tot+=e.cong;cnt++;}
  SIM.traffic=cnt?tot/cnt:0;

  for(const n of nodes.values()){
    if(n.busy>0)n.busy-=dt;
    if(n.e.length>2){n.phT=(n.phT||0)+dt; if(n.phT>11){n.phT=0;n.ph=((n.ph||0)+1)%2;}}
  }
  for(let i=VEH.n-1;i>=0;i--){
    const e=edges.get(VEH.edge[i]);
    if(!e){killVeh(i);continue;}
    const T=RTYPE[e.type];
    let tgt=VEH.tgt[i];
    // car following inside the same edge+direction
    const arr=edgeVeh.get(VEH.edge[i]*2+(VEH.dir[i]>0?0:1));
    if(arr){const k=arr.indexOf(i);
      if(k>=0&&k<arr.length-1){const j=arr[k+1],gap=VEH.s[j]-VEH.s[i];
        const need=5.5+VEH.spd[i]*0.85;
        if(gap<need)tgt=Math.min(tgt,Math.max(0,VEH.spd[j]*(gap/need)-(need-gap)*0.55));}}
    // junction control at the far end
    const rem=e.len-VEH.s[i];
    const endNode=VEH.dir[i]>0?e.b:e.a;
    if(rem<7){
      const N=nodes.get(endNode);
      let stop=false;
      if(N&&N.e.length>2){
        const grp=(N.e.indexOf(e.id))%2;
        if(grp!==(N.ph||0))stop=true;
        if(!stop&&N.busy>0)stop=true;
      } else if(N&&N.busy>0)stop=true;
      if(stop&&rem<4.5)tgt=0;
      else if(stop)tgt=Math.min(tgt,rem*0.7);
      else tgt=Math.min(tgt,4+rem);
    }
    const acc=tgt>VEH.spd[i]?3.4:9.5;
    VEH.spd[i]=Math.max(0,VEH.spd[i]+clamp(tgt-VEH.spd[i],-acc*dt*4,acc*dt));
    VEH.brake[i]=tgt<VEH.spd[i]-0.4?1:lerp(VEH.brake[i],0,dt*5);
    VEH.s[i]+=VEH.spd[i]*dt;
    if(VEH.s[i]>=e.len){
      const N=nodes.get(endNode);
      const p=VEH.path[i]; VEH.pi[i]++;
      if(!p||VEH.pi[i]>=p.length){ // arrived: re-target so the pool stays busy
        const b=Math.random()<0.5?resLots:workLots;
        if(b.length){const dl=b[(Math.random()*b.length)|0],nb=lotNode(dl);
          const np=nb!=null&&nb!==endNode?findPath(endNode,nb):null;
          if(np&&np.length){VEH.path[i]=np;VEH.pi[i]=0;
            const ne=edges.get(np[0]);VEH.edge[i]=np[0];VEH.dir[i]=ne.a===endNode?1:-1;
            VEH.s[i]=0;VEH.tgt[i]=RTYPE[ne.type].speed*(0.82+Math.random()*0.3);
            if(N)N.busy=0.55; continue;}}
        killVeh(i);continue;}
      const ne=edges.get(p[VEH.pi[i]]);
      if(!ne){killVeh(i);continue;}
      VEH.edge[i]=ne.id; VEH.dir[i]=ne.a===endNode?1:-1; VEH.s[i]=0;
      VEH.tgt[i]=RTYPE[ne.type].speed*(0.82+Math.random()*0.3);
      if(N)N.busy=0.5;
    }
    // world transform
    const s=VEH.dir[i]>0?VEH.s[i]:e.len-VEH.s[i];
    const p=edgeAtLen(e,clamp(s,0,e.len));
    const off=(T.lanes>2?T.w*0.25:T.w*0.24)*VEH.dir[i];
    VEH.x[i]=p.x-p.tz*off; VEH.z[i]=p.z+p.tx*off; VEH.y[i]=p.y+0.06;
    VEH.yaw[i]=Math.atan2(p.tx*VEH.dir[i],p.tz*VEH.dir[i]);
  }
  // pedestrians
  for(let i=PED.n-1;i>=0;i--){
    const e=edges.get(PED.edge[i]); if(!e){killPed(i);continue;}
    PED.s[i]+=PED.spd[i]*dt;
    PED.ph[i]+=PED.spd[i]*dt*2.6;
    if(PED.s[i]>=e.len){
      const endNode=PED.dir[i]>0?e.b:e.a, N=nodes.get(endNode);
      const p=PED.path[i];
      if(p){PED.pi[i]++;
        if(PED.pi[i]<p.length){const ne=edges.get(p[PED.pi[i]]);
          if(ne){PED.edge[i]=ne.id;PED.dir[i]=ne.a===endNode?1:-1;PED.s[i]=0;continue;}}
      }
      if(N&&N.e.length){                              // wander onward
        const nid=N.e[(Math.random()*N.e.length)|0], ne=edges.get(nid);
        if(ne){PED.edge[i]=nid;PED.dir[i]=ne.a===endNode?1:-1;PED.s[i]=0;PED.path[i]=null;
               if(Math.random()<0.5)PED.side[i]*=-1; continue;}}
      killPed(i);continue;}
    const s=PED.dir[i]>0?PED.s[i]:e.len-PED.s[i];
    const p=edgeAtLen(e,clamp(s,0,e.len));
    const T=RTYPE[e.type], off=(T.w/2+T.sw*0.55)*PED.side[i];
    PED.x[i]=p.x-p.tz*off; PED.z[i]=p.z+p.tx*off; PED.y[i]=p.y+0.20;
    PED.yaw[i]=Math.atan2(p.tx*PED.dir[i],p.tz*PED.dir[i]);
  }
  // keep the pool sized to what the city can support
  const wantV=clamp(Math.round(SIM.pop*0.16+SIM.jobs*0.06),0,MAXVEH);
  const wantP=clamp(Math.round(SIM.pop*0.13),0,MAXPED);
  let budget=14;
  while(VEH.n<wantV&&budget-->0)spawnVehicle();
  budget=14;
  while(PED.n<wantP&&budget-->0)spawnPed();
  while(VEH.n>wantV+30)killVeh(VEH.n-1);
  while(PED.n>wantP+30)killPed(PED.n-1);
}

// cash settles monthly; everything else refreshes continuously
function budgetTick(months){
  SIM.cash+=SIM.netIncome*months;
  if(SIM.cash<0&&!SIM.warnedBroke){SIM.warnedBroke=1;toast('Treasury in the red — raise taxes or cut upkeep','e','₡');}
  if(SIM.cash>0)SIM.warnedBroke=0;
}
