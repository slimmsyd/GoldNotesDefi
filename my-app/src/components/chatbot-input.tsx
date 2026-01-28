'use client';

import { useState } from 'react';
import { ChatModal } from './chat-modal';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

export function ChatbotInput() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const generateAIResponse = (userQuestion: string): string => {
    // Simulated AI responses - you can replace this with actual API calls
    const responses = [
      "Hello! I'm here to help you with any questions about our window tinting services. How can I assist you today?",
      "Thank you for your question! Our team specializes in providing top-quality solutions. Let me help you with that.",
      "Great question! I'd be happy to provide more information about that. What specific details are you interested in?",
      "I appreciate your interest! Let me share some insights that might help answer your question.",
    ];
    
    // For demo purposes, return a random response
    // In production, this would call your AI API
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const currentTime = getCurrentTime();
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: input.trim(),
      sender: 'user',
      timestamp: currentTime,
    };
    
    // Generate AI response
    const aiResponse: Message = {
      id: `ai-${Date.now()}`,
      text: generateAIResponse(input.trim()),
      sender: 'ai',
      timestamp: currentTime,
    };
    
    // Update messages
    setMessages(prev => [...prev, userMessage, aiResponse]);
    
    // Open modal
    setIsModalOpen(true);
    
    // Clear input after submission
    setInput('');
  };

  return (
    <>
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
        <form onSubmit={handleSubmit} className="relative">
          {/* Input Container */}
          <div className="relative flex items-center bg-white/90 backdrop-blur-md rounded-lg border border-gray-300 shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden">
            {/* Input Field */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask For Help"
              className="flex-1 bg-transparent px-6 py-4 text-gray-900 placeholder-gray-500 focus:outline-none text-base font-light"
            />
            
          {/* Submit Button */}
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex-shrink-0 mr-2 w-10 h-10 flex items-center justify-center rounded-lg hover:shadow-lg hover:shadow-yellow-500/50 disabled:from-gray-300 disabled:to-gray-300 disabled:opacity-50 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: input.trim() ? 'linear-gradient(to right, #FFE860, #FEFDD6)' : undefined,
            }}
          >
            <svg
              className="w-5 h-5 text-gray-900"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
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

      {/* Chat Modal */}
      <ChatModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        messages={messages}
      />
    </>
  );
}

