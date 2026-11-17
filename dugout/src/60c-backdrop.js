/* ================= page backdrops =================
   Each section gets its own faded scene behind the page header, tinted with the club's colour: the stadium
   bowl (home), the dressing room with the squad's shirts hanging up (squad), a chalk tactics board,
   the signing-day sponsor wall (transfers), the league trophy (competitions), the city from the boardroom
   (office) and the stadium's front (club). Pure SVG, no faces, cached per club and section. */
const BD={key:null};
const bdRng=seed=>{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
const BD_SCENE={home:'stadium',squad:'lockers',player:'lockers',tactics:'board',transfers:'wall',comps:'trophy',office:'skyline',club:'facade'};
const nest=(svg,x,y,w,h)=>svg.replace(/^<svg /,`<svg x="${x}" y="${y}" width="${w}" height="${h}" `).replace(/ class="[^"]*"/,'').replace(/ style="[^"]*"/,'');
// Crowd texture: a few pattern tiles of coloured specks, so a whole stand costs a handful of elements.
function crowdDefs(R,tc,n=3){
 const cols=[tc,mix(tc,'#ffffff',.45),mix(tc,'#000',.35),'#2c2c33','#3a3a42','#d8d5cc'];let s='';
 for(let k=0;k<n;k++){let d='';for(let i=0;i<46;i++){const x=R()*140,y=R()*16,c=cols[(R()*cols.length)|0];d+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="3.4" height="4.6" rx="1.2" fill="${c}" opacity="${(.45+R()*.55).toFixed(2)}"/>`}
  s+=`<pattern id="bdcr${k}" width="140" height="16" patternUnits="userSpaceOnUse">${d}</pattern>`}
 return s;
}
function bdStadium(c,tc,R){
 let s=`<defs><linearGradient id="bdsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(tc,'#05060a',.78)}"/><stop offset="1" stop-color="#07080b"/></linearGradient>
 <radialGradient id="bdglow"><stop offset="0" stop-color="#fffbe8" stop-opacity=".95"/><stop offset=".25" stop-color="#fff3c4" stop-opacity=".35"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></radialGradient>${crowdDefs(R,tc)}</defs>
 <rect width="1600" height="700" fill="url(#bdsky)"/>`;
 // roof and its truss
 s+=`<path d="M0,40 L1600,40 L1600,92 L0,92 Z" fill="#0d0e12"/>`;for(let x=0;x<1600;x+=40)s+=`<path d="M${x},40 L${x+20},92 L${x+40},40" stroke="#22242b" stroke-width="2" fill="none"/>`;
 // three tiers, each slightly narrower toward the pitch
 [[96,250,0],[262,380,1],[392,470,2]].forEach(([y0,y1,k])=>{s+=`<rect x="0" y="${y0}" width="1600" height="${y1-y0}" fill="#121318"/><rect x="0" y="${y0}" width="1600" height="${y1-y0}" fill="url(#bdcr${k})"/><rect x="0" y="${y1-6}" width="1600" height="6" fill="${mix(tc,'#000',.45)}"/>`});
 // aisles and the tier fascias in club colour
 for(let x=90;x<1600;x+=230)s+=`<rect x="${x}" y="96" width="9" height="374" fill="#0b0c10" opacity=".85"/>`;
 s+=`<rect x="0" y="250" width="1600" height="12" fill="${tc}" opacity=".85"/><text x="800" y="260" text-anchor="middle" ${FONT} font-weight="800" font-size="11" letter-spacing="14" fill="${ink(tc)}" opacity=".85">${esc(c.stadium.toUpperCase())}</text>`;
 // floodlight banks with glow
 for(const x of [160,560,1040,1440]){s+=`<rect x="${x-46}" y="6" width="92" height="30" rx="3" fill="#1b1c22"/>`;for(let i=0;i<4;i++)for(let j=0;j<2;j++)s+=`<rect x="${x-40+i*21}" y="${10+j*12}" width="17" height="9" rx="2" fill="#fffbe8"/>`;s+=`<circle cx="${x}" cy="21" r="170" fill="url(#bdglow)"/>`}
 // LED boards and the pitch
 s+=`<rect x="0" y="470" width="1600" height="30" fill="#0a0a0d"/>`;for(let x=0;x<1600;x+=400)s+=`<rect x="${x+4}" y="474" width="392" height="22" fill="${x/400%2?mix(tc,'#000',.2):'#15161b'}"/><text x="${x+200}" y="490" text-anchor="middle" ${FONT} font-weight="800" font-size="16" letter-spacing="4" fill="${x/400%2?ink(tc):tc}">${esc(x/400%2?c.sponsor:c.short.toUpperCase())}</text>`;
 s+=`<path d="M0,500 H1600 V700 H0 Z" fill="#163a22"/>`;for(let k=0;k<8;k++)s+=`<path d="M${k*200},500 H${k*200+100} L${k*230-60},700 H${k*230-175} Z" fill="#1a4428"/>`;
 s+=`<path d="M0,540 H1600" stroke="#e8f0e8" stroke-opacity=".5" stroke-width="3"/>`;
 return s;
}
function bdLockers(c,tc){
 const sq=squadOf(c.id).slice().sort((a,b)=>a.num-b.num).filter((_,i)=>i%3===0).slice(0,9);
 let s=`<defs><linearGradient id="bdwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(tc,'#08090c',.82)}"/><stop offset="1" stop-color="#0a0b0e"/></linearGradient>
 <radialGradient id="bdspot" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#fff6dc" stop-opacity=".22"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="700" fill="url(#bdwall)"/>`;
 const W=1600/9;
 sq.forEach((p,i)=>{const x=i*W;
  s+=`<rect x="${x+8}" y="40" width="${W-16}" height="560" rx="4" fill="#121319" stroke="#1f2028"/><rect x="${x+8}" y="40" width="${W-16}" height="560" fill="url(#bdspot)"/>`;
  s+=`<rect x="${x+8}" y="40" width="${W-16}" height="34" fill="${mix(tc,'#000',.3)}"/><text x="${x+W/2}" y="64" text-anchor="middle" ${FONT} font-weight="800" font-size="18" letter-spacing="3" fill="${ink(mix(tc,'#000',.3))}">${esc(p.ln.toUpperCase().slice(0,11))}</text>`;
  s+=`<path d="M${x+W/2-34},104 H${x+W/2+34}" stroke="#5a5c66" stroke-width="4" stroke-linecap="round"/>`;
  s+=nest(kitSVG(c,'home',{back:true,name:p.ln,num:p.num}),x+W/2-70,100,140,148);
  s+=`<rect x="${x+22}" y="440" width="${W-44}" height="12" rx="2" fill="#191a21"/><rect x="${x+22}" y="520" width="${W-44}" height="64" rx="3" fill="#0e0f13"/>`;
  // boots on the shelf, as simple shapes
  s+=`<path d="M${x+W/2-40},440 q4,-16 18,-16 h14 q6,0 8,8 l2,8 z M${x+W/2+4},440 q4,-16 18,-16 h14 q6,0 8,8 l2,8 z" fill="${mix(tc,'#111',.55)}"/>`;
 });
 s+=`<rect x="0" y="600" width="1600" height="100" fill="#0c0c10"/><rect x="0" y="600" width="1600" height="18" fill="#2a2016"/><rect x="0" y="618" width="1600" height="4" fill="#000" opacity=".5"/>`;
 return s;
}
function bdBoard(c,tc){
 const F=FORMATIONS[c.tac.form]||FORMATIONS['4-3-3'],P=(x,y)=>{const t=y/100,hw=760-t*380;return[800+(x-50)/50*hw,640-t*540]};
 let s=`<defs><radialGradient id="bdbd" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${mix(tc,'#0e2018',.7)}"/><stop offset="1" stop-color="#07090a"/></radialGradient></defs><rect width="1600" height="700" fill="url(#bdbd)"/>`;
 const L='stroke="#e9efe7" stroke-opacity=".38" fill="none" stroke-width="3"';
 const c4=[P(0,0),P(100,0),P(100,100),P(0,100)];s+=`<polygon points="${c4.map(p=>p.join(',')).join(' ')}" ${L}/>`;
 const mid=[P(0,50),P(100,50)];s+=`<path d="M${mid[0]} L${mid[1]}" ${L}/><ellipse cx="${P(50,50)[0]}" cy="${P(50,50)[1]}" rx="120" ry="44" ${L}/>`;
 for(const y0 of [0,100]){const d=y0?-1:1,b=[P(20,y0),P(20,y0+16*d),P(80,y0+16*d),P(80,y0)];s+=`<path d="M${b.join(' L')}" ${L}/>`}
 // chalk markers and arrows: circles for our shape, crosses for the opposition
 F.forEach(([pos,x,y],i)=>{const[px,py]=P(x,y*.55+4),r=13+y*.05;s+=`<circle cx="${px}" cy="${py}" r="${r}" stroke="${mix(tc,'#ffffff',.5)}" stroke-width="3.5" fill="none" opacity=".75"/>`;
  if(i>5){const[qx,qy]=P(x+(x<50?10:x>50?-10:0),y*.55+26);s+=`<path d="M${px},${py-r-4} Q${(px+qx)/2+30},${(py+qy)/2} ${qx},${qy}" stroke="#f0f0e8" stroke-opacity=".55" stroke-width="2.6" stroke-dasharray="10 8" fill="none"/><path d="M${qx-9},${qy+10} L${qx},${qy} L${qx+10},${qy+8}" stroke="#f0f0e8" stroke-opacity=".55" stroke-width="2.6" fill="none"/>`}});
 F.forEach(([pos,x,y])=>{const[px,py]=P(100-x,100-y*.42-4);s+=`<path d="M${px-9},${py-9} L${px+9},${py+9} M${px+9},${py-9} L${px-9},${py+9}" stroke="#f0c8c0" stroke-opacity=".5" stroke-width="3"/>`});
 s+=`<text x="1530" y="80" text-anchor="end" ${FONT} font-weight="800" font-size="64" fill="#e9efe7" opacity=".14" letter-spacing="6">${esc(c.tac.form)}</text>`;
 return s;
}
function bdWall(c,tc){
 const cr=crestSVG(c,{x:0,y:0,w:64}).replace(/^<svg /,'<svg id="bdcrest" ');
 let s=`<defs>${cr}<radialGradient id="bdsp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
 <rect width="1600" height="700" fill="${mix(tc,'#0a0b0e',.72)}"/>`;
 for(let r=0;r<8;r++)for(let k=0;k<9;k++){const x=k*200+(r%2?100:0)-40,y=r*92+10;
  s+=(r+k)%2?`<use href="#bdcrest" x="${x+64}" y="${y}" opacity=".55"/>`:`<text x="${x+96}" y="${y+50}" text-anchor="middle" ${FONT} font-weight="800" font-size="22" letter-spacing="3" fill="${mix(tc,'#ffffff',.55)}" opacity=".5">${esc(c.sponsor)}</text>`}
 // spotlights and camera flashes
 s+=`<ellipse cx="560" cy="300" rx="420" ry="300" fill="url(#bdsp)"/><ellipse cx="1150" cy="260" rx="360" ry="280" fill="url(#bdsp)"/>`;
 for(const[x,y,r]of[[300,160,40],[1320,420,28],[880,110,22]])s+=`<circle cx="${x}" cy="${y}" r="${r*3}" fill="url(#bdsp)"/><path d="M${x-r},${y} H${x+r} M${x},${y-r} V${y+r}" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`;
 // the signing table edge
 s+=`<rect x="0" y="560" width="1600" height="140" fill="#0b0b0e"/><rect x="0" y="560" width="1600" height="6" fill="${tc}" opacity=".8"/>`;
 return s;
}
function bdTrophy(c,tc,R){
 const info=trophyInfo({key:'lg:'+c.league});
 let s=`<defs><radialGradient id="bdtg" cx=".7" cy=".45" r=".6"><stop offset="0" stop-color="${mix(info.c1,'#000',.35)}"/><stop offset="1" stop-color="#07080a"/></radialGradient></defs><rect width="1600" height="700" fill="url(#bdtg)"/>`;
 for(let k=0;k<14;k++){const a=-Math.PI/2+(k-6.5)*.17;s+=`<polygon points="1160,320 ${1160+Math.cos(a-.035)*1100},${320+Math.sin(a-.035)*1100} ${1160+Math.cos(a+.035)*1100},${320+Math.sin(a+.035)*1100}" fill="#fff" opacity="${k%2?.035:.06}"/>`}
 for(let i=0;i<70;i++){const x=R()*1600,y=R()*560,col=[info.c1,info.c2,'#f2d16b','#ffffff'][i%4];s+=`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(4+R()*7).toFixed(1)}" height="${(9+R()*10).toFixed(1)}" fill="${col}" opacity="${(.25+R()*.4).toFixed(2)}" transform="rotate(${(R()*180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`}
 s+=nest(trophySVG(info,300),1010,70,300,375);
 s+=`<ellipse cx="1160" cy="456" rx="210" ry="22" fill="#000" opacity=".5"/>`;
 return s;
}
function bdSkyline(c,tc,R){
 let s=`<defs><linearGradient id="bddusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07080d"/><stop offset=".7" stop-color="${mix(tc,'#141018',.7)}"/><stop offset="1" stop-color="${mix(tc,'#3a2418',.55)}"/></linearGradient>
 <pattern id="bdwin" width="16" height="20" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="8" height="10" fill="#ffe7a8" opacity=".55"/></pattern>
 <pattern id="bdwin2" width="16" height="20" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="8" height="10" fill="#ffe7a8" opacity=".18"/></pattern></defs><rect width="1600" height="700" fill="url(#bddusk)"/>`;
 let x=0;while(x<1600){const w=60+R()*120,h=140+R()*360,y=640-h;s+=`<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#0d0e13"/><rect x="${(x+6).toFixed(0)}" y="${(y+10).toFixed(0)}" width="${(w-12).toFixed(0)}" height="${(h-10).toFixed(0)}" fill="url(#bdwin${R()<.45?'':'2'})"/>`;if(R()<.25)s+=`<rect x="${(x+w/2-1).toFixed(0)}" y="${(y-40).toFixed(0)}" width="2" height="40" fill="#1a1b22"/><circle cx="${(x+w/2).toFixed(0)}" cy="${(y-40).toFixed(0)}" r="3" fill="#ff5050" opacity=".8"/>`;x+=w+4+R()*14}
 // looking out through the boardroom glass
 s+=`<rect x="0" y="0" width="1600" height="700" fill="none" stroke="#050507" stroke-width="28"/>`;for(const mx of [400,800,1200])s+=`<rect x="${mx-7}" y="0" width="14" height="700" fill="#050507"/>`;
 s+=`<rect x="0" y="640" width="1600" height="60" fill="#09090c"/><rect x="0" y="640" width="1600" height="3" fill="${tc}" opacity=".6"/>`;
 return s;
}
function bdFacade(c,tc){
 let s=`<defs><linearGradient id="bdfa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(tc,'#090a0e',.8)}"/><stop offset="1" stop-color="#0a0a0d"/></linearGradient></defs><rect width="1600" height="700" fill="url(#bdfa)"/>`;
 s+=`<rect x="0" y="150" width="1600" height="470" fill="#121318"/>`;
 for(let k=0;k<16;k++){const x=k*100+10;s+=`<path d="M${x},620 V420 Q${x+40},360 ${x+80},420 V620 Z" fill="#0a0b0f"/><path d="M${x},420 Q${x+40},360 ${x+80},420" stroke="${tc}" stroke-opacity=".5" stroke-width="3" fill="none"/>`}
 for(let k=0;k<32;k++)s+=`<rect x="${k*50+14}" y="190" width="22" height="150" fill="#181a21"/>`;
 s+=`<rect x="0" y="150" width="1600" height="18" fill="${tc}" opacity=".8"/>`;
 s+=crestSVG(c,{x:725,y:-4,w:150});
 s+=`<text x="800" y="388" text-anchor="middle" ${FONT} font-weight="800" font-size="46" letter-spacing="16" fill="#e9e6dc" opacity=".5">${esc(c.stadium.toUpperCase())}</text>`;
 return s;
}
function backdropSVG(scene,c){
 const tc=c.colors[0]==='#ffffff'?c.colors[1]:c.colors[0],R=bdRng(strHash(c.name+scene));
 const body={stadium:bdStadium,lockers:bdLockers,board:bdBoard,wall:bdWall,trophy:bdTrophy,skyline:bdSkyline,facade:bdFacade}[scene](c,tc,R);
 return`<svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${body}</svg>`;
}
// Called on every render; only rebuilds when the section, club or squad shape changes.
function setBackdrop(){
 let el=document.getElementById('pgbg');
 if(!S||view==='match'){if(el)el.hidden=true;return}
 if(!el){el=document.createElement('div');el.id='pgbg';document.body.prepend(el)}
 const scene=BD_SCENE[view]||'stadium',c=clubOf(S.user),key=`${scene}|${c.id}|${scene==='lockers'?c.squad.length+'.'+c.squad[0]:''}|${scene==='board'?c.tac.form:''}`;
 el.hidden=false;if(BD.key===key)return;BD.key=key;
 el.dataset.scene=scene;el.innerHTML=backdropSVG(scene,c);
}
