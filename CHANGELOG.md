# Changelog

## 1.0.8 — 2026-07-02

拆分 LINE webhook route:handler 抽成獨立模組,route.ts 只留簽章驗證與分派。

- `app/api/line/webhook/route.ts` 由 839 行縮到 57 行,只保留 `POST`(簽章驗證 + dedup + event 分派)。
- handler 移到 `app/api/line/webhook/handlers/`:`shared.ts`(LINE client、sendMessages、profile、啟用狀態、dedup、pickup 訊息builder)、`text-message.ts`(`handleTextMessage`)、`postback.ts`(`handlePostback` 與日期/時間/時段子handler)。
- 純搬移,行為零變動;禁區 lib 只 import 不改,API contract 不動。特徵測試 25 個仍全綠、`tsc --noEmit` 與 `next build` 皆過。
- 順帶修掉 1.0.7 測試檔的 mock 型別(spread 參數缺 rest target),讓 `tsc` 乾淨。

## 1.0.7 — 2026-07-02

建立測試基建,為 LINE webhook 現有行為補上特徵測試。

- 加入 `vitest`(devDependency `^4.1.9`)與 `npm test`(`vitest run`)。`vitest.config.ts` 內容與 `security/audit-fixes-2026-07-02` 分支逐位元組一致,合併時 add/add 可自動解決。
- 新增 `tests/line-webhook.test.ts`:針對 `app/api/line/webhook/route.ts` 的簽章驗證、事件分派(dedup、event type)、代表性文字/postback handler 行為寫特徵測試,外部依賴(LINE SDK、Supabase 資料層、AI client)全 mock。25 個測試綠。
- 以突變測試(mutation test)確認測試會咬:蓄意破壞簽章拒絕與 handoff 文案,對應測試如期轉紅。route.ts 行為零修改,僅為後續重構鋪安全網。

## 1.0.6 — 2026-07-02

整頓 repo 根目錄:一次性爬蟲腳本歸檔。

- 根目錄 7 個 Python 資料前處理腳本(`scraper.py`、`get_image_urls.py`、`dedup_images.py`、`check_duplicates.py`、`build_image_md.py`、`rename_images.py`、`rename_for_url.py`)與 `product_image_urls.json` 移入 `scripts/scraping/`,附 README 說明用途與執行方式。
- 這批檔案本來就被 `.gitignore` 刻意排除(`*.py`),維持不納版控,僅 README 進版控供導覽。
- 腳本內容零修改,仍以 repo 根目錄為工作目錄執行。
- 註:1.0.1–1.0.5 為 `security/audit-fixes-2026-07-02` 分支的安全修正,尚未合併進 main;本檔以該分支 CHANGELOG 為基底往上疊,合併時取本分支版本即可。

## 1.0.5 — 2026-07-02

修正 cron 同步失敗時 HTTP 仍回 200 的回歸(對抗式複查發現)。

- `/api/cron/sync` 依 `runProductSync()` 的 `result.ok` 分流:失敗時回實際狀態碼(如 502),不再一律 200,讓 QStash/監控能正確判斷。此為 1.0.3 抽 `product-sync` 時漏掉的狀態轉發。

## 1.0.4 — 2026-07-02

安全強化:公開的 `/api/chat` 加限流與長度上限,壓制 LLM 成本濫用。

- 每 IP 限流(每分鐘 20 次)、`message` 上限 2000 字、`history` 截到最近 20 筆。
- 避免匿名高頻 + 超長 payload 灌爆付費 LLM 呼叫與 60 秒函式時間。

## 1.0.3 — 2026-07-02

安全修正:移除 admin 萬用金鑰後門,cron 不再自打 HTTP。

- 抽出 `lib/product-sync.ts`(`runProductSync` / `syncSingleProduct`),`/api/admin/scrape` 變薄殼、`/api/cron/sync` 直接呼叫,不再對自身發 HTTP、不再用 `ADMIN_SECRET` 當 bearer。
- `lib/admin-auth.ts` 移除 `token === ADMIN_SECRET` 的永久後門(徹底抵銷 JWT 效期/撤銷的那條),admin API 只認短效 JWT;登入的 email/password 比對改用 `safeEqualStr`。
- cron 授權維持既有的 `CRON_SECRET`;機器憑證與人類憑證分離。

## 1.0.2 — 2026-07-02

安全修正(CRITICAL):LIFF 預約端點改用伺服器端驗證的 LINE 身分,堵住 IDOR。

- 新增 `lib/liff-auth-core.ts`(抽 Bearer、驗 LINE verify 回應,含測試)與 `lib/liff-auth.ts`(`verifyLiffUser`:打 LINE `/oauth2/v2.1/verify` 驗 ID token、核對 aud=channel、回可信 `sub`)。
- `/api/liff/reservations`(GET/PATCH)與 `/api/booking/reserve` 不再信任 client 傳來的 `lineUserId`,改用驗過的 userId 做查詢與擁有權判斷;`reserve` 另加每 IP 限流與欄位長度上限。
- 前端 `app/liff/booking/page.tsx` 改以 `liff.getIDToken()` 帶 `Authorization: Bearer <token>`;`lib/liff.ts` 新增 `getLiffIdToken`。
- 需設定 `LINE_LOGIN_CHANNEL_ID`(未設會退用 LIFF ID 前綴,仍建議顯式設定);LIFF app 需啟用 `openid` scope,否則 `getIDToken` 為 null、請求會被擋。上線前需真機測試 LIFF 流程。

## 1.0.1 — 2026-07-02

測試基建與共用安全工具。

- 加入 vitest(`npm test`)與 `vitest.config.ts`(`@` alias)。此專案原本零測試。
- 新增 `lib/rate-limiter.ts`(可注入時鐘的 IP 限流器)+ 測試。
- 新增 `lib/safe-equal.ts`(HMAC + `timingSafeEqual` 定值時間比較)+ 測試。
