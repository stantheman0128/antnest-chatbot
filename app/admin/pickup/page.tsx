'use client';

import { useCallback, useEffect, useState } from 'react';

import { getToken, useToast } from '@/lib/admin-utils';

import DatesTab from './components/DatesTab';
import ManualAddModal from './components/ManualAddModal';
import ReservationsTab from './components/ReservationsTab';
import UpcomingTab from './components/UpcomingTab';
import { AddForm, Availability, Reservation, getDaysInMonth } from './constants';

export default function PickupPage() {
  const [tab, setTab] = useState<'today' | 'dates' | 'reservations'>('today');
  const { toast } = useToast();

  // Availabilities state
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [formStartTime, setFormStartTime] = useState('14:00');
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formMaxBookings, setFormMaxBookings] = useState(10);
  const [saving, setSaving] = useState(false);

  // Reservations state
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([]);
  const [dateFilter, setDateFilter] = useState('');

  // Manual add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    availabilityId: '',
    displayName: '',
    bookingType: 'flexible',
    pickupTime: '',
    flexiblePeriod: 'afternoon',
    note: '',
  });

  const fetchAvailabilities = useCallback(async () => {
    setLoadingDates(true);
    try {
      const res = await fetch('/api/admin/pickup/availability', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setAvailabilities((await res.json()) as Availability[]);
    } catch {
      toast('載入可取貨日期失敗', 'error');
    }
    setLoadingDates(false);
  }, [toast]);

  const fetchReservations = useCallback(
    async (date?: string) => {
      const url = date
        ? `/api/admin/pickup/reservations?date=${date}`
        : '/api/admin/pickup/reservations';
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) setReservations((await res.json()) as Reservation[]);
      } catch {
        toast('載入預約紀錄失敗', 'error');
      }
    },
    [toast],
  );

  const fetchUpcomingReservations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pickup/reservations?upcoming=true', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setUpcomingReservations((await res.json()) as Reservation[]);
    } catch {
      toast('載入近期預約失敗', 'error');
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAvailabilities();
    void fetchReservations();
    void fetchUpcomingReservations();
  }, [fetchAvailabilities, fetchReservations, fetchUpcomingReservations]);

  async function applyDates() {
    if (selectedDates.size === 0) {
      toast('請先在日曆選擇日期', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pickup/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        toast(`已套用 ${selectedDates.size} 個日期`);
        setSelectedDates(new Set());
        await fetchAvailabilities();
      } else {
        toast('儲存失敗，請重試', 'error');
      }
    } catch {
      toast('網路錯誤', 'error');
    }
    setSaving(false);
  }

  async function deleteAvailability(id: string) {
    try {
      const res = await fetch(`/api/admin/pickup/availability?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setAvailabilities((prev) => prev.filter((a) => a.id !== id));
        toast('已刪除');
      }
    } catch {
      toast('操作失敗', 'error');
    }
  }

  async function updateStatus(id: string, status: Reservation['status']) {
    try {
      const res = await fetch('/api/admin/pickup/reservations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        setUpcomingReservations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } catch {
      toast('操作失敗', 'error');
    }
  }

  async function handleManualAdd() {
    const body: Record<string, string> = {
      availabilityId: addForm.availabilityId,
      displayName: addForm.displayName,
      bookingType: addForm.bookingType,
    };

    if (addForm.bookingType === 'exact') {
      body.pickupTime = addForm.pickupTime || '14:00';
    } else {
      body.flexiblePeriod = addForm.flexiblePeriod;
      body.pickupTime =
        addForm.flexiblePeriod === 'afternoon'
          ? '14:00'
          : addForm.flexiblePeriod === 'evening_early'
            ? '17:00'
            : addForm.flexiblePeriod === 'night'
              ? '19:00'
              : '00:00';
    }

    if (addForm.note) body.note = addForm.note;

    try {
      const res = await fetch('/api/admin/pickup/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast('已新增預約');
        setShowAddModal(false);
        setAddForm({
          availabilityId: '',
          displayName: '',
          bookingType: 'flexible',
          pickupTime: '',
          flexiblePeriod: 'afternoon',
          note: '',
        });
        void fetchReservations();
        void fetchUpcomingReservations();
      } else {
        toast('新增失敗', 'error');
      }
    } catch {
      toast('操作失敗', 'error');
    }
  }

  const existingDateSet = new Set(availabilities.map((a) => a.availableDate));
  const todayStr = today.toISOString().split('T')[0];
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
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else setCalMonth((m) => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else setCalMonth((m) => m + 1);
  }

  // Group upcoming reservations by date
  const upcomingByDate = new Map<string, Reservation[]>();
  for (const r of upcomingReservations) {
    const date = r.availableDate || 'unknown';
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
          className="text-[11px] px-3 py-1.5 bg-amber-800 text-white rounded-lg hover:bg-amber-900 transition-colors font-medium"
        >
          + 手動新增
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl border border-stone-200 p-1 gap-1">
        {(['today', 'dates', 'reservations'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              tab === t
                ? 'bg-amber-800 text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t === 'today' ? '近期預約' : t === 'dates' ? '可取貨日期' : '全部紀錄'}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <UpcomingTab
          sortedUpcomingDates={sortedUpcomingDates}
          upcomingByDate={upcomingByDate}
          todayStr={todayStr}
          updateStatus={updateStatus}
        />
      )}

      {tab === 'dates' && (
        <DatesTab
          monthLabel={monthLabel}
          daysInMonth={daysInMonth}
          firstDayOfWeek={firstDayOfWeek}
          todayStr={todayStr}
          selectedDates={selectedDates}
          existingDateSet={existingDateSet}
          availabilities={availabilities}
          loadingDates={loadingDates}
          formStartTime={formStartTime}
          formEndTime={formEndTime}
          formMaxBookings={formMaxBookings}
          saving={saving}
          prevMonth={prevMonth}
          nextMonth={nextMonth}
          toggleDate={toggleDate}
          setFormStartTime={setFormStartTime}
          setFormEndTime={setFormEndTime}
          setFormMaxBookings={setFormMaxBookings}
          applyDates={applyDates}
          deleteAvailability={deleteAvailability}
        />
      )}

      {tab === 'reservations' && (
        <ReservationsTab
          reservations={reservations}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          fetchReservations={fetchReservations}
          updateStatus={updateStatus}
        />
      )}

      {showAddModal && (
        <ManualAddModal
          availabilities={availabilities}
          addForm={addForm}
          setAddForm={setAddForm}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleManualAdd}
        />
      )}
    </div>
  );
}
