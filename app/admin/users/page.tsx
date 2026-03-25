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

export default function UsersPage() {
  const [users, setUsers] = useState<LineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LineUser | null>(null);
  const [history, setHistory] = useState<ConversationLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setUsers(await res.json());
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function selectUser(user: LineUser) {
    setSelectedUser(user);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/users?id=${user.lineUserId}&limit=100`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setHistory(await res.json());
    } catch {
      setHistory([]);
    }
    setLoadingHistory(false);
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
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${month}/${day} ${h}:${m}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Conversation detail view
  if (selectedUser) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedUser(null); setHistory([]); }}
          className="flex items-center gap-1 text-[13px] text-amber-600 hover:text-amber-800"
        >
          ← 返回顧客列表
        </button>

        <div className="flex items-center gap-3">
          {selectedUser.pictureUrl ? (
            <img src={selectedUser.pictureUrl} alt="" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-400 text-[14px]">
              👤
            </div>
          )}
          <div>
            <p className="text-[15px] font-semibold text-stone-800">{selectedUser.displayName}</p>
            <p className="text-[11px] text-stone-400">最近互動：{timeAgo(selectedUser.lastSeen)}</p>
          </div>
        </div>

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
                    log.role === "user"
                      ? "bg-stone-100 rounded-tl-md"
                      : "bg-amber-50 rounded-tr-md"
                  }`}
                >
                  <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${
                    log.role === "user" ? "text-stone-700" : "text-amber-900"
                  }`}>
                    {log.content}
                  </p>
                  <p className="text-[10px] text-stone-300 mt-1">{formatTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // User list view
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[17px] font-semibold text-stone-800">顧客紀錄</h1>
        <p className="text-[11px] text-stone-400 mt-0.5">
          查看誰跟小螞蟻互動過，點進去看對話紀錄
        </p>
      </div>

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
                <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-400 text-[12px] shrink-0">
                  👤
                </div>
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
  );
}
