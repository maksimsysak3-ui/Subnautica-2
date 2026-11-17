/* ================= main menu & save slots ================= */
ui.mode='menu';ui.metas=null;ui.slotIntent=null;ui.confirmDel=null;ui.newSlot=null;ui.busy=false;

function ago(t){const s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';const d=Math.floor(s/86400);return d<7?d+(d>1?' days':' day')+' ago':new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
const latestSlot=()=>{const m=(ui.metas||[]).filter(Boolean).sort((a,b)=>b.savedAt-a.savedAt)[0];return m?m.slot:null};
const firstFree=()=>{const i=(ui.metas||[]).findIndex(m=>!m);return i<0?null:i+1};

// Faint pitch drawing that traces itself in, used as the menu backdrop.
const MENU_PITCH=`<svg class="mm-pitch" viewBox="0 0 1050 680" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2">
<rect x="20" y="20" width="1010" height="640"/><path d="M525 20V660"/><circle cx="525" cy="340" r="91.5"/><circle cx="525" cy="340" r="3" fill="currentColor"/>
<rect x="20" y="138.5" width="165" height="403"/><rect x="20" y="248.5" width="55" height="183"/><path d="M185 266.9A91.5 91.5 0 0 1 185 413.1"/>
<rect x="865" y="138.5" width="165" height="403"/><rect x="975" y="248.5" width="55" height="183"/><path d="M865 266.9A91.5 91.5 0 0 0 865 413.1"/>
<circle cx="130" cy="340" r="3" fill="currentColor"/><circle cx="920" cy="340" r="3" fill="currentColor"/></g></svg>`.replace(/<(rect|path|circle) /g,'<$1 pathLength="100" ');

function slotCard(n){
 const m=ui.metas?ui.metas[n-1]:undefined,over=ui.slotIntent==='new';
 if(m===undefined)return`<article class="mm-slot ghost"><span class="mm-no">0${n}</span><div class="mm-sk"></div></article>`;
 if(!m)return`<article class="mm-slot empty"><span class="mm-no">0${n}</span><div class="mm-empty"><b>Empty slot</b><small>Start a new career here</small></div>
  <div class="mm-act"><button class="btn" data-act="menu-new" data-v="${n}">New career ${ARROW}</button></div></article>`;
 const[w,d,l]=m.rec,games=w+d+l,tc=m.club.colors[0]==='#ffffff'?m.club.colors[1]:m.club.colors[0];
 const confirm=ui.confirmDel===n;
 return`<article class="mm-slot ${latestSlot()===n?'recent':''}" style="--tc:${tc}"><span class="mm-no">0${n}</span>
 <div class="mm-club">${crestSVG(m.club,{size:46})}<div><h3>${esc(m.club.name)}</h3><small>${esc(m.league)}</small></div></div>
 <dl class="mm-facts"><div><dt>Season</dt><dd>${esc(m.season)}</dd></div><div><dt>Matchday</dt><dd>${Math.min(m.md+1,MDAYS)}<i>/${MDAYS}</i></dd></div><div><dt>Position</dt><dd>${m.pos?ordinal(m.pos):'–'}</dd></div><div><dt>Record</dt><dd>${games?`${w}–${d}–${l}`:'–'}</dd></div><div><dt>Trophies</dt><dd>${m.trophies}</dd></div></dl>
 <div class="mm-foot"><small>Saved ${ago(m.savedAt)}</small>
 ${confirm?`<span class="mm-confirm">Delete this career? <button class="btn danger" data-act="menu-del-yes" data-v="${n}">Delete</button><button class="btn" data-act="menu-del-no">Keep</button></span>`
 :`<span class="mm-act">${over?`<button class="btn" data-act="menu-new" data-v="${n}" data-over="1">Overwrite</button>`:`<button class="btn ghost" data-act="menu-del" data-v="${n}" aria-label="Delete slot ${n}">Delete</button><button class="btn pri" data-act="menu-load" data-v="${n}">Load ${ARROW}</button>`}</span>`}</div></article>`;
}

function viewMenu(){
 const last=latestSlot(),lm=last?ui.metas[last-1]:null,full=ui.metas&&!firstFree();
 const item=(act,label,note,dis,v)=>`<li><button class="mm-item" data-act="${act}"${v!=null?` data-v="${v}"`:''}${dis?' disabled':''}><span class="mm-l">${label}</span><span class="mm-n">${note}</span></button></li>`;
 return`<div class="mm fresh">${MENU_PITCH}<div class="mm-glow" aria-hidden="true"></div>
 <div class="mm-in">
  <section class="mm-left">
   <div class="mm-mark">${LOGO}<div><h1>DUGOUT</h1><p>Football management</p></div></div>
   <ul class="mm-list">
    ${item('menu-load','Continue',lm?`${esc(lm.club.short)} · ${esc(lm.season)} · MD ${Math.min(lm.md+1,MDAYS)}`:'No saved career yet',!lm,last)}
    ${item('menu-new','New career',full?'All slots in use: choose one to overwrite':`Into slot ${firstFree()||1} · clubs from ${COUNTRIES.length} countries`,false,full?'':firstFree()||1)}
    ${item('menu-help','How to play','Matchdays, tactics, transfers',false)}
   </ul>
   <p class="mm-note">Careers are saved automatically to this browser after every action.</p>
  </section>
  <section class="mm-right" aria-label="Save slots">
   <div class="mm-head"><h2>Careers</h2><small>${ui.slotIntent==='new'?'Choose a slot to overwrite · <button class="link" data-act="menu-cancel">Cancel</button>':`${SLOTS} slots`}</small></div>
   <div class="mm-slots">${[1,2,3].slice(0,SLOTS).map(slotCard).join('')}</div>
  </section>
 </div></div>`;
}

const HELP=`<div class="eyebrow">How to play</div><h2 style="font-size:28px;margin:6px 0 14px">Running your club</h2>
<div class="help-grid">
<div><b>Matchdays</b><p>Press Continue in the top bar to move to the next fixture. Watch it live in 2D or 3D, or get an instant result. Give team talks before kick-off and at half-time.</p></div>
<div><b>Tactics</b><p>Pick a shape out of possession and in possession, give each slot a role, and set how the side reacts when it wins or loses the ball. Weather and fatigue change what works.</p></div>
<div><b>Transfers</b><p>Windows open in pre-season and mid-season. Make bids in the negotiation room: fee, add-ons and instalments first, then personal terms within your wage budget.</p></div>
<div><b>Office</b><p>Move money between the transfer and wage budgets, check finances and ask the board for support. Keep the board happy or you will be looking for a new job.</p></div>
</div><div style="text-align:right;margin-top:16px"><button class="btn pri" data-act="close">Got it</button></div>`;

async function refreshMetas(){try{ui.metas=await readMetas()}catch(e){ui.metas=[null,null,null]}}
async function toMenu(){
 await flushSave();await savePending;
 if(typeof leaveMatch==='function'&&view==='match')leaveMatch();
 closeModal();fxQueue.length=0;fxClose();
 S=null;M=null;W=null;view='home';sub='overview';ui.mode='menu';ui.slotIntent=null;ui.confirmDel=null;ui.metas=null;
 render();await refreshMetas();render();window.scrollTo(0,0);
}
function askMenu(){
 // A finished match is banked before leaving, so the result can't be lost or replayed.
 if(view==='match'&&M&&M.phase==='done'){processMatchday(applyUserMatch(M.E));M=null;toMenu();return}
 if(!(view==='match'&&M&&M.phase==='live')){toMenu();return}
 openModal(`<div class="eyebrow">Main menu</div><h2 style="font-size:26px;margin:6px 0 10px">Leave this match?</h2><p class="muted" style="line-height:1.6">The match is not saved until it finishes and you continue. Your career will reload from before kick-off.</p>
 <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn" data-act="close">Stay</button><button class="btn pri" data-act="menu-go">Leave to menu</button></div>`);
}
async function menuLoad(n){
 if(ui.busy)return;ui.busy=true;
 try{const s=await loadSlot(n);if(!s){toast('That save could not be read');await refreshMetas();render();return}
  S=s;ensureCalendar();advanceToUser();W=null;M=null;view='home';sub='overview';ui.mode='game';render();window.scrollTo(0,0)}
 catch(e){toast('That save could not be read')}
 finally{ui.busy=false}
}
function menuNew(n,over){
 if(!n){ui.slotIntent='new';render();return}
 ui.newSlot=n;ui.overwrite=!!over;ui.slotIntent=null;ui.mode='new';W=null;ui.pickClub=null;render();window.scrollTo(0,0);
}
