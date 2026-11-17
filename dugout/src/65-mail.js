/* ================= inbox: a two-pane mail client =================
   Messages store only ids (player, club, kind of attachment). Images, cards and tables are drawn when a message
   is opened, so saves stay small and attachments always show current data. */
ui.mailF='all';ui.msg=null;

const STAFF={
 'Board of Directors':{role:'Chairman’s office',col:'#b8944a',addr:'board',icon:'M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5'},
 'Assistant Manager':{role:'First team',col:'#4f8fd6',addr:'assistant',icon:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6'},
 'Head of Coaching':{role:'Training ground',col:'#3fb37f',addr:'coaching',icon:'M5 19l4-8 4 5 3-4 3 7M5 5h14'},
 'Director of Football':{role:'Recruitment',col:'#d0743c',addr:'football',icon:'M4 12h12M12 6l6 6-6 6'},
 'Head of Youth':{role:'Academy',col:'#9a6ad6',addr:'academy',icon:'M12 3l3 6 6 .9-4.5 4.3 1 6.3L12 17l-5.5 3.5 1-6.3L3 9.9 9 9z'},
};
const MAIL_KIND={board:'Board',staff:'Staff',transfer:'Transfers',info:'Club'};
function sender(m){
 const st=STAFF[m.from],c=clubOf(S.user),dom=(c.short||c.name).toLowerCase().replace(/[^a-z]/g,'')+'.club';
 if(st)return{name:m.from,role:st.role,addr:`${st.addr}@${dom}`,avatar:`<span class="av" style="--ac:${st.col}"><svg viewBox="0 0 24 24"><path d="${st.icon}"/></svg></span>`};
 const oc=S.clubs.find(x=>x.name===m.from);
 if(oc)return{name:m.from,role:'Transfer office',addr:`transfers@${(oc.short||oc.name).toLowerCase().replace(/[^a-z]/g,'')}.club`,avatar:`<span class="av crest-av">${crest(oc.id,30)}</span>`};
 return{name:m.from,role:'',addr:'',avatar:`<span class="av" style="--ac:#666"><b>${esc(m.from[0]||'?')}</b></span>`};
}
const mailTime=m=>{const h=8+(m.id*7)%11,mi=(m.id*13)%60;return`${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`};
const mailDate=m=>m.season===S.season?shortDate(mdDate(Math.min(m.md,MDAYS-1))):`Season ${m.season}`;
const preview=m=>esc(m.body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,110));

/* ---- attachments ---- */
function stadiumBanner(c){
 const[a,b]=c.colors,id=uid('sb');
 return`<svg class="m-hero" viewBox="0 0 640 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(c.stadium)}">
 <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(a,'#0a0f1e',.75)}"/><stop offset="1" stop-color="${mix(a,'#20304a',.55)}"/></linearGradient>
 <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8a4a"/><stop offset="1" stop-color="#1c5e31"/></linearGradient></defs>
 <rect width="640" height="220" fill="url(#${id}s)"/>
 ${[80,560].map(x=>`<rect x="${x-3}" y="18" width="6" height="96" fill="#2a3446"/><rect x="${x-26}" y="10" width="52" height="16" rx="2" fill="#fff8de"/><circle cx="${x}" cy="18" r="70" fill="#fff8de" opacity=".08"/>`).join('')}
 <path d="M0 132 L60 76 H580 L640 132 Z" fill="${mix(b,'#0b0f18',.55)}"/>
 ${Array.from({length:7},(_,r)=>`<path d="M${12+r*7} ${126-r*7} H${628-r*7}" stroke="${r%2?mix(a,'#000',.2):mix(b,'#000',.35)}" stroke-width="5" opacity=".85"/>`).join('')}
 <rect x="60" y="66" width="520" height="12" fill="${mix(a,'#000',.15)}"/><text x="320" y="75.5" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="10" letter-spacing="4" fill="${ink(mix(a,'#000',.15))}">${esc(c.stadium.toUpperCase())}</text>
 <path d="M0 132 H640 V220 H0 Z" fill="url(#${id}p)"/>${Array.from({length:8},(_,i)=>`<path d="M${i*80} 132 h40 l${40+i*6-24} 88 h-40 z" fill="#fff" opacity=".04"/>`).join('')}
 <path d="M320 132 V220 M140 220 Q320 150 500 220" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none"/>
 <g transform="translate(286 150)">${crestSVG(c,{x:0,y:0,w:68})}</g></svg>`;
}
function playerCard(p,note){
 if(!p)return'';const c=p.club>=0?clubOf(p.club):null,keys=(KEY_ATTRS[p.pos]||[]).slice(0,4);
 return`<div class="m-card">${c?`<div class="m-kit">${kitSVG(c,'home',{back:true,name:p.ln,num:p.num})}</div>`:''}
 <div class="m-pc"><div class="eyebrow">${note||posChip(p.pos)+' '+esc(c?c.short:'Free agent')}</div><h4>${esc(p.fn+' '+p.ln)}</h4>
 <div class="m-pr">${flagSVG(p.nat)} <span>${p.age} yrs</span> ${posChip(p.pos)}</div>
 <div class="m-pr"><small>Ability</small>${starHTML(stars(p.ovr))}<small>Potential</small>${starHTML(stars(p.pot))}</div>
 <div class="m-attrs">${keys.map(a=>attrBar(p,a)).join('')}</div>
 <div class="m-pr"><small>Value</small><b>${money(p.val)}</b><small>Wage</small><b>${money(p.wage)}/w</b></div></div></div>`;
}
function attachHTML(m){
 const a=m.att;if(!a)return'';const c=clubOf(S.user);
 switch(a.t){
  case'stadium':return stadiumBanner(clubOf(a.cid??S.user));
  case'player':return playerCard(S.players[a.pid],a.note);
  case'players':return`<div class="m-grid">${a.pids.map(id=>S.players[id]).filter(Boolean).slice(0,4).map(p=>playerCard(p)).join('')}</div>`;
  case'budget':{const wb=wageBill(S.user);return`<div class="m-kpis"><div><small>Transfer budget</small><b>${money(c.budget)}</b></div><div><small>Wage budget</small><b>${money(c.wageBudget)}/w</b></div><div><small>Wage bill</small><b>${money(wb)}/w</b><i class="meter"><i style="width:${clamp(wb/c.wageBudget*100,0,100)}%"></i></i></div><div><small>Objective</small><b>${esc(expectation(S.user))}</b></div></div>`}
  case'table':return`<div class="m-table">${leagueTable(c.league,true)}</div>`;
  case'squad':{const sq=squadOf(S.user).sort((x,y)=>y.ovr-x.ovr).slice(0,3);return`<div class="m-grid">${sq.map(p=>playerCard(p)).join('')}</div>`}
 }
 return'';
}

/* ---- list and reader ---- */
function mailRow(m){
 const sd=sender(m);
 return`<button class="mrow ${m.read?'':'unread'} ${ui.msg===m.id?'on':''}" data-act="msg" data-id="${m.id}">${sd.avatar}
 <span class="mr-main"><span class="mr-top"><b>${esc(sd.name)}</b><small>${mailDate(m)}</small></span><span class="mr-subj">${esc(m.subj)}</span><span class="mr-prev">${preview(m)}</span></span>
 ${m.action&&m.action.type==='offer'&&!m.action.done?'<i class="mr-tag">Action</i>':''}</button>`;
}
const msgRow=mailRow;
function readerHTML(m){
 if(!m)return`<div class="m-empty"><svg viewBox="0 0 24 24"><path d="M3 6h18v12H3zM3 6l9 7 9-7"/></svg><p>Select a message to read it.</p></div>`;
 const sd=sender(m),c=clubOf(S.user),a=m.action;let act='';
 if(a&&a.type==='offer'&&!a.done){const p=S.players[a.pid];act=p&&p.club===S.user&&windowOpen()?`<button class="btn pri" data-act="offer-yes" data-id="${m.id}">Accept ${money(a.fee)}</button><button class="btn" data-act="offer-no" data-id="${m.id}">Reject offer</button>`:'<span class="muted">This offer has lapsed.</span>'}
 else if(a&&a.type==='offer')act=`<span class="muted">${a.done==='yes'?'You accepted this offer.':'You rejected this offer.'}</span>`;
 const links=(m.links||[]).map(([l,act2,v,isId])=>`<button class="btn" data-act="${act2}" ${isId?`data-id="${v}"`:`data-v="${v}"`}>${esc(l)} ${ARROW}</button>`).join('');
 return`<article class="m-read"><header class="m-head">${sd.avatar}<div class="m-who"><b>${esc(sd.name)}</b>${sd.addr?`<small>&lt;${esc(sd.addr)}&gt;${sd.role?' · '+esc(sd.role):''}</small>`:''}<small>To: You (Manager, ${esc(c.name)})</small></div>
 <div class="m-when"><small>${mailDate(m)}, ${mailTime(m)}</small><span class="chip">${MAIL_KIND[m.kind]||'Club'}</span></div></header>
 <h2 class="m-subj">${esc(m.subj)}</h2>
 ${m.att&&m.att.t==='stadium'?attachHTML(m):''}
 <div class="m-body">${m.body}</div>
 ${m.att&&m.att.t!=='stadium'?`<div class="m-att">${attachHTML(m)}</div>`:''}
 ${act||links?`<div class="m-actions">${act}${links}</div>`:''}
 <footer class="m-sign">${esc(sd.name)}${sd.role?`<br><small>${esc(sd.role)} · ${esc(c.name)}</small>`:''}</footer></article>`;
}
function inboxView(){
 const list=S.inbox.filter(m=>ui.mailF==='all'||(ui.mailF==='unread'?!m.read:m.kind===ui.mailF));
 if(ui.msg==null&&list[0])ui.msg=list[0].id;
 const m=S.inbox.find(x=>x.id===ui.msg);if(m&&!m.read){m.read=true;save()}
 const unread=S.inbox.filter(x=>!x.read).length;
 return`<div class="mail"><aside class="m-list panel"><div class="m-tools"><div class="seg" role="group" aria-label="Filter">${[['all','All'],['unread',`Unread${unread?' '+unread:''}`],['board','Board'],['staff','Staff'],['transfer','Transfers']].map(([k,l])=>`<button data-act="mailf" data-v="${k}" aria-pressed="${ui.mailF===k}">${l}</button>`).join('')}</div>
 <button class="btn ghost" data-act="mail-read-all">Mark all read</button></div>
 <div class="m-rows">${list.map(mailRow).join('')||'<p class="pb muted">No messages here.</p>'}</div></aside>
 <section class="panel m-pane">${readerHTML(m)}</section></div>`;
}
function openMsg(id){ui.msg=id;if(view!=='home'||sub!=='inbox'){go('home','inbox');return}render();const r=document.querySelector('.m-pane');if(r&&innerWidth<900)r.scrollIntoView({behavior:'smooth'})}
