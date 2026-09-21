# Firebase Spark 成績系統遷移計畫

## 1. 目標

將目前以 Google Form、Google Apps Script 與 Google 試算表為核心的成績儲存流程，改為 Firebase Spark 方案。

由於學校資訊管理政策不允許 GAS 學生認證功能，學生身分不可依賴 Google Authentication、Google OAuth 或學校網域驗證。學生認證必須另行設計，與 Firebase 資料儲存服務分離。Firebase 在本計畫中只負責資料儲存與可選的技術工作階段，不負責證明學生真實身分。

預計使用：

- Firebase Authentication：僅可選用匿名工作階段，不作為學生身分認證
- Cloud Firestore：儲存學生資料、遊戲成績與排行榜
- Firebase App Check：降低未授權請求與濫用
- Firebase Hosting：部署靜態網站，可選
- Firebase Storage：僅在確認 Spark 方案可用額度與政策後評估；第一階段不依賴圖片上傳

本次遷移不改變既有遊戲內容、計分方式與證書畫面，主要替換登入、成績寫入及排行榜資料來源。

## 2. 現況分析

### 2.1 G2B3 第一課

目前主要流程位於：

- `G2B3/app.js`
- `G2B3/index.html`
- `G2B3/gas/程式碼.js`
- `G2B3/gas/Auth.js`

目前功能：

- Google Identity Services 登入
- 限制 `@st.tc.edu.tw` 網域
- 使用 Google ID Token 傳送至 GAS
- GAS 驗證 Token、Email、網域與有效期限

上述 Google 認證流程因學校政策限制，不列入新的正式流程。
- 成績透過 GAS 寫入 Google 試算表
- 使用 `submissionId` 進行重試去重
- Google Form 目前僅作為證書截圖與成績登錄介面

### 2.2 DynaSoKOBAN

目前主要流程位於：

- `DynaSoKOBAN/cai-service.js`
- `DynaSoKOBAN/index.html`
- `DynaSoKOBAN/dynasty-push-game.html`
- `G2B3/gas/Dynasty.js`

目前功能：

- 支援免登入體驗
- 原本支援 Google 學校帳號登入，但新流程不再依賴此功能
- GAS 儲存成績
- GAS 提供班級排行榜
- Google Form 負責證書截圖與成績登錄

### 2.3 目前主要問題

- Google Form 與前端遊戲狀態分離
- 學生需要額外填寫表單
- 證書截圖上傳流程容易中斷
- Google Form 欄位設定依賴手動維護
- GAS Web App 受限於部署、權限與跨網域流程
- G2B3 與 DynaSoKOBAN 的服務介面不完全一致
- 前端分數仍可被修改，後端無法重新計算遊戲結果

## 3. Firebase 架構

### 3.1 建議資料結構

```text
users/{uid}
  email
  displayName
  domain
  classId
  seatNo
  role
  createdAt
  updatedAt

units/{unitId}
  title
  enabled
  maxScore
  createdAt

submissions/{submissionId}
  uid
  unitId
  email
  displayName
  classId
  seatNo
  score
  stars
  durationSeconds
  badges
  completed
  identityStatus
  assignmentId
  clientSubmissionId
  createdAt
  updatedAt
  status
```

DynaSoKOBAN 可額外使用：

```text
submissions/{submissionId}
  moves
  maxLevel
  levelDetails
```

排行榜不建議另存一份重複資料，初期直接從 `submissions` 查詢：

- 指定 `unitId`
- 指定 `classId`
- `completed == true`
- 依 `score` 降冪排序
- 再依 `durationSeconds` 升冪排序
- 限制前 10 筆

若日後資料量增加，再考慮建立彙總排行榜。

## 4. 學生身分與工作階段設計

### 4.1 不使用 Google 身分認證

正式流程不使用以下方式判定學生身分：

- Google Authentication
- Google OAuth
- Google Identity Services
- `@st.tc.edu.tw` 網域判定
- Google ID Token

學生可直接進入遊戲，不要求學校帳號登入。

### 4.2 Firebase 匿名工作階段

若 Firestore Rules 需要登入狀態，可使用 Firebase Anonymous Authentication 取得技術性 `uid`；這不是學生登入，該 `uid` 只代表目前瀏覽器工作階段，不代表學生本人。若學校環境不允許任何 Firebase Authentication，則改用本機產生的工作階段識別碼，並限制可提交資料的可信度。

用途：

- 讓 Firestore Rules 能區分不同工作階段
- 降低完全公開 Firestore 寫入的風險
- 控制同一份提交資料的擁有者
- 支援重試去重

限制：

- 清除瀏覽器資料後會失去原工作階段
- 學生可以重新建立匿名帳號
- 匿名 `uid` 不能作為學籍或正式身分證明

若匿名登入在學校網路環境仍受阻，系統可退回純前端體驗，但不應允許該模式寫入正式成績。

### 4.3 手動學籍資料

開始作業或提交前要求學生填寫：

- 班級
- 座號
- 姓名

資料可儲存於：

```text
users/{uid}
```

同一工作階段下次進入時可讀取個人資料，但不能視為學生身分驗證。

免登入遊戲模式保留；是否允許寫入成績，依下方「成績可信度」政策決定。

### 4.4 學生認證另案處理

學生認證不應由 Firebase Google Auth 取代。可依學校政策選擇下列其中一種：

- 教師提供每班專屬作業碼，學生再填寫班級、座號與姓名
- 教師提供一次性作業碼，完成後由教師核對名冊
- 僅使用班級、座號與姓名，所有資料標記為待核對
- 由學校既有學習平台完成身分確認，再將短期作業識別碼帶入本平台

第一階段建議採用「教師提供作業碼 + 成績待核對」，避免在未確認學校政策前自行建立新的學生登入系統。作業碼若只在前端或 Firestore Rules 中比對，不能視為安全驗證；真正的作業碼驗證仍需由學校既有平台、教師管理流程或另一個獲准的後端處理。

### 4.5 建議的成績身分政策

初期採用「可提交、待教師核對」：

- 學生可以使用班級、座號、姓名提交成績
- 每筆資料標記 `identityStatus: "self_declared"`
- 排行榜可選擇只顯示待核對資料，或暫不納入正式排名
- 教師在管理流程中核對班級、座號、姓名與證書
- 核對後將狀態改為 `verified`

若學校要求不可讓學生自行上傳正式成績，則改用「只產生證書、不寫入正式資料」模式。

## 5. 成績提交流程

### 5.1 正式學生

1. 學生直接進入遊戲
2. Firebase 建立匿名工作階段，或建立本機工作階段識別碼
3. 學生填寫班級、座號與姓名
4. 學生完成遊戲
5. 前端產生 `clientSubmissionId`
6. 前端寫入 Firestore
7. Firestore Rules 驗證工作階段、作業碼與資料欄位
8. 前端確認寫入成功
9. 顯示「成績已送出，等待教師核對」與證書

### 5.2 免登入學生

1. 學生直接選擇免登入體驗
2. 可正常進行遊戲
3. 可顯示證書
4. 若未填寫學籍資料，不寫入正式成績
5. 若填寫資料後提交，標記為 `self_declared`
6. 是否出現在排行榜由教師核對政策決定

### 5.3 重試去重

使用兩層識別：

```text
document ID = uid_unitId_clientSubmissionId
```

或：

```text
submissions/{uid}_{unitId}_{clientSubmissionId}
```

Firestore Rules 禁止學生修改既有提交紀錄，避免重複寫入與成績覆蓋。

## 6. Firestore Security Rules

初期規則原則：

- 未建立匿名工作階段者不可寫入正式成績
- 只能以自己的匿名 `uid` 建立提交資料
- `unitId` 僅允許白名單中的單元
- `score` 必須為有限整數且在合理範圍
- `stars`、`durationSeconds`、`moves` 必須為非負數
- `completed` 必須為布林值
- 建立後不可修改 `uid`、`unitId`、`createdAt`
- 排行榜只能讀取必要欄位，不回傳 Email

重要限制：

Firebase Spark 方案使用前端直接寫入 Firestore 時，Security Rules 可以驗證格式與範圍，但無法真正驗證學生是否完成了所有遊戲關卡，也無法防止使用者修改瀏覽器中的分數。

因此第一階段只能達成：

- 工作階段限制
- 資料格式限制
- 請求權限限制
- 重複提交限制

不能宣稱已完整防作弊。

## 7. App Check

啟用 Firebase App Check，Web 初期可使用 reCAPTCHA Enterprise 或 reCAPTCHA v3。

目的：

- 降低非本網站程式直接呼叫 Firebase
- 過濾部分自動化請求
- 增加 Firestore 寫入濫用的門檻

App Check 不是學生身分驗證，也不是防止前端竄改分數的機制。

正式啟用前需先使用監控模式觀察誤判，再切換為強制驗證。

## 8. Firebase 專案設定

建立 Firebase 專案後設定：

1. 啟用 Authentication
2. 不啟用 Google 登入 Provider 作為正式流程
3. 啟用 Anonymous Authentication，或採用本機工作階段模式
4. 啟用 Cloud Firestore
5. 建立正式與測試資料庫環境
6. 設定 Firestore Security Rules
7. 建立 Firestore Index
8. 啟用 App Check
9. 建立 Firebase Web App
10. 視需求設定 Firebase Hosting

不得將下列資訊放入公開前端：

- Service Account 私密金鑰
- Firebase Admin SDK 憑證
- GAS 私密設定
- 管理員權限設定

Firebase Web Config 本身不是秘密，但必須搭配正確的 Authentication 設定與 Security Rules。

## 9. 程式修改範圍

### 9.1 新增檔案

建議新增：

```text
firebase-config.js
firebase-service.js
firebase-rules/firestore.rules
firebase-rules/firestore.indexes.json
firebase.json
.firebaserc
```

`firebase-config.js` 只放 Firebase Web SDK 設定。

`firebase-service.js` 統一提供：

- Firebase 初始化
- 匿名工作階段建立與清除
- 登出
- 取得目前使用者
- 讀取學生資料
- 儲存學生資料
- 提交 G2B3 成績
- 提交 DynaSoKOBAN 成績
- 取得排行榜
- 判斷匿名、體驗與待核對模式

### 9.2 修改 G2B3

主要修改：

- `G2B3/app.js`
- `G2B3/index.html`

移除或停用：

- `SCHOOL_AUTH_CONFIG.GAS_URL`
- Google ID Token 解析
- `uploadScoreToGAS()`
- Google Form 預填流程
- 依賴 GAS 回傳的成績成功訊息

改為呼叫：

```js
FirebaseService.submitScore({
  unitId,
  classId,
  seatNo,
  name,
  score,
  stars,
  durationSeconds,
  badges,
  completed,
  clientSubmissionId
});
```

### 9.3 修改 DynaSoKOBAN

主要修改：

- `DynaSoKOBAN/cai-service.js`
- `DynaSoKOBAN/index.html`
- `DynaSoKOBAN/dynasty-push-game.html`
- `DynaSoKOBAN/dynasty-sequence-game.html`

移除或停用：

- `GAS_API_URL`
- `SCORE_FORM_URL`
- `SCORE_FORM_ENTRIES`
- `idToken` 儲存
- GAS `submitScore`
- GAS `getLeaderboard`

改為共用 `firebase-service.js`。

## 10. Google Form 與 GAS 退場策略

不立即刪除既有 Google Form、GAS 與試算表。

建議分三階段：

### 階段一：Firebase 平行測試

- 正式流程仍使用 Google Form
- 測試帳號另外寫入 Firebase
- 比對 Firebase 與 GAS 的成績資料
- 確認登入、寫入、排行榜與重試

### 階段二：Firebase 正式寫入

- 前端改為 Firebase 優先
- GAS 保留唯讀或緊急回退用途
- Google Form 改為備援入口
- 觀察至少一個完整教學週期

### 階段三：停止舊服務

確認以下事項後再停用：

- Firebase 成績完整
- 所有單元均可提交
- 排行榜正確
- 學生不需要學校 Google 帳號即可進入遊戲
- 離線、逾時與重試狀態正常
- 舊試算表已完成備份

GAS 與 Google Form 資料應保留為歷史資料，不直接刪除。

## 11. 測試計畫

### 11.1 單元測試

新增測試：

- 未建立工作階段不得提交
- 缺少班級、座號或姓名時拒絕正式提交
- 清除工作階段後不得讀取上一個工作階段的提交
- 缺少必要欄位時拒絕
- 分數超出範圍時拒絕
- 負數時間或步數時拒絕
- 不可修改其他使用者資料
- 不可修改既有提交
- 相同提交識別碼不可重複建立

### 11.2 瀏覽器測試

保留既有：

```powershell
npm test
npm run test:browser
```

新增：

```powershell
npm run test:firebase
```

測試內容：

- 免登入遊戲
- G2B3 完整五關
- DynaSoKOBAN 完整流程
- 成績寫入 Firebase
- 重整後工作階段狀態
- 成績提交成功畫面
- 網路錯誤與重試
- 班級排行榜
- 手機版操作

### 11.3 Firebase Emulator

本機測試優先使用 Firebase Emulator：

- Authentication Emulator
- Firestore Emulator
- App Check 測試模式

避免自動化測試寫入正式 Firestore。

## 12. Firebase Spark 方案注意事項

Spark 方案沒有可執行的 Cloud Functions 或一般後端服務，因此：

- 不適合依賴伺服器重新計算成績
- 不適合把前端提交的分數視為高可信正式評量
- Firestore Rules 只能做欄位與權限驗證
- 匿名 Authentication 與 App Check 都不能取代學生身分驗證
- 排行榜資料必須控制讀取範圍
- 必須監控 Firestore 讀寫次數與儲存量
- 證書截圖上傳功能需先確認 Firebase Storage 在目前 Spark 政策與專案狀態下是否可用

若證書圖片儲存需要付費方案，第一階段建議：

- 證書仍由學生下載或截圖
- Firebase 只儲存成績與證書資訊
- 不在 Firebase 儲存圖片

若未來需要伺服器驗證計分、圖片上傳或管理員後台，應評估 Blaze 方案或獨立後端。

## 13. 監控與錯誤處理

前端需區分：

- 未建立工作階段
- 工作階段遺失
- 無權限
- Firestore 寫入失敗
- 網路逾時
- 重複提交
- App Check 驗證失敗

成功訊息只能在 Firestore 寫入成功後顯示。

失敗時不得顯示「已成功儲存」，並提供：

- 重試按鈕
- 錯誤原因
- 保留目前遊戲結果
- 保留 `clientSubmissionId`

## 14. 實作順序

### Phase 1：基礎建置

- 建立 Firebase 專案
- 啟用 Authentication、Firestore
- 建立 Web App 設定
- 建立 Firebase Emulator
- 建立 Security Rules 初版
- 建立 `firebase-service.js`

### Phase 2：工作階段與學籍資料

- 建立匿名 Firebase 工作階段
- 將 G2B3 改為手動填寫學籍資料
- 將 DynaSoKOBAN 改為手動填寫學籍資料
- 保留免登入遊戲
- 移除前端 Google JWT 解析與學校網域驗證
- 增加 `identityStatus` 與教師核對狀態

### Phase 3：G2B3 成績遷移

- 將 `uploadScoreToGAS()` 替換為 Firestore 寫入
- 新增提交識別碼
- 更新證書與成功提示
- 建立 G2B3 Firestore 測試

### Phase 4：DynaSoKOBAN 成績遷移

- 替換 `CAI.submitScore()`
- 替換 `CAI.getLeaderboard()`
- 遷移班級排行榜查詢
- 建立 DynaSoKOBAN Firestore 測試

### Phase 5：App Check 與安全強化

- 啟用 App Check 監控模式
- 觀察請求錯誤
- 修正合法使用者誤判
- 啟用強制驗證
- 完善 Firestore Rules

### Phase 6：平行驗收

- Firebase 與 GAS 同時測試
- 比對成績、班級、座號、排行榜
- 使用手機與桌面瀏覽器驗證
- 使用教師提供的作業碼與測試名冊驗證

### Phase 7：正式切換

- Firebase 成為唯一正式寫入來源
- Google Form 改為備援
- GAS 停止接受新成績
- 備份舊試算表
- 更新 README 與部署文件

## 15. 驗收標準

以下條件全部成立後，才算完成遷移：

- 學生不需要學校 Google 帳號即可進入遊戲
- 不會呼叫 Google OAuth 或 GAS 認證
- 免登入模式仍可遊玩
- 未填寫作業碼或學籍資料的體驗模式不會寫入正式成績
- G2B3 可完整提交成績
- DynaSoKOBAN 可完整提交成績
- 重試不會產生重複紀錄
- 排行榜只顯示遮罩姓名
- 成績失敗時不顯示成功
- 手機版流程可正常使用
- Firebase Emulator 測試通過
- `npm test` 通過
- `npm run test:browser` 通過
- 舊 Google Form 與 GAS 資料已備份
- README、部署文件與設定說明已更新

## 16. 風險

### 高風險

- Spark 方案無法提供伺服器端重新計分
- 前端分數仍可能被竄改
- Firestore Rules 無法判斷遊戲是否真的完成
- 匿名工作階段或本機工作階段被清除後，學生必須重新填寫資料
- 學生自行填寫的資料無法證明真實身分，必須透過教師核對流程補足

### 中風險

- Firestore 索引未建立導致排行榜查詢失敗
- App Check 導致部分學校網路請求被拒絕
- 學生資料格式與既有 GAS 欄位不一致
- Firebase 讀寫次數超過 Spark 免費額度

### 低風險

- 舊 Google Form 與 Firebase 資料短期不一致
- 使用者瀏覽器保留舊版 session
- 不同單元的 `unitId` 命名不一致

## 17. 建議的第一個實作切入點

先不要立即修改兩個遊戲。

第一個切入點建議是：

1. 建立 Firebase 專案
2. 建立 Firebase Emulator
3. 確認匿名 Authentication 或本機工作階段在學校網路可用
4. 完成 Firestore Rules
5. 建立獨立 `firebase-service.js`
6. 先將 DynaSoKOBAN 的測試成績以 `self_declared` 狀態寫入 Firebase
7. 確認成功後再遷移 G2B3

這樣可以先驗證 Firebase 登入、資料格式、排行榜與重試流程，再降低主遊戲一次性修改的風險。
