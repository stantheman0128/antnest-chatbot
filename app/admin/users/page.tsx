"use client";

import { useEffect, useState } from "react";

interface LineUser {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
  firstSeen: string;
  lastSeen: string;
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
  totalBotMessages: number;
  totalUserMessages: number;
  todayMessages: number;
  flaggedCount: number;
  dailyStats: Array<{ date: string; userMsgs: number; botMsgs: number; flagged: number }>;
}

export default function UsersPage() {
  const [users, setUsers] = useState<LineUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null);
  const [history, setHistory] = useState<ConversationLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  useEffect(() => {
    Promise.all([fetchUsers(), fetchStats()]).then(() => setLoading(false));
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch { /* ignore */ }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/users?stats=true", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }

  async function selectUser(user: LineUser) {
    setSelectedUser(user);
    setLoadingHistory(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/admin/users?id=${user.lineUserId}&limit=100`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch { setHistory([]); }
    setLoadingHistory(false);

    // Fetch AI summary in background
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/admin/users?id=${user.lineUserId}&summary`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
      }
    } catch { /* ignore */ }
    setLoadingSummary(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "剛剛";
    if (mins < 60) return `${mins} 分鐘前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小時前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Conversation detail view ──
  if (selectedUser) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedUser(null); setHistory([]); setSummary(null); }}
          className="flex items-center gap-1 text-[13px] text-amber-600 hover:text-amber-800"
        >
          ← 返回
        </button>

        <div className="flex items-center gap-3">
          {selectedUser.pictureUrl ? (
            <img src={selectedUser.pictureUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-400 text-[14px]">👤</div>
          )}
          <div>
            <p className="text-[15px] font-semibold text-stone-800">{selectedUser.displayName}</p>
            <p className="text-[11px] text-stone-400">最近互動：{timeAgo(selectedUser.lastSeen)}</p>
          </div>
        </div>

        {/* AI Summary */}
        <div className="bg-amber-50 rounded-2xl border border-amber-100 px-4 py-3">
          <p className="text-[10px] font-semibold text-amber-600 mb-1">AI 對話摘要</p>
          {loadingSummary ? (
            <p className="text-[13px] text-amber-700 animate-pulse">分析中...</p>
          ) : (
            <p className="text-[13px] text-amber-900">{summary || "尚無對話紀錄"}</p>
          )}
        </div>

        {/* Conversation */}
        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-100 py-12 text-center">
            <p className="text-[13px] text-stone-400">還沒有對話紀錄</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...history].reverse().map((log) => (
              <div key={log.id} className={`flex ${log.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                    log.metadata?.flagged
                      ? "bg-red-50 border-2 border-red-200 rounded-tl-md"
                      : log.role === "user"
                        ? "bg-stone-100 rounded-tl-md"
                        : "bg-amber-50 rounded-tr-md"
                  }`}
                >
                  {log.metadata?.flagged && (
                    <p className="text-[10px] text-red-500 font-semibold mb-1">不滿意回報</p>
                  )}
                  <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                    log.role === "user" ? "text-stone-700" : "text-amber-900"
                  }`}>
                    {log.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-stone-300">{formatTime(log.createdAt)}</p>
                    {log.metadata?.latencyMs && (
                      <p className="text-[10px] text-stone-300">{(log.metadata.latencyMs / 1000).toFixed(1)}s</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Dashboard view ──
  const dissatisfactionRate = stats && stats.totalMessages > 0
    ? ((stats.flaggedCount / stats.totalMessages) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[17px] font-semibold text-stone-800">顧客與數據</h1>
        <p className="text-[11px] text-stone-400 mt-0.5">AI 客服成效監控</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "總顧客", value: String(stats.totalUsers), sub: null },
            { label: "今日訊息", value: String(stats.todayMessages), sub: null },
            { label: "AI 回覆數", value: String(stats.totalBotMessages), sub: `共 ${stats.totalMessages} 則` },
            { label: "不滿意率", value: `${dissatisfactionRate}%`, sub: `${stats.flaggedCount} 則回報` },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-stone-100 p-3.5">
              <p className="text-[10px] font-medium text-stone-400">{card.label}</p>
              <p className="text-[22px] font-semibold text-stone-800 leading-tight mt-0.5">{card.value}</p>
              {card.sub && <p className="text-[10px] text-stone-400 mt-0.5">{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 7-day trend chart (pure SVG) */}
      {stats && stats.dailyStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-4">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">最近 7 天訊息量</p>
          <div className="relative h-28">
            <svg viewBox="0 0 280 100" className="w-full h-full" preserveAspectRatio="none">
              {(() => {
                const data = stats.dailyStats;
                const maxVal = Math.max(...data.map((d) => d.userMsgs + d.botMsgs), 1);
                const points = data.map((d, i) => ({
                  x: (i / Math.max(data.length - 1, 1)) * 260 + 10,
                  y: 90 - ((d.userMsgs + d.botMsgs) / maxVal) * 80,
                  total: d.userMsgs + d.botMsgs,
                  flagged: d.flagged,
                }));
                const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                const areaD = pathD + ` L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`;
                return (
                  <>
                    <path d={areaD} fill="url(#grad)" opacity="0.3" />
                    <path d={pathD} fill="none" stroke="#92400E" strokeWidth="2" strokeLinejoin="round" />
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="3" fill="#92400E" />
                        <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill="#78716C">{p.total}</text>
                        {p.flagged > 0 && <circle cx={p.x} cy={p.y} r="6" fill="none" stroke="#DC2626" strokeWidth="1.5" />}
                      </g>
                    ))}
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#92400E" />
                        <stop offset="100%" stopColor="#92400E" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="flex justify-between mt-1 px-1">
            {stats.dailyStats.map((d) => (
              <span key={d.date} className="text-[9px] text-stone-400">{d.date}</span>
            ))}
          </div>
        </div>
      )}

      {/* User list */}
      <div>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
          顧客列表
        </p>
        {users.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-100 py-12 text-center">
            <p className="text-[13px] font-medium text-stone-600 mb-1">還沒有顧客紀錄</p>
            <p className="text-[12px] text-stone-400">有人跟小螞蟻互動後就會出現在這裡</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-100">
            {users.map((user) => (
              <button
                key={user.lineUserId}
                onClick={() => selectUser(user)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
              >
                {user.pictureUrl ? (
                  <img src={user.pictureUrl} alt="" className="w-9 h-9 rounded-full shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-400 text-[12px] shrink-0">👤</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-stone-800 truncate">{user.displayName}</p>
                  <p className="text-[11px] text-stone-400">{timeAgo(user.lastSeen)}</p>
                </div>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-stone-300 shrink-0">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
