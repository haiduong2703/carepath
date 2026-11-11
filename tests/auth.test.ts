/** npm run test:auth — real HTTP + SQLite; never loads .env or calls an LLM. */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import initSqlJs, { type Database } from 'sql.js';
import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect } from 'vitest';
import { D1AuthStore, type AuthDatabase, type AuthStore } from '../server/auth-store';
import { hashPassword, verifyPassword } from '../server/auth';
import { api } from '../server/api';
import { FileAuthStore } from '../scripts/auth-file-store';
import { handleApi } from '../scripts/http-adapter';

const password='CarePath-test-2026!';
const fixture={id:'fixture-user',email:'fixture@example.test',name:'Người kiểm thử',createdAt:Date.now()};
let passwordHash:string, sqlite:Awaited<ReturnType<typeof initSqlJs>>, db:Database, store:AuthStore, server:Server, base:string;
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
// Execute exactly the production prepared statements against real SQLite.
function binding(database:Database):AuthDatabase {
  return { prepare(sql:string) {
    let args:(string|number)[]=[];
    return {
      bind(...values:(string|number)[]) {args=values;return this;},
      async first<T>() {const statement=database.prepare(sql);try {statement.bind(args);return statement.step()?statement.getAsObject() as T:null;}finally{statement.free();}},
      async run() {database.run(sql,args);return {meta:{changes:database.getRowsModified()}};}
    };
  }};
}
class Client {
  cookies=new Map<string,string>(); token='';
  async call(path:string,body?:unknown,extra:Record<string,string>={}) {
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(body===undefined?{}:{origin:base,'content-type':'application/json','x-csrf-token':this.token}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for (const s of response.headers.getSetCookie()) {const [pair]=s.split(';'),i=pair.indexOf('=');this.cookies.set(pair.slice(0,i),pair.slice(i+1));}
    const data=await response.json(); if(data.csrfToken)this.token=data.csrfToken;
    return {response,data};
  }
}
async function client(signedIn=false) {
  const c=new Client(); await c.call('/api/auth/session');
  if(signedIn){const token='a'.repeat(64);await store.createSession({tokenHash:digest(token),userId:fixture.id,expiresAt:Date.now()+60000});c.cookies.set('carepath-session',token);}
  return c;
}
beforeAll(async()=>{
  sqlite=await initSqlJs(); passwordHash=await hashPassword(password);
  server=createServer((req,res)=>{void handleApi(req,res,{AUTH_STORE:store});});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async()=>{
  db=new sqlite.Database();db.run('PRAGMA foreign_keys = ON');
  db.run(await readFile('drizzle/0000_common_loners.sql','utf8'));
  store=new D1AuthStore(binding(db));await store.createAccount({...fixture,passwordHash});
});
afterEach(()=>db.close());
afterAll(async()=>{await new Promise<void>((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();});});

describe('Email/password authentication through HTTP',()=>{
  it('bootstraps anonymous session without returning account secrets',async()=>{
    const {response,data}=await(new Client()).call('/api/auth/session');
    expect(data).toMatchObject({required:true,user:null});expect(data.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.getSetCookie()[0]).toContain('HttpOnly; SameSite=Lax');expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('protects every business API from anonymous callers and forged platform headers',async()=>{
    for(const path of ['/api/health','/api/search?q=Hà','/api/evaluation','/api/chat']){
      const response=await fetch(base+path,{headers:{'oai-authenticated-user-id':'fake-owner','cf-connecting-ip':'fake'}});expect(response.status).toBe(401);
    }
  });
  it('rejects fabricated session tokens',async()=>{const c=await client();c.cookies.set('carepath-session','b'.repeat(64));expect((await c.call('/api/health')).response.status).toBe(401);});
  it('registers, normalizes email, stores a salted hash and enters the app',async()=>{
    const c=await client();const {response,data}=await c.call('/api/auth/register',{email:'  NEW@Example.Test  ',name:'Người mới',password});
    expect(response.status).toBe(201);expect(data.user.email).toBe('new@example.test');expect(data.user.passwordHash).toBeUndefined();
    const account=await store.account('new@example.test');expect(account?.passwordHash).toMatch(/^scrypt\$32768\$8\$3\$/);expect(account?.passwordHash).not.toContain(password);expect(account?.passwordHash).not.toBe(passwordHash);
    expect((await c.call('/api/health')).response.status).toBe(200);
    const stored=db.exec('SELECT token_hash FROM sessions')[0].values[0][0];expect(stored).toBe(digest(c.cookies.get('carepath-session')!));expect(stored).not.toBe(c.cookies.get('carepath-session'));
  });
  it('rejects duplicate email independent of casing',async()=>{const c=await client();expect((await c.call('/api/auth/register',{email:'FIXTURE@example.test',name:'Khác',password})).response.status).toBe(409);});
  it('rejects invalid email, short/long passwords and missing registration name',async()=>{
    const c=await client();for(const body of [{email:'bad',name:'Test',password},{email:'new@example.test',name:'Test',password:'short'},{email:'new@example.test',name:'Test',password:'x'.repeat(129)},{email:'new@example.test',password}])expect((await c.call('/api/auth/register',body)).response.status).toBe(400);
  });
  it('accepts the correct password and rotates an existing session',async()=>{
    const c=await client(true),old=c.cookies.get('carepath-session');const {response,data}=await c.call('/api/auth/login',{email:fixture.email,password});
    expect(response.status).toBe(200);expect(data.user.name).toBe(fixture.name);expect(c.cookies.get('carepath-session')).not.toBe(old);expect(await store.session(digest(old!),Date.now())).toBeNull();
    expect((await c.call('/api/search?q=Hà%20Văn%20Quyết')).data.items.length).toBeGreaterThan(0);
  });
  it('uses the same login error for wrong passwords and unknown accounts',async()=>{
    const c=await client();for(const email of [fixture.email,'unknown@example.test']){const {response,data}=await c.call('/api/auth/login',{email,password:'Wrong-password-2026!'});expect(response.status).toBe(401);expect(data.error).toBe('Email hoặc mật khẩu chưa đúng.');}
  });
  it('logs out, removes the server session and rejects cookie replay',async()=>{
    const c=await client(true),old=c.cookies.get('carepath-session')!;expect((await c.call('/api/auth/logout',{})).response.status).toBe(200);c.cookies.set('carepath-session',old);expect((await c.call('/api/health')).response.status).toBe(401);
  });
  it('rejects expired sessions',async()=>{
    const c=await client();await store.createSession({tokenHash:digest('c'.repeat(64)),userId:fixture.id,expiresAt:Date.now()-1});c.cookies.set('carepath-session','c'.repeat(64));expect((await c.call('/api/auth/session')).data.user).toBeNull();expect((await c.call('/api/health')).response.status).toBe(401);
  });
  it('rejects missing CSRF and cross-origin auth requests',async()=>{
    const c=await client();for(const extra of [{'x-csrf-token':''},{origin:'https://evil.example'},{origin:''}] as Record<string,string>[])expect((await c.call('/api/auth/login',{email:fixture.email,password},extra)).response.status).toBe(403);
  });
  it('requires CSRF for authenticated chat as well',async()=>{
    const c=await client(true);expect((await c.call('/api/chat',{message:'Chào'},{'x-csrf-token':''})).response.status).toBe(403);expect((await c.call('/api/chat',{message:'Chào'})).response.status).toBe(200);
  });
  it('limits auth request size and content type',async()=>{
    const c=await client();expect((await c.call('/api/auth/login',{email:'x'.repeat(5000)})).response.status).toBe(400);expect((await c.call('/api/auth/login',{}, {'content-type':'text/plain'})).response.status).toBe(400);
  });
  it('persists rate limits and cannot bypass them with a spoofed IP header',async()=>{
    const c=await client();for(let n=0;n<20;n++)expect((await c.call('/api/auth/login',{}, {'cf-connecting-ip':String(n)})).response.status).toBe(400);
    expect((await c.call('/api/auth/login',{}, {'cf-connecting-ip':'fresh'})).response.status).toBe(429);
    expect(db.exec('SELECT count FROM auth_attempts')[0].values[0][0]).toBe(21);
  });
  it('uses Secure __Host cookies on HTTPS',async()=>{
    const response=await api(new Request('https://carepath.test/api/auth/session'),{AUTH_STORE:store});
    expect(response.headers.getSetCookie()[0]).toMatch(/^__Host-carepath-csrf=/);expect(response.headers.getSetCookie()[0]).toContain('; Secure');
  });
  it('fails closed when production database is unavailable',async()=>{
    expect((await api(new Request('https://carepath.test/api/auth/session'),{})).status).toBe(503);expect((await api(new Request('https://carepath.test/api/health'),{})).status).toBe(401);
  });
  it('does not evaluate email text as SQL',async()=>{expect(await store.account("' OR 1=1 --")).toBeNull();expect(db.exec('SELECT count(*) FROM accounts')[0].values[0][0]).toBe(1);});
});
describe('Password hashing and local persistence',()=>{
  it('matches standard Node scrypt output and rejects a modified password',async()=>{
    const {scryptSync}=await import('node:crypto');const parts=passwordHash.split('$');expect(parts[5]).toBe(scryptSync(password,Buffer.from(parts[4],'hex'),32,{N:32768,r:8,p:3,maxmem:40*1024*1024}).toString('hex'));
    expect(await verifyPassword(password,passwordHash)).toBe(true);expect(await verifyPassword(password+'!',passwordHash)).toBe(false);
  });
  it('keeps local accounts and sessions across a store restart without plaintext passwords',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'carepath-auth-')),path=join(dir,'auth.json');
    try {const first=new FileAuthStore(path);await first.createAccount({...fixture,passwordHash});await first.createSession({tokenHash:digest('opaque-session'),userId:fixture.id,expiresAt:Date.now()+60000});const next=new FileAuthStore(path);expect((await next.account(fixture.email))?.id).toBe(fixture.id);expect((await next.session(digest('opaque-session'),Date.now()))?.email).toBe(fixture.email);expect(await readFile(path,'utf8')).not.toContain(password);}
    finally {await unlink(path);await rmdir(dir);}
  });
  it('handles concurrent rate limit writes in SQLite',async()=>{const allowed=await Promise.all(Array.from({length:12},()=>store.consumeLimit('parallel',5,60000,Date.now())));expect(allowed.filter(Boolean)).toHaveLength(5);});
});
