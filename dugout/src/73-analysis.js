/* ================= match analysis =================
   Built from what the engine records: minute-by-minute momentum, every shot with its location and xG,
   per-player heat grids, average positions and who passed to whom. Used live and in the match report. */
ui.anTab='momentum';ui.anSide=0;ui.anPid=null;

const anCols=E=>kitColors(E).map(k=>{let c=k.base;if(contrast(c,'#141416')<2.2)c=mix(c,'#ffffff',.45);return c});
function pitchSVG(inner,o={}){
 const v=o.half?'50 -3 58 74':'-3 -3 111 74',id=uid('pt');
 return`<svg class="an-pitch ${o.cls||''}" viewBox="${v}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${o.label||'Pitch'}"><defs><pattern id="${id}" width="17.5" height="68" patternUnits="userSpaceOnUse"><rect width="8.75" height="68" fill="#1d4f2c"/><rect x="8.75" width="8.75" height="68" fill="#1a4828"/></pattern></defs>
 <rect x="-3" y="-3" width="111" height="74" fill="#163d22"/><rect x="0" y="0" width="105" height="68" fill="url(#${id})"/>
 <g fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".35"><rect x="0" y="0" width="105" height="68"/><path d="M52.5 0V68"/><circle cx="52.5" cy="34" r="9.15"/>
 <rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/>
 <path d="M16.5 26.7A9.15 9.15 0 0 1 16.5 41.3M88.5 26.7A9.15 9.15 0 0 0 88.5 41.3"/><rect x="-1.6" y="30.34" width="1.6" height="7.32"/><rect x="105" y="30.34" width="1.6" height="7.32"/></g>
 <g fill="rgba(255,255,255,.55)"><circle cx="52.5" cy="34" r=".5"/><circle cx="11" cy="34" r=".4"/><circle cx="94" cy="34" r=".4"/></g>${inner}</svg>`;
}
// Momentum: smoothed territorial pressure per minute, home above the line, away below, with goals marked.
function momentumSVG(E,upto){
 const cols=anCols(E),mins=Math.max(1,Math.min(E.mom.length,upto??E.mom.length)),W=600,H=150,mid=H/2,bw=W/Math.max(mins,90);
 const raw=[];for(let m=0;m<mins;m++){const v=E.mom[m]||[0,0];raw.push(v[0]-v[1])}
 const sm=raw.map((_,i)=>{let a=0,n=0;for(let k=-2;k<=2;k++){const v=raw[i+k];if(v!=null){a+=v*(3-Math.abs(k));n+=3-Math.abs(k)}}return a/n});
 const mx=Math.max(4,...sm.map(Math.abs));
 const bars=sm.map((v,i)=>{const h=Math.abs(v)/mx*(mid-14);return`<rect x="${(i*bw+.6).toFixed(1)}" y="${(v>0?mid-h:mid).toFixed(1)}" width="${Math.max(1,bw-1.2).toFixed(1)}" height="${h.toFixed(1)}" fill="${v>0?cols[0]:cols[1]}" opacity="${(.45+.55*Math.abs(v)/mx).toFixed(2)}" rx="1"/>`}).join('');
 const goals=E.events.filter(e=>e.type==='goal'&&(upto==null||e.min/60<upto)).map(e=>{const x=Math.min(W-6,e.min/60*bw),y=e.s?H-8:8;return`<g transform="translate(${x.toFixed(1)} ${y})"><circle r="6" fill="#fff"/><path d="M-2.4 -1.8 L0 -3.4 L2.4 -1.8 L1.6 1.4 L-1.6 1.4Z" fill="#111"/></g>`}).join('');
 const ht=45*bw;
 return`<svg class="an-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Match momentum"><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="rgba(255,255,255,.18)"/>
 <line x1="${ht}" y1="4" x2="${ht}" y2="${H-4}" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 3"/>${bars}${goals}
 ${[0,15,30,45,60,75,90].map(m=>`<text x="${m*bw+2}" y="${H-1}" font-size="9" fill="rgba(255,255,255,.35)" font-family="Barlow">${m}'</text>`).join('')}</svg>`;
}
function xgRaceSVG(E,upto){
 const cols=anCols(E),W=600,H=170,shots=E.events.filter(e=>e.type==='shot'&&(upto==null||e.min/60<upto)),end=Math.max(90,...shots.map(e=>e.min/60+1));
 const tot=[0,0],pts=[[[0,0]],[[0,0]]];for(const e of shots){pts[e.s].push([e.min/60,tot[e.s]]);tot[e.s]+=e.x;pts[e.s].push([e.min/60,tot[e.s]])}
 const last=upto??end;pts.forEach((p,s)=>p.push([last,tot[s]]));
 const mx=Math.max(1,tot[0],tot[1])*1.15,X=m=>m/end*(W-30)+24,Y=v=>H-18-v/mx*(H-30);
 const lines=pts.map((p,s)=>`<path d="M${p.map(([m,v])=>`${X(m).toFixed(1)} ${Y(v).toFixed(1)}`).join(' L')}" fill="none" stroke="${cols[s]}" stroke-width="2.4" stroke-linejoin="round"/>`).join('');
 const goals=shots.filter(e=>e.out==='goal').map(e=>{let v=0;for(const q of shots){if(q===e)break;if(q.s===e.s)v+=q.x}v+=e.x;return`<circle cx="${X(e.min/60).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="${cols[e.s]}" stroke="#fff" stroke-width="1.5"/>`}).join('');
 const grid=[0,.5,1,1.5,2,2.5,3,3.5,4].filter(v=>v<mx).map(v=>`<line x1="24" x2="${W-6}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.06)"/><text x="2" y="${Y(v)+3}" font-size="9" fill="rgba(255,255,255,.35)" font-family="Barlow">${v.toFixed(1)}</text>`).join('');
 return`<svg class="an-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Expected goals race">${grid}${lines}${goals}${[0,15,30,45,60,75,90].map(m=>`<text x="${X(m)}" y="${H-3}" font-size="9" fill="rgba(255,255,255,.35)" text-anchor="middle" font-family="Barlow">${m}'</text>`).join('')}</svg>`;
}
function shotMapSVG(E,upto){
 const cols=anCols(E),shots=E.events.filter(e=>e.type==='shot'&&e.sx!=null&&(upto==null||e.min/60<upto));
 const dots=shots.map(e=>{const r=(1+Math.sqrt(e.x)*4.2).toFixed(2),c=cols[e.s],nm=S.players[e.pid]?S.players[e.pid].ln:'';
  return e.out==='goal'?`<g><circle cx="${e.sx.toFixed(1)}" cy="${e.sy.toFixed(1)}" r="${(+r+.9).toFixed(2)}" fill="${c}" stroke="#fff" stroke-width=".6"/><title>${esc(nm)} ${Math.round(e.min/60)+1}' · goal · ${e.x.toFixed(2)} xG</title></g>`
  :`<circle cx="${e.sx.toFixed(1)}" cy="${e.sy.toFixed(1)}" r="${r}" fill="${e.out==='save'?c:'none'}" fill-opacity="${e.out==='save'?.55:0}" stroke="${c}" stroke-width=".55"><title>${esc(nm)} ${Math.round(e.min/60)+1}' · ${e.out} · ${e.x.toFixed(2)} xG</title></circle>`}).join('');
 return pitchSVG(dots,{label:'Shot map'});
}
function networkSVG(E,s){
 const cols=anCols(E),ps=E.P.concat(E.old).filter(p=>p.s===s&&p.an>40),byPid={};ps.forEach(p=>byPid[p.pid]=p);
 const pos=p=>[p.ax/p.an,p.ay/p.an];let edges='';
 const pairs={};for(const[k,n]of Object.entries(E.pn)){const[a,b]=k.split('-').map(Number);if(!byPid[a]||!byPid[b])continue;const key=a<b?a+'-'+b:b+'-'+a;pairs[key]=(pairs[key]||0)+n}
 const mx=Math.max(1,...Object.values(pairs));
 for(const[k,n]of Object.entries(pairs)){if(n<3)continue;const[a,b]=k.split('-').map(Number),[x1,y1]=pos(byPid[a]),[x2,y2]=pos(byPid[b]);edges+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#fff" stroke-opacity="${(.15+.6*n/mx).toFixed(2)}" stroke-width="${(.3+2.2*n/mx).toFixed(2)}" stroke-linecap="round"/>`}
 const nodes=ps.map(p=>{const[x,y]=pos(p),inv=p.st.pa+(Object.entries(E.pn).filter(([k])=>k.endsWith('-'+p.pid)).reduce((a,[,n])=>a+n,0)),r=1.7+Math.min(2,inv/40);
  return`<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${cols[s]}" stroke="#fff" stroke-width=".5"/><text x="${x.toFixed(1)}" y="${(y+1.1).toFixed(1)}" text-anchor="middle" font-size="2.4" font-weight="800" fill="${ink(cols[s])}" font-family="Barlow Condensed">${p.num}</text><title>${esc(p.name)}: ${p.st.pc}/${p.st.pa} passes</title></g>`}).join('');
 return pitchSVG(edges+nodes,{label:'Passing network and average positions'});
}
function heatSVG(E,pid){
 const p=E.P.concat(E.old).find(q=>q.pid===pid);if(!p)return pitchSVG('');
 const mx=Math.max(1,...p.hm),id=uid('hb');
 const cells=p.hm.map((v,i)=>{if(!v)return'';const x=(i%12)*105/12,y=Math.floor(i/12)*68/8,a=v/mx;const c=a>.7?'#ff3b1f':a>.4?'#ff8a1f':a>.18?'#ffc93a':'#fff27a';return`<rect x="${(x-1).toFixed(2)}" y="${(y-1).toFixed(2)}" width="${(105/12+2).toFixed(2)}" height="${(68/8+2).toFixed(2)}" fill="${c}" opacity="${(.3+.7*Math.sqrt(a)).toFixed(2)}"/>`}).join('');
 return pitchSVG(`<defs><filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs><g filter="url(#${id})" opacity=".85">${cells}</g>${p.an?`<circle cx="${(p.ax/p.an).toFixed(1)}" cy="${(p.ay/p.an).toFixed(1)}" r="1.6" fill="#fff"/>`:''}`,{label:'Heatmap'});
}
function playerStatsTable(E,s){
 const ps=E.P.concat(E.old).filter(p=>p.s===s&&p.st.mins>0).sort((a,b)=>(b.rating||0)-(a.rating||0));
 return`<div class="tw"><table class="tbl an-tbl"><thead><tr><th>Player</th><th class="r">Min</th><th class="r">Pass</th><th class="r">%</th><th class="r">KP</th><th class="r">Sh</th><th class="r">G</th><th class="r">A</th><th class="r">Tk</th><th class="r">Int</th><th class="r">Dr</th><th class="r">km</th><th class="r">Rt</th></tr></thead><tbody>
 ${ps.map(p=>`<tr class="click" data-act="an-player" data-id="${p.pid}"><td><span class="num-badge">${p.num}</span> <b>${esc(p.name)}</b> <small>${p.pos}</small></td><td class="r">${Math.round(p.st.mins/60)}</td><td class="r">${p.st.pc}/${p.st.pa}</td><td class="r">${p.st.pa?Math.round(p.st.pc/p.st.pa*100):'–'}</td><td class="r">${p.st.kp}</td><td class="r">${p.st.so}/${p.st.sh}</td><td class="r">${p.st.g||''}</td><td class="r">${p.st.as||''}</td><td class="r">${p.st.tk}</td><td class="r">${p.st.in}</td><td class="r">${p.st.dr}</td><td class="r">${(p.st.dist/1000).toFixed(1)}</td><td class="r">${p.rating!=null?`<span class="rt" style="background:${rtColor(p.rating)}">${p.rating.toFixed(1)}</span>`:'–'}</td></tr>`).join('')}</tbody></table></div>`;
}
function analysisHTML(E,live){
 const upto=live?Math.floor(clockSec(E)/60)+1:null,cols=anCols(E),T=s=>esc(clubOf(E.T[s].club).short);
 const tabs=[['momentum','Momentum'],['xg','xG race'],['shots','Shot map'],['network','Passing'],['heat','Heatmaps'],['players','Player stats']];
 const sideSeg=`<div class="seg" role="group" aria-label="Team">${[0,1].map(s=>`<button data-act="an-side" data-v="${s}" aria-pressed="${ui.anSide===s}">${T(s)}</button>`).join('')}</div>`;
 const legend=`<div class="an-leg">${[0,1].map(s=>`<span><i style="background:${cols[s]}"></i>${T(s)}</span>`).join('')}</div>`;
 let body='';const t=ui.anTab;
 if(t==='momentum')body=`${legend}${momentumSVG(E,upto)}<p class="an-note">Bars show which side was on top each minute: time on the ball weighted by how dangerous the area was. White markers are goals.</p>`;
 else if(t==='xg'){const xg=[0,1].map(s=>E.events.filter(e=>e.type==='shot'&&e.s===s).reduce((a,e)=>a+e.x,0));body=`<div class="an-big">${[0,1].map(s=>`<div><small>${T(s)} xG</small><b style="color:${cols[s]}">${xg[s].toFixed(2)}</b><small>${E.score[s]} scored</small></div>`).join('')}</div>${xgRaceSVG(E,upto)}`}
 else if(t==='shots')body=`${legend}<div class="an-pitchwrap">${shotMapSVG(E,upto)}</div><p class="an-note">Circle size is chance quality (xG). Filled: on target. Solid with white ring: goal. ${T(0)} attack right, ${T(1)} attack left.</p>`;
 else if(t==='network')body=`${sideSeg}<div class="an-pitchwrap">${networkSVG(E,ui.anSide)}</div><p class="an-note">Dots are average positions, sized by involvement. Lines join players who passed to each other three or more times; thicker means more.</p>`;
 else if(t==='heat'){const ps=E.P.concat(E.old).filter(p=>p.s===ui.anSide&&p.an>10);if(!ps.find(p=>p.pid===ui.anPid))ui.anPid=(ps.find(p=>p.pos!=='GK')||ps[0]||{}).pid;
  body=`<div class="an-row">${sideSeg}<select data-input="an-pid" aria-label="Player">${ps.map(p=>`<option value="${p.pid}" ${p.pid===ui.anPid?'selected':''}>${p.num} · ${esc(p.name)} (${p.pos})</option>`).join('')}</select></div><div class="an-pitchwrap">${heatSVG(E,ui.anPid)}</div>`}
 else body=`${sideSeg}${playerStatsTable(E,ui.anSide)}`;
 return`<div class="an"><div class="an-tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-act="an-tab" data-v="${k}" aria-selected="${t===k}">${l}</button>`).join('')}</div><div class="an-body">${body}</div></div>`;
}
