/* ================= utilities ================= */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function R(seed){const r=mulberry32(seed);const o={f:r,i:(a,b)=>a+Math.floor(r()*(b-a+1)),pick:a=>a[Math.floor(r()*a.length)],chance:p=>r()<p,n:(m,s)=>{let u=0,v=0;while(!u)u=r();while(!v)v=r();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}};return o}
const G=R((Math.random()*2147483647)|0);
let _uid=0;const uid=p=>p+(++_uid).toString(36);
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>{const a=Math.abs(v),s=v<0?'-':'';return a>=1e6?s+'£'+(a/1e6).toFixed(a>=1e7?1:2).replace(/\.?0+$/,'')+'M':s+'£'+Math.round(a/1e3)+'K'};
const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])};
const fill=(t,o)=>t.replace(/\{(\w+)\}/g,(_,k)=>o[k]??'');
function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255]}
function mix(a,b,t){const A=hex2rgb(a),B=hex2rgb(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')}
function lum(h){const[r,g,b]=hex2rgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const ink=h=>contrast(h,'#ffffff')>=contrast(h,'#111827')?'#ffffff':'#111827';
const FONT=`font-family="'Barlow Condensed','Arial Narrow',sans-serif"`;
function polyPts(cx,cy,r,n,rot=-90){return Array.from({length:n},(_,i)=>{const a=(rot+i*360/n)*Math.PI/180;return(cx+Math.cos(a)*r).toFixed(2)+','+(cy+Math.sin(a)*r).toFixed(2)}).join(' ')}
function starPts(cx,cy,R1,r1,n=5){const p=[];for(let i=0;i<n*2;i++){const a=(-90+i*180/n)*Math.PI/180,rr=i%2?r1:R1;p.push((cx+Math.cos(a)*rr).toFixed(2)+','+(cy+Math.sin(a)*rr).toFixed(2))}return p.join(' ')}
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

const sig=x=>1/(1+Math.exp(-x));
function pickW(items,wf,rng=G){let tot=0;const ws=items.map(x=>{const w=Math.max(0,wf(x));tot+=w;return w});if(!tot)return items[0];let r=rng.f()*tot;for(let i=0;i<items.length;i++){r-=ws[i];if(r<=0)return items[i]}return items[items.length-1]}
function poisson(l,rng=G){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=rng.f()}while(p>L);return k-1}
function shuffled(a,rng=G){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng.f()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const fmtDate=ms=>{const d=new Date(ms);return`${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`};
const shortDate=ms=>{const d=new Date(ms);return`${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`};
const DAY=864e5;
const vClass=v=>v>=85?'v6':v>=75?'v5':v>=65?'v4':v>=55?'v3':v>=45?'v2':'v1';
const rtColor=r=>r>=8?'#38d184':r>=7.2?'#9be15d':r>=6.6?'#ffd13a':r>=6?'#ff9f43':'#ff6b7c';
