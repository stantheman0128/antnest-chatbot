"use client";

import { useEffect, useState } from "react";

interface ConfigItem {
  key: string;
  value: string;
  label: string;
  description: string;
}

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
    return <p className="text-amber-800 text-center py-8">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-amber-900">系統設定</h2>
      <p className="text-sm text-amber-600">
        修改後即時生效，不需要重新部署
      </p>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.includes("成功")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* Editing modal */}
      {editingKey && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-amber-900">
                {CONFIG_SECTIONS.find((s) => s.key === editingKey)?.label ||
                  editingKey}
              </h3>
              <button
                onClick={() => setEditingKey(null)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm font-mono"
              />
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setEditingKey(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-amber-800 text-white rounded-lg font-medium hover:bg-amber-900 disabled:opacity-50"
              >
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config list */}
      <div className="space-y-2">
        {CONFIG_SECTIONS.map((section) => {
          const value = configs.get(section.key);
          const hasValue = value !== undefined && value !== "";
          return (
            <button
              key={section.key}
              onClick={() => startEdit(section.key)}
              className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-amber-900">
                    {section.label}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {section.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {hasValue ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      已設定
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      未設定
                    </span>
                  )}
                  <span className="text-gray-400">›</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
