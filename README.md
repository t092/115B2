# 國中歷史數位互動作業教學平台 (CAI Hub)

依據教育部 108 課綱國中歷史科編製之互動式學習與作業平台。

---

## 專案架構概覽

```text
.
├── index.html        # 多單元整合入口首頁（卡片式介面，支援即時搜尋與篩選）
├── hub.css           # 入口首頁專用現代深色主題樣式表（零依賴）
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
