export type Account = { id: string; email: string; name: string; passwordHash: string; createdAt: number };
export type AuthUser = Pick<Account, 'id' | 'email' | 'name'>;
export type Session = { tokenHash: string; userId: string; expiresAt: number };
export interface AuthStore {
  account(email: string): Promise<Account | null>;
  createAccount(account: Account): Promise<boolean>;
  createSession(session: Session): Promise<void>;
  session(tokenHash: string, now: number): Promise<AuthUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
  consumeLimit(key: string, limit: number, windowMs: number, now: number): Promise<boolean>;
}
// Structural subset of Cloudflare D1. All user input is bound, never SQL-interpolated.
interface Statement {
  bind(...values: (string | number)[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface AuthDatabase { prepare(sql: string): Statement }
export class D1AuthStore implements AuthStore {
  constructor(private db: AuthDatabase) {}
  account(email: string) {
    return this.db.prepare('SELECT id, email, name, password_hash AS passwordHash, created_at AS createdAt FROM accounts WHERE email = ?').bind(email).first<Account>();
  }
  async createAccount(a: Account) {
    const result = await this.db.prepare('INSERT INTO accounts (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(a.id,a.email,a.name,a.passwordHash,a.createdAt).run();
    return result.meta.changes === 1;
  }
  async createSession(s: Session) {
    await this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run();
    await this.db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(s.tokenHash,s.userId,s.expiresAt).run();
  }
  session(hash: string, now: number) {
    return this.db.prepare('SELECT a.id, a.email, a.name FROM sessions s JOIN accounts a ON a.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').bind(hash,now).first<AuthUser>();
  }
  async deleteSession(hash: string) { await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run(); }
  async consumeLimit(key: string, limit: number, windowMs: number, now: number) {
    await this.db.prepare('DELETE FROM auth_attempts WHERE expires_at <= ?').bind(now).run();
    // One atomic upsert prevents concurrent requests bypassing the quota.
    const row = await this.db.prepare('INSERT INTO auth_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key,now+windowMs).first<{count: number}>();
    return !!row && row.count <= limit;
  }
}
