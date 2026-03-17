"use client";

import { useEffect, useState } from "react";

interface ConfigItem {
  key: string;
  value: string;
  label: string;
  description: string;
}

const AUTO_SYNC_KEY = "auto_sync_enabled";

const CONFIG_SECTIONS: Omit<ConfigItem, "value">[] = [
  {
    key: "identity",
    label: "身份設定",
    description: "小螞蟻的角色定義與自我介紹時機",
  },
  {
    key: "mission",
    label: "任務目標",
    description: "客服助理的核心任務",
  },
  {
    key: "rules",
    label: "回覆規則",
    description: "優先順序、禁止事項、未知問題處理",
  },
  {
    key: "format",
    label: "回覆格式",
    description: "語氣、長度、emoji 使用、排版規則",
  },
  {
    key: "out_of_scope_reply",
    label: "超出範圍回覆",
    description: "不相關問題的回覆模板",
  },
  {
    key: "shipping",
    label: "運費與出貨",
    description: "運費金額、出貨時間、包裝說明",
  },
  {
    key: "pickup",
    label: "取貨方式",
    description: "工作室自取的地點與規則",
  },
  {
    key: "payment",
    label: "付款方式",
    description: "接受的付款方式",
  },
  {
    key: "refund_policy",
    label: "退換貨政策",
    description: "退款條件與流程",
  },
  {
    key: "membership",
    label: "會員制度",
    description: "會員等級、升級條件、優惠",
  },
  {
    key: "brand_story",
    label: "品牌故事",
    description: "關於螞蟻窩甜點",
  },
  {
    key: "contact",
    label: "聯絡資訊",
    description: "店名、地址、電話、社群連結",
  },
  {
    key: "ordering_process",
    label: "訂購流程",
    description: "從瀏覽到下單的步驟",
  },
  {
    key: "reminders",
    label: "注意事項",
    description: "AI 回覆時的額外提醒",
  },
  {
    key: "price_reference",
    label: "價格對照表",
    description: "所有商品價格由低到高排序",
  },
];

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  useEffect(() => {
    fetchConfigs();
  }, []);

  async function fetchConfigs() {
    try {
      const res = await fetch("/api/admin/config", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data: { key: string; value: string }[] = await res.json();
        const map = new Map<string, string>();
        for (const item of data) {
          map.set(item.key, item.value);
        }
        setConfigs(map);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(configs.get(key) || "");
    setMessage("");
  }

  async function handleSave() {
    if (!editingKey) return;
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ key: editingKey, value: editValue }),
      });

      if (res.ok) {
        setConfigs((prev) => {
          const next = new Map(prev);
          next.set(editingKey!, editValue);
          return next;
        });
        setMessage("儲存成功！即時生效中");
        setEditingKey(null);
      } else {
        setMessage("儲存失敗");
      }
    } catch {
      setMessage("網路錯誤");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-[17px] font-semibold text-stone-800">系統設定</h1>

      {message && (
        <div
          className={`px-4 py-2.5 rounded-xl text-[12px] ${
            message.includes("成功")
              ? "bg-amber-50 text-amber-800"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* Auto-sync section */}
      <div>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
          自動化
        </p>
        <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-medium text-stone-800">產品自動同步</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              每週一 20:05（台灣時間）自動同步官網
            </p>
          </div>
          <button
            onClick={async () => {
              const current = configs.get(AUTO_SYNC_KEY);
              const next = current === "false" ? "true" : "false";
              const res = await fetch("/api/admin/config", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify({ key: AUTO_SYNC_KEY, value: next }),
              });
              if (res.ok) {
                setConfigs((prev) => {
                  const m = new Map(prev);
                  m.set(AUTO_SYNC_KEY, next);
                  return m;
                });
              }
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              configs.get(AUTO_SYNC_KEY) !== "false"
                ? "bg-amber-700"
                : "bg-stone-200"
            }`}
            role="switch"
            aria-checked={configs.get(AUTO_SYNC_KEY) !== "false"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                configs.get(AUTO_SYNC_KEY) !== "false"
                  ? "translate-x-6"
                  : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI config sections */}
      <div>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
          AI 設定
        </p>
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-100">
          {CONFIG_SECTIONS.map((section) => {
            const value = configs.get(section.key);
            const hasValue = value !== undefined && value !== "";
            return (
              <button
                key={section.key}
                onClick={() => startEdit(section.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-[14px] font-medium text-stone-800">
                    {section.label}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                    {section.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      hasValue
                        ? "bg-amber-50 text-amber-700"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {hasValue ? "已設定" : "未設定"}
                  </span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4 text-stone-300 group-hover:text-stone-400 transition-colors"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edit bottom sheet */}
      {editingKey && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-stone-800">
                {CONFIG_SECTIONS.find((s) => s.key === editingKey)?.label ||
                  editingKey}
              </h3>
              <button
                onClick={() => setEditingKey(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={15}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-stone-900 text-[13px] font-mono bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors resize-none"
              />
            </div>
            <div className="p-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setEditingKey(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-[14px] text-stone-600 font-medium hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-amber-800 text-white rounded-xl text-[14px] font-medium hover:bg-amber-900 disabled:opacity-60 transition-colors"
              >
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
