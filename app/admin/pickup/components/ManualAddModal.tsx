import { Dispatch, SetStateAction } from 'react';

import { AddForm, Availability, PERIOD_LABEL, formatDate } from '../constants';

interface ManualAddModalProps {
  availabilities: Availability[];
  addForm: AddForm;
  setAddForm: Dispatch<SetStateAction<AddForm>>;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ManualAddModal({
  availabilities,
  addForm,
  setAddForm,
  onClose,
  onSubmit,
}: ManualAddModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-stone-800">手動新增預約</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400"
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
        <div className="p-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-[11px] font-semibold text-stone-500 block mb-1">日期</label>
            <select
              value={addForm.availabilityId}
              onChange={(e) => setAddForm((f) => ({ ...f, availabilityId: e.target.value }))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50"
            >
              <option value="">選擇日期</option>
              {availabilities.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatDate(a.availableDate)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-stone-500 block mb-1">顧客名稱</label>
            <input
              type="text"
              value={addForm.displayName}
              placeholder="輸入名字"
              onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-stone-500 block mb-1">預約方式</label>
            <div className="flex gap-2">
              {(['flexible', 'exact'] as const).map((bt) => (
                <button
                  key={bt}
                  onClick={() => setAddForm((f) => ({ ...f, bookingType: bt }))}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-medium border transition-colors ${
                    addForm.bookingType === bt
                      ? 'bg-amber-800 text-white border-amber-800'
                      : 'border-stone-200 text-stone-500'
                  }`}
                >
                  {bt === 'flexible' ? '彈性時段' : '精確時間'}
                </button>
              ))}
            </div>
          </div>
          {addForm.bookingType === 'exact' ? (
            <div>
              <label className="text-[11px] font-semibold text-stone-500 block mb-1">
                取貨時間
              </label>
              <input
                type="time"
                value={addForm.pickupTime}
                onChange={(e) => setAddForm((f) => ({ ...f, pickupTime: e.target.value }))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50"
              />
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-semibold text-stone-500 block mb-1">時段</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PERIOD_LABEL).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setAddForm((f) => ({ ...f, flexiblePeriod: key }))}
                    className={`py-2 rounded-xl text-[13px] font-medium border transition-colors ${
                      addForm.flexiblePeriod === key
                        ? 'bg-amber-800 text-white border-amber-800'
                        : 'border-stone-200 text-stone-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-[11px] font-semibold text-stone-500 block mb-1">備註</label>
            <input
              type="text"
              value={addForm.note}
              placeholder="選填"
              onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50"
            />
          </div>
        </div>
        <div className="p-4 border-t border-stone-100">
          <button
            onClick={() => void onSubmit()}
            disabled={!addForm.availabilityId || !addForm.displayName.trim()}
            className="w-full py-2.5 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
          >
            新增預約
          </button>
        </div>
      </div>
    </div>
  );
}
