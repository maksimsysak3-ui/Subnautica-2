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
 // ---- shared geometry ----
 const lathe=(pts,seg=20)=>new T.LatheGeometry(pts.map(([r,y])=>new T.Vector2(r,y)),seg);
 const G3={
  torso:lathe([[.13,0],[.15,.05],[.165,.14],[.19,.26],[.215,.38],[.225,.45],[.2,.51],[.11,.555],[.06,.565]]),
  shorts:lathe([[.15,0],[.175,.04],[.19,.12],[.2,.2],[.165,.24]],16),
  shortLeg:new T.CylinderGeometry(.098,.09,.17,12),collar:new T.TorusGeometry(.06,.016,6,16),
  delt:new T.SphereGeometry(.062,14,10),upper:new T.CapsuleGeometry(.054,.2,6,10),cuff:new T.CylinderGeometry(.058,.058,.035,10),fore:new T.CapsuleGeometry(.044,.19,6,10),hand:new T.SphereGeometry(.048,10,8),
  thigh:lathe([[.06,-.36],[.075,-.3],[.088,-.18],[.09,-.06],[.082,0]],12),knee:new T.SphereGeometry(.062,10,8),
  calf:lathe([[.045,-.4],[.05,-.34],[.066,-.22],[.07,-.12],[.06,0]],12),band:new T.CylinderGeometry(.064,.064,.05,12),
  boot:new T.CapsuleGeometry(.048,.16,4,10),sole:new T.BoxGeometry(.1,.025,.27),
  neck:new T.CylinderGeometry(.05,.058,.13,14),
  skull:lathe([[0,-.1],[.06,-.095],[.085,-.06],[.098,-.01],[.104,.04],[.1,.08],[.085,.11],[.055,.13],[0,.138]],28),
  jaw:new T.SphereGeometry(.075,20,14),cheek:new T.SphereGeometry(.03,10,8),ear:new T.SphereGeometry(.026,10,8),
  eyeW:new T.SphereGeometry(.016,10,8),iris:new T.SphereGeometry(.0085,8,6),brow:new T.BoxGeometry(.042,.011,.014),
  nose:new T.BoxGeometry(.026,.05,.03),nostril:new T.SphereGeometry(.014,8,6),mouth:new T.BoxGeometry(.04,.007,.01),lipG:new T.CapsuleGeometry(.007,.03,4,8),lid:new T.SphereGeometry(.017,10,6,0,Math.PI*2,0,Math.PI*.5),chin:new T.SphereGeometry(.03,10,8),jawBox:new T.BoxGeometry(.118,.055,.1),
  hair:new T.SphereGeometry(.112,28,14,0,Math.PI*2,0,Math.PI*.56),buzz:new T.SphereGeometry(.108,28,12,0,Math.PI*2,0,Math.PI*.5),afro:new T.SphereGeometry(.145,20,14,0,Math.PI*2,0,Math.PI*.6),bun:new T.SphereGeometry(.042,12,10),burn:new T.BoxGeometry(.012,.04,.03),
  blob:new T.PlaneGeometry(1,1),
 };
 // Sculpted head: a dense sphere displaced into nose, brow, sockets, cheekbones, chin and a tapering jaw.
 const gs=(x,y,z,cx,cy,cz,sx,sy,sz)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2+((z-cz)/sz)**2));
 function sculpt(face,rad,extra){
  const g=new T.SphereGeometry(1,48,36),pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),d=0;
   if(face){d+=.19*gs(x,y,z,0,-.16,1,.12,.26,.3)*(z>0?1:0);d+=.07*gs(x,y,z,0,.22,.95,.6,.09,.3);
    d-=.08*(gs(x,y,z,.33,.07,.92,.15,.1,.2)+gs(x,y,z,-.33,.07,.92,.15,.1,.2));d+=.05*(gs(x,y,z,.56,-.2,.72,.2,.15,.25)+gs(x,y,z,-.56,-.2,.72,.2,.15,.25));
    d+=.06*gs(x,y,z,0,-.86,.52,.42,.2,.3);d-=.035*gs(x,y,z,0,-.44,.95,.3,.05,.2);d+=.02*gs(x,y,z,0,-.5,.98,.22,.07,.2)}
   const r=(1+d)*rad;x*=r;y*=r;z*=r;x*=.9;z*=.94;
   if(y<0){const t=Math.min(1,-y/rad);x*=1-.2*t*t;if(z<0)z*=1-.18*t*t}
   if(y>.45*rad)y=.45*rad+(y-.45*rad)*.82;
   if(extra)[x,y,z]=extra(x,y,z);
   pos.setXYZ(i,x*.11,y*.116,z*.108)}
  g.computeVertexNormals();return g;
 }
 // Hair shell: the same skull, slightly larger, cut along a hairline (high at the forehead, low at the nape).
 function hairShell(rad,lift,hl){
  const g=sculpt(false,rad,(x,y,z)=>[x,y>0?y*(1+lift):y,z]),pos=g.attributes.position,idx=g.index.array,keep=[];
  const ok=i=>{const y=pos.getY(i)/.116,z=pos.getZ(i)/.108;return y>hl(z)};
  for(let i=0;i<idx.length;i+=3)if(ok(idx[i])&&ok(idx[i+1])&&ok(idx[i+2]))keep.push(idx[i],idx[i+1],idx[i+2]);
  g.setIndex(keep);g.computeVertexNormals();return g;
 }
 const HL=z=>-.5+.95*clamp((z+.25)/1.25,0,1);
 const HEAD={face:sculpt(true,1),short:hairShell(1.04,.03,HL),buzz:hairShell(1.018,0,HL),afro:hairShell(1.26,.08,z=>HL(z)-.05),long:hairShell(1.05,.02,z=>z<.2?-.95:HL(z))};
 const blobTex=canvasTex(64,64,x=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}),blobMat=new T.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false});
 const [hk,ak]=kitColors(E),kits=[hk,ak],gkCols=['#c7e83a','#ff7a1a'],cache={};
 const mat=(c,r=.7,m=0)=>cache[c+r+m]||(cache[c+r+m]=new T.MeshStandardMaterial({color:c,roughness:r,metalness:m}));
 const SKINS=['#f3d2ba','#e8bf9f','#d9a77f','#c48a61','#a66c47','#8a5335','#6c3f28','#4c2a1b'],HAIRS=['#141010','#2c1e15','#55361f','#7a3a1b','#c9a15a','#a3a3a6'];
 const looks=pid=>{const r=R(Math.imul(pid,2654435761)>>>0),p=S.players[pid],dark=['NGA','GHA','SEN','CIV'].includes(p.nat)||(p.nat==='BRA'&&r.chance(.5))||(p.nat==='FRA'&&r.chance(.4))||(['ENG','NED','BEL'].includes(p.nat)&&r.chance(.2));
  return{skin:SKINS[dark?r.i(5,7):r.i(0,4)],hair:p.age>=33&&r.chance(.4)?HAIRS[5]:HAIRS[dark?r.i(0,1):r.i(0,4)],style:r.pick(dark?['buzz','buzz','short','afro','bald']:['short','short','buzz','bun','long','bald']),tall:.94+(p.ht-165)/35*.14}};
 const hairTexCache={};
 function hairMat(col,style){const key=col+style;if(hairTexCache[key])return hairTexCache[key];
  const tex=canvasTex(256,256,(x,W,H)=>{x.fillStyle=col;x.fillRect(0,0,W,H);
   if(style==='afro'||style==='buzz'){for(let i=0;i<5200;i++){const v=Math.random();x.fillStyle=v<.5?mix(col,'#000000',.35+v*.3):mix(col,'#ffffff',.08+v*.12);x.beginPath();x.arc(Math.random()*W,Math.random()*H,style==='afro'?1.4+Math.random()*1.8:.8+Math.random(),0,7);x.fill()}}
   else{x.lineCap='round';for(let i=0;i<3400;i++){const v=Math.random(),sx=Math.random()*W,sy=Math.random()*H,len=10+Math.random()*26,a=(Math.random()-.5)*.35;x.strokeStyle=v<.55?mix(col,'#000000',.25+v*.35):mix(col,'#ffffff',.1+(v-.55)*.35);x.lineWidth=.6+Math.random()*1.1;x.beginPath();x.moveTo(sx,sy);x.quadraticCurveTo(sx+Math.sin(a)*len*.6+2,sy+len*.5,sx+Math.sin(a)*len,sy+len);x.stroke()}}});
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(style==='afro'?3:2,style==='afro'?2:1);
  return hairTexCache[key]=new T.MeshStandardMaterial({map:tex,bumpMap:tex,bumpScale:style==='afro'?3:1.6,roughness:.62,color:'#ffffff'});
 }
 const P=[];
 function buildPlayer(k){
  const sp=E.P[k],side=k<11?0:1,gk=sp.pos==='GK',kit=gk?{base:gkCols[side],alt:mix(gkCols[side],'#000000',.3),trim:'#111111',pattern:'plain'}:kits[side];
  const lk=looks(sp.pid),shortsC=contrast(kit.base,'#ffffff')>3?'#efefef':'#16161a',skin=mat(lk.skin,.55),shirt=new T.MeshStandardMaterial({map:shirtTex(kit,sp.num,sp.name),roughness:.72}),base=mat(kit.base,.72),trim=mat(kit.trim,.6),sh=mat(shortsC,.75),hairM=hairMat(lk.hair,lk.style),boot=mat('#121214',.35,.2),dark=mat('#1a1010',.4);
  const root=new T.Group(),body=new T.Group(),pelvis=new T.Group(),spine=new T.Group(),chest=new T.Group();root.add(body);body.add(pelvis);pelvis.position.y=.95;pelvis.add(spine);spine.position.y=.06;spine.add(chest);body.rotation.order='YXZ';
  const add=(g,m,par,x=0,y=0,z=0,cast=true)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=cast;par.add(o);return o};
  add(G3.shorts,sh,pelvis,0,-.12,0).scale.z=.8;
  const tor=add(G3.torso,shirt,spine,0,0,0);tor.scale.z=.74;
  add(G3.collar,trim,chest,0,.555,.005).rotation.x=Math.PI/2;
  add(G3.neck,skin,chest,0,.6,0);
  const head=new T.Group();head.position.y=.735;head.scale.setScalar(1.06);chest.add(head);
  const sk2=mat(mix(lk.skin,'#5a2a1a',.14),.6),white=mat('#d8d1c6',.35),iris=mat('#1a130f',.2),lip=mat(mix(lk.skin,'#8a3434',.22),.5);
  add(HEAD.face,skin,head);
  for(const q of[-1,1]){add(G3.ear,sk2,head,q*.084,-.004,-.006,false).scale.set(.38,1.05,.72);
   add(G3.eyeW,white,head,q*.035,.006,.083,false).scale.set(1.15,.72,.42);add(G3.iris,iris,head,q*.035,.005,.088,false).scale.set(1.05,1.05,.45);add(G3.lid,sk2,head,q*.035,.019,.082,false).scale.set(1.12,.22,.45);
   const br=add(G3.brow,mat(mix(lk.hair,'#000000',.3),.9),head,q*.035,.03,.094,false);br.rotation.z=q*-.1;br.scale.set(.85,.55,.7)}
  {const l=add(G3.lipG,lip,head,0,-.056,.089,false);l.rotation.z=Math.PI/2;l.scale.set(.7,1,.6)}
  if(lk.style!=='bald'){add(HEAD[lk.style==='bun'?'short':lk.style],hairM,head);if(lk.style==='bun')add(G3.bun,hairM,head,0,.1,-.085)}
  const leg=s=>{const hip=new T.Group();hip.position.set(s*.092,-.06,0);pelvis.add(hip);add(G3.shortLeg,sh,hip,0,-.07,0);add(G3.thigh,skin,hip,0,-.03,0);
   const knee=new T.Group();knee.position.y=-.4;hip.add(knee);add(G3.knee,skin,knee,0,0,.008).scale.set(1,1,.9);add(G3.calf,base,knee,0,0,0);add(G3.band,trim,knee,0,-.035,0);
   const ank=new T.Group();ank.position.y=-.42;knee.add(ank);const b=add(G3.boot,boot,ank,0,-.035,.05);b.rotation.x=Math.PI/2;add(G3.sole,mat(kit.trim==='#111111'?'#e8e8e8':'#f2f2f2',.5),ank,0,-.075,.05);return{hip,knee,ank}};
  const arm=s=>{const shg=new T.Group();shg.position.set(s*.23,.47,0);chest.add(shg);add(G3.delt,base,shg,s*.004,-.012,0).scale.set(.95,.9,.9);add(G3.upper,base,shg,0,-.14,0);add(G3.cuff,trim,shg,0,-.25,0);
   const el=new T.Group();el.position.y=-.29;shg.add(el);add(G3.fore,gk?base:skin,el,0,-.13,0);add(G3.hand,gk?mat('#f0f0f0',.6):skin,el,0,-.27,0).scale.set(.8,1.1,.6);return{sh:shg,el}};
  const blob=new T.Mesh(G3.blob,blobMat);blob.rotation.x=-Math.PI/2;blob.position.y=.02;blob.scale.set(1.3,1.3,1);root.add(blob);
  root.scale.setScalar(1.06*lk.tall);
  const o={root,body,pelvis,spine,chest,head,blob,L:leg(-1),Rl:leg(1),La:arm(-1),Ra:arm(1),pid:sp.pid,ph:Math.random()*6,yaw:side?-Math.PI/2:Math.PI/2,side,k,diveSide:1};
  scene.add(root);return o;
 }
 for(let k=0;k<22;k++)P[k]=buildPlayer(k);
 const ball=new T.Mesh(new T.SphereGeometry(.11,24,18),new T.MeshStandardMaterial({map:canvasTex(256,128,(x,W,H)=>{x.fillStyle='#f7f7f7';x.fillRect(0,0,W,H);x.fillStyle='#16181d';for(let i=0;i<12;i++){const cx=(i%6)*W/6+(i<6?0:W/12),cy=i<6?H*.3:H*.72;x.beginPath();for(let q=0;q<5;q++){const a=q/5*Math.PI*2-Math.PI/2;x.lineTo(cx+Math.cos(a)*12,cy+Math.sin(a)*11)}x.fill()}}),roughness:.32}));
 ball.castShadow=true;scene.add(ball);
 const ballBlob=new T.Mesh(G3.blob,blobMat);ballBlob.rotation.x=-Math.PI/2;ballBlob.position.y=.015;scene.add(ballBlob);
 const tagCv=document.createElement('canvas');tagCv.width=256;tagCv.height=64;const tagT=new T.CanvasTexture(tagCv);tagT.colorSpace=T.SRGBColorSpace;
 const tag=new T.Sprite(new T.SpriteMaterial({map:tagT,depthTest:false,transparent:true}));tag.scale.set(3.4,.85,1);tag.renderOrder=10;scene.add(tag);let tagOwner=-2;
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
  else if(mode==='replay'){const gx=side===0?52.5:-52.5,d=side===0?1:-1;camTo(gx+d*9,5.5,clamp(fr.by-34,-14,14)*.4+9,fr.bx-52.5,.8,fr.by-34,44,1-Math.exp(-real*3.5))}
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
