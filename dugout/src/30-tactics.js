/* ================= tactics ================= */
// slot = [position, lateral 0..100 (team's left -> right), depth 0..100 (own goal -> opposition goal)]
const FORMATIONS={
 '4-3-3':[['GK',50,4],['LB',12,22],['CB',37,18],['CB',63,18],['RB',88,22],['DM',50,34],['CM',31,50],['CM',69,50],['LW',14,72],['ST',50,82],['RW',86,72]],
 '4-2-3-1':[['GK',50,4],['LB',12,22],['CB',37,18],['CB',63,18],['RB',88,22],['DM',38,36],['DM',62,36],['LW',14,64],['AM',50,62],['RW',86,64],['ST',50,82]],
 '4-4-2':[['GK',50,4],['LB',12,22],['CB',37,18],['CB',63,18],['RB',88,22],['LW',12,52],['CM',38,46],['CM',62,46],['RW',88,52],['ST',38,80],['ST',62,80]],
 '4-1-4-1':[['GK',50,4],['LB',12,22],['CB',37,18],['CB',63,18],['RB',88,22],['DM',50,34],['LW',12,56],['CM',36,52],['CM',64,52],['RW',88,56],['ST',50,80]],
 '4-4-1-1':[['GK',50,4],['LB',12,22],['CB',37,18],['CB',63,18],['RB',88,22],['LW',12,50],['CM',38,44],['CM',62,44],['RW',88,50],['AM',50,66],['ST',50,82]],
 '3-5-2':[['GK',50,4],['CB',26,18],['CB',50,16],['CB',74,18],['LB',8,46],['DM',50,36],['CM',32,52],['CM',68,52],['RB',92,46],['ST',38,80],['ST',62,80]],
 '3-4-3':[['GK',50,4],['CB',26,18],['CB',50,16],['CB',74,18],['LB',10,46],['CM',38,44],['CM',62,44],['RB',90,46],['LW',18,74],['ST',50,82],['RW',82,74]],
 '5-3-2':[['GK',50,4],['LB',8,30],['CB',30,18],['CB',50,16],['CB',70,18],['RB',92,30],['CM',30,48],['DM',50,40],['CM',70,48],['ST',38,78],['ST',62,78]],
};
const ROLES={
 GK:[['gk','Goalkeeper','Stays on his line and keeps distribution safe.'],['sweeper','Sweeper keeper','Starts higher to sweep up balls in behind and joins short build-up.']],
 CB:[['cb','Centre-back','Holds the line and defends the box.'],['stopper','Stopper','Steps out aggressively to engage forwards dropping in.'],['distributor','Distributor','Looks for progressive passes into midfield and beyond.']],
 LB:[['fb','Full-back','Balanced: supports attacks without leaving the back line exposed.'],['overlap','Overlapping full-back','Bombs on outside the winger and crosses from the byline.'],['inverted','Inverted full-back','Tucks into midfield in possession to add an extra passer.']],
 RB:[['fb','Full-back','Balanced: supports attacks without leaving the back line exposed.'],['overlap','Overlapping full-back','Bombs on outside the winger and crosses from the byline.'],['inverted','Inverted full-back','Tucks into midfield in possession to add an extra passer.']],
 DM:[['anchor','Anchor','Screens the back line and rarely leaves his zone.'],['deep','Deep playmaker','Drops in to receive and sets the tempo with forward passes.'],['winner','Ball-winner','Hunts the ball and presses the opposition midfield.']],
 CM:[['b2b','Box-to-box','Covers ground both ways and arrives late in the box.'],['playmaker','Playmaker','Takes risks to unlock the defence with through balls.'],['winner','Ball-winner','Presses hard and breaks up play.']],
 AM:[['am','Attacking midfielder','Links midfield and attack and shoots from distance.'],['playmaker','Playmaker','Finds pockets of space and creates chances.'],['shadow','Shadow striker','Runs beyond the striker into the box.']],
 LW:[['winger','Winger','Hugs the touchline, beats his man and crosses.'],['inside','Inside forward','Cuts inside onto his stronger foot to shoot.'],['widepm','Wide playmaker','Drifts inside to create rather than cross.']],
 RW:[['winger','Winger','Hugs the touchline, beats his man and crosses.'],['inside','Inside forward','Cuts inside onto his stronger foot to shoot.'],['widepm','Wide playmaker','Drifts inside to create rather than cross.']],
 ST:[['striker','Complete forward','Does a bit of everything: holds up, links play and finishes.'],['poacher','Poacher','Lives on the shoulder of the last defender and gets in the box.'],['target','Target forward','Wins aerial duels and holds the ball up.'],['presser','Pressing forward','Leads the press and harries defenders.'],['false9','False nine','Drops deep to pull centre-backs out and create.']],
};
// inD: extra depth in possession (m), outD: out of possession, wide/inward lateral (m), press: pressing eagerness 0..1,
// shoot/dribble/cross/risk: decision multipliers, run: tendency to run in behind, prog: progressive-pass preference
const ROLE_FX={
 gk:{},sweeper:{inD:5,risk:1.1},
 cb:{},stopper:{press:.5,outD:3},distributor:{risk:1.3,prog:1.3},
 fb:{inD:6},overlap:{inD:22,wide:6,cross:1.5,run:.15},inverted:{inD:9,inward:18,risk:1.1},
 anchor:{inD:-4,outD:-3,press:.15},deep:{inD:-3,risk:1.35,prog:1.35},winner:{press:.95,tackle:1.15},
 b2b:{inD:9,run:.12,shoot:1.15},playmaker:{risk:1.45,prog:1.35,dribble:1.1},
 am:{shoot:1.25},shadow:{inD:10,run:.35,shoot:1.4},
 winger:{wide:6,cross:1.6,dribble:1.35},inside:{inward:12,inD:4,shoot:1.6,dribble:1.3,run:.2},widepm:{inward:10,inD:-4,risk:1.3,prog:1.25},
 striker:{shoot:1.2,run:.2},poacher:{inD:3,shoot:1.6,run:.45,press:.2},target:{head:1.3,inD:1},presser:{press:1,run:.2},false9:{inD:-14,risk:1.3,prog:1.25,dribble:1.2,shoot:.85},
};
const roleName=(pos,id)=>{const r=(ROLES[pos]||[]).find(x=>x[0]===id);return r?r[1]:id};
const INSTR=[
 ['ment','Mentality',['Very defensive','Defensive','Balanced','Attacking','Very attacking'],2,'in'],
 ['passing','Passing',['Short','Mixed','Direct'],1,'in'],
 ['tempo','Tempo',['Patient','Normal','High'],1,'in'],
 ['width','Width',['Narrow','Normal','Wide'],1,'in'],
 ['final','Final third',['Work it in','Mixed','Shoot on sight','Cross early'],1,'in'],
 ['line','Defensive line',['Deep','Standard','High'],1,'out'],
 ['press','Pressing',['Low block','Mid block','High press'],1,'out'],
 ['tackle','Tackling',['Stay on feet','Normal','Get stuck in'],1,'out'],
 ['onWin','When we win the ball',['Counter-attack','Mixed','Keep possession'],1,'tr'],
 ['onLose','When we lose the ball',['Counter-press','Mixed','Regroup'],1,'tr'],
];
const defaultIns=()=>Object.fromEntries(INSTR.map(i=>[i[0],i[3]]));
const defaultRoles=form=>FORMATIONS[form].map(([pos])=>ROLES[pos][0][0]);
function newTactic(form){return{form,formIn:form,roles:defaultRoles(form),ins:defaultIns(),xi:[],bench:[]}}
// Matches each out-of-possession slot to its in-possession slot (greedy nearest, goalkeeper fixed).
function shapeMap(formOut,formIn){
 const A=FORMATIONS[formOut],B=FORMATIONS[formIn||formOut],map=Array(11).fill(-1),used=new Set([0]);map[0]=0;
 const pairs=[];for(let i=1;i<11;i++)for(let j=1;j<11;j++)pairs.push([Math.hypot(A[i][1]-B[j][1],(A[i][2]-B[j][2])*1.3),i,j]);
 pairs.sort((a,b)=>a[0]-b[0]);for(const[,i,j]of pairs){if(map[i]<0&&!used.has(j)){map[i]=j;used.add(j)}}
 return map;
}
const PRI={GK:0,ST:1,CB:2,LW:3,RW:3,AM:4,LB:5,RB:5,DM:6,CM:7};
function pickXI(cid,form,avoidTired=true){
 const slots=FORMATIONS[form],pool=S.clubs[cid].squad.map(id=>S.players[id]).filter(p=>!p.inj),used=new Set(),xi=Array(11).fill(null);
 const score=(p,pos)=>rateAt(p,pos)*(avoidTired?(.75+.25*p.cond/100):1);
 const order=slots.map((_,i)=>i).sort((a,b)=>PRI[slots[a][0]]-PRI[slots[b][0]]);
 for(const i of order){const pos=slots[i][0];let best=null,bv=-1;for(const p of pool){if(used.has(p.id))continue;const v=score(p,pos);if(v>bv){bv=v;best=p}}if(best){xi[i]=best.id;used.add(best.id)}}
 return xi;
}
function pickBench(cid,xi){
 const inXI=new Set(xi),pool=S.clubs[cid].squad.map(id=>S.players[id]).filter(p=>!inXI.has(p.id)&&!p.inj).sort((a,b)=>b.ovr-a.ovr);
 const gk=pool.find(p=>p.pos==='GK'),rest=pool.filter(p=>p!==gk);
 return(gk?[gk.id]:[]).concat(rest.slice(0,6).map(p=>p.id));
}
function ensureLineup(cid){
 const c=S.clubs[cid],t=c.tac,sq=new Set(c.squad),slots=FORMATIONS[t.form],used=new Set();
 if(!t.roles||t.roles.length!==11)t.roles=defaultRoles(t.form);
 t.xi=slots.map((_,i)=>{const id=t.xi&&t.xi[i];if(id!=null&&sq.has(id)&&!used.has(id)&&!S.players[id].inj){used.add(id);return id}return null});
 slots.forEach(([pos],i)=>{if(t.xi[i]==null){const best=c.squad.map(id=>S.players[id]).filter(p=>!used.has(p.id)&&!p.inj).sort((a,b)=>rateAt(b,pos)-rateAt(a,pos))[0];if(best){t.xi[i]=best.id;used.add(best.id)}}});
 const okBench=(t.bench||[]).filter(id=>sq.has(id)&&!used.has(id)&&!S.players[id].inj);
 t.bench=okBench.length>=5?okBench.slice(0,7):pickBench(cid,t.xi);
}
// Team strength for the quick simulator: attack, midfield, defence from the XI at their slots.
const ATT_W={ST:1,LW:.85,RW:.85,AM:.7,CM:.25,LB:.1,RB:.1},MID_W={CM:1,DM:.85,AM:.85,LW:.3,RW:.3,LB:.15,RB:.15},DEF_W={GK:1.3,CB:1,LB:.75,RB:.75,DM:.6,CM:.15};
function strength(xi,form){
 const a=[0,0],m=[0,0],d=[0,0];
 FORMATIONS[form].forEach(([pos],i)=>{const p=S.players[xi[i]],e=p?rateAt(p,pos)*(.82+.18*p.cond/100):35;
  const add=(acc,w)=>{if(w){acc[0]+=e*w;acc[1]+=w}};add(a,ATT_W[pos]);add(m,MID_W[pos]);add(d,DEF_W[pos])});
 return{att:a[0]/a[1],mid:m[0]/m[1],def:d[0]/d[1]};
}
const PITCH_SVG=`<svg viewBox="0 0 68 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".4"><rect x="2" y="2" width="64" height="96"/><path d="M2,50 H66"/><circle cx="34" cy="50" r="8.5"/><rect x="15" y="2" width="38" height="15"/><rect x="25" y="2" width="18" height="5.5"/><rect x="15" y="83" width="38" height="15"/><rect x="25" y="92.5" width="18" height="5.5"/><path d="M27,17 A8,8 0 0,0 41,17 M27,83 A8,8 0 0,1 41,83"/></g></svg>`;
