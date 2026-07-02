import { CONFIG_SECTIONS } from '../constants';

interface ConfigSectionsListProps {
  configs: Map<string, string>;
  startEdit: (key: string) => void;
}

export default function ConfigSectionsList({ configs, startEdit }: ConfigSectionsListProps) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
        AI 設定
      </p>
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-100">
        {CONFIG_SECTIONS.map((section) => {
          const value = configs.get(section.key);
          const hasValue = value !== undefined && value !== '';
          return (
            <button
              key={section.key}
              onClick={() => startEdit(section.key)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-[13px] font-medium text-stone-800">{section.label}</p>
                <p className="text-[11px] text-stone-400 mt-0.5 truncate">{section.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    hasValue ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  {hasValue ? '已設定' : '未設定'}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 text-stone-300 group-hover:text-stone-400 transition-colors"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
