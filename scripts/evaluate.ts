import { mkdir, readFile, copyFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cases, CASES_VERSION } from '../evals/cases';
import { createModel, MODEL, reasoning, type Env } from '../server/assistant';
import { APP_FACTS } from '../server/app-facts';
import { records } from '../server/retrieval';
import { judgeSchema, judgeMessages, validateVerdict, RUBRIC_VERSION } from '../evals/judge';
import { checkResult } from '../evals/checks';
import { aggregate, type EvalRow } from '../evals/metrics';
import { createEvaluationHttp } from './evaluation-http';

const retryErrors = process.argv.includes('--retry-judge-errors');
const rejudge = process.argv.includes('--rejudge') || retryErrors;
const live = process.argv.includes('--live') || rejudge;
if (!live && !process.argv.includes('--offline')) throw new Error('Chọn --offline hoặc --live.');
if (live && !process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('Thiếu ANTHROPIC_API_KEY; chưa gọi API.');
const env: Env = live ? process.env : {};
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const recorded = rejudge ? JSON.parse(await readFile('reports/live-results.json', 'utf8')) as { summary: Record<string, unknown>; rows: EvalRow[] } : null;
if (recorded && (recorded.summary.casesSha256 !== sha(cases) || recorded.summary.datasetSha256 !== sha(records) || recorded.summary.appFactsSha256 !== sha(APP_FACTS) || recorded.rows.length !== cases.length)) throw new Error('Không thể chấm lại: câu hỏi, dữ liệu hoặc APP_FACTS đã thay đổi; cần chạy --live mới.');
if (retryErrors && recorded?.summary.rubricVersion !== RUBRIC_VERSION) throw new Error('Retry lỗi cần cùng phiên bản rubric; dùng --rejudge nếu đã thay rubric.');
await mkdir('reports', { recursive: true });
let baseline: { summary: Record<string, unknown>; archive: string } | null = null;
if (live) {
  try {
    const old = JSON.parse(await readFile('reports/live-results.json', 'utf8'));
    if (old.summary?.generatedAt) {
      const archive = 'reports/history/' + String(old.summary.generatedAt).replace(/[^a-zA-Z0-9-]/g, '-');
      await mkdir(archive, { recursive: true });
      for (const file of ['live-results.json', 'live-results.csv', 'live-report.md', 'summary.json']) {
        try { await access(`${archive}/${file}`); } catch { try { await copyFile(`reports/${file}`, `${archive}/${file}`); } catch { /* Old reports may omit a format. */ } }
      }
      baseline = { summary: old.summary, archive };
      console.log(`Đã giữ nguyên kết quả cũ tại ${archive}`);
    }
  } catch { /* First evaluation. */ }
}
const judge = live ? createModel({ ...env, CLAUDE_EFFORT: 'medium' }).withStructuredOutput(judgeSchema, { name: 'carepath_judge', method: 'jsonSchema', includeRaw: true }) : null;
const http = rejudge ? null : await createEvaluationHttp(env);
const rows: EvalRow[] = [];
let reusedJudgeResults = 0;
const generatedAt = new Date().toISOString();
try {
  for (const c of cases) {
    const startedAt = performance.now();
    const prior = recorded?.rows.find(r => r.id === c.id && r.question === c.question);
    if (rejudge && !prior) throw new Error(`Thiếu đáp án được ghi nhận: ${c.id}`);
    const measured = prior ? { result: prior.result, httpStatus: prior.httpStatus, httpLatencyMs: prior.httpLatencyMs, transportError: prior.transportError } : await http!.chat({ message: c.question, city: c.city, history: c.history });
    const row: EvalRow = { id: c.id, group: c.group, question: c.question, expected: c.expected, ...measured, checks: checkResult(c, measured.result), judge: null, judgeUsage: null, judgeError: null };
    if (retryErrors && prior?.judge && !prior.judgeError) {
      row.judge = prior.judge; row.judgeUsage = prior.judgeUsage; reusedJudgeResults++;
    } else if (judge) {
      try {
        const judged = await judge.invoke(judgeMessages(c, row.result), { signal: AbortSignal.timeout(8500) });
        if (!judged.parsed) throw new Error('Missing judge output');
        row.judge = validateVerdict(judged.parsed);
        row.judgeUsage = 'usage_metadata' in judged.raw ? judged.raw.usage_metadata as EvalRow['judgeUsage'] : null;
      } catch { row.judgeError = 'judge-timeout-api-or-schema-error'; }
    }
    rows.push(row);
    console.log(`${rows.length}/${cases.length} ${c.id}: rules ${row.checks.passed ? 'OK' : 'FAIL'}; HTTP ${row.httpStatus ?? 'ERROR'} ${row.httpLatencyMs}ms${live ? `; judge ${row.judge ? row.judge.passed ? 'PASS' : 'FAIL' : 'ERROR'}` : ''}`);
    if (live) await writeFile('reports/live-results.partial.json', JSON.stringify({ generatedAt, rubricVersion: RUBRIC_VERSION, completed: rows.length, total: cases.length, rows }, null, 2) + '\n');
    // One client, 20 chat requests/minute. Judge and pacing are not response time.
    const waitMs = (retryErrors && prior?.judge && !prior.judgeError ? 0 : rejudge ? 1000 : 3100) - (performance.now() - startedAt);
    if (waitMs > 0 && rows.length < cases.length) await new Promise(resolve => setTimeout(resolve, waitMs));
  }
} finally { await http?.close(); }
const counts = aggregate(rows, live);
const summary = {
  status: live ? counts.llmJudged === cases.length && counts.transportErrors === 0 ? 'live-complete' : 'live-incomplete' : 'offline-only',
  generatedAt, completedAt: new Date().toISOString(), provider: 'anthropic', model: live ? MODEL : null,
  reasoning: live ? reasoning(env) : null, thinking: live ? 'disabled' : null, judgeModel: live ? MODEL : null, judgeEffort: live ? 'medium' : null,
  evaluationMode: retryErrors ? 'retry-only-judge-errors' : rejudge ? 'rejudge-recorded-http-responses' : 'fresh-http-run', responsesGeneratedAt: recorded?.summary.responsesGeneratedAt ?? recorded?.summary.generatedAt ?? generatedAt,
  reusedJudgeResults, newJudgeRequests: live ? cases.length - reusedJudgeResults : 0,
  casesVersion: CASES_VERSION, casesSha256: sha(cases), rubricVersion: RUBRIC_VERSION,
  appFactsVersion: APP_FACTS.version, appFactsSha256: sha(APP_FACTS), datasetSha256: sha(records),
  measurement: 'localhost-http-full-json-response', scoringRule: 'all-four-scores-at-least-4-and-rule-checks', passFlagSource: 'computed-from-scores', ...counts,
  baseline: baseline ? { archive: baseline.archive, generatedAt: baseline.summary.generatedAt, total: baseline.summary.total, judgePassed: baseline.summary.judgePassed, rubricVersion: baseline.summary.rubricVersion ?? 'legacy-v1', measurement: baseline.summary.measurement ?? 'direct-service' } : null,
  note: (rejudge ? 'CHẤM LẠI đáp án HTTP đã ghi nhận: không gọi lại trợ lý và không đo lại thời gian/token hội thoại. Xem responsesGeneratedAt để biết thời điểm gốc. ' : '') + 'Đo qua HTTP localhost từ trước fetch đến sau khi đọc JSON đầy đủ. Chưa gồm Internet/trình duyệt của người dùng. Thời gian service ghi riêng; không tính judge và nhịp chờ giới hạn tốc độ. Token lấy từ usage API; lượt quy tắc dùng 0, lượt lỗi không biết usage giữ null. Token judge tách riêng. Cùng họ mô hình chấm có thể thiên lệch; cần rà mẫu thủ công. Các phiên bản thay rubric/cách đo nên không thể quy mọi thay đổi điểm cho mô hình.'
};
const prefix = live ? 'live' : 'offline';
await writeFile(`reports/${prefix}-results.json`, JSON.stringify({ summary, rows }, null, 2) + '\n');
await writeFile(`reports/${prefix}-results.csv`, '\uFEFFid,group,rule_pass,mode,http_status,http_latency_ms,service_latency_ms,input_tokens,output_tokens,judge_pass,judge_error\n' + rows.map(r => [r.id, r.group, r.checks.passed, r.result.mode, r.httpStatus ?? '', r.httpLatencyMs ?? '', r.result.metrics.latencyMs, r.result.metrics.inputTokens ?? '', r.result.metrics.outputTokens ?? '', r.judge?.passed ?? '', r.judgeError ?? ''].join(',')).join('\n') + '\n');
// Offline diagnostics never replace the latest measured live dashboard report.
await writeFile(live ? 'reports/summary.json' : 'reports/offline-summary.json', JSON.stringify(summary, null, 2) + '\n');
const n = (v: number | null) => v === null ? 'chưa đo' : v.toFixed(2);
const failed = rows.filter(r => !r.checks.passed || (live && !r.judge?.passed));
const md = `# Báo cáo CarePath — ${live ? 'LLM-as-judge' : 'ngoại tuyến'}\n\nTrạng thái: **${summary.status}**. Thời điểm UTC: ${generatedAt}.\n\n${summary.note}\n\n## Kết quả\n\n- Tổng số ca: ${counts.total}; được LLM chấm: ${counts.llmJudged}.\n- Đạt quy tắc: ${counts.rulesPassed}/${counts.total}; đạt cả judge và quy tắc: ${counts.judgePassed}/${counts.total}.\n- Lượt Claude: ${counts.llmTurns}; an toàn theo quy tắc: ${counts.safetyTurns}; tra cứu: ${counts.lookupTurns}.\n- Lỗi HTTP: ${counts.transportErrors}; lỗi judge: ${counts.judgeErrors}; fallback: ${counts.fallbackTurns}.\n\n| Chỉ số | Toàn bộ lượt | Chỉ lượt Claude | Giới hạn trung bình |\n|---|---:|---:|---:|\n| HTTP đầy đủ (ms) | ${n(summary.meanLatencyMs)} | ${n(live ? counts.llmOnly.meanHttpLatencyMs : null)} | 10.000 |\n| Service (ms) | ${n(summary.meanServiceLatencyMs)} | ${n(live ? counts.llmOnly.meanServiceLatencyMs : null)} | tham khảo |\n| Input token | ${n(summary.meanInputTokens)} | ${n(live ? counts.llmOnly.meanInputTokens : null)} | 30.000 |\n| Output token | ${n(summary.meanOutputTokens)} | ${n(live ? counts.llmOnly.meanOutputTokens : null)} | 500 |\n\nHTTP p50: ${n(summary.p50LatencyMs)} ms; p95: ${n(summary.p95LatencyMs)} ms.\n\nĐạt thời gian/input/output: ${summary.latencyPass ?? 'chưa đo'} / ${summary.inputPass ?? 'chưa đo'} / ${summary.outputPass ?? 'chưa đo'}.\n\n| Nhóm | Số ca | Đạt quy tắc | Được LLM chấm | Đạt cả hai |\n|---|---:|---:|---:|---:|\n${counts.groups.map(g => `| ${g.group} | ${g.total} | ${g.rulesPassed} | ${g.judged} | ${g.passed} |`).join('\n')}\n\n## Ca cần xem lại\n\n${failed.length ? failed.map(r => `- **${r.id}**: ${r.checks.issues.join('; ') || r.judge?.reason || r.judgeError || 'chưa có kết quả judge'}`).join('\n') : live ? 'Không có ca không đạt trong lần chạy này; không coi đây là bảo đảm cho mọi câu hỏi.' : 'Không có lỗi quy tắc; nội dung chưa được LLM chấm.'}\n\n## Phương pháp và truy vết\n\nModel ${MODEL}, effort low/medium, thinking disabled, max_tokens=500. Judge dùng medium và JSON Schema. Chương trình tính đạt từ bốn điểm >=4 cùng các kiểm tra quy tắc đạt; không dùng cờ passed độc lập của mô hình. APP_FACTS chỉ xác minh hành vi ứng dụng, không thay thế nguồn y tế. Không xóa ca khó hoặc đổi điểm đã đo; ngưỡng chấm giữ nguyên.\n\nCases: ${CASES_VERSION}; rubric: ${RUBRIC_VERSION}; dữ liệu SHA-256: ${summary.datasetSha256}.\n\n${baseline ? `Kết quả cũ giữ nguyên tại [bản trước](${baseline.archive.replace('reports/', '')}/live-report.md), đạt ${String(baseline.summary.judgePassed)}/${String(baseline.summary.total)}. Rubric và cách đo đã thay đổi nên không so sánh như thí nghiệm chỉ thay mô hình.` : 'Không có baseline kèm lần chạy này.'}\n\nToken judge: ${live ? `${counts.judgeTokenTotals.input} input / ${counts.judgeTokenTotals.output} output` : 'chưa gọi'}, không cộng vào token hội thoại. Chi tiết từng ca: ${prefix}-results.json và ${prefix}-results.csv.\n\nChạy lại từ thư mục carepath: \`npm run eval:live\`. Lệnh gọi API có tính phí. Offline dùng \`npm run eval:offline\` và không ghi đè summary live.\n`;
await writeFile(`reports/${prefix}-report.md`, md);
console.log(JSON.stringify(summary, null, 2));
if (counts.rulesPassed < cases.length || (live && (counts.llmJudged < cases.length || counts.transportErrors > 0 || counts.fallbackTurns > 0))) process.exitCode = 1;
