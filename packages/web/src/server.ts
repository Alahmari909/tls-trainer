import app from "./api";

const port = Number(process.env.PORT ?? 3000);
const distDir = `${import.meta.dir}/../dist`;
const staticDir = `${import.meta.dir}/../static`;
const indexPath = `${distDir}/index.html`;
const adminPath = `${distDir}/admin.html`;

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      return app.fetch(request);
    }

    // Check dist first, then static/ for large files (pdfs, components)
    const filePath = getStaticFilePath(url.pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) {
      // Hashed assets (e.g. main-abc123.js) get long cache; others get no-cache
      const isHashed = /\/assets\/[^/]+-[a-zA-Z0-9_]{8}\.(js|css)$/.test(url.pathname);
      return new Response(file, {
        headers: isHashed
          ? { "Cache-Control": "public, max-age=31536000, immutable" }
          : { "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
    }

    const staticPath = getStaticFilePath(url.pathname, staticDir);
    const staticFile = Bun.file(staticPath);
    if (await staticFile.exists()) {
      const isPdf = url.pathname.toLowerCase().endsWith(".pdf");
      const isDownload = url.searchParams.get("dl") === "1";
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
      return new Response(staticFile, { headers });
    }

    // Serve admin.html for /admin and all /admin/* routes
    const isAdminRoute =
      url.pathname === "/admin" ||
      url.pathname.startsWith("/admin/");

    const htmlPath = isAdminRoute ? adminPath : indexPath;
    const htmlFile = Bun.file(htmlPath);

    if (await htmlFile.exists()) {
      return new Response(htmlFile, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Fallback: if admin.html not built yet, fall back to index.html
    const index = Bun.file(indexPath);
    if (await index.exists()) {
      return new Response(index, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    return new Response("Build output not found. Run `bun run build` first.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
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
