import { api } from './api';
import { assets } from './assets.generated';
import type { Env } from './assistant';
const security = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' };
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    // Hosted publication always requires our own verified session, even if an env value is misconfigured.
    if (path.startsWith('/api/')) return api(request, { ...env, AUTH_MODE:'password' });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    const file = assets[path === '/' ? '/index.html' : path];
    if (!file) return new Response('Not found', { status: 404 });
    const bytes = Uint8Array.from(atob(file.body), c => c.charCodeAt(0));
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: { ...security, 'content-type': file.type, 'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
  }
};
