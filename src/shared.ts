export type RecordType = 'doctor' | 'facility' | 'specialty' | 'service';
export interface CareRecord {
  id: string; name: string; type: RecordType; city: string;
  specialties: string[]; summary: string; excerpt: string;
  url: string; fetchedAt: string; contentHash: string;
}
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatRequest { message: string; history?: ChatMessage[]; city?: string }
export interface ChatResult {
  answer: string; sources: CareRecord[];
  mode: 'llm' | 'lookup' | 'safety' | 'fallback';
  intent: 'search' | 'booking' | 'medical' | 'emergency' | 'privacy' | 'unknown';
  metrics: { latencyMs: number; inputTokens: number | null; outputTokens: number | null; model: string | null; reasoning: string | null };
  notice?: string;
}
