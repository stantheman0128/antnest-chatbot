import { getSupabase } from "./supabase";
import { CacheEntry, cache } from "./db-cache";

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

export const COMPLAINT_KEYWORDS = [
  "壞","破","爛","溢出","漏","退冰","融化","變質","發霉","異味","臭",
  "不新鮮","有問題","品質","瑕疵","損壞","碎","裂","凹","髒",
  "少了","缺","錯","不對","送錯","寄錯","沒收到",
  "退款","退貨","客訴","投訴","不滿","失望","生氣","🥹","😡","😤","😭",
];

export async function upsertLineUser(
  lineUserId: string, displayName: string, pictureUrl?: string | null
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("line_users").upsert(
      { line_user_id: lineUserId, display_name: displayName, picture_url: pictureUrl || null, last_seen: new Date().toISOString() },
      { onConflict: "line_user_id", ignoreDuplicates: false }
    );
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("upsertLineUser error:", e);
  }
}

export function logConversation(
  lineUserId: string, role: "user" | "bot", content: string, metadata?: Record<string, any>
): void {
  const sb = getSupabase();
  if (!sb) return;
  sb.from("conversation_logs")
    .insert({ line_user_id: lineUserId, role, content, metadata: metadata || {}, created_at: new Date().toISOString() })
    .then(({ error }) => { if (error && error.code !== "42P01") console.error("logConversation error:", error); });
}

export async function getAllLineUsers(): Promise<LineUser[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("line_users").select("*").order("last_seen", { ascending: false });
    if (error) { if (error.code !== "42P01") console.error("getAllLineUsers error:", error); return []; }
    return (data || []).map((r: any) => ({
      lineUserId: r.line_user_id, displayName: r.display_name, pictureUrl: r.picture_url || null,
      firstSeen: r.first_seen, lastSeen: r.last_seen,
    }));
  } catch { return []; }
}

export async function getConversationHistory(lineUserId: string, limit = 50): Promise<ConversationLog[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("conversation_logs").select("*")
      .eq("line_user_id", lineUserId).order("created_at", { ascending: false }).limit(limit);
    if (error) { if (error.code !== "42P01") console.error("getConversationHistory error:", error); return []; }
    return (data || []).map((r: any) => ({
      id: r.id, lineUserId: r.line_user_id, role: r.role, content: r.content,
      metadata: r.metadata || {}, createdAt: r.created_at,
    }));
  } catch { return []; }
}

export async function resolveIssue(logId: string, resolved: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.rpc("jsonb_merge_metadata", { log_id: logId, patch: { resolved } }).maybeSingle();
    if (error) {
      const { data } = await sb.from("conversation_logs").select("metadata").eq("id", logId).single();
      const metadata = { ...(data?.metadata || {}), resolved };
      const { error: updateErr } = await sb.from("conversation_logs").update({ metadata }).eq("id", logId);
      return !updateErr;
    }
    return true;
  } catch { return false; }
}

// ── Summary Cache ─────────────────────────────────────

export async function getCachedSummary(lineUserId: string): Promise<{ summary: string; updatedAt: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.from("line_users")
      .select("summary, summary_updated_at")
      .eq("line_user_id", lineUserId)
      .single();
    if (data?.summary && data?.summary_updated_at) {
      return { summary: data.summary, updatedAt: data.summary_updated_at };
    }
    return null;
  } catch { return null; }
}

export async function saveSummary(lineUserId: string, summary: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("line_users")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("line_user_id", lineUserId);
  } catch (e: any) {
    console.error("saveSummary error:", e?.message);
  }
}

// ── Stats ─────────────────────────────────────────────

const STATS_CACHE_TTL = 2 * 60 * 1000;

export interface ConversationStats {
  totalUsers: number;
  totalMessages: number;
  totalApiCalls: number;
  avgLatencyMs: number;
  estimatedTokens: number;
  flaggedCount: number;
  dailyStats: Array<{ date: string; apiCalls: number; avgLatency: number; tokens: number; flagged: number }>;
}

export async function getConversationStats(): Promise<ConversationStats> {
  const empty: ConversationStats = {
    totalUsers: 0, totalMessages: 0, totalApiCalls: 0,
    avgLatencyMs: 0, estimatedTokens: 0, flaggedCount: 0, dailyStats: [],
  };

  if (cache.stats && Date.now() - cache.stats.timestamp < STATS_CACHE_TTL) return cache.stats.data;

  const sb = getSupabase();
  if (!sb) return empty;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: totalUsers }, { count: totalMessages }, { data: logs }] = await Promise.all([
      sb.from("line_users").select("*", { count: "exact", head: true }),
      sb.from("conversation_logs").select("*", { count: "exact", head: true }),
      sb.from("conversation_logs").select("role, content, metadata, created_at").gte("created_at", thirtyDaysAgo),
    ]);
    if (!logs) return { ...empty, totalUsers: totalUsers || 0 };

    const now = new Date();
    let totalApiCalls = 0, flagged = 0, totalLatency = 0, latencyCount = 0, totalTokens = 0;

    const dayMap = new Map<string, { apiCalls: number; latencySum: number; latencyCount: number; tokens: number; flagged: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), { apiCalls: 0, latencySum: 0, latencyCount: 0, tokens: 0, flagged: 0 });
    }

    for (const log of logs) {
      const contentTokens = Math.ceil((log.content?.length || 0) * 0.5);
      if (log.role === "bot") {
        totalApiCalls++;
        totalTokens += 2350 + contentTokens;
        const lat = log.metadata?.latencyMs;
        if (typeof lat === "number") { totalLatency += lat; latencyCount++; }
      } else { totalTokens += contentTokens; }
      if (log.metadata?.flagged) flagged++;
      const logDate = (log.created_at || "").slice(0, 10);
      const bucket = dayMap.get(logDate);
      if (bucket) {
        if (log.role === "bot") {
          bucket.apiCalls++;
          bucket.tokens += 2350 + contentTokens;
          const lat = log.metadata?.latencyMs;
          if (typeof lat === "number") { bucket.latencySum += lat; bucket.latencyCount++; }
        } else { bucket.tokens += contentTokens; }
        if (log.metadata?.flagged) bucket.flagged++;
      }
    }

    const dailyStats = [...dayMap.entries()].map(([date, b]) => ({
      date: `${parseInt(date.slice(5, 7))}/${parseInt(date.slice(8, 10))}`,
      apiCalls: b.apiCalls,
      avgLatency: b.latencyCount > 0 ? Math.round(b.latencySum / b.latencyCount) : 0,
      tokens: b.tokens, flagged: b.flagged,
    }));

    const result: ConversationStats = {
      totalUsers: totalUsers || 0, totalMessages: totalMessages || logs.length,
      totalApiCalls, avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      estimatedTokens: totalTokens, flaggedCount: flagged, dailyStats,
    };
    cache.stats = { data: result, timestamp: Date.now() };
    return result;
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("getConversationStats error:", e);
    return empty;
  }
}

// ── Customers with Context ────────────────────────────

export interface CustomerWithContext {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  firstSeen: string;
  lastSeen: string;
  messageCount: number;
  flaggedCount: number;
  upcomingPickup: string | null;
  orderNumber: string | null;
  reservationStatus: string | null;
}

export async function getCustomersWithContext(): Promise<CustomerWithContext[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: users }, { data: logs }, { data: reservations }] = await Promise.all([
      sb.from("line_users").select("*").order("last_seen", { ascending: false }),
      sb.from("conversation_logs").select("line_user_id, role, content, metadata"),
      sb.from("reservations").select("line_user_id, order_number, status, pickup_availability(available_date)")
        .in("status", ["confirmed", "pending"]).order("created_at", { ascending: false }),
    ]);
    if (!users) return [];

    const msgCounts = new Map<string, number>();
    const flagCounts = new Map<string, number>();
    for (const log of logs || []) {
      msgCounts.set(log.line_user_id, (msgCounts.get(log.line_user_id) || 0) + 1);
      const isFlagged = log.metadata?.flagged;
      const isComplaint = log.role === "user" && !isFlagged && COMPLAINT_KEYWORDS.some((kw) => (log.content || "").includes(kw));
      if (isFlagged || isComplaint) {
        flagCounts.set(log.line_user_id, (flagCounts.get(log.line_user_id) || 0) + 1);
      }
    }

    const pickupMap = new Map<string, { date: string; orderNumber: string | null; status: string }>();
    for (const r of reservations || []) {
      const date = (r as any).pickup_availability?.available_date;
      if (date && date >= today && !pickupMap.has(r.line_user_id)) {
        pickupMap.set(r.line_user_id, { date, orderNumber: r.order_number, status: r.status });
      }
    }

    const customers: CustomerWithContext[] = users.map((u: any) => {
      const pickup = pickupMap.get(u.line_user_id);
      return {
        lineUserId: u.line_user_id, displayName: u.display_name, pictureUrl: u.picture_url || null,
        firstSeen: u.first_seen, lastSeen: u.last_seen,
        messageCount: msgCounts.get(u.line_user_id) || 0, flaggedCount: flagCounts.get(u.line_user_id) || 0,
        upcomingPickup: pickup?.date || null, orderNumber: pickup?.orderNumber || null,
        reservationStatus: pickup?.status || null,
      };
    });

    customers.sort((a, b) => {
      if (a.upcomingPickup && !b.upcomingPickup) return -1;
      if (!a.upcomingPickup && b.upcomingPickup) return 1;
      if (a.flaggedCount > 0 && b.flaggedCount === 0) return -1;
      if (a.flaggedCount === 0 && b.flaggedCount > 0) return 1;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    return customers;
  } catch (e: any) {
    if (e?.code !== "42P01") console.error("getCustomersWithContext error:", e);
    return [];
  }
}
