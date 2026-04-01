// ==========================================
// timer.js - مؤقت بومودورو للمذاكرة
// ==========================================

(function() {
    let timerInterval = null;
    let timeLeft = 25 * 60; // بالثواني
    let totalTime = 25 * 60;
    let isRunning = false;
    let isBreak = false;
    let sessionsCompleted = 0;
    const CIRCUMFERENCE = 2 * Math.PI * 90; // 565.48

    // نصائح المذاكرة
    const studyTips = [
        'ابتعد عن الجوال أثناء المذاكرة',
        'اشرب ماء كافي للحفاظ على تركيزك',
        'قسّم المادة إلى أجزاء صغيرة',
        'استخدم أسلوب التكرار المتباعد',
        'اكتب ملاحظات بيدك لتثبيت المعلومة',
        'اختبر نفسك بعد كل جلسة مذاكرة',
        'ذاكر في مكان هادئ وجيد الإضاءة',
        'ابدأ بالمواد الصعبة وأنت في قمة تركيزك',
        'خذ فترات راحة منتظمة',
        'نم جيداً قبل يوم الاختبار',
        'اشرح ما تعلمته لشخص آخر',
        'استخدم الخرائط الذهنية لتنظيم المعلومات',
        'راجع الملاحظات خلال 24 ساعة من الدرس',
        'تجنب المذاكرة المتواصلة لساعات طويلة',
        'كافئ نفسك بعد إنجاز كل هدف'
    ];

    // === تحديث العرض ===
    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;

        document.getElementById('timerMinutes').textContent = minutes.toString().padStart(2, '0');
        document.getElementById('timerSeconds').textContent = seconds.toString().padStart(2, '0');

        // تحديث الحلقة
        const progress = document.getElementById('timerProgress');
        const offset = CIRCUMFERENCE * (1 - timeLeft / totalTime);
        progress.style.strokeDasharray = CIRCUMFERENCE;
        progress.style.strokeDashoffset = offset;

        // تحديث اللون حسب النمط
        if (isBreak) {
            progress.classList.add('break');
            document.getElementById('timerLabel').textContent = 'وقت الراحة ☕';
        } else {
            progress.classList.remove('break');
            document.getElementById('timerLabel').textContent = 'وقت المذاكرة 📚';
        }
    }

    // === بدء المؤقت ===
    function startTimer() {
        if (isRunning) return;
        isRunning = true;

        document.getElementById('timerStart').style.display = 'none';
        document.getElementById('timerPause').style.display = 'inline-flex';

        timerInterval = setInterval(() => {
            timeLeft--;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                isRunning = false;

                // صوت تنبيه
                playNotificationSound();

                if (!isBreak) {
                    // انتهت جلسة المذاكرة
                    sessionsCompleted++;
                    logStudySession();
                    updateStats();

                    // بدء الراحة
                    isBreak = true;
                    const breakDuration = sessionsCompleted % 4 === 0 ?
                        parseInt(document.getElementById('longBreak').value) :
                        parseInt(document.getElementById('shortBreak').value);
                    timeLeft = breakDuration * 60;
                    totalTime = breakDuration * 60;

                    // إشعار
                    showNotification('أحسنت! 🎉', 'انتهت جلسة المذاكرة. خذ استراحة ' + breakDuration + ' دقائق');
                } else {
                    // انتهت الراحة
                    isBreak = false;
                    timeLeft = parseInt(document.getElementById('workDuration').value) * 60;
                    totalTime = timeLeft;

                    showNotification('وقت المذاكرة! 📚', 'انتهت الراحة. هيا نرجع نذاكر!');
                }

                document.getElementById('timerStart').style.display = 'inline-flex';
                document.getElementById('timerPause').style.display = 'none';
            }

            updateDisplay();
        }, 1000);
    }

    // === إيقاف مؤقت ===
    function pauseTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;

        document.getElementById('timerStart').style.display = 'inline-flex';
        document.getElementById('timerPause').style.display = 'none';
    }

    // === إعادة المؤقت ===
    function resetTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        isRunning = false;
        isBreak = false;

        timeLeft = parseInt(document.getElementById('workDuration').value) * 60;
        totalTime = timeLeft;

        document.getElementById('timerStart').style.display = 'inline-flex';
        document.getElementById('timerPause').style.display = 'none';

        updateDisplay();
    }

    // === تسجيل جلسة المذاكرة ===
    function logStudySession() {
        const studyLog = Storage.get('studyLog', []);
        const subject = document.getElementById('timerSubject').value.trim() || 'عام';
        const minutes = parseInt(document.getElementById('workDuration').value);
        const today = new Date().toISOString().split('T')[0];

        studyLog.push({
            date: today,
            subject: subject,
            minutes: minutes,
            timestamp: new Date().toISOString()
        });

        Storage.set('studyLog', studyLog);
    }

    // === تحديث الإحصائيات ===
    function updateStats() {
        const studyLog = Storage.get('studyLog', []);
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = studyLog.filter(s => s.date === today);

        document.getElementById('sessionsToday').textContent = todayLogs.length;
        document.getElementById('minutesToday').textContent = todayLogs.reduce((sum, s) => sum + s.minutes, 0);
    }

    // === صوت التنبيه ===
    function playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 1000;
                setTimeout(() => {
                    oscillator.frequency.value = 800;
                    setTimeout(() => {
                        oscillator.stop();
                        audioCtx.close();
                    }, 200);
                }, 200);
            }, 200);
        } catch(e) { /* صوت غير مدعوم */ }
    }

    // === إشعارات ===
    function showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
        }
    }

    // === عرض نصائح عشوائية ===
    function showRandomTips() {
        const container = document.getElementById('studyTips');
        const shuffled = [...studyTips].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, 3);

        container.innerHTML = selected.map(tip => `
            <p class="tip">💡 ${tip}</p>
        `).join('');
    }

    // === التهيئة ===
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('timerStart').addEventListener('click', startTimer);
        document.getElementById('timerPause').addEventListener('click', pauseTimer);
        document.getElementById('timerReset').addEventListener('click', resetTimer);

        // تحديث المؤقت عند تغيير المدة
        document.getElementById('workDuration').addEventListener('change', () => {
            if (!isRunning && !isBreak) {
                timeLeft = parseInt(document.getElementById('workDuration').value) * 60;
                totalTime = timeLeft;
                updateDisplay();
            }
        });

        // تهيئة العرض
        updateDisplay();
        updateStats();
        showRandomTips();

        // تحديث النصائح كل 30 ثانية
        setInterval(showRandomTips, 30000);
    });
})();
