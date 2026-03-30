import { NextRequest, NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/admin-auth';
import { ProductVariant, getAllProducts, getProductById, upsertProduct } from '@/lib/data-service';
import { StructuredDescription, serializeDescription } from '@/lib/product-description';

const CYBERBIZ_BASE = 'https://antnest.cyberbiz.co';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// ── Cyberbiz JSON API types ──────────────────────────

interface CyberbizPhotoUrl {
  grande?: string;
  original?: string;
  maximum?: string;
}

interface CyberbizPhotoEntry {
  photo?: { id?: number; position?: number };
}

interface CyberbizVariant {
  title?: string;
  option1?: string;
  price?: number;
  compare_at_price?: number | null;
  available?: boolean;
  photos?: Array<{ id?: number }>;
}

interface CyberbizDescription {
  setting_name?: string;
  body_html?: string;
}

interface CyberbizProductJson {
  body_html?: string;
  photo_urls?: CyberbizPhotoUrl[];
  photos?: CyberbizPhotoEntry[];
  variants?: CyberbizVariant[];
  other_descriptions?: CyberbizDescription[];
}

interface CyberbizC12tData {
  impressions?: Array<{ id?: string }>;
}

interface JsonLdProduct {
  '@type'?: string;
  name?: string;
  description?: string;
  image?: string;
  offers?: {
    price?: string;
    url?: string;
    availability?: string;
  };
}

/** Extract product handles from sitemap.xml + window.c12t analytics data in collections page */
async function getProductHandles(): Promise<string[]> {
  const handles = new Set<string>();

  // Source 1: sitemap.xml
  try {
    const res = await fetch(`${CYBERBIZ_BASE}/sitemap.xml`, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const xml = await res.text();
      for (const m of xml.matchAll(/\/products\/([^<\s"']+)/g)) {
        handles.add(m[1]);
      }
    }
  } catch {
    /* ignore */
  }

  // Source 2: /collections/all.json — contains window.c12t.impressions with all product handles
  try {
    const res = await fetch(`${CYBERBIZ_BASE}/collections/all.json?limit=250`, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 0 },
    });
    if (res.ok) {
      const html = await res.text();
      // Extract from window.c12t.impressions: handles appear as "id":"handle" entries
      const c12tMatch = html.match(/window\.c12t\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
      if (c12tMatch) {
        try {
          const data = JSON.parse(c12tMatch[1]) as CyberbizC12tData;
          const impressions = data?.impressions || [];
          for (const item of impressions) {
            if (item?.id) handles.add(String(item.id));
          }
        } catch {
          /* parse failed, fall through to regex */
        }
      }
      // Fallback: any /products/xxx pattern in the page
      for (const m of html.matchAll(/\/products\/([a-z0-9][a-z0-9-]*[a-z0-9])/g)) {
        handles.add(m[1]);
      }
    }
  } catch {
    /* ignore */
  }

  return [...handles];
}

interface ScrapedProduct {
  name: string;
  price: string;
  originalPrice: string | null;
  description: string;
  detailedDescription: string | null;
  imageUrl: string;
  storeUrl: string;
  inStock: boolean;
  titleForBadge: string;
  variants: ProductVariant[];
}

/** Strip HTML tags and collapse whitespace */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|ul|ol|div|h[1-6]|section)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split spec section text into sub-fields by detecting common headers */
function parseSpecSection(text: string): {
  specs: string;
  storage: string;
  shelfLife: string;
  usage: string;
} {
  const result = { specs: '', storage: '', shelfLife: '', usage: '' };

  const headers: Array<{ key: keyof typeof result; pattern: RegExp }> = [
    { key: 'storage', pattern: /保存方式|保存方法/ },
    { key: 'shelfLife', pattern: /保存期限|賞味期限/ },
    { key: 'usage', pattern: /食用方式|食用方法|享用方式/ },
  ];

  // Find all header positions
  const matches: Array<{ key: keyof typeof result; start: number; headerEnd: number }> = [];
  for (const { key, pattern } of headers) {
    const m = text.match(pattern);
    if (m && m.index !== undefined) {
      matches.push({ key, start: m.index, headerEnd: m.index + m[0].length });
    }
  }

  if (matches.length === 0) {
    result.specs = text.replace(/^-+\s*/gm, '').trim();
    return result;
  }

  matches.sort((a, b) => a.start - b.start);

  // Content before first header → specs (e.g. box dimensions)
  const beforeFirst = text
    .substring(0, matches[0].start)
    .replace(/^-+\s*/gm, '')
    .replace(/-+\s*$/gm, '')
    .trim();
  if (beforeFirst) result.specs = beforeFirst;

  // Extract content between consecutive headers
  for (let i = 0; i < matches.length; i++) {
    const end = i + 1 < matches.length ? matches[i + 1].start : text.length;
    const content = text
      .substring(matches[i].headerEnd, end)
      .replace(/^-+\s*/gm, '')
      .replace(/-+\s*$/gm, '')
      .trim();
    if (content) result[matches[i].key] = content;
  }

  return result;
}

/** Build structured v2 JSON description from Cyberbiz JSON API data */
function buildDetailedDescription(jsonData: CyberbizProductJson): string | null {
  const desc: StructuredDescription = {
    v: 2,
    intro: '',
    specs: '',
    storage: '',
    shelfLife: '',
    usage: '',
  };

  // 1. Product intro from body_html
  const bodyHtml: string = jsonData?.body_html || '';
  if (bodyHtml) {
    const bodyText = stripHtml(bodyHtml);
    const sepIdx = bodyText.indexOf('---');
    desc.intro =
      sepIdx > 0 ? bodyText.substring(0, sepIdx).trim() : bodyText.substring(0, 200).trim();
  }

  // 2. Parse spec section into sub-fields
  const otherDescs = jsonData?.other_descriptions || [];
  const specSection = otherDescs.find(
    (d) => d.setting_name === 'product_description_section_spec',
  );
  if (specSection?.body_html) {
    const specText = stripHtml(specSection.body_html);
    const parsed = parseSpecSection(specText);
    desc.specs = parsed.specs;
    desc.storage = parsed.storage;
    desc.shelfLife = parsed.shelfLife;
    desc.usage = parsed.usage;
  }

  return serializeDescription(desc);
}

/** Scrape a single product: JSON-LD for metadata, JSON API for image */
async function scrapeProduct(handle: string): Promise<ScrapedProduct | null> {
  try {
    const [htmlRes, jsonRes] = await Promise.all([
      fetch(`${CYBERBIZ_BASE}/products/${handle}`, {
        headers: { 'User-Agent': UA },
        next: { revalidate: 0 },
      }),
      fetch(`${CYBERBIZ_BASE}/products/${handle}.json`, {
        headers: { 'User-Agent': UA },
        next: { revalidate: 0 },
      }),
    ]);
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();

    // Extract JSON-LD for metadata
    const ldMatch = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/);
    if (!ldMatch) return null;

    let ld: JsonLdProduct;
    try {
      ld = JSON.parse(ldMatch[1]) as JsonLdProduct;
    } catch {
      return null;
    }

    if (ld['@type'] !== 'Product') return null;

    // Parse JSON API for images + variants
    let imageUrl = '';
    let variants: ProductVariant[] = [];
    let jsonData: CyberbizProductJson | null = null;

    if (jsonRes.ok) {
      try {
        jsonData = (await jsonRes.json()) as CyberbizProductJson;

        // Main product image
        const photo = jsonData?.photo_urls?.[0];
        if (photo?.grande) imageUrl = `https:${photo.grande}`;
        else if (photo?.original) imageUrl = `https:${photo.original}`;
        else if (photo?.maximum) imageUrl = `https:${photo.maximum}`;

        // Build photo ID → position map for variant photo resolution
        const photoPositionMap = new Map<number, number>();
        for (const p of jsonData?.photos || []) {
          if (p?.photo?.id && p?.photo?.position) {
            photoPositionMap.set(p.photo.id, p.photo.position);
          }
        }
        const photoUrls: CyberbizPhotoUrl[] = jsonData?.photo_urls || [];

        // Parse variants
        const rawVariants: CyberbizVariant[] = jsonData?.variants || [];
        if (rawVariants.length > 1 || (rawVariants.length === 1 && rawVariants[0]?.option1)) {
          variants = rawVariants.map((v) => {
            // Resolve variant-specific photo
            let variantImage: string | null = null;
            if (v.photos && v.photos.length > 0) {
              const photoId = v.photos[0]?.id;
              const position = photoId !== undefined ? photoPositionMap.get(photoId) : undefined;
              if (position && position <= photoUrls.length && photoUrls[position - 1]) {
                const pu = photoUrls[position - 1];
                variantImage = pu.grande
                  ? `https:${pu.grande}`
                  : pu.original
                    ? `https:${pu.original}`
                    : null;
              }
            }
            return {
              title: v.title || v.option1 || '',
              option1: v.option1 || null,
              price: v.price || 0,
              compareAtPrice: v.compare_at_price || null,
              available: v.available ?? false,
              imageUrl: variantImage,
            };
          });
        }
      } catch {
        /* fall through */
      }
    }

    // Fallback to og:image if JSON API unavailable
    if (!imageUrl) {
      const ogMatch =
        html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
        html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
      imageUrl = ogMatch?.[1] ?? (ld.image || '');
    }

    // Price: range if multiple variants with different prices, else single
    let price = '';
    if (variants.length > 1) {
      const prices = variants.map((v) => v.price).filter((p) => p > 0);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      price = min === max ? `NT$${min}` : `NT$${min} ~ NT$${max}`;
    } else {
      price = ld.offers?.price ? `NT$${Math.round(parseFloat(ld.offers.price))}` : '';
    }

    // Build detailed description from JSON API data (body_html + other_descriptions)
    const detailedDescription = jsonData ? buildDetailedDescription(jsonData) : null;

    return {
      name: ld.name || handle,
      price,
      originalPrice: null,
      description: (ld.description || '').slice(0, 120),
      detailedDescription,
      imageUrl,
      storeUrl: ld.offers?.url || `${CYBERBIZ_BASE}/products/${handle}`,
      inStock: ld.offers?.availability?.includes('InStock') ?? true,
      titleForBadge: ld.name || '',
      variants,
    };
  } catch {
    return null;
  }
}

function inferBadges(titleForBadge: string, existingBadges: string[]): string[] {
  if (existingBadges.length > 0) return existingBadges;
  const t = titleForBadge.toLowerCase();
  if (t.includes('酒精') && !t.includes('無酒精')) return ['🍷 含酒精'];
  return ['✅ 無酒精'];
}

export async function POST(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  try {
    const handles = await getProductHandles();
    if (handles.length === 0) {
      return NextResponse.json({ error: 'No products found in sitemap' }, { status: 502 });
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
        detailedDescription: scraped.detailedDescription || existing?.detailedDescription || null,
        imageUrl: scraped.imageUrl || existing?.imageUrl || '',
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
    console.error('Scrape error:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}

/** PUT /api/admin/scrape — sync a single product by handle */
export async function PUT(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  try {
    const { handle } = (await req.json()) as { handle: string };
    if (!handle || typeof handle !== 'string') {
      return NextResponse.json({ error: 'handle is required' }, { status: 400 });
    }

    const scraped = await scrapeProduct(handle);
    if (!scraped || !scraped.price) {
      return NextResponse.json({ error: 'Product not found on Cyberbiz' }, { status: 404 });
    }

    const existing = await getProductById(handle);
    const badges = inferBadges(scraped.titleForBadge, existing?.badges || []);

    await upsertProduct({
      id: handle,
      name: scraped.name,
      price: scraped.price,
      originalPrice: existing?.originalPrice ?? scraped.originalPrice,
      description: scraped.description || existing?.description || scraped.name,
      detailedDescription: scraped.detailedDescription || existing?.detailedDescription || null,
      imageUrl: scraped.imageUrl || existing?.imageUrl || '',
      storeUrl: scraped.storeUrl,
      badges,
      isActive: existing?.isActive ?? true,
      sortOrder: existing?.sortOrder ?? 0,
      temperatureZone: existing?.temperatureZone || null,
      alcoholFree: existing?.alcoholFree ?? true,
      variants: scraped.variants,
    });

    return NextResponse.json({ success: true, product: scraped.name });
  } catch (error) {
    console.error('Single product scrape error:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
