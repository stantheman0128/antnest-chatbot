import { NextRequest, NextResponse } from 'next/server';

import { verifyAdmin } from '@/lib/admin-auth';
import { runProductSync, syncSingleProduct } from '@/lib/product-sync';

// Allow up to 60s on Vercel Pro; free plan caps at 10s but scrape is fire-and-forget
export const maxDuration = 60;

/** POST /api/admin/scrape — full catalog sync from Cyberbiz */
export async function POST(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  try {
    const result = await runProductSync();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { added, updated, unchanged, deactivated } = result;
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

    const result = await syncSingleProduct(handle);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, product: result.product });
  } catch (error) {
    console.error('Single product scrape error:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
