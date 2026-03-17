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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-stone-800">對話範例</h1>
          <p className="text-[11px] text-stone-400 mt-0.5">
            新增後機器人會學習照此模式回應
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-800 rounded-lg text-[12px] font-medium text-white hover:bg-amber-900 transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          新增
        </button>
      </div>

      {toast && (
        <div
          className={`px-4 py-2.5 rounded-xl text-[12px] ${
            toast.includes("失敗") ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-800"
          }`}
        >
          {toast}
        </div>
      )}

      {examples.length === 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 py-12 text-center">
          <p className="text-[13px] font-medium text-stone-600 mb-1">還沒有對話範例</p>
          <p className="text-[12px] text-stone-400">新增範例來教機器人正確的回應方式</p>
        </div>
      )}

      <div className="space-y-3">
        {examples.map((example) => (
          <div
            key={example.id}
            className={`bg-white rounded-2xl border border-stone-100 overflow-hidden ${
              !example.isActive ? "opacity-50" : ""
            }`}
          >
            {/* Conversation preview */}
            <div className="px-4 pt-4 pb-3 space-y-2">
              {!example.isActive && (
                <span className="inline-block text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full mb-1">
                  已停用
                </span>
              )}
              <div className="flex gap-2.5 items-start">
                <span className="text-[10px] text-stone-400 pt-1 w-10 shrink-0 text-right">顧客</span>
                <div className="flex-1 bg-stone-100 rounded-2xl rounded-tl-md px-3 py-2">
                  <p className="text-[13px] text-stone-700 leading-relaxed">
                    {example.customerMessage}
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 items-start justify-end">
                <div className="flex-1 bg-amber-50 rounded-2xl rounded-tr-md px-3 py-2">
                  <p className="text-[13px] text-amber-900 leading-relaxed">
                    {example.correctResponse}
                  </p>
                </div>
                <span className="text-[10px] text-stone-400 pt-1 w-10 shrink-0">機器人</span>
              </div>
              {example.note && (
                <p className="text-[11px] text-stone-400 italic pl-12">{example.note}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex border-t border-stone-100">
              <button
                onClick={() => openEdit(example)}
                className="flex-1 py-2.5 text-[12px] font-medium text-stone-500 hover:bg-stone-50 transition-colors border-r border-stone-100"
              >
                編輯
              </button>
              <button
                onClick={() => toggleActive(example)}
                className={`flex-1 py-2.5 text-[12px] font-medium transition-colors border-r border-stone-100 ${
                  example.isActive
                    ? "text-stone-500 hover:bg-stone-50"
                    : "text-amber-700 hover:bg-amber-50"
                }`}
              >
                {example.isActive ? "停用" : "啟用"}
              </button>
              <button
                onClick={() => remove(example.id)}
                className="flex-1 py-2.5 text-[12px] font-medium text-red-400 hover:bg-red-50 transition-colors"
              >
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {modal.open && modal.editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="px-4 py-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-stone-800">
                {modal.editing.id ? "編輯範例" : "新增範例"}
              </h3>
              <button
                onClick={closeModal}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 transition-colors"
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

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-semibold text-stone-400 mb-1.5 uppercase tracking-widest">
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
                  className="w-full border border-stone-200 rounded-xl p-3 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-stone-400 mb-1.5 uppercase tracking-widest">
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
                  className="w-full border border-stone-200 rounded-xl p-3 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-stone-400 mb-1.5 uppercase tracking-widest">
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
                  className="w-full border border-stone-200 rounded-xl p-3 text-[13px] text-stone-900 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors"
                />
              </div>
            </div>

            <div className="px-4 py-4 border-t border-stone-100 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-[14px] text-stone-600 font-medium hover:bg-stone-50 transition-colors"
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
