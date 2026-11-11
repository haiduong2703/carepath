import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, AudioLines, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Compass, ExternalLink, FileCheck2, Heart, HeartPulse, Hospital, Info, MapPin, Menu, MessageCircle, Microscope, Plus, Search, Send, ShieldCheck, Sparkles, Stethoscope, X } from 'lucide-react';
import type { CareRecord, ChatMessage, ChatResult, RecordType } from './shared';
import './styles.css';
import { EvaluationView } from './Evaluation';

type Page = 'discover' | 'assistant' | 'booking' | 'evaluation';
type Turn = ChatMessage & { result?: ChatResult; error?: boolean };
type Health = { llmConfigured: boolean; totalRecords: number; ingestion: { fetchedAt?: string; counts?: Record<string, number> } };
const typeLabel: Record<RecordType, string> = { doctor: 'Bác sĩ', facility: 'Cơ sở y tế', specialty: 'Chuyên khoa', service: 'Dịch vụ' };
const date = (iso?: string) => iso ? new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa cập nhật';
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Kết nối chưa thành công. Vui lòng thử lại.');
  return body;
}
const prompts = ['Tìm bác sĩ tiêu hóa ở Hà Nội', 'Tôi muốn khám tổng quát tại TP. Hồ Chí Minh', 'Làm sao để đặt lịch khám?', 'Thông tin về xét nghiệm tại Diag'];

function App() {
  const [page, setPage] = useState<Page>('discover');
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<RecordType | ''>('');
  const [items, setItems] = useState<CareRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CareRecord | null>(null);
  const [info, setInfo] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CareRecord | null>(null);
  const [preferredDate, setPreferredDate] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const chatLock = useRef(false);
  const searchCounter = useRef(0);

  useEffect(() => { request<Health>('/api/health').then(setHealth).catch(() => setHealthError(true)); }, []);
  async function find(query = q, region = city, category = type) {
    const id = ++searchCounter.current;
    setLoading(true); setError('');
    try {
      const result = await request<{ items: CareRecord[] }>(`/api/search?q=${encodeURIComponent(query)}&city=${encodeURIComponent(region)}&type=${category}`);
      if (id === searchCounter.current) setItems(result.items);
    } catch (e) { if (id === searchCounter.current) setError((e as Error).message); }
    finally { if (id === searchCounter.current) setLoading(false); }
  }
  useEffect(() => { void find(); }, [city, type]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns, busy]);
  useEffect(() => {
    if (!selected && !info) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href],button,input,select,[tabindex="0"]') || []);
    controls()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); setInfo(false); }
      if (e.key === 'Tab') { const all = controls(); const first = all[0], last = all[all.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    };
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prior; document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, [selected, info]);
  function navigate(next: Page) { setPage(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function categorySearch(text: string) { setQ(text); setType(''); void find(text, city, ''); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  async function send(text = input) {
    const message = text.trim(); if (!message || chatLock.current) return;
    chatLock.current = true; setPage('assistant'); setInput(''); setBusy(true);
    const history = turns.filter(t => !t.error).slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    setTurns(prev => [...prev, { role: 'user', content: message }]);
    try {
      const result = await request<ChatResult>('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history, city }), signal: AbortSignal.timeout(12000) });
      setTurns(prev => [...prev, { role: 'assistant', content: result.answer, result }]);
    } catch (e) { setTurns(prev => [...prev, { role: 'assistant', content: (e as Error).name === 'TimeoutError' ? 'Kết nối đang chậm. Bạn có thể thử lại hoặc dùng trang Khám phá.' : (e as Error).message, error: true }]); }
    finally { setBusy(false); chatLock.current = false; }
  }
  function prepare(record: CareRecord) { setDraft(record); setSelected(null); navigate('booking'); }
  function downloadDraft() {
    if (!draft) return;
    const text = `CAREPATH — THÔNG TIN CHUẨN BỊ ĐẶT KHÁM\n\n${draft.name}\nKhu vực: ${draft.city}\nNgày mong muốn: ${preferredDate || 'Chưa chọn'}\nNguồn: ${draft.url}\n\nĐÂY KHÔNG PHẢI PHIẾU XÁC NHẬN LỊCH HẸN.\nChưa kiểm tra lịch trống. Bạn cần chọn ngày/giờ và hoàn tất thông tin trực tiếp trên BookingCare, sau đó chờ xác nhận chính thức.\n\nChuẩn bị: giấy tờ theo yêu cầu của cơ sở, danh sách thuốc đang dùng, kết quả khám cũ. Hỏi cơ sở về các yêu cầu chuẩn bị riêng.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'carepath-chuan-bi-dat-kham.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const nav = [
    { id: 'discover' as const, icon: Compass, label: 'Khám phá' },
    { id: 'assistant' as const, icon: Sparkles, label: 'Trợ lý AI' },
    { id: 'booking' as const, icon: CalendarDays, label: 'Hỗ trợ đặt lịch' },
    { id: 'evaluation' as const, icon: FileCheck2, label: 'Báo cáo đánh giá' }
  ];
  return <div className="app">
    {mobileMenu && <button className="nav-overlay" aria-label="Đóng menu" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('discover'); }} aria-label="CarePath trang chủ"><span className="brand-mark"><Plus strokeWidth={3} /></span>carepath<span className="brand-dot">.</span></a>
      <div className="sidebar-caption">ĐỒNG HÀNH CÙNG BẠN</div>
      <nav>{nav.map(({ id, icon: Icon, label }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={page === id ? 'page' : undefined}><Icon size={19} /><span>{label}</span>{id === 'assistant' && <span className="tiny-label">AI</span>}</button>)}</nav>
      <div className="side-bottom"><div className="side-note"><div className="note-icon"><Heart size={19} /></div><strong>Một bước nhỏ,<br/>an tâm hơn mỗi ngày.</strong><p>Tìm hiểu thông tin trước khi chọn nơi chăm sóc sức khỏe.</p><button onClick={() => setInfo(true)}>Về CarePath <ArrowUpRight size={15}/></button></div><button className="source-button" onClick={() => setInfo(true)}><ShieldCheck size={17}/> Dữ liệu có dẫn nguồn <CircleHelp size={14}/></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-toggle icon-button" aria-label="Mở menu" onClick={() => setMobileMenu(true)}><Menu size={22}/></button><span>Không gian sức khỏe</span><ChevronRight size={14}/><strong>{nav.find(n => n.id === page)?.label}</strong></div><button className="status" onClick={() => setInfo(true)}><span className={`status-dot ${health?.llmConfigured ? 'live' : ''}`}/>{healthError ? 'Chưa kết nối' : health?.llmConfigured ? 'Trợ lý AI đã sẵn sàng' : 'Chế độ tra cứu'}<Info size={14}/></button></header>
      <main>
        {page === 'discover' && <>
          <div className="section-kicker"><span/> CHỌN NƠI KHÁM, BẮT ĐẦU TỪ SỰ THẤU HIỂU</div>
          <section className="hero">
            <div className="hero-copy"><h1>Tìm đúng nơi.<br/><span>An tâm đi khám.</span></h1><p>Bác sĩ, cơ sở y tế và dịch vụ phù hợp với bạn.<br className="desktop-br"/> Cùng CarePath tìm hiểu và chuẩn bị cho bước tiếp theo.</p><div className="hero-proof"><span><ShieldCheck size={16}/> Nguồn BookingCare</span><i/><span><HeartPulse size={16}/> Đồng hành, không chẩn đoán</span></div></div>
            <div className="hero-guide"><div className="guide-top"><span className="sparkle-circle"><Sparkles size={24}/></span><span className="guide-pill">BẮT ĐẦU THẬT DỄ</span></div><h2>Chưa biết nên<br/>bắt đầu từ đâu?</h2><p>Chia sẻ nhu cầu tìm nơi khám.<br/>Tôi sẽ giúp bạn tìm hướng phù hợp.</p><button onClick={() => navigate('assistant')}>Trò chuyện cùng trợ lý <ArrowUpRight size={19}/></button><div className="guide-decoration" aria-hidden="true"><Plus/><Plus/><Plus/></div></div>
          </section>
          <form className="search-panel" onSubmit={e => { e.preventDefault(); void find(); document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><label className="search-input"><Search size={21}/><input aria-label="Tìm bác sĩ, chuyên khoa hoặc cơ sở y tế" placeholder="Tìm bác sĩ, chuyên khoa hoặc cơ sở y tế…" value={q} onChange={e => setQ(e.target.value)} maxLength={200}/>{q && <button type="button" className="icon-button" aria-label="Xóa tìm kiếm" onClick={() => { setQ(''); void find('', city, type); }}><X size={16}/></button>}</label><label className="location-input"><MapPin size={19}/><select aria-label="Khu vực tìm kiếm" value={city} onChange={e => setCity(e.target.value)}><option value="">Tất cả khu vực</option><option>Hà Nội</option><option>TP. Hồ Chí Minh</option></select><ChevronDown size={14}/></label><button className="button primary" type="submit"><Search size={18}/>Tìm kiếm</button></form>
          <section className="specialty-section"><div className="section-heading"><h2>Bạn đang quan tâm điều gì?</h2><span>Tìm nhanh theo chuyên khoa</span></div><div className="specialty-grid">{[{ name: 'Cơ Xương Khớp', icon: AudioLines, color: 'peach' }, { name: 'Tiêu hóa', icon: Stethoscope, color: 'mint' }, { name: 'Tim mạch', icon: HeartPulse, color: 'pink' }, { name: 'Thần kinh', icon: Sparkles, color: 'lavender' }, { name: 'Tai Mũi Họng', icon: Plus, color: 'blue' }, { name: 'Khám tổng quát', icon: ShieldCheck, color: 'sand' }].map(({ name, icon: Icon, color }) => <button key={name} className={`specialty ${q === name ? 'chosen' : ''}`} onClick={() => categorySearch(name)}><span className={`specialty-icon ${color}`}><Icon size={24} strokeWidth={1.65}/></span><span>{name}</span><ArrowUpRight size={15}/></button>)}</div></section>
          <section id="results" className="results"><div className="section-heading result-heading"><div><div className="eyebrow">THÔNG TIN ĐỂ BẠN LỰA CHỌN</div><h2>{q ? `Kết quả cho “${q}”` : 'Khám phá nơi chăm sóc sức khỏe'}</h2></div><span className="record-count">{loading ? 'Đang tìm…' : `${items.length} kết quả`}</span></div><div className="filter-row"><div className="tabs" aria-label="Loại kết quả">{(['', 'doctor', 'facility', 'specialty', 'service'] as const).map(t => <button key={t} className={type === t ? 'selected' : ''} onClick={() => setType(t)}>{t ? typeLabel[t] : 'Tất cả'}</button>)}</div><span className="updated"><Clock3 size={13}/> Cập nhật {date(health?.ingestion.fetchedAt)}</span></div>
            {error ? <div className="empty"><CircleHelp/><h3>Chưa tải được kết quả</h3><p>{error}</p><button className="button secondary" onClick={() => void find()}>Thử lại</button></div> : loading ? <div className="cards-grid">{[1, 2, 3].map(n => <div className="record-card skeleton" key={n}><div/><div/><div/></div>)}</div> : !items.length ? <div className="empty"><Search/><h3>Chưa có hồ sơ phù hợp</h3><p>Thử đổi khu vực, bỏ bộ lọc hoặc tìm bằng tên chuyên khoa. Dữ liệu hiện có chưa bao phủ toàn bộ BookingCare.</p><button className="button secondary" onClick={() => { setQ(''); setCity(''); setType(''); void find('', '', ''); }}>Xem tất cả</button></div> : <div className="cards-grid">{items.map(r => <RecordCard key={r.id} record={r} onClick={() => setSelected(r)}/>)}</div>}
          </section>
          <section className="help-banner"><div className="help-icon"><MessageCircle size={27}/></div><div><h3>Để việc tìm nơi khám nhẹ nhàng hơn.</h3><p>Hỏi về chuyên khoa, cơ sở y tế hoặc cách đặt lịch. CarePath ở đây để hỗ trợ bạn.</p></div><button className="button secondary" onClick={() => navigate('assistant')}>Hỏi trợ lý <ArrowRight size={17}/></button></section>
        </>}
        {page === 'assistant' && <section className="assistant-page"><div className="page-title"><div className="section-kicker"><span/> TRỢ LÝ ĐIỀU HƯỚNG KHÁM BỆNH</div><h1>Một câu hỏi.<br/><span>Một bước gần hơn.</span></h1><p>Tìm thông tin có nguồn, chọn bước tiếp theo phù hợp với bạn.</p></div><div className="chat-layout"><aside className="chat-aside"><div className="green-icon"><Sparkles size={24}/></div><h3>Tôi có thể giúp bạn…</h3>{prompts.map(p => <button className="prompt" key={p} onClick={() => void send(p)} disabled={busy}><span>{p}</span><ArrowUpRight size={17}/></button>)}<label className="chat-city">Khu vực quan tâm<select value={city} onChange={e => setCity(e.target.value)}><option value="">Tất cả khu vực</option><option>Hà Nội</option><option>TP. Hồ Chí Minh</option></select></label><div className="privacy-note"><ShieldCheck size={18}/><p>Không gửi số điện thoại, CCCD hoặc bệnh án vào chat. Hội thoại chỉ giữ trong phiên mở. Khi bật AI, nội dung đã lọc số định danh được gửi đến Anthropic.</p></div></aside><div className="chat-box"><div className="chat-top"><div className="assistant-avatar"><Plus size={20}/></div><div><strong>CarePath</strong><span>{health?.llmConfigured ? 'Trợ lý AI · có dẫn nguồn' : 'Trợ lý tra cứu · chưa bật LLM'}</span></div><button className="text-button" onClick={() => setTurns([])} disabled={busy || !turns.length}>Cuộc trò chuyện mới</button></div><div className="messages" role="log" aria-label="Cuộc trò chuyện" aria-live="polite">{!turns.length && <div className="chat-welcome"><div className="welcome-icon"><Sparkles size={30}/></div><h2>Chào bạn, tôi là CarePath.</h2><p>Bạn muốn tìm bác sĩ, cơ sở y tế hay cần<br/>hướng dẫn đặt lịch khám?</p><span>Thử một gợi ý bên cạnh để bắt đầu.</span></div>}{turns.map((t, i) => <div className={`turn ${t.role} ${t.error ? 'error-turn' : ''}`} key={i}>{t.role === 'assistant' && <span className="mini-avatar"><Plus size={14}/></span>}<div className="turn-content"><div className="bubble">{t.content}</div>{t.result?.sources.length ? <div className="chat-sources">{t.result.sources.map((r, j) => <button key={r.id} onClick={() => setSelected(r)}><span>[{j + 1}]</span>{r.name}<ArrowUpRight size={13}/></button>)}</div> : null}{t.result && <div className="message-meta">{t.result.mode === 'llm' ? 'AI' : t.result.mode === 'safety' ? 'Hướng dẫn an toàn' : 'Tra cứu'} · {(t.result.metrics.latencyMs / 1000).toFixed(2)} giây{t.result.mode === 'llm' && <> · {t.result.metrics.inputTokens ?? '?'} vào / {t.result.metrics.outputTokens ?? '?'} ra token</>}</div>}{t.result?.notice && <div className="message-notice">{t.result.notice}</div>}</div></div>)}{busy && <div className="thinking"><span/><span/><span/><small>Đang tìm thông tin cho bạn…</small></div>}<div ref={bottom}/></div><div className="composer-wrap"><form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}><textarea rows={2} aria-label="Câu hỏi cho CarePath" placeholder="Bạn muốn tìm nơi khám như thế nào?" value={input} maxLength={2000} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}/><button type="submit" className="send-button" disabled={busy || !input.trim()} aria-label="Gửi câu hỏi"><Send size={18}/></button></form><div className="composer-note"><span>Thông tin hỗ trợ tham khảo, không thay thế tư vấn y khoa.</span><span>{input.length}/2.000</span></div></div></div></div></section>}
        {page === 'booking' && <section className="booking-page"><div className="section-kicker"><span/> CHUẨN BỊ TRƯỚC KHI ĐI KHÁM</div><div className="page-title"><h1>Chủ động một chút.<br/><span>An tâm hơn nhiều.</span></h1><p>CarePath giúp bạn chọn hồ sơ và chuyển sang đặt lịch chính thức trên BookingCare.</p></div><div className="booking-layout"><div className="booking-card"><div className="step-title"><b>01</b><h2>Chọn nơi bạn muốn khám</h2></div>{draft ? <div className="draft-record"><div className="record-icon mint">{draft.type === 'doctor' ? <Stethoscope/> : <Hospital/>}</div><div><small>{typeLabel[draft.type]}</small><strong>{draft.name}</strong><span><MapPin size={14}/>{draft.city}</span></div><button className="icon-button" aria-label="Bỏ lựa chọn" onClick={() => setDraft(null)}><X size={18}/></button></div> : <div className="booking-empty"><Hospital size={32}/><p>Bắt đầu từ một bác sĩ, cơ sở hoặc dịch vụ phù hợp.</p><button className="button secondary" onClick={() => navigate('discover')}>Tìm nơi khám <ArrowRight size={16}/></button></div>}<div className="step-title"><b>02</b><h2>Ghi lại ngày mong muốn</h2></div><label className="date-label">Ngày dự kiến <span>(không bắt buộc)</span><input type="date" min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} value={preferredDate} onChange={e => setPreferredDate(e.target.value)}/></label><p className="field-note">Ngày này chỉ nằm trong ghi chú của bạn, chưa được kiểm tra lịch trống và không tự gửi sang BookingCare.</p><div className="step-title"><b>03</b><h2>Hoàn tất trên BookingCare</h2></div><p className="booking-instruction">Mở hồ sơ chính thức, chọn ngày giờ còn trống, nhập thông tin theo yêu cầu và chờ xác nhận từ BookingCare hoặc cơ sở y tế.</p><div className="booking-actions">{draft ? <a className="button primary" href={draft.url} target="_blank" rel="noopener noreferrer">Tiếp tục trên BookingCare <ExternalLink size={17}/></a> : <button className="button primary" disabled>Chọn hồ sơ để tiếp tục</button>}<button className="button secondary" disabled={!draft} onClick={downloadDraft}><ArrowDownToLine size={17}/>Lưu ghi chú</button></div><div className="booking-warning"><Info size={18}/><span>CarePath chưa tạo lịch hẹn. Chỉ coi lịch đã xác nhận khi bạn nhận xác nhận chính thức.</span></div></div><aside className="checklist"><div className="green-icon"><BookOpen size={24}/></div><h2>Mang theo sự chuẩn bị</h2><p>Một vài điều giúp buổi khám thuận lợi hơn.</p>{['Giấy tờ theo yêu cầu của cơ sở y tế', 'Kết quả khám và xét nghiệm trước đây', 'Danh sách thuốc bạn đang sử dụng', 'Những câu hỏi muốn trao đổi với bác sĩ'].map(t => <div className="check-item" key={t}><span><Check size={14}/></span>{t}</div>)}<div className="checklist-bottom">Hỏi trực tiếp cơ sở về giá, bảo hiểm và yêu cầu chuẩn bị riêng cho dịch vụ bạn chọn.</div></aside></div></section>}
        {page === 'evaluation' && <EvaluationView health={health}/>}
        <footer><span><span className="footer-brand">carepath.</span> Đồng hành từ bước đầu.</span><span>Nguồn công khai: <a href="https://bookingcare.vn/" target="_blank" rel="noopener noreferrer">BookingCare <ArrowUpRight size={12}/></a><i>·</i> Dự án học tập độc lập</span></footer>
      </main>
    </div>
    {(selected || info) && <div className="modal-backdrop" onClick={() => { setSelected(null); setInfo(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><button className="modal-close icon-button" aria-label="Đóng" onClick={() => { setSelected(null); setInfo(false); }}><X size={22}/></button>{selected ? <><span className="modal-kicker">{typeLabel[selected.type]} · NGUỒN BOOKINGCARE</span><h2 id="modal-title">{selected.name}</h2><div className="modal-city"><MapPin size={17}/>{selected.city}</div><div className="tags">{selected.specialties.map(s => <span key={s}>{s}</span>)}</div><p>{selected.summary}</p><div className="source-excerpt"><small>TRÍCH ĐOẠN HỒ SƠ CÔNG KHAI</small><p>{selected.excerpt}</p></div><p className="field-note">Lấy dữ liệu ngày {date(selected.fetchedAt)}. Giá, địa chỉ, chuyên môn và lịch khám có thể thay đổi; hãy xác minh trên trang nguồn.</p><div className="modal-actions"><button className="button primary" onClick={() => prepare(selected)}>Hỗ trợ đặt lịch <CalendarDays size={17}/></button><a href={selected.url} className="button secondary" target="_blank" rel="noopener noreferrer">Xem nguồn <ExternalLink size={16}/></a></div></> : <><div className="green-icon"><HeartPulse size={27}/></div><h2 id="modal-title">Chào bạn, đây là CarePath.</h2><p>CarePath là dự án học tập độc lập, giúp tra cứu hồ sơ công khai trên BookingCare và chuẩn bị đặt lịch. Ứng dụng không đại diện BookingCare hoặc cơ sở y tế.</p><div className="info-box"><strong>{health?.llmConfigured ? 'Đã bật trợ lý AI' : 'Đang ở chế độ tra cứu'}</strong><p>{health?.llmConfigured ? 'Câu trả lời AI dùng Claude Haiku 5.5 qua LangChain, dựa trên các hồ sơ tìm được. Vẫn cần kiểm tra lại tại nguồn.' : 'Chưa cấu hình khóa API. Bạn vẫn có thể tìm hồ sơ và dùng hướng dẫn tự động; các phản hồi tra cứu không do LLM tạo.'}</p></div><p>Không cung cấp chẩn đoán hoặc kê đơn. Không có kết nối để tạo, đổi hoặc hủy lịch hẹn. Hãy hoàn tất đặt khám trực tiếp trên BookingCare.</p><p className="field-note">Không lưu hội thoại vào cơ sở dữ liệu ứng dụng. Khi bật AI, nội dung đã lọc số định danh được gửi tới Anthropic; việc lọc không bảo đảm ẩn mọi thông tin cá nhân. Không gửi dữ liệu nhạy cảm.</p><button className="button primary" onClick={() => setInfo(false)}>Tôi đã hiểu <Check size={17}/></button></>}</section></div>}
  </div>;
}
function RecordCard({ record: r, onClick }: { record: CareRecord; onClick: () => void }) {
  const Icon = r.type === 'doctor' ? Stethoscope : r.type === 'facility' ? Hospital : r.type === 'service' ? Microscope : HeartPulse;
  return <article className="record-card"><div className="card-top"><div className={`record-icon ${r.type === 'doctor' ? 'blue' : r.type === 'specialty' ? 'lavender' : 'mint'}`}><Icon size={26} strokeWidth={1.6}/></div><span className="category-label">{typeLabel[r.type]}</span></div><h3>{r.name}</h3><div className="card-city"><MapPin size={14}/>{r.city}</div><p>{r.specialties.length ? r.specialties.slice(0, 3).join(' · ') : 'Xem thông tin chi tiết tại hồ sơ nguồn'}</p><div className="card-bottom"><span><ShieldCheck size={14}/> BookingCare</span><button onClick={onClick}>Xem hồ sơ <ArrowUpRight size={17}/></button></div></article>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
