'use client';

import { useCallback, useEffect, useState } from 'react';

import type { LiffState } from '@/lib/liff';

// ── Types ──────────────────────────────────────

interface PickupAvailability {
  id: string;
  availableDate: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  currentBookings: number;
}

interface Reservation {
  id: string;
  displayName: string;
  pickupTime: string;
  orderNumber: string | null;
  note: string | null;
  status: string;
  bookingType: string;
  flexiblePeriod: string | null;
  availableDate?: string;
  createdAt: string;
}

// ── Helpers ─────────────────────────────────────

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  const prefix = diff === 0 ? '今天 ' : diff === 1 ? '明天 ' : diff === 2 ? '後天 ' : '';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_ZH[d.getDay()];
  return `${prefix}${m}月${day}日（週${w}）`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
};

// ── Main Component ──────────────────────────────

type Tab = 'book' | 'my';
type BookingStep = 'select-date' | 'fill-form' | 'confirmed';

export default function LiffBookingPage() {
  const [liffState, setLiffState] = useState<LiffState>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('book');

  // Booking state
  const [availabilities, setAvailabilities] = useState<PickupAvailability[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [bookingStep, setBookingStep] = useState<BookingStep>('select-date');
  const [selected, setSelected] = useState<PickupAvailability | null>(null);
  const [form, setForm] = useState({ displayName: '', pickupTime: '', orderNumber: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ note: '', orderNumber: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── LIFF Init ──────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const { initLiff, getLiffProfile, isInClient } = await import('@/lib/liff');
        await initLiff();
        const profile = await getLiffProfile();
        const inClient = await isInClient();
        setLiffState({ status: 'ready', profile, isInClient: inClient });
        setForm((f) => ({ ...f, displayName: profile.displayName }));
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'LIFF 初始化失敗';
        setLiffState({ status: 'error', error: message });
      }
    })();
  }, []);

  // ── Fetch slots ────────────────────────────────

  useEffect(() => {
    fetch('/api/booking/slots')
      .then((r) => r.json())
      .then((data: PickupAvailability[]) => setAvailabilities(data))
      .catch(() => setError('載入失敗，請重新整理'))
      .finally(() => setLoadingSlots(false));
  }, []);

  // ── Fetch my reservations ──────────────────────

  const fetchMyReservations = useCallback(async () => {
    if (liffState.status !== 'ready') return;
    setLoadingRes(true);
    try {
      const res = await fetch(`/api/liff/reservations?lineUserId=${liffState.profile.userId}`);
      if (res.ok) setReservations(await res.json() as Reservation[]);
    } catch {
      /* ignore */
    }
    setLoadingRes(false);
  }, [liffState]);

  useEffect(() => {
    if (tab === 'my' && liffState.status === 'ready') {
      void fetchMyReservations();
    }
  }, [tab, liffState, fetchMyReservations]);

  // ── Booking submit ─────────────────────────────

  async function handleSubmit() {
    if (liffState.status !== 'ready' || !selected || !form.displayName.trim() || !form.pickupTime)
      return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/booking/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityId: selected.id,
          lineUserId: liffState.profile.userId,
          displayName: form.displayName.trim(),
          pickupTime: form.pickupTime,
          orderNumber: form.orderNumber || undefined,
          note: form.note || undefined,
        }),
      });

      if (res.status === 409) {
        setError('這個日期剛好預約滿了，請選擇其他日期');
        setBookingStep('select-date');
        const updated = (await fetch('/api/booking/slots').then((r) =>
          r.json(),
        )) as PickupAvailability[];
        setAvailabilities(updated);
        return;
      }
      if (!res.ok) throw new Error('Server error');
      setBookingStep('confirmed');
    } catch {
      setError('預約失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Cancel reservation ─────────────────────────

  async function handleCancel(reservationId: string) {
    if (liffState.status !== 'ready') return;
    setActionLoading(reservationId);
    try {
      const res = await fetch('/api/liff/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          lineUserId: liffState.profile.userId,
          action: 'cancel',
        }),
      });
      if (res.ok) {
        setReservations((prev) => prev.filter((r) => r.id !== reservationId));
      }
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  }

  // ── Save edit ──────────────────────────────────

  async function handleSaveEdit(reservationId: string) {
    if (liffState.status !== 'ready') return;
    setActionLoading(reservationId);
    try {
      const userId = liffState.profile.userId;
      // Update note
      await fetch('/api/liff/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          lineUserId: userId,
          action: 'update_note',
          value: editForm.note,
        }),
      });
      // Update order number
      await fetch('/api/liff/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId,
          lineUserId: userId,
          action: 'update_order',
          value: editForm.orderNumber,
        }),
      });
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, note: editForm.note || null, orderNumber: editForm.orderNumber || null }
            : r,
        ),
      );
      setEditingId(null);
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  }

  // ── Render: Loading / Error ────────────────────

  if (liffState.status === 'loading') {
    return (
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
        <p className="text-[13px] text-amber-700">LINE 連線中...</p>
      </div>
    );
  }

  if (liffState.status === 'error') {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-4xl mb-4">😵</div>
          <h1 className="text-[17px] font-bold text-stone-800 mb-2">無法連線 LINE</h1>
          <p className="text-[13px] text-stone-500 mb-6">{liffState.error}</p>
          <a
            href="/booking"
            className="inline-block px-6 py-3 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 transition-colors"
          >
            使用一般預約頁面
          </a>
        </div>
      </div>
    );
  }

  const { profile } = liffState;

  // ── Render: Confirmed ──────────────────────────

  if (bookingStep === 'confirmed' && selected) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-amber-900 mb-2">預約成功！</h1>
          <p className="text-amber-700 mb-4">
            {formatDateLabel(selected.availableDate)}
            <br />
            取貨時間：{form.pickupTime}
          </p>
          <div className="bg-amber-50 rounded-xl p-4 text-[13px] text-amber-800 text-left space-y-1 mb-6">
            <p>📍 取貨地址請確認 LINE 訊息</p>
            <p>⏰ 請準時到達</p>
            <p>📞 有問題請聯繫闆娘</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setBookingStep('select-date');
                setSelected(null);
                setForm((f) => ({ ...f, pickupTime: '', orderNumber: '', note: '' }));
              }}
              className="flex-1 py-3 border border-stone-200 rounded-xl text-[13px] font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              再預約一次
            </button>
            <button
              onClick={() => {
                setTab('my');
                void fetchMyReservations();
              }}
              className="flex-1 py-3 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 transition-colors"
            >
              查看我的預約
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Main UI ────────────────────────────

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        {profile.pictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.pictureUrl} alt="" className="w-8 h-8 rounded-full" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-stone-800 truncate">{profile.displayName}</p>
          <p className="text-[10px] text-stone-400">螞蟻窩甜點 預約取貨</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-amber-800 flex items-center justify-center">
          <span className="text-white text-sm">🐜</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <div className="flex bg-white rounded-xl border border-stone-200 p-1 gap-1">
          {(
            [
              ['book', '預約取貨'],
              ['my', '我的預約'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-[13px] font-medium rounded-lg transition-colors ${
                tab === key
                  ? 'bg-amber-800 text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Book Tab ──────────────────────────── */}
      {tab === 'book' && (
        <div className="p-4">
          {bookingStep === 'select-date' && (
            <div className="max-w-sm mx-auto">
              <p className="text-[13px] text-amber-700 mb-4">選擇方便的取貨日期</p>

              {error && (
                <div className="bg-red-50 text-red-700 rounded-xl p-3 text-[13px] mb-4">
                  {error}
                </div>
              )}

              {loadingSlots ? (
                <div className="flex justify-center py-12">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
                </div>
              ) : availabilities.length === 0 ? (
                <div className="text-center py-12 text-amber-600">
                  <p className="text-4xl mb-3">📅</p>
                  <p className="text-[13px] font-medium">目前沒有可預約的日期</p>
                  <p className="text-[11px] mt-1">請稍後再試，或直接聯繫闆娘</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availabilities.map((avail) => (
                    <button
                      key={avail.id}
                      onClick={() => {
                        setSelected(avail);
                        setForm((f) => ({ ...f, pickupTime: avail.startTime.slice(0, 5) }));
                        setBookingStep('fill-form');
                        setError(null);
                      }}
                      className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between hover:bg-amber-50 active:scale-[0.98] transition-transform text-left"
                    >
                      <div>
                        <p className="text-[13px] font-bold text-amber-900">
                          {formatDateLabel(avail.availableDate)}
                        </p>
                        <p className="text-[11px] text-amber-500 mt-0.5">
                          取貨時段：{avail.startTime.slice(0, 5)}–{avail.endTime.slice(0, 5)}
                          <span className="ml-2 text-stone-400">
                            剩 {avail.maxBookings - avail.currentBookings} 位
                          </span>
                        </p>
                      </div>
                      <span className="text-amber-800 text-lg">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {bookingStep === 'fill-form' && selected && (
            <div className="max-w-sm mx-auto">
              <button
                onClick={() => setBookingStep('select-date')}
                className="text-amber-700 text-[13px] mb-4 flex items-center gap-1"
              >
                ← 重新選擇日期
              </button>

              <div className="bg-amber-100 rounded-xl p-4 mb-6">
                <p className="text-[11px] text-amber-600">已選取貨日期</p>
                <p className="text-[13px] font-bold text-amber-900">
                  {formatDateLabel(selected.availableDate)}
                </p>
                <p className="text-[11px] text-amber-600">
                  可取貨時間：{selected.startTime.slice(0, 5)}–{selected.endTime.slice(0, 5)}
                </p>
              </div>

              <h2 className="text-[17px] font-bold text-amber-900 mb-4">填寫預約資料</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-amber-800 block mb-1">
                    取貨時間 *
                  </label>
                  <input
                    type="time"
                    min={selected.startTime.slice(0, 5)}
                    max={selected.endTime.slice(0, 5)}
                    value={form.pickupTime}
                    onChange={(e) => setForm((f) => ({ ...f, pickupTime: e.target.value }))}
                    className="w-full border border-amber-200 rounded-xl p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <p className="text-[10px] text-amber-500 mt-1">
                    請選擇 {selected.startTime.slice(0, 5)}–{selected.endTime.slice(0, 5)}{' '}
                    之間的時間
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-amber-800 block mb-1">
                    姓名 *
                  </label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="你的姓名"
                    className="w-full border border-amber-200 rounded-xl p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-amber-800 block mb-1">
                    訂單編號（選填）
                  </label>
                  <input
                    type="text"
                    value={form.orderNumber}
                    onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                    placeholder="官網訂單編號"
                    className="w-full border border-amber-200 rounded-xl p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-amber-800 block mb-1">
                    備註（選填）
                  </label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="有任何需要告知的事項嗎？"
                    rows={3}
                    className="w-full border border-amber-200 rounded-xl p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  />
                </div>

                {error && <p className="text-red-600 text-[13px]">{error}</p>}

                <button
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !form.displayName.trim() || !form.pickupTime}
                  className="w-full py-3.5 bg-amber-800 text-white rounded-xl text-[13px] font-bold hover:bg-amber-900 disabled:opacity-50 transition-colors"
                >
                  {submitting ? '預約中...' : '確認預約'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── My Reservations Tab ───────────────── */}
      {tab === 'my' && (
        <div className="p-4 max-w-sm mx-auto">
          {loadingRes ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-amber-600">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-[13px] font-medium">目前沒有預約</p>
              <button
                onClick={() => setTab('book')}
                className="mt-4 px-6 py-2.5 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 transition-colors"
              >
                立即預約
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-stone-100 overflow-hidden"
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-bold text-stone-800">
                        {r.availableDate ? formatDateLabel(r.availableDate) : '日期未知'}
                      </p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status] || 'bg-stone-100 text-stone-500'}`}
                      >
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      取貨時間：{r.pickupTime?.slice(0, 5)}
                    </p>
                    {r.orderNumber && (
                      <p className="text-[11px] text-stone-400 mt-0.5">訂單：{r.orderNumber}</p>
                    )}
                    {r.note && (
                      <p className="text-[11px] text-stone-400 mt-0.5 italic">備註：{r.note}</p>
                    )}

                    {/* Edit form */}
                    {editingId === r.id && (
                      <div className="mt-3 space-y-2 bg-stone-50 rounded-lg p-3">
                        <div>
                          <label className="text-[10px] font-medium text-stone-500 block mb-1">
                            訂單編號
                          </label>
                          <input
                            type="text"
                            value={editForm.orderNumber}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, orderNumber: e.target.value }))
                            }
                            className="w-full border border-stone-200 rounded-lg p-2 text-[13px] bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-stone-500 block mb-1">
                            備註
                          </label>
                          <textarea
                            value={editForm.note}
                            onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                            rows={2}
                            className="w-full border border-stone-200 rounded-lg p-2 text-[13px] bg-white resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 py-2 border border-stone-200 rounded-lg text-[11px] font-medium text-stone-500"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => void handleSaveEdit(r.id)}
                            disabled={actionLoading === r.id}
                            className="flex-1 py-2 bg-amber-800 text-white rounded-lg text-[11px] font-medium disabled:opacity-50"
                          >
                            {actionLoading === r.id ? '儲存中...' : '儲存'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {editingId !== r.id && (
                    <div className="flex border-t border-stone-100">
                      <button
                        onClick={() => {
                          setEditingId(r.id);
                          setEditForm({ note: r.note || '', orderNumber: r.orderNumber || '' });
                        }}
                        className="flex-1 py-2.5 text-[11px] font-medium text-stone-500 hover:bg-stone-50 transition-colors border-r border-stone-100"
                      >
                        修改
                      </button>
                      <button
                        onClick={() => void handleCancel(r.id)}
                        disabled={actionLoading === r.id}
                        className="flex-1 py-2.5 text-[11px] font-medium text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === r.id ? '取消中...' : '取消預約'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
