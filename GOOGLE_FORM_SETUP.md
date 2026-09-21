# Google Form 成績登錄設定

## 建立表單

1. 將 `G2B3/gas/CreateScoreForms.js` 複製到共用 Apps Script 專案。
2. 以老師帳號執行 `setupScoreForms()` 一次。
3. 授權 Forms、Drive、Spreadsheet 與觸發器權限。
4. 從執行記錄複製 `G2B3` 和 `DynaSoKOBAN` 的 `formUrl` 與 `entries`。
5. 開啟兩份表單的編輯頁面，手動新增「檔案上傳」題目：
   - 題目名稱必須是 `通關證書截圖`
   - 設為必填
   - 最多 1 個檔案
   - 建議限制為圖片，檔案大小上限 10 MB

每個遊戲會建立自己的表單與試算表：

- `G2B3`：第一課成績與通關證書
- `DynaSoKOBAN`：朝代 SOKOBAN 成績與通關證書

學生必須登入 Google Form，表單會收集已驗證的 Google Email，並要求上傳通關證書截圖。由於 Apps Script 的 `FormApp` 目前不能程式化新增檔案上傳題型，檔案上傳題需手動新增。

## 填入前端設定

將執行記錄中的資料填入：

- `G2B3/app.js` 的 `SCORE_FORM_CONFIG`
- `DynaSoKOBAN/cai-service.js` 的 `CAI_CONFIG.SCORE_FORM_URL` 與 `SCORE_FORM_ENTRIES`

`entries` 的數字是 Google Form 題目 ID，前端會用它們預填班級、座號、姓名、分數、作答時間與勳章。學生仍可在送出前檢查並修改資料，老師以證書截圖核對。

## 重複提交規則

每份表單都有 `有效成績` 工作表。相同遊戲中，同一個已驗證 Email 的舊紀錄會保留，但標記為 `已被新紀錄取代`；最新一筆標記為 `目前有效`。兩個遊戲的紀錄彼此不會互相取代。

## 注意事項

- Google Form 的檔案上傳題型會要求學生登入 Google。
- 表單與上傳檔案的擁有權在建立表單的老師帳號下。
- 若學校管理員禁止外部表單或檔案上傳，仍需要管理員調整 Google Workspace 政策。
- 前端預填的分數不是防竄改機制，老師應以通關證書截圖核對分數、時間與勳章。
