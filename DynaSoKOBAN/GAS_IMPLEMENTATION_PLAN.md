# 朝代方塊：共用 G2B3 帳號與成績服務

- Google OAuth Client ID：`403500919614-4c109l85fn6hul7nng2nskbs9kn4reis.apps.googleusercontent.com`
- 學校網域：`st.tc.edu.tw`
- [共用成績試算表](https://docs.google.com/spreadsheets/d/1z5m8l6LSthe0-c9d7hKEuDN3LswTsIg5CNGZP_p9uDQ/edit)
- [共用 Apps Script 專案](https://script.google.com/home/projects/1O9gzZyHXvChA6PY32TXxEG6sNqrGftTgRLKBgSVeQ5v006yxx_wPqaBB/edit)
- Web App 使用與 G2B3 相同的既有部署，設定在 `cai-service.js`。

後端原始碼已整合到 `../G2B3/gas/Dynasty.js`，由共用入口依 `unitName: DynaSoKOBAN` 分流。前端傳送 Google ID token，後端驗證後取得真實 Email。G2B3 第一課的資料表及 API 格式保留。

第一次通過驗證的成績提交會在共用試算表建立「朝代方塊_成績歷程」、「朝代方塊_即時排行榜」、「朝代方塊_學生名冊」分頁；名冊保留原有結構，目前不自動填入。排行榜只回傳遮罩姓名，不回傳 Email。

原作者的教師帳號例外已移除。新登入 session 使用本專案專屬名稱，舊版 session 不會沿用。登入憑證僅存在此瀏覽器分頁的 sessionStorage，支援首頁跳轉遊戲；登出時清除。憑證過期時請回首頁重新登入。

直接開啟 `file://` 僅使用免登入體驗；Google 登入需使用 GitHub Pages 或已在 OAuth 設定登記的 localhost 來源。

在本資料夾執行 `clasp status`／`clasp push` 時，`.clasp.json` 指向完整的 `../G2B3/gas`，不會連到原作者專案。請勿另行部署本資料夾的 `gas/Code.js`，它只保留搬移說明。

在專案根目錄執行 `npm test`，會同時檢查第一課及朝代方塊的成績整合。GAS 更新後仍須發布前端修改，完整驗收需用真實學校帳號。
