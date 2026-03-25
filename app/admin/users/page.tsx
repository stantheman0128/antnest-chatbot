"use client";

import { useEffect, useState } from "react";

interface Customer {
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

interface ConversationLog {
  id: string;
  lineUserId: string;
  role: "user" | "bot";
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalApiCalls: number;
  avgLatencyMs: number;
  estimatedTokens: number;
  flaggedCount: number;
  dailyStats: Array<{ date: string; apiCalls: number; avgLatency: number; tokens: number; flagged: number }>;
}

export default function UsersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Customer | null>(null);
  const [history, setHistory] = useState<ConversationLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeChart, setActiveChart] = useState<"apiCalls" | "latency" | "tokens">("apiCalls");
  const [customerFilter, setCustomerFilter] = useState<"recent" | "pickup" | "flagged">("recent");

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchStats()]).then(() => setLoading(false));
  }, []);

  async function fetchCustomers() {
    try {
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setCustomers(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/users?stats=true", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }

  async function selectUser(user: Customer) {
    setSelectedUser(user);
    setLoadingHistory(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/admin/users?id=${user.lineUserId}&limit=100`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setHistory(await res.json());
    } catch { setHistory([]); }
    setLoadingHistory(false);

    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/admin/users?id=${user.lineUserId}&summary`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) { const data = await res.json(); setSummary(data.summary); }
    } catch { /* ignore */ }
    setLoadingSummary(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "剛剛";
    if (mins < 60) return `${mins}分鐘前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小時前`;
    return `${Math.floor(hours / 24)}天前`;
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  function formatTokens(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Customer detail view ──
  if (selectedUser) {
    const COMPLAINT_KEYWORDS = [
      "壞","破","爛","溢出","漏","退冰","融化","變質","發霉","異味","臭",
      "不新鮮","有問題","品質","瑕疵","損壞","碎","裂","凹","髒",
      "少了","缺","錯","不對","送錯","寄錯","沒收到",
      "退款","退貨","客訴","投訴","不滿","失望","生氣","🥹","😡","😤","😭",
    ];

    // Build issues list from history
    const chronological = [...history].reverse();
    const allIssues: Array<{ id: string; content: string; context: string; type: "feedback" | "complaint"; resolved: boolean; time: string }> = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < chronological.length; i++) {
      const log = chronological[i];
      if (log.metadata?.flagged && !seenIds.has(log.id)) {
        let ctx = "";
        for (let j = i - 1; j >= 0; j--) {
          if (chronological[j].role === "bot") { ctx = chronological[j].content; break; }
        }
        allIssues.push({ id: log.id, content: "回答不滿意", context: ctx, type: "feedback", resolved: !!log.metadata?.resolved, time: log.createdAt });
        seenIds.add(log.id);
      }
      if (log.role === "user" && !log.metadata?.flagged && !seenIds.has(log.id)) {
        if (COMPLAINT_KEYWORDS.some((kw) => (log.content || "").includes(kw))) {
          allIssues.push({ id: log.id, content: log.content, context: "", type: "complaint", resolved: !!log.metadata?.resolved, time: log.createdAt });
          seenIds.add(log.id);
        }
      }
    }

    const openIssues = allIssues.filter((i) => !i.resolved);
    const resolvedIssues = allIssues.filter((i) => i.resolved);

    async function toggleResolved(logId: string, resolved: boolean) {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ logId, resolved }),
      });
      // Update local history metadata
      setHistory((prev) => prev.map((l) => l.id === logId ? { ...l, metadata: { ...l.metadata, resolved } } : l));
    }

    return (
      <div className="space-y-3">
        <button onClick={() => { setSelectedUser(null); setHistory([]); setSummary(null); }}
          className="flex items-center gap-1 text-[13px] text-amber-600 hover:text-amber-800">
          ← 返回
        </button>

        {/* Profile + AI summary combined */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {selectedUser.pictureUrl ? (
              <img src={selectedUser.pictureUrl} alt="" className="w-11 h-11 rounded-full" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-stone-200 flex items-center justify-center text-stone-400">👤</div>
            )}
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-stone-800">{selectedUser.displayName}</p>
              <p className="text-[11px] text-stone-400">
                {selectedUser.messageCount} 則 · {timeAgo(selectedUser.lastSeen)}
                {selectedUser.upcomingPickup && ` · 📦 ${selectedUser.upcomingPickup}`}
              </p>
            </div>
          </div>
          {/* AI summary inline */}
          <div className="bg-amber-50 rounded-xl px-3 py-2">
            {loadingSummary ? (
              <p className="text-[12px] text-amber-700 animate-pulse">摘要分析中...</p>
            ) : (
              <p className="text-[12px] text-amber-900">{summary || "尚無對話紀錄"}</p>
            )}
          </div>
        </div>

        {/* Open issues */}
        {openIssues.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 p-4">
            <p className="text-[10px] font-semibold text-red-500 mb-2.5">待處理（{openIssues.length}）</p>
            <div className="space-y-2">
              {openIssues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-2.5">
                  <button
                    onClick={() => toggleResolved(issue.id, true)}
                    className="mt-0.5 w-4.5 h-4.5 shrink-0 rounded border-2 border-stone-300 hover:border-amber-600 transition-colors flex items-center justify-center"
                    style={{ width: "18px", height: "18px" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        issue.type === "feedback" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                      }`}>
                        {issue.type === "feedback" ? "回答問題" : "產品問題"}
                      </span>
                      <span className="text-[9px] text-stone-400">{formatTime(issue.time)}</span>
                    </div>
                    <p className="text-[12px] text-stone-700 line-clamp-2">
                      {issue.type === "complaint" ? issue.content : issue.context || issue.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved issues (collapsed) */}
        {resolvedIssues.length > 0 && (
          <details className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <summary className="px-4 py-3 text-[10px] font-semibold text-stone-400 cursor-pointer hover:bg-stone-50 transition-colors">
              已解決（{resolvedIssues.length}）
            </summary>
            <div className="px-4 pb-3 space-y-2">
              {resolvedIssues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-2.5 opacity-60">
                  <button
                    onClick={() => toggleResolved(issue.id, false)}
                    className="mt-0.5 shrink-0 rounded border-2 border-amber-600 bg-amber-600 flex items-center justify-center"
                    style={{ width: "18px", height: "18px" }}
                  >
                    <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" className="w-2.5 h-2.5">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-400">
                        {issue.type === "feedback" ? "回答問題" : "產品問題"}
                      </span>
                      <span className="text-[9px] text-stone-400">{formatTime(issue.time)}</span>
                    </div>
                    <p className="text-[12px] text-stone-400 line-clamp-1 line-through">
                      {issue.type === "complaint" ? issue.content : issue.context || issue.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* No issues */}
        {allIssues.length === 0 && (
          <div className="bg-white rounded-2xl border border-stone-100 px-4 py-6 text-center">
            <p className="text-[12px] text-stone-400">沒有問題回饋紀錄</p>
          </div>
        )}
      </div>
    );
  }

  // ── Dashboard view ──
  const chartData = stats?.dailyStats || [];
  const chartValues = chartData.map((d) =>
    activeChart === "apiCalls" ? d.apiCalls
    : activeChart === "latency" ? d.avgLatency
    : d.tokens
  );
  const maxChartVal = Math.max(...chartValues, 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[17px] font-semibold text-stone-800">AI 客服數據</h1>
        <p className="text-[11px] text-stone-400 mt-0.5">成效監控與顧客管理</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "API 呼叫", value: String(stats.totalApiCalls), sub: `今日 ${chartData[chartData.length - 1]?.apiCalls || 0} 次`, color: "text-stone-800" },
            { label: "平均延遲", value: stats.avgLatencyMs > 0 ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : "—", sub: "AI 回覆速度", color: "text-stone-800" },
            { label: "Token 用量", value: formatTokens(stats.estimatedTokens), sub: "估算值", color: "text-stone-800" },
            { label: "不滿意率", value: stats.totalApiCalls > 0 ? `${((stats.flaggedCount / stats.totalApiCalls) * 100).toFixed(1)}%` : "0%", sub: `${stats.flaggedCount} 則回報`, color: stats.flaggedCount > 0 ? "text-red-600" : "text-stone-800" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-stone-100 p-3.5">
              <p className="text-[10px] font-medium text-stone-400">{card.label}</p>
              <p className={`text-[22px] font-semibold leading-tight mt-0.5 ${card.color}`}>{card.value}</p>
              {card.sub && <p className="text-[10px] text-stone-400 mt-0.5">{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Chart with tabs */}
      {stats && chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          {/* Chart tabs */}
          <div className="flex gap-1 mb-3">
            {([
              { key: "apiCalls" as const, label: "API 呼叫" },
              { key: "latency" as const, label: "延遲" },
              { key: "tokens" as const, label: "Token" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveChart(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  activeChart === tab.key ? "bg-amber-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-1.5" style={{ height: "96px" }}>
            {chartData.map((d, i) => {
              const val = chartValues[i];
              const barH = maxChartVal > 0 ? Math.max((val / maxChartVal) * 72, val > 0 ? 4 : 0) : 0;
              const label = activeChart === "latency" ? (val > 0 ? `${(val / 1000).toFixed(1)}s` : "—")
                : activeChart === "tokens" ? formatTokens(val)
                : String(val);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end" style={{ height: "96px" }}>
                  <p className="text-[9px] text-stone-500 font-medium mb-1">{label}</p>
                  <div
                    className={`w-full max-w-[28px] rounded-t-md ${d.flagged > 0 ? "bg-red-400" : "bg-amber-600"}`}
                    style={{ height: `${barH}px` }}
                  />
                  <p className="text-[9px] text-stone-400 mt-1">{d.date}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer list with filter tabs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
            顧客列表（{customers.length}）
          </p>
        </div>
        <div className="flex gap-1 mb-3">
          {([
            { key: "recent" as const, label: "最新訊息" },
            { key: "pickup" as const, label: "近期取貨" },
            { key: "flagged" as const, label: "問題回饋" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCustomerFilter(tab.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                customerFilter === tab.key ? "bg-amber-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
              }`}
            >
              {tab.label}
              {tab.key === "pickup" && customers.filter((c) => c.upcomingPickup).length > 0 && (
                <span className="ml-1 text-[9px]">({customers.filter((c) => c.upcomingPickup).length})</span>
              )}
              {tab.key === "flagged" && customers.filter((c) => c.flaggedCount > 0).length > 0 && (
                <span className="ml-1 text-[9px]">({customers.filter((c) => c.flaggedCount > 0).length})</span>
              )}
            </button>
          ))}
        </div>
        {(() => {
          let filtered = [...customers];
          if (customerFilter === "pickup") {
            filtered = filtered.filter((c) => c.upcomingPickup);
            filtered.sort((a, b) => (a.upcomingPickup || "").localeCompare(b.upcomingPickup || ""));
          } else if (customerFilter === "flagged") {
            filtered = filtered.filter((c) => c.flaggedCount > 0);
            filtered.sort((a, b) => b.flaggedCount - a.flaggedCount);
          } else {
            filtered.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
          }

          if (filtered.length === 0) return (
            <div className="bg-white rounded-2xl border border-stone-100 py-12 text-center">
              <p className="text-[13px] font-medium text-stone-600 mb-1">
                {customerFilter === "pickup" ? "目前沒有近期取貨的顧客" : customerFilter === "flagged" ? "沒有問題回饋紀錄" : "還沒有顧客紀錄"}
              </p>
            </div>
          );

          return (
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-100">
            {filtered.map((c) => (
              <button
                key={c.lineUserId}
                onClick={() => selectUser(c)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  {c.pictureUrl ? (
                    <img src={c.pictureUrl} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-400 text-[12px]">👤</div>
                  )}
                  {c.flaggedCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-stone-800 truncate">{c.displayName}</p>
                    {c.upcomingPickup && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full shrink-0">
                        📦 {c.upcomingPickup}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {c.messageCount} 則 · {timeAgo(c.lastSeen)}
                    {c.orderNumber && ` · 訂單 ${c.orderNumber}`}
                  </p>
                </div>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-stone-300 shrink-0">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
