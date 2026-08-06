$(() => {
    const debug = (...args) => {
        if (AppConfig.ENABLE_DEBUG_LOG) {
            console.log('[Login]', ...args);
        }
    };

    $('#loginForm').on('submit', async event => {
        event.preventDefault();

        const nationalId = String($('#nationalId').val() || '').trim().toUpperCase();
        $('#loginMessage').addClass('d-none').text('');

        if (!/^[A-Z][12][0-9]{8}$/.test(nationalId)) {
            $('#loginMessage').removeClass('d-none').text('身分證字號格式不正確。');
            return;
        }

        $('#loginBtn')
            .prop('disabled', true)
            .html('<span class="spinner-border spinner-border-sm me-2"></span>登入中');

        try {
            debug('開始查找登入者', { nationalId });
            const persons = await DataService.request('getPersons');
            const person = persons.find(item => (
                String(item.nationalId || '').trim().toUpperCase() === nationalId
            ));

            if (!person) {
                throw new Error('人員主檔中找不到此身分證字號。');
            }

            if (!person.active) {
                throw new Error('此人員目前為停用狀態，無法登入。');
            }

            sessionStorage.setItem(AppConfig.AUTH_STORAGE_KEY, JSON.stringify({
                nationalId: person.nationalId,
                name: person.name,
                loginAt: new Date().toISOString()
            }));

            debug('登入成功', {
                name: person.name,
                department: person.department,
                dataMode: AppConfig.USE_ONLINE_DATA ? 'online' : 'sample'
            });

            location.replace('index.html');
        } catch (error) {
            console.error('[Login] 登入失敗', error);
            $('#loginMessage').removeClass('d-none').text(error.message);
        } finally {
            $('#loginBtn')
                .prop('disabled', false)
                .html('<i class="fa-solid fa-right-to-bracket me-2"></i>登入');
        }
    });
});
