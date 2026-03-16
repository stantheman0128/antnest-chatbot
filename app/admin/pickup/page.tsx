"use client";

import { useEffect, useState } from "react";

interface Availability {
  id: string;
  availableDate: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  isActive: boolean;
  currentBookings: number;
}

interface Reservation {
  id: string;
  displayName: string;
  lineUserId: string | null;
  orderNumber: string | null;
  note: string | null;
  pickupTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  createdAt: string;
  availableDate?: string;
}

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

const STATUS_LABEL: Record<string, string> = {
  pending: "待確認",
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-green-50 text-green-700",
  completed: "bg-stone-100 text-stone-500",
  cancelled: "bg-red-50 text-red-500",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_ZH[d.getDay()];
  return `${m}/${day}（${w}）`;
}

/** Returns array of YYYY-MM-DD strings for all days in the given year/month */
function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}`);
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export default function PickupPage() {
  const [tab, setTab] = useState<"dates" | "reservations">("dates");

  // ── Availabilities state
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);

  // ── Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [formStartTime, setFormStartTime] = useState("14:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formMaxBookings, setFormMaxBookings] = useState(10);
  const [saving, setSaving] = useState(false);

  // ── Reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dateFilter, setDateFilter] = useState("");

  const [toast, setToast] = useState<string | null>(null);

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetchAvailabilities();
    fetchReservations();
  }, []);

  async function fetchAvailabilities() {
    setLoadingDates(true);
    try {
      const res = await fetch("/api/admin/pickup/availability", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setAvailabilities(await res.json());
    } catch {}
    setLoadingDates(false);
  }

  async function fetchReservations(date?: string) {
    const url = date
      ? `/api/admin/pickup/reservations?date=${date}`
      : "/api/admin/pickup/reservations";
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setReservations(await res.json());
    } catch {}
  }

  async function applyDates() {
    if (selectedDates.size === 0) {
      showToast("請先在日曆選擇日期");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pickup/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          dates: Array.from(selectedDates).sort(),
          startTime: formStartTime,
          endTime: formEndTime,
          maxBookings: formMaxBookings,
        }),
      });
      if (res.ok) {
        showToast(`已套用 ${selectedDates.size} 個日期`);
        setSelectedDates(new Set());
        await fetchAvailabilities();
      } else {
        showToast("儲存失敗，請重試");
      }
    } catch {
      showToast("網路錯誤");
    }
    setSaving(false);
  }

  async function deleteAvailability(id: string) {
    const res = await fetch(`/api/admin/pickup/availability?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      setAvailabilities((prev) => prev.filter((a) => a.id !== id));
      showToast("已刪除");
    }
  }

  async function updateStatus(id: string, status: Reservation["status"]) {
    const res = await fetch("/api/admin/pickup/reservations", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
  }

  const existingDateSet = new Set(availabilities.map((a) => a.availableDate));
  const todayStr = today.toISOString().split("T")[0];
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const monthLabel = `${calYear}年${calMonth + 1}月`;

  function toggleDate(dateStr: string) {
    if (dateStr < todayStr) return;
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-semibold text-stone-800">取貨預約管理</h1>

      {toast && (
        <div className="bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl text-[12px]">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-stone-200 p-1 gap-1">
        {(["dates", "reservations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-amber-800 text-white shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t === "dates" ? "可取貨日期" : "預約紀錄"}
          </button>
        ))}
      </div>

      {/* ── Dates Tab ─────────────────────────────── */}
      {tab === "dates" && (
        <div className="space-y-4">
          {/* Calendar */}
          <div className="bg-white rounded-2xl border border-stone-100 p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-[14px] font-semibold text-stone-800">{monthLabel}</span>
              <button
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_ZH.map((w) => (
                <div key={w} className="text-center text-[11px] text-stone-400 py-1 font-medium">
                  {w}
                </div>
              ))}
            </div>

            {/* Day cells */}
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
                      ${isPast ? "text-stone-300 cursor-not-allowed" : ""}
                      ${!isPast && isSelected ? "bg-amber-800 text-white" : ""}
                      ${!isPast && !isSelected ? "hover:bg-stone-100 text-stone-800" : ""}
                    `}
                  >
                    {new Date(dateStr + "T00:00:00").getDate()}
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
              onClick={applyDates}
              disabled={saving || selectedDates.size === 0}
              className="w-full py-2.5 bg-amber-800 text-white rounded-xl text-[14px] font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
            >
              {saving ? "套用中..." : `套用到 ${selectedDates.size} 個日期`}
            </button>
            <p className="text-[11px] text-stone-400">
              顧客在 LINE 選擇日期後可在此時段內自由選取貨時間
            </p>
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
                <p className="text-[11px] text-stone-300 mt-1">在上方日曆選擇日期後套用</p>
              </div>
            )}
            {availabilities.map((avail) => (
              <div
                key={avail.id}
                className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-[14px] font-semibold text-stone-800">
                    {formatDate(avail.availableDate)}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {avail.startTime.slice(0, 5)}–{avail.endTime.slice(0, 5)}
                    <span className="mx-1.5 text-stone-300">·</span>
                    上限 {avail.maxBookings} 人
                    <span className="mx-1.5 text-stone-300">·</span>
                    已預約 {avail.currentBookings}
                  </p>
                </div>
                <button
                  onClick={() => deleteAvailability(avail.id)}
                  className="text-[12px] px-2.5 py-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Reservations Tab ──────────────────────── */}
      {tab === "reservations" && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                fetchReservations(e.target.value || undefined);
              }}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors"
            />
            {dateFilter && (
              <button
                onClick={() => {
                  setDateFilter("");
                  fetchReservations();
                }}
                className="text-[12px] text-stone-400 hover:text-stone-600 px-2 transition-colors"
              >
                清除
              </button>
            )}
          </div>

          {reservations.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-100 py-10 text-center">
              <p className="text-[13px] text-stone-400">
                {dateFilter ? "這天沒有預約" : "還沒有預約紀錄"}
              </p>
            </div>
          )}

          {reservations.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-2xl border border-stone-100 p-4 ${
                r.status === "cancelled" ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-[14px] font-semibold text-stone-800">
                      {r.displayName}
                    </p>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        STATUS_STYLE[r.status] || "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.availableDate && (
                    <p className="text-[12px] text-stone-500">
                      {formatDate(r.availableDate)}
                      <span className="mx-1 text-stone-300">·</span>
                      {r.pickupTime?.slice(0, 5)}
                    </p>
                  )}
                  {r.lineUserId && (
                    <p className="text-[11px] text-stone-400 mt-0.5 font-mono">
                      {r.lineUserId}
                    </p>
                  )}
                  {r.orderNumber && (
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      訂單：{r.orderNumber}
                    </p>
                  )}
                  {r.note && (
                    <p className="text-[11px] text-stone-400 mt-0.5 italic">
                      {r.note}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => updateStatus(r.id, "confirmed")}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                      >
                        確認
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "cancelled")}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                      >
                        拒絕
                      </button>
                    </>
                  )}
                  {r.status === "confirmed" && (
                    <>
                      <button
                        onClick={() => updateStatus(r.id, "completed")}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                      >
                        完成
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "cancelled")}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
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
      )}
    </div>
  );
}
