import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { handleApi } from './http-adapter';
const root = resolve('dist/client');
const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) { await handleApi(req, res); return; }
  try {
    const path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    const target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!target.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(target);
    const ext = target.slice(target.lastIndexOf('.'));
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(Number(process.env.PORT || 8787), '127.0.0.1', () => console.log(`CarePath Local: http://127.0.0.1:${process.env.PORT || 8787}`));
