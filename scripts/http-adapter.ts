import type { IncomingMessage, ServerResponse } from 'node:http';
import { api } from '../server/api';
import type { Env } from '../server/assistant';
import { localEnv } from './auth-file-store';
export async function handleApi(req: IncomingMessage, res: ServerResponse, env: Env = localEnv()) {
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const part of req) { size += part.length; if (size > 24000) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Nội dung quá dài.' })); return; } chunks.push(part); }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    headers.set('cf-connecting-ip',req.socket.remoteAddress ?? 'local');
    const method = req.method || 'GET';
    const body = Buffer.concat(chunks);
    const request = new Request(`http://${req.headers.host || '127.0.0.1:8787'}${req.url}`, { method, headers, ...(method !== 'GET' && method !== 'HEAD' ? { body } : {}) });
    const response = await api(request, env);
    const responseHeaders: Record<string,string|string[]> = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) responseHeaders['set-cookie'] = cookies;
    res.writeHead(response.status, responseHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Máy chủ tạm thời không xử lý được yêu cầu.' })); }
}
