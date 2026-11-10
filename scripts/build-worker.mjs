import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { build } from 'esbuild';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const assets = {};
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name), url = prefix + '/' + entry.name;
    if (entry.isDirectory()) await walk(path, url);
    else assets[url] = { body: (await readFile(path)).toString('base64'), type: mime[extname(path)] || 'application/octet-stream' };
  }
}
await walk('dist/client');
await writeFile('server/assets.generated.ts', `// Generated; do not edit.\nexport const assets: Record<string, {body:string;type:string}> = ${JSON.stringify(assets)};\n`);
await mkdir('dist/server', { recursive: true });
await build({ entryPoints: ['server/worker.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: 'dist/server/index.js', minify: true, external: ['node:async_hooks'] });
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');
const { default: worker } = await import('../dist/server/index.js?verify=' + Date.now());
const health = await worker.fetch(new Request('https://carepath.test/api/health'), {});
if (!health.ok || !(await health.json()).totalRecords) throw new Error('Worker health check failed.');
const home = await worker.fetch(new Request('https://carepath.test/'), {});
if (!home.ok || !(await home.text()).includes('CarePath')) throw new Error('Worker home check failed.');
console.log(`Worker validated; ${Object.keys(assets).length} bundled assets.`);
