// Loopback-only fixture server. This file is never part of the production shell.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const revisions = new Map();
const rootFiles = new Set([
  "index.html", "sw.js", "manifest.json", "storage.js", "version.js",
  "health-hub.js", "nutrition-unit-rules.json", "today-icon-v9-192.png",
  "today-icon-v9-512.png", "apple-touch-icon-v9.png"
]);
const runtimeDirectories = /^(?:modules|assets|vendor|data|contracts|Today-AI-Engine\/src)\//;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1:4173").pathname;
    if (pathname === "/__test/health" && request.method === "GET") {
      response.writeHead(200).end("ready");
      return;
    }
    const revision = pathname.match(/^\/__test\/revision\/([a-f0-9]{24})$/);
    if (revision && request.method === "POST") {
      revisions.set(revision[1], 1);
      response.writeHead(204).end();
      return;
    }
    const scopedPath = pathname.match(/^\/runs\/([a-f0-9]{24})\/(.*)$/);
    if (!scopedPath || request.method !== "GET") {
      response.writeHead(404).end();
      return;
    }
    const [scope, relativePath] = [scopedPath[1], decodeURIComponent(scopedPath[2]) || "index.html"];
    const parts = relativePath.split("/");
    if (parts.some(part => !part || part.startsWith(".")) ||
        (!rootFiles.has(relativePath) && !runtimeDirectories.test(relativePath))) {
      response.writeHead(404).end();
      return;
    }
    let body = await fs.readFile(path.join(root, relativePath));
    if (relativePath === "sw.js" && revisions.has(scope)) {
      // Change only the cache version in memory to exercise a real waiting worker.
      body = Buffer.from(body.toString("utf8").replace(
        /const VERSION = "([^"]+)";/,
        'const VERSION = "$1-e2e-update-1";'
      ));
    }
    response.writeHead(200, {
      "content-type": mime[path.extname(relativePath)] || "application/octet-stream",
      "cache-control": "no-store"
    }).end(body);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
  }
});

server.listen(4173, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
