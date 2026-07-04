/**
 * TLS Trainer — Service Worker
 * Strategy:
 *  - App Shell (HTML/JS/CSS): Cache-first, update in background (stale-while-revalidate)
 *  - API calls:               Network-first, fall back to cache
 *  - Static assets (images, fonts): Cache-first, long TTL
 *  - Manuals / PDFs:          Cache-first after first fetch (offline reading)
 *  - Offline fallback:        /offline.html when network + cache both fail
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE   = `tls-shell-${CACHE_VERSION}`;
const STATIC_CACHE  = `tls-static-${CACHE_VERSION}`;
const API_CACHE     = `tls-api-${CACHE_VERSION}`;
const MANUAL_CACHE  = `tls-manuals-${CACHE_VERSION}`;

// App shell — critical resources to pre-cache on install
const SHELL_URLS = [
  "/",
  "/offline.html",
  "/manifest-trainee.json",
  "/favicon.ico",
];

// Static assets to pre-cache
const STATIC_ASSETS = [
  "/icon-trainee-192.png",
  "/icon-trainee-512.png",
  "/apple-touch-icon.png",
  "/og-image.png",
  "/tip-critical-area.webp",
  "/tip-ddm.webp",
  "/tip-glide-slope.webp",
  "/tip-ils-cat.webp",
  "/tip-loc.webp",
  "/tip-marker.webp",
  "/tip-rf-safety.webp",
  "/tip-self-test.webp",
  "/tip-startup.webp",
  "/tip-vswr.webp",
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) =>
        cache.addAll(SHELL_URLS).catch((err) => {
          console.warn("[SW] Shell pre-cache partial failure:", err);
        })
      ),
      caches.open(STATIC_CACHE).then((cache) =>
        cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn("[SW] Static pre-cache partial failure:", err);
        })
      ),
    ]).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE, MANUAL_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !CURRENT_CACHES.includes(key))
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin (except fonts), and chrome-extension requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.includes("fonts.g")) return;
  if (url.protocol === "chrome-extension:") return;

  // ── 1. API calls: Network-first → cache fallback ─────────────────────────
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 5000));
    return;
  }

  // ── 2. PDFs and Manuals: Cache-first (offline reading) ───────────────────
  if (
    url.pathname.endsWith(".pdf") ||
    url.pathname.startsWith("/pdfs/") ||
    url.pathname.startsWith("/static/pdfs/") ||
    url.pathname.startsWith("/admin-docs/")
  ) {
    event.respondWith(cacheFirstWithNetwork(request, MANUAL_CACHE));
    return;
  }

  // ── 3. Static assets (images, fonts, webp): Cache-first ──────────────────
  if (
    /\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot)$/.test(url.pathname) ||
    url.hostname.includes("fonts.g")
  ) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // ── 4. JS/CSS assets (hashed): Cache-first (immutable) ───────────────────
  if (/\/assets\/[^/]+-[a-zA-Z0-9_]{8}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // ── 5. HTML navigation: Stale-while-revalidate → offline fallback ─────────
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(staleWhileRevalidateWithOfflineFallback(request));
    return;
  }

  // ── 6. Everything else: Network-first ────────────────────────────────────
  event.respondWith(networkFirstWithCache(request, SHELL_CACHE, 8000));
});

// ── Strategy Helpers ─────────────────────────────────────────────────────────

/** Network-first: try network, fall back to cache, timeout after ms */
async function networkFirstWithCache(request, cacheName, timeoutMs = 8000) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetchWithTimeout(request, timeoutMs);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    return cached ?? offlineFallback(request);
  }
}

/** Cache-first: serve from cache, update cache in background */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Update in background
    fetch(request).then((res) => {
      if (res.ok) cache.put(request, res).catch(() => {});
    }).catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }
    return networkResponse;
  } catch {
    return offlineFallback(request);
  }
}

/** Stale-while-revalidate for HTML navigation */
async function staleWhileRevalidateWithOfflineFallback(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);

  if (cached) {
    // Serve stale immediately, update in background
    networkFetch.catch(() => {});
    return cached;
  }

  // No cache — wait for network
  const networkResponse = await networkFetch;
  if (networkResponse) return networkResponse;

  // Both failed — serve offline page
  return (await cache.match("/offline.html")) ?? new Response(
    "<h1>Offline</h1><p>No internet connection.</p>",
    { headers: { "Content-Type": "text/html" } }
  );
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then((res) => { clearTimeout(timer); resolve(res); })
                  .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function offlineFallback(request) {
  const cache = await caches.open(SHELL_CACHE);
  const url = new URL(request.url);
  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    return (await cache.match("/offline.html")) ?? new Response(
      "<h1>Offline</h1>",
      { headers: { "Content-Type": "text/html" } }
    );
  }
  return new Response("", { status: 503, statusText: "Service Unavailable" });
}

// ── Background Sync: queue failed API writes ─────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_MANUAL") {
    const { url } = event.data;
    if (url) {
      caches.open(MANUAL_CACHE).then((cache) =>
        fetch(url).then((res) => { if (res.ok) cache.put(url, res); }).catch(() => {})
      );
    }
  }
});
