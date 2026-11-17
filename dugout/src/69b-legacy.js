/* ================= longevity: club vision, derbies and achievements ================= */
/* ---------- rivals ---------- */
// Every club has one local rival: the nearest-reputation club from the same country, paired deterministically.
function rivalOf(cid){
 const c=clubOf(cid),pool=S.clubs.filter(x=>x.id!==cid&&x.nation===c.nation);if(!pool.length)return null;
 const h=x=>(Math.imul(Math.min(cid,x.id)*131+Math.max(cid,x.id),2654435761)>>>0)%7;
 return pool.slice().sort((a,b)=>(Math.abs(a.rep-c.rep)+h(a))-(Math.abs(b.rep-c.rep)+h(b)))[0].id;
}
const isDerby=(a,b)=>rivalOf(a)===b||rivalOf(b)===a;
function h2hRecord(opp){const r=(S.h2h||{})[opp]||{w:0,d:0,l:0};return r}
function recordH2H(opp,gf,ga){S.h2h=S.h2h||{};const r=S.h2h[opp]=S.h2h[opp]||{w:0,d:0,l:0};r[gf>ga?'w':gf<ga?'l':'d']++}

/* ---------- club vision ---------- */
const VISION_POOL=[
 {k:'pos',t:o=>`Finish ${ordinal(o.v)} or higher in the league`,mk:c=>({v:Math.max(1,targetPos(c.id)-1),y:2})},
 {k:'cont',t:()=>'Qualify for the Continental Elite Cup',mk:c=>({v:1,y:3}),ok:c=>c.rep>=72},
 {k:'cup',t:()=>'Reach a domestic cup semi-final',mk:()=>({v:1,y:2})},
 {k:'youth',t:o=>`Give first-team debuts to ${o.v} academy graduates`,mk:()=>({v:2,y:3})},
 {k:'young',t:o=>`Have ${o.v} under-23s in the regular starting XI`,mk:()=>({v:3,y:2})},
 {k:'wages',t:()=>'Keep the wage bill within budget every season',mk:()=>({v:1,y:3})},
 {k:'promo',t:()=>'Win promotion to the top flight',mk:()=>({v:1,y:2}),ok:c=>S.leagues[c.league].tier===1},
 {k:'title',t:()=>'Win the league title',mk:()=>({v:1,y:3}),ok:c=>c.rep>=84},
];
function ensureVision(){
 if(S.vision&&S.vision.club===S.user)return;
 const c=clubOf(S.user),pool=VISION_POOL.filter(g=>!g.ok||g.ok(c));
 const pick=[pool.find(g=>g.k==='pos')||pool[0],...shuffled(pool.filter(g=>g.k!=='pos')).slice(0,2)];
 S.vision={club:S.user,set:S.season,goals:pick.map(g=>Object.assign({k:g.k,done:false,failed:false,prog:0},g.mk(c),{due:S.season+g.mk(c).y-1}))};
}
const visionText=g=>(VISION_POOL.find(x=>x.k===g.k)||{t:()=>g.k}).t(g);
// Evaluated at season end (before the table resets).
function visionReview(){
 ensureVision();const c=clubOf(S.user),out=[];
 const pos=S.lastRow?posIn(table(c.league),S.user):null;
 for(const g of S.vision.goals){if(g.done||g.failed)continue;
  if(g.k==='pos'&&pos&&pos<=g.v)g.done=true;
  if(g.k==='title'&&pos===1)g.done=true;
  if(g.k==='promo'&&S.leagues[c.league].tier===1&&pos<=DROP)g.done=true;
  if(g.k==='cont'&&contQualifiers(true).includes(S.user))g.done=true;
  if(g.k==='cup'&&S.cups){for(const k of Object.values(S.cups))if(k.key.startsWith('dom')&&k.rounds[3]&&k.rounds[3].some(t=>t.h===S.user||t.a===S.user))g.done=true}
  if(g.k==='youth'){g.prog=squadOf(S.user).filter(p=>p.youth&&p.s.ap>0).length+(g.prog||0);if(g.prog>=g.v)g.done=true}
  if(g.k==='young'){const n=clubOf(S.user).tac.xi.map(id=>S.players[id]).filter(p=>p&&p.age<=23).length;g.prog=n;if(n>=g.v)g.done=true}
  if(g.k==='wages'){if(wageBill(S.user)>c.wageBudget)g.failed=true;else if(S.season>=g.due)g.done=true}
  if(!g.done&&S.season>=g.due)g.failed=true;
  if(g.done){S.board=clamp(S.board+8,5,100);c.budget+=Math.round(budgetOf(c.rep)*.15/1e5)*1e5;out.push(['done',g])}
  if(g.failed){S.board=clamp(S.board-10,5,100);out.push(['fail',g])}}
 if(out.length)mail('Board of Directors','Club vision: end-of-season review',`<p>${out.map(([s,g])=>`${s==='done'?'Achieved':'Missed'}: <b>${esc(visionText(g))}</b>.`).join('<br>')}</p><p>${out.some(x=>x[0]==='done')?'The board has added a bonus to the transfer budget.':''}</p>`,null,'board',{links:[['Board room','goto','office/board']]});
 // when every goal is resolved, the board sets a new vision
 if(S.vision.goals.every(g=>g.done||g.failed))S.vision=null;
}
function visionPanel(compact){
 ensureVision();const V=S.vision;
 return`<section class="panel ${compact?'':'c12'}"><div class="ph"><h3>Club vision</h3><small>Set by the board in ${2026+V.set}/${String(2027+V.set).slice(2)}</small></div><div class="list">${V.goals.map(g=>`<div class="li vis ${g.done?'done':g.failed?'fail':''}" style="grid-template-columns:22px 1fr auto"><span class="vis-ic">${g.done?'✓':g.failed?'✕':'○'}</span><span><b>${esc(visionText(g))}</b><small>${g.done?'Achieved':g.failed?'Missed':`By the end of ${2026+g.due}/${String(2027+g.due).slice(2)}`}</small></span>${g.prog&&!g.done?`<small>${g.prog}/${g.v}</small>`:''}</div>`).join('')}</div></section>`;
}

/* ---------- achievements ---------- */
const ACH=[
 ['first','First win','Win your first match.'],['five','Statement win','Win a match by five goals or more.'],['unbeaten10','Unbeatable','Go ten matches unbeaten.'],
 ['derby','Bragging rights','Win a derby.'],['giant','Giant killer','Beat a club with a much higher reputation.'],['cs','Clean sheet king','Keep 15 clean sheets in a season.'],
 ['title','Champions','Win a league title.'],['cup','Silverware','Win a domestic cup.'],['cont','Kings of the continent','Win the Continental Elite Cup.'],
 ['double','The double','Win the league and a cup in the same season.'],['promo','Going up','Win promotion.'],['buy4','Marquee signing','Sign a player rated 4 stars or more.'],
 ['sell50','Big sale','Sell a player for £50M or more.'],['grad','Homegrown','Give an academy graduate his first-team debut.'],['m100','Centurion','Manage 100 matches.'],
 ['m300','Veteran','Manage 300 matches.'],['s5','Long-term project','Complete five seasons at one club.'],['press','Media darling','Win over the fans in a press conference.'],
 ['pens','Nerves of steel','Win a penalty shootout.'],['fam','Well drilled','Reach 100% tactical familiarity.'],['scout','Network','Hold 25 scout reports.'],['comeback','Never in doubt','Win after trailing at half-time.'],
];
function unlock(k){S.ach=S.ach||{};if(S.ach[k])return;const a=ACH.find(x=>x[0]===k);if(!a)return;S.ach[k]=seasonLabel();
 toast(`Achievement unlocked: ${a[1]}`);news(`New achievement for the ${clubOf(S.user).short} manager: ${a[1]}. ${a[2]}`,'club',[S.user],{title:`Achievement: ${a[1]}`})}
// After each of the user's matches (from the full engine).
function achMatch(E,us,tie){
 const gf=E.score[us],ga=E.score[1-us],opp=E.T[1-us].club,mg=S.mgr;
 if(gf>ga)unlock('first');if(gf-ga>=5)unlock('five');
 S.run=gf>=ga?(S.run||0)+1:0;if(S.run>=10)unlock('unbeaten10');
 if(gf>ga&&isDerby(S.user,opp))unlock('derby');if(gf>ga&&clubOf(opp).rep>=clubOf(S.user).rep+10)unlock('giant');
 if(ga===0)S.cs=(S.cs||0)+1;if((S.cs||0)>=15)unlock('cs');
 const ht=E.events.find(e=>e.type==='ht'),htg=ht?E.events.filter(e=>e.type==='goal'&&e.t<ht.t):[];if(gf>ga&&htg.filter(e=>e.s!==us).length>htg.filter(e=>e.s===us).length)unlock('comeback');
 const games=mg.w+mg.d+mg.l+1;if(games>=100)unlock('m100');if(games>=300)unlock('m300');
 if((clubOf(S.user).tac.fam||0)>=100)unlock('fam');if((S.reports||[]).length>=25)unlock('scout');
 if(M&&M.pens&&M.pens[us]>M.pens[1-us])unlock('pens');
 if(isDerby(S.user,opp))recordH2H(opp,gf,ga);
}
function achSeason(){
 const tr=S.mgr.trophies.filter(t=>t.season===seasonLabel()&&t.club===S.user);
 if(tr.some(t=>!t.minor&&t.key&&t.key.startsWith('lg:')))unlock('title');if(tr.some(t=>t.key&&t.key.startsWith('dom-')))unlock('cup');if(tr.some(t=>t.key==='cont'))unlock('cont');
 if(tr.filter(t=>!t.minor).length>=2&&tr.some(t=>t.key&&t.key.startsWith('lg:')&&!t.minor))unlock('double');if(tr.some(t=>t.minor))unlock('promo');
 const atClub=S.hist.filter(h=>h.club===S.user).length+1;if(atClub>=5)unlock('s5');S.cs=0;
}
function viewAchievements(){
 const got=S.ach||{},n=Object.keys(got).length;
 return`<section class="panel c12"><div class="ph"><h3>Achievements</h3><small>${n} of ${ACH.length} unlocked</small></div><div class="pb"><div class="meter" style="margin:0 0 14px"><i style="width:${n/ACH.length*100}%"></i></div><div class="ach-grid">${ACH.map(([k,t,d])=>`<div class="ach ${got[k]?'on':''}"><span class="ach-ic">${got[k]?'★':'☆'}</span><div><b>${esc(t)}</b><small>${esc(d)}</small>${got[k]?`<em>${got[k]}</em>`:''}</div></div>`).join('')}</div></div></section>`;
}
