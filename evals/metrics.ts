import type { ChatResult } from '../src/shared';
import type { Verdict } from './judge';
export interface EvalRow {
  id: string; group: string; question: string; expected: string; result: ChatResult;
  checks: { passed: boolean; issues: string[] };
  httpStatus: number | null; httpLatencyMs: number | null; transportError: string | null;
  judge: Verdict | null; judgeUsage: { input_tokens?: number; output_tokens?: number } | null; judgeError: string | null;
}
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const percentile = (a: number[], p: number) => a.length ? [...a].sort((x, y) => x - y)[Math.ceil(a.length * p) - 1] : null;
export function aggregate(rows: EvalRow[], live: boolean) {
  const http = rows.map(r => r.httpLatencyMs).filter((n): n is number => n !== null);
  const allUsageKnown = rows.every(r => r.result.mode !== 'fallback' && r.result.metrics.inputTokens !== null && r.result.metrics.outputTokens !== null);
  const lm = rows.filter(r => r.result.mode === 'llm');
  const metrics = (a: EvalRow[]) => ({ total: a.length,
    meanHttpLatencyMs: mean(a.map(r => r.httpLatencyMs).filter((n): n is number => n !== null)),
    meanServiceLatencyMs: mean(a.map(r => r.result.metrics.latencyMs)),
    meanInputTokens: a.length && a.every(r => r.result.metrics.inputTokens !== null) ? mean(a.map(r => r.result.metrics.inputTokens!)) : null,
    meanOutputTokens: a.length && a.every(r => r.result.metrics.outputTokens !== null) ? mean(a.map(r => r.result.metrics.outputTokens!)) : null });
  const meanLatencyMs = mean(http), meanInputTokens = allUsageKnown ? mean(rows.map(r => r.result.metrics.inputTokens!)) : null, meanOutputTokens = allUsageKnown ? mean(rows.map(r => r.result.metrics.outputTokens!)) : null;
  const fallbackTurns = rows.filter(r => r.result.mode === 'fallback').length, transportErrors = rows.filter(r => r.transportError || r.httpStatus !== 200).length;
  const judged = rows.filter(r => r.judge);
  const groups = [...new Set(rows.map(r => r.group))].map(group => { const a = rows.filter(r => r.group === group); return { group, total: a.length, rulesPassed: a.filter(r => r.checks.passed).length, judged: a.filter(r => r.judge).length, passed: a.filter(r => r.checks.passed && r.judge?.passed).length }; });
  return {
    total: rows.length, llmJudged: judged.length, rulesPassed: rows.filter(r => r.checks.passed).length, judgePassed: rows.filter(r => r.checks.passed && r.judge?.passed).length,
    judgeErrors: rows.filter(r => r.judgeError).length, llmTurns: lm.length, safetyTurns: rows.filter(r => r.result.mode === 'safety').length, lookupTurns: rows.filter(r => r.result.mode === 'lookup').length,
    fallbackTurns, transportErrors,
    meanLatencyMs: live ? meanLatencyMs : null, meanServiceLatencyMs: live ? mean(rows.map(r => r.result.metrics.latencyMs)) : null,
    p50LatencyMs: live ? percentile(http, .5) : null, p95LatencyMs: live ? percentile(http, .95) : null,
    meanInputTokens: live ? meanInputTokens : null, meanOutputTokens: live ? meanOutputTokens : null,
    latencyPass: live && http.length === rows.length && meanLatencyMs !== null ? meanLatencyMs <= 10000 && fallbackTurns === 0 && transportErrors === 0 : null,
    inputPass: live && meanInputTokens !== null ? meanInputTokens <= 30000 : null, outputPass: live && meanOutputTokens !== null ? meanOutputTokens <= 500 : null,
    offlineLookupMeanMs: live ? null : meanLatencyMs, llmOnly: metrics(lm), groups,
    judgeTokenTotals: { input: judged.reduce((s, r) => s + (r.judgeUsage?.input_tokens ?? 0), 0), output: judged.reduce((s, r) => s + (r.judgeUsage?.output_tokens ?? 0), 0) }
  };
}
