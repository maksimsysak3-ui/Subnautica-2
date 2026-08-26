/*═══════ TOOLS & INPUT ════════════════════════════════════════════════════*/
const dirty={road:0,zone:0,build:0,net:0,props:0};
const TOOLS={
  select:{cat:'select'},
  road_street:{cat:'road',type:'street',curve:false,name:'Street',cost:12},
  road_streetC:{cat:'road',type:'street',curve:true,name:'Curved Street',cost:14},
  road_ave:{cat:'road',type:'avenue',curve:false,name:'Avenue',cost:30},
  road_aveC:{cat:'road',type:'avenue',curve:true,name:'Curved Avenue',cost:34},
  zone_r:{cat:'zone',z:1,name:'Residential'}, zone_c:{cat:'zone',z:2,name:'Commercial'},
  zone_i:{cat:'zone',z:3,name:'Industry'},   zone_x:{cat:'zone',z:0,name:'De-zone'},
  pipe:{cat:'pipe',name:'Water/Sewer Pipe',cost:9},
  pipe_x:{cat:'pipe',rm:true,name:'Remove Pipe'},
  svc_coal:{cat:'svc',kind:'coal'}, svc_wind:{cat:'svc',kind:'wind'},
  svc_pump:{cat:'svc',kind:'pump'}, svc_tower:{cat:'svc',kind:'tower'},
  svc_sewer:{cat:'svc',kind:'sewer'},
  bulldoze:{cat:'bull',name:'Bulldoze'}
};
const CATS=[
  {id:'select',n:'Select',svg:'<path d="M5 3l14 8-6 1.7L10 20z"/>',
   items:[['select','Inspect','']]},
  {id:'road',n:'Roads',svg:'<path d="M5 21l3.2-18M19 21l-3.2-18M12 4.5v3M12 11v3M12 17.5v3"/>',
   items:[['road_street','Street','₡14/m'],['road_streetC','Curved St.','₡16/m'],
          ['road_ave','Avenue','₡34/m'],['road_aveC','Curved Ave.','₡38/m']]},
  {id:'zone',n:'Zoning',svg:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>',
   items:[['zone_r','Residential','',ZCOL[1]],['zone_c','Commercial','',ZCOL[2]],
          ['zone_i','Industry','',ZCOL[3]],['zone_x','De-zone','',[.5,.5,.5]]]},
  {id:'power',n:'Power',svg:'<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>',
   items:[['svc_coal','Coal Plant','₡12,000'],['svc_wind','Wind Turbine','₡3,200']]},
  {id:'water',n:'Water',svg:'<path d="M12 3s6 6.6 6 10.8a6 6 0 11-12 0C6 9.6 12 3 12 3z"/>',
   items:[['pipe','Lay Pipe','₡9/m'],['pipe_x','Remove Pipe',''],
          ['svc_pump','Pump Station','₡5,200'],['svc_tower','Water Tower','₡2,400']]},
  {id:'sewage',n:'Sewage',svg:'<path d="M3.5 8.5h17M4.5 8.5a4 4 0 004 4h7a4 4 0 014 4M8.5 4v4.5M19.5 16.5V21"/>',
   items:[['svc_sewer','Treatment','₡6,800']]},
  {id:'bull',n:'Demolish',svg:'<path d="M3.5 21h17M6.5 21V9.5L12 4l5.5 5.5V21M10 21v-5.5h4V21"/>',
   items:[['bulldoze','Bulldoze','']]}
];
let tool='select', toolCat='select';
const IN={mx:0,my:0,down:false,btn:0,dragged:false,pan:false,rot:false,shift:false,
  lx:0,ly:0,gx:0,gz:0,gy:0,valid:false,stage:0,a:null,b:null,ctrl:null,keys:{}};
const PREV={pts:[],cost:0,ok:true,msg:''};

//──── toast ───────────────────────────────────────────────────────────────
const toastEl=document.getElementById('toasts');
function toast(msg,kind,icon){
  const d=document.createElement('div');
  d.className='toast glass '+(kind||'');
  d.innerHTML='<span class="ic">'+(icon||'●')+'</span><span>'+msg+'</span>';
  toastEl.appendChild(d);
  setTimeout(()=>{d.style.transition='.35s';d.style.opacity=0;d.style.transform='translateY(-10px)';
    setTimeout(()=>d.remove(),360);},3200);
  while(toastEl.children.length>4)toastEl.firstChild.remove();
}
const hintEl=document.getElementById('hint');
function hint(h){ if(!h){hintEl.classList.remove('on');return;}
  hintEl.innerHTML=h; hintEl.classList.add('on'); }

//──── snapping / picking ──────────────────────────────────────────────────
function snapPoint(x,z,ignoreAngleFrom){
  let best=null,bd=64;
  for(const n of nodes.values()){const d=dist2(n.x,n.z,x,z);if(d<bd){bd=d;best=n;}}
  if(best)return {x:best.x,z:best.z,node:best};
  // snap onto an existing carriageway → the road gets split there
  let se=null,sbd=1e9,st=0;
  for(const e of edges.values()){
    for(let i=0;i<e.pts.length;i++){const p=e.pts[i];
      const d=dist2(p.x,p.z,x,z);
      if(d<sbd&&d<Math.pow(RTYPE[e.type].w*0.6,2)){sbd=d;se=e;st=p.s;}}}
  if(se)return {x:0,z:0,split:se,s:st,...edgeAtLen(se,st)};
  if(ignoreAngleFrom&&IN.shift){
    const a=Math.atan2(z-ignoreAngleFrom.z,x-ignoreAngleFrom.x);
    const L=dist(x,z,ignoreAngleFrom.x,ignoreAngleFrom.z);
    const q=Math.round(a/(PI/12))*(PI/12);
    return {x:ignoreAngleFrom.x+Math.cos(q)*L,z:ignoreAngleFrom.z+Math.sin(q)*L};
  }
  return {x:Math.round(x/2)*2,z:Math.round(z/2)*2};
}
function pickLot(x,z){
  let best=null,bd=(LOT_W*0.62)**2;
  for(const l of lots.values()){const d=dist2(l.x,l.z,x,z);if(d<bd){bd=d;best=l;}}
  return best;
}
function pickEdge(x,z){
  let best=null,bd=1e9;
  for(const e of edges.values()){
    const w=Math.pow(RTYPE[e.type].w*0.7,2);
    for(const p of e.pts){const d=dist2(p.x,p.z,x,z);if(d<bd&&d<w){bd=d;best=e;}}}
  return best;
}
function pickSvc(x,z){
  for(const s of services.values()){
    const c=Math.cos(-s.yaw),si=Math.sin(-s.yaw);
    const dx=x-s.x,dz=z-s.z;
    const lx=dx*c+dz*si, lz=-dx*si+dz*c;
    if(Math.abs(lx)<s.def.w/2&&Math.abs(lz)<s.def.d/2)return s;}
  return null;
}

//──── road commit ─────────────────────────────────────────────────────────
function roadCost(a,b,ctrl,type){
  let L=0;
  if(ctrl){let px=a.x,pz=a.z;
    for(let i=1;i<=12;i++){const t=i/12,it=1-t;
      const x=a.x*it*it+ctrl.x*2*it*t+b.x*t*t, z=a.z*it*it+ctrl.z*2*it*t+b.z*t*t;
      L+=dist(px,pz,x,z);px=x;pz=z;}}
  else L=dist(a.x,a.z,b.x,b.z);
  return {len:L,cost:Math.round(L*RTYPE[type].cost)};
}
function commitRoad(){
  const T=TOOLS[tool];
  const a=IN.a,b=IN.b,ctrl=IN.ctrl;
  const {len,cost}=roadCost(a,b,ctrl,T.type);
  if(len<9){toast('Segment too short','w','▲');return;}
  if(cost>SIM.cash){toast('Insufficient funds — need '+money(cost),'e','✕');return;}
  const na=a.node||(a.split?splitEdgeAtLen(a.split,a.s):addNode(a.x,a.z));
  const nb=b.node||(b.split?splitEdgeAtLen(b.split,b.s):addNode(b.x,b.z));
  if(!na||!nb||na===nb){toast('Invalid segment','w','▲');return;}
  const made=addRoad(na,nb,T.type,ctrl);
  if(!made.length){toast('A road already runs there','w','▲');return;}
  SIM.cash-=cost;
  dirty.road=dirty.zone=dirty.net=dirty.props=1;
  pathCache.clear();
}

//──── main pointer handling ───────────────────────────────────────────────
function updateHover(){
  const r=screenRay(IN.mx,IN.my);
  const g=rayGround(r);
  if(!g){IN.valid=false;return;}
  IN.gx=g.x;IN.gy=g.y;IN.gz=g.z;IN.valid=true;
  const T=TOOLS[tool];
  hoverLot=(T.cat==='zone'||T.cat==='select'||T.cat==='bull')?pickLot(g.x,g.z):null;
  if(T.cat==='road'){
    if(IN.stage===0)PREV.snap=snapPoint(g.x,g.z);
    else if(IN.stage===1)IN.b=snapPoint(g.x,g.z,IN.a);
    else if(IN.stage===2)IN.ctrl={x:g.x,z:g.z};
  }
}
function paintZone(){
  const T=TOOLS[tool];
  const l=pickLot(IN.gx,IN.gz); if(!l)return;
  if(l.zone===T.z)return;
  if(T.z===0){ if(l.lvl){SIM.cash-=0;} l.zone=0;l.lvl=0;l.grow=0;l.pop=0;l.jobs=0;l.abandoned=false; }
  else{ if(l.lvl&&l.zone!==T.z){l.lvl=0;l.grow=0;l.mesh=-1;} l.zone=T.z; }
  dirty.zone=1;dirty.build=1;
}
function paintPipe(){
  const T=TOOLS[tool];
  const e=pickEdge(IN.gx,IN.gz); if(!e)return;
  if(T.rm){ if(!e.pipe)return; e.pipe=false; }
  else{ if(e.pipe)return;
    const c=Math.round(e.len*9);
    if(c>SIM.cash){toast('Insufficient funds for pipe','e','✕');return;}
    SIM.cash-=c; e.pipe=true; }
  dirty.road=1;dirty.net=1;
}
function placeSvcAt(){
  const T=TOOLS[tool], d=SDEF[T.kind];
  if(d.cost>SIM.cash){toast('Insufficient funds — '+d.name+' costs '+money(d.cost),'e','✕');return;}
  const gy=groundY(IN.gx,IN.gz);
  if(T.kind==='pump'){
    let near=false;
    for(let a=0;a<8;a++){const x=IN.gx+Math.cos(a/8*TAU)*26,z=IN.gz+Math.sin(a/8*TAU)*26;
      if(groundY(x,z)<WATER_Y+0.4){near=true;break;}}
    if(!near){toast('Pumping station must be built beside fresh water','w','▲');return;}
  }
  if(gy<WATER_Y+0.3){toast('Cannot build below the waterline','w','▲');return;}
  for(const s of services.values())
    if(Math.abs(s.x-IN.gx)<(s.def.w+d.w)/2&&Math.abs(s.z-IN.gz)<(s.def.d+d.d)/2){
      toast('Overlaps '+s.def.name,'w','▲');return;}
  const s=placeService(T.kind,IN.gx,IN.gz,svcYaw);
  SIM.cash-=d.cost;
  if(s.node==null)toast(d.name+' built — but it is not connected to a road','w','▲');
  else toast(d.name+' online','g','✓');
  dirty.net=1;dirty.props=1;
  pruneForest();
}
function bulldoze(){
  const s=pickSvc(IN.gx,IN.gz);
  if(s){services.delete(s.id);SIM.cash-=Math.round(s.def.cost*0.06);
    toast(s.def.name+' demolished','','✕');dirty.net=1;return;}
  const l=pickLot(IN.gx,IN.gz);
  if(l&&l.lvl){l.lvl=0;l.grow=0;l.pop=0;l.jobs=0;l.abandoned=false;l.mesh=-1;
    SIM.cash-=40;dirty.build=1;dirty.zone=1;return;}
  const e=pickEdge(IN.gx,IN.gz);
  if(e){SIM.cash-=Math.round(e.len*2);removeEdge(e);
    dirty.road=dirty.zone=dirty.net=dirty.props=1;pathCache.clear();
    for(let i=VEH.n-1;i>=0;i--)if(VEH.edge[i]===e.id)killVeh(i);
    for(let i=PED.n-1;i>=0;i--)if(PED.edge[i]===e.id)killPed(i);
    return;}
  if(l&&l.zone){l.zone=0;dirty.zone=1;}
}
let svcYaw=0;
function onDown(ev){
  cv.setPointerCapture(ev.pointerId);
  IN.down=true;IN.btn=ev.button;IN.dragged=false;IN.lx=ev.clientX;IN.ly=ev.clientY;
  if(ev.button===2||ev.button===1){IN.rot=(ev.button===2);IN.pan=(ev.button===1);return;}
  updateHover(); if(!IN.valid)return;
  const T=TOOLS[tool];
  if(T.cat==='zone'){paintZone();}
  else if(T.cat==='pipe'){paintPipe();}
}
function onMove(ev){
  const dx=ev.clientX-IN.lx, dy=ev.clientY-IN.ly;
  IN.mx=ev.clientX;IN.my=ev.clientY;
  if(IN.down&&(Math.abs(dx)+Math.abs(dy)>3))IN.dragged=true;
  if(IN.down&&IN.rot){
    CAM.yaw-=dx*0.0056; CAM.pitch=clamp(CAM.pitch+dy*0.0042,0.16,1.50);
    IN.lx=ev.clientX;IN.ly=ev.clientY;return;}
  if(IN.down&&IN.pan){
    const k=CAM.dDist*0.0016, c=Math.cos(CAM.dYaw),s=Math.sin(CAM.dYaw);
    CAM.tx-=(dx*c-dy*s)*k; CAM.tz+=(dx*s+dy*c)*k;
    IN.lx=ev.clientX;IN.ly=ev.clientY;return;}
  updateHover();
  if(IN.down&&IN.btn===0&&IN.valid){
    const T=TOOLS[tool];
    if(T.cat==='zone')paintZone();
    else if(T.cat==='pipe')paintPipe();
    else if(T.cat==='bull'&&IN.dragged)bulldoze();
    else if(T.cat==='select'&&IN.dragged){
      const k=CAM.dDist*0.0016,c=Math.cos(CAM.dYaw),s=Math.sin(CAM.dYaw);
      CAM.tx-=(dx*c-dy*s)*k;CAM.tz+=(dx*s+dy*c)*k;
      IN.lx=ev.clientX;IN.ly=ev.clientY;}
  }
}
function onUp(ev){
  const wasDrag=IN.dragged;
  IN.down=false;IN.rot=false;IN.pan=false;
  if(ev.button!==0){
    if(ev.button===2&&!wasDrag&&IN.stage>0){IN.stage=0;IN.a=IN.b=IN.ctrl=null;}
    return;}
  if(!IN.valid)return;
  const T=TOOLS[tool];
  if(T.cat==='road'){
    if(IN.stage===0){IN.a=snapPoint(IN.gx,IN.gz);IN.stage=1;IN.b=IN.a;}
    else if(IN.stage===1){IN.b=snapPoint(IN.gx,IN.gz,IN.a);
      if(T.curve){IN.ctrl={x:(IN.a.x+IN.b.x)/2,z:(IN.a.z+IN.b.z)/2};IN.stage=2;}
      else{commitRoad();IN.a=IN.b?{x:IN.b.x,z:IN.b.z,node:nodes.get(IN.b.node?IN.b.node.id:-1)||null}:null;
        IN.a=snapPoint(IN.b.x,IN.b.z);IN.stage=1;}}
    else{commitRoad();IN.a=snapPoint(IN.b.x,IN.b.z);IN.b=IN.a;IN.ctrl=null;IN.stage=1;}
    return;}
  if(T.cat==='svc'&&!wasDrag){placeSvcAt();return;}
  if(T.cat==='bull'&&!wasDrag){bulldoze();return;}
  if(T.cat==='select'&&!wasDrag){
    const s=pickSvc(IN.gx,IN.gz);
    if(s){selSvc=s;selLot=null;openInspector();return;}
    const l=pickLot(IN.gx,IN.gz);
    if(l){selLot=l;selSvc=null;openInspector();return;}
    const e=pickEdge(IN.gx,IN.gz);
    if(e){selLot=null;selSvc=null;selEdge=e;openInspector();return;}
    selLot=selSvc=selEdge=null;closeInspector();}
}
let selEdge=null;

/*═══════ UI CONSTRUCTION ══════════════════════════════════════════════════*/
const catsEl=document.getElementById('cats'), subEl=document.getElementById('sub');
function buildToolbar(){
  CATS.forEach(c=>{
    const b=document.createElement('button');
    b.className='cat'+(c.id==='select'?' on':'');
    b.innerHTML='<svg viewBox="0 0 24 24">'+c.svg+'</svg><span class="n">'+c.n+'</span>';
    b.onclick=()=>selectCat(c.id);
    b.dataset.cat=c.id; catsEl.appendChild(b);});
  selectCat('select');
}
function selectCat(id){
  toolCat=id;
  [...catsEl.children].forEach(b=>b.classList.toggle('on',b.dataset.cat===id));
  const c=CATS.find(x=>x.id===id);
  subEl.innerHTML='';
  c.items.forEach(([tid,name,cost,col])=>{
    const b=document.createElement('button');
    b.className='itm'; b.dataset.tool=tid;
    let sw='';
    if(col&&Array.isArray(col))sw='<div class="sw" style="background:rgb('+
      col.map(v=>Math.round(v*255)).join(',')+')"></div>';
    b.innerHTML=sw+'<span class="n">'+name+'</span>'+(cost?'<span class="c">'+cost+'</span>':'');
    b.onclick=()=>setTool(tid); subEl.appendChild(b);});
  subEl.classList.toggle('on',c.items.length>0);
  setTool(c.items[0][0]);
}
function setTool(t){
  tool=t; IN.stage=0;IN.a=IN.b=IN.ctrl=null;
  [...subEl.children].forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  const T=TOOLS[t];
  dirty.zone=1;
  let H='';
  switch(T.cat){
    case 'select':H='<b>Inspect</b> — click any building, road or utility. <kbd>LMB</kbd> drag to pan · <kbd>RMB</kbd> orbit · <kbd>Wheel</kbd> zoom';break;
    case 'road':H='<b>'+T.name+'</b> — click to start, click to finish'+(T.curve?', then click to set the curve':'')+'. <kbd>Shift</kbd> angle-snap · <kbd>RMB</kbd> cancel';break;
    case 'zone':H='<b>'+T.name+'</b> — drag along a road frontage to paint parcels';break;
    case 'pipe':H='<b>'+T.name+'</b> — drag along roads. Pipe is laid in the road trench and carries both water and sewage';break;
    case 'svc':H='<b>'+SDEF[T.kind].name+'</b> — '+SDEF[T.kind].desc+' <kbd>R</kbd> rotate';break;
    case 'bull':H='<b>Bulldoze</b> — click or drag over buildings, roads and utilities';break;
  }
  hint(H||'');
}
//──── inspector ────────────────────────────────────────────────────────────
const inspEl=document.getElementById('insp'),ibd=document.getElementById('ibd');
function closeInspector(){inspEl.classList.remove('on');}
document.getElementById('ix').onclick=()=>{selLot=selSvc=selEdge=null;closeInspector();};
function bar(label,v,col,txt){
  return '<div class="mtr"><div class="r1"><span>'+label+'</span><b>'+(txt||pct(v))+
    '</b></div><div class="trk"><div style="width:'+clamp(v*100,0,100)+'%;background:'+col+'"></div></div></div>';
}
function openInspector(){
  const t=document.getElementById('i-t'),s=document.getElementById('i-s');
  inspEl.classList.add('on');
  if(selLot){
    const l=selLot;
    t.textContent=l.lvl?(['','Home','Shop','Works'][l.zone]+' · Level '+l.lvl):'Vacant Parcel';
    s.textContent=ZNAME[l.zone];
    let h='';
    if(l.lvl){
      h+='<div class="row"><span>Residents</span><b>'+Math.round(l.pop)+'</b></div>';
      if(l.zone!==1)h+='<div class="row"><span>Jobs</span><b>'+Math.round(l.jobs)+'</b></div>';
      h+='<div class="row"><span>Land value</span><b>'+money(Math.round(l.value*180000))+'</b></div>';
      h+='<div class="row"><span>Condition</span><b class="'+(l.abandoned?'r':'g')+'">'+
         (l.abandoned?'ABANDONED':'Occupied')+'</b></div>';
    } else h+='<div class="row"><span>Status</span><b class="y">Awaiting development</b></div>';
    h+='<div style="display:flex;flex-direction:column;gap:6px;margin-top:3px">';
    h+=bar('Land value',l.value,'linear-gradient(90deg,#3a6,#fd4)');
    h+=bar('Pollution',sat(l.poll*0.055),'linear-gradient(90deg,#4c8,#e55)');
    if(l.zone===1)h+=bar('Happiness',l.happy,'linear-gradient(90deg,#e55,#4e9)');
    h+='</div>';
    h+='<div class="hd" style="margin-top:4px">Utilities</div><div class="chips">';
    h+='<div class="chip '+(l.pow?'':'bad')+'">⚡ '+(l.pow?'POWERED':'NO POWER')+'</div>';
    h+='<div class="chip '+(l.wat?'':'bad')+'">💧 '+(l.wat?'WATER':'NO WATER')+'</div>';
    h+='<div class="chip '+(l.sew?'':'bad')+'">♻ '+(l.sew?'SEWER':'NO SEWER')+'</div></div>';
    ibd.innerHTML=h;
  } else if(selSvc){
    const v=selSvc.def;
    t.textContent=v.name; s.textContent=v.cat.toUpperCase()+' UTILITY';
    let h='<div class="row"><span>Upkeep</span><b>'+money(v.up)+'/mo</b></div>';
    if(v.power)h+='<div class="row"><span>Generation</span><b class="g">'+fmt(v.power)+' kW</b></div>';
    if(v.water)h+='<div class="row"><span>Pumping</span><b class="g">'+fmt(v.water)+' m³</b></div>';
    if(v.sewage)h+='<div class="row"><span>Treatment</span><b class="g">'+fmt(v.sewage)+' m³</b></div>';
    h+='<div class="row"><span>Grid link</span><b class="'+(selSvc.node!=null?'g':'r')+'">'+
       (selSvc.node!=null?'CONNECTED':'ISOLATED')+'</b></div>';
    h+='<div class="row"><span>Pollution</span><b class="'+(v.poll>12?'r':'y')+'">'+v.poll+'</b></div>';
    h+='<div style="font:400 10.5px var(--ff);color:var(--tx-faint);margin-top:6px;line-height:1.5">'+v.desc+'</div>';
    ibd.innerHTML=h;
  } else if(selEdge){
    const e=selEdge,T2=RTYPE[e.type];
    t.textContent=T2.name; s.textContent=e.ctrl?'CURVED SEGMENT':'STRAIGHT SEGMENT';
    let h='<div class="row"><span>Length</span><b>'+e.len.toFixed(1)+' m</b></div>';
    h+='<div class="row"><span>Lanes</span><b>'+T2.lanes+'</b></div>';
    h+='<div class="row"><span>Vehicles</span><b>'+e.load+'</b></div>';
    h+='<div class="row"><span>Parcels</span><b>'+e.lots.length+'</b></div>';
    h+='<div class="row"><span>Upkeep</span><b>'+money(Math.round(e.len*T2.cost*0.035))+'/mo</b></div>';
    h+='<div style="margin-top:3px">'+bar('Congestion',e.cong,'linear-gradient(90deg,#4e9,#e55)')+'</div>';
    h+='<div class="hd" style="margin-top:4px">Buried services</div><div class="chips">';
    h+='<div class="chip '+(e.pipe?'':'bad')+'">'+(e.pipe?'💧 PIPE LAID':'✕ NO PIPE')+'</div>';
    h+='<div class="chip">⚡ POWER CARRIED</div></div>';
    ibd.innerHTML=h;
  } else closeInspector();
}
//──── HUD ─────────────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let lastHud=0;
function ubar(elId,txtId,use,cap,invert){
  const el=$(elId), tx=$(txtId);
  const f=cap>0?clamp(use/cap,0,1.4):(use>0?1.4:0);
  el.style.width=Math.min(100,f*100)+'%';
  el.style.background=f>1?'var(--bad)':f>0.88?'var(--am)':'var(--good)';
  tx.textContent=cap>0?Math.round(f*100)+'%':'—';
  tx.style.color=f>1?'var(--bad)':'var(--td)';
}
function updateHUD(){
  $('s-cash').textContent=money(SIM.cash);
  $('s-cash').className='v '+(SIM.cash<0?'dn':'');
  $('s-inc').textContent=(SIM.netIncome>=0?'+':'')+money(SIM.netIncome);
  $('s-inc').className='v '+(SIM.netIncome>=0?'up':'dn');
  $('s-pop').textContent=fmt(SIM.pop);
  $('s-job').textContent=fmt(SIM.jobsFilled)+'/'+fmt(SIM.jobs);
  ubar('u-pow','t-pow',SIM.powUse,SIM.powProd);
  ubar('u-wat','t-wat',SIM.watUse,SIM.watProd);
  ubar('u-sew','t-sew',SIM.sewUse,SIM.sewCap);
  const tel=$('u-tra'); tel.style.width=Math.min(100,SIM.traffic*100)+'%';
  tel.style.background=SIM.traffic>0.65?'var(--bad)':SIM.traffic>0.4?'var(--am)':'var(--good)';
  $('t-tra').textContent=SIM.traffic<0.25?'Free':SIM.traffic<0.5?'Busy':SIM.traffic<0.75?'Heavy':'Jam';
  const d=Math.floor(SIM.day)%7, dm=(Math.floor(SIM.day)%30)+1;
  $('c-date').textContent=DAYS[d]+' '+String(dm).padStart(2,'0')+' '+MONS[SIM.month%12]+' '+String(SIM.year+2024);
  $('c-time').textContent=String(Math.floor(SIM.hour)).padStart(2,'0')+':'+
    String(Math.floor(SIM.hour%1*60)).padStart(2,'0');
  $('tier').textContent=SIM.tier;
  $('unemp').textContent=pct(SIM.unemp)+' UNEMP';
  $('unemp').style.color=SIM.unemp>0.16?'var(--bad)':'var(--tf)';
  const hv=Math.round(SIM.happy*100);
  $('hapv').textContent=hv; $('hap-t').textContent=hv>=75?'Thriving':hv>=55?'Content':hv>=35?'Restless':'Angry';
  const hc=hv>=70?'var(--good)':hv>=45?'var(--am)':'var(--bad)';
  $('hapv').style.color=hc; $('hap-b').style.width=hv+'%'; $('hap-b').style.background=hc;
  $('vitals').innerHTML=
    bar('Land value',SIM.avgValue,'linear-gradient(90deg,#3d5b7a,#ffbf4d)')+
    bar('Pollution',sat(SIM.avgPoll*0.05),'linear-gradient(90deg,#54e39c,#ff6070)')+
    bar('Built parcels',lots.size?SIM.built/lots.size:0,'linear-gradient(90deg,#2b6f9a,#4fd2ff)',
        fmt(SIM.built)+' / '+fmt(lots.size))+
    bar('Treasury flow',sat(0.5+SIM.netIncome/9000),
        SIM.netIncome<0?'var(--bad)':'linear-gradient(90deg,#2f7d55,#54e39c)',
        money(SIM.netIncome)+'/mo');
  const al=[];
  if(SIM.powUse>SIM.powProd)al.push(['⚡ POWER DEFICIT','bad']);
  if(SIM.watUse>SIM.watProd)al.push(['💧 WATER SHORTAGE','bad']);
  if(SIM.sewUse>SIM.sewCap)al.push(['♻ SEWAGE OVERFLOW','bad']);
  if(SIM.cash<0)al.push(['₡ BANKRUPT','bad']);
  else if(SIM.netIncome<0)al.push(['↓ DEFICIT BUDGET','bad']);
  if(SIM.traffic>0.6)al.push(['🚗 GRIDLOCK','bad']);
  if(SIM.unemp>0.2&&SIM.pop>60)al.push(['UNEMPLOYMENT '+pct(SIM.unemp),'bad']);
  if(SIM.abandoned>0)al.push([SIM.abandoned+' ABANDONED','bad']);
  if(!al.length)al.push(['All systems nominal','']);
  $('alerts').innerHTML=al.map(a=>'<div class="chip '+a[1]+'">'+a[0]+'</div>').join('');
  $('d-r').style.height=(SIM.demand.r*100)+'%';
  $('d-c').style.height=(SIM.demand.c*100)+'%';
  $('d-i').style.height=(SIM.demand.i*100)+'%';
  if(selLot||selSvc||selEdge)openInspector();
}
//──── controls wiring ─────────────────────────────────────────────────────
function wire(){
  cv.addEventListener('pointerdown',onDown);
  cv.addEventListener('pointermove',onMove);
  window.addEventListener('pointerup',onUp);
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('wheel',e=>{
    e.preventDefault();
    const before=IN.valid?{x:IN.gx,z:IN.gz}:null;
    const f=Math.exp(e.deltaY*0.0013);
    CAM.dist=clamp(CAM.dist*f,14,760);
    if(before&&e.deltaY<0){                       // zoom toward the cursor
      CAM.tx=lerp(CAM.tx,before.x,0.16);CAM.tz=lerp(CAM.tz,before.z,0.16);}
  },{passive:false});
  document.querySelectorAll('.sp').forEach(b=>b.onclick=()=>{
    SIM.speed=+b.dataset.sp;
    document.querySelectorAll('.sp').forEach(x=>x.classList.toggle('on',x===b));});
  document.querySelectorAll('.ov').forEach(b=>b.onclick=()=>{
    overlay=b.dataset.ov;
    document.querySelectorAll('.ov').forEach(x=>x.classList.toggle('on',x===b));});
  window.addEventListener('keydown',e=>{
    IN.keys[e.code]=true; IN.shift=e.shiftKey;
    if(e.code==='Space'){e.preventDefault();
      const on=SIM.speed>0; SIM.speed=on?0:1;
      document.querySelectorAll('.sp').forEach(x=>x.classList.toggle('on',+x.dataset.sp===SIM.speed));}
    if(e.code==='Escape'){IN.stage=0;IN.a=IN.b=IN.ctrl=null;setTool('select');selectCat('select');}
    if(e.code==='KeyR')svcYaw+=PI/8;
    if(/^Digit[1-3]$/.test(e.code)){const n=+e.code.slice(5);SIM.speed=n;
      document.querySelectorAll('.sp').forEach(x=>x.classList.toggle('on',+x.dataset.sp===n));}
    const map={KeyQ:'road',KeyZ:'zone',KeyP:'power',KeyW:'water',KeyE:'sewage',KeyB:'bull',KeyV:'select'};
    if(map[e.code]&&!e.ctrlKey)selectCat(map[e.code]);
  });
  window.addEventListener('keyup',e=>{IN.keys[e.code]=false;IN.shift=e.shiftKey;});
}
function camKeys(dt){
  const k=IN.keys, sp=CAM.dDist*1.3*dt*(k.ShiftLeft?2.2:1);
  const c=Math.cos(CAM.dYaw),s=Math.sin(CAM.dYaw);
  let fx=0,fz=0;
  if(k.KeyW||k.ArrowUp)fz-=1; if(k.KeyS||k.ArrowDown)fz+=1;
  if(k.KeyA||k.ArrowLeft)fx-=1; if(k.KeyD||k.ArrowRight)fx+=1;
  if(fx||fz){const l=Math.hypot(fx,fz);fx/=l;fz/=l;
    CAM.tx+=(fx*c-fz*s)*sp; CAM.tz+=(-fx*s-fz*c)*sp;}
  if(k.KeyQ&&toolCat!=='road')CAM.yaw-=dt*1.1;
  if(k.KeyE&&toolCat!=='sewage')CAM.yaw+=dt*1.1;
}
