window.DataService = (() => {
    const files = {
        getAnnouncements: 'announcements.json',
        getPersons: 'persons.json',
        getDuties: 'duties.json',
        getTraining: 'training.json',
        getMemberRecords: 'member-records.json',
        getAwards: 'awards.json',
        getTrainingRules: 'training-rules.json',
        getAwardRules: 'award-rules.json',
        getCertificates: 'certificates.json'
    };

    const dutyMutationActions = new Set([
        'createDuty',
        'updateDuty',
        'deleteDuty'
    ]);

    async function getSample(action) {
        if (!files[action]) {
            throw new Error(`範例模式不支援 action：${action}`);
        }

        if (action === 'getDuties') {
            const versionKey = 'vf_duties_version';
            const currentVersion = String(AppConfig.SAMPLE_DATA_VERSION || '');
            const savedVersion = localStorage.getItem(versionKey);

            if (savedVersion !== currentVersion) {
                localStorage.removeItem('vf_duties');
                localStorage.setItem(versionKey, currentVersion);
                debugLog('範例勤務資料版本已更新，重新載入完整情境資料', {
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
                    debugLog('已移轉範例勤務的身分證字號');
                }

                return rows;
            }
        }

        return $.getJSON(`data/${files[action]}`);
    }

    async function request(action, payload = {}) {
        debugLog('Request', {
            action,
            mode: AppConfig.USE_ONLINE_DATA ? 'online' : 'sample',
            payload
        });

        if (!AppConfig.USE_ONLINE_DATA) {
            if (dutyMutationActions.has(action)) {
                return mutateDuty(action, payload);
            }
            return getSample(action);
        }

        return requestOnline(action, payload);
    }

    async function requestOnline(action, payload) {
        if (!AppConfig.API_BASE_URL || AppConfig.API_BASE_URL.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
            throw new Error('尚未設定 Google Apps Script API_BASE_URL。');
        }

        try {
            const response = await $.ajax({
                url: AppConfig.API_BASE_URL,
                method: 'POST',
                contentType: 'text/plain;charset=utf-8',
                dataType: 'json',
                timeout: Number(AppConfig.API_TIMEOUT_MS) || 30000,
                data: JSON.stringify({ action, payload })
            });

            if (response?.success === false) {
                throw new Error(response.message || 'Google Sheet API 操作失敗。');
            }

            const result = response?.data ?? response;
            debugLog('Response', { action, result });
            return result;
        } catch (error) {
            const message = normalizeAjaxError(error);
            console.error('[DataService] Online request failed', {
                action,
                message,
                error
            });
            throw new Error(message);
        }
    }

    async function mutateDuty(action, payload) {
        const rows = await getSample('getDuties');
        const keyMatch = row => (
            row.nationalId === payload.originalNationalId
            && row.name === payload.originalName
            && row.createdAt === payload.originalCreatedAt
        );

        if (action === 'createDuty') {
            rows.push(payload.record);
        }

        if (action === 'updateDuty') {
            const index = rows.findIndex(keyMatch);
            if (index < 0) {
                throw new Error('找不到要修改的勤務紀錄。');
            }
            rows[index] = payload.record;
        }

        if (action === 'deleteDuty') {
            const index = rows.findIndex(keyMatch);
            if (index < 0) {
                throw new Error('找不到要刪除的勤務紀錄。');
            }
            rows.splice(index, 1);
        }

        localStorage.setItem('vf_duties', JSON.stringify(rows));
        return true;
    }

    function normalizeAjaxError(error) {
        if (error?.responseJSON?.message) {
            return error.responseJSON.message;
        }

        if (error?.statusText === 'timeout') {
            return 'Google Sheet API 連線逾時，請稍後再試。';
        }

        if (error?.status === 0) {
            return '無法連線 Google Apps Script API，請確認部署權限與網址。';
        }

        if (error?.responseText) {
            try {
                const parsed = JSON.parse(error.responseText);
                if (parsed?.message) {
                    return parsed.message;
                }
            } catch {
                // 回傳內容不是 JSON 時，改用通用錯誤訊息。
            }
        }

        return error?.message || 'Google Sheet API 操作失敗。';
    }

    function debugLog(message, data) {
        if (!window.AppConfig?.ENABLE_DEBUG_LOG) {
            return;
        }

        if (data === undefined) {
            console.log(`[DataService] ${message}`);
        } else {
            console.log(`[DataService] ${message}`, data);
        }
    }

    return Object.freeze({ request });
})();
