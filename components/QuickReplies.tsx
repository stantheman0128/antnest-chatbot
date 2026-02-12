"use client";

interface QuickRepliesProps {
  onSelect: (message: string) => void;
  show: boolean;
}

const quickOptions = [
  "有什麼甜點？",
  "運費多少？",
  "怎麼下單？",
  "付款方式？",
  "可以自取嗎？",
  "有會員優惠嗎？",
];

export default function QuickReplies({ onSelect, show }: QuickRepliesProps) {
  if (!show) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {quickOptions.map((option) => (
        <button
          key={option}
          onClick={() => onSelect(option)}
          className="px-3 py-1.5 text-xs rounded-full border border-[#D4A574] text-[#8B5E3C] bg-white hover:bg-[#FFF0E0] transition-colors"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
