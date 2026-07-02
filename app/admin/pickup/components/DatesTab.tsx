import { Availability, WEEKDAY_ZH, formatDate } from '../constants';

interface DatesTabProps {
  monthLabel: string;
  daysInMonth: string[];
  firstDayOfWeek: number;
  todayStr: string;
  selectedDates: Set<string>;
  existingDateSet: Set<string>;
  availabilities: Availability[];
  loadingDates: boolean;
  formStartTime: string;
  formEndTime: string;
  formMaxBookings: number;
  saving: boolean;
  prevMonth: () => void;
  nextMonth: () => void;
  toggleDate: (dateStr: string) => void;
  setFormStartTime: (v: string) => void;
  setFormEndTime: (v: string) => void;
  setFormMaxBookings: (v: number) => void;
  applyDates: () => void;
  deleteAvailability: (id: string) => void;
}

export default function DatesTab({
  monthLabel,
  daysInMonth,
  firstDayOfWeek,
  todayStr,
  selectedDates,
  existingDateSet,
  availabilities,
  loadingDates,
  formStartTime,
  formEndTime,
  formMaxBookings,
  saving,
  prevMonth,
  nextMonth,
  toggleDate,
  setFormStartTime,
  setFormEndTime,
  setFormMaxBookings,
  applyDates,
  deleteAvailability,
}: DatesTabProps) {
  return (
    <div className="space-y-4">
      {/* Calendar */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <span className="text-[13px] font-semibold text-stone-800">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_ZH.map((w) => (
            <div key={w} className="text-center text-[11px] text-stone-400 py-1 font-medium">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {daysInMonth.map((dateStr) => {
            const isPast = dateStr < todayStr;
            const isSelected = selectedDates.has(dateStr);
            const hasAvail = existingDateSet.has(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => toggleDate(dateStr)}
                disabled={isPast}
                className={`relative w-9 h-9 mx-auto flex items-center justify-center rounded-full text-[13px] font-medium transition-colors
                  ${isPast ? 'text-stone-300 cursor-not-allowed' : ''}
                  ${!isPast && isSelected ? 'bg-amber-800 text-white' : ''}
                  ${!isPast && !isSelected ? 'hover:bg-stone-100 text-stone-800' : ''}
                `}
              >
                {new Date(dateStr + 'T00:00:00').getDate()}
                {hasAvail && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>
        {selectedDates.size > 0 && (
          <p className="text-center text-[11px] text-amber-700 mt-2 font-medium">
            已選 {selectedDates.size} 天
          </p>
        )}
      </div>

      {/* Time window form */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
        <p className="text-[13px] font-semibold text-stone-800">套用設定到已選日期</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-stone-400 block mb-1.5 uppercase tracking-widest">
              開始時間
            </label>
            <input
              type="time"
              value={formStartTime}
              onChange={(e) => setFormStartTime(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-stone-400 block mb-1.5 uppercase tracking-widest">
              結束時間
            </label>
            <input
              type="time"
              value={formEndTime}
              onChange={(e) => setFormEndTime(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-stone-400 block mb-1.5 uppercase tracking-widest">
            最多預約人數
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={formMaxBookings}
            onChange={(e) => setFormMaxBookings(Number(e.target.value))}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors"
          />
        </div>
        <button
          onClick={() => void applyDates()}
          disabled={saving || selectedDates.size === 0}
          className="w-full py-2.5 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
        >
          {saving ? '套用中...' : `套用到 ${selectedDates.size} 個日期`}
        </button>
      </div>

      {/* Existing availabilities */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-1">
          已設定的日期
        </p>
        {loadingDates && (
          <div className="flex justify-center py-6">
            <div className="w-4 h-4 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
          </div>
        )}
        {!loadingDates && availabilities.length === 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 py-10 text-center">
            <p className="text-[13px] text-stone-400">還沒有設定取貨日期</p>
          </div>
        )}
        {availabilities.map((avail) => (
          <div
            key={avail.id}
            className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p className="text-[13px] font-semibold text-stone-800">
                {formatDate(avail.availableDate)}
              </p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {avail.startTime.slice(0, 5)}–{avail.endTime.slice(0, 5)}
                <span className="mx-1.5 text-stone-300">·</span>
                上限 {avail.maxBookings} 人<span className="mx-1.5 text-stone-300">·</span>
                已預約 {avail.currentBookings}
              </p>
            </div>
            <button
              onClick={() => void deleteAvailability(avail.id)}
              className="text-[11px] px-2.5 py-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
            >
              刪除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
