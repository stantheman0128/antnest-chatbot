# 比賽繳交影片腳本

> 預估時長：3-5 分鐘
> 格式：露臉講解 + 螢幕錄影穿插

---

## 開場（30 秒）

嗨大家好，我是 Stan，這次要跟大家分享我用 Claude Code 搭配 Zeabur Skills 做的一個專案 —— **螞蟻窩甜點 AI 客服系統**。

---

## Part 1：為什麼做這個？（30 秒）

螞蟻窩甜點是一個真實的甜點品牌，闆娘平常透過 LINE 跟客人溝通，但因為問題太多、太重複了 —— 「有什麼口味？」「運費多少？」「怎麼下單？」—— 忙不過來。

所以我做了一個 **AI 客服 LINE Bot**，讓 AI 自動回覆常見問題，闆娘只需要處理退換貨、客訴這些需要人介入的事情。

---

## Part 2：功能介紹（1 分鐘）

這個系統有幾個核心功能：

1. **雙層 AI 回覆** —— 先用關鍵字比對快速回覆，遇到複雜問題才交給 AI
2. **LINE Bot 整合** —— 直接在 LINE 對話，支援多輪對話歷史、商品卡片、預約按鈕
3. **LIFF 預約系統** —— 客人可以在 LINE 裡面直接預約取貨時段
4. **Admin 管理後台** —— 闆娘可以管理產品、設定 AI 回覆規則、看客戶統計
5. **Cyberbiz 自動同步** —— 自動從官網同步產品資料和庫存狀態

（螢幕展示：LINE 對話畫面、Admin 後台、LIFF 預約頁面）

---

## Part 3：遷移到 Zeabur + Skills 使用過程（1.5 分鐘）

這次比賽，我把整個專案從 Vercel 遷移到 Zeabur，全程用 Claude Code + Zeabur Skills 完成。

來跟大家展示我用了哪些 Skills：

1. **zeabur-server-catalog + zeabur-server-rent** —— 用對話的方式瀏覽 VPS 方案，租了一台 Tencent Cloud Tokyo 伺服器，$2 美金一個月
2. **zeabur-project-create + zeabur-deploy** —— 建專案、一行指令部署 Next.js 應用
3. **zeabur-variables** —— 直接從 .env 檔匯入 12 個環境變數，不用手動一個個貼
4. **zeabur-ai-hub** —— 開通 AI Hub，拿 API key，讓 chatbot 透過 Zeabur 的 AI Hub 呼叫 Gemini 模型
5. **zeabur-domain-register** —— 搜尋並購買了 antnest-dessert.com 域名
6. **zeabur-domain-dns** —— 自動設定 A record 和 CNAME
7. **zeabur-deployment-logs + zeabur-restart** —— 查看 build log 除錯、重啟服務

總共用了 **15 個 Skills**，幾乎涵蓋了 Zeabur 的所有功能。

（螢幕展示：Claude Code 終端機畫面，展示幾個關鍵指令的執行過程）

---

## Part 4：開源貢獻（30 秒）

在使用過程中，我發現 Zeabur CLI 的 `domain search` 指令有一個 bug —— 如果你搜尋的時候沒有帶 TLD，比如直接打 `zeabur domain search antnest`，它會回傳「不可用」，但其實只是格式不對。

我去看了 source code，找到問題在 `search.go` 裡面少了一個驗證，修好後直接開了 PR，已經被 approve 了。

（螢幕展示：GitHub PR #220 畫面）

---

## Part 5：商業落地性（30 秒）

這不只是一個 side project —— 它**已經在線上運作**，真正幫助螞蟻窩甜點的闆娘處理客服問題。

- LINE Bot 已經串接到螞蟻窩的官方帳號
- 每天都有真實客人透過 AI 客服詢問產品、價格、運費
- Admin 後台讓闆娘可以自己管理 AI 的回覆，不需要工程師介入
- 預約系統讓面交自取的流程更有效率

遷移到 Zeabur 之後，所有的基礎設施管理都可以透過 Claude Code + Skills 用對話完成，不用再切到各種 dashboard。

---

## 結尾（15 秒）

以上就是我的作品分享，感謝大家觀看！如果你也想試試 Zeabur Skills，可以直接在 Claude Code 裡面安裝來玩玩看。謝謝！
