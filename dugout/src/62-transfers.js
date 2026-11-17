/* ================= transfer centre ================= */
const KEY_ATTRS={GK:['ref','div','han','one'],CB:['tck','mar','hea','pos'],LB:['pac','tck','cro','sta'],RB:['pac','tck','cro','sta'],DM:['tck','pos','pas','dec'],CM:['pas','vis','dec','sta'],AM:['vis','pas','dri','fir'],LW:['pac','dri','cro','fin'],RW:['pac','dri','cro','fin'],ST:['fin','cmp','fir','acc']};
const SHORT={pas:'PAS',cro:'CRO',dri:'DRI',fir:'FIR',fin:'FIN',lon:'LON',hea:'HEA',tck:'TCK',mar:'MAR',vis:'VIS',dec:'DEC',pos:'POS',cmp:'CMP',wor:'WOR',agg:'AGG',pac:'PAC',acc:'ACC',sta:'STA',str:'STR',agi:'AGI',jmp:'JMP',ref:'REF',han:'HAN',div:'DIV',dst:'DST',one:'1v1'};
const attrBar=(p,a)=>{const v=at20(p.at[AIX[a]]);return`<div class="ab"><span>${SHORT[a]}</span><i><b style="width:${v/20*100}%"></b></i><em class="${v>=16?'v6':v>=13?'v5':v>=10?'v4':'v3'}">${v}</em></div>`};
function squadNeeds(){
 const sq=squadOf(S.user).filter(p=>!p.inj),lgAvg=repToOvr(clubOf(S.user).rep);
 return POS.map(pos=>{const r=sq.map(p=>({p,v:rateAt(p,pos)})).sort((a,b)=>b.v-a.v);const best=r[0],depth=r.filter(x=>x.v>=lgAvg-8).length;return{pos,best:best?best.p:null,v:best?best.v:30,depth,gap:lgAvg+3-(best?best.v:30)}}).sort((a,b)=>b.gap-a.gap);
}
function targetsFor(pos,cur,n=3){
 const uc=clubOf(S.user),room=uc.wageBudget-wageBill(S.user);
 return Object.values(S.players).filter(p=>p.club!==S.user&&rateAt(p,pos)>cur+2&&p.val<=uc.budget*1.05&&wageDemand(p)<=room+2e3&&clubOf(p.club).rep-uc.rep<16)
  .map(p=>({p,s:rateAt(p,pos)-cur-p.val/Math.max(1,uc.budget)*6+(p.age<=24?2:0)})).sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.p);
}
function targetCard(p,cur){
 const keys=KEY_ATTRS[p.pos],diff=cur!=null?at20(rateAt(p,p.pos))-at20(cur):null;
 return`<article class="tcard"><header>${crest(p.club,30)}<div><b data-act="player" data-id="${p.id}" class="lnk">${esc(p.fn+' '+p.ln)}</b><small>${flagSVG(p.nat)} ${p.age} · ${esc(clubOf(p.club).short)} · ${esc(S.leagues[clubOf(p.club).league].name)}</small></div>${posChip(p.pos)}</header>
 <div class="tc-row"><div><small>Ability</small>${starHTML(stars(p.ovr))}</div><div><small>Potential</small>${starHTML(stars(p.pot))}</div>${diff!=null?`<div><small>vs starter</small><b class="${diff>0?'v5':'v2'}">${diff>0?'+':''}${diff}</b></div>`:''}</div>
 <div class="abs">${keys.map(a=>attrBar(p,a)).join('')}</div>
 <div class="tc-foot"><div><small>Value</small><b>${money(p.val)}</b></div><div><small>Wants</small><b>${money(wageDemand(p))}/w</b></div><div><small>Contract</small><b>${p.con} yr</b></div></div>
 <div class="tc-act"><button class="btn" data-act="shortlist" data-id="${p.id}">${S.shortlist.includes(p.id)?'Shortlisted':'Shortlist'}</button><button class="btn pri" data-act="negotiate" data-id="${p.id}">Make offer</button></div></article>`;
}
function transfersTop(){
 const c=clubOf(S.user),room=c.wageBudget-wageBill(S.user),offers=S.inbox.filter(m=>m.action&&m.action.type==='offer'&&!m.action.done).length,left=windowOpen()?(S.md<WIN1?WIN1-S.md:WIN2[1]-S.md):0;
 return`<div class="kpi-row"><div class="kt"><small>Transfer budget</small><b>${money(c.budget)}</b></div><div class="kt"><small>Wage room</small><b>${money(Math.max(0,room))}<em>/w</em></b></div><div class="kt"><small>Window</small><b class="${windowOpen()?'v5':''}">${windowOpen()?`Open · ${left} md left`:'Closed'}</b></div><div class="kt"><small>Squad</small><b>${c.squad.length}<em>/34</em></b></div><div class="kt"><small>Offers received</small><b>${offers}</b></div><div class="kt"><small>Spent this season</small><b>${money(S.fin.buys)}</b></div></div>`;
}
function viewTransfers(){
 const top=transfersTop();
 if(sub==='scouting')return top+viewScouting();
 if(sub==='search')return top+searchFilters()+`<div class="panel" id="tr-list"></div>`;
 if(sub==='shortlist'){const list=S.shortlist.map(id=>S.players[id]).filter(Boolean);return top+(list.length?`<div class="tcards">${list.map(p=>targetCard(p,squadOf(S.user).filter(x=>x.pos===p.pos).reduce((m,x)=>Math.max(m,rateAt(x,p.pos)),0))).join('')}</div>`:'<div class="panel"><p class="pb muted">Your shortlist is empty. Add players from the hub, search or their profile.</p></div>')}
 if(sub==='bids')return top+`<div class="panel"><div class="ph"><h3>Negotiations this season</h3></div>${S.bids.length?`<div class="tw"><table class="tbl"><thead><tr><th>Player</th><th>Club</th><th class="r">Offer</th><th class="r">Wage</th><th>Status</th><th>MD</th></tr></thead><tbody>${S.bids.map(b=>{const p=S.players[b.pid];return p?`<tr class="click" data-act="player" data-id="${p.id}"><td><b>${pName(p)}</b> ${posChip(p.pos)}</td><td><div class="who">${crest(b.from,18)}${esc(clubOf(b.from).short)}</div></td><td class="r">${money(b.fee)}</td><td class="r">${b.wage?money(b.wage):'–'}</td><td><span class="chip ${b.status==='Signed'?'ok':b.status==='Rejected'||b.status==='Terms refused'?'bad':''}">${b.status}</span></td><td>${b.md+1}</td></tr>`:''}).join('')}</tbody></table></div>`:'<p class="pb muted">No bids made yet this season.</p>'}</div>`;
 if(sub==='deals'){const lf=ui.dealLeague??'all';const list=S.deals.filter(d=>lf==='all'||clubOf(d.to).league==lf||clubOf(d.from).league==lf);
  return top+`<div class="toolbar"><label for="dl-lg">League <select id="dl-lg" data-change="dealLeague"><option value="all">All leagues</option>${S.leagues.map(l=>`<option value="${l.id}" ${String(lf)===String(l.id)?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label><small>${list.length} deals · ${money(list.reduce((a,d)=>a+d.fee,0))} spent</small></div>
  <div class="panel"><div class="tw"><table class="tbl"><thead><tr><th>MD</th><th>Player</th><th>From</th><th></th><th>To</th><th class="r">Fee</th></tr></thead><tbody>${list.slice(0,150).map(d=>`<tr class="click" data-act="player" data-id="${d.pid}"><td>${d.md+1}</td><td><b>${esc(d.name)}</b> ${posChip(d.pos)} <small>${d.age}</small></td><td><div class="who">${crest(d.from,18)}${esc(clubOf(d.from).short)}</div></td><td>→</td><td><div class="who">${crest(d.to,18)}${esc(clubOf(d.to).short)}</div></td><td class="r"><b>${d.fee?money(d.fee):'Swap'}</b></td></tr>`).join('')||'<tr><td colspan="6" class="muted">No deals yet.</td></tr>'}</tbody></table></div></div>`}
 // hub
 const needs=squadNeeds(),top3=needs.slice(0,3),mx=Math.max(...needs.map(n=>n.v));
 const kids=Object.values(S.players).filter(p=>p.age<=20&&p.club!==S.user).sort((a,b)=>b.pot-a.pot).slice(0,6);
 const big=S.deals.filter(d=>d.season===S.season).slice().sort((a,b)=>b.fee-a.fee).slice(0,6);
 const uc=clubOf(S.user),rec=S.deals.filter(d=>d.to===S.user).sort((a,b)=>b.fee-a.fee)[0],lgDeal=S.deals.filter(d=>d.season===S.season).sort((a,b)=>b.fee-a.fee)[0];
 const banner=`<section class="tw-banner ${windowOpen()?'open':''}" style="--cc:${uc.colors[0]}"><div><div class="eyebrow">${S.md<WIN1?'Summer':'Winter'} transfer window</div><h2>${windowOpen()?`Open · closes in ${S.md<WIN1?WIN1-S.md:WIN2[1]-S.md} matchdays`:`Closed · reopens at matchday ${WIN2[0]+1}`}</h2><p>${windowOpen()?'Clubs across six countries are doing business. Identify your targets and get deals done before the deadline.':'Plan your targets now: shortlist players and be ready when the window opens.'}</p></div><div class="twb-stats"><div><small>Your record signing</small><b>${rec?esc(rec.name)+' · '+money(rec.fee):'—'}</b></div><div><small>Biggest deal this season</small><b>${lgDeal?esc(lgDeal.name)+' · '+money(lgDeal.fee):'—'}</b></div><div><small>Deals completed</small><b>${S.deals.filter(d=>d.season===S.season).length}</b></div></div></section>`;
 return top+banner+`<div class="grid"><section class="panel c5"><div class="ph"><h3>Squad depth</h3><small>Best player per position, out of 20</small></div><div class="pb needs">${POS.map(pos=>{const n=needs.find(x=>x.pos===pos),v=at20(n.v),need=top3.includes(n);return`<div class="need ${need?'hot':''}"><span class="pos g-${GROUP[pos]}">${pos}</span><i><b style="width:${v/20*100}%"></b></i><em>${v}</em><small>${n.best?pName(n.best):'—'} · depth ${n.depth}</small></div>`}).join('')}</div></section>
 <section class="panel c7"><div class="ph"><h3>Biggest deals this season</h3><button class="btn" data-act="sub" data-v="deals">All deals</button></div><div class="list">${big.map(d=>`<button class="li" style="grid-template-columns:auto 1fr auto" data-act="player" data-id="${d.pid}">${crest(d.to,26)}<span><b>${esc(d.name)} <small style="display:inline">${d.pos}</small></b><small>${esc(clubOf(d.from).short)} → ${esc(clubOf(d.to).short)} · matchday ${d.md+1}</small></span><b class="av">${money(d.fee)}</b></button>`).join('')||'<p class="pb muted">No deals completed yet this season.</p>'}</div></section>
 ${top3.map(n=>{const t=targetsFor(n.pos,n.v);return`<section class="panel c12"><div class="ph"><h3>Recommended: ${POS_NAME[n.pos]}</h3><small>Current best: ${n.best?pName(n.best):'none'} (${at20(n.v)}/20)</small></div><div class="pb">${t.length?`<div class="tcards">${t.map(p=>targetCard(p,n.v)).join('')}</div>`:'<p class="muted" style="margin:0">No affordable upgrades found. Raise your budget in the Office or look at younger players.</p>'}</div></section>`}).join('')}
 <section class="panel c12"><div class="ph"><h3>Scouting: wonderkids</h3><small>Highest potential players aged 20 or under</small></div><div class="pb"><div class="tcards">${kids.map(p=>targetCard(p,null)).join('')}</div></div></section></div>`;
}
function searchFilters(){
 return`<div class="toolbar search-bar"><input type="search" id="tr-q" placeholder="Player or club" value="${esc(ui.trQ)}" data-input="trq" aria-label="Search by name or club">
 <label for="tr-pos">Position <select id="tr-pos" data-change="trPos"><option value="all">Any</option>${POS.map(p=>`<option ${ui.trPos===p?'selected':''}>${p}</option>`).join('')}</select></label>
 <label for="tr-lg">League <select id="tr-lg" data-change="trLeague"><option value="all">All leagues</option>${S.leagues.map(l=>`<option value="${l.id}" ${String(ui.trLeague)===String(l.id)?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
 <label for="tr-nat">Nationality <select id="tr-nat" data-change="trNat"><option value="all">Any</option>${Object.entries(NATIONS).map(([k,v])=>`<option value="${k}" ${ui.trNat===k?'selected':''}>${esc(v.n)}</option>`).join('')}</select></label>
 <label for="tr-max">Max value <select id="tr-max" data-change="trMax">${[[0,'Any'],[1e6,'£1M'],[5e6,'£5M'],[10e6,'£10M'],[25e6,'£25M'],[50e6,'£50M'],[100e6,'£100M']].map(([v,l])=>`<option value="${v}" ${ui.trMax==v?'selected':''}>${l}</option>`).join('')}</select></label>
 <label for="tr-age">Max age <select id="tr-age" data-change="trAge">${[40,19,21,23,25,28,31].map(v=>`<option value="${v}" ${ui.trAge==v?'selected':''}>${v===40?'Any':v}</option>`).join('')}</select></label>
 <label for="tr-min">Min ability <select id="tr-min" data-change="trMin">${[0,2,2.5,3,3.5,4,4.5].map(v=>`<option value="${v}" ${ui.trMin==v?'selected':''}>${v?v+' stars':'Any'}</option>`).join('')}</select></label>
 <label><input type="checkbox" id="tr-exp" data-change="trExp" ${ui.trExp?'checked':''}> Contract expiring</label></div>`;
}
function renderSearch(){
 const el=$('#tr-list');if(!el)return;const q=ui.trQ.trim().toLowerCase();
 const list=Object.values(S.players).filter(p=>p.club!==S.user&&(ui.trPos==='all'||p.pos===ui.trPos)&&(ui.trLeague==='all'||clubOf(p.club).league==ui.trLeague)&&(!ui.trNat||ui.trNat==='all'||p.nat===ui.trNat)&&(!ui.trMax||p.val<=ui.trMax)&&p.age<=ui.trAge&&stars(p.ovr)>=ui.trMin&&(!ui.trExp||p.con<=1)&&(!q||(p.fn+' '+p.ln).toLowerCase().includes(q)||clubOf(p.club).name.toLowerCase().includes(q)));
 const keys=ui.trPos!=='all'?KEY_ATTRS[ui.trPos]:null;
 const cols=[['name','Player',null],['club','Club',null],['pos','Pos',p=>POS.indexOf(p.pos)],['age','Age',p=>p.age,'r'],['ovr','Ability',p=>p.ovr],['pot','Potential',p=>p.pot],...(keys?keys.map(a=>['a_'+a,SHORT[a],p=>p.at[AIX[a]],'r']):[['key','Key attributes',null]]),['val','Value',p=>p.val,'r'],['wd','Wage demand',p=>wageDemand(p),'r hide-sm'],['con','Contract',p=>p.con,'r hide-sm']];
 const head=sortable('search',cols,list);
 el.innerHTML=list.length?`<div class="ph"><h3>Results <small>${list.length} players${list.length>100?', showing 100':''}</small></h3></div><div class="tw"><table class="tbl"><thead><tr>${head}<th></th></tr></thead><tbody>${list.slice(0,100).map(p=>`<tr class="click" data-act="player" data-id="${p.id}"><td><div class="who">${flagSVG(p.nat)}<b>${esc(p.fn+' '+p.ln)}</b>${S.shortlist.includes(p.id)?'<span class="chip hot">Shortlist</span>':''}</div></td><td><div class="who">${crest(p.club,18)}<span>${esc(clubOf(p.club).short)}</span></div></td><td>${posChip(p.pos)}</td><td class="r">${p.age}</td><td>${starHTML(stars(p.ovr))}</td><td>${starHTML(stars(p.pot))}</td>${keys?keys.map(a=>{const v=at20(p.at[AIX[a]]);return`<td class="r"><b class="${v>=16?'v6':v>=13?'v5':v>=10?'v4':'v3'}">${v}</b></td>`}).join(''):`<td><small>${KEY_ATTRS[p.pos].map(a=>`${SHORT[a]} <b>${at20(p.at[AIX[a]])}</b>`).join(' · ')}</small></td>`}<td class="r">${money(p.val)}</td><td class="r hide-sm">${money(wageDemand(p))}</td><td class="r hide-sm">${p.con} yr</td><td><button class="btn" data-act="negotiate" data-id="${p.id}">Offer</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="pb muted">No players match those filters.</p>';
}

/* ---------- negotiation room ---------- */
const ROLES_SQ=[['key','Key player',1.15],['first','First team',1],['rot','Rotation',.9],['back','Backup',.8]];
function negValue(n,p){return n.fee+n.addons*.6+n.sellOn/100*p.val*.8}
function negChance(n,p){return sig((negValue(n,p)/n.want-1)*13)}
function chanceWord(c){return c>.85?['Very likely','v6']:c>.6?['Likely','v5']:c>.35?['Possible','v4']:c>.12?['Unlikely','v2']:['Very unlikely','v1']}
function openNegotiation(pid){
 const p=S.players[pid];if(!p||p.club===S.user)return;
 if(!windowOpen()){toast(`The transfer window is closed. It reopens at matchday ${WIN2[0]+1}.`);return}
 const st=sellerStance(p),sel=clubOf(p.club),uc=clubOf(S.user);
 if(sel.rep-uc.rep>16&&p.ovr>repToOvr(uc.rep)+7){toast(`${p.ln} is not interested in joining a club of your stature.`);return}
 const want=p.val*st.mult*(.94+G.f()*.12),est=p.val*st.mult;
 const sq=squadOf(S.user).sort((a,b)=>b.ovr-a.ovr),rank=sq.filter(x=>x.ovr>p.ovr).length;
 ui.neg={pid,stage:'fee',want,est,fee:Math.round(p.val*.9/5e4)*5e4,addons:0,sellOn:0,inst:false,round:1,max:4,counter:null,
  log:[{who:'us',t:`We would like to open talks for ${p.fn} ${p.ln}.`},{who:'them',t:st.keyP?`${p.ln} is one of our most important players. Any offer will need to be substantial.`:`We are prepared to listen to offers for ${p.ln}.`}],
  wage:wageDemand(p),bonus:0,years:p.age>=30?2:4,role:rank<3?'key':rank<11?'first':'rot',clause:false,tries:0,expect:rank<3?'key':rank<11?'first':'rot'};
 renderNeg();
}
function negHeader(n,p){
 const uc=clubOf(S.user),sc=clubOf(p.club);
 return`<div class="nr-head" style="--a:${uc.colors[0]};--b:${sc.colors[0]}"><div class="nr-club">${crest(uc.id,64)}<b>${esc(uc.short)}</b><small>Buying club</small></div>
 <div class="nr-player">${kitSVG(sc,'home',{back:true,name:p.ln,num:p.num})}<div><div class="eyebrow">${n.stage==='fee'?'Club negotiation':n.stage==='call'?'On the phone with his agent':n.stage==='terms'?'Personal terms':'Done deal'}</div><h2>${esc(p.fn)} <b>${esc(p.ln)}</b></h2><div class="nr-meta">${posChip(p.pos)} <span>${p.age} yrs</span> ${flagSVG(p.nat)} <span>${starHTML(stars(p.ovr))}</span></div></div></div>
 <div class="nr-club">${crest(sc.id,64)}<b>${esc(sc.short)}</b><small>Selling club</small></div></div>
 <div class="nr-steps">${[['fee','1. Agree fee'],['call','2. Call the agent'],['terms','3. Personal terms'],['done','4. Signed']].map(([k,l])=>{const o=['fee','call','terms','done'];return`<span class="${n.stage===k?'on':o.indexOf(n.stage)>o.indexOf(k)?'ok':''}">${l}</span>`}).join('')}</div>`;
}
function gauge(val,est,c){
 const lo=est*.5,hi=est*1.5,pct=v=>clamp((v-lo)/(hi-lo)*100,0,100),[w,cl]=chanceWord(c);
 return`<div class="gauge"><div class="g-bar"><span style="left:0;width:${pct(est*.8)}%" class="z1"></span><span style="left:${pct(est*.8)}%;width:${pct(est)-pct(est*.8)}%" class="z2"></span><span style="left:${pct(est)}%;width:${pct(est*1.15)-pct(est)}%" class="z3"></span><span style="left:${pct(est*1.15)}%;right:0" class="z4"></span><i style="left:${pct(val)}%"></i></div>
 <div class="g-lbl"><span>Insulting</span><span>Below value</span><span>Fair</span><span>Premium</span></div>
 <div class="g-read"><div><small>Package worth</small><b>${money(val)}</b></div><div><small>Their valuation (scouted)</small><b>~${money(est)}</b></div><div><small>Acceptance</small><b class="${cl}">${w} · ${Math.round(c*100)}%</b></div></div></div>`;
}
function negLog(n){return`<div class="nr-log">${n.log.map(m=>`<div class="msg-b ${m.who}"><small>${m.who==='us'?'Your director of football':m.who==='agent'?"Player's agent":clubOf(S.players[n.pid].club).short}</small><p>${esc(m.t)}</p></div>`).join('')}</div>`}
function renderNeg(){
 const n=ui.neg,p=S.players[n.pid],uc=clubOf(S.user);let body;
 if(n.stage==='fee'){
  const max=Math.max(Math.round(p.val*.6/5e4)*5e4+1e5,Math.round(Math.min(uc.budget*(n.inst?2:1),p.val*2.6)/5e4)*5e4),min=Math.round(p.val*.3/5e4)*5e4;
  const c=negChance(n,p);
  body=`<div class="nr-body"><div class="nr-col"><h3>Your offer</h3>
  <div class="neg-lbl">Up-front fee</div>${stepper('neg','fee',n.fee,{min:0,max:9e12,label:'Up-front fee',chips:[['Their valuation',nice(n.est,5e4)],['−10%',nice(n.est*.9,5e4)],['+10%',nice(n.est*1.1,5e4)],['Market value',nice(p.val,5e4)]]})}
  <div class="neg-lbl">Add-ons <small>appearances, goals, trophies</small></div>${stepper('neg','addons',n.addons,{min:0,max:9e12,label:'Add-ons',chips:[['None',0],['10% of fee',nice(n.fee*.1,5e4)],['25% of fee',nice(n.fee*.25,5e4)]]})}
  <div class="neg-lbl">Sell-on clause</div><div class="seg" role="group" aria-label="Sell-on clause">${[0,10,15,20,25].map(v=>`<button data-act="neg-sellon" data-v="${v}" aria-pressed="${n.sellOn===v}">${v?v+'%':'None'}</button>`).join('')}</div>
  <label class="nr-check"><input type="checkbox" id="ni" data-change="negInst" ${n.inst?'checked':''}> Pay in two instalments (half now, half next season)</label>
  <div id="nr-sum">${feeSum(n,p)}</div></div>
  <div class="nr-col"><div id="nr-gauge">${gauge(negValue(n,p),n.est,c)}</div>${n.counter?`<div class="neg-counter"><span>${esc(clubOf(p.club).short)} would accept <b>${money(n.counter)}</b> up front with your current add-ons.</span><button class="btn" data-act="neg-accept-counter">Accept counter</button></div>`:''}${negLog(n)}</div></div>
  <div class="nr-foot"><button class="btn" data-act="close">Walk away</button><button class="btn pri lg" data-act="neg-bid" ${n.round>n.max?'disabled':''}>Submit offer</button></div>`;
 }else if(n.stage==='call'){
  body=agentCallHTML(n,p);
 }else if(n.stage==='terms'){
  const need=termsNeed(n,p);
  body=`<div class="nr-body"><div class="nr-col"><h3>Contract offer</h3>
  ${(()=>{const room=uc.wageBudget-wageBill(S.user);return`<div class="neg-lbl">Weekly wage</div>${stepper('neg','wage',n.wage,{min:0,max:9e12,label:'Weekly wage',suffix:' p/w',chips:[['His demand',nice(need,500)],['−10%',nice(need*.9,500)],['+10%',nice(need*1.1,500)]]})}${room<need?`<p class="neg-warn">His demand is above your wage room of ${money(room)} a week. Raise the wage budget in the Office or lean on the signing bonus.</p>`:''}`})()}
  <div class="neg-lbl">Signing-on bonus</div>${stepper('neg','bonus',n.bonus,{min:0,max:9e12,label:'Signing bonus',chips:[['None',0],['4 weeks',nice(n.wage*4,1e4)],['12 weeks',nice(n.wage*12,1e4)],['26 weeks',nice(n.wage*26,1e4)]]})}
  <div class="neg-lbl">Agent fee</div>${stepper('neg','agentFee',n.agentFee,{min:0,max:9e12,label:'Agent fee',chips:[['His ask',n.agentAsk],['−25%',nice(n.agentAsk*.75,1e4)],['None',0]]})}
  <div class="neg-lbl">Contract length</div><div class="seg" role="group" aria-label="Contract length">${[1,2,3,4,5].map(y=>`<button data-act="neg-years" data-v="${y}" aria-pressed="${n.years===y}">${y} yr</button>`).join('')}</div>
  <div class="neg-lbl" style="margin-top:12px">Squad role</div><div class="seg" role="group" aria-label="Squad role">${ROLES_SQ.map(([k,l])=>`<button data-act="neg-role" data-v="${k}" aria-pressed="${n.role===k}">${l}</button>`).join('')}</div>
  <label class="nr-check"><input type="checkbox" data-change="negClause" ${n.clause?'checked':''}> Include a release clause</label>
  <div id="nr-sum">${termsSum(n,p)}</div></div>
  <div class="nr-col"><div id="nr-gauge">${termsRead(n,p)}</div>${negLog(n)}</div></div>
  <div class="nr-foot"><button class="btn" data-act="close">Walk away</button><button class="btn pri lg" data-act="neg-terms">Offer contract</button></div>`;
 }else{
  body=`<div class="nr-done"><div class="eyebrow">Done deal</div><h2>${esc(p.fn)} ${esc(p.ln)} is a ${esc(uc.short)} player</h2>
  <div class="nr-sum big"><div><small>Fee</small><b>${money(n.fee)}</b></div><div><small>Add-ons</small><b>${money(n.addons)}</b></div><div><small>Wage</small><b>${money(n.wage)}/w</b></div><div><small>Contract</small><b>${n.years} years</b></div><div><small>Shirt</small><b>No. ${p.num}</b></div></div>
  <div class="nr-foot" style="justify-content:center"><button class="btn" data-act="close">Close</button><button class="btn pri lg" data-act="player" data-id="${p.id}">View player</button></div></div>`;
 }
 openModal(`<div class="nroom">${negHeader(n,p)}${body}</div>`);$('#modal .modal-box').classList.add('wide');
}
function feeSum(n,p){const uc=clubOf(S.user),now=n.fee*(n.inst?.5:1);return`<div class="nr-sum"><div><small>Due now</small><b>${money(now)}</b></div><div><small>Budget after</small><b class="${uc.budget-now<0?'v1':''}">${money(uc.budget-now)}</b></div><div><small>Round</small><b>${Math.min(n.round,n.max)} of ${n.max}</b></div></div>`}
function termsSum(n,p){const uc=clubOf(S.user),now=n.fee*(n.inst?.5:1)+n.bonus+(n.agentFee||0);return`<div class="nr-sum"><div><small>Wage room</small><b>${money(uc.wageBudget-wageBill(S.user))}/w</b></div><div><small>Due now</small><b class="${now>uc.budget?'v1':''}">${money(now)}</b></div><div><small>Total cost</small><b>${money(n.fee+n.bonus+(n.agentFee||0)+n.wage*52*n.years)}</b></div></div>`}
function termsRead(n,p){const need=termsNeed(n,p),c=sig((n.wage/need-1)*16+(n.clause?.3:0)+(n.interest||0)*3+((n.agentFee/(n.agentAsk||1))-1)*1.6),[w,cl]=chanceWord(c);return`<div class="gauge"><div class="g-read"><div><small>Agent wants</small><b>${money(need)}/w</b></div><div><small>Expects role</small><b>${ROLES_SQ.find(r=>r[0]===n.expect)[1]}</b></div><div><small>Agreement</small><b class="${cl}">${w} · ${Math.round(c*100)}%</b></div></div></div>`}
function negLive(){const n=ui.neg,p=S.players[n.pid],g=$('#nr-gauge'),sm=$('#nr-sum');if(!g)return;
 if(n.stage==='fee'){g.innerHTML=gauge(negValue(n,p),n.est,negChance(n,p));sm.innerHTML=feeSum(n,p)}else if(n.stage==='terms'){g.innerHTML=termsRead(n,p);sm.innerHTML=termsSum(n,p)}}
function termsNeed(n,p){const role=ROLES_SQ.find(r=>r[0]===n.role),exp=ROLES_SQ.findIndex(r=>r[0]===n.expect),got=ROLES_SQ.findIndex(r=>r[0]===n.role);
 return Math.round(wageDemand(p)*role[2]*(got>exp?1+(got-exp)*.18:1)*(n.years>=4&&p.age>=29?.93:n.years<=1?1.1:1)-n.bonus/(42*n.years))}
function negBid(){
 const n=ui.neg,p=S.players[n.pid],uc=clubOf(S.user),sel=clubOf(p.club),now=n.fee*(n.inst?.5:1);
 if(now>uc.budget){toast(`That is more than your transfer budget of ${money(uc.budget)}.`);return}
 if(uc.squad.length>=34){toast('Your squad is full (34 players).');return}
 const v=negValue(n,p),r=v/n.want;
 n.log.push({who:'us',t:`We offer ${money(n.fee)}${n.addons?` plus ${money(n.addons)} in add-ons`:''}${n.sellOn?` and a ${n.sellOn}% sell-on clause`:''}${n.inst?', paid in two instalments':''}.`});
 if(r>=1){n.log.push({who:'them',t:`We accept. You may speak to ${p.ln}'s representatives.`});n.stage='call';n.agentAsk=nice(Math.max(n.fee*.05,wageDemand(p)*8),1e4);n.agentFee=n.agentAsk;n.interest=agentInterest(p);n.counter=null;S.bids.unshift({pid:p.id,from:p.club,fee:n.fee,status:'Fee agreed',md:S.md});
  n.log.push({who:'agent',t:`${p.ln} is interested. We are looking for around ${money(wageDemand(p))} a week and a ${ROLES_SQ.find(x=>x[0]===n.expect)[1].toLowerCase()} role.`});n.wage=termsNeed(n,p);renderNeg();return}
 n.round++;
 if(n.round>n.max){n.log.push({who:'them',t:`We are too far apart. ${sel.short} have ended talks.`});S.bids.unshift({pid:p.id,from:p.club,fee:n.fee,status:'Rejected',md:S.md});save();renderNeg();return}
 if(r>=.8){n.counter=Math.max(n.fee+5e4,Math.round((n.want-n.addons*.6-n.sellOn/100*p.val*.8)/5e4)*5e4);n.log.push({who:'them',t:r>=.93?`We are close. Make it ${money(n.counter)} up front and we have a deal.`:`That is below our valuation. We would need ${money(n.counter)} up front.`})}
 else{n.counter=null;n.log.push({who:'them',t:r<.6?'That offer is insulting. Come back with something serious.':`Not enough. ${p.ln} is worth considerably more to us.`});n.want*=1.02}
 renderNeg();
}
function negTerms(){
 const n=ui.neg,p=S.players[n.pid],uc=clubOf(S.user),need=termsNeed(n,p);n.tries++;
 if(wageBill(S.user)+n.wage>uc.wageBudget){n.log.push({who:'us',t:'We cannot go that high: it breaks our wage budget.'});renderNeg();return}
 n.log.push({who:'us',t:`We offer ${money(n.wage)} a week for ${n.years} years as a ${ROLES_SQ.find(r=>r[0]===n.role)[1].toLowerCase()}${n.bonus?`, with a ${money(n.bonus)} signing bonus`:''}${n.clause?' and a release clause':''}.`});
 const c=sig((n.wage/need-1)*16+(n.clause?.3:0)+(n.interest||0)*3+((n.agentFee/(n.agentAsk||1))-1)*1.6);
 if(n.fee*(n.inst?.5:1)+n.bonus+(n.agentFee||0)>uc.budget){n.log.push({who:'us',t:'We cannot cover the fee, bonus and agent fee from the transfer budget.'});renderNeg();return}
 if(G.f()<c){
  const from=p.club,now=n.fee*(n.inst?.5:1);moveP(p.id,S.user,0);uc.budget-=now+n.bonus+(n.agentFee||0);clubOf(from).budget+=n.fee;if(n.inst)S.owed=(S.owed||0)+n.fee/2;
  p.wage=n.wage;p.con=n.years;S.fin.buys+=now+n.bonus;logDeal(p.id,from,S.user,n.fee);
  const b=S.bids.find(x=>x.pid===p.id&&x.status==='Fee agreed');if(b){b.status='Signed';b.wage=n.wage}
  mail('Director of Football',`${p.ln} signs from ${clubOf(from).short}`,`<p>${esc(p.fn+' '+p.ln)} has joined for <b>${money(n.fee)}</b>${n.addons?` plus ${money(n.addons)} in add-ons`:''} on ${money(n.wage)} a week until ${2026+S.season+n.years}. He will wear number ${p.num}.</p>`,null,'transfer',{att:{t:'player',pid:p.id,note:'New signing'},links:[['View player','player',p.id,1]]});
  news(`${p.fn} ${p.ln} (${p.pos}, ${p.age}) joins ${uc.name} from ${clubOf(from).name} for ${money(n.fee)}.`,'transfer',[S.user,from],{title:`${uc.short} complete ${p.ln} signing`});
  n.log.push({who:'agent',t:'We have a deal. He is delighted to join.'});n.stage='done';save();renderNeg();celebrateSigning(p,n.fee);if(stars(p.ovr)>=4)unlock('buy4');return}
 if(n.tries>=4){n.log.push({who:'agent',t:'We cannot reach an agreement. He will stay where he is.'});const b=S.bids.find(x=>x.pid===p.id&&x.status==='Fee agreed');if(b)b.status='Terms refused';save();renderNeg();setTimeout(closeModal,1800);return}
 n.log.push({who:'agent',t:n.wage<need*.9?`That is well short. He wants at least ${money(Math.round(need/500)*500)} a week.`:n.role!==n.expect&&ROLES_SQ.findIndex(r=>r[0]===n.role)>ROLES_SQ.findIndex(r=>r[0]===n.expect)?'He expects a bigger role than that.':'Close. Improve the offer a little and we can sign.'});
 renderNeg();
}
