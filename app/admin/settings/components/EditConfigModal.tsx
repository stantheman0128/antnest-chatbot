import {
  CONFIG_MAX_LENGTHS,
  CONFIG_SECTIONS,
  DEFAULT_MAX_LENGTH,
  hasSuspiciousContent,
} from '../constants';

interface EditConfigModalProps {
  editingKey: string;
  editValue: string;
  setEditValue: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function EditConfigModal({
  editingKey,
  editValue,
  setEditValue,
  saving,
  onClose,
  onSave,
}: EditConfigModalProps) {
  const maxLength = CONFIG_MAX_LENGTHS[editingKey] || DEFAULT_MAX_LENGTH;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-stone-800">
            {CONFIG_SECTIONS.find((s) => s.key === editingKey)?.label || editingKey}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            maxLength={maxLength}
            rows={15}
            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-stone-900 text-[13px] font-mono bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors resize-none"
          />
          <div className="flex justify-between mt-1.5 px-1">
            {hasSuspiciousContent(editValue) ? (
              <p className="text-[11px] text-orange-500">⚠️ 內容可能包含注入語句，請確認</p>
            ) : (
              <span />
            )}
            <p className="text-[11px] text-stone-400">
              {editValue.length} / {maxLength}
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-stone-200 rounded-xl text-[13px] text-stone-600 font-medium hover:bg-stone-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => void onSave()}
            disabled={saving}
            className="flex-1 py-2.5 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 disabled:opacity-60 transition-colors"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
