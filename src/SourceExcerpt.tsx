import type { CareRecord } from './shared';
export function sourceParagraphs(record: Pick<CareRecord,'name'|'excerpt'|'displayExcerpt'>) {
  const lines=(record.displayExcerpt ?? record.excerpt).split(/\n+/).map(s=>s.trim()).filter(Boolean);
  // The modal already shows the title; breadcrumbs/heading duplicates add no context.
  while(lines.length>1 && lines[0]===record.name)lines.shift();
  const shortened=(record.displayExcerpt ?? record.excerpt).replace(/\s/g,'').length<record.excerpt.replace(/\s/g,'').length;
  if((record.excerpt.length>=1000||shortened) && lines.length){const last=lines.length-1,cut=lines[last].lastIndexOf(' ');lines[last]=(!shortened&&cut>40?lines[last].slice(0,cut):lines[last])+'…';}
  return lines;
}
export function SourceExcerpt({record}:{record:CareRecord}) {
  return <div className="source-excerpt"><small>TRÍCH ĐOẠN HỒ SƠ CÔNG KHAI</small><div className="excerpt-body" tabIndex={0} aria-label={`Trích đoạn hồ sơ ${record.name}`}>{sourceParagraphs(record).map((p,i)=><p key={i}>{p}</p>)}</div><span className="excerpt-note">Trích đoạn rút gọn. Xem nội dung đầy đủ tại trang nguồn.</span></div>;
}
