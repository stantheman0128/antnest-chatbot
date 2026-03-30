/**
 * Quick test script — compare image URL extraction strategies.
 * Usage: node scripts/test-image-scrape.mjs [product-handle]
 * Output: scripts/image-test-result.html
 */
import { writeFileSync } from 'fs';

const BASE = 'https://antnest.cyberbiz.co';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const handle = process.argv[2] || 'classic-tiramisu';

console.log(`Fetching HTML: ${BASE}/products/${handle}`);
const [htmlRes, jsonRes] = await Promise.all([
  fetch(`${BASE}/products/${handle}`, { headers: { 'User-Agent': UA } }),
  fetch(`${BASE}/products/${handle}.json`, { headers: { 'User-Agent': UA } }),
]);

if (!htmlRes.ok) {
  console.error(`HTML HTTP ${htmlRes.status}`);
  process.exit(1);
}
const html = await htmlRes.text();
const jsonData = jsonRes.ok ? await jsonRes.json() : null;

// ─── Method A: cdn-next + 2048x2048 (現有邏輯) ───────────────────────────────
const matchA = html.match(/https:\/\/cdn-next\.cybassets\.com\/media\/[^"'\s]+2048x2048[^"'\s]*/);
const urlA = matchA?.[0] ?? null;

// ─── Method B: og:image meta tag ─────────────────────────────────────────────
const matchB =
  html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) ||
  html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
const urlB = matchB?.[1] ?? null;

// ─── Method C: cdn 600x600+ (擴大 regex) ─────────────────────────────────────
const matchC = html.match(
  /https:\/\/cdn(?:-next)?\.cybassets\.com\/media\/[^"'\s]+(?:2048x2048|1200x1200|600x600)[^"'\s]*/,
);
const urlC = matchC?.[0] ?? null;

// ─── Method D: JSON API photo_urls[0].maximum ────────────────────────────────
const photoUrls = jsonData?.photo_urls?.[0];
const urlD_max = photoUrls?.maximum ? `https:${photoUrls.maximum}` : null;
const urlD_orig = photoUrls?.original ? `https:${photoUrls.original}` : null;
const urlD_grande = photoUrls?.grande ? `https:${photoUrls.grande}` : null;

// ─── Current bad fallback: JSON-LD ───────────────────────────────────────────
const ldRaw = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/);
let urlLD = null;
try {
  urlLD = JSON.parse(ldRaw?.[1] ?? 'null')?.image ?? null;
} catch {
  // parse failed
}

// ─── Console summary ─────────────────────────────────────────────────────────
console.log('\n─── 結果 ───────────────────────────────────────────');
console.log('A  cdn-next 2048×2048:    ', urlA ?? '❌ no match');
console.log('B  og:image meta:         ', urlB ?? '❌ no match');
console.log('C  cdn 600×600+ regex:    ', urlC ?? '❌ no match');
console.log('D  JSON API maximum:      ', urlD_max ?? '❌');
console.log('D  JSON API original:     ', urlD_orig ?? '❌');
console.log('D  JSON API grande:       ', urlD_grande ?? '❌');
console.log('現有 fallback (JSON-LD):  ', urlLD ?? '❌ no match');

// ─── HTML visual report ───────────────────────────────────────────────────────
const card = (label, url, badge = '') => `
  <div style="flex:1;min-width:240px;max-width:300px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-family:sans-serif;background:#fff">
    <div style="background:#f9fafb;padding:10px 14px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px">
      <strong style="font-size:13px;flex:1">${label}</strong>
      ${badge ? `<span style="font-size:11px;padding:2px 7px;border-radius:20px;background:${badge.includes('✅') ? '#dcfce7' : badge.includes('⚠') ? '#fef9c3' : '#fee2e2'};color:#333">${badge}</span>` : ''}
    </div>
    ${
      url
        ? `<img src="${url}" style="width:100%;display:block;aspect-ratio:1;object-fit:cover"
             onerror="this.outerHTML='<div style=\\'aspect-ratio:1;background:#fee2e2;display:flex;align-items:center;justify-content:center;font-size:12px;color:#dc2626;padding:8px\\'>載入失敗</div>'" />`
        : `<div style="aspect-ratio:1;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px">no match</div>`
    }
    <div style="padding:8px 12px;word-break:break-all;font-size:10px;color:#6b7280;max-height:70px;overflow:auto;line-height:1.4">
      ${url ?? '—'}
    </div>
  </div>`;

const report = `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="UTF-8"/>
<title>Image Test — ${handle}</title>
</head><body style="margin:24px;background:#f8fafc">
  <h2 style="font-family:sans-serif;margin-bottom:4px">圖片抓取方式比較</h2>
  <p style="font-family:sans-serif;font-size:13px;color:#6b7280;margin-bottom:20px">
    產品：<code>${handle}</code> &nbsp;·&nbsp;
    <a href="${BASE}/products/${handle}" target="_blank">${BASE}/products/${handle}</a>
  </p>

  <h3 style="font-family:sans-serif;font-size:13px;color:#374151;margin-bottom:12px">HTML Scraping 方法</h3>
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-bottom:24px">
    ${card("A — cdn-next 2048×2048<br><small style='color:#9ca3af'>現有邏輯</small>", urlA, urlA ? '✅ 有抓到' : '❌ 沒 match')}
    ${card('B — og:image meta tag', urlB, urlB ? '✅ 有抓到' : '❌ 沒 match')}
    ${card('C — cdn 600×600+ regex', urlC, urlC ? '✅ 有抓到' : '❌ 沒 match')}
    ${card("現有 fallback<br><small style='color:#9ca3af'>JSON-LD image（壞的）</small>", urlLD, '⚠ 32×32')}
  </div>

  <h3 style="font-family:sans-serif;font-size:13px;color:#374151;margin-bottom:12px">JSON API 方法（新發現）</h3>
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
    ${card("D — JSON API<br><small style='color:#9ca3af'>maximum (2048×2048)</small>", urlD_max, urlD_max ? '✅ 2048×2048' : '❌')}
    ${card("D — JSON API<br><small style='color:#9ca3af'>original (1024×1024)</small>", urlD_orig, urlD_orig ? '✅ 1024×1024' : '❌')}
    ${card("D — JSON API<br><small style='color:#9ca3af'>grande (600×600)</small>", urlD_grande, urlD_grande ? '✅ 600×600' : '❌')}
  </div>
</body></html>`;

const out = 'scripts/image-test-result.html';
writeFileSync(out, report);
console.log(`\n✅ 輸出到 ${out}`);
