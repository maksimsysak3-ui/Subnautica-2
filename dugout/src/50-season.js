/* ================= career ================= */
let S=null;
const SEASON_START=Date.UTC(2027,7,7);
const mdDate=md=>SEASON_START+(S.season-1)*364*DAY+Math.round(md*7.4)*DAY;
const seasonLabel=()=>`${2026+S.season}/${String(2027+S.season).slice(2)}`;
const windowOpen=()=>S.md<WIN1||(S.md>=WIN2[0]&&S.md<WIN2[1]);
// Star bands get steeper at the top: 4★ and above is a small, expensive elite.
const STAR_BANDS=[[88,5],[84,4.5],[81,4],[76,3.5],[71,3],[66,2.5],[60,2],[54,1.5],[47,1]];
const stars=v=>{for(const[min,s]of STAR_BANDS)if(v>=min)return s;return .5};
const at20=v=>clamp(Math.round(v/5),1,20);
const clubOf=id=>S.clubs[id];
const leagueOf=cid=>S.leagues[S.clubs[cid].league];
const squadOf=cid=>S.clubs[cid].squad.map(id=>S.players[id]);
function roundRobin(ids){
 const t=ids.slice(),n=t.length,rounds=[];
 for(let r=0;r<n-1;r++){const m=[];for(let i=0;i<n/2;i++){const a=t[i],b=t[n-1-i];m.push((r+i)%2?[b,a]:[a,b])}rounds.push(m);t.splice(1,0,t.pop())}
 return rounds.concat(rounds.map(r=>r.map(([a,b])=>[b,a])));
}
function genWorld(seed){
 const rng=R(seed);
 S={v:3,seed,season:1,md:0,user:-1,clubs:[],players:{},leagues:[],fixtures:{},results:{},inbox:[],news:[],nid:1,npid:1,shortlist:[],hist:[],bidLog:{},deals:[],bids:[],compHist:{},board:62,fin:newFin(),train:{focus:'balanced',int:1},mgr:{rep:45,w:0,d:0,l:0,trophies:[],clubs:[],seasons:0}};
 const forms=Object.keys(FORMATIONS);
 COUNTRIES.forEach(co=>{
  const used=new Set();
  co.leagues.forEach((lname,tier)=>{
   const lid=S.leagues.length,lg={id:lid,name:lname,nation:co.code,tier,clubs:[]};S.leagues.push(lg);
   for(let i=0;i<PER;i++){
    const rep=Math.round(clamp((tier?67-i*1.0:92-i*1.6)*co.f+rng.n(0,1.5),35,96));
    const c=Object.assign({id:S.clubs.length,nation:co.code,league:lid,rep,hist:[]},makeClubIdentity(rng,co.lang,used));
    c.cap=Math.round((tier?9000:22000)+rep*rep*(tier?2.2:6)+rng.i(0,6000));
    c.tac=newTactic(rng.pick(forms));c.tac.ins.ment=2;c.tac.ins.press=rng.i(0,2);c.tac.ins.passing=rng.i(0,2);c.tac.ins.tempo=rng.i(0,2);c.tac.ins.line=rng.i(0,2);
    c.squad=[];S.clubs.push(c);lg.clubs.push(c.id);
    const base=repToOvr(rep),star=rng.i(3,TEMPLATE.length-1),youth=rng.i(3,TEMPLATE.length-1),seen={};
    TEMPLATE.forEach((pos,k)=>{
     const depth=seen[pos]=(seen[pos]||0)+1;let target=base+(depth===1?rng.i(-1,4):-rng.i(3,10)),age=depth===1?rng.i(22,31):rng.i(19,33),pot;
     // A standout player is likelier at bigger clubs; only the elite get a world-class marquee.
     if(k===star&&rng.chance(clamp((rep-50)/50,.12,.75)))target=base+rng.i(3,7)+(rep>=82&&rng.chance(.7)?rng.i(3,5):0);
     if(k===youth&&k!==star){age=rng.i(17,19);target=base-rng.i(10,15);pot=clamp(base+rng.i(2,14),target+8,rng.chance(.04)?94:89)}
     const nat=rng.chance(tier?.78:.6)?co.code:rng.pick(NAT_BAG);
     const p=genPlayer(rng,pos,clamp(target,32,93),c.id,nat,{age,pot});p.id=S.npid++;S.players[p.id]=p;c.squad.push(p.id);p.num=assignNum(c.id,pos);
    });
    const wages=c.squad.reduce((a,id)=>a+S.players[id].wage,0);
    c.wageBudget=Math.round(wages*1.12/1000)*1000;c.budget=budgetOf(rep);c.balance=c.budget*2;
   }
   S.fixtures[lid]=roundRobin(shuffled(lg.clubs,rng));S.results[lid]=[];
  });
 });
 initCups(null);
 return S;
}
function startCareer(cid){
 S.user=cid;const c=clubOf(cid);
 aiTransfers();aiTransfers();ensureLineup(cid);
 mail('Board of Directors',`Welcome to ${c.name}`,`<p>Welcome to ${esc(c.stadium)}. The board has made <b>${money(c.budget)}</b> available for transfers and a wage budget of <b>${money(c.wageBudget)}</b> per week.</p><p>Our objective this season: <b>${expectation(cid)}</b>.</p><p>The transfer window is open until matchday ${WIN1}.</p><p>Welcome aboard, and good luck.</p>`,null,'board',{att:{t:'stadium',cid},links:[['Club overview','nav','club'],['Office','nav','office']]});
 const best=squadOf(cid).sort((a,b)=>b.ovr-a.ovr)[0];
 mail('Assistant Manager','Squad assessment',`<p>${esc(best.fn+' '+best.ln)} is our standout player. I have set us up in a ${c.tac.form}. Review the shape, roles and instructions on the Tactics screen before the opener.</p><p>Here are the three players I think we build around.</p>`,null,'staff',{att:{t:'squad'},links:[['Open tactics','nav','tactics'],['View squad','nav','squad']]});
 if(typeof academyIntake==='function'&&!(S.acad||[]).length)academyIntake();
 news(`The board hopes the new appointment can deliver: ${expectation(cid).toLowerCase()}.`,'club',[cid],{title:`${c.short} name new manager`});
 save();
}
function expectation(cid){const c=clubOf(cid),lg=leagueOf(cid),rank=lg.clubs.map(clubOf).sort((a,b)=>b.rep-a.rep).findIndex(x=>x.id===cid)+1;
 if(lg.tier===1)return rank<=3?'Win promotion':rank<=8?'Challenge for promotion':rank<=15?'Finish mid-table':'Avoid relegation';
 return rank<=2?'Win the title':rank<=5?'Finish in the top four':rank<=10?'Finish in the top half':rank<=15?'Finish mid-table':'Avoid relegation'}
const targetPos=cid=>{const e=expectation(cid);return{'Win the title':1,'Finish in the top four':4,'Finish in the top half':10,'Finish mid-table':14,'Avoid relegation':17,'Win promotion':3,'Challenge for promotion':6}[e]||10};
function mail(from,subj,body,action,kind,extra){S.inbox.unshift(Object.assign({id:S.nid++,from,subj,body,md:S.md,season:S.season,read:false,action:action||null,kind:kind||'info'},extra||{}));if(S.inbox.length>60)S.inbox.length=60}
function news(text,kind,clubs,extra){S.news.unshift(Object.assign({id:S.nid++,md:S.md,season:S.season,text,kind,clubs:clubs||[]},extra||{}));if(S.news.length>90)S.news.length=90}
const newFin=()=>({gate:0,tv:0,prize:0,sponsor:0,sales:0,wages:0,buys:0});
function table(lid){
 const lg=S.leagues[lid],T={};lg.clubs.forEach(id=>T[id]={id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,form:[]});
 for(const r of S.results[lid]){const h=T[r.h],a=T[r.a];if(!h||!a)continue;h.p++;a.p++;h.gf+=r.hg;h.ga+=r.ag;a.gf+=r.ag;a.ga+=r.hg;
  if(r.hg>r.ag){h.w++;a.l++;h.pts+=3;h.form.push('W');a.form.push('L')}else if(r.hg<r.ag){a.w++;h.l++;a.pts+=3;a.form.push('W');h.form.push('L')}else{h.d++;a.d++;h.pts++;a.pts++;h.form.push('D');a.form.push('D')}}
 return Object.values(T).sort((x,y)=>y.pts-x.pts||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||clubOf(x.id).name.localeCompare(clubOf(y.id).name));
}
const posIn=(tb,id)=>tb.findIndex(r=>r.id===id)+1;
const userFixture=()=>{const t=typeof curTie==='function'&&S.cal?curTie():null;return t?[t.h,t.a]:null};
function fixturesOf(cid){const lid=clubOf(cid).league;return S.fixtures[lid].map((r,md)=>{const f=r.find(m=>m.includes(cid));const res=S.results[lid].find(x=>x.md===md&&x.h===f[0]&&x.a===f[1]);return{md,h:f[0],a:f[1],res}})}

/* ---------- AI team management ---------- */
function prepAI(cid,oppId){
 const c=clubOf(cid);if(cid===S.user)return;
 const opp=oppId!=null?clubOf(oppId):null;c.tac.xi=pickXI(cid,c.tac.form);c.tac.bench=pickBench(cid,c.tac.xi);
 if(opp){const d=c.rep-opp.rep,ins=c.tac.ins,oi=opp.tac.ins;ins.ment=d>8?3:d<-10?1:2;
  // AI managers scout the opponent and adapt: go direct over a high press, sit deeper and counter an all-out attack.
  if(!c.tac.base)c.tac.base={passing:ins.passing,tempo:ins.tempo,onWin:ins.onWin,line:ins.line,press:ins.press};
  Object.assign(ins,c.tac.base);
  if(oi.press===2){ins.passing=2;ins.tempo=Math.max(ins.tempo,1)}
  if(oi.ment>=3){ins.press=Math.max(ins.press,1);ins.line=Math.min(ins.line,1)}
  if(oi.line===2&&ins.passing<2)ins.passing=2;
 }
}
/* ---------- quick simulator for matches the user is not watching ---------- */
function expG(A,B,home,iA,iB){
 let x=1.07*Math.pow(A.att/B.def,2.2)*Math.pow(A.mid/B.mid,1.1);if(home)x*=1.12;
 x*=[.72,.86,1,1.14,1.3][iA.ment]*[.8,.9,1,1.1,1.22][iB.ment]*[.96,1,1.06][iA.press]*[.97,1,1.04][iB.press];
 return clamp(x,.2,3.2);
}
function quickSim(h,a,md,lid){
 prepAI(h,a);prepAI(a,h);const H=clubOf(h),A=clubOf(a);
 if(h===S.user||a===S.user)ensureLineup(S.user);
 const sH=strength(H.tac.xi,H.tac.form),sA=strength(A.tac.xi,A.tac.form);
 const hg=poisson(expG(sH,sA,true,H.tac.ins,A.tac.ins)),ag=poisson(expG(sA,sH,false,A.tac.ins,H.tac.ins));
 const ratingsOut={};
 const credit=(c,n,gf,ga)=>{const xi=c.tac.xi.filter(x=>x!=null),slots=FORMATIONS[c.tac.form];
  const r={};xi.forEach(id=>r[id]=6.4+(gf>ga?.35:gf<ga?-.3:0)+G.n(0,.35));
  for(let k=0;k<n;k++){const sc=pickW(xi,id=>{const p=S.players[id],pos=slots[c.tac.xi.indexOf(id)][0];return(ATT_W[pos]||.04)*Math.pow(p.at[AIX.fin]/60,1.2)});S.players[sc].s.g++;r[sc]+=1;
   if(G.f()<.72){const as=pickW(xi.filter(x=>x!==sc),id=>{const p=S.players[id],pos=slots[c.tac.xi.indexOf(id)][0];return((MID_W[pos]||0)+(ATT_W[pos]||0)*.6+.08)*Math.pow(p.at[AIX.pas]/60,2)});S.players[as].s.a++;r[as]+=.6}}
  slots.forEach(([pos],i)=>{const id=c.tac.xi[i];if(id!=null&&['GK','CB','LB','RB'].includes(pos))r[id]+=ga===0?.45:-ga*.15});
  for(const id of xi){const p=S.players[id];p.s.ap++;p.s.rs+=clamp(r[id],4,10);p.cond=clamp(p.cond-G.i(14,26),30,100);if(G.f()<.012)p.inj=G.i(1,4);ratingsOut[id]=r[id]}
 };
 credit(H,hg,hg,ag);credit(A,ag,ag,hg);
 const best=Object.entries(ratingsOut).sort((x,y)=>y[1]-x[1])[0];if(best)S.players[best[0]].s.mom++;
 return{md,h,a,hg,ag};
}

/* ---------- matchday ---------- */
function applyUserMatch(E){
 const res={md:S.md,h:E.T[0].club,a:E.T[1].club,hg:E.score[0],ag:E.score[1],user:true};
 const all=E.P.concat(E.old);let best=null;
 for(const sp of all){const p=S.players[sp.pid];if(!p)continue;if(sp.st.mins>0){p.s.ap++;const ti=E.T[sp.s].tac.ins;p.cond=Math.round(clamp(p.cond-G.i(14,26)*Math.min(1,sp.st.mins/90)*(ti.press===2?1.3:1)*(ti.ment>=3?1.1:1),25,100))}
  if(sp.rating!=null){p.s.rs+=sp.rating;if(!best||sp.rating>best.rating)best=sp}}
 for(const e of E.events){if(e.type==='goal'){S.players[e.pid].s.g++;if(e.astPid!=null&&S.players[e.astPid])S.players[e.astPid].s.a++}
  if(e.type==='red'&&e.pid!=null){const p=S.players[e.pid];if(p)p.ban=2}}
 if(best)S.players[best.pid].s.mom++;
 return res;
}
function processMatchday(userRes){
 const md=S.md;S.devNews=[];
 for(const lg of S.leagues){
  for(const[h,a]of S.fixtures[lg.id][md]){
   if(userRes&&userRes.h===h&&userRes.a===a){S.results[lg.id].push(userRes);continue}
   S.results[lg.id].push(quickSim(h,a,md,lg.id));
  }
 }
 for(const p of Object.values(S.players)){
  p.cond=Math.min(100,p.cond+24);
  if(p.inj){p.inj--;if(p.inj<=0)delete p.inj}
  if(p.ban){p.ban--;if(p.ban<=0)delete p.ban}
  const mine=p.club===S.user,tr=S.train,ti=[.6,1,1.45][tr.int];
  if(p.age<=23&&p.ovr<p.pot&&G.f()<.055*(mine?ti*(tr.focus==='youth'?1.5:1):1)*(p.loan?1.5:1)*(S.acad&&S.acad.includes(p.id)?.6+S.academy.fac*.2:1)){if(mine)trainBump(p);else bump(p,1);if(mine){p.dev=(p.dev||0)+1;if(p.ovr>=p.lastNote+2||!p.lastNote){p.lastNote=p.ovr;S.devNews=(S.devNews||[]).concat(p.id)}}}
  else if(p.age>=31&&G.f()<.03*(mine&&tr.focus==='fitness'?.6:1))bump(p,-1);
  if(mine){if(tr.focus==='fitness')p.cond=Math.min(100,p.cond+6);if(tr.int===2){p.cond=Math.max(40,p.cond-5);if(G.f()<.004)p.inj=G.i(1,3)}if(tr.int===0)p.cond=Math.min(100,p.cond+5)}
  p.val=valueOf(p);if(md%4===0){(p.vh=p.vh||[]).push(Math.round(p.val/1e4));if(p.vh.length>10)p.vh.shift();if(mine){(p.oh=p.oh||[]).push(p.ovr);if(p.oh.length>30)p.oh.shift()}}
 }
 const uc=clubOf(S.user),mine=S.results[uc.league].find(r=>r.md===md&&(r.h===S.user||r.a===S.user));
 if(mine){const home=mine.h===S.user,gf=home?mine.hg:mine.ag,ga=home?mine.ag:mine.hg,d=gf>ga?6:gf<ga?-6:0;
  for(const p of squadOf(S.user))p.mor=clamp(p.mor+d+G.i(-2,2),25,98);
  S.fans=clamp((S.fans??62)+(gf>ga?2:gf<ga?-2.5:0),5,100);
 if(home){const g=Math.round(uc.cap*.86*34*(.85+(S.fans??62)*.003));uc.balance+=g;S.fin.gate+=g}
  const tb=table(uc.league),pos=posIn(tb,S.user),tp=targetPos(S.user);S.board=clamp(S.board+(gf>ga?2.2:gf<ga?-2.6:.2)+(pos<=tp?.5:-.6),5,100);}
 {const tv=Math.round(budgetOf(uc.rep)*.035),sp=Math.round(budgetOf(uc.rep)*.012),w=Math.round(wageBill(S.user)*1.05);uc.balance+=tv+sp-w;S.fin.tv+=tv;S.fin.sponsor+=sp;S.fin.wages+=w}
 if(mine){const home=mine.h===S.user,gf=home?mine.hg:mine.ag,ga=home?mine.ag:mine.hg;S.mgr[gf>ga?'w':gf<ga?'l':'d']++}
 if(S.devNews.length){const ps=S.devNews.map(id=>S.players[id]);mail('Head of Coaching','Training report: players improving',`<p>${ps.map(p=>`${esc(p.fn+' '+p.ln)} (${p.pos}, ${p.age}) has developed and is now ${stars(p.ovr)} stars.`).join('<br>')}</p>`,null,'staff',{att:{t:'players',pids:ps.map(p=>p.id)},links:[['Training','goto','squad/training']]})}
 headlines(md);
 if(S.board<14&&!S.sacked)S.sacked=true;
 if(windowOpen())aiTransfers();
 aiManagers();
 if(windowOpen()&&G.f()<(squadOf(S.user).some(p=>p.tl)?.6:.3))incomingOffer();
 if(typeof squadMood==='function')squadMood();
 if(typeof scoutTick==='function')scoutTick();
 S.md++;if(S.cal)S.ci++;
 if(S.md===WIN2[0])mail('Director of Football','January window opens',`<p>The winter transfer window is open until matchday ${WIN2[1]}. Our current position and budget are below.</p>`,null,'transfer',{att:{t:'budget'},links:[['Transfer hub','nav','transfers']]});
 if(S.md===WIN1)mail('Director of Football','Transfer window closed',`<p>The summer window has closed. It reopens at matchday ${WIN2[0]+1}.</p>`,null,'transfer',{att:{t:'budget'}});
 if(S.md>=MDAYS)mail('Board of Directors','The season is over',`<p>Open the season review from the Continue button to see the final standings, promotions and relegations.</p>`,null,'board',{att:{t:'table'},links:[['Competition','nav','comps']]});
}
function resultTitle(r){const H=clubOf(r.h).short,A=clubOf(r.a).short,d=r.hg-r.ag;
 if(d===0)return r.hg>=3?`${H} and ${A} share six goals`:r.hg===0?`${H} and ${A} cancel each other out`:`${H} and ${A} share the points`;
 const W=d>0?H:A,L=d>0?A:H,m=Math.abs(d);return m>=4?`${W} run riot against ${L}`:m>=3?`${W} thrash ${L}`:m===2?`${W} beat ${L}`:`${W} edge past ${L}`}
function headlines(md){
 const ul=clubOf(S.user).league;
 for(const r of S.results[ul].filter(x=>x.md===md)){
  const mine=r.h===S.user||r.a===S.user;if(!mine&&G.f()>.35)continue;
  const W=r.hg>r.ag?r.h:r.ag>r.hg?r.a:null;
  const sum=mine?(W===S.user?`A ${r.hg+r.ag>=4?'thrilling':'hard-earned'} win keeps the momentum going.`:W==null?'A point apiece after a tight contest.':'The manager admitted his side fell short and must respond quickly.'):`Matchday ${md+1} in the ${S.leagues[ul].name}.`;
  news(sum,mine?'club':'result',[r.h,r.a],{title:resultTitle(r),score:[r.h,r.a,r.hg,r.ag]});
 }
 for(const lg of S.leagues){
  const rs=S.results[lg.id].filter(r=>r.md===md);if(!rs.length)continue;
  const big=rs.sort((x,y)=>(y.hg+y.ag)-(x.hg+x.ag))[0];
  if(big.hg+big.ag>=5)news(`${clubOf(big.h).short} ${big.hg}–${big.ag} ${clubOf(big.a).short}: goal-fest in the ${lg.name}.`,'result',[big.h,big.a]);
  if(md>=4&&md%3===0){const tb=table(lg.id);news(`${clubOf(tb[0].id).name} have ${tb[0].pts} points after ${md+1} matchdays, ${tb[0].pts-tb[1].pts} clear of ${clubOf(tb[1].id).short}.`,'table',[tb[0].id],{title:`${clubOf(tb[0].id).short} top the ${lg.name}`})}
 }
}

/* ---------- transfers ---------- */
function weakestSlot(cid){const c=clubOf(cid),xi=pickXI(cid,c.tac.form),slots=FORMATIONS[c.tac.form];let w=null;
 slots.forEach(([pos],i)=>{const p=S.players[xi[i]];const v=p?rateAt(p,pos):30;if(!w||v<w.v)w={pos,v}});return w}
function moveP(pid,to,fee){
 const p=S.players[pid],from=p.club,fc=clubOf(from),tc=clubOf(to);
 fc.squad=fc.squad.filter(x=>x!==pid);p.club=to;p.num=assignNum(to,p.pos);tc.squad.push(pid);
 fc.budget+=fee;tc.budget-=fee;p.mor=clamp(p.mor+5,30,95);p.con=Math.max(p.con,3);
 if(fc.tac.xi)fc.tac.xi=fc.tac.xi.map(x=>x===pid?null:x);if(fc.tac.bench)fc.tac.bench=fc.tac.bench.filter(x=>x!==pid);
 if(from===S.user||to===S.user)ensureLineup(S.user);
 S.shortlist=S.shortlist.filter(x=>x!==pid||to!==S.user);
}
function logDeal(pid,from,to,fee){const p=S.players[pid];S.deals.unshift({pid,name:p.fn+' '+p.ln,pos:p.pos,age:p.age,from,to,fee,md:S.md,season:S.season});if(S.deals.length>300)S.deals.length=300}
function aiTransfers(){
 const n=S.md<WIN1?34:18;
 for(let k=0;k<n;k++){
  const c=G.pick(S.clubs);if(c.id===S.user||c.squad.length>=30||c.budget<5e5)continue;
  const w=weakestSlot(c.id);if(!w)continue;
  let best=null;
  for(const p of Object.values(S.players)){if(p.club===c.id||p.club===S.user)continue;const pc=clubOf(p.club);if(pc.rep>c.rep-2||pc.squad.length<=20)continue;
   const v=rateAt(p,w.pos);if(v<w.v+3||p.val*1.15>c.budget*.7||p.age>31)continue;const sc=v-p.val/1.5e7+(p.age<24?2:0);if(!best||sc>best.s)best={p,s:sc}}
  if(!best||G.f()<.25)continue;
  const p=best.p,fee=Math.round(p.val*(1.05+G.f()*.35)/5e4)*5e4,from=p.club;
  moveP(p.id,c.id,fee);logDeal(p.id,from,c.id,fee);
  if(c.squad.length>28){const worst=squadOf(c.id).filter(x=>x.id!==p.id).sort((a,b)=>a.ovr-b.ovr)[0];const to=G.pick(S.clubs.filter(x=>x.rep<c.rep-8&&x.id!==S.user&&x.squad.length<28))||clubOf(from);const f2=Math.round(worst.val*.8/5e4)*5e4;moveP(worst.id,to.id,f2);logDeal(worst.id,c.id,to.id,f2)}
  const big=fee>=2e7;
  news(`${p.fn} ${p.ln} (${p.pos}, ${p.age}) completes his move from ${clubOf(from).name}. The fee is ${money(fee)}.`,'transfer',[c.id,from],{title:big?`${c.short} smash the bank for ${p.ln}`:`${c.short} sign ${p.ln}`});
 }
}
// AI clubs react to form: managers get sacked, new managers change the shape.
function aiManagers(){
 if(S.md<8)return;
 for(const lg of S.leagues){const tb=table(lg.id);
  for(const r of tb.slice(-4)){const c=clubOf(r.id);if(c.id===S.user||c.sacked===S.season)continue;const f=r.form.slice(-5);
   if(f.filter(x=>x==='L').length>=4&&G.f()<.22){c.sacked=S.season;const forms=Object.keys(FORMATIONS);c.tac=newTactic(G.pick(forms));c.tac.ins.press=G.i(0,2);c.tac.ins.line=G.i(0,2);c.tac.ins.passing=G.i(0,2);
    news(`${c.name} have sacked their manager after ${f.filter(x=>x==='L').length} defeats in five. The new man switches to a ${c.tac.form}.`,'club',[c.id],{title:`${c.short} part company with manager`})}}
  const lead=tb[0];if(lead&&S.md%5===0&&lead.form.slice(-5).every(x=>x==='W'))news(`${clubOf(lead.id).name} have won five in a row and sit top of the ${lg.name}.`,'table',[lead.id],{title:`${clubOf(lead.id).short} on a roll`});
 }
}
function incomingOffer(){
 const cand=squadOf(S.user).filter(p=>p.ovr>=55);if(!cand.length)return;
 const p=pickW(cand,x=>Math.pow(Math.max(1,x.ovr-50),2)*(x.tl?8:1)),uc=clubOf(S.user);
 const pool=S.clubs.filter(c=>c.id!==S.user&&c.rep>=uc.rep-6&&c.budget>p.val);if(!pool.length)return;
 const club=G.pick(pool),fee=Math.round(p.val*(p.tl?.85+G.f()*.3:1.05+G.f()*.4)/5e4)*5e4;
 mail(club.name,`Offer for ${p.ln}`,`<p>${esc(club.name)} have bid <b>${money(fee)}</b> for ${esc(p.fn+' '+p.ln)} (${p.pos}, age ${p.age}). We value him at ${money(p.val)}.</p><p>Let us know if you are willing to do business.</p>`,{type:'offer',pid:p.id,club:club.id,fee},'transfer',{att:{t:'player',pid:p.id}});
}
function wageBill(cid){return squadOf(cid).reduce((a,p)=>a+p.wage,0)}
function wageDemand(p){const uc=clubOf(S.user),pc=clubOf(p.club);return Math.round(p.wage*(1.12+Math.max(0,(pc.rep-uc.rep)/80))/100)*100}
function sellerStance(p){const sel=clubOf(p.club),keyP=squadOf(sel.id).sort((a,b)=>b.ovr-a.ovr).slice(0,3).some(x=>x.id===p.id);return{keyP,mult:(keyP?1.22:1.05)*(sel.squad.length<=21?1.1:1)}}
function bidVerdict(pid,fee){
 const p=S.players[pid],sel=clubOf(p.club),uc=clubOf(S.user),key=S.season+':'+S.md+':'+pid;
 if(!windowOpen())return{ok:false,msg:`The transfer window is closed. It reopens at matchday ${WIN2[0]+1}.`};
 if(fee>uc.budget)return{ok:false,msg:`That is more than your transfer budget of ${money(uc.budget)}.`};
 if(uc.squad.length>=34)return{ok:false,msg:'Your squad is full (34 players). Sell someone first.'};
 if(sel.rep-uc.rep>16&&p.ovr>repToOvr(uc.rep)+7)return{ok:false,msg:`${p.ln} is not interested in joining a club of your stature.`};
 S.bidLog[key]=(S.bidLog[key]||0)+1;if(S.bidLog[key]>3)return{ok:false,msg:`${sel.short} have ended talks until the next matchday.`};
 const st=sellerStance(p),want=Math.round(p.val*st.mult/1e5)*1e5;
 if(fee>=want*(.97+G.f()*.06))return{ok:true,fee};
 if(fee>=want*.78)return{ok:false,counter:Math.round((want+fee)/2/1e5)*1e5,msg:`${sel.short} want more. They would accept ${money(Math.round((want+fee)/2/1e5)*1e5)}.`};
 return{ok:false,msg:`${sel.short} rejected the bid${fee<p.val*.7?' out of hand':''}. They are looking for around ${money(want)}.`};
}
function termsVerdict(p,wage,years){const d=wageDemand(p),uc=clubOf(S.user);
 if(wageBill(S.user)+wage>uc.wageBudget)return{ok:false,msg:`That wage would take you over your wage budget of ${money(uc.wageBudget)} a week.`};
 const need=d*(years>=4&&p.age>=29?.92:years<=1?1.1:1);
 if(wage>=need)return{ok:true};
 if(wage>=need*.88&&G.f()<.4)return{ok:true};
 return{ok:false,msg:`His agent says he wants at least ${money(Math.round(need/100)*100)} a week.`};
}
function canSell(p){const sq=squadOf(S.user);if(sq.length<=18)return'You need at least 18 players.';if(p.pos==='GK'&&sq.filter(x=>x.pos==='GK').length<=2)return'You need at least two goalkeepers.';return''}

/* ---------- season end ---------- */
function endSeason(){
 seasonHistory();
 if(typeof returnLoans==='function')returnLoans();
 if(typeof contractExits==='function')contractExits();
 const contNext=contQualifiers(true),report=[],uc0=clubOf(S.user),uLeague=S.leagues[uc0.league].name,uPos=posIn(table(uc0.league),S.user);
 COUNTRIES.forEach(co=>{
  const [top,bot]=S.leagues.filter(l=>l.nation===co.code).sort((a,b)=>a.tier-b.tier);
  const t1=table(top.id),t2=table(bot.id);
  const down=t1.slice(-DROP).map(r=>r.id),up=t2.slice(0,DROP).map(r=>r.id);
  for(const[lg,tb]of[[top,t1],[bot,t2]]){const sc=Object.values(S.players).filter(p=>lg.clubs.includes(p.club)).sort((a,b)=>b.s.g-a.s.g)[0];(S.compHist[lg.id]=S.compHist[lg.id]||[]).unshift({season:seasonLabel(),champ:tb[0].id,runner:tb[1].id,pts:tb[0].pts,scorer:sc?sc.fn+' '+sc.ln:'',goals:sc?sc.s.g:0,scorerClub:sc?sc.club:null})}
  report.push({league:top.name,champ:t1[0].id,down,up,lower:bot.name,champ2:t2[0].id});
  clubOf(t1[0].id).rep=clamp(clubOf(t1[0].id).rep+2,30,96);
  for(const id of down){clubOf(id).rep=clamp(clubOf(id).rep-3,30,96);clubOf(id).league=bot.id}
  for(const id of up){clubOf(id).rep=clamp(clubOf(id).rep+3,30,96);clubOf(id).league=top.id}
  top.clubs=top.clubs.filter(x=>!down.includes(x)).concat(up);bot.clubs=bot.clubs.filter(x=>!up.includes(x)).concat(down);
 });
 S.hist.unshift(Object.assign({season:seasonLabel(),league:uLeague,pos:uPos,club:S.user},S.lastRow||{}));
 {const lg0=S.leagues[uc0.league],tp=targetPos(S.user);S.mgr.seasons++;S.mgr.rep=clamp(S.mgr.rep+(tp-uPos)*1.6+(uPos===1?6:0),5,99);
  S.lastSeason={pos:uPos,league:uLeague,tier:lg0.tier,champ:uPos===1,promoted:lg0.tier===1&&uPos<=DROP,relegated:lg0.tier===0&&uPos>PER-DROP,club:S.user};
  if(uPos===1)S.mgr.trophies.push({t:uLeague,season:seasonLabel(),club:S.user});
  if(lg0.tier===1&&uPos<=DROP)S.mgr.trophies.push({t:`Promotion from ${uLeague}`,season:seasonLabel(),club:S.user,minor:1})}
 for(const c of S.clubs){c.budget=Math.max(c.budget,0)+budgetOf(c.rep)*.8;c.budget=Math.round(c.budget/1e5)*1e5;c.wageBudget=Math.round(Math.max(c.wageBudget,wageBill(c.id)*1.08)/1000)*1000}
 for(const p of Object.values(S.players)){
  p.age++;if(p.age<=23&&p.ovr<p.pot)bump(p,Math.min(p.pot-p.ovr,G.i(1,5)));else if(p.age>=31)bump(p,-G.i(0,3));
  p.s={ap:0,g:0,a:0,rs:0,mom:0};p.cond=100;p.con--;if(p.con<=0){p.con=G.i(1,4);if(p.club!==S.user)p.wage=wageOf(p)}
  p.val=valueOf(p);delete p.inj;delete p.ban;
 }
 for(const p of Object.values(S.players)){
  if(p.age>=35&&G.f()<.6&&p.club!==S.user||p.age>=37){
   const c=clubOf(p.club),rng=R((Math.random()*2e9)|0),co=COUNTRIES.find(x=>x.code===c.nation);
   const y=genPlayer(rng,p.pos,repToOvr(c.rep)-rng.i(10,16),c.id,rng.chance(.7)?co.code:rng.pick(NAT_BAG),{age:rng.i(16,18),pot:clamp(repToOvr(c.rep)+rng.i(-2,12),55,rng.chance(.04)?93:88)});
   y.id=S.npid++;S.players[y.id]=y;c.squad=c.squad.filter(x=>x!==p.id).concat(y.id);y.num=p.num;keepLegend(p);delete S.players[p.id];
   if(c.id===S.user)mail('Head of Youth',`${p.ln} retires`,`<p>${esc(p.fn+' '+p.ln)} has retired. ${esc(y.fn+' '+y.ln)} (${y.pos}, 17) has been promoted from the academy.</p>`,null,'staff',{att:{t:'player',pid:y.id,note:'Academy graduate'},links:[['View player','player',y.id,1]]});
  }
 }
 {const uc=clubOf(S.user),prize=Math.round(budgetOf(uc.rep)*(1-(uPos-1)/PER)*.6);uc.balance+=prize;uc.budget+=Math.round(prize*.5);S.fin=newFin();S.fin.prize=prize}
 if(S.owed){clubOf(S.user).budget-=Math.round(S.owed);S.fin.buys+=Math.round(S.owed);S.owed=0}
 S.season++;S.md=0;S.bidLog={};S.bids=[];
 S.youth=typeof academyIntake==='function'?academyIntake():youthIntake(S.user,G.i(3,5)).map(p=>p.id);for(const c of S.clubs)if(c.id!==S.user&&c.squad.length<30)youthIntake(c.id,G.i(1,2));
 S.offers=S.lastSeason&&S.mgr.rep>clubOf(S.user).rep+4?jobOffers(2,clubOf(S.user).rep+3,Math.min(96,S.mgr.rep+8)).map(c=>c.id):[];
 for(const p of Object.values(S.players)){p.dev=0;p.ovr0=p.ovr;p.val0=p.val}
 for(const lg of S.leagues){S.fixtures[lg.id]=roundRobin(shuffled(lg.clubs));S.results[lg.id]=[]}
 S.clubs.forEach(c=>{c.tac.xi=c.tac.xi||[];if(c.id!==S.user)c.tac.xi=[]});ensureLineup(S.user);
 initCups(contNext);
 mail('Board of Directors',`Season ${seasonLabel()} begins`,`<p>You are in the ${esc(S.leagues[clubOf(S.user).league].name)}. The board's objective: <b>${expectation(S.user)}</b>. Transfer budget: <b>${money(clubOf(S.user).budget)}</b>.</p>`,null,'board',{att:{t:'budget'},links:[['Office','nav','office'],['Transfer hub','nav','transfers']]});
 save();return report;
}

/* ---------- training ---------- */
const TRAIN={balanced:{n:'Balanced',d:'Even work across all areas.',a:null},attack:{n:'Attacking',d:'Finishing, passing, dribbling and movement.',a:['fin','pas','dri','fir','vis','cmp']},defend:{n:'Defending',d:'Tackling, marking, positioning and heading.',a:['tck','mar','pos','hea','dec']},
 fitness:{n:'Fitness',d:'Faster recovery between matches and slower decline for veterans.',a:['sta','pac','acc','str','agi']},tactical:{n:'Tactical',d:'Decisions, positioning, work rate and vision.',a:['dec','pos','wor','vis']},youth:{n:'Youth development',d:'Young players develop 50% faster.',a:null}};
function trainBump(p){const f=(p.tf&&typeof IND_FOCUS!=='undefined'&&IND_FOCUS[p.tf]&&IND_FOCUS[p.tf][1])||TRAIN[S.train.focus].a;if(!f){bump(p,1);return}
 for(let k=0;k<3;k++){const a=G.pick(f),i=AIX[a];p.at[i]=Math.min(99,p.at[i]+2)}p.ovr=calcOvr(p.pos,p.at);if(p.pot<p.ovr)p.pot=p.ovr;p.val=valueOf(p)}
/* ---------- manager career ---------- */
function jobOffers(n,minRep,maxRep){return shuffled(S.clubs.filter(c=>c.id!==S.user&&c.rep>=minRep&&c.rep<=maxRep)).slice(0,n)}
function takeJob(cid,reason){const old=S.user;S.mgr.clubs.push({club:old,season:seasonLabel(),reason});S.user=cid;S.board=60;S.sacked=false;S.fin=newFin();S.shortlist=[];S.bids=[];
 const c=clubOf(cid);ensureLineup(cid);mail('Board of Directors',`Welcome to ${c.name}`,`<p>We are delighted to appoint you. Your objective: <b>${expectation(cid)}</b>. Transfer budget: <b>${money(c.budget)}</b>.</p>`,null,'board',{att:{t:'stadium',cid},links:[['Club overview','nav','club']]});
 news(`${c.name} have appointed a new manager.`,'club',[cid],{title:`${c.short} name new manager`});save()}
function youthIntake(cid,n,fac){const c=clubOf(cid),co=COUNTRIES.find(x=>x.code===c.nation),rng=R((Math.random()*2e9)|0),out=[];
 for(let k=0;k<n;k++){const pos=rng.pick(['GK','CB','CB','LB','RB','DM','CM','CM','AM','LW','RW','ST','ST']),roll=rng.f(),pot=clamp(Math.round(repToOvr(c.rep)+(roll<.08?rng.i(12,20):roll<.35?rng.i(4,11):rng.i(-8,3))+((fac||2)-2)*2),45,(roll<.015?95:89)+Math.max(0,(fac||2)-3));
  const y=genPlayer(rng,pos,clamp(pot-rng.i(16,26),35,70),cid,rng.chance(.75)?co.code:rng.pick(NAT_BAG),{age:rng.i(16,17),pot});y.con=3;y.wage=Math.max(500,Math.round(y.wage*.5/100)*100);y.id=S.npid++;S.players[y.id]=y;c.squad.push(y.id);y.num=assignNum(cid,pos);y.youth=S.season;out.push(y)}
 return out}
