'use client';

import { useCallback, useEffect, useState } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { getToken, useToast } from '@/lib/admin-utils';

interface ProductForm {
  id: string;
  name: string;
  price: string;
  originalPrice: string;
  description: string;
  // Structured description fields (v2 JSON)
  descMode: 'structured' | 'legacy';
  descLegacy: string;
  descIntro: string;
  descSpecs: string;
  descStorage: string;
  descShelfLife: string;
  descUsage: string;
  imageUrl: string;
  storeUrl: string;
  badges: string;
  isActive: boolean;
  sortOrder: number;
  temperatureZone: string;
  alcoholFree: boolean;
}

const EMPTY_FORM: ProductForm = {
  id: '',
  name: '',
  price: '',
  originalPrice: '',
  description: '',
  descMode: 'structured',
  descLegacy: '',
  descIntro: '',
  descSpecs: '',
  descStorage: '',
  descShelfLife: '',
  descUsage: '',
  imageUrl: '',
  storeUrl: '',
  badges: '',
  isActive: true,
  sortOrder: 0,
  temperatureZone: '冷凍',
  alcoholFree: true,
};

interface DescFromRaw {
  mode: 'structured' | 'legacy';
  intro: string;
  specs: string;
  storage: string;
  shelfLife: string;
  usage: string;
  legacy: string;
}

interface ParsedV2 {
  v?: number;
  intro?: string;
  specs?: string;
  storage?: string;
  shelfLife?: string;
  usage?: string;
}

/** Parse v2 JSON from detailedDescription, or return null for legacy text */
function parseDescFromRaw(raw: string | null): DescFromRaw {
  if (!raw)
    return {
      mode: 'structured',
      intro: '',
      specs: '',
      storage: '',
      shelfLife: '',
      usage: '',
      legacy: '',
    };
  if (raw.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as ParsedV2;
      if (parsed?.v === 2) {
        return {
          mode: 'structured',
          intro: parsed.intro || '',
          specs: parsed.specs || '',
          storage: parsed.storage || '',
          shelfLife: parsed.shelfLife || '',
          usage: parsed.usage || '',
          legacy: '',
        };
      }
    } catch {
      /* not valid JSON */
    }
  }
  return {
    mode: 'legacy',
    intro: '',
    specs: '',
    storage: '',
    shelfLife: '',
    usage: '',
    legacy: raw,
  };
}

/** Serialize structured fields back to JSON string */
function serializeDesc(form: ProductForm): string | null {
  if (form.descMode === 'legacy') return form.descLegacy || null;
  const hasContent =
    form.descIntro || form.descSpecs || form.descStorage || form.descShelfLife || form.descUsage;
  if (!hasContent) return null;
  return JSON.stringify({
    v: 2,
    intro: form.descIntro,
    specs: form.descSpecs,
    storage: form.descStorage,
    shelfLife: form.descShelfLife,
    usage: form.descUsage,
  });
}

export default function ProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const isNew = productId === 'new';

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  interface ProductApiItem {
    id: string;
    name: string;
    price: string;
    originalPrice?: string;
    description: string;
    detailedDescription: string | null;
    imageUrl: string;
    storeUrl: string;
    badges: string[];
    isActive: boolean;
    sortOrder: number;
    temperatureZone?: string;
    alcoholFree: boolean;
  }

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products?all=true', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const products = (await res.json()) as ProductApiItem[];
        const product = products.find((p) => p.id === productId);
        if (product) {
          const desc = parseDescFromRaw(product.detailedDescription);
          setForm({
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice || '',
            description: product.description,
            descMode: desc.mode,
            descLegacy: desc.legacy,
            descIntro: desc.intro,
            descSpecs: desc.specs,
            descStorage: desc.storage,
            descShelfLife: desc.shelfLife,
            descUsage: desc.usage,
            imageUrl: product.imageUrl,
            storeUrl: product.storeUrl,
            badges: product.badges.join(', '),
            isActive: product.isActive,
            sortOrder: product.sortOrder,
            temperatureZone: product.temperatureZone || '冷凍',
            alcoholFree: product.alcoholFree,
          });
        }
      } else {
        toast('載入產品資料失敗', 'error');
      }
    } catch {
      toast('載入產品資料失敗', 'error');
    }
    setLoading(false);
  }, [productId, toast]);

  useEffect(() => {
    if (!isNew) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchProduct();
    }
  }, [isNew, fetchProduct]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: form.id,
      name: form.name,
      price: form.price,
      originalPrice: form.originalPrice || null,
      description: form.description,
      detailedDescription: serializeDesc(form),
      imageUrl: form.imageUrl,
      storeUrl: form.storeUrl,
      badges: form.badges
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      isActive: form.isActive,
      sortOrder: form.sortOrder,
      temperatureZone: form.temperatureZone,
      alcoholFree: form.alcoholFree,
    };

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast('儲存成功！');
        if (isNew) {
          router.replace(`/admin/products/${form.id}`);
        }
      } else {
        toast('儲存失敗', 'error');
      }
    } catch {
      toast('網路錯誤', 'error');
    }
    setSaving(false);
  }

  function updateField(field: keyof ProductForm, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return <p className="text-amber-800 text-center py-8">載入中...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-amber-900">{isNew ? '新增產品' : '編輯產品'}</h2>
        <div className="flex items-center gap-3">
          {!isNew && (
            <button
              type="button"
              onClick={() =>
                void (async () => {
                  setSyncing(true);
                  try {
                    const res = await fetch('/api/admin/scrape', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${getToken()}`,
                      },
                      body: JSON.stringify({ handle: productId }),
                    });
                    if (res.ok) {
                      toast('同步成功！重新載入...');
                      await fetchProduct();
                    } else {
                      const err = (await res.json()) as { error?: string };
                      toast(`同步失敗：${err.error || '未知錯誤'}`, 'error');
                    }
                  } catch {
                    toast('同步失敗：網路錯誤', 'error');
                  }
                  setSyncing(false);
                })()
              }
              disabled={syncing}
              className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 disabled:opacity-50"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
              >
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
              {syncing ? '同步中...' : '從官網同步'}
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="text-amber-600 text-sm hover:text-amber-800"
          >
            ← 返回
          </button>
        </div>
      </div>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        {/* ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            產品 ID（英文，不可更改）
          </label>
          <input
            type="text"
            value={form.id}
            onChange={(e) => updateField('id', e.target.value)}
            disabled={!isNew}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 disabled:bg-gray-100"
            placeholder="e.g. classic-tiramisu"
            required
          />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">產品名稱</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>

        {/* Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">售價</label>
            <input
              type="text"
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              placeholder="NT$290 起"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">原價（選填）</label>
            <input
              type="text"
              value={form.originalPrice}
              onChange={(e) => updateField('originalPrice', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              placeholder="NT$390"
            />
          </div>
        </div>

        {/* Short description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">短描述（卡片用）</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>

        {/* Detailed description — structured or legacy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              詳細描述（AI 知識庫用）
            </label>
            {form.descMode === 'legacy' && (
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    descMode: 'structured',
                    descIntro: prev.descLegacy,
                    descLegacy: '',
                  }))
                }
                className="text-xs text-amber-600 hover:text-amber-800"
              >
                轉換為結構化欄位 →
              </button>
            )}
          </div>

          {form.descMode === 'legacy' ? (
            <textarea
              value={form.descLegacy}
              onChange={(e) => updateField('descLegacy', e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm"
              placeholder="詳細的產品特色、食用方式、保存方式等..."
            />
          ) : (
            <div className="space-y-2.5 bg-stone-50 rounded-xl p-3">
              {[
                { key: 'descIntro' as const, label: '商品特色', rows: 5, ph: '產品特色介紹...' },
                {
                  key: 'descSpecs' as const,
                  label: '規格說明',
                  rows: 2,
                  ph: '尺寸、重量、成分等...',
                },
                {
                  key: 'descStorage' as const,
                  label: '保存方式',
                  rows: 4,
                  ph: '冷凍/冷藏保存方式...',
                },
                {
                  key: 'descShelfLife' as const,
                  label: '保存期限',
                  rows: 2,
                  ph: '冷凍1個月 / 冷藏2-3天...',
                },
                {
                  key: 'descUsage' as const,
                  label: '食用方式',
                  rows: 4,
                  ph: '退冰時間、回烤方式等...',
                },
              ].map(({ key, label, rows, ph }) => (
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-stone-400 mb-1 uppercase tracking-widest">
                    {label}
                  </label>
                  <textarea
                    value={form[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    rows={rows}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-gray-900 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-800/15 focus:border-amber-700 transition-colors resize-y"
                    placeholder={ph}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* URLs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">圖片網址</label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => updateField('imageUrl', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">商品頁連結</label>
          <input
            type="url"
            value={form.storeUrl}
            onChange={(e) => updateField('storeUrl', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            required
          />
        </div>

        {/* Badges */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標籤（逗號分隔）</label>
          <input
            type="text"
            value={form.badges}
            onChange={(e) => updateField('badges', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            placeholder="🏆 招牌, ✅ 無酒精"
          />
        </div>

        {/* Options row */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">溫層</label>
            <select
              value={form.temperatureZone}
              onChange={(e) => updateField('temperatureZone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="冷凍">冷凍</option>
              <option value="常溫">常溫</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => updateField('sortOrder', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={form.alcoholFree}
                onChange={(e) => updateField('alcoholFree', e.target.checked)}
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
            onChange={(e) => updateField('isActive', e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-700">上架中</span>
        </label>

        {/* Save */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-amber-800 text-white py-3 rounded-lg font-medium hover:bg-amber-900 disabled:opacity-50 transition-colors"
        >
          {saving ? '儲存中...' : '儲存'}
        </button>
      </form>
    </div>
  );
}
