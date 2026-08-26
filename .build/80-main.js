// aerial perspective: haze grows with camera height so wide shots read deep
const FOGD=()=>0.00058+SUN.night*0.00026+clamp(CAM.dDist-160,0,600)*0.0000019;
/*═══════ PREVIEW / GHOSTS ═════════════════════════════════════════════════*/
function unitBox(){const mb=new MeshBuilder();box(mb,0,0,0,1,1,1,[1,1,1],{ao0:1,ao1:1,em:.7,rg:.4});return mb.build();}
function drawPreview(){
  const M=A.prop.marker; if(!M)return;
  const T=TOOLS[tool];
  const put=(x,z,w,d,h,c,em,yaw)=>{
    M.push(x,groundY(x,z)+0.16,z,yaw||0,w,h||0.16,d,c[0]/2,c[1]/2,c[2]/2,0,em===undefined?0.55:em);};
  if(T.cat==='road'){
    const good=[0.35,1,0.65], bad=[1,0.3,0.3];
    const a=IN.stage>=1?IN.a:PREV.snap, b=IN.stage>=1?IN.b:null;
    if(a)put(a.x,a.z,2.4,2.4,0.3,good,0.8);
    if(a&&b){
      const ctrl=(IN.stage===2)?IN.ctrl:(T.curve?{x:(a.x+b.x)/2,z:(a.z+b.z)/2}:null);
      const {len,cost}=roadCost(a,b,ctrl,T.type);
      const ok=cost<=SIM.cash&&len>=9;
      const c=ok?good:bad, w=RTYPE[T.type].w;
      const n=clamp(Math.round(len/3.2),2,140);
      let px=a.x,pz=a.z;
      for(let i=0;i<=n;i++){
        const t=i/n;
        let x,z;
        if(ctrl){const it=1-t;x=a.x*it*it+ctrl.x*2*it*t+b.x*t*t;z=a.z*it*it+ctrl.z*2*it*t+b.z*t*t;}
        else{x=lerp(a.x,b.x,t);z=lerp(a.z,b.z,t);}
        const yaw=Math.atan2(x-px,z-pz);
        if(i%2===0)put(x,z,w,2.0,0.12,c,0.5,yaw);
        px=x;pz=z;}
      put(b.x,b.z,2.4,2.4,0.3,c,0.8);
      if(ctrl&&IN.stage===2)put(ctrl.x,ctrl.z,1.6,1.6,0.5,[1,.85,.3],0.9);
      PREV.msg=money(cost)+' · '+len.toFixed(0)+' m';
    }
  } else if(T.cat==='svc'&&IN.valid){
    const d=SDEF[T.kind], ok=d.cost<=SIM.cash;
    const c=ok?[0.35,1,0.65]:[1,0.3,0.3];
    const cy=Math.cos(svcYaw),sy=Math.sin(svcYaw);
    for(let i=0;i<=10;i++){const t=i/10-0.5;
      for(const s of[-1,1]){
        let lx=t*d.w, lz=s*d.d/2;
        put(IN.gx+lx*cy+lz*sy,IN.gz-lx*sy+lz*cy,1.2,1.2,0.3,c,0.7,svcYaw);
        lx=s*d.w/2; lz=t*d.d;
        put(IN.gx+lx*cy+lz*sy,IN.gz-lx*sy+lz*cy,1.2,1.2,0.3,c,0.7,svcYaw);}}
    PREV.msg=d.name+' · '+money(d.cost);
  } else if((T.cat==='zone'||T.cat==='bull')&&hoverLot){
    const l=hoverLot, c=T.cat==='bull'?[1,.35,.3]:ZCOL[T.z||0];
    const cy=Math.cos(l.yaw),sy=Math.sin(l.yaw);
    for(let i=0;i<=6;i++){const t=i/6-0.5;
      for(const s of[-1,1]){
        let lx=t*LOT_W,lz=s*LOT_D/2;
        put(l.x+lx*cy+lz*sy,l.z-lx*sy+lz*cy,1.1,1.1,0.25,c,0.75,l.yaw);
        lx=s*LOT_W/2;lz=t*LOT_D;
        put(l.x+lx*cy+lz*sy,l.z-lx*sy+lz*cy,1.1,1.1,0.25,c,0.75,l.yaw);}}
  } else if(T.cat==='pipe'&&IN.valid){
    const e=pickEdge(IN.gx,IN.gz);
    if(e)for(const p of e.pts)put(p.x,p.z,2.0,2.0,0.2,T.rm?[1,.4,.3]:[.3,.75,1],0.7);
  }
  if(selLot){const l=selLot,cy=Math.cos(l.yaw),sy=Math.sin(l.yaw);
    for(let i=0;i<=8;i++){const t=i/8-0.5;
      for(const s of[-1,1]){
        let lx=t*LOT_W,lz=s*LOT_D/2;
        put(l.x+lx*cy+lz*sy,l.z-lx*sy+lz*cy,0.9,0.9,0.2,[1,1,1],0.9,l.yaw);
        lx=s*LOT_W/2;lz=t*LOT_D;
        put(l.x+lx*cy+lz*sy,l.z-lx*sy+lz*cy,0.9,0.9,0.2,[1,1,1],0.9,l.yaw);}}}
}

/*═══════ WATER QUAD ═══════════════════════════════════════════════════════*/
const waterVAO=gl.createVertexArray();
{const b=gl.createBuffer();gl.bindVertexArray(waterVAO);gl.bindBuffer(gl.ARRAY_BUFFER,b);
 const S=MAP*3;
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-S,-S, S,-S, S,S, -S,-S, S,S, -S,S]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);}

/*═══════ RESIZE ═══════════════════════════════════════════════════════════*/
let renderScale=1;
function resize(){
  const dpr=clamp(window.devicePixelRatio||1,1,2);
  const w=Math.max(2,Math.round(cv.clientWidth*dpr*renderScale));
  const h=Math.max(2,Math.round(cv.clientHeight*dpr*renderScale));
  if(cv.width===w&&cv.height===h)return;
  cv.width=w;cv.height=h;allocRT(w,h);
}
window.addEventListener('resize',()=>{cv.width=0;resize();});

/*═══════ STARTER SETTLEMENT ═══════════════════════════════════════════════*/
function starterCity(){
  const cx=-60,cz=-70;
  const mk=(x1,z1,x2,z2,ty)=>addRoad(addNode(x1,z1),addNode(x2,z2),ty);
  mk(cx-158,cz,cx+158,cz,'avenue');                     // the spine
  for(let i=-2;i<=2;i++)mk(cx+i*63,cz-126,cx+i*63,cz+126,'street');
  for(const zz of[-126,-63,63,126])mk(cx-126,cz+zz,cx+126,cz+zz,'street');
  // service spurs, anchored on nodes that already exist
  mk(cx+158,cz,cx+212,cz+92,'street');
  mk(cx+126,cz-126,cx+164,cz-160,'street');
  for(const e of edges.values()){e.pipe=true;rebuildLots(e);}
  rebuildNetworks();
  placeService('coal',cx+224,cz+112,0.7);
  placeService('tower',cx-20,cz-140,0);
  placeService('sewer',cx+176,cz-176,0.7);
  // find real shoreline and run a spur out to a pumping station
  let sh=null,sd=1e9;
  for(let a=0;a<420;a++){
    const x=-HALF+20+Math.random()*(MAP-40), z=-HALF+20+Math.random()*(MAP-40);
    const y=groundY(x,z);
    if(y<1.0||y>3.2)continue;
    let coast=false;
    for(let k=0;k<8;k++)if(groundY(x+Math.cos(k/8*TAU)*24,z+Math.sin(k/8*TAU)*24)<WATER_Y){coast=true;break;}
    if(!coast)continue;
    const d=dist(x,z,cx,cz); if(d<sd){sd=d;sh=[x,z];}
  }
  if(sh){
    let best=null,bd=1e9;
    for(const n of nodes.values()){const d=dist2(n.x,n.z,sh[0],sh[1]);if(d<bd){bd=d;best=n;}}
    if(best){
      const dx=sh[0]-best.x,dz=sh[1]-best.z,L=Math.hypot(dx,dz)||1;
      const ex=sh[0]-dx/L*16, ez=sh[1]-dz/L*16;
      addRoad(best,addNode(ex,ez),'street');
      for(const e of edges.values()){e.pipe=true;rebuildLots(e);}
      rebuildNetworks();
      placeService('pump',sh[0]-dx/L*6,sh[1]-dz/L*6,Math.atan2(dx,dz));
    }
  }
  rebuildNetworks();
  // zoning: commerce on the spine, industry east, housing everywhere else
  for(const l of lots.values()){
    const e=edges.get(l.e);
    if(l.x>cx+100)l.zone=3;                       // industry to the east
    else if(e&&e.type==='avenue')l.zone=2;        // commerce fronts the spine only
    else l.zone=1;
  }
  SIM.cash=140000;
  CAM.tx=cx;CAM.tz=cz;CAM.dTx=cx;CAM.dTz=cz;CAM.dist=230;CAM.dDist=230;
}

/*═══════ BOOT ════════════════════════════════════════════════════════════*/
const lbf=document.getElementById('lbf'), lt=document.getElementById('lt');
let assetStep=null, booted=false;
function boot(){
  resize();
  buildToolbar(); wire();
  lt.textContent='forging assets…';
  assetStep=buildAssets(p=>{lbf.style.width=(p*76)+'%';});
  requestAnimationFrame(bootStep);
}
function bootStep(){
  const t0=performance.now();
  let done=false;
  while(performance.now()-t0<26&&!done)done=assetStep();
  if(!done){requestAnimationFrame(bootStep);return;}
  lt.textContent='planting terrain…'; lbf.style.width='82%';
  requestAnimationFrame(()=>{
    buildForest();
    lt.textContent='surveying the valley…'; lbf.style.width='90%';
    requestAnimationFrame(()=>{
      A.prop.marker=mkBatch(unitBox(),4200);
      starterCity();
      rebuildRoadBatch(); rebuildZoneBatch(false); buildProps(); pruneForest();
      rebuildNetworks(); updateLotUtilities(); refreshLotIndex();
      refreshDyn();
      lt.textContent='ready'; lbf.style.width='100%';
      setTimeout(()=>{document.getElementById('load').classList.add('off');
        toast('Welcome to your settlement. Zone, connect, and grow.','g','◆');
        setTimeout(()=>hint('<b>Roads</b> <kbd>Q</kbd> · <b>Zoning</b> <kbd>Z</kbd> · <b>Power</b> <kbd>P</kbd> · <b>Water</b> <kbd>W</kbd> · <b>Sewage</b> <kbd>E</kbd> · <b>Bulldoze</b> <kbd>B</kbd>'),1400);
      },260);
      booted=true; requestAnimationFrame(frame);
    });
  });
}

/*═══════ FRAME ═══════════════════════════════════════════════════════════*/
let prevT=performance.now(), acc=0, fps=60, frames=0, fpsT=0, simAcc=0, monthAcc=0, budgetAcc=0;
let gpuAvg=16;
function frame(now){
  const raw=Math.min(0.1,(now-prevT)/1000); prevT=now;
  frames++; fpsT+=raw;
  if(fpsT>0.5){fps=frames/fpsT;frames=0;fpsT=0;
    // adaptive resolution keeps big cities smooth without touching the sim
    if(fps<44&&renderScale>0.68){renderScale=Math.max(0.68,renderScale-0.07);cv.width=0;resize();}
    else if(fps>58&&renderScale<1){renderScale=Math.min(1,renderScale+0.05);cv.width=0;resize();}}
  const dt=raw;
  STAT.time=(STAT.time||0)+dt;
  camKeys(dt); camUpdate(dt);
  if(!IN.down)updateHover();

  // ── simulation clock: 1 real second ≈ 1 in-game hour at speed 1 ──
  const mul=[0,1,3,9][SIM.speed]||0;
  const sdt=dt*mul;
  if(mul>0){
    SIM.hour+=sdt;
    while(SIM.hour>=24){SIM.hour-=24;SIM.day++;
      if(SIM.day%30===0){SIM.month++;if(SIM.month%12===0)SIM.year++;}}
    simAcc+=sdt;
    if(simAcc>0.5){                                   // sub-daily systems
      growthTick(simAcc*1.0); simAcc=0;
      refreshLotIndex();}
    monthAcc+=sdt;
    if(monthAcc>2){                                   // every two in-game hours
      fieldTick(); updateLotUtilities(); statsTick();
      budgetAcc+=monthAcc; monthAcc=0;
      if(budgetAcc>=720){budgetTick(budgetAcc/720);budgetAcc=0;}}
    trafficTick(Math.min(0.05,dt*Math.min(mul,3)));
  }
  updateSun(SIM.hour);

  // ── deferred rebuilds (never more than one heavy job per frame) ──
  if(dirty.road){rebuildRoadBatch();buildProps();refreshDyn();dirty.road=0;dirty.zone=1;}
  else if(dirty.net){rebuildNetworks();updateLotUtilities();dirty.net=0;}
  else if(dirty.zone){rebuildZoneBatch(toolCat==='zone');refreshDyn();dirty.zone=0;}
  else if(dirty.props){pruneForest();dirty.props=0;}

  populate(dt,STAT.time);
  drawPreview();
  STAT.draws=0;STAT.tris=0;STAT.inst=0;

  // ── shadow ──
  setLightMatrix();
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.shadowF);
  gl.viewport(0,0,SHADOW_SZ,SHADOW_SZ);
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.depthFunc(gl.LESS);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);
  renderScene('shadow');
  gl.cullFace(gl.BACK);

  // ── main ──
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.colF);
  gl.viewport(0,0,RW,RH);
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // sky
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  gl.useProgram(P.sky);
  gl.uniformMatrix4fv(P.sky.u.uInvVP,false,CAM.invVP);
  gl.uniform3f(P.sky.u.uEye,CAM.ex,CAM.ey,CAM.ez);
  gl.uniform3fv(P.sky.u.uSunDir,SUN.dir);gl.uniform3fv(P.sky.u.uSunCol,SUN.col);
  gl.uniform3fv(P.sky.u.uZen,SUN.zen);gl.uniform3fv(P.sky.u.uHor,SUN.hor);
  gl.uniform3fv(P.sky.u.uGnd,SUN.gnd);
  gl.uniform1f(P.sky.u.uNight,SUN.night);gl.uniform1f(P.sky.u.uTime,STAT.time);
  drawQuad();
  gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.enable(gl.CULL_FACE);
  renderScene('main');
  // water
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);
  gl.useProgram(P.water);
  gl.uniformMatrix4fv(P.water.u.uVP,false,CAM.vp);
  gl.uniform3f(P.water.u.uEye,CAM.ex,CAM.ey,CAM.ez);
  gl.uniform3fv(P.water.u.uSunDir,SUN.dir);gl.uniform3fv(P.water.u.uSunCol,SUN.col);
  gl.uniform3fv(P.water.u.uSkyCol,SUN.sky);gl.uniform3fv(P.water.u.uFogCol,SUN.fog);
  gl.uniform3f(P.water.u.uDeep,0.020,0.075,0.105);
  gl.uniform3f(P.water.u.uShallow,0.075,0.24,0.26);
  gl.uniform1f(P.water.u.uTime,STAT.time);gl.uniform1f(P.water.u.uLvl,WATER_Y);
  gl.uniform1f(P.water.u.uFogD,FOGD());
  gl.uniform2f(P.water.u.uOfs,CAM.dTx,CAM.dTz);
  gl.bindVertexArray(waterVAO);gl.drawArrays(gl.TRIANGLES,0,6);
  gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);

  // ── post ──
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.CULL_FACE);
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.aoF);gl.viewport(0,0,AOW,AOH);
  gl.useProgram(P.ao);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.depT);
  gl.uniform1i(P.ao.u.uDepth,0);
  gl.uniformMatrix4fv(P.ao.u.uInvP,false,CAM.invP);
  gl.uniform2f(P.ao.u.uRes,AOW,AOH);
  gl.uniform1f(P.ao.u.uRad,26);gl.uniform1f(P.ao.u.uNear,CAM.near);gl.uniform1f(P.ao.u.uFar,CAM.far);
  drawQuad();
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.b0F);gl.viewport(0,0,BW,BH);
  gl.useProgram(P.bright);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.colT);
  gl.uniform1i(P.bright.u.uT,0);gl.uniform1f(P.bright.u.uThr,1.35);
  drawQuad();
  for(let i=0;i<2;i++){
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.b1F);
    gl.useProgram(P.blur);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.b0T);
    gl.uniform1i(P.blur.u.uT,0);gl.uniform2f(P.blur.u.uDir,1.4/BW,0);drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.b0F);
    gl.bindTexture(gl.TEXTURE_2D,RT.b1T);gl.uniform2f(P.blur.u.uDir,0,1.4/BH);drawQuad();}
  gl.bindFramebuffer(gl.FRAMEBUFFER,RT.ldrF);gl.viewport(0,0,RW,RH);
  gl.useProgram(P.comp);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.colT);gl.uniform1i(P.comp.u.uCol,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,RT.aoT);gl.uniform1i(P.comp.u.uAO,1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,RT.b0T);gl.uniform1i(P.comp.u.uBloom,2);
  gl.uniform2f(P.comp.u.uRes,RW,RH);
  gl.uniform1f(P.comp.u.uExp,0.76+SUN.night*0.52);
  gl.uniform1f(P.comp.u.uNight,SUN.night);
  gl.uniform1f(P.comp.u.uAOStr,1.05);
  gl.uniform1f(P.comp.u.uBloomStr,0.34+SUN.night*0.62);
  gl.uniform1f(P.comp.u.uTime,STAT.time);
  drawQuad();
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);
  gl.useProgram(P.fxaa);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,RT.ldrT);
  gl.uniform1i(P.fxaa.u.uT,0);gl.uniform2f(P.fxaa.u.uRes,RW,RH);
  drawQuad();

  // ── HUD ──
  if(now-lastHud>240){lastHud=now;updateHUD();
    document.getElementById('perf').innerHTML=
      '<b>'+fps.toFixed(0)+'</b> fps · '+(renderScale*100|0)+'% · '+STAT.draws+' draws<br>'+
      fmt(STAT.tris)+' tris · '+fmt(STAT.inst)+' instances<br>'+
      VEH.n+' vehicles · '+PED.n+' citizens<br>'+
      fmt(lots.size)+' parcels · '+edges.size+' segments';
  }
  if(PREV.msg&&(TOOLS[tool].cat==='road'||TOOLS[tool].cat==='svc')&&IN.stage>0){}
  requestAnimationFrame(frame);
}
boot();
