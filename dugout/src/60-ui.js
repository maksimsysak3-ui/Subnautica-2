/* ================= interface ================= */
let view='home',sub='overview',W=null;
const ui={trNat:'all',trExp:false,dealLeague:'all',sort:{squad:['ovr',-1],search:['ovr',-1]},group:'all',tSel:null,tSwap:null,trPos:'all',trLeague:'all',trMax:0,trAge:40,trMin:0,trQ:'',lg:null,lgMd:null,kitBack:false,pickNation:'ENG',pickLeague:null,pickClub:null,pid:null,back:null};
const ARROW='<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const LOGO=`<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="10" fill="#ffb43a"/><path d="M11 10 H19 A10 10 0 0 1 19 30 H11 Z" fill="none" stroke="#2b1900" stroke-width="3.4" stroke-linejoin="round"/><path d="M15 20 H24 M21 16.5 L24.5 20 L21 23.5" fill="none" stroke="#2b1900" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const NAV=[['home','Home',[['overview','Overview'],['inbox','Inbox'],['news','News']]],['squad','Squad',[['players','Players'],['stats','Statistics'],['training','Training']]],['tactics','Tactics',[['tactics','Tactics']]],['transfers','Transfers',[['hub','Transfer hub'],['search','Player search'],['shortlist','Shortlist'],['bids','My bids'],['deals','Deals']]],['comps','Competitions',[['overview','Overview'],['table','Table'],['fixtures','Fixtures'],['stats','Stats'],['clubs','Clubs'],['history','History']]],['office','Office',[['budget','Budgets'],['finances','Finances'],['board','Board']]],['club','Club',[['overview','Overview'],['honours','Honours'],['history','History']]]];
const NAV_ICON={home:'<path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/>',squad:'<path d="M8 3 4 6 2 11l4 1v9h12v-9l4-1-2-5-4-3q-4 3-8 0z"/>',tactics:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="14" r="1.5"/><path d="M10.5 11.5q3-4 6.5-2M15 15l3 3M18 15l-3 3"/>',transfers:'<path d="M4 8h15l-4-4M20 16H5l4 4"/>',comps:'<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5M12 14v4M8 20h8"/>',office:'<rect x="3" y="7" width="18" height="13" rx="1"/><path d="M9 7V4h6v3M3 12h18"/>',club:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>'};
function storyArt(n,big){
 if(n.score){const[h,a,hg,ag]=n.score,ch=clubOf(h),ca=clubOf(a);return`<div class="story-art" style="background:linear-gradient(115deg,${ch.colors[0]} 0 48%,${ca.colors[0]} 52% 100%)">${crest(h,big?62:30)}<span class="sc">${hg}–${ag}</span>${crest(a,big?62:30)}</div>`}
 const c=n.clubs[0]!=null?clubOf(n.clubs[0]):null;return`<div class="story-art" style="background:radial-gradient(circle at 50% 40%,${c?c.colors[0]:'#333'},#0a0a0b 75%)">${c?crest(c.id,big?84:30):''}</div>`;
}
function newsTile(n){
 if(n.score){const[h,a,hg,ag]=n.score;return`<span class="tile" style="background:linear-gradient(135deg,${clubOf(h).colors[0]} 0 50%,${clubOf(a).colors[0]} 50%)"><span style="position:relative;text-shadow:0 2px 6px rgba(0,0,0,.8)">${hg}–${ag}</span></span>`}
 const c=n.clubs[0]!=null?clubOf(n.clubs[0]):null;return`<span class="tile" style="background:${c?mix(c.colors[0],'#000000',.35):'#222'}">${c?crest(c.id):''}</span>`;
}
function newsSidebar(){
 const list=S.news.slice(0,12),top=list.find(n=>n.title)||list[0];if(!top)return'';
 const tag={club:'Club',result:'Result',transfer:'Transfer',table:'League'};
 return`<aside class="newsbar" aria-label="News"><article class="story">${storyArt(top,true)}<div class="story-body"><div class="eyebrow">${tag[top.kind]||'News'}</div><h4>${esc(top.title||top.text)}</h4>${top.title?`<p>${esc(top.text)}</p>`:''}<div class="story-meta"><span>Matchday ${top.md+1}</span><span>·</span><span>${seasonLabel()}</span></div></div></article>
 <section class="panel"><div class="ph"><h3>More stories</h3><button class="btn" data-act="go-news">All</button></div><div>${list.filter(n=>n!==top).slice(0,8).map(n=>`<div class="ns">${newsTile(n)}<span><b>${esc(n.title||n.text)}</b><small>${tag[n.kind]||'News'} · MD ${n.md+1}</small></span></div>`).join('')}</div></section></aside>`;
}
const starHTML=v=>`<span class="stars" title="${v} stars" style="--v:${v/5*100}%">★★★★★</span>`;
const crest=(cid,size)=>crestSVG(clubOf(cid),{size});
const pName=p=>esc(p.fn[0]+'. '+p.ln);
const posChip=pos=>`<span class="pos g-${GROUP[pos]}">${pos}</span>`;
const formHTML=f=>`<span class="form">${f.slice(-5).map(x=>`<i class="${x}">${x}</i>`).join('')}</span>`;
const avg=p=>p.s.ap?(p.s.rs/p.s.ap):null;
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),2800)}
function openModal(html){$('#modal-body').innerHTML=html;$('#modal').hidden=false;$('#modal').scrollTop=0}
function closeModal(){$('#modal').hidden=true;$('#modal-body').innerHTML='';$('#modal .modal-box').classList.remove('wide')}
function go(v,sb,extra){if(typeof leaveMatch==='function'&&view==='match'&&v!=='match')leaveMatch();view=v;sub=sb||(NAV.find(n=>n[0]===v)||[0,0,[['','']]])[2][0][0];Object.assign(ui,extra||{});render();window.scrollTo(0,0)}
function openPlayer(pid){ui.back=[view,sub];go('player','',{pid})}

/* ---------- bar ---------- */
function nextLabel(){if(S.md>=MDAYS)return'Season review';if(typeof M!=='undefined'&&M&&M.phase==='live')return'Resume match';if(typeof M!=='undefined'&&M&&M.phase==='done')return'Match report';return'Continue'}
function renderBar(){
 const c=clubOf(S.user),fx=userFixture(),unread=S.inbox.filter(m=>!m.read).length,nav=NAV.find(n=>n[0]===view);
 const opp=fx?clubOf(fx[0]===S.user?fx[1]:fx[0]):null;
 $('#bar').style.setProperty('--tc',c.colors[0]===('#ffffff')?c.colors[1]:c.colors[0]);
 $('#bar').innerHTML=`<div class="bar-row"><button class="logo" data-act="menu" title="Main menu (career saves automatically)">${LOGO}<span>DUGOUT</span></button>
 <button class="club-chip" data-act="nav" data-v="club">${crest(S.user)}<b>${esc(c.short)}</b></button>
 <nav class="nav" aria-label="Sections">${NAV.map(([k,l])=>`<button data-act="nav" data-v="${k}" ${view===k?'aria-current="page"':''}><svg viewBox="0 0 24 24">${NAV_ICON[k]}</svg>${l}${k==='home'&&unread?'<span class="dot"></span>':''}</button>`).join('')}</nav>
 <div class="when"><b>${fmtDate(mdDate(Math.min(S.md,MDAYS-1)))}</b><small>${opp?`Next: ${esc(opp.short)} (${fx[0]===S.user?'H':'A'}) · MD ${S.md+1}/${MDAYS}`:'Season complete'}</small></div>
 <button class="go" data-act="continue"><span class="lbl">${nextLabel()}</span>${ARROW}</button></div>
 ${nav&&nav[2].length>1?`<div class="sub">${nav[2].map(([k,l])=>`<button data-act="sub" data-v="${k}" aria-current="${sub===k}">${l}</button>`).join('')}<span class="sp"></span></div>`:view==='player'?`<div class="sub"><button data-act="back">‹ Back</button><span class="sp"></span></div>`:''}`;
}

/* ---------- start ---------- */
function viewStart(){
 if(!W){W=genWorld((Math.random()*2e9)|0);S=null}
 const lgs=W.leagues.filter(l=>l.nation===ui.pickNation),lid=ui.pickLeague??lgs[0].id,lg=W.leagues[lid];
 const clubs=lg.clubs.map(id=>W.clubs[id]).sort((a,b)=>b.rep-a.rep),c=W.clubs[ui.pickClub??clubs[0].id];
 const sv=S;S=W;
 const html=`<div class="start"><div class="start-top"><button class="btn ghost" data-act="menu-back">‹ Main menu</button><span class="chip">Save slot ${ui.newSlot||1}</span></div>
 <header class="hero">${LOGO}<div><h1>New career</h1><p>Choose a club from ${COUNTRIES.length} countries and ${W.leagues.length} divisions. Every match is simulated from real positional play.</p></div></header>
 <div class="toolbar"><div class="seg" role="group" aria-label="Country">${COUNTRIES.map(co=>`<button data-act="pickNation" data-v="${co.code}" aria-pressed="${co.code===ui.pickNation}">${flagSVG(co.code)} ${NATIONS[co.code].n}</button>`).join('')}</div>
 <div class="seg" role="group" aria-label="Division">${lgs.map(l=>`<button data-act="pickLeague" data-v="${l.id}" aria-pressed="${l.id===lid}">${esc(l.name)}</button>`).join('')}</div></div>
 <div class="pick-grid"><div class="panel"><div class="tw"><table class="tbl"><thead><tr><th>Club</th><th>Reputation</th><th class="r">Budget</th><th class="r hide-sm">Wages p/w</th><th class="hide-sm">Objective</th></tr></thead><tbody>
 ${clubs.map(k=>`<tr class="click ${k.id===c.id?'me':''}" data-act="pickClub" data-id="${k.id}"><td><div class="who">${crest(k.id,22)}<b>${esc(k.name)}</b></div></td><td>${starHTML(stars(repToOvr(k.rep)))}</td><td class="r">${money(k.budget)}</td><td class="r hide-sm">${money(k.wageBudget)}</td><td class="hide-sm"><small>${expectation(k.id)}</small></td></tr>`).join('')}</tbody></table></div></div>
 <aside class="panel club-prev"><div class="pb"><div class="cp-head">${crest(c.id)}<div><h2 style="font-size:28px;line-height:1">${esc(c.name)}</h2><p class="muted" style="margin:4px 0 0">${esc(lg.name)} · Est. ${c.est}</p></div></div>
 <div class="kits">${['home','away','third'].map(w=>`<figure>${kitSVG(c,w)}<figcaption>${w}</figcaption></figure>`).join('')}</div>
 <dl class="facts"><div><dt>Stadium</dt><dd>${esc(c.stadium)}</dd></div><div><dt>Capacity</dt><dd>${c.cap.toLocaleString('en-GB')}</dd></div><div><dt>Transfer budget</dt><dd>${money(c.budget)}</dd></div><div><dt>Objective</dt><dd>${expectation(c.id)}</dd></div><div><dt>Best player</dt><dd>${(()=>{const p=c.squad.map(id=>W.players[id]).sort((a,b)=>b.ovr-a.ovr)[0];return pName(p)+' · '+p.pos})()}</dd></div><div><dt>Squad</dt><dd>${c.squad.length} players</dd></div></dl>
 <button class="btn pri lg" style="width:100%" data-act="start" data-id="${c.id}">Take charge of ${esc(c.short)} ${ARROW}</button>${ui.overwrite?`<p class="muted" style="font-size:12px;margin:8px 0 0">This replaces the career in slot ${ui.newSlot}.</p>`:''}</div></aside></div></div>`;
 S=sv;return html;
}

/* ---------- home ---------- */
function viewHome(){
 if(sub==='inbox')return inboxView();
 if(sub==='news')return newsView(S.news);
 const c=clubOf(S.user),fx=userFixture(),tb=table(c.league),lg=S.leagues[c.league],fxs=fixturesOf(S.user),wb=wageBill(S.user);
 const next=fxs.filter(f=>!f.res).slice(0,5),last=fxs.filter(f=>f.res).slice(-5).reverse();
 const sq=squadOf(S.user),unavailable=sq.filter(p=>p.inj||p.ban),tired=sq.filter(p=>p.cond<75).sort((a,b)=>a.cond-b.cond).slice(0,4),top=sq.filter(p=>p.s.ap>=2).sort((a,b)=>avg(b)-avg(a)).slice(0,5);
 const opp=fx?(fx[0]===S.user?fx[1]:fx[0]):null,oppRow=opp!=null?tb.find(r=>r.id===opp):null;
 return`<div class="grid">
 <section class="panel c4"><div class="ph"><h3>Inbox</h3><button class="link btn" data-act="sub" data-v="inbox">All</button></div><div class="list">${S.inbox.slice(0,8).map(msgRow).join('')||'<p class="pb muted">No messages.</p>'}</div></section>
 <section class="panel c5"><div class="ph"><h3>Next match <small>${fx?fmtDate(mdDate(S.md)):''}</small></h3>${fx?`<span class="chip hot">Matchday ${S.md+1}</span>`:''}</div><div class="pb">
 ${fx?`<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;text-align:center">${[fx[0],fx[1]].map((id,k)=>`<div${k?' style="order:3"':''}>${crest(id,64)}<div style="font:700 18px var(--fd);text-transform:uppercase;margin-top:6px">${esc(clubOf(id).short)}</div><small>${S.results[c.league].length?ordinal(posIn(tb,id))+' · ':''}${formHTML(tb.find(r=>r.id===id).form)}</small></div>`).join('<div style="order:2"><div class="kpi" style="color:var(--dim)">VS</div><small>'+esc(clubOf(fx[0]).stadium)+'</small></div>')}</div>
 <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn" data-act="nav" data-v="tactics">Tactics</button><button class="btn pri" data-act="continue">Go to match ${ARROW}</button></div>
 ${oppRow?`<p class="muted" style="font-size:13px;text-align:center;margin:10px 0 0">${esc(clubOf(opp).name)} usually line up in a ${clubOf(opp).tac.form}. Their danger man: ${(()=>{const p=squadOf(opp).sort((a,b)=>b.ovr-a.ovr)[0];return pName(p)+' ('+p.pos+')'})()}.</p>`:''}`
 :`<p>The season is over.</p><button class="btn pri" data-act="continue">Season review ${ARROW}</button>`}</div></section>
 <section class="panel c3"><div class="ph"><h3>Finances</h3></div><div class="pb"><div class="eyebrow" style="color:var(--muted)">Transfer budget</div><div class="kpi">${money(c.budget)}</div>
 <div class="eyebrow" style="color:var(--muted);margin-top:14px">Wage bill</div><div class="kpi sm">${money(wb)} <small style="font:500 13px var(--fb)">of ${money(c.wageBudget)} p/w</small></div><div class="meter"><i style="width:${clamp(wb/c.wageBudget*100,0,100)}%"></i></div>
 <div class="eyebrow" style="color:var(--muted);margin-top:14px">Board objective</div><div style="font-weight:600;margin-top:3px">${expectation(S.user)}</div>
 <div style="margin-top:12px"><span class="chip ${windowOpen()?'ok':''}">${windowOpen()?'Transfer window open':'Transfer window closed'}</span></div></div></section>
 <section class="panel c5"><div class="ph"><h3>${esc(lg.name)}</h3><button class="btn" data-act="nav" data-v="comps">Competition</button></div><div class="tw">${leagueTable(c.league,true)}</div></section>
 <section class="panel c4"><div class="ph"><h3>Fixtures &amp; results</h3></div><div class="list">${last.slice(0,3).reverse().concat(next).map(fixtureRow).join('')}</div></section>
 <section class="panel c3"><div class="ph"><h3>Squad status</h3></div><div class="list">
 ${top.length?top.map(p=>`<button class="li" data-act="player" data-id="${p.id}">${posChip(p.pos)}<span><b>${pName(p)}</b><small>${p.s.ap} apps · ${p.s.g} G · ${p.s.a} A</small></span><span class="rt" style="background:${rtColor(avg(p))}">${avg(p).toFixed(2)}</span></button>`).join(''):'<p class="pb muted" style="margin:0">Form guide appears after two matches.</p>'}
 ${unavailable.map(p=>`<button class="li" data-act="player" data-id="${p.id}">${posChip(p.pos)}<span><b>${pName(p)}</b><small>${p.inj?`Injured · ${p.inj} md`:`Suspended · ${p.ban} md`}</small></span><span class="chip bad">Out</span></button>`).join('')}
 ${tired.map(p=>`<button class="li" data-act="player" data-id="${p.id}">${posChip(p.pos)}<span><b>${pName(p)}</b><small>Match fitness</small></span><span class="chip">${p.cond}%</span></button>`).join('')}</div></section>
 </div>`;
}
const msgRow=m=>`<button class="li ${m.read?'':'unread'}" data-act="msg" data-id="${m.id}"><i class="dotc"></i><span><b>${esc(m.subj)}</b><small>${esc(m.from)}</small></span><small>MD ${m.md+1}</small></button>`;
const newsRow=n=>`<div class="ns" style="grid-template-columns:46px 1fr auto">${newsTile(n)}<span><b>${esc(n.title||n.text)}</b>${n.title?`<small style="display:block;color:var(--muted);font-size:12px;margin-top:2px">${esc(n.text)}</small>`:''}</span><small>MD ${n.md+1}</small></div>`;
function fixtureRow(f){const home=f.h===S.user,opp=home?f.a:f.h,r=f.res;let res='';if(r){const gf=home?r.hg:r.ag,ga=home?r.ag:r.hg;res=`<span class="rt" style="background:${gf>ga?'var(--win)':gf<ga?'var(--loss)':'var(--draw)'}">${gf}–${ga}</span>`}
 return`<div class="li">${crest(opp,22)}<span><b>${esc(clubOf(opp).name)} <small style="display:inline">(${home?'H':'A'})</small></b><small>${shortDate(mdDate(f.md))} · Matchday ${f.md+1}</small></span>${res||'<small>–</small>'}</div>`}
function inboxView(){return`<div class="grid"><section class="panel c12"><div class="ph"><h3>Inbox <small>${S.inbox.length} messages</small></h3></div><div class="list">${S.inbox.map(msgRow).join('')}</div></section></div>`}
function newsView(list){return`<div class="grid"><section class="panel c12"><div class="ph"><h3>News</h3></div><div class="list">${list.map(newsRow).join('')||'<p class="pb muted">Nothing yet.</p>'}</div></section></div>`}
function openMsg(id){
 const m=S.inbox.find(x=>x.id===id);if(!m)return;m.read=true;save();const a=m.action;let act='';
 if(a&&a.type==='offer'&&!a.done){const p=S.players[a.pid];act=p&&p.club===S.user&&windowOpen()?`<div class="toolbar" style="margin:16px 0 0"><button class="btn pri" data-act="offer-yes" data-id="${m.id}">Accept ${money(a.fee)}</button><button class="btn" data-act="offer-no" data-id="${m.id}">Reject</button></div>`:'<p class="muted">This offer has lapsed.</p>'}
 else if(a&&a.type==='offer')act=`<p class="muted">${a.done==='yes'?'You accepted this offer.':'You rejected this offer.'}</p>`;
 openModal(`<div class="eyebrow">${esc(m.from)} · Matchday ${m.md+1}</div><h2 style="font-size:26px;margin:6px 0 10px">${esc(m.subj)}</h2><div style="line-height:1.6">${m.body}</div>${act}`);renderBar();
}

function sortable(key,cols,list){const[sk,dir]=ui.sort[key];const col=cols.find(c=>c[0]===sk);if(col&&col[2])list.sort((a,b)=>(col[2](a)-col[2](b))*dir||0);
 return cols.map(([k,l,f,cls])=>`<th class="${f?'s':''} ${k===sk?'on':''} ${cls||''}" ${f?`data-act="sort" data-k="${key}" data-v="${k}"`:''}>${l}${k===sk?(dir<0?' ▾':' ▴'):''}</th>`).join('')}

/* ---------- squad ---------- */
function viewSquad(){
 if(sub==='training')return viewTraining();
 const c=clubOf(S.user),inXI=new Set(c.tac.xi),inB=new Set(c.tac.bench),grp=p=>ui.group==='all'||GROUP[p.pos]===ui.group;
 const list=squadOf(S.user).filter(grp);
 const head=`<div class="toolbar"><div class="seg" role="group" aria-label="Position group">${['all','GK','DEF','MID','ATT'].map(g=>`<button data-act="group" data-v="${g}" aria-pressed="${ui.group===g}">${g==='all'?'All':g}</button>`).join('')}</div><span class="grow"></span><small>${c.squad.length} players · wage bill ${money(wageBill(S.user))} p/w</small></div>`;
 if(sub==='stats'){
  const cols=[['num','#',p=>p.num,'c'],['name','Name',null],['pos','Pos',p=>POS.indexOf(p.pos)],['ap','Apps',p=>p.s.ap,'r'],['g','Goals',p=>p.s.g,'r'],['a','Assists',p=>p.s.a,'r'],['mom','PoM',p=>p.s.mom,'r'],['avg','Av rating',p=>avg(p)||0,'r']];
  return head+`<div class="panel"><div class="tw"><table class="tbl"><thead><tr>${sortable('squad',cols,list)}</tr></thead><tbody>${list.map(p=>`<tr class="click" data-act="player" data-id="${p.id}"><td class="c"><span class="num-badge">${p.num}</span></td><td><div class="who">${flagSVG(p.nat)}<b>${esc(p.fn+' '+p.ln)}</b></div></td><td>${posChip(p.pos)}</td><td class="r">${p.s.ap}</td><td class="r">${p.s.g}</td><td class="r">${p.s.a}</td><td class="r">${p.s.mom}</td><td class="r">${avg(p)?`<span class="rt" style="background:${rtColor(avg(p))}">${avg(p).toFixed(2)}</span>`:'–'}</td></tr>`).join('')}</tbody></table></div></div>`;
 }
 const cols=[['num','#',p=>p.num,'c'],['name','Name',null],['pos','Pos',p=>POS.indexOf(p.pos)],['sel','Status',p=>inXI.has(p.id)?2:inB.has(p.id)?1:0],['age','Age',p=>p.age,'r'],['ovr','Ability',p=>p.ovr],['pot','Potential',p=>p.pot],['cond','Cond',p=>p.cond,'r'],['mor','Morale',p=>p.mor,'r hide-sm'],['val','Value',p=>p.val,'r'],['trend','Trend',p=>p.val/(p.val0||p.val),'r'],['wage','Wage',p=>p.wage,'r hide-sm'],['con','Contract',p=>p.con,'r hide-sm']];
 return head+`<div class="panel"><div class="tw"><table class="tbl"><thead><tr>${sortable('squad',cols,list)}</tr></thead><tbody>
 ${list.map(p=>`<tr class="click" data-act="player" data-id="${p.id}"><td class="c"><span class="num-badge">${p.num}</span></td><td><div class="who">${flagSVG(p.nat)}<b>${esc(p.fn+' '+p.ln)}</b>${p.inj?'<span class="chip bad">Inj</span>':''}${p.ban?'<span class="chip bad">Ban</span>':''}</div></td><td>${posChip(p.pos)}${p.sec.length?` <small>${p.sec.join(' ')}</small>`:''}</td><td>${inXI.has(p.id)?'<span class="chip ok">Starting</span>':inB.has(p.id)?'<span class="chip">Sub</span>':''}</td><td class="r">${p.age}</td><td>${starHTML(stars(p.ovr))}</td><td>${starHTML(stars(p.pot))}</td><td class="r"><span class="${p.cond<70?'v2':p.cond<85?'v3':'v5'}">${p.cond}%</span></td><td class="r hide-sm">${moraleWord(p.mor)}</td><td class="r">${money(p.val)}</td><td class="r">${trendHTML(p)}</td><td class="r hide-sm">${money(p.wage)}</td><td class="r hide-sm">${p.con} yr${p.con>1?'s':''}</td></tr>`).join('')}</tbody></table></div></div>`;
}
const trendHTML=p=>{const r=p.val/(p.val0||p.val)-1;return Math.abs(r)<.01?'<small>–</small>':`<b class="${r>0?'v5':'v2'}">${r>0?'▲':'▼'} ${Math.abs(Math.round(r*100))}%</b>`};
const moraleWord=m=>m>=85?'<span class="v6">Superb</span>':m>=72?'<span class="v5">Good</span>':m>=55?'<span class="v3">Okay</span>':m>=40?'<span class="v2">Poor</span>':'<span class="v1">Very poor</span>';

/* ---------- player profile ---------- */
function viewPlayer(){
 const p=S.players[ui.pid];if(!p)return'<p>Player not found.</p>';
 const c=clubOf(p.club),mine=p.club===S.user,gk=p.pos==='GK',groups=gk?['Goalkeeping','Mental','Physical']:['Technical','Mental','Physical'];
 const posmap=Object.entries({GK:[50,94],CB:[50,78],LB:[14,72],RB:[86,72],DM:[50,62],CM:[50,48],AM:[50,32],LW:[14,28],RW:[86,28],ST:[50,12]}).map(([k,[x,y]])=>`<i class="${p.pos===k?'n':p.sec.includes(k)?'s':'x'}" style="left:${x}%;top:${y}%">${k}</i>`).join('');
 const shortl=S.shortlist.includes(p.id);
 return`<div class="grid"><section class="panel c12"><div class="pp-head">${kitSVG(c,'home',{back:true,name:p.ln,num:p.num})}
 <div style="min-width:0"><div class="eyebrow">${POS_NAME[p.pos]}${p.sec.length?' · also '+p.sec.join(', '):''}</div><h1>${esc(p.fn)} <b>${esc(p.ln)}</b></h1>
 <div class="pp-meta">${flagSVG(p.nat)} ${esc(NATIONS[p.nat].n)}<span>${p.age} years</span><span>${p.ht} cm</span><span>${p.foot==='L'?'Left':'Right'}-footed</span><span>${crest(c.id,18)} ${esc(c.name)} · No. ${p.num}</span></div></div>
 <div class="pp-ovr"><div><div class="eyebrow" style="color:var(--muted)">Ability</div>${starHTML(stars(p.ovr))}</div><div><div class="eyebrow" style="color:var(--muted);margin-top:8px">Potential</div>${starHTML(stars(p.pot))}</div></div></div></section>
 <section class="panel c8"><div class="ph"><h3>Attributes <small>out of 20</small></h3></div><div class="pb attrs">${groups.map(g=>`<div class="ag"><h4>${g}</h4>${ATTR_GROUPS[g].map(a=>{const v=at20(p.at[AIX[a]]);return`<div class="ar"><span>${ATTR_NAME[a]}</span><b class="${v>=16?'v6':v>=13?'v5':v>=10?'v4':v>=7?'v3':'v2'}">${v}</b></div>`}).join('')}</div>`).join('')}</div></section>
 <section class="panel c4"><div class="ph"><h3>Positions</h3></div><div class="pb"><div class="posmap">${posmap}</div></div></section>
 <section class="panel c4"><div class="ph"><h3>Contract</h3></div><div class="pb"><dl class="facts"><div><dt>Value</dt><dd>${money(p.val)}</dd></div><div><dt>Wage</dt><dd>${money(p.wage)} p/w</dd></div><div><dt>Contract</dt><dd>${p.con} year${p.con>1?'s':''}</dd></div><div><dt>Condition</dt><dd>${p.cond}%</dd></div><div><dt>Morale</dt><dd>${moraleWord(p.mor)}</dd></div><div><dt>Status</dt><dd>${p.inj?`Injured (${p.inj} md)`:p.ban?`Suspended (${p.ban} md)`:'Available'}</dd></div></dl>
 <div class="toolbar" id="pp-actions" style="margin:0">${mine?`<button class="btn" data-act="sell" data-id="${p.id}">Find a buyer</button>`:`<button class="btn pri" data-act="negotiate" data-id="${p.id}">Make an offer</button><button class="btn" data-act="shortlist" data-id="${p.id}">${shortl?'Remove from shortlist':'Add to shortlist'}</button>`}</div></div></section>
 <section class="panel c4"><div class="ph"><h3>Market value</h3>${trendHTML(p)}</div><div class="pb"><div class="kpi sm">${money(p.val)}</div>${sparkSVG((p.vh||[]).map(v=>v*1e4).concat([p.val]))}<small>Season start: ${money(p.val0||p.val)} · driven by ability, potential, age, form and contract</small></div></section>
 <section class="panel c4"><div class="ph"><h3>This season</h3></div><div class="pb"><dl class="facts"><div><dt>Appearances</dt><dd>${p.s.ap}</dd></div><div><dt>Goals</dt><dd>${p.s.g}</dd></div><div><dt>Assists</dt><dd>${p.s.a}</dd></div><div><dt>Player of the match</dt><dd>${p.s.mom}</dd></div><div><dt>Average rating</dt><dd>${avg(p)?avg(p).toFixed(2):'–'}</dd></div></dl></div></section>
 <section class="panel c4"><div class="ph"><h3>Scout report</h3></div><div class="pb" style="font-size:13px;line-height:1.6">${scoutReport(p)}</div></section></div>`;
}
function scoutReport(p){
 const top=ATTRS.filter(a=>!GKA.includes(a)||p.pos==='GK').map(a=>[a,p.at[AIX[a]]]).sort((x,y)=>y[1]-x[1]),best=top.slice(0,3).map(x=>ATTR_NAME[x[0]].toLowerCase()),weak=top.slice(-2).map(x=>ATTR_NAME[x[0]].toLowerCase());
 const lvl=stars(p.ovr),pot=stars(p.pot);
 return`<p style="margin:0 0 8px">Strengths: <b>${best.join(', ')}</b>. Weaknesses: ${weak.join(' and ')}.</p><p style="margin:0">${lvl>=4?'A top-level player.':lvl>=3?'A solid first-team player at this level.':lvl>=2?'A squad player.':'Not yet ready for regular first-team football.'} ${pot-lvl>=1.5?'Has the potential to become much better.':pot>lvl?'Still has room to improve.':'Unlikely to improve much further.'}</p>`;
}
function sellUI(pid){
 const p=S.players[pid],why=canSell(p);if(why)return toast(why);
 if(!windowOpen())return toast('The transfer window is closed.');
 const pool=S.clubs.filter(c=>c.id!==S.user&&c.budget>p.val*.8&&c.rep>=clubOf(S.user).rep-15);if(!pool.length)return toast('No club can afford him right now.');
 const buyer=G.pick(pool),fee=Math.round(p.val*(.8+G.f()*.3)/5e4)*5e4;ui.sell={pid,buyer:buyer.id,fee};
 $('#pp-actions').innerHTML=`<div style="width:100%"><p style="margin:0 0 8px">${crest(buyer.id,18)} <b>${esc(buyer.name)}</b> offer <b>${money(fee)}</b> (valued at ${money(p.val)}).</p><div class="toolbar" style="margin:0"><button class="btn pri" data-act="sell-yes">Accept</button><button class="btn" data-act="player" data-id="${pid}">Keep him</button></div></div>`;
}

/* ---------- tactics ---------- */
function viewTactics(){
 ensureLineup(S.user);
 const c=clubOf(S.user),t=c.tac,slots=FORMATIONS[t.form],inSl=FORMATIONS[t.formIn||t.form],map=shapeMap(t.form,t.formIn),sel=ui.tSel??9;
 const xy=(lat,dep)=>[lat,100-dep*.96-2];
 const arrows=slots.map((s,i)=>{if(i===0)return'';const rf=ROLE_FX[t.roles[i]]||{},b=inSl[map[i]];let lat=b[1],dep=b[2]+(rf.inD||0)*.9;if(rf.inward)lat+=lat<50?rf.inward*1.3:-rf.inward*1.3;if(rf.wide)lat+=lat<45?-rf.wide:lat>55?rf.wide:0;
  const[x1,y1]=xy(s[1],s[2]),[x2,y2]=xy(clamp(lat,4,96),clamp(dep,4,96));if(Math.hypot(x2-x1,y2-y1)<3)return'';return`<line x1="${x1*.68}" y1="${y1}" x2="${x2*.68}" y2="${y2}" stroke="#ffb43a" stroke-width=".55" stroke-dasharray="1.4 1" marker-end="url(#ah)" opacity=".85"/>`}).join('');
 const players=slots.map(([pos,lat,dep],i)=>{const p=S.players[t.xi[i]],[x,y]=xy(lat,dep),f=p?famil(p,pos):0,r=p?rateAt(p,pos):0;
  return`<button class="slot ${sel===i?'sel':''} ${f>=.97?'fit-good':f>=.86?'fit-ok':'fit-bad'}" style="left:${x}%;top:${y}%" data-act="slot" data-i="${i}"><span class="kitm">${p?kitSVG(c,pos==='GK'?'third':'home',{back:true,name:p.ln,num:p.num}):''}</span><span class="nm">${p?esc(p.ln):'Empty'}${p?`<b>${at20(r)}</b>`:''}</span><span class="rl">${pos} · ${esc(roleName(pos,t.roles[i]))}</span></button>`}).join('');
 const sp=slots[sel],sPos=sp[0],cur=S.players[t.xi[sel]],roles=ROLES[sPos],roleDesc=(roles.find(r=>r[0]===t.roles[sel])||roles[0])[2];
 const inXI=new Set(t.xi),cands=squadOf(S.user).filter(p=>!p.inj&&!p.ban).sort((a,b)=>rateAt(b,sPos)-rateAt(a,sPos));
 const opt=(k,label,opts,val,group)=>`<div class="row"><small>${label}</small><div class="seg" role="group" aria-label="${label}">${opts.map((o,i)=>`<button data-act="ins" data-k="${k}" data-v="${i}" aria-pressed="${val===i}">${o}</button>`).join('')}</div></div>`;
 const grp=g=>INSTR.filter(i=>i[4]===g).map(([k,l,o])=>opt(k,l,o,t.ins[k])).join('');
 const r=strength(t.xi,t.form);
 return`<div class="tac">
 <div class="tac-pitch tac-left"><section class="panel"><div class="ph"><h3>Shape</h3><button class="btn" data-act="autoxi">Pick best XI</button></div><div class="pb">
 <div class="toolbar"><label for="f-out">Without the ball <select id="f-out" data-change="form">${Object.keys(FORMATIONS).map(f=>`<option ${f===t.form?'selected':''}>${f}</option>`).join('')}</select></label>
 <label for="f-in">With the ball <select id="f-in" data-change="formIn">${Object.keys(FORMATIONS).map(f=>`<option ${f===(t.formIn||t.form)?'selected':''}>${f}</option>`).join('')}</select></label></div>
 <div class="pitch">${PITCH_SVG}<svg viewBox="0 0 68 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><defs><marker id="ah" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ffb43a"/></marker></defs>${arrows}</svg>${players}</div>
 <p class="muted" style="font-size:12px;margin:10px 0 0">Players stand in their defensive shape. Dashed arrows show where each one moves when you have the ball, from your attacking shape and their role. The number on each shirt is his ability in that slot (out of 20); the ring shows positional fit.</p></div></section>${tacticsCharts(t)}</div>
 <section class="panel"><div class="ph"><h3>${POS_NAME[sPos]} <small>slot ${sel+1}</small></h3></div><div class="pb">
 <div class="row ins"><div class="row"><small>Role</small><div class="seg" role="group" aria-label="Role">${roles.map(([id,l])=>`<button data-act="role" data-v="${id}" aria-pressed="${t.roles[sel]===id}">${l}</button>`).join('')}</div></div></div>
 <p class="role-desc">${esc(roleDesc)}</p>${cur?slotDetail(cur,sPos,t.roles[sel]):''}</div>
 <div class="ph" style="border-top:1px solid var(--line)"><h3>Pick for this slot</h3>${ui.tSwap!=null?'<small>Tap a player to swap</small>':''}</div>
 <div class="tw" style="max-height:440px"><table class="tbl"><thead><tr><th>Player</th><th>Pos</th><th class="r">Fit</th><th class="r">Cond</th><th></th></tr></thead><tbody>
 ${cands.map(p=>`<tr class="click ${cur&&cur.id===p.id?'me':''}" data-act="assign" data-id="${p.id}"><td><div class="who"><span class="num-badge">${p.num}</span><b>${pName(p)}</b></div></td><td>${posChip(p.pos)}</td><td class="r"><b class="${vClass(rateAt(p,sPos))}">${at20(rateAt(p,sPos))}</b></td><td class="r">${p.cond}%</td><td>${inXI.has(p.id)?'<span class="chip ok">XI</span>':t.bench.includes(p.id)?'<span class="chip">Sub</span>':''}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel"><div class="ph"><h3>Instructions</h3></div><div class="pb ins">
 <div class="eyebrow">In possession</div>${grp('in')}<div class="eyebrow" style="margin-top:6px">Out of possession</div>${grp('out')}<div class="eyebrow" style="margin-top:6px">Transitions</div>${grp('tr')}
</div></section></div>`;
}

/* ---------- club ---------- */
function viewClub(){
 if(sub==='honours')return viewHonours();
 const c=clubOf(S.user),wb=wageBill(S.user);
 if(sub==='history')return`<div class="panel"><div class="ph"><h3>Club history</h3></div>${S.hist.length?`<div class="tw"><table class="tbl"><thead><tr><th>Season</th><th>Competition</th><th class="r">Finish</th></tr></thead><tbody>${S.hist.map(h=>`<tr><td>${h.season}</td><td>${esc(h.league)}</td><td class="r"><b>${ordinal(h.pos)}</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="pb muted">Your first season is under way.</p>'}</div>`;
 const best=squadOf(S.user).sort((a,b)=>b.ovr-a.ovr)[0];
 return`<div class="grid"><section class="panel c12" style="background:radial-gradient(60% 140% at 0% 50%,color-mix(in srgb,${c.colors[0]} 35%,transparent),transparent 70%),var(--panel)"><div class="pb" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">${crest(c.id,130)}<div><div class="eyebrow">${esc(S.leagues[c.league].name)} · Est. ${c.est}</div><h1 style="font-size:clamp(30px,5vw,50px);text-transform:uppercase;line-height:1">${esc(c.name)}</h1><p class="muted" style="margin:6px 0 10px">${esc(c.stadium)} · ${c.cap.toLocaleString('en-GB')} seats</p><div style="display:flex;gap:6px">${c.colors.map(x=>`<i style="width:26px;height:26px;border-radius:6px;background:${x};box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)"></i>`).join('')}</div></div><div style="margin-left:auto"><div class="eyebrow" style="color:var(--muted)">Reputation</div>${starHTML(stars(repToOvr(c.rep)))}</div></div></section>
 <section class="panel c8"><div class="ph"><h3>${seasonLabel()} kits</h3><button class="btn" data-act="kitflip">${ui.kitBack?'Show front':'Show back'}</button></div><div class="pb"><div class="kits" style="margin:0">${['home','away','third'].map(w=>`<figure>${kitSVG(c,w,ui.kitBack?{back:true,name:best.ln,num:best.num}:{})}<figcaption>${w}</figcaption></figure>`).join('')}</div></div></section>
 <section class="panel c4"><div class="ph"><h3>Board</h3></div><div class="pb"><dl class="facts"><div><dt>Objective</dt><dd>${expectation(S.user)}</dd></div><div><dt>Position</dt><dd>${S.results[c.league].length?ordinal(posIn(table(c.league),S.user)):'–'}</dd></div><div><dt>Shirt sponsor</dt><dd>${esc(c.sponsor)}</dd></div><div><dt>Founded</dt><dd>${c.est}</dd></div></dl></div></section></div>`;
}

/* ---------- season review ---------- */
function openSeasonReview(){
 const c=clubOf(S.user),tb=table(c.league),pos=posIn(tb,S.user);
 const rows=COUNTRIES.map(co=>{const[top,bot]=S.leagues.filter(l=>l.nation===co.code).sort((a,b)=>a.tier-b.tier);const t1=table(top.id),t2=table(bot.id);
  return`<tr><td>${flagSVG(co.code)} ${esc(top.name)}</td><td><div class="who">${crest(t1[0].id,18)}<b>${esc(clubOf(t1[0].id).short)}</b></div></td><td><small>Down: ${t1.slice(-2).map(r=>esc(clubOf(r.id).short)).join(', ')}</small></td><td><small>Up: ${t2.slice(0,2).map(r=>esc(clubOf(r.id).short)).join(', ')}</small></td></tr>`}).join('');
 openModal(`<div class="eyebrow">Season ${seasonLabel()} review</div><h2 style="font-size:30px;margin:6px 0">You finished ${ordinal(pos)} in the ${esc(S.leagues[c.league].name)}</h2><p class="muted" style="margin:0 0 14px">Objective: ${expectation(S.user)}.</p><div class="tw"><table class="tbl"><thead><tr><th>League</th><th>Champions</th><th>Relegated</th><th>Promoted</th></tr></thead><tbody>${rows}</tbody></table></div><button class="btn pri lg" style="width:100%;margin-top:16px" data-act="new-season">Start the ${2027+S.season}/${String(2028+S.season).slice(2)} season</button>`);
}

/* ---------- tactics data ---------- */
function slotDetail(p,pos,role){
 const w=PROF[pos],keys=Object.keys(w).sort((a,b)=>w[b]-w[a]).slice(0,7);
 return`<div class="sd"><div class="sd-top"><b data-act="player" data-id="${p.id}" class="lnk">${esc(p.fn+' '+p.ln)}</b>${starHTML(stars(rateAt(p,pos)))}</div>
 <div class="sd-kv"><span>Fit <b class="${famil(p,pos)>=.97?'v5':famil(p,pos)>=.86?'v3':'v2'}">${famil(p,pos)>=.97?'Natural':famil(p,pos)>=.86?'Accomplished':'Unconvincing'}</b></span><span>Condition <b>${p.cond}%</b></span><span>Morale ${moraleWord(p.mor)}</span><span>Age <b>${p.age}</b></span></div>
 <div class="abs">${keys.map(a=>attrBar(p,a)).join('')}</div></div>`;
}
function teamAnalysis(t){
 const ps=t.xi.map(id=>S.players[id]).filter(Boolean),slots=FORMATIONS[t.form],grp=g=>ps.filter((p,i)=>g.includes(slots[t.xi.indexOf(p.id)][0]));
 const av=(list,keys)=>list.length?list.reduce((a,p)=>a+keys.reduce((b,k)=>b+p.at[AIX[k]],0)/keys.length,0)/list.length:40;
 const out=ps.filter(p=>p.pos!=='GK'),gk=grp(['GK']);
 const m=[['Build-up play',av(grp(['CB','LB','RB','DM','GK']),['pas','vis','fir','cmp'])],['Chance creation',av(grp(['CM','AM','LW','RW']),['vis','pas','dri','cro'])],['Finishing',av(grp(['ST','LW','RW','AM']),['fin','cmp','lon'])],['Aerial threat',av(grp(['CB','ST']),['hea','jmp','str'])],['Pace',av(out,['pac','acc'])],['Pressing',av(out,['wor','sta','agg'])],['Defending',av(grp(['CB','LB','RB','DM']),['tck','mar','pos'])],['Goalkeeping',av(gk,['ref','div','han','one'])]];
 const age=(ps.reduce((a,p)=>a+p.age,0)/ps.length).toFixed(1),ht=Math.round(ps.reduce((a,p)=>a+p.ht,0)/ps.length),val=ps.reduce((a,p)=>a+p.val,0);
 return`<div class="ta"><div class="ta-kv"><span>Avg age <b>${age}</b></span><span>Avg height <b>${ht} cm</b></span><span>XI value <b>${money(val)}</b></span></div><div class="ta-grid">${m.map(([l,v])=>{const s=at20(v);return`<div class="ab wide"><span>${l}</span><i><b style="width:${s/20*100}%"></b></i><em class="${s>=16?'v6':s>=13?'v5':s>=10?'v4':'v3'}">${s}</em></div>`}).join('')}</div></div>`;
}
