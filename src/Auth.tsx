import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, Eye, EyeOff, HeartPulse, LoaderCircle, LogOut, Plus, ShieldCheck } from 'lucide-react';
type User = { id:string; email:string; name:string };
type Session = { required:boolean; user:User|null; csrfToken:string|null };
let csrfToken: string | null = null;
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.method && !['GET','HEAD'].includes(init.method.toUpperCase()) && csrfToken) headers.set('x-csrf-token',csrfToken);
  const response = await fetch(url,{ ...init,headers,credentials:'same-origin' });
  const body = await response.json();
  if (response.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('carepath-session-expired'));
  if (!response.ok) throw new Error(body.error || 'Chưa thể kết nối. Vui lòng thử lại.');
  return body;
}
const AuthContext = createContext<{ user:User|null; logout:()=>Promise<void> }>({ user:null,logout:async()=>{} });
export const useAuth = () => useContext(AuthContext);
export function AccountMenu() {
  const { user,logout } = useAuth(); const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  if (!user) return null;
  return <div className="account-menu"><span title={user.email}>{user.name}</span><button aria-label="Đăng xuất" title="Đăng xuất" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await logout();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><LogOut size={16}/><span>Đăng xuất</span></button>{error && <span role="alert">{error}</span>}</div>;
}
export function AuthGate({ children }: { children:ReactNode }) {
  const [session,setSession] = useState<Session|null>(null);
  const [error,setError] = useState(''); const [retry,setRetry] = useState(0);
  useEffect(()=>{
    const controller = new AbortController();
    setError('');
    apiRequest<Session>('/api/auth/session',{signal:controller.signal}).then(s=>{csrfToken=s.csrfToken;setSession(s);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
    const expired = ()=>{csrfToken=null;setSession(null);setRetry(n=>n+1);};
    window.addEventListener('carepath-session-expired',expired);
    return ()=>{controller.abort();window.removeEventListener('carepath-session-expired',expired);};
  },[retry]);
  async function logout() {
    await apiRequest('/api/auth/logout',{method:'POST'});
    csrfToken=null;setSession(null);setRetry(n=>n+1);
  }
  if (session && (!session.required || session.user)) return <AuthContext.Provider value={{user:session.user,logout}}>{children}</AuthContext.Provider>;
  return <div className="auth-page">
    <section className="auth-intro"><a className="brand" href="/" aria-label="CarePath"><span className="brand-mark"><Plus strokeWidth={3}/></span>carepath<span className="brand-dot">.</span></a><div className="auth-intro-copy"><span className="auth-kicker">MỘT BƯỚC GẦN HƠN ĐẾN SỨC KHỎE</span><h1>Tìm nơi khám.<br/><span>An tâm hơn.</span></h1><p>Tìm bác sĩ, hỏi trợ lý AI và chuẩn bị đặt lịch từ nguồn thông tin công khai trên BookingCare.</p><div className="auth-feature"><HeartPulse size={22}/><span>Thông tin rõ nguồn, lựa chọn dễ hơn.</span></div></div><p className="auth-footnote">CarePath hỗ trợ tìm thông tin và hướng dẫn đặt lịch. Không thay thế tư vấn của bác sĩ.</p></section>
    <main className="auth-main"><div className="auth-card">{!session ? <div className="auth-loading" role="status">{error ? <><h2>Chưa thể kết nối</h2><p role="alert">{error}</p><button className="button primary" onClick={()=>setRetry(n=>n+1)}>Thử lại</button></> : <><LoaderCircle className="spin" size={28}/><p>Đang kiểm tra phiên đăng nhập…</p></>}</div> : <AuthForm onSuccess={s=>{csrfToken=s.csrfToken;setSession({required:true,...s});}}/>}<div className="auth-privacy"><ShieldCheck size={17}/><span>Tài khoản dành cho bản nộp thử. Email chưa được xác minh; vui lòng dùng mật khẩu riêng cho bản thử.</span></div></div></main>
  </div>;
}
function AuthForm({ onSuccess }: { onSuccess:(s:{user:User;csrfToken:string})=>void }) {
  const [register,setRegister] = useState(false),[visible,setVisible] = useState(false),[busy,setBusy] = useState(false),[error,setError] = useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget),password = String(data.get('password')||'');
    if (register && password!==data.get('confirmation')) {setError('Hai mật khẩu chưa trùng nhau.');return;}
    setBusy(true);setError('');
    try { onSuccess(await apiRequest('/api/auth/'+(register?'register':'login'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:data.get('email'),password,...(register?{name:data.get('name')}: {})})})); }
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <><div className="auth-tabs" aria-label="Tài khoản"><button type="button" aria-pressed={!register} className={!register?'active':''} disabled={busy} onClick={()=>{setRegister(false);setError('');}}>Đăng nhập</button><button type="button" aria-pressed={register} className={register?'active':''} disabled={busy} onClick={()=>{setRegister(true);setError('');}}>Đăng ký</button></div><h2>{register?'Tạo tài khoản CarePath':'Chào mừng bạn trở lại'}</h2><p className="auth-subtitle">{register?'Đăng ký bằng email để bắt đầu trải nghiệm.':'Đăng nhập để tiếp tục tìm nơi khám phù hợp.'}</p><form key={String(register)} onSubmit={submit}>
    {register && <label className="auth-label">Tên hiển thị<input name="name" autoComplete="name" placeholder="Tên của bạn" required minLength={2} maxLength={60} disabled={busy}/></label>}
    <label className="auth-label">Email<input name="email" type="email" autoComplete="email" placeholder="ban@example.com" required maxLength={254} disabled={busy}/></label>
    <label className="auth-label">Mật khẩu<div className="auth-password"><input name="password" type={visible?'text':'password'} autoComplete={register?'new-password':'current-password'} placeholder="Từ 12 đến 128 ký tự" minLength={12} maxLength={128} required disabled={busy}/><button type="button" aria-label={visible?'Ẩn mật khẩu':'Hiện mật khẩu'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
    {register && <label className="auth-label">Nhập lại mật khẩu<input name="confirmation" type={visible?'text':'password'} autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy}/></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button type="submit" className="button primary auth-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={18}/>Đang xử lý…</>:<>{register?'Tạo tài khoản':'Đăng nhập'}<ArrowRight size={18}/></>}</button>
  </form><p className="auth-switch">{register?'Đã có tài khoản?':'Chưa có tài khoản?'} <button type="button" disabled={busy} onClick={()=>{setRegister(!register);setError('');}}>{register?'Đăng nhập':'Đăng ký ngay'}</button></p></>;
}
