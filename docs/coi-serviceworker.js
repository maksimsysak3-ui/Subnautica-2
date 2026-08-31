/*
 * Cross-origin isolation via service worker.
 *
 * SharedArrayBuffer -- which the simulation needs to share the world state
 * with worker threads -- is only available on a cross-origin isolated page.
 * That requires two response headers:
 *
 *   Cross-Origin-Opener-Policy:   same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * GitHub Pages does not let you set response headers. So this service worker
 * sits in front of every request and adds them itself. First visit: the page
 * loads without isolation, registers this worker, and reloads once. Every
 * visit after that is isolated from the start.
 *
 * Technique popularised by coi-serviceworker (gzuidhof, MIT). Reimplemented
 * here so the project carries no runtime dependency.
 *
 * Caveat: every cross-origin subresource must now send CORP headers or it
 * will be blocked. Keep this app self-hosted -- no CDN fonts, no remote
 * images -- and that never comes up.
 */

if (typeof window === 'undefined') {
  // ---- service worker context ----------------------------------------
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    event.respondWith(
      fetch(req.mode === 'no-cors' ? new Request(req, { credentials: 'omit' }) : req)
        .then((res) => {
          if (res.status === 0) return res; // opaque; nothing to rewrite
          const headers = new Headers(res.headers);
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          });
        })
        .catch((err) => {
          console.error('[coi] fetch failed:', req.url, err);
          return new Response('coi-serviceworker: upstream fetch failed', { status: 502 });
        }),
    );
  });
} else {
  // ---- page context ---------------------------------------------------
  (() => {
    if (window.crossOriginIsolated) return;       // already isolated, nothing to do
    if (!('serviceWorker' in navigator)) return;  // no SW support; app degrades gracefully

    // Guard against a reload loop if registration succeeds but isolation
    // still does not take effect (some embedded webviews).
    const KEY = 'coi-reload-attempted';
    navigator.serviceWorker
      .register(new URL('coi-serviceworker.js', location.href), { scope: './' })
      .then((reg) => {
        if (reg.active && !navigator.serviceWorker.controller) {
          if (sessionStorage.getItem(KEY)) return;
          sessionStorage.setItem(KEY, '1');
          window.location.reload();
        }
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state !== 'activated') return;
            if (sessionStorage.getItem(KEY)) return;
            sessionStorage.setItem(KEY, '1');
            window.location.reload();
          });
        });
      })
      .catch((err) => console.warn('[coi] service worker registration failed:', err));
  })();
}
