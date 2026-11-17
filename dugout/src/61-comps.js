/* ================= competitions: identity + hub ================= */
const COMP_STYLE={ENG:['#4b1f7a','#f2c14e','crown'],ESP:['#c8401f','#ffd36b','flame'],GER:['#a70f1d','#ececec','bolt'],ITA:['#1b52b0','#f0c75e','tower'],FRA:['#0d5a60','#f5f1e6','star'],NED:['#e05f1b','#16224f','crown']};
function compStyle(lid){const lg=S.leagues[lid],[c1,c2,em]=COMP_STYLE[lg.nation];return lg.tier?{c1:mix(c1,'#000000',.38),c2,em}:{c1,c2,em}}
const compAbbr=lid=>{const n=S.leagues[lid].name.split(' ');return(n[0][0]+(n[1]||'')[0]).toUpperCase()+(S.leagues[lid].tier?'2':'')};
function leagueLogo(lid,size=48){
 const st=compStyle(lid),lg=S.leagues[lid],id=uid('lg');
 return`<svg class="lgo" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(lg.name)} logo"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(st.c1,'#ffffff',.14)}"/><stop offset="1" stop-color="${mix(st.c1,'#000000',.32)}"/></linearGradient><clipPath id="${id}c"><rect x="5" y="5" width="90" height="90" rx="22"/></clipPath></defs>
 <rect x="5" y="5" width="90" height="90" rx="22" fill="url(#${id})"/>
 <g clip-path="url(#${id}c)"><path d="M5 72 L95 30 L95 46 L5 88 Z" fill="${st.c2}" opacity=".1"/></g>
 <rect x="5" y="5" width="90" height="90" rx="22" fill="none" stroke="${st.c2}" stroke-opacity=".9" stroke-width="2.4"/>
 <rect x="11" y="11" width="78" height="78" rx="17" fill="none" stroke="${st.c2}" stroke-opacity=".28" stroke-width="1"/>
 ${emblemSVG(st.em,50,42,40,st.c2)}
 <rect x="27" y="68" width="46" height="15" rx="2" fill="${st.c2}"/><text x="50" y="79.5" text-anchor="middle" ${FONT} font-weight="800" font-size="12" letter-spacing="2" fill="${mix(st.c1,'#000000',.25)}">${compAbbr(lid)}</text></svg>`;
}
function compStrip(lid){const cups=S.cups?Object.values(S.cups).sort((a,b)=>(a.key==='cont'?-1:0)-(b.key==='cont'?-1:0)):[];
 return`<div class="comp-strip">${cups.map(c=>`<button class="comp-pick cup" data-act="pickComp" data-v="${c.key}" aria-pressed="${c.key===lid}" title="${esc(c.name)}">${cupLogo(c.key,30)}<span>${esc(c.name)}</span></button>`).join('')}${cups.length?'<i class="cs-div"></i>':''}${S.leagues.map(l=>`<button class="comp-pick" data-act="pickComp" data-v="${l.id}" aria-pressed="${l.id===lid}" title="${esc(l.name)}">${leagueLogo(l.id,30)}<span>${esc(l.name)}</span></button>`).join('')}</div>`}
function compHeader(lid){
 const lg=S.leagues[lid],st=compStyle(lid),tb=table(lid),played=S.results[lid].length,sc=Object.values(S.players).filter(p=>lg.clubs.includes(p.club)).sort((a,b)=>b.s.g-a.s.g)[0];
 const goals=S.results[lid].reduce((a,r)=>a+r.hg+r.ag,0);
 return`<section class="comp-hero" style="--lc:${st.c1};--lc2:${st.c2}">${leagueLogo(lid,88)}<div class="ch-main"><div class="eyebrow" style="color:${st.c2}">${flagSVG(lg.nation)} ${NATIONS[lg.nation].n} · ${lg.tier?'Second tier':'Top flight'} · ${seasonLabel()}</div><h1>${esc(lg.name)}</h1><div class="ch-stats">
 <div><small>Matchday</small><b>${Math.min(S.md,MDAYS)}/${MDAYS}</b></div><div><small>Leaders</small><b>${played?`${crest(tb[0].id,20)} ${esc(clubOf(tb[0].id).short)}`:'–'}</b></div><div><small>Top scorer</small><b>${sc&&sc.s.g?`${esc(sc.ln)} (${sc.s.g})`:'–'}</b></div><div><small>Goals per game</small><b>${played?(goals/played).toFixed(2):'–'}</b></div><div><small>Clubs</small><b>${lg.clubs.length}</b></div></div></div></section>`;
}
function leagueTable(lid,compact){
 const tb=table(lid),lg=S.leagues[lid],st=compStyle(lid);
 const zone=i=>lg.tier===0?(i===0?'zc':i<4?'zq':i>=tb.length-DROP?'zr':''):(i<DROP?'zp':i<DROP+4?'zq':'');
 return`<table class="tbl" style="--lc:${st.c1}"><thead><tr><th>#</th><th>Club</th><th class="r">P</th>${compact?'':'<th class="r">W</th><th class="r">D</th><th class="r">L</th><th class="r hide-sm">F</th><th class="r hide-sm">A</th>'}<th class="r">GD</th><th class="r">Pts</th>${compact?'':'<th class="hide-sm">Form</th>'}</tr></thead><tbody>
 ${tb.map((r,i)=>`<tr class="${zone(i)} ${r.id===S.user?'me':''}"><td>${i+1}</td><td><div class="who">${crest(r.id,18)}<b>${esc(compact?clubOf(r.id).short:clubOf(r.id).name)}</b></div></td><td class="r">${r.p}</td>${compact?'':`<td class="r">${r.w}</td><td class="r">${r.d}</td><td class="r">${r.l}</td><td class="r hide-sm">${r.gf}</td><td class="r hide-sm">${r.ga}</td>`}<td class="r">${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td class="r"><b>${r.pts}</b></td>${compact?'':`<td class="hide-sm">${formHTML(r.form)}</td>`}</tr>`).join('')}</tbody></table>`;
}
function resultRows(lid,md){const res=S.results[lid].filter(r=>r.md===md);
 return S.fixtures[lid][md].map(([h,a])=>{const r=res.find(x=>x.h===h&&x.a===a);return`<div class="fxr ${h===S.user||a===S.user?'mine':''}"><span class="t r">${esc(clubOf(h).short)} ${crest(h,20)}</span><span class="sc">${r?r.hg+' – '+r.ag:shortDate(mdDate(md))}</span><span class="t">${crest(a,20)} ${esc(clubOf(a).short)}</span></div>`}).join('')}
function viewComps(){
 if(typeof ui.lg==='string'&&S.cups&&S.cups[ui.lg])return viewCup(ui.lg);
 const lid=typeof ui.lg==='number'?ui.lg:clubOf(S.user).league,lg=S.leagues[lid],top=compStrip(lid)+compHeader(lid);
 const pl=()=>Object.values(S.players).filter(p=>lg.clubs.includes(p.club));
 const legend=`<div class="legend">${lg.tier===0?'<span><i class="zc"></i>Champions</span><span><i class="zq"></i>Top four</span><span><i class="zr"></i>Relegation</span>':'<span><i class="zp"></i>Promotion</span><span><i class="zq"></i>Chasing pack</span>'}</div>`;
 if(sub==='table')return top+`<div class="panel"><div class="ph"><h3>Standings</h3>${legend}</div><div class="tw">${leagueTable(lid,false)}</div></div>`;
 if(sub==='fixtures'){const md=ui.lgMd??Math.min(S.md,MDAYS-1);
  return top+`<div class="panel"><div class="ph"><h3>Matchday ${md+1} <small>${fmtDate(mdDate(md))}</small></h3><div class="toolbar" style="margin:0"><button class="btn" data-act="md" data-d="-1" ${md<=0?'disabled':''}>Previous</button><button class="btn" data-act="md" data-d="1" ${md>=MDAYS-1?'disabled':''}>Next</button></div></div><div class="fx-grid">${resultRows(lid,md)}</div></div>`}
 if(sub==='stats'){
  const block=(title,list,val)=>`<section class="panel c4"><div class="ph"><h3>${title}</h3></div><div class="list">${list.map((p,i)=>`<button class="li" style="grid-template-columns:22px auto 1fr auto" data-act="player" data-id="${p.id}"><small>${i+1}</small>${crest(p.club,20)}<span><b>${pName(p)}</b><small>${esc(clubOf(p.club).short)} · ${p.pos}</small></span><b class="av">${val(p)}</b></button>`).join('')||'<p class="pb muted">No data yet.</p>'}</div></section>`;
  const ps=pl();return top+`<div class="grid">${block('Goals',ps.filter(p=>p.s.g).sort((a,b)=>b.s.g-a.s.g).slice(0,15),p=>p.s.g)}${block('Assists',ps.filter(p=>p.s.a).sort((a,b)=>b.s.a-a.s.a).slice(0,15),p=>p.s.a)}${block('Average rating',ps.filter(p=>p.s.ap>=Math.max(2,S.md/3)).sort((a,b)=>avg(b)-avg(a)).slice(0,15),p=>avg(p).toFixed(2))}${block('Player of the match',ps.filter(p=>p.s.mom).sort((a,b)=>b.s.mom-a.s.mom).slice(0,15),p=>p.s.mom)}${block('Most valuable',ps.sort((a,b)=>b.val-a.val).slice(0,15),p=>money(p.val))}${block('Best young players',ps.filter(p=>p.age<=21).sort((a,b)=>b.pot-a.pot).slice(0,15),p=>starHTML(stars(p.pot)))}</div>`}
 if(sub==='clubs'){const tb=table(lid);return top+`<div class="club-cards">${lg.clubs.map(clubOf).sort((a,b)=>posIn(tb,a.id)-posIn(tb,b.id)).map(c=>{const sq=squadOf(c.id),best=sq.sort((a,b)=>b.ovr-a.ovr)[0];return`<div class="cc" style="--cc:${c.colors[0]}">${crest(c.id,64)}<div><b>${esc(c.name)}</b><small>${esc(c.stadium)} · ${c.cap.toLocaleString('en-GB')}</small><div class="cc-row"><span>${S.results[lid].length?ordinal(posIn(tb,c.id)):'–'}</span>${starHTML(stars(repToOvr(c.rep)))}<span>${c.tac.form}</span></div><small>Star: ${pName(best)} · Budget ${money(c.budget)}</small></div></div>`}).join('')}</div>`}
 if(sub==='history'){const h=S.compHist[lid]||[];return top+`<div class="panel"><div class="ph"><h3>Roll of honour</h3></div>${h.length?`<div class="tw"><table class="tbl"><thead><tr><th>Season</th><th>Champions</th><th class="r">Pts</th><th>Runners-up</th><th>Top scorer</th><th>Player of the Season</th></tr></thead><tbody>${h.map(x=>{const aw=(S.awards||[]).find(a=>a.season===x.season),la=aw&&aw.leagues.find(l=>l.lid===lid);return`<tr><td>${x.season}</td><td><div class="who">${crest(x.champ,18)}<b>${esc(clubOf(x.champ).name)}</b></div></td><td class="r">${x.pts}</td><td><div class="who">${crest(x.runner,18)}${esc(clubOf(x.runner).short)}</div></td><td>${esc(x.scorer)} <small>(${x.goals})</small></td><td>${la&&la.poty?`${esc(la.poty.n)} <small>${esc(clubOf(la.poty.club).short)}</small>`:'–'}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="pb muted">The first champions will be crowned at the end of this season.</p>'}</div>`}
 // overview
 const tb=table(lid),lastMd=Math.max(0,Math.min(S.md,MDAYS)-1),ps=pl();
 const goals=S.results[lid].reduce((a,r)=>a+r.hg+r.ag,0),hw=S.results[lid].filter(r=>r.hg>r.ag).length,big=S.results[lid].slice().sort((a,b)=>Math.abs(b.hg-b.ag)-Math.abs(a.hg-a.ag))[0];
 return top+`<div class="grid"><section class="panel c7"><div class="ph"><h3>Standings</h3><button class="btn" data-act="sub" data-v="table">Full table</button></div><div class="tw">${leagueTable(lid,true)}</div></section>
 <div class="c5" style="display:grid;gap:12px;align-content:start"><section class="panel"><div class="ph"><h3>${S.md?'Latest results':'Opening fixtures'} <small>Matchday ${(S.md?lastMd:0)+1}</small></h3></div><div class="fx-grid one">${resultRows(lid,S.md?lastMd:0)}</div></section>
 <section class="panel"><div class="ph"><h3>Season in numbers</h3></div><div class="pb kpis"><div><small>Goals</small><b>${goals}</b></div><div><small>Per game</small><b>${S.results[lid].length?(goals/S.results[lid].length).toFixed(2):'–'}</b></div><div><small>Home wins</small><b>${S.results[lid].length?Math.round(hw/S.results[lid].length*100)+'%':'–'}</b></div><div><small>Biggest win</small><b>${big?`${big.hg}–${big.ag}`:'–'}</b></div></div></section>
 <section class="panel"><div class="ph"><h3>Golden boot</h3><button class="btn" data-act="sub" data-v="stats">All stats</button></div><div class="list">${ps.filter(p=>p.s.g).sort((a,b)=>b.s.g-a.s.g).slice(0,5).map((p,i)=>`<button class="li" style="grid-template-columns:22px auto 1fr auto" data-act="player" data-id="${p.id}"><small>${i+1}</small>${crest(p.club,20)}<span><b>${pName(p)}</b></span><b class="av">${p.s.g}</b></button>`).join('')||'<p class="pb muted">No goals yet.</p>'}</div></section></div></div>`;
}

/* ---------- cups ---------- */
function cupStyle(key){if(key==='cont')return{c1:'#101a3c',c2:'#dfe5f0',c3:'#7d8fbf'};const n=key.slice(4),[c1,c2]=COMP_STYLE[n];return{c1:mix(c1,'#000000',.45),c2:'#e8c25a',c3:c2}}
const TROPHY='M30 22h40v14c0 13-9 23-20 24-11-1-20-11-20-24zM30 27H22c0 9 5 15 11 16M70 27h8c0 9-5 15-11 16M45 60h10v8H45zM36 68h28l3 7H33z';
function cupLogo(key,size=48){
 const st=cupStyle(key),id=uid('cl'),c=S.cups&&S.cups[key],ab=key==='cont'?'ECC':(c?c.name:'CUP').split(' ').map(w=>w[0]).join('').slice(0,3).toUpperCase();
 const ring=key==='cont'?Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return`<circle cx="${(50+Math.cos(a)*36).toFixed(1)}" cy="${(46+Math.sin(a)*36).toFixed(1)}" r="2.3" fill="${st.c2}" opacity=".75"/>`}).join(''):'';
 return`<svg class="lgo" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${esc(c?c.name:'Cup')} logo"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${mix(st.c1,'#ffffff',.18)}"/><stop offset="1" stop-color="${mix(st.c1,'#000000',.35)}"/></radialGradient>
 <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(st.c2,'#ffffff',.35)}"/><stop offset=".55" stop-color="${st.c2}"/><stop offset="1" stop-color="${mix(st.c2,'#000000',.35)}"/></linearGradient></defs>
 <circle cx="50" cy="50" r="46" fill="url(#${id})"/><circle cx="50" cy="50" r="46" fill="none" stroke="${st.c2}" stroke-width="2.4"/><circle cx="50" cy="50" r="40" fill="none" stroke="${st.c2}" stroke-opacity=".25"/>${ring}
 <path d="${TROPHY}" fill="url(#${id}t)" stroke="${mix(st.c2,'#000000',.45)}" stroke-width="1.2" stroke-linejoin="round" transform="translate(0 -4)"/>
 <rect x="28" y="74" width="44" height="13" rx="2" fill="${st.c2}"/><text x="50" y="84" text-anchor="middle" ${FONT} font-weight="800" font-size="10.5" letter-spacing="2" fill="${st.c1}">${ab}</text></svg>`;
}
const compBadge=(comp,size=18)=>comp==='lg'||typeof comp==='number'?leagueLogo(typeof comp==='number'?comp:clubOf(S.user).league,size):cupLogo(comp,size);
function cupStage(c){const done=c.rounds.findIndex(r=>!r||r.some(t=>t.hg==null));return c.winner!=null?'Complete':done<0?'Complete':c.names[done]}
function tieCard(t,c,r){
 if(!t)return`<div class="tie tbd"><span>To be drawn</span></div>`;
 const w=t.hg!=null?tieWinner(t):null,row=id=>`<div class="tr ${w===id?'w':w!=null?'l':''} ${id===S.user?'me':''}">${crest(id,16)}<b>${esc(clubOf(id).short)}</b><em>${t.hg!=null?(id===t.h?t.hg:t.ag):''}${t.pens?`<sup>${id===t.h?t.pens[0]:t.pens[1]}</sup>`:''}</em></div>`;
 return`<div class="tie ${t.h===S.user||t.a===S.user?'mine':''}">${row(t.h)}${row(t.a)}${t.pens?'<small class="tp">pens</small>':''}</div>`;
}
function bracketHTML(c){
 const start=c.kind==='gko'?6:0,cols=[];let n=c.kind==='gko'?4:16;
 for(let r=start;r<c.names.length;r++){const ties=c.rounds[r]||Array(n).fill(null);cols.push(`<div class="br-col"><div class="br-h">${esc(c.names[r])}<small>${shortDate(mdDate(c.after[r])+3*DAY)}</small></div><div class="br-ties">${ties.map(t=>tieCard(t,c,r)).join('')}</div></div>`);n=Math.max(1,n/2)}
 const champ=c.winner!=null?`<div class="br-col champ"><div class="br-h">Winner</div><div class="br-ties"><div class="br-win">${crest(c.winner,54)}<b>${esc(clubOf(c.winner).name)}</b></div></div></div>`:'';
 return`<div class="bracket">${cols.join('')}${champ}</div>`;
}
function groupsHTML(c){return`<div class="groups">${c.groups.map((g,gi)=>`<section class="panel"><div class="ph"><h3>Group ${'ABCD'[gi]}</h3></div><table class="tbl"><thead><tr><th>#</th><th>Club</th><th class="r">P</th><th class="r">GD</th><th class="r">Pts</th></tr></thead><tbody>${groupTable(g).map((r,i)=>`<tr class="${i<2?'zq':''} ${r.id===S.user?'me':''}"><td>${i+1}</td><td><div class="who">${crest(r.id,18)}<b>${esc(clubOf(r.id).short)}</b> ${flagSVG(clubOf(r.id).nation)}</div></td><td class="r">${r.p}</td><td class="r">${r.gf-r.ga>0?'+':''}${r.gf-r.ga}</td><td class="r"><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></section>`).join('')}</div>`}
function viewCup(key){
 const c=S.cups[key],st=cupStyle(key),hist=(S.cupHist||{})[key]||[],holder=hist[0];
 const ut=c.teams.includes(S.user),alive=ut&&(c.winner===S.user||userAlive(c,c.rounds.findIndex(r=>!r||r.some(t=>t.hg==null))<0?c.names.length-1:c.rounds.findIndex(r=>!r||r.some(t=>t.hg==null))));
 const all=c.rounds.filter(Boolean).flat().filter(t=>t.hg!=null),goals=all.reduce((a,t)=>a+t.hg+t.ag,0);
 const top=compStrip(key)+`<section class="comp-hero cup" style="--lc:${st.c1};--lc2:${st.c2}">${cupLogo(key,88)}<div class="ch-main"><div class="eyebrow" style="color:${st.c2}">${key==='cont'?'Continental':`${flagSVG(c.nation)} ${NATIONS[c.nation].n}`} · Cup · ${seasonLabel()}</div><h1>${esc(c.name)}</h1><div class="ch-stats">
 <div><small>Stage</small><b>${esc(cupStage(c))}</b></div><div><small>Holders</small><b>${holder?`${crest(holder.w,20)} ${esc(clubOf(holder.w).short)}`:'–'}</b></div><div><small>Your club</small><b>${!ut?'Not entered':c.winner===S.user?'Winners':alive?'Still in':'Knocked out'}</b></div><div><small>Clubs</small><b>${c.teams.length}</b></div><div><small>Goals per game</small><b>${all.length?(goals/all.length).toFixed(2):'–'}</b></div></div></div></section>`;
 if(sub==='history')return top+`<div class="panel"><div class="ph"><h3>Roll of honour</h3></div>${hist.length?`<div class="tw"><table class="tbl"><thead><tr><th>Season</th><th>Winners</th><th class="r">Final</th><th>Runners-up</th></tr></thead><tbody>${hist.map(x=>`<tr><td>${x.season}</td><td><div class="who">${crest(x.w,18)}<b>${esc(clubOf(x.w).name)}</b></div></td><td class="r">${x.h===x.w?x.hg+'–'+x.ag:x.ag+'–'+x.hg}${x.pens?' (p)':''}</td><td><div class="who">${crest(x.ru,18)}${esc(clubOf(x.ru).name)}</div></td></tr>`).join('')}</tbody></table></div>`:'<p class="pb muted">The first final is still to be played.</p>'}</div>`;
 if(sub==='fixtures')return top+c.names.map((nm,r)=>c.rounds[r]?`<section class="panel" style="margin-bottom:12px"><div class="ph"><h3>${esc(nm)} <small>${fmtDate(mdDate(c.after[r])+3*DAY)}</small></h3></div><div class="fx-grid">${c.rounds[r].map(t=>`<div class="fxr ${t.h===S.user||t.a===S.user?'mine':''}"><span class="t r">${esc(clubOf(t.h).short)} ${crest(t.h,20)}</span><span class="sc">${t.hg!=null?t.hg+' – '+t.ag+(t.pens?` <small>(${t.pens[0]}–${t.pens[1]} p)</small>`:''):shortDate(mdDate(c.after[r])+3*DAY)}</span><span class="t">${crest(t.a,20)} ${esc(clubOf(t.a).short)}</span></div>`).join('')}</div></section>`:'').join('')||top+'<p class="muted">No ties drawn yet.</p>';
 if(sub==='clubs'||sub==='stats')return top+`<div class="club-cards">${c.teams.map(clubOf).sort((a,b)=>b.rep-a.rep).map(k=>`<div class="cc" style="--cc:${k.colors[0]}">${crest(k.id,56)}<div><b>${esc(k.name)}</b><small>${esc(S.leagues[k.league].name)}</small><div class="cc-row">${starHTML(stars(repToOvr(k.rep)))}</div></div></div>`).join('')}</div>`;
 const legend=c.kind==='gko'?'<p class="muted" style="margin:0 0 10px">Top two in each group reach the quarter-finals. Group winners face runners-up.</p>':'<p class="muted" style="margin:0 0 10px">Single-leg ties, redrawn every round. Level after 90 minutes goes to penalties.</p>';
 return top+legend+(c.kind==='gko'?groupsHTML(c):'')+`<section class="panel"><div class="ph"><h3>Knockout</h3></div><div class="pb" style="overflow-x:auto">${bracketHTML(c)}</div></section>`;
}
