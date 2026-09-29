# Firebase 連線設定

## 1. 建立 Firebase 專案

1. 開啟 Firebase Console，建立新專案。
2. 不需要啟用 Google Analytics。
3. 在「專案設定」新增 Web App。
4. 複製 Firebase SDK 設定。

## 2. 填入前端設定

將 Web App 設定填入根目錄的 `firebase-config.js`：

```js
window.CAI_FIREBASE_CONFIG = {
  apiKey: '你的 apiKey',
  authDomain: '你的專案.firebaseapp.com',
  projectId: '你的 projectId',
  storageBucket: '你的 storageBucket',
  messagingSenderId: '你的 messagingSenderId',
  appId: '你的 appId'
};
```

此檔案不放 Service Account 私密金鑰。

## 3. 啟用 Firebase 服務

在 Firebase Console：

1. Authentication → Sign-in method → 啟用 Anonymous。
2. Firestore Database → 建立資料庫。
3. 將 `firebase-rules/firestore.rules` 內容部署至 Firestore Rules。
4. 先使用測試帳號驗證寫入與排行榜。

成績送出後若瀏覽器未收到成功回應，遊戲會以固定提交 ID 重試，並讀取該學生自己的成績文件確認是否已寫入。Firestore Rules 的 `scores/{scoreId}` 因此允許使用者 `get` 自己的文件，仍禁止學生列出、更新或刪除成績。修改或部署新版規則後，請執行 `npx firebase deploy --only firestore:rules`。

Firebase Anonymous Authentication 只是技術工作階段，不是學生身分認證。學生仍使用班級、座號、姓名與教師核對流程。

## 4. 匯入學習帳號名冊

名冊集合格式：

```text
students/{email}
  class
  seat
  name
  email
```

`students` 集合的文件 ID 使用小寫 Email。請在 Firebase Console 的「專案設定 → 服務帳戶」建立匯入用 Service Account 金鑰，下載 JSON 到本機，不要放入 Git。

安裝依賴後執行：

```powershell
npm install
node tools/import-students.cjs 115學習帳號.csv C:\private\firebase-service-account.json
```

程式會將 CSV 的「班級、座號、姓名、Google學習帳號」匯入 `students` 集合。

## 5. 學生查詢與成績格式

1. 學生輸入學習帳號 Email。
2. 前端查詢 `students/{email}`。
3. 查到資料時帶入班級、座號，姓名可改為代號。
4. 查不到資料時進入訪客模式，不寫入正式成績。
5. 正式成績寫入 `scores` 集合，固定欄位包含：

```text
class
seat
email
unitName
totalScore
```

G2B3 在全部五道主關卡完成後自動儲存。若網路或 Firebase 寫入失敗，待送成績會暫存於該瀏覽器七天；同一名冊帳號重新開啟頁面時，系統會恢復成績並重試。成功確認後會移除本機暫存。

## 6. 教師管理帳號

教師管理頁位於 `teacher/index.html`，首頁右下角「教師管理」按鈕可進入。教師使用 Firebase Authentication Email/Password 帳號登入，教師帳號不可由管理頁自行註冊。

建立或授權教師帳號：

1. Authentication → Sign-in method → 啟用 Email/Password。
2. Authentication → Users → Add user，建立教師 Email 與密碼。
3. 複製該帳號的 UID。
4. Firestore Database → Data 建立 `teachers/{UID}` 文件，欄位設定為：

   ```text
   role: "teacher"   (string)
   active: true       (boolean)
   ```

5. 部署 Firestore Rules：

   ```powershell
   npx firebase deploy --only firestore:rules
   ```

Rules 會以已登入帳號的 UID 查詢 `teachers/{UID}`，只有 `role` 為 `teacher` 且 `active` 為 `true` 才能管理名冊及讀取成績。教師角色文件由專案管理者在 Console 維護，前端不能自行授權。停用權限時，將 `active` 設為 `false` 或刪除角色文件；需要同時停用帳號時，請在 Authentication 停用或刪除該使用者。

忘記密碼可由 Authentication Console 重設，或之後再加入 Firebase Auth 密碼重設郵件功能。教師密碼不存於程式碼或 Firestore。

成績表固定列出 `teacher/teacher.js` 中的單元目錄；新增課程時，需在該目錄加入欄位標籤，並將新 `unitName` 加入 `firebase-rules/firestore.rules` 成績白名單。若成績資料中出現目錄外的單元，頁面會以 `unitName` 自動追加欄位。

## 7. 載入方式

各遊戲頁面會載入 Firebase compat SDK、`firebase-config.js` 與 `firebase-service.js`。目前設定為空白時，服務會停用，遊戲仍可進入，但不會寫入 Firebase。

## 8. 本機測試

不要直接以 `file://` 測試 Firebase 寫入。請使用本機 HTTP 伺服器，例如：

```powershell
npx http-server . -p 8080
```

再開啟：

```text
http://localhost:8080/
```

並將 `localhost` 加入 Firebase Authentication 的授權網域。

## 9. 重要限制

- Firestore Rules 可限制資料格式與匿名工作階段，但不能證明學生本人身分。
- 前端分數仍可能被竄改，不能視為高可信度防作弊系統。
- 若需要教師核對，應另建教師管理流程，不能讓學生直接修改 `verified` 狀態。
- Firebase Storage 是否能在目前 Spark 專案使用，需依 Firebase Console 顯示的政策與額度確認；第一階段不依賴圖片上傳。
