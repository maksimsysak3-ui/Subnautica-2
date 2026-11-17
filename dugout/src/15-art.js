/* ================= SVG: flags ================= */
function flagSVG(code){
 const N=NATIONS[code],f=N.f;let s='';
 const V=(a,b,c)=>`<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
 const H=(a,b,c)=>`<rect width="30" height="6.7" fill="${a}"/><rect y="6.6" width="30" height="6.8" fill="${b}"/><rect y="13.3" width="30" height="6.7" fill="${c}"/>`;
 switch(f[0]){
  case'v':s=V(f[1],f[2],f[3]);break;
  case'v2':s=`<rect width="12" height="20" fill="${f[1]}"/><rect x="12" width="18" height="20" fill="${f[2]}"/>`;break;
  case'h':s=H(f[1],f[2],f[3]);break;
  case'h2':s=`<rect width="30" height="10" fill="${f[1]}"/><rect y="10" width="30" height="10" fill="${f[2]}"/>`;break;
  case'h3':s=`<rect width="30" height="20" fill="${f[2]}"/><rect width="30" height="5" fill="${f[1]}"/><rect y="15" width="30" height="5" fill="${f[3]}"/>`;break;
  case'col':s=`<rect width="30" height="10" fill="${f[1]}"/><rect y="10" width="30" height="5" fill="${f[2]}"/><rect y="15" width="30" height="5" fill="${f[3]}"/>`;break;
  case'cross':s=`<rect width="30" height="20" fill="${f[1]}"/><rect x="13" width="4" height="20" fill="${f[2]}"/><rect y="8" width="30" height="4" fill="${f[2]}"/>`;break;
  case'saltire':s=`<rect width="30" height="20" fill="${f[1]}"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="${f[2]}" stroke-width="3.6"/>`;break;
  case'nordic':s=`<rect width="30" height="20" fill="${f[1]}"/><rect x="9" width="4" height="20" fill="${f[2]}"/><rect y="8" width="30" height="4" fill="${f[2]}"/>`;break;
  case'nordic2':s=`<rect width="30" height="20" fill="${f[1]}"/><rect x="8.4" width="5.2" height="20" fill="${f[2]}"/><rect y="7.4" width="30" height="5.2" fill="${f[2]}"/><rect x="9.8" width="2.4" height="20" fill="${f[3]}"/><rect y="8.8" width="30" height="2.4" fill="${f[3]}"/>`;break;
  case'brazil':s=`<rect width="30" height="20" fill="${f[1]}"/><polygon points="15,2.2 27.5,10 15,17.8 2.5,10" fill="${f[2]}"/><circle cx="15" cy="10" r="4.4" fill="${f[3]}"/>`;break;
  case'disc':s=`<rect width="30" height="20" fill="${f[1]}"/><circle cx="15" cy="10" r="6" fill="${f[2]}"/>`;break;
  case'hstar':s=H(f[1],f[2],f[3])+`<polygon points="${starPts(15,10.4,3.4,1.4)}" fill="#111"/>`;break;
  case'vstar':s=V(f[1],f[2],f[3])+`<polygon points="${starPts(15,10.4,3.4,1.4)}" fill="${f[1]}"/>`;break;
 }
 return`<svg class="flag" viewBox="0 0 30 20" role="img" aria-label="${esc(N.n)}">${s}</svg>`;
}

/* ================= SVG: crests ================= */
const SHAPES={
 heater:'M10,8 H90 V52 C90,82 72,101 50,113 C28,101 10,82 10,52 Z',
 rounded:'M10,16 Q10,8 18,8 H82 Q90,8 90,16 V58 C90,86 70,103 50,113 C30,103 10,86 10,58 Z',
 pointed:'M50,5 L91,17 V56 C91,84 72,102 50,114 C28,102 9,84 9,56 V17 Z',
 hex:'M50,5 L92,28 V88 L50,114 L8,88 V28 Z',
 castle:'M10,24 H19 V11 H31 V24 H43 V11 H57 V24 H69 V11 H81 V24 H90 V60 C90,88 70,104 50,114 C30,104 10,88 10,60 Z',
 oval:'M50,6 C79,6 92,30 92,60 C92,92 74,114 50,114 C26,114 8,92 8,60 C8,30 21,6 50,6 Z',
 diamond:'M50,4 L94,58 L50,116 L6,58 Z',
 badge:'M23,8 H77 Q92,8 92,23 V82 Q92,103 50,114 Q8,103 8,82 V23 Q8,8 23,8 Z',
 scallop:'M8,22 Q29,4 50,20 Q71,4 92,22 V60 C92,88 72,104 50,114 C28,104 8,88 8,60 Z',
 tall:'M17,5 H83 V66 C83,92 66,107 50,115 C34,107 17,92 17,66 Z',
 pennant:'M10,8 H90 V78 L50,114 L10,78 Z',
};
const EMB={
 star:{f:'M'+starPts(20,21.5,19,7.8).replace(/ /g,' L')+' Z'},
 crown:{f:'M4,31 L6,12 L13,20 L20,7 L27,20 L34,12 L36,31 Z M5,33 H35 V37 H5 Z'},
 bolt:{f:'M24,2 L8,23 H18 L14,38 L32,15 H22 L27,2 Z'},
 anchor:{s:'M20,10 V35 M12,16 H28 M6,25 Q8,35 20,35 Q32,35 34,25',x:'<circle cx="20" cy="6.5" r="3.6" fill="none" stroke="C" stroke-width="3"/>'},
 tower:{f:'M8,38 V13 H12 V7 H16 V13 H18 V7 H22 V13 H24 V7 H28 V13 H32 V38 H24 V29 Q20,23 16,29 V38 Z'},
 wave:{s:'M3,13 Q8.5,6 14,13 T25,13 T36,13 M3,22 Q8.5,15 14,22 T25,22 T36,22 M3,31 Q8.5,24 14,31 T25,31 T36,31'},
 tree:{f:'M20,3 C29,3 35,10 33,18 C38,24 33,31 25,30 H22 V38 H18 V30 H15 C7,31 2,24 7,18 C5,10 11,3 20,3 Z'},
 key:{s:'M13,11 A7,7 0 1,0 27,11 A7,7 0 1,0 13,11 M20,18 V37 M20,28 H27 M20,34 H25'},
 bird:{f:'M2,13 C10,12 16,16 20,22 C23,14 30,8 38,6 C33,12 31,18 31,24 C27,29 21,31 15,33 L5,38 L10,30 C6,25 4,19 2,13 Z'},
 hammer:{f:'M6,6 H27 Q32,6 32,11 V14 Q32,17 29,17 H6 Z M16.5,17 H21.5 V38 H16.5 Z'},
 flame:{f:'M20,2 C24,10 32,14 32,24 C32,32 26,38 20,38 C14,38 8,32 8,24 C8,18 12,14 14,10 C15,16 18,18 19,18 C17,12 18,6 20,2 Z'},
 mountain:{f:'M2,36 L15,12 L21,22 L27,14 L38,36 Z M15,12 L18,18 L12,18 Z'},
 ship:{f:'M5,26 H35 L30,34 H10 Z M19,4 V25 H21 V4 Z M21,6 L33,22 H21 Z M19,9 L9,22 H19 Z'},
 sun:{s:'M20,13 A7,7 0 1,0 20.01,13 M20,2 V7 M20,33 V38 M2,20 H7 M33,20 H38 M7.3,7.3 L10.8,10.8 M29.2,29.2 L32.7,32.7 M7.3,32.7 L10.8,29.2 M29.2,10.8 L32.7,7.3'},
 swords:{s:'M7,5 L33,33 M33,5 L7,33 M5,12 L12,5 M28,5 L35,12 M7,29 L11,33 M29,33 L33,29'},
 wheel:{s:'M20,4 A16,16 0 1,0 20.01,4 M20,13 A7,7 0 1,0 20.01,13 M20,4 V13 M20,27 V36 M4,20 H13 M27,20 H36 M8.7,8.7 L15,15 M25,25 L31.3,31.3 M8.7,31.3 L15,25 M25,15 L31.3,8.7'},
 rose:{f:'M20,6 C25,6 30,10 29,15 C34,15 36,21 32,24 C35,28 31,34 26,32 C25,37 15,37 14,32 C9,34 5,28 8,24 C4,21 6,15 11,15 C10,10 15,6 20,6 Z M20,15 A5,5 0 1,0 20.01,15'},
 horseshoe:{s:'M9,36 V18 A11,11 0 0,1 31,18 V36 M6,36 H12 M28,36 H34'},
};
function emblemSVG(n,cx,cy,size,col){
 const sc=size/40,o=(dx,dy)=>`transform="translate(${(cx-size/2+dx).toFixed(2)} ${(cy-size/2+dy).toFixed(2)}) scale(${sc.toFixed(3)})"`;
 if(n==='ball'){
  const spokes=[0,1,2,3,4].map(i=>{const a=(-90+i*72)*Math.PI/180;return`M${20+Math.cos(a)*6.5},${20+Math.sin(a)*6.5} L${20+Math.cos(a)*16},${20+Math.sin(a)*16}`}).join(' ');
  return`<g ${o(1,1.5)} opacity=".3"><circle cx="20" cy="20" r="17" fill="#000"/></g><g ${o(0,0)}><circle cx="20" cy="20" r="17" fill="#fff" stroke="#111" stroke-width="1.6"/><polygon points="${polyPts(20,20,6.8,5)}" fill="#111"/><path d="${spokes}" stroke="#111" stroke-width="1.4"/></g>`;
 }
 const e=EMB[n],body=c=>e.f?`<path d="${e.f}" fill="${c}"/>`:`<path d="${e.s}" fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`+(e.x?e.x.replace('"C"',`"${c}"`):'');
 return`<g ${o(1.1,1.6)} opacity=".32">${body('#000')}</g><g ${o(0,0)}>${body(col)}</g>`;
}
function divisionSVG(div,col,c1,c){
 switch(div){
  case'fess':return`<rect x="0" y="0" width="100" height="56" fill="${col}"/>`;
  case'saltire':return`<path d="M0,0 L100,120 M100,0 L0,120" stroke="${col}" stroke-width="16"/>`;
  case'cross':return`<rect x="41" y="0" width="18" height="120" fill="${col}"/><rect x="0" y="44" width="100" height="18" fill="${col}"/>`;
  case'pile':return`<polygon points="18,0 82,0 50,96" fill="${col}"/>`;
  case'hoops':{let s='';for(let y=18;y<120;y+=22)s+=`<rect x="0" y="${y}" width="100" height="11" fill="${col}"/>`;return s}
  case'chequy':{let s='';for(let y=0;y<120;y+=15)for(let x=(y/15)%2?15:0;x<100;x+=30)s+=`<rect x="${x}" y="${y}" width="15" height="15" fill="${col}"/>`;return s}
  case'wavy':return`<path d="M0,64 Q12.5,54 25,64 T50,64 T75,64 T100,64 V120 H0 Z" fill="${col}"/><path d="M0,84 Q12.5,74 25,84 T50,84 T75,84 T100,84" fill="none" stroke="${c1}" stroke-width="5"/>`;
  case'sun':{let s='';for(let k=0;k<12;k+=2){const a=k/12*Math.PI*2,b=(k+1)/12*Math.PI*2;s+=`<polygon points="50,56 ${50+Math.cos(a)*90},${56+Math.sin(a)*90} ${50+Math.cos(b)*90},${56+Math.sin(b)*90}" fill="${col}"/>`}return s}
  case'bordure':return`<path d="M0,0 H100 V120 H0 Z M16,16 V76 Q16,98 50,106 Q84,98 84,76 V16 Z" fill="${col}" fill-rule="evenodd"/>`;
  case'pale':return`<rect x="50" y="0" width="50" height="120" fill="${col}"/>`;
  case'quarters':return`<rect x="50" y="0" width="50" height="60" fill="${col}"/><rect x="0" y="60" width="50" height="60" fill="${col}"/>`;
  case'bend':return`<polygon points="-10,28 22,-4 112,96 80,128" fill="${col}"/>`;
  case'stripes':{let s='';for(let x=21;x<84;x+=16)s+=`<rect x="${x}" y="0" width="8" height="120" fill="${col}"/>`;return s}
  case'chevron':return`<polygon points="0,86 50,56 100,86 100,100 50,70 0,100" fill="${col}"/>`;
  case'chief':return`<rect x="0" y="0" width="100" height="36" fill="${col}"/><text x="50" y="31" text-anchor="middle" ${FONT} font-weight="800" font-size="13" letter-spacing="2.5" fill="${contrast(col,c1)>2.4?c1:ink(col)}">${c.abbr}</text>`;
  default:return'';
 }
}
function crestSVG(c,o={}){
 const id=uid('c'),[c1,c2,c3]=c.colors,[shape,div,emb]=c.crest,round=shape==='round';
 const em=contrast(c1,c2)>2.4?c2:ink(c1);
 const attrs=o.w?`x="${o.x||0}" y="${o.y||0}" width="${o.w}" height="${(o.w*1.2).toFixed(1)}"`:`class="crest ${o.cls||''}"${o.size?` style="width:${o.size}px;height:${Math.round(o.size*1.2)}px"`:''}`;
 const inner=round?'':SHAPES[shape],sc='transform="translate(50 60) scale(.86) translate(-50 -60)"';
 let s=`<svg ${attrs} viewBox="0 0 100 120" role="img" aria-label="${esc(c.name)} crest"><defs><clipPath id="${id}k">${round?'<circle cx="50" cy="60" r="35"/>':`<path d="${inner}" ${sc}/>`}</clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c1,'#ffffff',.1)}"/><stop offset="1" stop-color="${mix(c1,'#000000',.2)}"/></linearGradient>`;
 if(round)s+=`<path id="${id}t" d="M11.5,60 A38.5,38.5 0 0,1 88.5,60"/><path id="${id}b" d="M8,60 A42,42 0 0,0 92,60"/>`;
 else s+=`<path id="${id}r" d="M15,95.5 Q50,88.5 85,95.5"/>`;
 s+='</defs>';
 if(round){
  s+=`<circle cx="50" cy="61.5" r="48" fill="#000" opacity=".3"/><circle cx="50" cy="60" r="48" fill="${mix(c2,'#000',.3)}"/><circle cx="50" cy="60" r="46.5" fill="${c2}"/><circle cx="50" cy="60" r="44.5" fill="url(#${id}f)"/><circle cx="50" cy="60" r="36.6" fill="${c2}"/>`;
  s+=`<text ${FONT} font-weight="700" font-size="${c.name.length>16?7.2:8.4}" letter-spacing="1.1" fill="${em}"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${esc(c.name.toUpperCase())}</textPath></text>`;
  s+=`<text ${FONT} font-weight="700" font-size="7" letter-spacing="1.6" fill="${em}"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">EST · ${c.est}</textPath></text>`;
  s+=`<polygon points="${starPts(9.6,60,2.6,1.1)}" fill="${em}"/><polygon points="${starPts(90.4,60,2.6,1.1)}" fill="${em}"/>`;
 }else{
  s+=`<path d="${inner}" fill="#000" opacity=".3" transform="translate(0 1.6)"/><path d="${inner}" fill="${c2}"/><path d="${inner}" fill="none" stroke="${mix(c2,'#000',.35)}" stroke-width="1"/><path d="${inner}" fill="url(#${id}f)" ${sc}/>`;
 }
 s+=`<g clip-path="url(#${id}k)">${round?`<rect width="100" height="120" fill="url(#${id}f)"/>`:''}${divisionSVG(div,c2,c1,c)}</g>`;
 if(!round)s+=`<path d="${inner}" fill="none" stroke="${c2}" stroke-opacity=".5" stroke-width="1.2" transform="translate(50 60) scale(.78) translate(-50 -60)"/>`;else s+=`<circle cx="50" cy="60" r="32.5" fill="none" stroke="${c2}" stroke-opacity=".45" stroke-width="1"/>`;
 let ey=round?60:div==='chief'?59:52,es=round?42:div==='chief'?30:36;
 if(['pale','quarters','bend','stripes','chevron','fess','saltire','cross','pile','hoops','chequy','wavy','sun'].includes(div)){s+=`<circle cx="50" cy="${ey}" r="${(es*.6).toFixed(1)}" fill="${c1}" stroke="${c2}" stroke-width="2.4"/>`;es*=.76}
 if(emb==='mono'){const t=(c.abbr||c.short.slice(0,2)).slice(0,emb.length>2&&(c.short.length>8)?2:3).toUpperCase();s+=`<text x="50" y="${(ey+es*.2).toFixed(1)}" text-anchor="middle" ${FONT} font-weight="800" font-size="${(es*(t.length>2?.62:.8)).toFixed(1)}" letter-spacing="-.5" fill="${em}">${esc(t)}</text>`}
 else s+=emblemSVG(emb,50,ey,es,em);
 if(!round){
  const bc=contrast(c3,c1)>1.6?c3:c2,bt=ink(bc),dk=mix(bc,'#000',.32),nm=c.short.toUpperCase(),fs=Math.min(10.5,128/nm.length);
  s+=`<path d="M5,92 L17,90 L17,104 L5,106 L9.5,98.5 Z" fill="${dk}"/><path d="M95,92 L83,90 L83,104 L95,106 L90.5,98.5 Z" fill="${dk}"/>`;
  s+=`<path d="M12,87.5 Q50,80.5 88,87.5 L88,101.5 Q50,94.5 12,101.5 Z" fill="${bc}" stroke="${dk}" stroke-width=".8"/>`;
  s+=`<text ${FONT} font-weight="800" font-size="${fs.toFixed(1)}" letter-spacing=".8" fill="${bt}" dy="${(fs*.36).toFixed(1)}"><textPath href="#${id}r" startOffset="50%" text-anchor="middle">${esc(nm)}</textPath></text>`;
  s+=`<path d="${inner}" fill="url(#${id}g)" ${sc} pointer-events="none"/>`;
 }else s+=`<circle cx="50" cy="60" r="44.5" fill="url(#${id}g)"/>`;
 const orn=c.crest[3];
 if(orn&&!round){const sc2=contrast(c3,'#1a1a1a')>3?c3:'#e8c25a';
  if(orn==='stars1'||orn==='stars2'||orn==='stars3'){const n=+orn.slice(-1),xs=n===1?[50]:n===2?[42,58]:[36,50,64];s=s.replace('</defs>','</defs>')+xs.map(x=>`<polygon points="${starPts(x,4.5,4.2,1.7)}" fill="${sc2}" stroke="#000" stroke-opacity=".35" stroke-width=".6"/>`).join('')}
  if(orn==='laurel'){const leaf=(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="2.2" ry="5" transform="rotate(${r} ${x} ${y})" fill="#e8c25a" opacity=".9"/>`;let l='';for(let k=0;k<5;k++){const y=34+k*12;l+=leaf(6+k*1.6,y,-25+k*8)+leaf(94-k*1.6,y,25-k*8)}s+=l}}
 return s+'</svg>';
}

/* ================= SVG: kits ================= */
function patternSVG(pat,alt,x,y,w,h,u,gid){
 let s='';
 switch(pat){
  case'band':s=`<rect x="${x}" y="${y+h*.3}" width="${w}" height="${h*.16}" fill="${alt}"/>`;break;
  case'centre':s=`<rect x="${x+w/2-u*.9}" y="${y}" width="${u*1.8}" height="${h}" fill="${alt}"/>`;break;
  case'panels':s=`<rect x="${x}" y="${y}" width="${w*.24}" height="${h}" fill="${alt}"/><rect x="${x+w*.76}" y="${y}" width="${w*.24}" height="${h}" fill="${alt}"/>`;break;
  case'yoke':s=`<path d="M${x},${y} H${x+w} V${y+h*.24} Q${x+w/2},${y+h*.34} ${x},${y+h*.24} Z" fill="${alt}"/>`;break;
  case'checks':for(let yy=y;yy<y+h;yy+=u)for(let xx=x+(((yy-y)/u)%2?u:0);xx<x+w;xx+=2*u)s+=`<rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${u}" height="${u}" fill="${alt}"/>`;break;
  case'dstripes':for(let k=-h;k<w;k+=u*2.2)s+=`<polygon points="${x+k},${y+h} ${x+k+u},${y+h} ${x+k+u+h*.7},${y} ${x+k+h*.7},${y}" fill="${alt}"/>`;break;
  case'fade':s=`<rect x="${x}" y="${y+h*.45}" width="${w}" height="${h*.55}" fill="${alt}" opacity=".85"/>`+Array.from({length:6},(_,k)=>`<rect x="${x}" y="${(y+h*.45-k*h*.05).toFixed(1)}" width="${w}" height="${(h*.025).toFixed(1)}" fill="${alt}" opacity="${(.7-k*.1).toFixed(2)}"/>`).join('');break;
  case'hoopsthin':for(let i=y+u*.6;i<y+h;i+=u*1.2)s+=`<rect x="${x}" y="${i.toFixed(1)}" width="${w}" height="${(u*.35).toFixed(1)}" fill="${alt}"/>`;break;
  case'stripes':{let st=x+w/2-u/2;while(st-2*u>x-u)st-=2*u;for(let i=st;i<x+w;i+=2*u)s+=`<rect x="${i.toFixed(1)}" y="${y}" width="${u}" height="${h}" fill="${alt}"/>`;break}
  case'pinstripe':{const g=u*.62;let st=x+w/2;while(st-g>x)st-=g;for(let i=st;i<x+w;i+=g)s+=`<rect x="${(i-.6).toFixed(1)}" y="${y}" width="1.3" height="${h}" fill="${alt}" opacity=".75"/>`;break}
  case'hoops':for(let i=y+u*.9;i<y+h;i+=u*1.8)s+=`<rect x="${x}" y="${i.toFixed(1)}" width="${w}" height="${(u*.9).toFixed(1)}" fill="${alt}"/>`;break;
  case'halves':s=`<rect x="${x+w/2}" y="${y}" width="${w/2}" height="${h}" fill="${alt}"/>`;break;
  case'quarters':s=`<rect x="${x+w/2}" y="${y}" width="${w/2}" height="${h/2}" fill="${alt}"/><rect x="${x}" y="${y+h/2}" width="${w/2}" height="${h/2}" fill="${alt}"/>`;break;
  case'sash':s=`<polygon points="${x+w*.2},${y} ${x+w*.42},${y} ${x+w*.8},${y+h} ${x+w*.58},${y+h}" fill="${alt}"/>`;break;
  case'chevron':s=`<polygon points="${x},${y+h*.16} ${x+w/2},${y+h*.36} ${x+w},${y+h*.16} ${x+w},${y+h*.27} ${x+w/2},${y+h*.47} ${x},${y+h*.27}" fill="${alt}"/>`;break;
  case'gradient':s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${gid})"/>`;break;
 }
 return s;
}
const gradDef=(id,k)=>`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.base}"/><stop offset=".42" stop-color="${k.base}"/><stop offset="1" stop-color="${k.alt}"/></linearGradient>`;
const KIT_BODY='M70,14 C80,24 120,24 130,14 L168,28 L197,76 L169,95 L156,80 L156,198 Q100,207 44,198 L44,80 L31,95 L3,76 L32,28 Z';
function kitSVG(c,which,o={}){
 const k=c.kits[which],id=uid('k'),tx=ink(k.base),busy=['stripes','hoops','halves','quarters','sash','chevron'].includes(k.pattern),dk=mix(k.base,'#000',.4);
 let s=`<svg class="kit" viewBox="0 0 200 212" role="img" aria-label="${esc(c.name)} ${which} kit${o.back?', back':''}"><defs><clipPath id="${id}c"><path d="${KIT_BODY}"/></clipPath>
 <linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
 <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".24"/></linearGradient>
 <pattern id="${id}m" width="3.2" height="3.2" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="#000" opacity=".13"/></pattern>${k.pattern==='gradient'?gradDef(id+'g',k):''}</defs>
 <ellipse cx="100" cy="205" rx="66" ry="5" fill="#000" opacity=".22"/><path d="${KIT_BODY}" fill="${k.base}"/>
 <g clip-path="url(#${id}c)">${patternSVG(k.pattern,k.alt,0,0,200,212,22,id+'g')}
 ${k.pattern==='plain'?`<rect x="44" y="84" width="6" height="120" fill="${k.trim}" opacity=".9"/><rect x="150" y="84" width="6" height="120" fill="${k.trim}" opacity=".9"/>`:''}
 <polygon points="3,76 31,95 34.6,89 6.6,70" fill="${k.trim}"/><polygon points="197,76 169,95 165.4,89 193.4,70" fill="${k.trim}"/>
 <path d="M62,118 Q75,150 66,198 M140,112 Q127,150 136,198" stroke="#000" stroke-opacity=".08" stroke-width="8" fill="none"/>
 <path d="M44,82 Q53,102 46,124 M156,82 Q147,102 154,124" stroke="#000" stroke-opacity=".2" stroke-width="5" fill="none"/>
 <rect width="200" height="212" fill="url(#${id}m)"/><rect width="200" height="212" fill="url(#${id}s)"/><rect width="200" height="212" fill="url(#${id}v)"/></g>`;
 const col=o.back?'crew':k.collar;
 if(col==='v')s+=`<path d="M70,14 L100,44 L130,14 C120,20 80,20 70,14 Z" fill="${dk}"/><path d="M70,14 L100,44 L130,14" fill="none" stroke="${k.trim}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>`;
 else if(col==='polo')s+=`<path d="M74,13 C84,20 116,20 126,13 Z" fill="${dk}"/><path d="M100,28 V56" stroke="${dk}" stroke-width="2.2"/><circle cx="100" cy="40" r="1.6" fill="${tx}"/><circle cx="100" cy="50" r="1.6" fill="${tx}"/><polygon points="69,13 99,29 88,41 63,23" fill="${k.trim}"/><polygon points="131,13 101,29 112,41 137,23" fill="${k.trim}"/>`;
 else s+=`<path d="M74,13 C84,20 116,20 126,13 Z" fill="${dk}"/><path d="M70,14 C80,26 120,26 130,14" fill="none" stroke="${k.trim}" stroke-width="6" stroke-linecap="round"/>`;
 if(o.back){
  const nm=(o.name||'').toUpperCase();
  s+=`<text x="100" y="62" text-anchor="middle" ${FONT} font-weight="700" font-size="${Math.min(15,150/Math.max(6,nm.length))}" letter-spacing="2.4" fill="${tx}" ${busy?`stroke="${k.base}" stroke-width="3" paint-order="stroke"`:''}>${esc(nm)}</text>`;
  s+=`<text x="100" y="152" text-anchor="middle" ${FONT} font-weight="800" font-size="78" fill="${tx}" stroke="${busy?k.base:k.trim}" stroke-width="${busy?5:2.2}" paint-order="stroke">${o.num??''}</text>`;
 }else{
  const sp=c.sponsor,fs=Math.min(19,100/(sp.length*.52));
  s+=crestSVG(c,{x:113,y:44,w:22});
  s+=`<path d="M59,61 L66.5,53 L74,61 M63,61 L66.5,57 L70,61" stroke="${tx}" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  s+=`<text x="100" y="118" text-anchor="middle" ${FONT} font-weight="800" font-size="${fs.toFixed(1)}" letter-spacing="1.4" fill="${tx}" ${busy?`stroke="${k.base}" stroke-width="3.5" paint-order="stroke"`:''}>${esc(sp)}</text>`;
 }
 return s+`<path d="${KIT_BODY}" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.4"/></svg>`;
}

