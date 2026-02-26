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

## Running Modes

There are three ways to run this chatbot, each suited to a different use case:

### Local (本地開發)

Runs the Next.js dev server on your own machine. Best for development and testing before deploying.

- The web chat UI is served at `http://localhost:3000`
- Changes to code are reflected immediately (hot reload)
- API keys are read from `.env.local` on your filesystem
- The LINE webhook **cannot** receive messages from LINE in this mode (LINE requires a public HTTPS URL); use a tunnel tool like `ngrok` if you need to test LINE locally

```bash
npm install
# add GOOGLE_AI_API_KEY (and LINE keys if needed) to .env.local
npm run dev
# open http://localhost:3000
```

### Background (背景服務)

Runs the production build as a long-lived Node.js process on a server you control (e.g. a VPS or on-prem machine). This is useful when you want a stable, always-on deployment without depending on a managed cloud platform.

- Build once, then start the server process in the background
- The process keeps running after you log out (use `pm2`, `nohup`, or a systemd service)
- You are responsible for the server, SSL termination (required for LINE webhook), and uptime

```bash
npm run build
# run in background with pm2 (install once: npm i -g pm2)
pm2 start npm --name antnest-chatbot -- start
```

### Cloud (雲端部署)

Deploys to a managed platform (Vercel is the default choice for this project). This is the recommended mode for production.

- Push to the `main` branch → Vercel automatically builds and deploys
- LINE webhook is publicly reachable over HTTPS with no extra configuration
- Environment variables are set in the Vercel Dashboard (not `.env.local`)
- Serverless architecture means no idle cost; each API call spins up on demand

See [LINE_SETUP.md](./LINE_SETUP.md) for the full Vercel + LINE setup guide.

---

| | Local | Background | Cloud |
|---|---|---|---|
| **Best for** | Development & testing | Self-hosted production | Managed production |
| **LINE webhook** | ❌ Needs tunnel | ✅ With SSL setup | ✅ Out of the box |
| **Always-on** | No (manual start) | Yes (process manager) | Yes (Vercel serverless) |
| **Env vars** | `.env.local` | `.env.local` / system env | Vercel Dashboard |
| **Cost** | Free | Server cost | Free (Vercel hobby tier) |

## 本地開發

1. 安裝依賴
```bash
npm install
```

2. 設定環境變數（`.env.local`）
```env
GOOGLE_AI_API_KEY=your_google_ai_key
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
