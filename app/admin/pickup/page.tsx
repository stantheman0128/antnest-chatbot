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
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  availableDate?: string;
}

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

const STATUS_LABEL: Record<string, string> = {
  confirmed: "已確認",
  completed: "已完成",
  cancelled: "已取消",
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
        showToast(`已套用 ${selectedDates.size} 個日期 ✅`);
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

  // Set of existing availability dates (for dot indicator on calendar)
  const existingDateSet = new Set(availabilities.map((a) => a.availableDate));
  const todayStr = today.toISOString().split("T")[0];

  // Calendar rendering
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
  const monthLabel = `${calYear}年${calMonth + 1}月`;

  function toggleDate(dateStr: string) {
    if (dateStr < todayStr) return; // can't select past dates
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
      <h2 className="text-xl font-bold text-amber-900">取貨預約管理</h2>

      {toast && (
        <div className="bg-green-50 text-green-800 px-4 py-3 rounded-xl text-sm">{toast}</div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-amber-200">
        {(["dates", "reservations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-amber-800 text-white"
                : "bg-white text-amber-700 hover:bg-amber-50"
            }`}
          >
            {t === "dates" ? "📅 可取貨日期" : "📋 預約紀錄"}
          </button>
        ))}
      </div>

      {/* ── Dates Tab ─────────────────────────────── */}
      {tab === "dates" && (
        <div className="space-y-4">
          {/* Calendar */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-amber-50 text-amber-700 font-bold">‹</button>
              <span className="font-bold text-amber-900">{monthLabel}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-amber-50 text-amber-700 font-bold">›</button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_ZH.map((w) => (
                <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {/* Leading empty cells */}
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
                    className={`relative w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-colors
                      ${isPast ? "text-gray-300 cursor-not-allowed" : ""}
                      ${!isPast && isSelected ? "bg-amber-800 text-white" : ""}
                      ${!isPast && !isSelected ? "hover:bg-amber-100 text-amber-900" : ""}
                    `}
                  >
                    {new Date(dateStr + "T00:00:00").getDate()}
                    {/* Dot: existing availability */}
                    {hasAvail && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDates.size > 0 && (
              <p className="text-center text-xs text-amber-600 mt-2">
                已選 {selectedDates.size} 天
              </p>
            )}
          </div>

          {/* Time window form */}
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-sm font-bold text-amber-900">套用設定到已選日期</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-amber-700 block mb-1">開始時間</label>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="w-full border border-amber-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-amber-700 block mb-1">結束時間</label>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="w-full border border-amber-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-amber-700 block mb-1">最多預約人數</label>
              <input
                type="number"
                min={1}
                max={50}
                value={formMaxBookings}
                onChange={(e) => setFormMaxBookings(Number(e.target.value))}
                className="w-full border border-amber-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={applyDates}
              disabled={saving || selectedDates.size === 0}
              className="w-full py-3 bg-amber-800 text-white rounded-xl font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
            >
              {saving ? "套用中..." : `套用到 ${selectedDates.size} 個日期`}
            </button>
            <p className="text-xs text-amber-500">顧客在 LINE 選擇日期後可在此時段內自由選取貨時間</p>
          </div>

          {/* Existing availabilities list */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-800 px-1">已設定的日期</p>
            {loadingDates && <p className="text-center text-amber-600 py-4 text-sm">載入中...</p>}
            {!loadingDates && availabilities.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-sm">還沒有設定取貨日期</p>
                <p className="text-xs mt-1">在上方日曆選擇日期後套用</p>
              </div>
            )}
            {availabilities.map((avail) => (
              <div key={avail.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                <div>
                  <p className="font-bold text-amber-900 text-sm">{formatDate(avail.availableDate)}</p>
                  <p className="text-xs text-amber-600">
                    {avail.startTime.slice(0, 5)}–{avail.endTime.slice(0, 5)} · 上限 {avail.maxBookings} 人 · 已預約 {avail.currentBookings}
                  </p>
                </div>
                <button
                  onClick={() => deleteAvailability(avail.id)}
                  className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
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
              className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            {dateFilter && (
              <button
                onClick={() => {
                  setDateFilter("");
                  fetchReservations();
                }}
                className="text-sm text-amber-600 hover:text-amber-800 px-2"
              >
                清除
              </button>
            )}
          </div>

          {reservations.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">{dateFilter ? "這天沒有預約" : "還沒有預約紀錄"}</p>
            </div>
          )}

          {reservations.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-xl p-4 shadow-sm ${r.status === "cancelled" ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-amber-900">{r.displayName}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : r.status === "completed"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.availableDate && (
                    <p className="text-sm text-amber-700">
                      📅 {formatDate(r.availableDate)} ⏰ {r.pickupTime?.slice(0, 5)}
                    </p>
                  )}
                  {r.lineUserId && (
                    <p className="text-xs text-gray-400 mt-0.5">LINE: {r.lineUserId}</p>
                  )}
                  {r.orderNumber && (
                    <p className="text-xs text-gray-500 mt-0.5">訂單：{r.orderNumber}</p>
                  )}
                  {r.note && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{r.note}</p>
                  )}
                </div>
                {r.status === "confirmed" && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => updateStatus(r.id, "completed")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      完成
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "cancelled")}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
