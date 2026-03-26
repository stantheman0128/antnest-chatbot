import { getSupabase } from "./supabase";

// ── Pickup Reservation System ──────────────────────────

export interface PickupAvailability {
  id: string;
  availableDate: string;
  startTime: string;
  endTime: string;
  maxBookings: number;
  isActive: boolean;
  currentBookings: number;
  createdAt: string;
}

export interface Reservation {
  id: string;
  availabilityId: string;
  lineUserId: string | null;
  displayName: string;
  pickupTime: string;
  orderNumber: string | null;
  note: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  bookingType: "exact" | "flexible";
  flexiblePeriod: "afternoon" | "evening_early" | "night" | "tbd" | null;
  createdAt: string;
  availableDate?: string;
}

function getTaiwanToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function mapDbReservation(row: any): Reservation {
  return {
    id: row.id,
    availabilityId: row.availability_id,
    lineUserId: row.line_user_id || null,
    displayName: row.display_name,
    pickupTime: row.pickup_time,
    orderNumber: row.order_number || null,
    note: row.note || null,
    status: row.status,
    bookingType: row.booking_type || "exact",
    flexiblePeriod: row.flexible_period || null,
    createdAt: row.created_at,
  };
}

export async function getAvailableDates(): Promise<PickupAvailability[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const today = getTaiwanToday();

  const { data: avails, error } = await sb
    .from("pickup_availability")
    .select("*")
    .eq("is_active", true)
    .gte("available_date", today)
    .order("available_date", { ascending: true });
  if (error) { console.error("available dates fetch error:", error); return []; }
  if (!avails || avails.length === 0) return [];

  const ids = avails.map((a: any) => a.id);
  const { data: reservs } = await sb
    .from("reservations")
    .select("availability_id")
    .in("availability_id", ids)
    .in("status", ["pending", "confirmed"]);

  const counts = new Map<string, number>();
  for (const r of (reservs || [])) {
    counts.set(r.availability_id, (counts.get(r.availability_id) || 0) + 1);
  }

  return avails
    .map((row: any): PickupAvailability => ({
      id: row.id, availableDate: row.available_date, startTime: row.start_time,
      endTime: row.end_time, maxBookings: row.max_bookings, isActive: row.is_active,
      currentBookings: counts.get(row.id) || 0, createdAt: row.created_at,
    }))
    .filter((a) => a.currentBookings < a.maxBookings);
}

export async function getAllAvailabilities(): Promise<PickupAvailability[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const today = getTaiwanToday();

  const { data: avails, error } = await sb
    .from("pickup_availability").select("*").gte("available_date", today)
    .order("available_date", { ascending: true });
  if (error) { console.error("availabilities fetch error:", error); return []; }
  if (!avails || avails.length === 0) return [];

  const ids = avails.map((a: any) => a.id);
  const { data: reservs } = await sb
    .from("reservations").select("availability_id")
    .in("availability_id", ids).in("status", ["pending", "confirmed"]);

  const counts = new Map<string, number>();
  for (const r of (reservs || [])) {
    counts.set(r.availability_id, (counts.get(r.availability_id) || 0) + 1);
  }

  return avails.map((row: any): PickupAvailability => ({
    id: row.id, availableDate: row.available_date, startTime: row.start_time,
    endTime: row.end_time, maxBookings: row.max_bookings, isActive: row.is_active,
    currentBookings: counts.get(row.id) || 0, createdAt: row.created_at,
  }));
}

export async function getAvailabilityById(id: string): Promise<PickupAvailability | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("pickup_availability").select("*").eq("id", id).single();
  if (error) return null;
  const { count } = await sb.from("reservations").select("*", { count: "exact", head: true })
    .eq("availability_id", id).in("status", ["pending", "confirmed"]);
  return {
    id: data.id, availableDate: data.available_date, startTime: data.start_time,
    endTime: data.end_time, maxBookings: data.max_bookings, isActive: data.is_active,
    currentBookings: count || 0, createdAt: data.created_at,
  };
}

export async function bulkCreateAvailabilities(
  dates: string[], startTime: string, endTime: string, maxBookings: number
): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const rows = dates.map((d) => ({
    available_date: d, start_time: startTime, end_time: endTime,
    max_bookings: maxBookings, is_active: true,
  }));
  const { data, error } = await sb.from("pickup_availability")
    .upsert(rows, { onConflict: "available_date" }).select();
  if (error) { console.error("bulk create error:", error); return 0; }
  return (data || []).length;
}

export async function deleteAvailability(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pickup_availability").delete().eq("id", id);
  if (error) { console.error("availability delete error:", error); return false; }
  return true;
}

export async function createReservation(input: {
  availabilityId: string; lineUserId?: string; displayName: string;
  pickupTime: string; orderNumber?: string; note?: string;
  bookingType?: "exact" | "flexible"; flexiblePeriod?: string;
}): Promise<Reservation | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: newId, error: rpcError } = await sb.rpc("create_reservation_atomic", {
    p_availability_id: input.availabilityId, p_line_user_id: input.lineUserId || null,
    p_display_name: input.displayName, p_pickup_time: input.pickupTime,
    p_order_number: input.orderNumber || null, p_note: input.note || null,
    p_booking_type: input.bookingType || "exact", p_flexible_period: input.flexiblePeriod || null,
  });
  if (rpcError || !newId) { console.error("reservation atomic insert error:", rpcError); return null; }
  const { data, error } = await sb.from("reservations").select("*").eq("id", newId).single();
  if (error || !data) return null;
  return mapDbReservation(data);
}

export async function getAllReservations(dateFilter?: string): Promise<Reservation[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let query = sb.from("reservations").select("*, pickup_availability(available_date)")
    .order("created_at", { ascending: false });
  if (dateFilter) {
    const { data: avail } = await sb.from("pickup_availability").select("id").eq("available_date", dateFilter).single();
    if (!avail) return [];
    query = query.eq("availability_id", avail.id);
  }
  const { data, error } = await query;
  if (error) { console.error("reservations fetch error:", error); return []; }
  return (data || []).map((r: any) => ({ ...mapDbReservation(r), availableDate: r.pickup_availability?.available_date }));
}

export async function updateReservationStatus(id: string, status: Reservation["status"]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("reservations").update({ status }).eq("id", id);
  if (error) { console.error("reservation update error:", error); return false; }
  return true;
}

export async function updateReservationNote(id: string, note: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("reservations").update({ note }).eq("id", id);
  if (error) { console.error("reservation note update error:", error); return false; }
  return true;
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("reservations").select("*, pickup_availability(available_date)").eq("id", id).single();
  if (error || !data) return null;
  return { ...mapDbReservation(data), availableDate: data.pickup_availability?.available_date };
}

export async function getLatestReservationByUser(lineUserId: string): Promise<Reservation | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("reservations")
    .select("*, pickup_availability(available_date)")
    .eq("line_user_id", lineUserId).in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false }).limit(1).single();
  if (error || !data) return null;
  return { ...mapDbReservation(data), availableDate: data.pickup_availability?.available_date };
}

export async function getReservationsByUser(lineUserId: string): Promise<Reservation[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const today = getTaiwanToday();
  const { data, error } = await sb.from("reservations")
    .select("*, pickup_availability(available_date)")
    .eq("line_user_id", lineUserId).in("status", ["pending", "confirmed"])
    .gte("pickup_availability.available_date", today)
    .order("created_at", { ascending: false });
  if (error) { console.error("getReservationsByUser error:", error); return []; }
  return (data || []).map((r: any) => ({ ...mapDbReservation(r), availableDate: r.pickup_availability?.available_date }));
}

export async function updateReservationOrderNumber(id: string, orderNumber: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("reservations").update({ order_number: orderNumber }).eq("id", id);
  return !error;
}

export async function getConfirmedReservationsForCalendar(): Promise<Reservation[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("reservations")
    .select("*, pickup_availability(available_date)")
    .eq("status", "confirmed").order("created_at", { ascending: false });
  if (error) { console.error("calendar reservations fetch error:", error); return []; }
  return (data || []).map((r: any) => ({ ...mapDbReservation(r), availableDate: r.pickup_availability?.available_date }));
}
