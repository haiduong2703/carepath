import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { createModel, MODEL, reasoning } from '../server/assistant';
import { handleApi } from './http-adapter';
import type { ChatRequest, ChatResult } from '../src/shared';

// Run explicitly with npm run test:live. At most four paid model requests:
// one short connectivity probe, then three real HTTP chat scenarios.
// Never log raw SDK errors: authentication errors may contain part of a key.
const report: {
  generatedAt: string; status: string; model: string; reasoning: string;
  preflight: unknown; scenarios: unknown[]; summary?: unknown;
} = { generatedAt: new Date().toISOString(), status: 'started', model: MODEL, reasoning: 'low', preflight: null, scenarios: [] };

function safeFailure(error: unknown) {
  const e = error as { status?: unknown; code?: unknown; name?: string; type?: unknown; message?: unknown; error?: { code?: unknown; type?: unknown }; cause?: { code?: unknown } };
  const status = typeof e?.status === 'number' ? e.status : null;
  const codeValue = e?.code ?? e?.error?.code ?? e?.cause?.code;
  const allowed = ['authentication_error', 'permission_error', 'invalid_request_error', 'rate_limit_error', 'overloaded_error', 'not_found_error', 'api_error', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'EPERM', 'EACCES', 'ETIMEDOUT'];
  const code = typeof codeValue === 'string' && allowed.includes(codeValue) ? codeValue : null;
  const typeValue = e?.type ?? e?.error?.type;
  const type = typeof typeValue === 'string' && allowed.includes(typeValue) ? typeValue : null;
  // Some LangChain/SDK versions keep the provider explanation only in message.
  // Record a classified label, never the raw text or authentication headers.
  const messageSuggestsQuota = typeof e?.message === 'string' && /credit balance|insufficient credits|billing limit/i.test(e.message);
  const timeout = e?.name === 'AbortError' || e?.name === 'TimeoutError' || e?.name === 'APIConnectionTimeoutError';
  const hint = status === 401 ? 'Khóa không được Anthropic chấp nhận. Kiểm tra đúng khóa API trong .env.'
    : messageSuggestsQuota ? 'Tài khoản Anthropic không đủ credits; kiểm tra hạn mức tại Claude Console.'
    : status === 429 ? 'Anthropic giới hạn tốc độ hoặc hạn mức. Chưa tiếp tục gọi các ca còn lại.'
    : status === 403 ? 'Project hoặc khóa chưa có quyền gọi yêu cầu này.'
    : status === 404 ? 'Không truy cập được model hoặc endpoint đã cấu hình.'
    : timeout ? 'Yêu cầu vượt thời gian 8,5 giây. Chưa xác minh được model phản hồi thành công.'
    : 'Lệnh gọi thất bại. Kiểm tra mạng và cấu hình; chi tiết lỗi thô được giữ kín để tránh lộ khóa.';
  return { status, code, type, messageSuggestsQuota, timeout, hint };
}

async function save() {
  await mkdir('reports', { recursive: true });
  await writeFile('reports/live-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log('Báo cáo: reports/live-smoke.json');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    report.status = 'missing-key';
    report.preflight = { ok: false, hint: 'Thiếu ANTHROPIC_API_KEY. Đặt khóa trong .env, không phải .env.example.' };
    console.log('Chưa nhận được khóa API.');
    await save(); process.exitCode = 1; return;
  }
  const start = performance.now();
  try {
    report.reasoning = reasoning(process.env);
    const response = await createModel({ ...process.env, CLAUDE_EFFORT: 'low' }, 32).invoke('Chỉ trả lời đúng một từ: OK.', { signal: AbortSignal.timeout(8500) });
    const content = typeof response.content === 'string' ? response.content.trim() : '';
    if (!content) throw new Error('Empty model response');
    report.preflight = { ok: true, latencyMs: Math.round(performance.now() - start), inputTokens: response.usage_metadata?.input_tokens ?? null, outputTokens: response.usage_metadata?.output_tokens ?? null };
    console.log('Kết nối Claude Haiku 5.5 thành công; bắt đầu thử qua HTTP.');
  } catch (error) {
    const failure = safeFailure(error);
    report.status = 'preflight-failed';
    report.preflight = { ok: false, latencyMs: Math.round(performance.now() - start), ...failure };
    console.log(JSON.stringify(report.preflight, null, 2));
    await save(); process.exitCode = 1; return;
  }

  const server = createServer((req, res) => { void handleApi(req, res); });
  const measured: { latencyMs: number; inputTokens: number; outputTokens: number }[] = [];
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const healthResponse = await fetch(base + '/api/health', { signal: AbortSignal.timeout(5000) });
    const health = await healthResponse.json() as { llmConfigured?: boolean };
    if (!healthResponse.ok || !health.llmConfigured) throw new Error('Live server did not receive the key');
    const scenarios: { id: string; input: ChatRequest }[] = [
      { id: 'find-doctor', input: { message: 'Tìm bác sĩ Hà Văn Quyết khám chuyên khoa gì?', city: 'Hà Nội' } },
      { id: 'find-facility', input: { message: 'Tôi muốn tìm xét nghiệm tại Diag ở TP. Hồ Chí Minh', city: 'TP. Hồ Chí Minh' } },
      { id: 'booking', input: { message: 'Hướng dẫn đặt lịch bác sĩ Hà Văn Quyết sáng mai', city: 'Hà Nội' } }
    ];
    for (const scenario of scenarios) {
      const startedAt = performance.now();
      const response = await fetch(base + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(scenario.input), signal: AbortSignal.timeout(12000) });
      const result = await response.json() as ChatResult;
      const latencyMs = Math.round(performance.now() - startedAt);
      const passed = response.ok && result.mode === 'llm' && !!result.answer?.trim() && result.metrics?.inputTokens !== null && result.metrics?.outputTokens !== null;
      report.scenarios.push({ id: scenario.id, input: scenario.input, httpStatus: response.status, passed, endToEndLatencyMs: latencyMs, result });
      if (passed) measured.push({ latencyMs, inputTokens: result.metrics.inputTokens!, outputTokens: result.metrics.outputTokens! });
      console.log(JSON.stringify({ id: scenario.id, passed, mode: result.mode, latencyMs, inputTokens: result.metrics?.inputTokens, outputTokens: result.metrics?.outputTokens, answer: result.answer }, null, 2));
    }
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const completed = measured.length === scenarios.length;
    report.status = completed ? 'live-smoke-complete' : 'live-smoke-incomplete';
    report.summary = {
      total: scenarios.length, llmSucceeded: measured.length,
      meanEndToEndLatencyMs: completed ? mean(measured.map(r => r.latencyMs)) : null,
      meanInputTokens: completed ? mean(measured.map(r => r.inputTokens)) : null,
      meanOutputTokens: completed ? mean(measured.map(r => r.outputTokens)) : null,
      note: 'Thử kết nối và 3 câu hỏi qua HTTP localhost; không phải bộ đánh giá 120 ca hoặc LLM-as-judge. Warm-up probe không tính vào trung bình.'
    };
    console.log(JSON.stringify(report.summary, null, 2));
    if (!completed) process.exitCode = 1;
  } catch (error) {
    report.status = 'live-smoke-failed';
    report.scenarios.push({ error: safeFailure(error) });
    process.exitCode = 1;
  } finally {
    if (server.listening) await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    await save();
  }
}
await main();
