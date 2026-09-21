# 朝代方塊：Firebase 成績服務

- Firebase 專案設定位於根目錄 `firebase-config.js`。
- Firestore 規則位於根目錄 `firebase-rules/firestore.rules`。
- 成績服務由根目錄 `firebase-service.js` 提供。

目前正式入口不使用 Google 登入。學生填寫班級、座號與姓名後進入作業，通關時由 Firebase Anonymous Authentication 建立技術工作階段，成績寫入 Firestore，並標記為 `self_declared` 等待教師核對。

第一次通過驗證的成績提交會在共用試算表建立「朝代方塊_成績歷程」、「朝代方塊_即時排行榜」、「朝代方塊_學生名冊」分頁；名冊保留原有結構，目前不自動填入。排行榜只回傳遮罩姓名，不回傳 Email。

原作者的教師帳號例外已移除。新登入 session 使用本專案專屬名稱，舊版 session 不會沿用。登入憑證僅存在此瀏覽器分頁的 sessionStorage，支援首頁跳轉遊戲；登出時清除。憑證過期時請回首頁重新登入。

直接開啟 `file://` 可進行遊戲；Firebase 寫入需使用 HTTP 伺服器，詳細設定見根目錄 `FIREBASE_SETUP.md`。

在本資料夾執行 `clasp status`／`clasp push` 時，`.clasp.json` 指向完整的 `../G2B3/gas`，不會連到原作者專案。請勿另行部署本資料夾的 `gas/Code.js`，它只保留搬移說明。

在專案根目錄執行 `npm test`，會檢查既有遊戲與成績服務回歸測試。Firebase 連線需使用測試帳號與 Firebase Console 確認 Firestore 寫入。
