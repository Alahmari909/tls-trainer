import type { Plugin, ViteDevServer } from "vite";
import fs from "fs";
import path from "path";

export default function honoDevPlugin(): Plugin {
  return {
    name: "hono-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "/";

        // Handle API routes via Hono
        if (url.startsWith("/api")) {
          try {
            const request = await toWebRequest(req);
            const app = await loadApp(server);
            const response = await app.fetch(request);

            res.statusCode = response.status;
            response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (err) {
            server.ssrFixStacktrace(err as Error);
            console.error("[hono-dev]", err);
            res.statusCode = 500;
            res.end("Internal Server Error");
          }
          return;
        }

        // Serve admin.html for /admin and /admin/* routes (dev mode)
        const pathname = url.split("?")[0];
        const isAdminRoute =
          pathname === "/admin" ||
          pathname.startsWith("/admin/");

        if (isAdminRoute && !url.includes(".")) {
          const webRoot = path.resolve(__dirname, "../../");
          const adminHtml = path.join(webRoot, "admin.html");
          if (fs.existsSync(adminHtml)) {
            // Let Vite transform admin.html
            req.url = "/admin.html";
          }
        }

        next();
      });
    },
  };
}

async function loadApp(server: ViteDevServer) {
  const mod = await server.ssrLoadModule("/src/api/index.ts");
  return mod.default;
}

function toWebRequest(req: import("http").IncomingMessage): Request {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (req as unknown as ReadableStream) : undefined,
    // @ts-expect-error duplex needed for streaming request bodies
    duplex: hasBody ? "half" : undefined,
  });
}
