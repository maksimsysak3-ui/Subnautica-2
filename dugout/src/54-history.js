/* ================= history, awards and records =================
   At the end of every season: awards for every league (player and young player of the season, golden boot,
   manager of the season, team of the season), a line in every player's career, the club's season record,
   and retired greats kept as legends so club records survive them. */
const TOTS_SLOTS=[['GK',['GK']],['RB',['RB']],['CB',['CB']],['CB',['CB']],['LB',['LB']],['DM',['DM','CM']],['CM',['CM','AM','DM']],['AM',['AM','CM']],['RW',['RW','LW','AM']],['ST',['ST']],['LW',['LW','RW','AM']]];
const awScore=p=>avg(p)+p.s.g*.03+p.s.a*.022+p.s.mom*.02;
function leagueAwards(lg){
 const pool=Object.values(S.players).filter(p=>lg.clubs.includes(p.club)&&p.s.ap>=10),best=(list,f)=>list.slice().sort((a,b)=>f(b)-f(a))[0];
 const poty=best(pool.filter(p=>p.s.ap>=18),awScore),young=best(pool.filter(p=>p.age<=21&&p.s.ap>=12),awScore);
 const boot=pool.slice().sort((a,b)=>b.s.g-a.s.g||a.s.ap-b.s.ap)[0],used=new Set(),tots=[];
 for(const[slot,ok]of TOTS_SLOTS){const p=best(pool.filter(q=>ok.includes(q.pos)&&!used.has(q.id)&&q.s.ap>=14),q=>avg(q)+(q.pos===slot?.15:0));if(p){used.add(p.id);tots.push(p.id)}else tots.push(null)}
 const tb=table(lg.id),mots=tb.map((r,i)=>({id:r.id,d:targetPos(r.id)-(i+1)})).sort((a,b)=>b.d-a.d||posIn(tb,a.id)-posIn(tb,b.id))[0];
 return{lid:lg.id,poty:poty&&poty.id,young:young&&young.id,boot:boot&&boot.s.g?{pid:boot.id,g:boot.s.g}:null,tots,mots:mots&&mots.id};
}
const snap=p=>p?{id:p.id,n:p.fn+' '+p.ln,club:p.club,pos:p.pos,age:p.age,ap:p.s.ap,g:p.s.g,a:p.s.a,r:+avg(p).toFixed(2)}:null;
function seasonHistory(){
 const season=seasonLabel(),aw={season,leagues:[]};
 for(const lg of S.leagues){const a=leagueAwards(lg);aw.leagues.push({lid:a.lid,name:lg.name,tier:lg.tier,poty:snap(S.players[a.poty]),young:snap(S.players[a.young]),boot:a.boot?Object.assign(snap(S.players[a.boot.pid]),{g:a.boot.g}):null,tots:a.tots.map(id=>snap(S.players[id])),mots:a.mots});
  const hon=(id,t)=>{const p=S.players[id];if(p)(p.hon=p.hon||[]).push({t,lg:lg.name,season})};
  hon(a.poty,'Player of the Season');hon(a.young,'Young Player of the Season');if(a.boot)hon(a.boot.pid,'Golden Boot');a.tots.forEach(id=>id!=null&&hon(id,'Team of the Season'));
  if(a.mots===S.user)(S.mgr.awards=S.mgr.awards||[]).push({t:'Manager of the Season',lg:lg.name,season})}
 (S.awards=S.awards||[]).unshift(aw);if(S.awards.length>25)S.awards.length=25;
 // careers
 for(const p of Object.values(S.players))if(p.s.ap>0){(p.car=p.car||[]).push({season,club:p.club,ap:p.s.ap,g:p.s.g,a:p.s.a,r:+avg(p).toFixed(2)});if(p.car.length>22)p.car.shift()}
 // the user's season in detail
 const c=clubOf(S.user),tb=table(c.league),row=tb.find(r=>r.id===S.user)||{},top=squadOf(S.user).sort((a,b)=>b.s.g-a.s.g)[0];
 const cupRuns=S.cups?Object.values(S.cups).filter(k=>k.teams.includes(S.user)).map(k=>{if(k.winner===S.user)return{n:k.name,r:'Winners'};let last='';k.rounds.forEach((r,i)=>{if(r&&r.some(t=>t.h===S.user||t.a===S.user))last=k.names[i]});return{n:k.name,r:last.startsWith('Group')?'Group stage':last||'–'}}):[];
 S.lastRow={pts:row.pts,w:row.w,d:row.d,l:row.l,gf:row.gf,ga:row.ga,top:top&&top.s.g?{n:top.fn[0]+'. '+top.ln,g:top.s.g}:null,cups:cupRuns,lid:c.league,club:S.user};
 // biggest wins for the user's club this season, league and cups
 const mine=S.results[c.league].filter(r=>r.h===S.user||r.a===S.user).map(r=>({gf:r.h===S.user?r.hg:r.ag,ga:r.h===S.user?r.ag:r.hg,opp:r.h===S.user?r.a:r.h,comp:S.leagues[c.league].name}));
 if(S.cups)for(const k of Object.values(S.cups))for(const r of k.rounds)if(r)for(const t of r)if(t.hg!=null&&(t.h===S.user||t.a===S.user))mine.push({gf:t.h===S.user?t.hg:t.ag,ga:t.h===S.user?t.ag:t.hg,opp:t.h===S.user?t.a:t.h,comp:k.name});
 const rec=(S.clubRec=S.clubRec||{})[S.user]=S.clubRec[S.user]||{};
 for(const m of mine){const d=m.gf-m.ga;if(!rec.bigWin||d>rec.bigWin.gf-rec.bigWin.ga||d===rec.bigWin.gf-rec.bigWin.ga&&m.gf>rec.bigWin.gf)rec.bigWin=Object.assign({season},m);if(!rec.bigLoss||d<rec.bigLoss.gf-rec.bigLoss.ga)rec.bigLoss=Object.assign({season},m)}
 if(row.pts!=null&&(!rec.mostPts||row.pts>rec.mostPts.pts))rec.mostPts={pts:row.pts,season,lg:S.leagues[c.league].name};
 if(row.gf!=null&&(!rec.mostGoals||row.gf>rec.mostGoals.gf))rec.mostGoals={gf:row.gf,season};
}
// Keep notable players after they retire, so club records and the hall of fame survive them.
function keepLegend(p){
 const ap=(p.car||[]).reduce((a,x)=>a+x.ap,0),g=(p.car||[]).reduce((a,x)=>a+x.g,0);
 if(ap<120&&g<45&&!(p.hon||[]).length)return;
 (S.legends=S.legends||[]).push({id:p.id,n:p.fn+' '+p.ln,pos:p.pos,nat:p.nat,car:p.car||[],hon:p.hon||[],ovr:p.ovr,retired:seasonLabel()});
 if(S.legends.length>400)S.legends.shift();
}
// All-time records for a club, from current players' careers plus retired legends.
function clubAllTime(cid){
 const tally={};const add=(id,n,car,pos,live)=>{for(const x of car||[])if(x.club===cid){const t=tally[id]=tally[id]||{id,n,pos,ap:0,g:0,a:0,seasons:0,live};t.ap+=x.ap;t.g+=x.g;t.a+=x.a;t.seasons++}};
 for(const p of Object.values(S.players))add(p.id,p.fn+' '+p.ln,p.car,p.pos,true);
 for(const l of S.legends||[])add(l.id,l.n,l.car,l.pos,false);
 const list=Object.values(tally);
 return{scorers:list.filter(x=>x.g).sort((a,b)=>b.g-a.g).slice(0,10),apps:list.sort((a,b)=>b.ap-a.ap).slice(0,10)};
}

/* ---------- views ---------- */
function posChart(hist){
 if(hist.length<2)return'';const pts=hist.slice().reverse(),W=600,H=160,X=i=>20+i*(W-40)/(pts.length-1),Y=p=>14+(p-1)/(PER-1)*(H-34);
 return`<svg class="an-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="League finishes by season">${[1,5,10,15,20].map(p=>`<line x1="20" x2="${W-20}" y1="${Y(p)}" y2="${Y(p)}" stroke="rgba(255,255,255,.06)"/><text x="4" y="${Y(p)+3}" font-size="9" fill="rgba(255,255,255,.35)">${p}</text>`).join('')}
 <path d="M${pts.map((h,i)=>`${X(i)} ${Y(h.pos)}`).join(' L')}" fill="none" stroke="var(--accent)" stroke-width="2.4"/>${pts.map((h,i)=>`<circle cx="${X(i)}" cy="${Y(h.pos)}" r="4.5" fill="${h.pos===1?'#e8c25a':'#141416'}" stroke="var(--accent)" stroke-width="2"><title>${h.season}: ${ordinal(h.pos)} in ${esc(h.league)}</title></circle><text x="${X(i)}" y="${H-4}" font-size="9" text-anchor="middle" fill="rgba(255,255,255,.4)">${h.season.slice(2)}</text>`).join('')}</svg>`;
}
function viewClubHistory(){
 const H=S.hist;
 return`<div class="grid"><section class="panel c12"><div class="ph"><h3>League finishes</h3></div><div class="pb">${H.length>1?posChart(H):'<p class="muted" style="margin:0">Complete two seasons to see your trajectory.</p>'}</div></section>
 <section class="panel c12"><div class="ph"><h3>Season by season</h3></div>${H.length?`<div class="tw"><table class="tbl"><thead><tr><th>Season</th><th>Club</th><th>League</th><th class="r">Pos</th><th class="r">P</th><th class="r">W-D-L</th><th class="r">GF:GA</th><th class="r">Pts</th><th>Cups</th><th>Top scorer</th></tr></thead><tbody>
 ${H.map(h=>`<tr><td>${h.season}</td><td>${h.club!=null?`<div class="who">${crest(h.club,16)}${esc(clubOf(h.club).short)}</div>`:''}</td><td>${esc(h.league)}</td><td class="r"><b>${ordinal(h.pos)}</b></td><td class="r">${h.w!=null?h.w+h.d+h.l:''}</td><td class="r">${h.w!=null?`${h.w}-${h.d}-${h.l}`:''}</td><td class="r">${h.gf!=null?h.gf+':'+h.ga:''}</td><td class="r">${h.pts??''}</td><td><small>${(h.cups||[]).map(x=>`${esc(x.n)}: ${esc(x.r)}`).join('<br>')}</small></td><td><small>${h.top?`${esc(h.top.n)} (${h.top.g})`:''}</small></td></tr>`).join('')}</tbody></table></div>`:'<p class="pb muted">Your first season is under way.</p>'}</section></div>`;
}
function viewClubRecords(){
 const rec=(S.clubRec||{})[S.user]||{},at=clubAllTime(S.user),c=clubOf(S.user);
 const lst=(t,list,f)=>`<section class="panel c4"><div class="ph"><h3>${t}</h3></div><div class="list">${list.length?list.map((x,i)=>`<${x.live?`button class="li" data-act="player" data-id="${x.id}"`:'div class="li"'} style="grid-template-columns:22px 1fr auto"><small>${i+1}</small><span><b>${esc(x.n)}</b><small>${x.pos} · ${x.seasons} season${x.seasons>1?'s':''}${x.live?'':' · retired'}</small></span><b class="av">${f(x)}</b></${x.live?'button':'div'}>`).join(''):'<p class="pb muted" style="margin:0">Records start after your first season.</p>'}</div></section>`;
 const legends=(S.legends||[]).filter(l=>l.car.some(x=>x.club===S.user)).slice(-8).reverse();
 const box=(k,v,s)=>`<div><small>${k}</small><b>${v}</b><small>${s||''}</small></div>`;
 return`<div class="grid"><section class="panel c12"><div class="ph"><h3>${esc(c.name)} records</h3></div><div class="pb rec-kpis">
 ${box('Biggest win',rec.bigWin?`${rec.bigWin.gf}–${rec.bigWin.ga}`:'–',rec.bigWin?`v ${esc(clubOf(rec.bigWin.opp).short)} · ${esc(rec.bigWin.comp)} · ${rec.bigWin.season}`:'')}
 ${box('Heaviest defeat',rec.bigLoss?`${rec.bigLoss.gf}–${rec.bigLoss.ga}`:'–',rec.bigLoss?`v ${esc(clubOf(rec.bigLoss.opp).short)} · ${rec.bigLoss.season}`:'')}
 ${box('Most points',rec.mostPts?rec.mostPts.pts:'–',rec.mostPts?`${rec.mostPts.season} · ${esc(rec.mostPts.lg)}`:'')}
 ${box('Most league goals',rec.mostGoals?rec.mostGoals.gf:'–',rec.mostGoals?rec.mostGoals.season:'')}
 ${box('Founded',c.est,esc(c.stadium))}</div></section>
 ${lst('All-time top scorers',at.scorers,x=>x.g)}${lst('Most appearances',at.apps,x=>x.ap)}
 <section class="panel c4"><div class="ph"><h3>Hall of fame</h3></div><div class="list">${legends.length?legends.map(l=>`<div class="li" style="grid-template-columns:1fr auto"><span><b>${esc(l.n)}</b><small>${l.pos} · retired ${l.retired} · ${l.car.reduce((a,x)=>a+x.ap,0)} apps, ${l.car.reduce((a,x)=>a+x.g,0)} goals</small></span><span class="chip">${l.hon.length} honours</span></div>`).join(''):'<p class="pb muted" style="margin:0">Retired club greats will be honoured here.</p>'}</div></section></div>`;
}
// Season awards ceremony for the user's league.
function awardsCeremony(){
 const aw=S.awards&&S.awards[0];if(!aw)return fxClose();const L=aw.leagues.find(l=>l.lid===(S.lastRow?S.lastRow.lid:clubOf(S.user).league))||aw.leagues[0];
 const card=(t,p,extra)=>p?`<div class="aw-card ${p.club===S.user?'mine':''}"><small>${t}</small>${crest(p.club,40)}<b>${esc(p.n)}</b><span>${esc(clubOf(p.club).short)} · ${p.pos}${extra?' · '+extra:''}</span></div>`:'';
 const slots=[[50,92],[86,74],[62,78],[38,78],[14,74],[50,58],[30,50],[70,50],[82,24],[50,16],[18,24]];
 const tots=L.tots.map((p,i)=>p?`<div class="tots-p" style="left:${slots[i][0]}%;top:${slots[i][1]}%">${crest(p.club,20)}<b>${esc(p.n.split(' ').slice(-1)[0])}</b></div>`:'').join('');
 fxOverlay(`<div class="aw"><div class="sg-eyebrow">${esc(L.name)} · ${aw.season}</div><h1>Season awards</h1>
 <div class="aw-grid">${card('Player of the Season',L.poty,L.poty&&`${L.poty.r} avg`)}${card('Young Player',L.young,L.young&&`age ${L.young.age}`)}${card('Golden Boot',L.boot,L.boot&&`${L.boot.g} goals`)}
 ${L.mots!=null?`<div class="aw-card ${L.mots===S.user?'mine':''}"><small>Manager of the Season</small>${crest(L.mots,40)}<b>${L.mots===S.user?'You':esc(clubOf(L.mots).short)+' manager'}</b><span>${esc(clubOf(L.mots).name)}</span></div>`:''}</div>
 <div class="tots"><div class="tots-h">Team of the Season</div><div class="tots-pitch">${tots}</div></div>
 <button class="btn pri lg" data-act="fx-close">Continue ${ARROW}</button></div>`,'awards',0);
}
