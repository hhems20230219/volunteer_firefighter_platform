/**
 * 將前端 data/*.json 的目前範例資料匯入 Google Sheet。
 * 執行前會先建立工作表；預設只寫入空白工作表。
 */
const SAMPLE_DATA = Object.freeze({
  "Announcements": [
    {
      "date": "2026-08-10",
      "category": "訓練",
      "title": "八月份常年訓練",
      "content": "請依公告時間準時完成簽到定位確認。"
    },
    {
      "date": "2026-08-15",
      "category": "活動",
      "title": "防災宣導活動",
      "content": "集合地點與服裝規定請參閱群組公告。"
    },
    {
      "date": "2026-08-20",
      "category": "隊務事項",
      "title": "勤務紀錄確認",
      "content": "請確認本月個人勤務資料是否完整。",
      "url": "https://www.nfa.gov.tw/",
      "linkText": "查看消防署網站"
    }
  ],
  "Persons": [
    {
      "nationalId": "E123714468",
      "brigade": "第一救護大隊",
      "unit": "新興分隊",
      "department": "分隊部",
      "title": "幹事",
      "name": "吳宇樺",
      "gender": "男",
      "birthDate": "1989-09-26",
      "emtLevel": "EMT-1",
      "phone": "0983186098",
      "active": true,
      "joinDate": "2023-09-01"
    },
    {
      "nationalId": "A223456789",
      "brigade": "第一救護大隊",
      "unit": "新興分隊",
      "department": "救護組",
      "title": "隊員",
      "name": "陳怡君",
      "gender": "女",
      "birthDate": "1992-04-18",
      "emtLevel": "EMT-2",
      "phone": "0911222333",
      "active": true,
      "joinDate": "2022-03-15"
    },
    {
      "nationalId": "B123456789",
      "brigade": "第一救護大隊",
      "unit": "新興分隊",
      "department": "救護組",
      "title": "小隊長",
      "name": "林志豪",
      "gender": "男",
      "birthDate": "1985-02-10",
      "emtLevel": "EMT-1",
      "phone": "0922333444",
      "active": true,
      "joinDate": "2018-01-10"
    },
    {
      "nationalId": "C223456789",
      "brigade": "第一救護大隊",
      "unit": "新興分隊",
      "department": "救護組",
      "title": "隊員",
      "name": "黃美玲",
      "gender": "女",
      "birthDate": "1990-07-22",
      "emtLevel": "EMT-1",
      "phone": "0933444555",
      "active": true,
      "joinDate": "2020-05-01"
    },
    {
      "nationalId": "D123456789",
      "brigade": "第一救護大隊",
      "unit": "新興分隊",
      "department": "救護組",
      "title": "隊員",
      "name": "張家豪",
      "gender": "男",
      "birthDate": "1997-11-08",
      "emtLevel": "EMT-1",
      "phone": "0944555666",
      "active": true,
      "joinDate": "2024-06-01"
    }
  ],
  "Duties": [
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-01-05 07:50:00.101",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-01-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-01-05",
      "checkOutTime": "12:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-02-05 07:50:00.102",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-02-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-02-05",
      "checkOutTime": "12:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-03-05 07:50:00.103",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-03-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-03-05",
      "checkOutTime": "12:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-04-05 07:50:00.104",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-04-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-04-05",
      "checkOutTime": "12:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-05-05 07:50:00.105",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-05-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-05-05",
      "checkOutTime": "12:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-06-05 07:50:00.106",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-06-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-06-05",
      "checkOutTime": "12:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-07-05 07:50:00.107",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-07-05",
      "checkInTime": "08:00",
      "checkOutDate": "2026-07-05",
      "checkOutTime": "10:00",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-08-01 07:50:00.108",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-08-01",
      "checkInTime": "08:00",
      "checkOutDate": "2026-08-01",
      "checkOutTime": "12:30",
      "content": "協勤勤務",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-01-10 09:00:00.200",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-01-10",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-02-10 09:00:00.201",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-02-10",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-03-10 09:00:00.202",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-03-10",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-04-10 09:00:00.203",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-04-10",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-05-10 09:00:00.204",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-05-10",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-06-10 09:00:00.300",
      "dutyType": "常年訓練",
      "serviceType": "無故缺席",
      "checkInDate": "",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-07-10 09:00:00.301",
      "dutyType": "常年訓練",
      "serviceType": "無故缺席",
      "checkInDate": "",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-08-03 14:05:10.456",
      "dutyType": "常年訓練",
      "serviceType": "出席",
      "checkInDate": "2026-08-03",
      "checkInTime": "14:00",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "createdAt": "2026-08-08 18:00:00.001",
      "dutyType": "公差勤務",
      "serviceType": "",
      "checkInDate": "2026-08-08",
      "checkInTime": "18:00",
      "checkOutDate": "2026-08-08",
      "checkOutTime": "21:00",
      "content": "活動支援",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-01-08 09:00:00.100",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-01-08",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-02-08 09:00:00.101",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-02-08",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-03-08 09:00:00.102",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-03-08",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-04-08 09:00:00.103",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-04-08",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-05-08 09:00:00.104",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-05-08",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-06-08 09:00:00.105",
      "dutyType": "常年訓練",
      "serviceType": "請假",
      "checkInDate": "2026-06-08",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-03-20 09:00:00.200",
      "dutyType": "常年訓練",
      "serviceType": "無故缺席",
      "checkInDate": "",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-05-20 09:00:00.201",
      "dutyType": "常年訓練",
      "serviceType": "無故缺席",
      "checkInDate": "",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-07-20 09:00:00.202",
      "dutyType": "常年訓練",
      "serviceType": "無故缺席",
      "checkInDate": "",
      "checkInTime": "",
      "checkOutDate": "",
      "checkOutTime": "",
      "content": "",
      "signatureData": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "createdAt": "2026-08-02 18:32:11.321",
      "dutyType": "公差勤務",
      "serviceType": "",
      "checkInDate": "2026-08-02",
      "checkInTime": "18:30",
      "checkOutDate": "2026-08-02",
      "checkOutTime": "21:00",
      "content": "歌唱比賽",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-01-12 08:00:00.001",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-01-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-01-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-02-12 08:00:00.002",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-02-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-02-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-03-12 08:00:00.003",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-03-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-03-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-04-12 08:00:00.004",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-04-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-04-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-05-12 08:00:00.005",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-05-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-05-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-06-12 08:00:00.006",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-06-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-06-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-07-12 08:00:00.007",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-07-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-07-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "createdAt": "2026-08-12 08:00:00.008",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-08-12",
      "checkInTime": "08:00",
      "checkOutDate": "2026-08-12",
      "checkOutTime": "12:00",
      "content": "救護協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-01-15 07:50:00.001",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-01-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-01-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-02-15 07:50:00.002",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-02-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-02-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-03-15 07:50:00.003",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-03-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-03-15",
      "checkOutTime": "10:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-04-15 07:50:00.004",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-04-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-04-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-05-15 07:50:00.005",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-05-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-05-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-06-15 07:50:00.006",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-06-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-06-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-07-15 07:50:00.007",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-07-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-07-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "createdAt": "2026-08-15 07:50:00.008",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-08-15",
      "checkInTime": "08:00",
      "checkOutDate": "2026-08-15",
      "checkOutTime": "12:00",
      "content": "勤務協勤",
      "signatureData": ""
    },
    {
      "nationalId": "D123456789",
      "name": "張家豪",
      "createdAt": "2026-06-18 18:00:00.006",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-06-18",
      "checkInTime": "18:00",
      "checkOutDate": "2026-06-18",
      "checkOutTime": "20:00",
      "content": "新進協勤",
      "signatureData": ""
    },
    {
      "nationalId": "D123456789",
      "name": "張家豪",
      "createdAt": "2026-07-18 18:00:00.007",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-07-18",
      "checkInTime": "18:00",
      "checkOutDate": "2026-07-18",
      "checkOutTime": "20:00",
      "content": "新進協勤",
      "signatureData": ""
    },
    {
      "nationalId": "D123456789",
      "name": "張家豪",
      "createdAt": "2026-08-18 18:00:00.008",
      "dutyType": "協勤",
      "serviceType": "出勤",
      "checkInDate": "2026-08-18",
      "checkInTime": "18:00",
      "checkOutDate": "2026-08-18",
      "checkOutTime": "20:00",
      "content": "新進協勤",
      "signatureData": ""
    }
  ],
  "Training": [
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "trainingItem": "素行調查",
      "completionDate": "2023-02-01",
      "expiryDate": "",
      "note": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "trainingItem": "新進人員基本訓練",
      "completionDate": "2023-06-01",
      "expiryDate": "",
      "note": "於素行調查後 2 年內完成"
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "trainingItem": "基礎幹部講習班",
      "completionDate": "2024-03-01",
      "expiryDate": "",
      "note": "於素行調查後 3 年內完成"
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "trainingItem": "素行調查",
      "completionDate": "2025-03-01",
      "expiryDate": "",
      "note": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "trainingItem": "素行調查",
      "completionDate": "2021-01-15",
      "expiryDate": "",
      "note": "已逾新進訓練與基礎幹部講習班期限"
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "trainingItem": "素行調查",
      "completionDate": "2025-07-01",
      "expiryDate": "",
      "note": "仍在完成期限內"
    }
  ],
  "MemberRecords": [
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "date": "2023-09-01",
      "recordType": "入隊",
      "content": "加入新興分隊",
      "note": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "date": "2025-01-01",
      "recordType": "職務異動",
      "content": "擔任分隊部幹事",
      "note": ""
    },
    {
      "nationalId": "A223456789",
      "name": "陳怡君",
      "date": "2022-03-15",
      "recordType": "入隊",
      "content": "加入新興分隊",
      "note": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "date": "2018-01-10",
      "recordType": "入隊",
      "content": "加入新興分隊",
      "note": ""
    },
    {
      "nationalId": "B123456789",
      "name": "林志豪",
      "date": "2024-01-01",
      "recordType": "職務異動",
      "content": "擔任小隊長",
      "note": ""
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "date": "2020-05-01",
      "recordType": "入隊",
      "content": "加入新興分隊",
      "note": ""
    },
    {
      "nationalId": "D123456789",
      "name": "張家豪",
      "date": "2024-06-01",
      "recordType": "入隊",
      "content": "加入新興分隊",
      "note": "新進人員"
    }
  ],
  "Awards": [
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "awardName": "年度熱心服務獎",
      "awardDate": "2025-12-20",
      "source": "外部獎項",
      "note": "2025年度"
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "awardName": "民間公益服務表揚",
      "awardDate": "2024-11-10",
      "source": "外部獎項",
      "note": "非系統條件判斷獎項"
    },
    {
      "nationalId": "C223456789",
      "name": "黃美玲",
      "awardName": "內政部消防署全國消防楷模",
      "awardDate": "2026-01-20",
      "source": "法定獎項",
      "note": "已取得範例"
    }
  ],
  "TrainingRules": [
    {
      "name": "新進人員基本訓練",
      "description": "§10 入隊後三年內應完成新進人員基本訓練。",
      "basisPersonField": "joinDate",
      "basisPersonFieldName": "入隊日期",
      "completionWithinYears": 3,
      "lawName": "義勇消防組織編組訓練演習服勤辦法",
      "lawUrl": "https://law.nfa.gov.tw/MOBILE/law.aspx?LSID=FL005073"
    },
    {
      "name": "基礎幹部講習班",
      "description": "§12.4 已完成新進人員基本訓練後，三年內應完成基礎幹部講習班。",
      "requiredTraining": [
        "新進人員基本訓練"
      ],
      "basisTraining": "新進人員基本訓練",
      "completionWithinYears": 3,
      "lawName": "義勇消防組織編組訓練演習服勤辦法",
      "lawUrl": "https://law.nfa.gov.tw/MOBILE/law.aspx?LSID=FL005073"
    }
  ],
  "AwardRules": [
    {
      "name": "內政部消防署全國消防楷模",
      "description": "服務年資須滿 5 年。",
      "minServiceMonths": 60,
      "lawName": "內政部消防署全國消防楷模甄選表揚實施規定",
      "lawUrl": "https://law.nfa.gov.tw/MOBILE/law.aspx?LSID=FL029281",
      "manualReviewNote": "系統僅自動判斷服務年資；其他甄選與審查條件仍須由承辦單位確認。"
    },
    {
      "name": "內政部消防署全國救護志工菁英",
      "description": "服務年資須滿 5 年、累計出勤時數須滿 1000 小時。",
      "minServiceMonths": 60,
      "minTotalDutyHours": 1000,
      "lawName": "內政部消防署全國救護志工菁英甄選表揚實施規定",
      "lawUrl": "https://law.nfa.gov.tw/MOBILE/law.aspx?LSID=FL060960",
      "manualReviewNote": "系統自動判斷服務年資與累計出勤時數；其他甄選與審查條件仍須由承辦單位確認。"
    }
  ],
  "Certificates": [
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "certificateName": "ACLS",
      "completionDate": "",
      "expiryDate": "",
      "note": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "certificateName": "BLS",
      "completionDate": "2025-01-10",
      "expiryDate": "",
      "note": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "certificateName": "BLS-I",
      "completionDate": "",
      "expiryDate": "",
      "note": ""
    },
    {
      "nationalId": "E123714468",
      "name": "吳宇樺",
      "certificateName": "TECC",
      "completionDate": "",
      "expiryDate": "",
      "note": ""
    }
  ]
});

function seedSampleData(overwrite) {
  setupSheets();
  const shouldOverwrite = overwrite === true;
  const spreadsheet = getSpreadsheet_();

  Object.keys(SAMPLE_DATA).forEach(function (sheetName) {
    const rows = SAMPLE_DATA[sheetName] || [];
    const config = APP.sheets[sheetName];
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!config || !sheet || !rows.length) {
      return;
    }

    if (sheet.getLastRow() > 1 && !shouldOverwrite) {
      console.log(sheetName + ' 已有資料，略過匯入。');
      return;
    }

    if (shouldOverwrite && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }

    const values = rows.map(function (record) {
      return config.headers.map(function (header) {
        return sanitizeCellValue_(record[header]);
      });
    });

    sheet.getRange(2, 1, values.length, config.headers.length).setValues(values);
    sheet.autoResizeColumns(1, config.headers.length);
  });

  SpreadsheetApp.flush();
  console.log('範例資料匯入完成。');
}
