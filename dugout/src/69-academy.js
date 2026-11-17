/* ================= scouting, youth academy, development and loans ================= */
ui.sc={region:'all',pos:'all',age:23};

/* ---------- knowledge: how well the club knows a player ---------- */
function know(p){
 if(!p||p.club===S.user||(S.acad||[]).includes(p.id))return 100;
 const c=clubOf(p.club),uc=clubOf(S.user),base=c.league===uc.league?55:c.nation===uc.nation?35:15;
 return Math.min(100,base+((S.know||{})[p.id]||0));
}
function attrShown(p,a){
 const v=at20(p.at[AIX[a]]),k=know(p);if(k>=95)return{v,t:String(v)};
 const sp=Math.max(1,Math.round((100-k)/24)),off=((p.id*7+AIX[a]*13)%3)-1,lo=clamp(v-sp+off,1,20),hi=clamp(v+sp+off,1,20);
 return{v:(lo+hi)/2,t:lo===hi?String(lo):`${lo}–${hi}`,unc:true};
}
function potShown(p){const k=know(p);if(k>=80)return starHTML(stars(p.pot));const s=stars(p.pot),sp=k<40?1:.5;return`<span class="unc-stars">${Math.max(.5,s-sp)}–${Math.min(5,s+sp)}<i>★</i></span>`}

/* ---------- scouting ---------- */
function gradeOf(p){
 const uc=S.user,peers=squadOf(uc).filter(q=>GROUP[q.pos]===GROUP[p.pos]).sort((a,b)=>b.ovr-a.ovr),bar=(peers[1]||peers[0]||{ovr:60}).ovr;
 if(p.ovr>=bar+2||p.age<=21&&p.pot>=bar+8)return'A';if(p.ovr>=bar-2||p.age<=23&&p.pot>=bar+3)return'B';if(p.ovr>=bar-7)return'C';return'D';
}
const GRADE_TXT={A:'Would improve the first team. Strongly recommended.',B:'Could compete for a starting place.',C:'Squad depth at best.',D:'Not good enough for us.'};
function addReport(pid){const p=S.players[pid];if(!p||p.club===S.user)return;S.reports=(S.reports||[]).filter(r=>r.pid!==pid);S.reports.unshift({pid,grade:gradeOf(p),md:S.md,season:S.season});if(S.reports.length>80)S.reports.length=80}
function scoutTick(){
 S.know=S.know||{};const fresh=[];
 for(const pid of S.scoutQ||[]){S.know[pid]=100;addReport(pid);fresh.push(pid)}S.scoutQ=[];
 const a=S.scout;
 if(a){const pool=Object.values(S.players).filter(p=>p.club!==S.user&&p.club>=0&&(a.region==='all'||clubOf(p.club).nation===a.region)&&(a.pos==='all'||GROUP[p.pos]===a.pos)&&p.age<=a.age&&know(p)<90);
  for(const p of shuffled(pool).sort((x,y)=>y.pot-x.pot).slice(0,30).sort(()=>G.f()-.5).slice(0,7)){S.know[p.id]=(S.know[p.id]||0)+38;if(know(p)>=70&&gradeOf(p)<='B'){addReport(p.id);fresh.push(p.id)}}}
 if(fresh.length){const ps=fresh.map(id=>S.players[id]).filter(Boolean).sort((x,y)=>gradeOf(x).localeCompare(gradeOf(y)));
  mail('Chief Scout',`Scouting update: ${fresh.length} new report${fresh.length>1?'s':''}`,`<p>${ps.slice(0,4).map(p=>`<b>${esc(p.fn+' '+p.ln)}</b> (${p.pos}, ${p.age}, ${esc(clubOf(p.club).short)}): grade ${gradeOf(p)}. ${GRADE_TXT[gradeOf(p)]}`).join('<br>')}</p>`,null,'transfer',{att:{t:'players',pids:ps.slice(0,2).map(p=>p.id)},links:[['Scouting centre','goto','transfers/scouting']]})}
}
function viewScouting(){
 const a=S.scout,regions=[['all','All countries'],...COUNTRIES.map(c=>[c.code,NATIONS[c.code].n])];
 const reps=(S.reports||[]).map(r=>({r,p:S.players[r.pid]})).filter(x=>x.p&&x.p.club!==S.user);
 const known=Object.keys(S.know||{}).length;
 return`<div class="grid"><section class="panel c5"><div class="ph"><h3>Scouting assignment</h3>${a?'<span class="chip ok">Active</span>':'<span class="chip">Idle</span>'}</div><div class="pb">
 <p class="muted" style="margin:0 0 12px;font-size:13px">Your scouts watch players matching the brief every matchday. The better you know a player, the more precise his attributes and potential become.</p>
 <div class="neg-f"><label>Region</label><select data-input="sc-region">${regions.map(([k,l])=>`<option value="${k}" ${ui.sc.region===k?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
 <div class="neg-f"><label>Position</label><div class="seg" role="group">${['all','GK','DEF','MID','ATT'].map(g=>`<button data-act="sc-pos" data-v="${g}" aria-pressed="${ui.sc.pos===g}">${g==='all'?'Any':g}</button>`).join('')}</div></div>
 <div class="neg-f"><label>Maximum age</label>${stepper('sc','age',ui.sc.age,{min:17,max:35,label:'Maximum age',fmt:v=>v+' yrs',chips:[['U19',19],['U21',21],['U23',23],['Any',35]]})}</div>
 <div class="toolbar" style="margin:0"><button class="btn pri" data-act="sc-start">${a?'Update assignment':'Send scouts'}</button>${a?'<button class="btn" data-act="sc-stop">Recall scouts</button>':''}</div>
 ${a?`<p class="muted" style="font-size:12px;margin:12px 0 0">Watching: ${a.region==='all'?'all countries':esc(NATIONS[a.region].n)} · ${a.pos==='all'?'any position':a.pos} · age ${a.age} and under</p>`:''}</div></section>
 <section class="panel c7"><div class="ph"><h3>Knowledge</h3></div><div class="pb rec-kpis"><div><small>Players scouted</small><b>${known}</b></div><div><small>Reports on file</small><b>${reps.length}</b></div><div><small>Grade A targets</small><b>${reps.filter(x=>x.r.grade==='A').length}</b></div></div>
 <div class="pb" style="padding-top:0"><p class="muted" style="font-size:13px;margin:0">Players in your league are partly known already. Elsewhere, attributes show as ranges until scouted. Use “Scout player” on any profile for a full report after the next match.</p></div></section>
 <section class="panel c12"><div class="ph"><h3>Scout reports</h3><small>${reps.length} on file</small></div>${reps.length?`<div class="tw"><table class="tbl"><thead><tr><th>Grade</th><th>Player</th><th>Club</th><th class="r">Age</th><th>Pos</th><th>Ability</th><th>Potential</th><th class="r">Value</th><th>Verdict</th></tr></thead><tbody>
 ${reps.map(({r,p})=>`<tr class="click" data-act="player" data-id="${p.id}"><td><span class="grade g${r.grade}">${r.grade}</span></td><td><b>${pName(p)}</b></td><td><div class="who">${crest(p.club,16)}${esc(clubOf(p.club).short)}</div></td><td class="r">${p.age}</td><td>${posChip(p.pos)}</td><td>${starHTML(stars(p.ovr))}</td><td>${potShown(p)}</td><td class="r">${money(p.val)}</td><td><small>${GRADE_TXT[r.grade]}</small></td></tr>`).join('')}</tbody></table></div>`:'<p class="pb muted">No reports yet. Send your scouts out or scout a player from his profile.</p>'}</section></div>`;
}

/* ---------- youth academy ---------- */
const ACAD_COST=[0,1.5e6,3e6,6e6,10e6];
const acadOf=()=>(S.acad||[]).map(id=>S.players[id]).filter(Boolean);
function ensureAcademy(){if(!S.academy)S.academy={fac:2,rec:2};if(!S.acad)S.acad=[]}
function viewAcademy(){
 ensureAcademy();const A=S.academy,ps=acadOf().sort((a,b)=>b.pot-a.pot),c=clubOf(S.user);
 const lvl=(k,t,d)=>{const v=A[k],cost=ACAD_COST[v]||0;return`<div class="acad-lvl"><div><b>${t}</b><small>${d}</small></div><div class="acad-bars">${[1,2,3,4,5].map(i=>`<i class="${i<=v?'on':''}"></i>`).join('')}</div>${v<5?`<button class="btn" data-act="acad-up" data-v="${k}" ${c.budget<cost?'disabled':''}>Upgrade · ${money(cost)}</button>`:'<span class="chip ok">Maximum</span>'}</div>`};
 return`<div class="grid"><section class="panel c12"><div class="ph"><h3>Academy</h3><small>Upgrades are paid from the transfer budget (${money(c.budget)})</small></div><div class="pb acad-top">
 ${lvl('fac','Youth facilities','Speeds up the development of every academy player.')}${lvl('rec','Youth recruitment','More and better prospects at each intake.')}</div></section>
 <section class="panel c12"><div class="ph"><h3>Academy players</h3><small>${ps.length} prospects · next intake at the end of the season</small></div>
 ${ps.length?`<div class="acad-grid">${ps.map(p=>`<div class="acad-card"><div class="acad-h">${posChip(p.pos)}<b>${esc(p.fn+' '+p.ln)}</b><small>${p.age} · ${flagSVG(p.nat)}</small></div>
 <div class="acad-r"><span><small>Now</small>${starHTML(stars(p.ovr))}</span><span><small>Potential</small>${starHTML(stars(p.pot))}</span></div>
 <div class="meter"><i style="width:${clamp((p.ovr-40)/(Math.max(p.pot,p.ovr+1)-40)*100,4,100)}%"></i></div><small class="muted">${personality(p)[0]}${p.ovr>(p.ovr0||p.ovr)?` · +${p.ovr-p.ovr0} this season`:''}</small>
 <div class="toolbar" style="margin:8px 0 0"><button class="btn" data-act="player" data-id="${p.id}">Profile</button><button class="btn pri" data-act="acad-promote" data-id="${p.id}">Promote</button><button class="btn ghost" data-act="acad-release" data-id="${p.id}">Release</button></div></div>`).join('')}</div>`:'<p class="pb muted">No prospects in the academy. The next intake arrives at the end of the season.</p>'}</section></div>`;
}

/* ---------- development centre ---------- */
function viewDevelopment(){
 ensureAcademy();const mine=squadOf(S.user).concat(acadOf()),loaned=Object.values(S.players).filter(p=>p.loan&&p.loan.from===S.user);
 const list=mine.concat(loaned).filter(p=>p.age<=23).sort((a,b)=>(b.pot-b.ovr)-(a.pot-a.ovr));
 const status=p=>p.loan?`<span class="chip">On loan · ${esc(clubOf(p.club).short)}</span>`:(S.acad||[]).includes(p.id)?'<span class="chip">Academy</span>':'<span class="chip ok">First team</span>';
 return`<div class="panel"><div class="ph"><h3>Young players</h3><small>Under-24s at the club, on loan or in the academy</small></div>${list.length?`<div class="tw"><table class="tbl"><thead><tr><th>Player</th><th class="r">Age</th><th>Pos</th><th>Status</th><th>Now</th><th>Potential</th><th style="min-width:140px">Progress</th><th class="r">This season</th><th class="r">Apps</th><th>Training</th><th></th></tr></thead><tbody>
 ${list.map(p=>{const dv=p.ovr-(p.ovr0||p.ovr);return`<tr><td><button class="link" data-act="player" data-id="${p.id}"><b>${pName(p)}</b></button></td><td class="r">${p.age}</td><td>${posChip(p.pos)}</td><td>${status(p)}</td><td>${starHTML(stars(p.ovr))}</td><td>${starHTML(stars(p.pot))}</td>
 <td><div class="meter" style="margin:0"><i style="width:${clamp((p.ovr-40)/(Math.max(p.pot,p.ovr+1)-40)*100,4,100)}%"></i></div></td><td class="r ${dv>0?'v5':''}">${dv>0?'+'+dv:dv||'–'}</td><td class="r">${p.s.ap}</td><td><small>${IND_FOCUS[p.tf||'none'][0]}</small></td>
 <td>${p.loan?'':`<button class="btn" data-act="loan-out" data-id="${p.id}">Loan out</button>`}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="pb muted">No young players at the club.</p>'}</div>`;
}

/* ---------- loans ---------- */
function loanOut(pid){
 const p=S.players[pid],uc=clubOf(S.user),wasAcad=(S.acad||[]).includes(pid);
 if(!wasAcad&&squadOf(S.user).length<=18){toast('You need at least 18 players in the squad.');return}
 const to=S.clubs.filter(c=>c.id!==S.user&&c.rep<uc.rep-4&&c.rep>uc.rep-30&&c.squad.length<28).sort((a,b)=>Math.abs(repToOvr(a.rep)-p.ovr-4)-Math.abs(repToOvr(b.rep)-p.ovr-4))[G.i(0,2)];
 if(!to){toast('No club wants him on loan right now.');return}
 if(wasAcad){S.acad=S.acad.filter(x=>x!==pid);uc.squad.push(pid)}
 moveP(pid,to.id,0);p.loan={from:S.user,season:S.season};
 news(`${p.fn} ${p.ln} joins ${to.name} on a season-long loan from ${uc.name}.`,'transfer',[to.id,S.user]);
 mail('Director of Football',`${p.ln} loaned to ${to.short}`,`<p>${esc(p.fn+' '+p.ln)} will spend the rest of the season at ${esc(to.name)} to get regular football. He returns in the summer.</p>`,null,'transfer',{att:{t:'player',pid:p.id,note:'On loan'}});
 save();render();toast(`${p.ln} loaned to ${to.short}`);
}
// Loans end and academy intakes arrive at the end of the season.
function returnLoans(){for(const p of Object.values(S.players))if(p.loan&&p.loan.from===S.user){const back=p.loan.from;delete p.loan;moveP(p.id,back,0);mail('Director of Football',`${p.ln} returns from loan`,`<p>${esc(p.fn+' '+p.ln)} is back after his loan spell: ${p.s.ap} appearances, ${p.s.g} goals.</p>`,null,'transfer',{att:{t:'player',pid:p.id}})}}
function academyIntake(){ensureAcademy();const c=clubOf(S.user),ps=youthIntake(S.user,2+S.academy.rec+G.i(0,1),S.academy.fac);for(const p of ps){c.squad=c.squad.filter(x=>x!==p.id);S.acad.push(p.id)}return ps.map(p=>p.id)}
