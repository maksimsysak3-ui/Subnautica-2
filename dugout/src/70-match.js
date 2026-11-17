/* ================= match day ================= */
let M=null;
const MODES={key:{label:'Key highlights',ff:120},ext:{label:'Extended',ff:70},full:{label:'Full match',ff:0}};
// Pre-match ceremony timeline in seconds (3D), and the shorter overlay-only version for the 2D view.
const INTRO3D={walk:3,anthem:13.5,shake:22.5,disperse:27,end:32.5,l3:[.6,6.4],lu:[6.9,13.3],music:3};
const INTRO2D={end:9.5,l3:[.3,3.6],lu:[3.6,9],music:.3};
function newMatchDay(){const t=curTie();if(!t)return null;const fx=[t.h,t.a];return{fx,tie:t,wx:forecast(S.md,fx[0]),phase:'pre',mode:'key',hs:1,fs:12,viewMode:'3d',camMode:'tv',paused:false,pt:0,shown:0,scan:0,wins:[],score:[0,0],sel:null,tab:'feed',ss:{sh:[0,0],sot:[0,0],xg:[0,0],cor:[0,0],fo:[0,0],yc:[0,0],off:[0,0]}}}
function kickOff(){
 const[h,a]=M.fx;prepAI(h,a);prepAI(a,h);ensureLineup(S.user);
 const team=c=>({club:c,tac:clubOf(c).tac,bench:clubOf(c).tac.bench.slice(),ai:c!==S.user});
 M.E=createMatch({seed:(S.seed^(S.season*1000+S.md*17+h*3))>>>0,getP:id=>S.players[id],teams:[team(h),team(a)],weather:M.wx});
 M.us=h===S.user?0:1;M.phase='live';M.pt=0;M.rate=1;M.intro={ct:0};M.wins=[[0,9]];SND.init();SND.setCrowd(.5);
 if(M.preTalk){const d=talkEffect(M.preTalk,0,false);applyTalk(M.E,M.us,d);setTimeout(()=>toast(talkWord(d)),400)}
}
const clockAt=(E,t)=>{const c=t<E.h1?Math.min(t,E.h1):2700+(t-E.h1);const m=Math.floor(c/60);if(t<E.h1&&c>=2700)return`45+${Math.floor((c-2700)/60)+1}'`;if(c>=5400)return`90+${Math.floor((c-5400)/60)+1}'`;return`${m+1}'`};
function evText(e){
 const E=M.E,nm=pid=>pid!=null&&S.players[pid]?S.players[pid].ln:'',team=s=>s>=0?clubOf(E.T[s].club).short:'';
 switch(e.type){
  case'goal':return`GOAL! ${team(e.s)} ${e.score[0]}–${e.score[1]}. ${nm(e.pid)} ${e.pen?'converts the penalty':e.head?'heads it in':['finishes calmly','drills it into the corner','fires it past the keeper','slots it home','smashes it in'][e.pid%5]}${e.astPid!=null?`. Assist: ${nm(e.astPid)}`:''}.`;
  case'save':return`${nm(e.gkPid)} saves from ${nm(e.pid)}${e.x>.25?'. What a stop!':'.'}`;
  case'miss':return e.x>.25?`Big chance! ${nm(e.pid)} misses from close range.`:`${nm(e.pid)} ${['shoots wide','fires over the bar','drags it past the post'][e.pid%3]}.`;
  case'block':return`${nm(e.pid)}'s ${e.cross?'cross':'shot'} is blocked.`;
  case'corner':return`Corner to ${team(e.s)}.`;
  case'foul':return e.card===1?`Yellow card for ${nm(e.pid)}.`:e.card===2?'':`Free kick: foul by ${nm(e.pid)}.`;
  case'red':return`RED CARD! ${nm(e.pid)} is sent off.`;
  case'pen':return`PENALTY to ${team(e.s)}!`;
  case'offside':return`${nm(e.pid)} is caught offside.`;
  case'sub':return`Substitution, ${team(e.s)}: ${nm(e.inPid)} replaces ${nm(e.outPid)}.`;
  case'weather':return{rain:'Rain is falling now.',storm:'The rain is getting heavier. Conditions are treacherous.',cloudy:'The weather is clearing up.',snow:'Snow is starting to fall.',clear:'The sun is out.',wind:'The wind is picking up.',heat:'It is getting hot out there.'}[e.wx]||'';
  case'ht':return`Half-time: ${team(0)} ${M.score[0]}–${M.score[1]} ${team(1)}.`;
  case'ft':return`Full-time: ${team(0)} ${M.score[0]}–${M.score[1]} ${team(1)}.`;
 }
 return'';
}
const evClass=e=>e.type==='weather'?'whistle':e.type==='goal'?'goal':e.type==='red'?'card red':e.type==='foul'&&e.card?'card':e.type==='ht'||e.type==='ft'?'whistle':'';
function scanEvents(){
 const E=M.E;
 for(;M.scan<E.events.length;M.scan++){const e=E.events[M.scan];
  // Key highlights keep only real chances; extended shows every shot plus set pieces and cards.
  if(e.type==='shot'&&(e.out==='goal'||e.x>=(M.mode==='ext'?.04:.11)||M.mode==='ext'&&e.out==='save'))M.wins.push([e.t-7,e.t+2]);
  if(e.type==='goal')M.wins.push([e.t-1,e.t+6.5]);
  if(e.type==='pen'||e.type==='red')M.wins.push([e.t-5,e.t+2.5]);
  if(e.type==='ht')M.wins.push([E.h1,E.h1+6]);
  if(M.mode==='ext'&&e.type==='foul'&&e.card)M.wins.push([e.t-2,e.t+3]);
 }
}
function inWindow(t){for(const w of M.wins)if(t>=w[0]&&t<=w[1])return true;return false}
function nextWin(t){let n=Infinity;for(const w of M.wins)if(w[0]>t&&w[0]<n)n=w[0];return n}
function surface(){
 const E=M.E,feed=$('#m-feed');let changed=false;
 while(M.shown<E.events.length&&E.events[M.shown].t<=M.pt+1e-6){
  const e=E.events[M.shown++],ss=M.ss;
  if(e.type==='goal'){M.score=e.score.slice();flash(e.s);SND.swell(1,4);M.repQ={t:e.t,s:e.s}}
  if(e.type==='shot')SND.swell(.35+Math.min(.5,e.x*2),1.1);
  if(e.type==='ht')SND.whistle(2,true);if(e.type==='ft')SND.whistle(3,true);if(e.type==='red'||e.type==='pen')SND.swell(.7,1.6);
  if(e.type==='ht'&&!M.htDone){M.htDone=true;M.paused=true;const b=$('#m-pause');if(b)b.textContent='Resume';openModal(talkHTML(true))}
  if(e.type==='shot'){ss.sh[e.s]++;ss.xg[e.s]+=e.x;if(e.out==='goal'||e.out==='save')ss.sot[e.s]++;continue}
  if(e.type==='corner')ss.cor[e.s]++;if(e.type==='foul'){ss.fo[e.s]++;if(e.card)ss.yc[e.s]++}if(e.type==='offside')ss.off[e.s]++;
  const tx=evText(e);if(!tx)continue;changed=true;
  caption(tx,evClass(e));
  if(feed)feed.insertAdjacentHTML('afterbegin',`<li class="${evClass(e)}"><b>${e.type==='ht'||e.type==='ft'?'':clockAt(E,e.t)}</b><span>${esc(tx)}</span></li>`);
 }
 return changed;
}
function flash(s){const f=$('#m-flash');if(!f)return;f.style.setProperty('--fc',clubOf(M.E.T[s].club).colors[0]);f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
function statsHTML(){
 const E=M.E,st=E.st,ss=M.phase==='done'?{sh:st.sh,sot:st.sot,xg:st.xg,cor:st.cor,fo:st.fo,yc:st.yc,off:st.off}:M.ss,tot=st.pos[0]+st.pos[1]||1,ph=Math.round(st.pos[0]/tot*100);
 const row=(l,a,b,fa=a,fb=b)=>{const t=(+a)+(+b)||1;return`<div class="srow"><span>${fa}</span><div>${l}</div><span>${fb}</span><span class="bar"><i style="width:${(+a)/t*100||50}%"></i><i style="width:${(+b)/t*100||50}%"></i></span></div>`};
 const pc=s=>st.pa[s]?Math.round(st.pc[s]/st.pa[s]*100):0;
 return row('Possession',ph,100-ph,ph+'%',(100-ph)+'%')+row('Shots',ss.sh[0],ss.sh[1])+row('On target',ss.sot[0],ss.sot[1])+row('Expected goals',ss.xg[0],ss.xg[1],ss.xg[0].toFixed(2),ss.xg[1].toFixed(2))+row('Passes',st.pa[0],st.pa[1])+row('Pass accuracy',pc(0),pc(1),pc(0)+'%',pc(1)+'%')+row('Corners',ss.cor[0],ss.cor[1])+row('Fouls',ss.fo[0],ss.fo[1])+row('Yellow cards',ss.yc[0],ss.yc[1])+row('Offsides',ss.off[0],ss.off[1]);
}
function lineupHTML(){
 const E=M.E,tm=E.T[M.us];
 const on=tm.pl.map(p=>{const r=rate(E,p);return`<button class="li ${M.sel===p.i?'sel':''}" data-act="msel" data-i="${p.i}" ${p.off?'disabled':''}><span class="num-badge">${p.num}</span><span><b>${pName(S.players[p.pid])}</b><small>${p.pos} · ${esc(roleName(p.pos,p.role))}</small></span><span class="en" title="Energy"><i style="width:${Math.round(p.en*100)}%;background:${p.en<.55?'var(--loss)':p.en<.7?'var(--warn)':'var(--win)'}"></i></span>${r!=null?`<span class="rt" style="background:${rtColor(r)}">${r.toFixed(1)}</span>`:p.off?'<span class="chip bad">Off</span>':'<small>–</small>'}</button>`}).join('');
 const bench=tm.bench.map(id=>S.players[id]).filter(Boolean).map(p=>`<button class="li" data-act="msub" data-id="${p.id}" ${M.sel==null||tm.subs>=5?'disabled':''}><span class="num-badge">${p.num}</span><span><b>${pName(p)}</b><small>${p.pos} · ${p.cond}%</small></span><span></span>${starHTML(stars(p.ovr))}</button>`).join('');
 return`<div class="ph"><h3>On the pitch</h3><small>${5-tm.subs} subs left</small></div><div class="list lineup">${on}</div><div class="ph"><h3>Bench</h3><small>${M.sel!=null?'Tap a sub to bring him on':'Select a player to replace'}</small></div><div class="list lineup">${bench||'<p class="pb muted">No substitutes left.</p>'}</div>`;
}
function quickTacHTML(){
 const t=clubOf(S.user).tac,keys=['ment','tempo','passing','press','line','onWin','onLose'];
 return`<div class="pb ins">${INSTR.filter(i=>keys.includes(i[0])).map(([k,l,o])=>`<div class="row"><small>${l}</small><div class="seg" role="group" aria-label="${l}">${o.map((x,i)=>`<button data-act="ins" data-k="${k}" data-v="${i}" aria-pressed="${t.ins[k]===i}">${x.replace('Very ','V. ').replace('Counter-','C-')}</button>`).join('')}</div></div>`).join('')}
 <div class="row"><small>Attacking shape</small><select data-change="formInLive" aria-label="Attacking shape">${Object.keys(FORMATIONS).map(f=>`<option ${f===(t.formIn||t.form)?'selected':''}>${f}</option>`).join('')}</select></div></div>`;
}
function viewMatch(){
 if(!M)M=newMatchDay();if(!M){view='home';return viewHome()}
 const[h,a]=M.fx,H=clubOf(h),A=clubOf(a);
 const bar=`<div class="mbar"><div class="mt">${crest(h,44)}<div><b>${esc(H.name)}</b><small>${H.tac.form}</small></div></div><div class="msc"><div class="kpi" id="m-score">${M.score[0]} – ${M.score[1]}</div><span class="clock" id="m-clock">${M.phase==='pre'?'Kick-off':M.phase==='done'?'Full-time':clockAt(M.E,M.pt)}</span><div class="wxline" id="m-wx">${wxIcon(M.E?M.E.wxType:M.wx.type)}<span>${M.E?WX[M.E.wxType].n:WX[M.wx.type].n} · ${M.wx.temp}°C · ${kickLabel(M.wx.kick)}</span></div></div><div class="mt">${crest(a,44)}<div><b>${esc(A.name)}</b><small>${A.tac.form}</small></div></div></div>`;
 if(M.phase==='pre'){
  ensureLineup(S.user);prepAI(h===S.user?a:h,S.user);
  const sheet=cid=>{const c=clubOf(cid),t=c.tac;return`<section class="panel c4"><div class="ph"><h3>${esc(c.short)}</h3><small>${t.form}${t.formIn&&t.formIn!==t.form?' → '+t.formIn:''}</small></div><div class="list">${t.xi.map((id,i)=>{const p=S.players[id];return p?`<button class="li" style="grid-template-columns:30px 1fr auto" data-act="player" data-id="${p.id}">${posChip(FORMATIONS[t.form][i][0])}<span><b>${pName(p)}</b><small>${esc(roleName(FORMATIONS[t.form][i][0],t.roles[i]))}</small></span>${starHTML(stars(p.ovr))}</button>`:''}).join('')}</div></section>`};
  const sH=strength(H.tac.xi,H.tac.form),sA=strength(A.tac.xi,A.tac.form);
  return bar+`<div class="grid">${sheet(h)}<section class="panel c4"><div class="ph"><h3>Match preview</h3></div><div class="pb">${['Attack','Midfield','Defence'].map((l,i)=>{const x=[sH.att,sH.mid,sH.def][i],y=[sA.att,sA.mid,sA.def][i];return`<div class="srow" style="padding:6px 0"><span>${at20(x)}</span><div>${l}</div><span>${at20(y)}</span><span class="bar"><i style="width:${x/(x+y)*100}%"></i><i style="width:${y/(x+y)*100}%"></i></span></div>`}).join('')}
  <p class="muted" style="font-size:13px">${esc(M.tie?M.tie.label:'')}<br>${fmtDate(M.tie?M.tie.date:mdDate(S.md))} · ${esc(H.stadium)}</p><div class="forecast">${wxIcon(M.wx.type)}<div><b>${WX[M.wx.type].n}, ${M.wx.temp}°C</b><small>${kickLabel(M.wx.kick)} kick-off${daylight(M.wx,0)<.5?' under the floodlights':daylight(M.wx,6000)<.5?' · finishes under the lights':''} · wind ${M.wx.wSpd} km/h</small><small>${wxAdvice(M.wx.type)}</small></div></div>
  <div class="eyebrow" style="color:var(--muted);margin-top:12px">Team talk</div><div class="seg" role="group" aria-label="Team talk" style="display:flex;margin-top:6px">${TALKS.map(([k,l])=>`<button style="flex:1" data-act="pretalk" data-v="${k}" aria-pressed="${M.preTalk===k}">${l}</button>`).join('')}</div>
  <div style="display:grid;gap:8px;margin-top:12px"><button class="btn pri lg" data-act="kickoff">Kick off ${ARROW}</button><button class="btn" data-act="nav" data-v="tactics">Edit tactics</button><button class="btn" data-act="instant">Instant result</button></div></div></section>${sheet(a)}</div>`;
 }
 if(M.phase==='done')return bar+postHTML();
 M.shownFeed=true;
 const ctl=(lbl,grp,items,cur,act,hide)=>`<div class="seg" role="group" aria-label="${lbl}" ${hide?'hidden':''}>${items.map(([k,l])=>`<button data-act="${act}" data-v="${k}" aria-pressed="${cur==k}">${l}</button>`).join('')}</div>`;
 return bar+`<div class="mstage">
 <div class="stage" id="stage"><canvas id="m-canvas" aria-label="Match view"></canvas>
  <div class="stage-msg" id="stage-msg" hidden></div>
  <div class="ov-sbug" id="m-sbug">${sbugHTML()}</div>
  <div class="ov-tl" id="m-tl"><b id="m-tlc"></b><small>Fast forward</small><span id="m-tlt"></span></div>
  <div class="ov-l3" id="m-l3">${l3HTML()}</div>
  <div class="ov-lu" id="m-lu">${lineupCards()}</div>
  <div class="ov-cap" id="m-cap"></div>
  <div class="ov-rep" id="m-rep"><span>Replay</span><button data-act="mskiprep">Skip</button></div>
  <button class="ov-skip" id="m-skip" data-act="mskip" ${M.intro?'':'hidden'}>Skip to kick-off ›</button>
  <div class="flash" id="m-flash"><b>GOAL</b></div></div>
 <div class="mctl">${ctl('Viewing mode',0,Object.entries(MODES).map(([k,v])=>[k,v.label]),M.mode,'mmode')}
 ${ctl('Speed',0,(M.mode==='full'?[6,12,24,48]:[1,2,4]).map(v=>[v,v+'×']),M.mode==='full'?M.fs:M.hs,'mspeed')}
 ${ctl('View',0,[['3d','3D'],['2d','2D']],M.viewMode,'mview')}
 ${ctl('Camera',0,[['tv','TV'],['high','Tactical'],['near','Close']],M.camMode,'mcam',M.viewMode!=='3d')}
 <span class="grow"></span>
 <button class="btn ghost" data-act="msound" id="m-sound" aria-pressed="${SND.on}">${SND.on?'Sound on':'Sound off'}</button>
 <button class="btn ghost" data-act="mfull" title="Full screen">Full screen</button>
 <button class="btn" data-act="mpause" id="m-pause">${M.paused?'Resume':'Pause'}</button><button class="btn" data-act="instant">Instant result</button></div></div>
 <div class="mgrid">
 <section class="panel"><div class="ph"><h3>Commentary</h3></div><ul class="feed" id="m-feed"></ul></section>
 <section class="panel"><div class="ph"><h3>Match stats</h3></div><div id="m-stats">${statsHTML()}</div></section>
 <section class="panel"><div class="ph"><div class="seg" role="group" aria-label="Panel">${[['team','Team'],['tac','Tactics']].map(([k,l])=>`<button data-act="mtab2" data-v="${k}" aria-pressed="${(M.tab2||'team')===k}">${l}</button>`).join('')}</div></div><div id="m-side">${(M.tab2||'team')==='team'?lineupHTML():quickTacHTML()}</div></section></div>
 <section class="panel an-panel" id="m-an" style="margin-top:12px">${analysisHTML(M.E,true)}</section>`;
}
const shortOf=s=>esc(clubOf(M.E.T[s].club).abbr||clubOf(M.E.T[s].club).short.slice(0,3).toUpperCase());
function sbugHTML(){if(!M.E)return'';const[hk,ak]=kitColors(M.E);return`<span class="sb-t" style="--k:${hk.base}">${shortOf(0)}</span><b id="m-sbs">${M.score[0]}–${M.score[1]}</b><span class="sb-t" style="--k:${ak.base}">${shortOf(1)}</span><i id="m-sbc">${clockAt(M.E,M.pt)}</i>`}
function l3HTML(){const[h,a]=M.fx,H=clubOf(h),lg=S.leagues[H.league];
 return`<div class="l3-in"><small>${esc(M.tie?M.tie.label:lg.name)}</small><div class="l3-teams">${crest(h,34)}<b>${esc(H.name)}</b><i>v</i><b>${esc(clubOf(a).name)}</b>${crest(a,34)}</div><span>${esc(H.stadium)} · ${kickLabel(M.wx.kick)} · ${WX[M.wx.type].n}, ${M.wx.temp}°C</span></div>`}
function lineupCards(){if(!M.E)return'';const ks=kitColors(M.E);
 return[0,1].map(s=>{const c=clubOf(M.E.T[s].club);return`<div class="lu-card" style="--k:${ks[s].base};--ki:${ink(ks[s].base)}"><header>${crest(c.id,38)}<div><b>${esc(c.short)}</b><small>${esc(c.tac.form)}</small></div></header>
 <ol>${M.E.P.slice(s*11,s*11+11).map((p,i)=>`<li style="--d:${i*45}ms"><i>${p.num}</i><span>${esc(p.name)}</span><em>${p.pos}</em></li>`).join('')}</ol></div>`}).join('<div class="lu-vs">VS</div>')}
function caption(tx,cls){const el=$('#m-cap');if(!el||M.intro)return;el.className='ov-cap on '+(cls||'');el.innerHTML=`<b>${clockAt(M.E,M.pt)}</b><span>${esc(tx)}</span>`;M.capAt=performance.now();const t=$('#m-tlt');if(t)t.textContent=tx}
function penaltiesFor(M){const E=M.E;if(M.so)return M.so;
 const on=s=>E.P.filter(p=>p.s===s&&!p.off&&!p.red).map(p=>S.players[p.pid]).filter(p=>p&&p.pos!=='GK').sort((a,b)=>(b.at[AIX.fin]+b.at[AIX.cmp])-(a.at[AIX.fin]+a.at[AIX.cmp]));
 M.so=shootout(E.T[0].club,E.T[1].club,cid=>on(cid===E.T[0].club?0:1));M.pens=M.so.pens;return M.so}
function shootoutHTML(){const so=penaltiesFor(M),E=M.E,w=so.pens[0]>so.pens[1]?0:1;let i=0;
 const row=s=>so.kicks.filter(k=>k.s===s).map(k=>`<i class="pk ${k.ok?'ok':'miss'}" style="--d:${(i++*2+s)*0.55}s" title="${esc(S.players[k.pid]?S.players[k.pid].ln:'')}">${k.ok?'✓':'✕'}</i>`).join('');
 return`<div class="so"><div class="eyebrow">Penalty shootout</div>${[0,1].map(s=>`<div class="so-row">${crest(E.T[s].club,22)}<b>${esc(clubOf(E.T[s].club).short)}</b><span>${row(s)}</span><em>${so.pens[s]}</em></div>`).join('')}
 <p class="so-res" style="--d:${so.kicks.length*0.55+.3}s">${esc(clubOf(E.T[w].club).name)} win ${Math.max(...so.pens)}–${Math.min(...so.pens)} on penalties</p></div>`}
function postHTML(){
 const E=M.E,us=M.us,gf=E.score[us],ga=E.score[1-us],all=E.P.concat(E.old).filter(p=>p.rating!=null);
 const motm=all.slice().sort((a,b)=>b.rating-a.rating)[0];
 const goals=s=>E.events.filter(e=>e.type==='goal'&&e.s===s).map(e=>`${esc(S.players[e.pid].ln)} ${clockAt(E,e.t)}${e.pen?' (pen)':''}`).join('<br>')||'&nbsp;';
 const rt=s=>all.filter(p=>p.s===s).sort((a,b)=>b.rating-a.rating).map(p=>`<tr class="click" data-act="player" data-id="${p.pid}"><td><span class="num-badge">${p.num}</span></td><td><b>${pName(S.players[p.pid])}</b></td><td>${posChip(p.pos)}</td><td class="r"><small>${[p.st.g?p.st.g+' G':'',p.st.as?p.st.as+' A':'',p.st.sv?p.st.sv+' saves':'',p.st.pa?`${p.st.pc}/${p.st.pa} passes`:''].filter(Boolean).join(' · ')}</small></td><td class="r"><span class="rt" style="background:${rtColor(p.rating)}">${p.rating.toFixed(1)}</span></td></tr>`).join('');
 const so=M.tie&&M.tie.ko&&gf===ga?penaltiesFor(M):null,wonP=so&&(so.pens[us]>so.pens[1-us]);
 return`<div class="grid"><section class="panel c4"><div class="ph"><h3>${so?(wonP?'Through on penalties':'Out on penalties'):gf>ga?'Victory':gf<ga?'Defeat':'Draw'}</h3>${M.tie&&M.tie.comp!=='lg'?`<small>${esc(M.tie.label)}</small>`:''}</div>${so?shootoutHTML():''}<div class="pb"><div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted)"><div>${goals(0)}</div><div style="text-align:right">${goals(1)}</div></div></div><div>${statsHTML()}</div>
 <div class="pb"><div class="eyebrow">Player of the match</div><p style="margin:6px 0 0;font:700 20px var(--fd)">${esc(S.players[motm.pid].fn+' '+motm.name)} <span class="rt" style="background:${rtColor(motm.rating)}">${motm.rating.toFixed(1)}</span></p><small>${esc(clubOf(E.T[motm.s].club).name)}</small>
 <button class="btn pri lg" style="width:100%;margin-top:14px" data-act="match-finish">Continue ${ARROW}</button></div></section>
 ${[0,1].map(s=>`<section class="panel c4"><div class="ph"><h3>${esc(clubOf(E.T[s].club).short)} ratings</h3></div><div class="tw"><table class="tbl"><tbody>${rt(s)}</tbody></table></div></section>`).join('')}<section class="panel c12 an-panel">${analysisHTML(E,false)}</section></div>`;
}

const wxAdvice=t=>({rain:'A wet pitch: the ball skids, first touches suffer and keepers spill more.',storm:'Heavy rain: expect mistakes. Simple, direct football may pay off.',snow:'Snow slows the ball and the players. Short passing will struggle.',wind:'Strong wind will push long balls and crosses off target.',heat:'Hot conditions: players tire faster. Consider a lower press.',cloudy:'Good conditions for football.',clear:'Perfect conditions for football.'})[t]||'';
// weather the viewer should see at the current playback time (engine runs ahead)
function wxAtPt(){let t=M.wx.type;for(const c of M.wx.changes)if(clockAtSec(M.E,M.pt)>=c.t)t=c.type;return t}
const clockAtSec=(E,t)=>t<E.h1?t:2700+(t-E.h1);
/* ---------- live loop ---------- */
let RAF=0,VIEW=null,lastTs=0;
function mountMatch(){
 cancelAnimationFrame(RAF);if(VIEW){VIEW.dispose();VIEW=null}
 if(!M||M.phase!=='live')return;
 const feed=$('#m-feed');if(feed){const E=M.E;for(let k=0;k<M.shown;k++){const e=E.events[k],tx=e.type==='shot'?'':evText(e);if(tx)feed.insertAdjacentHTML('afterbegin',`<li class="${evClass(e)}"><b>${e.type==='ht'||e.type==='ft'?'':clockAt(E,e.t)}</b><span>${esc(tx)}</span></li>`)}}
 const cv=$('#m-canvas'),stage=$('#stage');
 const use2d=()=>{VIEW=create2D(cv,M.E)};
 if(M.viewMode==='3d'&&typeof create3D==='function'){
  const msg=$('#stage-msg');msg.hidden=false;msg.textContent='Loading the stadium…';
  create3D(stage,cv,M.E).then(v=>{if(!M||view!=='match'||$('#m-canvas')!==cv){v.dispose();return}VIEW=v;msg.hidden=true;v.setCam(M.camMode)}).catch(err=>{console.warn(err);msg.textContent='3D is unavailable on this device, showing the 2D view.';setTimeout(()=>{msg.hidden=true},2500);const c2=cv.cloneNode();cv.replaceWith(c2);VIEW=create2D(c2,M.E)});
 }else use2d();
 lastTs=performance.now();RAF=requestAnimationFrame(loop);
}
function leaveMatch(){cancelAnimationFrame(RAF);if(VIEW){VIEW.dispose();VIEW=null}if(M&&M.phase==='live')M.paused=true;SND.stop()}
// Playback speed: highlight speed inside windows, fast-forward between them, braking smoothly as the next window nears.
function targetRate(){
 if(M.mode==='full')return M.fs;
 if(inWindow(M.pt))return M.hs;
 const ff=MODES[M.mode].ff,gap=nextWin(M.pt)-M.pt;
 return clamp(gap/.3,M.hs,ff);
}
function setOv(id,on){const el=document.getElementById(id);if(el&&el.classList.contains('on')!==on)el.classList.toggle('on',on)}
function endIntro(){if(!M||!M.intro)return;M.intro=null;{const st=$('#stage');if(st)st.classList.remove('intro')}['m-l3','m-lu'].forEach(id=>setOv(id,false));const sk=$('#m-skip');if(sk)sk.hidden=true;SND.whistle(1);SND.setCrowd(.42);M.capAt=0;caption('Kick-off! We are under way.','whistle')}
function endReplay(){M.replay=null;setOv('m-rep',false)}
let sideT=0;
function loop(ts){
 if(!M||M.phase!=='live'||view!=='match')return;
 const dt=Math.min(.25,(ts-lastTs)/1000);lastTs=ts;const E=M.E;
 const t0=performance.now();while(!E.done&&E.t<M.pt+20&&performance.now()-t0<12)stepMatch(E);
 scanEvents();
 // ---- pre-match ceremony ----
 if(M.intro){
  if(!VIEW){RAF=requestAnimationFrame(loop);return}
  $('#stage').classList.add('intro');
  const IT=VIEW.intro?INTRO3D:INTRO2D;if(!M.paused)M.intro.ct+=dt;const ct=M.intro.ct;
  if(!M.intro.music&&ct>=IT.music){M.intro.music=1;SND.anthem()}
  setOv('m-l3',ct>=IT.l3[0]&&ct<IT.l3[1]);setOv('m-lu',ct>=IT.lu[0]&&ct<IT.lu[1]);
  if(VIEW.intro)VIEW.intro(ct,M.paused?0:dt);else VIEW.draw(0,0,dt);
  if(ct>=IT.end)endIntro();
  RAF=requestAnimationFrame(loop);return;
 }
 // ---- goal replay ----
 if(!M.replay&&M.repQ&&M.pt>=Math.min(M.repQ.t+4.5,E.done?E.t-1e-3:Infinity)){M.replay={rt:M.repQ.t-5.5,end:M.repQ.t+1,s:M.repQ.s};M.repQ=null;setOv('m-rep',true);setOv('m-tl',false)}
 if(M.replay){
  setOv('m-rep',true);if(!M.paused)M.replay.rt+=dt*.6;
  if(VIEW)VIEW.draw(M.replay.rt,M.paused?0:dt*.6,dt,{cam:'replay',side:M.replay.s});
  if(M.replay.rt>=M.replay.end)endReplay();
  RAF=requestAnimationFrame(loop);return;
 }
 const want=targetRate();M.rate=want<M.rate?want:M.rate+(want-M.rate)*(1-Math.exp(-dt*4));const r=M.rate;
 if(!M.paused)M.pt=Math.min(M.pt+dt*r,E.t);
 surface();
 const tl=r>=8&&!M.paused;setOv('m-tl',tl);if(tl)setOv('m-cap',false);
 if(M.capAt&&performance.now()-M.capAt>4500){M.capAt=0;setOv('m-cap',false)}
 const clk=clockAt(E,M.pt);
 $('#m-score').textContent=`${M.score[0]} – ${M.score[1]}`;$('#m-clock').textContent=clk;
 {const c=$('#m-sbc');if(c)c.textContent=clk;const sc=$('#m-sbs');if(sc)sc.textContent=`${M.score[0]}–${M.score[1]}`;if(tl){const b=$('#m-tlc');if(b)b.textContent=clk}}
 {const shownWx=wxAtPt();if(shownWx!==M.lastWx){M.lastWx=shownWx;const el=$('#m-wx');if(el)el.innerHTML=`${wxIcon(shownWx)}<span>${WX[shownWx].n} · ${M.wx.temp}°C · ${kickLabel(M.wx.kick)}</span>`}}
 if(VIEW)VIEW.draw(M.pt,M.paused?0:dt*Math.min(r,4),dt);
 if(ts-sideT>1000){sideT=ts;{const an=$('#m-an');if(an&&!an.matches(':hover')&&!an.contains(document.activeElement)&&(M.anT=(M.anT||0)+1)%2===0)an.innerHTML=analysisHTML(M.E,true)}const st=$('#m-stats');if(st)st.innerHTML=statsHTML();const sd=$('#m-side');if(sd&&(M.tab2||'team')==='team'&&!sd.matches(':hover'))sd.innerHTML=lineupHTML();
  if(!M.paused)SND.setCrowd(inWindow(M.pt)?.5:.32,2)}
 if(E.done&&M.pt>=E.t-1e-3&&!M.repQ){finishLive();return}
 RAF=requestAnimationFrame(loop);
}
function finishLive(){cancelAnimationFrame(RAF);if(VIEW){VIEW.dispose();VIEW=null}M.phase='done';M.intro=null;M.replay=null;M.score=M.E.score.slice();SND.setCrowd(.18,3);render()}
function instantResult(){
 if(M.phase==='pre')kickOff();
 runToEnd(M.E);M.pt=M.E.t;M.shown=M.E.events.length;M.score=M.E.score.slice();M.repQ=null;finishLive();SND.stop();
}
function finishMatchday(){
 const E=M.E,res=applyUserMatch(E);
 if(M.tie&&M.tie.comp!=='lg'){if(M.tie.ko&&E.score[0]===E.score[1]&&!M.pens)M.pens=penaltiesFor(M).pens;processCupEvent(res,M.pens)}else processMatchday(res);
 advanceToUser();
 const us=M.us,gf=E.score[us],ga=E.score[1-us],opp=clubOf(E.T[1-us].club);M=null;
 save();go('home');toast(`${gf>ga?'Won':gf<ga?'Lost':'Drew'} ${gf}–${ga} against ${opp.short}`);if(S.sacked)setTimeout(sackedFlow,600);
 if(S.pendingTrophy){const t=S.pendingTrophy;S.pendingTrophy=null;setTimeout(()=>celebrateTrophy(`${t.t} winners`,`${seasonLabel()} · ${clubOf(t.club).name}`,t.club),700)}
}

/* ---------- interpolated frame access (shared by 2D/3D) ---------- */
function frameAt(E,t,out){
 const r=E.rec,f=t/DT,i0=Math.max(0,Math.min(r.n-1,Math.floor(f))),i1=Math.min(r.n-1,i0+1),a=clamp(f-i0,0,1);
 const o0=(i0%CAP)*STRIDE,o1=(i1%CAP)*STRIDE,b=r.buf;
 for(let k=0;k<22;k++){const j=k*3;out.px[k]=b[o0+j]+(b[o1+j]-b[o0+j])*a;out.py[k]=b[o0+j+1]+(b[o1+j+1]-b[o0+j+1])*a;out.pose[k]=a<.5?b[o0+j+2]:b[o1+j+2]}
 const j=66;out.bx=b[o0+j]+(b[o1+j]-b[o0+j])*a;out.by=b[o0+j+1]+(b[o1+j+1]-b[o0+j+1])*a;out.bz=b[o0+j+2]+(b[o1+j+2]-b[o0+j+2])*a;out.own=b[o0+j+3];
 return out;
}
const newFrame=()=>({px:new Float32Array(22),py:new Float32Array(22),pose:new Float32Array(22),bx:0,by:0,bz:0,own:-1});
function kitColors(E){
 const H=clubOf(E.T[0].club),A=clubOf(E.T[1].club),hk=H.kits.home;let ak=A.kits.away;
 if(contrast(hk.base,ak.base)<2)ak=A.kits.third;if(contrast(hk.base,ak.base)<1.6)ak=A.kits.home;
 return[hk,ak];
}

/* ---------- 2D view ----------
   A tactical broadcast view: mown pitch with goals and nets, kit-patterned player tokens with numbers and facing,
   unit lines for each side's defence and midfield, a height-aware ball with shadow and trail, and shot pulses. */
function create2D(cv,E){
 const ctx=cv.getContext('2d'),fr=newFrame(),prev=newFrame(),ks=kitColors(E),trail=[],pulses=[];let W=0,H=0,dpr=1,pitchCv=null,lastShot=E.events.length;
 const GKK=[{base:'#c7e83a',alt:'#1d2a10',trim:'#1d2a10',pattern:'plain'},{base:'#ff7a1a',alt:'#2a1405',trim:'#2a1405',pattern:'plain'}];
 const fit=()=>{const r=cv.getBoundingClientRect();dpr=Math.min(2,devicePixelRatio||1);W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);pitchCv=null};
 fit();const ro=new ResizeObserver(fit);ro.observe(cv);
 let s=1,ox=0,oy=0;const X=x=>ox+x*s,Y=y=>oy+y*s;
 // The pitch is painted once per size into an offscreen canvas.
 function paintPitch(){
  const m=Math.max(14,Math.min(W,H)*.05);s=Math.min((W-2*m)/PW,(H-2*m)/PH);ox=(W-PW*s)/2;oy=(H-PH*s)/2;
  const pc=document.createElement('canvas');pc.width=W*dpr;pc.height=H*dpr;const g=pc.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
  const bg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.75);bg.addColorStop(0,'#1b4a2a');bg.addColorStop(1,'#0c2414');g.fillStyle=bg;g.fillRect(0,0,W,H);
  for(let i=0;i<14;i++){g.fillStyle=i%2?'rgba(255,255,255,.035)':'rgba(0,0,0,.05)';g.fillRect(X(i*PW/14),Y(0),PW/14*s+.5,PH*s)}
  for(let i=0;i<9;i++){g.fillStyle=i%2?'rgba(255,255,255,.018)':'rgba(0,0,0,.02)';g.fillRect(X(0),Y(i*PH/9),PW*s,PH/9*s+.5)}
  for(let i=0;i<2200;i++){g.fillStyle=Math.random()<.5?'rgba(255,255,255,.025)':'rgba(0,0,0,.04)';g.fillRect(X(Math.random()*PW),Y(Math.random()*PH),1,1)}
  g.strokeStyle='rgba(255,255,255,.78)';g.lineWidth=Math.max(1.2,s*.13);g.lineCap='round';
  g.strokeRect(X(0),Y(0),PW*s,PH*s);g.beginPath();g.moveTo(X(52.5),Y(0));g.lineTo(X(52.5),Y(PH));g.stroke();
  g.beginPath();g.arc(X(52.5),Y(34),9.15*s,0,7);g.stroke();g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(X(52.5),Y(34),Math.max(1.5,s*.25),0,7);g.fill();
  for(const d of[0,1]){const gx=d?PW:0,dir=d?-1:1;
   g.strokeRect(Math.min(X(gx),X(gx+dir*16.5)),Y(13.84),16.5*s,40.32*s);g.strokeRect(Math.min(X(gx),X(gx+dir*5.5)),Y(24.84),5.5*s,18.32*s);
   g.beginPath();g.arc(X(gx+dir*11),Y(34),9.15*s,d?Math.PI-.93:-.93,d?Math.PI+.93:.93);g.stroke();
   g.beginPath();g.arc(X(gx+dir*11),Y(34),Math.max(1.3,s*.22),0,7);g.fill();
   for(const cy of[0,PH]){g.beginPath();g.arc(X(gx),Y(cy),s,cy?(d?Math.PI:1.5*Math.PI):(d?.5*Math.PI:0),cy?(d?1.5*Math.PI:2*Math.PI):(d?Math.PI:.5*Math.PI));g.stroke()}
   // goal with net
   const gx0=X(gx),gx1=X(gx-dir*2),y0=Y(34-3.66),y1=Y(34+3.66);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(Math.min(gx0,gx1),y0,Math.abs(gx1-gx0),y1-y0);
   g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=.6;for(let k=0;k<=8;k++){const yy=y0+(y1-y0)*k/8;g.beginPath();g.moveTo(gx0,yy);g.lineTo(gx1,yy);g.stroke()}for(let k=0;k<=3;k++){const xx=gx0+(gx1-gx0)*k/3;g.beginPath();g.moveTo(xx,y0);g.lineTo(xx,y1);g.stroke()}
   g.strokeStyle='#f4f4f4';g.lineWidth=Math.max(2,s*.24);g.beginPath();g.moveTo(gx0,y0);g.lineTo(gx1,y0);g.lineTo(gx1,y1);g.lineTo(gx0,y1);g.stroke();g.strokeStyle='rgba(255,255,255,.78)';g.lineWidth=Math.max(1.2,s*.13)}
  const vg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.45,W/2,H/2,Math.max(W,H)*.8);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=vg;g.fillRect(0,0,W,H);
  pitchCv=pc;
 }
 function token(x,y,r,kit,num,face,carrier){
  ctx.save();ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x+r*.25,y+r*.35,r*1.05,r*.8,0,0,7);ctx.fill();
  ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.save();ctx.clip();ctx.fillStyle=kit.base;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.fillStyle=kit.alt;
  switch(kit.pattern){case'stripes':for(let k=-2;k<=2;k+=2)ctx.fillRect(x+k*r*.4-r*.2,y-r,r*.4,2*r);break;case'pinstripe':for(let k=-3;k<=3;k++)ctx.fillRect(x+k*r*.32,y-r,r*.08,2*r);break;case'hoops':for(let k=-2;k<=2;k+=2)ctx.fillRect(x-r,y+k*r*.4-r*.2,2*r,r*.4);break;
   case'halves':ctx.fillRect(x,y-r,r,2*r);break;case'quarters':ctx.fillRect(x,y-r,r,r);ctx.fillRect(x-r,y,r,r);break;case'sash':ctx.beginPath();ctx.moveTo(x-r,y+r*.2);ctx.lineTo(x+r*.2,y-r);ctx.lineTo(x+r*.7,y-r);ctx.lineTo(x-r,y+r*.75);ctx.fill();break;case'chevron':ctx.fillRect(x-r,y-r*.15,2*r,r*.3);break}
  const gl=ctx.createLinearGradient(x,y-r,x,y+r);gl.addColorStop(0,'rgba(255,255,255,.22)');gl.addColorStop(.5,'rgba(255,255,255,0)');gl.addColorStop(1,'rgba(0,0,0,.25)');ctx.fillStyle=gl;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.restore();
  ctx.lineWidth=Math.max(1.5,r*.18);ctx.strokeStyle=carrier?'#fff':contrast(kit.trim,kit.base)>1.6?kit.trim:mix(kit.base,'#000000',.5);ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.stroke();
  if(face!=null){ctx.fillStyle=carrier?'#fff':'rgba(255,255,255,.85)';ctx.beginPath();const a=face,tx=x+Math.cos(a)*(r+r*.55),ty=y+Math.sin(a)*(r+r*.55);ctx.moveTo(tx,ty);ctx.lineTo(x+Math.cos(a+.45)*(r+1),y+Math.sin(a+.45)*(r+1));ctx.lineTo(x+Math.cos(a-.45)*(r+1),y+Math.sin(a-.45)*(r+1));ctx.fill()}
  const tc=['stripes','hoops','halves','quarters','sash','pinstripe'].includes(kit.pattern)?'#ffffff':ink(kit.base);
  ctx.font=`800 ${Math.round(r*1.1)}px "Barlow Condensed","Arial Narrow",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  if(tc==='#ffffff'){ctx.lineWidth=Math.max(2,r*.28);ctx.strokeStyle='rgba(0,0,0,.55)';ctx.strokeText(num,x,y+.5)}ctx.fillStyle=tc;ctx.fillText(num,x,y+.5);ctx.restore();
 }
 function unitLines(side,r){
  const groups={DEF:[],MID:[]};for(let k=side*11;k<side*11+11;k++){const p=E.P[k],g=GROUP[p.pos];if(Math.floor(fr.pose[k])===POSE.off)continue;if(groups[g])groups[g].push([fr.px[k],fr.py[k]])}
  ctx.save();ctx.strokeStyle=side?'rgba(255,255,255,.16)':'rgba(255,255,255,.16)';ctx.setLineDash([4,5]);ctx.lineWidth=1.2;
  for(const g of Object.values(groups)){if(g.length<2)continue;g.sort((a,b)=>a[1]-b[1]);ctx.beginPath();g.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.stroke()}
  ctx.restore();
 }
 return{
  draw(t,sim,real){
   if(!pitchCv)paintPitch();frameAt(E,t,fr);frameAt(E,Math.max(0,t-.25),prev);
   ctx.clearRect(0,0,W,H);ctx.drawImage(pitchCv,0,0,W,H);
   const r=Math.max(9,1.38*s);
   unitLines(0,r);unitLines(1,r);
   // shot pulses: new shot events surfaced up to t
   for(;lastShot<E.events.length&&E.events[lastShot].t<=t;lastShot++){const e=E.events[lastShot];if(e.type==='shot'&&e.sx!=null)pulses.push({x:e.sx,y:e.sy,t0:performance.now(),goal:e.out==='goal',s:e.s})}
   if(lastShot>E.events.length)lastShot=E.events.length;
   const now=performance.now();for(let i=pulses.length-1;i>=0;i--){const p=pulses[i],a=(now-p.t0)/1400;if(a>1){pulses.splice(i,1);continue}
    ctx.strokeStyle=p.goal?`rgba(255,200,80,${1-a})`:`rgba(255,255,255,${.8-a*.8})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(X(p.x),Y(p.y),r*(1+a*3),0,7);ctx.stroke();
    ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(X(p.x),Y(p.y));ctx.lineTo(X(p.s?0:PW),Y(34));ctx.stroke();ctx.setLineDash([])}
   // ball trail
   trail.push([fr.bx,fr.by]);if(trail.length>18)trail.shift();
   for(let i=1;i<trail.length;i++){ctx.strokeStyle=`rgba(255,255,255,${(i/trail.length*.35).toFixed(2)})`;ctx.lineWidth=1+i/trail.length*2;ctx.beginPath();ctx.moveTo(X(trail[i-1][0]),Y(trail[i-1][1]));ctx.lineTo(X(trail[i][0]),Y(trail[i][1]));ctx.stroke()}
   // players
   const order=[];for(let k=0;k<22;k++)order.push(k);order.sort((a,b)=>fr.py[a]-fr.py[b]);
   for(const k of order){const pose=Math.floor(fr.pose[k]);if(pose===POSE.off)continue;const p=E.P[k],sd=k<11?0:1,kit=p.pos==='GK'?GKK[sd]:ks[sd];
    const vx=fr.px[k]-prev.px[k],vy=fr.py[k]-prev.py[k],sp=Math.hypot(vx,vy);const face=sp>.12?Math.atan2(vy,vx):Math.atan2(fr.by-fr.py[k],fr.bx-fr.px[k]);
    token(X(fr.px[k]),Y(fr.py[k]),r,kit,p.num,face,fr.own===k)}
   // ball with height
   const bz=fr.bz,bx=X(fr.bx),by=Y(fr.by);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(bx+bz*s*.35,by+bz*s*.5,r*.42,r*.3,0,0,7);ctx.fill();
   const br=r*(.42+Math.min(.5,bz*.07)),byz=by-bz*s*.55;const bgd=ctx.createRadialGradient(bx-br*.35,byz-br*.35,br*.1,bx,byz,br);bgd.addColorStop(0,'#ffffff');bgd.addColorStop(1,'#cfcfcf');ctx.fillStyle=bgd;ctx.beginPath();ctx.arc(bx,byz,br,0,7);ctx.fill();ctx.strokeStyle='#222';ctx.lineWidth=1;ctx.stroke();
   // carrier name pill
   if(fr.own>=0){const p=E.P[fr.own],nm=p.name.toUpperCase(),x=X(fr.px[fr.own]),y=Y(fr.py[fr.own])-r-14;ctx.font='700 12px "Barlow Condensed","Arial Narrow",sans-serif';const tw=ctx.measureText(nm).width+16;
    ctx.fillStyle='rgba(10,10,12,.85)';ctx.fillRect(x-tw/2,y-9,tw,18);ctx.fillStyle=ks[fr.own<11?0:1].base;ctx.fillRect(x-tw/2,y-9,3,18);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(nm,x+1,y+.5)}
   // light and weather
   const wt=wxAtPt(),dl=daylight(M.wx,clockAtSec(E,t));
   if(dl<1){ctx.fillStyle=`rgba(0,4,14,${(1-dl)*.3})`;ctx.fillRect(0,0,W,H)}
   if(wt==='rain'||wt==='storm'||wt==='snow'){const n=wt==='storm'?260:wt==='rain'?140:120,ph=performance.now()/1000;ctx.strokeStyle=wt==='snow'?'rgba(255,255,255,.75)':'rgba(190,210,230,.35)';ctx.fillStyle='rgba(255,255,255,.8)';ctx.lineWidth=1;ctx.beginPath();
    for(let i=0;i<n;i++){const sx=(i*97.13%1)*W,sy=((i*57.7%1)*H+ph*(wt==='snow'?30:420))%H;if(wt==='snow')ctx.rect(sx+Math.sin(ph+i)*6,sy,2,2);else{ctx.moveTo(sx,sy);ctx.lineTo(sx-3,sy+12)}}
    wt==='snow'?ctx.fill():ctx.stroke()}
  },
  dispose(){ro.disconnect()},setCam(){},
 };
}
