'use client';

import { useEffect, useRef, useState } from 'react';

import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';
import QuickReplies from './QuickReplies';

interface Message {
  role: 'user' | 'bot';
  content: string;
  source?: 'template' | 'ai' | 'error';
}

const WELCOME_MESSAGE: Message = {
  role: 'bot',
  content:
    '你好！🐜 我是螞蟻窩甜點的智能客服小蟻～\n\n很高興為你服務！你可以直接打字問我問題，或點選下方的常見問題快速查詢。\n\n我可以幫你查詢商品資訊、價格、運費、付款方式等等喔！😊',
  source: 'template',
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setShowQuickReplies(false);

    try {
      const history = messages
        .filter((m) => m !== WELCOME_MESSAGE)
        .map((m) => ({
          role: m.role === 'bot' ? 'assistant' : 'user',
          content: m.content,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      const data = (await res.json()) as {
        response?: string;
        source?: 'template' | 'ai' | 'error';
      };

      const botMessage: Message = {
        role: 'bot',
        content: data.response || '抱歉，我暫時無法回答，請直接聯繫客服 📞 0906367231',
        source: data.source,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content:
            '抱歉，連線似乎出了點問題 😥\n請稍後再試，或直接聯繫我們：\n📞 0906367231\n📧 evaboxbox@gmail.com',
          source: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-lg mx-auto bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#8B5E3C] text-white">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">
          🐜
        </div>
        <div>
          <h1 className="font-bold text-base">螞蟻窩甜點</h1>
          <p className="text-xs text-amber-200">ANT NEST 智能客服</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 bg-[#FFF8F0]">
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} source={msg.source} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-2 mt-1 text-sm">
              🐜
            </div>
            <div className="bg-[#FFF0E0] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#D4A574] rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-[#D4A574] rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-[#D4A574] rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      <QuickReplies onSelect={(msg) => void sendMessage(msg)} show={showQuickReplies} />

      {/* Input */}
      <ChatInput onSend={(msg) => void sendMessage(msg)} disabled={isLoading} />
    </div>
  );
}
