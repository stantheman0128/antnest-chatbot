import { getSupabase } from "./supabase";
import { cache, isCacheValid, CacheEntry } from "./db-cache";

// ── Types ──────────────────────────────────────────────

export interface SystemConfig {
  key: string;
  value: string;
}

// ── System Config ──────────────────────────────────────

export async function getConfigMap(): Promise<Map<string, string>> {
  if (isCacheValid(cache.config)) return cache.config.data;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from("system_config").select("*");
      if (!error && data) {
        const map = new Map<string, string>();
        for (const row of data) {
          map.set(row.key, row.value);
        }
        cache.config = { data: map, timestamp: Date.now() };
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
  cache.config = null;
  return true;
}

export async function deleteConfig(key: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("system_config").delete().eq("key", key);
  if (error) { console.error("Supabase delete config error:", error); return false; }
  cache.config = null;
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

// ── Static Fallback ────────────────────────────────────

function getStaticConfig(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const fs = require("fs");
    const path = require("path");
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
