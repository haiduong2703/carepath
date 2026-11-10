import { z } from 'zod';
import { records, search } from './retrieval';
import { respond, type Env } from './assistant';
import ingestion from '../data/ingestion.json';
import evaluation from '../reports/summary.json';
const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  city: z.enum(['', 'Hà Nội', 'TP. Hồ Chí Minh']).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(6).optional()
}).strict();
const visits = new Map<string, { at: number; count: number }>();
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
export async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, llmConfigured: !!env.OPENAI_API_KEY, mode: env.OPENAI_API_KEY ? 'llm' : 'lookup', model: env.OPENAI_API_KEY ? 'gpt-5.4' : null, totalRecords: records.length, ingestion });
  if (url.pathname === '/api/evaluation' && request.method === 'GET') return json(evaluation);
  if (url.pathname === '/api/search' && request.method === 'GET') {
    const q = (url.searchParams.get('q') || '').slice(0, 200);
    const city = url.searchParams.get('city') || '';
    const type = url.searchParams.get('type') || '';
    if (!['', 'doctor', 'facility', 'specialty', 'service'].includes(type) || !['', 'Hà Nội', 'TP. Hồ Chí Minh'].includes(city)) return json({ error: 'Bộ lọc không hợp lệ.' }, 400);
    const items = search(q, { city, type: type as '' | 'doctor' | 'facility' | 'specialty' | 'service', limit: 30 });
    return json({ items, total: items.length });
  }
  if (url.pathname === '/api/chat') {
    if (request.method !== 'POST') return json({ error: 'Chỉ hỗ trợ POST.' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Yêu cầu phải là JSON.' }, 415);
    const key = request.headers.get('oai-authenticated-user-id') || request.headers.get('cf-connecting-ip') || 'local';
    const now = Date.now(), v = visits.get(key);
    if (v && now - v.at < 60000 && v.count >= 20) return json({ error: 'Bạn gửi quá nhanh. Vui lòng thử lại sau một phút.' }, 429);
    if (visits.size > 10000) visits.clear();
    visits.set(key, v && now - v.at < 60000 ? { at: v.at, count: v.count + 1 } : { at: now, count: 1 });
    if (Number(request.headers.get('content-length') || 0) > 24000) return json({ error: 'Nội dung quá dài.' }, 413);
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: 'Thiếu nội dung.' }, 400);
      const chunks: Uint8Array[] = []; let length = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 24000) { await reader.cancel(); return json({ error: 'Nội dung quá dài.' }, 413); } chunks.push(value); }
      const combined = new Uint8Array(length); let at = 0; for (const c of chunks) { combined.set(c, at); at += c.length; }
      const parsed = chatSchema.safeParse(JSON.parse(new TextDecoder().decode(combined)));
      if (!parsed.success) return json({ error: 'Câu hỏi tối đa 2.000 ký tự, lịch sử tối đa 6 tin nhắn.' }, 400);
      return json(await respond(parsed.data, env));
    } catch { return json({ error: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }, 400); }
  }
  return json({ error: 'Không tìm thấy API.' }, 404);
}
