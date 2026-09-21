# 國中歷史數位互動作業教學平台 (CAI Hub)

依據教育部 108 課綱國中歷史科編製之互動式學習與作業平台。

---

## 專案架構概覽

```text
.
├── index.html        # 課程入口首頁（目前開放第一課，其餘為預告卡片）
├── hub.css           # 入口首頁樣式，使用原生 CSS
├── firebase-config.js    # Firebase Web App 設定
├── firebase-service.js   # Firebase 名冊、工作階段與成績服務
├── firebase-rules/       # Firestore Rules
├── FIREBASE_SETUP.md     # Firebase 建置與名冊匯入說明
│
└── G2B3/             # 【第 1 課】商周至隋唐的國家與社會（獨立完整專案）
    ├── index.html    # 第 1 課作業主頁（重點講義 ✕ 5道闖關遊戲）
    ├── style.css     # 遊戲與講義樣式表
    ├── app.js        # 核心遊戲關卡邏輯與成績登記系統
    ├── detective.js  # 歷史除錯關卡
    ├── maze-scene.bundle.js # 3D時空迷宮打包
    ├── maze-adventure.js    # 迷宮控制
    ├── gas/          # 舊版 GAS 程式，僅供歷史資料與回溯
    └── vendor/       # Three.js 等函式庫
```

---

## 獨立性與隔離規範

1. **學習帳號名冊**：
   - Firebase `students` 集合以 Email 作為文件 ID，保存班級、座號、名冊姓名與 Email。
   - 學生輸入帳號後由 Firebase 查詢名冊；查不到的帳號只可作為訪客體驗。
2. **成績格式統一**：
   - 所有單元寫入 Firebase `scores` 集合，固定包含 `class`、`seat`、`email`、`unitName` 與 `totalScore`。
   - 舊版 Google Form、Google OAuth、GAS API 原始碼保留作歷史資料與回溯用途。
3. **路徑相對引用**：
   - 各章節內部皆使用相對路徑，可獨立部署或透過 Hub 入口跳轉。

## 本機開發與驗證

前端使用原生 HTML/CSS/JavaScript，直接開啟 `index.html` 即可閱讀及練習。
Google Form 成績登錄需使用 Google 帳號登入，以取得已驗證的 Email；遊戲本身可先免登入體驗。

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

- 不在 `students` 名冊中的學生可以練習及取得證書，但不會寫入正式成績。
- 名冊學生完成遊戲後，成績寫入 Firebase `scores` 集合，並標記為待教師核對。
- 姓名可由學生使用課堂代號顯示；班級、座號與 Email 由名冊資料帶入。
- 成績只在 Firebase 確認寫入後顯示成功；連線失敗會提示重試。
- 已完成作業可在證書區重新登入並重試上傳。重新整理頁面會清除遊戲與登入狀態，請先完成上傳或複製成績報告。
- Firestore Rules 驗證匿名工作階段、名冊 Email、班級座號對應與分數範圍。
- 分數目前仍由前端計算；Rules 檢查不等同伺服器重新計分或完整防作弊。

部署步驟見 [G2B3/gas/README.md](G2B3/gas/README.md)。前後端必須配套更新，舊版 GAS 不支援新的憑證驗證與回執。

`graphify-out/` 為可重建的分析輸出，已排除 Git 追蹤。分析自有程式時應排除 `vendor/`、`maze-scene.bundle.js`、`gas/Forge.js` 與 `node_modules/`，避免第三方程式淹沒課程邏輯。
