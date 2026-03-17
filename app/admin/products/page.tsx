"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  price: string;
  description: string;
  isActive: boolean;
  badges: string[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  async function fetchProducts() {
    try {
      const res = await fetch("/api/admin/products?all=true", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setProducts(await res.json());
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function syncFromCyberbiz() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSyncResult(
          `同步完成 · 新增 ${data.added} · 更新 ${data.updated} · 下架 ${data.deactivated}`
        );
        await fetchProducts();
      } else {
        setSyncResult("同步失敗，請稍後再試");
      }
    } catch {
      setSyncResult("同步失敗，請稍後再試");
    }
    setSyncing(false);
  }

  async function toggleActive(product: Product) {
    const updated = { ...product, isActive: !product.isActive };
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(updated),
    });

    if (res.ok) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updated : p))
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[17px] font-semibold text-stone-800">產品管理</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={syncFromCyberbiz}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 rounded-lg text-[12px] font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            {syncing ? "同步中" : "同步官網"}
          </button>
          <Link
            href="/admin/products/new"
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
          </Link>
        </div>
      </div>

      {syncResult && (
        <div
          className={`px-4 py-2.5 rounded-xl text-[12px] ${
            syncResult.includes("失敗")
              ? "bg-red-50 text-red-600"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {syncResult}
        </div>
      )}

      {/* Product list */}
      <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
        {products.length === 0 && (
          <div className="py-12 text-center text-[13px] text-stone-400">
            還沒有產品
          </div>
        )}
        {products.map((product, idx) => (
          <div
            key={product.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              !product.isActive ? "opacity-50" : ""
            } ${idx < products.length - 1 ? "border-b border-stone-100" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="text-[14px] font-medium text-stone-800 hover:text-amber-800 transition-colors"
                >
                  {product.name}
                </Link>
                {!product.isActive && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-400 rounded-full shrink-0">
                    下架
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[12px] text-amber-700 font-medium">
                  {product.price}
                </span>
                {product.badges.slice(0, 2).map((badge, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => toggleActive(product)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors ${
                product.isActive
                  ? "text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              {product.isActive ? "下架" : "上架"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
