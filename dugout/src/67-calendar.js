/* ================= calendar =================
   A month view of the whole season. Each fixture is themed in its competition's colours and logo, with the
   opponent, venue and result. Cup rounds you are not in, transfer windows and deadline day are marked too. */
ui.calM=null;
const MONTH_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
const compTheme=comp=>{if(comp==='lg'||typeof comp==='number'){const st=compStyle(typeof comp==='number'?comp:clubOf(S.user).league);return{c1:st.c1,c2:st.c2,name:S.leagues[typeof comp==='number'?comp:clubOf(S.user).league].name}}const st=cupStyle(comp);return{c1:st.c1,c2:st.c2,name:S.cups[comp].name}};
function calendarItems(){
 const items={},put=(ms,o)=>{const k=new Date(ms).toISOString().slice(0,10);(items[k]=items[k]||[]).push(o)};
 for(const f of userSchedule())put(f.date,Object.assign({kind:'fx'},f));
 // cup rounds the user is not part of, so the calendar shows the whole season's rhythm
 if(S.cups)for(const c of Object.values(S.cups).filter(c=>c.teams.includes(S.user)))c.after.forEach((md,r)=>{const ms=mdDate(md)+3*DAY,k=new Date(ms).toISOString().slice(0,10);if(!(items[k]||[]).some(x=>x.kind==='fx'&&x.comp===c.key))put(ms,{kind:'cup',comp:c.key,label:c.names[r]})});
 put(mdDate(0)-5*DAY,{kind:'win',label:'Transfer window opens'});put(mdDate(WIN1)-DAY,{kind:'win',label:'Deadline day',deadline:true});
 put(mdDate(WIN2[0])-2*DAY,{kind:'win',label:'Winter window opens'});put(mdDate(WIN2[1])-DAY,{kind:'win',label:'Winter deadline day',deadline:true});
 put(mdDate(MDAYS-1)+2*DAY,{kind:'win',label:'Season awards'});
 return items;
}
function viewCalendar(){
 const items=calendarItems(),nowMs=(()=>{const t=curTie()||nextUserTie();return t?t.date:mdDate(Math.min(S.md,MDAYS-1))})();
 const start=new Date(mdDate(0)-6*DAY),months=[];for(let i=0;i<11;i++){const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1));months.push(d)}
 const nowIdx=Math.max(0,months.findIndex((d,i)=>{const n=months[i+1];return nowMs>=d.getTime()&&(!n||nowMs<n.getTime())}));
 const mi=clamp(ui.calM??nowIdx,0,months.length-1),m0=months[mi],y=m0.getUTCFullYear(),mo=m0.getUTCMonth(),days=new Date(Date.UTC(y,mo+1,0)).getUTCDate(),lead=(m0.getUTCDay()+6)%7;
 const todayKey=new Date(nowMs).toISOString().slice(0,10);let cells='';
 for(let i=0;i<lead;i++)cells+='<div class="cal-d out"></div>';
 const monthFx=[];
 for(let d=1;d<=days;d++){const k=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,list=items[k]||[],fx=list.find(x=>x.kind==='fx');let inner='';
  if(fx){monthFx.push(fx);const th=compTheme(fx.comp);
   if(fx.pending)inner=`<div class="cal-fx" style="--c1:${th.c1};--c2:${th.c2}">${compBadge(fx.comp,18)}<span><b>${esc(fx.label)}</b><small>Draw pending</small></span></div>`;
   else{const home=fx.h===S.user,opp=home?fx.a:fx.h,r=fx.res;let res='';if(r){const gf=home?r.hg:r.ag,ga=home?r.ag:r.hg,pw=r.pens?(home?r.pens[0]>r.pens[1]:r.pens[1]>r.pens[0]):null,o=gf>ga||pw===true?'w':gf<ga||pw===false?'l':'d';res=`<em class="cal-r ${o}">${gf}–${ga}${r.pens?'p':''}</em>`}
    inner=`<div class="cal-fx ${r?'played':''}" style="--c1:${th.c1};--c2:${th.c2}" title="${esc(th.name)} · ${esc(fx.label)}">${compBadge(fx.comp,18)}<span>${crest(opp,18)}<b>${esc(clubOf(opp).short)}</b><small>${home?'H':'A'} · ${esc(fx.label)}</small></span>${res}</div>`}}
  for(const x of list){if(x.kind==='cup')inner+=`<div class="cal-tag" style="--c1:${compTheme(x.comp).c1}">${compBadge(x.comp,12)}<span>${esc(x.label)}</span></div>`;if(x.kind==='win')inner+=`<div class="cal-tag win ${x.deadline?'dl':''}"><span>${esc(x.label)}</span></div>`}
  cells+=`<div class="cal-d ${k===todayKey?'today':''} ${fx?'has':''}"><i>${d}</i>${inner}</div>`}
 const used=[...new Set(monthFx.map(f=>f.comp))],rec=monthFx.filter(f=>f.res).reduce((a,f)=>{const home=f.h===S.user,gf=home?f.res.hg:f.res.ag,ga=home?f.res.ag:f.res.hg;a[gf>ga?0:gf<ga?2:1]++;return a},[0,0,0]);
 const legend=['lg',...(S.cups?Object.keys(S.cups).filter(k=>S.cups[k].teams.includes(S.user)):[])].map(k=>`<span>${compBadge(k,20)}${esc(compTheme(k).name)}</span>`).join('');
 return`<div class="cal-wrap"><section class="panel cal"><div class="cal-head"><button class="btn ghost" data-act="cal-m" data-d="-1" ${mi<=0?'disabled':''} aria-label="Previous month">‹</button><h2>${MONTH_FULL[mo]} <small>${y}</small></h2><button class="btn ghost" data-act="cal-m" data-d="1" ${mi>=months.length-1?'disabled':''} aria-label="Next month">›</button>
 <div class="cal-months">${months.map((d,i)=>`<button data-act="cal-go" data-v="${i}" aria-pressed="${i===mi}" class="${i===nowIdx?'now':''}">${MONTH_FULL[d.getUTCMonth()].slice(0,3)}</button>`).join('')}</div></div>
 <div class="cal-grid">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
 <div class="cal-legend">${legend}</div></section>
 <aside class="panel cal-side"><div class="ph"><h3>${MONTH_FULL[mo]} at a glance</h3></div><div class="pb"><div class="cal-kpis"><div><small>Matches</small><b>${monthFx.filter(f=>!f.pending).length}</b></div><div><small>Record</small><b>${rec[0]}-${rec[1]}-${rec[2]}</b></div><div><small>Competitions</small><b>${used.length}</b></div></div></div>
 <div class="list">${monthFx.map(f=>schedRow(f)).join('')||'<p class="pb muted" style="margin:0">No fixtures this month.</p>'}</div></aside></div>`;
}
