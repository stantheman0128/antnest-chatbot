'use client';

import { useCallback, useEffect, useState } from 'react';

import Image from 'next/image';

import { getToken, useToast } from '@/lib/admin-utils';

interface ConfigItem {
  key: string;
  value: string;
  label: string;
  description: string;
}

const AUTO_SYNC_KEY = 'auto_sync_enabled';
const AUTO_RESPOND_IDS_KEY = 'auto_respond_user_ids';

const CONFIG_MAX_LENGTHS: Record<string, number> = {
  greeting: 500,
  next_order_announcement: 500,
  mission: 500,
  rules: 2000,
  format: 2000,
  out_of_scope_reply: 500,
  shipping: 1000,
  pickup: 1000,
  payment: 500,
  refund_policy: 1000,
  membership: 2000,
  brand_story: 2000,
  contact: 500,
  ordering_process: 1000,
  reminders: 1000,
  price_reference: 2000,
};

const DEFAULT_MAX_LENGTH = 2000;

const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /忽略(以上|上面|之前|先前)(的)?(指令|規則|提示|設定)/g,
];

function hasSuspiciousContent(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(value);
  });
}

const CONFIG_SECTIONS: Omit<ConfigItem, 'value'>[] = [
  {
    key: 'next_order_announcement',
    label: '下次開單時間公告',
    description: '顧客問「下次開單」時的回覆內容',
  },
  {
    key: 'greeting',
    label: '打招呼訊息',
    description: '顧客呼叫小螞蟻時的歡迎訊息（純文字）',
  },
  {
    key: 'mission',
    label: '任務目標',
    description: '客服助理的核心任務',
  },
  {
    key: 'rules',
    label: '回覆規則',
    description: '優先順序、禁止事項、未知問題處理',
  },
  {
    key: 'format',
    label: '回覆格式',
    description: '語氣、長度、emoji 使用、排版規則',
  },
  {
    key: 'out_of_scope_reply',
    label: '超出範圍回覆',
    description: '不相關問題的回覆模板',
  },
  {
    key: 'shipping',
    label: '運費與出貨',
    description: '運費金額、出貨時間、包裝說明',
  },
  {
    key: 'pickup',
    label: '取貨方式',
    description: '工作室自取的地點與規則',
  },
  {
    key: 'payment',
    label: '付款方式',
    description: '接受的付款方式',
  },
  {
    key: 'refund_policy',
    label: '退換貨政策',
    description: '退款條件與流程',
  },
  {
    key: 'membership',
    label: '會員制度',
    description: '會員等級、升級條件、優惠',
  },
  {
    key: 'brand_story',
    label: '品牌故事',
    description: '關於螞蟻窩甜點',
  },
  {
    key: 'contact',
    label: '聯絡資訊',
    description: '店名、地址、電話、社群連結',
  },
  {
    key: 'ordering_process',
    label: '訂購流程',
    description: '從瀏覽到下單的步驟',
  },
  {
    key: 'reminders',
    label: '注意事項',
    description: 'AI 回覆時的額外提醒',
  },
  {
    key: 'price_reference',
    label: '價格對照表',
    description: '所有商品價格由低到高排序',
  },
];

interface LineUserInfo {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
}

export default function SettingsPage() {
  const [configs, setConfigs] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [allUsers, setAllUsers] = useState<LineUserInfo[]>([]);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const { toast } = useToast();

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { key: string; value: string }[];
        const map = new Map<string, string>();
        for (const item of data) {
          map.set(item.key, item.value);
        }
        setConfigs(map);
      }
    } catch {
      toast('無法載入設定，請重新整理頁面', 'error');
    }
    setLoading(false);
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setAllUsers((await res.json()) as LineUserInfo[]);
    } catch {
      toast('無法載入用戶清單', 'error');
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfigs();
    void fetchUsers();
  }, [fetchConfigs, fetchUsers]);

  function getAdminIds(): string[] {
    return (configs.get(AUTO_RESPOND_IDS_KEY) || '')
      .split(/[\n,]/)
      .map((id) => id.trim())
      .filter(Boolean);
  }

  async function saveAdminIds(ids: string[]) {
    try {
      const value = ids.join('\n');
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ key: AUTO_RESPOND_IDS_KEY, value }),
      });
      if (res.ok) {
        setConfigs((prev) => {
          const m = new Map(prev);
          m.set(AUTO_RESPOND_IDS_KEY, value);
          return m;
        });
        toast('管理員名單已更新！');
      }
    } catch {
      toast('更新管理員名單失敗', 'error');
    }
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(configs.get(key) || '');
  }

  async function handleSave() {
    if (!editingKey) return;
    setSaving(true);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ key: editingKey, value: editValue }),
      });

      const result = (await res.json()) as { warnings?: string[]; error?: string };
      if (res.ok) {
        setConfigs((prev) => {
          const next = new Map(prev);
          next.set(editingKey, editValue);
          return next;
        });
        if (result.warnings && result.warnings.length > 0) {
          toast('儲存成功！⚠️ ' + result.warnings.join(', '));
        } else {
          toast('儲存成功！即時生效中');
        }
        setEditingKey(null);
      } else {
        toast(result.error || '儲存失敗', 'error');
      }
    } catch {
      toast('網路錯誤', 'error');
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

      {/* AI Model configuration */}
      <div>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
          AI 模型配置
        </p>
        <div className="bg-white rounded-2xl border border-stone-100 px-4 py-4 space-y-4">
          {(
            [
              {
                key: 'classifier_model',
                label: '意圖分類器',
                desc: '分類用戶意圖，需要最快速度',
                defaultVal: 'gemini-2.5-flash-lite',
              },
              {
                key: 'ai_model',
                label: '標準回答',
                desc: '已知主題的回答',
                defaultVal: 'gemini-2.5-flash',
              },
              {
                key: 'strong_ai_model',
                label: '強模型',
                desc: '模糊/複雜問題，需要更強推理力',
                defaultVal: 'gemini-2.5-pro',
              },
              {
                key: 'failover_model',
                label: 'Failover',
                desc: '主模型失敗時的備援',
                defaultVal: 'gemini-2.5-flash',
              },
              {
                key: 'summary_model',
                label: '對話摘要',
                desc: 'Admin 後台的對話摘要生成',
                defaultVal: 'gemini-2.5-flash-lite',
              },
            ] as const
          ).map(({ key, label, desc, defaultVal }) => (
            <div key={key}>
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-[13px] font-medium text-stone-800">{label}</p>
                <p className="text-[10px] text-stone-300">
                  預設：{defaultVal.replace('gemini-', '')}
                </p>
              </div>
              <p className="text-[11px] text-stone-400 mb-1.5">{desc}</p>
              <select
                value={configs.get(key) || defaultVal}
                onChange={(e) =>
                  void (async () => {
                    const value = e.target.value;
                    try {
                      const res = await fetch('/api/admin/config', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${getToken()}`,
                        },
                        body: JSON.stringify({ key, value }),
                      });
                      if (res.ok) {
                        setConfigs((prev) => {
                          const m = new Map(prev);
                          m.set(key, value);
                          return m;
                        });
                        toast(`${label} 已切換為 ${value.replace('gemini-', '')}`);
                      }
                    } catch {
                      toast(`切換 ${label} 失敗`, 'error');
                    }
                  })()
                }
                className="w-full px-3 py-2 border border-stone-200 rounded-xl text-[13px] text-stone-700 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700"
              >
                <option value="gemini-2.5-flash-lite">2.5 Flash-Lite（最快）</option>
                <option value="gemini-2.5-flash">2.5 Flash（均衡）</option>
                <option value="gemini-2.5-pro">2.5 Pro（最強推理）</option>
                <option value="gemini-3-flash-preview">3 Flash Preview（實驗性）</option>
                <option value="gemini-3.1-flash-lite-preview">
                  3.1 Flash-Lite Preview（實驗性）
                </option>
              </select>
            </div>
          ))}

          {/* Reset to defaults button */}
          <button
            onClick={() =>
              void (async () => {
                if (!confirm('確定要恢復所有模型為預設設定嗎？')) return;
                const defaults: Record<string, string> = {
                  classifier_model: 'gemini-2.5-flash-lite',
                  ai_model: 'gemini-2.5-flash',
                  strong_ai_model: 'gemini-2.5-pro',
                  failover_model: 'gemini-2.5-flash-lite',
                  summary_model: 'gemini-2.5-flash-lite',
                };
                try {
                  await Promise.all(
                    Object.entries(defaults).map(([key, value]) =>
                      fetch('/api/admin/config', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${getToken()}`,
                        },
                        body: JSON.stringify({ key, value }),
                      }),
                    ),
                  );
                  setConfigs((prev) => {
                    const m = new Map(prev);
                    for (const [key, value] of Object.entries(defaults)) {
                      m.set(key, value);
                    }
                    return m;
                  });
                  toast('已恢復所有模型為預設設定');
                } catch {
                  toast('恢復預設失敗', 'error');
                }
              })()
            }
            className="w-full py-2.5 border border-stone-200 rounded-xl text-[12px] font-medium text-stone-500 hover:bg-stone-50 transition-colors"
          >
            恢復預設模型設定
          </button>
        </div>
      </div>

      {/* Auto-sync section */}
      <div>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
          自動化
        </p>
        <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-stone-800">產品自動同步</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              每週一 20:05（台灣時間）自動同步官網
            </p>
          </div>
          <button
            onClick={() =>
              void (async () => {
                try {
                  const current = configs.get(AUTO_SYNC_KEY);
                  const next = current === 'false' ? 'true' : 'false';
                  const res = await fetch('/api/admin/config', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
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
                } catch {
                  toast('切換自動同步失敗', 'error');
                }
              })()
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              configs.get(AUTO_SYNC_KEY) !== 'false' ? 'bg-amber-700' : 'bg-stone-200'
            }`}
            role="switch"
            aria-checked={configs.get(AUTO_SYNC_KEY) !== 'false'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                configs.get(AUTO_SYNC_KEY) !== 'false' ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Admin / always-respond users */}
        <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-stone-800">管理員身份</p>
              <p className="text-[11px] text-stone-400 mt-0.5">
                這些人傳訊息時，小螞蟻會自動回覆（不需要呼叫小螞蟻）
              </p>
            </div>
            <button
              onClick={() => setShowAddAdmin(true)}
              className="px-2.5 py-1 bg-amber-800 text-white rounded-lg text-[11px] font-medium hover:bg-amber-900 transition-colors shrink-0"
            >
              + 新增
            </button>
          </div>

          {/* Current admins */}
          <div className="space-y-2">
            {getAdminIds().length === 0 ? (
              <p className="text-[11px] text-stone-400 py-2">尚未設定管理員</p>
            ) : (
              getAdminIds().map((id) => {
                const user = allUsers.find((u) => u.lineUserId === id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 bg-stone-50 rounded-xl px-3 py-2.5"
                  >
                    {user?.pictureUrl ? (
                      <Image
                        src={user.pictureUrl}
                        alt={user.displayName + ' 的大頭貼'}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-[11px] text-stone-400 shrink-0">
                        👤
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-stone-800 truncate">
                        {user?.displayName || '未知用戶'}
                      </p>
                      <p className="text-[10px] text-stone-400 font-mono truncate">{id}</p>
                    </div>
                    <button
                      onClick={() => void saveAdminIds(getAdminIds().filter((x) => x !== id))}
                      className="text-[11px] text-red-400 hover:text-red-600 shrink-0"
                    >
                      移除
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add admin modal */}
          {showAddAdmin && (
            <div className="border border-stone-200 rounded-xl p-3 space-y-2 bg-stone-50">
              <p className="text-[11px] font-semibold text-stone-500">選擇用戶或輸入 ID</p>
              {/* Known users not yet admin */}
              {allUsers.filter((u) => !getAdminIds().includes(u.lineUserId)).length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {allUsers
                    .filter((u) => !getAdminIds().includes(u.lineUserId))
                    .map((user) => (
                      <button
                        key={user.lineUserId}
                        onClick={() => {
                          void saveAdminIds([...getAdminIds(), user.lineUserId]);
                          setShowAddAdmin(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white transition-colors text-left"
                      >
                        {user.pictureUrl ? (
                          <Image
                            src={user.pictureUrl}
                            alt={user.displayName + ' 的大頭貼'}
                            width={28}
                            height={28}
                            className="w-7 h-7 rounded-full shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center text-[10px] text-stone-400 shrink-0">
                            👤
                          </div>
                        )}
                        <span className="text-[11px] text-stone-700 truncate">
                          {user.displayName}
                        </span>
                      </button>
                    ))}
                </div>
              )}
              {/* Manual ID input */}
              <div className="flex gap-2">
                <input
                  id="manual-admin-id"
                  type="text"
                  placeholder="或手動輸入 LINE User ID"
                  className="flex-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-[11px] font-mono bg-white focus:outline-none focus:ring-2 focus:ring-amber-800/15"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('manual-admin-id') as HTMLInputElement;
                    const val = input?.value?.trim();
                    if (val && !getAdminIds().includes(val)) {
                      void saveAdminIds([...getAdminIds(), val]);
                      setShowAddAdmin(false);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-amber-800 text-white rounded-lg text-[11px] font-medium hover:bg-amber-900 transition-colors shrink-0"
                >
                  加入
                </button>
              </div>
              <button
                onClick={() => setShowAddAdmin(false)}
                className="text-[11px] text-stone-400 hover:text-stone-600"
              >
                取消
              </button>
            </div>
          )}
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
            const hasValue = value !== undefined && value !== '';
            return (
              <button
                key={section.key}
                onClick={() => startEdit(section.key)}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors text-left group"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-[13px] font-medium text-stone-800">{section.label}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                    {section.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      hasValue ? 'bg-amber-50 text-amber-700' : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {hasValue ? '已設定' : '未設定'}
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
              <h3 className="text-[13px] font-semibold text-stone-800">
                {CONFIG_SECTIONS.find((s) => s.key === editingKey)?.label || editingKey}
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
                maxLength={CONFIG_MAX_LENGTHS[editingKey] || DEFAULT_MAX_LENGTH}
                rows={15}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-stone-900 text-[13px] font-mono bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors resize-none"
              />
              <div className="flex justify-between mt-1.5 px-1">
                {hasSuspiciousContent(editValue) ? (
                  <p className="text-[11px] text-orange-500">⚠️ 內容可能包含注入語句，請確認</p>
                ) : (
                  <span />
                )}
                <p className="text-[11px] text-stone-400">
                  {editValue.length} / {CONFIG_MAX_LENGTHS[editingKey] || DEFAULT_MAX_LENGTH}
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setEditingKey(null)}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-[13px] text-stone-600 font-medium hover:bg-stone-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 py-2.5 bg-amber-800 text-white rounded-xl text-[13px] font-medium hover:bg-amber-900 disabled:opacity-60 transition-colors"
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
