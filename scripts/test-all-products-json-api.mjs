/**
 * Test JSON API photo_urls across all product handles.
 * Usage: node scripts/test-all-products-json-api.mjs
 */

const BASE = 'https://antnest.cyberbiz.co';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Step 1: get all handles from sitemap
console.log('Fetching sitemap...');
const sitemapRes = await fetch(`${BASE}/sitemap.xml`, { headers: { 'User-Agent': UA } });
const xml = await sitemapRes.text();
const handles = [...new Set([...xml.matchAll(/\/products\/([^<\s"']+)/g)].map((m) => m[1]))].filter(
  (h) => !h.includes('.') && h.length > 2,
); // exclude .xml, .atom, etc

console.log(`Found ${handles.length} handles\n`);

// Step 2: test each handle
const results = [];
for (const handle of handles) {
  const jsonRes = await fetch(`${BASE}/products/${handle}.json`, { headers: { 'User-Agent': UA } });
  if (!jsonRes.ok) {
    results.push({ handle, ok: false, reason: `HTTP ${jsonRes.status}` });
    continue;
  }
  const data = await jsonRes.json();
  const photo = data?.photo_urls?.[0];
  const maximum = photo?.maximum ? `https:${photo.maximum}` : null;
  const grande = photo?.grande ? `https:${photo.grande}` : null;
  const original = photo?.original ? `https:${photo.original}` : null;

  results.push({
    handle,
    ok: !!maximum,
    maximum: maximum ?? '❌',
    grande: grande ?? '❌',
    original: original ?? '❌',
  });

  const status = maximum ? '✅' : '❌';
  console.log(`${status} ${handle}`);
  if (!maximum)
    console.log(`   photo_urls[0] keys: ${photo ? Object.keys(photo).join(', ') : '(none)'}`);
}

// Summary
const ok = results.filter((r) => r.ok).length;
const fail = results.filter((r) => !r.ok).length;
console.log(`\n─── Summary ───`);
console.log(`✅ ${ok} / ${results.length} have photo_urls[0].maximum`);
if (fail > 0) {
  console.log(`❌ Failed handles:`);
  results
    .filter((r) => !r.ok)
    .forEach((r) => console.log(`   ${r.handle}: ${r.reason ?? 'no maximum key'}`));
}

// Show a few sample URLs for size inspection
console.log('\n─── Sample URLs ───');
results
  .filter((r) => r.ok)
  .slice(0, 3)
  .forEach((r) => {
    console.log(`\n${r.handle}:`);
    console.log(`  grande   (600×600):  ${r.grande}`);
    console.log(`  original (1024×1024):${r.original}`);
    console.log(`  maximum  (2048×2048):${r.maximum}`);
  });
