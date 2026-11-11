import { z } from 'zod';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { D1AuthStore, type AuthDatabase, type AuthStore, type AuthUser } from './auth-store';

export interface AuthEnv { DB?: AuthDatabase; AUTH_STORE?: AuthStore; AUTH_MODE?: string }
export const authRequired = (env: AuthEnv) => env.AUTH_MODE !== 'disabled';
const storeFor = (env: AuthEnv) => env.AUTH_STORE ?? (env.DB ? new D1AuthStore(env.DB) : null);
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const hex = (size: number) => bytesToHex(crypto.getRandomValues(new Uint8Array(size)));
const sha256 = async (s: string) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
const equal = (a: string, b: string) => { if (a.length !== b.length) return false; let n = 0; for (let i=0;i<a.length;i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i); return n === 0; };
const json = (data: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
};
function names(request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  return { session: secure ? '__Host-carepath-session' : 'carepath-session', csrf: secure ? '__Host-carepath-csrf' : 'carepath-csrf', secure };
}
function cookieValue(request: Request, name: string) {
  const entries = (request.headers.get('cookie') ?? '').split(';').map(s => s.trim()).filter(s => s.startsWith(name+'='));
  return entries.length === 1 ? entries[0].slice(name.length+1) : '';
}
function cookie(request: Request, name: string, value: string, age: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${names(request).secure ? '; Secure' : ''}`;
}
export function validMutation(request: Request) {
  const origin = request.headers.get('origin');
  const token = request.headers.get('x-csrf-token') ?? '';
  return origin === new URL(request.url).origin && /^[a-f0-9]{64}$/.test(token) && equal(token,cookieValue(request,names(request).csrf));
}
// Serialize memory-heavy KDF work within one Worker isolate (128 MB limit).
let kdfQueue = Promise.resolve(); let pendingKdf = 0;
async function derive(password: string, salt: string) {
  if (pendingKdf >= 4) throw new Error('AUTH_BUSY');
  pendingKdf++;
  let release!: () => void; const prior = kdfQueue;
  kdfQueue = new Promise<void>(resolve => { release = resolve; });
  await prior;
  try { return bytesToHex(await scryptAsync(password,hexToBytes(salt),{ N:32768,r:8,p:3,dkLen:32,maxmem:40*1024*1024 })); }
  finally { pendingKdf--; release(); }
}
export async function hashPassword(password: string) {
  const salt = hex(16);
  return `scrypt$32768$8$3$${salt}$${await derive(password,salt)}`;
}
export async function verifyPassword(password: string, hash: string) {
  const match = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(hash);
  if (!match) return false;
  return equal(await derive(password,match[1]),match[2]);
}
// Same KDF cost for unknown accounts; never a usable account or password.
const dummyHash = 'scrypt$32768$8$3$00000000000000000000000000000000$' + '0'.repeat(64);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(128);
const loginSchema = z.object({ email: emailSchema, password: passwordSchema }).strict();
const registerSchema = loginSchema.extend({ name: z.string().trim().min(2).max(60) });
async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('BODY');
  const reader = request.body?.getReader(); if (!reader) throw new Error('BODY');
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const part = await reader.read(); if (part.done) break; length+=part.value.length; if (length>4096) { await reader.cancel(); throw new Error('BODY'); } chunks.push(part.value); }
  const all = new Uint8Array(length); let at=0; for (const part of chunks) { all.set(part,at); at+=part.length; }
  return JSON.parse(new TextDecoder().decode(all));
}
export async function currentUser(request: Request, env: AuthEnv): Promise<AuthUser | null> {
  const token = cookieValue(request,names(request).session);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return await storeFor(env)?.session(await sha256(token),Date.now()) ?? null;
}
export async function authRoute(request: Request, env: AuthEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (!authRequired(env)) return path === '/api/auth/session' ? json({ required:false,user:null,csrfToken:null }) : json({ error:'Đăng nhập không được bật trong tiến trình kiểm thử này.' },404);
  const store = storeFor(env);
  if (!store) return json({ error:'Máy chủ chưa sẵn sàng lưu tài khoản. Vui lòng thử lại sau.' },503);
  try {
    if (path === '/api/auth/session' && request.method === 'GET') {
      const previous = cookieValue(request,names(request).csrf);
      const csrfToken = /^[a-f0-9]{64}$/.test(previous) ? previous : hex(32);
      return json({ required:true,user:await currentUser(request,env),csrfToken },200,[cookie(request,names(request).csrf,csrfToken,SESSION_SECONDS)]);
    }
    if (!['/api/auth/login','/api/auth/register','/api/auth/logout'].includes(path)) return json({ error:'Không tìm thấy API.' },404);
    if (request.method !== 'POST') return json({ error:'Chỉ hỗ trợ POST.' },405);
    if (!validMutation(request)) return json({ error:'Phiên biểu mẫu không hợp lệ. Vui lòng tải lại trang.' },403);
    const oldToken = cookieValue(request,names(request).session);
    if (path === '/api/auth/logout') {
      if (/^[a-f0-9]{64}$/.test(oldToken)) await store.deleteSession(await sha256(oldToken));
      return json({ ok:true },200,[cookie(request,names(request).session,'',0),cookie(request,names(request).csrf,'',0)]);
    }
    // Cloudflare supplies this header in production; the Node adapter replaces it from the socket.
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const register = path.endsWith('/register');
    const now = Date.now();
    const ipKey = `${register?'register':'login'}:${await sha256(ip)}`;
    if (!await store.consumeLimit(ipKey,register?5:20,register?3600000:60000,now)) return json({ error:'Bạn thử quá nhiều lần. Vui lòng quay lại sau.' },429);
    let body: unknown; try { body = await readBody(request); } catch { return json({ error:'Biểu mẫu phải là JSON hợp lệ, tối đa 4 KB.' },400); }
    const parsed = (register ? registerSchema : loginSchema).safeParse(body);
    if (!parsed.success) return json({ error:'Nhập email hợp lệ, mật khẩu từ 12–128 ký tự và tên từ 2–60 ký tự khi đăng ký.' },400);
    const { email, password } = parsed.data;
    if (!await store.consumeLimit('account:'+await sha256(email),10,60000,now)) return json({ error:'Bạn thử quá nhiều lần. Vui lòng quay lại sau.' },429);
    let account = await store.account(email);
    if (register) {
      if (account) return json({ error:'Không thể đăng ký email này. Nếu đã có tài khoản, hãy đăng nhập.' },409);
      account = { id:crypto.randomUUID(),email,name:(parsed.data as z.infer<typeof registerSchema>).name,passwordHash:await hashPassword(password),createdAt:now };
      if (!await store.createAccount(account)) return json({ error:'Không thể đăng ký email này. Nếu đã có tài khoản, hãy đăng nhập.' },409);
    } else if (!await verifyPassword(password,account?.passwordHash ?? dummyHash) || !account) {
      return json({ error:'Email hoặc mật khẩu chưa đúng.' },401);
    }
    if (/^[a-f0-9]{64}$/.test(oldToken)) await store.deleteSession(await sha256(oldToken));
    const token = hex(32), csrfToken = hex(32);
    await store.createSession({ tokenHash:await sha256(token),userId:account.id,expiresAt:now+SESSION_SECONDS*1000 });
    const user: AuthUser = { id:account.id,email:account.email,name:account.name };
    return json({ user,csrfToken },register?201:200,[cookie(request,names(request).session,token,SESSION_SECONDS),cookie(request,names(request).csrf,csrfToken,SESSION_SECONDS)]);
  } catch (error) {
    return error instanceof Error && error.message === 'AUTH_BUSY'
      ? json({ error:'Máy chủ đang bận. Vui lòng thử lại sau ít giây.' },429)
      : json({ error:'Chưa thể xử lý tài khoản. Vui lòng thử lại sau.' },503);
  }
}
