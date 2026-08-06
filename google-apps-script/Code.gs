/**
 * 義消隊務管理平台 Google Apps Script API
 *
 * 支援：
 * - 公告、人員、勤務、訓練、隊員紀錄、獎項、規則、證照讀取
 * - Duty 新增／修改／刪除
 *
 * 建議使用「綁定 Google Sheet」的 Apps Script 專案。
 */

const APP = Object.freeze({
  spreadsheetIdProperty: 'SPREADSHEET_ID',
  sheets: {
    Announcements: {
      readAction: 'getAnnouncements',
      headers: ['date', 'category', 'title', 'content', 'url', 'linkText', 'enabled', 'order'],
      booleanFields: ['enabled'],
      numberFields: ['order']
    },
    Persons: {
      readAction: 'getPersons',
      headers: ['nationalId', 'brigade', 'unit', 'department', 'title', 'name', 'gender', 'birthDate', 'emtLevel', 'phone', 'active', 'joinDate'],
      booleanFields: ['active']
    },
    Duties: {
      readAction: 'getDuties',
      headers: ['nationalId', 'name', 'createdAt', 'dutyType', 'serviceType', 'checkInDate', 'checkInTime', 'checkOutDate', 'checkOutTime', 'content', 'signatureData']
    },
    Training: {
      readAction: 'getTraining',
      headers: ['nationalId', 'name', 'trainingItem', 'completionDate', 'expiryDate', 'note']
    },
    MemberRecords: {
      readAction: 'getMemberRecords',
      headers: ['nationalId', 'name', 'date', 'recordType', 'content', 'note']
    },
    Awards: {
      readAction: 'getAwards',
      headers: ['nationalId', 'name', 'awardName', 'awardDate', 'source', 'note']
    },
    TrainingRules: {
      readAction: 'getTrainingRules',
      headers: ['name', 'description', 'basisType', 'basisTraining', 'completionWithinYears', 'minServiceMonths', 'requiredTraining', 'requiredEmtLevels', 'requiredTitle', 'lawName', 'lawUrl'],
      numberFields: ['completionWithinYears', 'minServiceMonths'],
      jsonFields: ['requiredTraining', 'requiredEmtLevels', 'requiredTitle']
    },
    AwardRules: {
      readAction: 'getAwardRules',
      headers: ['name', 'description', 'minServiceMonths', 'minDutyCount', 'minDutyHours', 'requiredTraining', 'lawName', 'lawUrl', 'manualReviewNote'],
      numberFields: ['minServiceMonths', 'minDutyCount', 'minDutyHours'],
      jsonFields: ['requiredTraining']
    },
    Certificates: {
      readAction: 'getCertificates',
      headers: ['nationalId', 'name', 'certificateName', 'completionDate', 'expiryDate', 'note']
    }
  }
});

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    const body = raw ? JSON.parse(raw) : {};
    return handleRequest_(body);
  } catch (error) {
    return jsonResponse_({ success: false, message: normalizeErrorMessage_(error) });
  }
}

function handleRequest_(request) {
  try {
    const action = String(request.action || '').trim();
    const payload = request.payload || {};

    if (!action) {
      throw new Error('缺少 action。');
    }

    const readConfig = findSheetConfigByReadAction_(action);
    if (readConfig) {
      const rows = readSheetObjects_(readConfig.sheetName, readConfig.config);
      return jsonResponse_({ success: true, data: rows });
    }

    switch (action) {
      case 'createDuty':
        return jsonResponse_({ success: true, data: createDuty_(payload) });
      case 'updateDuty':
        return jsonResponse_({ success: true, data: updateDuty_(payload) });
      case 'deleteDuty':
        return jsonResponse_({ success: true, data: deleteDuty_(payload) });
      case 'healthCheck':
        return jsonResponse_({ success: true, data: { status: 'ok', serverTime: new Date().toISOString() } });
      default:
        throw new Error(`不支援的 action：${action}`);
    }
  } catch (error) {
    console.error('[API] Request failed', error);
    return jsonResponse_({ success: false, message: normalizeErrorMessage_(error) });
  }
}

function createDuty_(payload) {
  const record = normalizeDutyRecord_(payload.record);
  validateDutyRecord_(record);

  return withDocumentLock_(function () {
    const sheet = getRequiredSheet_('Duties');
    const config = APP.sheets.Duties;
    const duplicate = findDutyRowIndex_(sheet, payload.originalNationalId || record.nationalId, payload.originalName || record.name, payload.originalCreatedAt || record.createdAt);

    if (duplicate >= 2) {
      throw new Error('此勤務紀錄已存在，請重新整理後再操作。');
    }

    sheet.appendRow(config.headers.map(function (header) {
      return sanitizeCellValue_(record[header]);
    }));

    return true;
  });
}

function updateDuty_(payload) {
  const record = normalizeDutyRecord_(payload.record);
  validateDutyRecord_(record);

  return withDocumentLock_(function () {
    const sheet = getRequiredSheet_('Duties');
    const rowIndex = findDutyRowIndex_(sheet, payload.originalNationalId, payload.originalName, payload.originalCreatedAt);

    if (rowIndex < 2) {
      throw new Error('找不到要修改的勤務紀錄。');
    }

    const values = APP.sheets.Duties.headers.map(function (header) {
      return sanitizeCellValue_(record[header]);
    });
    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
    return true;
  });
}

function deleteDuty_(payload) {
  return withDocumentLock_(function () {
    const sheet = getRequiredSheet_('Duties');
    const rowIndex = findDutyRowIndex_(sheet, payload.originalNationalId, payload.originalName, payload.originalCreatedAt);

    if (rowIndex < 2) {
      throw new Error('找不到要刪除的勤務紀錄。');
    }

    sheet.deleteRow(rowIndex);
    return true;
  });
}

function findDutyRowIndex_(sheet, nationalId, name, createdAt) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getDisplayValues();
  const targetNationalId = normalizeText_(nationalId).toUpperCase();
  const targetName = normalizeText_(name);
  const targetCreatedAt = normalizeText_(createdAt);

  for (let index = 0; index < values.length; index += 1) {
    if (
      normalizeText_(values[index][0]).toUpperCase() === targetNationalId &&
      normalizeText_(values[index][1]) === targetName &&
      normalizeText_(values[index][2]) === targetCreatedAt
    ) {
      return index + 2;
    }
  }

  return -1;
}

function readSheetObjects_(sheetName, config) {
  const sheet = getRequiredSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const headerIndexes = {};
  headerValues.forEach(function (header, index) {
    headerIndexes[String(header).trim()] = index;
  });

  const missingHeaders = config.headers.filter(function (header) {
    return headerIndexes[header] === undefined;
  });
  if (missingHeaders.length) {
    throw new Error(`${sheetName} 缺少欄位：${missingHeaders.join('、')}`);
  }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  return values
    .filter(function (row) {
      return row.some(function (cell) { return String(cell).trim() !== ''; });
    })
    .map(function (row) {
      const item = {};
      config.headers.forEach(function (header) {
        let value = row[headerIndexes[header]];
        value = deserializeField_(value, header, config);
        item[header] = value;
      });
      return item;
    });
}

function deserializeField_(value, header, config) {
  if ((config.booleanFields || []).indexOf(header) >= 0) {
    return parseBoolean_(value);
  }
  if ((config.numberFields || []).indexOf(header) >= 0) {
    const numberValue = Number(value);
    return String(value).trim() === '' || Number.isNaN(numberValue) ? 0 : numberValue;
  }
  if ((config.jsonFields || []).indexOf(header) >= 0) {
    if (String(value).trim() === '') {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      throw new Error(`${header} 必須是 JSON 陣列格式。`);
    }
  }
  return String(value || '');
}

function normalizeDutyRecord_(record) {
  const source = record || {};
  const normalized = {};
  APP.sheets.Duties.headers.forEach(function (header) {
    normalized[header] = normalizeText_(source[header]);
  });
  return normalized;
}

function validateDutyRecord_(record) {
  if (!record.nationalId) throw new Error('勤務資料缺少身分證字號。');
  if (!record.name) throw new Error('勤務資料缺少姓名。');
  if (!record.createdAt) throw new Error('勤務資料缺少建立時間。');
  if (!record.dutyType) throw new Error('勤務資料缺少勤務類型。');

  const person = findPersonByNationalId_(record.nationalId);
  if (!person) throw new Error('人員主檔不存在此身分證字號。');
  if (person.name !== record.name) throw new Error('勤務姓名與人員主檔不一致。');
  if (!person.active) throw new Error('停用人員不可新增或修改勤務。');
}

function findPersonByNationalId_(nationalId) {
  const persons = readSheetObjects_('Persons', APP.sheets.Persons);
  const key = normalizeText_(nationalId).toUpperCase();
  return persons.find(function (person) {
    return normalizeText_(person.nationalId).toUpperCase() === key;
  }) || null;
}

function findSheetConfigByReadAction_(action) {
  const sheetNames = Object.keys(APP.sheets);
  for (let index = 0; index < sheetNames.length; index += 1) {
    const sheetName = sheetNames[index];
    const config = APP.sheets[sheetName];
    if (config.readAction === action) {
      return { sheetName: sheetName, config: config };
    }
  }
  return null;
}

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }

  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(APP.spreadsheetIdProperty);
  if (!spreadsheetId) {
    throw new Error('找不到 Google Sheet。請將 Apps Script 綁定試算表，或設定 SPREADSHEET_ID Script Property。');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getRequiredSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`找不到工作表：${sheetName}。請先執行 setupSheets()。`);
  }
  return sheet;
}

function withDocumentLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function parseBoolean_(value) {
  const text = String(value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', '是', '啟用'].indexOf(text) >= 0;
}

function sanitizeCellValue_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
    return JSON.stringify(value);
  }
  const text = String(value);
  // 避免試算表公式注入。
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function normalizeText_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function normalizeErrorMessage_(error) {
  return error && error.message ? String(error.message) : String(error || '未知錯誤');
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
