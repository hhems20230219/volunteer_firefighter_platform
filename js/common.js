window.Common = (() => {
    const dtLanguage = {
        emptyTable: '沒有資料',
        info: '顯示第 _START_ 至 _END_ 筆，共 _TOTAL_ 筆',
        infoEmpty: '顯示第 0 至 0 筆，共 0 筆',
        lengthMenu: '每頁顯示 _MENU_ 筆',
        search: '搜尋：',
        zeroRecords: '找不到符合的資料',
        paginate: { first: '第一頁', last: '最後一頁', next: '下一頁', previous: '上一頁' }
    };

    const responsiveTables = new Set();
    let responsiveResizeTimer = null;
    let responsiveResizeObserver = null;

    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });

    function log(scope, message, data) {
        if (!AppConfig.ENABLE_DEBUG_LOG) return;
        if (data === undefined) console.log(`[${scope}] ${message}`);
        else console.log(`[${scope}] ${message}`, data);
    }

    function escapeHtml(value) { return $('<div>').text(value ?? '').html(); }
    function formatTimestamp(date = new Date()) {
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3,'0')}`;
    }
    function createHalfHourOptions(includeBlank = true) {
        const options = includeBlank ? ['<option value="">請選擇</option>'] : [];
        for (let hour = 0; hour < 24; hour += 1) {
            ['00','30'].forEach(minute => {
                const value = `${String(hour).padStart(2,'0')}:${minute}`;
                options.push(`<option value="${value}">${value}</option>`);
            });
        }
        return options.join('');
    }
    function hoursBetween(duty) {
        if (!duty.checkInDate || !duty.checkInTime || !duty.checkOutDate || !duty.checkOutTime) return 0;
        const start = new Date(`${duty.checkInDate}T${duty.checkInTime}:00`);
        const end = new Date(`${duty.checkOutDate}T${duty.checkOutTime}:00`);
        return Math.max(0, (end-start)/3600000);
    }

    function createResponsiveDataTable(selector, options = {}) {
        if (typeof window.DataTable !== 'function') {
            throw new Error('DataTables 核心套件未正確載入。');
        }

        if (!window.DataTable.Responsive) {
            throw new Error('DataTables Responsive 擴充套件未正確載入。');
        }

        const callerColumnDefs = Array.isArray(options.columnDefs) ? options.columnDefs : [];
        const settings = {
            ...options,
            language: options.language || dtLanguage,
            responsive: options.responsive || {
                details: {
                    type: 'column',
                    target: 0
                }
            },
            columnDefs: [
                {
                    targets: 0,
                    className: 'dtr-control',
                    orderable: false,
                    searchable: false,
                    width: '1.75rem',
                    responsivePriority: -1
                },
                ...callerColumnDefs
            ],
            autoWidth: false
        };

        log('DataTables', '建立 Responsive DataTable', {
            selector,
            coreVersion: window.DataTable.version || 'unknown',
            responsiveVersion: window.DataTable.Responsive.version || 'unknown'
        });

        const table = new window.DataTable(selector, settings);
        responsiveTables.add(table);

        const tableElement = document.querySelector(selector);
        const observeTarget = tableElement?.parentElement || tableElement;
        if (observeTarget && typeof ResizeObserver === 'function') {
            if (!responsiveResizeObserver) {
                responsiveResizeObserver = new ResizeObserver(() => {
                    scheduleResponsiveTablesRecalc('ResizeObserver');
                });
            }
            responsiveResizeObserver.observe(observeTarget);
        }

        window.setTimeout(() => recalcResponsiveTable(table), 0);
        return table;
    }

    function isUsableDataTable(table) {
        try {
            return Boolean(table && table.table && table.table().node()?.isConnected);
        } catch {
            return false;
        }
    }

    function recalcResponsiveTable(table) {
        if (!isUsableDataTable(table)) {
            responsiveTables.delete(table);
            return;
        }

        try {
            table.columns.adjust();
            if (table.responsive && typeof table.responsive.recalc === 'function') {
                table.responsive.recalc();
            }
        } catch (error) {
            responsiveTables.delete(table);
            log('DataTables', 'Responsive 重算失敗，已移除失效實例', error);
        }
    }

    function recalcAllResponsiveTables(reason = 'manual') {
        responsiveTables.forEach(table => recalcResponsiveTable(table));
        log('DataTables', '完成全部 Responsive 表格重算', {
            reason,
            tableCount: responsiveTables.size,
            viewportWidth: window.innerWidth
        });
    }

    function scheduleResponsiveTablesRecalc(reason = 'resize') {
        window.clearTimeout(responsiveResizeTimer);
        responsiveResizeTimer = window.setTimeout(() => {
            window.requestAnimationFrame(() => {
                recalcAllResponsiveTables(reason);
            });
        }, 120);
    }

    function getAuth() {
        try { return JSON.parse(sessionStorage.getItem(AppConfig.AUTH_STORAGE_KEY) || 'null'); }
        catch { return null; }
    }
    function requireAuth() {
        const auth = getAuth();
        if (!auth?.nationalId) {
            log('Auth', '尚未登入，導向登入頁');
            location.replace('login.html');
            throw new Error('尚未登入');
        }
        return auth;
    }
    function resolveCurrentUser(persons) {
        const auth = requireAuth();
        const originalNationalId = String(auth.nationalId || '').trim().toUpperCase();
        const normalizedNationalId = String(
            AppConfig.NATIONAL_ID_MIGRATIONS?.[originalNationalId] || originalNationalId
        ).trim().toUpperCase();
        const currentUser = persons.find(person => (
            String(person.nationalId || '').trim().toUpperCase() === normalizedNationalId
        )) || null;

        if (currentUser && originalNationalId !== normalizedNationalId) {
            sessionStorage.setItem(AppConfig.AUTH_STORAGE_KEY, JSON.stringify({
                ...auth,
                nationalId: normalizedNationalId,
                name: currentUser.name
            }));
            log('Auth', '登入身分證字號已依設定完成移轉', {
                oldNationalId: originalNationalId,
                newNationalId: normalizedNationalId
            });
        }

        if (currentUser && auth.name !== currentUser.name) {
            sessionStorage.setItem(AppConfig.AUTH_STORAGE_KEY, JSON.stringify({
                ...auth,
                name: currentUser.name
            }));
            log('Auth', '登入姓名已依人員主檔同步', {
                nationalId: normalizedNationalId,
                oldName: auth.name,
                newName: currentUser.name
            });
        }

        return currentUser;
    }
    function createAccessContext(persons) {
        const currentUser = resolveCurrentUser(persons);
        if (!currentUser) {
            const error = new Error('登入者不存在於人員主檔，請重新登入。');
            error.code = 'AUTH_USER_NOT_FOUND';
            throw error;
        }
        const isStationOffice = currentUser.department === '分隊部';
        const visiblePersons = isStationOffice ? persons.filter(p => p.brigade === currentUser.brigade && p.unit === currentUser.unit) : [currentUser];
        return Object.freeze({ currentUser, isStationOffice, roleName: isStationOffice ? '分隊部' : '個人', canViewTeamStatistics: isStationOffice, canViewAllUnitProfiles: isStationOffice, visiblePersons });
    }
    function applyAccessToLayout(context) {
        $('[data-requires-station-office]').toggleClass('d-none', !context.isStationOffice);
        $('[data-current-user-name]').text(context.currentUser.name);
        $('[data-current-user-role]').text(context.roleName);
        $('[data-current-user-department]').text(context.currentUser.department || '未設定');
        $('[data-current-user-title]').text(context.currentUser.title || '未設定');
        $('.mobile-app-footer').css('grid-template-columns', context.isStationOffice ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)');
        $('body').append(`<span class="access-role-badge badge rounded-pill ${context.isStationOffice?'text-bg-danger':'text-bg-primary'}"><i class="fa-solid fa-user-shield me-1"></i>${escapeHtml(context.roleName)}權限</span>`);
        $('[data-action="logout"]').on('click', () => {
            log('Auth', '登出', { name: context.currentUser.name });
            sessionStorage.removeItem(AppConfig.AUTH_STORAGE_KEY);
            location.replace('login.html');
        });
    }
    function renderAccessDenied() {
        $('main').html(`<div class="container py-5"><section class="card border-0 shadow-sm access-denied-card"><div class="card-body p-4 p-lg-5 text-center"><div class="access-denied-icon mx-auto mb-3"><i class="fa-solid fa-lock"></i></div><h1 class="h3 fw-bold">沒有隊務統計權限</h1><p class="text-secondary mb-4">個人權限只能查看自己的個人資料。</p><a class="btn btn-danger" href="query.html">查看我的資料</a></div></section></div>`);
    }
    async function loadLayout() {
        try {
            requireAuth();
            const [navbarHtml, footerHtml, persons] = await Promise.all([$.get('navbar.html'), $.get('footer.html'), DataService.request('getPersons')]);
            $('#navbarHost').html(navbarHtml); $('#footerHost').html(footerHtml);
            const page = $('body').data('page');
            $(`[data-page-link="${page}"]`).addClass('active').attr('aria-current','page');
            const accessContext = createAccessContext(persons);
            window.AppAccess = accessContext;
            applyAccessToLayout(accessContext);
            log('Access', '權限初始化完成', { user: accessContext.currentUser.name, role: accessContext.roleName, visiblePersons: accessContext.visiblePersons.length });
            if (page === 'statistics' && !accessContext.canViewTeamStatistics) { $('body').attr('data-access-denied','true'); renderAccessDenied(); }
            $('body').append(`<span class="data-source-badge badge rounded-pill ${AppConfig.USE_ONLINE_DATA?'text-bg-success':'text-bg-secondary'}">${AppConfig.USE_ONLINE_DATA?'線上資料':'範例資料'}</span>`);
            resolveReady(accessContext);
        } catch (error) {
            rejectReady(error);
            console.error('[Common] 權限初始化失敗', error);

            if (error.message === '尚未登入') {
                return;
            }

            const canRelogin = error.code === 'AUTH_USER_NOT_FOUND';
            const actionHtml = canRelogin
                ? `<button type="button" class="btn btn-danger mt-3" id="forceReloginBtn"><i class="fa-solid fa-right-from-bracket me-1"></i>清除登入並重新登入</button>`
                : '';

            $('main').prepend(`
                <div class="container pt-4">
                    <div class="alert alert-danger">
                        <div>初始化失敗：${escapeHtml(error.message)}</div>
                        ${actionHtml}
                    </div>
                </div>
            `);

            $('#forceReloginBtn').on('click', () => {
                log('Auth', '清除失效登入狀態並返回登入頁');
                sessionStorage.removeItem(AppConfig.AUTH_STORAGE_KEY);
                location.replace('login.html');
            });
        }
    }
    $(window).on('resize orientationchange', () => {
        scheduleResponsiveTablesRecalc('window-resize');
    });

    $(document).on('shown.bs.tab shown.bs.modal hidden.bs.modal', () => {
        scheduleResponsiveTablesRecalc('bootstrap-visibility-change');
    });

    return {
        dtLanguage,
        ready,
        loadLayout,
        escapeHtml,
        formatTimestamp,
        createHalfHourOptions,
        hoursBetween,
        resolveCurrentUser,
        createAccessContext,
        getAuth,
        requireAuth,
        log,
        createResponsiveDataTable,
        recalcResponsiveTable,
        recalcAllResponsiveTables,
        scheduleResponsiveTablesRecalc
    };
})();
$(Common.loadLayout);
