# 螞蟻窩甜點智能客服

ANT NEST Dessert AI Customer Service Chatbot

## 功能特色

- 🤖 雙層回答架構：模板比對（快速、免費）+ AI 生成（靈活、智能）
- 💬 支援網頁聊天界面
- 📱 可整合 LINE Official Account
- 🚀 使用 Groq Llama 3.1 8B（超快回應速度 1-2 秒）
- 💰 成本最佳化：模板處理 70% 常見問題，AI 處理 30% 複雜問題
- 🛡️ 防護機制：只回答甜點店相關問題

## 技術架構

- **框架**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **AI 模型**: Groq Llama 3.1 8B Instant
- **部署**: Vercel
- **LINE 整合**: @line/bot-sdk

## 專案結構

```
antnest-chatbot/
├── app/                      # Next.js App Router
│   ├── api/
│   │   ├── chat/            # 網頁聊天 API
│   │   └── line/webhook/    # LINE Bot webhook
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/              # React 元件
│   ├── ChatWindow.tsx
│   ├── MessageBubble.tsx
│   ├── ChatInput.tsx
│   └── QuickReplies.tsx
├── lib/                     # 核心邏輯
│   ├── intent-matcher.ts   # 關鍵字比對引擎
│   ├── ai-client.ts        # Groq API 整合
│   ├── knowledge-base.ts   # 知識庫載入
│   └── template-responses.ts
├── data/                    # 知識庫資料
│   ├── products.json       # 產品目錄
│   ├── store-info.json     # 店鋪資訊
│   ├── policies.json       # 政策說明
│   ├── faq-pairs.json      # FAQ 意圖與回答
│   └── system-prompt.md    # AI 系統提示
└── LINE_SETUP.md           # LINE Bot 部署指南
```

## 本地開發

1. 安裝依賴
```bash
npm install
```

2. 設定環境變數（`.env.local`）
```env
GROQ_API_KEY=your_groq_api_key
LINE_CHANNEL_ACCESS_TOKEN=your_line_token
LINE_CHANNEL_SECRET=your_line_secret
```

3. 啟動開發伺服器
```bash
npm run dev
```

4. 開啟瀏覽器 http://localhost:3000

## 部署到 Vercel

詳見 [LINE_SETUP.md](./LINE_SETUP.md)

## License

MIT

---

Built with ❤️ for ANT NEST Dessert by Claude Code
