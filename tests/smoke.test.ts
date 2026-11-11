/**
 * Chạy: npm run test:smoke
 * Tự mở HTTP server trên cổng trống, không cần chạy npm run dev.
 * Luôn tắt ANTHROPIC_API_KEY trong môi trường test, không gọi API có tính phí.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { handleApi } from '../scripts/http-adapter';
import type { CareRecord, ChatRequest, ChatResult } from '../src/shared';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Không dùng khóa thật ngay cả khi người chạy đã đặt khóa trong terminal.
  vi.stubEnv('ANTHROPIC_API_KEY', undefined);
  server = createServer((req, res) => { void handleApi(req, res, { AUTH_MODE:'disabled' }); });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
  } finally {
    vi.unstubAllEnvs();
  }
});

async function get<T>(path: string) {
  const response = await fetch(baseUrl + path, { signal: AbortSignal.timeout(5000) });
  return { response, body: await response.json() as T };
}

async function post(body: unknown, extraHeaders: Record<string, string> = {}) {
  return fetch(baseUrl + '/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Mỗi ca độc lập với hạn mức của các ca khác.
      'oai-authenticated-user-id': `smoke-${randomUUID()}`,
      ...extraHeaders
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
}

async function chat(input: ChatRequest): Promise<ChatResult> {
  const response = await post(input);
  expect(response.status).toBe(200);
  return response.json();
}

describe('CarePath — thử luồng sử dụng qua HTTP, không cần API key', () => {
  it('Máy chủ sẵn sàng và có dữ liệu tra cứu', async () => {
    const { response, body } = await get<{ ok: boolean; mode: string; llmConfigured: boolean; totalRecords: number }>('/api/health');
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.llmConfigured).toBe(false);
    expect(body.mode).toBe('lookup');
    expect(body.totalRecords).toBeGreaterThan(0);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('Tìm đúng Hà Văn Quyết bằng tên không dấu', async () => {
    const { response, body } = await get<{ items: CareRecord[]; total: number }>('/api/search?q=Ha%20Van%20Quyet');
    expect(response.status).toBe(200);
    expect(body.items.map(record => record.id)).toEqual(['i56']);
    expect(body.total).toBe(body.items.length);
    expect(new URL(body.items[0].url).origin).toBe('https://bookingcare.vn');
  });

  it('Tìm cơ sở Doctor Check bằng bộ lọc loại hồ sơ', async () => {
    const { response, body } = await get<{ items: CareRecord[] }>('/api/search?q=Doctor%20Check&type=facility');
    expect(response.status).toBe(200);
    expect(body.items.some(record => record.id === 'p450')).toBe(true);
    expect(body.items.every(record => record.type === 'facility')).toBe(true);
  });

  it('Lọc bác sĩ tại TP. Hồ Chí Minh', async () => {
    const params = new URLSearchParams({ city: 'TP. Hồ Chí Minh', type: 'doctor' });
    const { response, body } = await get<{ items: CareRecord[] }>(`/api/search?${params}`);
    expect(response.status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every(record => record.city === 'TP. Hồ Chí Minh' && record.type === 'doctor')).toBe(true);
  });

  it('Chat trả hồ sơ đúng, công khai chế độ tra cứu và không tiêu thụ token LLM', async () => {
    const result = await chat({ message: 'Tìm bác sĩ Hà Văn Quyết' });
    expect(result.answer).toContain('Hà Văn Quyết');
    expect(result.sources.map(record => record.id)).toEqual(['i56']);
    expect(result.mode).toBe('lookup');
    expect(result.notice).toContain('không do LLM');
    expect(result.metrics).toMatchObject({ model: null, inputTokens: 0, outputTokens: 0 });
  });

  it('Câu hỏi nối tiếp giữ nhu cầu tiêu hóa khi người dùng bổ sung Hà Nội', async () => {
    const result = await chat({
      message: 'Hà Nội',
      history: [{ role: 'user', content: 'Tìm bác sĩ tiêu hóa' }]
    });
    expect(result.sources.some(record => record.id === 'i56')).toBe(true);
    expect(result.sources.every(record => record.city === 'Hà Nội' || record.city === 'Toàn quốc')).toBe(true);
  });

  it('Đặt lịch được hướng dẫn sang BookingCare, không báo đã đặt thành công', async () => {
    const result = await chat({ message: 'Đặt lịch khám Hà Văn Quyết ngày mai' });
    expect(result.intent).toBe('booking');
    expect(result.answer).toContain('chưa truy cập được lịch trống');
    expect(result.answer).toContain('xác nhận chính thức');
    expect(result.sources.some(record => record.id === 'i56')).toBe(true);
  });

  it('Yêu cầu kê đơn được chuyển sang hướng dẫn an toàn', async () => {
    const result = await chat({ message: 'Kê đơn kháng sinh cho tôi' });
    expect(result.mode).toBe('safety');
    expect(result.intent).toBe('medical');
    expect(result.answer).toContain('không thể chẩn đoán, kê đơn');
    expect(result.sources).toEqual([]);
  });

  it('Tình huống khẩn cấp ưu tiên hướng dẫn cấp cứu', async () => {
    const result = await chat({ message: 'Tôi đang đau ngực và khó thở' });
    expect(result.mode).toBe('safety');
    expect(result.intent).toBe('emergency');
    expect(result.answer).toContain('115');
    expect(result.sources).toEqual([]);
  });

  it('Đọc được báo cáo của bộ đánh giá ít nhất 100 ca', async () => {
    const { response, body } = await get<{ total: number; llmJudged: number }>('/api/evaluation');
    expect(response.status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(100);
    expect(body.llmJudged).toBeGreaterThanOrEqual(0);
    expect(body.llmJudged).toBeLessThanOrEqual(body.total);
  });
});

describe('CarePath — đầu vào không hợp lệ qua HTTP', () => {
  it.each([
    ['câu hỏi rỗng', { message: '' }],
    ['câu hỏi chỉ có khoảng trắng', { message: '   ' }],
    ['câu hỏi vượt 2.000 ký tự', { message: 'a'.repeat(2001) }],
    ['khu vực chưa hỗ trợ', { message: 'Tìm nơi khám', city: 'Đà Nẵng' }],
    ['trường ngoài hợp đồng API', { message: 'Xin chào', model: 'custom-model' }]
  ])('Từ chối %s với HTTP 400', async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty('error');
  });

  it('JSON lỗi cú pháp trả HTTP 400', async () => {
    const response = await fetch(baseUrl + '/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
      signal: AbortSignal.timeout(5000)
    });
    expect(response.status).toBe(400);
  });

  it('Body vượt 24KB bị chặn ở HTTP adapter', async () => {
    const response = await post({ message: 'a'.repeat(24001) });
    expect(response.status).toBe(413);
    expect(await response.json()).toHaveProperty('error');
  });

  it('Content-Type khác JSON trả HTTP 415', async () => {
    expect((await post({ message: 'Xin chào' }, { 'content-type': 'text/plain' })).status).toBe(415);
  });

  it('Origin bên ngoài bị chặn với HTTP 403', async () => {
    expect((await post({ message: 'Xin chào' }, { origin: 'https://example.invalid' })).status).toBe(403);
  });

  it('GET vào endpoint chat trả HTTP 405', async () => {
    expect((await fetch(baseUrl + '/api/chat', { signal: AbortSignal.timeout(5000) })).status).toBe(405);
  });

  it('Endpoint không tồn tại trả HTTP 404', async () => {
    const { response, body } = await get<{ error: string }>('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(body.error).toBeTruthy();
  });
});
