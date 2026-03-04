import fs from "fs";
import path from "path";
import { getSupabase } from "./supabase";

// ── Types ──────────────────────────────────────────────

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
  weekday: number;        // 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string;      // "14:00"
  endTime: string;        // "17:00"
  slotDurationMinutes: number;
  maxPerSlot: number;
  isActive: boolean;
  createdAt: string;
}

export interface PickupSlot {
  id: string;
  availabilityId: string;
  slotDate: string;       // "2026-03-10"
  startTime: string;
  endTime: string;
  maxCapacity: number;
  currentBookings: number;
  isAvailable: boolean;
}

export interface Reservation {
  id: string;
  slotId: string;
  lineUserId: string | null;
  displayName: string;
  orderNumber: string | null;
  note: string | null;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
  // joined
  slotDate?: string;
  slotStartTime?: string;
  slotEndTime?: string;
}

export async function getAvailabilityRules(): Promise<PickupAvailability[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pickup_availability")
    .select("*")
    .order("weekday", { ascending: true });
  if (error) { console.error("availability fetch error:", error); return []; }
  return (data || []).map(mapDbAvailability);
}

export async function upsertAvailability(
  rule: Partial<PickupAvailability> & { weekday: number; startTime: string; endTime: string }
): Promise<PickupAvailability | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const row: any = {
    weekday: rule.weekday,
    start_time: rule.startTime,
    end_time: rule.endTime,
    slot_duration_minutes: rule.slotDurationMinutes ?? 60,
    max_per_slot: rule.maxPerSlot ?? 3,
    is_active: rule.isActive ?? true,
  };
  if (rule.id) row.id = rule.id;
  const { data, error } = await sb
    .from("pickup_availability")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) { console.error("availability upsert error:", error); return null; }
  return mapDbAvailability(data);
}

export async function deleteAvailability(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("pickup_availability").delete().eq("id", id);
  if (error) { console.error("availability delete error:", error); return false; }
  return true;
}

/**
 * Lazily generate pickup_slots for the next `weeksAhead` weeks based on availability rules.
 * Only creates slots that don't already exist (UNIQUE constraint on slot_date + start_time).
 */
export async function ensureSlotsGenerated(weeksAhead = 3): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const rules = await getAvailabilityRules();
  const activeRules = rules.filter((r) => r.isActive);
  if (activeRules.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slotsToInsert: any[] = [];

  for (let w = 0; w < weeksAhead; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + w * 7 + d);
      const weekday = date.getDay();

      for (const rule of activeRules) {
        if (rule.weekday !== weekday) continue;

        // Generate slots within the time window
        const [sh, sm] = rule.startTime.split(":").map(Number);
        const [eh, em] = rule.endTime.split(":").map(Number);
        let cursor = sh * 60 + sm;
        const endMinutes = eh * 60 + em;

        while (cursor + rule.slotDurationMinutes <= endMinutes) {
          const startH = String(Math.floor(cursor / 60)).padStart(2, "0");
          const startM = String(cursor % 60).padStart(2, "0");
          const endCursor = cursor + rule.slotDurationMinutes;
          const endH = String(Math.floor(endCursor / 60)).padStart(2, "0");
          const endM = String(endCursor % 60).padStart(2, "0");

          slotsToInsert.push({
            availability_id: rule.id,
            slot_date: date.toISOString().split("T")[0],
            start_time: `${startH}:${startM}`,
            end_time: `${endH}:${endM}`,
            max_capacity: rule.maxPerSlot,
            current_bookings: 0,
            is_available: true,
          });
          cursor += rule.slotDurationMinutes;
        }
      }
    }
  }

  if (slotsToInsert.length === 0) return;
  // ignore conflicts (already exists)
  await sb.from("pickup_slots").upsert(slotsToInsert, {
    onConflict: "slot_date,start_time",
    ignoreDuplicates: true,
  });
}

export async function getAvailableSlots(): Promise<PickupSlot[]> {
  const sb = getSupabase();
  if (!sb) return [];

  await ensureSlotsGenerated(3);

  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await sb
    .from("pickup_slots")
    .select("*")
    .gte("slot_date", today)
    .eq("is_available", true)
    .order("slot_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) { console.error("slots fetch error:", error); return []; }
  return (data || [])
    .map(mapDbSlot)
    .filter((s) => s.currentBookings < s.maxCapacity);
}

export async function getSlotById(id: string): Promise<PickupSlot | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("pickup_slots")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return mapDbSlot(data);
}

export async function createReservation(input: {
  slotId: string;
  lineUserId?: string;
  displayName: string;
  orderNumber?: string;
  note?: string;
}): Promise<Reservation | null> {
  const sb = getSupabase();
  if (!sb) return null;

  // Check slot still has capacity
  const slot = await getSlotById(input.slotId);
  if (!slot || slot.currentBookings >= slot.maxCapacity) return null;

  const { data, error } = await sb
    .from("reservations")
    .insert({
      slot_id: input.slotId,
      line_user_id: input.lineUserId || null,
      display_name: input.displayName,
      order_number: input.orderNumber || null,
      note: input.note || null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) { console.error("reservation insert error:", error); return null; }

  // Increment current_bookings
  await sb
    .from("pickup_slots")
    .update({ current_bookings: slot.currentBookings + 1 })
    .eq("id", input.slotId);

  return mapDbReservation(data);
}

export async function getAllReservations(dateFilter?: string): Promise<Reservation[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb
    .from("reservations")
    .select("*, pickup_slots(slot_date, start_time, end_time)")
    .order("created_at", { ascending: false });

  if (dateFilter) {
    const { data: slots } = await sb
      .from("pickup_slots")
      .select("id")
      .eq("slot_date", dateFilter);
    const slotIds = (slots || []).map((s: any) => s.id);
    if (slotIds.length === 0) return [];
    query = query.in("slot_id", slotIds);
  }

  const { data, error } = await query;
  if (error) { console.error("reservations fetch error:", error); return []; }

  return (data || []).map((r: any) => ({
    ...mapDbReservation(r),
    slotDate: r.pickup_slots?.slot_date,
    slotStartTime: r.pickup_slots?.start_time,
    slotEndTime: r.pickup_slots?.end_time,
  }));
}

export async function updateReservationStatus(
  id: string,
  status: Reservation["status"]
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from("reservations")
    .update({ status })
    .eq("id", id);
  if (error) { console.error("reservation update error:", error); return false; }
  return true;
}

function mapDbAvailability(row: any): PickupAvailability {
  return {
    id: row.id,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    slotDurationMinutes: row.slot_duration_minutes,
    maxPerSlot: row.max_per_slot,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapDbSlot(row: any): PickupSlot {
  return {
    id: row.id,
    availabilityId: row.availability_id,
    slotDate: row.slot_date,
    startTime: row.start_time,
    endTime: row.end_time,
    maxCapacity: row.max_capacity,
    currentBookings: row.current_bookings,
    isAvailable: row.is_available,
  };
}

function mapDbReservation(row: any): Reservation {
  return {
    id: row.id,
    slotId: row.slot_id,
    lineUserId: row.line_user_id || null,
    displayName: row.display_name,
    orderNumber: row.order_number || null,
    note: row.note || null,
    status: row.status,
    createdAt: row.created_at,
  };
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
  };
}
