/* ================= trophies =================
   Every competition has its own trophy: a lidded league cup with ribbons in the league's colours, a big-eared
   domestic cup, a tall silver continental trophy with a star crown, and a plate for second-tier titles. Used in
   the celebration, the parade and the trophy room (and modelled in 3D for the on-pitch lift). */
function trophyInfo(t){
 // t: a trophy record {t:name, key?, season, club, minor?}
 let key=t.key;
 if(!key){if(t.t===CONT_NAME)key='cont';else{const dk=Object.entries(CUP_NAMES).find(([,n])=>n===t.t);if(dk)key='dom-'+dk[0];else{const lg=S.leagues.find(l=>t.t.includes(l.name));key=lg?'lg:'+lg.id:'lg:0'}}}
 if(key==='cont'){const st=cupStyle('cont');return{key,kind:'cont',metal:'silver',c1:st.c1,c2:'#9fb4e8',name:CONT_NAME}}
 if(key.startsWith('dom-')){const n=key.slice(4),[c1,c2]=COMP_STYLE[n];return{key,kind:'jug',metal:'gold',c1,c2,name:CUP_NAMES[n]}}
 const lid=+key.slice(3),lg=S.leagues[lid]||S.leagues[0],st=compStyle(lg.id);
 return{key,kind:t.minor||lg.tier?'plate':'league',metal:lg.tier||t.minor?'silver':'gold',c1:st.c1,c2:st.c2,name:t.minor?t.t:lg.name};
}
function trophySVG(info,size=120){
 const id=uid('tr'),g=info.metal==='silver'?['#5d6573','#f2f5fa','#8a93a3']:['#7a5a14','#f8e08e','#a07a1e'],sw=`url(#${id}m)`,dk=g[0];
 const defs=`<defs><linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset=".42" stop-color="${g[1]}"/><stop offset=".6" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></linearGradient><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2c32"/><stop offset="1" stop-color="#121214"/></linearGradient></defs>`;
 const base=`<path d="M38 128h44l6 14H32z" fill="url(#${id}b)"/><rect x="30" y="140" width="60" height="8" rx="1" fill="#0d0d0f"/>`;
 let body='';
 if(info.kind==='league')body=`<path d="M44 26h32v4c0 4 8 8 8 22 0 18-12 28-24 30-12-2-24-12-24-30 0-14 8-18 8-22z" fill="${sw}"/><path d="M36 40c-12 0-16 18-2 24M84 40c12 0 16 18 2 24" fill="none" stroke="${sw}" stroke-width="4.5"/><ellipse cx="60" cy="26" rx="17" ry="4" fill="${g[1]}"/><path d="M50 22c0-8 20-8 20 0z" fill="${sw}"/><circle cx="60" cy="13" r="4" fill="${sw}"/><path d="M54 82h12v18h-12z" fill="${sw}"/><path d="M44 100h32l4 28H40z" fill="${sw}"/><path d="M40 104 L28 124 L34 124 L46 108 Z" fill="${info.c1}"/><path d="M80 104 L92 124 L86 124 L74 108 Z" fill="${info.c2}"/><path d="M44 106h32v6H44z" fill="${info.c1}" opacity=".85"/>`;
 else if(info.kind==='jug')body=`<path d="M40 22h40c2 18 8 28 8 42 0 18-14 26-28 26S32 82 32 64c0-14 6-24 8-42z" fill="${sw}"/><path d="M34 34c-22-4-26 34-4 38M86 34c22-4 26 34 4 38" fill="none" stroke="${sw}" stroke-width="5.5"/><ellipse cx="60" cy="22" rx="20" ry="5" fill="${g[1]}"/><path d="M53 90h14v12H53z" fill="${sw}"/><path d="M42 102h36l4 26H38z" fill="${sw}"/><rect x="42" y="108" width="36" height="7" fill="${info.c1}"/><rect x="42" y="115" width="36" height="3" fill="${info.c2}"/>`;
 else if(info.kind==='cont')body=`<path d="M46 30h28c0 22 6 30 6 46 0 12-10 18-20 20-10-2-20-8-20-20 0-16 6-24 6-46z" fill="${sw}"/><path d="M42 38c-16-10-28 8-18 24 6 10 16 10 20 8M78 38c16-10 28 8 18 24-6 10-16 10-20 8" fill="none" stroke="${sw}" stroke-width="6"/><polygon points="${starPts(60,16,10,4)}" fill="${sw}"/><ellipse cx="60" cy="30" rx="15" ry="4" fill="${g[1]}"/><path d="M55 96h10v8H55z" fill="${sw}"/><path d="M44 104h32l4 24H40z" fill="${sw}"/>${Array.from({length:5},(_,k)=>`<circle cx="${46+k*7}" cy="116" r="1.8" fill="#dfe5f0"/>`).join('')}`;
 else body=`<circle cx="60" cy="58" r="34" fill="${sw}"/><circle cx="60" cy="58" r="27" fill="none" stroke="${dk}" stroke-width="1.5" opacity=".6"/><circle cx="60" cy="58" r="16" fill="${info.c1}" opacity=".9"/><polygon points="${starPts(60,58,9,3.6)}" fill="${g[1]}"/><path d="M54 92h12v10H54z" fill="${sw}"/><path d="M44 102h32l4 26H40z" fill="${sw}"/>`;
 return`<svg class="trophy" viewBox="0 0 120 150" width="${size}" height="${size*1.25}" role="img" aria-label="${esc(info.name)} trophy">${defs}${body}${base}<path d="M40 30 Q44 60 52 80" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
}
// Celebration overlay (used after the on-pitch lift, at season end, and for 2D or instant results).
function celebrateTrophy(title,sub,cid,rec){
 const c=clubOf(cid),info=trophyInfo(rec||{t:title.replace(/ (winners|champions)$/i,''),club:cid});
 fxOverlay(`<div class="tr2" style="--cc:${c.colors[0]};--c1:${info.c1};--c2:${info.c2}"><div class="tr2-rays"></div><div class="tr2-cup">${trophySVG(info,170)}</div>
 <div class="tr2-crest">${crest(cid,64)}</div><div class="sg-eyebrow">${esc(sub)}</div><h1>${esc(title)}</h1><p class="tr2-sub">${esc(c.name)} · ${esc(info.name)}</p>
 <button class="btn pri lg" data-act="fx-close">Continue ${ARROW}</button></div>`,'trophy',0);
 if(typeof SND!=='undefined'&&SND.ctx){SND.swell(1,5)}
}
// The open-top bus parade, after a season with silverware.
function paradeOverlay(list){
 const c=clubOf(S.user),fans=Math.round((40000+(S.fans??62)*2600+c.cap*1.2)/1000)*1000,cols=c.colors;
 const crowd=Array.from({length:90},(_,i)=>`<i style="left:${(i*1.13)%100}%;bottom:${(i%3)*9}px;background:${cols[i%3]};animation-delay:${(i%7)*.12}s"></i>`).join('');
 fxOverlay(`<div class="parade" style="--cc:${cols[0]};--c2:${cols[1]}"><div class="sg-eyebrow">${esc(c.short)} · trophy parade</div><h1>${list.length>1?`A ${list.length===2?'double':list.length===3?'treble':list.length+'-trophy season'}!`:'Champions!'}</h1>
 <div class="pd-street"><div class="pd-crowd">${crowd}</div><div class="pd-bus"><svg viewBox="0 0 220 90" width="260"><rect x="6" y="30" width="200" height="44" rx="6" fill="${cols[0]}"/><rect x="6" y="30" width="200" height="10" fill="${cols[1]}"/><rect x="14" y="44" width="186" height="16" rx="2" fill="rgba(255,255,255,.18)"/><text x="106" y="56" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="12" fill="${ink(cols[0])}">${esc(c.short.toUpperCase())} · CHAMPIONS</text><circle cx="50" cy="76" r="10" fill="#111"/><circle cx="166" cy="76" r="10" fill="#111"/>${Array.from({length:9},(_,k)=>`<circle cx="${30+k*20}" cy="22" r="6" fill="#e8bf9f"/><rect x="${25+k*20}" y="27" width="10" height="6" fill="${cols[k%2]}"/>`).join('')}</svg><div class="pd-cups">${list.map(t=>trophySVG(trophyInfo(t),46)).join('')}</div></div></div>
 <p class="tr2-sub">An estimated ${fans.toLocaleString('en-GB')} supporters lined the streets.</p><button class="btn pri lg" data-act="fx-close">Continue ${ARROW}</button></div>`,'parade',0);
}
// Trophy room: one shelf per season, spotlights, labels.
function trophyRoom(){
 const tr=S.mgr.trophies;if(!tr.length)return'<p class="muted" style="margin:0">The cabinet is empty. Win a league, a cup or promotion to fill it.</p>';
 const by={};tr.forEach(t=>(by[t.season]=by[t.season]||[]).push(t));
 const count={};tr.forEach(t=>{const n=trophyInfo(t).name;count[n]=(count[n]||0)+1});
 return`<div class="troom-tally">${Object.entries(count).map(([n,k])=>`<span><b>${k}×</b> ${esc(n)}</span>`).join('')}</div><div class="troom">${Object.entries(by).reverse().map(([season,ts])=>`<div class="tshelf"><div class="tshelf-items">${ts.map(t=>{const info=trophyInfo(t);return`<figure class="tslot">${trophySVG(info,84)}<figcaption><b>${esc(info.name)}</b><small>${esc(clubOf(t.club).short)}</small></figcaption></figure>`}).join('')}</div><div class="tshelf-plank"><span>${season}</span></div></div>`).join('')}</div>`;
}
