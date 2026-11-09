// Petit serveur local sans dépendance : node server.mjs [--open] [--port 5173]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
let port = Number(args[args.indexOf("--port") + 1]) || Number(process.env.PORT) || 5173;
const shouldOpen = args.includes("--open");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".gpx": "application/gpx+xml", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) { res.writeHead(403).end("Interdit"); return; }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Introuvable"); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end("Erreur serveur");
  }
});

function listen() {
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE" && port < 5190) { port++; listen(); }
    else { console.error(e.message); process.exit(1); }
  });
  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}/`;
    console.log(`\n  Visorando accessible est lancé : ${url}\n  (Ctrl + C pour arrêter)\n`);
    if (shouldOpen) {
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start \"\"" : "xdg-open";
      exec(`${cmd} ${url}`);
    }
  });
}
listen();
