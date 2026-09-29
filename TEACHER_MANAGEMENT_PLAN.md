# 教師管理介面規劃

## 目標

提供專用教師管理頁面，讓教師可以：

1. 新增、編輯、刪除 Firebase `students` 集合中的學生名冊資料。
2. 閱讀學生各課程總成績；每位學生、每個單元顯示最高分。
3. 從學習首頁右下角進入管理頁面。
4. 選擇班級及一個或多個課程，匯出 CSV 成績表。

## 頁面與檔案

| 路徑 | 用途 |
|---|---|
| `teacher/index.html` | 教師登入、名冊管理、成績總表 |
| `teacher/teacher.css` | 教師管理頁的桌面及手機樣式 |
| `teacher/teacher.js` | 頁面互動、名冊表格、成績彙總及篩選 |
| `teacher-entry.css` | 學習首頁右下角固定「教師管理」按鈕 |
| `firebase-service.js` | 教師登入、權限檢查及名冊/成績資料操作 |
| `firebase-rules/firestore.rules` | 教師角色判斷及 Firestore 存取權限 |

## 教師帳號與權限

教師以 Firebase Authentication Email/Password 帳號登入。教師帳號由專案管理者在 Firebase Console 建立，不提供公開註冊。

每個教師 Authentication 帳號需在 Firestore 有對應角色文件：

```text
teachers/{Firebase Authentication UID}
  role: "teacher"  // string
  active: true      // boolean
```

Firestore Rules 依據已登入使用者的 Email claim、UID 對應的角色文件及 `active` 狀態檢查教師權限。角色文件只能由專案管理者在 Console 維護；用戶端不可建立或修改教師權限。停用教師時將 `active` 設為 `false`，或刪除角色文件；必要時也可在 Authentication 停用帳號。

教師密碼由 Firebase Authentication 管理，不存於程式碼、Firestore 或 sessionStorage。登出透過 Firebase Auth `signOut()`。學生端建立匿名工作階段前會先結束任何非匿名登入，避免教師帳號被沿用為學生遊戲工作階段。

## Firestore 權限

- `teachers/{uid}`：帳號僅可讀自己的角色文件；用戶端不可 list/create/update/delete。
- `students/{email}`：登入用戶可 `get` 單一名冊文件；只有教師可 list/create/update/delete。
- `scores/{scoreId}`：保留既有學生提交驗證；教師可讀取成績列表及單筆資料；一般學生仍不得列出成績。
- 既有成績寫入欄位及單元白名單驗證維持不變。

部署 Rules：

```powershell
npx firebase deploy --only firestore:rules
```

## 學生名冊

名冊資料使用既有結構：

```text
students/{lowercase email}
  email
  class
  seat
  name
```

管理頁功能：

- 顯示班級、座號、姓名與 Email。
- 支援班級篩選及姓名、座號、Email 搜尋。
- 新增前檢查 Email 格式、必要欄位、重複 Email 與同班重複座號。
- 編輯時可修改班級、座號、姓名與 Email。
- 更改 Email 使用 Firestore batch 新增新文件及刪除舊文件，並在 `previousEmails` 保留舊 Email，以便連回舊成績。
- 刪除學生名冊不刪除歷史成績；成績總表將未對應到目前名冊的學生保留為歷史資料列。

## 成績總表

表格欄位為：

```text
班級 | 座號 | 姓名 | 課程1總成績 | 課程2總成績 | …
```

彙總規則：

- 依學生 Email（含名冊中的 `previousEmails`）及 `unitName` 將多筆成績合併。
- 同一學生、同一單元取最高 `totalScore`；沒有成績顯示 `—`。
- 不顯示核對狀態欄位。
- 支援班級篩選與姓名、座號、Email 搜尋。
- 名冊外或已刪除學生的歷史成績仍顯示。
- 選擇單一班級及要輸出的課程欄位，下載該班 CSV；輸出全班學生，不受表格搜尋條件影響。
- CSV 使用 UTF-8 BOM，檔名包含班級與日期；未作答欄位輸出 `—`，文字欄位會處理 CSV 引號及試算表公式字元。

目前單元目錄：

| `unitName` | 欄位標籤 |
|---|---|
| `G2B3` | 課程1總成績 |
| `G2B3L21` | 課程2總成績 |
| `DynaSoKOBAN` | 朝代SOKOBAN總成績 |
| `silklemmings` | 絲路小商人總成績 |

頁面固定顯示目錄中的單元；若成績資料中出現目錄外的 `unitName`，會自動追加欄位。新增單元時，若要在尚無人成績前也顯示欄位，需更新 `teacher/teacher.js` 的 `UNIT_CATALOG`；同時須將 `unitName` 加入 Firestore Rules 成績白名單。

## 首頁入口與體驗

- 根目錄 `index.html` 右下角固定顯示「教師管理」按鈕，連至 `teacher/index.html`。
- 按鈕支援鍵盤焦點樣式與手機安全區邊距。
- 管理頁包含教師登入、學生名冊及成績總表兩個分頁；成績總表可選班級與課程後下載 CSV。
- 名冊新增、編輯、刪除均提供結果提示；刪除前再次確認。

## 驗證

執行：

```powershell
npm test
npm run test:browser
```

教師瀏覽器測試使用 FirebaseService 模擬資料，涵蓋首頁入口、登入介面、名冊新增/修改 Email/刪除、最高分彙總、動態單元欄位、保留歷史成績及指定班級/多課程 CSV 輸出。此測試不會連線正式 Firestore；正式 Rules 仍需部署後以已授權教師帳號實測。
