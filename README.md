# 國中歷史數位互動作業教學平台 (CAI Hub)

依據教育部 108 課綱國中歷史科編製之互動式學習與作業平台。

---

## 專案架構概覽

```text
.
├── index.html        # 課程入口首頁（目前開放第一課，其餘為預告卡片）
├── hub.css           # 入口首頁樣式，使用原生 CSS
│
└── G2B3/             # 【第 1 課】商周至隋唐的國家與社會（獨立完整專案）
    ├── index.html    # 第 1 課作業主頁（重點講義 ✕ 5道闖關遊戲）
    ├── style.css     # 遊戲與講義樣式表
    ├── app.js        # 核心遊戲關卡邏輯與成績登記系統
    ├── detective.js  # 歷史除錯關卡
    ├── maze-scene.bundle.js # 3D時空迷宮打包
    ├── maze-adventure.js    # 迷宮控制
    ├── gas/          # Google Apps Script 後端程式與 clasp 設定
    └── vendor/       # Three.js 等函式庫
```

---

## 獨立性與隔離規範

1. **Google OAuth 隔離**：
   - 各單元擁有獨立的 Google Client ID 與設定，根目錄不加載 Google 登入 SDK，絕不造成狀態衝突。
2. **GAS（試算表成績系統）隔離**：
   - 各單元的後端 Apps Script 與試算表均獨立配置，彼此資料表結構與 API 端點互不干擾。
3. **路徑相對引用**：
   - 各章節內部皆使用相對路徑，可獨立部署或透過 Hub 入口跳轉。

## 本機開發與驗證

前端使用原生 HTML/CSS/JavaScript，直接開啟 `index.html` 即可閱讀及練習。
Google 登入需透過已設定 OAuth 來源的 HTTP/HTTPS 網址使用。

在根目錄執行（需 Node.js 與 Microsoft Edge）：

```powershell
npm ci
npm test
npm run test:browser
```

`npm test` 驗證成績上傳、憑證簽章、拒絕無效身分及重試去重；不存取正式試算表。
瀏覽器測試涵蓋迷宮、歷史除錯及手機操作。也可用 `PLAYWRIGHT_MODULE` 指定既有 Playwright 套件的絕對路徑。
修改迷宮場景後執行 `npm run build:maze`；後端密碼學套件更新後執行 `npm run build:auth`。

## 成績登錄與部署

- 未登入者可以練習及取得證書；不會用假 Email 上傳。
- 成績只在後端確認寫入並回傳同一作業識別碼後顯示成功。連線失敗會提示重試；同一頁面的同一份作業重試不會重複寫入。
- 已完成作業可在證書區重新登入並重試上傳。重新整理頁面會清除遊戲與登入狀態，請先完成上傳或複製成績報告。
- 後端驗證 Google RSA 簽章、用戶端 ID、簽發者、有效期限、已驗證 Email 與學校 `hd` 網域；不採用前端自行傳入的 Email。
- 分數目前仍由前端計算；後端範圍檢查並不等同伺服器重新計分或完整防作弊。

部署步驟見 [G2B3/gas/README.md](G2B3/gas/README.md)。前後端必須配套更新，舊版 GAS 不支援新的憑證驗證與回執。

`graphify-out/` 為可重建的分析輸出，已排除 Git 追蹤。分析自有程式時應排除 `vendor/`、`maze-scene.bundle.js`、`gas/Forge.js` 與 `node_modules/`，避免第三方程式淹沒課程邏輯。
