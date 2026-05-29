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
      return new Response(file);
    }

    const staticPath = getStaticFilePath(url.pathname, staticDir);
    const staticFile = Bun.file(staticPath);
    if (await staticFile.exists()) {
      return new Response(staticFile);
    }

    // Serve admin.html for /admin and all /admin/* routes
    const isAdminRoute =
      url.pathname === "/admin" ||
      url.pathname.startsWith("/admin/");

    const htmlPath = isAdminRoute ? adminPath : indexPath;
    const htmlFile = Bun.file(htmlPath);

    if (await htmlFile.exists()) {
      return new Response(htmlFile, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Fallback: if admin.html not built yet, fall back to index.html
    const index = Bun.file(indexPath);
    if (await index.exists()) {
      return new Response(index, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
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
