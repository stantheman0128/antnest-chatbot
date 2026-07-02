import { MODEL_FIELDS } from '../constants';

interface ModelConfigSectionProps {
  configs: Map<string, string>;
  onSelectModel: (key: string, value: string) => void;
  onResetModels: () => void;
}

export default function ModelConfigSection({
  configs,
  onSelectModel,
  onResetModels,
}: ModelConfigSectionProps) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
        AI 模型配置
      </p>
      <div className="bg-white rounded-2xl border border-stone-100 px-4 py-4 space-y-4">
        {MODEL_FIELDS.map(({ key, label, desc, defaultVal }) => (
          <div key={key}>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-[13px] font-medium text-stone-800">{label}</p>
              <p className="text-[10px] text-stone-300">
                預設：{defaultVal.replace('gemini-', '')}
              </p>
            </div>
            <p className="text-[11px] text-stone-400 mb-1.5">{desc}</p>
            <select
              value={configs.get(key) || defaultVal}
              onChange={(e) => onSelectModel(key, e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl text-[13px] text-stone-700 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700"
            >
              <option value="gemini-2.5-flash-lite">2.5 Flash-Lite（最快）</option>
              <option value="gemini-2.5-flash">2.5 Flash（均衡）</option>
              <option value="gemini-2.5-pro">2.5 Pro（最強推理）</option>
              <option value="gemini-3-flash-preview">3 Flash Preview（實驗性）</option>
              <option value="gemini-3.1-flash-lite-preview">
                3.1 Flash-Lite Preview（實驗性）
              </option>
            </select>
          </div>
        ))}

        {/* Reset to defaults button */}
        <button
          onClick={onResetModels}
          className="w-full py-2.5 border border-stone-200 rounded-xl text-[12px] font-medium text-stone-500 hover:bg-stone-50 transition-colors"
        >
          恢復預設模型設定
        </button>
      </div>
    </div>
  );
}
