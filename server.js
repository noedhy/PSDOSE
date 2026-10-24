const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT) || 4173;
const root = path.resolve(__dirname);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".sql": "text/plain; charset=utf-8"
};

function safePath(urlPath) {
  const requested = decodeURIComponent(urlPath.split("?")[0]);
  const relative = requested === "/" ? "index.html" : requested.slice(1);
  const file = path.resolve(root, relative);
  return file.startsWith(root + path.sep) ? file : null;
}

const server = http.createServer((req, res) => {
  const file = safePath(req.url || "/");
  if (!file) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Acesso negado");
    return;
  }

  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado");
      return;
    }

    const extension = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mime[extension] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Doses PS disponível em http://localhost:${port}`);
});
