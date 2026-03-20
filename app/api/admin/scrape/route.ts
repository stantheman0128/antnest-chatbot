import { NextRequest, NextResponse } from "next/server";
import { getAllProducts, upsertProduct, ProductVariant } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

const CYBERBIZ_BASE = "https://antnest.cyberbiz.co";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/** Extract product handles from sitemap.xml + window.c12t analytics data in collections page */
async function getProductHandles(): Promise<string[]> {
  const handles = new Set<string>();

  // Source 1: sitemap.xml
  try {
    const res = await fetch(`${CYBERBIZ_BASE}/sitemap.xml`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const xml = await res.text();
      for (const m of xml.matchAll(/\/products\/([^<\s"']+)/g)) {
        handles.add(m[1]);
      }
    }
  } catch { /* ignore */ }

  // Source 2: /collections/all.json — contains window.c12t.impressions with all product handles
  try {
    const res = await fetch(`${CYBERBIZ_BASE}/collections/all.json?limit=250`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const html = await res.text();
      // Extract from window.c12t.impressions: handles appear as "id":"handle" entries
      const c12tMatch = html.match(/window\.c12t\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (c12tMatch) {
        try {
          const data = JSON.parse(c12tMatch[1]);
          const impressions: any[] = data?.impressions || [];
          for (const item of impressions) {
            if (item?.id) handles.add(String(item.id));
          }
        } catch { /* parse failed, fall through to regex */ }
      }
      // Fallback: any /products/xxx pattern in the page
      for (const m of html.matchAll(/\/products\/([a-z0-9][a-z0-9\-]*[a-z0-9])/g)) {
        handles.add(m[1]);
      }
    }
  } catch { /* ignore */ }

  return [...handles];
}

interface ScrapedProduct {
  name: string;
  price: string;
  originalPrice: string | null;
  description: string;
  imageUrl: string;
  storeUrl: string;
  inStock: boolean;
  titleForBadge: string;
  variants: ProductVariant[];
}

/** Scrape a single product: JSON-LD for metadata, JSON API for image */
async function scrapeProduct(handle: string): Promise<ScrapedProduct | null> {
  try {
    const [htmlRes, jsonRes] = await Promise.all([
      fetch(`${CYBERBIZ_BASE}/products/${handle}`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 0 },
      }),
      fetch(`${CYBERBIZ_BASE}/products/${handle}.json`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 0 },
      }),
    ]);
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();

    // Extract JSON-LD for metadata
    const ldMatch = html.match(
      /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/
    );
    if (!ldMatch) return null;

    let ld: any;
    try {
      ld = JSON.parse(ldMatch[1]);
    } catch {
      return null;
    }

    if (ld["@type"] !== "Product") return null;

    // Parse JSON API for images + variants
    let imageUrl = "";
    let variants: ProductVariant[] = [];
    let jsonData: any = null;

    if (jsonRes.ok) {
      try {
        jsonData = await jsonRes.json();

        // Main product image
        const photo = jsonData?.photo_urls?.[0];
        if (photo?.grande)   imageUrl = `https:${photo.grande}`;
        else if (photo?.original) imageUrl = `https:${photo.original}`;
        else if (photo?.maximum)  imageUrl = `https:${photo.maximum}`;

        // Build photo ID → position map for variant photo resolution
        const photoPositionMap = new Map<number, number>();
        for (const p of jsonData?.photos || []) {
          if (p?.photo?.id && p?.photo?.position) {
            photoPositionMap.set(p.photo.id, p.photo.position);
          }
        }
        const photoUrls: any[] = jsonData?.photo_urls || [];

        // Parse variants
        const rawVariants: any[] = jsonData?.variants || [];
        if (rawVariants.length > 1 || (rawVariants.length === 1 && rawVariants[0]?.option1)) {
          variants = rawVariants.map((v: any) => {
            // Resolve variant-specific photo
            let variantImage: string | null = null;
            if (v.photos?.length > 0) {
              const photoId = v.photos[0]?.id;
              const position = photoPositionMap.get(photoId);
              if (position && position <= photoUrls.length && photoUrls[position - 1]) {
                const pu = photoUrls[position - 1];
                variantImage = pu.grande ? `https:${pu.grande}`
                  : pu.original ? `https:${pu.original}` : null;
              }
            }
            return {
              title: v.title || v.option1 || "",
              option1: v.option1 || null,
              price: v.price || 0,
              compareAtPrice: v.compare_at_price || null,
              available: v.available ?? false,
              imageUrl: variantImage,
            };
          });
        }
      } catch { /* fall through */ }
    }

    // Fallback to og:image if JSON API unavailable
    if (!imageUrl) {
      const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
                   || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
      imageUrl = ogMatch?.[1] ?? (ld.image || "");
    }

    // Price: range if multiple variants with different prices, else single
    let price = "";
    if (variants.length > 1) {
      const prices = variants.map((v) => v.price).filter((p) => p > 0);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      price = min === max ? `NT$${min}` : `NT$${min} ~ NT$${max}`;
    } else {
      price = ld.offers?.price
        ? `NT$${Math.round(parseFloat(ld.offers.price))}`
        : "";
    }

    return {
      name: ld.name || handle,
      price,
      originalPrice: null,
      description: (ld.description || "").slice(0, 120),
      imageUrl,
      storeUrl: ld.offers?.url || `${CYBERBIZ_BASE}/products/${handle}`,
      inStock: ld.offers?.availability?.includes("InStock") ?? true,
      titleForBadge: ld.name || "",
      variants,
    };
  } catch {
    return null;
  }
}

function inferBadges(titleForBadge: string, existingBadges: string[]): string[] {
  if (existingBadges.length > 0) return existingBadges;
  const t = titleForBadge.toLowerCase();
  if (t.includes("酒精") && !t.includes("無酒精")) return ["🍷 含酒精"];
  return ["✅ 無酒精"];
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  try {
    const handles = await getProductHandles();
    if (handles.length === 0) {
      return NextResponse.json({ error: "No products found in sitemap" }, { status: 502 });
    }

    const existingProducts = await getAllProducts();
    const existingMap = new Map(existingProducts.map((p) => [p.id, p]));
    const cyberbizHandles = new Set(handles);

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let deactivated = 0;

    for (const handle of handles) {
      const scraped = await scrapeProduct(handle);
      if (!scraped || !scraped.price) continue;

      const existing = existingMap.get(handle);
      const badges = inferBadges(scraped.titleForBadge, existing?.badges || []);

      const isNew = !existing;
      const changed =
        !existing ||
        existing.price !== scraped.price ||
        existing.imageUrl !== scraped.imageUrl ||
        !existing.isActive ||
        JSON.stringify(existing.variants) !== JSON.stringify(scraped.variants);

      if (!changed) {
        unchanged++;
        continue;
      }

      await upsertProduct({
        id: handle,
        name: scraped.name,
        price: scraped.price,
        originalPrice: existing?.originalPrice ?? scraped.originalPrice,
        description: scraped.description || existing?.description || scraped.name,
        detailedDescription: existing?.detailedDescription || null,
        imageUrl: scraped.imageUrl || existing?.imageUrl || "",
        storeUrl: scraped.storeUrl,
        badges,
        isActive: true,
        sortOrder: existing?.sortOrder ?? existingProducts.length + added,
        temperatureZone: existing?.temperatureZone || null,
        alcoholFree: existing?.alcoholFree ?? true,
        variants: scraped.variants,
      });

      if (isNew) added++;
      else updated++;
    }

    // Deactivate DB products no longer on CYBERBIZ
    for (const existing of existingProducts) {
      if (!cyberbizHandles.has(existing.id) && existing.isActive) {
        await upsertProduct({ ...existing, isActive: false });
        deactivated++;
      }
    }

    return NextResponse.json({ added, updated, unchanged, deactivated });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json({ error: "Scrape failed" }, { status: 500 });
  }
}
