/** 建立或校正全部工作表與標頭。 */
function setupSheets() {
  const spreadsheet = getSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty(APP.spreadsheetIdProperty, spreadsheet.getId());
  Object.keys(APP.sheets).forEach(function (sheetName) {
    const config = APP.sheets[sheetName];
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    const currentHeaders = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), config.headers.length)).getDisplayValues()[0]
      : [];

    config.headers.forEach(function (header, index) {
      if (currentHeaders[index] !== header) {
        sheet.getRange(1, index + 1).setValue(header);
      }
    });

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, config.headers.length)
      .setFontWeight('bold')
      .setBackground('#9f1d2d')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, config.headers.length);
  });

  SpreadsheetApp.flush();
  console.log('Google Sheet 初始化完成。');
}

/**
 * Standalone Apps Script 專案使用：設定目標試算表 ID。
 * 綁定試算表的 Apps Script 不需要執行。
 */
function setSpreadsheetId(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('請提供 spreadsheetId。');
  }
  PropertiesService.getScriptProperties().setProperty(APP.spreadsheetIdProperty, spreadsheetId);
}
