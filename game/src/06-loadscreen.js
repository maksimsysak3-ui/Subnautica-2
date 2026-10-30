// =====================================================================
//  Loading a case: the location's photos drifting under a letterbox, the case title, a line from the file
// =====================================================================
const LOADSCREEN = (() => {
  const id = new URLSearchParams(location.search).get('map');
  const CASE = {
    dar: { no: '01', title: 'DAR ESSALAM', place: 'MOROCCO · A WALLED HARBOUR TOWN', lines: ['The militia took the kasbah three weeks ago — and the town with it.', 'Our people are still inside the medina.', 'Walk, don’t run. A uniform opens their doors.'] },
    seoul: { no: '02', title: 'NEON SEOUL', place: 'SOUTH KOREA · MAPO-GU · NIGHT', lines: ['A list of our people is for sale tonight.', 'Two crews, one city, five stations on Line 2.', 'Their own men’s clothes fool only them.'] },
    bahamas: { no: '04', title: 'PARADISE', place: 'THE BAHAMAS · ELEUTHERA · A PRIVATE ISLAND', lines: ['Victor Kane banks for every file on the desk.', 'His accountant wants out. She knows where he keeps the keys.', 'Every payment went through one man.'] },
    manor: { no: '03', title: 'RAVENSCROFT', place: 'ENGLAND · A COUNTRY ESTATE · THE GALA', lines: ['Lord Ashdown keeps a ledger of every bribe he has paid.', 'Three hundred guests. Forty men with earpieces.', 'Guests don’t go upstairs.'] },
  }[id];
  if (!CASE) return { progress() { }, done() { } };
  const el = document.createElement('div');
  el.id = 'loadscreen';
  el.innerHTML = `<div class="ls-pics">${(CASE_PHOTOS[id] || []).map((src, i) => `<div class="ls-pic" style="background-image:url(${src});animation-delay:${i * 6}s"></div>`).join('')}</div>
    <div class="ls-vig"></div><div class="ls-bar" style="top:0"></div><div class="ls-bar" style="bottom:0"></div>
    <div class="ls-txt"><div class="ls-no">CASE ${CASE.no}</div><div class="ls-title">${CASE.title}</div><div class="ls-place">${CASE.place}</div><div class="ls-line"></div></div>
    <div class="ls-prog"><div class="ls-step"></div><div class="ls-track"><i></i></div></div>`;
  const css = document.createElement('style');
  css.textContent = `#loadscreen{position:fixed;inset:0;z-index:60;background:#050505;overflow:hidden;font-family:Rajdhani,system-ui,sans-serif;color:#efe6d2;transition:opacity 1s}
    #loadscreen.out{opacity:0;pointer-events:none}
    .ls-pic{position:absolute;inset:-6%;background-size:cover;background-position:center;opacity:0;animation:lsPan 18s linear infinite;filter:saturate(.85) contrast(1.08)}
    @keyframes lsPan{0%{opacity:0;transform:scale(1.02) translate(-1.5%,0)}6%{opacity:1}33%{opacity:1}40%{opacity:0;transform:scale(1.14) translate(1.5%,-1%)}100%{opacity:0}}
    .ls-vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(0,0,0,0) 35%,rgba(0,0,0,.75) 100%),linear-gradient(90deg,rgba(0,0,0,.65),rgba(0,0,0,0) 55%)}
    .ls-bar{position:absolute;left:0;right:0;height:11vh;background:#000}
    .ls-txt{position:absolute;left:7vw;top:30vh;max-width:min(640px,80vw)}
    .ls-no{font-size:13px;letter-spacing:.5em;color:#c9a45c;margin-bottom:6px;animation:lsIn 1.2s both}
    .ls-title{font-size:min(9vw,68px);font-weight:700;letter-spacing:.12em;line-height:1;text-shadow:0 4px 30px rgba(0,0,0,.6);animation:lsIn 1.2s .2s both}
    .ls-place{margin-top:12px;font-size:13px;letter-spacing:.35em;opacity:.75;animation:lsIn 1.2s .4s both}
    .ls-line{margin-top:34px;font-size:19px;letter-spacing:.04em;font-style:italic;color:#e8dcc0;min-height:28px;transition:opacity .6s}
    @keyframes lsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    .ls-prog{position:absolute;left:7vw;right:7vw;bottom:calc(11vh + 26px)}
    .ls-step{font-size:12px;letter-spacing:.3em;opacity:.6;margin-bottom:8px}
    .ls-track{height:2px;background:rgba(255,255,255,.12)}.ls-track i{display:block;height:100%;width:0;background:#c9a45c;transition:width .3s}`;
  document.head.appendChild(css); document.body.appendChild(el);
  const lineEl = el.querySelector('.ls-line'), step = el.querySelector('.ls-step'), bar = el.querySelector('.ls-track i');
  let k = 0; const nextLine = () => { lineEl.style.opacity = '0'; setTimeout(() => { lineEl.textContent = `“${CASE.lines[k++ % CASE.lines.length]}”`; lineEl.style.opacity = '1'; }, 600); };
  nextLine(); const timer = setInterval(nextLine, 5200);
  return {
    progress(msg, t) { step.textContent = msg.toUpperCase(); bar.style.width = `${Math.round(t * 100)}%`; },
    done() { clearInterval(timer); bar.style.width = '100%'; step.textContent = 'READY'; setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 1100); }, 500); },
  };
})();
