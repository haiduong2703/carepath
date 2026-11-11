import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { CareRecord } from '../src/shared';
import { formatSnapshotExcerpt } from './source-text';
const origin='https://bookingcare.vn';
const get=async(url:string)=>{
  if(new URL(url).origin!==origin)throw Error('Only BookingCare sources are allowed');
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'user-agent':'CarePath-Educational-Research/1.0 (public directory formatting)'}});
  if(!r.ok)throw Error(`HTTP ${r.status}`);const text=await r.text();if(text.length>4_000_000)throw Error('Source too large');return text;
};
const records=JSON.parse(await readFile('data/catalog.json','utf8')) as CareRecord[];
const robots=await get(origin+'/robots.txt');
const disallow=robots.split('\n').filter(l=>/^Disallow:/i.test(l.trim())).map(l=>l.replace(/^Disallow:\s*/i,'').trim()).filter(Boolean);
const errors:{id:string;reason:string}[]=[];let formatted=0;
let shortened=0;
await mkdir('.sites/qa',{recursive:true});
for(const r of records){
  const path=new URL(r.url).pathname;
  if(disallow.some(p=>new RegExp('^'+p.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')).test(path)))throw Error('Source disallowed by robots.txt');
  await new Promise(resolve=>setTimeout(resolve,1050));
  try{
    const html=process.argv.includes('--cached') ? await readFile(`.sites/qa/${r.id}.html`,'utf8') : await get(r.url);
    if(!process.argv.includes('--cached'))await writeFile(`.sites/qa/${r.id}.html`,html);
    const displayExcerpt=formatSnapshotExcerpt(r.excerpt,html);
    if(!displayExcerpt)throw Error('Source text differs from the evaluation snapshot');
    const shown=displayExcerpt.replace(/\s/g,''), original=r.excerpt.replace(/\s/g,'');
    if(!original.startsWith(shown))throw Error('Snapshot content mismatch');
    if(shown.length<original.length)shortened++;
    r.displayExcerpt=displayExcerpt;formatted++;console.log(`Formatted ${r.id}: ${r.name}`);
  }catch(e){errors.push({id:r.id,reason:(e as Error).message});}
}
if(errors.length){console.error(JSON.stringify({formatted,total:records.length,errors},null,2));throw Error('No catalog changes saved; some sources could not be matched.');}
await writeFile('data/catalog.json',JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({formatted,shortened,total:records.length,note:'Only display whitespace added; excerpt/contentHash/metadata and model context are unchanged. Changed source sections are omitted from display.'}));
