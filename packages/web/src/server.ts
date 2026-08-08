import app from "./api";

// ── Layer 0: Crash guard ─────────────────────────────────────────────────────
// Many notification/telemetry calls are fire-and-forget (`sendTelegram({...})`
// with no await and no .catch). Without these handlers a single rejected
// promise terminates the Bun process and Railway reports the service as
// CRASHED with the whole site returning 502. Log loudly, stay alive.
process.on("unhandledRejection", (reason: any) => {
  console.error(
    "[fatal-guard] Unhandled promise rejection (server kept alive):",
    reason?.stack ?? reason?.message ?? reason
  );
});
process.on("uncaughtException", (err: any) => {
  console.error(
    "[fatal-guard] Uncaught exception (server kept alive):",
    err?.stack ?? err?.message ?? err
  );
});
// ─────────────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3000);

// ── Layer 2: Security Headers ────────────────────────────────────────────────
function securityHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy":
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: blob: https://storage.googleapis.com; " +
      "connect-src 'self' wss: https://api.openai.com https://*.turso.io; " +
      "frame-src 'self' https://docs.google.com https://docs.google.com/viewer; " +
      "object-src 'none';",
    ...extra,
  };
}
// ─────────────────────────────────────────────────────────────────────────────
const distDir = `${import.meta.dir}/../dist`;
const staticDir = `${import.meta.dir}/../static`;
const indexPath = `${distDir}/index.html`;
const adminPath = `${distDir}/admin.html`;

// ── Admin hostname detection ─────────────────────────────────────────────────
// The Admin interface gets its own public hostname pointed at THIS SAME service
// (same server, same database, same env). A request is treated as "admin host"
// when its Host header matches `admin.*` or `tls-admin*`, or is listed in the
// optional ADMIN_HOSTS env var (comma-separated). On an admin host every
// navigation returns the admin shell, so /, /admin and deep refreshes all work.
// The trainee host is completely unaffected: /admin keeps working there.
export function isAdminHostname(host: string | null | undefined): boolean {
  const h = (host ?? "").split(":")[0].trim().toLowerCase();
  if (!h) return false;
  const extra = (process.env.ADMIN_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes(h)) return true;
  return h.startsWith("admin.") || h.startsWith("tls-admin");
}

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    // ── Layer 4: Request size limit (anti-payload DDoS) ──────────────────────
    // Document uploads (PDF slides) need a larger ceiling; every other endpoint
    // stays tight. 25MB keeps stored files within the size Turso can serve.
    const isDocUpload =
      request.method === "POST" && url.pathname === "/api/admin/documents";
    const maxBody = isDocUpload ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxBody) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (url.pathname.startsWith("/api")) {
      return app.fetch(request);
    }

    // ── Optional legacy /admin -> dedicated admin host redirect ──────────────
    // OFF by default. Enable only after the new admin URL is verified by setting
    // ADMIN_REDIRECT_HOST=<admin-host> (e.g. tls-admin-production.up.railway.app).
    // Never applies to /api (handled above) and never runs on the admin host
    // itself, so authentication and the trainee app are untouched.
    const onAdminHost = isAdminHostname(request.headers.get("host"));

    // Root of the admin host must return the admin shell. Handled here because
    // the static lookup below maps "/" straight to dist/index.html.
    if (onAdminHost && url.pathname === "/") {
      const adminShell = Bun.file(adminPath);
      if (await adminShell.exists()) {
        return new Response(adminShell, {
          headers: securityHeaders({
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          }),
        });
      }
    }

    const legacyRedirectHost = (process.env.ADMIN_REDIRECT_HOST ?? "").trim();
    if (
      legacyRedirectHost &&
      !onAdminHost &&
      (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
    ) {
      const target = `https://${legacyRedirectHost}${url.pathname}${url.search}`;
      return new Response(null, {
        status: 302,
        headers: { Location: target, "Cache-Control": "no-store" },
      });
    }

    // Check dist first, then static/ for large files (pdfs, components)
    const filePath = getStaticFilePath(url.pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      // Hashed assets (e.g. main-abc123.js) get long cache; others get no-cache
      const isHashed = /\/assets\/[^/]+-[a-zA-Z0-9_]{8}\.(js|css)$/.test(url.pathname);
      // Service Worker must be served with Service-Worker-Allowed header
      const isSW = url.pathname === "/sw.js";
      return new Response(file, {
        headers: securityHeaders(
          isHashed
            ? { "Cache-Control": "public, max-age=31536000, immutable" }
            : isSW
              ? { "Cache-Control": "no-cache, no-store, must-revalidate", "Service-Worker-Allowed": "/", "Content-Type": "application/javascript" }
              : { "Cache-Control": "no-cache, no-store, must-revalidate" }
        ),
      });
    }

    const staticPath = getStaticFilePath(url.pathname, staticDir);
    const staticFile = Bun.file(staticPath);
    if (await staticFile.exists()) {
      const isPdf = url.pathname.toLowerCase().endsWith(".pdf");
      const isDownload = url.searchParams.get("dl") === "1";
      const isHtml = url.pathname.toLowerCase().endsWith(".html");
      const headers: Record<string, string> = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      };
      if (isPdf) {
        headers["Content-Type"] = "application/pdf";
        if (isDownload) {
          const fileName = url.pathname.split("/").pop() ?? "file.pdf";
          headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
        } else {
          headers["Content-Disposition"] = "inline";
        }
      }
      // HTML files served from /static (like simulator_tls.html) must be
      // embeddable in iframes — override X-Frame-Options for these only
      if (isHtml) {
        return new Response(staticFile, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      return new Response(staticFile, { headers: securityHeaders(headers) });
    }

    // Serve admin.html for /admin and all /admin/* routes — and for EVERY
    // navigation on a dedicated admin hostname (so "/" and direct refreshes of
    // any admin path return the admin shell instead of the trainee shell).
    const isAdminRoute =
      onAdminHost ||
      url.pathname === "/admin" ||
      url.pathname.startsWith("/admin/");

    const htmlPath = isAdminRoute ? adminPath : indexPath;
    const htmlFile = Bun.file(htmlPath);

    if (await htmlFile.exists()) {
      return new Response(htmlFile, {
        headers: securityHeaders({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        }),
      });
    }

    // Fallback: if admin.html not built yet, fall back to index.html
    const index = Bun.file(indexPath);
    if (await index.exists()) {
      return new Response(index, {
        headers: securityHeaders({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        }),
      });
    }

    return new Response("Build output not found. Run `bun run build` first.", {
      status: 500,
      headers: securityHeaders({ "Content-Type": "text/plain; charset=utf-8" }),
    });
  },
});

console.log(`Web server listening on http://localhost:${server.port}`);

function getStaticFilePath(pathname: string, baseDir = distDir) {
  const cleanPath = decodeURIComponent(pathname)
    .replace(/^\/+/, "")
    .replaceAll("..", "");

  return cleanPath ? `${baseDir}/${cleanPath}` : indexPath;
}
