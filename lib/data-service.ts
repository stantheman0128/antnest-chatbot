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

// ── Cache Invalidation ─────────────────────────────────

export function invalidateCache() {
  productsCache = null;
  configCache = null;
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
