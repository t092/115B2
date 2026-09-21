/**
 * 國中歷史數位互動作業 - 萬能多單元自動分頁成績接收器
 * 綁定試算表 ID: 1z5m8l6LSthe0-c9d7hKEuDN3LswTsIg5CNGZP_p9uDQ
 * 特點：若教學單元頁籤不存在，系統自動建立並美化表頭；若已存在則自動追加成績。
 */

var SPREADSHEET_ID = '1z5m8l6LSthe0-c9d7hKEuDN3LswTsIg5CNGZP_p9uDQ';

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '伺服器繁忙，請稍後重試'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var rawData = e.postData ? e.postData.contents : '';
    var data = {};
    if (rawData) {
      try {
        data = JSON.parse(rawData);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else {
      data = e.parameter || {};
    }

    var identity = verifyStudentToken(data.idToken);
    if (data.unitName === 'DynaSoKOBAN') return Dynasty.submit(data, identity);
    var email = identity.email.trim().toLowerCase();
    if (data.unitName !== AUTH_CONFIG.unit) throw new Error('不支援的教學單元');
    if (!/^[a-f0-9-]{36}$/i.test(data.submissionId || '')) throw new Error('缺少有效的作業識別碼');
    if (!Number.isSafeInteger(data.score) || data.score < 0 || data.score > 1000 ||
        !Number.isSafeInteger(data.stars) || data.stars < 0 || data.stars > 100) throw new Error('成績格式或範圍不正確');
    if (!String(data.class || '').trim() || !String(data.name || '').trim() ||
        !/^\d{1,3}$/.test(String(data.seat || ''))) throw new Error('請完整填寫班級、座號與姓名');
    var safeFields = [data.class, data.seat, data.name, data.timeSpent,
      Array.isArray(data.badges) ? data.badges.join('、') : data.badges].map(sheetText);

    var spreadsheet = getSpreadsheet();
    var unitName = AUTH_CONFIG.unit;
    var sheet = spreadsheet.getSheetByName(unitName);

    // 2. 判斷該單元分頁是否存在，若無則全自動新建並格式化表頭
    if (!sheet) {
      sheet = spreadsheet.insertSheet(unitName);
      var headers = [
        '登錄時間',
        '學生帳號 (Email)',
        '學生班級',
        '學生座號',
        '學生姓名',
        '作業總積分',
        '榮譽星星數',
        '作答總耗時',
        '解鎖勳章',
        '挑戰日期', '作業識別碼'
      ];
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#1e293b')
                 .setFontColor('#ffffff')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }

    // Add the receipt column to existing ten-column sheets; preserve earlier rows.
    if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('作業識別碼');
    if (sheet.getRange(1, 11).getValue() !== '作業識別碼') throw new Error('試算表第 11 欄已被使用，請先確認欄位設定');
    var receipt = identity.sub + ':' + data.submissionId;
    if (sheet.getLastRow() > 1 && sheet.getRange(2, 11, sheet.getLastRow() - 1, 1)
        .createTextFinder(receipt).matchEntireCell(true).findNext()) {
      return ContentService.createTextOutput(JSON.stringify({status: 'success', unit: unitName,
        submissionId: data.submissionId})).setMimeType(ContentService.MimeType.JSON);
    }
    // 3. 追加學生成績紀錄
    var now = new Date();
    var formattedDate = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');

    sheet.appendRow([
      formattedDate,
      email,
      safeFields[0], safeFields[1], safeFields[2],
      Number(data.score) || 0,
      Number(data.stars) || 0,
      safeFields[3], safeFields[4],
      Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd'), receipt
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      submissionId: data.submissionId,
      unit: unitName,
      message: '成績已成功登錄至單元：' + unitName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.unitName === 'DynaSoKOBAN') return Dynasty.get(e);
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    message: '國中歷史數位互動作業 - 萬能多單元成績接收 API 正常運行中！'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 建立 5 個測試工作表並填寫前 5 筆測試資料
 * (可在 Apps Script 上方下拉選單選擇 createTestSheets 執行)
 */
function createTestSheets() {
  var spreadsheet = getSpreadsheet();
  var sheetNames = [
    '測試工作表1',
    '測試工作表2',
    '測試工作表3',
    '測試工作表4',
    '測試工作表5'
  ];

  var headers = [
    '登錄時間',
    '學生帳號 (Email)',
    '學生班級',
    '學生座號',
    '學生姓名',
    '作業總積分',
    '榮譽星星數',
    '作答總耗時',
    '解鎖勳章',
    '挑戰日期'
  ];

  var now = new Date();
  var formattedDate = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  var dateStr = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy/MM/dd');

  sheetNames.forEach(function(name, sIdx) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#1e293b')
                 .setFontColor('#ffffff')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }

    var existingRows = sheet.getLastRow();
    var currentCount = Math.max(0, existingRows - 1);
    for (var i = currentCount + 1; i <= 5; i++) {
      sheet.appendRow([
        formattedDate,
        'test0' + i + '@st.tc.edu.tw',
        '20' + (sIdx + 1),
        i,
        '測試' + i,
        100 - (i - 1) * 5,
        3,
        '01:3' + i,
        '測試徽章、挑戰成功',
        dateStr
      ]);
    }
  });

  Logger.log('已成功建立/檢查 5 個測試工作表，每個工作表前 5 筆測試資料均已填妥！');
}

/**
 * 移除所有測試工作表 (手動點擊「執行」使用)
 * 會刪除名稱含有「測試」的所有工作表 (如 測試工作表1 ~ 測試工作表5)
 * 若試算表內無其他工作表，會自動保留/建立「二上第1課_商周至隋唐的國家與社會」
 */
function deleteTestSheets() {
  var spreadsheet = getSpreadsheet();
  var sheets = spreadsheet.getSheets();

  // 若刪除後會變成 0 個工作表，先確保有正式單元工作表
  var nonTestSheets = sheets.filter(function(s) {
    return s.getName().indexOf('測試') === -1;
  });

  if (nonTestSheets.length === 0) {
    var defaultUnit = '二上第1課_商周至隋唐的國家與社會';
    var newSheet = spreadsheet.insertSheet(defaultUnit);
    var headers = [
      '登錄時間',
      '學生帳號 (Email)',
      '學生班級',
      '學生座號',
      '學生姓名',
      '作業總積分',
      '榮譽星星數',
      '作答總耗時',
      '解鎖勳章',
      '挑戰日期'
    ];
    newSheet.appendRow(headers);
    var headerRange = newSheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1e293b')
               .setFontColor('#ffffff')
               .setFontWeight('bold')
               .setHorizontalAlignment('center');
    newSheet.setFrozenRows(1);
  }

  // 刪除所有名稱含有「測試」的工作表
  var deletedCount = 0;
  sheets = spreadsheet.getSheets();
  sheets.forEach(function(sheet) {
    var name = sheet.getName();
    if (name.indexOf('測試') !== -1) {
      spreadsheet.deleteSheet(sheet);
      deletedCount++;
      Logger.log('已刪除工作表: ' + name);
    }
  });

  Logger.log('已成功刪除 ' + deletedCount + ' 個測試工作表！');
}


/**
 * 單筆測試連線函式
 */
function test() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        email: 'test@st.tc.edu.tw',
        name: '系統測試員',
        class: '201',
        seat: '99',
        score: 100,
        stars: 3,
        timeSpent: '01:23',
        badges: ['測試連線'],
        unitName: '測試工作表1'
      })
    }
  };
  var result = doPost(fakeEvent);
  Logger.log('執行結果: ' + result.getContent());
}
