/**
 * TLS Trainer — Service Worker  (v4 — SPA-safe PWA)
 *
 * Key fix: Navigation requests (opening app from home screen) MUST always
 * return the correct HTML shell (index.html or admin.html), never a 404 or
 * offline page, so the React SPA can boot and handle routing itself.
 *
 * Strategy:
 *  - App Shell (HTML):          Cache-first → network update in background
 *  - JS/CSS assets (hashed):    Cache-first (immutable)
 *  - API calls:                 Network-first → cache fallback (5 s timeout)
 *  - Static assets (img/font):  Cache-first → network update
 *  - PDFs / Manuals:            Cache-first after first fetch (offline reading)
 *  - Navigation fallback:       Always serve index.html / admin.html (SPA)
 */

const CACHE_VERSION  = "v4";
const SHELL_CACHE    = `tls-shell-${CACHE_VERSION}`;
const STATIC_CACHE   = `tls-static-${CACHE_VERSION}`;
const API_CACHE      = `tls-api-${CACHE_VERSION}`;
const MANUAL_CACHE   = `tls-manuals-${CACHE_VERSION}`;

// ── Critical shell resources pre-cached on install ──────────────────────────
const SHELL_URLS = [
  "/",
  "/admin",           // admin PWA start_url — must be in cache
  "/offline.html",
  "/manifest-trainee.json",
  "/manifest-admin.json",
  "/favicon.ico",
];

// ── Static assets pre-cached on install ─────────────────────────────────────
const STATIC_ASSETS = [
  "/icon-trainee-192.png",
  "/icon-trainee-512.png",
  "/icon-admin-192.png",
  "/icon-admin-512.png",
  "/apple-touch-icon.png",
  "/apple-touch-icon-admin.png",
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

// ── Install: pre-cache shell + static assets ─────────────────────────────────
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

// ── Activate: delete old caches, claim clients immediately ───────────────────
self.addEventListener("activate", (event) => {
  const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE, MANUAL_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !CURRENT_CACHES.includes(key))
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin (except Google Fonts), and extension requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !url.hostname.includes("fonts.g")) return;
  if (url.protocol === "chrome-extension:") return;

  // ── 1. API calls: Network-first → cache fallback ─────────────────────────
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 5000));
    return;
  }

  // ── 2. PDFs / Manuals: Cache-first (offline reading) ─────────────────────
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

  // ── 4. Hashed JS/CSS assets: Cache-first (immutable) ─────────────────────
  if (/\/assets\/[^/]+-[a-zA-Z0-9_]{8}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, SHELL_CACHE));
    return;
  }

  // ── 5. HTML navigation (SPA) ─────────────────────────────────────────────
  //   This is the critical fix: any navigation request (opening from home
  //   screen, refreshing, deep-linking) must return the correct HTML shell.
  //   The React router then handles the path client-side.
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  // ── 6. Everything else: Network-first ────────────────────────────────────
  event.respondWith(networkFirstWithCache(request, SHELL_CACHE, 8000));
});

// ── Navigation handler: SPA-safe ─────────────────────────────────────────────
// Determines which HTML shell to serve (index.html vs admin.html),
// tries network first, falls back to cache, never returns 404.
async function handleNavigation(request, url) {
  // Decide which shell this route belongs to
  const isAdminRoute =
    url.pathname === "/admin" ||
    url.pathname.startsWith("/admin/");

  // Canonical shell URL (what the server actually serves)
  const shellUrl = isAdminRoute ? "/admin" : "/";

  const cache = await caches.open(SHELL_CACHE);

  // Try network first (so we always get the latest build)
  try {
    const networkResponse = await fetchWithTimeout(request, 6000);
    if (networkResponse.ok) {
      // Update cache with fresh shell
      cache.put(shellUrl, networkResponse.clone()).catch(() => {});
      return networkResponse;
    }
  } catch {
    // Network failed — fall through to cache
  }

  // Serve from cache (stale is fine — React handles routing)
  const cached = await cache.match(shellUrl);
  if (cached) return cached;

  // Last resort: try the other shell
  const fallbackShell = isAdminRoute ? "/" : "/admin";
  const fallbackCached = await cache.match(fallbackShell);
  if (fallbackCached) return fallbackCached;

  // Absolute last resort: offline page
  const offlinePage = await cache.match("/offline.html");
  if (offlinePage) return offlinePage;

  return new Response(
    "<!doctype html><html><head><meta charset=UTF-8><meta name=viewport content='width=device-width,initial-scale=1'><title>TLS Trainer</title></head><body><p style='font-family:sans-serif;text-align:center;padding:40px'>Loading TLS Trainer... Please check your connection.</p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

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

/** Cache-first: serve from cache, update in background */
async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    // Update in background (stale-while-revalidate)
    fetch(request)
      .then((res) => { if (res.ok) cache.put(request, res).catch(() => {}); })
      .catch(() => {});
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

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SW timeout")), ms);
    fetch(request)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

async function offlineFallback(request) {
  const cache = await caches.open(SHELL_CACHE);
  const url = new URL(request.url);
  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    return (
      (await cache.match("/offline.html")) ??
      new Response("<h1>Offline</h1>", { headers: { "Content-Type": "text/html" } })
    );
  }
  return new Response("", { status: 503, statusText: "Service Unavailable" });
}

// ── Messages ──────────────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data?.type === "CACHE_MANUAL") {
    const { url } = event.data;
    if (url) {
      caches.open(MANUAL_CACHE).then((cache) =>
        fetch(url)
          .then((res) => { if (res.ok) cache.put(url, res); })
          .catch(() => {})
      );
    }
  }
});
