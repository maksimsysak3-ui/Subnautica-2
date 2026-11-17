/* ================= logo families and kit realism =================
   Not every club uses a heraldic shield. A hash of the club name picks one of three families, so existing
   saves get the same logo every time without touching world generation:
   classic (the shield or roundel from crestSVG), modern (flat badge with no ribbon or gradients) and
   monogram (interlocking initials, no container). */
const strHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0};
function crestStyle(c){if(c.crest[4])return c.crest[4];const h=strHash(c.name)%20;return h<9?'classic':h<15?'modern':'mono'}
const crestAttrs=(c,o)=>o.w?`x="${o.x||0}" y="${o.y||0}" width="${o.w}" height="${(o.w*1.2).toFixed(1)}"`:`class="crest ${o.cls||''}"${o.size?` style="width:${o.size}px;height:${Math.round(o.size*1.2)}px"`:''}`;
// The two letters a monogram uses: town initial plus the initial of the club's other word ("Penport Borough" -> PB).
function initials(c){
 const w=c.name.split(/\s+/).filter(x=>x&&!/^(of|de|del|la|le|the|fc|cf|sc|ac|1\.)$/i.test(x)),t=c.short[0].toUpperCase();
 const o=w.find(x=>x[0].toUpperCase()!==t&&!x.startsWith(c.short));return o?t+o[0].toUpperCase():t+(c.short[1]||'').toUpperCase();
}
// A colour that reads against the app's dark panels.
const onDark=(a,b)=>contrast(a,'#141416')>=2.2?a:contrast(b,'#141416')>=2.2?b:'#e8e6df';
function modernShape(kind,inset,fill){
 const i=inset;
 if(kind==='circle')return`<circle cx="50" cy="60" r="${46-i}" fill="${fill}"/>`;
 if(kind==='rsquare')return`<rect x="${8+i}" y="${16+i}" width="${84-2*i}" height="${88-2*i}" rx="${Math.max(4,20-i)}" fill="${fill}"/>`;
 if(kind==='hex'){const r=48-i;return`<polygon points="${[0,1,2,3,4,5].map(k=>{const a=(k*60-90)*Math.PI/180;return`${(50+Math.cos(a)*r).toFixed(1)},${(60+Math.sin(a)*r).toFixed(1)}`}).join(' ')}" fill="${fill}"/>`}
 return`<path d="M14,12 H86 V58 C86,86 68,102 50,111 C32,102 14,86 14,58 Z" fill="${fill}" transform="translate(50 60) scale(${(1-i/50).toFixed(3)}) translate(-50 -60)"/>`;
}
function crestModern(c,o){
 const[c1,c2]=c.colors,h=strHash(c.name+'m'),kind=['circle','rsquare','hex','shield'][h%4],split=(h>>3)%3===0;
 const em=contrast(c1,c2)>2.2?c2:ink(c1),emb=c.crest[2]==='mono'?'star':c.crest[2];
 let s=`<svg ${crestAttrs(c,o)} viewBox="0 0 100 120" role="img" aria-label="${esc(c.name)} logo">`;
 s+=modernShape(kind,0,c2)+modernShape(kind,4.5,c1);
 if(split){const id=uid('m');s+=`<clipPath id="${id}"><rect x="50" y="0" width="50" height="120"/></clipPath><g clip-path="url(#${id})">${modernShape(kind,4.5,mix(c1,'#000',.16))}</g>`}
 s+=emblemSVG(emb,50,kind==='shield'?50:54,36,em);
 s+=`<text x="50" y="${kind==='shield'?88:90}" text-anchor="middle" ${FONT} font-weight="800" font-size="12.5" letter-spacing="2.6" fill="${em}">${esc(c.abbr)}</text>`;
 return s+'</svg>';
}
function crestMono(c,o){
 const[c1,c2]=c.colors,L=initials(c),a=onDark(c1,c2),b=a===c1?onDark(c2,'#e8e6df'):c1===a?c2:onDark(c2,c1),ring=(strHash(c.name+'r')%2)===0;
 const serif=`font-family="Georgia,'Times New Roman',serif"`,fs=L.length>1?54:70;
 let s=`<svg ${crestAttrs(c,o)} viewBox="0 0 100 120" role="img" aria-label="${esc(c.name)} logo">`;
 if(ring)s+=`<circle cx="50" cy="56" r="44" fill="none" stroke="${a}" stroke-width="2.2"/><circle cx="50" cy="56" r="39.5" fill="none" stroke="${a}" stroke-width=".9" opacity=".7"/>`;
 // Interlock: the second letter is drawn over the first with a knock-out stroke in the panel colour.
 s+=`<text x="${L.length>1?36:50}" y="${ring?77:80}" text-anchor="middle" ${serif} font-weight="700" font-style="italic" font-size="${fs}" fill="${a}">${L[0]}</text>`;
 if(L[1])s+=`<text x="64" y="${ring?77:80}" text-anchor="middle" ${serif} font-weight="700" font-style="italic" font-size="${fs}" fill="${b===a?mix(a,'#000',.35):b}" stroke="#141416" stroke-width="3" paint-order="stroke">${L[1]}</text>`;
 s+=`<text x="50" y="${ring?114:108}" text-anchor="middle" ${FONT} font-weight="700" font-size="9.5" letter-spacing="3.2" fill="${a}">${esc(c.short.toUpperCase().slice(0,12))}</text>`;
 return s+'</svg>';
}

/* ---- kits ----
   Real kits are mostly plain or one traditional pattern; away and third kits are simpler still. Checks,
   diagonal stripes, chevrons, quarters and gradients read as fancy dress, so they are re-picked once per
   save (deterministically from the club name), and patterns whose two colours are too close are made plain. */
const KIT_REAL={home:[['plain',13],['stripes',3],['hoops',1],['pinstripe',2],['band',1],['yoke',1],['panels',1],['centre',1],['halves',1],['sash',1],['hoopsthin',1]],
 away:[['plain',10],['yoke',2],['band',2],['pinstripe',2],['panels',2],['centre',1],['sash',1],['hoopsthin',1]],
 third:[['plain',8],['pinstripe',2],['yoke',2],['panels',2],['fade',1]]};
function realKits(c){
 for(const w of ['home','away','third']){const k=c.kits[w];if(!k)continue;
  const L=KIT_REAL[w],tot=L.reduce((a,x)=>a+x[1],0);let r=strHash(c.name+w)%tot;
  for(const[p,n]of L){if(r<n){k.pattern=p;break}r-=n}
  if(k.pattern!=='plain'&&contrast(k.base,k.alt)<1.25)k.pattern='plain';
  if(contrast(k.trim,k.base)<1.15)k.trim=contrast(k.alt,k.base)>=1.15?k.alt:ink(k.base);
  // An away kit must not clash with the home kit at a glance.
  if(w==='away'&&contrast(c.kits.home.base,k.base)<1.6){k.base=lum(c.kits.home.base)>.4?'#151b2b':'#f2f1ec';k.alt=c.colors[0];if(contrast(k.alt,k.base)<1.25)k.alt=ink(k.base)}
 }
 c.kitsV=2;
}
