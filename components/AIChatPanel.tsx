import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2, Sparkles } from 'lucide-react';
import { getGeminiResponse, ChatMessage } from '../services/geminiService';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contextData: string; // Serialized data of the current view
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ isOpen, onClose, contextData }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: 'Hello! I am your Ops Copilot. I have context about the clusters currently visible on your screen. How can I assist you with maintenance or troubleshooting today?',
      timestamp: Date.now()
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await getGeminiResponse(userMsg.content, contextData, messages);
      
      const botMsg: ChatMessage = {
        role: 'model',
        content: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 z-50 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
      {/* Header */}
      <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500 rounded-lg">
             <Sparkles size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Ops Copilot</h3>
            <p className="text-xs text-slate-400">Powered by Gemini 2.5</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-slate-700 border border-gray-100 rounded-bl-none'
              }`}
            >
              {msg.role === 'model' && (
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  <Bot size={12} /> Copilot
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
               <Loader2 className="animate-spin text-indigo-600" size={18} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your clusters..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`p-2 rounded-full transition-colors ${
              input.trim() 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;