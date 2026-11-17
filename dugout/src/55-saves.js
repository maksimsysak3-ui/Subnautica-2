/* ================= save slots =================
   Careers live in IndexedDB (gzip-compressed where the browser supports it), one record per slot plus a small
   metadata record for the menu. Falls back to localStorage if IndexedDB is unavailable. */
const SLOTS=3;
const DB={
 p:null,fallback:false,
 open(){if(!this.p)this.p=new Promise((res,rej)=>{try{const r=indexedDB.open('dugout-saves',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}).catch(e=>{this.fallback=true;return null});return this.p},
 async put(k,v){const db=await this.open();if(!db){localStorage.setItem('dugout:'+k,typeof v==='string'?v:JSON.stringify(v));return}
  return new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
 async get(k){const db=await this.open();if(!db){const v=localStorage.getItem('dugout:'+k);if(v==null)return null;try{return k[0]==='m'?JSON.parse(v):v}catch(e){return v}}
  return new Promise((res,rej)=>{const r=db.transaction('kv').objectStore('kv').get(k);r.onsuccess=()=>res(r.result??null);r.onerror=()=>rej(r.error)})},
 async del(k){const db=await this.open();if(!db){localStorage.removeItem('dugout:'+k);return}
  return new Promise(res=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=()=>res();t.onerror=()=>res()})},
};
async function pack(str){if(DB.fallback||typeof CompressionStream==='undefined')return str;return new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).blob()}
async function unpack(v){if(v==null)return null;if(typeof v==='string')return v;return new Response(v.stream().pipeThrough(new DecompressionStream('gzip'))).text()}
function slotMeta(){
 const c=clubOf(S.user),lg=S.leagues[c.league],played=S.results[c.league].length;
 return{slot:S.slot,savedAt:Date.now(),club:{id:c.id,name:c.name,short:c.short,abbr:c.abbr,colors:c.colors,crest:c.crest,est:c.est},league:lg.name,season:seasonLabel(),md:S.md,
  pos:played?posIn(table(c.league),S.user):null,rec:[S.mgr.w,S.mgr.d,S.mgr.l],trophies:S.mgr.trophies.filter(t=>!t.minor).length,seasons:S.mgr.seasons};
}
let saveTimer=0,savePending=null;
function save(){
 if(!S||!S.slot)return false;
 clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,350);return true;
}
async function flushSave(){
 clearTimeout(saveTimer);if(!S||!S.slot)return;
 const slot=S.slot,json=JSON.stringify(S),meta=slotMeta();
 // Chain writes so a slower, older save can never land after a newer one.
 savePending=(savePending||Promise.resolve()).then(async()=>{try{await DB.put('d'+slot,await pack(json));await DB.put('m'+slot,DB.fallback?JSON.stringify(meta):meta)}
  catch(e){if(typeof toast==='function'&&!save.warned){save.warned=1;toast('Could not save: browser storage is full or blocked')}}});
 return savePending;
}
async function loadSlot(n){const raw=await unpack(await DB.get('d'+n));if(!raw)return null;const s=JSON.parse(raw);if(!s||s.v!==3)return null;s.slot=n;return s}
async function readMetas(){const out=[];for(let n=1;n<=SLOTS;n++){let m=await DB.get('m'+n);if(typeof m==='string')try{m=JSON.parse(m)}catch(e){m=null}out.push(m||null)}return out}
async function deleteSlot(n){await DB.del('d'+n);await DB.del('m'+n)}
// One-time move of a pre-slot career (single localStorage save) into slot 1.
async function migrateLegacy(){
 try{const t=localStorage.getItem(KEY);if(!t)return;const s=JSON.parse(t);if(!s||s.v!==3||s.user<0)return;
  const metas=await readMetas();if(metas[0])return;
  const prev=S;S=s;S.slot=1;await flushSave();await savePending;S=prev;localStorage.removeItem(KEY)}catch(e){}
}
