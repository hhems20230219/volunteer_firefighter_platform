$(() => {
    let persons = [];
    let duties = [];
    let statisticsTable;

    // 需要新增指標時，只要在這裡增加一個定義並設定 enabled: true。
    const METRIC_DEFINITIONS = [
        {
            key: 'activeCount',
            title: '現役人數',
            icon: 'fa-users',
            enabled: true,
            calculate: context => context.activePersons.length,
            format: value => `${value} 人`
        },
        {
            key: 'maleCount',
            title: '男性人數',
            icon: 'fa-mars',
            enabled: true,
            calculate: context => context.activePersons.filter(person => person.gender === '男').length,
            format: value => `${value} 人`
        },
        {
            key: 'femaleCount',
            title: '女性人數',
            icon: 'fa-venus',
            enabled: true,
            calculate: context => context.activePersons.filter(person => person.gender === '女').length,
            format: value => `${value} 人`
        },
        {
            key: 'genderRatio',
            title: '男女比',
            icon: 'fa-venus-mars',
            enabled: true,
            calculate: context => {
                const male = context.activePersons.filter(person => person.gender === '男').length;
                const female = context.activePersons.filter(person => person.gender === '女').length;
                return { male, female };
            },
            format: value => `${value.male}：${value.female}`
        },
        {
            key: 'emt1Count',
            title: 'EMT-1 人數',
            icon: 'fa-user-nurse',
            enabled: true,
            calculate: context => context.activePersons.filter(person => person.emtLevel === 'EMT-1').length,
            format: value => `${value} 人`
        },
        {
            key: 'emt2Count',
            title: 'EMT-2 人數',
            icon: 'fa-user-doctor',
            enabled: true,
            calculate: context => context.activePersons.filter(person => person.emtLevel === 'EMT-2').length,
            format: value => `${value} 人`
        },
        {
            key: 'emtpCount',
            title: 'EMT-P 人數',
            icon: 'fa-star-of-life',
            enabled: true,
            calculate: context => context.activePersons.filter(person => person.emtLevel === 'EMT-P').length,
            format: value => `${value} 人`
        }
    ];

    function initializeFilters() {
        const currentYear = new Date().getFullYear();

        $('#yearFilter').html(
            Array.from({ length: 8 }, (_, index) => currentYear - index)
                .map(year => `<option value="${year}">${year}</option>`)
                .join('')
        );

        $('#monthFilter').append(
            Array.from({ length: 12 }, (_, index) => {
                const monthValue = String(index + 1).padStart(2, '0');
                return `<option value="${monthValue}">${index + 1} 月</option>`;
            }).join('')
        );
    }

    function personMatchesDuty(person, duty) {
        return person.nationalId === duty.nationalId && person.name === duty.name;
    }

    function filterRowsByPeriod(rows, year, month) {
        const prefix = month ? `${year}-${month}` : String(year);
        return rows.filter(duty => String(duty.checkInDate || '').startsWith(prefix));
    }

    function annualRowsForPerson(person, year) {
        return duties.filter(duty => (
            personMatchesDuty(person, duty)
            && String(duty.checkInDate || '').startsWith(String(year))
        ));
    }

    function evaluationMonthRange(person, year) {
        const selectedYear = Number(year);
        const joinDate = person.joinDate ? new Date(`${person.joinDate}T00:00:00`) : null;
        const configuredStart = new Date(`${AppConfig.RULE_CALCULATION_START_DATE}T00:00:00`);
        const effectiveStart = [configuredStart, joinDate]
            .filter(date => date && !Number.isNaN(date.getTime()))
            .sort((left, right) => right - left)[0];
        const now = new Date();

        if (effectiveStart && effectiveStart.getFullYear() > selectedYear) {
            return [];
        }

        const firstMonth = effectiveStart && effectiveStart.getFullYear() === selectedYear
            ? effectiveStart.getMonth() + 1
            : 1;
        const lastMonth = selectedYear < now.getFullYear()
            ? 12
            : selectedYear > now.getFullYear()
                ? 0
                : now.getMonth() + 1;

        if (lastMonth < firstMonth) {
            return [];
        }

        return Array.from(
            { length: lastMonth - firstMonth + 1 },
            (_, index) => firstMonth + index
        );
    }

    function annualTrainingStatus(person, year) {
        const rows = annualRowsForPerson(person, year);
        const monthsToEvaluate = evaluationMonthRange(person, year);
        const trainingRows = rows.filter(duty => duty.dutyType === '常年訓練');
        const attendedMonths = new Set(
            trainingRows
                .filter(duty => duty.serviceType === '出席' && duty.checkInDate)
                .map(duty => Number(String(duty.checkInDate).slice(5, 7)))
                .filter(month => month >= 1 && month <= 12)
        );
        const leaveMonths = new Set(
            trainingRows
                .filter(duty => duty.serviceType === '請假' && duty.checkInDate)
                .map(duty => Number(String(duty.checkInDate).slice(5, 7)))
                .filter(month => month >= 1 && month <= 12)
        );

        const calculateOffsetMonths = months => months
            .map(month => ({
                month,
                hours: rows
                    .filter(duty => (
                        duty.dutyType === '協勤'
                        && Number(String(duty.checkInDate || '').slice(5, 7)) === month
                    ))
                    .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0)
            }))
            .filter(item => item.hours >= 8)
            .slice(0, 4)
            .map(item => item.month);

        // 個人勤務統計使用完整年度資料，不受規則起算日限制。
        const allLeaveMonths = [...leaveMonths].sort((left, right) => left - right);
        const allOffsetMonths = calculateOffsetMonths(allLeaveMonths);
        const attendCount = attendedMonths.size;
        const leaveCount = leaveMonths.size;
        const effectiveAttendCount = attendCount + allOffsetMonths.length;
        const effectiveLeaveCountAll = Math.max(0, leaveCount - allOffsetMonths.length);

        // 不足名單只從集中設定的起算日開始判斷。
        const evaluatedLeaveMonths = allLeaveMonths.filter(month => monthsToEvaluate.includes(month));
        const complianceOffsetMonths = calculateOffsetMonths(evaluatedLeaveMonths);
        const absenceMonths = monthsToEvaluate.filter(month => (
            !attendedMonths.has(month) && !leaveMonths.has(month)
        ));
        const complianceLeaveCount = evaluatedLeaveMonths.length;
        const complianceEffectiveLeaveCount = Math.max(0, complianceLeaveCount - complianceOffsetMonths.length);
        const cooperationHours = rows
            .filter(duty => duty.dutyType === '協勤')
            .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

        return {
            attendCount,
            leaveCount,
            cooperationHours,
            offsetCount: allOffsetMonths.length,
            offsetMonths: allOffsetMonths,
            effectiveLeaveCount: effectiveLeaveCountAll,
            effectiveAttendCount,
            complianceLeaveCount,
            complianceOffsetCount: complianceOffsetMonths.length,
            complianceOffsetMonths,
            complianceEffectiveLeaveCount,
            absenceCount: absenceMonths.length,
            absenceMonths,
            evaluatedMonthCount: monthsToEvaluate.length,
            isApplicable: monthsToEvaluate.length > 0,
            compliant: complianceEffectiveLeaveCount <= 6 && absenceMonths.length <= 3
        };
    }

    function cooperationShortage(person, year, month) {
        const applicableMonths = evaluationMonthRange(person, year);
        const monthsToCheck = month
            ? applicableMonths.filter(item => item === Number(month))
            : applicableMonths;

        return monthsToCheck.map(monthNumber => {
            const prefix = `${year}-${String(monthNumber).padStart(2, '0')}`;
            const hours = duties
                .filter(duty => (
                    personMatchesDuty(person, duty)
                    && duty.dutyType === '協勤'
                    && String(duty.checkInDate || '').startsWith(prefix)
                ))
                .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

            return {
                month: monthNumber,
                hours,
                shortage: Math.max(0, 4 - hours)
            };
        }).filter(item => item.shortage > 0);
    }

    function renderMetricCards(context) {
        const cards = METRIC_DEFINITIONS
            .filter(metric => metric.enabled)
            .map(metric => {
                const value = metric.calculate(context);
                return `
                    <div class="col-6 col-md-4 col-xl-3">
                        <article class="card metric-card border-0 shadow-sm h-100">
                            <div class="card-body p-4">
                                <div class="d-flex justify-content-between align-items-start gap-3">
                                    <div>
                                        <div class="small text-secondary mb-1">${Common.escapeHtml(metric.title)}</div>
                                        <div class="h4 fw-bold mb-0">${Common.escapeHtml(metric.format(value))}</div>
                                    </div>
                                    <span class="metric-icon"><i class="fa-solid ${Common.escapeHtml(metric.icon)}"></i></span>
                                </div>
                            </div>
                        </article>
                    </div>
                `;
            });

        $('#statisticsKpis').html(cards.join(''));
    }

    function renderInsufficientLists(year, month) {
        const trainingRows = persons
            .filter(person => person.active !== false)
            .map(person => ({ person, status: annualTrainingStatus(person, year) }))
            .filter(item => item.status.isApplicable && !item.status.compliant);

        $('#trainingInsufficientList').html(trainingRows.length
            ? trainingRows.map(item => `
                <div class="shortage-item">
                    <div class="fw-semibold">${Common.escapeHtml(item.person.name)}</div>
                    <div class="small text-secondary">
                        計算後請假 ${item.status.complianceEffectiveLeaveCount} 次、無故缺席 ${item.status.absenceCount} 次；
                        協勤抵免 ${item.status.complianceOffsetCount} 次並列入出席。
                    </div>
                </div>
            `).join('')
            : '<div class="text-success"><i class="fa-solid fa-circle-check me-1"></i>目前沒有常年訓練不足人員。</div>');

        const cooperationRows = persons
            .filter(person => person.active !== false)
            .map(person => ({
                person,
                shortages: cooperationShortage(person, year, month)
            }))
            .filter(item => item.shortages.length > 0);

        $('#cooperationInsufficientList').html(cooperationRows.length
            ? cooperationRows.map(item => `
                <div class="shortage-item">
                    <div class="fw-semibold">${Common.escapeHtml(item.person.name)}</div>
                    <div class="small text-secondary">
                        ${item.shortages.map(shortage => `${shortage.month} 月尚差 ${shortage.shortage.toFixed(1)} 小時`).join('、')}
                    </div>
                </div>
            `).join('')
            : '<div class="text-success"><i class="fa-solid fa-circle-check me-1"></i>目前沒有協勤時數不足人員。</div>');
    }

    function renderDetails(filteredDuties, year) {
        const details = persons.map(person => {
            const personalDuties = filteredDuties.filter(duty => personMatchesDuty(person, duty));
            const trainingStatus = annualTrainingStatus(person, year);
            const cooperationHours = personalDuties
                .filter(duty => duty.dutyType === '協勤')
                .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);
            const officialHours = personalDuties
                .filter(duty => duty.dutyType === '公差勤務')
                .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);
            const totalHours = personalDuties.reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

            return {
                name: person.name,
                cooperationHours,
                trainingAttend: trainingStatus.effectiveAttendCount,
                trainingOffset: trainingStatus.offsetCount,
                trainingLeave: trainingStatus.effectiveLeaveCount,
                officialHours,
                totalHours
            };
        });

        if (statisticsTable) {
            statisticsTable.destroy();
        }

        $('#statisticsTable tbody').html(details.map(detail => `
            <tr>
                <td class="dtr-control"></td>
                <td>${Common.escapeHtml(detail.name)}</td>
                <td>${detail.cooperationHours.toFixed(1)}</td>
                <td>${detail.trainingAttend}${detail.trainingOffset > 0 ? `（含抵免 ${detail.trainingOffset}）` : ''}</td>
                <td>${detail.trainingLeave}</td>
                <td>${detail.officialHours.toFixed(1)}</td>
                <td>${detail.totalHours.toFixed(1)}</td>
            </tr>
        `).join(''));

        statisticsTable = Common.createResponsiveDataTable('#statisticsTable', {
            pageLength: 10,
            columnDefs: [
                { targets: 1, responsivePriority: 1 },
                { targets: 2, responsivePriority: 2 },
                { targets: 3, responsivePriority: 3 },
                { targets: 4, responsivePriority: 4 },
                { targets: 5, responsivePriority: 5 },
                { targets: 6, responsivePriority: 6 }
            ]
        });
    }

    function render() {
        const year = $('#yearFilter').val();
        const month = $('#monthFilter').val();
        const filteredDuties = filterRowsByPeriod(duties, year, month);
        const context = {
            persons,
            activePersons: persons.filter(person => person.active),
            duties: filteredDuties,
            year,
            month
        };

        renderMetricCards(context);
        renderInsufficientLists(year, month);
        renderDetails(filteredDuties, year);
        Common.log('Statistics', '完成統計畫面更新', {
            year,
            month: month || '全年',
            metricCount: METRIC_DEFINITIONS.filter(metric => metric.enabled).length,
            dutyRows: filteredDuties.length
        });
    }

    async function initialize() {
        const access = await Common.ready;

        if (!access.canViewTeamStatistics) {
            return;
        }

        initializeFilters();

        const result = await Promise.all([
            DataService.request('getPersons'),
            DataService.request('getDuties')
        ]);

        persons = result[0].filter(person => (
            person.brigade === access.currentUser.brigade
            && person.unit === access.currentUser.unit
        ));

        duties = result[1].filter(duty => (
            persons.some(person => personMatchesDuty(person, duty))
        ));

        $('#applyFilterBtn').on('click', render);
        Common.log('Statistics', '統計資料初始化完成', { persons: persons.length, duties: duties.length });
        render();
    }

    initialize().catch(error => {
        if ($('body').attr('data-access-denied') !== 'true') {
            console.error('[Statistics] 載入失敗', error);
            alert(`載入失敗：${error.message}`);
        }
    });
});
