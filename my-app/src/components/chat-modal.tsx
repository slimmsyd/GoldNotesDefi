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
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
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
  isDarkMode = false,
  onToggleDarkMode,
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
            className={`fixed inset-y-0 right-0 z-50 shadow-2xl flex flex-col ${isDarkMode
                ? 'bg-[#0a0a0a] border-l border-white/10'
                : 'bg-white border-l border-gray-200'
              }`}
            style={drawerStyle ?? { width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode
                ? 'border-white/10 bg-black/40'
                : 'border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50'
              }`}>
              <div className="flex flex-col">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Chat Assistant</h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ask anything about GoldBack and W3B</p>
              </div>
              <div className="flex items-center gap-2">
                {onToggleDarkMode && (
                  <button
                    onClick={onToggleDarkMode}
                    className={`transition-colors p-2 rounded-full ${isDarkMode
                        ? 'text-yellow-400 hover:bg-white/10 hover:text-yellow-300'
                        : 'text-gray-400 hover:bg-white/50 hover:text-yellow-500'
                      }`}
                    aria-label="Toggle dark mode"
                    type="button"
                  >
                    {isDarkMode ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path stroke="none" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 4.22a1 1 0 011.415 0l.708.708a1 1 0 01-1.414 1.414l-.708-.708a1 1 0 010-1.414zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM15.636 15.636a1 1 0 010 1.414l-.708.708a1 1 0 01-1.414-1.414l.708-.708a1 1 0 011.414 0zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.22-4.22a1 1 0 01-1.414 0l-.708-.708a1 1 0 011.414-1.414l.708.708a1 1 0 010 1.414zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zM5.78 4.364a1 1 0 010 1.414L5.07 6.485A1 1 0 013.657 5.07l.708-.708a1 1 0 011.414 0zM10 6a4 4 0 100 8 4 4 0 000-8z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    )}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`transition-colors p-1 rounded-lg ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
                    }`}
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
                    className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.sender === 'user'
                          ? isDarkMode ? 'text-black' : 'text-gray-900'
                          : isDarkMode ? 'bg-white/10 text-gray-100 border border-white/5' : 'bg-gray-100 text-gray-900'
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
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-white/10 bg-black/40' : 'border-gray-200 bg-gray-50'
              }`}>
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
                  className={`flex-1 rounded-full px-5 py-3 focus:outline-none text-sm border shadow-inner ${isDarkMode
                      ? 'bg-black/60 border-white/10 text-white placeholder-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                />
                <button
                  type="submit"
                  disabled={isStreaming || !draft.trim()}
                  className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:shadow-lg hover:shadow-[#c9a84c]/50 disabled:opacity-50 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${(!isStreaming && draft.trim()) ? (isDarkMode ? 'bg-[#c9a84c] text-black' : 'bg-[#c9a84c] text-black') : (isDarkMode ? 'bg-white/10 text-white/50' : 'bg-gray-200 text-gray-400')
                    }`}
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
