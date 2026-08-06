window.DataService = (() => {
    const files = {
        getAnnouncements: 'announcements.json', getPersons: 'persons.json', getDuties: 'duties.json', getTraining: 'training.json', getMemberRecords: 'member-records.json', getAwards: 'awards.json', getTrainingRules: 'training-rules.json', getAwardRules: 'award-rules.json', getCertificates: 'certificates.json'
    };
    async function getSample(action) {
        if (action === 'getDuties') {
            const versionKey = 'vf_duties_version';
            const currentVersion = String(AppConfig.SAMPLE_DATA_VERSION || '');
            const savedVersion = localStorage.getItem(versionKey);

            if (savedVersion !== currentVersion) {
                localStorage.removeItem('vf_duties');
                localStorage.setItem(versionKey, currentVersion);
                console.log('[DataService] 範例勤務資料版本已更新，重新載入完整情境資料', {
                    oldVersion: savedVersion,
                    newVersion: currentVersion
                });
            }

            const saved = localStorage.getItem('vf_duties');
            if (saved) {
                const rows = JSON.parse(saved);
                let changed = false;
                rows.forEach(row => {
                    const migratedNationalId = AppConfig.NATIONAL_ID_MIGRATIONS?.[row.nationalId];
                    if (migratedNationalId) {
                        row.nationalId = migratedNationalId;
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem('vf_duties', JSON.stringify(rows));
                    console.log('[DataService] 已移轉範例勤務的身分證字號');
                }
                return rows;
            }
        }
        return $.getJSON(`data/${files[action]}`);
    }
    async function request(action, payload = {}) {
        if (window.AppConfig?.ENABLE_DEBUG_LOG) console.log('[DataService] Request', { action, mode: AppConfig.USE_ONLINE_DATA ? 'online' : 'sample', payload });
        if (!AppConfig.USE_ONLINE_DATA) {
            if (['createDuty','updateDuty','deleteDuty'].includes(action)) return mutateDuty(action, payload);
            return getSample(action);
        }
        const response = await $.ajax({ url: AppConfig.API_BASE_URL, method: 'POST', contentType: 'application/json', data: JSON.stringify({ action, payload }) });
        if (response?.success === false) throw new Error(response.message || '線上資料操作失敗');
        const result = response.data ?? response;
            if (window.AppConfig?.ENABLE_DEBUG_LOG) console.log('[DataService] Response', { action, result });
            return result;
    }
    async function mutateDuty(action, payload) {
        const rows = await getSample('getDuties');
        const keyMatch = row => row.nationalId === payload.originalNationalId && row.name === payload.originalName && row.createdAt === payload.originalCreatedAt;
        if (action === 'createDuty') rows.push(payload.record);
        if (action === 'updateDuty') { const i = rows.findIndex(keyMatch); if (i < 0) throw new Error('找不到要修改的勤務紀錄'); rows[i] = payload.record; }
        if (action === 'deleteDuty') { const i = rows.findIndex(keyMatch); if (i < 0) throw new Error('找不到要刪除的勤務紀錄'); rows.splice(i,1); }
        localStorage.setItem('vf_duties', JSON.stringify(rows)); return true;
    }
    return { request };
})();
