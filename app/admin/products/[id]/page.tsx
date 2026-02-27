"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface ProductForm {
  id: string;
  name: string;
  price: string;
  originalPrice: string;
  description: string;
  detailedDescription: string;
  imageUrl: string;
  storeUrl: string;
  badges: string;
  isActive: boolean;
  sortOrder: number;
  temperatureZone: string;
  alcoholFree: boolean;
}

const EMPTY_FORM: ProductForm = {
  id: "",
  name: "",
  price: "",
  originalPrice: "",
  description: "",
  detailedDescription: "",
  imageUrl: "",
  storeUrl: "",
  badges: "",
  isActive: true,
  sortOrder: 0,
  temperatureZone: "冷凍",
  alcoholFree: true,
};

export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const isNew = productId === "new";

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function getToken() {
    return localStorage.getItem("admin_token") || "";
  }

  useEffect(() => {
    if (!isNew) {
      fetchProduct();
    }
  }, [productId]);

  async function fetchProduct() {
    try {
      const res = await fetch("/api/admin/products?all=true", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const products = await res.json();
        const product = products.find((p: any) => p.id === productId);
        if (product) {
          setForm({
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice || "",
            description: product.description,
            detailedDescription: product.detailedDescription || "",
            imageUrl: product.imageUrl,
            storeUrl: product.storeUrl,
            badges: product.badges.join(", "),
            isActive: product.isActive,
            sortOrder: product.sortOrder,
            temperatureZone: product.temperatureZone || "冷凍",
            alcoholFree: product.alcoholFree,
          });
        }
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      id: form.id,
      name: form.name,
      price: form.price,
      originalPrice: form.originalPrice || null,
      description: form.description,
      detailedDescription: form.detailedDescription || null,
      imageUrl: form.imageUrl,
      storeUrl: form.storeUrl,
      badges: form.badges
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean),
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      temperatureZone: form.temperatureZone,
      alcoholFree: form.alcoholFree,
    };

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage("儲存成功！");
        if (isNew) {
          router.replace(`/admin/products/${form.id}`);
        }
      } else {
        setMessage("儲存失敗");
      }
    } catch {
      setMessage("網路錯誤");
    }
    setSaving(false);
  }

  function updateField(field: keyof ProductForm, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return <p className="text-amber-800 text-center py-8">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-900">
          {isNew ? "新增產品" : "編輯產品"}
        </h2>
        <button
          onClick={() => router.back()}
          className="text-amber-600 text-sm hover:text-amber-800"
        >
          ← 返回
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            產品 ID（英文，不可更改）
          </label>
          <input
            type="text"
            value={form.id}
            onChange={(e) => updateField("id", e.target.value)}
            disabled={!isNew}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100"
            placeholder="e.g. classic-tiramisu"
            required
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            產品名稱
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>

        {/* Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              售價
            </label>
            <input
              type="text"
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              placeholder="NT$290 起"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              原價（選填）
            </label>
            <input
              type="text"
              value={form.originalPrice}
              onChange={(e) => updateField("originalPrice", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              placeholder="NT$390"
            />
          </div>
        </div>

        {/* Short description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            短描述（卡片用）
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>

        {/* Detailed description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            詳細描述（AI 知識庫用）
          </label>
          <textarea
            value={form.detailedDescription}
            onChange={(e) => updateField("detailedDescription", e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            placeholder="詳細的產品特色、食用方式、保存方式等..."
          />
        </div>

        {/* URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            圖片網址
          </label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => updateField("imageUrl", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            商品頁連結
          </label>
          <input
            type="url"
            value={form.storeUrl}
            onChange={(e) => updateField("storeUrl", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>

        {/* Badges */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            標籤（逗號分隔）
          </label>
          <input
            type="text"
            value={form.badges}
            onChange={(e) => updateField("badges", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            placeholder="🏆 招牌, ✅ 無酒精"
          />
        </div>

        {/* Options row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              溫層
            </label>
            <select
              value={form.temperatureZone}
              onChange={(e) => updateField("temperatureZone", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="冷凍">冷凍</option>
              <option value="常溫">常溫</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              排序
            </label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) =>
                updateField("sortOrder", parseInt(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={form.alcoholFree}
                onChange={(e) => updateField("alcoholFree", e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">無酒精</span>
            </label>
          </div>
        </div>

        {/* Active toggle */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => updateField("isActive", e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">上架中</span>
        </label>

        {/* Save */}
        {message && (
          <p
            className={`text-sm ${
              message.includes("成功") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-amber-800 text-white py-3 rounded-lg font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
        >
          {saving ? "儲存中..." : "儲存"}
        </button>
      </form>
    </div>
  );
}
