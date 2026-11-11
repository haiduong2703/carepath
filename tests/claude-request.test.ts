import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createModel, respond, MODEL } from '../server/assistant';

afterEach(() => vi.restoreAllMocks());

function mockAnthropic(text: string) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
    id: 'msg_test', type: 'message', role: 'assistant', model: MODEL,
    content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 110, output_tokens: 30 }
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
}

function sentRequest(fetchMock: ReturnType<typeof mockAnthropic>) {
  const [input, init] = fetchMock.mock.calls[0];
  const url = input instanceof Request ? input.url : String(input);
  expect(new URL(url).origin).toBe('https://api.anthropic.com');
  expect(new URL(url).pathname).toBe('/v1/messages');
  const body = JSON.parse(init?.body as string);
  expect(body.model).toBe(MODEL);
  expect(body.max_tokens).toBe(500);
  expect(body.thinking).toEqual({ type: 'disabled' });
  expect(body.output_config.effort).toBe('low');
  for (const name of ['temperature', 'top_p', 'top_k', 'reasoning', 'max_completion_tokens', 'store']) expect(body).not.toHaveProperty(name);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return body;
}

describe('Claude Messages API — request format, no network', () => {
  it('sends Claude parameters and records Anthropic usage', async () => {
    const fetchMock = mockAnthropic('Hồ sơ Hà Văn Quyết thuộc chuyên khoa Tiêu hóa [1].');
    const result = await respond({ message: 'Tìm bác sĩ Hà Văn Quyết' }, { ANTHROPIC_API_KEY: 'test-only' });
    const body = sentRequest(fetchMock);
    expect(JSON.stringify(body.messages)).toContain('Hà Văn Quyết');
    expect(result.mode).toBe('llm');
    expect(result.metrics).toMatchObject({ model: MODEL, reasoning: 'low', inputTokens: 110, outputTokens: 30 });
  });

  it('keeps effort and token limits when the judge uses native JSON Schema', async () => {
    const fetchMock = mockAnthropic(JSON.stringify({ passed: true, reason: 'Đúng nguồn.' }));
    const judge = createModel({ ANTHROPIC_API_KEY: 'test-only' }).withStructuredOutput(z.object({ passed: z.boolean(), reason: z.string() }), { name: 'judge_test', method: 'jsonSchema', includeRaw: true });
    const result = await judge.invoke('Đánh giá câu trả lời mẫu.');
    const body = sentRequest(fetchMock);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(result.parsed).toEqual({ passed: true, reason: 'Đúng nguồn.' });
    expect('usage_metadata' in result.raw && result.raw.usage_metadata).toMatchObject({ input_tokens: 110, output_tokens: 30 });
  });
});
