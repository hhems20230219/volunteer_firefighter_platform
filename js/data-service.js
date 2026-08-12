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

    const readActions = new Set(Object.keys(files));
    const memoryCache = new Map();
    const inFlightRequests = new Map();
    const sessionCachePrefix = 'vf_cache_';

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

    function sessionCacheKey(action) {
        return `${sessionCachePrefix}${action}`;
    }

    function cacheTtl(action) {
        if (action === 'getPersons') {
            return Number(AppConfig.PERSON_CACHE_TTL_MS) || 300000;
        }
        return Number(AppConfig.READ_CACHE_TTL_MS) || 30000;
    }

    function getSessionCache(action) {
        if (!readActions.has(action)) {
            return null;
        }

        try {
            const key = sessionCacheKey(action);
            const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
            if (!cached || !Array.isArray(cached.data) || !cached.savedAt) {
                return null;
            }

            if (Date.now() - Number(cached.savedAt) > cacheTtl(action)) {
                sessionStorage.removeItem(key);
                return null;
            }

            return cached.data;
        } catch {
            sessionStorage.removeItem(sessionCacheKey(action));
            return null;
        }
    }

    function setSessionCache(action, rows) {
        if (!readActions.has(action) || !Array.isArray(rows)) {
            return;
        }

        try {
            sessionStorage.setItem(sessionCacheKey(action), JSON.stringify({
                savedAt: Date.now(),
                data: rows
            }));
        } catch (error) {
            debugLog(`${action} session 快取寫入失敗，忽略快取`, error);
        }
    }

    function getCached(action) {
        if (memoryCache.has(action)) {
            return memoryCache.get(action);
        }

        const cached = getSessionCache(action);
        if (cached) {
            memoryCache.set(action, cached);
            debugLog('使用 session 快取', { action, count: cached.length });
            return cached;
        }

        return undefined;
    }

    function setCached(action, data) {
        if (!readActions.has(action)) {
            return;
        }

        memoryCache.set(action, data);
        setSessionCache(action, data);
    }

    function clearCache(action) {
        if (action) {
            memoryCache.delete(action);
            sessionStorage.removeItem(sessionCacheKey(action));
            return;
        }

        memoryCache.clear();
        readActions.forEach(readAction => {
            sessionStorage.removeItem(sessionCacheKey(readAction));
        });
    }

    function setCachedData(action, data) {
        if (!readActions.has(action)) {
            throw new Error(`不可快取非讀取 action：${action}`);
        }
        setCached(action, data);
    }

    async function request(action, payload = {}) {
        debugLog('Request', {
            action,
            mode: AppConfig.USE_ONLINE_DATA ? 'online' : 'sample',
            payload
        });

        if (readActions.has(action)) {
            const cached = getCached(action);
            if (cached !== undefined) {
                return cached;
            }

            if (inFlightRequests.has(action)) {
                debugLog('共用進行中的讀取要求', { action });
                return inFlightRequests.get(action);
            }
        }

        const promise = (async () => {
            if (!AppConfig.USE_ONLINE_DATA) {
                if (dutyMutationActions.has(action)) {
                    const result = await mutateDuty(action, payload);
                    clearCache('getDuties');
                    return result;
                }

                const result = await getSample(action);
                setCached(action, result);
                return result;
            }

            const result = await requestOnline(action, payload, readActions.has(action));
            setCached(action, result);

            if (dutyMutationActions.has(action)) {
                clearCache('getDuties');
            }

            return result;
        })();

        if (readActions.has(action)) {
            inFlightRequests.set(action, promise);
        }

        try {
            return await promise;
        } finally {
            if (inFlightRequests.get(action) === promise) {
                inFlightRequests.delete(action);
            }
        }
    }

    async function requestBundle(actions) {
        const requestedActions = [...new Set((actions || []).map(String).filter(Boolean))];
        if (!requestedActions.length) {
            return {};
        }

        requestedActions.forEach(action => {
            if (!readActions.has(action)) {
                throw new Error(`批次讀取不支援 action：${action}`);
            }
        });

        const result = {};
        const missingActions = [];

        requestedActions.forEach(action => {
            const cached = getCached(action);
            if (cached !== undefined) {
                result[action] = cached;
            } else {
                missingActions.push(action);
            }
        });

        if (!missingActions.length) {
            debugLog('批次讀取全部命中快取', { actions: requestedActions });
            return result;
        }

        if (!AppConfig.USE_ONLINE_DATA) {
            const rows = await Promise.all(missingActions.map(action => getSample(action)));
            missingActions.forEach((action, index) => {
                result[action] = rows[index];
                setCached(action, rows[index]);
            });
            return result;
        }

        debugLog('送出單次批次讀取', { actions: missingActions });
        const bundle = await requestOnline('getBundle', { actions: missingActions }, true);

        missingActions.forEach(action => {
            const data = bundle?.[action] ?? [];
            result[action] = data;
            setCached(action, data);
        });

        return result;
    }

    async function requestOnline(action, payload, canRetry) {
        if (!AppConfig.API_BASE_URL || AppConfig.API_BASE_URL.includes('REPLACE_WITH_DEPLOYMENT_ID')) {
            throw new Error('尚未設定 Google Apps Script API_BASE_URL。');
        }

        const retryCount = canRetry ? Math.max(0, Number(AppConfig.API_READ_RETRY_COUNT) || 0) : 0;
        let lastError = null;

        for (let attempt = 0; attempt <= retryCount; attempt += 1) {
            try {
                const response = await $.ajax({
                    url: AppConfig.API_BASE_URL,
                    method: 'POST',
                    contentType: 'text/plain;charset=utf-8',
                    dataType: 'json',
                    timeout: Number(AppConfig.API_TIMEOUT_MS) || 20000,
                    data: JSON.stringify({ action, payload })
                });

                if (response?.success === false) {
                    throw createResponseError(response.message || 'Google Sheet API 操作失敗。');
                }

                const result = response?.data ?? response;
                debugLog('Response', { action, attempt: attempt + 1, result });
                return result;
            } catch (error) {
                lastError = error;
                const retryable = canRetry && isRetryableError(error) && attempt < retryCount;

                console.error('[DataService] Online request failed', {
                    action,
                    attempt: attempt + 1,
                    retryable,
                    message: normalizeAjaxError(error),
                    error
                });

                if (!retryable) {
                    break;
                }

                const delay = (Number(AppConfig.API_RETRY_BASE_DELAY_MS) || 1200) * Math.pow(2, attempt);
                debugLog('Google Sheet API 暫時失敗，準備重試', {
                    action,
                    nextAttempt: attempt + 2,
                    delay
                });
                await sleep(delay);
            }
        }

        throw new Error(normalizeAjaxError(lastError));
    }

    function createResponseError(message) {
        const error = new Error(message);
        error.isApiResponseError = true;
        return error;
    }

    function isRetryableError(error) {
        if (!error || error.isApiResponseError) {
            return false;
        }

        return error.statusText === 'timeout'
            || error.status === 0
            || Number(error.status) >= 500;
    }

    function sleep(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    async function mutateDuty(action, payload) {
        const rows = [...await getSample('getDuties')];
        const keyMatch = row => (
            row.nationalId === payload.originalNationalId
            && row.name === payload.originalName
            && row.createdAt === payload.originalCreatedAt
        );

        if (action === 'createDuty') {
            const record = payload.record || {};
            const duplicate = record.checkInDate && record.checkInTime
                ? rows.some(row => (
                    row.nationalId === record.nationalId
                    && row.dutyType === record.dutyType
                    && row.serviceType === record.serviceType
                    && row.checkInDate === record.checkInDate
                    && row.checkInTime === record.checkInTime
                ))
                : false;

            if (duplicate) {
                throw new Error('系統偵測到相同的簽到紀錄已存在，已阻止重複新增。請重新整理頁面確認目前勤務狀態。');
            }

            const requiresCheckOut = record.dutyType === '協勤' || record.dutyType === '公差勤務';
            const pending = requiresCheckOut
                ? rows.some(row => (
                    row.nationalId === record.nationalId
                    && (row.dutyType === '協勤' || row.dutyType === '公差勤務')
                    && (!row.checkOutDate || !row.checkOutTime)
                ))
                : false;

            if (pending) {
                throw new Error('目前已有一筆勤務尚未簽退，已阻止重複簽到。請先完成簽退。');
            }

            rows.push(record);
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
        return action === 'deleteDuty' ? true : payload.record;
    }

    function normalizeAjaxError(error) {
        if (error?.responseJSON?.message) {
            return error.responseJSON.message;
        }

        if (error?.statusText === 'timeout') {
            return 'Google Sheet API 連線逾時，系統已自動重試仍未成功，請稍後再試。';
        }

        if (error?.status === 0) {
            return '無法連線 Google Apps Script API，系統已自動重試；請確認網路、部署權限與 API 網址。';
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

    return Object.freeze({
        request,
        requestBundle,
        clearCache,
        setCachedData
    });
})();
