import type { IncomingMessage, ServerResponse } from 'node:http';
import { api } from '../server/api';
export async function handleApi(req: IncomingMessage, res: ServerResponse) {
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const part of req) { size += part.length; if (size > 24000) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Nội dung quá dài.' })); return; } chunks.push(part); }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const method = req.method || 'GET';
    const body = Buffer.concat(chunks);
    const request = new Request(`http://${req.headers.host || '127.0.0.1:8787'}${req.url}`, { method, headers, ...(method !== 'GET' && method !== 'HEAD' ? { body } : {}) });
    const response = await api(request, process.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Máy chủ tạm thời không xử lý được yêu cầu.' })); }
}
