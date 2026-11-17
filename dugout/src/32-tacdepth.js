/* ================= tactical depth =================
   A tactic has a complexity: pressing triggers, a high line, short passing under pressure, a separate shape in
   possession, specialist roles. A squad has the tactical intelligence to carry it out, and grows familiar with a
   system over time. Ask too much of a limited or unfamiliar squad and decisions, passing and positioning suffer;
   a clever, settled squad executes a demanding plan and gets the full benefit of it. */
const ROLE_CX={gk:0,sweeper:6,cb:0,stopper:3,distributor:5,fb:0,overlap:3,inverted:7,anchor:0,deep:6,winner:2,b2b:1,playmaker:6,am:1,shadow:4,winger:0,inside:3,widepm:6,striker:1,poacher:2,target:1,presser:4,false9:8};
const ROLE_KEYS={gk:['ref','han','pos'],sweeper:['one','pas','dec'],cb:['tck','mar','hea'],stopper:['tck','agg','str'],distributor:['pas','vis','cmp'],fb:['tck','pac','sta'],overlap:['sta','cro','pac'],inverted:['pas','dec','pos'],
 anchor:['pos','tck','dec'],deep:['pas','vis','cmp'],winner:['tck','wor','agg'],b2b:['sta','wor','pas'],playmaker:['pas','vis','dec'],am:['lon','pas','vis'],shadow:['fin','pac','dec'],
 winger:['dri','cro','pac'],inside:['dri','fin','acc'],widepm:['pas','vis','dri'],striker:['fin','fir','str'],poacher:['fin','acc','cmp'],target:['hea','str','jmp'],presser:['wor','sta','acc'],false9:['pas','vis','dri']};
const INS_CX={press:[0,5,16],line:[3,0,10],passing:[8,2,0],tempo:[2,0,6],width:[2,0,2],ment:[4,0,0,2,6],final:[5,0,3,1],onWin:[4,0,7],onLose:[10,0,2]};
const INS_LABEL={press:['Low block','Mid block','High press'],line:['Deep line','Standard line','High line'],passing:['Short passing','Mixed passing','Direct passing'],tempo:['Patient tempo','Normal tempo','High tempo'],width:['Narrow','Normal width','Wide'],ment:['Very defensive','Defensive','Balanced','Attacking','Very attacking'],final:['Work it in','Mixed final third','Shoot on sight','Cross early'],onWin:['Counter-attack','Mixed transition','Keep possession'],onLose:['Counter-press','Mixed reaction','Regroup']};
function tacComplexity(t){
 const parts=[];let c=8;
 for(const[k,arr]of Object.entries(INS_CX)){const v=arr[t.ins[k]]||0;if(v){c+=v;parts.push([INS_LABEL[k][t.ins[k]],v])}}
 if(t.formIn&&t.formIn!==t.form){c+=12;parts.push(['Separate shape with the ball',12])}
 (t.roles||[]).forEach((r,i)=>{const v=Math.round((ROLE_CX[r]||0)*.5);if(v>=2)parts.push([roleName(FORMATIONS[t.form][i][0],r),v]);c+=v});
 return{cx:clamp(Math.round(8+(c-8)*.72),0,100),parts:parts.sort((a,b)=>b[1]-a[1])};
}
function tacIQ(cid){
 const c=clubOf(cid),xi=c.tac.xi.map(id=>S.players[id]).filter(Boolean);if(!xi.length)return 50;
 const a=k=>xi.reduce((s,p)=>s+p.at[AIX[k]],0)/xi.length;
 return clamp(Math.round((a('dec')*1.3+a('pos')+a('wor')*.8+a('cmp')*.9+a('vis')*.7)/4.7*1.12-8),20,99);
}
function roleFit(p,role){const ks=ROLE_KEYS[role]||[];if(!ks.length)return.7;return ks.reduce((s,k)=>s+p.at[AIX[k]],0)/ks.length/100}
const tacSig=t=>[t.form,t.formIn,...INSTR.map(i=>t.ins[i[0]]),...(t.roles||[])].join('|');
function famOf(cid){const t=clubOf(cid).tac;return cid===S.user?(t.fam??55):82}
function tacticFit(cid){
 const t=clubOf(cid).tac,{cx,parts}=tacComplexity(t),iq=tacIQ(cid),fam=famOf(cid),cap=Math.round(iq*.62+fam*.38),gap=cx-cap;
 const effect=gap>0?-clamp(gap/420,0,.07):clamp(-gap/2600,0,.015);
 return{cx,parts,iq,fam,cap,gap,effect};
}
function fitVerdict(f){
 if(f.gap>22)return['Too demanding','v2','The players cannot carry this out. Expect wrong decisions, misplaced passes and gaps in the shape. Simplify the instructions or give them time to learn it.'];
 if(f.gap>8)return['Stretching them','v3','The squad will make mistakes with this system until they know it better. It may pay off with more familiarity.'];
 if(f.gap>-10)return['Good fit','v5','The squad can execute this plan.'];
 return['Comfortable','v6','The players could handle a more demanding system if you want more from them.'];
}
// After each match the squad learns the system it played; overhauling the tactic costs familiarity.
function tacticLearn(){
 const c=clubOf(S.user),t=c.tac,sig=tacSig(t);t.fam=t.fam??55;
 if(t.lastSig&&t.lastSig!==sig){const a=t.lastSig.split('|'),b=sig.split('|');let ch=0;for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i])ch++;
  if(a[0]!==b[0]||a[1]!==b[1])t.fam*=.6;t.fam=Math.max(15,t.fam-ch*3)}
 t.fam=Math.min(100,t.fam+6+(S.train&&S.train.focus==='tactical'?4:0));t.lastSig=sig;
}
// At kick-off: apply the execution effect and role suitability to both sides.
function applyTactics(E){
 for(const s of[0,1]){const cid=E.T[s].club,f=tacticFit(cid);if(f.effect)applyTalk(E,s,f.effect);
  const t=clubOf(cid).tac;for(const p of E.T[s].pl){if(p.off)continue;const i=t.xi.indexOf(p.pid);if(i<0)continue;const rf=roleFit(S.players[p.pid],t.roles[i]);
   if(rf<.58){const m=1-(.58-rf)*.35;for(const k of['dec','pas','pos'])p.a[k]=clamp(p.a[k]*m,.05,1)}}}
}
