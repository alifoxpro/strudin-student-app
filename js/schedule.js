// ==========================================
// schedule.js - إدارة الجدول الدراسي
// ==========================================

(function() {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    let selectedColor = '#4F46E5';
    let editingClassId = null;

    function getClasses() {
        return Storage.get('classes', []);
    }

    function saveClasses(classes) {
        Storage.set('classes', classes);
    }

    function generateId() {
        return 'cls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }

    // === رسم الجدول ===
    function renderSchedule() {
        const grid = document.getElementById('scheduleGrid');
        const classes = getClasses();
        const today = new Date().getDay(); // 0=أحد

        grid.innerHTML = dayNames.map((day, index) => {
            const dayClasses = classes
                .filter(c => parseInt(c.day) === index)
                .sort((a, b) => a.start.localeCompare(b.start));

            const isToday = today === index;

            return `
                <div class="schedule-day">
                    <div class="schedule-day-header ${isToday ? 'today' : ''}">
                        ${day}
                        ${isToday ? ' (اليوم)' : ''}
                    </div>
                    <div class="schedule-day-body">
                        ${dayClasses.length === 0 ?
                            '<p class="empty-state" style="padding:1rem;font-size:0.8rem">لا توجد حصص</p>' :
                            dayClasses.map(c => `
                                <div class="schedule-class" style="background:${c.color}15; border-color:${c.color}; color:${c.color}">
                                    <div class="schedule-class-actions">
                                        <button onclick="editClass('${c.id}')" title="تعديل">✏️</button>
                                        <button onclick="deleteClass('${c.id}')" title="حذف">🗑️</button>
                                    </div>
                                    <div class="schedule-class-name">${c.name}</div>
                                    <div class="schedule-class-time">${c.start} - ${c.end}</div>
                                    ${c.teacher ? `<div class="schedule-class-teacher">${c.teacher}</div>` : ''}
                                    ${c.room ? `<div class="schedule-class-teacher">القاعة: ${c.room}</div>` : ''}
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    // === فتح نافذة إضافة حصة ===
    function openClassModal(classData = null) {
        const modal = document.getElementById('classModal');
        const title = document.getElementById('classModalTitle');
        const form = document.getElementById('classForm');

        if (classData) {
            title.textContent = 'تعديل الحصة';
            document.getElementById('className').value = classData.name;
            document.getElementById('classTeacher').value = classData.teacher || '';
            document.getElementById('classDay').value = classData.day;
            document.getElementById('classStart').value = classData.start;
            document.getElementById('classEnd').value = classData.end;
            document.getElementById('classRoom').value = classData.room || '';
            document.getElementById('classId').value = classData.id;
            selectedColor = classData.color;
            editingClassId = classData.id;
        } else {
            title.textContent = 'إضافة حصة جديدة';
            form.reset();
            document.getElementById('classId').value = '';
            selectedColor = '#4F46E5';
            editingClassId = null;
        }

        // تحديث اللون المحدد
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.color === selectedColor);
        });

        modal.classList.add('active');
    }

    // === حفظ الحصة ===
    function saveClass(e) {
        e.preventDefault();

        const classData = {
            id: editingClassId || generateId(),
            name: document.getElementById('className').value.trim(),
            teacher: document.getElementById('classTeacher').value.trim(),
            day: document.getElementById('classDay').value,
            start: document.getElementById('classStart').value,
            end: document.getElementById('classEnd').value,
            color: selectedColor,
            room: document.getElementById('classRoom').value.trim()
        };

        let classes = getClasses();

        if (editingClassId) {
            classes = classes.map(c => c.id === editingClassId ? classData : c);
        } else {
            classes.push(classData);
        }

        saveClasses(classes);
        document.getElementById('classModal').classList.remove('active');
        renderSchedule();
        updateDashboard();
    }

    // === تعديل حصة ===
    window.editClass = function(id) {
        const classes = getClasses();
        const classData = classes.find(c => c.id === id);
        if (classData) openClassModal(classData);
    };

    // === حذف حصة ===
    window.deleteClass = function(id) {
        if (!confirm('هل تريد حذف هذه الحصة؟')) return;
        let classes = getClasses();
        classes = classes.filter(c => c.id !== id);
        saveClasses(classes);
        renderSchedule();
        updateDashboard();
    };

    // === التهيئة ===
    document.addEventListener('DOMContentLoaded', () => {
        // زر إضافة حصة
        document.getElementById('addClassBtn').addEventListener('click', () => openClassModal());

        // إغلاق النافذة
        document.getElementById('closeClassModal').addEventListener('click', () => {
            document.getElementById('classModal').classList.remove('active');
        });
        document.getElementById('cancelClassBtn').addEventListener('click', () => {
            document.getElementById('classModal').classList.remove('active');
        });

        // حفظ الحصة
        document.getElementById('classForm').addEventListener('submit', saveClass);

        // اختيار اللون
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedColor = btn.dataset.color;
            });
        });

        // رسم الجدول
        renderSchedule();
    });
})();
