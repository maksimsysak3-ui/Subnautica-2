/* ================= app shell ================= */
function render(){
 $('#bar').hidden=!S;
 if(!S){$('#bar').innerHTML='';
  if(ui.mode==='new'){$('#view').innerHTML=viewStart();return}
  // Keep the menu backdrop mounted so the intro animation plays once, not on every click.
  const ex=$('#view .mm'),html=viewMenu();
  if(ex){const tmp=document.createElement('div');tmp.innerHTML=html;ex.querySelector('.mm-in').replaceWith(tmp.querySelector('.mm-in'))}
  else{$('#view').innerHTML=html;const mm=$('#view .mm');setTimeout(()=>mm.classList.remove('fresh'),1200)}
  return}
 renderBar();
 const fn={home:viewHome,squad:viewSquad,player:viewPlayer,tactics:viewTactics,transfers:viewTransfers,comps:viewComps,office:viewOffice,club:viewClub,match:viewMatch}[view]||viewHome;
 const html=fn(),side=['home','squad','club'].includes(view)&&!(view==='home'&&sub==='news');
 $('#view').innerHTML=side?`<div class="layout"><div style="min-width:0">${html}</div>${newsSidebar()}</div>`:html;
 if(view==='transfers'&&sub==='search')renderSearch();
 if(view==='match')mountMatch();
}
function onContinue(){if(S.sacked){sackedFlow();return}if(S.md>=MDAYS){openSeasonReview();return}go('match')}
function sackedFlow(){const c=clubOf(S.user),ids=jobOffers(3,Math.max(30,c.rep-22),c.rep-4).map(x=>x.id);jobsModal(ids.length?ids:jobOffers(3,30,70).map(x=>x.id),'You have been sacked',`${c.name} have relieved you of your duties`,true)}
function assignToSlot(pid){
 const t=clubOf(S.user).tac,i=ui.tSel??9,j=t.xi.indexOf(pid);
 if(j===i)return;
 if(j>=0){[t.xi[i],t.xi[j]]=[t.xi[j],t.xi[i]]}
 else{const old=t.xi[i];t.xi[i]=pid;const b=t.bench.indexOf(pid);if(b>=0)t.bench[b]=old;}
 ensureLineup(S.user);save();render();
}
function pressOne(t){t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b===t))}
document.addEventListener('click',e=>{
 if(e.target.id==='modal'){closeModal();return}
 const t=e.target.closest('[data-act]');if(!t||t.disabled)return;
 const a=t.dataset.act,id=t.dataset.id!=null?+t.dataset.id:null,v=t.dataset.v,tac=S?clubOf(S.user).tac:null;
 switch(a){
  case'close':closeModal();break;
  case'fx-close':fxClose();break;
  case'train':S.train.focus=v;save();render();break;
  case'train-int':S.train.int=+v;save();render();break;
  case'pretalk':M.preTalk=v;pressOne(t);break;
  case'talk':{const E=M.E,diff=E.score[M.us]-E.score[1-M.us],d=talkEffect(v,diff,true);applyTalk(E,M.us,d);closeModal();M.paused=false;const b=$('#m-pause');if(b)b.textContent='Pause';toast(talkWord(d));break}
  case'talk-skip':closeModal();M.paused=false;{const b=$('#m-pause');if(b)b.textContent='Pause'}break;
  case'job':closeModal();takeJob(id,S.sacked?'Sacked':'Left for a new job');S.offers=[];M=null;go('home');toast(`Welcome to ${clubOf(id).name}`);break;
  case'go-news':go('home','news');break;
  case'pickNation':ui.pickNation=v;ui.pickLeague=null;ui.pickClub=null;render();break;
  case'pickLeague':ui.pickLeague=+v;ui.pickClub=null;render();break;
  case'pickClub':ui.pickClub=id;render();break;
  case'start':S=W;W=null;S.slot=ui.newSlot||1;ui.mode='game';startCareer(id);flushSave();view='home';sub='overview';render();window.scrollTo(0,0);break;
  case'menu':askMenu();break;
  case'menu-go':toMenu();break;
  case'menu-back':W=null;ui.mode='menu';render();break;
  case'menu-load':if(v)menuLoad(+v);break;
  case'menu-new':menuNew(v?+v:null,t.dataset.over);break;
  case'menu-cancel':ui.slotIntent=null;render();break;
  case'menu-help':openModal(HELP);break;
  case'menu-del':ui.confirmDel=+v;render();break;
  case'menu-del-no':ui.confirmDel=null;render();break;
  case'menu-del-yes':ui.confirmDel=null;deleteSlot(+v).then(refreshMetas).then(render);break;
  case'nav':closeModal();go(v);break;
  case'sub':sub=v;render();window.scrollTo(0,0);break;
  case'back':{const b=ui.back||['home','overview'];go(b[0],b[1]);break}
  case'continue':closeModal();onContinue();break;
  case'player':closeModal();openPlayer(id);break;
  case'msg':openMsg(id);break;
  case'offer-yes':case'offer-no':{const m=S.inbox.find(x=>x.id===id),o=m&&m.action;if(!o||o.done)break;const p=S.players[o.pid];
   if(a==='offer-yes'){const why=canSell(p);if(p.club!==S.user){toast('He is no longer at the club.');break}if(why){toast(why);break}moveP(p.id,o.club,o.fee);S.fin.sales+=o.fee;logDeal(p.id,S.user,o.club,o.fee);o.done='yes';news(`${p.fn} ${p.ln} joins ${clubOf(o.club).name} from ${clubOf(S.user).name} for ${money(o.fee)}.`,'transfer',[o.club,S.user]);toast(`${p.ln} sold for ${money(o.fee)}`)}else{o.done='no';toast('Offer rejected')}
   save();closeModal();render();break}
  case'sort':{const k=t.dataset.k,cur=ui.sort[k];ui.sort[k]=[v,cur[0]===v?-cur[1]:-1];if(view==='transfers'&&sub==='search')renderSearch();else render();break}
  case'group':ui.group=v;render();break;
  case'negotiate':openNegotiation(id);break;
  case'neg-bid':negBid();break;
  case'neg-terms':negTerms();break;
  case'neg-years':ui.neg.years=+v;renderNeg();break;
  case'neg-role':ui.neg.role=v;renderNeg();break;
  case'neg-accept-counter':ui.neg.fee=ui.neg.counter;ui.neg.counter=null;negBid();break;
  case'pickComp':ui.lg=+v;ui.lgMd=null;render();break;
  case'board-req':{const c=clubOf(S.user);S.boardReq=S.season;if(S.board>=62){const g=Math.round(c.budget*.2/1e5)*1e5+5e6;c.budget+=g;toast(`The board has added ${money(g)} to your transfer budget`)}else{S.board=Math.max(5,S.board-3);toast('The board turned down your request')}save();render();break}
  case'split-apply':{const c=clubOf(S.user),w=+$('#sp-r').value,total=c.budget+c.wageBudget*WAGE_TO_FEE;c.wageBudget=w;c.budget=Math.max(0,Math.round((total-w*WAGE_TO_FEE)/1e5)*1e5);save();render();toast('Budgets updated');break}
  case'sell':sellUI(id);break;
  case'sell-yes':{const s=ui.sell;if(!s)break;const p=S.players[s.pid];moveP(s.pid,s.buyer,s.fee);S.fin.sales+=s.fee;logDeal(s.pid,S.user,s.buyer,s.fee);news(`${p.fn} ${p.ln} joins ${clubOf(s.buyer).name} from ${clubOf(S.user).name} for ${money(s.fee)}.`,'transfer',[s.buyer,S.user]);save();toast(`${p.ln} sold for ${money(s.fee)}`);ui.sell=null;go('squad');break}
  case'shortlist':{const i=S.shortlist.indexOf(id);if(i>=0)S.shortlist.splice(i,1);else S.shortlist.push(id);save();render();break}
  case'slot':ui.tSel=+t.dataset.i;render();break;
  case'assign':assignToSlot(id);break;
  case'role':tac.roles[ui.tSel??9]=v;save();render();break;
  case'ins':tac.ins[t.dataset.k]=+v;save();if(view==='match')pressOne(t);else render();break;
  case'autoxi':tac.xi=pickXI(S.user,tac.form);tac.bench=pickBench(S.user,tac.xi);save();render();toast('Best XI selected');break;
  case'md':ui.lgMd=clamp((ui.lgMd??Math.min(S.md,MDAYS-1))+ +t.dataset.d,0,MDAYS-1);render();break;
  case'kitflip':ui.kitBack=!ui.kitBack;render();break;
  case'new-season':{closeModal();endSeason();M=null;go('home');const ls=S.lastSeason;
   if(ls&&(ls.champ||ls.promoted))fxQueue.push(()=>celebrateTrophy(ls.champ?`${ls.league} champions`:`Promoted from ${ls.league}`,`${seasonLabel()} · ${clubOf(ls.club).name}`,ls.club));
   if(S.youth&&S.youth.length)fxQueue.push(()=>revealYouth(S.youth));
   if(S.offers&&S.offers.length)fxQueue.push(()=>jobsModal(S.offers,'Job offers','Your reputation is growing',false));
   if(fxQueue.length)fxQueue.shift()();else toast(`Season ${seasonLabel()} has begun`);break}
  case'kickoff':kickOff();render();break;
  case'instant':instantResult();break;
  case'match-finish':finishMatchday();break;
  case'mmode':M.mode=v;M.scan=0;M.wins=[];scanEvents();render();break;
  case'mspeed':if(M.mode==='full')M.fs=+v;else M.hs=+v;pressOne(t);break;
  case'mview':M.viewMode=v;render();break;
  case'mcam':M.camMode=v;if(VIEW)VIEW.setCam(v);pressOne(t);break;
  case'mpause':M.paused=!M.paused;t.textContent=M.paused?'Resume':'Pause';break;
  case'mtab':M.tab=v;pressOne(t);$('#m-feed').hidden=v!=='feed';$('#m-stats').hidden=v!=='stats';if(v==='stats')$('#m-stats').innerHTML=statsHTML();break;
  case'mtab2':M.tab2=v;pressOne(t);$('#m-side').innerHTML=v==='team'?lineupHTML():quickTacHTML();break;
  case'msel':{const i=+t.dataset.i;M.sel=M.sel===i?null:i;$('#m-side').innerHTML=lineupHTML();break}
  case'msub':{const E=M.E,tm=E.T[M.us],p=E.P[M.sel];if(p&&!p.off&&substitute(E,tm,p,id)){toast(`${S.players[id].ln} is coming on`)}M.sel=null;$('#m-side').innerHTML=lineupHTML();break}
 }
});
document.addEventListener('change',e=>{
 const k=e.target.dataset.change;if(!k)return;const v=e.target.value,tac=S&&S.user>=0?clubOf(S.user).tac:null;
 if(k==='lg'){ui.lg=+v;ui.lgMd=null;render()}
 else if(k==='form'){tac.form=v;tac.roles=defaultRoles(v);tac.xi=pickXI(S.user,v);tac.bench=pickBench(S.user,tac.xi);ui.tSel=9;save();render()}
 else if(k==='formIn'){tac.formIn=v;save();render()}
 else if(k==='formInLive'){tac.formIn=v;if(M&&M.E)setShape(M.E.T[M.us]);save()}
 else if(['trPos','trLeague','trMax','trAge','trMin','trNat'].includes(k)){ui[k]=['trPos','trLeague','trNat'].includes(k)?v:+v;renderSearch()}
 else if(k==='trExp'){ui.trExp=e.target.checked;renderSearch()}
 else if(k==='negInst'){ui.neg.inst=e.target.checked;renderNeg()}
 else if(k==='negClause'){ui.neg.clause=e.target.checked;renderNeg()}
 else if(k==='dealLeague'){ui.dealLeague=v;render()}
});
document.addEventListener('input',e=>{const k=e.target.dataset.input,v=+e.target.value;
 if(k==='neg'){const key=e.target.dataset.k;ui.neg[key]=v;const o=document.getElementById(e.target.id+'-o');if(o)o.textContent=key==='sellOn'?v+'%':money(v);negLive()}
 else if(k==='split'){const c=clubOf(S.user),total=c.budget+c.wageBudget*WAGE_TO_FEE;$('#sp-w').textContent=money(v)+'/w';$('#sp-t').textContent=money(Math.max(0,total-v*WAGE_TO_FEE))}
 else if(k==='trq'){ui.trQ=e.target.value;renderSearch()}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('#modal').hidden)closeModal();
 if(e.key===' '&&view==='match'&&M&&M.phase==='live'&&!/INPUT|SELECT|BUTTON/.test(e.target.tagName)){e.preventDefault();M.paused=!M.paused;const b=$('#m-pause');if(b)b.textContent=M.paused?'Resume':'Pause'}
});
async function boot(data){
 if(data&&data.S&&data.S.slot){S=data.S;ui.mode='game';view='home';sub='overview';render();return}
 render();await migrateLegacy();await refreshMetas();if(!S)render();
}
// Write the pending save before the tab closes or is hidden (mobile browsers rarely fire unload).
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S)flushSave()});
window.addEventListener('pagehide',()=>{if(S)flushSave()});
if(window.claude&&window.claude.hot&&window.claude.hot.snapshot)window.claude.hot.snapshot(()=>({S}));
window.claude?.hot?.ready?window.claude.hot.ready(boot):boot(window.claude?.hot?.data??{});
