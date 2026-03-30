'use client';

import { useEffect, useState } from 'react';

interface PickupAvailability {
  id: string;
  availableDate: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  currentBookings: number;
}

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

type Step = 'select-date' | 'fill-form' | 'confirmed';

export default function BookingPage() {
  const [availabilities, setAvailabilities] = useState<PickupAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('select-date');
  const [selected, setSelected] = useState<PickupAvailability | null>(null);
  const [form, setForm] = useState({ displayName: '', pickupTime: '', orderNumber: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/booking/slots')
      .then((r) => r.json())
      .then((data: PickupAvailability[]) => setAvailabilities(data))
      .catch(() => setError('載入失敗，請重新整理'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!selected || !form.displayName.trim() || !form.pickupTime) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/booking/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityId: selected.id,
          displayName: form.displayName.trim(),
          pickupTime: form.pickupTime,
          orderNumber: form.orderNumber || undefined,
          note: form.note || undefined,
        }),
      });

      if (res.status === 409) {
        setError('這個日期剛好預約滿了，請選擇其他日期');
        setStep('select-date');
        const updated = (await fetch('/api/booking/slots').then((r) =>
          r.json(),
        )) as PickupAvailability[];
        setAvailabilities(updated);
        return;
      }
      if (!res.ok) throw new Error('Server error');
      setStep('confirmed');
    } catch {
      setError('預約失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <p className="text-amber-700">載入中...</p>
      </div>
    );
  }

  // Confirmed
  if (step === 'confirmed' && selected) {
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
          <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 text-left space-y-1">
            <p>📍 取貨地址請確認 LINE 訊息</p>
            <p>⏰ 請準時到達，逾時可能影響其他顧客</p>
            <p>📞 有問題請聯繫闆娘</p>
          </div>
        </div>
      </div>
    );
  }

  // Fill form
  if (step === 'fill-form' && selected) {
    return (
      <div className="min-h-screen bg-amber-50 p-4">
        <div className="max-w-sm mx-auto pt-6">
          <button
            onClick={() => setStep('select-date')}
            className="text-amber-700 text-sm mb-4 flex items-center gap-1"
          >
            ← 重新選擇日期
          </button>

          <div className="bg-amber-100 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-600">已選取貨日期</p>
            <p className="font-bold text-amber-900">{formatDateLabel(selected.availableDate)}</p>
            <p className="text-xs text-amber-600">
              可取貨時間：{selected.startTime.slice(0, 5)}–{selected.endTime.slice(0, 5)}
            </p>
          </div>

          <h2 className="text-xl font-bold text-amber-900 mb-4">填寫預約資料</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-amber-800 block mb-1">取貨時間 *</label>
              <input
                type="time"
                min={selected.startTime.slice(0, 5)}
                max={selected.endTime.slice(0, 5)}
                value={form.pickupTime}
                onChange={(e) => setForm((f) => ({ ...f, pickupTime: e.target.value }))}
                className="w-full border border-amber-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-amber-500 mt-1">
                請選擇 {selected.startTime.slice(0, 5)}–{selected.endTime.slice(0, 5)} 之間的時間
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-amber-800 block mb-1">姓名 *</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="你的 LINE 顯示名稱或姓名"
                className="w-full border border-amber-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-amber-800 block mb-1">
                訂單編號（選填）
              </label>
              <input
                type="text"
                value={form.orderNumber}
                onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                placeholder="CYBERBIZ 訂單編號"
                className="w-full border border-amber-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-amber-800 block mb-1">備註（選填）</label>
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="有任何需要告知的事項嗎？"
                rows={3}
                className="w-full border border-amber-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || !form.displayName.trim() || !form.pickupTime}
              className="w-full py-4 bg-amber-800 text-white rounded-2xl font-bold text-lg hover:bg-amber-900 disabled:opacity-50 mt-2"
            >
              {submitting ? '預約中...' : '確認預約'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Select date
  return (
    <div className="min-h-screen bg-amber-50 p-4">
      <div className="max-w-sm mx-auto pt-6">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🐜</div>
          <h1 className="text-2xl font-bold text-amber-900">螞蟻窩 預約取貨</h1>
          <p className="text-amber-600 text-sm mt-1">選擇你方便的取貨日期</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm mb-4">{error}</div>}

        {availabilities.length === 0 && (
          <div className="text-center py-12 text-amber-600">
            <p className="text-4xl mb-3">📅</p>
            <p className="font-medium">目前沒有可預約的日期</p>
            <p className="text-sm mt-1">請稍後再試，或直接聯繫闆娘</p>
          </div>
        )}

        <div className="space-y-3">
          {availabilities.map((avail) => (
            <button
              key={avail.id}
              onClick={() => {
                setSelected(avail);
                setForm((f) => ({ ...f, pickupTime: avail.startTime.slice(0, 5) }));
                setStep('fill-form');
              }}
              className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between hover:bg-amber-50 active:scale-95 transition-transform text-left"
            >
              <div>
                <p className="font-bold text-amber-900">{formatDateLabel(avail.availableDate)}</p>
                <p className="text-xs text-amber-500 mt-0.5">
                  取貨時段：{avail.startTime.slice(0, 5)}–{avail.endTime.slice(0, 5)}
                </p>
              </div>
              <span className="text-amber-800 text-lg">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
