import { Reservation, STATUS_LABEL, STATUS_STYLE, formatDate, getTimeDisplay } from '../constants';

interface UpcomingTabProps {
  sortedUpcomingDates: string[];
  upcomingByDate: Map<string, Reservation[]>;
  todayStr: string;
  updateStatus: (id: string, status: Reservation['status']) => void;
}

export default function UpcomingTab({
  sortedUpcomingDates,
  upcomingByDate,
  todayStr,
  updateStatus,
}: UpcomingTabProps) {
  return (
    <div className="space-y-4">
      {sortedUpcomingDates.length === 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 py-10 text-center">
          <p className="text-[13px] text-stone-400">近期沒有預約</p>
        </div>
      )}

      {sortedUpcomingDates.map((date) => (
        <div key={date} className="space-y-2">
          <p className="text-[11px] font-semibold text-stone-500 px-1">
            {formatDate(date)}
            {date === todayStr && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                今天
              </span>
            )}
          </p>
          {upcomingByDate.get(date)!.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-stone-800 truncate">
                    {r.displayName}
                  </p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                      r.bookingType === 'flexible'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {getTimeDisplay(r)}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.note && (
                  <p className="text-[11px] text-stone-400 mt-0.5 truncate italic">{r.note}</p>
                )}
              </div>
              {r.status === 'confirmed' && (
                <div className="flex gap-1.5 shrink-0 ml-2">
                  <button
                    onClick={() => void updateStatus(r.id, 'completed')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    完成
                  </button>
                  <button
                    onClick={() => void updateStatus(r.id, 'cancelled')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
