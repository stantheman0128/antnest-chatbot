import { NextRequest, NextResponse } from "next/server";
import { getAllProducts, upsertProduct } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

const CYBERBIZ_BASE = "https://antnest.cyberbiz.co";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

/** Extract product handles from sitemap.xml + /collections/all (catches products missing from sitemap) */
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
  } catch { /* ignore, fall through to collection page */ }

  // Source 2: /collections/all — catches products not yet in sitemap
  try {
    const res = await fetch(`${CYBERBIZ_BASE}/collections/all`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const html = await res.text();
      for (const m of html.matchAll(/\/products\/([^"'?\s/]+)/g)) {
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
}

/** Scrape a single product page, extract JSON-LD + large image */
async function scrapeProduct(handle: string): Promise<ScrapedProduct | null> {
  try {
    const res = await fetch(`${CYBERBIZ_BASE}/products/${handle}`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract JSON-LD
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

    // Extract cdn-next large image (2048x2048) from page HTML
    const imgMatch = html.match(
      /https:\/\/cdn-next\.cybassets\.com\/media\/[^"'\s]+2048x2048[^"'\s]*/
    );
    const imageUrl = imgMatch
      ? imgMatch[0]
      : (ld.image || "");

    const price = ld.offers?.price
      ? `NT$${Math.round(parseFloat(ld.offers.price))}`
      : "";

    return {
      name: ld.name || handle,
      price,
      originalPrice: null, // JSON-LD doesn't expose compare-at price
      description: (ld.description || "").slice(0, 120),
      imageUrl,
      storeUrl: ld.offers?.url || `${CYBERBIZ_BASE}/products/${handle}`,
      inStock: ld.offers?.availability?.includes("InStock") ?? true,
      titleForBadge: ld.name || "",
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
        !existing.isActive;

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
