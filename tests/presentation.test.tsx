import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readableSourceText, formatSnapshotExcerpt } from '../scripts/source-text';
import { MessageContent, shouldSendOnEnter } from '../src/ChatPanel';
import { sourceParagraphs } from '../src/SourceExcerpt';
import catalog from '../data/catalog.json';
describe('Source text boundaries',()=>{
  it('separates headings, paragraphs and adjacent list items instead of concatenating words',()=>{
    expect(readableSourceText('<h1>Tiêu hóa</h1><p>Danh sách bác sĩ</p><ul><li>Hà Nội</li><li>TP. Hồ Chí Minh</li></ul>')).toBe('Tiêu hóa\n\nDanh sách bác sĩ\n\nHà Nội\n\nTP. Hồ Chí Minh');
  });
  it('preserves inline Vietnamese text and explicit line breaks',()=>{expect(readableSourceText('<p>Khám <b>Tiêu hóa</b> tại Hà Nội<br>Tham khảo tại nguồn</p>')).toBe('Khám Tiêu hóa tại Hà Nội\n\nTham khảo tại nguồn');});
  it('omits navigation, scripts, style and footer from displayed source text',()=>{expect(readableSourceText('<header>Header</header><nav>Nav</nav><script>bad()</script><style>bad{}</style><p>Hồ sơ</p><footer>Footer</footer>')).toBe('Hồ sơ');});
  it('restores only snapshot whitespace and does not replace historical facts',()=>{expect(formatSnapshotExcerpt('Tiêu hóaDanh sách bác sĩHà Nội','<h1>Tiêu hóa</h1><p>Danh sách bác sĩ</p><p>Hà Nội</p>')).toBe('Tiêu hóa\n\nDanh sách bác sĩ\n\nHà Nội');expect(formatSnapshotExcerpt('Tên cũ','<h1>Tên mới</h1>')).toBeNull();});
  it('formats all current source excerpts without adding any new snapshot content',()=>{for(const record of catalog){expect(record.displayExcerpt,record.id).toBeTruthy();expect(record.excerpt.replace(/\s/g,'').startsWith(record.displayExcerpt!.replace(/\s/g,'')),record.id).toBe(true);}});
  it('shows specialty paragraphs once and removes duplicate title lines',()=>{const r=catalog.find(r=>r.id==='s22')!;const lines=sourceParagraphs(r);expect(lines[0]).toBe('Bác sĩ Chuyên khoa Tiêu hóa');expect(lines.some(s=>s.includes('Tiêu hóaTiêu hóa'))).toBe(false);expect(lines.length).toBeGreaterThan(4);});
});
describe('Chat rendering and Vietnamese composition',()=>{
  it('renders paragraphs, bold text and numbered steps as separate semantic elements',()=>{const html=renderToStaticMarkup(<MessageContent assistant text={'**Bước tiếp theo**\n\n1. Mở nguồn.\n2. Chọn hồ sơ.'}/>);expect(html).toContain('<strong>Bước tiếp theo</strong>');expect(html).toContain('<ol>');expect(html.match(/<li>/g)).toHaveLength(2);expect(html).not.toContain('**');});
  it('never runs HTML or renders arbitrary model-provided links/images',()=>{const html=renderToStaticMarkup(<MessageContent assistant text={'<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![image](https://example.com/track)'}/>);expect(html).not.toContain('<script');expect(html).not.toContain('<img');expect(html).not.toContain('href=');expect(html).not.toContain('onerror=');});
  it('keeps user text literal',()=>{const html=renderToStaticMarkup(<MessageContent assistant={false} text={'**Tôi hỏi**\nDòng 2 <img src=x>'}/>);expect(html).toContain('**Tôi hỏi**');expect(html).toContain('&lt;img src=x&gt;');});
  it('sends Enter after composition finishes',()=>{expect(shouldSendOnEnter({key:'Enter',shiftKey:false,isComposing:false})).toBe(true);});
  it('never sends while an IME is composing or handling key code 229',()=>{expect(shouldSendOnEnter({key:'Enter',shiftKey:false,isComposing:true})).toBe(false);expect(shouldSendOnEnter({key:'Enter',shiftKey:false,isComposing:false},true)).toBe(false);expect(shouldSendOnEnter({key:'Enter',shiftKey:false,isComposing:false,keyCode:229})).toBe(false);});
  it('keeps Shift+Enter for a new line',()=>{expect(shouldSendOnEnter({key:'Enter',shiftKey:true,isComposing:false})).toBe(false);expect(shouldSendOnEnter({key:'a',shiftKey:false,isComposing:false})).toBe(false);});
});
