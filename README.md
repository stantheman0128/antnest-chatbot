# 螞蟻窩甜點智能客服

ANT NEST Dessert AI Customer Service System

## 功能

- AI 客服聊天（網頁 + LINE Bot）
- 雙層回答：關鍵字模板（快速）+ Gemini AI 生成（智能）
- 多輪對話記憶（LINE 聊天支援上下文）
- AI 自動 failover（主模型掛掉自動切換）
- 管理後台（產品、設定、客戶 Dashboard、預約管理）
- 預約系統（日期 + 彈性時段 + iCal 匯出）
- LIFF 預約頁面（LINE 內外皆可用）
- Cyberbiz 產品自動同步（每週 cron）

## 技術架構

| 類別    | 技術                                                   |
| ------- | ------------------------------------------------------ |
| 框架    | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 |
| AI 模型 | Google Gemini 3.1 Flash-Lite Preview                   |
| 資料庫  | Supabase (PostgreSQL)                                  |
| 認證    | JWT (2h expiry) + rate limiting                        |
| LINE    | @line/bot-sdk + @line/liff                             |
| 部署    | Vercel (auto-deploy)                                   |

## 專案結構

```
antnest-chatbot/
├── app/
│   ├── api/
│   │   ├── chat/              # 網頁聊天 API
│   │   ├── line/webhook/      # LINE Bot webhook
│   │   ├── booking/           # 預約 API (slots, reserve)
│   │   ├── calendar/feed/     # iCal 匯出
│   │   ├── cron/sync/         # 自動同步 Cyberbiz
│   │   ├── liff/reservations/ # LIFF 預約 API
│   │   └── admin/             # 管理後台 API (JWT 保護)
│   ├── admin/                 # 管理後台頁面
│   ├── booking/               # 獨立預約頁面
│   ├── liff/booking/          # LIFF 預約頁面
│   └── page.tsx               # 聊天介面首頁
├── components/                # React 元件 (Chat UI)
├── lib/                       # 核心邏輯 (20 個模組)
│   ├── ai-client.ts           # Gemini API + auto-failover
│   ├── intent-matcher.ts      # 關鍵字意圖比對
│   ├── knowledge-base.ts      # 動態知識庫載入
│   ├── admin-auth.ts          # JWT 認證
│   ├── supabase.ts            # Supabase client
│   ├── db-*.ts                # 資料庫 CRUD 模組 (6 個)
│   ├── flex-message.ts        # LINE Flex Message
│   └── ...
└── data/                      # 靜態知識庫 (fallback)
    ├── products.json
    ├── faq-pairs.json
    ├── store-info.json
    ├── policies.json
    └── system-prompt.md
```

## 本地開發

```bash
npm install
# 設定 .env.local (見下方)
npm run dev
# 開啟 http://localhost:3000
```

### 環境變數 (.env.local)

```env
GOOGLE_AI_API_KEY=your_key
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
ADMIN_SECRET=your_admin_secret
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
```

## 部署

Push to `main` branch → Vercel 自動 build & deploy。

環境變數在 Vercel Dashboard → Settings → Environment Variables 設定。

## LINE Bot 設定

1. [LINE Developers Console](https://developers.line.biz/) 建立 Messaging API Channel
2. 取得 Channel Secret + Channel Access Token
3. 設定 Webhook URL：`https://antnest-chatbot.vercel.app/api/line/webhook`
4. 開啟 Use webhook，關閉自動回覆

## 詳細文件

- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — 完整進度、架構、roadmap
- [tasks/pos-system-plan.md](./tasks/pos-system-plan.md) — POS 系統開發計畫

## License

MIT

---

Built with Claude Code for ANT NEST Dessert
