import { useEffect, useRef, type KeyboardEvent } from 'react';
import Markdown from 'react-markdown';
import { ArrowUpRight, Plus, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { CareRecord, ChatMessage, ChatResult } from './shared';
export type Turn=ChatMessage & {result?:ChatResult;error?:boolean};
const prompts=['Tìm bác sĩ tiêu hóa ở Hà Nội','Tôi muốn khám tổng quát tại TP. Hồ Chí Minh','Làm sao để đặt lịch khám?','Thông tin về xét nghiệm tại Diag'];
export function shouldSendOnEnter(event:{key:string;shiftKey:boolean;isComposing:boolean;keyCode?:number},composing=false){return event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!composing&&event.keyCode!==229;}
export function MessageContent({text,assistant}:{text:string;assistant:boolean}){
  return assistant ? <div className="bubble markdown-answer"><Markdown skipHtml allowedElements={['p','strong','em','ul','ol','li','br','blockquote','code']} unwrapDisallowed>{text}</Markdown></div> : <div className="bubble user-text">{text}</div>;
}
type Props={turns:Turn[];input:string;busy:boolean;city:string;llmConfigured:boolean|null;healthError:boolean;onInput:(s:string)=>void;onCity:(s:string)=>void;onSend:(s?:string)=>Promise<void>;onReset:()=>void;onSource:(r:CareRecord)=>void};
export function ChatPanel({turns,input,busy,city,llmConfigured,healthError,onInput,onCity,onSend,onReset,onSource}:Props){
  const bottom=useRef<HTMLDivElement>(null),textarea=useRef<HTMLTextAreaElement>(null),composing=useRef(false);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:busy?'auto':'smooth',block:'nearest'});},[turns,busy]);
  useEffect(()=>{const el=textarea.current;if(el){el.style.height='auto';el.style.height=Math.min(160,Math.max(52,el.scrollHeight))+'px';}},[input]);
  function keyDown(event:KeyboardEvent<HTMLTextAreaElement>){
    if(shouldSendOnEnter({...event.nativeEvent,key:event.key,shiftKey:event.shiftKey},composing.current)){event.preventDefault();if(!busy)void onSend();}
  }
  return <section className="assistant-page">
    <div className="page-title"><div className="section-kicker"><span/> TRỢ LÝ ĐIỀU HƯỚNG KHÁM BỆNH</div><h1>Một câu hỏi.<br/><span>Một bước gần hơn.</span></h1><p>Tìm thông tin có nguồn, chọn bước tiếp theo phù hợp với bạn.</p></div>
    <div className="chat-layout">
      <aside className="chat-aside"><div className="green-icon"><Sparkles size={24}/></div><h3>Tôi có thể giúp bạn…</h3>{prompts.map(p=><button type="button" className="prompt" key={p} onClick={()=>void onSend(p)} disabled={busy}><span>{p}</span><ArrowUpRight size={17}/></button>)}
        <label className="chat-city">Khu vực quan tâm<select value={city} onChange={e=>onCity(e.target.value)}><option value="">Tất cả khu vực</option><option>Hà Nội</option><option>TP. Hồ Chí Minh</option></select></label>
        <div className="privacy-note"><ShieldCheck size={18}/><p>Không gửi số điện thoại, CCCD hoặc bệnh án vào chat. Hội thoại chỉ giữ trong phiên mở. Khi bật AI, nội dung đã lọc số định danh được gửi đến Anthropic.</p></div>
      </aside>
      <div className="chat-box" aria-busy={busy}>
        <div className="chat-top"><div className="assistant-avatar"><Plus size={20}/></div><div><strong>CarePath</strong><span>{healthError?'Chưa kiểm tra được kết nối':llmConfigured===null?'Đang kiểm tra kết nối…':llmConfigured?'Claude · có dẫn nguồn':'Tra cứu · chưa bật Claude'}</span></div><button type="button" className="text-button" onClick={onReset} disabled={busy||!turns.length}>Cuộc trò chuyện mới</button></div>
        {llmConfigured===false&&!healthError&&<div className="chat-mode-note" role="status">Đang dùng tra cứu tự động. Claude chưa được cấu hình trên máy chủ này.</div>}
        <div className="messages" role="log" aria-label="Cuộc trò chuyện" aria-live="polite" aria-relevant="additions text">
          {!turns.length&&<div className="chat-welcome"><div className="welcome-icon"><Sparkles size={30}/></div><h2>Chào bạn, tôi là CarePath.</h2><p>Bạn muốn tìm bác sĩ, cơ sở y tế hay cần hướng dẫn đặt lịch khám?</p><span>Chọn gợi ý hoặc nhập câu hỏi bên dưới.</span></div>}
          {turns.map((t,i)=><div className={`turn ${t.role} ${t.error?'error-turn':''}`} key={i}>{t.role==='assistant'&&<span className="mini-avatar"><Plus size={14}/></span>}<div className="turn-content"><MessageContent text={t.content} assistant={t.role==='assistant'}/>
            {!!t.result?.sources.length&&<div className="chat-sources" aria-label="Nguồn tham khảo">{t.result.sources.map((r,j)=><button type="button" key={r.id} onClick={()=>onSource(r)}><span>[{j+1}]</span><span>{r.name}</span><ArrowUpRight size={14}/></button>)}</div>}
            {t.result&&<div className="message-meta">{t.result.mode==='llm'?'Claude':t.result.mode==='safety'?'Hướng dẫn an toàn':t.result.mode==='fallback'?'Tra cứu dự phòng':'Tra cứu'} · {(t.result.metrics.latencyMs/1000).toFixed(2)} giây{t.result.mode==='llm'&&<> · {t.result.metrics.inputTokens??'?'} vào / {t.result.metrics.outputTokens??'?'} ra token</>}</div>}
            {t.result?.notice&&<div className="message-notice">{t.result.notice}</div>}
          </div></div>)}
          {busy&&<div className="thinking" role="status"><span/><span/><span/><small>Đang tìm thông tin cho bạn…</small></div>}<div ref={bottom}/>
        </div>
        <div className="composer-wrap"><form className="composer" onSubmit={e=>{e.preventDefault();if(!busy&&!composing.current)void onSend();}}><textarea ref={textarea} rows={2} aria-label="Câu hỏi cho CarePath" aria-describedby="chat-input-help" placeholder="Ví dụ: Tìm bác sĩ tiêu hóa ở Hà Nội…" value={input} maxLength={2000} onChange={e=>onInput(e.target.value)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={keyDown}/><button type="submit" className="send-button" disabled={busy||!input.trim()} aria-label="Gửi câu hỏi"><Send size={20}/></button></form><div className="composer-note" id="chat-input-help"><span>Enter để gửi · Shift + Enter để xuống dòng</span><span>{input.length.toLocaleString('vi-VN')}/2.000</span></div><p className="chat-disclaimer">Thông tin tham khảo, không thay thế tư vấn y khoa.</p></div>
      </div>
    </div>
  </section>;
}
