import catalog from '../data/catalog.json';
import type { CareRecord, RecordType } from '../src/shared';
export const records = catalog as CareRecord[];
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const stop = new Set('toi minh muon can tim cho giup voi o tai la va cua bac si benh vien phong kham dich vu y te nao co khong duoc mot nhung ban hay thong tin ve xin hoi lam the de den dat lich xem'.split(' '));
const tokens = (s: string) => normalize(s).split(' ').filter(t => t.length > 1 && !stop.has(t));
const aliases: [RegExp, string][] = [
  [/da day|dai trang|trao nguoc|tieu hoa|noi soi/, 'tieu hoa'],
  [/xuong|khop|dau lung|dau goi/, 'co xuong khop cot song'],
  [/ho hap|phoi|ho keo dai/, 'ho hap phoi'],
  [/mat ngu|dau dau|than kinh/, 'than kinh'],
  [/tim mach|huyet ap/, 'tim mach'],
  [/tai mui hong|viem hong|viem xoang/, 'tai mui hong'],
  [/xet nghiem|mau|diag/, 'xet nghiem'],
  [/tong quat|tam soat|doctor check/, 'kham tong quat doctor check'],
  [/tam ly|stress|cang thang/, 'tam ly suc khoe tam than']
];
export function inferCity(q: string) {
  const n = normalize(q);
  if (/ha noi|\bhn\b/.test(n)) return 'Hà Nội';
  if (/ho chi minh|\bhcm\b|sai gon|tphcm/.test(n)) return 'TP. Hồ Chí Minh';
  return '';
}
export function search(query: string, opts: { city?: string; type?: RecordType | ''; limit?: number } = {}) {
  const nq = normalize(query);
  const expanded = nq + ' ' + aliases.filter(([r]) => r.test(nq)).map(([, s]) => s).join(' ');
  const terms = [...new Set(tokens(expanded))];
  const city = opts.city || inferCity(query);
  if (/da nang|\bhue\b|can tho|hai phong/.test(nq) && !city) return [];
  const filtered = records.filter(r => (!opts.type || r.type === opts.type) && (!city || r.city === city || r.city === 'Toàn quốc'));
  if (!query.trim()) {
    const featured = opts.type ? filtered : (['doctor', 'facility', 'service', 'specialty'] as const).flatMap(t => filtered.filter(r => r.type === t).slice(0, 3));
    return [...featured, ...filtered.filter(r => !featured.includes(r))].slice(0, opts.limit ?? 6);
  }
  if (!terms.length) return [];
  const documents = records.map(r => tokens(`${r.name} ${r.name} ${r.specialties.join(' ')} ${r.excerpt}`));
  const avgLength = documents.reduce((sum, d) => sum + d.length, 0) / Math.max(documents.length, 1);
  const scored = filtered.map(record => {
    const d = documents[records.indexOf(record)];
    let score = 0;
    for (const term of terms) {
      const frequency = d.filter(t => t === term).length;
      const df = documents.filter(doc => doc.includes(term)).length;
      const idf = Math.log(1 + (records.length - df + 0.5) / (df + 0.5));
      score += idf * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * d.length / Math.max(avgLength, 1)));
    }
    const name = normalize(record.name);
    if (name.includes(nq) || (nq.includes(name) && name.length > 4)) score += 18;
    if (record.specialties.some(s => expanded.includes(normalize(s)))) score += 4;
    if (/bac si/.test(nq) && record.type === 'doctor') score += score > 0 ? 2 : 0;
    if (/benh vien|co so|phong kham/.test(nq) && record.type === 'facility') score += score > 0 ? 2 : 0;
    return { record, score };
  });
  return scored.filter(s => s.score >= 1.3).sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 4).map(s => s.record);
}
