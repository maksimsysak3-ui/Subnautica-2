/* ================= press conferences and media =================
   Before and after matches the media want a word. Questions come from the real situation (form, the table,
   the opponent, a star player, a transfer rumour, the result). Answers move squad or player morale, board
   confidence and how the fans feel, and the best quote makes the headlines. */
ui.press=null;
const OUTLETS=['The Touchline','Matchday Standard','The Final Whistle','Pitchside Weekly','The Daily Header','Terrace Times'];
const fansWord=f=>f>=80?['Delighted','v6']:f>=65?['Positive','v5']:f>=50?['Patient','v4']:f>=35?['Restless','v3']:['Angry','v2'];
function formOf(cid){const lid=clubOf(cid).league,r=S.results[lid].filter(x=>x.h===cid||x.a===cid).slice(-5);return r.map(x=>{const h=x.h===cid,gf=h?x.hg:x.ag,ga=h?x.ag:x.hg;return gf>ga?'W':gf<ga?'L':'D'})}
function pressQuestions(kind){
 const uc=clubOf(S.user),qs=[],sq=squadOf(S.user),star=sq.slice().sort((a,b)=>b.ovr-a.ovr)[0],fm=formOf(S.user),wins=fm.filter(x=>x==='W').length,losses=fm.filter(x=>x==='L').length;
 const tb=S.results[uc.league].length?table(uc.league):null,pos=tb?posIn(tb,S.user):null,tp=targetPos(S.user);
 const T=M&&M.tie,opp=M?clubOf(M.fx[0]===S.user?M.fx[1]:M.fx[0]):null,stronger=opp&&opp.rep>uc.rep+4,weaker=opp&&opp.rep<uc.rep-4;
 const O=(t,tone,fx)=>({t,tone,fx});
 if(kind==='pre'){
  if(opp)qs.push({q:stronger?`${opp.name} are expected to beat you. Is this a free hit?`:weaker?`Anything less than a win against ${opp.short} would be a disappointment, wouldn't it?`:`How do you see the game against ${opp.short} going?`,
   o:[O(stronger?"We fear nobody. We're going there to win.":"We expect to win, and so do the players.",'Confident',{mor:3,fans:3,board:weaker?0:-1,risk:1}),O(`${opp.short} deserve respect. We'll need to be at our best.`,'Respectful',{mor:1,fans:0,board:1}),O("I only think about my own team.",'Calm',{mor:1})]});
  if(T&&T.comp!=='lg')qs.push({q:`How seriously are you taking the ${S.cups[T.comp].name}?`,o:[O("Every trophy matters. We want to go all the way.",'Ambitious',{fans:4,board:1,mor:2}),O("It's a chance to give minutes to players who need them.",'Pragmatic',{fans:-3,board:0}),O("One game at a time.",'Calm',{mor:1})]});
  if(losses>=3)qs.push({q:`${losses} defeats in your last ${fm.length}. Is your job under threat?`,o:[O("I have the full backing of the board and the players.",'Defiant',{board:-2,mor:2}),O("Results haven't been good enough. That's on me.",'Honest',{board:2,fans:2,mor:-1}),O("I'm not going to discuss that.",'Deflect',{fans:-2})]});
  else if(wins>=3)qs.push({q:`${wins} wins in your last ${fm.length}. Can you keep this run going?`,o:[O("This squad can beat anyone right now.",'Bullish',{mor:4,fans:3,risk:1}),O("We stay humble and keep working.",'Grounded',{mor:2,board:1}),O("Form is temporary. The next game is all that matters.",'Calm',{mor:1})]});
  if(star)qs.push({q:`Everyone is talking about ${star.fn} ${star.ln}. What makes him so important?`,o:[O(`He's world class and he'll prove it again.`,'Praise',{pid:star.id,pmor:6,mor:-1}),O("He's one part of a team. Nobody is bigger than the club.",'Team first',{mor:2,pid:star.id,pmor:-2}),O("He knows he can still improve.",'Demanding',{pid:star.id,pmor:-1,board:1})]});
  const linked=sq.filter(p=>p.ovr>=repToOvr(uc.rep)).sort(()=>G.f()-.5)[0],suitor=S.clubs.filter(c=>c.rep>uc.rep+6).sort(()=>G.f()-.5)[0];
  if(linked&&suitor&&G.f()<.6)qs.push({q:`There are reports ${suitor.name} want ${linked.ln}. Will he be here next season?`,o:[O(`${linked.ln} is not for sale. End of story.`,'Protect',{pid:linked.id,pmor:5,fans:3}),O("Every player has a price, but we're not looking to sell.",'Open',{pid:linked.id,pmor:-3,board:1}),O("I don't comment on speculation.",'Deflect',{})]});
 }else{
  const E=M.E,us=M.us,gf=E.score[us],ga=E.score[1-us],res=gf>ga?'win':gf<ga?'loss':'draw',best=E.P.concat(E.old).filter(p=>p.s===us&&p.rating!=null).sort((a,b)=>b.rating-a.rating)[0],worst=E.P.concat(E.old).filter(p=>p.s===us&&p.rating!=null).sort((a,b)=>a.rating-b.rating)[0],red=E.events.find(e=>e.type==='red'&&e.s===us);
  qs.push({q:res==='win'?`${gf}–${ga}. How pleased are you with that performance?`:res==='loss'?`${gf}–${ga}. What went wrong today?`:`${gf}–${ga}. A point gained or two dropped?`,
   o:res==='win'?[O("Delighted. That's the standard I expect every week.",'Proud',{mor:3,fans:3,board:1}),O("Three points, but we can play much better.",'Demanding',{mor:-1,board:2}),O(`Credit to ${opp.short}, they made it tough.`,'Gracious',{fans:1})]
   :res==='loss'?[O("We weren't good enough. I take responsibility.",'Accountable',{fans:2,board:1,mor:1}),O("Some of my players let themselves down today.",'Critical',{mor:-4,board:1,fans:1}),O("The decisions went against us all afternoon.",'Blame officials',{fans:2,board:-2})]
   :[O("A fair result. We move on.",'Measured',{mor:1}),O("Two points dropped. We should have won that.",'Frustrated',{mor:-1,fans:1,board:1}),O("Plenty of positives to take.",'Upbeat',{mor:2})]});
  if(best)qs.push({q:`${S.players[best.pid].ln} stood out today. Your thoughts?`,o:[O("Outstanding. That's why he plays.",'Praise',{pid:best.pid,pmor:6}),O("He was good, but I expect that from him.",'Measured',{pid:best.pid,pmor:1})]});
  if(red)qs.push({q:`${S.players[red.pid].ln} was sent off. Was it deserved?`,o:[O("He's let his teammates down and he knows it.",'Critical',{pid:red.pid,pmor:-6,board:1}),O("I'll speak to him privately.",'Protect',{pid:red.pid,pmor:2}),O("I haven't seen it again yet.",'Deflect',{})]});
  else if(worst&&res==='loss')qs.push({q:`${S.players[worst.pid].ln} had a difficult afternoon. Will he keep his place?`,o:[O("He has my full support.",'Protect',{pid:worst.pid,pmor:5}),O("Everyone has to earn their place. He knows that.",'Demanding',{pid:worst.pid,pmor:-4,mor:1})]});
 }
 return qs.slice(0,3);
}
function openPress(kind){ui.press={kind,qs:pressQuestions(kind),i:0,picks:[],outlet:OUTLETS[(S.md+S.season+(kind==='post'?3:0))%OUTLETS.length]};renderPress()}
function renderPress(){
 const P=ui.press,q=P.qs[P.i];
 if(!q){return pressSummary()}
 openModal(`<div class="press"><div class="press-h"><span class="press-mic"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg></span><div><div class="eyebrow">${P.kind==='pre'?'Pre-match':'Post-match'} press conference</div><small>${esc(P.outlet)} · question ${P.i+1} of ${P.qs.length}</small></div></div>
 <blockquote class="press-q">${esc(q.q)}</blockquote><div class="press-opts">${q.o.map((o,k)=>`<button class="press-opt" data-act="press-a" data-v="${k}"><em>${esc(o.tone)}</em><span>“${esc(o.t)}”</span></button>`).join('')}</div>
 <div class="press-f"><div class="press-dots">${P.qs.map((_,k)=>`<i class="${k<P.i?'done':k===P.i?'on':''}"></i>`).join('')}</div><button class="btn ghost" data-act="press-skip">Send your assistant</button></div></div>`);
}
function answerPress(k){
 const P=ui.press,q=P.qs[P.i],o=q.o[k],fx=o.fx;P.picks.push({q:q.q,o});
 if(fx.mor)for(const p of squadOf(S.user))p.mor=clamp(p.mor+fx.mor,25,98);
 if(fx.pid!=null&&S.players[fx.pid])S.players[fx.pid].mor=clamp(S.players[fx.pid].mor+(fx.pmor||0),25,98);
 if(fx.board)S.board=clamp(S.board+fx.board,5,100);
 S.fans=clamp((S.fans??62)+(fx.fans||0),5,100);
 P.i++;renderPress();
}
function pressSummary(){
 const P=ui.press,tot={mor:0,board:0,fans:0};for(const{o}of P.picks){tot.mor+=o.fx.mor||0;tot.board+=o.fx.board||0;tot.fans+=o.fx.fans||0}
 const pick=P.picks.slice().sort((a,b)=>Math.abs((b.o.fx.fans||0))+Math.abs(b.o.fx.mor||0)-Math.abs(a.o.fx.fans||0)-Math.abs(a.o.fx.mor||0))[0],uc=clubOf(S.user);
 if(pick){const head=`${uc.short} boss: “${pick.o.t.length>70?pick.o.t.slice(0,67)+'…':pick.o.t}”`;news(`Speaking to ${P.outlet}, the ${uc.name} manager was asked: “${pick.q}”`,'club',[S.user],{title:head})}
 if(M)M['press_'+P.kind]=true;if(tot.fans>=5)unlock('press');save();
 const line=(l,v)=>`<div class="press-fx"><span>${l}</span><b class="${v>0?'v5':v<0?'v2':''}">${v>0?'+'+v:v===0?'No change':v}</b></div>`,[fw]=fansWord(S.fans??62);
 openModal(`<div class="press"><div class="eyebrow">Press conference over</div><h2 style="font-size:26px;margin:6px 0 12px">${pick?`“${esc(pick.o.t)}”`:'No questions answered'}</h2><p class="muted" style="margin:0 0 12px">${esc(P.outlet)} will lead with that quote.</p>
 ${line('Squad morale',tot.mor)}${line('Board confidence',tot.board)}${line('Fan mood',tot.fans)}<p class="muted" style="font-size:12px;margin:10px 0 0">Supporters are ${fw.toLowerCase()}.</p>
 <div style="text-align:right;margin-top:14px"><button class="btn pri" data-act="press-done">Done</button></div></div>`);
 ui.press=null;
}
