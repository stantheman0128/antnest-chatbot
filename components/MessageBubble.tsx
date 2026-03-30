'use client';

interface MessageBubbleProps {
  role: 'user' | 'bot';
  content: string;
  source?: 'template' | 'ai' | 'error';
}

export default function MessageBubble({ role, content, source: _source }: MessageBubbleProps) {
  const isBot = role === 'bot';

  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-3`}>
      {isBot && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-2 mt-1 text-sm">
          🐜
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isBot
            ? 'bg-[#FFF0E0] text-gray-800 rounded-tl-sm'
            : 'bg-[#8B5E3C] text-white rounded-tr-sm'
        }`}
      >
        {content}
      </div>
    </div>
  );
}
