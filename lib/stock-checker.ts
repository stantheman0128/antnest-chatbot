import { getActiveProducts, getConfig, setConfig, upsertProduct } from './data-service';

const CYBERBIZ_BASE = 'https://antnest.cyberbiz.co';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const STOCK_TTL = 30 * 60 * 1000; // 30 minutes

const STOCK_KEYWORDS = [
  '有貨',
  '還有嗎',
  '售完',
  '賣完',
  '有沒有',
  '還有沒有',
  '缺貨',
  '庫存',
  '補貨',
  '買得到',
  '能買',
  '還能買',
  '有現貨',
  '還剩',
  '剩幾',
  '買不到',
  '沒有了',
];

/** Check if the user message is asking about stock/availability */
export function isStockQuery(message: string): boolean {
  return STOCK_KEYWORDS.some((kw) => message.includes(kw));
}

/** Fetch variant availability for a single product from CYBERBIZ JSON API */
async function fetchVariantAvailability(
  handle: string,
): Promise<{ title: string; available: boolean }[] | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${CYBERBIZ_BASE}/products/${handle}.json`, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = (await res.json()) as {
      variants?: Array<{ title?: string; option1?: string; available?: boolean }>;
    };

    const variants = data?.variants || [];
    return variants.map((v) => ({
      title: v.title || v.option1 || '',
      available: v.available ?? false,
    }));
  } catch {
    return null;
  }
}

/**
 * Refresh stock data if stale (older than 30 min).
 * Returns true if any stock was updated.
 */
export async function refreshStockIfStale(): Promise<boolean> {
  // Check last refresh time
  const lastChecked = await getConfig('stock_last_checked');
  if (lastChecked && Date.now() - parseInt(lastChecked) < STOCK_TTL) {
    return false; // Still fresh
  }

  const products = await getActiveProducts();
  if (products.length === 0) return false;

  // Fetch all products in parallel
  const results = await Promise.allSettled(
    products.map(async (product) => {
      const freshAvail = await fetchVariantAvailability(product.id);
      if (!freshAvail || freshAvail.length === 0) return false;

      // Check if any variant availability changed
      let changed = false;
      const updatedVariants = product.variants.map((v) => {
        const match = freshAvail.find((f) => f.title === v.title || f.title === v.option1);
        if (match && match.available !== v.available) {
          changed = true;
          return { ...v, available: match.available };
        }
        return v;
      });

      if (changed) {
        await upsertProduct({ ...product, variants: updatedVariants });
        console.log(`Stock updated: ${product.id}`);
      }
      return changed;
    }),
  );

  // Update timestamp regardless of whether anything changed
  await setConfig('stock_last_checked', Date.now().toString());

  return results.some((r) => r.status === 'fulfilled' && r.value === true);
}
