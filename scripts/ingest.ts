import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { CareRecord, RecordType } from '../src/shared';
import { readableSourceText } from './source-text';

const origin = 'https://bookingcare.vn';
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
async function get(url: string) {
  const u = new URL(url);
  if (u.origin !== origin || u.username || u.password) throw new Error('Chỉ chấp nhận nguồn BookingCare HTTPS.');
  const r = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error', headers: { 'User-Agent': 'CarePath-Educational-Research/1.0 (public directory; no appointment crawling)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  const text = await r.text();
  if (text.length > 4_000_000) throw new Error('Trang vượt giới hạn kích thước.');
  return text;
}

// Read robots.txt before collecting. Crawl only public directories, one request/second.
const robots = await get(origin + '/robots.txt');
const blocks = robots.split('\n').filter(l => /^Disallow:/i.test(l.trim())).map(l => l.replace(/^Disallow:\s*/i, '').trim()).filter(Boolean);
function permitted(path: string) {
  return !blocks.some(p => new RegExp('^' + p.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')).test(path));
}
const home = load(await get(origin));
const candidates = new Map<string, { type: RecordType; label: string }>();
// Refresh known profiles first so homepage recommendations do not silently drop evaluation sources.
try {
  const previous = JSON.parse(await readFile('data/catalog.json', 'utf8')) as CareRecord[];
  for (const r of previous) { const u = new URL(r.url); if (u.origin === origin && permitted(u.pathname)) candidates.set(r.url, { type: r.type, label: r.name }); }
} catch { /* Fresh checkout can start from the public homepage. */ }
home('a[href]').each((_, element) => {
  const a = home(element);
  const href = a.attr('href');
  if (!href) return;
  let u: URL;
  try { u = new URL(href, origin); } catch { return; }
  if (u.origin !== origin || !permitted(u.pathname)) return;
  const label = clean(a.text());
  let type: RecordType | undefined;
  if (/^\/co-so-y-te\/.+-p\d+$/.test(u.pathname)) type = 'facility';
  else if (/^\/dich-vu-y-te\/kham-chuyen-khoa\/.+-i\d+$/.test(u.pathname)) type = 'doctor';
  else if (/^\/dich-vu-y-te\/.+-s\d+$/.test(u.pathname)) type = 'specialty';
  else if (/^\/dich-vu-y-te\/.+-i\d+$/.test(u.pathname)) type = 'service';
  if (type && label) candidates.set(u.origin + u.pathname, { type, label });
});
const counts: Record<RecordType, number> = { doctor: 0, facility: 0, specialty: 0, service: 0 };
const records: CareRecord[] = [];
const errors: { url: string; error: string }[] = [];
for (const [url, { type, label }] of candidates) {
  if (counts[type] >= (type === 'specialty' ? 10 : 9)) continue;
  await pause(1050);
  try {
    const html = await get(url), $ = load(html);
    $('script, style, nav, footer, header, noscript').remove();
    const name = clean($('h1').first().text()) || label.slice(0, 150);
    let body = readableSourceText(html);
    const index = body.indexOf(name);
    body = body.slice(index >= 0 ? index : 0);
    body = body.split(/Phản hồi của bệnh nhân|Đánh giá của người bệnh|Người bệnh nói gì/i)[0];
    const excerpt = body.slice(0, 1000);
    const lead = body.slice(0, 1300);
    const actualType: RecordType = type === 'doctor' && /^Khám /i.test(name) ? 'service' : type;
    const city = actualType === 'specialty' ? 'Toàn quốc' : /hồ chí minh|tp\.?\s*hcm|tphcm/i.test(lead) ? 'TP. Hồ Chí Minh' : /hà nội/i.test(lead) ? 'Hà Nội' : 'Xem tại nguồn';
    const names = ['Cơ Xương Khớp', 'Thần kinh', 'Tiêu hóa', 'Tim mạch', 'Tai Mũi Họng', 'Cột sống', 'Y học Cổ truyền', 'Châm cứu', 'Sản Phụ khoa', 'Siêu âm thai', 'Hô hấp', 'Nam học', 'Thận - Tiết niệu', 'Da liễu', 'Nội khoa', 'Sức khỏe tâm thần', 'Bệnh Viêm gan', 'Xét nghiệm', 'Khám tổng quát', 'Tâm lý'];
    const specialties = actualType === 'specialty' ? [name] : names.filter(s => lead.toLocaleLowerCase('vi').includes(s.toLocaleLowerCase('vi')));
    const kind = { doctor: 'Hồ sơ bác sĩ', facility: 'Cơ sở y tế', specialty: 'Danh mục chuyên khoa', service: 'Dịch vụ y tế' }[actualType];
    records.push({ id: new URL(url).pathname.match(/[ips]\d+$/)?.[0] ?? `record-${records.length}`, name, type: actualType, city,
      specialties, summary: `${kind}${specialties.length ? ' · ' + specialties.slice(0, 3).join(', ') : ''}. Thông tin công khai trên BookingCare.`,
      excerpt, url, fetchedAt: new Date().toISOString(), contentHash: createHash('sha256').update(excerpt).digest('hex') });
    counts[actualType]++;
    console.log(`${records.length}. ${actualType}: ${name}`);
  } catch (e) { errors.push({ url, error: String(e) }); console.error(String(e)); }
}
if (records.length < 15) throw new Error(`Chỉ lấy được ${records.length} hồ sơ; giữ nguyên snapshot cũ.`);
await mkdir('data', { recursive: true });
await writeFile('data/catalog.json', JSON.stringify(records, null, 2) + '\n');
await writeFile('data/ingestion.json', JSON.stringify({ fetchedAt: new Date().toISOString(), origin, robotsSha256: createHash('sha256').update(robots).digest('hex'), counts, total: records.length, errors, policy: 'Public allowlisted pages only. No appointment endpoints, patient reviews, images, or live schedule scraping. City inferred from profile lead; verify at source.' }, null, 2) + '\n');
console.log(`Đã lưu ${records.length} hồ sơ công khai. ${errors.length} lỗi.`);
