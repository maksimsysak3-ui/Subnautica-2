/* ================= match day ================= */
let M=null;
const MODES={key:{label:'Key highlights',ff:40},ext:{label:'Extended',ff:14},full:{label:'Full match',ff:0}};
function newMatchDay(){const fx=userFixture();if(!fx)return null;return{fx,wx:forecast(S.md,fx[0]),phase:'pre',mode:'key',hs:1,fs:6,viewMode:'3d',camMode:'tv',paused:false,pt:0,shown:0,scan:0,wins:[],score:[0,0],sel:null,tab:'feed',ss:{sh:[0,0],sot:[0,0],xg:[0,0],cor:[0,0],fo:[0,0],yc:[0,0],off:[0,0]}}}
function kickOff(){
 const[h,a]=M.fx;prepAI(h,a);prepAI(a,h);ensureLineup(S.user);
 const team=c=>({club:c,tac:clubOf(c).tac,bench:clubOf(c).tac.bench.slice(),ai:c!==S.user});
 M.E=createMatch({seed:(S.seed^(S.season*1000+S.md*17+h*3))>>>0,getP:id=>S.players[id],teams:[team(h),team(a)],weather:M.wx});
 M.us=h===S.user?0:1;M.phase='live';M.pt=0;
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
  if(e.type==='shot')M.wins.push([e.t-11,e.t+3.5]);
  if(e.type==='goal')M.wins.push([e.t-1,e.t+7]);
  if(e.type==='pen'||e.type==='red')M.wins.push([e.t-6,e.t+3]);
  if(M.mode==='ext'&&(e.type==='corner'||e.type==='foul'&&e.card))M.wins.push([e.t-3,e.t+6]);
 }
}
function inWindow(t){for(const w of M.wins)if(t>=w[0]&&t<=w[1])return true;return false}
function surface(){
 const E=M.E,feed=$('#m-feed');let changed=false;
 while(M.shown<E.events.length&&E.events[M.shown].t<=M.pt+1e-6){
  const e=E.events[M.shown++],ss=M.ss;
  if(e.type==='goal'){M.score=e.score.slice();flash(e.s)}
  if(e.type==='ht'&&!M.htDone){M.htDone=true;M.paused=true;const b=$('#m-pause');if(b)b.textContent='Resume';openModal(talkHTML(true))}
  if(e.type==='shot'){ss.sh[e.s]++;ss.xg[e.s]+=e.x;if(e.out==='goal'||e.out==='save')ss.sot[e.s]++;continue}
  if(e.type==='corner')ss.cor[e.s]++;if(e.type==='foul'){ss.fo[e.s]++;if(e.card)ss.yc[e.s]++}if(e.type==='offside')ss.off[e.s]++;
  const tx=evText(e);if(!tx)continue;changed=true;
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
  <p class="muted" style="font-size:13px">${fmtDate(mdDate(S.md))} · ${esc(H.stadium)}</p><div class="forecast">${wxIcon(M.wx.type)}<div><b>${WX[M.wx.type].n}, ${M.wx.temp}°C</b><small>${kickLabel(M.wx.kick)} kick-off${daylight(M.wx,0)<.5?' under the floodlights':daylight(M.wx,6000)<.5?' · finishes under the lights':''} · wind ${M.wx.wSpd} km/h</small><small>${wxAdvice(M.wx.type)}</small></div></div>
  <div class="eyebrow" style="color:var(--muted);margin-top:12px">Team talk</div><div class="seg" role="group" aria-label="Team talk" style="display:flex;margin-top:6px">${TALKS.map(([k,l])=>`<button style="flex:1" data-act="pretalk" data-v="${k}" aria-pressed="${M.preTalk===k}">${l}</button>`).join('')}</div>
  <div style="display:grid;gap:8px;margin-top:12px"><button class="btn pri lg" data-act="kickoff">Kick off ${ARROW}</button><button class="btn" data-act="nav" data-v="tactics">Edit tactics</button><button class="btn" data-act="instant">Instant result</button></div></div></section>${sheet(a)}</div>`;
 }
 if(M.phase==='done')return bar+postHTML();
 M.shownFeed=true;
 return bar+`<div class="mgrid">
 <section class="panel"><div class="ph"><div class="seg" role="group" aria-label="Panel">${[['feed','Commentary'],['stats','Stats']].map(([k,l])=>`<button data-act="mtab" data-v="${k}" aria-pressed="${M.tab===k}">${l}</button>`).join('')}</div></div>
 <ul class="feed" id="m-feed" ${M.tab!=='feed'?'hidden':''}></ul><div id="m-stats" ${M.tab!=='stats'?'hidden':''}>${statsHTML()}</div></section>
 <div class="mid" style="min-width:0"><div class="stage" id="stage"><canvas id="m-canvas" aria-label="Match view"></canvas><div class="stage-msg" id="stage-msg" hidden></div><div class="ff" id="m-ff" hidden>Fast forward</div><div class="flash" id="m-flash"><b>GOAL</b></div></div>
 <div class="mctl"><div class="seg" role="group" aria-label="Viewing mode">${Object.entries(MODES).map(([k,v])=>`<button data-act="mmode" data-v="${k}" aria-pressed="${M.mode===k}">${v.label}</button>`).join('')}</div>
 <div class="seg" role="group" aria-label="Speed">${(M.mode==='full'?[3,6,12,24]:[1,2,4]).map(v=>`<button data-act="mspeed" data-v="${v}" aria-pressed="${(M.mode==='full'?M.fs:M.hs)===v}">${v}×</button>`).join('')}</div>
 <div class="seg" role="group" aria-label="View">${[['3d','3D'],['2d','2D']].map(([k,l])=>`<button data-act="mview" data-v="${k}" aria-pressed="${M.viewMode===k}">${l}</button>`).join('')}</div>
 <div class="seg" role="group" aria-label="Camera" ${M.viewMode!=='3d'?'hidden':''}>${[['tv','TV'],['high','Tactical'],['near','Close']].map(([k,l])=>`<button data-act="mcam" data-v="${k}" aria-pressed="${M.camMode===k}">${l}</button>`).join('')}</div>
 <div class="toolbar" style="margin:0"><button class="btn" data-act="mpause" id="m-pause">${M.paused?'Resume':'Pause'}</button><button class="btn" data-act="instant">Instant result</button></div></div></div>
 <section class="panel"><div class="ph"><div class="seg" role="group" aria-label="Panel">${[['team','Team'],['tac','Tactics']].map(([k,l])=>`<button data-act="mtab2" data-v="${k}" aria-pressed="${(M.tab2||'team')===k}">${l}</button>`).join('')}</div></div><div id="m-side">${(M.tab2||'team')==='team'?lineupHTML():quickTacHTML()}</div></section></div>`;
}
function postHTML(){
 const E=M.E,us=M.us,gf=E.score[us],ga=E.score[1-us],all=E.P.concat(E.old).filter(p=>p.rating!=null);
 const motm=all.slice().sort((a,b)=>b.rating-a.rating)[0];
 const goals=s=>E.events.filter(e=>e.type==='goal'&&e.s===s).map(e=>`${esc(S.players[e.pid].ln)} ${clockAt(E,e.t)}${e.pen?' (pen)':''}`).join('<br>')||'&nbsp;';
 const rt=s=>all.filter(p=>p.s===s).sort((a,b)=>b.rating-a.rating).map(p=>`<tr class="click" data-act="player" data-id="${p.pid}"><td><span class="num-badge">${p.num}</span></td><td><b>${pName(S.players[p.pid])}</b></td><td>${posChip(p.pos)}</td><td class="r"><small>${[p.st.g?p.st.g+' G':'',p.st.as?p.st.as+' A':'',p.st.sv?p.st.sv+' saves':'',p.st.pa?`${p.st.pc}/${p.st.pa} passes`:''].filter(Boolean).join(' · ')}</small></td><td class="r"><span class="rt" style="background:${rtColor(p.rating)}">${p.rating.toFixed(1)}</span></td></tr>`).join('');
 return`<div class="grid"><section class="panel c4"><div class="ph"><h3>${gf>ga?'Victory':gf<ga?'Defeat':'Draw'}</h3></div><div class="pb"><div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted)"><div>${goals(0)}</div><div style="text-align:right">${goals(1)}</div></div></div><div>${statsHTML()}</div>
 <div class="pb"><div class="eyebrow">Player of the match</div><p style="margin:6px 0 0;font:700 20px var(--fd)">${esc(S.players[motm.pid].fn+' '+motm.name)} <span class="rt" style="background:${rtColor(motm.rating)}">${motm.rating.toFixed(1)}</span></p><small>${esc(clubOf(E.T[motm.s].club).name)}</small>
 <button class="btn pri lg" style="width:100%;margin-top:14px" data-act="match-finish">Continue ${ARROW}</button></div></section>
 ${[0,1].map(s=>`<section class="panel c4"><div class="ph"><h3>${esc(clubOf(E.T[s].club).short)} ratings</h3></div><div class="tw"><table class="tbl"><tbody>${rt(s)}</tbody></table></div></section>`).join('')}</div>`;
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
function leaveMatch(){cancelAnimationFrame(RAF);if(VIEW){VIEW.dispose();VIEW=null}if(M&&M.phase==='live')M.paused=true}
function rateNow(){const md=MODES[M.mode];if(M.mode==='full')return M.fs;return inWindow(M.pt)?M.hs:md.ff}
let sideT=0;
function loop(ts){
 if(!M||M.phase!=='live'||view!=='match')return;
 const dt=Math.min(.25,(ts-lastTs)/1000);lastTs=ts;const E=M.E;
 const t0=performance.now();while(!E.done&&E.t<M.pt+18&&performance.now()-t0<12)stepMatch(E);
 scanEvents();
 const r=rateNow();
 if(!M.paused)M.pt=Math.min(M.pt+dt*r,E.t);
 const ff=$('#m-ff');if(ff)ff.hidden=!(r>=10&&!M.paused);
 surface();
 $('#m-score').textContent=`${M.score[0]} – ${M.score[1]}`;$('#m-clock').textContent=clockAt(E,M.pt);
 {const shownWx=wxAtPt();if(shownWx!==M.lastWx){M.lastWx=shownWx;const el=$('#m-wx');if(el)el.innerHTML=`${wxIcon(shownWx)}<span>${WX[shownWx].n} · ${M.wx.temp}°C · ${kickLabel(M.wx.kick)}</span>`}}
 if(VIEW)VIEW.draw(M.pt,M.paused?0:dt*Math.min(r,4),dt);
 if(ts-sideT>1000){sideT=ts;const st=$('#m-stats');if(st&&!st.hidden)st.innerHTML=statsHTML();const sd=$('#m-side');if(sd&&(M.tab2||'team')==='team'&&!sd.matches(':hover'))sd.innerHTML=lineupHTML()}
 if(E.done&&M.pt>=E.t-1e-3){finishLive();return}
 RAF=requestAnimationFrame(loop);
}
function finishLive(){cancelAnimationFrame(RAF);if(VIEW){VIEW.dispose();VIEW=null}M.phase='done';M.score=M.E.score.slice();render()}
function instantResult(){
 if(M.phase==='pre')kickOff();
 runToEnd(M.E);M.pt=M.E.t;M.shown=M.E.events.length;M.score=M.E.score.slice();finishLive();
}
function finishMatchday(){
 const E=M.E,res=applyUserMatch(E);processMatchday(res);
 const us=M.us,gf=E.score[us],ga=E.score[1-us],opp=clubOf(E.T[1-us].club);M=null;
 save();go('home');toast(`${gf>ga?'Won':gf<ga?'Lost':'Drew'} ${gf}–${ga} against ${opp.short}`);if(S.sacked)setTimeout(sackedFlow,600);
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

/* ---------- 2D view ---------- */
function create2D(cv,E){
 const ctx=cv.getContext('2d'),fr=newFrame(),[hk,ak]=kitColors(E),trail=[];let W=0,H=0,dpr=1;
 const fit=()=>{const r=cv.getBoundingClientRect();dpr=Math.min(2,devicePixelRatio||1);W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)};
 fit();const ro=new ResizeObserver(fit);ro.observe(cv);
 return{
  draw(t){
   frameAt(E,t,fr);const m=12,sx=(W-2*m)/PW,sy=(H-2*m)/PH,s=Math.min(sx,sy),ox=(W-PW*s)/2,oy=(H-PH*s)/2,X=x=>ox+x*s,Y=y=>oy+y*s;
   ctx.fillStyle='#0a0f0b';ctx.fillRect(0,0,W,H);
   for(let i=0;i<12;i++){ctx.fillStyle=i%2?'#1c5f34':'#1f6a3a';ctx.fillRect(X(i*PW/12),Y(0),PW/12*s+1,PH*s)}
   ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.2;ctx.strokeRect(X(0),Y(0),PW*s,PH*s);
   ctx.beginPath();ctx.moveTo(X(52.5),Y(0));ctx.lineTo(X(52.5),Y(PH));ctx.stroke();ctx.beginPath();ctx.arc(X(52.5),Y(34),9.15*s,0,7);ctx.stroke();
   for(const d of[0,1]){const gx=d?PW:0,dir=d?-1:1;ctx.strokeRect(Math.min(X(gx),X(gx+dir*16.5)),Y(13.84),16.5*s,40.32*s);ctx.strokeRect(Math.min(X(gx),X(gx+dir*5.5)),Y(24.84),5.5*s,18.32*s);ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(Math.min(X(gx),X(gx-dir*1.2)),Y(30.34),1.2*s,7.32*s)}
   trail.push([fr.bx,fr.by]);if(trail.length>14)trail.shift();
   ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=2;ctx.beginPath();trail.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.stroke();
   const r=Math.max(5,1.15*s);
   for(let k=0;k<22;k++){const sd=k<11?0:1,p=E.P[k],pose=Math.floor(fr.pose[k]);if(pose===POSE.off)continue;const kit=sd?ak:hk,gk=p.pos==='GK',fill=gk?(sd?'#ff7a1a':'#d6f53b'):kit.base;
    ctx.beginPath();ctx.arc(X(fr.px[k]),Y(fr.py[k]),r,0,7);ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=fr.own===k?'#fff':gk?'#111':kit.alt===kit.base?'#111':kit.alt;ctx.stroke();
    ctx.fillStyle=ink(fill);ctx.font=`700 ${Math.round(r*1.05)}px "Barlow Condensed",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.num,X(fr.px[k]),Y(fr.py[k])+.5);
    if(fr.own===k){ctx.fillStyle='rgba(0,0,0,.75)';const tw=ctx.measureText(p.name).width+10;ctx.fillRect(X(fr.px[k])-tw/2,Y(fr.py[k])-r-20,tw,16);ctx.fillStyle='#fff';ctx.font='600 12px Barlow,sans-serif';ctx.fillText(p.name,X(fr.px[k]),Y(fr.py[k])-r-12)}}
   const bz=fr.bz;ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(X(fr.bx)+bz*1.5,Y(fr.by)+bz*1.5,r*.45,0,7);ctx.fill();
   ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(X(fr.bx),Y(fr.by),r*(.45+bz*.05),0,7);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=1;ctx.stroke();
   const wt=wxAtPt(),dl=daylight(M.wx,clockAtSec(E,t));
   if(dl<1){ctx.fillStyle=`rgba(0,4,12,${(1-dl)*.28})`;ctx.fillRect(0,0,W,H)}
   if(wt==='rain'||wt==='storm'||wt==='snow'){const n=wt==='storm'?260:wt==='rain'?140:120,ph=performance.now()/1000;ctx.strokeStyle=wt==='snow'?'rgba(255,255,255,.75)':'rgba(190,210,230,.35)';ctx.fillStyle='rgba(255,255,255,.8)';ctx.lineWidth=1;ctx.beginPath();
    for(let i=0;i<n;i++){const sx=(i*97.13%1)*W,sy=((i*57.7%1)*H+ph*(wt==='snow'?30:420))%H;if(wt==='snow')ctx.rect(sx+Math.sin(ph+i)*6,sy,2,2);else{ctx.moveTo(sx,sy);ctx.lineTo(sx-3,sy+12)}}
    wt==='snow'?ctx.fill():ctx.stroke()}
  },
  dispose(){ro.disconnect()},setCam(){},
 };
}
