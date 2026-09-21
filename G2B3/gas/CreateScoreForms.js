/**
 * 建立每個遊戲各自的 Google Form 與成績紀錄表。
 *
 * 使用方式：
 * 1. 將本檔案放入共用 Apps Script 專案。
 * 2. 以老師帳號執行 setupScoreForms() 一次。
 * 3. 將執行記錄中的表單網址填入前端設定。
 *
 * 每個遊戲各有一份表單，因此同一 Email 只會在同一個遊戲內互相取代。
 */
var SCORE_FORM_CONFIGS = [
  {
    unit: 'G2B3',
    title: '國中歷史二上第1課｜成績與通關證書登錄',
    description: '請使用完成本課作業的學校 Google 帳號登入，填寫成績並上傳通關證書截圖。',
    sheetTitle: 'G2B3 第一課成績紀錄'
  },
  {
    unit: 'DynaSoKOBAN',
    title: '中國朝代 SOKOBAN｜成績與通關證書登錄',
    description: '請使用完成朝代 SOKOBAN 的 Google 帳號登入，填寫成績並上傳通關證書截圖。',
    sheetTitle: 'DynaSoKOBAN 成績紀錄'
  }
];

function setupScoreForms() {
  var properties = PropertiesService.getScriptProperties();
  var registry = {};

  SCORE_FORM_CONFIGS.forEach(function(config) {
    var form = FormApp.create(config.title);
    form.setDescription(config.description);
    form.setCollectEmail(true);
    form.setLimitOneResponsePerUser(false);
    form.setConfirmationMessage('資料已送出，老師會依通關證書截圖核對成績。');

    var classItem = addRequiredText(form, '班級');
    var seatItem = addRequiredText(form, '座號');
    var nameItem = addRequiredText(form, '姓名');
    var scoreItem = addRequiredText(form, '分數');

    // Apps Script FormApp 目前無法以程式新增檔案上傳題型。
    // 表單建立後，請在 Google Form 編輯器手動新增同名的檔案上傳題。

    var responseSpreadsheet = SpreadsheetApp.create(config.sheetTitle);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSpreadsheet.getId());

    var recordSheet = responseSpreadsheet.insertSheet('有效成績');
    recordSheet.appendRow([
      '提交時間', 'Google Email', '班級', '座號', '姓名', '分數',
      '作答時間', '勳章', '通關證書檔案', '紀錄狀態'
    ]);
    recordSheet.setFrozenRows(1);

    ScriptApp.newTrigger('handleScoreFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();

    registry[config.unit] = {
      formId: form.getId(),
      formUrl: form.getPublishedUrl(),
      spreadsheetId: responseSpreadsheet.getId(),
      sheetTitle: config.sheetTitle,
      entries: {
        className: classItem.getId(),
        seat: seatItem.getId(),
        name: nameItem.getId(),
        score: scoreItem.getId(),
      }
    };
    Logger.log(config.unit + '：請手動新增「通關證書截圖」檔案上傳題，並設為必填、最多 1 個檔案。');
  });

  properties.setProperty('SCORE_FORM_REGISTRY', JSON.stringify(registry));
  Logger.log(JSON.stringify(registry, null, 2));
}

function addRequiredText(form, title) {
  return form.addTextItem().setTitle(title).setRequired(true);
}

// 已經建立的表單可執行一次，移除不再使用的欄位。
function updateExistingScoreForms() {
  var formIds = [
    '1FAIpQLSe0zZJA3NnwwEWIXOtcmqK1FPD88ScvnIGRrfVVY-SWnebdmg',
    '1FAIpQLSfpEN7ExwsG1kTcaNZDTf2KIFec2tpx7FqqxSSKydm0zzI2tQ'
  ];
  formIds.forEach(function(formId) {
    var form = FormApp.openById(formId);
    form.getItems().slice().forEach(function(item) {
      if (item.getTitle && ['作答時間', '勳章'].indexOf(item.getTitle()) !== -1) {
        form.deleteItem(item);
      }
    });
    form.setCollectEmail(true);
    Logger.log('已更新表單：' + form.getPublishedUrl());
    Logger.log('請確認表單內有必填的「通關證書截圖」檔案上傳題。');
  });
}

function handleScoreFormSubmit(event) {
  var source = event.source;
  var registry = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('SCORE_FORM_REGISTRY') || '{}'
  );
  var config = Object.keys(registry).map(function(unit) {
    return {unit: unit, data: registry[unit]};
  }).filter(function(item) {
    return item.data.formId === source.getId();
  })[0];
  if (!config) throw new Error('找不到表單對應的遊戲設定');

  var answers = {};
  event.response.getItemResponses().forEach(function(itemResponse) {
    var item = itemResponse.getItem();
    answers[item.getTitle()] = itemResponse.getResponse();
  });

  var email = String(event.response.getRespondentEmail() || '').trim().toLowerCase();
  if (!email) throw new Error('表單沒有取得已驗證的 Email');
  if (!/@st\.tc\.edu\.tw$/i.test(email)) throw new Error('只接受學校 Google 帳號');

  var spreadsheet = SpreadsheetApp.openById(config.data.spreadsheetId);
  var sheet = spreadsheet.getSheetByName('有效成績');
  if (!sheet) throw new Error('找不到有效成績工作表');

  var rows = sheet.getLastRow();
  if (rows > 1) {
    var existing = sheet.getRange(2, 1, rows - 1, 10).getValues();
    existing.forEach(function(row, index) {
      if (String(row[1]).trim().toLowerCase() === email && row[9] === '目前有效') {
        sheet.getRange(index + 2, 10).setValue('已被新紀錄取代');
      }
    });
  }

  var uploadedFiles = Array.isArray(answers['通關證書截圖'])
    ? answers['通關證書截圖'].join('\n')
    : String(answers['通關證書截圖'] || '');
  sheet.appendRow([
    event.response.getTimestamp(), email, answers['班級'] || '', answers['座號'] || '',
    answers['姓名'] || '', answers['分數'] || '', answers['作答時間'] || '',
    answers['勳章'] || '', uploadedFiles, '目前有效'
  ]);
}
