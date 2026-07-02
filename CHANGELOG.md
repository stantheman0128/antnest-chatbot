# Changelog

## 1.0.1 — 2026-07-02

測試基建與共用安全工具。

- 加入 vitest(`npm test`)與 `vitest.config.ts`(`@` alias)。此專案原本零測試。
- 新增 `lib/rate-limiter.ts`(可注入時鐘的 IP 限流器)+ 測試。
- 新增 `lib/safe-equal.ts`(HMAC + `timingSafeEqual` 定值時間比較)+ 測試。
