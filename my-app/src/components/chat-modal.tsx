'use client';

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
}

export function ChatModal({ isOpen, onClose, messages }: ChatModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 right-8 transform -translate-y-1/2 z-50 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-amber-50">
            <h3 className="text-lg font-semibold text-gray-900">Chat Assistant</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white/50"
              aria-label="Close chat"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.sender === 'user'
                      ? 'text-gray-900'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                  style={{
                    background: message.sender === 'user' 
                      ? 'linear-gradient(to right, #FFE860, #FEFDD6)' 
                      : undefined,
                  }}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                </div>
                
                {/* Timestamp */}
                <span className="text-xs text-gray-500 mt-1 px-2">
                  {message.timestamp}
                </span>
              </div>
            ))}
            
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">No messages yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Continue asking questions using the input below
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

