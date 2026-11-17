/* ================= top navigation and the club hub ================= */
ui.dd=null;
const NAV_EXTRA={tactics:[['tactics','Tactics'],['squad/training','Training'],['squad/players','Squad']]};
function renderBar(){
 const c=clubOf(S.user),nt=nextUserTie(),unread=S.inbox.filter(m=>!m.read).length,tc=c.colors[0]==='#ffffff'?c.colors[1]:c.colors[0];
 document.body.classList.add('ingame','topnav');document.body.style.setProperty('--tc',tc);
 const opp=nt&&!nt.pending?clubOf(nt.h===S.user?nt.a:nt.h):null;
 const items=(k,subs)=>(NAV_EXTRA[k]||subs.map(([sk,sl])=>[k+'/'+sk,sl])).map(([dest,l])=>{const[v,sb]=dest.includes('/')?dest.split('/'):[k,dest];const on=view===v&&(sub===sb||(!sb&&true));
  return`<button class="tn-li ${on&&view===k?'on':''}" data-act="ddgo" data-v="${v}/${sb||''}">${esc(l)}${sb==='inbox'&&unread?` <em class="sb-badge">${unread}</em>`:''}</button>`}).join('');
 $('#bar').innerHTML=`<div class="tn"><button class="tn-logo" data-act="menu" title="Main menu (your career saves automatically)">${LOGO}<span>DUGOUT</span></button>
 <button class="tn-club" data-act="nav" data-v="club">${crest(S.user,30)}<b>${esc(c.short)}</b></button>
 <nav class="tn-nav" aria-label="Sections">${NAV.map(([k,l,subs])=>`<div class="tn-item ${view===k?'on':''} ${ui.dd===k?'open':''}"><button class="tn-btn" data-act="dd" data-v="${k}" aria-expanded="${ui.dd===k}" aria-haspopup="true">${l}${k==='home'&&unread?`<em class="sb-badge">${unread}</em>`:''}<i class="tn-caret" aria-hidden="true"></i></button><div class="tn-menu" role="menu">${items(k,subs)}</div></div>`).join('')}</nav>
 <div class="tn-r">${nt?`<div class="tn-next">${compBadge(nt.comp,18)}<span><small>${esc(nt.short)} · ${shortDate(nt.date)}</small><b>${opp?`${esc(opp.short)} <i>${nt.neutral?'N':nt.h===S.user?'H':'A'}</i>`:'Draw pending'}</b></span></div>`:''}<button class="go" data-act="continue"><span class="lbl">${nextLabel()}</span>${ARROW}</button></div></div>`;
}
function pageHead(){
 const nav=NAV.find(n=>n[0]===view),secName=nav?nav[1]:view==='player'?'Squad':view==='match'?'Match':'',title=(PAGE[view]||{})[sub]||(PAGE[view]||{})['']||secName;
 const nt=nextUserTie(),tabs=nav&&nav[2].length>1?`<div class="ph-tabs" role="tablist">${nav[2].map(([k,l])=>`<button role="tab" data-act="sub" data-v="${k}" aria-selected="${sub===k}">${l}</button>`).join('')}</div>`:view==='player'?`<div class="ph-tabs"><button data-act="back">‹ Back</button></div>`:'';
 return`<header class="pghead"><div class="pg-l"><div class="pg-crumb">${esc(clubOf(S.user).short)} <i>/</i> ${esc(secName)}</div><h1>${esc(title)}</h1></div>
 <div class="pg-r"><div class="pg-date"><b>${fmtDate(nt?nt.date:mdDate(MDAYS-1))}</b><small>${seasonLabel()} season · ${S.md<MDAYS?`Matchday ${S.md+1} of ${MDAYS}`:'Season complete'}</small></div></div>${tabs}</header>`;
}

/* ---------- the club hub ---------- */
function homeHub(){
 const c=clubOf(S.user),ct=curTie(),tb=table(c.league),lg=S.leagues[c.league],played=S.results[c.league].length,pos=played?posIn(tb,S.user):null;
 const sq=squadOf(S.user),sqx=c.tac.xi.map(id=>S.players[id]).filter(Boolean),avgOf=f=>sqx.length?Math.round(sqx.reduce((a,p)=>a+f(p),0)/sqx.length):0;
 const mor=avgOf(p=>p.mor),fit=avgOf(p=>p.cond),[bw,bcl]=boardWord(S.board),[fw,fcl]=fansWord(S.fans??62),fam=Math.round(c.tac.fam??55);
 // ---- match centre ----
 let mc;
 if(ct){
  const h=ct.h,a=ct.a,opp=h===S.user?a:h,oc=clubOf(opp),home=h===S.user,derby=isDerby(S.user,opp),hasTb=id=>tb.find(r=>r.id===id);
  const side=id=>{const r=hasTb(id),cl=clubOf(id),fm=formOf(id);return`<div class="mc-team"><div class="mc-crest">${crest(id,92)}</div><b>${esc(cl.name)}</b><small>${r&&played?`${ordinal(posIn(tb,id))} · ${r.pts} pts`:esc(S.leagues[cl.league].name)}</small><div class="mc-form">${fm.length?formHTML(fm):'<span class="muted">No games yet</span>'}</div></div>`};
  const wx=forecast(S.md,h),sU=strength(c.tac.xi,c.tac.form);prepAI(opp,S.user);const sO=strength(oc.tac.xi,oc.tac.form);
  const fp=id=>formOf(id).reduce((a,x)=>a+(x==='W'?3:x==='D'?1:0),0),gs=id=>{const r=hasTb(id);return r?[r.gf,r.ga]:[0,0]};
  const cmp=(l,x,y,fmt=v=>v,inv)=>{const tot=(x+y)||1,px=x/tot*100;return`<div class="tt-row"><span class="${(inv?x<y:x>y)?'w':''}">${fmt(x)}</span><small>${l}</small><span class="${(inv?y<x:y>x)?'w':''}">${fmt(y)}</span><div class="tt-bar"><i style="width:${px}%"></i><i style="width:${100-px}%"></i></div></div>`};
  const [ug,uga]=gs(S.user),[og,oga]=gs(opp),star=sq.slice().sort((x,y)=>y.ovr-x.ovr)[0],danger=squadOf(opp).slice().sort((x,y)=>y.ovr-x.ovr)[0],r=h2hRecord(opp);
  const keyMan=(p,lab,cl)=>p?`<button class="mc-key" data-act="player" data-id="${p.id}"><span class="mc-kit">${kitSVG(clubOf(p.club),'home',{back:true,name:p.ln,num:p.num})}</span><span><small>${lab}</small><b>${pName(p)}</b><em>${posChip(p.pos)} ${starHTML(stars(p.ovr))}</em><small>${p.s.ap?`${p.s.g} goals · ${avg(p)?avg(p).toFixed(2):'–'} avg`:'No appearances yet'}</small></span></button>`:'';
  mc=`<section class="panel c8 mc" style="--oc:${oc.colors[0]==='#ffffff'?oc.colors[1]:oc.colors[0]}">
  <div class="mc-head">${compBadge(ct.comp,22)}<span><b>${esc(ct.label)}</b><small>${fmtDate(ct.date)} · ${kickLabel(wx.kick)} · ${esc(clubOf(h).stadium)}</small></span>${derby?'<b class="derby-tag">Derby</b>':''}<span class="mc-wx">${wxIcon(wx.type)} ${WX[wx.type].n}, ${wx.temp}°C</span></div>
  <div class="mc-main">${side(h)}<div class="mc-mid"><div class="mc-vs">VS</div><small>${home?'Home':ct.neutral?'Neutral venue':'Away'}</small><div class="mc-btns"><button class="btn pri" data-act="continue">Go to match ${ARROW}</button><button class="btn" data-act="nav" data-v="tactics">Tactics</button></div></div>${side(a)}</div>
  <div class="mc-pre"><div class="mc-tt"><div class="mc-sub">Tale of the tape <small>${esc(c.short)} v ${esc(oc.short)}</small></div>${cmp('Attack',at20(sU.att),at20(sO.att))}${cmp('Midfield',at20(sU.mid),at20(sO.mid))}${cmp('Defence',at20(sU.def),at20(sO.def))}${cmp('Form (last 5)',fp(S.user),fp(opp),v=>v+' pts')}${played?cmp('Goals scored',ug,og)+cmp('Goals conceded',uga,oga,v=>v,true):''}</div>
  <div class="mc-keys"><div class="mc-sub">Players to watch</div>${keyMan(star,'Our key man')}${keyMan(danger,'Their danger man')}<p class="mc-note">${esc(oc.short)} usually play ${esc(oc.tac.form)}.${derby?` Derby record under you: ${r.w}W ${r.d}D ${r.l}L.`:''}</p></div></div></section>`;
 }else mc=`<section class="panel c8 mc"><div class="pb" style="text-align:center;padding:40px"><h2 style="font-size:32px">The season is over</h2><p class="muted">Review the final standings, awards and your board's verdict.</p><button class="btn pri lg" data-act="continue">Season review ${ARROW}</button></div></section>`;
 // ---- status ----
 const row=(l,v,cl,pct,sub2)=>`<div class="st-row"><span><small>${l}</small><b class="${cl||''}">${v}</b></span><i class="hk-bar"><i style="width:${clamp(pct,0,100)}%"></i></i>${sub2?`<em>${sub2}</em>`:''}</div>`;
 const status=`<section class="panel c4"><div class="ph"><h3>Club status</h3>${pos?`<span class="chip">${ordinal(pos)} in ${esc(lg.name)}</span>`:''}</div><div class="pb st">
 ${row('Board confidence',bw,bcl,S.board,`Objective: ${expectation(S.user)}`)}${row('Supporters',fw,fcl,S.fans??62)}${row('Squad morale',moraleWord(mor),'',mor)}${row('Match fitness',fit+'%',fit<75?'v3':'',fit)}${row('Tactical familiarity',fam+'%','',fam)}
 <div class="st-mini"><div><small>Transfer budget</small><b>${money(c.budget)}</b></div><div><small>Wage room</small><b>${money(c.wageBudget-wageBill(S.user))}/w</b></div><div><small>Window</small><b class="${windowOpen()?'v5':''}">${windowOpen()?'Open':'Closed'}</b></div></div></div></section>`;
 // ---- league snapshot ----
 const around=played?(()=>{const i=pos-1,idx=new Set([0,1,2,i-1,i,i+1].filter(x=>x>=0&&x<tb.length));return[...idx].sort((a,b)=>a-b)})():[0,1,2,3,4,5];
 const snap=`<section class="panel c5"><div class="ph"><h3>${esc(lg.name)}</h3><button class="btn ghost" data-act="nav" data-v="comps">Full table</button></div><table class="tbl"><thead><tr><th>#</th><th>Club</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th><th>Form</th></tr></thead><tbody>
 ${around.map((i,k)=>{const r=tb[i],gap=k>0&&i-around[k-1]>1;return`${gap?'<tr class="gap"><td colspan="6">···</td></tr>':''}<tr class="${r.id===S.user?'me':''}"><td>${i+1}</td><td><div class="who">${crest(r.id,18)}<b>${esc(clubOf(r.id).short)}</b></div></td><td class="r">${r.p}</td><td class="r">${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td class="r"><b>${r.pts}</b></td><td>${formHTML(r.form)}</td></tr>`}).join('')}</tbody></table></section>`;
 // ---- fixtures ----
 const sch=userSchedule(),nxt=sch.filter(f=>!f.res).slice(1,9),last=sch.filter(f=>f.res).slice(-3);
 const fixtures=`<section class="panel c4"><div class="ph"><h3>Fixtures</h3><button class="btn ghost" data-act="sub" data-v="calendar">Calendar</button></div><div class="list">${last.concat(nxt).map(schedRow).join('')||'<p class="pb muted">No fixtures.</p>'}</div></section>`;
 // Panels marked fit sit inside a cell whose height comes from the row's anchor panel, and their lists
 // clip to that height, so the hub never shows dead space at the bottom of a box.
 const fitCell=(cls,html)=>`<div class="fit ${cls}">${html}</div>`;
 const inbox=`<section class="panel"><div class="ph"><h3>Inbox</h3><button class="btn ghost" data-act="sub" data-v="inbox">${S.inbox.filter(m=>!m.read).length||'All'} ${S.inbox.some(m=>!m.read)?'unread':'messages'}</button></div><div class="list hub-mail">${S.inbox.slice(0,10).map(m=>`<button class="li ${m.read?'':'unread'}" data-act="msg" data-id="${m.id}" style="grid-template-columns:auto 1fr"><i class="hm-dot"></i><span><b>${esc(m.subj)}</b><small>${esc(m.from)}</small></span></button>`).join('')||'<p class="pb muted">No messages.</p>'}</div></section>`;
 const right=`<div class="fit c4"><div class="hub-col">${status.replace('class="panel c4"','class="panel"')}${inbox}</div></div>`;
 // ---- squad, vision, news, transfers ----
 const top=sq.filter(p=>p.s.ap>=2).sort((a,b)=>avg(b)-avg(a)).slice(0,8),out=sq.filter(p=>p.inj||p.ban);
 const pRow=p=>`<button class="li" data-act="player" data-id="${p.id}">${posChip(p.pos)}<span><b>${pName(p)}</b><small>${p.inj?`Injured · ${p.inj} md`:p.ban?`Suspended · ${p.ban} md`:`${p.s.ap} apps · ${p.s.g} G · ${p.s.a} A`}</small></span>${p.inj||p.ban?'<span class="chip bad">Out</span>':avg(p)?`<span class="rt" style="background:${rtColor(avg(p))}">${avg(p).toFixed(2)}</span>`:starHTML(stars(p.ovr))}</button>`;
 const byOvr=sq.slice().sort((a,b)=>b.ovr-a.ovr).slice(0,8);
 const squad=`<section class="panel"><div class="ph"><h3>${top.length?'Form guide':'Key players'}</h3><button class="btn ghost" data-act="nav" data-v="squad">Squad</button></div><div class="list">${out.map(pRow).join('')}${(top.length?top:byOvr).map(pRow).join('')}</div></section>`;
 const nIcon=n=>{const id=(n.clubs||[])[0];return id!=null&&S.clubs[id]?`<span class="hn-th" style="--nc:${clubOf(id).colors[0]}">${crest(id,26)}</span>`:`<span class="hn-th">${LOGO}</span>`};
 const news=`<section class="panel"><div class="ph"><h3>Latest news</h3><button class="btn ghost" data-act="sub" data-v="news">All news</button></div><div class="list">${S.news.slice(0,12).map(n=>`<div class="li hn" style="grid-template-columns:auto 1fr">${nIcon(n)}<span><b>${esc(n.title||n.text)}</b><small>${n.season===S.season?`Matchday ${n.md+1}`:seasonLabel()}</small></span></div>`).join('')||'<p class="pb muted">No news yet.</p>'}</div></section>`;
 const deals=S.deals.filter(d=>d.season===S.season).slice(0,12),lgIds=new Set(lg.clubs);
 const tf=`<section class="panel"><div class="ph"><h3>Transfer wire</h3><button class="btn ghost" data-act="nav" data-v="transfers">Transfers</button></div><div class="list">${deals.sort((a,b)=>(lgIds.has(b.to)||lgIds.has(b.from))-(lgIds.has(a.to)||lgIds.has(a.from))).map(d=>`<button class="li" style="grid-template-columns:auto 1fr auto" data-act="player" data-id="${d.pid}">${crest(d.to,24)}<span><b>${esc(d.name)} <small style="display:inline">${d.pos||''}</small></b><small>${esc(clubOf(d.from).short)} → ${esc(clubOf(d.to).short)}</small></span><b class="hub-fee">${d.loan?'Loan':money(d.fee)}</b></button>`).join('')||`<p class="pb muted">${windowOpen()?'No deals done yet this window.':'The window is closed.'}</p>`}</div></section>`;
 return`<div class="grid hub">${mc}${right}${snap}${fitCell('c4',fixtures.replace('class="panel c4"','class="panel"'))}${fitCell('c3',news)}${visionPanel(true).replace('class="panel "','class="panel c4 hub-anchor"')}${fitCell('c4',squad)}${fitCell('c4',tf)}</div>`;
}
