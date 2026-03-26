"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "登入失敗");
        return;
      }

      localStorage.setItem("admin_token", data.token);
      router.replace("/admin");
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-stone-50">
      <div className="w-full max-w-[340px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-2xl bg-amber-800 flex items-center justify-center mb-3 shadow-sm">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <ellipse cx="12" cy="7" rx="3" ry="2" fill="white" opacity="0.95" />
              <ellipse cx="12" cy="13.5" rx="3.5" ry="2.5" fill="white" opacity="0.95" />
              <ellipse cx="12" cy="19.5" rx="2.5" ry="1.8" fill="white" opacity="0.7" />
              <line x1="9" y1="12" x2="5.5" y2="10.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
              <line x1="9" y1="14" x2="5.5" y2="15" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
              <line x1="15" y1="12" x2="18.5" y2="10.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
              <line x1="15" y1="14" x2="18.5" y2="15" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />
            </svg>
          </div>
          <h1 className="text-[17px] font-semibold text-stone-800 tracking-tight">螞蟻窩管理後台</h1>
          <p className="text-[11px] text-stone-400 mt-0.5">請登入以繼續</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-stone-400 mb-1.5 uppercase tracking-widest">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-[13px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors placeholder:text-stone-300"
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-stone-400 mb-1.5 uppercase tracking-widest">
                密碼
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-[13px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors placeholder:text-stone-300"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              {error && (
                <p className="mt-2 text-[11px] text-red-500">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-800 text-white py-2.5 rounded-xl text-[13px] font-medium hover:bg-amber-900 active:scale-[0.98] disabled:opacity-60 transition-all mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  登入中
                </span>
              ) : (
                "登入"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
