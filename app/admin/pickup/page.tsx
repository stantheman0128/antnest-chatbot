"use client";

import { useEffect, useState } from "react";

interface Availability {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxPerSlot: number;
  isActive: boolean;
}

interface Reservation {
  id: string;
  displayName: string;
  orderNumber: string | null;
  note: string | null;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  slotDate?: string;
  slotStartTime?: string;
  slotEndTime?: string;
}

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const STATUS_LABEL: Record<string, string> = {
  confirmed: "✅ 已確認",
  completed: "🏁 已完成",
  cancelled: "❌ 已取消",
};

const EMPTY_RULE: Omit<Availability, "id" | "isActive"> = {
  weekday: 1,
  startTime: "14:00",
  endTime: "17:00",
  slotDurationMinutes: 60,
  maxPerSlot: 3,
};

export default function PickupPage() {
  const [tab, setTab] = useState<"rules" | "reservations">("rules");
  const [rules, setRules] = useState<Availability[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing: Partial<Availability> | null }>({
    open: false,
    editing: null,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetchRules();
    fetchReservations();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pickup/availability", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setRules(await res.json());
    } catch {}
    setLoading(false);
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

  async function saveRule() {
    if (!modal.editing) return;
    setSaving(true);
    const res = await fetch("/api/admin/pickup/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(modal.editing),
    });
    if (res.ok) {
      showToast("儲存成功！");
      setModal({ open: false, editing: null });
      await fetchRules();
    } else {
      showToast("儲存失敗");
    }
    setSaving(false);
  }

  async function deleteRule(id: string) {
    const res = await fetch(`/api/admin/pickup/availability?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      setRules((prev) => prev.filter((r) => r.id !== id));
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

  async function generateSlots() {
    const res = await fetch("/api/admin/pickup/slots", {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) showToast("時段已更新！");
  }

  if (loading) {
    return <p className="text-amber-800 text-center py-8">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-900">取貨預約管理</h2>
      </div>

      {toast && (
        <div className="bg-green-50 text-green-800 px-4 py-3 rounded-xl text-sm">{toast}</div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-amber-200">
        {(["rules", "reservations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-amber-800 text-white"
                : "bg-white text-amber-700 hover:bg-amber-50"
            }`}
          >
            {t === "rules" ? "⏰ 可用時段設定" : "📋 預約紀錄"}
          </button>
        ))}
      </div>

      {/* ── Rules Tab ─────────────────────────────── */}
      {tab === "rules" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setModal({ open: true, editing: { ...EMPTY_RULE, isActive: true } })}
              className="flex-1 bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-900"
            >
              + 新增時段規則
            </button>
            <button
              onClick={generateSlots}
              className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-200"
            >
              🔄 更新時段
            </button>
          </div>

          <p className="text-xs text-amber-600 px-1">
            設定好規則後點「更新時段」，系統會自動產生未來 4 週的預約空位
          </p>

          {rules.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              <p className="text-3xl mb-2">📅</p>
              <p>還沒有設定可用時段</p>
              <p className="text-xs mt-1">新增規則來讓顧客預約取貨</p>
            </div>
          )}

          {rules.map((rule) => (
            <div key={rule.id} className={`bg-white rounded-xl p-4 shadow-sm ${!rule.isActive ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-amber-900">
                    每週{WEEKDAY_ZH[rule.weekday]}
                  </p>
                  <p className="text-sm text-amber-700">
                    {rule.startTime}–{rule.endTime}，每 {rule.slotDurationMinutes} 分鐘一格，上限 {rule.maxPerSlot} 人
                  </p>
                  {!rule.isActive && (
                    <span className="text-xs text-gray-400">已停用</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ open: true, editing: { ...rule } })}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    刪除
                  </button>
                </div>
              </div>
            </div>
          ))}
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
            <div className="text-center py-10 text-gray-500">
              <p className="text-3xl mb-2">📭</p>
              <p>{dateFilter ? "這天沒有預約" : "還沒有預約紀錄"}</p>
            </div>
          )}

          {reservations.map((r) => (
            <div key={r.id} className={`bg-white rounded-xl p-4 shadow-sm ${r.status === "cancelled" ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-amber-900">{r.displayName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "confirmed" ? "bg-green-100 text-green-700" :
                      r.status === "completed" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-600"
                    }`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.slotDate && (
                    <p className="text-sm text-amber-700">
                      📅 {r.slotDate} {r.slotStartTime}–{r.slotEndTime}
                    </p>
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

      {/* Rule Edit Modal */}
      {modal.open && modal.editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-lg font-bold text-amber-900">
              {modal.editing.id ? "編輯時段規則" : "新增時段規則"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-amber-800 block mb-1">每週幾</label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAY_ZH.map((w, i) => (
                    <button
                      key={i}
                      onClick={() => setModal((m) => ({ ...m, editing: { ...m.editing!, weekday: i } }))}
                      className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                        modal.editing?.weekday === i
                          ? "bg-amber-800 text-white"
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-amber-800 block mb-1">開始時間</label>
                  <input
                    type="time"
                    value={modal.editing.startTime || "14:00"}
                    onChange={(e) => setModal((m) => ({ ...m, editing: { ...m.editing!, startTime: e.target.value } }))}
                    className="w-full border border-amber-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-amber-800 block mb-1">結束時間</label>
                  <input
                    type="time"
                    value={modal.editing.endTime || "17:00"}
                    onChange={(e) => setModal((m) => ({ ...m, editing: { ...m.editing!, endTime: e.target.value } }))}
                    className="w-full border border-amber-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-amber-800 block mb-1">每格時長（分鐘）</label>
                  <select
                    value={modal.editing.slotDurationMinutes || 60}
                    onChange={(e) => setModal((m) => ({ ...m, editing: { ...m.editing!, slotDurationMinutes: Number(e.target.value) } }))}
                    className="w-full border border-amber-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value={30}>30 分鐘</option>
                    <option value={60}>60 分鐘</option>
                    <option value={90}>90 分鐘</option>
                    <option value={120}>2 小時</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-amber-800 block mb-1">每格上限</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={modal.editing.maxPerSlot || 3}
                    onChange={(e) => setModal((m) => ({ ...m, editing: { ...m.editing!, maxPerSlot: Number(e.target.value) } }))}
                    className="w-full border border-amber-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModal({ open: false, editing: null })}
                className="flex-1 py-3 border border-amber-200 rounded-xl text-amber-700 font-medium hover:bg-amber-50"
              >
                取消
              </button>
              <button
                onClick={saveRule}
                disabled={saving}
                className="flex-1 py-3 bg-amber-800 text-white rounded-xl font-medium hover:bg-amber-900 disabled:opacity-50"
              >
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
