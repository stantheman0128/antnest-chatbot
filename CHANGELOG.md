# Changelog

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
