import fs from "fs";
import path from "path";
import { getSupabase } from "./supabase";

// ── Types ──────────────────────────────────────────────

export interface ProductVariant {
  title: string;
  option1: string | null;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  imageUrl: string | null;
}

export interface ProductCard {
  id: string;
  name: string;
  price: string;
  originalPrice: string | null;
  description: string;
  detailedDescription: string | null;
  imageUrl: string;
  storeUrl: string;
  badges: string[];
  isActive: boolean;
  sortOrder: number;
  temperatureZone: string | null;
  alcoholFree: boolean;
  variants: ProductVariant[];
}

export interface SystemConfig {
  key: string;
  value: string;
}

// ── Cache ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let productsCache: CacheEntry<ProductCard[]> | null = null;
let configCache: CacheEntry<Map<string, string>> | null = null;

function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL;
}

// ── Products ───────────────────────────────────────────

export async function getActiveProducts(): Promise<ProductCard[]> {
  if (isCacheValid(productsCache)) return productsCache.data;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        const products = data.map(mapDbProduct);
        productsCache = { data: products, timestamp: Date.now() };
        return products;
      }
      console.error("Supabase products query error:", error);
    } catch (e) {
      console.error("Supabase products fetch error:", e);
    }
  }

  // Fallback to static file
  return getStaticProducts();
}

export async function getAllProducts(): Promise<ProductCard[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && data) return data.map(mapDbProduct);
      console.error("Supabase all products query error:", error);
    } catch (e) {
      console.error("Supabase all products fetch error:", e);
    }
  }
  return getStaticProducts();
}

export async function getProductById(
  id: string
): Promise<ProductCard | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) return mapDbProduct(data);
    } catch (e) {
      console.error("Supabase product fetch error:", e);
    }
  }
  const products = await getStaticProducts();
  return products.find((p) => p.id === id) || null;
}

export async function upsertProduct(
  product: Partial<ProductCard> & { id: string }
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from("products").upsert(
    {
      id: product.id,
      name: product.name,
      price: product.price,
      original_price: product.originalPrice,
      description: product.description,
      detailed_description: product.detailedDescription,
      image_url: product.imageUrl,
      store_url: product.storeUrl,
      badges: product.badges,
      is_active: product.isActive ?? true,
      sort_order: product.sortOrder ?? 0,
      temperature_zone: product.temperatureZone,
      alcohol_free: product.alcoholFree ?? true,
      variants: product.variants ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Supabase upsert product error:", error);
    return false;
  }

  // Invalidate cache
  productsCache = null;
  configCache = null; // system prompt includes products
  return true;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) {
    console.error("Supabase delete product error:", error);
    return false;
  }
  productsCache = null;
  configCache = null;
  return true;
}

// ── System Config ──────────────────────────────────────

export async function getConfigMap(): Promise<Map<string, string>> {
  if (isCacheValid(configCache)) return configCache.data;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("system_config").select("*");
      if (!error && data) {
        const map = new Map<string, string>();
        for (const row of data) {
          map.set(row.key, row.value);
        }
        configCache = { data: map, timestamp: Date.now() };
        return map;
      }
      console.error("Supabase config query error:", error);
    } catch (e) {
      console.error("Supabase config fetch error:", e);
    }
  }

  // Fallback: parse system-prompt.md sections
  return getStaticConfig();
}

export async function getConfig(key: string): Promise<string | null> {
  const map = await getConfigMap();
  return map.get(key) || null;
}

export async function setConfig(key: string, value: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from("system_config").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    console.error("Supabase set config error:", error);
    return false;
  }
  configCache = null;
  return true;
}

export async function deleteConfig(key: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("system_config").delete().eq("key", key);
  if (error) { console.error("Supabase delete config error:", error); return false; }
  configCache = null;
  return true;
}

export async function getAllConfigs(): Promise<SystemConfig[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("system_config")
        .select("*")
        .order("key");
      if (!error && data) return data.map((r) => ({ key: r.key, value: r.value }));
    } catch (e) {
      console.error("Supabase configs fetch error:", e);
    }
  }
  const map = await getStaticConfig();
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

// ── Conversation Examples ──────────────────────────────

export interface ConversationExample {
  id: string;
  customerMessage: string;
  correctResponse: string;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

let examplesCache: CacheEntry<ConversationExample[]> | null = null;

export async function getActiveExamples(): Promise<ConversationExample[]> {
  if (isCacheValid(examplesCache)) return examplesCache.data;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("conversation_examples")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        const examples = data.map(mapDbExample);
        examplesCache = { data: examples, timestamp: Date.now() };
        return examples;
      }
      // Table might not exist yet — fail silently
      if (error?.code !== "42P01") {
        console.error("Supabase examples query error:", error);
      }
    } catch (e) {
      console.error("Supabase examples fetch error:", e);
    }
  }
  return [];
}

export async function getAllExamples(): Promise<ConversationExample[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("conversation_examples")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && data) return data.map(mapDbExample);
      if (error?.code !== "42P01") {
        console.error("Supabase all examples query error:", error);
      }
    } catch (e) {
      console.error("Supabase examples fetch error:", e);
    }
  }
  return [];
}

export async function upsertExample(
  example: Partial<ConversationExample> & { customerMessage: string; correctResponse: string }
): Promise<ConversationExample | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const row: any = {
    customer_message: example.customerMessage,
    correct_response: example.correctResponse,
    note: example.note || null,
    is_active: example.isActive ?? true,
    sort_order: example.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };
  if (example.id) row.id = example.id;

  const { data, error } = await sb
    .from("conversation_examples")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.error("Supabase upsert example error:", error);
    return null;
  }

  examplesCache = null;
  configCache = null; // system prompt includes examples
  return mapDbExample(data);
}

export async function deleteExample(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb
    .from("conversation_examples")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Supabase delete example error:", error);
    return false;
  }

  examplesCache = null;
  configCache = null;
  return true;
}

function mapDbExample(row: any): ConversationExample {
  return {
    id: row.id,
    customerMessage: row.customer_message,
    correctResponse: row.correct_response,
    note: row.note || null,
    isActive: row.is_active,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
  };
}

// ── Pickup Reservation System ──────────────────────────

export interface PickupAvailability {
  id: string;
  availableDate: string;    // "2026-03-10"
  startTime: string;        // "14:00"
  endTime: string;          // "18:00"
  maxBookings: number;
  isActive: boolean;
  currentBookings: number;  // counted from confirmed reservations
  createdAt: string;
}

export interface Reservation {
  id: string;
  availabilityId: string;
  lineUserId: string | null;
  displayName: string;
  pickupTime: string;       // "15:30" for exact, "14:00" for flexible (period start)
  orderNumber: string | null;
  note: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  bookingType: "exact" | "flexible";
  flexiblePeriod: "afternoon" | "evening_early" | "night" | "tbd" | null;
  createdAt: string;
  // joined
  availableDate?: string;
}

/** Get today's date in Taiwan timezone (Asia/Taipei) */
function getTaiwanToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

/** Returns future active dates that still have capacity (for LINE booking). */
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

  // Count pending + confirmed bookings per availability (both hold a spot)
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
      id: row.id,
      availableDate: row.available_date,
      startTime: row.start_time,
      endTime: row.end_time,
      maxBookings: row.max_bookings,
      isActive: row.is_active,
      currentBookings: counts.get(row.id) || 0,
      createdAt: row.created_at,
    }))
    .filter((a) => a.currentBookings < a.maxBookings);
}

/** Returns all future availabilities (for admin panel). */
export async function getAllAvailabilities(): Promise<PickupAvailability[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const today = getTaiwanToday();

  const { data: avails, error } = await sb
    .from("pickup_availability")
    .select("*")
    .gte("available_date", today)
    .order("available_date", { ascending: true });
  if (error) { console.error("availabilities fetch error:", error); return []; }
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

  return avails.map((row: any): PickupAvailability => ({
    id: row.id,
    availableDate: row.available_date,
    startTime: row.start_time,
    endTime: row.end_time,
    maxBookings: row.max_bookings,
    isActive: row.is_active,
    currentBookings: counts.get(row.id) || 0,
    createdAt: row.created_at,
  }));
}

export async function getAvailabilityById(id: string): Promise<PickupAvailability | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("pickup_availability")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;

  const { count } = await sb
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("availability_id", id)
    .in("status", ["pending", "confirmed"]);

  return {
    id: data.id,
    availableDate: data.available_date,
    startTime: data.start_time,
    endTime: data.end_time,
    maxBookings: data.max_bookings,
    isActive: data.is_active,
    currentBookings: count || 0,
    createdAt: data.created_at,
  };
}

/** Bulk-create or update availability for the given dates (admin calendar multi-select). */
export async function bulkCreateAvailabilities(
  dates: string[],
  startTime: string,
  endTime: string,
  maxBookings: number
): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  const rows = dates.map((d) => ({
    available_date: d,
    start_time: startTime,
    end_time: endTime,
    max_bookings: maxBookings,
    is_active: true,
  }));
  const { data, error } = await sb
    .from("pickup_availability")
    .upsert(rows, { onConflict: "available_date" })
    .select();
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
  availabilityId: string;
  lineUserId?: string;
  displayName: string;
  pickupTime: string;
  orderNumber?: string;
  note?: string;
  bookingType?: "exact" | "flexible";
  flexiblePeriod?: string;
}): Promise<Reservation | null> {
  const sb = getSupabase();
  if (!sb) return null;

  // Atomic check-and-insert via Postgres function (prevents overbooking race condition)
  const { data: newId, error: rpcError } = await sb.rpc("create_reservation_atomic", {
    p_availability_id: input.availabilityId,
    p_line_user_id: input.lineUserId || null,
    p_display_name: input.displayName,
    p_pickup_time: input.pickupTime,
    p_order_number: input.orderNumber || null,
    p_note: input.note || null,
    p_booking_type: input.bookingType || "exact",
    p_flexible_period: input.flexiblePeriod || null,
  });

  if (rpcError || !newId) {
    console.error("reservation atomic insert error:", rpcError);
    return null;
  }

  // Fetch the created reservation to return full object
  const { data, error } = await sb
    .from("reservations")
    .select("*")
    .eq("id", newId)
    .single();

  if (error || !data) return null;
  return mapDbReservation(data);
}

export async function getAllReservations(dateFilter?: string): Promise<Reservation[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb
    .from("reservations")
    .select("*, pickup_availability(available_date)")
    .order("created_at", { ascending: false });

  if (dateFilter) {
    const { data: avail } = await sb
      .from("pickup_availability")
      .select("id")
      .eq("available_date", dateFilter)
      .single();
    if (!avail) return [];
    query = query.eq("availability_id", avail.id);
  }

  const { data, error } = await query;
  if (error) { console.error("reservations fetch error:", error); return []; }

  return (data || []).map((r: any) => ({
    ...mapDbReservation(r),
    availableDate: r.pickup_availability?.available_date,
  }));
}

export async function updateReservationStatus(
  id: string,
  status: Reservation["status"]
): Promise<boolean> {
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
  const { data, error } = await sb
    .from("reservations")
    .select("*, pickup_availability(available_date)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return { ...mapDbReservation(data), availableDate: data.pickup_availability?.available_date };
}

/** Returns most recent pending/confirmed reservation for a LINE user (for cancel/modify flow). */
export async function getLatestReservationByUser(lineUserId: string): Promise<Reservation | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("reservations")
    .select("*, pickup_availability(available_date)")
    .eq("line_user_id", lineUserId)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return { ...mapDbReservation(data), availableDate: data.pickup_availability?.available_date };
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

/** Fetch all confirmed reservations with dates for iCal feed. */
export async function getConfirmedReservationsForCalendar(): Promise<Reservation[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("reservations")
    .select("*, pickup_availability(available_date)")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });

  if (error) { console.error("calendar reservations fetch error:", error); return []; }
  return (data || []).map((r: any) => ({
    ...mapDbReservation(r),
    availableDate: r.pickup_availability?.available_date,
  }));
}

// ── Cache Invalidation ─────────────────────────────────

export function invalidateCache() {
  productsCache = null;
  configCache = null;
  examplesCache = null;
}

// ── Static Fallbacks ───────────────────────────────────

function getStaticProducts(): ProductCard[] {
  try {
    const filePath = path.join(process.cwd(), "data", "product-cards.json");
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Object.entries(raw).map(([id, p]: [string, any], i) => ({
      id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice || null,
      description: p.description,
      detailedDescription: null,
      imageUrl: p.image,
      storeUrl: p.url,
      badges: p.badges || [],
      isActive: true,
      sortOrder: i,
      temperatureZone: null,
      alcoholFree: !p.badges?.some((b: string) => b.includes("酒精")),
      variants: [],
    }));
  } catch {
    return [];
  }
}

function getStaticConfig(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const filePath = path.join(process.cwd(), "data", "system-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8");

    // Extract XML-like sections from system prompt
    const sections = [
      "identity", "mission", "rules", "format", "out_of_scope_reply",
      "shipping", "pickup", "payment", "refund_policy", "membership",
      "brand_story", "contact", "ordering_process", "reminders",
      "price_reference",
    ];

    for (const section of sections) {
      const regex = new RegExp(`<${section}[^>]*>([\\s\\S]*?)</${section}>`, "i");
      const match = content.match(regex);
      if (match) {
        map.set(section, match[1].trim());
      }
    }
  } catch {
    // ignore
  }
  return map;
}

// ── LINE Users & Conversation Logs ────────────────────

export interface LineUser {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface ConversationLog {
  id: string;
  lineUserId: string;
  role: "user" | "bot";
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export async function upsertLineUser(
  lineUserId: string,
  displayName: string,
  pictureUrl?: string | null
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("line_users").upsert(
      {
        line_user_id: lineUserId,
        display_name: displayName,
        picture_url: pictureUrl || null,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "line_user_id", ignoreDuplicates: false }
    );
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("upsertLineUser error:", e);
  }
}

export function logConversation(
  lineUserId: string,
  role: "user" | "bot",
  content: string,
  metadata?: Record<string, any>
): void {
  const sb = getSupabase();
  if (!sb) return;
  // Fire-and-forget — don't block webhook response
  sb.from("conversation_logs")
    .insert({
      line_user_id: lineUserId,
      role,
      content,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error && error.code !== "42P01") {
        console.error("logConversation error:", error);
      }
    });
}

export async function getAllLineUsers(): Promise<LineUser[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("line_users")
      .select("*")
      .order("last_seen", { ascending: false });
    if (error) {
      if (error.code !== "42P01") console.error("getAllLineUsers error:", error);
      return [];
    }
    return (data || []).map((r: any) => ({
      lineUserId: r.line_user_id,
      displayName: r.display_name,
      pictureUrl: r.picture_url || null,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
    }));
  } catch {
    return [];
  }
}

export async function getConversationHistory(
  lineUserId: string,
  limit = 50
): Promise<ConversationLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("conversation_logs")
      .select("*")
      .eq("line_user_id", lineUserId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (error.code !== "42P01") console.error("getConversationHistory error:", error);
      return [];
    }
    return (data || []).map((r: any) => ({
      id: r.id,
      lineUserId: r.line_user_id,
      role: r.role,
      content: r.content,
      metadata: r.metadata || {},
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function resolveIssue(logId: string, resolved: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    // Fetch current metadata, merge resolved flag
    const { data } = await sb.from("conversation_logs").select("metadata").eq("id", logId).single();
    const metadata = { ...(data?.metadata || {}), resolved };
    const { error } = await sb.from("conversation_logs").update({ metadata }).eq("id", logId);
    return !error;
  } catch {
    return false;
  }
}

export interface ConversationStats {
  totalUsers: number;
  totalMessages: number;
  totalApiCalls: number;
  avgLatencyMs: number;
  estimatedTokens: number;
  flaggedCount: number;
  dailyStats: Array<{
    date: string;
    apiCalls: number;
    avgLatency: number;
    tokens: number;
    flagged: number;
  }>;
}

export async function getConversationStats(): Promise<ConversationStats> {
  const empty: ConversationStats = {
    totalUsers: 0, totalMessages: 0, totalApiCalls: 0,
    avgLatencyMs: 0, estimatedTokens: 0, flaggedCount: 0, dailyStats: [],
  };
  const sb = getSupabase();
  if (!sb) return empty;

  try {
    const { count: totalUsers } = await sb.from("line_users").select("*", { count: "exact", head: true });
    const { data: logs } = await sb.from("conversation_logs").select("role, content, metadata, created_at");
    if (!logs) return { ...empty, totalUsers: totalUsers || 0 };

    const now = new Date();
    let totalApiCalls = 0, flagged = 0, totalLatency = 0, latencyCount = 0, totalTokens = 0;

    // Daily buckets for last 7 days
    const dayMap = new Map<string, { apiCalls: number; latencySum: number; latencyCount: number; tokens: number; flagged: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), { apiCalls: 0, latencySum: 0, latencyCount: 0, tokens: 0, flagged: 0 });
    }

    for (const log of logs) {
      // Estimate tokens: Chinese ~0.5 tokens per char, system prompt ~2350 tokens per API call
      const contentTokens = Math.ceil((log.content?.length || 0) * 0.5);

      if (log.role === "bot") {
        totalApiCalls++;
        totalTokens += 2350 + contentTokens; // system prompt + output
        const lat = log.metadata?.latencyMs;
        if (typeof lat === "number") {
          totalLatency += lat;
          latencyCount++;
        }
      } else {
        totalTokens += contentTokens; // input only
      }

      if (log.metadata?.flagged) flagged++;

      const logDate = (log.created_at || "").slice(0, 10);
      const bucket = dayMap.get(logDate);
      if (bucket) {
        if (log.role === "bot") {
          bucket.apiCalls++;
          bucket.tokens += 2350 + contentTokens;
          const lat = log.metadata?.latencyMs;
          if (typeof lat === "number") { bucket.latencySum += lat; bucket.latencyCount++; }
        } else {
          bucket.tokens += contentTokens;
        }
        if (log.metadata?.flagged) bucket.flagged++;
      }
    }

    const dailyStats = [...dayMap.entries()].map(([date, b]) => ({
      date: `${parseInt(date.slice(5, 7))}/${parseInt(date.slice(8, 10))}`,
      apiCalls: b.apiCalls,
      avgLatency: b.latencyCount > 0 ? Math.round(b.latencySum / b.latencyCount) : 0,
      tokens: b.tokens,
      flagged: b.flagged,
    }));

    return {
      totalUsers: totalUsers || 0,
      totalMessages: logs.length,
      totalApiCalls,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      estimatedTokens: totalTokens,
      flaggedCount: flagged,
      dailyStats,
    };
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("getConversationStats error:", e);
    return empty;
  }
}

export interface CustomerWithContext {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  firstSeen: string;
  lastSeen: string;
  messageCount: number;
  flaggedCount: number;
  // From reservations
  upcomingPickup: string | null;
  orderNumber: string | null;
  reservationStatus: string | null;
}

export async function getCustomersWithContext(): Promise<CustomerWithContext[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    // Fetch users
    const { data: users } = await sb.from("line_users").select("*").order("last_seen", { ascending: false });
    if (!users) return [];

    // Fetch message counts + issue counts per user (explicit flags + complaint keywords)
    const COMPLAINT_KEYWORDS = ["壞","破","爛","溢出","漏","退冰","融化","變質","發霉","異味","不新鮮","有問題","品質","瑕疵","損壞","少了","缺","送錯","寄錯","沒收到","退款","退貨","客訴","投訴","不滿","失望"];
    const { data: logs } = await sb.from("conversation_logs").select("line_user_id, role, content, metadata");
    const msgCounts = new Map<string, number>();
    const flagCounts = new Map<string, number>();
    for (const log of logs || []) {
      msgCounts.set(log.line_user_id, (msgCounts.get(log.line_user_id) || 0) + 1);
      const isFlagged = log.metadata?.flagged;
      const isComplaint = log.role === "user" && !isFlagged && COMPLAINT_KEYWORDS.some((kw: string) => (log.content || "").includes(kw));
      if (isFlagged || isComplaint) {
        flagCounts.set(log.line_user_id, (flagCounts.get(log.line_user_id) || 0) + 1);
      }
    }

    // Fetch upcoming reservations (confirmed, future dates)
    const today = new Date().toISOString().slice(0, 10);
    const { data: reservations } = await sb
      .from("reservations")
      .select("line_user_id, order_number, status, pickup_availability(available_date)")
      .in("status", ["confirmed", "pending"])
      .order("created_at", { ascending: false });

    const pickupMap = new Map<string, { date: string; orderNumber: string | null; status: string }>();
    for (const r of reservations || []) {
      const date = (r as any).pickup_availability?.available_date;
      if (date && date >= today && !pickupMap.has(r.line_user_id)) {
        pickupMap.set(r.line_user_id, { date, orderNumber: r.order_number, status: r.status });
      }
    }

    // Combine and sort: upcoming pickups first, then flagged, then recent
    const customers: CustomerWithContext[] = users.map((u: any) => {
      const pickup = pickupMap.get(u.line_user_id);
      return {
        lineUserId: u.line_user_id,
        displayName: u.display_name,
        pictureUrl: u.picture_url || null,
        firstSeen: u.first_seen,
        lastSeen: u.last_seen,
        messageCount: msgCounts.get(u.line_user_id) || 0,
        flaggedCount: flagCounts.get(u.line_user_id) || 0,
        upcomingPickup: pickup?.date || null,
        orderNumber: pickup?.orderNumber || null,
        reservationStatus: pickup?.status || null,
      };
    });

    customers.sort((a, b) => {
      // Upcoming pickups first
      if (a.upcomingPickup && !b.upcomingPickup) return -1;
      if (!a.upcomingPickup && b.upcomingPickup) return 1;
      // Then flagged (needs attention)
      if (a.flaggedCount > 0 && b.flaggedCount === 0) return -1;
      if (a.flaggedCount === 0 && b.flaggedCount > 0) return 1;
      // Then by recent activity
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    return customers;
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("getCustomersWithContext error:", e);
    return [];
  }
}

// ── DB → App Type Mapping ──────────────────────────────

function mapDbProduct(row: any): ProductCard {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    originalPrice: row.original_price || null,
    description: row.description,
    detailedDescription: row.detailed_description || null,
    imageUrl: row.image_url,
    storeUrl: row.store_url,
    badges: row.badges || [],
    isActive: row.is_active,
    sortOrder: row.sort_order || 0,
    temperatureZone: row.temperature_zone || null,
    alcoholFree: row.alcohol_free ?? true,
    variants: row.variants || [],
  };
}
