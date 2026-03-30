# LINE Bot 整合指南

## 📋 前置準備

### 1. 建立 LINE Official Account

1. 到 [LINE Official Account Manager](https://manager.line.biz/)
2. 登入並建立新帳號
3. 填寫店家資訊（螞蟻窩甜點）

### 2. 建立 Messaging API Channel

1. 到 [LINE Developers Console](https://developers.line.biz/)
2. 建立新的 Provider（如「Antnest Dessert」）
3. 建立 Messaging API Channel
4. 取得以下資訊：
   - **Channel Secret**（在 Basic settings）
   - **Channel Access Token**（在 Messaging API → 點擊 Issue）

### 3. 設定環境變數

編輯 `.env.local`，填入剛才取得的資訊：

```env
LINE_CHANNEL_ACCESS_TOKEN=你的_channel_access_token
LINE_CHANNEL_SECRET=你的_channel_secret
GOOGLE_AI_API_KEY=你的_google_ai_key
```

---

## 🚀 部署到 Vercel

### Step 1: 推送到 GitHub

```bash
cd C:\Users\stans\antnest-chatbot
git init
git add .
git commit -m "Initial commit: ANT NEST chatbot MVP"
git branch -M main
git remote add origin https://github.com/你的用戶名/antnest-chatbot.git
git push -u origin main
```

### Step 2: 連接 Vercel

1. 到 [Vercel](https://vercel.com/) 註冊/登入
2. 點擊 **"New Project"**
3. Import 你的 GitHub repo
4. 設定環境變數（Settings → Environment Variables）：
   - `GOOGLE_AI_API_KEY`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `ADMIN_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. 點擊 **Deploy**

### Step 3: 設定 LINE Webhook URL

1. 部署完成後，複製你的 Vercel URL（例如：`https://antnest-chatbot.vercel.app`）
2. 回到 LINE Developers Console → Messaging API
3. 設定 **Webhook URL**：
   ```
   https://你的vercel網址.vercel.app/api/line/webhook
   ```
4. 點擊 **Verify** 確認連線
5. 開啟 **Use webhook**

---

## ✅ 測試

1. 在 LINE Developers Console 取得你的 **Bot QR Code**
2. 用手機掃描加入好友
3. 傳訊息測試：
   - 「有什麼甜點？」（模板回答）
   - 「500元可以買什麼」（AI 回答）

---

## 🎨 進階設定（選配）

### Rich Menu（圖文選單）

在 LINE Official Account Manager：

- 設定常用按鈕（產品目錄、聯絡我們、最新優惠等）
- 連結到官網或觸發特定關鍵字

### Auto Reply 設定

關閉預設的自動回覆（改用我們的 chatbot）：

- LINE Official Account Manager → 回應設定
- 關閉「自動回應訊息」
- 開啟「Webhook」

### 多輪對話

已支援。LINE 聊天會自動保存對話歷史到 Supabase `line_users` 表，AI 會參考上下文回覆。

---

## 📊 監控

- Vercel Dashboard 可查看 API 呼叫次數、錯誤率
- LINE Developers Console 可查看訊息數量統計
- Server logs 在 Vercel → Deployments → Logs

---

## 💰 成本估算

- **Vercel**: 免費方案（每月 100GB bandwidth）
- **Google Gemini**: 免費 1,000 requests/day
- **Supabase**: 免費方案（500MB database, 1GB storage）
- **LINE Messaging API**: 免費（每月 500 則免費訊息）

預估中小型甜點店流量完全免費！

---

## 🆘 常見問題

### Webhook 驗證失敗

- 確認 Vercel 部署成功
- 確認 URL 格式正確（`/api/line/webhook`）
- 確認環境變數設定正確

### 機器人不回應

- 檢查 Vercel logs 有無錯誤
- 確認 Webhook 已開啟
- 確認 Auto Reply 已關閉

### AI 回答太慢

- Gemini 正常 1-3 秒
- 若超過 5 秒，檢查 API key 是否正確
- 系統已內建 25s fallback 訊息 + 60s timeout
