# 時空迷宮

直接雙擊 `index.html`，或透過網站 / 本機 HTTP 伺服器開啟，都可使用 Three.js 3D 迷宮。請保留同資料夾內的 `maze-scene.bundle.js`、`maze-adventure.js`、`app.js` 與 `style.css`。

- 玩家走到守護者身旁時自動開啟歷史題目；守護者巡邏接觸玩家也會觸發，不必按對話按鈕。
- 答題時停止移動；答對後守護者不再觸發題目，並從雷達消失。
- 三題完成後，在玉璽位置按「領取玉璽」，或使用空白鍵領取。
- 瀏覽器無法啟動 WebGL 或場景檔案缺失時，保留可遊玩的 2D 相容模式，並在場景下方說明原因。

## 檔案與建置

- `maze-adventure.js`：移動、守護者巡邏、自動對話、雷達及玉璽領取。
- `maze-scene.js`：3D 角色、立體場景及鏡頭的原始碼。
- `vendor/three.module.js`、`vendor/three.core.js`：固定版本 Three.js 0.180.0，授權位於 `vendor/THREE-LICENSE.txt`。
- `maze-scene.bundle.js`：包含上述 Three.js 與場景程式的傳統腳本，避免本機 `file://` 的模組載入限制；執行時不需連線至 CDN。

修改 `maze-scene.js` 後，執行 `node tools/build-maze.cjs` 更新 bundle。此建置工具專用於已存入專案的 r180 模組格式；更新 Three.js 時應一併檢查建置工具並執行測試。

## 驗證

執行 `node tests/maze-check.cjs`。測試會自行啟動及關閉本機 HTTP 伺服器，同時驗證 HTTP 與 `file://` 的 3D 載入、自動接觸對話、單次加分、雷達標記移除、玉璽領取、手機版面，以及缺少 bundle / WebGL 不可用時的備援。

需安裝 Playwright 及 Microsoft Edge；可使用 `PLAYWRIGHT_MODULE` 指定 Playwright 套件路徑。
