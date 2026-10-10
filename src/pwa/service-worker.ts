/// <reference lib="webworker" />

declare const __PWA_CACHE_NAME__: string;
declare const __PWA_PRECACHE_URLS__: string[];

const scope = globalThis as unknown as ServiceWorkerGlobalScope;
const CACHE_PREFIX = 'todolist-static-';

scope.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil((async () => {
    const cache = await caches.open(__PWA_CACHE_NAME__);
    try {
      await cache.addAll(__PWA_PRECACHE_URLS__);
    } catch (error) {
      await caches.delete(__PWA_CACHE_NAME__);
      throw error;
    }
  })());
});

scope.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil((async () => {
    const names = (await caches.keys())
      .filter((name) => name.startsWith(CACHE_PREFIX))
      .sort();
    await Promise.all(names.slice(0, -2).map((name) => caches.delete(name)));
    await scope.clients.claim();
  })());
});

scope.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && typeof event.data === 'object' && event.data.type === 'ACTIVATE_UPDATE') {
    event.waitUntil(scope.skipWaiting());
  }
});

scope.addEventListener('fetch', (event: FetchEvent) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.location.origin || url.pathname.startsWith('/__/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cachedRoute = await caches.match(request, { ignoreSearch: true });
        return cachedRoute ?? new Response('이 화면은 아직 오프라인 저장되지 않았습니다. 연결 후 다시 열어 주세요.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
    return;
  }

  const isStaticAsset = url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/design/')
    || url.pathname.startsWith('/fonts/')
    || url.pathname === '/manifest.webmanifest';
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cachedAsset = await caches.match(request);
    if (cachedAsset) return cachedAsset;
    return fetch(request);
  })());
});
