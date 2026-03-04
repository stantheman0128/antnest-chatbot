# 螞蟻窩甜點 POS 系統｜完整開發計畫

> 取代現有 CyberBiz，專為「開單制甜點預購」設計的自有系統

---

## 一、系統概覽

### 營運流程

```
建立開單 → 設定上架時間 → 自動開放購買（顯示剩餘數量）
    → 截止（手動或售完） → 製作 → 出貨（列印 ibon 貼紙）
    → 追蹤到貨 → 提醒未取貨 → 退回不自動退款，闆娘手動決定
```

### 技術架構

```
┌──────────────────────────────────────────────────────┐
│                    前端 (Next.js)                      │
├──────────────┬───────────────┬────────────────────────┤
│  商店前台     │  管理後台      │  LINE 整合              │
│  - 商品瀏覽   │  - 開單管理    │  - 訂單通知推播          │
│  - 購物車     │  - 訂單列表    │  - 到貨通知              │
│  - 結帳       │  - 出貨管理    │  - 未取貨提醒            │
│  - 會員中心   │  - 財務報表    │  - LIFF 點餐（Phase 2）  │
│  - 訂單查詢   │  - 會員分析    │                         │
│               │  - 商品管理    │                         │
└──────┬───────┴───────┬───────┴──────────┬─────────────┘
       │               │                  │
       └───────────────┼──────────────────┘
                       │ API Routes
┌──────────────────────▼───────────────────────────────┐
│                 Next.js API Layer                      │
│  /api/orders    /api/products    /api/batches          │
│  /api/payments  /api/shipping    /api/members          │
│  /api/reports   /api/webhooks    /api/line             │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              資料庫 (PostgreSQL via Supabase)           │
│  + Prisma ORM                                         │
│  + Supabase Auth (會員 + 管理員)                        │
│  + Supabase Storage (商品圖片)                          │
└──────────────────────────────────────────────────────┘

外部串接：
  ├─ ECPay 金流 API（信用卡、貨到付款、分期）
  ├─ ECPay 物流 API（7-11 ibon、全家）
  ├─ LINE Messaging API（推播通知）
  └─ LINE Login（會員登入 via NextAuth）
```

### 為什麼不用 Medusa.js

螞蟻窩的「開單制」跟傳統電商差異太大：
- 批次開單 + 限時限量 + 截單後庫存凍結 → Medusa 沒有這個概念
- 退貨不釋出庫存 → 需要自定義庫存邏輯
- 每批獨立成本/利潤計算 → Medusa 沒有財務模組

用 **Next.js + Prisma + Supabase** 直接建，反而更快更乾淨。

---

## 二、資料模型 (Prisma Schema 設計)

### 核心 Entity

```
Product（商品）
├─ id, name, slug, description, images[]
├─ category
├─ costPerUnit（單位成本，用於利潤計算）
└─ variants[]（口味/規格）

Batch（開單批次）
├─ id, name（例如「第 23 期」）
├─ status: DRAFT → SCHEDULED → ACTIVE → CLOSED → PRODUCING → SHIPPING → COMPLETED
├─ scheduledOpenAt（自動上架時間）
├─ scheduledCloseAt（自動截止時間，可選）
├─ manualClosedAt
├─ shippingDate（預計出貨日）
├─ estimatedArrivalDate（預計到貨日）
└─ batchItems[]

BatchItem（批次商品）
├─ batchId → Batch
├─ productId → Product
├─ variantId → ProductVariant（可選）
├─ price（本批售價）
├─ costOverride（本批成本，可覆蓋 Product.costPerUnit）
├─ quantityLimit（限量數）
├─ quantitySold（已售數）
└─ remainingCount = quantityLimit - quantitySold

Order（訂單）
├─ id, orderNumber
├─ memberId → Member
├─ batchId → Batch
├─ status: PENDING_PAYMENT → PAID → PRODUCING → SHIPPED → DELIVERED → PICKED_UP → RETURNED → REFUNDED
├─ paymentMethod, paymentStatus
├─ shippingMethod: SEVEN_ELEVEN_FROZEN | FAMILY_MART_FROZEN | SELF_PICKUP
├─ shippingTrackingNo
├─ estimatedPickupDate
├─ pickupDeadline
├─ pickupReminderSentAt
├─ returnedAt（超商退回時間）
├─ refundStatus: NONE | PENDING_REVIEW | REFUNDED | REJECTED
├─ refundDecision: null（闆娘尚未決定）| REFUND | CONTACT_RESEND | REJECT
├─ totalAmount, shippingFee
└─ orderItems[]

OrderItem（訂單明細）
├─ orderId → Order
├─ batchItemId → BatchItem
├─ quantity
├─ unitPrice
└─ subtotal

Member（會員）
├─ id
├─ lineUserId（LINE 登入綁定）
├─ name, email, phone
├─ birthday → 系統自動算年齡層
├─ addresses[]
├─ createdAt
└─ orders[]

AdminUser（管理員）
├─ id, email, role: OWNER | STAFF
└─ permissions[]
```

### 關鍵設計決策

| 需求 | 設計 |
|------|------|
| 截單後退貨不釋出庫存 | `quantitySold` 只在下單時 +1，退貨時**不** -1 |
| 自動上架 | Cron job 每分鐘檢查 `scheduledOpenAt`，到時間就把 status 改為 ACTIVE |
| 剩餘數量 | 即時計算 `quantityLimit - quantitySold`，前端顯示 |
| 不取貨不自動退款 | 超商回報退回時，`refundStatus` 設為 `PENDING_REVIEW`，闆娘在後台決定 |

---

## 三、功能模組 & 開發階段

### Phase 1：核心系統（MVP）

#### 1A. 商品 & 開單管理（後台）
- [ ] 商品 CRUD（名稱、描述、圖片、成本、分類、口味變體）
- [ ] 開單 CRUD（建立批次、指定商品與數量、設定售價）
- [ ] 開單排程（設定自動上架日期時間）
- [ ] 批次狀態流轉（DRAFT → SCHEDULED → ACTIVE → CLOSED → ...）
- [ ] 手動截單按鈕
- [ ] 售完自動截止（剩餘 = 0 時自動 CLOSED）

#### 1B. 商店前台
- [ ] 商品列表頁（只顯示 ACTIVE 批次的商品）
- [ ] 商品詳情頁（圖片、描述、價格、剩餘數量即時顯示）
- [ ] 購物車
- [ ] 結帳流程（選擇配送方式 → 填寫收件資訊 → 付款）
- [ ] 訂單完成頁 + 訂單查詢頁

#### 1C. 金流串接（ECPay）
- [ ] 信用卡付款
- [ ] 貨到付款
- [ ] 分期付款
- [ ] ECPay webhook 接收付款結果
- [ ] CheckMacValue 驗證

#### 1D. 會員系統
- [ ] 註冊（姓名、email、電話、生日）
- [ ] LINE Login 整合（NextAuth LINE Provider）
- [ ] 會員中心：我的訂單、基本資料修改
- [ ] 後台：會員列表、年齡層分布圖表

---

### Phase 2：物流 & 訂單追蹤

> **物流研究結論（2026-03 更新）**
> - 甜點需要冷凍出貨（-18°C）
> - **全家冷凍 B2C**：日翊物流直接費率 NT$145(S60)/NT$155(S105)（來源：Cyberbiz 文件）
>   - 目前走 Cyberbiz = NT$190，可省 NT$35–45
>   - API 串接透過 ECPay Logistics API
>   - 日翊聯絡：reyiservice@fme.com.tw / 03-307-5581
> - **7-11 冷凍 B2C**：ECPay NT$129 優惠已於 2025/12/31 到期，正常費率 NT$180
>   - 統昶行銷負責冷鏈，不直接對小型電商開放
>   - 可向統一數網 PRESCO（711EC@sp88.com）詢問直接合約
> - **好賣+ (全家)**：NT$99 但無 API，不適合自建系統
> - **建議短期路線**：Cyberbiz + 日翊 B2C 場勘申請（降至 NT$145）
> - **自建系統路線**：ECPay Logistics API 串接全家冷凍 + 7-11 冷凍

#### 2A. 物流串接
- [ ] ECPay 物流 API — 全家冷凍 B2C（日翊物流）
  - 建立物流訂單 → 取得託運單號
  - 一鍵批次建立（整批訂單一次產生託運單）
  - 尺寸限制：45×30×30cm、5kg(S60) 或 10kg(S105)
- [ ] ECPay 物流 API — 7-11 冷凍 B2C（統昶行銷）
  - 尺寸限制：30×30×45cm、10kg
  - 費率需確認（優惠是否延長）
- [ ] 自取選項（串接已開發的預約系統）

#### 2B. 訂單列表 & 追蹤（後台）
- [ ] 訂單列表：篩選（批次、狀態、配送方式）
- [ ] 每筆訂單顯示：
  - 訂單編號、會員名稱
  - 商品明細
  - 付款狀態
  - **出貨日期**
  - **預計到貨日期**
  - **取貨狀態**（已取 / 未取 / 已退回）
  - **取貨期限倒數**
- [ ] ECPay 物流狀態 webhook → 自動更新到貨/取貨狀態
- [ ] 批次總覽：這批還有幾筆未出貨 / 未取貨

#### 2C. 未取貨處理
- [ ] 超商退回 webhook → 訂單標記 RETURNED + refundStatus = PENDING_REVIEW
- [ ] 後台「待處理退貨」列表
- [ ] 闆娘可選：退款 / 聯繫客人重寄 / 不處理
- [ ] 退款操作 → 呼叫 ECPay 退款 API

---

### Phase 3：LINE 通知

#### 3A. LINE 推播通知
- [ ] 訂單成立通知（Flex Message 卡片：商品、金額、訂單編號）
- [ ] 出貨通知（含物流單號）
- [ ] 到貨通知（「您的包裹已到 XX 門市，請於 X 天內取貨」）
- [ ] 未取貨提醒（取貨期限前 2 天自動推播）
- [ ] 退貨通知（「您的包裹已退回，請聯繫我們」）

#### 3B. LINE Bot 基本互動
- [ ] 查詢訂單狀態（輸入訂單編號）
- [ ] 連結到商店前台
- [ ] Rich Menu 設定（商品目錄 / 我的訂單 / 聯絡客服）

---

### Phase 4：財務報表 & 分析

#### 4A. 批次利潤報表
- [ ] 每批銷售額總計
- [ ] 每批成本總計（商品成本 × 數量）
- [ ] 毛利 = 銷售額 - 成本
- [ ] 毛利率
- [ ] 可加入：物流費、包材費（手動輸入）
- [ ] 匯出 CSV/Excel

#### 4B. 財務儀表板
- [ ] 月營收趨勢圖
- [ ] 各商品銷售排行
- [ ] 毛利率趨勢
- [ ] 退貨率

#### 4C. 會員分析
- [ ] 年齡層分布（圓餅圖，依生日計算）
- [ ] 回購率
- [ ] 平均客單價
- [ ] 新/舊客比例

---

## 四、技術選型

| 項目 | 選擇 | 理由 |
|------|------|------|
| 框架 | **Next.js 15 (App Router)** | 全棧、SSR、API Routes、現有專案基礎 |
| ORM | **Prisma** | TypeScript 原生、migration 管理、type-safe |
| 資料庫 | **Supabase (PostgreSQL)** | 免費額度、Auth 內建、Storage、Realtime |
| Auth | **NextAuth.js + Supabase** | LINE Provider 內建、session 管理 |
| UI | **shadcn/ui + Tailwind CSS** | 後台元件豐富、可客製化 |
| 圖表 | **Recharts** | 輕量、React 原生、報表用 |
| 金流 | **ECPay AIO API** | 台灣主流、信用卡+貨到+分期一次搞定 |
| 物流 | **ECPay Logistics API** | 全家冷凍 B2C + 7-11 冷凍 B2C（需冷凍出貨）|
| LINE | **@line/bot-sdk + NextAuth LINE** | 推播 + 登入 |
| 排程 | **Vercel Cron Jobs** | 自動上架、未取貨提醒（免費方案每日 1 次，Pro 每分鐘）|
| 部署 | **Vercel** | 現有基礎、自動部署、Edge Functions |

---

## 五、專案結構

```
antnest-pos/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (store)/              # 商店前台
│   │   │   ├── page.tsx          # 首頁（當期商品）
│   │   │   ├── products/[slug]/  # 商品詳情
│   │   │   ├── cart/             # 購物車
│   │   │   ├── checkout/         # 結帳
│   │   │   └── orders/           # 我的訂單
│   │   ├── (admin)/              # 管理後台
│   │   │   ├── dashboard/        # 儀表板
│   │   │   ├── batches/          # 開單管理
│   │   │   ├── products/         # 商品管理
│   │   │   ├── orders/           # 訂單管理
│   │   │   ├── members/          # 會員管理
│   │   │   ├── shipping/         # 出貨管理
│   │   │   ├── finance/          # 財務報表
│   │   │   └── settings/         # 系統設定
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── ecpay-payment/  # ECPay 付款回調
│   │   │   │   ├── ecpay-logistics/# ECPay 物流狀態回調
│   │   │   │   └── line/           # LINE webhook
│   │   │   ├── cron/
│   │   │   │   ├── auto-publish/   # 自動上架
│   │   │   │   └── pickup-reminder/# 未取貨提醒
│   │   │   └── trpc/[trpc]/        # tRPC router (或 REST)
│   │   └── auth/                 # NextAuth
│   ├── lib/
│   │   ├── ecpay/                # ECPay 金流 wrapper
│   │   ├── ecpay-logistics/      # ECPay 物流 wrapper
│   │   ├── line/                 # LINE Bot 推播
│   │   └── prisma.ts             # Prisma client
│   ├── components/
│   │   ├── store/                # 前台元件
│   │   └── admin/                # 後台元件
│   └── types/
├── public/
│   └── images/                   # 商品圖片（已有）
└── package.json
```

---

## 六、開發時程估算

| 階段 | 範圍 | 預估 |
|------|------|------|
| Phase 1 | 商品、開單、前台、金流、會員 | 核心功能 |
| Phase 2 | 物流串接、訂單追蹤、退貨處理 | 最複雜的整合 |
| Phase 3 | LINE 通知 | 已有 bot-sdk 基礎 |
| Phase 4 | 報表、財務、分析 | 數據呈現 |

> Phase 1 做完就能取代 CyberBiz 上線。

---

## 七、ECPay 前置作業（現在就該做）

- [ ] 確認現有 ECPay 商家帳號資訊（MerchantID、HashKey、HashIV）
- [ ] 申請 ECPay 測試環境（sandbox）
- [ ] 確認 7-11 ibon 物流是否已開通（需要在 ECPay 後台另外申請）
- [ ] 確認電子發票需求（台灣法規，營業額超過門檻要開）

---

## 八、跟現有 antnest-chatbot 的關係

| 項目 | 現有 chatbot | 新 POS 系統 |
|------|------------|-----------|
| 定位 | LINE 客服機器人（問答） | 完整銷售+營運系統 |
| 共用 | 商品知識庫、LINE channel | 同一個 LINE 官方帳號 |
| 建議 | 保留為獨立服務 | 新開 `antnest-pos` 專案 |
| 整合 | POS 的 LINE webhook 可轉發「非訂單問題」給 chatbot | 訂單相關由 POS 處理 |
