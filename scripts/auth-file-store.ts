import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Account, AuthStore, AuthUser, Session } from '../server/auth-store';
type Data = { accounts: Account[]; sessions: Session[]; attempts: { key:string; count:number; expiresAt:number }[] };
// Single local Node server only. Production uses shared D1, never this file.
export class FileAuthStore implements AuthStore {
  private queue = Promise.resolve();
  constructor(private path = resolve('.data/auth.json')) {}
  private async withData<T>(write: boolean, action: (data: Data) => T): Promise<T> {
    let release!: () => void; const prior = this.queue;
    this.queue = new Promise<void>(r => { release = r; }); await prior;
    try {
      let data: Data;
      try { data = JSON.parse(await readFile(this.path,'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; data = {accounts:[],sessions:[],attempts:[]}; }
      const now = Date.now(); data.sessions = data.sessions.filter(s => s.expiresAt>now); data.attempts = data.attempts.filter(a => a.expiresAt>now);
      const result = action(data);
      if (write) { await mkdir(dirname(this.path),{recursive:true,mode:0o700}); const temp = this.path+'.tmp'; await writeFile(temp,JSON.stringify(data),{mode:0o600}); await rename(temp,this.path); }
      return result;
    } finally { release(); }
  }
  account(email: string) { return this.withData(false,d => d.accounts.find(a=>a.email===email) ?? null); }
  createAccount(a: Account) { return this.withData(true,d => { if (d.accounts.some(x=>x.email===a.email)) return false; d.accounts.push(a); return true; }); }
  async createSession(s: Session) { await this.withData(true,d => { d.sessions.push(s); }); }
  session(hash: string, now: number) { return this.withData(false,d => { const s=d.sessions.find(x=>x.tokenHash===hash && x.expiresAt>now), a=s && d.accounts.find(x=>x.id===s.userId); return a ? {id:a.id,email:a.email,name:a.name} satisfies AuthUser : null; }); }
  async deleteSession(hash: string) { await this.withData(true,d => { d.sessions=d.sessions.filter(s=>s.tokenHash!==hash); }); }
  consumeLimit(key: string, limit: number, windowMs: number, now: number) { return this.withData(true,d => { let a=d.attempts.find(a=>a.key===key); if (!a) { a={key,count:0,expiresAt:now+windowMs}; d.attempts.push(a); } return ++a.count<=limit; }); }
}
const localStore = new FileAuthStore();
export const localEnv = () => ({ ...process.env, AUTH_MODE:'password',AUTH_STORE:localStore });
