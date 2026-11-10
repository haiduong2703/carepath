import { access, mkdir, writeFile } from 'node:fs/promises';
// A fresh source checkout has no generated asset module yet. Type-checking runs
// before Vite; the real module is written by build-worker after Vite completes.
try { await access('server/assets.generated.ts'); }
catch { await mkdir('server', { recursive: true }); await writeFile('server/assets.generated.ts', 'export const assets: Record<string, {body:string;type:string}> = {};\n'); }
