$(() => {
    let persons = [];
    let duties = [];
    let trainings = [];
    let records = [];
    let awards = [];
    let trainingRules = [];
    let awardRules = [];
    let certificates = [];
    let trainingTable;
    let awardTable;

    function years() {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 8 }, (_, index) => currentYear - index);
    }

    function months() {
        return [
            { value: 0, text: '全年度' },
            ...Array.from({ length: 12 }, (_, index) => ({
                value: index + 1,
                text: `${index + 1} 月`
            }))
        ];
    }

    function serviceMonths(person) {
        if (!person.joinDate) {
            return 0;
        }

        const start = new Date(`${person.joinDate}T00:00:00`);
        const now = new Date();
        let total = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();

        if (now.getDate() < start.getDate()) {
            total -= 1;
        }

        return Math.max(0, total);
    }

    function formatMonthDuration(totalMonths) {
        const monthsValue = Math.max(0, Number(totalMonths) || 0);
        const yearsPart = Math.floor(monthsValue / 12);
        const monthsPart = monthsValue % 12;
        const parts = [];

        if (yearsPart > 0) {
            parts.push(`${yearsPart} 年`);
        }

        if (monthsPart > 0) {
            parts.push(`${monthsPart} 個月`);
        }

        return parts.length ? parts.join(' ') : '0 個月';
    }

    function personMatchesDuty(person, duty) {
        return duty.nationalId === person.nationalId && duty.name === person.name;
    }

    function yearMatchesDuty(duty, year) {
        return String(duty.checkInDate || '').startsWith(String(year));
    }

    function monthMatchesDuty(duty, year, month) {
        if (!Number(month)) {
            return yearMatchesDuty(duty, year);
        }

        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        return String(duty.checkInDate || '').startsWith(prefix);
    }

    function cooperationHoursByMonth(person, year) {
        return Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const hours = duties
                .filter(duty => (
                    personMatchesDuty(person, duty)
                    && duty.dutyType === '協勤'
                    && monthMatchesDuty(duty, year, month)
                ))
                .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

            return { month, hours };
        });
    }

    function complianceEvaluationMonths(person, year) {
        const selectedYear = Number(year);
        const now = new Date();
        const configuredStart = new Date(`${AppConfig.RULE_CALCULATION_START_DATE}T00:00:00`);
        const joinDate = person.joinDate ? new Date(`${person.joinDate}T00:00:00`) : null;
        const effectiveStart = [configuredStart, joinDate]
            .filter(date => date && !Number.isNaN(date.getTime()))
            .sort((left, right) => right - left)[0];

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

        return Array.from({ length: lastMonth - firstMonth + 1 }, (_, index) => firstMonth + index);
    }

    function annualCompliance(person, year) {
        const selectedYear = Number(year);
        const rows = duties.filter(duty => personMatchesDuty(person, duty) && yearMatchesDuty(duty, selectedYear));
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

        const offsetForMonths = months => months
            .map(month => ({
                month,
                hours: rows
                    .filter(duty => duty.dutyType === '協勤' && monthMatchesDuty(duty, selectedYear, month))
                    .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0)
            }))
            .filter(item => item.hours >= 8)
            .slice(0, 4)
            .map(item => item.month);

        // KPI 使用整個所選年度資料，不受規則起算日限制。
        const allLeaveMonths = Array.from(leaveMonths).sort((left, right) => left - right);
        const allOffsetMonths = offsetForMonths(allLeaveMonths);
        const actualAttendCount = attendedMonths.size;
        const offsetCount = allOffsetMonths.length;
        const effectiveAttendCount = actualAttendCount + offsetCount;

        // 合規判斷只從設定起算日與個人入隊日兩者較晚者開始。
        const evaluatedMonths = complianceEvaluationMonths(person, selectedYear);
        const evaluatedLeaveMonths = allLeaveMonths.filter(month => evaluatedMonths.includes(month));
        const complianceOffsetMonths = offsetForMonths(evaluatedLeaveMonths);
        const absenceMonths = evaluatedMonths.filter(month => (
            !attendedMonths.has(month) && !leaveMonths.has(month)
        ));
        const leaveCount = evaluatedLeaveMonths.length;
        const effectiveLeaveCount = Math.max(0, leaveCount - complianceOffsetMonths.length);
        const cooperationHours = rows
            .filter(duty => duty.dutyType === '協勤')
            .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

        return {
            actualAttendCount,
            offsetCount,
            offsetMonths: allOffsetMonths,
            effectiveAttendCount,
            leaveCount,
            complianceOffsetCount: complianceOffsetMonths.length,
            complianceOffsetMonths,
            effectiveLeaveCount,
            absenceCount: absenceMonths.length,
            absenceMonths,
            evaluatedMonthCount: evaluatedMonths.length,
            cooperationHours
        };
    }

    function personDutyStats(person, year, month) {
        const annualRows = duties.filter(duty => personMatchesDuty(person, duty) && yearMatchesDuty(duty, year));
        const selectedRows = Number(month)
            ? annualRows.filter(duty => monthMatchesDuty(duty, year, month))
            : annualRows;
        const annualHours = annualRows.reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);
        const selectedHours = selectedRows.reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);
        const totalCooperationHours = duties
            .filter(duty => personMatchesDuty(person, duty) && duty.dutyType === '協勤')
            .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);
        const selectedCooperationHours = selectedRows
            .filter(duty => duty.dutyType === '協勤')
            .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);
        const annualTrainingRows = annualRows.filter(duty => duty.dutyType === '常年訓練');
        const annualTrainingAttend = annualTrainingRows.filter(duty => duty.serviceType === '出席').length;
        const selectedOfficialRows = selectedRows.filter(duty => duty.dutyType === '公差勤務');
        const selectedOfficialHours = selectedOfficialRows.reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

        return {
            annualRows,
            selectedRows,
            dutyCount: annualRows.length,
            annualHours,
            selectedHours,
            totalCooperationHours,
            selectedCooperationHours,
            annualTrainingRows,
            annualTrainingAttend,
            selectedOfficialRows,
            selectedOfficialHours
        };
    }

    function elapsedMonthsTarget(year) {
        const now = new Date();
        const selectedYear = Number(year);

        if (selectedYear < now.getFullYear()) {
            return 12;
        }

        if (selectedYear > now.getFullYear()) {
            return 0;
        }

        return now.getMonth() + 1;
    }

    function clampPercent(value) {
        return Math.max(0, Math.min(100, Number(value) || 0));
    }

    function progressCard({ title, value, detail, percent, icon, barClass, showProgress = true }) {
        const safePercent = clampPercent(percent);
        const progressHtml = showProgress
            ? `
                <div class="progress position-relative" role="progressbar" aria-valuenow="${safePercent}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar ${barClass}" style="width:${safePercent}%"></div>
                    <span class="progress-percentage">${safePercent.toFixed(0)}%</span>
                </div>
            `
            : '';

        return `
            <div class="col-12 col-sm-6 col-xl-3">
                <article class="card personal-kpi-card shadow-sm h-100">
                    <div class="card-body p-4">
                        <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
                            <div>
                                <div class="small text-secondary mb-1">${Common.escapeHtml(title)}</div>
                                <div class="h4 fw-bold mb-0">${Common.escapeHtml(value)}</div>
                            </div>
                            <span class="personal-kpi-icon">
                                <i class="fa-solid ${Common.escapeHtml(icon)}"></i>
                            </span>
                        </div>
                        ${progressHtml}
                        <div class="small text-secondary ${showProgress ? 'mt-2' : ''}">${Common.escapeHtml(detail)}</div>
                    </div>
                </article>
            </div>
        `;
    }

    function cooperationYearRange(person) {
        const years = duties
            .filter(duty => personMatchesDuty(person, duty) && duty.dutyType === '協勤' && duty.checkInDate)
            .map(duty => Number(String(duty.checkInDate).slice(0, 4)))
            .filter(Number.isFinite);

        if (!years.length) {
            const currentYear = new Date().getFullYear();
            return `${currentYear}-${currentYear}`;
        }

        return `${Math.min(...years)}-${Math.max(...years)}`;
    }

    function completedTrainingNames(person) {
        return trainings
            .filter(training => training.nationalId === person.nationalId && training.name === person.name)
            .map(training => training.trainingItem);
    }

    function findTraining(person, trainingName) {
        return trainings.find(training => (
            training.nationalId === person.nationalId
            && training.name === person.name
            && training.trainingItem === trainingName
        ));
    }

    function addYears(dateText, yearsToAdd) {
        const date = new Date(`${dateText}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        date.setFullYear(date.getFullYear() + yearsToAdd);
        return date;
    }

    function formatDate(date) {
        if (!date) {
            return '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function evaluateTraining(person, rule) {
        const completedTraining = completedTrainingNames(person);
        const missing = [];
        const info = [];

        (rule.requiredTraining || []).forEach(trainingName => {
            if (!completedTraining.includes(trainingName)) {
                missing.push(`尚未完成「${trainingName}」`);
            }
        });

        if (rule.completionWithinYears) {
            let basisDateText = '';
            let basisMissingMessage = '';

            if (rule.basisTraining) {
                const basis = findTraining(person, rule.basisTraining);
                basisDateText = basis?.completionDate || '';
                basisMissingMessage = `尚未完成「${rule.basisTraining}」，無法計算完成期限`;
            } else if (rule.basisPersonField) {
                basisDateText = person?.[rule.basisPersonField] || '';
                basisMissingMessage = `尚未設定「${rule.basisPersonFieldName || rule.basisPersonField}」，無法計算完成期限`;
            }

            if (!basisDateText) {
                missing.push(basisMissingMessage || '缺少完成期限起算資料');
            } else {
                const deadline = addYears(basisDateText, rule.completionWithinYears);

                if (deadline) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (today > deadline) {
                        missing.push(`完成期限已於 ${formatDate(deadline)} 屆滿`);
                    } else {
                        info.push(`須於 ${formatDate(deadline)} 前完成`);
                    }
                }
            }
        }

        const currentServiceMonths = serviceMonths(person);

        if ((rule.minServiceMonths || 0) > currentServiceMonths) {
            missing.push(`服務年資尚差 ${formatMonthDuration(rule.minServiceMonths - currentServiceMonths)}`);
        }

        if ((rule.requiredEmtLevels || []).length > 0 && !rule.requiredEmtLevels.includes(person.emtLevel)) {
            missing.push(`EMT級別需為 ${rule.requiredEmtLevels.join('／')}`);
        }

        if ((rule.requiredTitle || []).length > 0 && !rule.requiredTitle.includes(person.title)) {
            missing.push(`職稱需為 ${rule.requiredTitle.join('／')}`);
        }

        return {
            eligible: missing.length === 0,
            missing,
            info
        };
    }

    function evaluateAward(person, rule, year) {
        const stats = personDutyStats(person, year, 1);
        const completedTraining = completedTrainingNames(person);
        const missing = [];
        const currentServiceMonths = serviceMonths(person);
        const totalDutyHours = duties
            .filter(duty => personMatchesDuty(person, duty))
            .reduce((sum, duty) => sum + Common.hoursBetween(duty), 0);

        if ((rule.minServiceMonths || 0) > currentServiceMonths) {
            missing.push(`服務年資尚差 ${formatMonthDuration(rule.minServiceMonths - currentServiceMonths)}`);
        }

        if (stats.dutyCount < (rule.minDutyCount || 0)) {
            missing.push(`年度勤務次數尚差 ${(rule.minDutyCount || 0) - stats.dutyCount} 次`);
        }

        if (stats.annualHours < (rule.minDutyHours || 0)) {
            missing.push(`年度勤務時數尚差 ${((rule.minDutyHours || 0) - stats.annualHours).toFixed(1)} 小時`);
        }

        if (totalDutyHours < (rule.minTotalDutyHours || 0)) {
            missing.push(`累計出勤時數尚差 ${((rule.minTotalDutyHours || 0) - totalDutyHours).toFixed(1)} 小時`);
        }

        (rule.requiredTraining || []).forEach(trainingName => {
            if (!completedTraining.includes(trainingName)) {
                missing.push(`尚未完成「${trainingName}」`);
            }
        });

        return {
            eligible: missing.length === 0,
            missing,
            info: rule.manualReviewNote ? [rule.manualReviewNote] : []
        };
    }

    function eligibilityCard(title, result, description, lawName, lawUrl) {
        const statusClass = result.eligible
            ? 'eligibility-status eligibility-status-ok'
            : 'eligibility-status eligibility-status-pending';
        const cardClass = result.eligible ? 'eligible' : 'not-eligible';
        const statusText = result.eligible ? '符合條件' : '尚未符合';
        const infoHtml = (result.info || []).length
            ? `<ul class="mb-2 text-success">${result.info.map(item => `<li>${Common.escapeHtml(item)}</li>`).join('')}</ul>`
            : '';
        const detailHtml = result.eligible
            ? `${infoHtml}<p class="mb-0 text-success">目前條件已符合。</p>`
            : `${infoHtml}<ul class="mb-0">${result.missing.map(item => `<li>${Common.escapeHtml(item)}</li>`).join('')}</ul>`;
        const lawHtml = lawUrl
            ? `<a class="btn btn-sm btn-outline-secondary mt-3" href="${Common.escapeHtml(lawUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-scale-balanced me-1"></i>${Common.escapeHtml(lawName || '查看法規依據')}</a>`
            : '';

        return `
            <div class="col-12 col-lg-6">
                <article class="card eligibility-card ${cardClass} h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between gap-2">
                            <h3 class="h6 fw-bold">${Common.escapeHtml(title)}</h3>
                            <span class="${statusClass}">${statusText}</span>
                        </div>
                        <p class="small text-secondary">${Common.escapeHtml(description || '')}</p>
                        ${detailHtml}
                        ${lawHtml}
                    </div>
                </article>
            </div>
        `;
    }


    function formatServiceDuration(person) {
        return formatMonthDuration(serviceMonths(person));
    }

    function renderBasicInfo(person) {
        $('#basicInfoGrid').html([
            ['入隊日期', person.joinDate || '-'],
            ['服務年資', formatServiceDuration(person)],
            ['EMT級別', person.emtLevel || '-'],
            ['性別', person.gender || '-']
        ].map(([label, value]) => `
            <div class="col-12 col-sm-6 col-lg-3">
                <div class="profile-field h-100">
                    <div class="small text-secondary">${Common.escapeHtml(label)}</div>
                    <div class="fw-bold mt-1">${Common.escapeHtml(value)}</div>
                </div>
            </div>
        `).join(''));
    }

    function renderCertificates(person) {
        const certificateNames = ['ACLS', 'BLS', 'BLS-I', 'TECC'];
        const personalCertificates = certificates.filter(item => (
            item.nationalId === person.nationalId && item.name === person.name
        ));

        $('#certificateCards').html(certificateNames.map(name => {
            const certificate = personalCertificates.find(item => item.certificateName === name);
            const completionDate = certificate?.completionDate || '';
            return `
                <div class="col-12 col-sm-6 col-xl-3">
                    <article class="certificate-card h-100 ${completionDate ? 'is-completed' : 'is-empty'}">
                        <div class="certificate-icon">
                            <i class="fa-solid fa-certificate"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${Common.escapeHtml(name)}</div>
                            <div class="small ${completionDate ? 'text-success' : 'text-secondary'}">
                                ${completionDate ? Common.escapeHtml(completionDate.replaceAll('-', '/')) : '-'}
                            </div>
                        </div>
                    </article>
                </div>
            `;
        }).join(''));
    }

    function isPendingDuty(duty) {
        return ['協勤', '公差勤務'].includes(duty.dutyType)
            && duty.checkInDate
            && duty.checkInTime
            && (!duty.checkOutDate || !duty.checkOutTime);
    }


    function updateQueryPersonTitle() {
        const nationalId = $('#personSelect').val();
        const person = persons.find(item => item.nationalId === nationalId);
        $('#queryPersonTitle').val(person?.title || '');
    }

    function renderProfile() {
        updateQueryPersonTitle();
        const personKey = $('#personSelect').val();
        const year = Number($('#yearSelect').val());
        const month = Number($('#monthSelect').val());
        const person = persons.find(item => item.nationalId === personKey);

        Common.log('Query', '開始顯示個人履歷', { personKey, year, month });

        if (!person) {
            $('#profileContent').prop('hidden', true);
            return;
        }

        $('#profileContent').prop('hidden', false);
        $('#profileName').text(`${person.title || ''} ${person.name}`.trim());
        $('#profileOrg').text(`${person.brigade}｜${person.unit}｜${person.department}`);
        renderBasicInfo(person);
        renderCertificates(person);

        const stats = personDutyStats(person, year, month);
        const compliance = annualCompliance(person, year);
        const annualTargetHours = elapsedMonthsTarget(year) * 4;
        const selectedCooperationTarget = Number(month) ? 4 : annualTargetHours;
        const cooperationProgress = selectedCooperationTarget > 0
            ? (stats.selectedCooperationHours / selectedCooperationTarget) * 100
            : 0;
        const effectiveTrainingAttend = compliance.effectiveAttendCount;
        const annualTrainingTarget = 12;
        const trainingProgress = (effectiveTrainingAttend / annualTrainingTarget) * 100;
        const selectedPeriodText = Number(month) ? `${year} 年 ${month} 月` : `${year} 年`;
        const cooperationRange = cooperationYearRange(person);

        $('#personalKpis').html([
            progressCard({
                title: '協勤總時數',
                value: `${stats.totalCooperationHours.toFixed(1)} 小時`,
                detail: `${cooperationRange}協勤時數累計`,
                percent: 0,
                icon: 'fa-clock',
                barClass: 'bg-primary',
                showProgress: false
            }),
            progressCard({
                title: Number(month) ? `${year}年${month}月協勤時數` : `${year}年協勤時數`,
                value: `${stats.selectedCooperationHours.toFixed(1)} 小時`,
                detail: Number(month)
                    ? `${month} 月協勤基準 4 小時`
                    : `${year} 年協勤參考進度 ${selectedCooperationTarget} 小時`,
                percent: cooperationProgress,
                icon: 'fa-calendar-day',
                barClass: cooperationProgress >= 100 ? 'bg-success' : 'bg-warning'
            }),
            progressCard({
                title: `${year}年常年訓練`,
                value: `${effectiveTrainingAttend} / 12 次`,
                detail: `出席 ${compliance.actualAttendCount} 次，請假協勤抵免出席 ${compliance.offsetCount} 次`,
                percent: trainingProgress,
                icon: 'fa-person-chalkboard',
                barClass: trainingProgress >= 100 ? 'bg-success' : 'bg-info'
            }),
            progressCard({
                title: `${year}年公差勤務`,
                value: `${stats.selectedOfficialHours.toFixed(1)} 小時`,
                detail: stats.selectedOfficialRows.length > 0
                    ? `${selectedPeriodText}共 ${stats.selectedOfficialRows.length} 筆公差勤務`
                    : `${selectedPeriodText}尚無公差勤務`,
                percent: 0,
                icon: 'fa-briefcase',
                barClass: 'bg-secondary',
                showProgress: false
            })
        ].join(''));

        const effectiveLeaveOk = compliance.effectiveLeaveCount <= 6;
        const absenceOk = compliance.absenceCount <= 3;

        $('#annualTrainingCompliance').html(`
            <div class="col-12 col-lg-6">
                <article class="card compliance-card ${effectiveLeaveOk ? 'is-compliant' : 'is-warning'} h-100">
                    <div class="card-body">
                        <h3 class="h6 fw-bold">常年訓練請假</h3>
                        <p class="mb-1">請假 ${compliance.leaveCount} 次，協勤抵免出席 ${compliance.complianceOffsetCount} 次，抵免後請假 ${compliance.effectiveLeaveCount} 次。</p>
                        <p class="small text-secondary mb-0">一年共 12 次常年訓練；最多請假 6 次。該月協勤每 8 小時可抵免該月 1 次常訓請假，最多抵免 4 次，抵免後列入出席。</p>
                        <a class="btn btn-sm btn-outline-secondary mt-3" href="https://law.nfa.gov.tw/MOBILE/law.aspx?LSID=FL005073" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-scale-balanced me-1"></i>查看法規依據</a>
                    </div>
                </article>
            </div>
            <div class="col-12 col-lg-6">
                <article class="card compliance-card ${absenceOk ? 'is-compliant' : 'is-warning'} h-100">
                    <div class="card-body">
                        <h3 class="h6 fw-bold">常年訓練無故缺席</h3>
                        <p class="mb-1">截至目前無故未出席 ${compliance.absenceCount} 次${compliance.absenceMonths.length ? `（${compliance.absenceMonths.join('、')} 月）` : ''}。</p>
                        <p class="small text-secondary mb-0">每月應有 1 次常年訓練；該月沒有出席且沒有請假，即計為無故未出席。無故未出席不得超過 3 次。</p>
                        <a class="btn btn-sm btn-outline-secondary mt-3" href="https://law.nfa.gov.tw/MOBILE/law.aspx?LSID=FL005073" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-scale-balanced me-1"></i>查看法規依據</a>
                    </div>
                </article>
            </div>
        `);

        const personalTraining = trainings.filter(training => (
            training.nationalId === person.nationalId && training.name === person.name
        ));

        if (trainingTable) {
            trainingTable.destroy();
            trainingTable = null;
        }

        $('#trainingTable').html(`
            <thead>
                <tr>
                    <th class="dtr-control-column" aria-label="展開明細"></th>
                    <th>訓練項目</th>
                    <th>完成日期</th>
                    <th>備註</th>
                </tr>
            </thead>
            <tbody></tbody>
        `);

        $('#trainingTable tbody').html(personalTraining.map(training => `
            <tr>
                <td class="dtr-control"></td>
                <td>${Common.escapeHtml(training.trainingItem)}</td>
                <td>${Common.escapeHtml(training.completionDate)}</td>
                <td>${Common.escapeHtml(training.note || '-')}</td>
            </tr>
        `).join(''));

        trainingTable = Common.createResponsiveDataTable('#trainingTable', {
            pageLength: 5
        });

        $('#trainingEligibility').html(
            trainingRules
                .filter(rule => !personalTraining.some(training => training.trainingItem === rule.name))
                .map(rule => eligibilityCard(
                    rule.name,
                    evaluateTraining(person, rule),
                    rule.description,
                    rule.lawName,
                    rule.lawUrl
                ))
                .join('')
            || '<div class="col-12 text-secondary">目前沒有待完成的訓練項目。</div>'
        );

        const personalAwards = awards.filter(award => (
            award.nationalId === person.nationalId && award.name === person.name
        ));

        if (awardTable) {
            awardTable.destroy();
            awardTable = null;
        }

        $('#awardTable').html(`
            <thead>
                <tr>
                    <th class="dtr-control-column" aria-label="展開明細"></th>
                    <th>獎項</th>
                    <th>獲獎日期</th>
                    <th>來源</th>
                    <th>備註</th>
                </tr>
            </thead>
            <tbody></tbody>
        `);

        $('#awardTable tbody').html(personalAwards.map(award => `
            <tr>
                <td class="dtr-control"></td>
                <td>${Common.escapeHtml(award.awardName)}</td>
                <td>${Common.escapeHtml(award.awardDate)}</td>
                <td>${Common.escapeHtml(award.source)}</td>
                <td>${Common.escapeHtml(award.note || '-')}</td>
            </tr>
        `).join(''));

        awardTable = Common.createResponsiveDataTable('#awardTable', {
            pageLength: 5
        });

        $('#awardEligibility').html(
            awardRules
                .filter(rule => !personalAwards.some(award => award.awardName === rule.name))
                .map(rule => eligibilityCard(
                    rule.name,
                    evaluateAward(person, rule, year),
                    rule.description,
                    rule.lawName,
                    rule.lawUrl
                ))
                .join('')
            || '<div class="col-12 text-secondary">目前沒有待判斷的獎項。</div>'
        );

        const personalRecords = records
            .filter(record => record.nationalId === person.nationalId && record.name === person.name)
            .sort((left, right) => right.date.localeCompare(left.date));

        $('#memberTimeline').html(personalRecords.map(record => `
            <article class="timeline-item">
                <div class="small text-secondary">
                    ${Common.escapeHtml(record.date)}｜${Common.escapeHtml(record.recordType)}
                </div>
                <div class="fw-semibold">${Common.escapeHtml(record.content)}</div>
                <div class="small text-secondary">${Common.escapeHtml(record.note || '')}</div>
            </article>
        `).join('') || '<div class="text-secondary">目前沒有隊員紀錄。</div>');
    }

    async function initialize() {
        const access = await Common.ready;
        const data = await Common.withLoading(() => DataService.requestBundle([
            'getPersons',
            'getDuties',
            'getTraining',
            'getMemberRecords',
            'getAwards',
            'getTrainingRules',
            'getAwardRules',
            'getCertificates'
        ]), '個人資料載入中，請稍候…');

        const allPersons = data.getPersons || access.visiblePersons;
        duties = data.getDuties || [];
        trainings = data.getTraining || [];
        records = data.getMemberRecords || [];
        awards = data.getAwards || [];
        trainingRules = data.getTrainingRules || [];
        awardRules = data.getAwardRules || [];
        certificates = data.getCertificates || [];

        persons = access.isStationOffice
            ? allPersons.filter(person => (
                person.brigade === access.currentUser.brigade
                && person.unit === access.currentUser.unit
            ))
            : [access.currentUser];

        $('#personSelect').html(persons.map(person => `
            <option value="${person.nationalId}">
                ${Common.escapeHtml(person.name)}
            </option>
        `).join(''));

        updateQueryPersonTitle();

        if (!access.isStationOffice) {
            $('#personSelect')
                .prop('disabled', true)
                .attr('title', '個人權限只能查看自己的資料');

            $('#personSelect')
                .closest('.col-12')
                .find('.form-label')
                .text('目前登入者');
        }

        const now = new Date();
        $('#yearSelect').html(years().map(year => (
            `<option value="${year}" ${year === now.getFullYear() ? 'selected' : ''}>${year}</option>`
        )).join(''));

        $('#monthSelect').html(months().map(month => (
            `<option value="${month.value}" ${month.value === now.getMonth() + 1 ? 'selected' : ''}>${month.text}</option>`
        )).join(''));

        $('[data-bs-toggle="tab"]').on('shown.bs.tab', () => {
            Common.recalcResponsiveTable(trainingTable);
            Common.recalcResponsiveTable(awardTable);
        });

        $('#personSelect, #yearSelect, #monthSelect').on('change', renderProfile);


        Common.log('Query', '查詢頁初始化完成', { visiblePersons: persons.length });
        renderProfile();
    }

    initialize().catch(error => {
        console.error('[Query] 載入失敗', error);
        alert(`載入失敗：${error.message}`);
    });
});
