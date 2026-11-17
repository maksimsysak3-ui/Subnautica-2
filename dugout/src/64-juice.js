/* ================= charts, celebrations, training, team talks, honours ================= */
// ---- charts ----
function radarSVG(axes,series,size=260){
 const n=axes.length,c=size/2,r=size/2-38,pt=(i,v)=>{const a=-Math.PI/2+i/n*Math.PI*2;return[c+Math.cos(a)*r*v,c+Math.sin(a)*r*v]};
 let g='';for(const k of[.25,.5,.75,1])g+=`<polygon points="${axes.map((_,i)=>pt(i,k).join(',')).join(' ')}" fill="none" stroke="#2c2c30" stroke-width="1"/>`;
 axes.forEach((a,i)=>{const[x,y]=pt(i,1),[lx,ly]=pt(i,1.17);g+=`<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="#2c2c30"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-family="Barlow Condensed,sans-serif" font-weight="700" letter-spacing=".5" fill="#9a9993">${a.toUpperCase()}</text>`});
 for(const s of series)g+=`<polygon points="${s.v.map((v,i)=>pt(i,clamp(v/20,0,1)).join(',')).join(' ')}" fill="${s.c}" fill-opacity="${s.o??.22}" stroke="${s.c}" stroke-width="2"/>`;
 return`<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Team profile chart">${g}</svg>`;
}
function sparkSVG(vals,w=260,h=70){
 if(!vals||vals.length<2)return'<p class="muted" style="font-size:12px;margin:0">Value history builds up as the season goes on.</p>';
 const mn=Math.min(...vals),mx=Math.max(...vals),rg=mx-mn||1,X=i=>4+i/(vals.length-1)*(w-8),Y=v=>h-6-(v-mn)/rg*(h-14),up=vals[vals.length-1]>=vals[0],col=up?'#5fbf8a':'#d9775f';
 const d=vals.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
 return`<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Value trend"><path d="${d}L${X(vals.length-1)},${h}L${X(0)},${h}Z" fill="${col}" fill-opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2"/><circle cx="${X(vals.length-1)}" cy="${Y(vals[vals.length-1])}" r="3.5" fill="${col}"/></svg>`;
}
function profile(cid,t){
 const xi=(t||clubOf(cid).tac).xi,form=(t||clubOf(cid).tac).form,slots=FORMATIONS[form],ps=xi.map(id=>S.players[id]).filter(Boolean);
 const grp=g=>ps.filter(p=>g.includes(slots[xi.indexOf(p.id)][0])),av=(list,keys)=>list.length?at20(list.reduce((a,p)=>a+keys.reduce((b,k)=>b+p.at[AIX[k]],0)/keys.length,0)/list.length):8,out=ps.filter(p=>p.pos!=='GK');
 return[av(grp(['CB','LB','RB','DM','GK']),['pas','vis','fir','cmp']),av(grp(['CM','AM','LW','RW']),['vis','pas','dri','cro']),av(grp(['ST','LW','RW','AM']),['fin','cmp','lon']),av(grp(['CB','ST']),['hea','jmp','str']),av(out,['pac','acc']),av(out,['wor','sta','agg']),av(grp(['CB','LB','RB','DM']),['tck','mar','pos']),av(grp(['GK']),['ref','div','han','one'])];
}
const PROFILE_AXES=['Build-up','Creation','Finishing','Aerial','Pace','Pressing','Defending','Keeping'];
function tacticsCharts(t){
 const fx=userFixture(),opp=fx?(fx[0]===S.user?fx[1]:fx[0]):null;if(opp!=null)prepAI(opp,S.user);
 const me=profile(S.user,t),op=opp!=null?profile(opp):null,c=clubOf(S.user),oc=opp!=null?clubOf(opp):null;
 const oppCol=oc?(contrast(oc.colors[0],'#0a0a0b')<2?oc.colors[1]:oc.colors[0]):'#888';
 const xi=t.xi.map(id=>S.players[id]).filter(Boolean);
 return`<section class="panel"><div class="ph"><h3>Team profile</h3><small>${oc?`vs ${esc(oc.short)} (next match)`:''}</small></div><div class="pb tc-charts"><div>${radarSVG(PROFILE_AXES,[...(op?[{v:op,c:oppCol,o:.12}]:[]),{v:me,c:'#e9e6df',o:.25}])}
 <div class="legend" style="justify-content:center"><span><i style="background:#e9e6df"></i>${esc(c.short)}</span>${oc?`<span><i style="background:${oppCol}"></i>${esc(oc.short)}</span>`:''}</div></div>
 <div class="tc-list">${PROFILE_AXES.map((a,i)=>`<div class="tcl"><span>${a}</span><b>${me[i]}</b>${op?`<em class="${me[i]>op[i]?'v5':me[i]<op[i]?'v2':''}">${me[i]>op[i]?'+':''}${me[i]-op[i]}</em>`:''}</div>`).join('')}</div></div>
 <div class="ph" style="border-top:1px solid var(--line)"><h3>Starting XI condition</h3><small>Avg ${Math.round(xi.reduce((a,p)=>a+p.cond,0)/Math.max(1,xi.length))}%</small></div><div class="pb cond-bars">${xi.map(p=>`<div title="${esc(p.ln)} ${p.cond}%"><i style="height:${p.cond}%;background:${p.cond<70?'#d9775f':p.cond<85?'#d6b14e':'#5fbf8a'}"></i><span>${p.num}</span></div>`).join('')}</div></section>`;
}

// ---- celebrations ----
function fxOverlay(html,cls,ms){
 let el=$('#fx');if(!el){el=document.createElement('div');el.id='fx';document.body.appendChild(el)}
 el.className='fx '+cls;el.innerHTML=html+'<div class="fx-confetti">'+Array.from({length:60},(_,i)=>`<i style="--x:${Math.random()*100}%;--d:${(Math.random()*1.2).toFixed(2)}s;--r:${Math.random()*720-360}deg;--c:${['#e9e6df','#ffb43a','#5fbf8a','#6e9fd1','#d9775f'][i%5]}"></i>`).join('')+'</div><button class="fx-skip" data-act="fx-close">Continue</button>';
 el.hidden=false;void el.offsetWidth;el.classList.add('show');clearTimeout(fxOverlay.t);if(ms)fxOverlay.t=setTimeout(()=>fxClose(),ms);
}
function fxClose(){const el=$('#fx');if(el){el.hidden=true;el.innerHTML=''}if(fxQueue.length)fxQueue.shift()()}
const fxQueue=[];
function celebrateSigning(p,fee){
 const c=clubOf(S.user);
 fxOverlay(`<div class="sg" style="--cc:${c.colors[0]};--c2:${c.colors[1]}"><div class="sg-sweep"></div><div class="sg-crest">${crest(c.id,120)}</div>
 <div class="sg-shirt">${kitSVG(c,'home',{back:true,name:p.ln,num:p.num})}</div>
 <div class="sg-text"><div class="sg-eyebrow">Official · ${esc(c.name)}</div><h1>${esc(p.fn)} <b>${esc(p.ln)}</b></h1><div class="sg-stamp">Signed</div>
 <div class="sg-row"><span>${posChip(p.pos)} ${POS_NAME[p.pos]}</span><span>${p.age} years</span><span>${flagSVG(p.nat)} ${esc(NATIONS[p.nat].n)}</span></div><div class="sg-fee">${fee?money(fee):'Free transfer'}</div></div></div>`,'sign',7000);
}
function celebrateTrophy(title,sub,cid){
 const c=clubOf(cid);
 fxOverlay(`<div class="tr" style="--cc:${c.colors[0]}"><svg class="tr-cup" viewBox="0 0 120 150" aria-hidden="true"><defs><linearGradient id="cupg" x1="0" x2="1"><stop offset="0" stop-color="#8a6a1c"/><stop offset=".45" stop-color="#f6dd8a"/><stop offset="1" stop-color="#9c7a22"/></linearGradient></defs><path d="M30 12h60v28c0 22-14 38-30 40-16-2-30-18-30-40z" fill="url(#cupg)"/><path d="M30 20H14c0 18 8 28 18 30M90 20h16c0 18-8 28-18 30" fill="none" stroke="url(#cupg)" stroke-width="6"/><rect x="54" y="80" width="12" height="26" fill="url(#cupg)"/><path d="M36 106h48l6 18H30z" fill="url(#cupg)"/><rect x="26" y="124" width="68" height="14" fill="#2a2a2e"/></svg>
 ${crest(cid,90)}<div class="sg-eyebrow">${esc(sub)}</div><h1>${esc(title)}</h1></div>`,'trophy',0);
}
function revealYouth(ids){
 const ps=ids.map(id=>S.players[id]).filter(Boolean);if(!ps.length)return;
 fxOverlay(`<div class="yi"><div class="sg-eyebrow">Youth intake · ${seasonLabel()}</div><h1>The class of ${2026+S.season}</h1><div class="yi-cards">${ps.map((p,i)=>`<div class="yi-card" style="--i:${i}">${kitSVG(clubOf(S.user),'home',{back:true,name:p.ln,num:p.num})}<b>${esc(p.fn+' '+p.ln)}</b><small>${posChip(p.pos)} ${p.age} · ${flagSVG(p.nat)}</small><div><small>Potential</small>${starHTML(stars(p.pot))}</div></div>`).join('')}</div></div>`,'youth',0);
}

// ---- training ----
function viewTraining(){
 const t=S.train,sq=squadOf(S.user),dev=sq.filter(p=>p.ovr0!=null&&p.ovr!==p.ovr0).sort((a,b)=>(b.ovr-b.ovr0)-(a.ovr-a.ovr0));
 return`<div class="grid"><section class="panel c8"><div class="ph"><h3>Training focus</h3><small>Applies every week until you change it</small></div><div class="pb train-grid">${Object.entries(TRAIN).map(([k,v])=>`<button class="train-card" data-act="train" data-v="${k}" aria-pressed="${t.focus===k}"><b>${v.n}</b><small>${v.d}</small></button>`).join('')}</div>
 <div class="pb" style="border-top:1px solid var(--line)"><div class="eyebrow" style="color:var(--muted)">Intensity</div><div class="seg" role="group" aria-label="Training intensity" style="margin-top:8px">${['Light','Normal','Intense'].map((l,i)=>`<button data-act="train-int" data-v="${i}" aria-pressed="${t.int===i}">${l}</button>`).join('')}</div>
 <p class="muted" style="font-size:13px">${['Light sessions: players recover faster but develop more slowly.','Normal workload.','Intense sessions: players develop faster, but fatigue builds and injuries are more likely.'][t.int]}</p></div></section>
 <section class="panel c4"><div class="ph"><h3>Development this season</h3></div><div class="list">${dev.length?dev.slice(0,12).map(p=>{const d=p.ovr-p.ovr0;return`<button class="li" data-act="player" data-id="${p.id}">${posChip(p.pos)}<span><b>${pName(p)}</b><small>${p.age} · ${starHTML(stars(p.ovr))}</small></span><b class="av ${d>0?'v5':'v2'}">${d>0?'▲ +':'▼ '}${d}</b></button>`}).join(''):'<p class="pb muted">No changes yet. Young players improve through the season.</p>'}</div></section></div>`;
}

// ---- team talks ----
const TALKS=[['calm','Stay calm','Keep your heads.'],['motivate','Motivate','Go out and enjoy it.'],['demand','Demand more','I expect better than this.'],['praise','Praise','Brilliant, keep it going.']];
function talkEffect(kind,diff,half){
 // diff = our goals minus theirs at the time of the talk
 const t={calm:diff<0?.01:.015,motivate:half?(diff<=0?.03:.01):.025,demand:diff<0?.045:diff===0?.02:-.03,praise:diff>0?.03:diff===0?0:-.035}[kind];
 return t+(G.f()-.5)*.02;
}
function applyTalk(E,s,delta){for(const p of E.T[s].pl){if(p.off)continue;for(const k of['dec','cmp','wor','fin','pas','pos'])p.a[k]=clamp(p.a[k]*(1+delta),.05,1)}}
const talkWord=d=>d>.025?'The players look fired up.':d>.008?'The players respond well.':d>-.008?'The message has little effect.':'The players look rattled by your words.';
function talkHTML(half){const E=M&&M.E,diff=E?E.score[M.us]-E.score[1-M.us]:0;
 return`<div class="talk"><div class="eyebrow">${half?'Half-time team talk':'Pre-match team talk'}</div><h2>${half?`${M.score[0]}–${M.score[1]} at the break`:'Final words before kick-off'}</h2><p class="muted">${half?(diff>0?'You are ahead. Keep them focused.':diff<0?'You are behind. They need a reaction.':'All square. Push them on.'):'Set the tone for the match.'}</p>
 <div class="talk-grid">${TALKS.map(([k,l,q])=>`<button class="train-card" data-act="talk" data-v="${k}" data-half="${half?1:0}"><b>${l}</b><small>"${q}"</small></button>`).join('')}</div>${half?'<div class="toolbar" style="margin:12px 0 0"><button class="btn" data-act="talk-skip">Skip</button></div>':''}</div>`}

// ---- honours ----
function viewHonours(){
 const m=S.mgr,games=m.w+m.d+m.l,trophies=m.trophies;
 return`<div class="grid"><section class="panel c4"><div class="ph"><h3>Manager profile</h3></div><div class="pb"><dl class="facts"><div><dt>Reputation</dt><dd>${starHTML(stars(30+m.rep*.6))}</dd></div><div><dt>Seasons</dt><dd>${m.seasons}</dd></div><div><dt>Matches</dt><dd>${games}</dd></div><div><dt>Win rate</dt><dd>${games?Math.round(m.w/games*100)+'%':'–'}</dd></div><div><dt>Record</dt><dd>${m.w}W ${m.d}D ${m.l}L</dd></div><div><dt>Trophies</dt><dd>${trophies.filter(t=>!t.minor).length}</dd></div></dl>
 ${m.clubs.length?`<div class="eyebrow" style="color:var(--muted);margin-top:8px">Previous clubs</div>${m.clubs.map(x=>`<div class="li" style="grid-template-columns:auto 1fr auto">${crest(x.club,20)}<span><b>${esc(clubOf(x.club).name)}</b><small>${x.reason}</small></span><small>${x.season}</small></div>`).join('')}`:''}</div></section>
 <section class="panel c8"><div class="ph"><h3>Trophy cabinet</h3></div><div class="pb">${trophies.length?`<div class="cabinet">${trophies.map(t=>`<div class="cup ${t.minor?'minor':''}"><svg viewBox="0 0 120 150" aria-hidden="true"><path d="M30 12h60v28c0 22-14 38-30 40-16-2-30-18-30-40z" fill="${t.minor?'#9aa0a6':'#d8b85a'}"/><path d="M30 20H14c0 18 8 28 18 30M90 20h16c0 18-8 28-18 30" fill="none" stroke="${t.minor?'#9aa0a6':'#d8b85a'}" stroke-width="6"/><rect x="54" y="80" width="12" height="26" fill="${t.minor?'#9aa0a6':'#d8b85a'}"/><path d="M36 106h48l6 18H30z" fill="${t.minor?'#9aa0a6':'#d8b85a'}"/><rect x="26" y="124" width="68" height="14" fill="#2a2a2e"/></svg><b>${esc(t.t)}</b><small>${t.season} · ${esc(clubOf(t.club).short)}</small></div>`).join('')}</div>`:'<p class="muted" style="margin:0">Your cabinet is empty. Win a league or earn promotion to fill it.</p>'}</div></section>
 <section class="panel c12"><div class="ph"><h3>Season by season</h3></div>${S.hist.length?`<div class="tw"><table class="tbl"><thead><tr><th>Season</th><th>Competition</th><th class="r">Finish</th></tr></thead><tbody>${S.hist.map(h=>`<tr><td>${h.season}</td><td>${esc(h.league)}</td><td class="r"><b>${ordinal(h.pos)}</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="pb muted">Your first season is under way.</p>'}</section></div>`;
}
function jobsModal(ids,title,sub,forced){
 openModal(`<div class="eyebrow">${esc(sub)}</div><h2 style="font-size:28px;margin:6px 0 14px">${esc(title)}</h2><div class="jobs">${ids.map(id=>{const c=clubOf(id);return`<div class="job" style="--cc:${c.colors[0]}">${crest(id,56)}<div><b>${esc(c.name)}</b><small>${esc(S.leagues[c.league].name)} · ${starHTML(stars(repToOvr(c.rep)))}</small><small>Budget ${money(c.budget)} · objective: ${expectation(id).toLowerCase()}</small></div><button class="btn pri" data-act="job" data-id="${id}">Accept</button></div>`}).join('')}</div>${forced?'':'<div class="toolbar" style="margin:14px 0 0"><button class="btn" data-act="close">Stay at your club</button></div>'}`);
}
