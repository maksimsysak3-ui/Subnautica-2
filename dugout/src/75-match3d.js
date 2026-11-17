/* ================= 3D match view =================
   Renders the engine's recorded frames with jointed players: shaped torso, shoulders, hips, knees,
   ankles, elbows, hands, head with ears/eyes/brows/hair, kit with collar, cuffs, sock bands and boots.
   A procedural gait drives running; one-off actions cover kicks, slides, headers, dives, throw-ins and celebrations. */
async function create3D(stage,cv,E){
 await loadThree();
 const T=THREE,renderer=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const scene=new T.Scene();scene.background=new T.Color('#050506');scene.fog=new T.Fog('#050506',140,320);
 const cam=new T.PerspectiveCamera(24,16/9,.3,800);cam.position.set(0,18,55);
 const others=shuffled(S.clubs.filter(c=>c.id!==E.T[0].club&&c.id!==E.T[1].club)).slice(0,10);
 const sc={scene,ads:[],home:clubOf(E.T[0].club),away:clubOf(E.T[1].club),sponsors:[clubOf(E.T[0].club),clubOf(E.T[1].club),...others]};
 let lastFov=0;
 const size=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;lastFov=0;cam.updateProjectionMatrix()};size();
 const ro=new ResizeObserver(size);ro.observe(stage);
 scene.add(new T.HemisphereLight('#dfe6ff','#24331f',.75));
 const sun=new T.DirectionalLight('#fff3df',2.7);sun.position.set(-28,62,30);sun.castShadow=true;
 Object.assign(sun.shadow.camera,{left:-60,right:60,top:40,bottom:-40,near:10,far:160});sun.shadow.camera.updateProjectionMatrix();
 sun.shadow.mapSize.set(4096,4096);sun.shadow.bias=-.00035;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
 const rim=new T.DirectionalLight('#ffe2b8',1.1);rim.position.set(35,30,-45);scene.add(rim);
 const fill=new T.DirectionalLight('#c9d4ff',.45);fill.position.set(10,25,50);scene.add(fill);
 buildStadium(sc);
 // ---- players: a clean, boxy stylised figure dressed in the club's real kit ----
 // The shirt front and back are the game's own kit artwork (same as the club screens), so the 3D kit matches exactly.
 const [hk,ak]=kitColors(E),kits=[hk,ak],cache={},texCache={};
 const mat=(c,r=.75,m=0)=>cache[c+r+m]||(cache[c+r+m]=new T.MeshStandardMaterial({color:c,roughness:r,metalness:m}));
 const SKINS=['#f3d2ba','#e8bf9f','#d9a77f','#c48a61','#a66c47','#8a5335','#6c3f28','#4c2a1b'],HAIRS=['#141010','#2c1e15','#55361f','#7a3a1b','#c9a15a','#a3a3a6'];
 const looks=pid=>{const r=R(Math.imul(pid,2654435761)>>>0),p=S.players[pid],dark=['NGA','GHA','SEN','CIV'].includes(p.nat)||(p.nat==='BRA'&&r.chance(.5))||(p.nat==='FRA'&&r.chance(.4))||(['ENG','NED','BEL'].includes(p.nat)&&r.chance(.2));
  return{skin:SKINS[dark?r.i(5,7):r.i(0,4)],hair:p.age>=33&&r.chance(.4)?HAIRS[5]:HAIRS[dark?r.i(0,1):r.i(0,4)],style:r.pick(dark?['buzz','buzz','short','afro','bald']:['short','short','buzz','bun','long','bald']),tall:.94+(p.ht-165)/35*.14,eye:r.pick(['#3a2a1e','#2a1d14','#4a5a6a','#3d5a3a'])}};
 function svgTex(svg,w,h,crop,fill){
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle=fill;x.fillRect(0,0,w,h);
  const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;
  const img=new Image();img.onload=()=>{x.clearRect(0,0,w,h);x.fillStyle=fill;x.fillRect(0,0,w,h);x.drawImage(img,crop[0],crop[1],crop[2],crop[3],0,0,w,h);t.needsUpdate=true};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="400" height="424" '));return t;
 }
 const TORSO_CROP=[84,30,232,372];
 // Which club kit (home/away/third) each side is wearing, plus goalkeeper kits as pseudo-kits.
 const sideKit=s=>{const c=clubOf(E.T[s].club),k=kits[s],w=Object.keys(c.kits).find(q=>c.kits[q]===k)||'home';return{c,w,k}};
 const GK=[{base:'#c7e83a',alt:'#1d2a10',trim:'#1d2a10',pattern:'plain',collar:'crew'},{base:'#ff7a1a',alt:'#2a1405',trim:'#2a1405',pattern:'plain',collar:'crew'}];
 function kitFor(side,gk){const{c,w,k}=sideKit(side);if(!gk)return{c,w,k};const gkk=GK[side];return{c:Object.assign({},c,{kits:Object.assign({},c.kits,{gk:gkk})}),w:'gk',k:gkk}}
 const shortsOf=k=>k.shorts||(k.pattern==='plain'||k.pattern==='gradient'?(contrast(k.base,k.alt)>1.5?k.alt:k.trim):contrast(k.trim,k.base)>1.4?k.trim:'#17171b');
 const socksOf=k=>k.socks||(k.pattern==='plain'?k.base:k.alt===shortsOf(k)?k.base:k.alt);
 function sleeveTex(k){const key='sl'+k.base+k.alt+k.pattern;if(texCache[key])return texCache[key];
  return texCache[key]=canvasTex(64,64,(x,W,H)=>{x.fillStyle=k.base;x.fillRect(0,0,W,H);x.fillStyle=k.alt;
   if(k.pattern==='stripes')for(let i=8;i<W;i+=32)x.fillRect(i,0,14,H);else if(k.pattern==='pinstripe')for(let i=3;i<W;i+=12)x.fillRect(i,0,2,H);else if(k.pattern==='hoops')for(let y=8;y<H;y+=32)x.fillRect(0,y,W,14);else if(k.pattern==='gradient'){const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,k.base);g.addColorStop(1,mix(k.base,k.alt,.4));x.fillStyle=g;x.fillRect(0,0,W,H)}})}
 function faceTex(lk){const key='f'+lk.skin+lk.hair+lk.eye;if(texCache[key])return texCache[key];
  return texCache[key]=canvasTex(128,128,(x,W,H)=>{x.fillStyle=lk.skin;x.fillRect(0,0,W,H);
   const sh=mix(lk.skin,'#3a1a10',.22),br=mix(lk.hair,'#000000',.2);
   x.fillStyle=mix(lk.skin,'#ffffff',.08);x.fillRect(18,22,92,18);
   for(const q of[-1,1]){const cx=64+q*24;x.fillStyle=br;x.fillRect(cx-14,44,28,7);x.fillStyle='#f4f0ea';x.fillRect(cx-11,56,22,12);x.fillStyle=lk.eye;x.fillRect(cx-5,56,11,12);x.fillStyle='#0b0b0c';x.fillRect(cx-2,59,5,6);x.fillStyle=sh;x.fillRect(cx-12,69,24,3)}
   x.fillStyle=sh;x.fillRect(58,62,12,26);x.fillStyle=mix(lk.skin,'#000000',.32);x.fillRect(57,86,14,4);
   x.fillStyle=mix(lk.skin,'#7a2c2c',.35);x.fillRect(46,99,36,6);x.fillStyle=mix(lk.skin,'#2a1010',.4);x.fillRect(46,99,36,2);
   x.fillStyle=mix(lk.skin,'#000000',.08);x.fillRect(0,112,W,16)})}
 function hairTex(col){const key='h'+col;if(texCache[key])return texCache[key];
  const t=canvasTex(64,64,(x,W,H)=>{x.fillStyle=col;x.fillRect(0,0,W,H);for(let i=0;i<260;i++){x.fillStyle=Math.random()<.5?mix(col,'#000000',.3):mix(col,'#ffffff',.12);x.fillRect(Math.random()*W,Math.random()*H,2,4+Math.random()*5)}});
  return texCache[key]=new T.MeshStandardMaterial({map:t,roughness:.85})}
 const BX=(w,h,d)=>{const k=w+'|'+h+'|'+d;return cache['g'+k]||(cache['g'+k]=new T.BoxGeometry(w,h,d))};
 const blobTex=canvasTex(64,64,x=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}),blobMat=new T.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}),blobG=new T.PlaneGeometry(1,1);
 const P=[];
 function buildPlayer(k){
  const sp=E.P[k],side=k<11?0:1,gk=sp.pos==='GK',{c,w,k:kit}=kitFor(side,gk),lk=looks(sp.pid);
  const tk='t'+side+gk;
  const front=texCache[tk+'f']||(texCache[tk+'f']=new T.MeshStandardMaterial({map:svgTex(kitSVG(c,w),256,320,TORSO_CROP,kit.base),roughness:.78}));
  const back=new T.MeshStandardMaterial({map:svgTex(kitSVG(c,w,{back:true,name:sp.name,num:sp.num}),256,320,TORSO_CROP,kit.base),roughness:.78});
  const sideM=texCache[tk+'s']||(texCache[tk+'s']=new T.MeshStandardMaterial({map:sleeveTex(kit),roughness:.78}));
  const base=mat(kit.base),trim=mat(kit.trim,.6),shorts=mat(shortsOf(kit)),socks=mat(socksOf(kit)),skin=mat(lk.skin,.62),boot=mat(side?'#16161a':'#f2f2f2',.35,.15),sole=mat('#d9d9d9',.5);
  const headM=[skin,skin,skin,skin,new T.MeshStandardMaterial({map:faceTex(lk),roughness:.6}),skin];
  const root=new T.Group(),body=new T.Group(),pelvis=new T.Group(),spine=new T.Group(),chest=new T.Group();root.add(body);body.add(pelvis);pelvis.position.y=.95;pelvis.add(spine);spine.position.y=.06;spine.add(chest);body.rotation.order='YXZ';
  const add=(g,m,par,x=0,y=0,z=0,cast=true)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=cast;par.add(o);return o};
  // shorts and torso
  add(BX(.4,.2,.25),shorts,pelvis,0,-.07,0);
  add(BX(.44,.56,.25),[sideM,sideM,base,base,front,back],chest,0,.28,0);
  add(BX(.2,.035,.12),trim,chest,0,.565,.02);
  add(BX(.11,.1,.11),skin,chest,0,.61,0);
  const head=new T.Group();head.position.y=.765;chest.add(head);
  add(BX(.23,.26,.24),headM,head,0,0,0);
  add(BX(.03,.06,.05),skin,head,.13,-.01,0,false);add(BX(.03,.06,.05),skin,head,-.13,-.01,0,false);
  const hm=hairTex(lk.hair),st=lk.style;
  if(st==='short'||st==='bun'||st==='long'){add(BX(.245,.07,.255),hm,head,0,.15,-.003);add(BX(.245,.16,.05),hm,head,0,.06,-.105);add(BX(.02,.1,.2),hm,head,.12,.08,-.02,false);add(BX(.02,.1,.2),hm,head,-.12,.08,-.02,false)}
  if(st==='buzz'){add(BX(.236,.03,.246),hm,head,0,.135,0);add(BX(.236,.12,.02),hm,head,0,.07,-.12)}
  if(st==='afro'){add(BX(.31,.16,.31),hm,head,0,.15,-.02)}
  if(st==='long')add(BX(.25,.26,.06),hm,head,0,-.04,-.12);
  if(st==='bun')add(BX(.08,.08,.08),hm,head,0,.15,-.13);
  const leg=s=>{const hip=new T.Group();hip.position.set(s*.1,-.06,0);pelvis.add(hip);
   add(BX(.17,.2,.19),shorts,hip,0,-.1,0);add(BX(.135,.2,.15),skin,hip,0,-.29,0);
   const knee=new T.Group();knee.position.y=-.4;hip.add(knee);
   add(BX(.13,.36,.14),socks,knee,0,-.2,0);add(BX(.136,.045,.146),trim,knee,0,-.05,0);
   const ank=new T.Group();ank.position.y=-.42;knee.add(ank);add(BX(.12,.08,.27),boot,ank,0,-.04,.05);add(BX(.122,.02,.27),sole,ank,0,-.085,.05,false);return{hip,knee,ank}};
  const arm=s=>{const shg=new T.Group();shg.position.set(s*.275,.5,0);chest.add(shg);
   add(BX(.11,.3,.11),sideM,shg,0,-.12,0);add(BX(.115,.03,.115),trim,shg,0,-.27,0);
   const el=new T.Group();el.position.y=-.28;shg.add(el);add(BX(.088,.24,.088),gk?base:skin,el,0,-.12,0);
   add(BX(gk?.11:.085,.1,gk?.08:.06),gk?mat('#f4f4f4',.6):skin,el,0,-.29,0);return{sh:shg,el}};
  const blob=new T.Mesh(blobG,blobMat);blob.rotation.x=-Math.PI/2;blob.position.y=.02;blob.scale.set(1.3,1.3,1);root.add(blob);
  root.scale.setScalar(1.04*lk.tall);
  const o={root,body,pelvis,spine,chest,head,blob,L:leg(-1),Rl:leg(1),La:arm(-1),Ra:arm(1),pid:sp.pid,ph:Math.random()*6,yaw:side?-Math.PI/2:Math.PI/2,side,k,diveSide:1};
  scene.add(root);return o;
 }
 for(let k=0;k<22;k++)P[k]=buildPlayer(k);
 const ball=new T.Mesh(new T.SphereGeometry(.11,24,18),new T.MeshStandardMaterial({map:canvasTex(256,128,(x,W,H)=>{x.fillStyle='#f7f7f7';x.fillRect(0,0,W,H);x.fillStyle='#16181d';for(let i=0;i<12;i++){const cx=(i%6)*W/6+(i<6?0:W/12),cy=i<6?H*.3:H*.72;x.beginPath();for(let q=0;q<5;q++){const a=q/5*Math.PI*2-Math.PI/2;x.lineTo(cx+Math.cos(a)*12,cy+Math.sin(a)*11)}x.fill()}}),roughness:.32}));
 ball.castShadow=true;scene.add(ball);
 const ballBlob=new T.Mesh(blobG,blobMat);ballBlob.rotation.x=-Math.PI/2;ballBlob.position.y=.015;scene.add(ballBlob);
 const tagCv=document.createElement('canvas');tagCv.width=256;tagCv.height=64;const tagT=new T.CanvasTexture(tagCv);tagT.colorSpace=T.SRGBColorSpace;
 const tag=new T.Sprite(new T.SpriteMaterial({map:tagT,depthTest:false,transparent:true,sizeAttenuation:false}));tag.scale.set(.072,.018,1);tag.center.set(.5,0);tag.renderOrder=10;scene.add(tag);let tagOwner=-2;
 // ---- weather & time of day ----
 const NR=5200,rainPos=new Float32Array(NR*6),rainG=new T.BufferGeometry();rainG.setAttribute('position',new T.BufferAttribute(rainPos,3));
 for(let i=0;i<NR;i++){rainPos[i*6]=Math.random()*80-40;rainPos[i*6+1]=Math.random()*30;rainPos[i*6+2]=Math.random()*56-28}
 const rain=new T.LineSegments(rainG,new T.LineBasicMaterial({color:'#b9c7d6',transparent:true,opacity:.34,depthWrite:false}));rain.frustumCulled=false;scene.add(rain);
 const NS=3800,snowPos=new Float32Array(NS*3),snowG=new T.BufferGeometry();snowG.setAttribute('position',new T.BufferAttribute(snowPos,3));
 for(let i=0;i<NS;i++){snowPos[i*3]=Math.random()*80-40;snowPos[i*3+1]=Math.random()*26;snowPos[i*3+2]=Math.random()*56-28}
 const snow=new T.Points(snowG,new T.PointsMaterial({color:'#ffffff',size:.13,transparent:true,opacity:.9,depthWrite:false}));snow.frustumCulled=false;scene.add(snow);
 const snowCover=new T.Mesh(new T.PlaneGeometry(111,74),new T.MeshStandardMaterial({map:canvasTex(512,512,(x,W,H)=>{x.fillStyle='#ffffff';x.fillRect(0,0,W,H);for(let i=0;i<9000;i++){x.fillStyle=`rgba(200,210,220,${Math.random()*.5})`;x.fillRect(Math.random()*W,Math.random()*H,3,3)}}),transparent:true,opacity:0,roughness:.9,depthWrite:false}));
 snowCover.rotation.x=-Math.PI/2;snowCover.position.y=.012;snowCover.material.map.wrapS=snowCover.material.map.wrapT=T.RepeatWrapping;snowCover.material.map.repeat.set(8,6);scene.add(snowCover);
 const hemi=scene.children.find(o=>o.isHemisphereLight),SKY={clear:'#7fa3c8',cloudy:'#8b949d',rain:'#5c6670',storm:'#3d454e',snow:'#a2aab2',wind:'#7d97b2',heat:'#a3bdd6'},wxp=M.wx;
 let snowAmt=wxp.type==='snow'?.35:0;
 function env(t,dt){
  const wt=wxAtPt(),dl=daylight(wxp,clockAtSec(E,t)),c=new T.Color('#050506'),dusk=new T.Color('#b9693f'),day=new T.Color(SKY[wt]);
  if(dl>.5)c.copy(dusk).lerp(day,(dl-.5)*2);else c.lerp(dusk,dl*2*.8);
  scene.background.copy(c);scene.fog.color.copy(c);
  const thick=wt==='storm'||wt==='snow'?1:wt==='rain'?.5:0;scene.fog.near=150-90*thick;scene.fog.far=330-150*thick;
  const cloud=wt==='clear'||wt==='heat'?1:wt==='wind'?.85:.5;
  sun.intensity=2.7*dl*cloud+(1-dl)*2.3;sun.color.set(dl>.5?'#fff3df':'#f0f3ff').lerp(new T.Color('#ffb27a'),dl>.2&&dl<.7?.5:0);
  sun.position.set(-28*dl,62+10*(1-dl),30*dl+12*(1-dl));
  hemi.intensity=.3+.45*dl;rim.intensity=.4+.7*(1-dl);
  renderer.toneMappingExposure=1.15-.12*(1-dl);
  for(const h of sc.heads)h.material.color.set(dl>.85?'#8a8a86':'#fffbe8');for(const g of sc.glows)g.material.opacity=.15+.85*(1-dl);
  const wet=wt==='storm'?1:wt==='rain'?.6:0;sc.pitch.material.roughness=.95-.45*wet;sc.pitch.material.color.setScalar(1-.14*wet);
  if(wt==='snow')snowAmt=Math.min(.55,snowAmt+dt*.004);else snowAmt=Math.max(0,snowAmt-dt*.002);snowCover.material.opacity=snowAmt;
  const raining=wt==='rain'||wt==='storm';rain.visible=raining;snow.visible=wt==='snow';
  if(raining){const n=wt==='storm'?NR:NR*.55|0,wx=Math.cos(wxp.wDir)*wxp.wSpd*.012,wz=Math.sin(wxp.wDir)*wxp.wSpd*.012;rainG.setDrawRange(0,n*2);
   for(let i=0;i<n;i++){const o=i*6;let y=rainPos[o+1]-dt*22;if(y<0)y+=30;rainPos[o+1]=y;rainPos[o+3]=rainPos[o]+wx;rainPos[o+4]=y+.7;rainPos[o+5]=rainPos[o+2]+wz}
   rainG.attributes.position.needsUpdate=true;rain.position.set(bx,0,bz)}
  if(wt==='snow'){const tt=performance.now()/1000;for(let i=0;i<NS;i++){const o=i*3;let y=snowPos[o+1]-dt*1.4;if(y<0)y+=26;snowPos[o+1]=y;snowPos[o]+=Math.sin(tt+i)*dt*.3}snowG.attributes.position.needsUpdate=true;snow.position.set(bx,0,bz)}
 }
 const fr=newFrame(),prev=newFrame(),look=new T.Vector3();let camMode='tv',bx=0,bz=0;
 const lerpA=(a,b,t)=>{let d=b-a;d=Math.atan2(Math.sin(d),Math.cos(d));return a+d*t};
 function pose(o,code,p,speed,sim){
  const L=o.L,Rl=o.Rl,La=o.La,Ra=o.Ra,s=Math.min(1,speed/7.5);
  o.ph+=sim*(5+speed*1.08);const ph=o.ph,A=.16+.66*s;
  let hipL=-A*Math.sin(ph),hipR=A*Math.sin(ph),kneeL=(.2+1.25*s)*Math.max(0,Math.sin(ph+1.25)),kneeR=(.2+1.25*s)*Math.max(0,Math.sin(ph+1.25+Math.PI));
  let shL=A*.9*Math.sin(ph),shR=-A*.9*Math.sin(ph),elb=-(.4+1*s),lean=-.04-.22*s,y=.95+.05*Math.abs(Math.sin(ph))*s-.02*s,roll=0,pitch=0,shZ=.1,headX=.06*s,twist=.12*s*Math.sin(ph);
  if(speed<.35){const b=Math.sin(ph*.22)*.02;hipL=b;hipR=-b;kneeL=kneeR=.08;shL=shR=.05;elb=-.25;lean=-.03;y=.95;twist=0}
  const e=Math.sin(Math.min(1,p)*Math.PI);
  if(code===POSE.kick){const swing=p<.4?.95*(p/.4):.95-2.5*Math.min(1,(p-.4)/.28);hipR=swing;kneeR=p<.4?1.4*(p/.4):Math.max(0,1.4-3.2*(p-.4));hipL=-.12;kneeL=.3;shL=-.7*e;shR=.45*e;shZ=.6*e;lean=-.1+.18*(p>.4?1:0)*e;twist=-.25*e}
  else if(code===POSE.tackle){pitch=1*e;y=.95-.58*e;hipR=-1.4*e;kneeR=.08;hipL=-.25*e;kneeL=1.5*e;shL=-1.3*e;shR=.7*e;lean=.25*e}
  else if(code===POSE.dive){roll=o.diveSide*1.4*e;y=.95+.5*e;shL=shR=-2.7*e;elb=-.15;hipL=-.3*e;hipR=-.1*e;kneeL=kneeR=.35*e}
  else if(code===POSE.head){y=.95+.45*e;headX=.6*Math.sin(p*Math.PI*2)*e;shL=shR=-1*e;shZ=.4*e;kneeL=kneeR=1*e;hipL=hipR=-.55*e}
  else if(code===POSE.cel){shL=-2.9;shR=-2.6;shZ=.5;elb=-.3;y+=.09*Math.abs(Math.sin(ph*1.6));lean=.1}
  else if(code===POSE.thr){shL=shR=-2.8+.95*Math.min(1,p*1.6);elb=-1.7+1.5*Math.min(1,p*1.6);lean=-.18}
  L.hip.rotation.x=hipL;Rl.hip.rotation.x=hipR;L.knee.rotation.x=kneeL;Rl.knee.rotation.x=kneeR;L.ank.rotation.x=-kneeL*.4+.1*s;Rl.ank.rotation.x=-kneeR*.4+.1*s;
  La.sh.rotation.x=shL;Ra.sh.rotation.x=shR;La.sh.rotation.z=-shZ;Ra.sh.rotation.z=shZ;La.el.rotation.x=Ra.el.rotation.x=elb;
  o.spine.rotation.x=-lean;o.chest.rotation.y=twist;o.pelvis.rotation.y=-twist*.6;o.pelvis.position.y=y;o.body.rotation.z=roll;o.body.rotation.x=pitch;o.head.rotation.x=headX;
  o.blob.scale.setScalar(1.3-(y-.95)*.8);
 }
 function drawTag(k){const x=tagCv.getContext('2d');x.clearRect(0,0,256,64);tagOwner=k;if(k<0){tag.visible=false;return}
  const sp=E.P[k];x.fillStyle='rgba(10,10,11,.86)';if(x.roundRect){x.beginPath();x.roundRect(6,10,244,44,10);x.fill()}else x.fillRect(6,10,244,44);
  x.fillStyle=k<11?hk.base:ak.base;x.fillRect(6,10,9,44);x.fillStyle='#fff';x.font='700 28px "Barlow Condensed","Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(`${sp.num}  ${sp.name.toUpperCase()}`,132,33);tagT.needsUpdate=true;tag.visible=true}
 // ---- tunnel for the walkout ----
 {const tg=new T.Group(),dk=new T.MeshBasicMaterial({color:'#030304'}),fr=new T.MeshStandardMaterial({color:mix(sc.home.colors[0],'#111111',.35),roughness:.6});
  const mouth=new T.Mesh(new T.BoxGeometry(4,2.5,1.2),dk);mouth.position.set(0,1.25,40.4);tg.add(mouth);
  for(const q of[-1,1]){const post=new T.Mesh(new T.BoxGeometry(.35,2.9,1.4),fr);post.position.set(q*2.15,1.45,40.2);tg.add(post)}
  const lintel=new T.Mesh(new T.BoxGeometry(4.7,.45,1.4),fr);lintel.position.set(0,2.9,40.2);tg.add(lintel);scene.add(tg)}
 // ---- camera helpers ----
 const D2R=Math.PI/180,camPos=new T.Vector3(),camLook=new T.Vector3();let camInit=false;
 function fovFor(hfov){const v=2*Math.atan(Math.tan(hfov*D2R/2)/cam.aspect)/D2R;const f=clamp(v,14,70);if(Math.abs(f-lastFov)>.01){cam.fov=lastFov=f;cam.updateProjectionMatrix()}}
 function camTo(px,py,pz,lx,ly,lz,hfov,k){
  if(!camInit||k>=1){camPos.set(px,py,pz);camLook.set(lx,ly,lz);camInit=true}
  else{camPos.x+=(px-camPos.x)*k;camPos.y+=(py-camPos.y)*k;camPos.z+=(pz-camPos.z)*k;camLook.x+=(lx-camLook.x)*k;camLook.y+=(ly-camLook.y)*k;camLook.z+=(lz-camLook.z)*k}
  cam.position.copy(camPos);cam.lookAt(camLook);fovFor(hfov);
 }
 // Broadcast framing. The main camera hangs under the main-stand roof and pans with the play.
 let lead=0;
 function gameCam(mode,real,fr,prev,side){
  const k=1-Math.exp(-real*2.4),vx=(fr.bx-prev.bx)/.2;
  lead+=(clamp(vx*.55,-7,7)-lead)*(1-Math.exp(-real*1.2));
  bx+=(clamp(fr.bx-52.5+lead,-44,44)-bx)*k;bz+=(fr.by-34-bz)*k;
  if(mode==='high')camTo(bx*.5,62,40,bx*.62,0,0,62,k);
  else if(mode==='near')camTo(bx*.9,6.2,Math.min(39,bz+15),bx,1,bz,36,k);
  else if(mode==='replay'){const gx=side===0?52.5:-52.5,d=side===0?1:-1;camTo(gx+d*4,4.4,clamp(fr.by-34,-14,14)*.4+8,fr.bx-52.5,.8,fr.by-34,44,1-Math.exp(-real*3.5))}
  else camTo(bx*.66,18,55,bx,0,bz*.92,36,k);
 }
 function placeBall(fr,prev){
  ball.position.set(fr.bx-52.5,Math.max(.11,fr.bz),fr.by-34);ball.rotation.x+=(fr.by-prev.by)*.9;ball.rotation.z-=(fr.bx-prev.bx)*.9;
  ballBlob.position.set(ball.position.x,.015,ball.position.z);ballBlob.scale.setScalar(.45/(1+fr.bz*.4));
 }
 // ---- pre-match ceremony: walkout, line-up for the anthem, handshakes, then everyone takes position ----
 const f0=newFrame();let f0done=false;const IT=INTRO3D;
 const lineX=k=>{const s=k<11?-1:1,i=k%11;return s*(.9+i*.85)};
 function introPos(k,ct){
  const s=k<11?-1:1,i=k%11,lx=lineX(k),lz=20;
  const st=IT.walk+i*.36,sx=s*.9,sz=38.5,len=Math.hypot(lx-sx,lz-sz),dur=len/2.8;
  if(ct<st)return null;
  if(ct<st+dur){const u=(ct-st)/dur;return[sx+(lx-sx)*u,sz+(lz-sz)*u,0]}
  if(s>0&&ct>=IT.shake){const u=clamp((ct-IT.shake)/3.9,0,1);return[lx-11.6*u,20+.95*Math.min(1,u*5),u<1?2:0]}
  return[lx,lz,1];
 }
 function introAt(k,ct){
  if(ct<IT.disperse)return introPos(k,ct);
  const a=introPos(k,IT.disperse)||[0,38.5,0],u=clamp((ct-IT.disperse)/(IT.end-IT.disperse-.6),0,1),e=u*u*(3-2*u);
  return[a[0]+(f0.px[k]-52.5-a[0])*e,a[1]+(f0.py[k]-34-a[1])*e,u<1?0:3];
 }
 function introCam(ct,real){
  if(ct<IT.walk){const a=-.75+ct*.12;camTo(Math.sin(a)*78,30-ct*2.5,Math.cos(a)*66,0,0,0,58,1)}
  else if(ct<IT.anthem){const u=(ct-IT.walk)/(IT.anthem-IT.walk);camTo(7.5,2.4,33.5,-.5,1.25,36-u*13,40,1)}
  else if(ct<IT.shake){const u=(ct-IT.anthem)/(IT.shake-IT.anthem);const x=-10+u*20;camTo(x,1.8,27.6,x,1.45,20,36,1)}
  else if(ct<IT.disperse)camTo(1.5,3.6,31.5,-3.5,1.1,20.5,44,1);
  else{const u=clamp((ct-IT.disperse)/(IT.end-IT.disperse),0,1),e=u*u*(3-2*u);bx=f0.bx-52.5;bz=f0.by-34;
   camTo(1.5+(bx*.66-1.5)*e,3.6+(18-3.6)*e,31.5+(55-31.5)*e,-3.5+(bx+3.5)*e,1.1-1.1*e,20.5+(bz*.92-20.5)*e,44-8*e,1)}
 }
 const ip=[],iv=[];
 return{
  setCam(m){camMode=m},
  intro(ct,real){
   if(!f0done){frameAt(E,0,f0);f0done=true}
   sc.ads.forEach(tx=>{tx.offset.x=(tx.offset.x+real*.03)%1});
   for(let k=0;k<22;k++){const o=P[k],q=introAt(k,ct);
    if(!q){o.root.visible=false;continue}o.root.visible=true;
    const old=ip[k]||q,vx=(q[0]-old[0])/Math.max(real,1e-3),vz=(q[1]-old[1])/Math.max(real,1e-3);ip[k]=q;
    iv[k]=iv[k]==null?0:iv[k]+(Math.hypot(vx,vz)-iv[k])*Math.min(1,real*8);const speed=real>0?iv[k]:0;
    o.root.position.set(q[0],0,q[1]);
    const want=speed>.6?Math.atan2(vx,vz):q[2]===3?Math.atan2(f0.bx-52.5-q[0],f0.by-34-q[1]):q[2]===2?-Math.PI/2:0;
    o.yaw=lerpA(o.yaw,want,Math.min(1,real*6));o.body.rotation.y=o.yaw;pose(o,POSE.run,0,speed,real);
    const shaking=ct>=IT.shake&&ct<IT.disperse&&(k>=11?q[2]===2:true);
    if(shaking){o.La.sh.rotation.x=-1.05;o.La.sh.rotation.z=.12;o.La.el.rotation.x=-.25}
   }
   ball.position.set(f0.bx-52.5,.11,f0.by-34);ballBlob.position.set(ball.position.x,.015,ball.position.z);if(tagOwner!==-1)drawTag(-1);
   introCam(ct,real);env(0,real);renderer.render(scene,cam);
  },
  draw(t,sim,real,opt){
   frameAt(E,t,fr);frameAt(E,Math.max(0,t-.2),prev);
   sc.ads.forEach(tx=>{tx.offset.x=(tx.offset.x+real*.03)%1});
   for(let k=0;k<22;k++){
    let o=P[k];const sp=E.P[k];
    if(o.pid!==sp.pid){scene.remove(o.root);P[k]=o=buildPlayer(k)}
    const code=Math.floor(fr.pose[k]),pf=fr.pose[k]-code;
    if(code===POSE.off){o.root.visible=false;continue}o.root.visible=true;
    const x=fr.px[k]-52.5,z=fr.py[k]-34,vx=(fr.px[k]-prev.px[k])/.2,vz=(fr.py[k]-prev.py[k])/.2,speed=Math.hypot(vx,vz);
    o.root.position.set(x,0,z);
    const want=speed>.7?Math.atan2(vx,vz):Math.atan2(fr.bx-52.5-x,fr.by-34-z);
    if(code!==POSE.dive)o.yaw=lerpA(o.yaw,want,Math.min(1,real*7));else if(pf<.12){const toB=Math.atan2(fr.bx-52.5-x,fr.by-34-z)-o.yaw;o.diveSide=Math.sin(toB)>0?-1:1}
    o.body.rotation.y=o.yaw;pose(o,code,pf,speed,sim);
   }
   placeBall(fr,prev);
   const own=fr.own>=0?fr.own:-1,showTag=!(opt&&opt.noTag)&&camMode!=='high';
   if((showTag?own:-1)!==tagOwner)drawTag(showTag?own:-1);if(showTag&&own>=0)tag.position.set(fr.px[own]-52.5,2.45,fr.py[own]-34);
   gameCam(opt&&opt.cam||camMode,real,fr,prev,opt&&opt.side);
   env(t,real);renderer.render(scene,cam);
  },
  dispose(){ro.disconnect();renderer.dispose();renderer.forceContextLoss()},
 };
}
