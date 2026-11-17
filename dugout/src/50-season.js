/* ================= career ================= */
let S=null;
const SEASON_START=Date.UTC(2027,7,7);
const mdDate=md=>SEASON_START+(S.season-1)*364*DAY+Math.round(md*11.2)*DAY;
const seasonLabel=()=>`${2026+S.season}/${String(2027+S.season).slice(2)}`;
const windowOpen=()=>S.md<=3||(S.md>=12&&S.md<=14);
const stars=v=>clamp(Math.round((v-38)/10*2)/2,.5,5);
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
 S={v:2,seed,season:1,md:0,user:-1,clubs:[],players:{},leagues:[],fixtures:{},results:{},inbox:[],news:[],nid:1,npid:1,shortlist:[],hist:[],bidLog:{}};
 const forms=Object.keys(FORMATIONS);
 COUNTRIES.forEach(co=>{
  const used=new Set();
  co.leagues.forEach((lname,tier)=>{
   const lid=S.leagues.length,lg={id:lid,name:lname,nation:co.code,tier,clubs:[]};S.leagues.push(lg);
   for(let i=0;i<PER;i++){
    const rep=Math.round(clamp((tier?66-i*1.35:90-i*2.1)*co.f+rng.n(0,1.5),35,95));
    const c=Object.assign({id:S.clubs.length,nation:co.code,league:lid,rep,hist:[]},makeClubIdentity(rng,co.lang,used));
    c.cap=Math.round((tier?9000:22000)+rep*rep*(tier?2.2:6)+rng.i(0,6000));
    c.tac=newTactic(rng.pick(forms));c.tac.ins.ment=2;c.tac.ins.press=rng.i(0,2);c.tac.ins.passing=rng.i(0,2);c.tac.ins.tempo=rng.i(0,2);c.tac.ins.line=rng.i(0,2);
    c.squad=[];S.clubs.push(c);lg.clubs.push(c.id);
    const base=repToOvr(rep),star=rng.i(3,TEMPLATE.length-1),youth=rng.i(3,TEMPLATE.length-1),seen={};
    TEMPLATE.forEach((pos,k)=>{
     const depth=seen[pos]=(seen[pos]||0)+1;let target=base+(depth===1?rng.i(-1,4):-rng.i(3,10)),age=depth===1?rng.i(22,31):rng.i(19,33),pot;
     if(k===star)target=base+rng.i(6,9);
     if(k===youth&&k!==star){age=rng.i(17,19);target=base-rng.i(10,15);pot=clamp(base+rng.i(2,14),target+8,95)}
     const nat=rng.chance(tier?.78:.6)?co.code:rng.pick(NAT_BAG);
     const p=genPlayer(rng,pos,clamp(target,32,93),c.id,nat,{age,pot});p.id=S.npid++;S.players[p.id]=p;c.squad.push(p.id);p.num=assignNum(c.id,pos);
    });
    const wages=c.squad.reduce((a,id)=>a+S.players[id].wage,0);
    c.wageBudget=Math.round(wages*1.12/1000)*1000;c.budget=budgetOf(rep);c.balance=c.budget*2;
   }
   S.fixtures[lid]=roundRobin(shuffled(lg.clubs,rng));S.results[lid]=[];
  });
 });
 return S;
}
function startCareer(cid){
 S.user=cid;const c=clubOf(cid);
 ensureLineup(cid);
 mail('Board of Directors',`Welcome to ${c.name}`,`<p>Welcome to ${esc(c.stadium)}. The board has made <b>${money(c.budget)}</b> available for transfers and a wage budget of <b>${money(c.wageBudget)}</b> per week.</p><p>Our objective this season: <b>${expectation(cid)}</b>.</p><p>The transfer window is open until matchday 4.</p>`,null,'board');
 const best=squadOf(cid).sort((a,b)=>b.ovr-a.ovr)[0];
 mail('Assistant Manager','Squad assessment',`<p>${esc(best.fn+' '+best.ln)} is our standout player. I have set us up in a ${c.tac.form}. Review the shape, roles and instructions on the Tactics screen before the opener.</p>`,null,'staff');
 news(`The board hopes the new appointment can deliver: ${expectation(cid).toLowerCase()}.`,'club',[cid],{title:`${c.short} name new manager`});
 save();
}
function expectation(cid){const c=clubOf(cid),lg=leagueOf(cid),rank=lg.clubs.map(clubOf).sort((a,b)=>b.rep-a.rep).findIndex(x=>x.id===cid)+1;
 if(lg.tier===1)return rank<=3?'Win promotion':rank<=7?'Challenge for promotion':'Avoid relegation';
 return rank<=2?'Win the title':rank<=5?'Finish in the top four':rank<=9?'Finish in the top half':'Avoid relegation'}
function mail(from,subj,body,action,kind){S.inbox.unshift({id:S.nid++,from,subj,body,md:S.md,season:S.season,read:false,action:action||null,kind:kind||'info'});if(S.inbox.length>60)S.inbox.length=60}
function news(text,kind,clubs,extra){S.news.unshift(Object.assign({id:S.nid++,md:S.md,season:S.season,text,kind,clubs:clubs||[]},extra||{}));if(S.news.length>90)S.news.length=90}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));return true}catch(e){return false}}
function loadSave(){try{const t=localStorage.getItem(KEY);if(!t)return null;const s=JSON.parse(t);return s&&s.v===2&&s.user>=0?s:null}catch(e){return null}}
function table(lid){
 const lg=S.leagues[lid],T={};lg.clubs.forEach(id=>T[id]={id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0,form:[]});
 for(const r of S.results[lid]){const h=T[r.h],a=T[r.a];if(!h||!a)continue;h.p++;a.p++;h.gf+=r.hg;h.ga+=r.ag;a.gf+=r.ag;a.ga+=r.hg;
  if(r.hg>r.ag){h.w++;a.l++;h.pts+=3;h.form.push('W');a.form.push('L')}else if(r.hg<r.ag){a.w++;h.l++;a.pts+=3;a.form.push('W');h.form.push('L')}else{h.d++;a.d++;h.pts++;a.pts++;h.form.push('D');a.form.push('D')}}
 return Object.values(T).sort((x,y)=>y.pts-x.pts||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||clubOf(x.id).name.localeCompare(clubOf(y.id).name));
}
const posIn=(tb,id)=>tb.findIndex(r=>r.id===id)+1;
const userFixture=()=>S.md>=MDAYS?null:S.fixtures[S.clubs[S.user].league][S.md].find(m=>m.includes(S.user));
function fixturesOf(cid){const lid=clubOf(cid).league;return S.fixtures[lid].map((r,md)=>{const f=r.find(m=>m.includes(cid));const res=S.results[lid].find(x=>x.md===md&&x.h===f[0]&&x.a===f[1]);return{md,h:f[0],a:f[1],res}})}

/* ---------- AI team management ---------- */
function prepAI(cid,oppId){
 const c=clubOf(cid);if(cid===S.user)return;
 const opp=oppId!=null?clubOf(oppId):null;c.tac.xi=pickXI(cid,c.tac.form);c.tac.bench=pickBench(cid,c.tac.xi);
 if(opp){const d=c.rep-opp.rep;c.tac.ins.ment=d>8?3:d<-10?1:2}
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
  for(let k=0;k<n;k++){const sc=pickW(xi,id=>{const p=S.players[id],pos=slots[c.tac.xi.indexOf(id)][0];return(ATT_W[pos]||.04)*Math.pow(p.at[AIX.fin]/60,2)});S.players[sc].s.g++;r[sc]+=1;
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
 for(const sp of all){const p=S.players[sp.pid];if(!p)continue;if(sp.st.mins>0){p.s.ap++;p.cond=Math.round(clamp(sp.en*100,20,100))}
  if(sp.rating!=null){p.s.rs+=sp.rating;if(!best||sp.rating>best.rating)best=sp}}
 for(const e of E.events){if(e.type==='goal'){S.players[e.pid].s.g++;if(e.astPid!=null&&S.players[e.astPid])S.players[e.astPid].s.a++}
  if(e.type==='red'&&e.pid!=null){const p=S.players[e.pid];if(p)p.ban=2}}
 if(best)S.players[best.pid].s.mom++;
 return res;
}
function processMatchday(userRes){
 const md=S.md;
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
  if(p.age<=23&&p.ovr<p.pot&&G.f()<.055)bump(p,1);
  else if(p.age>=31&&G.f()<.03)bump(p,-1);
 }
 const uc=clubOf(S.user),mine=S.results[uc.league].find(r=>r.md===md&&(r.h===S.user||r.a===S.user));
 if(mine){const home=mine.h===S.user,gf=home?mine.hg:mine.ag,ga=home?mine.ag:mine.hg,d=gf>ga?6:gf<ga?-6:0;
  for(const p of squadOf(S.user))p.mor=clamp(p.mor+d+G.i(-2,2),25,98);
  if(home)uc.balance+=Math.round(uc.cap*.85*32);}
 uc.balance-=Math.round(squadOf(S.user).reduce((a,p)=>a+p.wage,0)*1.6);
 headlines(md);
 if(windowOpen())aiTransfers();
 if(windowOpen()&&G.f()<.2)incomingOffer();
 S.md++;
 if(S.md===12)mail('Director of Football','January window opens',`<p>The winter transfer window is open until matchday 15.</p>`,null,'transfer');
 if(S.md===4)mail('Director of Football','Transfer window closed',`<p>The summer window has closed. It reopens at matchday 13.</p>`,null,'transfer');
 if(S.md>=MDAYS)mail('Board of Directors','The season is over',`<p>Open the season review from the Continue button to see the final standings, promotions and relegations.</p>`,null,'board');
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
function aiTransfers(){
 for(let k=0;k<7;k++){
  const c=G.pick(S.clubs);if(c.id===S.user||c.squad.length>=29)continue;
  const w=weakestSlot(c.id);if(!w)continue;
  let best=null;
  for(const p of Object.values(S.players)){if(p.club===c.id||p.club===S.user)continue;const pc=clubOf(p.club);if(pc.rep>c.rep-3||pc.squad.length<=19)continue;
   const v=rateAt(p,w.pos);if(v<w.v+3||p.val>c.budget*.6||p.age>31)continue;if(!best||v-p.val/2e7>best.s)best={p,s:v-p.val/2e7}}
  if(!best||G.f()<.4)continue;
  const p=best.p,fee=Math.round(p.val*(1+G.f()*.3)/5e4)*5e4,from=p.club;
  moveP(p.id,c.id,fee);
  if(c.squad.length>28){const worst=squadOf(c.id).filter(x=>x.id!==p.id).sort((a,b)=>a.ovr-b.ovr)[0];moveP(worst.id,from,0)}
  news(`${p.fn} ${p.ln} (${p.pos}, ${p.age}) completes his move from ${clubOf(from).name}. The fee is ${money(fee)}.`,'transfer',[c.id,from],{title:`${c.short} sign ${p.ln}`});
 }
}
function incomingOffer(){
 const cand=squadOf(S.user).filter(p=>p.ovr>=55);if(!cand.length)return;
 const p=pickW(cand,x=>Math.pow(Math.max(1,x.ovr-50),2)),uc=clubOf(S.user);
 const pool=S.clubs.filter(c=>c.id!==S.user&&c.rep>=uc.rep-6&&c.budget>p.val);if(!pool.length)return;
 const club=G.pick(pool),fee=Math.round(p.val*(1+G.f()*.35)/5e4)*5e4;
 mail(club.name,`Offer for ${p.ln}`,`<p>${esc(club.name)} have bid <b>${money(fee)}</b> for ${esc(p.fn+' '+p.ln)} (${p.pos}, age ${p.age}). We value him at ${money(p.val)}.</p>`,{type:'offer',pid:p.id,club:club.id,fee},'transfer');
}
function wageBill(cid){return squadOf(cid).reduce((a,p)=>a+p.wage,0)}
function wageDemand(p){const uc=clubOf(S.user),pc=clubOf(p.club);return Math.round(p.wage*(1.12+Math.max(0,(pc.rep-uc.rep)/80))/100)*100}
function bidVerdict(pid,fee){
 const p=S.players[pid],sel=clubOf(p.club),uc=clubOf(S.user),key=S.season+':'+S.md+':'+pid;
 if(!windowOpen())return{ok:false,msg:'The transfer window is closed. It reopens at matchday 13.'};
 if(fee>uc.budget)return{ok:false,msg:`That is more than your transfer budget of ${money(uc.budget)}.`};
 if(uc.squad.length>=32)return{ok:false,msg:'Your squad is full (32 players). Sell someone first.'};
 const wd=wageDemand(p);if(wageBill(S.user)+wd>uc.wageBudget)return{ok:false,msg:`He wants ${money(wd)} a week, which would take you over your wage budget of ${money(uc.wageBudget)}.`};
 if(sel.rep-uc.rep>14&&p.ovr>repToOvr(uc.rep)+6)return{ok:false,msg:`${p.ln} is not interested in joining a club of your stature.`};
 S.bidLog[key]=(S.bidLog[key]||0)+1;if(S.bidLog[key]>2)return{ok:false,msg:`${sel.short} have ended talks until the next matchday.`};
 const keyP=squadOf(sel.id).sort((a,b)=>b.ovr-a.ovr).slice(0,3).some(x=>x.id===pid);
 let pa=sig((fee/p.val-1.08)*9);if(keyP)pa*=.7;if(sel.squad.length<=20)pa*=.5;
 if(G.f()<pa)return{ok:true,wage:wd};
 const want=Math.round(p.val*(keyP?1.35:1.15)/1e5)*1e5;
 return{ok:false,msg:`${sel.short} rejected the bid. They want closer to ${money(want)}.`};
}
function canSell(p){const sq=squadOf(S.user);if(sq.length<=18)return'You need at least 18 players.';if(p.pos==='GK'&&sq.filter(x=>x.pos==='GK').length<=2)return'You need at least two goalkeepers.';return''}

/* ---------- season end ---------- */
function endSeason(){
 const report=[],uc0=clubOf(S.user),uLeague=S.leagues[uc0.league].name,uPos=posIn(table(uc0.league),S.user);
 COUNTRIES.forEach(co=>{
  const [top,bot]=S.leagues.filter(l=>l.nation===co.code).sort((a,b)=>a.tier-b.tier);
  const t1=table(top.id),t2=table(bot.id);
  const down=t1.slice(-2).map(r=>r.id),up=t2.slice(0,2).map(r=>r.id);
  report.push({league:top.name,champ:t1[0].id,down,up,lower:bot.name,champ2:t2[0].id});
  clubOf(t1[0].id).rep=clamp(clubOf(t1[0].id).rep+2,30,96);
  for(const id of down){clubOf(id).rep=clamp(clubOf(id).rep-3,30,96);clubOf(id).league=bot.id}
  for(const id of up){clubOf(id).rep=clamp(clubOf(id).rep+3,30,96);clubOf(id).league=top.id}
  top.clubs=top.clubs.filter(x=>!down.includes(x)).concat(up);bot.clubs=bot.clubs.filter(x=>!up.includes(x)).concat(down);
 });
 S.hist.unshift({season:seasonLabel(),league:uLeague,pos:uPos});
 for(const c of S.clubs){c.budget=Math.max(c.budget,0)+budgetOf(c.rep)*.8;c.budget=Math.round(c.budget/1e5)*1e5;c.wageBudget=Math.round(Math.max(c.wageBudget,wageBill(c.id)*1.08)/1000)*1000}
 for(const p of Object.values(S.players)){
  p.age++;if(p.age<=23&&p.ovr<p.pot)bump(p,Math.min(p.pot-p.ovr,G.i(1,5)));else if(p.age>=31)bump(p,-G.i(0,3));
  p.s={ap:0,g:0,a:0,rs:0,mom:0};p.cond=100;p.con--;if(p.con<=0){p.con=G.i(1,4);if(p.club!==S.user)p.wage=wageOf(p)}
  p.val=valueOf(p);delete p.inj;delete p.ban;
 }
 for(const p of Object.values(S.players)){
  if(p.age>=35&&G.f()<.6&&p.club!==S.user||p.age>=37){
   const c=clubOf(p.club),rng=R((Math.random()*2e9)|0),co=COUNTRIES.find(x=>x.code===c.nation);
   const y=genPlayer(rng,p.pos,repToOvr(c.rep)-rng.i(10,16),c.id,rng.chance(.7)?co.code:rng.pick(NAT_BAG),{age:rng.i(16,18),pot:clamp(repToOvr(c.rep)+rng.i(-2,12),55,95)});
   y.id=S.npid++;S.players[y.id]=y;c.squad=c.squad.filter(x=>x!==p.id).concat(y.id);y.num=p.num;delete S.players[p.id];
   if(c.id===S.user)mail('Head of Youth',`${p.ln} retires`,`<p>${esc(p.fn+' '+p.ln)} has retired. ${esc(y.fn+' '+y.ln)} (${y.pos}, 17) has been promoted from the academy.</p>`,null,'staff');
  }
 }
 S.season++;S.md=0;S.bidLog={};
 for(const lg of S.leagues){S.fixtures[lg.id]=roundRobin(shuffled(lg.clubs));S.results[lg.id]=[]}
 S.clubs.forEach(c=>{c.tac.xi=c.tac.xi||[];if(c.id!==S.user)c.tac.xi=[]});ensureLineup(S.user);
 mail('Board of Directors',`Season ${seasonLabel()} begins`,`<p>You are in the ${esc(S.leagues[clubOf(S.user).league].name)}. The board's objective: <b>${expectation(S.user)}</b>. Transfer budget: <b>${money(clubOf(S.user).budget)}</b>.</p>`,null,'board');
 save();return report;
}
