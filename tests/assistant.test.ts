import { describe, it, expect, vi, afterEach } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { respond, createModel, reasoning, redact } from '../server/assistant';
import { search, records } from '../server/retrieval';
import { api } from '../server/api';
import { cases } from '../evals/cases';
afterEach(() => vi.restoreAllMocks());
describe('Public-source retrieval', () => {
  it('has real source URLs, unique IDs and verification dates', () => {
    expect(records.length).toBeGreaterThanOrEqual(15);
    expect(new Set(records.map(r => r.id)).size).toBe(records.length);
    for (const r of records) { expect(new URL(r.url).origin).toBe('https://bookingcare.vn'); expect(r.contentHash).toMatch(/^[a-f0-9]{64}$/); expect(Date.parse(r.fetchedAt)).toBeGreaterThan(0); }
  });
  it('finds an accentless personal name', () => expect(search('Ha Van Quyet')[0].id).toBe('i56'));
  it('does not add unrelated profiles to a known full-name lookup', () => expect(search('Tìm Hà Văn Quyết').map(r => r.id)).toEqual(['i56']));
  it('does not show Hanoi doctors as HCM doctors', () => { const hits = search('Hà Văn Quyết', { city: 'TP. Hồ Chí Minh' }); expect(hits.every(r => r.city === 'TP. Hồ Chí Minh' || r.city === 'Toàn quốc')).toBe(true); expect(hits.some(r => r.id === 'i56')).toBe(false); });
  it('does not invent unsupported cities', () => expect(search('nơi khám ở Đà Nẵng')).toEqual([]));
  it('represents national categories without a false single city', () => expect(records.filter(r => r.type === 'specialty').every(r => r.city === 'Toàn quốc')).toBe(true));
  it('keeps named services out of the doctor category', () => expect(records.find(r => r.id === 'i915')?.type).toBe('service'));
});
describe('Conversation and safety', () => {
  it('directs an urgent symptom to emergency help without a model call', async () => { const r = await respond({ message: 'Tôi đau ngực và khó thở' }); expect(r.intent).toBe('emergency'); expect(r.answer).toContain('115'); expect(r.sources).toEqual([]); expect(r.metrics.inputTokens).toBe(0); });
  it('handles a negated symptom without emergency escalation', async () => expect((await respond({ message: 'Tôi không đau ngực, chỉ muốn tìm bác sĩ tiêu hóa' })).intent).toBe('search'));
  it('does not prescribe antibiotics', async () => { const r = await respond({ message: 'Kê đơn kháng sinh cho tôi' }); expect(r.mode).toBe('safety'); expect(r.answer).toContain('không thể'); });
  it('does not claim to book an appointment', async () => { const r = await respond({ message: 'Đặt lịch Hà Văn Quyết ngày mai' }); expect(r.intent).toBe('booking'); expect(r.answer).toContain('chưa truy cập'); expect(r.answer).toContain('xác nhận chính thức'); });
  it('does not label lookup as AI', async () => { const r = await respond({ message: 'Tìm Hà Văn Quyết' }); expect(r.mode).toBe('lookup'); expect(r.metrics.model).toBeNull(); expect(r.notice).toContain('không do LLM'); });
  it('uses the prior need on a city follow-up', async () => { const r = await respond({ message: 'Hà Nội', history: [{ role: 'user', content: 'Tìm bác sĩ tiêu hóa' }] }); expect(r.sources.some(s => s.id === 'i56' || s.id === 's22')).toBe(true); });
  it('redacts common identifiers before sending model context', () => { const r = redact('email me test@example.com phone 0912345678 CCCD 012345678901'); expect(r).not.toContain('test@example.com'); expect(r).not.toContain('0912345678'); expect(r).not.toContain('012345678901'); });
  it('enforces the requested model/effort/output policy', () => { const m = createModel({ OPENAI_API_KEY: 'test-only' }); expect(m.model).toBe('gpt-5.4'); expect(m.maxTokens).toBe(500); expect(reasoning({})).toBe('none'); expect(() => reasoning({ REASONING_EFFORT: 'high' })).toThrow(); });
  it('includes real source context and question in a live prompt and records provider usage', async () => {
    const invoke = vi.spyOn(ChatOpenAI.prototype, 'invoke').mockResolvedValue(new AIMessage({ content: 'Thông tin tiêu hóa [1].', usage_metadata: { input_tokens: 120, output_tokens: 35, total_tokens: 155 } }) as never);
    const r = await respond({ message: 'Tìm bác sĩ Hà Văn Quyết' }, { OPENAI_API_KEY: 'test-only' });
    const prompt = JSON.stringify(invoke.mock.calls[0][0]); expect(prompt).toContain('Hà Văn Quyết'); expect(prompt).not.toContain('{context}'); expect(prompt).not.toContain('{question}');
    expect(r.mode).toBe('llm'); expect(r.metrics.inputTokens).toBe(120); expect(r.metrics.outputTokens).toBe(35);
  });
  it('does not manufacture zero usage on provider failure', async () => { vi.spyOn(ChatOpenAI.prototype, 'invoke').mockRejectedValue(new Error('timeout')); const r = await respond({ message: 'Thông tin Hà Văn Quyết' }, { OPENAI_API_KEY: 'test-only' }); expect(r.mode).toBe('fallback'); expect(r.metrics.inputTokens).toBeNull(); expect(r.metrics.outputTokens).toBeNull(); });
});
describe('HTTP contract', () => {
  const post = (body: unknown, extra: Record<string, string> = {}) => new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'oai-authenticated-user-id': Math.random().toString(), ...extra }, body: JSON.stringify(body) });
  it('rejects malformed payloads', async () => expect((await api(post({ message: '' }), {})).status).toBe(400));
  it('rejects overlong questions', async () => expect((await api(post({ message: 'a'.repeat(2001) }), {})).status).toBe(400));
  it('rejects cross-origin requests', async () => expect((await api(post({ message: 'hello' }, { origin: 'https://evil.example' }), {})).status).toBe(403));
  it('rejects unknown search filters', async () => expect((await api(new Request('http://localhost/api/search?type=admin'), {})).status).toBe(400));
  it('rate-limits repeated requests', async () => { const headers = { 'oai-authenticated-user-id': 'rate-test' }; for (let i = 0; i < 20; i++) await api(post({ message: 'Chào' }, headers), {}); expect((await api(post({ message: 'Chào' }, headers), {})).status).toBe(429); });
  it('contains 120 unique questions across 12 groups', () => { expect(cases).toHaveLength(120); expect(new Set(cases.map(c => c.id)).size).toBe(120); expect(new Set(cases.map(c => c.question)).size).toBe(120); expect(new Set(cases.map(c => c.group)).size).toBe(12); });
});
