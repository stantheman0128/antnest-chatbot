import { NextRequest, NextResponse } from "next/server";
import { getAllProducts, upsertProduct } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

const CYBERBIZ_BASE = "https://antnest.cyberbiz.co";

interface CyberbizProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  variants: Array<{
    price: string;
    compare_at_price: string | null;
  }>;
  images: Array<{ src: string }>;
  tags: string[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function formatPrice(priceStr: string): string {
  const num = parseInt(priceStr, 10);
  if (isNaN(num)) return priceStr;
  return `NT$${num}`;
}

function inferBadges(product: CyberbizProduct, existingBadges: string[]): string[] {
  // Keep existing badges if we have them — they were curated
  if (existingBadges.length > 0) return existingBadges;

  const badges: string[] = [];
  const titleAndTags = (product.title + " " + product.tags.join(" ")).toLowerCase();

  if (titleAndTags.includes("酒精") && !titleAndTags.includes("無酒精")) {
    badges.push("🍷 含酒精");
  } else {
    badges.push("✅ 無酒精");
  }

  return badges;
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  try {
    // 1. Fetch all products from CYBERBIZ
    const collectionRes = await fetch(
      `${CYBERBIZ_BASE}/collections/all.json?limit=250`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 0 } }
    );

    if (!collectionRes.ok) {
      return NextResponse.json(
        { error: `CYBERBIZ API error: ${collectionRes.status}` },
        { status: 502 }
      );
    }

    const collectionData = await collectionRes.json();
    const cyberbizProducts: CyberbizProduct[] = collectionData.products || [];
    const cyberbizHandles = new Set(cyberbizProducts.map((p) => p.handle));

    // 2. Get existing DB products for comparison
    const existingProducts = await getAllProducts();
    const existingMap = new Map(existingProducts.map((p) => [p.id, p]));

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    let deactivated = 0;

    // 3. Upsert products found on CYBERBIZ
    for (const cp of cyberbizProducts) {
      const variant = cp.variants?.[0];
      if (!variant) continue;

      const price = formatPrice(variant.price);
      const originalPrice = variant.compare_at_price
        ? formatPrice(variant.compare_at_price)
        : null;
      const imageUrl = cp.images?.[0]?.src || "";
      const description = stripHtml(cp.body_html).slice(0, 120) || cp.title;
      const storeUrl = `${CYBERBIZ_BASE}/products/${cp.handle}`;

      const existing = existingMap.get(cp.handle);
      const badges = inferBadges(cp, existing?.badges || []);

      const isNew = !existing;
      const priceChanged = existing && existing.price !== price;
      const imageChanged = existing && existing.imageUrl !== imageUrl;

      if (!isNew && !priceChanged && !imageChanged) {
        // Still mark as active if it was deactivated
        if (existing && !existing.isActive) {
          await upsertProduct({ ...existing, isActive: true });
          updated++;
        } else {
          unchanged++;
        }
        continue;
      }

      await upsertProduct({
        id: cp.handle,
        name: cp.title,
        price,
        originalPrice,
        description,
        detailedDescription: existing?.detailedDescription || null,
        imageUrl,
        storeUrl,
        badges,
        isActive: true,
        sortOrder: existing?.sortOrder ?? existingProducts.length + added,
        temperatureZone: existing?.temperatureZone || null,
        alcoholFree: existing?.alcoholFree ?? true,
      });

      if (isNew) added++;
      else updated++;
    }

    // 4. Deactivate DB products no longer on CYBERBIZ
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
