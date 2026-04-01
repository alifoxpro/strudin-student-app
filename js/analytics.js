// ==========================================
// analytics.js - تحليل الأداء الذكي
// ==========================================

(function() {
    let editingGradeId = null;

    const typeLabels = {
        quiz: 'اختبار قصير',
        midterm: 'اختبار نصفي',
        final: 'اختبار نهائي',
        homework: 'واجب',
        project: 'مشروع',
        participation: 'مشاركة'
    };

    const subjectColors = [
        '#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED',
        '#0891B2', '#BE185D', '#4338CA', '#65A30D', '#EA580C'
    ];

    function getGrades() {
        return Storage.get('grades', []);
    }

    function saveGrades(grades) {
        Storage.set('grades', grades);
    }

    function generateId() {
        return 'gr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }

    // ==========================================
    // 📊 حساب الإحصائيات
    // ==========================================
    function getStats() {
        const grades = getGrades();
        if (grades.length === 0) return null;

        // حساب النسب المئوية
        const withPercent = grades.map(g => ({
            ...g,
            percent: (g.score / g.total) * 100
        }));

        // المعدل العام
        const avgPercent = withPercent.reduce((s, g) => s + g.percent, 0) / withPercent.length;

        // تجميع حسب المادة
        const bySubject = {};
        withPercent.forEach(g => {
            if (!bySubject[g.subject]) bySubject[g.subject] = [];
            bySubject[g.subject].push(g);
        });

        // متوسط كل مادة
        const subjectAvgs = {};
        Object.keys(bySubject).forEach(sub => {
            const avg = bySubject[sub].reduce((s, g) => s + g.percent, 0) / bySubject[sub].length;
            subjectAvgs[sub] = Math.round(avg * 10) / 10;
        });

        // أقوى وأضعف مادة
        const sortedSubjects = Object.entries(subjectAvgs).sort((a, b) => b[1] - a[1]);
        const best = sortedSubjects[0];
        const weak = sortedSubjects[sortedSubjects.length - 1];

        // تطور الأداء عبر الوقت
        const timeline = withPercent
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(g => ({ date: g.date, percent: g.percent, subject: g.subject }));

        return {
            total: grades.length,
            avgPercent: Math.round(avgPercent * 10) / 10,
            bySubject,
            subjectAvgs,
            best: best ? { name: best[0], avg: best[1] } : null,
            weak: weak && sortedSubjects.length > 1 ? { name: weak[0], avg: weak[1] } : null,
            timeline,
            grades: withPercent
        };
    }

    // ==========================================
    // 📈 رسم بياني شريطي (بدون مكتبات)
    // ==========================================
    function renderBarChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!data || Object.keys(data).length === 0) {
            container.innerHTML = '<p class="empty-state">أضف درجات لعرض الرسم البياني</p>';
            return;
        }

        const entries = Object.entries(data);
        const maxVal = Math.max(...entries.map(e => e[1]));

        container.innerHTML = `
            <div class="bar-chart">
                ${entries.map(([ label, value ], i) => {
                    const height = maxVal > 0 ? (value / 100) * 160 : 0;
                    const color = subjectColors[i % subjectColors.length];
                    const gradeClass = value >= 90 ? 'excellent' : value >= 75 ? 'good' : value >= 60 ? 'average' : 'weak';
                    return `
                        <div class="bar-item">
                            <span class="bar-value">${value}%</span>
                            <div class="bar" style="height:${height}px; background:${color}"></div>
                            <span class="bar-label">${label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // ==========================================
    // 📉 رسم بياني خطي
    // ==========================================
    function renderTimelineChart(containerId, timeline) {
        const container = document.getElementById(containerId);
        if (!timeline || timeline.length === 0) {
            container.innerHTML = '<p class="empty-state">أضف درجات لعرض التطور</p>';
            return;
        }

        const width = 500;
        const height = 160;
        const padding = 30;

        const points = timeline.map((t, i) => ({
            x: padding + (i / Math.max(timeline.length - 1, 1)) * (width - padding * 2),
            y: height - padding - ((t.percent / 100) * (height - padding * 2)),
            ...t
        }));

        // خط المسار
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        // منطقة مملوءة
        const areaD = pathD + ` L ${points[points.length-1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

        container.innerHTML = `
            <div class="line-chart">
                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                    <!-- خطوط المرجع -->
                    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#E2E8F0" stroke-width="1"/>
                    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#E2E8F0" stroke-width="1"/>

                    <!-- خطوط أفقية مرجعية -->
                    ${[25, 50, 75, 100].map(val => {
                        const y = height - padding - ((val / 100) * (height - padding * 2));
                        return `
                            <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#F1F5F9" stroke-width="1" stroke-dasharray="4"/>
                            <text x="${padding - 5}" y="${y + 4}" fill="#94A3B8" font-size="10" text-anchor="end" font-family="Tajawal">${val}%</text>
                        `;
                    }).join('')}

                    <!-- المنطقة المملوءة -->
                    <path d="${areaD}" fill="url(#gradient)" opacity="0.3"/>

                    <!-- الخط -->
                    <path d="${pathD}" fill="none" stroke="#4F46E5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

                    <!-- النقاط -->
                    ${points.map(p => `
                        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#4F46E5" stroke="white" stroke-width="2"/>
                        <title>${p.subject}: ${Math.round(p.percent)}% - ${formatDateShort(p.date)}</title>
                    `).join('')}

                    <!-- تدرج لوني -->
                    <defs>
                        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#4F46E5"/>
                            <stop offset="100%" stop-color="#4F46E5" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        `;
    }

    // ==========================================
    // 🧠 تحليل بالذكاء الاصطناعي
    // ==========================================
    async function generateAIAnalysis() {
        const stats = getStats();
        if (!stats) {
            document.getElementById('aiAnalysisContent').innerHTML =
                '<p class="empty-state">أضف درجات أولاً لتحليل أدائك</p>';
            return;
        }

        const apiKey = Storage.get('groqApiKey', '');
        if (!apiKey) {
            document.getElementById('aiAnalysisContent').innerHTML =
                '<p class="empty-state">يرجى إدخال مفتاح Groq API في إعدادات المساعد الذكي أولاً</p>';
            return;
        }

        // عرض التحميل
        document.getElementById('aiAnalysisContent').innerHTML = `
            <div class="ai-analysis-loading">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
                <p>جاري تحليل أدائك بالذكاء الاصطناعي...</p>
            </div>
        `;

        // بناء بيانات الطالب
        const studyLog = Storage.get('studyLog', []);
        const homework = Storage.get('homework', []);
        const settings = Storage.get('settings', {});

        const studentData = `
بيانات الطالب:
- الاسم: ${settings.name || 'طالب'}
- المرحلة: الثانوية (${settings.level === 'first' ? 'أول' : settings.level === 'second' ? 'ثاني' : 'ثالث'})
- المعدل العام: ${stats.avgPercent}%
- عدد الدرجات المسجلة: ${stats.total}

متوسط الدرجات حسب المادة:
${Object.entries(stats.subjectAvgs).map(([sub, avg]) => `- ${sub}: ${avg}%`).join('\n')}

أقوى مادة: ${stats.best?.name} (${stats.best?.avg}%)
أضعف مادة: ${stats.weak?.name || stats.best?.name} (${stats.weak?.avg || stats.best?.avg}%)

آخر الدرجات:
${stats.grades.slice(-10).map(g => `- ${g.subject} (${typeLabels[g.type]}): ${g.score}/${g.total} = ${Math.round(g.percent)}% - ${g.date}`).join('\n')}

ساعات المذاكرة هذا الأسبوع: ${getWeeklyStudyMinutes()} دقيقة
الواجبات المعلّقة: ${homework.filter(h => !h.completed).length}
الواجبات المنجزة: ${homework.filter(h => h.completed).length}
        `.trim();

        const prompt = `أنت محلل أداء دراسي ذكي. حلل بيانات هذا الطالب وقدم:

1. **تقييم عام** (بجملتين)
2. **نقاط القوة** (3-4 نقاط)
3. **نقاط تحتاج تحسين** (3-4 نقاط مع حلول عملية)
4. **خطة مذاكرة مقترحة** (جدول أسبوعي مبسط يركز على المواد الضعيفة)
5. **توقع الأداء** (هل الطالب في مسار تحسن أم تراجع)
6. **نصيحة تحفيزية شخصية**

البيانات:
${studentData}

كن محدداً واذكر أسماء المواد. استخدم إيموجي مناسبة.`;

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: Storage.get('groqModel', 'llama-3.3-70b-versatile'),
                    messages: [
                        { role: 'system', content: 'أنت محلل أداء دراسي متخصص للطلاب السعوديين في المرحلة الثانوية. قدم تحليلات دقيقة ونصائح عملية بالعربية.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 2048,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error('API Error: ' + response.status);
            }

            const data = await response.json();
            const analysis = data.choices[0].message.content;

            document.getElementById('aiAnalysisContent').innerHTML = formatAnalysis(analysis);

            // حفظ آخر تحليل
            Storage.set('lastAnalysis', {
                content: analysis,
                date: new Date().toISOString()
            });

        } catch (error) {
            document.getElementById('aiAnalysisContent').innerHTML = `
                <p class="empty-state">❌ حدث خطأ في التحليل. تأكد من مفتاح Groq API واتصال الإنترنت.</p>
            `;
        }
    }

    function getWeeklyStudyMinutes() {
        const studyLog = Storage.get('studyLog', []);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekStr = weekAgo.toISOString().split('T')[0];
        return studyLog
            .filter(s => s.date >= weekStr)
            .reduce((sum, s) => sum + s.minutes, 0);
    }

    function formatAnalysis(text) {
        return text
            .replace(/### (.+)/g, '<h4>$1</h4>')
            .replace(/## (.+)/g, '<h4>$1</h4>')
            .replace(/# (.+)/g, '<h4>$1</h4>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^\- (.+)/gm, '<li>$1</li>')
            .replace(/^\d+\. (.+)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/<\/li><br><li>/g, '</li><li>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    }

    // ==========================================
    // 📋 جدول الدرجات
    // ==========================================
    function renderGrades() {
        const grades = getGrades();
        const tbody = document.getElementById('gradesBody');

        if (grades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد درجات بعد. أضف أول درجة!</td></tr>';
            return;
        }

        // ترتيب حسب التاريخ (الأحدث أولاً)
        const sorted = [...grades].sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = sorted.map(g => {
            const percent = Math.round((g.score / g.total) * 100);
            const gradeClass = percent >= 90 ? 'excellent' : percent >= 75 ? 'good' : percent >= 60 ? 'average' : 'weak';
            const gradeLabel = percent >= 90 ? 'ممتاز' : percent >= 75 ? 'جيد جداً' : percent >= 60 ? 'جيد' : 'ضعيف';

            return `
                <tr>
                    <td><strong>${g.subject}</strong></td>
                    <td>${typeLabels[g.type] || g.type}</td>
                    <td><strong>${g.score}</strong></td>
                    <td>${g.total}</td>
                    <td><span class="grade-badge ${gradeClass}">${percent}% ${gradeLabel}</span></td>
                    <td>${formatDateShort(g.date)}</td>
                    <td class="grade-actions">
                        <button onclick="editGrade('${g.id}')" title="تعديل">✏️</button>
                        <button onclick="deleteGrade('${g.id}')" title="حذف">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ==========================================
    // تحديث كل شيء
    // ==========================================
    function updateAnalytics() {
        const stats = getStats();

        if (!stats) {
            document.getElementById('avgGrade').textContent = '-';
            document.getElementById('bestSubject').textContent = '-';
            document.getElementById('weakSubject').textContent = '-';
            document.getElementById('totalGrades').textContent = '0';
            renderBarChart('subjectChart', null);
            renderTimelineChart('timelineChart', null);
            renderGrades();
            return;
        }

        // بطاقات الملخص
        document.getElementById('avgGrade').textContent = stats.avgPercent + '%';
        document.getElementById('bestSubject').textContent = stats.best?.name || '-';
        document.getElementById('weakSubject').textContent = stats.weak?.name || '-';
        document.getElementById('totalGrades').textContent = stats.total;

        // الرسوم البيانية
        renderBarChart('subjectChart', stats.subjectAvgs);
        renderTimelineChart('timelineChart', stats.timeline);

        // الجدول
        renderGrades();

        // تحميل آخر تحليل محفوظ
        const lastAnalysis = Storage.get('lastAnalysis', null);
        if (lastAnalysis) {
            const date = new Date(lastAnalysis.date);
            document.getElementById('aiAnalysisContent').innerHTML =
                `<p style="font-size:0.8rem;color:var(--text-light);margin-bottom:1rem">آخر تحليل: ${formatDateShort(lastAnalysis.date)}</p>` +
                formatAnalysis(lastAnalysis.content);
        }
    }

    function formatDateShort(dateStr) {
        const d = new Date(dateStr);
        return `${d.getDate()}/${d.getMonth() + 1}`;
    }

    // ==========================================
    // CRUD الدرجات
    // ==========================================
    function openGradeModal(gradeData = null) {
        const modal = document.getElementById('gradeModal');
        const form = document.getElementById('gradeForm');
        const title = document.getElementById('gradeModalTitle');

        if (gradeData) {
            title.textContent = 'تعديل الدرجة';
            document.getElementById('gradeSubject').value = gradeData.subject;
            document.getElementById('gradeType').value = gradeData.type;
            document.getElementById('gradeScore').value = gradeData.score;
            document.getElementById('gradeTotal').value = gradeData.total;
            document.getElementById('gradeDate').value = gradeData.date;
            document.getElementById('gradeNotes').value = gradeData.notes || '';
            document.getElementById('gradeId').value = gradeData.id;
            editingGradeId = gradeData.id;
        } else {
            title.textContent = 'إضافة درجة جديدة';
            form.reset();
            document.getElementById('gradeTotal').value = '100';
            document.getElementById('gradeDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('gradeId').value = '';
            editingGradeId = null;
        }

        modal.classList.add('active');
    }

    function saveGrade(e) {
        e.preventDefault();

        const gradeData = {
            id: editingGradeId || generateId(),
            subject: document.getElementById('gradeSubject').value.trim(),
            type: document.getElementById('gradeType').value,
            score: parseFloat(document.getElementById('gradeScore').value),
            total: parseFloat(document.getElementById('gradeTotal').value),
            date: document.getElementById('gradeDate').value,
            notes: document.getElementById('gradeNotes').value.trim()
        };

        let grades = getGrades();
        if (editingGradeId) {
            grades = grades.map(g => g.id === editingGradeId ? gradeData : g);
        } else {
            grades.push(gradeData);
        }

        saveGrades(grades);
        document.getElementById('gradeModal').classList.remove('active');
        updateAnalytics();
    }

    window.editGrade = function(id) {
        const grades = getGrades();
        const grade = grades.find(g => g.id === id);
        if (grade) openGradeModal(grade);
    };

    window.deleteGrade = function(id) {
        if (!confirm('هل تريد حذف هذه الدرجة؟')) return;
        let grades = getGrades();
        grades = grades.filter(g => g.id !== id);
        saveGrades(grades);
        updateAnalytics();
    };

    // ==========================================
    // 🚀 التهيئة
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('addGradeBtn').addEventListener('click', () => openGradeModal());

        document.getElementById('closeGradeModal').addEventListener('click', () => {
            document.getElementById('gradeModal').classList.remove('active');
        });
        document.getElementById('cancelGradeBtn').addEventListener('click', () => {
            document.getElementById('gradeModal').classList.remove('active');
        });

        document.getElementById('gradeForm').addEventListener('submit', saveGrade);

        document.getElementById('generateAnalysisBtn').addEventListener('click', generateAIAnalysis);

        updateAnalytics();
    });
})();
