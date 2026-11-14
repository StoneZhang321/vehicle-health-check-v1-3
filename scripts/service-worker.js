/* 中文：只缓存同源静态资源；检测资料仅在IndexedDB。 English: Cache same-origin resources; inspection data stays in IndexedDB. */
const CACHE = __CACHE_NAME__;
const RESOURCES = __PRECACHE__;
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(RESOURCES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("vhcinspect-1.3-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // 中文：导航优先更新，断网回到缓存入口。 English: Refresh navigation online and use the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match("/index.html", { ignoreVary: true }))));
  } else {
    // 中文：此缓存只含同源静态构建资源；预取与模块加载的Origin头可不同，文件字节不变。
    // English: This cache holds only same-origin static build files; prefetch and module Origin headers can differ without changing their bytes.
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
