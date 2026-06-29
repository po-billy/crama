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

// ── Web Push: 알림 표시 ──
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  const title = d.title || 'Crama';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'crama-brief',
    data: { url: d.url || '/' },
  }));
});

// ── Web Push: 알림 클릭 → 해당 글 열기(이미 열린 탭 있으면 포커스) ──
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { if (c.navigate) c.navigate(url); return c.focus(); } }
      return self.clients.openWindow(url);
    }),
  );
});
