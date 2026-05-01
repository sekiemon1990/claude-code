// Service Worker (簡易キャッシュ戦略)
// - 静的アセット: cache-first
// - HTML / API: network-first (オフライン時にキャッシュへフォールバック)
// - スクレイピング API は cache 対象外 (POST のため)

const CACHE_VERSION = "v1";
const STATIC_CACHE = `maxus-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `maxus-runtime-${CACHE_VERSION}`;

// インストール時にプリキャッシュする最小限のリソース
const PRECACHE_URLS = ["/", "/search", "/list", "/history", "/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            fetch(url, { credentials: "same-origin" })
              .then((res) => res.ok && cache.put(url, res.clone()))
              .catch(() => null),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // GET 以外は SW を介さない
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 同一オリジンのみ介入 (CDN 画像・API 等は素通し)
  if (url.origin !== self.location.origin) return;

  // /api/* は基本キャッシュしない (network passthrough)
  if (url.pathname.startsWith("/api/")) return;

  // _next/static や画像など静的アセット → cache-first
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        });
      }),
    );
    return;
  }

  // HTML / その他 GET → network-first, fallback to cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error())),
  );
});
