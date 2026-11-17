/* ================= cup competitions =================
   A season is a calendar of events: 38 league matchdays with cup rounds played in midweek between them.
   Every country has a 32-team knockout cup; the best 16 clubs on the continent play the Continental Elite Cup
   (four groups of four, then quarter-finals, semi-finals and a final). Single-leg ties go to penalties. */
const CUP_NAMES={ENG:'Royal Cup',ESP:'Copa del Sol',GER:'Goldpokal',ITA:'Coppa Aurea',FRA:'Coupe Étoile',NED:'Kroonbeker'};
const DOM_AFTER=[5,11,17,26,33],DOM_ROUNDS=['Round of 32','Round of 16','Quarter-finals','Semi-finals','Final'];
const CONT_AFTER=[3,6,9,12,15,18,24,29,36],CONT_ROUNDS=['Group matchday 1','Group matchday 2','Group matchday 3','Group matchday 4','Group matchday 5','Group matchday 6','Quarter-finals','Semi-finals','Final'];
const CONT_NAME='Continental Elite Cup';
const CONT_SLOTS={ENG:3,ESP:3,GER:3,ITA:3,FRA:2,NED:2};
const GROUP_RR=[[[0,1],[2,3]],[[2,0],[3,1]],[[0,3],[1,2]],[[1,0],[3,2]],[[0,2],[1,3]],[[3,0],[2,1]]];

function contQualifiers(useTables){
 const out=[];
 for(const co of COUNTRIES){const top=S.leagues.find(l=>l.nation===co.code&&l.tier===0);
  const order=useTables&&S.results[top.id].length?table(top.id).map(r=>r.id):top.clubs.slice().sort((a,b)=>clubOf(b).rep-clubOf(a).rep);
  out.push(...order.slice(0,CONT_SLOTS[co.code]))}
 return out;
}
function initCups(contTeams){
 const cups={};
 for(const co of COUNTRIES){
  const [top,bot]=S.leagues.filter(l=>l.nation===co.code).sort((a,b)=>a.tier-b.tier);
  const teams=top.clubs.concat(bot.clubs.slice().sort((a,b)=>clubOf(b).rep-clubOf(a).rep).slice(0,12));
  cups['dom-'+co.code]={key:'dom-'+co.code,name:CUP_NAMES[co.code],nation:co.code,kind:'ko',teams,after:DOM_AFTER,names:DOM_ROUNDS,rounds:DOM_ROUNDS.map(()=>null),winner:null};
 }
 const ct=(contTeams||contQualifiers(false)).slice(0,16);
 // seed into four pots by reputation, one club per pot in each group, avoiding same-country clashes where possible
 const pots=[0,1,2,3].map(k=>ct.slice().sort((a,b)=>clubOf(b).rep-clubOf(a).rep).slice(k*4,k*4+4)),groups=[[],[],[],[]];
 for(const pot of pots){const left=shuffled(pot);for(const g of groups){let i=left.findIndex(id=>!g.some(x=>clubOf(x).nation===clubOf(id).nation));if(i<0)i=0;g.push(left.splice(i,1)[0])}}
 cups.cont={key:'cont',name:CONT_NAME,kind:'gko',teams:ct,after:CONT_AFTER,names:CONT_ROUNDS,groups:groups.map(ids=>({ids,res:[]})),rounds:CONT_ROUNDS.map(()=>null),winner:null};
 S.cups=cups;buildCalendar();
}
function buildCalendar(){
 const cal=[];
 for(let md=0;md<MDAYS;md++){cal.push({t:'lg',md});
  if(S.cups)for(const k of Object.keys(S.cups)){const c=S.cups[k],r=c.after.indexOf(md);if(r>=0)cal.push({t:'cup',key:k,r,after:md})}}
 S.cal=cal;S.ci=cal.findIndex(e=>e.t==='lg'&&e.md===S.md);if(S.ci<0)S.ci=cal.length;
}
// Older saves (before cups) get a league-only calendar; cups start with their next season.
function ensureCalendar(){if(!S.cal){S.cups=S.cups||null;buildCalendar()}}
const curEvent=()=>S.cal&&S.cal[S.ci];
const evDate=ev=>ev.t==='lg'?mdDate(ev.md):mdDate(ev.after)+3*DAY;
const isGroupRound=(c,r)=>c.kind==='gko'&&r<6;
const isFinal=(c,r)=>r===c.names.length-1;
const tieWinner=t=>t.hg>t.ag?t.h:t.ag>t.hg?t.a:t.pens?(t.pens[0]>t.pens[1]?t.h:t.a):null;

/* ---- draws ---- */
function drawRound(c,r){
 if(c.rounds[r])return c.rounds[r];
 let ties=[];
 if(isGroupRound(c,r)){c.groups.forEach((g,gi)=>GROUP_RR[r].forEach(([x,y])=>ties.push({h:g.ids[x],a:g.ids[y],g:gi})))}
 else if(c.kind==='gko'&&r===6){const st=c.groups.map(g=>groupTable(g));ties=[[0,1],[1,0],[2,3],[3,2]].map(([a,b])=>({h:st[a][0].id,a:st[b][1].id}))}
 else{const prev=r===0?c.teams.slice():c.rounds[r-1].map(tieWinner);const pool=shuffled(prev);for(let i=0;i+1<pool.length;i+=2)ties.push({h:pool[i],a:pool[i+1]})}
 if(isFinal(c,r))ties.forEach(t=>t.neutral=true);
 c.rounds[r]=ties;return ties;
}
function groupTable(g){
 const T={};g.ids.forEach(id=>T[id]={id,p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0});
 for(const r of g.res){const H=T[r.h],A=T[r.a];H.p++;A.p++;H.gf+=r.hg;H.ga+=r.ag;A.gf+=r.ag;A.ga+=r.hg;if(r.hg>r.ag){H.w++;A.l++;H.pts+=3}else if(r.hg<r.ag){A.w++;H.l++;A.pts+=3}else{H.d++;A.d++;H.pts++;A.pts++}}
 return Object.values(T).sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||clubOf(b.id).rep-clubOf(a.id).rep);
}

/* ---- the user's ties ---- */
function tieLabel(c,r){return`${c.name} · ${c.names[r]}`}
function userTieAt(ev,draw){
 if(!ev)return null;
 if(ev.t==='lg'){const lid=clubOf(S.user).league,f=S.fixtures[lid][ev.md].find(m=>m.includes(S.user));return f?{h:f[0],a:f[1],comp:'lg',lid,label:`${S.leagues[lid].name} · Matchday ${ev.md+1}`,short:`MD ${ev.md+1}/${MDAYS}`,date:evDate(ev)}:null}
 const c=S.cups&&S.cups[ev.key];if(!c)return null;
 if(!c.rounds[ev.r]&&!draw)return userAlive(c,ev.r)?{pending:true,comp:ev.key,r:ev.r,label:tieLabel(c,ev.r),short:c.names[ev.r],date:evDate(ev)}:null;
 const t=drawRound(c,ev.r).find(x=>x.h===S.user||x.a===S.user);
 return t&&t.hg==null?{h:t.h,a:t.a,comp:ev.key,r:ev.r,ko:!isGroupRound(c,ev.r),neutral:!!t.neutral,label:tieLabel(c,ev.r),short:c.names[ev.r],date:evDate(ev),tie:t}:null;
}
function userAlive(c,r){
 if(!c.teams.includes(S.user))return false;
 if(c.kind==='gko'&&r<6)return true;
 const last=r-1;if(last<0)return true;
 if(c.kind==='gko'&&last===5){if(!c.rounds[5]||c.rounds[5].some(t=>t.hg==null))return true;const g=c.groups.find(g=>g.ids.includes(S.user));return groupTable(g).slice(0,2).some(x=>x.id===S.user)}
 const pr=c.rounds[last];if(!pr)return true;const t=pr.find(x=>x.h===S.user||x.a===S.user);return!!t&&(t.hg==null||tieWinner(t)===S.user);
}
const curTie=()=>userTieAt(curEvent(),true);
function nextUserTie(){if(!S.cal)return null;for(let i=S.ci;i<S.cal.length;i++){const t=userTieAt(S.cal[i],i===S.ci);if(t)return t}return null}

/* ---- penalties ---- */
function shootout(h,a,getTakers){
 const tk=[getTakers(h),getTakers(a)],gk=[keeperOf(h),keeperOf(a)],sc=[0,0],kicks=[];
 const kick=(s,n)=>{const p=tk[s][n%tk[s].length],k=gk[1-s],pr=clamp(.76+(p.at[AIX.fin]-60)*.004+(p.at[AIX.cmp]-60)*.003-(k?(k.at[AIX.ref]-60)*.003:0),.55,.92),ok=G.f()<pr;if(ok)sc[s]++;kicks.push({s,pid:p.id,ok})};
 const taken=[0,0];
 for(let n=0;n<5;n++){for(const s of[0,1]){kick(s,n);taken[s]++;if(sc[0]+5-taken[0]<sc[1]||sc[1]+5-taken[1]<sc[0])return{pens:sc,kicks}}}
 for(let n=5;n<30&&sc[0]===sc[1];n++){kick(0,n);kick(1,n)}
 return{pens:sc,kicks};
}
function keeperOf(cid){const c=clubOf(cid),i=(FORMATIONS[c.tac.form]||[]).findIndex(s=>s[0]==='GK'),id=c.tac.xi[i>=0?i:0];return S.players[id]||squadOf(cid).find(p=>p.pos==='GK')}
const takersOf=cid=>{const c=clubOf(cid);return(c.tac.xi.length?c.tac.xi.map(id=>S.players[id]).filter(Boolean):squadOf(cid)).filter(p=>p.pos!=='GK').sort((a,b)=>(b.at[AIX.fin]+b.at[AIX.cmp])-(a.at[AIX.fin]+a.at[AIX.cmp]))};

/* ---- processing a cup round ---- */
function cupPrize(c,r,won){const base=c.key==='cont'?[1.6e6,1.6e6,1.6e6,1.6e6,1.6e6,1.6e6,6e6,9e6,16e6]:[.15e6,.3e6,.6e6,1.2e6,3e6];return Math.round((base[r]||0)*(won?1:.5))}
function processCupEvent(userRes,userPens){
 const ev=curEvent(),c=S.cups[ev.key],ties=drawRound(c,ev.r),grp=isGroupRound(c,ev.r);
 for(const t of ties){
  if(t.hg!=null)continue;
  if(userRes&&t.h===userRes.h&&t.a===userRes.a){t.hg=userRes.hg;t.ag=userRes.ag;t.user=true;if(userPens)t.pens=userPens}
  else{const r=quickSim(t.h,t.a,S.md,null);t.hg=r.hg;t.ag=r.ag}
  if(!grp&&t.hg===t.ag&&!t.pens)t.pens=shootout(t.h,t.a,takersOf).pens;
  if(grp)c.groups[t.g].res.push({h:t.h,a:t.a,hg:t.hg,ag:t.ag});
 }
 for(const p of Object.values(S.players)){p.cond=Math.min(100,p.cond+16);if(p.inj){p.inj--;if(p.inj<=0)delete p.inj}}
 // the user's tie: money, morale, board, manager record
 const ut=ties.find(t=>t.h===S.user||t.a===S.user),uc=clubOf(S.user);
 if(ut){const home=ut.h===S.user,gf=home?ut.hg:ut.ag,ga=home?ut.ag:ut.hg,won=grp?gf>ga:tieWinner(ut)===S.user;
  if(home&&!ut.neutral){const g=Math.round(uc.cap*.8*38);uc.balance+=g;S.fin.gate+=g}
  const pz=cupPrize(c,ev.r,won);uc.balance+=pz;S.fin.prize=(S.fin.prize||0)+pz;
  for(const p of squadOf(S.user))p.mor=clamp(p.mor+(won?5:gf<ga?-4:0),25,98);
  S.board=clamp(S.board+(won?1.5:-1),5,100);S.mgr[gf>ga?'w':gf<ga?'l':'d']++;
  if(!grp&&!won)news(`${uc.name} are out of the ${c.name}, beaten ${Math.max(gf,ga)}–${Math.min(gf,ga)}${ut.pens?` on penalties (${Math.max(...ut.pens)}–${Math.min(...ut.pens)})`:''} by ${clubOf(home?ut.a:ut.h).name}.`,'cup',[S.user],{title:`${uc.short} knocked out of the ${c.name}`})}
 // headline the round
 {const big=ties.slice().sort((x,y)=>Math.abs(clubOf(y.h).rep-clubOf(y.a).rep)*(tieWinner(y)===(clubOf(y.h).rep<clubOf(y.a).rep?y.h:y.a)?1:0)-Math.abs(clubOf(x.h).rep-clubOf(x.a).rep)*(tieWinner(x)===(clubOf(x.h).rep<clubOf(x.a).rep?x.h:x.a)?1:0))[0];
  if(big&&!isFinal(c,ev.r)){const w=tieWinner(big)||big.h,l=w===big.h?big.a:big.h;if(clubOf(w).rep<clubOf(l).rep-6)news(`${clubOf(w).name} stun ${clubOf(l).name} ${Math.max(big.hg,big.ag)}–${Math.min(big.hg,big.ag)}${big.pens?' on penalties':''} in the ${c.name} ${c.names[ev.r].toLowerCase()}.`,'cup',[w,l],{title:`Cup shock: ${clubOf(w).short} knock out ${clubOf(l).short}`})}}
 if(isFinal(c,ev.r)){const t=ties[0],w=tieWinner(t),ru=w===t.h?t.a:t.h;c.winner=w;
  (S.cupHist=S.cupHist||{})[c.key]=(S.cupHist[c.key]||[]);S.cupHist[c.key].unshift({season:seasonLabel(),w,ru,hg:t.hg,ag:t.ag,pens:t.pens||null,h:t.h});
  clubOf(w).rep=clamp(clubOf(w).rep+(c.key==='cont'?3:1),30,97);
  news(`${clubOf(w).name} win the ${c.name}, beating ${clubOf(ru).name} ${Math.max(t.hg,t.ag)}–${Math.min(t.hg,t.ag)}${t.pens?` on penalties`:''} in the final.`,'cup',[w,ru],{title:`${clubOf(w).short} lift the ${c.name}`});
  if(w===S.user){S.mgr.trophies.push({t:c.name,season:seasonLabel(),club:S.user});S.pendingTrophy={t:c.name,club:S.user}}}
 S.ci++;
}
// Play every event the user is not part of (cup rounds after elimination, rounds they never entered).
function advanceToUser(){ensureCalendar();let n=0;while(S.ci<S.cal.length&&!curTie()&&n++<60){const ev=curEvent();if(ev.t==='lg')break;processCupEvent(null)}}

/* ---- the user's full schedule (league + cups), for home and fixtures lists ---- */
function userSchedule(){
 if(!S.cal)return[];
 const out=[],lid=clubOf(S.user).league;
 S.cal.forEach((ev,i)=>{
  if(ev.t==='lg'){const f=S.fixtures[lid][ev.md].find(m=>m.includes(S.user));if(!f)return;const r=S.results[lid].find(x=>x.md===ev.md&&x.h===f[0]&&x.a===f[1]);out.push({h:f[0],a:f[1],date:evDate(ev),comp:'lg',label:`MD ${ev.md+1}`,res:r||null,i})}
  else{const c=S.cups[ev.key],ties=c.rounds[ev.r];const t=ties&&ties.find(x=>x.h===S.user||x.a===S.user);
   if(t)out.push({h:t.h,a:t.a,date:evDate(ev),comp:ev.key,label:c.names[ev.r],res:t.hg!=null?t:null,i});
   else if(!ties&&i>=S.ci&&userAlive(c,ev.r))out.push({h:null,a:null,date:evDate(ev),comp:ev.key,label:c.names[ev.r],pending:true,i})}
 });
 return out;
}
