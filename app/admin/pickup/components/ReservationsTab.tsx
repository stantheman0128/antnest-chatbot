import { Reservation, STATUS_LABEL, STATUS_STYLE, formatDate, getTimeDisplay } from '../constants';

interface ReservationsTabProps {
  reservations: Reservation[];
  dateFilter: string;
  setDateFilter: (v: string) => void;
  fetchReservations: (date?: string) => void;
  updateStatus: (id: string, status: Reservation['status']) => void;
}

export default function ReservationsTab({
  reservations,
  dateFilter,
  setDateFilter,
  fetchReservations,
  updateStatus,
}: ReservationsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            void fetchReservations(e.target.value || undefined);
          }}
          className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors"
        />
        {dateFilter && (
          <button
            onClick={() => {
              setDateFilter('');
              void fetchReservations();
            }}
            className="text-[11px] text-stone-400 hover:text-stone-600 px-2 transition-colors"
          >
            清除
          </button>
        )}
      </div>

      {reservations.length === 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 py-10 text-center">
          <p className="text-[13px] text-stone-400">
            {dateFilter ? '這天沒有預約' : '還沒有預約紀錄'}
          </p>
        </div>
      )}

      {reservations.map((r) => (
        <div
          key={r.id}
          className={`bg-white rounded-2xl border border-stone-100 p-4 ${r.status === 'cancelled' ? 'opacity-50' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <p className="text-[13px] font-semibold text-stone-800">{r.displayName}</p>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status] || 'bg-stone-100 text-stone-500'}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    r.bookingType === 'flexible'
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-stone-50 text-stone-400'
                  }`}
                >
                  {r.bookingType === 'flexible' ? '彈性' : '精確'}
                </span>
              </div>
              {r.availableDate && (
                <p className="text-[11px] text-stone-500">
                  {formatDate(r.availableDate)}
                  <span className="mx-1 text-stone-300">·</span>
                  {getTimeDisplay(r)}
                </p>
              )}
              {r.orderNumber && (
                <p className="text-[11px] text-stone-400 mt-0.5">訂單：{r.orderNumber}</p>
              )}
              {r.note && <p className="text-[11px] text-stone-400 mt-0.5 italic">{r.note}</p>}
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
              {r.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => void updateStatus(r.id, 'completed')}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    完成
                  </button>
                  <button
                    onClick={() => void updateStatus(r.id, 'cancelled')}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
