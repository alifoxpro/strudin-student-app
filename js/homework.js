// ==========================================
// homework.js - إدارة الواجبات والتذكيرات
// ==========================================

(function() {
    let currentFilter = 'all';
    let editingHomeworkId = null;

    function getHomework() {
        return Storage.get('homework', []);
    }

    function saveHomework(list) {
        Storage.set('homework', list);
    }

    function generateId() {
        return 'hw_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }

    // === عرض الواجبات ===
    function renderHomework() {
        const container = document.getElementById('homeworkList');
        let homework = getHomework();
        const now = new Date();
        const todayStr = new Date(now.toDateString());

        // تطبيق الفلتر
        if (currentFilter === 'pending') {
            homework = homework.filter(h => !h.completed);
        } else if (currentFilter === 'completed') {
            homework = homework.filter(h => h.completed);
        } else if (currentFilter === 'overdue') {
            homework = homework.filter(h => !h.completed && new Date(h.dueDate) < todayStr);
        }

        // ترتيب: المتأخر أولاً، ثم حسب تاريخ التسليم
        homework.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        if (homework.length === 0) {
            const messages = {
                all: 'لا توجد واجبات بعد. أضف واجبك الأول!',
                pending: 'لا توجد واجبات معلّقة 🎉',
                completed: 'لم يتم إنجاز أي واجب بعد',
                overdue: 'لا توجد واجبات متأخرة 👍'
            };
            container.innerHTML = `<p class="empty-state">${messages[currentFilter]}</p>`;
            return;
        }

        container.innerHTML = homework.map(h => {
            const dueDate = new Date(h.dueDate);
            const isOverdue = !h.completed && dueDate < todayStr;
            const daysLeft = Math.ceil((dueDate - todayStr) / 86400000);

            let dueText = '';
            if (isOverdue) {
                const daysLate = Math.abs(daysLeft);
                dueText = `متأخر ${daysLate} ${daysLate === 1 ? 'يوم' : 'أيام'}`;
            } else if (daysLeft === 0) dueText = 'اليوم';
            else if (daysLeft === 1) dueText = 'غداً';
            else dueText = `بعد ${daysLeft} أيام`;

            const priorityLabels = { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' };

            return `
                <div class="homework-item priority-${h.priority} ${h.completed ? 'completed' : ''}">
                    <button class="homework-check ${h.completed ? 'checked' : ''}"
                            onclick="toggleHomework('${h.id}')"
                            title="${h.completed ? 'إلغاء الإنجاز' : 'تحديد كمنجز'}">
                        ${h.completed ? '✓' : ''}
                    </button>
                    <div class="homework-info">
                        <div class="homework-title">${h.title}</div>
                        <div class="homework-meta">
                            <span>📚 ${h.subject}</span>
                            <span>📅 ${formatDate(h.dueDate)}</span>
                            <span>⚡ ${priorityLabels[h.priority]}</span>
                            ${isOverdue ? '<span class="overdue-tag">⚠️ ' + dueText + '</span>' :
                              '<span>⏰ ' + dueText + '</span>'}
                        </div>
                        ${h.notes ? `<div class="homework-notes">${h.notes}</div>` : ''}
                    </div>
                    <div class="homework-actions">
                        <button onclick="editHomework('${h.id}')" title="تعديل">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button onclick="deleteHomework('${h.id}')" title="حذف">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // === تنسيق التاريخ ===
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = arabicMonths[date.getMonth()];
        return `${day} ${month}`;
    }

    // === فتح نافذة الواجب ===
    function openHomeworkModal(hwData = null) {
        const modal = document.getElementById('homeworkModal');
        const title = document.getElementById('homeworkModalTitle');
        const form = document.getElementById('homeworkForm');

        if (hwData) {
            title.textContent = 'تعديل الواجب';
            document.getElementById('hwTitle').value = hwData.title;
            document.getElementById('hwSubject').value = hwData.subject;
            document.getElementById('hwDueDate').value = hwData.dueDate;
            document.getElementById('hwPriority').value = hwData.priority;
            document.getElementById('hwNotes').value = hwData.notes || '';
            document.getElementById('hwId').value = hwData.id;
            editingHomeworkId = hwData.id;
        } else {
            title.textContent = 'إضافة واجب جديد';
            form.reset();
            // تعيين تاريخ افتراضي (غداً)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('hwDueDate').value = tomorrow.toISOString().split('T')[0];
            document.getElementById('hwId').value = '';
            editingHomeworkId = null;
        }

        modal.classList.add('active');
    }

    // === حفظ الواجب ===
    function saveHomeworkItem(e) {
        e.preventDefault();

        const hwData = {
            id: editingHomeworkId || generateId(),
            title: document.getElementById('hwTitle').value.trim(),
            subject: document.getElementById('hwSubject').value.trim(),
            dueDate: document.getElementById('hwDueDate').value,
            priority: document.getElementById('hwPriority').value,
            notes: document.getElementById('hwNotes').value.trim(),
            completed: false,
            createdAt: new Date().toISOString()
        };

        let homework = getHomework();

        if (editingHomeworkId) {
            homework = homework.map(h => {
                if (h.id === editingHomeworkId) {
                    return { ...h, ...hwData, completed: h.completed };
                }
                return h;
            });
        } else {
            homework.push(hwData);
        }

        saveHomework(homework);
        document.getElementById('homeworkModal').classList.remove('active');
        renderHomework();
        updateDashboard();
    }

    // === تبديل حالة الواجب ===
    window.toggleHomework = function(id) {
        let homework = getHomework();
        homework = homework.map(h => {
            if (h.id === id) {
                return { ...h, completed: !h.completed, completedAt: !h.completed ? new Date().toISOString() : null };
            }
            return h;
        });
        saveHomework(homework);
        renderHomework();
        updateDashboard();
    };

    // === تعديل واجب ===
    window.editHomework = function(id) {
        const homework = getHomework();
        const hw = homework.find(h => h.id === id);
        if (hw) openHomeworkModal(hw);
    };

    // === حذف واجب ===
    window.deleteHomework = function(id) {
        if (!confirm('هل تريد حذف هذا الواجب؟')) return;
        let homework = getHomework();
        homework = homework.filter(h => h.id !== id);
        saveHomework(homework);
        renderHomework();
        updateDashboard();
    };

    // === التنبيهات ===
    function checkReminders() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }

        const homework = getHomework();
        const now = new Date();
        const todayStr = new Date(now.toDateString());

        homework.forEach(h => {
            if (h.completed) return;
            const dueDate = new Date(h.dueDate);
            const daysLeft = Math.ceil((dueDate - todayStr) / 86400000);

            if (daysLeft === 1 && Notification.permission === 'granted') {
                const key = 'notified_' + h.id + '_' + now.toDateString();
                if (!sessionStorage.getItem(key)) {
                    new Notification('تذكير بواجب! 📝', {
                        body: `${h.title} (${h.subject}) - يجب تسليمه غداً`,
                        icon: '📚'
                    });
                    sessionStorage.setItem(key, '1');
                }
            }
        });
    }

    // === التهيئة ===
    document.addEventListener('DOMContentLoaded', () => {
        // زر إضافة واجب
        document.getElementById('addHomeworkBtn').addEventListener('click', () => openHomeworkModal());

        // إغلاق النافذة
        document.getElementById('closeHomeworkModal').addEventListener('click', () => {
            document.getElementById('homeworkModal').classList.remove('active');
        });
        document.getElementById('cancelHomeworkBtn').addEventListener('click', () => {
            document.getElementById('homeworkModal').classList.remove('active');
        });

        // حفظ الواجب
        document.getElementById('homeworkForm').addEventListener('submit', saveHomeworkItem);

        // أزرار الفلترة
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderHomework();
            });
        });

        renderHomework();

        // فحص التنبيهات كل 5 دقائق
        checkReminders();
        setInterval(checkReminders, 300000);
    });
})();
