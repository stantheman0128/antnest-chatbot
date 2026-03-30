# 螞蟻窩甜點聊天機器人 -- 系統架構文件

> 本文件以 Mermaid 圖表呈現系統各層級的架構與流程，供開發與維運參考。

---

## 1. 系統架構總覽

外部使用者透過 LINE 或 Web 介面發送訊息，經 Next.js API Routes 處理後，
由意圖比對器 (Intent Matcher) 或 AI 客戶端 (Gemini) 產生回覆。
管理員透過 Admin UI 管理商品、設定與預約；Vercel Cron 定期觸發 Cyberbiz 商品同步。

```mermaid
graph TB
    %% ── 使用者入口 ──
    Customer["顧客<br/>LINE App"]
    WebUser["訪客<br/>Web Chat"]
    Admin["管理員<br/>Admin UI"]
    LIFFUser["顧客<br/>LIFF 預約頁"]

    %% ── LINE Platform ──
    LINE["LINE Platform<br/>Messaging API"]

    %% ── Next.js API Layer ──
    subgraph Vercel["Vercel (Next.js App Router)"]
        WebhookAPI["POST /api/line/webhook<br/>LINE Webhook 處理器"]
        ChatAPI["POST /api/chat<br/>Web Chat API"]
        AdminAPI["Admin API Routes<br/>/api/admin/*"]
        CronAPI["GET /api/cron/sync<br/>定時商品同步"]
        BookingAPI["Booking API<br/>/api/booking/*"]
        LIFFAPI["LIFF API<br/>/api/liff/*"]
        CalendarAPI["GET /api/calendar/feed<br/>iCal 匯出"]

        subgraph CoreLib["核心邏輯層 (lib/)"]
            IntentMatcher["intent-matcher.ts<br/>FAQ 關鍵字比對"]
            AIClient["ai-client.ts<br/>Gemini API + Failover"]
            KnowledgeBase["knowledge-base.ts<br/>System Prompt 組裝"]
            StockChecker["stock-checker.ts<br/>庫存即時查詢"]
            DataService["data-service.ts<br/>資料存取 Barrel"]
            AdminAuth["admin-auth.ts<br/>JWT 認證"]
            DBCache["db-cache.ts<br/>記憶體快取 (5min TTL)"]
        end
    end

    %% ── 外部服務 ──
    Supabase["Supabase<br/>PostgreSQL"]
    Gemini["Google Gemini API<br/>2.5-flash-lite / 2.5-flash"]
    Cyberbiz["Cyberbiz 官網<br/>antnest.cyberbiz.co"]

    %% ── 連線 ──
    Customer -->|"傳送訊息"| LINE
    LINE -->|"Webhook POST + 簽章驗證"| WebhookAPI
    WebhookAPI -->|"Reply Message"| LINE
    LINE -->|"回覆"| Customer

    WebUser -->|"HTTP POST"| ChatAPI
    LIFFUser -->|"預約操作"| BookingAPI
    LIFFUser -->|"查詢/修改預約"| LIFFAPI
    Admin -->|"JWT Bearer Token"| AdminAPI

    WebhookAPI --> IntentMatcher
    WebhookAPI --> AIClient
    WebhookAPI --> StockChecker
    WebhookAPI --> DataService
    ChatAPI --> AIClient

    AIClient --> KnowledgeBase
    AIClient --> Gemini
    KnowledgeBase --> DataService

    AdminAPI --> AdminAuth
    AdminAPI --> DataService
    AdminAPI -->|"POST /api/admin/scrape"| Cyberbiz

    CronAPI -->|"每週一 20:05 (UTC+8)"| AdminAPI
    StockChecker -->|"即時抓取 variant JSON"| Cyberbiz

    DataService --> DBCache
    DataService --> Supabase

    BookingAPI --> DataService
    LIFFAPI --> DataService
    CalendarAPI --> DataService

    style Vercel fill:#f0f4ff,stroke:#3b82f6,stroke-width:2px
    style CoreLib fill:#e8f5e9,stroke:#4caf50,stroke-width:1px
    style Supabase fill:#3ecf8e,color:#fff,stroke:#2da06f
    style Gemini fill:#4285f4,color:#fff,stroke:#1a73e8
    style Cyberbiz fill:#ff9800,color:#fff,stroke:#e68900
    style LINE fill:#06c755,color:#fff,stroke:#05a647
```

---

## 2. 訊息路由流程 (Message Routing)

LINE Webhook 收到訊息後的完整決策樹。
這是系統最核心的邏輯，對應 `app/api/line/webhook/route.ts`。

```mermaid
flowchart TD
    Start(["LINE Webhook<br/>POST /api/line/webhook"])
    VerifySig{"驗證 LINE 簽章"}
    VerifySig -->|"無效"| Reject["401 拒絕"]
    VerifySig -->|"有效"| ParseEvents["解析 events"]

    ParseEvents --> ForEach["逐一處理 event"]
    ForEach --> Dedup{"事件重複？<br/>(30s dedup)"}
    Dedup -->|"是"| Skip1["跳過"]
    Dedup -->|"否"| EventType{"event.type？"}

    EventType -->|"postback"| HandlePostback["handlePostback()"]
    EventType -->|"message (text)"| HandleText["handleTextMessage()"]
    EventType -->|"其他"| Skip2["忽略"]

    %% ── Text Message 決策樹 ──
    HandleText --> LogUser["記錄使用者資訊<br/>(upsertLineUser)"]
    LogUser --> CheckLen{"訊息 > 2000 字？"}
    CheckLen -->|"是"| IgnoreSpam["忽略 (疑似攻擊)"]
    CheckLen -->|"否"| KW1

    KW1{"包含「呼叫闆娘」？"}
    KW1 -->|"是"| Deactivate["停用機器人<br/>轉接真人<br/>顯示 getPausedQuickReply"]
    KW1 -->|"否"| KW2

    KW2{"包含「呼叫小螞蟻」<br/>或「呼叫客服」？"}
    KW2 -->|"是"| Activate["啟用機器人<br/>發送 greeting"]
    KW2 -->|"否"| KW3

    KW3{"預約取貨關鍵字？<br/>(預約取貨/我要預約...)"}
    KW3 -->|"是"| PickupCarousel["顯示取貨日期 Carousel"]
    KW3 -->|"否"| KW4

    KW4{"查詢/取消/修改預約？"}
    KW4 -->|"是"| ShowReservation["查詢最新預約<br/>顯示 Flex Message"]
    KW4 -->|"否"| KW5

    KW5{"「下次開單」<br/>或「開單時間」？"}
    KW5 -->|"是"| Announcement["回覆開單公告<br/>(system_config)"]
    KW5 -->|"否"| KW6

    KW6{"「我的ID」？"}
    KW6 -->|"是"| ShowID["回覆 LINE User ID"]
    KW6 -->|"否"| PendingNote

    PendingNote{"有 pending_note？<br/>(剛預約完)"}
    PendingNote -->|"是"| SaveNote["儲存備註到預約"]
    PendingNote -->|"否"| CheckActive

    CheckActive{"機器人已啟用？<br/>或 auto_respond 名單？"}
    CheckActive -->|"否"| Silent["靜默不回應"]
    CheckActive -->|"是"| ShowTyping["顯示 typing indicator"]

    ShowTyping --> StockQ{"庫存相關問題？"}
    StockQ -->|"是"| RefreshStock["refreshStockIfStale()<br/>抓取 Cyberbiz 庫存"]
    StockQ -->|"否"| AICall
    RefreshStock --> AICall

    AICall["generateAIResponse()<br/>帶入最近 20 則對話"]
    AICall --> AIResult{"AI 回應類型？"}

    AIResult -->|"skip: true"| CheckForce{"auto_respond 使用者？"}
    CheckForce -->|"否"| SilentSkip["靜默"]
    CheckForce -->|"是"| ForceReply["強制回覆"]

    AIResult -->|"escalate: true"| Escalate["回覆安撫訊息<br/>停用機器人<br/>轉接闆娘"]
    AIResult -->|"showPickupLink"| PickupLink["回覆文字 + 預約 Carousel"]
    AIResult -->|"正常回覆"| SplitMsg["splitResponse()<br/>分割長訊息"]

    SplitMsg --> HasProducts{"有 SHOW_PRODUCTS？"}
    HasProducts -->|"是"| WithCarousel["文字訊息 + 商品 Carousel"]
    HasProducts -->|"否"| TextOnly["純文字訊息"]

    WithCarousel --> SendReply["replyMessage()"]
    TextOnly --> SendReply
    ForceReply --> SendReply
    SendReply --> TouchActivity["更新 active_until<br/>(延長 30 分鐘)"]

    %% ── Postback 決策樹 ──
    HandlePostback --> PB1{"FEEDBACK:BAD？"}
    PB1 -->|"是"| RecordFeedback["記錄不滿意回饋"]
    PB1 -->|"否"| PB2

    PB2{"SELECT_DATE:*？"}
    PB2 -->|"是"| DateSelected["顯示時段選擇器<br/>(精確/彈性)"]
    PB2 -->|"否"| PB3

    PB3{"PICK_TIME_EXACT:*？"}
    PB3 -->|"是"| ExactTime["建立精確時間預約"]
    PB3 -->|"否"| PB4

    PB4{"PICK_PERIOD:*？"}
    PB4 -->|"是"| FlexPeriod["建立彈性時段預約"]
    PB4 -->|"否"| PB5

    PB5{"CANCEL_MY_RES:*？"}
    PB5 -->|"是"| CancelRes["取消預約 (驗證所有權)"]
    PB5 -->|"否"| PB6

    PB6{"REBOOK:*？"}
    PB6 -->|"是"| Rebook["取消舊預約 + 重新選日期"]
    PB6 -->|"否"| PB7

    PB7{"SKIP_NOTE？"}
    PB7 -->|"是"| SkipNote["清除 pending_note"]
    PB7 -->|"否"| PBLegacy["Legacy postback<br/>或未處理"]

    style Start fill:#06c755,color:#fff
    style Reject fill:#ef4444,color:#fff
    style Silent fill:#9ca3af,color:#fff
    style SilentSkip fill:#9ca3af,color:#fff
    style Deactivate fill:#f59e0b,color:#fff
    style Activate fill:#10b981,color:#fff
    style Escalate fill:#f59e0b,color:#fff
    style AICall fill:#4285f4,color:#fff
```

---

## 3. 預約取貨狀態機 (Reservation State Machine)

預約從建立到完成的狀態轉換，包含顧客與管理員各自可執行的操作。
對應 `lib/db-reservations.ts` 中的 `Reservation.status` 欄位。

```mermaid
stateDiagram-v2
    [*] --> 查詢可用日期 : 顧客說「預約取貨」

    state "選擇流程" as SelectFlow {
        查詢可用日期 --> 選擇日期 : 顯示日期 Carousel
        選擇日期 --> 選擇時段類型 : SELECT_DATE postback
        選擇時段類型 --> 精確時間 : PICK_TIME_EXACT
        選擇時段類型 --> 彈性時段 : PICK_PERIOD
    }

    精確時間 --> pending : createReservation(bookingType=exact)
    彈性時段 --> pending : createReservation(bookingType=flexible)

    state "預約生命週期" as Lifecycle {
        pending --> confirmed : 管理員確認<br/>(Admin API)
        pending --> cancelled : 顧客取消<br/>(CANCEL_MY_RES)
        pending --> cancelled : 管理員取消<br/>(Admin API)
        confirmed --> completed : 管理員標記完成<br/>(Admin API)
        confirmed --> cancelled : 顧客取消<br/>(CANCEL_MY_RES)
        confirmed --> cancelled : 管理員取消<br/>(Admin API)
    }

    cancelled --> [*]
    completed --> [*]

    pending --> 備註流程 : 提示加備註
    state "備註流程" as NoteFlow {
        備註流程 --> 儲存備註 : 輸入文字 (pending_note)
        備註流程 --> 跳過備註 : SKIP_NOTE postback
    }

    cancelled --> 重新預約 : REBOOK postback
    重新預約 --> 查詢可用日期 : 取消舊預約 + 重新開始

    note right of pending
        pending = 已建立，等待管理員確認
        booking_type: exact | flexible
        flexible_period: afternoon | evening_early | night | tbd
    end note

    note right of confirmed
        confirmed = 管理員已確認
        顧客仍可取消
    end note

    note left of cancelled
        cancelled = 已取消
        可透過 REBOOK 重新預約
    end note
```

---

## 4. 管理員資料流 (Admin Data Flow)

管理員透過 Admin UI 操作資料的完整流程，包含認證、快取失效、
以及資料如何影響下一次 AI 回覆。

```mermaid
flowchart LR
    subgraph AdminUI["Admin UI (React)"]
        Login["登入頁<br/>/admin/login"]
        Dashboard["儀表板<br/>/admin"]
        Products["商品管理<br/>/admin/products"]
        Settings["系統設定<br/>/admin/settings"]
        Examples["回覆範例<br/>/admin/examples"]
        Pickup["預約管理<br/>/admin/pickup"]
        Users["顧客管理<br/>/admin/users"]
    end

    subgraph AuthFlow["認證流程"]
        LoginAPI["POST /api/admin/login<br/>Rate Limited (5次/15min)"]
        JWT["JWT Token (HS256)<br/>有效期 2 小時"]
        VerifyAdmin["verifyAdmin()<br/>每個 Admin API 呼叫都驗證"]
    end

    subgraph AdminAPIs["Admin API Routes"]
        ConfigAPI["POST /api/admin/config<br/>更新系統設定"]
        ProductAPI["GET/POST/DELETE<br/>/api/admin/products"]
        ScrapeAPI["POST /api/admin/scrape<br/>Cyberbiz 全站同步"]
        ExampleAPI["GET/POST/DELETE<br/>/api/admin/examples"]
        PickupAPI["預約時段 + 預約管理<br/>/api/admin/pickup/*"]
        UserAPI["GET /api/admin/users<br/>顧客清單 + 對話摘要"]
    end

    subgraph DataLayer["資料層"]
        Cache["db-cache.ts<br/>記憶體快取<br/>(products/config/examples/stats)<br/>TTL = 5 分鐘"]
        Supabase2["Supabase PostgreSQL<br/>products / system_config<br/>conversation_examples<br/>pickup_availability<br/>reservations"]
    end

    subgraph AIImpact["AI 回覆影響"]
        KBAssembly["knowledge-base.ts<br/>getSystemPrompt()"]
        NextAI["下次 AI 回覆<br/>使用最新資料"]
    end

    %% 認證流程
    Login -->|"email + password"| LoginAPI
    LoginAPI -->|"驗證成功"| JWT
    JWT -->|"存入 localStorage"| AdminUI
    AdminUI -->|"Bearer Token"| VerifyAdmin
    VerifyAdmin -->|"驗證通過"| AdminAPIs

    %% 資料操作
    Settings --> ConfigAPI
    Products --> ProductAPI
    Products --> ScrapeAPI
    Examples --> ExampleAPI
    Pickup --> PickupAPI
    Users --> UserAPI

    %% 寫入 & 快取失效
    ConfigAPI -->|"setConfig()"| Supabase2
    ConfigAPI -->|"cache.config = null"| Cache
    ProductAPI -->|"upsertProduct()"| Supabase2
    ProductAPI -->|"cache.products = null"| Cache
    ExampleAPI -->|"upsertExample()"| Supabase2
    ExampleAPI -->|"cache.examples = null"| Cache
    ScrapeAPI -->|"scrape + upsert"| Supabase2

    %% AI 使用最新資料
    Cache -->|"下次請求重新載入"| KBAssembly
    Supabase2 -->|"cache miss 時查詢"| Cache
    KBAssembly --> NextAI

    style AdminUI fill:#f0f4ff,stroke:#3b82f6
    style AuthFlow fill:#fef3c7,stroke:#f59e0b
    style DataLayer fill:#e8f5e9,stroke:#4caf50
    style AIImpact fill:#ede9fe,stroke:#8b5cf6
```

**快取失效機制說明：**

| 操作                                  | 失效的快取 Key   | 觸發方式                       |
| ------------------------------------- | ---------------- | ------------------------------ |
| `setConfig()` / `deleteConfig()`      | `cache.config`   | 設為 `null`，下次讀取重新查 DB |
| `upsertProduct()` / `deleteProduct()` | `cache.products` | 設為 `null`                    |
| `upsertExample()` / `deleteExample()` | `cache.examples` | 設為 `null`                    |
| `invalidateAllCaches()`               | 全部 key         | 遍歷所有 key 設為 `null`       |

快取 TTL 為 5 分鐘 (`CACHE_TTL = 5 * 60 * 1000`)。寫入操作會立即清除對應快取，
確保下一次 AI 回覆使用最新的設定與商品資料。

---

## 5. AI 回覆管線 (AI Response Pipeline)

從使用者訊息到最終回覆的完整 AI 處理流程，包含 system prompt 組裝、
模型呼叫、failover 機制、與回應解析。

```mermaid
flowchart TD
    UserMsg["使用者訊息"]

    subgraph PromptAssembly["System Prompt 組裝<br/>knowledge-base.ts → getSystemPrompt()"]
        direction TB
        LoadParallel["並行載入三個資料源"]
        ConfigMap["getConfigMap()<br/>系統設定 (mission, rules,<br/>format, shipping, payment...)"]
        ActiveProducts["getActiveProducts()<br/>上架商品 + 口味 + 庫存"]
        ActiveExamples["getActiveExamples()<br/>闆娘回覆範例"]

        LoadParallel --> ConfigMap
        LoadParallel --> ActiveProducts
        LoadParallel --> ActiveExamples

        AssemblePrompt["assemblePrompt()"]
        ConfigMap --> AssemblePrompt
        ActiveProducts --> AssemblePrompt
        ActiveExamples --> AssemblePrompt

        subgraph PromptSections["Prompt 結構"]
            direction TB
            Identity["&lt;identity&gt;<br/>小螞蟻身份 (硬編碼)"]
            Security["&lt;security&gt;<br/>安全規則 (硬編碼)"]
            Mission["&lt;mission&gt;<br/>任務說明"]
            OwnerInst["&lt;owner_instructions&gt;<br/>闆娘指令 (最高優先)"]
            Rules["&lt;rules&gt;<br/>回覆規則"]
            Format["&lt;format&gt;<br/>格式要求"]
            KB["&lt;knowledge_base&gt;<br/>商品/運費/付款/退換..."]
            Reminders["&lt;reminders&gt;<br/>提醒事項"]
        end

        AssemblePrompt --> PromptSections
    end

    subgraph OutputInstructions["輸出指令<br/>ai-client.ts → getProductCardInstruction()"]
        ProductCards["&lt;product_cards&gt;<br/>SHOW_PRODUCTS 格式說明<br/>可用 product ID 列表"]
        ResponseControl["&lt;response_control&gt;<br/>回覆 / 預約取貨 / 轉接 / 靜默<br/>四種判斷邏輯"]
    end

    subgraph GeminiCall["Gemini API 呼叫<br/>ai-client.ts"]
        Sanitize["sanitizeUserInput()<br/>截斷 500 字 / 過濾注入"]
        BuildContents["組裝 contents[]<br/>近 20 則對話歷史 + 當前訊息"]

        Sanitize --> BuildContents

        subgraph FailoverChain["Failover 機制"]
            Primary["Primary: gemini-2.5-flash-lite<br/>Timeout: 8 秒"]
            Failover["Failover: gemini-2.5-flash<br/>Timeout: 15 秒"]
            Fallback["Fallback: 靜態錯誤訊息<br/>(含客服聯絡方式)"]

            Primary -->|"timeout 或 error"| Failover
            Failover -->|"timeout 或 error"| Fallback
        end

        BuildContents --> Primary
    end

    subgraph ResponseParsing["回應解析<br/>parseAIResponse()"]
        RawText["Gemini 原始回覆"]
        StripMD["stripMarkdown()<br/>移除 **bold** / ## headers 等"]

        ParseSignals["解析控制信號"]
        SignalSKIP["SKIP → skip: true"]
        SignalESCALATE["ESCALATE: 原因 → escalate: true"]
        SignalPICKUP["SHOW_PICKUP_LINK → showPickupLink: true"]
        SignalPRODUCTS["SHOW_PRODUCTS: id1, id2<br/>→ productSpecs[]"]

        RawText --> StripMD
        StripMD --> ParseSignals
        ParseSignals --> SignalSKIP
        ParseSignals --> SignalESCALATE
        ParseSignals --> SignalPICKUP
        ParseSignals --> SignalPRODUCTS
    end

    subgraph FinalOutput["最終輸出處理"]
        SplitResp["splitResponse()<br/>每 8 行分段<br/>最多 3 段 (有商品時 2 段)"]
        QuickReply["附加 QuickReply 按鈕<br/>(查看品項/我要訂購/預約取貨...)"]
        ProductCarousel["buildProductCarousel()<br/>Flex Message 商品卡片"]
        ReplyMsg["LINE replyMessage()<br/>最多 5 則訊息"]

        SplitResp --> QuickReply
        QuickReply --> ReplyMsg
        ProductCarousel --> ReplyMsg
    end

    UserMsg --> PromptAssembly
    PromptSections --> GeminiCall
    OutputInstructions --> GeminiCall
    Primary -->|"成功"| ResponseParsing
    Failover -->|"成功"| ResponseParsing
    ResponseParsing --> FinalOutput

    style PromptAssembly fill:#ede9fe,stroke:#8b5cf6
    style GeminiCall fill:#dbeafe,stroke:#3b82f6
    style ResponseParsing fill:#fef3c7,stroke:#f59e0b
    style FinalOutput fill:#e8f5e9,stroke:#4caf50
    style FailoverChain fill:#fee2e2,stroke:#ef4444
```

**AI 模型選擇邏輯：**

| 優先順序 | 來源                     | 說明                                 |
| -------- | ------------------------ | ------------------------------------ |
| 1        | `system_config.ai_model` | 管理員在後台設定的模型               |
| 2        | `DEFAULT_MODEL`          | `gemini-2.5-flash-lite` (預設)       |
| 3        | `FAILOVER_MODEL`         | `gemini-2.5-flash` (failover 時使用) |

**回應控制信號：**

| 信號                 | 觸發條件        | 系統行為                       |
| -------------------- | --------------- | ------------------------------ |
| `SKIP`               | AI 判定不需回覆 | 靜默 (auto_respond 使用者除外) |
| `ESCALATE: 原因`     | 需要真人處理    | 安撫訊息 + 停用機器人          |
| `SHOW_PICKUP_LINK`   | 顧客想預約取貨  | 文字 + 日期選擇 Carousel       |
| `SHOW_PRODUCTS: ids` | 提及具體商品    | 文字 + 商品卡片 Carousel       |

---

## 附錄：API Routes 總覽

| Route                            | Method          | 認證        | 用途                 |
| -------------------------------- | --------------- | ----------- | -------------------- |
| `/api/line/webhook`              | POST            | LINE 簽章   | LINE 訊息進入點      |
| `/api/chat`                      | POST            | 無          | Web Chat API         |
| `/api/admin/login`               | POST            | Rate Limit  | 管理員登入，發放 JWT |
| `/api/admin/config`              | GET/POST        | JWT         | 系統設定 CRUD        |
| `/api/admin/products`            | GET/POST/DELETE | JWT         | 商品 CRUD            |
| `/api/admin/scrape`              | POST/PUT        | JWT         | Cyberbiz 商品同步    |
| `/api/admin/examples`            | GET/POST/DELETE | JWT         | 回覆範例 CRUD        |
| `/api/admin/pickup/availability` | GET/POST/DELETE | JWT         | 取貨時段管理         |
| `/api/admin/pickup/reservations` | GET/PATCH       | JWT         | 預約管理             |
| `/api/admin/pickup/slots`        | GET             | JWT         | 時段查詢             |
| `/api/admin/users`               | GET             | JWT         | 顧客清單 + 對話摘要  |
| `/api/booking/slots`             | GET             | 無          | LIFF 取貨時段查詢    |
| `/api/booking/reserve`           | POST            | 無          | LIFF 建立預約        |
| `/api/liff/reservations`         | GET/PATCH       | lineUserId  | LIFF 預約查詢/修改   |
| `/api/cron/sync`                 | GET             | CRON_SECRET | Vercel Cron 商品同步 |
| `/api/calendar/feed`             | GET             | 無          | iCal 格式預約匯出    |
