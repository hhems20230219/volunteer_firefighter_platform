$(() => {
    let persons = [];
    let duties = [];
    let table = null;
    let formMode = 'checkIn'; // checkIn | checkOut | edit
    let locationVerified = false;
    let clockTimer = null;
    let isSubmitting = false;

    const modal = new bootstrap.Modal('#dutyModal');
    const canvas = document.getElementById('signatureCanvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;

    $('#checkInTime, #checkOutTime').html(Common.createHalfHourOptions(true));


    function updateClock() {
        const now = new Date();
        const pad = value => String(value).padStart(2, '0');
        $('#currentClockTime').text(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
        $('#currentClockDate').text(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    }

    function initializeClock() {
        updateClock();
        window.clearInterval(clockTimer);
        clockTimer = window.setInterval(updateClock, 1000);
    }

    function initializeDutyFilters() {
        const currentYear = new Date().getFullYear();
        $('#dutyYearFilter').html(
            '<option value="">全年度</option>' +
            Array.from({ length: 8 }, (_, index) => currentYear - index)
                .map(year => `<option value="${year}">${year}</option>`)
                .join('')
        );
        $('#dutyMonthFilter').html(
            '<option value="">全年</option>' +
            Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;
                return `<option value="${String(month).padStart(2, '0')}">${month} 月</option>`;
            }).join('')
        );
        $('#dutyYearFilter').val(String(currentYear));
        $('#dutyMonthFilter').val('');
    }

    function filterRowsBySelectedPeriod(rows) {
        const year = String($('#dutyYearFilter').val() || '');
        const month = String($('#dutyMonthFilter').val() || '');

        return rows.filter(row => {
            const dateText = String(row.checkInDate || row.createdAt || '');
            const matchesYear = !year || dateText.startsWith(year);
            const matchesMonth = !month || dateText.slice(5, 7) === month;
            return matchesYear && matchesMonth;
        });
    }

    function setLocationState(state, message = '') {
        const stateMap = {
            idle: { text: '尚未定位', className: 'text-bg-secondary' },
            success: { text: '定位成功', className: 'text-bg-success' },
            failed: { text: '定位失敗', className: 'text-bg-danger' }
        };
        const current = stateMap[state] || stateMap.idle;
        $('#locationStatusBadge')
            .removeClass('text-bg-secondary text-bg-success text-bg-danger')
            .addClass(current.className)
            .text(current.text);
        $('#locationAlert').toggleClass('d-none', !message).text(message || '');
    }

    function currentPerson() {
        return window.AppAccess?.currentUser || Common.resolveCurrentUser(persons);
    }

    function operationLabel() {
        if (formMode === 'checkOut') return '簽退';
        if (formMode === 'edit') return '修改';
        return '簽到';
    }

    function setSubmitState(submitting) {
        isSubmitting = submitting;
        const label = operationLabel();
        const $button = $('#submitBtn');

        $button.prop('disabled', submitting);
        $('#dutyModal [data-bs-dismiss="modal"], #getLocationBtn, #clearSignatureBtn')
            .prop('disabled', submitting);

        if (submitting) {
            $button.html(`<i class="fa-solid fa-hourglass-half me-1"></i>${label}處理中…`);
            return;
        }

        updateFormUi();
    }

    function showOperationResult({ success, title, message }) {
        const $toast = $('#dutyResultToast');
        const $header = $('#dutyResultToastHeader');
        const $icon = $('#dutyResultToastIcon');
        const $title = $('#dutyResultToastTitle');
        const $message = $('#dutyResultToastMessage');

        $toast.removeClass('text-bg-success text-bg-danger')
            .addClass(success ? 'text-bg-success' : 'text-bg-danger');
        $header.removeClass('text-bg-success text-bg-danger')
            .addClass(success ? 'text-bg-success' : 'text-bg-danger');
        $icon.attr('class', success
            ? 'fa-solid fa-circle-check me-2'
            : 'fa-solid fa-circle-xmark me-2');
        $title.text(title);
        $message.text(message);

        bootstrap.Toast.getOrCreateInstance($toast[0], {
            autohide: success,
            delay: 8000
        }).show();
    }

    function availableFormPersons() {
        return window.AppAccess?.visiblePersons || [currentPerson()].filter(Boolean);
    }

    function selectedFormPerson() {
        const nationalId = $('#personName').val();
        return persons.find(person => person.nationalId === nationalId) || currentPerson();
    }

    function renderPersonOptions(selectedNationalId) {
        const options = availableFormPersons();
        $('#personName').html(options.map(person => `
            <option value="${Common.escapeHtml(person.nationalId)}">
                ${Common.escapeHtml(person.name)}
            </option>
        `).join(''));
        $('#personName').val(selectedNationalId || currentPerson()?.nationalId || '');
        $('#personName').prop('disabled', formMode !== 'checkIn' || !window.AppAccess?.isStationOffice);
        updateSelectedPersonFields();
    }

    function updateSelectedPersonFields() {
        const person = selectedFormPerson();
        if (!person) return;
        $('#nationalId').val(person.nationalId);
        $('#personTitle').val(person.title || '');
    }

    function serviceTypes(type) {
        if (type === '協勤') return ['出勤', '待命協勤'];
        if (type === '常年訓練') return ['出席', '請假'];
        return [''];
    }

    function getRule(type = $('#dutyType').val(), service = $('#serviceType').val()) {
        return {
            checkInRequired: !(type === '常年訓練' && service === '請假'),
            checkOutRequired: type === '協勤' || type === '公差勤務',
            checkInLocationRequired: AppConfig.GEOLOCATION_ENABLED === true
                && (type === '協勤' || (type === '常年訓練' && service === '出席')),
            checkOutLocationRequired: AppConfig.GEOLOCATION_ENABLED === true
                && type === '協勤',
            contentRequired: (type === '協勤' && service === '出勤') || type === '公差勤務'
        };
    }

    function isPending(row) {
        return getRule(row.dutyType, row.serviceType).checkOutRequired
            && (!row.checkOutDate || !row.checkOutTime);
    }

    function getCurrentUserRows() {
        const person = currentPerson();
        if (!person) return [];
        return duties.filter(row => {
            const isCurrentPerson = row.nationalId === person.nationalId;
            const isAttendanceRecord = !(
                row.dutyType === '常年訓練'
                && row.serviceType === '無故缺席'
            );

            return isCurrentPerson && isAttendanceRecord;
        });
    }

    function getPendingDuty(person = currentPerson()) {
        if (!person) return null;
        return duties.find(row => row.nationalId === person.nationalId && isPending(row)) || null;
    }

    function toRadians(value) {
        return value * Math.PI / 180;
    }

    function distanceMeters(lat1, lng1, lat2, lng2) {
        const earthRadius = 6371000;
        const dLat = toRadians(lat2 - lat1);
        const dLng = toRadians(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
            * Math.sin(dLng / 2) ** 2;
        return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function findAllowedLocation(lat, lng) {
        const candidates = AppConfig.ALLOWED_DUTY_LOCATIONS.map(place => ({
            ...place,
            distance: distanceMeters(lat, lng, place.lat, place.lng)
        })).sort((left, right) => left.distance - right.distance);

        const nearest = candidates[0];
        return {
            allowed: nearest.distance <= AppConfig.GEOLOCATION_ALLOWED_RADIUS_METERS,
            nearest
        };
    }

    function formatToday() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function nearestHalfHour() {
        const now = new Date();
        const minutes = now.getMinutes() < 30 ? 0 : 30;
        return `${String(now.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function setLocationUi(required) {
        locationVerified = false;
        $('#locationSection').toggle(required);
        setLocationState('idle');
        $('#getLocationBtn')
            .prop('disabled', false)
            .html('<i class="fa-solid fa-location-crosshairs me-1"></i>重新定位');
    }

    function applyFormSectionOrder() {
        const isCheckIn = formMode === 'checkIn';
        const isCheckOut = formMode === 'checkOut';

        const orderMap = isCheckIn
            ? {
                locationSection: 10,
                personTitleSection: 20,
                personNameSection: 30,
                checkInSection: 40,
                dutyTypeSection: 50,
                serviceTypeSection: 60,
                checkOutSection: 70,
                contentSection: 80,
                signatureSection: 90
            }
            : isCheckOut
                ? {
                    locationSection: 10,
                    personTitleSection: 20,
                    personNameSection: 30,
                    dutyTypeSection: 40,
                    serviceTypeSection: 50,
                    checkOutSection: 60,
                    contentSection: 70,
                    signatureSection: 80,
                    checkInSection: 90
                }
                : {
                    personTitleSection: 10,
                    personNameSection: 20,
                    dutyTypeSection: 30,
                    serviceTypeSection: 40,
                    checkInSection: 50,
                    checkOutSection: 60,
                    contentSection: 70,
                    signatureSection: 80,
                    locationSection: 90
                };

        Object.entries(orderMap).forEach(([id, order]) => {
            $(`#${id}`).css('order', order);
        });
    }

    function updateFormUi() {
        const type = $('#dutyType').val();
        const service = $('#serviceType').val();
        const rule = getRule(type, service);

        const isCheckIn = formMode === 'checkIn';
        const isCheckOut = formMode === 'checkOut';
        applyFormSectionOrder();
        const isEdit = formMode === 'edit';

        $('#operationSectionTitle').text(isCheckOut ? '勤務簽退' : (isEdit ? '修改勤務紀錄' : '勤務簽到'));
        $('#operationIcon')
            .removeClass('fa-right-to-bracket fa-right-from-bracket fa-pen-to-square')
            .addClass(isCheckOut ? 'fa-right-from-bracket' : (isEdit ? 'fa-pen-to-square' : 'fa-right-to-bracket'));
        $('#contentLabel').text(type === '公差勤務' ? '公差內容' : '協勤內容');

        $('#serviceType').prop('disabled', !(isCheckIn || (isCheckOut && type === '協勤')));

        $('#dutyTypeSection').toggle(isCheckOut || isEdit);
        $('#serviceTypeSection').show();
        $('#checkInSection').toggle(!isCheckOut);
        $('#checkOutSection').toggle(isCheckOut || isEdit);
        $('#contentSection').toggle((isCheckOut || isEdit) && rule.contentRequired);
        $('#signatureSection').toggle(isCheckOut || isEdit);

        $('#locationSection').insertAfter('#operationHeadingSection');

        $('#checkInDate, #checkInTime')
            .prop('disabled', isCheckOut || !rule.checkInRequired)
            .prop('required', !isCheckOut && rule.checkInRequired);

        $('#checkOutDate, #checkOutTime')
            .prop('disabled', !isCheckOut && !isEdit)
            .prop('required', (isCheckOut || isEdit) && rule.checkOutRequired);

        $('#content')
            .prop('disabled', !(isCheckOut || isEdit) || !rule.contentRequired)
            .prop('required', (isCheckOut || isEdit) && rule.contentRequired);

        if (!rule.contentRequired) $('#content').val('');

        if (isCheckIn) {
            const isAnnualTraining = type === '常年訓練';
            $('#dutyTypeSection, #serviceTypeSection').toggle(isAnnualTraining);
            $('#checkOutSection, #contentSection, #signatureSection').hide();
            $('#personTitleSection, #personNameSection, #checkInSection').show();
            setLocationUi(rule.checkInLocationRequired);
            $('#submitBtn').html(`<i class="fa-solid fa-right-to-bracket me-1"></i>${rule.checkOutRequired ? '完成簽到' : '儲存紀錄'}`);
        } else if (isCheckOut) {
            $('#checkInSection').hide();
            $('#personTitleSection, #personNameSection, #dutyTypeSection, #serviceTypeSection, #checkOutSection, #signatureSection').show();
            $('#contentSection').toggle(rule.contentRequired);
            setLocationUi(rule.checkOutLocationRequired);
            $('#submitBtn').html('<i class="fa-solid fa-right-from-bracket me-1"></i>完成簽退');
        } else {
            $('#locationSection').hide();
            $('#submitBtn').html('<i class="fa-solid fa-floppy-disk me-1"></i>儲存修改');
        }
    }

    function autoVerifyLocationIfRequired() {
        const type = $('#dutyType').val();
        const service = $('#serviceType').val();
        const rule = getRule(type, service);
        const required = formMode === 'checkOut'
            ? rule.checkOutLocationRequired
            : formMode === 'checkIn'
                ? rule.checkInLocationRequired
                : false;

        if (!required) return;

        window.setTimeout(() => {
            getLocation();
        }, 250);
    }

    function getLocation() {
        if (!navigator.geolocation) {
            locationVerified = false;
            setLocationState('failed', '定位失敗：目前瀏覽器不支援定位功能。');
            return;
        }

        const actionLabel = formMode === 'checkOut' ? '簽退' : '簽到';
        Common.log('Duty', `開始驗證${actionLabel}定位`);
        setLocationState('idle');
        $('#getLocationBtn')
            .prop('disabled', true)
            .html('<i class="fa-solid fa-location-crosshairs me-2"></i>定位中…');

        navigator.geolocation.getCurrentPosition(position => {
            const result = findAllowedLocation(position.coords.latitude, position.coords.longitude);
            Common.log('Duty', `${actionLabel}定位驗證結果`, {
                accuracy: position.coords.accuracy,
                nearestPlace: result.nearest.name,
                distanceMeters: Math.round(result.nearest.distance),
                allowed: result.allowed
            });

            $('#getLocationBtn')
                .prop('disabled', false)
                .html('<i class="fa-solid fa-location-crosshairs me-1"></i>重新定位');

            if (!result.allowed) {
                locationVerified = false;
                setLocationState(
                    'failed',
                    `定位失敗：目前位置距離「${result.nearest.name}」約 ${Math.round(result.nearest.distance)} 公尺，請移至允許地點後重新定位。`
                );
                return;
            }

            locationVerified = true;
            setLocationState('success');
        }, error => {
            console.error('[Duty] 定位失敗', error);
            $('#getLocationBtn')
                .prop('disabled', false)
                .html('<i class="fa-solid fa-location-crosshairs me-1"></i>重新定位');
            locationVerified = false;
            const message = error.code === 1
                ? '定位失敗：請允許瀏覽器定位權限。'
                : error.code === 2
                    ? '定位失敗：目前無法取得 GPS 位置，請開啟定位服務後重試。'
                    : error.code === 3
                        ? '定位失敗：定位逾時，請移至空曠處或重新定位。'
                        : '定位失敗：目前無法取得 GPS 位置，請開啟定位服務後重試。';
            setLocationState('failed', message);
        }, {
            enableHighAccuracy: true,
            timeout: AppConfig.GEOLOCATION_TIMEOUT_MS,
            maximumAge: AppConfig.GEOLOCATION_MAX_AGE_MS
        });
    }

    function fillCommonFields(person, row, type) {
        $('#originalCreatedAt').val(row?.createdAt || '');
        $('#dutyType').val(type);
        $('#serviceType').html(
            serviceTypes(type).map(item => `<option value="${item}">${item || '不適用'}</option>`).join('')
        ).val(row?.serviceType ?? serviceTypes(type)[0]);
        renderPersonOptions(person.nationalId);
    }

    function openCheckIn(type) {
        const target = JSON.parse(sessionStorage.getItem('vfDutyTarget') || 'null');
        const person = window.AppAccess?.isStationOffice
            ? persons.find(item => item.nationalId === target?.nationalId) || currentPerson()
            : currentPerson();
        sessionStorage.removeItem('vfDutyTarget');
        if (!person) {
            alert('找不到目前人員資料。');
            return;
        }

        const pending = getPendingDuty(person);
        if (pending) {
            alert(`目前仍有一筆「${pending.dutyType}／${pending.serviceType || '不適用'}」尚未簽退，請先完成簽退。`);
            return;
        }

        formMode = 'checkIn';
        $('#modalTitle').text('勤務簽到');
        fillCommonFields(person, null, type);
        $('#checkInDate').val(formatToday());
        $('#checkInTime').val(nearestHalfHour());
        $('#checkOutDate, #checkOutTime, #content').val('');
        clearCanvas();
        updateFormUi();
        Common.log('Duty', '開啟勤務簽到', { type });
        modal.show();
        autoVerifyLocationIfRequired();
    }

    function openCheckOut(row) {
        const person = persons.find(item => item.nationalId === row.nationalId) || currentPerson();
        formMode = 'checkOut';
        $('#modalTitle').text('勤務簽退');
        fillCommonFields(person, row, row.dutyType);
        $('#checkInDate').val(row.checkInDate || '');
        $('#checkInTime').val(row.checkInTime || '');
        $('#checkOutDate').val(formatToday());
        $('#checkOutTime').val(nearestHalfHour());
        $('#content').val(row.content || '');
        clearCanvas();
        updateFormUi();
        Common.log('Duty', '開啟勤務簽退', { row });
        modal.show();
        autoVerifyLocationIfRequired();
    }

    function openEdit(row) {
        const person = persons.find(item => item.nationalId === row.nationalId) || currentPerson();
        formMode = 'edit';
        $('#modalTitle').text('修改勤務紀錄');
        fillCommonFields(person, row, row.dutyType);
        $('#checkInDate').val(row.checkInDate || '');
        $('#checkInTime').val(row.checkInTime || '');
        $('#checkOutDate').val(row.checkOutDate || '');
        $('#checkOutTime').val(row.checkOutTime || '');
        $('#content').val(row.content || '');
        clearCanvas();
        updateFormUi();
        Common.log('Duty', '開啟修改勤務', { row });
        modal.show();
    }

    function validate() {
        const type = $('#dutyType').val();
        const service = $('#serviceType').val();
        const rule = getRule(type, service);

        if (formMode === 'checkIn') {
            const formPerson = selectedFormPerson();
            const pendingDuty = getPendingDuty(formPerson);
            if (pendingDuty) {
                return `${formPerson.name} 目前仍有一筆勤務尚未簽退，請先完成簽退。`;
            }
            if (rule.checkInRequired && (!$('#checkInDate').val() || !$('#checkInTime').val())) {
                return '請完整選擇簽到日期與時間。';
            }
            if (rule.checkInLocationRequired && !locationVerified) {
                return '請先完成允許範圍內的簽到定位驗證。';
            }
        }

        if (formMode === 'checkOut') {
            if (!$('#checkOutDate').val() || !$('#checkOutTime').val()) {
                return '請完整選擇簽退日期與時間。';
            }
            if (rule.checkOutLocationRequired && !locationVerified) {
                return '請先完成允許範圍內的簽退定位驗證。';
            }
            if (rule.contentRequired && !$('#content').val().trim()) {
                return '請填寫協勤／公差內容。';
            }
            if (isCanvasBlank()) {
                return '請完成簽名。';
            }
            const checkIn = new Date(`${$('#checkInDate').val()}T${$('#checkInTime').val()}:00`);
            const checkOut = new Date(`${$('#checkOutDate').val()}T${$('#checkOutTime').val()}:00`);
            if (checkOut < checkIn) return '簽退時間不可早於簽到時間。';
        }

        if (formMode === 'edit') {
            if (rule.checkInRequired && (!$('#checkInDate').val() || !$('#checkInTime').val())) {
                return '請完整選擇簽到日期與時間。';
            }
            if (rule.checkOutRequired && (!$('#checkOutDate').val() || !$('#checkOutTime').val())) {
                return '需要簽退的勤務，請完整填寫簽退日期與時間。';
            }
            if (rule.contentRequired && !$('#content').val().trim()) {
                return '請填寫協勤／公差內容。';
            }
        }

        return '';
    }

    function buildRecord() {
        const original = duties.find(row =>
            row.nationalId === $('#nationalId').val()
            && row.createdAt === $('#originalCreatedAt').val()
        );
        const rule = getRule();

        if (formMode === 'checkOut') {
            return {
                ...original,
                serviceType: $('#serviceType').val(),
                checkOutDate: $('#checkOutDate').val(),
                checkOutTime: $('#checkOutTime').val(),
                content: rule.contentRequired ? $('#content').val().trim() : '',
                signatureData: getCanvasData()
            };
        }

        const formPerson = selectedFormPerson();
        return {
            nationalId: formPerson.nationalId,
            name: formPerson.name,
            createdAt: formMode === 'edit' ? $('#originalCreatedAt').val() : Common.formatTimestamp(),
            dutyType: $('#dutyType').val(),
            serviceType: $('#serviceType').val(),
            checkInDate: rule.checkInRequired ? $('#checkInDate').val() : '',
            checkInTime: rule.checkInRequired ? $('#checkInTime').val() : '',
            checkOutDate: formMode === 'edit' && rule.checkOutRequired ? $('#checkOutDate').val() : '',
            checkOutTime: formMode === 'edit' && rule.checkOutRequired ? $('#checkOutTime').val() : '',
            content: formMode === 'edit' && rule.contentRequired ? $('#content').val().trim() : '',
            signatureData: formMode === 'edit' && original?.signatureData ? original.signatureData : ''
        };
    }

    function renderPendingDuty(rows) {
        const pending = rows.find(isPending);
        $('#pendingDutySection').toggle(Boolean(pending));

        if (!pending) {
            $('#pendingDutyContent').empty();
            return;
        }

        $('#pendingDutyContent').html(`
            <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                <div>
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span class="badge text-bg-warning">尚未簽退</span>
                        <strong>${Common.escapeHtml(pending.dutyType)}</strong>
                        <span class="text-secondary">${Common.escapeHtml(pending.serviceType || '不適用')}</span>
                    </div>
                    <div class="text-secondary">
                        簽到：${Common.escapeHtml(pending.checkInDate)} ${Common.escapeHtml(pending.checkInTime)}
                    </div>
                    ${pending.content ? `<div class="text-secondary mt-1">內容：${Common.escapeHtml(pending.content)}</div>` : ''}
                </div>
                <button class="btn btn-danger btn-lg" id="pendingCheckOutBtn" type="button">
                    <i class="fa-solid fa-right-from-bracket me-2"></i>辦理簽退
                </button>
            </div>
        `);
        $('#pendingDutyContent').data('row', pending);
    }

    const dutyTableHeaderHtml = `
        <tr>
            <th class="dtr-control-column" aria-label="展開明細"></th>
            <th>建立時間</th>
            <th>勤務類型</th>
            <th>服勤類型</th>
            <th>簽到日期</th>
            <th>簽到時間</th>
            <th>簽退日期</th>
            <th>簽退時間</th>
            <th>協勤內容</th>
            <th>操作</th>
        </tr>
    `;

    function restoreDutyTableStructure() {
        const tableElement = document.getElementById('dutyTable');

        if (!tableElement) {
            throw new Error('找不到勤務紀錄表格。');
        }

        let thead = tableElement.querySelector('thead');
        if (!thead) {
            thead = document.createElement('thead');
            tableElement.prepend(thead);
        }

        thead.className = 'table-light';
        thead.innerHTML = dutyTableHeaderHtml;

        let tbody = tableElement.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            tableElement.append(tbody);
        }
    }

    function render() {
        const allRows = getCurrentUserRows().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        const rows = filterRowsBySelectedPeriod(allRows);
        renderPendingDuty(allRows);

        if (table) {
            table.destroy();
            table = null;
        }

        restoreDutyTableStructure();

        $('#dutyTable tbody').html(rows.map((item, index) => {
            const pending = isPending(item);
            return `
                <tr>
                    <td class="dtr-control"></td>
                    <td>${Common.escapeHtml(item.createdAt || '-')}</td>
                    <td>${Common.escapeHtml(item.dutyType || '-')}</td>
                    <td>${Common.escapeHtml(item.serviceType || '-')}</td>
                    <td>${Common.escapeHtml(item.checkInDate || '-')}</td>
                    <td>${Common.escapeHtml(item.checkInTime || '-')}</td>
                    <td>${Common.escapeHtml(item.checkOutDate || '-')}</td>
                    <td>${Common.escapeHtml(item.checkOutTime || '-')}</td>
                    <td>${Common.escapeHtml(item.content || '-')}</td>
                    <td class="text-nowrap">
                        ${pending ? `<button class="btn btn-sm btn-danger checkout-btn" data-index="${index}" aria-label="簽退" title="辦理簽退"><i class="fa-solid fa-right-from-bracket"></i></button>` : ''}
                        <button class="btn btn-sm btn-outline-primary edit-btn" data-index="${index}" aria-label="修改" title="修改"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-index="${index}" aria-label="刪除" title="刪除"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join(''));

        table = Common.createResponsiveDataTable('#dutyTable', {
            order: [[1, 'desc']],
            pageLength: 10,
            columnDefs: [
                { targets: 9, responsivePriority: 0 },
                { targets: 2, responsivePriority: 1 },
                { targets: 3, responsivePriority: 2 },
                { targets: 4, responsivePriority: 3 },
                { targets: 5, responsivePriority: 4 },
                { targets: 6, responsivePriority: 5 },
                { targets: 7, responsivePriority: 6 },
                { targets: 8, responsivePriority: 7 },
                { targets: 1, responsivePriority: 8 }
            ]
        });
        $('#dutyTable').data('rows', rows);
        Common.log('Duty', '勤務紀錄完成顯示', {
            count: rows.length,
            pendingCount: rows.filter(isPending).length
        });
    }

    async function load() {
        const access = await Common.ready;
        await Common.withLoading(async () => {
            const data = await DataService.requestBundle(['getPersons', 'getDuties']);
            persons = data.getPersons || access.visiblePersons;
            duties = data.getDuties || [];
            Common.log('Duty', '資料載入完成', { persons: persons.length, duties: duties.length });
            render();
        }, '出勤紀錄載入中，請稍候…');

        const target = JSON.parse(sessionStorage.getItem('vfDutyTarget') || 'null');
        if (target?.createdAt) {
            const row = duties.find(item => item.nationalId === target.nationalId && item.createdAt === target.createdAt);
            sessionStorage.removeItem('vfDutyTarget');
            if (row) {
                if (isPending(row)) openCheckOut(row);
                else openEdit(row);
            }
        }
    }

    $('.duty-type-btn').on('click', function () {
        openCheckIn($(this).data('type'));
    });

    $('#serviceType').on('change', updateFormUi);
    $('#personName').on('change', updateSelectedPersonFields);
    $('#getLocationBtn').on('click', getLocation);
    $('#dutyYearFilter, #dutyMonthFilter').on('change', render);

    $('#pendingDutyContent').on('click', '#pendingCheckOutBtn', function () {
        openCheckOut($('#pendingDutyContent').data('row'));
    });

    $('#dutyTable')
        .on('click', '.checkout-btn', function () {
            openCheckOut($('#dutyTable').data('rows')[$(this).data('index')]);
        })
        .on('click', '.edit-btn', function () {
            openEdit($('#dutyTable').data('rows')[$(this).data('index')]);
        })
        .on('click', '.delete-btn', async function () {
            const row = $('#dutyTable').data('rows')[$(this).data('index')];
            if (!confirm('確定刪除此勤務紀錄？')) return;
            Common.log('Duty', '刪除勤務', row);
            await DataService.request('deleteDuty', {
                originalNationalId: row.nationalId,
                originalName: row.name,
                originalCreatedAt: row.createdAt
            });

            duties = duties.filter(item => !(
                item.nationalId === row.nationalId
                && item.createdAt === row.createdAt
            ));
            DataService.setCachedData('getDuties', duties);
            render();
        });

    $('#dutyForm').on('submit', async event => {
        event.preventDefault();

        if (isSubmitting) {
            Common.log('Duty', '忽略重複送出：上一筆勤務操作仍在處理中', { formMode });
            return;
        }

        const message = validate();
        if (message) {
            showOperationResult({
                success: false,
                title: `${operationLabel()}未送出`,
                message
            });
            return;
        }

        const record = buildRecord();
        const isCreate = formMode === 'checkIn';
        const action = isCreate ? 'createDuty' : 'updateDuty';
        const submittedMode = formMode;
        const submittedLabel = operationLabel();
        const submittedPerson = selectedFormPerson() || currentPerson();
        const submittedDate = submittedMode === 'checkOut' ? record.checkOutDate : record.checkInDate;
        const submittedTime = submittedMode === 'checkOut' ? record.checkOutTime : record.checkInTime;

        Common.log('Duty', `${submittedLabel}勤務送出`, record);
        setSubmitState(true);

        try {
            const savedRecord = await DataService.request(action, {
                originalNationalId: record.nationalId,
                originalName: record.name,
                originalCreatedAt: $('#originalCreatedAt').val(),
                record
            });

            if (isCreate) {
                duties.push(savedRecord || record);
            } else {
                const originalCreatedAt = $('#originalCreatedAt').val();
                const index = duties.findIndex(item => (
                    item.nationalId === record.nationalId
                    && item.createdAt === originalCreatedAt
                ));

                if (index >= 0) {
                    duties[index] = savedRecord || record;
                } else {
                    // API 已成功時，不因前端暫存找不到舊項目而再次打 API；直接補回最新紀錄。
                    duties.push(savedRecord || record);
                }
            }

            DataService.setCachedData('getDuties', duties);
            render();
            modal.hide();

            showOperationResult({
                success: true,
                title: `${submittedLabel}成功`,
                message: `${submittedPerson?.name || record.name || '人員'} 已於 ${submittedDate || '-'} ${submittedTime || '-'} 完成${submittedLabel}。`
            });
        } catch (error) {
            console.error(`[Duty] ${submittedLabel}失敗`, error);
            showOperationResult({
                success: false,
                title: `${submittedLabel}失敗`,
                message: error.message || '勤務資料送出失敗，請稍後再試。'
            });
        } finally {
            setSubmitState(false);
        }
    });

    function point(event) {
        const rect = canvas.getBoundingClientRect();
        const source = event.touches ? event.touches[0] : event;
        return {
            x: (source.clientX - rect.left) * (canvas.width / rect.width),
            y: (source.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    function start(event) {
        drawing = true;
        const currentPoint = point(event);
        ctx.beginPath();
        ctx.moveTo(currentPoint.x, currentPoint.y);
        event.preventDefault();
    }

    function move(event) {
        if (!drawing) return;
        const currentPoint = point(event);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
        event.preventDefault();
    }

    function stop() {
        drawing = false;
    }

    function isCanvasBlank() {
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = canvas.width;
        blankCanvas.height = canvas.height;
        return canvas.toDataURL() === blankCanvas.toDataURL();
    }

    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function getCanvasData() {
        return canvas.toDataURL('image/png');
    }

    ['mousedown', 'touchstart'].forEach(name => canvas.addEventListener(name, start, { passive: false }));
    ['mousemove', 'touchmove'].forEach(name => canvas.addEventListener(name, move, { passive: false }));
    ['mouseup', 'mouseleave', 'touchend'].forEach(name => canvas.addEventListener(name, stop));
    $('#clearSignatureBtn').on('click', clearCanvas);

    initializeClock();
    initializeDutyFilters();

    load().catch(error => {
        console.error('[Duty] 載入失敗', error);
        alert(`載入失敗：${error.message}`);
    });
});
