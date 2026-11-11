import { normalize } from '../server/retrieval';
import type { ChatResult } from '../src/shared';
import type { TestCase } from './cases';
export function checkResult(c: TestCase, r: ChatResult) {
  const issues: string[] = [];
  if (c.intent && c.intent !== r.intent) issues.push(`intent ${r.intent}, mong đợi ${c.intent}`);
  if (c.expectedIds && !c.expectedIds.some(id => r.sources.some(s => s.id === id))) issues.push('Thiếu nguồn đích trong top 4');
  if (c.city && r.sources.some(s => s.city !== c.city && s.city !== 'Toàn quốc')) issues.push('Nguồn sai khu vực');
  if (c.mustInclude?.some(s => !r.answer.includes(s))) issues.push('Thiếu nội dung bắt buộc');
  if (c.mustNotInclude?.some(s => r.answer.includes(s))) issues.push('Có nội dung bị cấm');
  if (r.sources.some(s => new URL(s.url).origin !== 'https://bookingcare.vn')) issues.push('Nguồn ngoài BookingCare');
  for (const m of r.answer.matchAll(/\[(\d{1,2})\]/g)) if (Number(m[1]) < 1 || Number(m[1]) > r.sources.length) issues.push('Số dẫn nguồn không tồn tại');
  if (/\b(?:toi|carepath) (?:da|vua) (?:huy lich|doi lich|dat lich thanh cong|xac nhan thanh toan)\b/.test(normalize(r.answer))) issues.push('Khẳng định thao tác không được ứng dụng hỗ trợ');
  if (r.mode === 'fallback') issues.push('Lượt hội thoại không hoàn tất bằng LLM hoặc bị lỗi HTTP');
  return { passed: issues.length === 0, issues: [...new Set(issues)] };
}
