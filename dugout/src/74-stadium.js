/* ================= 3D stadium (pitch, goals, stands, lights, boards) ================= */
let THREE=null,threeP=null;
function loadThree(){if(!threeP)threeP=import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js').then(m=>(THREE=m)).catch(e=>{threeP=null;throw e});return threeP}
function canvasTex(w,h,draw){const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;return t}
const CFONT='"Barlow Condensed","Arial Narrow",sans-serif';
function buildStadium(sc){
 const T=THREE,scene=sc.scene,home=sc.home,away=sc.away,s=20,EX=55.5,EZ=37;
 const pitchT=canvasTex(EX*2*s,EZ*2*s,(x,W,H)=>{
  for(let i=0;i<22;i++){x.fillStyle=i%2?'#2a7f40':'#318f49';x.fillRect(i*W/22,0,W/22+1,H)}
  for(let j=0;j<14;j++){x.fillStyle=j%2?'rgba(255,255,255,.025)':'rgba(0,0,0,.03)';x.fillRect(0,j*H/14,W,H/14+1)}
  for(let i=0;i<60000;i++){const v=Math.random();x.fillStyle=v<.5?`rgba(0,30,0,${.04+v*.06})`:`rgba(190,255,170,${.02+(v-.5)*.05})`;x.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*2,2+Math.random()*3)}
  const X=m=>(m+EX)*s,Z=m=>(m+EZ)*s;x.strokeStyle='rgba(255,255,255,.9)';x.fillStyle='rgba(255,255,255,.9)';x.lineWidth=.12*s;
  const rect=(x0,z0,x1,z1)=>x.strokeRect(X(Math.min(x0,x1)),Z(z0),Math.abs(x1-x0)*s,(z1-z0)*s);
  const spot=(a,b)=>{x.beginPath();x.arc(X(a),Z(b),.22*s,0,Math.PI*2);x.fill()};
  rect(-52.5,-34,52.5,34);x.beginPath();x.moveTo(X(0),Z(-34));x.lineTo(X(0),Z(34));x.stroke();
  x.beginPath();x.arc(X(0),Z(0),9.15*s,0,Math.PI*2);x.stroke();spot(0,0);
  const a0=Math.acos(5.5/9.15);
  for(const d of[-1,1]){const gl=52.5*d;rect(gl,-20.16,gl-16.5*d,20.16);rect(gl,-9.16,gl-5.5*d,9.16);spot(41.5*d,0);
   x.beginPath();if(d>0)x.arc(X(41.5),Z(0),9.15*s,Math.PI-a0,Math.PI+a0);else x.arc(X(-41.5),Z(0),9.15*s,-a0,a0);x.stroke();
   for(const e of[-1,1]){const c=Math.atan2(-e,-d);x.beginPath();x.arc(X(gl),Z(34*e),s,c-Math.PI/4,c+Math.PI/4);x.stroke()}}
 });
 const pitch=new T.Mesh(new T.PlaneGeometry(EX*2,EZ*2),new T.MeshStandardMaterial({map:pitchT,roughness:.95}));pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);sc.pitch=pitch;sc.heads=[];sc.glows=[];
 const ground=new T.Mesh(new T.PlaneGeometry(260,200),new T.MeshStandardMaterial({color:'#11281c',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
 [-1,1].forEach(d=>scene.add(goalMesh(d)));
 // LED boards with every club's sponsor
 const adBase=canvasTex(2048,64,(x,W,H)=>{x.fillStyle='#0a0a0b';x.fillRect(0,0,W,H);x.font=`800 40px ${CFONT}`;x.textBaseline='middle';let px=24;const cols=['#ffffff','#ffb43a','#52d6ff',mix(home.colors[0],'#ffffff',.35)];sc.sponsors.forEach((c,i)=>{x.fillStyle=cols[i%cols.length];x.fillText(c.sponsor,px,H/2+2);px+=x.measureText(c.sponsor).width+80})});
 const board=(len,px,pz,ry)=>{const t=adBase.clone();t.needsUpdate=true;t.wrapS=T.RepeatWrapping;t.repeat.x=len/42;sc.ads.push(t);const m=new T.Mesh(new T.PlaneGeometry(len,.9),new T.MeshBasicMaterial({map:t}));m.position.set(px,.45,pz);m.rotation.y=ry;scene.add(m)};
 board(110,0,35.8,Math.PI);board(110,0,-35.8,0);board(72,57,0,-Math.PI/2);board(72,-57,0,Math.PI/2);
 // stands
 const pal=[...home.colors,...home.colors,home.colors[0],home.colors[0],away.colors[0],away.colors[1],'#d9d2c4','#3b4252','#8a95a8'];
 const crowdT=canvasTex(512,256,(x,W,H)=>{x.fillStyle='#0a0e17';x.fillRect(0,0,W,H);for(let y=3;y<H;y+=8)for(let xx=1;xx<W;xx+=6){if(Math.random()<.07)continue;x.fillStyle=pal[Math.floor(Math.random()*pal.length)];x.fillRect(xx+Math.random(),y,4,5);x.fillStyle='rgba(235,195,165,.85)';x.fillRect(xx+1,y-2,2,2)}});
 const stand=(width,dist,len,ang,near)=>{
  const g=new T.Group(),a=ang*Math.PI/180,y0=1.6,tex=crowdT.clone();tex.needsUpdate=true;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(width/14,len/9);
  const seat=new T.Mesh(new T.PlaneGeometry(width,len),new T.MeshBasicMaterial({map:tex,color:'#a4adbf'}));seat.rotation.x=-(Math.PI/2+a);seat.position.set(0,y0+Math.sin(a)*len/2,dist+Math.cos(a)*len/2);g.add(seat);
  const dark=new T.MeshStandardMaterial({color:'#121a29',roughness:.9});
  const wall=new T.Mesh(new T.PlaneGeometry(width,y0),dark);wall.rotation.y=Math.PI;wall.position.set(0,y0/2,dist);g.add(wall);
  const top=y0+Math.sin(a)*len,back=dist+Math.cos(a)*len;
  if(near)return g;
  const roof=new T.Mesh(new T.BoxGeometry(width+2,.6,len*.75),new T.MeshStandardMaterial({color:'#0b111c',roughness:.8}));roof.position.set(0,top+5,back-len*.3);g.add(roof);
  const strip=new T.Mesh(new T.BoxGeometry(width,.3,.3),new T.MeshBasicMaterial({color:'#fff6dc'}));strip.position.set(0,top+4.6,back-len*.67);g.add(strip);
  const bw=new T.Mesh(new T.PlaneGeometry(width,top+6),dark);bw.rotation.y=Math.PI;bw.position.set(0,(top+6)/2,back);g.add(bw);
  return g;
 };
 [[0,124,40,26,30],[Math.PI,124,40,26,30],[Math.PI/2,84,60,22,28],[-Math.PI/2,84,60,22,28]].forEach(([ry,w,d,l,an],i)=>{const g=stand(w,d,l,an,i===0);g.rotation.y=ry;scene.add(g)});
 // floodlights
 const glowT=canvasTex(128,128,x=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,250,232,1)');g.addColorStop(.25,'rgba(255,240,205,.5)');g.addColorStop(1,'rgba(255,240,205,0)');x.fillStyle=g;x.fillRect(0,0,128,128)});
 for(const[px,pz]of[[-68,-54],[68,-54],[-68,54],[68,54]]){
  const mast=new T.Mesh(new T.CylinderGeometry(.5,.8,46,8),new T.MeshStandardMaterial({color:'#2a3446'}));mast.position.set(px,23,pz);scene.add(mast);
  const head=new T.Mesh(new T.BoxGeometry(8,4,.6),new T.MeshBasicMaterial({color:'#fffbe8'}));head.position.set(px,46,pz);head.lookAt(0,0,0);scene.add(head);sc.heads.push(head);
  const sp=new T.Sprite(new T.SpriteMaterial({map:glowT,blending:T.AdditiveBlending,depthWrite:false,transparent:true}));sp.scale.set(30,30,1);sp.position.copy(head.position);scene.add(sp);sc.glows.push(sp);
 }
}
function goalMesh(d){
 const T=THREE,g=new T.Group(),pm=new T.MeshStandardMaterial({color:'#f4f4f4',roughness:.3}),pg=new T.CylinderGeometry(.06,.06,2.44,10);
 for(const z of[-3.66,3.66]){const m=new T.Mesh(pg,pm);m.position.set(0,1.22,z);m.castShadow=true;g.add(m)}
 const bar=new T.Mesh(new T.CylinderGeometry(.06,.06,7.44,10),pm);bar.rotation.x=Math.PI/2;bar.position.y=2.44;bar.castShadow=true;g.add(bar);
 const net=(rx,ry)=>{const t=canvasTex(64,64,x=>{x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=2;for(let i=0;i<=64;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i,64);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(64,i);x.stroke()}});t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);return new T.MeshBasicMaterial({map:t,transparent:true,side:T.DoubleSide,depthWrite:false})};
 const back=new T.Mesh(new T.PlaneGeometry(7.32,2.44),net(18,6));back.rotation.y=Math.PI/2;back.position.set(d*2,1.22,0);g.add(back);
 const top=new T.Mesh(new T.PlaneGeometry(2,7.32),net(5,18));top.rotation.x=-Math.PI/2;top.position.set(d,2.44,0);g.add(top);
 for(const z of[-3.66,3.66]){const sd=new T.Mesh(new T.PlaneGeometry(2,2.44),net(5,6));sd.position.set(d,1.22,z);g.add(sd)}
 g.position.x=d*52.5;return g;
}
function shirtTex(k,num,name){return canvasTex(256,128,(x,W,H)=>{
 x.fillStyle=k.base;x.fillRect(0,0,W,H);x.fillStyle=k.alt;
 switch(k.pattern){
  case'stripes':for(let i=0;i<W;i+=32)x.fillRect(i+8,0,16,H);break;
  case'pinstripe':for(let i=0;i<W;i+=12)x.fillRect(i,0,2,H);break;
  case'hoops':for(let y=14;y<H;y+=28)x.fillRect(0,y,W,14);break;
  case'halves':x.fillRect(W/2,0,W/2,H);break;
  case'quarters':x.fillRect(W/2,0,W/2,H/2);x.fillRect(0,H/2,W/2,H/2);break;
  case'sash':x.beginPath();x.moveTo(W*.86,0);x.lineTo(W,0);x.lineTo(W,H*.55);x.closePath();x.fill();x.beginPath();x.moveTo(0,H*.1);x.lineTo(W*.12,H);x.lineTo(0,H);x.closePath();x.fill();break;
  case'chevron':x.fillRect(0,H*.3,W,H*.14);break;
  case'gradient':{const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,k.base);g.addColorStop(.45,k.base);g.addColorStop(1,k.alt);x.fillStyle=g;x.fillRect(0,0,W,H);break}
 }
 x.fillStyle=k.trim;x.fillRect(0,0,W,7);x.fillRect(0,H-5,W,5);
 const busy=!['plain','gradient','pinstripe'].includes(k.pattern),tx=ink(k.base),nm=String(name).toUpperCase();
 x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.fillStyle=tx;
 x.font=`800 62px ${CFONT}`;x.lineWidth=7;x.strokeStyle=busy?k.base:k.trim;x.strokeText(num,W/2,76);x.fillText(num,W/2,76);
 x.font=`700 17px ${CFONT}`;x.lineWidth=4;x.strokeStyle=k.base;x.strokeText(nm,W/2,28);x.fillText(nm,W/2,28);
 x.font=`800 24px ${CFONT}`;x.strokeText(num,W*.94,42);x.fillText(num,W*.94,42);
})}
