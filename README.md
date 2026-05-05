# Family Pay PoC

LINE Bot + LIFF 家庭代墊系統 PoC。

## PoC 階段目標
- Node.js ESM + Express
- LINE Bot webhook（follow 歡迎、postback 5 個「待開發」回覆）
- LIFF Hello 頁（顯示登入者暱稱）
- Rich Menu 六宮格（第 1 格開 LIFF、其他 5 格 postback）
- 不接 DB（PoC 階段）
- 部署到 Render 免費方案

---

## Repo 結構
```
family-pay/
├── package.json
├── server.js
├── routes/
│   ├── webhook.js
│   ├── liff.js
│   └── config.js
├── public/
│   └── liff/
│       └── hello.html
├── richmenu/
│   ├── richmenu.json
│   ├── generate-png.js
│   └── upload.js
├── .env.example
├── .gitignore
└── README.md
```

---

## 本機啟動

```bash
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
# 編輯 .env 填入金鑰
npm start
```

開啟 http://localhost:3000 確認 server 跑起來。

---

## 環境變數

| 變數 | 說明 |
|---|---|
| `PORT` | 預設 3000；Render 會自動注入 |
| `LINE_CHANNEL_SECRET` | LINE Messaging API Channel Secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API Channel Access Token (long-lived) |
| `LIFF_ID` | LIFF App ID |
| `PUBLIC_BASE_URL` | 部署後的 URL，例如 `https://family-pay.onrender.com` |

---

## 端點

| 路徑 | 方法 | 用途 |
|---|---|---|
| `/` | GET | 首頁（健康檢查） |
| `/api/config` | GET | 回傳 `{ liffId }` 給前端 |
| `/liff/hello` | GET | LIFF Hello 頁 |
| `/webhook` | POST | LINE Messaging API webhook |

---

## 總裁部署 SOP

### Step 1：LINE Developers — 拿金鑰
1. 進入 https://developers.line.biz/console/ 用 LINE 帳號登入
2. 建立 **Provider**：例如「Dario 家庭工具」
3. 在 Provider 下建立 **Messaging API Channel**：
   - Channel name：`家庭代墊管家`
   - Category：個人 → Subcategory：工具
4. 在 Channel **Basic settings** 取得：`Channel Secret`
5. 在 Channel **Messaging API** 分頁按「Issue」取得：`Channel Access Token (long-lived)`
6. 同 Channel 下建立 **LIFF App**：
   - Endpoint URL 先填 `https://example.com`（部署後再改）
   - Size：Full
   - Scope：勾 `profile`、`openid`
   - 取得 `LIFF ID`
7. **Auto-reply**、**Greeting messages** 全部關閉（避免跟 webhook 打架）

### Step 2：建立 GitHub repo + push
```bash
cd family-pay
git init
git add .
git commit -m "init family pay poc"
git branch -M main
git remote add origin https://github.com/你的帳號/family-pay.git
git push -u origin main
```

### Step 3：Render 部署
1. 進入 https://render.com 用 GitHub 登入（不用綁信用卡）
2. New → Web Service → 選 GitHub repo `family-pay`
3. 設定：
   - Runtime：`Node`
   - Build Command：`npm install`
   - Start Command：`npm start`
   - Plan：`Free`
4. Environment Variables 加入：
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LIFF_ID`
   - `PUBLIC_BASE_URL`（暫時填 `https://family-pay.onrender.com`，部署後拿到實際 URL 再回填）
5. Deploy 等候建置完成
6. 拿到 URL：例如 `https://family-pay-xxxx.onrender.com`

### Step 4：LINE Webhook URL 設定
1. 回到 LINE Developers → Messaging API Channel → Messaging API 分頁
2. **Webhook URL** 填：`https://family-pay-xxxx.onrender.com/webhook`
3. 開啟 **Use webhook**
4. 按 **Verify** → 應顯示 `Success`

### Step 5：LIFF Endpoint URL 設定
1. 回到 LIFF App 設定
2. **Endpoint URL** 改成：`https://family-pay-xxxx.onrender.com/liff/hello`

### Step 6：本機跑 Rich Menu 上傳腳本
```bash
# 確保 .env 已填入 LINE_CHANNEL_ACCESS_TOKEN 與 LIFF_ID
npm install
npm run upload-richmenu
```

成功會看到：
```
Rich menu image generated: .../richmenu/richmenu.png
Rich menu uploaded successfully.
Rich menu ID: richmenu-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 7：加好友測試
1. 在 LINE Developers Channel 頁面拿 QR code
2. 用手機 LINE 掃 QR code 加 Bot 好友
3. 確認：
   - [ ] 收到歡迎訊息「歡迎加入家庭代墊系統！請點選下方選單開始使用。」
   - [ ] 聊天室底部顯示六宮格 Rich Menu
   - [ ] 點第 1 格「家庭代墊」→ 開啟 LIFF 頁顯示「Hello, {你的暱稱}」
   - [ ] 點第 2-6 格 → Bot 回覆對應「XX 功能尚在開發中」

全部 ✓ → P1 PoC 過關，可以進入 P2 後端 MVP 開發。

---

## 卡關常見原因
| 症狀 | 原因 |
|---|---|
| Webhook Verify 失敗 | `LINE_CHANNEL_SECRET` 沒設、或 webhook router 順序錯 |
| LIFF 開啟白屏 | `LIFF_ID` 沒設、或 LIFF Endpoint URL 跟部署 URL 不一致 |
| Rich Menu 上傳 400 | 圖片尺寸不對（必須 2500x1686）、areas 座標超範圍、或 access token 過期 |
| Render 部署失敗 | `package.json` engines 沒指定、或 sharp 在 Render 安裝失敗（看 build log） |

---

## PoC 階段刻意不做
- DB 連線（Supabase）
- 代墊資料新增 / 查詢
- 圓餅圖統計
- 請款訊息產生
- 月終提醒
- 多家人權限

以上等 P2 MVP 階段再加。
