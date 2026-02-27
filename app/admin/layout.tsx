"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token && pathname !== "/admin/login") {
      router.replace("/admin/login");
    } else {
      setAuthenticated(!!token || pathname === "/admin/login");
    }
    setLoading(false);
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-amber-800">載入中...</p>
      </div>
    );
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!authenticated) return null;

  const navItems = [
    { href: "/admin", label: "首頁", icon: "🏠" },
    { href: "/admin/products", label: "產品管理", icon: "🍰" },
    { href: "/admin/settings", label: "系統設定", icon: "⚙️" },
  ];

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Top nav bar */}
      <nav className="bg-amber-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <h1 className="text-lg font-bold">🐜 螞蟻窩管理</h1>
        <button
          onClick={() => {
            localStorage.removeItem("admin_token");
            router.replace("/admin/login");
          }}
          className="text-sm text-amber-200 hover:text-white"
        >
          登出
        </button>
      </nav>

      {/* Tab navigation */}
      <div className="flex border-b border-amber-200 bg-white">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
              pathname === item.href
                ? "text-amber-900 border-b-2 border-amber-900"
                : "text-amber-600 hover:text-amber-800"
            }`}
          >
            <span className="block text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Content */}
      <main className="p-4 max-w-2xl mx-auto">{children}</main>
    </div>
  );
}
