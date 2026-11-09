#!/usr/bin/env node
// Tiny static server for dist/ (used by the tests and for local previews): node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = +(process.argv[2] || process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(dist, p));
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Serving dist/ on http://localhost:${port}/`));
