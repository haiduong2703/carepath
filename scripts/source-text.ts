import { load } from 'cheerio';
import type { AnyNode } from 'domhandler';

const blocks = new Set(['div','p','h1','h2','h3','h4','h5','h6','li','ul','ol','section','article','main','aside','blockquote','tr','td','dt','dd']);
/** Read DOM text in order, preserving inline text and block/line boundaries. */
export function readableSourceText(html: string): string {
  const dom = load(html);
  dom('script,style,nav,footer,header,noscript').remove();
  const parts: string[] = [];
  function visit(node: AnyNode) {
    if (node.type === 'text') { parts.push(node.data); return; }
    if (!('children' in node)) return;
    const name = 'name' in node ? node.name.toLowerCase() : '';
    if (name === 'br') { parts.push('\n'); return; }
    if (blocks.has(name)) parts.push('\n');
    for (const child of node.children) visit(child);
    if (blocks.has(name)) parts.push('\n');
  }
  for (const node of dom('body').contents().toArray()) visit(node);
  return parts.join('').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n\n');
}
/** Restore whitespace from source DOM without changing the snapshot's words/facts. */
export function formatSnapshotExcerpt(excerpt: string, html: string): string | null {
  const text = readableSourceText(html), compact: string[] = [], positions: number[] = [];
  for (let i=0;i<text.length;i++) if (!/\s/.test(text[i])) { compact.push(text[i]); positions.push(i); }
  const needle=excerpt.replace(/\s/g,''), source=compact.join('');
  if(!needle)return null;
  const start=source.indexOf(needle.slice(0,Math.min(32,needle.length)));
  if(start<0)return null;
  let length=0;while(length<needle.length&&needle[length]===source[start+length])length++;
  if(length===needle.length)return text.slice(positions[start],positions[start+length-1]+1);
  // Recommendations may reorder between fetches. Display only complete matching
  // blocks before the change; never copy today's different recommendations.
  if(length<80)return null;
  const prefix=text.slice(positions[start],positions[start+length-1]+1);
  const boundary=prefix.lastIndexOf('\n\n');
  return boundary>0 ? prefix.slice(0,boundary) : null;
}
