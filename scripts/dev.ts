import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { handleApi } from './http-adapter';
const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) void handleApi(req, res);
  else vite.middlewares(req, res);
});
const port = Number(process.env.PORT || 8787);
server.listen(port, '127.0.0.1', () => console.log(`CarePath Local: http://127.0.0.1:${port}`));
const stop = () => { server.close(); void vite.close().then(() => process.exit()); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
