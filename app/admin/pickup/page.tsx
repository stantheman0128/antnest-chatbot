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
  bookingType: "exact" | "flexible";
  flexiblePeriod: string | null;
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

const PERIOD_LABEL: Record<string, string> = {
  afternoon: "下午",
  evening_early: "傍晚",
  night: "晚上",
  tbd: "待定",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_ZH[d.getDay()];
  return `${m}/${day}（${w}）`;
}

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

function getTimeDisplay(r: Reservation) {
  if (r.bookingType === "flexible" && r.flexiblePeriod) {
    return PERIOD_LABEL[r.flexiblePeriod] || "彈性";
  }
  return r.pickupTime?.slice(0, 5) || "";
}

export default function PickupPage() {
  const [tab, setTab] = useState<"today" | "dates" | "reservations">("today");

  // Availabilities state
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [formStartTime, setFormStartTime] = useState("14:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formMaxBookings, setFormMaxBookings] = useState(10);
  const [saving, setSaving] = useState(false);

  // Reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([]);
  const [dateFilter, setDateFilter] = useState("");

  // Manual add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    availabilityId: "",
    displayName: "",
    bookingType: "flexible" as "exact" | "flexible",
    pickupTime: "",
    flexiblePeriod: "afternoon",
    note: "",
  });

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
    fetchUpcomingReservations();
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

  async function fetchUpcomingReservations() {
    try {
      const res = await fetch("/api/admin/pickup/reservations?upcoming=true", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setUpcomingReservations(await res.json());
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
      setUpcomingReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    }
  }

  async function handleManualAdd() {
    const body: any = {
      availabilityId: addForm.availabilityId,
      displayName: addForm.displayName,
      bookingType: addForm.bookingType,
    };

    if (addForm.bookingType === "exact") {
      body.pickupTime = addForm.pickupTime || "14:00";
    } else {
      body.flexiblePeriod = addForm.flexiblePeriod;
      body.pickupTime = addForm.flexiblePeriod === "afternoon" ? "14:00"
        : addForm.flexiblePeriod === "evening_early" ? "17:00"
        : addForm.flexiblePeriod === "night" ? "19:00" : "00:00";
    }

    if (addForm.note) body.note = addForm.note;

    const res = await fetch("/api/admin/pickup/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      showToast("已新增預約");
      setShowAddModal(false);
      setAddForm({ availabilityId: "", displayName: "", bookingType: "flexible", pickupTime: "", flexiblePeriod: "afternoon", note: "" });
      fetchReservations();
      fetchUpcomingReservations();
    } else {
      showToast("新增失敗");
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

  // Group upcoming reservations by date
  const upcomingByDate = new Map<string, Reservation[]>();
  for (const r of upcomingReservations) {
    const date = r.availableDate || "unknown";
    if (!upcomingByDate.has(date)) upcomingByDate.set(date, []);
    upcomingByDate.get(date)!.push(r);
  }
  const sortedUpcomingDates = [...upcomingByDate.keys()].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-stone-800">取貨預約管理</h1>
        <button
          onClick={() => {
            if (availabilities.length > 0) {
              setAddForm((f) => ({ ...f, availabilityId: availabilities[0].id }));
            }
            setShowAddModal(true);
          }}
          className="text-[12px] px-3 py-1.5 bg-amber-800 text-white rounded-lg hover:bg-amber-900 transition-colors font-medium"
        >
          + 手動新增
        </button>
      </div>

      {toast && (
        <div className="bg-amber-50 text-amber-800 px-4 py-2.5 rounded-xl text-[12px]">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-stone-200 p-1 gap-1">
        {(["today", "dates", "reservations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-amber-800 text-white shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t === "today" ? "近期預約" : t === "dates" ? "可取貨日期" : "全部紀錄"}
          </button>
        ))}
      </div>

      {/* ── Today/Upcoming Tab ─────────────────────── */}
      {tab === "today" && (
        <div className="space-y-4">
          {sortedUpcomingDates.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-100 py-10 text-center">
              <p className="text-[13px] text-stone-400">近期沒有預約</p>
            </div>
          )}

          {sortedUpcomingDates.map((date) => (
            <div key={date} className="space-y-2">
              <p className="text-[12px] font-semibold text-stone-500 px-1">
                {formatDate(date)}
                {date === todayStr && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">今天</span>
                )}
              </p>
              {upcomingByDate.get(date)!.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-stone-800 truncate">
                        {r.displayName}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                        r.bookingType === "flexible" ? "bg-blue-50 text-blue-600" : "bg-stone-100 text-stone-500"
                      }`}>
                        {getTimeDisplay(r)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    {r.note && (
                      <p className="text-[11px] text-stone-400 mt-0.5 truncate italic">{r.note}</p>
                    )}
                  </div>
                  {r.status === "confirmed" && (
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      <button
                        onClick={() => updateStatus(r.id, "completed")}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                      >
                        完成
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "cancelled")}
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
      )}

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
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAY_ZH.map((w) => (
                <div key={w} className="text-center text-[11px] text-stone-400 py-1 font-medium">{w}</div>
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
              <p className="text-center text-[11px] text-amber-700 mt-2 font-medium">已選 {selectedDates.size} 天</p>
            )}
          </div>

          {/* Time window form */}
          <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
            <p className="text-[13px] font-semibold text-stone-800">套用設定到已選日期</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-stone-400 block mb-1.5 uppercase tracking-widest">開始時間</label>
                <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-stone-400 block mb-1.5 uppercase tracking-widest">結束時間</label>
                <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-stone-400 block mb-1.5 uppercase tracking-widest">最多預約人數</label>
              <input type="number" min={1} max={50} value={formMaxBookings} onChange={(e) => setFormMaxBookings(Number(e.target.value))}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors" />
            </div>
            <button onClick={applyDates} disabled={saving || selectedDates.size === 0}
              className="w-full py-2.5 bg-amber-800 text-white rounded-xl text-[14px] font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors">
              {saving ? "套用中..." : `套用到 ${selectedDates.size} 個日期`}
            </button>
          </div>

          {/* Existing availabilities */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-1">已設定的日期</p>
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
              <div key={avail.id} className="bg-white rounded-xl border border-stone-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-stone-800">{formatDate(avail.availableDate)}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    {avail.startTime.slice(0, 5)}–{avail.endTime.slice(0, 5)}
                    <span className="mx-1.5 text-stone-300">·</span>
                    上限 {avail.maxBookings} 人
                    <span className="mx-1.5 text-stone-300">·</span>
                    已預約 {avail.currentBookings}
                  </p>
                </div>
                <button onClick={() => deleteAvailability(avail.id)}
                  className="text-[12px] px-2.5 py-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
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
            <input type="date" value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); fetchReservations(e.target.value || undefined); }}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-[13px] text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors" />
            {dateFilter && (
              <button onClick={() => { setDateFilter(""); fetchReservations(); }}
                className="text-[12px] text-stone-400 hover:text-stone-600 px-2 transition-colors">
                清除
              </button>
            )}
          </div>

          {reservations.length === 0 && (
            <div className="bg-white rounded-2xl border border-stone-100 py-10 text-center">
              <p className="text-[13px] text-stone-400">{dateFilter ? "這天沒有預約" : "還沒有預約紀錄"}</p>
            </div>
          )}

          {reservations.map((r) => (
            <div key={r.id} className={`bg-white rounded-2xl border border-stone-100 p-4 ${r.status === "cancelled" ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <p className="text-[14px] font-semibold text-stone-800">{r.displayName}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status] || "bg-stone-100 text-stone-500"}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      r.bookingType === "flexible" ? "bg-blue-50 text-blue-600" : "bg-stone-50 text-stone-400"
                    }`}>
                      {r.bookingType === "flexible" ? "彈性" : "精確"}
                    </span>
                  </div>
                  {r.availableDate && (
                    <p className="text-[12px] text-stone-500">
                      {formatDate(r.availableDate)}
                      <span className="mx-1 text-stone-300">·</span>
                      {getTimeDisplay(r)}
                    </p>
                  )}
                  {r.orderNumber && <p className="text-[11px] text-stone-400 mt-0.5">訂單：{r.orderNumber}</p>}
                  {r.note && <p className="text-[11px] text-stone-400 mt-0.5 italic">{r.note}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {r.status === "confirmed" && (
                    <>
                      <button onClick={() => updateStatus(r.id, "completed")}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors">
                        完成
                      </button>
                      <button onClick={() => updateStatus(r.id, "cancelled")}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
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

      {/* ── Manual Add Modal ──────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-stone-800">手動新增預約</h3>
              <button onClick={() => setShowAddModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-[11px] font-semibold text-stone-500 block mb-1">日期</label>
                <select value={addForm.availabilityId}
                  onChange={(e) => setAddForm((f) => ({ ...f, availabilityId: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50">
                  <option value="">選擇日期</option>
                  {availabilities.map((a) => (
                    <option key={a.id} value={a.id}>{formatDate(a.availableDate)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-stone-500 block mb-1">顧客名稱</label>
                <input type="text" value={addForm.displayName} placeholder="輸入名字"
                  onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-stone-500 block mb-1">預約方式</label>
                <div className="flex gap-2">
                  {(["flexible", "exact"] as const).map((bt) => (
                    <button key={bt}
                      onClick={() => setAddForm((f) => ({ ...f, bookingType: bt }))}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-medium border transition-colors ${
                        addForm.bookingType === bt
                          ? "bg-amber-800 text-white border-amber-800"
                          : "border-stone-200 text-stone-500"
                      }`}>
                      {bt === "flexible" ? "彈性時段" : "精確時間"}
                    </button>
                  ))}
                </div>
              </div>
              {addForm.bookingType === "exact" ? (
                <div>
                  <label className="text-[11px] font-semibold text-stone-500 block mb-1">取貨時間</label>
                  <input type="time" value={addForm.pickupTime}
                    onChange={(e) => setAddForm((f) => ({ ...f, pickupTime: e.target.value }))}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50" />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-semibold text-stone-500 block mb-1">時段</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PERIOD_LABEL).map(([key, label]) => (
                      <button key={key}
                        onClick={() => setAddForm((f) => ({ ...f, flexiblePeriod: key }))}
                        className={`py-2 rounded-xl text-[13px] font-medium border transition-colors ${
                          addForm.flexiblePeriod === key
                            ? "bg-amber-800 text-white border-amber-800"
                            : "border-stone-200 text-stone-500"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold text-stone-500 block mb-1">備註</label>
                <input type="text" value={addForm.note} placeholder="選填"
                  onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-[13px] bg-stone-50" />
              </div>
            </div>
            <div className="p-4 border-t border-stone-100">
              <button onClick={handleManualAdd}
                disabled={!addForm.availabilityId || !addForm.displayName.trim()}
                className="w-full py-2.5 bg-amber-800 text-white rounded-xl text-[14px] font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors">
                新增預約
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
