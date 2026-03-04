"use client";

import { useEffect, useState } from "react";

interface Example {
  id: string;
  customerMessage: string;
  correctResponse: string;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY: Omit<Example, "id" | "sortOrder"> = {
  customerMessage: "",
  correctResponse: "",
  note: null,
  isActive: true,
};

export default function ExamplesPage() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    open: boolean;
    editing: Partial<Example> | null;
  }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchExamples();
  }, []);

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  async function fetchExamples() {
    try {
      const res = await fetch("/api/admin/examples", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setExamples(await res.json());
    } catch {
      // ignore
    }
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openNew() {
    setModal({ open: true, editing: { ...EMPTY } });
  }

  function openEdit(example: Example) {
    setModal({ open: true, editing: { ...example } });
  }

  function closeModal() {
    setModal({ open: false, editing: null });
  }

  async function save() {
    if (!modal.editing) return;
    const { customerMessage, correctResponse } = modal.editing;
    if (!customerMessage?.trim() || !correctResponse?.trim()) return;

    setSaving(true);
    const res = await fetch("/api/admin/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(modal.editing),
    });

    if (res.ok) {
      showToast("儲存成功！即時生效中");
      closeModal();
      await fetchExamples();
    } else {
      showToast("儲存失敗");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/examples?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      setExamples((prev) => prev.filter((e) => e.id !== id));
      showToast("已刪除");
    }
  }

  async function toggleActive(example: Example) {
    const res = await fetch("/api/admin/examples", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ ...example, isActive: !example.isActive }),
    });
    if (res.ok) {
      setExamples((prev) =>
        prev.map((e) =>
          e.id === example.id ? { ...e, isActive: !e.isActive } : e
        )
      );
    }
  }

  if (loading) {
    return <p className="text-amber-800 text-center py-8">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-amber-900">對話範例教學</h2>
          <p className="text-xs text-amber-600 mt-0.5">
            新增範例後，機器人會學習照此模式回應
          </p>
        </div>
        <button
          onClick={openNew}
          className="bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-900"
        >
          + 新增
        </button>
      </div>

      {toast && (
        <div className="bg-green-50 text-green-800 px-4 py-3 rounded-xl text-sm">
          {toast}
        </div>
      )}

      {examples.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">💬</p>
          <p className="font-medium">還沒有對話範例</p>
          <p className="text-sm mt-1">
            新增範例來教機器人正確的回應方式
          </p>
        </div>
      )}

      <div className="space-y-3">
        {examples.map((example) => (
          <div
            key={example.id}
            className={`bg-white rounded-xl p-4 shadow-sm ${
              !example.isActive ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {!example.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                      已停用
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm">
                    <span className="text-gray-500 text-xs">顧客說：</span>
                    <p className="text-amber-900 font-medium line-clamp-2">
                      「{example.customerMessage}」
                    </p>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 text-xs">機器人回：</span>
                    <p className="text-green-800 line-clamp-2">
                      「{example.correctResponse}」
                    </p>
                  </div>
                  {example.note && (
                    <p className="text-xs text-gray-400 italic">{example.note}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => openEdit(example)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100"
                >
                  編輯
                </button>
                <button
                  onClick={() => toggleActive(example)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    example.isActive
                      ? "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      : "bg-green-50 text-green-600 hover:bg-green-100"
                  }`}
                >
                  {example.isActive ? "停用" : "啟用"}
                </button>
                <button
                  onClick={() => remove(example.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal.open && modal.editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4">
            <h3 className="text-lg font-bold text-amber-900">
              {modal.editing.id ? "編輯範例" : "新增範例"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-amber-800 block mb-1">
                  顧客說的話 *
                </label>
                <textarea
                  value={modal.editing.customerMessage || ""}
                  onChange={(e) =>
                    setModal((m) => ({
                      ...m,
                      editing: { ...m.editing!, customerMessage: e.target.value },
                    }))
                  }
                  placeholder="例如：可以換口味嗎？"
                  rows={2}
                  className="w-full border border-amber-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-800 block mb-1">
                  機器人應該怎麼回 *
                </label>
                <textarea
                  value={modal.editing.correctResponse || ""}
                  onChange={(e) =>
                    setModal((m) => ({
                      ...m,
                      editing: { ...m.editing!, correctResponse: e.target.value },
                    }))
                  }
                  placeholder="例如：客製化需求幫你轉接闆娘～"
                  rows={3}
                  className="w-full border border-amber-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-amber-800 block mb-1">
                  備註（選填）
                </label>
                <input
                  type="text"
                  value={modal.editing.note || ""}
                  onChange={(e) =>
                    setModal((m) => ({
                      ...m,
                      editing: { ...m.editing!, note: e.target.value || null },
                    }))
                  }
                  placeholder="提醒自己為什麼加這個範例"
                  className="w-full border border-amber-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3 border border-amber-200 rounded-xl text-amber-700 font-medium hover:bg-amber-50"
              >
                取消
              </button>
              <button
                onClick={save}
                disabled={
                  saving ||
                  !modal.editing.customerMessage?.trim() ||
                  !modal.editing.correctResponse?.trim()
                }
                className="flex-1 py-3 bg-amber-800 text-white rounded-xl font-medium hover:bg-amber-900 disabled:opacity-50"
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
