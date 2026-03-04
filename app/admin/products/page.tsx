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
          `同步完成！新增 ${data.added} 個・更新 ${data.updated} 個・下架 ${data.deactivated} 個`
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
    return <p className="text-amber-800 text-center py-8">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-900">產品管理</h2>
        <div className="flex gap-2">
          <button
            onClick={syncFromCyberbiz}
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? "同步中..." : "🔄 同步官網"}
          </button>
          <Link
            href="/admin/products/new"
            className="bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-900"
          >
            + 新增
          </Link>
        </div>
      </div>

      {syncResult && (
        <div className="bg-blue-50 text-blue-800 px-4 py-3 rounded-xl text-sm">
          {syncResult}
        </div>
      )}

      <div className="space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className={`bg-white rounded-xl p-4 shadow-sm ${
              !product.isActive ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="font-medium text-amber-900 hover:underline truncate"
                  >
                    {product.name}
                  </Link>
                  {!product.isActive && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                      已下架
                    </span>
                  )}
                </div>
                <p className="text-sm text-amber-700 mt-0.5">{product.price}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                  {product.description}
                </p>
                {product.badges.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {product.badges.map((badge, i) => (
                      <span
                        key={i}
                        className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => toggleActive(product)}
                className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  product.isActive
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                }`}
              >
                {product.isActive ? "下架" : "上架"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <p className="text-center text-gray-500 py-8">還沒有產品</p>
      )}
    </div>
  );
}
