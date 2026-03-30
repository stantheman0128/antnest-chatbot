# 螞蟻窩甜點 AI 客服系統 — 專案狀態

最後更新：2026-03-30

---

## 一、專案概覽

| 項目         | 資訊                                                           |
| ------------ | -------------------------------------------------------------- |
| 專案名稱     | 螞蟻窩甜點 AI 客服聊天機器人                                   |
| 目標         | 為螞蟻窩甜點（ANT NEST）提供智能客服 + 預約系統 + 營運管理後台 |
| GitHub       | https://github.com/stantheman0128/antnest-chatbot              |
| 線上版       | https://antnest-chatbot.vercel.app                             |
| LINE Bot     | 已串接，production 使用中                                      |
| 總 Commit 數 | 111                                                            |

---

## 二、目前架構

```
使用者訊息（網頁 or LINE）
    ↓
Tier 1：關鍵字意圖比對 (intent-matcher.ts)
    ├─ 命中短訊息 → 模板回答 (faq-pairs.json)
    ├─ 推理信號詞 / 長訊息 / 多意圖 → 交給 AI
    └─ 未命中 ↓
Tier 2：AI 生成回答
    ├─ Supabase 動態載入：system config + 產品資料 + 對話範例
    ├─ LINE 多輪對話歷史注入
    ├─ 主模型：Gemini 3.1 Flash-Lite Preview
    ├─ Auto-failover：主模型失敗 → 備援模型
    └─ 回傳結果（長訊息自動分段）
```

### 技術棧

| 類別    | 技術                                                       |
| ------- | ---------------------------------------------------------- |
| 框架    | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4     |
| AI 模型 | Google Gemini 3.1 Flash-Lite Preview（主） + auto-failover |
| 資料庫  | Supabase (PostgreSQL)                                      |
| 認證    | JWT (jose, 2h expiry) + rate limiting                      |
| LINE    | @line/bot-sdk + @line/liff                                 |
| 部署    | Vercel (auto-deploy on push to main)                       |
| Cron    | Vercel Cron — 每週一 12:05 UTC 自動同步 Cyberbiz 產品      |

---

## 三、已完成功能

### 3.1 AI 聊天核心

- [x] 雙層回答架構（關鍵字比對 + AI 生成）
- [x] 16 個 FAQ 意圖的關鍵字模板
- [x] 推理信號詞偵測（推薦/比較/建議 → 直接交 AI）
- [x] 多輪對話歷史（LINE 聊天支援 context）
- [x] 對話摘要快取（line_users 表）
- [x] AI 回應延遲追蹤（console log）
- [x] 動態 greeting（從 admin 設定）
- [x] Prompt injection 防護
- [x] 長訊息自動分段
- [x] 「呼叫闆娘」quick reply 推薦

### 3.2 AI 模型管理

- [x] Gemini 3.1 Flash-Lite Preview（從 Groq Llama 8B → Gemini 2.5 → 3.1 升級）
- [x] Auto-failover（主模型掛掉自動切換備援）
- [x] Admin 可選模型
- [x] 25s fallback 訊息 + 60s timeout

### 3.3 LINE Bot 整合

- [x] Webhook 接收/回覆訊息
- [x] LINE 簽章驗證
- [x] Flex Message 產品卡片（carousel）
- [x] Flex Message 預約卡片（日期/時段選擇）
- [x] Quick Reply 按鈕
- [x] Typing indicator
- [x] 多輪對話歷史
- [x] 對話紀錄 logging

### 3.4 Admin 管理後台

- [x] JWT 認證（2h 過期 + rate limiting，取代 plaintext token）
- [x] 產品管理（CRUD + Cyberbiz 自動同步 + 手動同步）
- [x] 產品變體支援（口味/規格）
- [x] 結構化產品描述（從 Cyberbiz JSON API 爬取）
- [x] 系統設定編輯器（greeting、rules、format 等 key-value）
- [x] 對話範例管理（訓練 AI 用）
- [x] 客戶 Dashboard（AI metrics、對話趨勢、CRM）
- [x] 使用者統計 + 對話歷史查看
- [x] 自動偵測產品抱怨 + 回饋卡片
- [x] Issue resolution checklist
- [x] 預約/取貨管理
- [x] 統一 UI（toast system、error handling、font、image optimization）

### 3.5 預約系統

- [x] 取貨日期可用性管理（admin 設定）
- [x] 日期 + 彈性時段預約
- [x] 待確認流程（pending → confirmed）
- [x] 客戶取消/修改
- [x] 訂單編號提示
- [x] iCal feed 匯出（Apple/Google Calendar 訂閱）

### 3.6 LIFF 預約網頁

- [x] LINE 內部開啟 → 自動辨識身份
- [x] 外部瀏覽器 → LINE Login
- [x] 預約管理 API (/api/liff/reservations)

### 3.7 Cyberbiz 產品同步

- [x] 手動觸發同步（admin）
- [x] Vercel Cron 每週自動同步
- [x] 從 Cyberbiz JSON API 爬取完整描述 + 600×600 圖片
- [x] Per-product 個別同步
- [x] 售完/庫存狀態即時更新

### 3.8 程式碼品質

- [x] data-service.ts 拆分為 6 個模組（db-config/products/examples/reservations/logging/cache）
- [x] 7 個安全/邏輯 bug 修復
- [x] Code review 修正（dedup、perf、correctness）
- [x] Client bundle 相容性修復（fs/path inline require）
- [x] React hooks 順序修復

---

## 四、API 路由一覽

| 路由                             | 方法            | 用途         | 認證         |
| -------------------------------- | --------------- | ------------ | ------------ |
| `/api/chat`                      | POST            | 網頁聊天     | -            |
| `/api/line/webhook`              | POST            | LINE Bot     | LINE 簽章    |
| `/api/booking/slots`             | GET             | 可預約日期   | -            |
| `/api/booking/reserve`           | POST            | 建立預約     | -            |
| `/api/calendar/feed`             | GET             | iCal 匯出    | token        |
| `/api/cron/sync`                 | GET             | 自動同步產品 | Vercel Cron  |
| `/api/liff/reservations`         | GET/POST        | LIFF 預約    | lineUserId   |
| `/api/admin/login`               | POST            | 產生 JWT     | rate limited |
| `/api/admin/config`              | GET/POST        | 系統設定     | JWT          |
| `/api/admin/examples`            | GET/POST/DELETE | 對話範例     | JWT          |
| `/api/admin/products`            | GET/POST/DELETE | 產品管理     | JWT          |
| `/api/admin/scrape`              | POST            | 手動同步     | JWT          |
| `/api/admin/users`               | GET/POST        | 使用者統計   | JWT          |
| `/api/admin/pickup/availability` | GET/POST/DELETE | 預約可用性   | JWT          |
| `/api/admin/pickup/reservations` | GET/POST        | 預約管理     | JWT          |

---

## 五、頁面一覽

| 路由                   | 用途               |
| ---------------------- | ------------------ |
| `/`                    | 網頁聊天介面       |
| `/booking`             | 獨立預約頁面       |
| `/liff/booking`        | LINE LIFF 預約頁面 |
| `/admin/login`         | 管理員登入         |
| `/admin/products`      | 產品管理           |
| `/admin/products/[id]` | 編輯產品           |
| `/admin/pickup`        | 預約/取貨管理      |
| `/admin/users`         | 客戶 Dashboard     |
| `/admin/settings`      | 系統設定           |
| `/admin/examples`      | 對話範例管理       |

---

## 六、Supabase 資料表

| 表名                    | 用途                                               |
| ----------------------- | -------------------------------------------------- |
| `products`              | 產品資料（含 variants、stock status）              |
| `system_config`         | 系統設定 key-value（greeting、rules、policies 等） |
| `conversation_examples` | AI 訓練用對話範例                                  |
| `pickup_availability`   | 取貨日期/時段可用性                                |
| `reservations`          | 預約記錄                                           |
| `line_users`            | LINE 使用者資料 + 對話歷史 + 摘要快取              |

---

## 七、開發 Roadmap

> 標記：🤖 = Claude 可自主完成 | 👤 = 需要你手動操作 | 🤝 = 協作完成

### Phase 1：基礎系統 ✅ 全部完成

| Phase  | 名稱                                            | 狀態 |
| ------ | ----------------------------------------------- | ---- |
| **1A** | MVP — 關鍵字比對 + AI 聊天 + LINE Bot           | ✅   |
| **1B** | Supabase 資料庫遷移 + Admin 後台                | ✅   |
| **1C** | 預約系統（日期 + 彈性時段 + iCal）              | ✅   |
| **1D** | LIFF 預約網頁（LINE 身份整合）                  | ✅   |
| **1E** | 模型升級（→ Gemini 3.1 Flash-Lite + failover）  | ✅   |
| **1F** | 客戶 Dashboard（CRM + AI metrics + 回饋偵測）   | ✅   |
| **1G** | Cyberbiz 自動同步（cron + 手動）                | ✅   |
| **1H** | 程式碼品質（模組拆分 + 安全修復 + code review） | ✅   |

---

### Phase 2：快速優化（改動小、見效快）

#### 2A：ESLint + Prettier 🤖

**難度**：★★☆☆☆ | **依賴**：無

- ESLint：@eslint/js + typescript-eslint + eslint-plugin-next
- Prettier：tailwind plugin + import sorting
- VS Code settings 自動存檔格式化
- 全專案統一程式碼風格

#### 2B：husky + lint-staged 🤖

**難度**：★☆☆☆☆ | **依賴**：2A

- git commit 前自動跑 ESLint + Prettier
- 壞程式碼不可能 commit 進 repo
- type-check 在 commit 前執行

#### 2C：TypeScript 加嚴 🤖

**難度**：★☆☆☆☆ | **依賴**：2A

- 開啟 noUncheckedIndexedAccess（抓 object access bug）
- 開啟 noUnusedLocals / noUnusedParameters
- 修復新規則產生的 type error

#### 2D：架構流程圖（Mermaid） 🤖

**難度**：★★☆☆☆ | **依賴**：無

在 `docs/architecture.md` 用 Mermaid 畫（GitHub 直接渲染）：

- 對話路由圖（訊息怎麼分流）
- 預約狀態機（pending → confirmed → cancelled）
- 系統架構圖（元件關係）
- 資料流圖（Admin 改設定 → chatbot 用新資料）

#### 2E：Prompt 架構重構 🤖

**難度**：★★☆☆☆ | **依賴**：無

把 system prompt 正式拆為 4 個隔離區塊：

```xml
<instruction>核心任務和行為規則</instruction>
<format_rules>格式限制</format_rules>
<knowledge_base>產品和政策資訊</knowledge_base>
<corrections>動態注入的修正規則</corrections>
```

- 抽象佔位符（{{PRODUCT_NAME}}）取代具體產品名
- Meta-instruction 宣告範例用途

#### 2F：Rich Menu 設定 ✅

闆娘已在 LINE Official Account Manager 完成。

#### 2G：GitHub Projects Board 👤

**難度**：★☆☆☆☆ | **依賴**：無

- 把 todo.md 搬到 GitHub Issues + Projects
- Kanban board：Backlog / Todo / In Progress / Done
- Issue 連結到 commit 和 PR

#### 2H：LINE 管理指令 🤖

**難度**：★★★☆☆ | **依賴**：無

偵測闆娘 userId + `/` 開頭訊息，走管理流程：

```
/商品 列表                    → 顯示所有商品
/商品 上架 classic-tiramisu   → 上架指定商品
/商品 下架 classic-tiramisu   → 下架指定商品
/商品 改價 classic-tiramisu 320 → 修改價格
/設定 查看 shipping           → 查看運費設定
/狀態                        → bot 狀態（活躍用戶數、今日訊息數）
```

---

### Phase 3：系統升級（需要新 infra）

#### 3A：GitHub Actions CI 🤖

**難度**：★★☆☆☆ | **依賴**：2A

- push 後自動跑：lint → type-check → test → build
- 壞程式碼不可能部署到 production

#### 3B：Vitest 測試框架 🤖

**難度**：★★★☆☆ | **依賴**：3A

- 對關鍵路徑寫 unit test：
  - intent-matcher（意圖比對邏輯）
  - admin-auth（JWT 驗證）
  - ai-client（failover 邏輯）
- CI 自動跑測試

#### 3C：Dependabot 🤖

**難度**：★☆☆☆☆ | **依賴**：無

- GitHub 自動偵測依賴安全漏洞
- 每週自動開 PR 更新
- .github/dependabot.yml 設定

#### 3D：Supabase Migrations 🤖

**難度**：★★☆☆☆ | **依賴**：無

- 把 DB schema 版本控制（supabase/migrations/）
- 任何人都能從 git 重建完整 DB
- supabase db diff 產生 migration 檔

#### 3E：推播通知系統 🤖

**難度**：★★★☆☆ | **依賴**：無

- 新開單通知（推給所有追蹤者）
- 取貨提醒（預約前一天自動推播）
- 未取貨警告
- Vercel Cron + LINE push message API

#### 3F：Sentry 錯誤追蹤 🤝

**難度**：★★☆☆☆ | **依賴**：無

- Production 錯誤即時通知（email / Slack）
- 需要：建立 Sentry 帳號（👤）→ 整合程式碼（🤖）

#### 3G：RAG 語意檢索 🤝

**難度**：★★★★☆ | **依賴**：2E

- Supabase 開啟 pgvector extension
- 產品描述 → embedding → vector column
- Router 意圖分類（Store_Info / Product_Query / Needs_Reasoning / Off_Topic）
- Parent-Child 索引策略
- Similarity Score < 0.7 → fallback

#### 3H：Reflexion 反饋機制 🤝

**難度**：★★★★★ | **依賴**：3G

- feedback_knowledge_base 表（糾錯記憶庫）
- Optimization Agent（bad response → 修正規則）
- Correction Vector DB → Runtime 動態注入
- 讓系統自我進化，由人類主導方向

#### 3I：Vercel Analytics 👤

**難度**：★☆☆☆☆ | **依賴**：無

- Vercel Dashboard 開啟 Web Analytics（免費）
- 看哪些頁面被使用、用戶從哪來

#### 3J：POS 系統 Figma 設計 👤

**難度**：★★★☆☆ | **依賴**：Phase 4 開始前

- Figma 開帳號
- 先畫 wireframe：闆娘開單流程、客人購買流程
- 定義品牌設計系統（色彩、字型、元件）
- 確認完再寫 code

---

### Phase 4：POS 系統（獨立專案）

**難度**：★★★★★ | **依賴**：chatbot 穩定 + 3J 設計完成

> 完整計畫見 `tasks/pos-system-plan.md`

螞蟻窩計畫建立自有 POS 系統（antnest-pos），專為「開單制甜點預購」設計。與 chatbot 共用同一個 LINE 官方帳號，但分開開發部署。

核心特色：批次開單 → 限時限量 → 截單製作 → 冷凍出貨 → 未取貨處理

技術棧：Next.js + Prisma + Supabase + ECPay（金流+物流） + LINE Login

---

### 依賴關係 & 建議順序

```
2A ESLint ─→ 2B husky ─→ 2C TS 加嚴 ─→ 3A CI ─→ 3B Vitest
2D 架構圖（獨立）
2E Prompt ─────────────────────────→ 3G RAG ─→ 3H Reflexion
2F Rich Menu ✅
2G GitHub Projects（獨立）
2H LINE 管理指令（獨立）
3C Dependabot（獨立）
3D Supabase Migrations（獨立）
3E 推播通知（獨立）
3F Sentry（獨立）
3I Vercel Analytics（獨立）
3J Figma（Phase 4 前）
```

---

## 八、參考研究文件

| 文件                                           | 內容                                          |
| ---------------------------------------------- | --------------------------------------------- |
| `tasks/pos-system-plan.md`                     | POS 系統完整開發計畫                          |
| `tasks/cold-chain-logistics-research.md`       | 台灣冷藏/冷凍物流服務比較（黑貓、全家、7-11） |
| `tasks/research-familymart-super-good-sell.md` | 全家超級好賣平台研究（無 API，不適合串接）    |

---

## 九、環境與部署

### 本地開發

```bash
cd C:\Users\stans\Projects\antnest-chatbot
npm run dev  # localhost:3000
```

### 部署

- Vercel 自動部署：push to main → build & deploy
- URL：https://antnest-chatbot.vercel.app

### 環境變數（.env.local / Vercel Dashboard）

- `GOOGLE_AI_API_KEY` — Gemini API
- `LINE_CHANNEL_ACCESS_TOKEN` — LINE Messaging API
- `LINE_CHANNEL_SECRET` — LINE Webhook 驗證
- `ADMIN_SECRET` — Admin JWT signing
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase (server-side)

### Git

- Remote：https://github.com/stantheman0128/antnest-chatbot.git
- Branch：main
- User：stantheman0128

---

## 十、設計原則（經驗教訓）

1. **不要 overfit**：不要針對特定失敗案例寫死修正，要找根因寫通用規則
2. **Prompt 格式影響 AI 輸出**：prompt 裡用 `**粗體**` → AI 也會輸出粗體
3. **Intent matcher 應該保守**：不確定就交給 AI，AI 呼叫是 cheap 的
4. **手機優先排版**：段落短、空行多，不要一坨文字
5. **推理類問題一律交 AI**：推薦、比較、計算、組合都不該用模板
6. **模組化拆分**：單檔超過 500 行就該拆（data-service.ts 1120 行教訓）
7. **安全優先**：JWT 取代 plaintext token、rate limiting、input validation
