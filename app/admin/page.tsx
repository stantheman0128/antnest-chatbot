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
  const inactiveCount = products.length - activeCount;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[17px] font-semibold text-stone-800">總覽</h1>
        <p className="text-[12px] text-stone-400 mt-0.5">螞蟻窩甜點管理後台</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "上架中", value: loading ? "—" : String(activeCount), accent: false },
          { label: "已下架", value: loading ? "—" : String(inactiveCount), accent: false },
          { label: "總產品", value: loading ? "—" : String(products.length), accent: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-2xl border p-4 ${
              stat.accent
                ? "bg-amber-800 border-amber-800"
                : "bg-white border-stone-100"
            }`}
          >
            <p className={`text-[10px] font-medium mb-1 ${stat.accent ? "text-amber-200" : "text-stone-400"}`}>
              {stat.label}
            </p>
            <p className={`text-[26px] font-semibold leading-none ${stat.accent ? "text-white" : "text-stone-800"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
          快速操作
        </p>
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-100">
          {[
            { href: "/admin/products", label: "管理產品", desc: "新增、修改、上下架" },
            { href: "/admin/pickup", label: "取貨預約", desc: "查看預約、設定時段" },
            { href: "/admin/examples", label: "對話範例", desc: "教機器人正確的回應方式" },
            { href: "/admin/settings", label: "系統設定", desc: "運費、付款、取貨方式等" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-stone-50 transition-colors group"
            >
              <div>
                <p className="text-[14px] font-medium text-stone-800">{item.label}</p>
                <p className="text-[12px] text-stone-400 mt-0.5">{item.desc}</p>
              </div>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-stone-300 group-hover:text-stone-400 transition-colors shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
