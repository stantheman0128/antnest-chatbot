// Shared cache infrastructure — no type imports to avoid circular deps

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL;
}

// Centralized cache store — each module reads/writes its own key
// Using `any` intentionally to avoid circular type imports
export const cache: Record<string, CacheEntry<any> | null> = {
  products: null,
  config: null,
  examples: null,
  stats: null,
};

export function invalidateAllCaches() {
  for (const key of Object.keys(cache)) cache[key] = null;
}
