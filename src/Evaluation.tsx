import { useEffect, useState } from 'react';
import { ArrowDownToLine, Clock3, FileCheck2, Info, Sparkles } from 'lucide-react';
import { apiRequest } from './Auth';
interface Stats { total: number; meanHttpLatencyMs: number | null; meanServiceLatencyMs: number | null; meanInputTokens: number | null; meanOutputTokens: number | null }
interface Report {
  status: string; total: number; llmJudged: number; judgePassed: number; rulesPassed: number;
  llmTurns: number; fallbackTurns: number; judgeErrors: number; transportErrors?: number;
  meanLatencyMs: number | null; meanServiceLatencyMs?: number | null; p50LatencyMs: number | null; p95LatencyMs: number | null;
  meanInputTokens: number | null; meanOutputTokens: number | null;
  latencyPass: boolean | null; inputPass: boolean | null; outputPass: boolean | null;
  measurement?: string; evaluationMode?: string; rubricVersion?: string; responsesGeneratedAt?: string;
  llmOnly?: Stats; groups?: { group: string; total: number; rulesPassed: number; judged: number; passed: number }[];
}
const labels: Record<string, string> = { doctor: 'Bác sĩ', facility: 'Cơ sở y tế', specialty: 'Chuyên khoa', service: 'Dịch vụ', location: 'Khu vực', booking: 'Đặt lịch', factuality: 'Đúng dữ kiện', medical: 'Yêu cầu y khoa', emergency: 'Khẩn cấp', privacy: 'Riêng tư', injection: 'Prompt injection', conversation: 'Hội thoại' };
const number = (v: number | null | undefined) => v == null ? 'Chưa đo' : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const passed = (v: boolean | null | undefined) => v == null ? 'Chưa đo' : v ? 'Đạt ngưỡng' : 'Chưa đạt';

export function EvaluationView({ health }: { health: { totalRecords: number } | null }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { const controller = new AbortController(); apiRequest<Report>('/api/evaluation', { signal: controller.signal }).then(setReport).catch(e => { if (e.name !== 'AbortError') setError(true); }); return () => controller.abort(); }, []);
  const measured = report?.status === 'live-complete' || report?.status === 'live-incomplete';
  const ready = report?.status === 'live-complete';
  const percent = report?.total && report.llmJudged ? 100 * report.judgePassed / report.total : null;
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'carepath-evaluation-summary.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="evaluation-page">
    <div className="section-kicker"><span/> ĐO LƯỜNG MINH BẠCH</div>
    <div className="page-title"><h1>Chất lượng cần<br/><span>được kiểm chứng.</span></h1><p>120 tình huống với Claude Haiku 5.5. {health ? `${health.totalRecords} hồ sơ và danh mục nguồn.` : 'Đang tải dữ liệu nguồn.'}</p></div>
    <div className="report-notice"><Info size={22}/><div><strong>{ready ? 'Đã hoàn tất đánh giá; xem riêng số ca đạt' : measured ? 'Lần đánh giá chưa hoàn tất đầy đủ' : 'Chưa có kết quả LLM-as-judge'}</strong><p>{measured ? 'Hoàn tất chạy không có nghĩa mọi ca đều đạt. Mỗi ca cần cả bốn điểm từ 4/5 và kiểm tra quy tắc đạt. Độ trễ không bao gồm giám khảo hoặc thời gian chờ giữa lượt.' : 'Số liệu tra cứu ngoại tuyến không chứng minh chất lượng, thời gian hoặc token của mô hình. Cần cấu hình khóa trên máy chủ và chạy eval:live.'}</p></div></div>
    {error && <p role="alert">Chưa tải được báo cáo. Vui lòng tải lại trang.</p>}
    <div className="stats-grid">{[
      { value: report ? `${report.llmJudged}/${report.total}` : '—', label: 'Ca được LLM chấm', icon: FileCheck2 },
      { value: percent == null ? 'Chưa đo' : `${number(percent)}%`, label: `Đạt cả judge và quy tắc${report ? ` · ${report.judgePassed}/${report.total}` : ''}`, icon: Sparkles },
      { value: measured ? `${number(report?.meanLatencyMs)} ms` : 'Chưa đo', label: report?.measurement === 'localhost-http-full-json-response' ? 'Trung bình qua HTTP localhost' : 'Trung bình trong service', icon: Clock3 },
      { value: report ? String(report.fallbackTurns + report.judgeErrors + (report.transportErrors || 0)) : '—', label: 'Fallback / lỗi judge / HTTP', icon: Info }
    ].map(({ value, label, icon: Icon }) => <div className="stat" key={label}><Icon size={22}/><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="report-card"><h2>Hiệu năng và mức token</h2>
      <div className="criteria-row"><span>Mô hình</span><strong>Claude Haiku 5.5 · effort tối đa medium</strong></div>
      <div className="criteria-row"><span>HTTP trung bình / lượt · yêu cầu ≤ 10 giây</span><strong>{number(report?.meanLatencyMs)} ms<small>{passed(report?.latencyPass)}</small></strong></div>
      <div className="criteria-row"><span>Input token trung bình · yêu cầu ≤ 30.000</span><strong>{number(report?.meanInputTokens)}<small>{passed(report?.inputPass)}</small></strong></div>
      <div className="criteria-row"><span>Output token trung bình · yêu cầu ≤ 500</span><strong>{number(report?.meanOutputTokens)}<small>{passed(report?.outputPass)}</small></strong></div>
      <div className="criteria-row"><span>HTTP p50 / p95</span><strong>{number(report?.p50LatencyMs)} / {number(report?.p95LatencyMs)} ms</strong></div>
      {measured && report?.llmOnly && <><div className="criteria-row"><span>Chỉ các lượt thực sự gọi Claude</span><strong>{report.llmOnly.total} lượt · {number(report.llmOnly.meanHttpLatencyMs)} ms</strong></div><div className="criteria-row"><span>Token riêng các lượt Claude</span><strong>{number(report.llmOnly.meanInputTokens)} vào / {number(report.llmOnly.meanOutputTokens)} ra</strong></div></>}
      <p>Toàn bộ lượt có cả các phản hồi bằng quy tắc, dùng 0 token LLM. Token giám khảo được ghi riêng. HTTP localhost chưa bao gồm đường truyền Internet và trình duyệt người dùng.</p>
      {measured && report?.evaluationMode && report.evaluationMode !== 'fresh-http-run' && <p>Đây là kết quả chấm lại đáp án HTTP đã ghi nhận. Thời gian và token hội thoại giữ nguyên từ lần thu đáp án, không được đo lại khi chấm.</p>}
    </div>
    {report?.groups && <div className="report-card"><h2>Kết quả từng nhóm</h2><div className="report-table-wrap"><table className="report-table"><thead><tr><th>Nhóm</th><th>Số ca</th><th>Quy tắc</th><th>Đã chấm</th><th>Đạt cả hai</th></tr></thead><tbody>{report.groups.map(g => <tr key={g.group}><td>{labels[g.group] || g.group}</td><td>{g.total}</td><td>{g.rulesPassed}</td><td>{g.judged}</td><td>{g.passed}</td></tr>)}</tbody></table></div></div>}
    <div className="report-card"><h2>Phương pháp và dữ liệu để đối chiếu</h2><p>Giám khảo dùng nguồn BookingCare cho thông tin y tế và APP_FACTS cho hành vi ứng dụng. Thiếu địa điểm được phép hỏi làm rõ; dữ kiện về giá, lịch, chính sách và cơ sở vẫn cần nguồn. Không xóa ca khó để tăng điểm. Rubric hiện tại: {report?.rubricVersion || 'chưa có'}.</p><p>Kết quả trước giữ trong reports/history. Khi thay rubric, không coi chênh lệch điểm là bằng chứng mô hình tự cải thiện. Cùng họ mô hình chấm có thể có thiên lệch và cần kiểm tra thủ công một mẫu.</p><div className="code-block">cd D:\TestLLM\carepath<br/>npm run eval:live</div><div className="booking-actions"><button className="button secondary" disabled={!report} onClick={download}><ArrowDownToLine size={17}/>Tải số liệu tổng hợp</button><a className="button secondary" href="https://github.com/haiduong2703/carepath/blob/main/reports/live-report.md" target="_blank" rel="noopener noreferrer">Báo cáo trong mã nguồn</a></div></div>
  </section>;
}
