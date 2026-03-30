import { CacheEntry, cache, isCacheValid } from './db-cache';
import { getSupabase } from './supabase';

// ── Types ──────────────────────────────────────────────

export interface ProductVariant {
  title: string;
  option1: string | null;
  price: number;
  compareAtPrice: number | null;
  available: boolean;
  imageUrl: string | null;
}

export interface ProductCard {
  id: string;
  name: string;
  price: string;
  originalPrice: string | null;
  description: string;
  detailedDescription: string | null;
  imageUrl: string;
  storeUrl: string;
  badges: string[];
  isActive: boolean;
  sortOrder: number;
  temperatureZone: string | null;
  alcoholFree: boolean;
  variants: ProductVariant[];
}

// ── DB Row Type ──────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  price: string;
  original_price: string | null;
  description: string;
  detailed_description: string | null;
  image_url: string;
  store_url: string;
  badges: string[] | null;
  is_active: boolean;
  sort_order: number | null;
  temperature_zone: string | null;
  alcohol_free: boolean | null;
  variants: ProductVariant[] | null;
}

// ── Static Product Shape ─────────────────────────────────

interface StaticProduct {
  name: string;
  price: string;
  originalPrice?: string | null;
  description: string;
  image: string;
  url: string;
  badges?: string[];
}

// ── Products ───────────────────────────────────────────

export async function getActiveProducts(): Promise<ProductCard[]> {
  if (isCacheValid(cache.products as CacheEntry<ProductCard[]> | null))
    return (cache.products as CacheEntry<ProductCard[]>).data;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        const products = (data as ProductRow[]).map(mapDbProduct);
        cache.products = { data: products, timestamp: Date.now() };
        return products;
      }
      console.error('Supabase products query error:', error);
    } catch (e) {
      console.error('Supabase products fetch error:', e);
    }
  }

  // Fallback to static file
  return getStaticProducts();
}

export async function getAllProducts(): Promise<ProductCard[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data) return (data as ProductRow[]).map(mapDbProduct);
      console.error('Supabase all products query error:', error);
    } catch (e) {
      console.error('Supabase all products fetch error:', e);
    }
  }
  return getStaticProducts();
}

export async function getProductById(id: string): Promise<ProductCard | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const result = await sb.from('products').select('*').eq('id', id).single();

      if (!result.error && result.data) return mapDbProduct(result.data as ProductRow);
    } catch (e) {
      console.error('Supabase product fetch error:', e);
    }
  }
  const products = getStaticProducts();
  return products.find((p) => p.id === id) || null;
}

export async function upsertProduct(
  product: Partial<ProductCard> & { id: string },
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from('products').upsert(
    {
      id: product.id,
      name: product.name,
      price: product.price,
      original_price: product.originalPrice,
      description: product.description,
      detailed_description: product.detailedDescription,
      image_url: product.imageUrl,
      store_url: product.storeUrl,
      badges: product.badges,
      is_active: product.isActive ?? true,
      sort_order: product.sortOrder ?? 0,
      temperature_zone: product.temperatureZone,
      alcohol_free: product.alcoholFree ?? true,
      variants: product.variants ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('Supabase upsert product error:', error);
    return false;
  }

  // Invalidate cache
  cache.products = null;
  cache.config = null; // system prompt includes products
  return true;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete product error:', error);
    return false;
  }
  cache.products = null;
  cache.config = null;
  return true;
}

// ── Static Fallback ───────────────────────────────────

function getStaticProducts(): ProductCard[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const filePath = path.join(process.cwd(), 'data', 'product-cards.json');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, StaticProduct>;
    return Object.entries(raw).map(([id, p], i) => ({
      id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice || null,
      description: p.description,
      detailedDescription: null,
      imageUrl: p.image,
      storeUrl: p.url,
      badges: p.badges || [],
      isActive: true,
      sortOrder: i,
      temperatureZone: null,
      alcoholFree: !(p.badges ?? []).some((b: string) => b.includes('酒精')),
      variants: [],
    }));
  } catch {
    return [];
  }
}

// ── DB → App Type Mapping ──────────────────────────────

function mapDbProduct(row: ProductRow): ProductCard {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    originalPrice: row.original_price || null,
    description: row.description,
    detailedDescription: row.detailed_description || null,
    imageUrl: row.image_url,
    storeUrl: row.store_url,
    badges: row.badges || [],
    isActive: row.is_active,
    sortOrder: row.sort_order || 0,
    temperatureZone: row.temperature_zone || null,
    alcoholFree: row.alcohol_free ?? true,
    variants: row.variants || [],
  };
}
