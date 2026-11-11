import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Env } from '../server/assistant';
import type { ChatRequest, ChatResult } from '../src/shared';
import { handleApi } from './http-adapter';
export async function createEvaluationHttp(env: Env) {
  // Isolated loopback-only model evaluation; auth is covered separately by auth.test.ts.
  const server = createServer((req, res) => { void handleApi(req, res, { ...env, AUTH_MODE:'disabled' }); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    async chat(input: ChatRequest) {
      const start = performance.now();
      try {
        const response = await fetch(baseUrl + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(12000) });
        const body = await response.json() as ChatResult, httpLatencyMs = Math.round(performance.now() - start);
        if (!response.ok || !body.metrics || typeof body.answer !== 'string') return { result: failed('Không có phản hồi hội thoại hợp lệ.', httpLatencyMs), httpStatus: response.status, httpLatencyMs, transportError: `HTTP ${response.status}` };
        return { result: body, httpStatus: response.status, httpLatencyMs, transportError: null };
      } catch { const httpLatencyMs = Math.round(performance.now() - start); return { result: failed('Kết nối HTTP lỗi hoặc quá thời gian.', httpLatencyMs), httpStatus: null, httpLatencyMs, transportError: 'http-connection-or-timeout' }; }
    },
    async close() { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); }
  };
}
function failed(answer: string, latencyMs: number): ChatResult {
  return { answer, sources: [], mode: 'fallback', intent: 'unknown', metrics: { latencyMs, inputTokens: null, outputTokens: null, model: null, reasoning: null } };
}
