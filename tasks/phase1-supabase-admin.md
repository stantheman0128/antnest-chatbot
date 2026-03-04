# Phase 1: Supabase DB + Admin Backend

## Overview

將螞蟻窩甜點 chatbot 從靜態檔案驅動改為 Supabase 資料庫驅動，並建立管理後台讓闆娘可以即時修改商品、價格、AI 回覆設定等，不需要重新部署。

## Current Status

代碼已完成，推送到 `development` branch。尚未部署。

## Branch

`development` (基於 main 分支)

---

## Database Schema

在 Supabase SQL Editor 中建立：

### products table
```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  original_price TEXT,
  description TEXT NOT NULL,
  detailed_description TEXT,
  image_url TEXT NOT NULL,
  store_url TEXT NOT NULL,
  badges TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  temperature_zone TEXT,
  alcohol_free BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### system_config table
```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Files on Development Branch

### New Core Libraries
- `lib/supabase.ts` — Supabase client singleton (returns null if not configured, enabling fallback)
- `lib/data-service.ts` — Data access layer with 5-min TTL cache, static file fallback
- `lib/admin-auth.ts` — Simple token-based admin auth (env var based)

### Modified Core Libraries
- `lib/knowledge-base.ts` — Refactored to async, assembles system prompt from DB config
- `lib/flex-message.ts` — Refactored to async, reads products from DB
- `lib/ai-client.ts` — Dynamic product IDs from DB (not hardcoded)
- `app/api/line/webhook/route.ts` — Updated for async knowledge-base/flex-message

### Admin UI Pages
- `app/admin/layout.tsx` — Layout with nav, auth gate, logout
- `app/admin/login/page.tsx` — Login form
- `app/admin/page.tsx` — Dashboard with product counts
- `app/admin/products/page.tsx` — Product list with active toggle
- `app/admin/products/[id]/page.tsx` — Product edit form (all fields)
- `app/admin/settings/page.tsx` — System config editor with modal

### Admin API Routes
- `app/api/admin/login/route.ts` — POST: authenticate with email/password, returns token
- `app/api/admin/products/route.ts` — GET/POST/DELETE: product CRUD
- `app/api/admin/config/route.ts` — GET/POST: system config CRUD

### Seed Script
- `scripts/seed.ts` — Imports existing product-cards.json + system-prompt.md into Supabase

---

## Environment Variables Needed

```env
# Supabase (from Supabase Dashboard > Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Admin Auth
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_SECRET=random-32-char-secret-for-jwt
```

---

## Setup Steps

1. **Create Supabase project** at supabase.com
2. **Run schema SQL** in Supabase SQL Editor (see above)
3. **Set env vars** in `.env.local` (local) and Vercel Dashboard (production)
4. **Run seed script**: `npx tsx scripts/seed.ts`
5. **Test admin panel**: visit `/admin/login`
6. **Verify**: edit a product → check chatbot response reflects change
7. **Deploy**: merge `development` → `main`, push

## Key Architecture Decisions

- **Fallback**: If Supabase env vars not set, reads from static files (product-cards.json, system-prompt.md)
- **Cache**: 5-min TTL on DB reads, invalidated on writes
- **No redeploy needed**: All content changes are instant via DB
- **Simple auth**: Env var email/password, not Supabase Auth (闆娘 is the only admin)

---

## Phase 2: 預約自取系統

### 目標
讓顧客可以透過 LINE chatbot 預約工作室自取時間，取代目前「私訊闆娘約時間」的人工流程。

### Database Schema (新增)

```sql
CREATE TABLE pickup_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 3,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES pickup_slots(id),
  line_user_id TEXT NOT NULL,
  display_name TEXT,
  order_number TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed / cancelled / completed
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 功能需求
- **闆娘端（Admin UI）**：
  - 新增/編輯/刪除自取時段（日期 + 時間區間 + 容量上限）
  - 查看預約列表（誰約了哪個時段）
  - 批次建立時段（例如：每週三到五 14:00-17:00）
- **顧客端（LINE chatbot）**：
  - AI 判斷顧客想約自取 → ESCALATE 轉接（現有機制）
  - 未來可擴展：直接在 LINE 中選擇時段（LIFF 或 Flex Message）
- **提醒**：
  - 自取前一天自動提醒顧客（LINE 推播）
  - 闆娘端看到當天的預約清單

### 實作方式
- Admin UI 加一個 `/admin/pickup` 頁面
- API: `/api/admin/pickup/route.ts`（CRUD slots + 查看 reservations）
- 第一版先做管理端，顧客預約仍透過 LINE 對話讓闆娘手動建立
- 第二版考慮 LIFF 讓顧客自己選時段

---

## Phase 3: 商品資料管理優化

### 目標
讓闆娘可以在 Admin UI 管理所有商品資料，chatbot 即時反映變更。不需要 CYBERBIZ API 同步（確認無 API 可用）。

### 功能需求
- **Admin UI 強化**：
  - 商品圖片上傳（Supabase Storage）
  - 商品排序拖拉
  - 商品分類/標籤管理
  - 批次上下架
  - 價格歷史紀錄
- **Chatbot 整合**：
  - 新增商品後 chatbot 自動認識（動態 product ID，Phase 1 已實作）
  - 商品下架後 chatbot 不再推薦
  - 即時同步，不需重新部署
- **資料完整性**：
  - 商品卡片圖片（LINE Flex Message 用）
  - 商品詳細描述（AI 知識庫用）
  - 價格、規格、保存方式等結構化欄位

### 注意事項
- CYBERBIZ 官網仍作為下單入口，商品連結指向 CYBERBIZ
- Admin UI 只管理 chatbot 側的商品資料（描述、圖片、價格顯示）
- 如果之後有自建 POS 系統（見 `tasks/pos-system-plan.md`），此 Admin UI 可作為過渡方案

---

## Phase 4: LINE AI 管理指令

### 目標
讓闆娘透過 LINE 訊息直接管理 chatbot，不需要開電腦進 Admin UI。適合日常快速操作。

### 設計
闆娘的 LINE userId 設為 admin，收到的訊息前面有特殊前綴時走管理流程。

### 指令格式
```
/商品 列表                    → 顯示所有商品（名稱 + 價格 + 狀態）
/商品 上架 classic-tiramisu   → 上架指定商品
/商品 下架 classic-tiramisu   → 下架指定商品
/商品 改價 classic-tiramisu 320 → 修改價格

/設定 查看 shipping           → 查看運費設定
/設定 更新 shipping 新內容     → 更新設定

/狀態                        → 顯示 bot 狀態（活躍用戶數、今日訊息數等）
```

### 實作方式
- `app/api/line/webhook/route.ts` 加入 admin 指令判斷
- 環境變數 `ADMIN_LINE_USER_ID` 設定闆娘的 userId
- 訊息以 `/` 開頭 + userId 是 admin → 走管理流程，不走 AI
- 管理操作呼叫 `lib/data-service.ts` 的現有函式
- 回覆用 Flex Message 呈現（結構化、好看）

### 前置條件
- Phase 1 完成（Supabase + data-service 已就緒）
- 需要知道闆娘的 LINE userId（可從 webhook log 中取得）

---

## Phase 順序與依賴

```
Phase 1 (Supabase + Admin) ← 你現在要做的
    ↓
Phase 3 (商品管理優化) ← 強化 Admin UI，依賴 Phase 1 的基礎
    ↓
Phase 4 (LINE 管理指令) ← 依賴 Phase 1 的 data-service
    ↓
Phase 2 (預約自取) ← 獨立功能，但 DB 基礎依賴 Phase 1
```

建議順序：1 → 4 → 3 → 2
- Phase 4 最實用（闆娘每天都能用）且最輕量
- Phase 3 是 UI 強化，不急
- Phase 2 是新功能，可以最後做
