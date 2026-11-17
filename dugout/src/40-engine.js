/* ================= match engine =================
   Positional simulation at 10 Hz. Home (side 0) attacks +x. Every goal comes out of play:
   shape from the tactic, carrier decisions from attributes and space, passes that can be cut out,
   tackles, aerial duels, set pieces. Frames are recorded for the 2D/3D viewers. */
const PW=105,PH=68,DT=0.1,GH=3.66,STRIDE=70,CAP=1800;
const POSE={run:0,kick:1,tackle:2,dive:3,head:4,cel:5,off:6,thr:7};
const POSE_DUR=[1,.45,.8,1.1,.6,4,1,.7];
const fX=(s,x)=>s?PW-x:x,fY=(s,y)=>s?PH-y:y;
function xgAt(fx,fy){const dx=Math.max(.5,PW-fx),dy=fy-34,ang=Math.abs(Math.atan2(GH*2*dx,dx*dx+dy*dy-GH*GH));return sig(-1.25+2.1*ang-.105*Math.hypot(dx,dy))}
function threat(fx,fy){const d=Math.hypot(PW-fx,(fy-34)*1.15);return .02+.55*Math.exp(-d/15)+.08*fx/PW}
const inBox=(s,x,y)=>{const fx=fX(s,x);return fx<16.5&&Math.abs(y-34)<20.16};

function createMatch(cfg){
 const rng=R((cfg.seed>>>0)||7);
 const E={t:0,rng,events:[],score:[0,0],done:false,half:1,h1:2700+rng.i(1,3)*60,poss:0,P:[],T:[],old:[],
  ball:{x:52.5,y:34,z:.11,vx:0,vy:0,vz:0,owner:-1,recv:-1,lastS:0,lastP:-1,shot:null,tgt:{x:52.5,y:34},aerial:false,kt:0,cross:false},
  restart:null,lastPass:null,nextSub:3300,wxPlan:cfg.weather||{type:'clear',changes:[],wDir:0,wSpd:5},wxType:(cfg.weather||{}).type||'clear',wxNext:0,gain:[0,0],prevPoss:0,getP:cfg.getP,
  st:{pos:[0,0],sh:[0,0],sot:[0,0],xg:[0,0],pa:[0,0],pc:[0,0],cor:[0,0],fo:[0,0],yc:[0,0],rc:[0,0],off:[0,0],tk:[0,0],thru:[0,0],crs:[0,0],drib:[0,0],runs:[0,0]},
  rec:{buf:new Float32Array(CAP*STRIDE),own:new Int8Array(CAP),n:0}};
 E.ft=E.h1+2700+rng.i(2,5)*60;E.wx=WX[E.wxType]||WX.clear;
 cfg.teams.forEach((T,s)=>{
  const tm={s,club:T.club,tac:T.tac,slots:FORMATIONS[T.tac.form],bench:T.bench.slice(),subs:0,ai:!!T.ai,pl:[]};setShape(tm);E.T.push(tm);
  T.tac.xi.forEach((pid,slot)=>{const p=mkSim(E,cfg.getP(pid),s,slot,tm,E.P.length);E.P.push(p);tm.pl.push(p)});
 });
 kickoffSetup(E,0);record(E);
 return E;
}
function setShape(tm){tm.slots=FORMATIONS[tm.tac.form];tm.slotsIn=FORMATIONS[tm.tac.formIn||tm.tac.form];tm.inMap=shapeMap(tm.tac.form,tm.tac.formIn)}
// Transition state: counter-attack window after winning the ball, counter-press/regroup window after losing it.
const counterOn=(E,s)=>E.poss===s&&E.T[s].tac.ins.onWin===0&&E.t-E.gain[s]<7;
const cpressOn=(E,s)=>E.poss!==s&&E.T[s].tac.ins.onLose===0&&E.t-E.gain[1-s]<5;
const regroupOn=(E,s)=>E.poss!==s&&E.T[s].tac.ins.onLose===2&&E.t-E.gain[1-s]<6;
function mkSim(E,po,s,slot,tm,i){
 const pos=tm.slots[slot][0],f=famil(po,pos),a={};
 ATTRS.forEach((k,j)=>a[k]=po.at[j]/100);
 if(f<1)for(const k of['pos','dec','mar','tck','vis','cro'])a[k]*=f;
 if(s===0)for(const k of['pas','dec','pos','fin','fir','cmp'])a[k]=Math.min(1,a[k]*1.035);
 return{i,s,slot,pid:po.id,num:po.num,name:po.ln,pos,role:tm.tac.roles[slot]||ROLES[pos][0][0],a,x:0,y:0,vx:0,vy:0,tx:0,ty:0,
  en:(po.cond??100)/100,yc:0,off:false,red:false,cool:.5,pose:0,poseT:0,run:0,sprint:false,stun:0,tkCool:0,dribT:null,diveY:null,
  st:{pa:0,pc:0,sh:0,so:0,g:0,as:0,kp:0,tk:0,in:0,sv:0,fo:0,dr:0,mins:0}};
}
function ev(E,type,s,i,d){const m=clockSec(E);const e=Object.assign({t:E.t,min:m,type,s,i,pid:i!=null&&i>=0?E.P[i].pid:null},d||{});E.events.push(e);return e}
function clockSec(E){return E.half===1?E.t:2700+(E.t-E.h1)}
function setPose(p,k){p.pose=k;p.poseT=0}
const mates=(E,s,p)=>E.T[s].pl.filter(m=>m!==p&&!m.off);
const opps=(E,s)=>E.T[1-s].pl.filter(o=>!o.off);
function pressure(E,p){let d=99;for(const o of E.T[1-p.s].pl){if(o.off)continue;const q=Math.hypot(o.x-p.x,o.y-p.y);if(q<d)d=q}return d}
function nearestTo(list,x,y){let b=null,bd=1e9;for(const o of list){const d=Math.hypot(o.x-x,o.y-y);if(d<bd){bd=d;b=o}}return b}
// The opposition's offside line in team s's frame (second-last defender, never behind halfway).
function offLine(E,s){const xs=E.T[1-s].pl.filter(o=>!o.off).map(o=>fX(s,o.x)).sort((a,b)=>b-a);return Math.max(xs[1]??52.5,52.5,fX(s,E.ball.x))}

function kickoffSetup(E,s){
 const b=E.ball;Object.assign(b,{x:52.5,y:34,z:.11,vx:0,vy:0,vz:0,owner:-1,recv:-1,shot:null,aerial:false});
 for(const tm of E.T)for(const p of tm.pl){if(p.off)continue;const[pos,lat,dep]=tm.slots[p.slot];const fx=pos==='GK'?4:Math.min(49,8+dep*.5),fy=34+(lat-50)/50*26;p.x=fX(tm.s,fx);p.y=fY(tm.s,fy);p.vx=p.vy=0;p.run=0}
 setRestart(E,'ko',s,52.5,34);E.restart.t=1.5;
}

/* ---------- main step ---------- */
function stepMatch(E){
 if(E.done)return;
 E.t+=DT;const b=E.ball;
 if(!b.shot&&!(E.restart&&E.restart.cel)){
  if(E.half===1&&E.t>=E.h1){E.half=2;ev(E,'ht',-1,-1);kickoffSetup(E,1)}
  else if(E.half===2&&E.t>=E.ft){E.done=true;ev(E,'ft',-1,-1);finalize(E);record(E);return}
 }
 {const ch=E.wxPlan.changes[E.wxNext];if(ch&&clockSec(E)>=ch.t){E.wxNext++;E.wxType=ch.type;E.wx=WX[ch.type];ev(E,'weather',-1,-1,{wx:ch.type})}}
 if(E.restart)restartStep(E);else playStep(E);
 for(const p of E.P){
  if(p.off){p.vx=p.vy=0;continue}
  movePlayer(E,p);p.st.mins+=DT;
  if(p.pose){p.poseT+=DT;if(p.poseT>POSE_DUR[p.pose]){p.pose=0;p.poseT=0}}
 }
 if(b.owner>=0)placeBall(E.P[b.owner],b);
 if(E.poss!==E.prevPoss){E.gain[E.poss]=E.t;E.prevPoss=E.poss}
 E.st.pos[E.poss]+=DT;
 if(E.t>=E.nextSub){E.nextSub+=240;autoSubs(E)}
 record(E);
}
function playStep(E){
 const b=E.ball;
 shapeTeam(E,E.T[0]);shapeTeam(E,E.T[1]);assign(E);
 if(b.owner>=0){const c=E.P[b.owner];carrier(E,c);if(b.owner===c.i)tackles(E,c)}
 else ballFlight(E);
}
function record(E){
 const r=E.rec,k0=(r.n%CAP),buf=r.buf;let k=k0*STRIDE;const b=E.ball;
 for(const p of E.P){buf[k++]=p.x;buf[k++]=p.y;buf[k++]=p.off?POSE.off:p.pose+Math.min(.99,p.poseT/POSE_DUR[p.pose])}
 buf[k++]=b.x;buf[k++]=b.y;buf[k++]=b.z;buf[k++]=b.owner;r.own[k0]=E.poss;r.n++;
}

/* ---------- team shape ---------- */
function shapeTeam(E,tm){
 const s=tm.s,ins=tm.tac.ins,poss=E.poss===s,b=E.ball,bx=fX(s,b.x),by=fY(s,b.y),ol=offLine(E,s);
 const ctr=counterOn(E,s),rg=regroupOn(E,s);
 let line=[23,31,39][ins.line]+(bx-52)*.42+(poss?6+ins.ment*1.6:(ins.ment-2)*1.5)-(rg?7:0)+(ins.onWin===2&&poss?2:0);
 line=clamp(line,9,poss?58:46);if(!poss)line=Math.min(line,Math.max(9,bx-7));
 const len=(poss?31+ins.ment*2:24+ins.line*2)+(ctr?8:0),hw=poss?[22,27,31][ins.width]:20,sh=(by-34)*(poss?.18:.42);
 for(const p of tm.pl){
  if(p.off)continue;
  const pos=tm.slots[p.slot][0],sl=poss?tm.slotsIn[tm.inMap[p.slot]]:tm.slots[p.slot],lat=sl[1],dep=sl[2],rf=ROLE_FX[p.role]||{};let fx,fy;
  if(pos==='GK'){fx=clamp(3+Math.max(0,bx-30)*.09+(p.role==='sweeper'?3:0),2.5,p.role==='sweeper'||ins.line===2?17:12);fy=34+(by-34)*.22;
   if(b.shot&&b.shot.gk===p.i&&b.shot.s!==s)fy=b.shot.gy*(s?-1:1)+(s?PH:0)}
  else{
   fx=line+(dep-18)/64*len;fy=34+(lat-50)/50*hw+sh;
   if(poss){fx+=rf.inD||0;if(rf.wide)fy+=lat<45?-rf.wide:lat>55?rf.wide:0;if(rf.inward)fy+=lat<50?rf.inward:-rf.inward;
    if(p.run>E.t){fx=ol+7;fy+= (34-fy)*.35}else if(fx>ol-.8)fx=ol-.8}
   else{fx+=rf.outD||0;
    const g=GROUP[pos],cap=Math.max(4,g==='ATT'?bx+8:g==='MID'?bx-1:bx-3.5);if(fx>cap)fx=cap;
    if(bx<40){fy=34+(fy-34)*(.62+bx/40*.3)+(by-34)*.15}}
  }
  p.tx=fX(s,clamp(fx,1,PW-1));p.ty=fY(s,clamp(fy,pos==='GK'?1.5:4.5,pos==='GK'?PH-1.5:PH-4.5));
 }
}
// Pressing, marking, chasing loose balls, receivers and runs: overrides on top of the shape.
function assign(E){
 const b=E.ball,owner=b.owner>=0?E.P[b.owner]:null;
 for(const tm of E.T){
  const s=tm.s,ins=tm.tac.ins,def=E.poss!==s,dir=s?-1:1,pl=tm.pl.filter(p=>!p.off);
  if(def&&owner){
   const bxd=fX(s,b.x),eng=[42,66,120][ins.press]+clamp((E.t-E.gain[1-s]-8)*2.2,0,45),cp=cpressOn(E,s),n=cp?3:regroupOn(E,s)?1:bxd<eng?[1,2,2][ins.press]:1;
   const cand=pl.filter(p=>p.pos!=='GK').map(p=>({p,d:Math.hypot(p.x-b.x,p.y-b.y)*(1-((ROLE_FX[p.role]||{}).press||0)*.3)})).sort((a,c)=>a.d-c.d);
   const pressers=new Set();
   cand.slice(0,n).forEach(({p},k)=>{pressers.add(p);const gap=k===0?(cp?1.0:1.25):2.8,ang=k===0?0:(k===1?.9:-.9);p.tx=b.x+(b.owner>=0?b.vx*.45:0)-dir*gap*Math.cos(ang);p.ty=b.y+(b.owner>=0?b.vy*.45:0)+gap*Math.sin(ang);p.sprint=k===0||bxd<eng||cp});
   for(const p of pl){
    if(pressers.has(p)||p.pos==='GK')continue;
    let best=null,bd=10;for(const o of E.T[1-s].pl){if(o.off||o===owner)continue;const d=Math.hypot(o.x-p.tx,o.y-p.ty);if(d<bd){bd=d;best=o}}
    if(best){p.tx=p.tx*.45+(best.x-dir*1.6)*.55;p.ty=p.ty*.45+best.y*.55}
   }
  }
  if(!owner&&!E.restart){
   if(b.recv>=0&&E.P[b.recv].s===s){const r=E.P[b.recv];r.tx=b.tgt.x;r.ty=b.tgt.y;r.sprint=true}
   const loose=b.recv<0||E.t-b.kt>3.5;
   if(loose){const px=b.x+b.vx*.35,py=b.y+b.vy*.35;pl.filter(p=>p.pos!=='GK'||inBox(s,b.x,b.y)).sort((a,c)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(c.x-px,c.y-py)).slice(0,2).forEach(p=>{p.tx=px;p.ty=py;p.sprint=true})}
   else if(def&&b.recv>=0){const r=E.P[b.recv],m=nearestTo(pl.filter(p=>p.pos!=='GK'),r.tgtX??b.tgt.x,b.tgt.y);if(m){m.tx=b.tgt.x;m.ty=b.tgt.y;m.sprint=true}}
  }
  if(!def&&owner&&owner.s===s&&fX(s,owner.x)>35){
   const oppLine=fX(s,E.T[1-s].pl.filter(o=>!o.off&&o.pos!=='GK').reduce((m,o)=>s?Math.max(m,o.x):Math.min(m,o.x),s?-1:999)),highLine=oppLine<68?1+(68-oppLine)/5:1,boost=(counterOn(E,s)?3.5:1)*highLine;for(const p of pl){const rf=ROLE_FX[p.role]||{};const rr=(rf.run||(GROUP[p.pos]==='ATT'?.07:GROUP[p.pos]==='MID'&&highLine>1.6?.04:0))*(highLine>1.6?1.6:1);if(!rr||p===owner||p.run>E.t)continue;if(E.rng.f()<rr*.012*boost){p.run=E.t+3.2;E.st.runs[s]++}}
  }
  for(const p of pl)if(p.run>E.t&&p!==owner)p.sprint=true;
 }
}

/* ---------- movement ---------- */
function movePlayer(E,p){
 // Off-ball players never freeze: a slow personal drift around their target keeps them shuffling and walking.
 const wob=E.ball.owner===p.i||p.pos==='GK'?0:Math.hypot(E.ball.x-p.x,E.ball.y-p.y)>15?.9:.35;
 const dx=p.tx+Math.sin(E.t*.45+p.i*2.1)*wob-p.x,dy=p.ty+Math.cos(E.t*.37+p.i*1.3)*wob-p.y,d=Math.hypot(dx,dy),fat=.72+.28*clamp(p.en,0,1);
 if(d>5&&E.poss!==p.s)p.sprint=true;else if(d>9)p.sprint=true;
 let vmax=(5.4+p.a.pac*3.4)*fat*(p.sprint?1:.68)*E.wx.spd;
 if(p.stun>E.t)vmax*=.35;
 // Rest-defence cost: a side committed forward (very attacking or pressing high) is slow to recover after losing the ball.
 {const ti=E.T[p.s].tac.ins;if(E.poss!==p.s&&p.pos!=='GK'&&E.t-E.gain[1-p.s]<8&&(ti.ment>=3||ti.press===2)){const f=(ti.ment===4?.74:ti.ment===3?.86:1)*(ti.press===2?.9:1);vmax*=GROUP[p.pos]==='DEF'?Math.sqrt(f):f}}
 if(E.ball.owner===p.i)vmax*=.76+.1*p.a.dri;
 let vx=0,vy=0;if(d>.12){const sp=Math.min(vmax,d*1.8);vx=dx/d*sp;vy=dy/d*sp}
 const acc=(4+p.a.acc*5)*fat*DT;let ax=vx-p.vx,ay=vy-p.vy;const am=Math.hypot(ax,ay);if(am>acc){ax*=acc/am;ay*=acc/am}
 p.vx+=ax;p.vy+=ay;p.x=clamp(p.x+p.vx*DT,-2,PW+2);p.y=clamp(p.y+p.vy*DT,-2,PH+2);
 const sp=Math.hypot(p.vx,p.vy);const ti=E.T[p.s].tac.ins;p.en=Math.max(.2,p.en-(3e-5+3.4e-6*sp*sp)*(1.3-p.a.sta)*DT*(ti.press===2?2.1:ti.press===0?.85:1)*(ti.ment>=3?1.15:1)*(ti.line===2?1.1:1)*E.wx.fat);
 p.sprint=false;
}
function placeBall(c,b){const sp=Math.hypot(c.vx,c.vy);let dx,dy;if(sp>.4){dx=c.vx/sp;dy=c.vy/sp}else{dx=c.s?-1:1;dy=0}b.x=c.x+dx*.55;b.y=c.y+dy*.55;b.z=.11;b.vx=c.vx;b.vy=c.vy;b.vz=0}

/* ---------- ball carrier ---------- */
function carrier(E,c){
 c.cool-=DT;
 const pr=pressure(E,c);
 if(c.cool<=0||(pr<1.2&&c.cool>.3&&E.rng.f()<.1))decide(E,c,pr);
 if(E.ball.owner!==c.i)return;
 if(c.dribT){c.tx=c.dribT.x;c.ty=c.dribT.y;c.sprint=true}
 else{
  // Carry the ball while deciding: drift into space, away from the nearest opponent, shield when closed down.
  const s=c.s,dir=s?-1:1,fx=fX(s,c.x);let n=null,nd=99;for(const o of E.T[1-s].pl){if(o.off)continue;const q=Math.hypot(o.x-c.x,o.y-c.y);if(q<nd){nd=q;n=o}}
  const space=clamp((nd-4)/8,0,1);let ax=dir*.35*space*(fx>66?0:1),ay=Math.sin(E.t*.7+c.i*1.7)*.8+(fY(s,c.y)<34?-.15:.15)*dir*0;
  if(n&&nd<10){const k=(10-nd)/10*(fx>66?.5:1.6);ax-=(n.x-c.x)/nd*k;ay-=(n.y-c.y)/nd*k}
  const m=Math.hypot(ax,ay)||1,spd=c.pos==='GK'?.6:nd<3.2||fx>66?.6:.9+space*.8;
  c.tx=c.x+ax/m*spd/1.8;c.ty=c.y+ay/m*spd/1.8;c.sprint=false;
 }
 // a goal-side defender in front blocks the line: the carrier is slowed and pushed wide
 const dir=c.s?-1:1;for(const o of E.T[1-c.s].pl){if(o.off)continue;const ax=(o.x-c.x)*dir,ay=o.y-c.y;if(ax>0&&ax<1.8&&Math.abs(ay)<1.1){c.tx=c.x+dir*.4;c.ty=c.y+(ay>0?-2.2:2.2);c.sprint=false;if(ax<1.15&&c.cool>1.1)c.cool=1.1;break}}
 c.tx=clamp(c.tx,1,PW-1);c.ty=clamp(c.ty,2,PH-2);
}
function laneRisk(c,tx,ty,op){
 const dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy)||1;let keep=1;
 for(const o of op){const f=((o.x-c.x)*dx+(o.y-c.y)*dy)/(d*d);if(f<.06||f>1.05)continue;
  const px=c.x+dx*f,py=c.y+dy*f,perp=Math.hypot(o.x-px,o.y-py),tb=f*d/17;
  keep*=1-.8*Math.exp(-Math.max(0,perp-.6)/(.9+tb*4.2*(.6+o.a.pos*.6)))}
 return 1-keep;
}
function density(c,op,s){const fx=fX(s,c.x);let n=0;for(const o of op){if(o.pos==='GK')continue;if(fX(s,o.x)>fx-.5&&Math.hypot(o.x-c.x,o.y-c.y)<7)n++}return n}
function blockers(c,op,s){let n=0;const gx=fX(s,PW),dx=gx-c.x,dy=34-c.y,d=Math.hypot(dx,dy);
 for(const o of op){if(o.pos==='GK')continue;const f=((o.x-c.x)*dx+(o.y-c.y)*dy)/(d*d);if(f<.02||f>.6)continue;const perp=Math.hypot(o.x-(c.x+dx*f),o.y-(c.y+dy*f));if(perp<1.3)n++}return n}
function decide(E,c,pr){
 const s=c.s,tm=E.T[s],ins=tm.tac.ins,rf=ROLE_FX[c.role]||{},fx=fX(s,c.x),fy=fY(s,c.y),base=threat(fx,fy),opts=[];
 const prog=clamp((E.t-E.gain[s]-7)/18,0,1)*(ins.ment<=1?1.7:1),ms=mates(E,s,c),op=opps(E,s),ol=offLine(E,s),urg=clamp((E.t-E.gain[s]-10)/25,0,1)*(fx>55?1:0)*[.75,.88,1,1.08,1.15][ins.ment];
 const ctr=counterOn(E,s),strOpp=E.T[1-s].tac.ins.ment>=3&&E.t-E.gain[s]<9,keep=ins.onWin===2&&E.t-E.gain[s]<6,lossCost=(fx<35?.42:fx<65?.24:.1)*(keep?1.5:1),tempoW=[.8,1,1.25][ins.tempo]*(ctr?1.45:1)*(strOpp?1.3:1)*(keep?.75:1),riskW=(rf.risk||1)*[.88,.94,1,1.06,1.1][ins.ment];
 c.dribT=null;
 for(const m of ms){
  if(m.pos==='GK'&&fx>38)continue;
  const tx=m.x+m.vx*.6,ty=m.y+m.vy*.6,mfx=fX(s,tx),mfy=fY(s,ty),d=Math.hypot(tx-c.x,ty-c.y);
  if(d<5||d>62)continue;
  if(fX(s,m.x)>ol+.2)continue;
  const lr=laneRisk(c,tx,ty,op),lofted=d>34;
  let risk=lofted?.3+.005*d:lr;const rp=pressure(E,{s,x:tx,y:ty});if(rp<2)risk+=.17;else if(rp<4)risk+=.06;
  let p=clamp((.99-d*.0038*(1.35-c.a.pas))*(1-risk*.9),.03,.98);if(pr<1.1)p*=.9;
  const val=threat(mfx,mfy)-base;
  let u=p*(val*2.2*riskW*tempoW*((mfx>fx+8)?(rf.prog||1):1)+.06)-(1-p)*lossCost;
  if(ins.passing===0&&d>26)u-=.025;if(ins.passing===2&&mfx-fx>12)u+=.012+.0005*d;
  if(mfx<fx-5)u-=.012*ins.tempo;
  if(pr<2.4&&fx>64&&mfx<fx-2&&rp>4)u+=.045;
  if(mfx<fx+3)u-=.018*prog;else u+=.012*prog*Math.min(1,(mfx-fx)/15);
  opts.push({k:'pass',m,tx,ty,u,lofted});
 }
 for(const m of ms){
  if(!(m.run>E.t))continue;const mx=fX(s,m.x);if(mx>ol+.9)continue;
  const tfx=Math.min(PW-5,ol+9),tfy=clamp(fY(s,m.y)+(34-fY(s,m.y))*.3,6,62),tx=fX(s,tfx),ty=fY(s,tfy),d=Math.hypot(tx-c.x,ty-c.y);
  if(d<8||d>48)continue;
  const behind=PW-ol,risk=laneRisk(c,tx,ty,op)*.7+.1,p=clamp((.95-d*.006*(1.4-c.a.pas))*(1-risk)*(.55+.45*c.a.vis)*(behind>32?1.12:1),.03,.92);
  opts.push({k:'pass',m,tx,ty,u:p*((threat(tfx,tfy)-base)*2.6*riskW*tempoW*(behind>32?1.5:1)*(strOpp?1.5:1)+.06)-(1-p)*lossCost,lofted:d>30,thru:1});
 }
 const dg=Math.hypot(PW-fx,fy-34);
 if(fx>66&&dg<34){
  const x=xgAt(fx,fy)*Math.pow(.7,blockers(c,op,s))*Math.pow(.8,density(c,op,s)),sk=dg>20?c.a.lon:c.a.fin;
  const mul=(rf.shoot||1)*[1,1,1.6,.9][ins.final]*(ins.final===0&&dg>18?.55:1);
  if(x*mul>(ins.final===2?.16:.25)*(1-.4*urg))opts.push({k:'shot',u:x*1.1*mul*(.7+.6*sk)*(pr<1.5?.75:1)-.12+.02*urg});
 }
 if((fy<15||fy>53)&&fx>72){let n=0,h=0;for(const m of ms){const mx=fX(s,m.x),my=fY(s,m.y);if(mx>86&&my>22&&my<46){n++;h=Math.max(h,m.a.hea)}}
  if(n)opts.push({k:'cross',u:(.03+.034*n*h+.05*c.a.cro)*(rf.cross||1)*(ins.final===3?1.6:1)*(1+urg)})}
 {let near=99;for(const o of op){const ofx=fX(s,o.x),ofy=fY(s,o.y);if(ofx>fx-1&&Math.abs(ofy-fy)<(ofx-fx)+2){near=Math.min(near,Math.hypot(ofx-fx,ofy-fy))}}
  const space=clamp((near-2.5)/9,0,1),val=threat(Math.min(PW-2,fx+7),fy)-base;
  let u=(val*1.6+.012)*(rf.dribble||1)*(.45+c.a.dri)*Math.max(space,urg*.5)*(fx>80?.55:1)-(pr<1.6?.07*(1-c.a.dri):0);
  if(c.pos==='GK'||(GROUP[c.pos]==='DEF'&&fx<30))u-=.05;
  opts.push({k:'drib',u})}
 if(fx<14&&pr<1.2)opts.push({k:'clear',u:(1.2-pr)*.04*(ins.passing===2?1.3:1)});
 opts.push({k:'hold',u:pr>5?.02:pr>3?.0:-.04});
 const temp=.012+(1-c.a.dec)*.035;let mx=-1e9;for(const o of opts)mx=Math.max(mx,o.u);
 let tot=0;for(const o of opts){o.w=Math.exp((o.u-mx)/temp);tot+=o.w}
 let r=E.rng.f()*tot,ch=opts[opts.length-1];for(const o of opts){r-=o.w;if(r<=0){ch=o;break}}
 exec(E,c,ch,op);
}
function exec(E,c,o,op){
 const s=c.s;
 if(o.k==='pass'){if(offside(E,c,o.m))return;if(o.thru)E.st.thru[s]++;doPass(E,c,o.tx,o.ty,o.m,o.lofted,op,false)}
 else if(o.k==='shot')shoot(E,c,false,false);
 else if(o.k==='cross'){const blk=op.find(q=>q.pos!=='GK'&&Math.hypot(q.x-c.x,q.y-c.y)<3.2);if(blk&&E.rng.f()<.4){c.st.pa++;E.st.pa[s]++;ev(E,'block',s,c.i,{by:blk.i,cross:1});setRestart(E,'corner',s,s?0:PW,c.y<34?0:PH);return}const t=crossTarget(E,c);E.st.crs[s]++;doPass(E,c,t.x,t.y,t.m,true,op,true)}
 else if(o.k==='drib'){E.st.drib[s]++;const fx=fX(s,c.x),fy=fY(s,c.y),n=nearestTo(op,c.x,c.y);let tfy=fy;if(n){tfy+=fY(s,n.y)>fy?-3.5:3.5}if(fx>86)tfy+=(34-tfy)*.4;
  c.dribT={x:fX(s,Math.min(PW-3,fx+8)),y:fY(s,clamp(tfy,3,PH-3))};c.cool=.6+E.rng.f()*.6}
 else if(o.k==='clear'){const fx=fX(s,c.x);doPass(E,c,fX(s,clamp(fx+40+E.rng.f()*18,0,100)),fY(s,12+E.rng.f()*44),null,true,op,false)}
 else c.cool=.5;
}
function offside(E,c,m){
 const s=c.s,mfx=fX(s,m.x);if(mfx<=offLine(E,s)+.25||mfx<=fX(s,c.x)||mfx<52.5)return false;
 E.st.off[s]++;ev(E,'offside',s,m.i);setRestart(E,'fk',1-s,m.x,m.y);return true;
}
function crossTarget(E,c){const s=c.s;let best=null,bv=-1;for(const m of mates(E,s,c)){const mx=fX(s,m.x),my=fY(s,m.y);if(mx<84||my<18||my>50)continue;const v=m.a.hea+m.a.jmp*.5+E.rng.f()*.3;if(v>bv){bv=v;best=m}}
 if(!best)return{x:fX(s,94),y:fY(s,34+E.rng.n(0,5)),m:null};return{x:best.x+(s?-1:1)*1.2,y:best.y+E.rng.n(0,1),m:best}}
function intercept(E,c,tx,ty,v,op){
 const dx=tx-c.x,dy=ty-c.y,d=Math.hypot(dx,dy);let best=null;
 for(const o of op){
  for(let f=.12;f<=1.01;f+=.08){const px=c.x+dx*f,py=c.y+dy*f,tb=d*f/v,od=Math.max(0,Math.hypot(o.x-px,o.y-py)-.95),to=od/(5.5+o.a.pac*3)+.36-o.a.pos*.14;
   if(to<tb){if(E.rng.f()<.15+.15*o.a.pos-.18*c.a.pas){if(!best||tb<best.tb)best={o,x:px,y:py,tb}}break}}
 }
 return best;
}
function doPass(E,c,tx,ty,m,lofted,op,cross){
 tx=clamp(tx,2,PW-2);ty=clamp(ty,lofted?6:3,lofted?PH-6:PH-3);
 const d=Math.hypot(tx-c.x,ty-c.y),pr=pressure(E,c),err=(1-c.a.pas)*(.05+d*.0035)+(pr<1.5?.04:0)+(cross?(1-c.a.cro)*.05:0)+E.wx.err+(lofted?E.wx.wind*E.wxPlan.wSpd*.0006:0);
 const a0=Math.atan2(ty-c.y,tx-c.x)+E.rng.n(0,err),dd=d*(1+E.rng.n(0,err*.5));
 tx=c.x+Math.cos(a0)*dd;ty=c.y+Math.sin(a0)*dd;
 c.st.pa++;E.st.pa[c.s]++;
 let recv=m?m.i:-1;const v=lofted?clamp(12+d*.3,14,25):clamp(dd*.45*(.45+.55*E.wx.fric)+7,9,27);
 if(!lofted&&m){const ic=intercept(E,c,tx,ty,(v+7)/2,op);if(ic){tx=ic.x;ty=ic.y;recv=ic.o.i}}
 kick(E,c,tx,ty,v,lofted,recv);E.ball.cross=!!cross;
}
function kick(E,c,tx,ty,v,lofted,recv){
 const b=E.ball,dx=tx-b.x,dy=ty-b.y,d=Math.hypot(dx,dy)||.1;
 Object.assign(b,{vx:dx/d*v,vy:dy/d*v,vz:lofted?9.81*(d/v)/2:0,z:.12,owner:-1,recv,aerial:lofted,lastP:c.i,lastS:c.s,kt:E.t,tgt:{x:tx,y:ty}});
 E.poss=c.s;setPose(c,POSE.kick);c.cool=.8;c.dribT=null;
}

/* ---------- ball in flight ---------- */
function ballFlight(E){
 const b=E.ball;
 b.x+=b.vx*DT;b.y+=b.vy*DT;
 if(b.z>.11||b.vz>0){b.vz-=9.81*DT;b.z+=b.vz*DT;if(b.z<=.11){b.z=.11;if(b.vz<-2.2){b.vz=-b.vz*.35;b.vx*=.6;b.vy*=.6}else b.vz=0;if(!b.shot)b.aerial=false}}
 if(b.z>1&&E.wx.wind&&!b.shot){const w=E.wx.wind*E.wxPlan.wSpd/30;b.vx+=Math.cos(E.wxPlan.wDir)*w*.9*DT;b.vy+=Math.sin(E.wxPlan.wDir)*w*.9*DT}
 if(b.z<=.12){const f=Math.exp(-(b.shot?.1:.45*E.wx.fric)*DT);b.vx*=f;b.vy*=f}
 if(b.shot){shotFlight(E);return}
 if(outOfPlay(E))return;
 if(b.recv>=0){const r=E.P[b.recv];if(!r.off){const d=Math.hypot(r.x-b.x,r.y-b.y);
  if(b.aerial){if(b.z<2.6&&b.vz<0&&d<2.6){aerial(E);return}}
  else if(d<1.6&&b.z<1.5){receive(E,r,false);return}}}
 if(b.aerial&&b.recv<0&&b.z<2.4&&b.vz<0){aerial(E);return}
 const sp=Math.hypot(b.vx,b.vy);
 if((sp<6||b.recv<0||E.t-b.kt>4)&&b.z<1.6){let best=null,bd=1.15;for(const p of E.P){if(p.off)continue;const d=Math.hypot(p.x-b.x,p.y-b.y);if(d<bd){bd=d;best=p}}if(best){receive(E,best,best.i!==b.recv);return}}
 if(sp<.3&&b.z<=.12){b.vx=b.vy=0}
}
function receive(E,p,loose){
 const b=E.ball,pr=pressure(E,p),sp=Math.hypot(b.vx,b.vy),passer=b.lastP>=0?E.P[b.lastP]:null;
 let ok=.905+.09*p.a.fir-(pr<1.1?.1:pr<2.4?.035:0)-(sp>16?.05:0)-E.wx.touch;
 if(p.pos==='GK'&&inBox(p.s,b.x,b.y))ok=.98;
 if(E.rng.f()<ok){
  if(passer&&passer.s===p.s&&passer!==p&&(!loose||E.t-b.kt<4)&&!b.shot){passer.st.pc++;E.st.pc[p.s]++;E.lastPass={i:passer.i,t:E.t}}
  else if(passer&&passer.s!==p.s){if(!loose)p.st.in++;E.lastPass=null}
  Object.assign(b,{owner:p.i,recv:-1,aerial:false,vz:0,z:.11,lastS:p.s,lastP:p.i,cross:false});E.poss=p.s;
  p.cool=(2.95+(1-p.a.dec)*1+E.rng.f()*1.9)*[1.35,1,.78][E.T[p.s].tac.ins.tempo]*(counterOn(E,p.s)?.6:1);p.dribT=null;
 }else{const a=E.rng.f()*Math.PI*2;Object.assign(b,{vx:Math.cos(a)*3,vy:Math.sin(a)*3,recv:-1,lastP:p.i,lastS:p.s,kt:E.t,aerial:false})}
}
function aerial(E){
 const b=E.ball;let best=null,bs=-9;
 for(const p of E.P){if(p.off)continue;const d=Math.hypot(p.x-b.x,p.y-b.y);if(d>2.6)continue;
  let sc=p.a.hea*.45+p.a.jmp*.35+p.a.str*.2-d*.22+E.rng.f()*.32;
  if(p.pos==='GK'&&inBox(p.s,b.x,b.y))sc+=.3+p.a.han*.3;
  if(p.s===b.lastS&&p.role==='target')sc+=.08;
  if(sc>bs){bs=sc;best=p}}
 b.aerial=false;b.recv=-1;
 if(!best)return;
 const p=best,s=p.s,fx=fX(s,b.x),fy=fY(s,b.y);
 if(p.pos==='GK'&&inBox(s,b.x,b.y)){setPose(p,POSE.dive);receive(E,p,true);return}
 setPose(p,POSE.head);
 if(s===b.lastS&&fx>84&&Math.abs(fy-34)<15){if(b.lastP>=0&&E.P[b.lastP].s===s&&b.lastP!==p.i)E.lastPass={i:b.lastP,t:E.t};b.x=p.x;b.y=p.y;shoot(E,p,true,false);return}
 if(s!==b.lastS&&fx<18&&E.rng.f()<.14){p.st.in++;setRestart(E,'corner',1-s,fX(s,0),b.y<34?0:PH);return}
 if(s!==b.lastS&&fx<40){b.x=p.x;b.y=p.y;p.st.in++;kick(E,p,fX(s,clamp(fx+20+E.rng.f()*16,0,100)),fY(s,clamp(fy+E.rng.n(0,12),3,65)),13,true,-1);b.z=2;return}
 receive(E,p,false);
}
function outOfPlay(E){
 const b=E.ball;
 if(b.y<0||b.y>PH){setRestart(E,'throw',1-b.lastS,clamp(b.x,1,PW-1),b.y<0?0:PH);return true}
 if(b.x<0||b.x>PW){const side=b.x<0?0:1;if(b.lastS===side)setRestart(E,'corner',1-side,b.x<0?0:PW,b.y<34?0:PH);else setRestart(E,'gk',side);return true}
 return false;
}

/* ---------- shooting ---------- */
function shoot(E,c,head,pen){
 const s=c.s,b=E.ball,fx=fX(s,c.x),fy=fY(s,c.y),dg=Math.hypot(PW-fx,fy-34),op=opps(E,s),gk=op.find(o=>o.pos==='GK');
 const gks=gk?(gk.a.ref+gk.a.div+gk.a.one+gk.a.pos)/4:.2,bl=pen?0:blockers(c,op,s),sk=head?c.a.hea:dg>20?c.a.lon:c.a.fin;
 let x=pen?.76:xgAt(fx,fy)*(head?.55:1)*Math.pow(.75,bl)*Math.pow(.8,density(c,op,s));
 const prs=pen?9:pressure(E,c);x*=(.72+.56*sk)*(.9+.2*c.a.cmp)*(prs<1.5?.72:prs<3?.86:1)*(1.12-.5*gks)*(pen?1:.40)*(!pen&&E.T[1-s].tac.ins.ment>=3&&E.t-E.gain[s]<10?1.25:1);x=clamp(x,.01,.95);
 const pOT=clamp(Math.max(x+.08,.28+.4*sk-.006*dg),.1,.93),blockP=Math.min(.45,bl*.22),r=E.rng.f();
 const out=E.rng.f()<blockP?'block':r<x?'goal':r<pOT?'save':'miss';
 c.st.sh++;E.st.sh[s]++;E.st.xg[s]+=x;if(out==='goal'||out==='save'){c.st.so++;E.st.sot[s]++}
 const ast=E.lastPass&&E.t-E.lastPass.t<6&&E.P[E.lastPass.i].s===s&&E.lastPass.i!==c.i?E.lastPass.i:-1;
 if(ast>=0)E.P[ast].st.kp++;
 const gx=s?-.6:PW+.6;let gy,gz;
 if(out==='miss'){if(E.rng.f()<.55){gy=34+(E.rng.f()<.5?-1:1)*(GH+.4+E.rng.f()*3);gz=.3+E.rng.f()*1.6}else{gy=34+E.rng.n(0,2.5);gz=2.65+E.rng.f()*1.5}}
 else{gy=34+(E.rng.f()-.5)*2*(GH-.35);gz=.2+E.rng.f()*(head?1.6:2)}
 let blk=-1;if(out==='block'){let bd=99;for(const o of op){if(o.pos==='GK')continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d<bd&&fX(s,o.x)>fx-1){bd=d;blk=o.i}}}
 const v=head?15:pen?24:clamp(19+sk*11,18,32),d=Math.hypot(gx-c.x,gy-c.y),T=d/v;
 b.x=c.x;b.y=c.y;b.z=head?2:.15;
 Object.assign(b,{vx:(gx-c.x)/T,vy:(gy-c.y)/T,vz:(gz-b.z+4.905*T*T)/T,owner:-1,recv:-1,aerial:false,lastP:c.i,lastS:s,kt:E.t,
  shot:{s,out,x,shooter:c.i,ast,gk:gk?gk.i:-1,gy,gz,head,pen,blk}});
 E.poss=s;setPose(c,head?POSE.head:POSE.kick);c.cool=1;
 ev(E,'shot',s,c.i,{out,x,head,pen,ast});
 if(gk&&(out==='save'||out==='goal')&&E.rng.f()<.85){gk.diveY=gy;setPose(gk,POSE.dive)}
}
function shotFlight(E){
 const b=E.ball,sh=b.shot,s=sh.s,past=s?b.x<=0:b.x>=PW;
 if(sh.out==='block'&&sh.blk>=0){const bk=E.P[sh.blk];if(Math.hypot(bk.x-b.x,bk.y-b.y)<1.3){b.shot=null;bk.st.in++;ev(E,'block',s,sh.shooter,{by:bk.i});
   if(E.rng.f()<.45){setRestart(E,'corner',s,s?0:PW,b.y<34?0:PH);return}
   const a=Math.atan2(b.vy,b.vx)+Math.PI+E.rng.n(0,.9);Object.assign(b,{vx:Math.cos(a)*7,vy:Math.sin(a)*7,vz:2,recv:-1,lastP:bk.i,lastS:bk.s,kt:E.t});return}}
 if(sh.out==='save'&&sh.gk>=0){const gk=E.P[sh.gk];if(s?b.x<=gk.x+.4:b.x>=gk.x-.4){
   b.shot=null;gk.st.sv++;setPose(gk,POSE.dive);ev(E,'save',s,sh.shooter,{gk:gk.i,gkPid:gk.pid,x:sh.x});
   const r=E.rng.f();
   if(r<.42*E.wx.hold){Object.assign(b,{owner:gk.i,vx:0,vy:0,vz:0,lastS:gk.s,lastP:gk.i});E.poss=gk.s;gk.cool=1.6;E.lastPass=null}
   else if(r<.72){Object.assign(b,{vx:(s?1:-1)*(4+E.rng.f()*6),vy:E.rng.n(0,6),vz:2.5,recv:-1,lastP:gk.i,lastS:gk.s,kt:E.t})}
   else setRestart(E,'corner',s,s?0:PW,b.y<34?0:PH);
   return}}
 if(past){b.shot=null;if(sh.out==='goal'){goal(E,s,sh);return}ev(E,'miss',s,sh.shooter,{x:sh.x});setRestart(E,'gk',1-s);return}
 if(E.t-b.kt>4)b.shot=null;
}
function goal(E,s,sh){
 E.score[s]++;const c=E.P[sh.shooter];c.st.g++;if(sh.ast>=0)E.P[sh.ast].st.as++;
 setPose(c,POSE.cel);E.lastPass=null;
 ev(E,'goal',s,sh.shooter,{ast:sh.ast,astPid:sh.ast>=0?E.P[sh.ast].pid:null,x:sh.x,head:sh.head,pen:sh.pen,score:E.score.slice()});
 const b=E.ball;Object.assign(b,{vx:0,vy:0,vz:0,z:.11,owner:-1,recv:-1,shot:null,aerial:false});
 setRestart(E,'ko',1-s,52.5,34);E.restart.t=30;E.restart.cel=sh.shooter;E.restart.place=false;
}

/* ---------- tackles and fouls ---------- */
function tackles(E,c){
 for(const o of E.T[1-c.s].pl){
  if(o.off||o.tkCool>E.t)continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d>1.7)continue;
  const ins=E.T[o.s].tac.ins,box=inBox(o.s,c.x,c.y);if(d>1.9||E.rng.f()>(.0062+.0026*ins.tackle)*(box?2.4:1))continue;
  o.tkCool=E.t+1.2;setPose(o,POSE.tackle);
  const win=sig(((o.a.tck*1.1+o.a.str*.3+o.a.pos*.2)-(c.a.dri*1.1+c.a.agi*.3+c.a.str*.2))*4)*(.6+.08*ins.tackle)*((ROLE_FX[o.role]||{}).tackle||1)*(.7+.3*clamp(o.en,0,1));
  const foulP=clamp(.1+o.a.agg*.08+ins.tackle*.05+(ins.press===2?.05:0)-o.a.tck*.06,.04,.32)*(box?.12:1),r=E.rng.f();
  if(r<foulP){foul(E,o,c);return}
  if(r<foulP+win*(1-foulP)){
   o.st.tk++;E.st.tk[o.s]++;E.lastPass=null;
   const b=E.ball;
   if(E.rng.f()<.55){Object.assign(b,{owner:o.i,lastS:o.s,lastP:o.i});E.poss=o.s;o.cool=.4}
   else{const a=E.rng.f()*Math.PI*2;Object.assign(b,{owner:-1,vx:Math.cos(a)*3,vy:Math.sin(a)*3,recv:-1,lastP:o.i,lastS:o.s,kt:E.t})}
   c.cool=Math.max(c.cool,.3);return}
  o.stun=E.t+.8;c.st.dr++;
 }
}
function foul(E,o,c){
 o.st.fo++;E.st.fo[o.s]++;const ins=E.T[o.s].tac.ins;let card=0;
 if(E.rng.f()<.08+.05*ins.tackle+o.a.agg*.06){card=1;o.yc++;E.st.yc[o.s]++;if(o.yc>=2)card=2}else if(E.rng.f()<.005)card=2;
 ev(E,'foul',o.s,o.i,{on:c.i,card});
 if(card===2){o.off=true;o.red=true;E.st.rc[o.s]++;o.x=fX(o.s,50);o.y=-3;ev(E,'red',o.s,o.i)}
 const s=c.s,fx=fX(s,c.x),fy=fY(s,c.y);
 if(fx>PW-16.5&&Math.abs(fy-34)<20.16){setRestart(E,'pen',s,fX(s,PW-11),34);ev(E,'pen',s,c.i)}
 else setRestart(E,'fk',s,c.x,c.y,c);
}

/* ---------- set pieces ---------- */
function setRestart(E,type,s,x,y,taker){
 const b=E.ball;Object.assign(b,{owner:-1,recv:-1,shot:null,aerial:false,vx:0,vy:0,vz:0,z:.11});
 if(type==='gk'){x=fX(s,5.5);y=34+(E.rng.f()<.5?-5:5)}
 if(type==='corner'){x=x<1?.6:PW-.6;y=y<34?.6:PH-.6}
 if(type==='throw')y=y<=0?.3:PH-.3;
 b.x=x;b.y=y;E.poss=s;
 const tm=E.T[s],pl=tm.pl.filter(p=>!p.off);
 if(!taker){
  if(type==='gk')taker=pl.find(p=>p.pos==='GK');
  else if(type==='corner')taker=pl.filter(p=>p.pos!=='GK').sort((a,c)=>c.a.cro-a.a.cro)[0];
  else if(type==='pen')taker=pl.filter(p=>p.pos!=='GK').sort((a,c)=>(c.a.fin+c.a.cmp)-(a.a.fin+a.a.cmp))[0];
  if(!taker)taker=nearestTo(pl.filter(p=>p.pos!=='GK'),x,y);
 }
 E.restart={type,s,x,y,t:{throw:7,gk:11,corner:15,fk:12,ko:5,pen:22}[type]*(.8+E.rng.f()*.4),taker:taker.i,place:true};
 if(type==='corner'){E.st.cor[s]++;ev(E,'corner',s,taker.i)}
}
function restartStep(E){
 const r=E.restart,b=E.ball,tk=E.P[r.taker];
 shapeTeam(E,E.T[0]);shapeTeam(E,E.T[1]);
 const dir=r.s?-1:1;
 if(r.type==='ko'){
  for(const p of E.P){const fx=fX(p.s,p.tx);if(fx>50)p.tx=fX(p.s,50)}
  if(r.cel!=null&&r.t>18){const sc=E.P[r.cel];for(const p of E.T[sc.s].pl){if(p.off||p.pos==='GK')continue;if(p===sc){p.tx=fX(sc.s,PW-6);p.ty=sc.y<34?4:PH-4;p.sprint=true}else{p.tx=sc.x-dir*0+(sc.s?2:-2);p.ty=sc.y;p.sprint=true}}}
 }
 if(r.type==='corner'){
  const att=E.T[r.s].pl.filter(p=>!p.off&&p!==tk&&p.pos!=='GK').sort((a,c)=>(c.a.hea+c.a.jmp)-(a.a.hea+a.a.jmp));
  const spots=[[99,30],[97,37],[94,33],[101,39],[88,26],[88,42]];
  att.forEach((p,k)=>{if(k<6){p.tx=fX(r.s,spots[k][0]);p.ty=fY(r.s,spots[k][1])}});
  const def=E.T[1-r.s].pl.filter(p=>!p.off);
  def.forEach(p=>{if(p.pos==='GK'){p.tx=fX(1-r.s,1.2);p.ty=34;return}});
  const markers=def.filter(p=>p.pos!=='GK').sort((a,c)=>(c.a.mar+c.a.hea)-(a.a.mar+a.a.hea));
  att.slice(0,4).forEach((a,k)=>{const m=markers[k];if(m){m.tx=a.tx+dir*1;m.ty=a.ty}});
  markers.slice(4,6).forEach((m,k)=>{m.tx=fX(1-r.s,6);m.ty=[30,38][k]});
 }
 if(r.type==='pen'){for(const p of E.P){if(p===tk||p.off)continue;if(p.pos==='GK'&&p.s!==r.s){p.tx=fX(p.s,.8);p.ty=34;continue}const fx=fX(r.s,p.tx);if(fx>PW-19){p.tx=fX(r.s,PW-19-((p.i*7)%9));p.ty=clamp(p.ty+((p.i*13)%11-5)*1.6,6,62)}}}
 if(r.type==='fk'){for(const p of E.T[1-r.s].pl){if(p.off)continue;const d=Math.hypot(p.tx-r.x,p.ty-r.y);if(d<9.2){const a=Math.atan2(p.ty-r.y,p.tx-r.x);p.tx=r.x+Math.cos(a)*9.2;p.ty=r.y+Math.sin(a)*9.2}}}
 if(r.place||r.t<4){tk.tx=r.x-dir*.6;tk.ty=r.y;tk.sprint=true}
 if(r.place){b.x=r.x;b.y=r.y}
 r.t-=DT;
 const ready=Math.hypot(tk.x-r.x,tk.y-r.y)<1.6;
 if(r.t<=0&&(ready||r.t<-5)){
  if(!r.place){b.x=r.x;b.y=r.y}
  E.restart=null;tk.x=r.x-dir*.5;tk.y=r.y;take(E,r,tk);
 }
}
function take(E,r,tk){
 const s=r.s,op=opps(E,s),ms=mates(E,s,tk),b=E.ball;b.x=r.x;b.y=r.y;b.z=.11;E.poss=s;
 const nearMate=(maxD,fwd)=>{const c=ms.filter(m=>m.pos!=='GK'||r.type==='gk'?true:false).filter(m=>{const d=Math.hypot(m.x-tk.x,m.y-tk.y);return d>4&&d<maxD&&(!fwd||fX(s,m.x)<=offLine(E,s))});return c.length?E.rng.pick(c):nearestTo(ms,tk.x,tk.y)};
 switch(r.type){
  case'ko':{const m=ms.filter(p=>fX(s,p.x)<fX(s,tk.x)).sort((a,c)=>Math.hypot(a.x-tk.x,a.y-tk.y)-Math.hypot(c.x-tk.x,c.y-tk.y))[0]||nearMate(20);doPass(E,tk,m.x,m.y,m,false,op,false);break}
  case'throw':{setPose(tk,POSE.thr);const m=nearMate(20);doPass(E,tk,m.x,m.y,m,false,op,false);break}
  case'gk':{const ins=E.T[s].tac.ins;if(ins.passing===2||E.rng.f()<.42){const fw=ms.filter(m=>fX(s,m.x)>45);const m=fw.length?E.rng.pick(fw):nearMate(60);doPass(E,tk,m.x,m.y,m,true,op,false)}else{const cbs=ms.filter(m=>GROUP[m.pos]==='DEF');const m=cbs.length?E.rng.pick(cbs):nearMate(30);doPass(E,tk,m.x,m.y,m,false,op,false)}break}
  case'corner':{const t=crossTarget(E,tk);doPass(E,tk,t.x,t.y,t.m,true,op,true);break}
  case'pen':shoot(E,tk,false,true);break;
  case'fk':{const fx=fX(s,r.x),fy=fY(s,r.y);if(fx>74&&Math.abs(fy-34)<16&&E.rng.f()<.4)shoot(E,tk,false,false);else{b.owner=tk.i;b.lastS=s;b.lastP=tk.i;tk.cool=.1;decide(E,tk,9)}break}
 }
}

/* ---------- substitutions & ratings ---------- */
function substitute(E,tm,p,pid){
 const po=E.getP(pid);if(!po||tm.subs>=5)return false;
 const n=mkSim(E,po,tm.s,p.slot,tm,p.i);n.x=fX(tm.s,52.5);n.y=tm.s?PH+.5:-.5;n.st.mins=0;
 E.old.push(p);E.P[p.i]=n;tm.pl[tm.pl.indexOf(p)]=n;tm.bench=tm.bench.filter(x=>x!==pid);tm.subs++;
 if(E.ball.owner===p.i)E.ball.owner=-1;
 ev(E,'sub',tm.s,p.i,{outPid:p.pid,inPid:pid});return true;
}
function autoSubs(E){
 for(const tm of E.T){
  if(!tm.ai||tm.subs>=5||E.t<3300)continue;
  const tired=tm.pl.filter(p=>!p.off&&p.pos!=='GK').sort((a,c)=>a.en-c.en)[0];
  if(!tired||tired.en>.68&&!(tired.yc&&E.rng.f()<.3))continue;
  const cand=tm.bench.map(id=>E.getP(id)).filter(q=>q&&q.pos!=='GK').sort((a,c)=>rateAt(c,tired.pos)-rateAt(a,tired.pos))[0];
  if(cand)substitute(E,tm,tired,cand.id);
 }
}
function rate(E,p){
 const s=p.s,ga=E.score[1-s],gf=E.score[s],st=p.st;if(st.mins<600)return null;
 let r=6.2+(gf>ga?.3:gf<ga?-.3:0)+st.g*.85+st.as*.6+st.kp*.15+st.so*.06+st.pc*.007-(st.pa-st.pc)*.03+st.tk*.1+st.in*.07+st.sv*.22+st.dr*.04-st.fo*.06-p.yc*.25;
 if(['GK','CB','LB','RB'].includes(p.pos))r+=ga===0?.45:-ga*.17;
 if(p.red)r-=1.2;
 return Math.round(clamp(r,3.5,10)*10)/10;
}
function finalize(E){for(const p of E.P.concat(E.old))p.rating=rate(E,p)}
// Runs a whole match with no viewer (instant result).
function runToEnd(E){let g=0;while(!E.done&&g++<80000)stepMatch(E)}
