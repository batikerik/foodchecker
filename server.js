// Локальный сервер для разработки и запуска на своей машине.
// На Vercel он не нужен — там работает api/analyze.js.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAnalyze } from "./lib/analyze.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, "public");
const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY = 12 * 1024 * 1024; // 12 МБ

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/analyze") {
    if (req.method !== "POST") {
      return json(res, 405, { error: "Only POST" });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (err) {
      return json(res, err.tooLarge ? 413 : 400, {
        error: err.tooLarge ? "Фото слишком большое." : "Некорректный запрос.",
      });
    }
    const { status, body: payload } = await handleAnalyze(body);
    return json(res, status, payload);
  }

  await serveStatic(url.pathname, res);
});

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      req.destroy();
      throw Object.assign(new Error("body too large"), { tooLarge: true });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_DIR, rel);

  // не выпускаем за пределы public/
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function json(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

server.listen(PORT, () => {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠  GEMINI_API_KEY не задан — запросы будут падать.");
  }
  console.log(`FoodChecker: http://localhost:${PORT}`);
});
