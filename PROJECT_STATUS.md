# 螞蟻窩甜點客服機器人 — 專案狀態文件

最後更新：2026-02-11

---

## 一、專案概覽

- 專案名稱：螞蟻窩甜點 AI 客服聊天機器人
- 目標：為螞蟻窩甜點（ANT NEST）建立智能客服，最終整合進 LINE 官方帳號
- 狀態：MVP 已完成並部署，進入優化階段
- GitHub：https://github.com/stantheman0128/antnest-chatbot
- 線上版：https://antnest-chatbot.vercel.app
- LINE Bot：已串接，alpha 測試中

---

## 二、目前架構（V1 — MVP）

```
使用者訊息
    ↓
Tier 1：關鍵字意圖比對 (intent-matcher.ts)
    ├─ 命中 → 模板回答 (faq-pairs.json)
    └─ 未命中 ↓
Tier 2：AI 生成回答
    └─ 整包知識庫 (~3000 tokens) 塞進 system prompt
    └─ 呼叫 Groq API → Llama 3.1 8B Instant
    └─ 回傳結果
```

### 技術棧
- 框架：Next.js 16 (App Router) + TypeScript + Tailwind CSS
- AI 模型：Groq Llama 3.1 8B Instant (Runtime Bot)
- 部署：Vercel（自動部署，push to main 觸發）
- LINE 整合：@line/bot-sdk，webhook endpoint at /api/line/webhook
- 知識庫：JSON + Markdown 靜態檔案，直接塞進 system prompt

### 關鍵檔案
- `lib/intent-matcher.ts` — 關鍵字意圖比對引擎
- `lib/ai-client.ts` — Groq API 呼叫（OpenAI SDK 相容）
- `lib/knowledge-base.ts` — 載入 system-prompt.md
- `app/api/chat/route.ts` — 網頁聊天 API
- `app/api/line/webhook/route.ts` — LINE Bot webhook
- `data/system-prompt.md` — AI 知識庫（純文字，無 Markdown 格式）
- `data/faq-pairs.json` — 16 個意圖的關鍵字 + 模板回答
- `data/products.json` — 7 個產品資料
- `.env.local` — GROQ_API_KEY, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET

---

## 三、目前遇到的問題

### 問題 1：LLM 模型能力不足（根本問題）

Llama 3.1 8B 無法滿足需求：
- 格式控制差：反覆輸出 `**粗體**` Markdown 語法，LINE 不支援
- 中文理解力不足：口語化問句（「我很愛吃巧克力有推薦嗎」）理解困難
- 多層指令跟隨弱：知識庫 + 格式規則 + 行為限制同時存在時會丟東忘西
- 推理能力不足：「湊到 2000 免運要買什麼組合」這類計算型問題表現差
- 抗 prompt injection 差：情緒性發言（「笑屁笑」）會認真回應而非拒絕

### 問題 2：Intent Matcher 設計缺陷

已部分修正，但仍有結構性問題：
- 關鍵字比對是靜態的，無法理解語意
- 無法區分「運費多少」（直接 FAQ）和「怎麼買才能免運」（需要 AI 推理）
- 多個意圖同分時缺乏消歧機制
- 目前的修正方案（訊息長度門檻 + 推理信號詞）是 heuristic，不夠 robust

已做的修正：
- greeting 只在短訊息（<=10 字）觸發
- 超過 12 字且只命中 1 個關鍵字 → 交給 AI
- 包含推理信號詞（推薦/建議/比較/適合等）→ 直接交給 AI
- 多個意圖同分 → 交給 AI

### 問題 3：系統無法從錯誤中學習

- 沒有對話紀錄資料庫
- 沒有反饋機制（無法標記 bad response）
- 每次發現問題只能手動改 system prompt 或 faq-pairs.json
- 容易陷入 overfitting（針對特定案例修改而非解決根因）

### 問題 4：知識檢索方式粗糙

- 每次 AI 呼叫都塞入完整知識庫（~3000 tokens）
- 不管問什麼都看到全部資料，增加幻覺風險
- 沒有 relevance scoring，AI 可能從不相關的段落抓資訊回答

---

## 四、接下來的行動計畫

### Phase 2A：模型升級（優先）

將 Runtime Bot 從 Llama 3.1 8B 升級到更強的模型。

候選模型（依推薦度排序）：

1. Gemini 2.5 Flash — 免費 1500 req/天，中文強，指令跟隨好，速度快
2. DeepSeek V3 — 中文最好，便宜（$0.28/$0.42 per 1M tokens）
3. Llama 3.3 70B on Groq — 仍可用 Groq 快速推理，能力大幅提升
4. GPT-4o-mini — 指令跟隨很強，成本適中

實作改動：
- 修改 `lib/ai-client.ts` 的 model、baseURL、API key
- 修改 `.env.local` 的環境變數
- 測試格式遵守、中文理解、推理能力

### Phase 2B：Prompt 架構重構

套用 Prompt Engineering 最佳實踐：

1. XML 標籤隔離：把指令、格式規則、知識庫明確分開
   ```xml
   <instruction>核心任務和行為規則</instruction>
   <format_rules>格式限制</format_rules>
   <knowledge_base>產品和政策資訊</knowledge_base>
   <corrections>動態注入的修正規則（來自 Correction DB）</corrections>
   ```

2. 抽象佔位符：回答範例使用 {{PRODUCT_NAME}}、{{PRICE}} 而非具體產品名
3. Meta-instruction：明確宣告範例的用途是「格式參考」而非「內容範本」

### Phase 2C：RAG 系統導入

從「整包知識庫塞 prompt」改為「檢索相關片段」：

1. Router（意圖分類）：
   - Store_Info → 靜態資料表（地址、營業時間等）
   - Product_Query → Vector DB + Metadata Filter
   - Product_Detail → 特定產品 ID 檢索
   - Needs_Reasoning → AI 搭配完整 context
   - Off_Topic → 拒絕

2. 索引策略（Parent-Child）：
   - Child Chunk（檢索用）：口感描述、關鍵特色的向量
   - Parent Chunk（回傳用）：完整產品資訊
   - Metadata：Price, Allergens, Alcohol, Temperature, Flavors

3. 生成防護：
   - Similarity Score < 0.7 → fallback（不強行生成）
   - 只基於 Retrieved Context 回答

### Phase 2D：Reflexion 反饋機制（Human-in-the-loop）

建立自動化優化迴圈：

1. chat_logs 表：紀錄所有對話（query, response, context, status）
2. feedback_knowledge_base 表（糾錯記憶庫）：
   - original_query_embedding：向量檢索相似情境
   - trigger_category：錯誤類型（hallucination, tone, logic）
   - bad_example_abstract：抽象化的錯誤描述
   - user_critique：管理員反饋
   - correction_rule：AI 轉譯後的修正原則
   - corrected_example_abstract：抽象化的正確範例

3. Optimization Agent：
   - 後台 AI，讀取 {Query, Bad_Response, Admin_Critique}
   - 產出根源分析 + 通用修正規則（非針對特定案例）
   - 規則存入 Correction Vector DB

4. Runtime 動態注入：
   - 新問題進來 → 搜尋 Correction DB 有無類似的前車之鑑
   - 相似度 > 0.85 → 動態插入修正規則到 prompt
   - 讓系統越用越聰明，且由人類主導進化方向

---

## 五、架構演進路線圖

```
V1（目前）
├─ 關鍵字比對 + 模板
├─ 整包知識庫 → Llama 3.1 8B
└─ 手動調整 prompt

    ↓ Phase 2A: 模型升級

V1.5
├─ 關鍵字比對 + 模板
├─ 整包知識庫 → Gemini 2.5 Flash（或其他強模型）
├─ XML 結構化 prompt
└─ 手動調整 prompt

    ↓ Phase 2B-C: RAG + 結構化檢索

V2
├─ Router 意圖分類
├─ Vector DB 語意檢索 + Metadata Filter
├─ Parent-Child 索引策略
├─ 強模型生成（Gemini Flash）
└─ Similarity Score 防護

    ↓ Phase 2D: 反饋迴圈

V3
├─ 全部 V2 功能
├─ chat_logs 對話紀錄
├─ feedback_knowledge_base 糾錯記憶庫
├─ Optimization Agent（DeepSeek R1 / Claude Sonnet）
├─ 動態修正規則注入
└─ 管理後台（標記 good/bad、查看分析）
```

---

## 六、環境與部署資訊

### 本地開發
- 專案路徑：C:\Users\stans\antnest-chatbot
- 啟動指令：npm run dev（會在 localhost:3000 或可用 port）
- OneDrive 路徑有中文字元問題，已搬到 C:\Users\stans\antnest-chatbot

### 部署
- Vercel 自動部署：push to main → 自動 build & deploy
- 環境變數在 Vercel Dashboard 設定（GROQ_API_KEY, LINE_*)
- 部署 URL：https://antnest-chatbot.vercel.app

### API Keys（在 .env.local）
- GROQ_API_KEY：Groq API（Runtime Bot）
- LINE_CHANNEL_ACCESS_TOKEN：LINE Messaging API
- LINE_CHANNEL_SECRET：LINE Webhook 驗證

### Git
- Remote：https://github.com/stantheman0128/antnest-chatbot.git
- Branch：main
- User：stantheman0128 / pohans@andrew.cmu.edu

---

## 七、重要設計原則（已學到的教訓）

1. 不要 overfit：不要針對特定失敗案例寫死修正，要找根因並寫通用規則
2. System prompt 本身的格式會影響 AI 輸出：prompt 裡用 **粗體** → AI 也會輸出 **粗體**
3. Intent matcher 應該保守：不確定就交給 AI，AI 是 cheap 的（Groq 免費）
4. 手機優先排版：段落短、空行多、不要一坨文字
5. 推理類問題一律交 AI：推薦、比較、計算、組合都不該用模板
6. 兩種模型各司其職：Runtime Bot 要快要穩，Optimization Agent 要聰明
