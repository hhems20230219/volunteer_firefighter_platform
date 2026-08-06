# Google Apps Script CRUD API

## 權限範圍

|資料|API 操作|
|---|---|
|Announcements|Read|
|Persons|Read|
|Duties|Create / Read / Update / Delete|
|Training|Read|
|MemberRecords|Read|
|Awards|Read|
|TrainingRules|Read|
|AwardRules|Read|
|Certificates|Read|

## 建立方式

1. 建立 Google Sheet。
2. 在試算表選擇「擴充功能 → Apps Script」。
3. 將 `Code.gs`、`Setup.gs`、`appsscript.json` 複製到專案。
4. 執行 `setupSheets()`，授權後會建立全部工作表與標頭。
5. 將現有 JSON 資料貼入對應工作表；第一列標頭不可改名。
6. 部署為 Web App：
   - Execute as：Me
   - Who has access：Anyone
7. 將部署網址填入前端 `config.js` 的 `API_BASE_URL`。
8. 將 `USE_ONLINE_DATA` 改為 `true`。

## Duty 唯一識別

勤務單筆資料使用以下組合定位：

- `nationalId`
- `name`
- `createdAt`（精確到毫秒）

## 陣列欄位

以下欄位在 Google Sheet 儲存為 JSON 字串：

- TrainingRules.requiredTraining
- TrainingRules.requiredEmtLevels
- TrainingRules.requiredTitle
- AwardRules.requiredTraining

例如：

```json
["EMT-1","EMT-2"]
```

## 安全注意

目前登入是前端輸入身分證字號，適合內部原型與受控環境。正式公開使用時，應再整合 Google Workspace 身分、企業 SSO 或後端 Session；不要將身分證字號視為密碼。
