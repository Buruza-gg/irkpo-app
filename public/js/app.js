// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function showLoader(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="loader-container">
            <div class="spinner"></div>
            <div class="loader-text">Загружаем данные...</div>
        </div>
    `;
}

// --- РОУТИНГ ---
async function router(pageName) {
    const container = document.getElementById('app-content');
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${pageName}`);
    if (activeBtn) activeBtn.classList.add('active');

    container.style.opacity = '0';
    
    setTimeout(async () => {
        try {
            const response = await fetch(`pages/${pageName}.html`);
            if (!response.ok) throw new Error('Страница не найдена');
            const html = await response.text();
            container.innerHTML = html;
            container.style.opacity = '1';
            container.style.transition = 'opacity 0.3s ease';
        } catch (e) {
            container.innerHTML = `<div class="message-box error">Ошибка загрузки: ${e.message}</div>`;
            container.style.opacity = '1';
        }
    }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
    router('home');
});

let globalGradesData = null;

// --- РАСПИСАНИЕ ---
async function loadSchedule() {
    const groupInput = document.getElementById('groupInput');
    const groupName = groupInput.value.trim();
    if (!groupName) { 
        groupInput.focus(); groupInput.style.borderColor = 'red';
        setTimeout(() => groupInput.style.borderColor = '', 1000); return; 
    }
    showLoader('schedule-content');

    try {
        const response = await fetch('/api/schedule', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupName })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Ошибка сервера");
        if (!data.schedule || !data.schedule.items || data.schedule.items.length === 0) {
            document.getElementById('schedule-content').innerHTML = `<div class="message-box"><div style="font-size:40px;margin-bottom:10px;">📭</div>Расписание пустое</div>`; return;
        }
        renderScheduleUI(data);
    } catch (e) { 
        document.getElementById('schedule-content').innerHTML = `<div class="message-box error"><div style="font-size:40px;margin-bottom:10px;">⚠️</div>${e.message}</div>`; 
    }
}

function renderScheduleUI(data) {
    const container = document.getElementById('schedule-content');
    const days = data.schedule.items; 
    const weekName = data.schedule.currentWeekName || "Текущая неделя";
    let html = `
        <div class="schedule-header">
            <div class="schedule-title">Расписание <span class="group-highlight">${data.group}</span></div>
            <div class="date-range">${weekName}</div> 
        </div>
        <div class="days-grid">
    `;
    days.forEach(day => {
        html += `<div class="day-card"><div class="day-header">${day.dayOfWeek}</div><div class="day-body">`;
        if (day.lessonIndexes && day.lessonIndexes.length > 0) {
            day.lessonIndexes.forEach(slot => {
                const time = `${slot.lessonStartTime} - ${slot.lessonEndTime}`;
                if (slot.items && slot.items.length > 0) {
                    slot.items.forEach(lesson => {
                        let subjectName = lesson.lessonName || (lesson.comment && lesson.comment.includes('куратор') ? lesson.comment : "Без названия");
                        const isCurator = subjectName.toLowerCase().includes('куратор');
                        
                        // --- ЛОГИКА ОТОБРАЖЕНИЯ АУДИТОРИИ И ПОДГРУППЫ ---
                        const roomHtml = lesson.classroom ? `<span class="lesson-room">Ауд. ${lesson.classroom}</span>` : '';
                        // Если есть подгруппа, добавляем её. Можно добавить запятую или скобки по желанию
                        const subgroupHtml = lesson.subgroup ? `<span class="lesson-subgroup">Подгруппа ${lesson.subgroup}</span>` : '';
                        
                        html += `<div class="lesson-item ${isCurator ? 'curator' : ''}">
                                    <div class="lesson-time">${time}</div>
                                    <div class="lesson-name">${subjectName}</div>
                                    <div class="lesson-details">
                                        <div class="teacher-name">${lesson.teacherName || "Преподаватель не указан"}</div>
                                        
                                        <!-- Единый блок для местоположения -->
                                        <div class="lesson-location">
                                            ${roomHtml}
                                            ${subgroupHtml}
                                        </div>
                                    </div>
                                 </div>`;
                    });
                }
            });
        } else { html += `<div style="color:#999; text-align:center; padding: 20px;">Нет занятий 🎉</div>`; }
        html += `</div></div>`;
    });
    html += `</div>`;
    container.style.opacity = 0; container.innerHTML = html;
    setTimeout(() => { container.style.transition = 'opacity 0.5s ease'; container.style.opacity = 1; }, 50);
}

// --- УСПЕВАЕМОСТЬ ---
async function loadGrades() {
    const phoneInput = document.getElementById('phoneInput');
    const phone = phoneInput.value.trim();
    if(!phone) { phoneInput.focus(); return; }
    showLoader('grades-content');
    try {
        const res = await fetch('/api/grades', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if(res.ok) {
            globalGradesData = data;
            renderSemesterTabs(data);
        } else { document.getElementById('grades-content').innerHTML = `<div class="message-box error">${data.error}</div>`; }
    } catch(e) { document.getElementById('grades-content').innerHTML = '<div class="message-box error">Ошибка соединения</div>'; }
}

function renderSemesterTabs(data) {
    const container = document.getElementById('grades-content');
    if (!data.plans || data.plans.length === 0) { container.innerHTML = '<div class="message-box">Нет данных по учебному плану</div>'; return; }
    const plan = data.plans[0];
    const periods = plan.periods;

    let html = `
        <div style="text-align:center; margin-bottom:30px;">
            <h2 style="margin:0; font-size:24px;">Группа <span class="group-highlight">${plan.groupName}</span></h2>
        </div>
        <div class="semesters-nav" id="semesterNav"></div>
        <div id="semesterTableContainer"></div>
    `;
    container.innerHTML = html;

    const navContainer = document.getElementById('semesterNav');
    
    // Генерируем кнопки
    periods.forEach((period, index) => {
        const btn = document.createElement('button');
        // Активным делаем последний семестр
        const isActive = index === periods.length - 1;
        btn.className = `sem-btn ${isActive ? 'active' : ''}`; 
        btn.innerText = period.name;
        btn.id = `sem-btn-${index}`; // ID для скролла
        btn.onclick = () => switchSemester(index, periods);
        navContainer.appendChild(btn);
    });

    // Рисуем и скроллим к последнему семестру
    if (periods.length > 0) {
        const lastIndex = periods.length - 1;
        renderSemesterTable(periods[lastIndex]);
        setTimeout(() => {
            const activeBtn = document.getElementById(`sem-btn-${lastIndex}`);
            if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
    }
}

function switchSemester(index, periods) {
    document.querySelectorAll('.sem-btn').forEach((b, i) => {
        if (i === index) {
            b.classList.add('active');
            b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else b.classList.remove('active');
    });
    renderSemesterTable(periods[index]);
}

function renderSemesterTable(period) {
    const container = document.getElementById('semesterTableContainer');
    container.style.opacity = 0;
    
    setTimeout(() => {
        if (!period.planCells || period.planCells.length === 0) {
            container.innerHTML = '<div class="message-box">Нет предметов</div>'; 
        } else {
            let html = `
                <div class="grades-table-wrapper">
                    <table class="styled-table">
                        <thead><tr><th>Предмет / Преподаватель</th><th>Итог</th></tr></thead>
                        <tbody>
            `;
            period.planCells.forEach((cell, idx) => {
                const subject = cell.rowName;
                let mark = null;
                if (cell.attestation && cell.attestation.markName) mark = cell.attestation.markName;
                else if (cell.sheets && cell.sheets.length > 0) mark = cell.sheets[0].sheetAttestationMarkName;
                
                let teacher = "";
                if (cell.sheets && cell.sheets.length > 0) teacher = cell.sheets[0].teacherName || "";
                
                let badgeClass = "";
                if(mark == "5") badgeClass = "g-5"; else if(mark == "4") badgeClass = "g-4";
                else if(mark == "3") badgeClass = "g-3"; else if(mark == "2") badgeClass = "g-2";
                const displayMark = mark ? `<span class="grade-badge-sm ${badgeClass}">${mark}</span>` : '<span style="color:#d1d5db; font-size:20px;">•</span>';

                html += `
                    <tr class="subject-row" onclick="openSubjectDetails('${period.name}', ${idx})">
                        <td><div style="font-weight:600; margin-bottom:4px;">${subject}</div><div style="font-size:13px; color:#9ca3af;">${teacher}</div></td>
                        <td>${displayMark}</td>
                    </tr>
                `;
            });
            html += `</tbody></table></div>`;
            container.innerHTML = html;
        }
        container.style.transition = 'opacity 0.3s ease';
        container.style.opacity = 1;
        window.currentPeriodData = period;
    }, 150);
}

// --- МОДАЛЬНОЕ ОКНО ---
function openSubjectDetails(periodName, cellIndex) {
    const cell = window.currentPeriodData.planCells[cellIndex];
    const modal = document.getElementById('detailsModal');
    document.getElementById('modalSubjectTitle').innerText = cell.rowName;
    const body = document.getElementById('modalBody');

    let lessons = [];
    if (cell.sheets && cell.sheets.length > 0 && cell.sheets[0].lessons) {
        lessons = cell.sheets[0].lessons;
        lessons = lessons.slice().reverse(); 
    }

    if (lessons.length === 0) {
        body.innerHTML = `<div style="text-align:center; padding:60px; color:#9ca3af;"><div style="font-size:40px; margin-bottom:10px;">📝</div>Записей нет</div>`;
    } else {
        let html = '';
        lessons.forEach(lesson => {
            const date = formatDate(lesson.lessonDate);
            const topic = lesson.themePlanName || "Тема не указана";
            const type = lesson.lessonTypeName || "Занятие";
            const mark = lesson.markName;
            let markHtml = '';
            if (mark) {
                let c = ''; if(mark=="5") c='g-5'; else if(mark=="4") c='g-4'; else if(mark=="3") c='g-3'; else if(mark=="2") c='g-2';
                markHtml = `<div class="grade-box ${c}">${mark}</div>`;
            }
            html += `
                <div class="lesson-card">
                    <div class="lc-content">
                        <div class="lc-meta"><span>${date}</span><span class="lc-type-badge">${type}</span></div>
                        <div class="lc-topic">${topic}</div>
                    </div>
                    <div class="lc-grade-area">${markHtml}</div>
                </div>
            `;
        });
        body.innerHTML = html;
    }
    modal.classList.add('open');
}

function closeModal() { 
    const modal = document.getElementById('detailsModal');
    const content = modal.querySelector('.modal-content');
    content.style.transform = 'scale(0.9)'; content.style.opacity = '0'; content.style.transition = 'all 0.2s';
    setTimeout(() => { modal.classList.remove('open'); content.style.transform = ''; content.style.opacity = ''; }, 200);
}
document.getElementById('detailsModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });

function formatDate(str) {
    if(!str) return '';
    const d = new Date(str);
    if(isNaN(d)) return str.split(' ')[0];
    const months = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];
    return `${d.getDate()} ${months[d.getMonth()]}`;
}
