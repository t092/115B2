# 第一課成績後端

本資料夾的修改需部署至 Apps Script 後才生效。本機測試不會更新雲端程式或寫入正式成績。

## 更新現有部署

1. 在現有 Apps Script 專案更新 `程式碼.js`，加入 `Auth.js` 與 `Forge.js`，並保留 `appsscript.json`。`Forge.js` 是 `node-forge` 1.4.0 的固定版本建置產物，授權見 `FORGE-LICENSE.txt`；不要手動修改產物。
2. 確認 `程式碼.js` 的試算表 ID，以及 `Auth.js` 的 `clientId`、`domain`、`unit` 與前端 `app.js` 設定一致。目前只允許第一課，拒絕由外部指定任意工作表名稱。
3. 在 Apps Script「部署 → 管理部署」編輯原 Web App，選擇新版本後部署。保留以部署者身分執行及現有存取方式，讓瀏覽器可以送出請求；實際學生身分由每次請求的 ID token 驗證。
4. 新增的 `UrlFetchApp` 需要允許外部請求，以取得 Google 公開驗證憑證。部署時依 Apps Script 提示授權。
5. 更新前端靜態檔案。如果建立了全新 Web App 部署而非更新原部署，需同步修改 `app.js` 的 `GAS_URL`。
6. 用學校帳號完成一份作業，確認前端顯示成功、試算表新增一列，再按重試確認不重複。關閉網路時必須顯示無法確認，不能顯示成功。

既有前 10 欄與成績保留，第 11 欄新增「作業識別碼」供重試去重；若該欄已有其他用途，後端拒絕寫入，需先調整表格。憑證只用於驗證，不寫入試算表或快取；快取只存 Google 公開憑證。

同一作業識別碼的第一次成功提交為準。遊戲資料與識別碼僅留在當前頁面記憶體，重新整理後不會自動恢復。前端分數仍可被操作，若要用作高可信度正式評量，需另行設計伺服器出題與計分。

`test()` 是舊的無憑證測試資料，現在預期被拒絕；請用根目錄的 `npm test` 執行不寫雲端的回歸測試。`createTestSheets()`、`deleteTestSheets()` 會操作真實試算表，部署驗證不需執行它們。

驗證規則依據 [Google 官方 ID token 驗證文件](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)。使用固定 Google 公開憑證端點及 RSA SHA-256 驗證，不使用供除錯用途的 tokeninfo 端點。
