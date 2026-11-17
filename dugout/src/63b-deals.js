/* ================= dealmaking: steppers, agents and phone calls =================
   Every number in a deal is set with a precise stepper (minus, value, plus) and quick-pick chips, never a
   slider. Talks with agents and rival directors happen on the phone: you choose what to ask and how to reply. */
const AG_FIRST=['Marco','Daniel','Sofia','Luca','Elena','Tomás','Jonas','Clara','Rafael','Nina','Pieter','Hugo','Ines','Victor','Anna','Samir'];
const AG_LAST=['Bellini','Okafor','Lindqvist','Moreau','Ferreira','Kowalski','Van Dijkstra','Rossetti','Haddad','Brennan','Castell','Novak','Duarte','Sauer'];
const AGENCIES=['Apex Sports Management','Northline Talent','Crest Football Group','Meridian Athletes','Blue Ribbon Agency','Kestrel Sports','Linea Football','Firstteam Partners'];
function agentOf(p){const h=Math.imul(p.id+31,2654435761)>>>0;return{name:`${AG_FIRST[h%AG_FIRST.length]} ${AG_LAST[(h>>>5)%AG_LAST.length]}`,agency:AGENCIES[(h>>>9)%AGENCIES.length]}}
const nice=(v,m)=>Math.max(m,Math.round(v/m)*m);
/* ---------- stepper ---------- */
const STEP_TARGETS={};
function stepper(t,k,v,o){
 const f=o.fmt||money;
 return`<div class="stp-wrap"><div class="stp" role="group" aria-label="${esc(o.label||k)}"><button class="stp-b" data-act="stp" data-t="${t}" data-k="${k}" data-d="-1" aria-label="Decrease" ${v<=o.min?'disabled':''}>−</button>
 <output class="stp-v">${f(v)}${o.suffix||''}</output><button class="stp-b" data-act="stp" data-t="${t}" data-k="${k}" data-d="1" aria-label="Increase" ${v>=o.max?'disabled':''}>+</button></div>
 ${o.chips?`<div class="stp-chips">${o.chips.map(([l,x])=>`<button data-act="stp-set" data-t="${t}" data-k="${k}" data-v="${Math.round(x)}" aria-pressed="${Math.round(x)===Math.round(v)}">${esc(l)}</button>`).join('')}</div>`:''}</div>`;
}
// Each stepper target registers how to read its object, its limits and how to redraw.
function stepApply(t,k,dir,setTo){
 const T=STEP_TARGETS[t];if(!T)return;const obj=T.obj(),lim=T.lim(k);if(!obj||!lim)return;
 let v=setTo!=null?setTo:obj[k]+dir*lim.step;obj[k]=clamp(Math.round(v/lim.step)*lim.step,lim.min,lim.max);if(setTo!=null)obj[k]=clamp(setTo,lim.min,lim.max);T.redraw();
}

/* ---------- phone ---------- */
function phoneHTML(o){
 return`<div class="phone"><div class="ph-top"><span>${o.time||'09:41'}</span><span class="ph-net"><i></i><i></i><i></i><i></i></span></div>
 <div class="ph-call"><div class="ph-av">${o.avatar}</div><div><b>${esc(o.who)}</b><small>${esc(o.sub)}</small></div><span class="ph-dur" id="ph-dur">${o.dur||'00:12'}</span></div>
 <div class="ph-msgs">${o.msgs.map(m=>`<div class="ph-m ${m.me?'me':''}">${m.html||esc(m.t)}</div>`).join('')}</div>
 <div class="ph-replies">${o.replies.map(r=>`<button class="ph-r ${r.cls||''}" data-act="${r.act}" ${r.v!=null?`data-v="${r.v}"`:''} ${r.id!=null?`data-id="${r.id}"`:''}>${esc(r.label)}</button>`).join('')}</div>
 ${o.extra||''}<button class="ph-hang" data-act="${o.hang||'close'}" aria-label="End call"><svg viewBox="0 0 24 24"><path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3.5-2v-3c-2-.7-4-.7-6 0v3l-3.5 2z"/></svg></button></div>`;
}
const callClock=n=>{const s=12+n*17;return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};

/* ---------- buying: the call with the player's agent ---------- */
function agentInterest(p){const uc=clubOf(S.user),sc=clubOf(p.club),d=(uc.rep-sc.rep)/10,role=ui.neg?ROLES_SQ.findIndex(r=>r[0]===ui.neg.expect):1;return clamp(d*.12+(p.age>=29?.05:0)-(role===0?.05:0)+(personality(p)[0]==='Ambitious'?(d>0?.12:-.12):0),-.35,.35)}
function agentCallHTML(n,p){
 const ag=agentOf(p),q=n.asked||(n.asked={}),msgs=n.call||(n.call=[{t:`${ag.name} speaking. You've agreed a fee with ${clubOf(p.club).short} for ${p.fn}. What would you like to know?`}]);
 const reps=[];if(!q.int)reps.push({label:'Is he interested in joining us?',act:'call-q',v:'int'});if(!q.wage)reps.push({label:'What is he looking for?',act:'call-q',v:'wage'});if(!q.fee)reps.push({label:'What is your fee?',act:'call-q',v:'fee'});if(!q.comp)reps.push({label:'Is anyone else interested?',act:'call-q',v:'comp'});
 reps.push({label:'Let’s put an offer together',act:'call-terms',cls:'pri'});
 const ini=ag.name.split(' ').map(x=>x[0]).join('');
 return`<div class="nr-body call"><div class="nr-col">${phoneHTML({who:ag.name,sub:`${ag.agency} · agent of ${p.fn} ${p.ln}`,avatar:`<span class="ph-ini">${ini}</span>`,dur:callClock(Object.keys(q).length),msgs,replies:reps,hang:'close'})}</div>
 <div class="nr-col"><h3>What you know</h3><dl class="facts"><div><dt>Interest</dt><dd>${q.int?n.intWord:'Ask the agent'}</dd></div><div><dt>Wage expectation</dt><dd>${q.wage?`${money(Math.round(termsNeed(n,p)*.92/500)*500)}–${money(Math.round(termsNeed(n,p)*1.08/500)*500)} p/w`:'Ask the agent'}</dd></div><div><dt>Expected role</dt><dd>${q.wage?ROLES_SQ.find(r=>r[0]===n.expect)[1]:'Ask the agent'}</dd></div><div><dt>Agent fee</dt><dd>${q.fee?money(n.agentAsk):'Ask the agent'}</dd></div><div><dt>Competition</dt><dd>${q.comp?n.compWord:'Ask the agent'}</dd></div></dl>
 <p class="muted" style="font-size:13px">Agreed fee: <b>${money(n.fee)}</b>${n.addons?` + ${money(n.addons)} add-ons`:''}.</p></div></div>`;
}
function callAsk(k){
 const n=ui.neg,p=S.players[n.pid],ag=agentOf(p);n.asked[k]=1;
 const say=t=>n.call.push({t}),me=t=>n.call.push({t,me:1});
 if(k==='int'){me('Is he interested in joining us?');const i=n.interest=agentInterest(p);n.intWord=i>.15?'Very keen':i>0?'Open to it':i>-.15?'Needs convincing':'Reluctant';say(i>.15?`He'd love it. ${clubOf(S.user).short} is a step up for him.`:i>0?'He likes the project. Get the details right and we can do business.':i>-.15?`Honestly, he's happy where he is. You'll need to make it worth his while.`:`He has reservations. He'd need a big role and a strong offer.`)}
 if(k==='wage'){me('What is he looking for?');say(`Around ${money(Math.round(termsNeed(n,p)/500)*500)} a week, and he wants to be a ${ROLES_SQ.find(r=>r[0]===n.expect)[1].toLowerCase()}.`)}
 if(k==='fee'){me('And your fee?');say(`My fee would be ${money(n.agentAsk)}. That's standard for a deal this size.`)}
 if(k==='comp'){me('Is anyone else interested?');const rival=S.clubs.filter(c=>c.id!==S.user&&c.id!==p.club&&Math.abs(c.rep-clubOf(S.user).rep)<8).sort(()=>G.f()-.5)[0];n.rival=G.f()<.45&&rival?rival.id:null;n.compWord=n.rival?`${clubOf(n.rival).short} have called`:'No firm interest';say(n.rival?`I won't lie, ${clubOf(n.rival).name} have been in touch. If you want him, don't wait too long.`:`There's been some noise, nothing concrete. You're in pole position.`)}
 renderNeg();
}

/* ---------- selling: a rival director calls with a bid ---------- */
function offerCall(mid){
 const m=S.inbox.find(x=>x.id===mid);if(!m||!m.action||m.action.done)return;const o=m.action,p=S.players[o.pid],c=clubOf(o.club);
 if(!ui.oc||ui.oc.mid!==mid)ui.oc={mid,ask:nice(o.fee*1.2,5e4),msgs:[{t:`Hello, this is the director of football at ${c.name}. We've sent over a bid of ${money(o.fee)} for ${p.fn} ${p.ln}. Can we make this work?`}],stage:'open',max:Math.round(o.fee*(1.12+G.f()*.25)/5e4)*5e4,tries:0};
 renderOfferCall();
}
function renderOfferCall(){
 const oc=ui.oc,m=S.inbox.find(x=>x.id===oc.mid),o=m.action,p=S.players[o.pid],c=clubOf(o.club);
 const reps=oc.stage==='done'?[{label:'Close',act:'close'}]:[{label:`Accept ${money(o.fee)}`,act:'oc-accept',cls:'pri'},{label:'Counter with your price',act:'oc-counter'},{label:'He is not for sale',act:'oc-nfs'},{label:'Reject the bid',act:'oc-reject'}];
 const extra=oc.stage==='open'&&oc.counter?`<div class="ph-extra"><small>Your asking price</small>${stepper('oc','ask',oc.ask,{min:nice(o.fee,5e4),max:nice(o.fee*2.5,5e4),label:'Asking price',chips:[['Value',p.val],['+20%',o.fee*1.2],['+40%',o.fee*1.4]]})}<button class="btn pri" data-act="oc-name">Name your price</button></div>`:'';
 openModal(`<div class="oc">${phoneHTML({who:`${c.short} · Director of Football`,sub:`Bid for ${p.fn} ${p.ln} · valued at ${money(p.val)}`,avatar:crest(c.id,34),dur:callClock(oc.msgs.length),msgs:oc.msgs,replies:oc.counter&&oc.stage==='open'?[]:reps,extra,hang:'close'})}</div>`);
}
function offerCallAct(a){
 const oc=ui.oc,m=S.inbox.find(x=>x.id===oc.mid),o=m.action,p=S.players[o.pid],c=clubOf(o.club),me=t=>oc.msgs.push({t,me:1}),say=t=>oc.msgs.push({t});
 if(a==='counter'){oc.counter=true;me('We would need more than that.');return renderOfferCall()}
 if(a==='name'){oc.tries++;me(`${money(oc.ask)} and he's yours.`);
  if(oc.ask<=oc.max){o.fee=oc.ask;say(`...Fine. ${money(oc.ask)} it is. Send the paperwork.`);oc.counter=false;return completeOfferSale(m,true)}
  if(oc.tries>=2||oc.ask>oc.max*1.35){say(`That's way beyond what we can do. We'll look elsewhere.`);o.done='no';oc.stage='done';oc.counter=false;save();return renderOfferCall()}
  const mid=nice((oc.ask+oc.max)/2*.97,5e4);o.fee=Math.max(o.fee,Math.min(mid,oc.max));say(`We can't go that high. Our final offer is ${money(o.fee)}.`);oc.counter=false;return renderOfferCall()}
 if(a==='accept')return completeOfferSale(m,true);
 if(a==='nfs'){me(`${p.ln} is not for sale.`);say('Understood. Thanks for your time.');o.done='no';p.mor=clamp(p.mor+5,25,98);oc.stage='done';save();return renderOfferCall()}
 if(a==='reject'){me('We are rejecting the bid.');say('Disappointing. We may come back.');o.done='no';oc.stage='done';save();return renderOfferCall()}
}
function completeOfferSale(m,fromCall){
 const o=m.action,p=S.players[o.pid],c=clubOf(o.club),why=canSell(p);
 if(p.club!==S.user){toast('He is no longer at the club.');return}if(why){toast(why);return}
 moveP(p.id,o.club,o.fee);S.fin.sales+=o.fee;if(o.fee>=50e6)unlock('sell50');logDeal(p.id,S.user,o.club,o.fee);o.done='yes';
 news(`${p.fn} ${p.ln} joins ${c.name} from ${clubOf(S.user).name} for ${money(o.fee)}.`,'transfer',[o.club,S.user]);toast(`${p.ln} sold for ${money(o.fee)}`);
 if(ui.oc){ui.oc.stage='done';ui.oc.msgs.push({t:`Pleasure doing business. We'll confirm ${p.ln}'s medical today.`})}save();if(fromCall)renderOfferCall();render();
}

/* ---------- stepper targets ---------- */
STEP_TARGETS.neg={obj:()=>ui.neg,redraw:()=>renderNeg(),lim:k=>{const n=ui.neg,p=S.players[n.pid],uc=clubOf(S.user);
 if(k==='fee')return{min:nice(p.val*.3,5e4),max:nice(Math.max(p.val*.7,Math.min(uc.budget*(n.inst?2:1),p.val*2.6)),5e4),step:nice(n.est*.025,5e4)};
 if(k==='addons')return{min:0,max:nice(p.val*.5,5e4),step:nice(p.val*.025,5e4)};
 if(k==='wage'){const need=termsNeed(n,p);return{min:nice(need*.55,500),max:Math.max(nice(need*.55,500),nice(Math.min(need*1.7,uc.wageBudget-wageBill(S.user)),500)),step:nice(need*.025,250)}}
 if(k==='bonus')return{min:0,max:nice(p.wage*60,1e4),step:nice(p.wage*2,1e4)};
 if(k==='agentFee')return{min:0,max:nice(n.agentAsk*2,1e4),step:nice(n.agentAsk*.1,1e4)};}};
STEP_TARGETS.oc={obj:()=>ui.oc,redraw:()=>renderOfferCall(),lim:()=>{const o=S.inbox.find(x=>x.id===ui.oc.mid).action;return{min:nice(o.fee,5e4),max:nice(o.fee*2.5,5e4),step:nice(o.fee*.05,5e4)}}};
STEP_TARGETS.ren={obj:()=>ui.ren,redraw:()=>renderRenew(),lim:()=>{const p=S.players[ui.ren.pid],d=renewDemand(p),room=clubOf(S.user).wageBudget-wageBill(S.user)+p.wage;return{min:nice(p.wage*.8,100),max:Math.max(p.wage,Math.min(room,nice(d*1.6,100))),step:nice(d*.025,100)}}};
STEP_TARGETS.sc={obj:()=>ui.sc,redraw:()=>render(),lim:()=>({min:17,max:35,step:1})};
STEP_TARGETS.split={obj:()=>ui.split||(ui.split={w:clubOf(S.user).wageBudget,season:S.season,md:S.md}),redraw:()=>render(),lim:()=>{const c=clubOf(S.user),wb=wageBill(S.user),total=c.budget+c.wageBudget*WAGE_TO_FEE;return{min:Math.round(wb/1000)*1000,max:Math.max(Math.round(wb/1000)*1000+1000,Math.round(Math.min(total/WAGE_TO_FEE,wb*1.8)/1000)*1000),step:1000}}};
