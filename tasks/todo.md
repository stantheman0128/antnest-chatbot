# 螞蟻窩甜點 — Roadmap

> 詳細說明見 [PROJECT_STATUS.md](../PROJECT_STATUS.md) 第七節
> 🤖 = Claude 自主 | 👤 = 你手動 | 🤝 = 協作

## Phase 1：基礎系統 ✅ 全部完成

- [x] 1A — MVP：關鍵字比對 + AI 聊天 + LINE Bot
- [x] 1B — Supabase + Admin 後台
- [x] 1C — 預約系統
- [x] 1D — LIFF 預約網頁
- [x] 1E — 模型升級（Gemini 3.1 + failover）
- [x] 1F — 客戶 Dashboard
- [x] 1G — Cyberbiz 自動同步
- [x] 1H — 程式碼品質

## Phase 2：快速優化

- [ ] 2A — ESLint + Prettier 🤖
- [ ] 2B — husky + lint-staged 🤖 ← 依賴 2A
- [ ] 2C — TypeScript 加嚴 🤖 ← 依賴 2A
- [ ] 2D — 架構流程圖 Mermaid 🤖
- [ ] 2E — Prompt 架構重構（XML 隔離）🤖
- [x] 2F — Rich Menu 設定 ✅ 闆娘已完成
- [ ] 2G — GitHub Projects Board 👤
- [ ] 2H — LINE 管理指令 🤖

## Phase 3：系統升級

- [ ] 3A — GitHub Actions CI 🤖 ← 依賴 2A
- [ ] 3B — Vitest 測試框架 🤖 ← 依賴 3A
- [ ] 3C — Dependabot 🤖
- [ ] 3D — Supabase Migrations 🤖
- [ ] 3E — 推播通知系統 🤖
- [ ] 3F — Sentry 錯誤追蹤 🤝
- [ ] 3G — RAG 語意檢索 🤝 ← 依賴 2E
- [ ] 3H — Reflexion 反饋機制 🤝 ← 依賴 3G
- [ ] 3I — Vercel Analytics 👤
- [ ] 3J — POS 系統 Figma 設計 👤

## Phase 4：POS 系統（獨立專案）

- [ ] 4 — antnest-pos（見 `pos-system-plan.md`）← 依賴 3J
