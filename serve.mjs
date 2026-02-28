#!/usr/bin/env node
/**
 * Lightweight static file server for the Next.js static export (out/).
 * Supports BASE_PATH for sub-path deployment and PORT for custom port.
 *
 * Usage:
 *   npm run serve                          # http://localhost:3000/
 *   PORT=8080 npm run serve                # http://localhost:8080/
 *   BASE_PATH=/fab-craft-3d npm run serve   # http://localhost:3000/fab-craft-3d/
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const OUT_DIR   = join(__dirname, 'out');
const PORT      = Number(process.env.PORT) || 3000;
const BASE      = (process.env.BASE_PATH || '').replace(/\/+$/, '');  // strip trailing slash

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json',
};

async function tryFile(filePath) {
  try {
    const s = await stat(filePath);
    if (s.isFile()) return await readFile(filePath);
  } catch { /* not found */ }
  return null;
}

const server = createServer(async (req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);

  // Strip basePath prefix
  if (BASE && url.startsWith(BASE)) {
    url = url.slice(BASE.length) || '/';
  } else if (BASE && url === '/') {
    // Redirect root to basePath
    res.writeHead(302, { Location: `${BASE}/` });
    res.end();
    return;
  }

  // Try exact file → directory/index.html → .html extension → 404
  let body = await tryFile(join(OUT_DIR, url));

  if (!body && url.endsWith('/')) {
    body = await tryFile(join(OUT_DIR, url, 'index.html'));
  }

  if (!body && !extname(url)) {
    // Try appending /index.html then .html (Next.js static export patterns)
    body = await tryFile(join(OUT_DIR, url, 'index.html'));
    if (!body) body = await tryFile(join(OUT_DIR, url + '.html'));
  }

  if (!body) {
    // SPA fallback: serve index.html for client-side routing
    body = await tryFile(join(OUT_DIR, 'index.html'));
  }

  if (!body) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext  = extname(url) || '.html';
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(body);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}${BASE || ''}/`;
  console.log(`Serving out/ at ${url}`);
});
