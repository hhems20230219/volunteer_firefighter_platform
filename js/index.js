$(() => {
    const categoryClass = category => ({
        '隊務事項': 'text-bg-danger',
        '活動': 'text-bg-primary',
        '訓練': 'text-bg-success'
    }[category] || 'text-bg-secondary');

    function isSafeLink(value) {
        if (!value) return false;
        try {
            const url = new URL(value, window.location.href);
            return ['http:', 'https:'].includes(url.protocol);
        } catch {
            return false;
        }
    }

    DataService.request('getAnnouncements').then(rows => {
        const sortedRows = [...rows].sort((left, right) =>
            String(right.date || '').localeCompare(String(left.date || ''))
        );

        Common.log('Index', '公告載入完成', { count: sortedRows.length });
        $('#announcementList')
            .toggleClass('announcement-scroll', sortedRows.length > 3)
            .html(sortedRows.map(item => {
                const linkHtml = isSafeLink(item.url)
                    ? `<a class="announcement-link" href="${Common.escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-arrow-up-right-from-square"></i>${Common.escapeHtml(item.linkText || '查看連結')}</a>`
                    : '';

                return `
                    <article class="announcement-item py-3">
                        <div class="d-flex flex-column flex-md-row gap-2">
                            <time class="text-secondary text-nowrap">${Common.escapeHtml(item.date)}</time>
                            <span class="badge ${categoryClass(item.category)} align-self-start">${Common.escapeHtml(item.category)}</span>
                            <div>
                                <h3 class="h6 fw-bold mb-1">${Common.escapeHtml(item.title)}</h3>
                                <p class="text-secondary mb-0">${Common.escapeHtml(item.content)}</p>
                                ${linkHtml}
                            </div>
                        </div>
                    </article>
                `;
            }).join('') || '<div class="text-secondary">目前沒有公告</div>');
    }).catch(error => {
        console.error('[Index] 公告載入失敗', error);
        $('#announcementList').html(`<div class="alert alert-danger">公告載入失敗：${Common.escapeHtml(error.message)}</div>`);
    });
});
