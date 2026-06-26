// Crama PWA 서비스워커 — 설치 가능(installable) + 가벼운 네트워크 우선 캐시.
// 콘텐츠/데이터 정확성을 위해 네트워크 우선, 오프라인일 때만 캐시 폴백.
const CACHE = 'crama-v1';
const SHELL = ['/', '/offline.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(R2 등)는 패스

  // Supabase API 등은 항상 네트워크
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy).catch(() => {}));
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/offline.html'))),
  );
});
