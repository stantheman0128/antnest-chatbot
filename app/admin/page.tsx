"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProductCard {
  id: string;
  name: string;
  price: string;
  isActive: boolean;
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const token = localStorage.getItem("admin_token");
    try {
      const res = await fetch("/api/admin/products?all=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  const activeCount = products.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-amber-900">管理總覽</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">上架產品</p>
          <p className="text-3xl font-bold text-amber-900">
            {loading ? "..." : activeCount}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">總產品數</p>
          <p className="text-3xl font-bold text-amber-900">
            {loading ? "..." : products.length}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-amber-800">快速操作</h3>

        <Link
          href="/admin/products"
          className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <span className="text-lg">🍰</span>
          <span className="ml-2 text-amber-900 font-medium">管理產品</span>
          <span className="text-gray-400 text-sm ml-2">
            新增、修改、上下架
          </span>
        </Link>

        <Link
          href="/admin/settings"
          className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <span className="text-lg">⚙️</span>
          <span className="ml-2 text-amber-900 font-medium">系統設定</span>
          <span className="text-gray-400 text-sm ml-2">
            運費、付款、取貨方式等
          </span>
        </Link>
      </div>
    </div>
  );
}
