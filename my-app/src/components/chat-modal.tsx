'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  onSend: () => void;
  isStreaming: boolean;
  streamingAiId: string | null;
  streamingStatus: string | null;
}

export function ChatModal({
  isOpen,
  onClose,
  messages,
  draft,
  setDraft,
  onSend,
  isStreaming,
  streamingAiId,
  streamingStatus,
}: ChatModalProps) {
  // Desktop: push-layout-left happens in parent. Here we decide whether to use an overlay/backdrop.
  const [isDesktop, setIsDesktop] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // Close on Escape.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    // Auto-scroll + focus when opened / new messages arrive.
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    inputRef.current?.focus();
  }, [isOpen, messages.length]);

  // On overlay mode (mobile/tablet), prevent background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    if (isDesktop) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, isDesktop]);

  const drawerWidth = 420;
  const drawerStyle = useMemo(
    () => (isDesktop ? { width: `${drawerWidth}px` } : undefined),
    [isDesktop]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop only for overlay (mobile/tablet) */}
          {!isDesktop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={onClose}
            />
          )}

          {/* Right drawer */}
          <motion.aside
            key="chat-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Chat Assistant"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-y-0 right-0 z-50 bg-white border-l border-gray-200 shadow-2xl flex flex-col"
            style={drawerStyle ?? { width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-gray-900">Chat Assistant</h3>
                <p className="text-xs text-gray-500">Ask anything about GoldBack and W3B</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white/50"
                aria-label="Close chat"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      message.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.sender === 'user'
                          ? 'text-gray-900'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                      style={{
                        background:
                          message.sender === 'user'
                            ? 'linear-gradient(to right, #FFE860, #FEFDD6)'
                            : undefined,
                      }}
                    >
                      {message.sender === 'ai' &&
                      isStreaming &&
                      streamingAiId === message.id &&
                      !message.text ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-900 animate-spin" />
                          <span className="text-xs text-gray-500">
                            {streamingStatus || 'Thinking…'}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                      )}
                    </div>
                    {message.sender === 'ai' && isStreaming && streamingAiId === message.id ? (
                      <span className="text-[11px] text-gray-400 mt-1 px-2">
                        {streamingStatus || 'Thinking…'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 mt-1 px-2">{message.timestamp}</span>
                    )}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask for Gnosis..."
                  className="flex-1 bg-white rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !draft.trim()}
                  className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg hover:shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: !isStreaming && draft.trim()
                      ? 'linear-gradient(to right, #FFE860, #FEFDD6)'
                      : undefined,
                  }}
                  aria-label="Send message"
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
              </form>
              {isStreaming && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Assistant is responding…
                </p>
              )}
              <p className="mt-2 text-[11px] text-gray-500">
                Tip: Press <span className="font-semibold">Esc</span> to close.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
