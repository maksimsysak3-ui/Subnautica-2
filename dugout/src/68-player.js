/* ================= player profile, contracts and happiness ================= */
ui.pTab='overview';ui.ren=null;
const PERSONALITIES=[['Model professional','Trains hard and sets the standard for everyone around him.'],['Ambitious','Wants to play at the highest level and win trophies.'],['Resolute','Rarely rattled; thrives when the pressure is on.'],['Determined','Never gives up on a lost cause.'],['Leader','Organises those around him and lifts the dressing room.'],['Fairly professional','Does what is asked of him, rarely more.'],['Easy-going','Relaxed, popular, occasionally lacks urgency.'],['Temperamental','Brilliant on his day but prone to cards and outbursts.'],['Spirited','Plays with energy and visible passion.']];
const personality=p=>PERSONALITIES[(Math.imul(p.id+7,2654435761)>>>0)%PERSONALITIES.length];
const PROMISES=[['key','Key player'],['first','First-team regular'],['rot','Rotation option'],['back','Backup'],['youth','Youngster']];
const IND_FOCUS={none:['Follow team schedule',null],finishing:['Finishing',['fin','lon','cmp']],creativity:['Creativity',['pas','vis','fir','dec']],dribbling:['Ball carrying',['dri','agi','fir']],defending:['Defending',['tck','mar','pos']],aerial:['Aerial',['hea','jmp','str']],physical:['Athleticism',['pac','acc','sta']],keeping:['Goalkeeping',['ref','han','div','one']]};
function squadRole(p){if(p.prom)return p.prom;const sq=squadOf(p.club).filter(q=>GROUP[q.pos]===GROUP[p.pos]).sort((a,b)=>b.ovr-a.ovr),i=sq.indexOf(p);return p.age<=19?'youth':i===0?'key':i<(GROUP[p.pos]==='GK'?1:3)?'first':i<5?'rot':'back'}
const promName=k=>(PROMISES.find(x=>x[0]===k)||['',''])[1];
function happiness(p){const m=p.mor;return m>=85?['Very happy','v6']:m>=70?['Content','v5']:m>=55?['Settled','v4']:m>=40?['Frustrated','v3']:['Unhappy','v2']}
function cardAxes(p){const a=k=>at20(p.at[AIX[k]]),m=(...ks)=>Math.round(ks.reduce((s,k)=>s+a(k),0)/ks.length);
 return p.pos==='GK'?[['Reflexes',a('ref')],['Handling',a('han')],['Diving',a('div')],['One on ones',a('one')],['Positioning',a('pos')],['Distribution',a('pas')]]
 :[['Pace',m('pac','acc')],['Shooting',m('fin','lon')],['Passing',m('pas','vis')],['Dribbling',m('dri','fir','agi')],['Defending',m('tck','mar','pos')],['Physical',m('str','sta','jmp')]]}
function strengths(p){const keys=(p.pos==='GK'?['ref','han','div','one','pos','cmp','dec','pas']:ATTRS.filter(k=>!['ref','han','div','dst','one'].includes(k))).map(k=>[k,at20(p.at[AIX[k]])]).sort((a,b)=>b[1]-a[1]);return{good:keys.slice(0,4),bad:keys.slice(-3).reverse()}}
function ovrHistSVG(p){
 const pts=(p.oh||[]).concat([p.ovr]);if(pts.length<2)return'<p class="muted" style="margin:0">Progress is charted every few matchdays.</p>';
 const W=600,H=150,mn=Math.min(...pts)-2,mx=Math.max(...pts,p.pot)+1,X=i=>16+i*(W-32)/(pts.length-1),Y=v=>H-16-(v-mn)/(mx-mn)*(H-30);
 return`<svg class="an-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ability over time"><line x1="16" x2="${W-16}" y1="${Y(p.pot)}" y2="${Y(p.pot)}" stroke="#e8c25a" stroke-dasharray="4 4" opacity=".6"/><text x="${W-18}" y="${Y(p.pot)-5}" text-anchor="end" font-size="10" fill="#e8c25a">Potential ${starsText(p.pot)}</text>
 <path d="M${pts.map((v,i)=>`${X(i)} ${Y(v)}`).join(' L')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>${pts.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="#141416" stroke="var(--accent)" stroke-width="2"/>`).join('')}</svg>`;
}
const starsText=v=>stars(v).toFixed(1).replace('.0','')+'★';
function viewPlayer(){
 const p=S.players[ui.pid];if(!p)return'<p>Player not found.</p>';
 const c=clubOf(p.club),mine=p.club===S.user,per=personality(p),[hp,hc]=happiness(p),role=squadRole(p),sw=strengths(p),shortl=S.shortlist.includes(p.id);
 const badges=[p.inj?`<span class="chip bad">Injured · ${p.inj} md</span>`:'',p.ban?`<span class="chip bad">Suspended · ${p.ban} md</span>`:'',p.tl?'<span class="chip">Transfer listed</span>':'',mine&&p.con<=1?'<span class="chip warn">Contract expiring</span>':'',(p.hon||[]).length?`<span class="chip ok">${p.hon.length} honour${p.hon.length>1?'s':''}</span>`:''].join('');
 const tabs=[['overview','Overview'],['career','Career'],['contract','Contract'],['dev','Development']];
 const hero=`<section class="pp2-hero" style="--cc:${c.colors[0]==='#ffffff'?c.colors[1]:c.colors[0]}"><div class="pp2-kit">${kitSVG(c,'home',{back:true,name:p.ln,num:p.num})}</div>
 <div class="pp2-main"><div class="pp2-club">${crest(c.id,22)} ${esc(c.name)} · No. ${p.num}</div><h1>${esc(p.fn)} <b>${esc(p.ln)}</b></h1>
 <div class="pp2-meta"><span>${posChip(p.pos)} ${POS_NAME[p.pos]}${p.sec.length?` <small>also ${p.sec.join(', ')}</small>`:''}</span><span>${flagSVG(p.nat)} ${esc(NATIONS[p.nat].n)}</span><span>${p.age} years</span><span>${p.ht} cm</span><span>${p.foot==='L'?'Left':'Right'} foot</span></div>
 <div class="pp2-badges">${badges}</div></div>
 <div class="pp2-rate"><div><small>Current ability</small>${starHTML(stars(p.ovr))}</div><div><small>Potential ability</small>${starHTML(stars(p.pot))}</div><div><small>Value</small><b>${money(p.val)}</b></div></div>
 <div class="pp2-tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-act="p-tab" data-v="${k}" aria-selected="${ui.pTab===k}">${l}</button>`).join('')}</div></section>`;
 const t=ui.pTab;let body='';
 if(t==='career'){const car=(p.car||[]).slice().reverse(),cur={season:seasonLabel(),club:p.club,ap:p.s.ap,g:p.s.g,a:p.s.a,r:avg(p)},all=[cur,...car],tot=all.reduce((a,x)=>({ap:a.ap+x.ap,g:a.g+x.g,a:a.a+x.a}),{ap:0,g:0,a:0});
  body=`<div class="grid"><section class="panel c8"><div class="ph"><h3>Career statistics</h3><small>${tot.ap} apps · ${tot.g} goals · ${tot.a} assists</small></div><div class="tw"><table class="tbl"><thead><tr><th>Season</th><th>Club</th><th class="r">Apps</th><th class="r">Goals</th><th class="r">Assists</th><th class="r">Av rating</th></tr></thead><tbody>
  ${all.map((x,i)=>`<tr class="${i===0?'me':''}"><td>${x.season}${i===0?' <small>(current)</small>':''}</td><td><div class="who">${crest(x.club,16)}${esc(clubOf(x.club).short)}</div></td><td class="r">${x.ap}</td><td class="r">${x.g}</td><td class="r">${x.a}</td><td class="r">${x.r?(+x.r).toFixed(2):'–'}</td></tr>`).join('')}</tbody></table></div></section>
  <section class="panel c4"><div class="ph"><h3>Honours</h3></div><div class="list">${(p.hon||[]).slice().reverse().map(h=>`<div class="li" style="grid-template-columns:28px 1fr"><svg viewBox="0 0 100 100" width="24" height="24"><path d="${TROPHY}" fill="#e8c25a"/></svg><span><b>${esc(h.t)}</b><small>${esc(h.lg)} · ${h.season}</small></span></div>`).join('')||'<p class="pb muted" style="margin:0">No individual honours yet.</p>'}</div></section></div>`}
 else if(t==='contract'){const ren=mine?`<button class="btn pri" data-act="renew" data-id="${p.id}">Offer new contract</button>`:'';
  body=`<div class="grid"><section class="panel c6"><div class="ph"><h3>Contract</h3></div><div class="pb"><dl class="facts"><div><dt>Wage</dt><dd>${money(p.wage)} p/w</dd></div><div><dt>Expires</dt><dd>June ${2027+S.season+p.con-1} <small>(${p.con} season${p.con>1?'s':''})</small></dd></div><div><dt>Squad status</dt><dd>${promName(role)}${p.prom?' <small>(promised)</small>':''}</dd></div><div><dt>Market value</dt><dd>${money(p.val)}</dd></div><div><dt>Release clause</dt><dd>${p.rc?money(p.rc):'None'}</dd></div><div><dt>Happiness</dt><dd><span class="${hc}">${hp}</span></dd></div></dl>
  <div class="toolbar" style="margin:12px 0 0">${mine?`${ren}<button class="btn" data-act="tlist" data-id="${p.id}">${p.tl?'Remove from transfer list':'Transfer list'}</button><button class="btn" data-act="sell" data-id="${p.id}">Find a buyer</button>`:`<button class="btn pri" data-act="negotiate" data-id="${p.id}">Make an offer</button><button class="btn" data-act="shortlist" data-id="${p.id}">${shortl?'Remove from shortlist':'Add to shortlist'}</button>`}</div></div></section>
  <section class="panel c6"><div class="ph"><h3>Personality</h3></div><div class="pb"><div class="pp2-per"><b>${per[0]}</b><p>${per[1]}</p></div><p class="muted" style="font-size:13px;margin:10px 0 0">${mine?(p.mor<55?`${esc(p.ln)} is not happy at the moment. ${p.prom&&['key','first'].includes(p.prom)?'He feels you are not keeping your promise about playing time.':'A new contract or more minutes could help.'}`:`${esc(p.ln)} is settled at the club.`):`Agents suggest he would consider a move${c.rep<clubOf(S.user).rep?' to a bigger club':''}.`}</p></div></section></div>`}
 else if(t==='dev'){const f=p.tf||'none',dv=p.ovr-(p.ovr0||p.ovr);
  body=`<div class="grid"><section class="panel c8"><div class="ph"><h3>Ability over time</h3><small>${dv>0?`+${dv} this season`:dv<0?`${dv} this season`:'No change this season'}</small></div><div class="pb">${ovrHistSVG(p)}</div></section>
  <section class="panel c4"><div class="ph"><h3>Individual training</h3></div><div class="pb">${mine?`<p class="muted" style="font-size:13px;margin:0 0 10px">Give him a personal focus on top of the team schedule. Under-24s with room to grow develop fastest.</p><div class="tf-grid">${Object.entries(IND_FOCUS).filter(([k])=>k!=='keeping'||p.pos==='GK').map(([k,[l]])=>`<button class="tf ${f===k?'on':''}" data-act="tfocus" data-id="${p.id}" data-v="${k}">${l}</button>`).join('')}</div>`:'<p class="muted" style="margin:0">Only your own players can be given individual training.</p>'}</div></section>
  <section class="panel c6"><div class="ph"><h3>Market value</h3>${trendHTML(p)}</div><div class="pb"><div class="kpi sm">${money(p.val)}</div>${sparkSVG((p.vh||[]).map(v=>v*1e4).concat([p.val]))}</div></section>
  <section class="panel c6"><div class="ph"><h3>Outlook</h3></div><div class="pb" style="font-size:13px;line-height:1.6">${p.age<=23&&p.pot>p.ovr+3?`At ${p.age}, ${esc(p.ln)} still has plenty of growth in him. Regular football and focused training will help him reach ${starsText(p.pot)}.`:p.age>=31?`${esc(p.ln)} is past his peak; expect his physical attributes to start declining.`:`${esc(p.ln)} is at or near his peak.`}</div></section></div>`}
 else{const groups=p.pos==='GK'?['Goalkeeping','Mental','Physical']:['Technical','Mental','Physical'],ax=cardAxes(p);
  const posmap=Object.entries({GK:[50,94],CB:[50,78],LB:[14,72],RB:[86,72],DM:[50,62],CM:[50,48],AM:[50,32],LW:[14,28],RW:[86,28],ST:[50,12]}).map(([k,[x,y]])=>`<i class="${p.pos===k?'n':p.sec.includes(k)?'s':'x'}" style="left:${x}%;top:${y}%">${k}</i>`).join('');
  body=`<div class="grid"><section class="panel c8"><div class="ph"><h3>Attributes</h3><small>out of 20</small></div><div class="pb attrs">${groups.map(g=>`<div class="ag"><h4>${g}</h4>${ATTR_GROUPS[g].map(a=>{const v=at20(p.at[AIX[a]]);return`<div class="ar"><span>${ATTR_NAME[a]}</span><b class="${v>=16?'v6':v>=13?'v5':v>=10?'v4':v>=7?'v3':'v2'}">${v}</b></div>`}).join('')}</div>`).join('')}</div></section>
  <section class="panel c4"><div class="ph"><h3>Profile</h3></div><div class="pb" style="display:grid;place-items:center">${radarSVG(ax.map(x=>x[0]),[{v:ax.map(x=>x[1]),c:'#ffb43a'}],250)}</div></section>
  <section class="panel c4"><div class="ph"><h3>Strengths and weaknesses</h3></div><div class="pb sw"><div><small>Strengths</small>${sw.good.map(([k,v])=>`<span class="v6">${ATTR_NAME[k]} <b>${v}</b></span>`).join('')}</div><div><small>Weaknesses</small>${sw.bad.map(([k,v])=>`<span class="v2">${ATTR_NAME[k]} <b>${v}</b></span>`).join('')}</div></div></section>
  <section class="panel c4"><div class="ph"><h3>Positions</h3></div><div class="pb"><div class="posmap">${posmap}</div></div></section>
  <section class="panel c4"><div class="ph"><h3>This season</h3></div><div class="pb"><dl class="facts"><div><dt>Appearances</dt><dd>${p.s.ap}</dd></div><div><dt>Goals</dt><dd>${p.s.g}</dd></div><div><dt>Assists</dt><dd>${p.s.a}</dd></div><div><dt>Player of the match</dt><dd>${p.s.mom}</dd></div><div><dt>Average rating</dt><dd>${avg(p)?avg(p).toFixed(2):'–'}</dd></div><div><dt>Condition</dt><dd>${p.cond}%</dd></div></dl></div></section>
  <section class="panel c12"><div class="ph"><h3>Scout report</h3><small>${per[0]}</small></div><div class="pb" style="font-size:13.5px;line-height:1.65">${scoutReport(p)}</div></section></div>`}
 return hero+body;
}

/* ---------- contract renewal ---------- */
function renewDemand(p){const role=squadRole(p),k={key:1.35,first:1.2,rot:1.05,back:.95,youth:.9}[role]||1;return Math.round(Math.max(p.wage*1.05,wageOf(p))*k*(p.age<=24?1.08:1)/100)*100}
function openRenew(pid){const p=S.players[pid];ui.ren={pid,wage:renewDemand(p),years:p.age>=31?2:p.age<=23?5:4,role:squadRole(p),tries:0,msg:''};renderRenew()}
function renderRenew(){
 const r=ui.ren,p=S.players[r.pid],d=renewDemand(p),room=clubOf(S.user).wageBudget-wageBill(S.user)+p.wage,max=Math.max(p.wage,Math.min(room,Math.round(d*1.6/100)*100));
 openModal(`<div class="eyebrow">Contract talks · ${esc(p.fn+' '+p.ln)}</div><h2 style="font-size:26px;margin:6px 0 4px">Offer a new contract</h2><p class="muted" style="margin:0 0 14px">Currently ${money(p.wage)} p/w until June ${2027+S.season+p.con-1}. His agent is looking for around <b>${money(d)}</b> p/w${p.age>=31?' and the security of a longer deal':''}.</p>
 <div class="neg-f"><label>Weekly wage <b id="rw-o">${money(r.wage)}</b></label><input type="range" min="${Math.round(p.wage*.8/100)*100}" max="${max}" step="100" value="${Math.min(r.wage,max)}" data-input="ren-w"></div>
 <div class="neg-f"><label>Length</label><div class="seg" role="group">${[1,2,3,4,5].map(y=>`<button data-act="ren-y" data-v="${y}" aria-pressed="${r.years===y}">${y} yr${y>1?'s':''}</button>`).join('')}</div></div>
 <div class="neg-f"><label>Squad status promised</label><div class="seg" role="group">${PROMISES.filter(x=>x[0]!=='youth'||p.age<=21).map(([k,l])=>`<button data-act="ren-r" data-v="${k}" aria-pressed="${r.role===k}">${l}</button>`).join('')}</div></div>
 ${r.msg?`<p class="ren-msg">${esc(r.msg)}</p>`:''}<p class="muted" style="font-size:12px">Wage room after this deal: ${money(room-r.wage)} p/w</p>
 <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-act="close">Walk away</button><button class="btn pri" data-act="ren-offer">Submit offer</button></div>`);
}
function renewOffer(){
 const r=ui.ren,p=S.players[r.pid],d=renewDemand(p),cur=squadRole(p),roleRank=k=>['back','youth','rot','first','key'].indexOf(k);
 const roleBonus=(roleRank(r.role)-roleRank(cur))*.06,yearsOk=p.age>=31?r.years>=2:p.age<=22?r.years<=5:true,need=d*(1-roleBonus)*(p.mor<50?1.1:1);
 const room=clubOf(S.user).wageBudget-wageBill(S.user)+p.wage;
 if(r.wage>room){r.msg='That would take you over the wage budget. Free up wages or ask the board for more.';return renderRenew()}
 if(roleRank(r.role)>roleRank(cur)+1){r.msg=`His agent doesn't believe the promise: "He knows where he stands in the squad. Be realistic."`;return renderRenew()}
 if(r.wage>=need&&yearsOk){p.wage=r.wage;p.con=r.years;p.prom=r.role;p.mor=clamp(p.mor+10,25,98);p.compl=0;closeModal();save();render();
  mail('Director of Football',`${p.ln} signs a new contract`,`<p>${esc(p.fn+' '+p.ln)} has agreed a new ${r.years}-year deal worth <b>${money(r.wage)}</b> a week, as a ${promName(r.role).toLowerCase()}.</p>`,null,'transfer',{att:{t:'player',pid:p.id,note:'New contract'},links:[['View player','player',p.id,1]]});toast(`${p.ln} has signed a new contract`);return}
 r.tries++;p.mor=clamp(p.mor-3,25,98);
 if(r.tries>=4){closeModal();toast(`${p.ln}'s agent has ended talks for now`);p.noTalks=S.md+6;save();render();return}
 r.msg=!yearsOk?(p.age>=31?'"At his age he wants security. At least two years."':'"He wants a long-term deal."'):`"We're not there yet. He's looking for something closer to ${money(Math.round(need/100)*100)} a week."`;renderRenew();
}

/* ---------- happiness and contract expiry, run each matchday ---------- */
function squadMood(){
 const xi=new Set(clubOf(S.user).tac.xi);
 for(const p of squadOf(S.user)){
  if(xi.has(p.id))p.benched=0;else p.benched=(p.benched||0)+1;
  const want=p.prom||squadRole(p),lim=want==='key'?3:want==='first'?5:99;
  if(p.benched>=lim){p.mor=clamp(p.mor-4,25,98);if(!p.compl||S.md-p.compl>8){p.compl=S.md;
   mail(p.fn+' '+p.ln,'Playing time',`<p>Boss, I was told I'd be a ${promName(want).toLowerCase()} here, but I haven't started for ${p.benched} matches. I want to be playing.</p>`,null,'staff',{att:{t:'player',pid:p.id},links:[['View player','player',p.id,1],['Tactics','nav','tactics']]})}}
 }
 if(S.md===24){const exp=squadOf(S.user).filter(p=>p.con<=1);if(exp.length)mail('Director of Football','Contracts expiring this summer',`<p>${exp.length} player${exp.length>1?'s are':' is'} out of contract at the end of the season and will leave on a free unless we agree new terms: ${exp.map(p=>esc(p.fn+' '+p.ln)).join(', ')}.</p>`,null,'transfer',{att:{t:'players',pids:exp.map(p=>p.id)},links:exp.slice(0,3).map(p=>[`Talk to ${p.ln}`,'player',p.id,1])})}
}
// At season end, the user's players whose contracts have run out leave on a free transfer.
function contractExits(){
 const gone=[];
 for(const p of squadOf(S.user).slice()){if(p.con>1)continue;if(squadOf(S.user).length<=18)break;
  const to=S.clubs.filter(c=>c.id!==S.user&&Math.abs(repToOvr(c.rep)-p.ovr)<8&&c.squad.length<30).sort(()=>G.f()-.5)[0];if(!to)continue;
  moveP(p.id,to.id,0);p.con=G.i(2,4);gone.push(p);news(`${p.fn} ${p.ln} joins ${to.name} on a free transfer after his contract with ${clubOf(S.user).name} expired.`,'transfer',[to.id,S.user])}
 if(gone.length)mail('Director of Football','Players released',`<p>These players left on free transfers when their contracts expired: ${gone.map(p=>esc(p.fn+' '+p.ln)).join(', ')}.</p>`,null,'transfer');
}
