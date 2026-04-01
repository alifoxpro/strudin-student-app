// ==========================================
// app.js - التطبيق الرئيسي والتنقل
// ==========================================

// === التخزين المحلي ===
const Storage = {
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem('strudin_' + key);
            return data ? JSON.parse(data) : defaultValue;
        } catch { return defaultValue; }
    },
    set(key, value) {
        localStorage.setItem('strudin_' + key, JSON.stringify(value));
    },
    remove(key) {
        localStorage.removeItem('strudin_' + key);
    },
    exportAll() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('strudin_')) {
                data[key] = localStorage.getItem(key);
            }
        }
        return data;
    },
    importAll(data) {
        Object.keys(data).forEach(key => {
            if (key.startsWith('strudin_')) {
                localStorage.setItem(key, data[key]);
            }
        });
    }
};

// === الاقتباسات التحفيزية ===
const quotes = [
    "العلم نور والجهل ظلام، فاسعَ دائماً نحو النور",
    "النجاح ليس نهاية الطريق، بل بداية رحلة جديدة",
    "كل يوم تتعلم فيه شيئاً جديداً هو يوم لم يضع",
    "الاستمرارية هي مفتاح النجاح، لا تتوقف أبداً",
    "ابدأ من حيث أنت، واستخدم ما لديك، وافعل ما تستطيع",
    "التعليم هو أقوى سلاح يمكنك استخدامه لتغيير العالم",
    "لا يهم مدى بطء تقدمك، المهم ألا تتوقف",
    "الصبر مع المذاكرة ينتج عنه نتائج لا تُصدَّق",
    "اقرأ كثيراً، تعلم دائماً، وابقَ فضولياً",
    "النجاح يأتي لمن يستعد جيداً وينتظر بصبر",
    "مشوار الألف ميل يبدأ بخطوة واحدة",
    "العقل مثل العضلات، كلما استخدمته أكثر أصبح أقوى",
    "لا تقارن نفسك بالآخرين، قارن نفسك بنفسك بالأمس",
    "كل خبير كان يوماً مبتدئاً",
    "الفشل ليس نهاية الطريق، بل هو معلم عظيم"
];

// === الأيام بالعربية ===
const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// === التنقل بين الصفحات ===
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.dataset.page;

            // تحديث التنقل
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // تحديث الصفحات
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + targetPage).classList.add('active');

            // إغلاق القائمة في الموبايل
            closeSidebar();

            // تحديث لوحة التحكم إذا انتقلنا إليها
            if (targetPage === 'dashboard') {
                updateDashboard();
            }
        });
    });
}

// === القائمة الجانبية (موبايل) ===
function initMobileSidebar() {
    const sidebar = document.getElementById('sidebar');

    // إنشاء زر القائمة للموبايل
    const mobileBtn = document.createElement('button');
    mobileBtn.className = 'mobile-menu-btn';
    mobileBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
    `;
    document.body.appendChild(mobileBtn);

    // إنشاء الخلفية المعتمة
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', closeSidebar);
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
}

// === التاريخ ===
function updateDate() {
    const now = new Date();
    const day = arabicDays[now.getDay()];
    const date = now.getDate();
    const month = arabicMonths[now.getMonth()];
    const year = now.getFullYear();
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.textContent = `${day}، ${date} ${month} ${year}`;
    }
}

// === الاقتباس اليومي ===
function updateQuote() {
    const today = new Date();
    const index = (today.getDate() + today.getMonth()) % quotes.length;
    const quoteEl = document.querySelector('.quote-text');
    if (quoteEl) {
        quoteEl.textContent = '💎 ' + quotes[index];
    }
}

// === تحديث لوحة التحكم ===
function updateDashboard() {
    const now = new Date();
    const todayIndex = now.getDay(); // 0=أحد

    // حصص اليوم
    const classes = Storage.get('classes', []);
    const todayClasses = classes
        .filter(c => parseInt(c.day) === (todayIndex === 0 ? 0 : todayIndex === 6 ? -1 : todayIndex - 0))
        .sort((a, b) => a.start.localeCompare(b.start));

    // تحويل الأيام: الأحد=0، الإثنين=1...
    // في select: 0=أحد، 1=اثنين، 2=ثلاثاء، 3=أربعاء، 4=خميس
    const dayMap = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
    const jsToSchedule = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: -1, 6: -1 };
    const scheduleDay = jsToSchedule[todayIndex];

    const todaySchedule = classes.filter(c => parseInt(c.day) === scheduleDay)
        .sort((a, b) => a.start.localeCompare(b.start));

    document.getElementById('todayClassesCount').textContent = todaySchedule.length;

    // عرض الحصص القادمة
    const upcomingEl = document.getElementById('upcomingClasses');
    if (todaySchedule.length === 0) {
        upcomingEl.innerHTML = '<p class="empty-state">لا توجد حصص اليوم</p>';
    } else {
        upcomingEl.innerHTML = todaySchedule.map(c => `
            <div class="list-item">
                <div class="list-item-color" style="background:${c.color}"></div>
                <div class="list-item-info">
                    <h4>${c.name}</h4>
                    <p>${c.teacher || ''} ${c.room ? '• القاعة ' + c.room : ''}</p>
                </div>
                <span class="list-item-time">${c.start} - ${c.end}</span>
            </div>
        `).join('');
    }

    // الواجبات
    const homework = Storage.get('homework', []);
    const pending = homework.filter(h => !h.completed);
    const completed = homework.filter(h => h.completed);
    const overdue = pending.filter(h => new Date(h.dueDate) < new Date(now.toDateString()));

    document.getElementById('pendingHomeworkCount').textContent = pending.length;
    document.getElementById('completedHomeworkCount').textContent = completed.length;

    // واجبات مستحقة قريباً
    const upcomingHw = pending
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5);

    const hwEl = document.getElementById('upcomingHomework');
    if (upcomingHw.length === 0) {
        hwEl.innerHTML = '<p class="empty-state">لا توجد واجبات مستحقة</p>';
    } else {
        hwEl.innerHTML = upcomingHw.map(h => {
            const due = new Date(h.dueDate);
            const isOverdue = due < new Date(now.toDateString());
            const daysLeft = Math.ceil((due - new Date(now.toDateString())) / 86400000);
            let dueText = '';
            if (isOverdue) dueText = '<span class="overdue-tag">متأخر</span>';
            else if (daysLeft === 0) dueText = 'اليوم';
            else if (daysLeft === 1) dueText = 'غداً';
            else dueText = `بعد ${daysLeft} أيام`;

            return `
                <div class="list-item">
                    <div class="list-item-color" style="background:${h.priority === 'high' ? '#DC2626' : h.priority === 'medium' ? '#D97706' : '#059669'}"></div>
                    <div class="list-item-info">
                        <h4>${h.title}</h4>
                        <p>${h.subject}</p>
                    </div>
                    <span class="list-item-time">${dueText}</span>
                </div>
            `;
        }).join('');
    }

    // ساعات المذاكرة
    const studyLog = Storage.get('studyLog', []);
    const todayStr = now.toISOString().split('T')[0];
    const todayMinutes = studyLog
        .filter(s => s.date === todayStr)
        .reduce((sum, s) => sum + s.minutes, 0);
    document.getElementById('studyHoursToday').textContent = (todayMinutes / 60).toFixed(1);

    // تحديث شارة الواجبات
    const badge = document.getElementById('homeworkBadge');
    if (pending.length > 0) {
        badge.style.display = 'inline';
        badge.textContent = pending.length;
    } else {
        badge.style.display = 'none';
    }

    // المعدل العام من الدرجات
    const grades = Storage.get('grades', []);
    if (grades.length > 0) {
        const avgPercent = grades.reduce((s, g) => s + (g.score / g.total) * 100, 0) / grades.length;
        document.getElementById('dashboardAvgGrade').textContent = Math.round(avgPercent) + '%';
    } else {
        document.getElementById('dashboardAvgGrade').textContent = '-';
    }
}

// === الإعدادات ===
function initSettings() {
    const settingsBtn = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettingsModal');
    const saveBtn = document.getElementById('saveSettingsBtn');
    const exportBtn = document.getElementById('exportDataBtn');
    const importBtn = document.getElementById('importDataBtn');
    const importFile = document.getElementById('importFile');

    settingsBtn.addEventListener('click', () => {
        const settings = Storage.get('settings', {});
        document.getElementById('studentName').value = settings.name || '';
        document.getElementById('studentLevel').value = settings.level || 'first';
        settingsModal.classList.add('active');
    });

    closeBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    saveBtn.addEventListener('click', () => {
        Storage.set('settings', {
            name: document.getElementById('studentName').value,
            level: document.getElementById('studentLevel').value
        });
        settingsModal.classList.remove('active');

        // تحديث رسالة الترحيب
        const name = document.getElementById('studentName').value;
        if (name) {
            document.querySelector('#page-dashboard .page-header h2').textContent = `مرحباً ${name}! 👋`;
        }
    });

    // تصدير البيانات
    exportBtn.addEventListener('click', () => {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'strudin-backup-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    // استيراد البيانات
    importBtn.addEventListener('click', () => importFile.click());

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                Storage.importAll(data);
                alert('تم استيراد البيانات بنجاح! سيتم تحديث الصفحة.');
                location.reload();
            } catch {
                alert('خطأ في قراءة الملف. تأكد من أنه ملف نسخة احتياطية صحيح.');
            }
        };
        reader.readAsText(file);
    });

    // تحميل اسم الطالب
    const settings = Storage.get('settings', {});
    if (settings.name) {
        document.querySelector('#page-dashboard .page-header h2').textContent = `مرحباً ${settings.name}! 👋`;
    }
}

// === إغلاق النوافذ بالضغط خارجها ===
function initModalClose() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// === التهيئة ===
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMobileSidebar();
    initModalClose();
    initSettings();
    updateDate();
    updateQuote();
    updateDashboard();

    // تحديث التاريخ كل دقيقة
    setInterval(updateDate, 60000);
});
