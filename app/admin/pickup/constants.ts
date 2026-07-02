export interface Availability {
  id: string;
  availableDate: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  isActive: boolean;
  currentBookings: number;
}

export interface Reservation {
  id: string;
  displayName: string;
  lineUserId: string | null;
  orderNumber: string | null;
  note: string | null;
  pickupTime: string;
  bookingType: 'exact' | 'flexible';
  flexiblePeriod: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
  availableDate?: string;
}

export interface AddForm {
  availabilityId: string;
  displayName: string;
  bookingType: 'exact' | 'flexible';
  pickupTime: string;
  flexiblePeriod: string;
  note: string;
}

export const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];

export const STATUS_LABEL: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
};

export const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-green-50 text-green-700',
  completed: 'bg-stone-100 text-stone-500',
  cancelled: 'bg-red-50 text-red-500',
};

export const PERIOD_LABEL: Record<string, string> = {
  afternoon: '下午',
  evening_early: '傍晚',
  night: '晚上',
  tbd: '待定',
};

export function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_ZH[d.getDay()];
  return `${m}/${day}（${w}）`;
}

export function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function getTimeDisplay(r: Reservation) {
  if (r.bookingType === 'flexible' && r.flexiblePeriod) {
    return PERIOD_LABEL[r.flexiblePeriod] || '彈性';
  }
  return r.pickupTime?.slice(0, 5) || '';
}
