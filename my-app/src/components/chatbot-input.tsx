'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatModal } from './chat-modal';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

export function ChatbotInput() {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string>('anonymous');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const prevBodyStylesRef = useRef<{ paddingRight: string; overflowX: string; transition: string } | null>(
    null
  );

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getFallbackResponse = (): string => {
    const responses = [
      "Chat is temporarily unavailable. Try again in a moment.",
      "I couldn't reach the chat service right now. Please retry.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  useEffect(() => {
    // Stable per-browser identity for the upstream chat API.
    try {
      const key = 'w3b_chat_user_id';
      const existing = window.localStorage.getItem(key);
      if (existing) {
        setUserId(existing);
        return;
      }
      const created = window.crypto?.randomUUID?.() || `anon-${Date.now()}`;
      window.localStorage.setItem(key, created);
      setUserId(created);
    } catch {
      // If storage is blocked, keep anonymous.
      setUserId('anonymous');
    }
  }, []);

  const stripThinking = (text: string): string => {
    if (!text) return text;
    let out = text;

    // Remove complete <thinking>...</thinking> blocks.
    out = out.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    const lower = out.toLowerCase();
    const openIdx = lower.indexOf('<thinking');
    if (openIdx !== -1) {
      // If an opening tag exists without a matching close (likely mid-stream), hide it and everything after.
      out = out.slice(0, openIdx);
    }

    const trimPartialSuffix = (tag: string) => {
      const l = out.toLowerCase();
      const t = tag.toLowerCase();
      const max = Math.min(l.length, t.length - 1);
      for (let i = max; i >= 1; i--) {
        if (l.endsWith(t.slice(0, i))) {
          out = out.slice(0, out.length - i);
          return;
        }
      }
    };

    // Prevent partial tokens like "<th" / "inking" / ">" from flashing in the UI.
    trimPartialSuffix('<thinking>');
    trimPartialSuffix('</thinking>');

    return out;
  };

  useEffect(() => {
    // Desktop push-layout-left: reserve space so the drawer doesn't cover content.
    const mq = window.matchMedia('(min-width: 768px)');
    const drawerWidthPx = '420px';

    const reset = () => {
      const prev = prevBodyStylesRef.current;
      if (!prev) return;
      document.body.style.paddingRight = prev.paddingRight;
      document.body.style.overflowX = prev.overflowX;
      document.body.style.transition = prev.transition;
      prevBodyStylesRef.current = null;
    };

    const apply = () => {
      if (!isOpen || !mq.matches) {
        reset();
        return;
      }
      if (!prevBodyStylesRef.current) {
        prevBodyStylesRef.current = {
          paddingRight: document.body.style.paddingRight,
          overflowX: document.body.style.overflowX,
          transition: document.body.style.transition,
        };
      }
      document.body.style.transition = document.body.style.transition || 'padding-right 220ms ease';
      document.body.style.paddingRight = drawerWidthPx;
      document.body.style.overflowX = 'hidden';
    };

    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      reset();
    };
  }, [isOpen]);

  const createUserAndAiPlaceholder = (text: string) => {
    const currentTime = getCurrentTime();

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: currentTime,
    };
    
    // AI placeholder (streamed in)
    const aiId = `ai-${Date.now()}`;
    const aiResponse: Message = {
      id: aiId,
      text: '',
      sender: 'ai',
      timestamp: currentTime,
    };
    
    // Update messages
    setMessages(prev => [...prev, userMessage, aiResponse]);

    return aiId;
  };

  const streamAiResponseInto = async (aiId: string, text: string) => {
    let rawAnswer = '';
    let sseBuffer = '';
    let rafScheduled = false;
    let nextVisible = '';

    const scheduleMessageUpdate = (visible: string) => {
      nextVisible = visible;
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, text: nextVisible } : m))
        );
      });
    };

    // If no status arrives quickly, show a generic thinking indicator after a beat.
    const thinkingFallback = window.setTimeout(() => {
      setActiveStatus((prev) => (prev && prev !== 'Sent' ? prev : 'Thinking…'));
    }, 650);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, userId }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        // Useful in dev to see why /api/chat failed (missing env, 401, etc).
        console.warn('Chat API error:', res.status, errText);
        throw new Error(errText || `Upstream error (${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';

      // Streaming: upstream is typically SSE (text/event-stream). Parse "data:" frames.
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as any;
        const finalText =
          (typeof json?.message === 'string' && json.message) ||
          (typeof json?.response === 'string' && json.response) ||
          (typeof json?.text === 'string' && json.text) ||
          JSON.stringify(json);
        scheduleMessageUpdate(stripThinking(finalText));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        const finalText = await res.text();
        scheduleMessageUpdate(stripThinking(finalText));
        return;
      }

      const decoder = new TextDecoder();
      const normalize = (chunkText: string) => chunkText.replace(/\r\n/g, '\n');

      const handlePayload = (payload: string) => {
        const trimmed = payload.trim();
        if (!trimmed) return;

        // Some SSE servers use [DONE] sentinels.
        if (trimmed === '[DONE]') {
          return;
        }

        let obj: any = null;
        try {
          obj = JSON.parse(payload);
        } catch {
          // Not JSON: treat as plain token text.
        }

        if (obj && typeof obj === 'object') {
          const t = typeof obj.type === 'string' ? obj.type : '';
          if (t === 'status') {
            if (typeof obj.content === 'string' && obj.content.trim()) {
              setActiveStatus(obj.content.trim());
            }
            return;
          }
          if (t === 'token') {
            if (typeof obj.content === 'string') {
              rawAnswer += obj.content;
              scheduleMessageUpdate(stripThinking(rawAnswer));
            }
            return;
          }
          if (t === 'complete') {
            const answer =
              (typeof obj.answer === 'string' && obj.answer) ||
              (typeof obj.content === 'string' && obj.content) ||
              rawAnswer;
            rawAnswer = answer;
            scheduleMessageUpdate(stripThinking(rawAnswer));
            return;
          }
          return;
        }

        // Plain text payload: treat as tokens.
        rawAnswer += payload;
        scheduleMessageUpdate(stripThinking(rawAnswer));
      };

      const handleSseBlock = (block: string) => {
        // Collect all data lines. SSE permits multiple data: lines per event.
        const dataLines = block
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, '')); // "data: " -> payload

        if (dataLines.length === 0) return;
        const payload = dataLines.join('\n');
        handlePayload(payload);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += normalize(decoder.decode(value, { stream: true }));

        // Process complete SSE event blocks separated by a blank line.
        while (true) {
          const sep = sseBuffer.indexOf('\n\n');
          if (sep === -1) break;
          const block = sseBuffer.slice(0, sep);
          sseBuffer = sseBuffer.slice(sep + 2);
          handleSseBlock(block);
        }
      }

      sseBuffer += normalize(decoder.decode());
      // Flush any remaining final block (some servers omit trailing \n\n).
      if (sseBuffer.trim().length > 0) {
        handleSseBlock(sseBuffer);
      }
    } catch (e) {
      const fallback = getFallbackResponse();
      scheduleMessageUpdate(fallback);
    }
    window.clearTimeout(thinkingFallback);
  };

  const handleSend = () => {
    if (isStreaming) return;
    const text = draft.trim();
    if (!text) return;
    const aiId = createUserAndAiPlaceholder(text);
    setIsStreaming(true);
    setActiveAiId(aiId);
    setActiveStatus('Sent');

    // Clear draft after sending
    setDraft('');

    void streamAiResponseInto(aiId, text).finally(() => {
      setIsStreaming(false);
      setActiveAiId(null);
      setActiveStatus(null);
    });
  };

  const handleLauncherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStreaming) return;
    const text = draft.trim();
    if (!text) return;
    // Open only when the user submits a question.
    setIsOpen(true);
    const aiId = createUserAndAiPlaceholder(text);
    setIsStreaming(true);
    setActiveAiId(aiId);
    setActiveStatus('Sent');
    setDraft('');

    void streamAiResponseInto(aiId, text).finally(() => {
      setIsStreaming(false);
      setActiveAiId(null);
      setActiveStatus(null);
    });
  };

  return (
    <>
      {!isOpen && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <form onSubmit={handleLauncherSubmit} className="relative">
            <div className="relative flex items-center bg-white/90 backdrop-blur-md rounded-lg border border-gray-300 shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask For Help"
                className="flex-1 bg-transparent px-6 py-4 text-gray-900 placeholder-gray-500 focus:outline-none text-base font-light"
              />

              <button
                type="submit"
                disabled={!draft.trim()}
                className="flex-shrink-0 mr-2 w-10 h-10 flex items-center justify-center rounded-lg hover:shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                style={{
                  background: draft.trim() ? 'linear-gradient(to right, #FFE860, #FEFDD6)' : undefined,
                }}
                aria-label="Submit question"
              >
                <svg className="w-5 h-5 text-gray-900" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 4L12 20M12 4L6 10M12 4L18 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Chat Modal */}
      <ChatModal 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        draft={draft}
        setDraft={setDraft}
        onSend={handleSend}
        isStreaming={isStreaming}
        streamingAiId={activeAiId}
        streamingStatus={activeStatus}
      />
    </>
  );
}
