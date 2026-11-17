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
 return top+`<div class="grid"><section class="panel c5"><div class="ph"><h3>Squad depth</h3><small>Best player per position, out of 20</small></div><div class="pb needs">${POS.map(pos=>{const n=needs.find(x=>x.pos===pos),v=at20(n.v),need=top3.includes(n);return`<div class="need ${need?'hot':''}"><span class="pos g-${GROUP[pos]}">${pos}</span><i><b style="width:${v/20*100}%"></b></i><em>${v}</em><small>${n.best?pName(n.best):'—'} · depth ${n.depth}</small></div>`}).join('')}</div></section>
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

/* ---------- negotiation ---------- */
function openNegotiation(pid){
 const p=S.players[pid];if(!p)return;if(p.club===S.user)return;
 ui.neg={pid,stage:'fee',fee:Math.round(p.val/5e4)*5e4,counter:null,wage:wageDemand(p),years:p.age>=30?2:4,msg:'',tries:0};renderNeg();
}
function renderNeg(){
 const n=ui.neg,p=S.players[n.pid],c=clubOf(p.club),uc=clubOf(S.user),st=sellerStance(p),wd=wageDemand(p);
 const head=`<div class="neg-head">${kitSVG(c,'home',{back:true,name:p.ln,num:p.num})}<div><div class="eyebrow">Transfer negotiation · ${n.stage==='fee'?'Step 1 of 2: fee':'Step 2 of 2: personal terms'}</div><h2>${esc(p.fn)} <b>${esc(p.ln)}</b></h2><small>${posChip(p.pos)} ${p.age} years · ${crest(c.id,18)} ${esc(c.name)} · contract ${p.con} yr</small><div class="tc-row" style="margin-top:8px"><div><small>Ability</small>${starHTML(stars(p.ovr))}</div><div><small>Potential</small>${starHTML(stars(p.pot))}</div><div><small>Value</small><b>${money(p.val)}</b></div></div></div></div>`;
 let body;
 if(n.stage==='fee'){
  const min=Math.round(p.val*.4/5e4)*5e4,max=Math.max(min+1e5,Math.round(Math.min(uc.budget,p.val*2.5)/5e4)*5e4);
  body=`<div class="neg-grid"><div class="panel"><div class="pb"><div class="eyebrow" style="color:var(--muted)">Club's position</div><ul class="neg-notes"><li>${st.keyP?`One of ${esc(c.short)}'s three best players. Expect them to ask well above value.`:'Not a key player for them.'}</li><li>${p.con<=1?'His contract is nearly up, which lowers the price.':'He is under contract for '+p.con+' more years.'}</li><li>${c.squad.length<=21?'Their squad is thin, so they are reluctant to sell.':'They have enough cover in his position.'}</li><li>Your budget: <b>${money(uc.budget)}</b></li></ul></div></div>
  <div class="panel"><div class="pb"><label for="neg-fee" class="neg-lbl">Transfer fee <output id="neg-fee-out">${money(n.fee)}</output></label><input type="range" id="neg-fee" min="${min}" max="${max}" step="50000" value="${clamp(n.fee,min,max)}" data-input="negfee">
  ${n.counter?`<div class="neg-counter">${esc(c.short)} counter with <b>${money(n.counter)}</b>. <button class="btn" data-act="neg-accept-counter">Accept ${money(n.counter)}</button></div>`:''}
  <p class="neg-msg" role="status">${esc(n.msg)}</p><div class="toolbar" style="margin:0"><button class="btn pri" data-act="neg-bid">Submit bid</button><button class="btn" data-act="close">Walk away</button></div></div></div></div>`;
 }else{
  body=`<div class="neg-grid"><div class="panel"><div class="pb"><div class="eyebrow" style="color:var(--muted)">Agent's demands</div><ul class="neg-notes"><li>Fee agreed with ${esc(c.short)}: <b>${money(n.fee)}</b></li><li>Asking wage: <b>${money(wd)}</b> a week (currently earns ${money(p.wage)})</li><li>Longer deals cost a little less for older players; a one-year deal costs more.</li><li>Wage room: <b>${money(uc.wageBudget-wageBill(S.user))}</b> a week</li></ul></div></div>
  <div class="panel"><div class="pb"><label for="neg-wage" class="neg-lbl">Weekly wage <output id="neg-wage-out">${money(n.wage)}</output></label><input type="range" id="neg-wage" min="${Math.round(wd*.6/100)*100}" max="${Math.round(wd*1.6/100)*100}" step="500" value="${n.wage}" data-input="negwage">
  <div class="neg-lbl" style="margin-top:12px">Contract length</div><div class="seg" role="group" aria-label="Contract length">${[1,2,3,4,5].map(y=>`<button data-act="neg-years" data-v="${y}" aria-pressed="${n.years===y}">${y} yr</button>`).join('')}</div>
  <p class="neg-msg" role="status">${esc(n.msg)}</p><div class="toolbar" style="margin:0"><button class="btn pri" data-act="neg-terms">Offer contract</button><button class="btn" data-act="close">Walk away</button></div></div></div></div>`;
 }
 openModal(head+body);
}
function negBid(){
 const n=ui.neg,p=S.players[n.pid],v=bidVerdict(n.pid,n.fee);
 if(v.ok){n.stage='terms';n.msg=`${clubOf(p.club).short} accepted ${money(n.fee)}. Now agree personal terms.`;S.bids.unshift({pid:p.id,from:p.club,fee:n.fee,status:'Fee agreed',md:S.md});renderNeg();return}
 n.counter=v.counter||null;n.msg=v.msg;if(!v.counter)S.bids.unshift({pid:p.id,from:p.club,fee:n.fee,status:'Rejected',md:S.md});renderNeg();
}
function negTerms(){
 const n=ui.neg,p=S.players[n.pid],v=termsVerdict(p,n.wage,n.years);n.tries++;
 if(!v.ok){n.msg=v.msg+(n.tries>=3?' Talks have broken down.':'');if(n.tries>=3){const b=S.bids.find(x=>x.pid===p.id&&x.status==='Fee agreed');if(b)b.status='Terms refused';save();renderNeg();setTimeout(closeModal,1600);return}renderNeg();return}
 const from=p.club;moveP(p.id,S.user,n.fee);p.wage=n.wage;p.con=n.years;S.fin.buys+=n.fee;logDeal(p.id,from,S.user,n.fee);
 const b=S.bids.find(x=>x.pid===p.id&&x.status==='Fee agreed');if(b){b.status='Signed';b.wage=n.wage}
 mail('Director of Football',`${p.ln} signs from ${clubOf(from).short}`,`<p>${esc(p.fn+' '+p.ln)} has joined for <b>${money(n.fee)}</b> on ${money(n.wage)} a week until ${2026+S.season+n.years}. He will wear number ${p.num}.</p>`,null,'transfer');
 news(`${p.fn} ${p.ln} (${p.pos}, ${p.age}) joins ${clubOf(S.user).name} from ${clubOf(from).name} for ${money(n.fee)}.`,'transfer',[S.user,from],{title:`${clubOf(S.user).short} complete ${p.ln} signing`});
 save();closeModal();toast(`${p.fn} ${p.ln} signed for ${money(n.fee)}`);openPlayer(p.id);
}
