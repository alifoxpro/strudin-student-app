// ==========================================
// ai-helper.js - المساعد الذكي (Groq API) + صوت
// ==========================================

(function() {
    let isProcessing = false;
    let recognition = null;
    let isRecording = false;
    let autoSpeak = true;
    let isSpeaking = false;
    let speechQueue = [];
    let currentAudio = null;

    // === النماذج المتاحة في Groq ===
    const GROQ_MODELS = [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (متعدد الاستخدام)' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (سريع)' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
    ];

    const DEFAULT_API_KEY = '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';

    function getApiKey() {
        const saved = Storage.get('groqApiKey', '');
        return saved && saved.trim() !== '' ? saved : DEFAULT_API_KEY;
    }

    function saveApiKey(key) {
        Storage.set('groqApiKey', key);
    }

    function getSelectedModel() {
        return Storage.get('groqModel', GROQ_MODELS[0].id);
    }

    function saveSelectedModel(model) {
        Storage.set('groqModel', model);
    }

    // ==========================================
    // 🎤 التعرف على الكلام (Speech-to-Text)
    // ==========================================
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            const micBtn = document.getElementById('micBtn');
            if (micBtn) micBtn.style.display = 'none';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let finalTranscript = '';

        recognition.onstart = () => {
            isRecording = true;
            finalTranscript = '';
            document.getElementById('micBtn').classList.add('recording');
            document.getElementById('voiceStatus').style.display = 'flex';
            document.getElementById('chatInput').placeholder = '🎤 تكلم الآن...';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }
            const chatInput = document.getElementById('chatInput');
            chatInput.value = finalTranscript + interimTranscript;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        };

        recognition.onerror = (event) => {
            stopRecording();
            if (event.error === 'not-allowed') {
                addMessage('bot', '❌ يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.');
            }
        };

        recognition.onend = () => {
            if (isRecording) {
                stopRecording();
                const chatInput = document.getElementById('chatInput');
                if (chatInput.value.trim()) {
                    sendMessage(chatInput.value.trim());
                }
            }
        };
    }

    function startRecording() {
        if (!recognition) {
            addMessage('bot', '❌ التعرف على الكلام غير مدعوم. جرب Google Chrome.');
            return;
        }
        stopSpeaking();
        try {
            document.getElementById('chatInput').value = '';
            recognition.start();
        } catch(e) {
            stopRecording();
        }
    }

    function stopRecording() {
        isRecording = false;
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
        }
        document.getElementById('micBtn').classList.remove('recording');
        document.getElementById('voiceStatus').style.display = 'none';
        document.getElementById('chatInput').placeholder = 'اكتب سؤالك أو اضغط 🎤 للتحدث...';
    }

    // ==========================================
    // 🔊 تحويل النص إلى كلام
    // يستخدم SpeechSynthesis إذا توفر صوت عربي
    // وإلا يفتح Google Translate لقراءة النص
    // ==========================================

    function speakText(text) {
        const cleanText = text
            .replace(/<[^>]*>/g, ' ')
            .replace(/[#*_`~\[\]()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) return;
        stopSpeaking();

        // تحقق إذا يوجد صوت عربي في المتصفح
        const synth = window.speechSynthesis;
        if (synth) {
            const voices = synth.getVoices();
            const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
            if (arabicVoice) {
                speakWithNativeVoice(cleanText, arabicVoice);
                return;
            }
        }

        // إذا لا يوجد صوت عربي - استخدم Google Translate popup
        speakWithGooglePopup(cleanText);
    }

    // === القراءة بصوت المتصفح (إذا توفر عربي) ===
    function speakWithNativeVoice(text, voice) {
        const synth = window.speechSynthesis;
        isSpeaking = true;
        updateAllSpeakButtons(true);

        const chunks = splitForTTS(text, 120);
        let idx = 0;

        function next() {
            if (idx >= chunks.length || !isSpeaking) {
                isSpeaking = false;
                updateAllSpeakButtons(false);
                return;
            }
            synth.cancel();
            const u = new SpeechSynthesisUtterance(chunks[idx]);
            u.voice = voice;
            u.lang = voice.lang;
            u.rate = 0.9;
            u.onend = () => { idx++; setTimeout(next, 100); };
            u.onerror = () => { idx++; setTimeout(next, 100); };
            synth.speak(u);
        }
        next();
    }

    // === القراءة عبر Google Translate (نافذة صغيرة) ===
    function speakWithGooglePopup(text) {
        // أخذ أول 500 حرف فقط
        const shortText = text.substring(0, 500);
        const encoded = encodeURIComponent(shortText);

        // فتح Google Translate مع النص - يقرأ تلقائياً عند الضغط على زر السماعة
        const url = 'https://translate.google.com/?sl=ar&tl=en&text=' + encoded + '&op=translate';

        // فتح نافذة صغيرة
        const popup = window.open(url, 'tts_popup', 'width=600,height=400,left=100,top=100,scrollbars=yes');

        isSpeaking = true;
        updateAllSpeakButtons(true);

        // عرض تعليمات للمستخدم
        showTTSHelp();

        // إيقاف الحالة بعد فترة
        setTimeout(() => {
            isSpeaking = false;
            updateAllSpeakButtons(false);
        }, 5000);
    }

    function showTTSHelp() {
        // عرض رسالة توجيهية
        const existing = document.getElementById('tts-help-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'tts-help-toast';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#4F46E5;color:white;padding:12px 24px;border-radius:12px;font-family:Tajawal;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);text-align:center;direction:rtl;max-width:90%;';
        toast.innerHTML = '🔊 تم فتح Google Translate — اضغط زر السماعة 🔈 لسماع النص بالعربي';
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 8000);
    }

    function splitForTTS(text, maxLen) {
        const result = [];
        const parts = text.split(/(?<=[.!?؟،:\n])\s*/);
        let current = '';
        for (const p of parts) {
            if ((current + ' ' + p).length > maxLen && current) {
                result.push(current.trim());
                current = p;
            } else {
                current += (current ? ' ' : '') + p;
            }
        }
        if (current.trim()) result.push(current.trim());
        return result.length ? result : [text.substring(0, maxLen)];
    }

    function stopSpeaking() {
        isSpeaking = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        const toast = document.getElementById('tts-help-toast');
        if (toast) toast.remove();
        updateAllSpeakButtons(false);
    }

    function updateAllSpeakButtons(speaking) {
        document.querySelectorAll('.btn-speak').forEach(btn => {
            if (speaking) {
                btn.innerHTML = '🔊 جاري القراءة... (إيقاف)';
                btn.classList.add('speaking');
            } else {
                btn.innerHTML = '🔈 اسمع الرد';
                btn.classList.remove('speaking');
            }
        });
    }

    // ==========================================
    // 💬 إرسال واستقبال الرسائل
    // ==========================================
    async function sendMessage(message) {
        if (isProcessing || !message.trim()) return;

        const apiKey = getApiKey();

        addMessage('user', message);
        document.getElementById('chatInput').value = '';

        isProcessing = true;
        updateSendButton();
        const typingId = addTypingIndicator();

        try {
            const systemPrompt = `أنت مساعد دراسي ذكي للطلاب في المرحلة الثانوية. اسمك "ضوء القمر".
مهمتك مساعدة الطلاب في:
- شرح الدروس والمفاهيم بطريقة بسيطة وواضحة
- إنشاء أسئلة مراجعة واختبارات
- تلخيص المواضيع الدراسية
- تقديم نصائح دراسية فعّالة
- مساعدة في حل المسائل خطوة بخطوة

قواعد مهمة:
- استخدم اللغة العربية دائماً
- كن ودوداً ومشجعاً
- اشرح بطريقة بسيطة تناسب طلاب الثانوية
- استخدم أمثلة توضيحية
- إذا كان السؤال عن مسألة رياضية أو علمية، اشرح الحل خطوة بخطوة`;

            const messages = [
                { role: 'system', content: systemPrompt },
                ...getConversationHistory(message)
            ];

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: getSelectedModel(),
                    messages: messages,
                    max_tokens: 2048,
                    temperature: 0.7,
                    top_p: 0.9
                })
            });

            removeTypingIndicator(typingId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    addMessage('bot', '❌ مفتاح Groq API غير صحيح.');
                } else if (response.status === 429) {
                    addMessage('bot', '⏳ تم تجاوز الحد المسموح. انتظر قليلاً.');
                } else {
                    addMessage('bot', `❌ خطأ: ${error.error?.message || 'غير معروف'}`);
                }
                return;
            }

            const data = await response.json();
            const reply = data.choices[0].message.content;

            saveToHistory('user', message);
            saveToHistory('assistant', reply);

            addMessage('bot', formatMarkdown(reply), reply);

            // قراءة الرد بالصوت تلقائياً
            if (autoSpeak) {
                // تأخير بسيط ليظهر النص أولاً
                setTimeout(() => speakText(reply), 500);
            }

        } catch (error) {
            removeTypingIndicator(typingId);
            addMessage('bot', '❌ خطأ في الاتصال. تحقق من الإنترنت وحاول مرة أخرى.');
        } finally {
            isProcessing = false;
            updateSendButton();
        }
    }

    // === سجل المحادثة ===
    function getConversationHistory(currentMessage) {
        const history = Storage.get('chatHistory', []);
        const recent = history.slice(-10);
        const messages = recent.map(h => ({ role: h.role, content: h.content }));
        messages.push({ role: 'user', content: currentMessage });
        return messages;
    }

    function saveToHistory(role, content) {
        const history = Storage.get('chatHistory', []);
        history.push({ role, content, timestamp: new Date().toISOString() });
        if (history.length > 50) history.splice(0, history.length - 50);
        Storage.set('chatHistory', history);
    }

    // === إضافة رسالة ===
    function addMessage(type, content, rawText) {
        const container = document.getElementById('chatMessages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type === 'user' ? 'user-message' : 'bot-message'}`;

        let speakButton = '';
        if (type === 'bot' && rawText) {
            // حفظ النص الخام كـ data attribute
            const safeId = 'msg_' + Date.now();
            speakButton = `<button class="btn-speak" data-msg-id="${safeId}" onclick="window.__toggleSpeak('${safeId}')">🔈 اسمع الرد</button>`;
            // تخزين النص مؤقتاً
            if (!window.__msgTexts) window.__msgTexts = {};
            window.__msgTexts[safeId] = rawText;
        }

        msgDiv.innerHTML = `
            <div class="message-avatar">${type === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">
                ${type === 'user' ? escapeHtml(content) : content}
                ${speakButton}
            </div>
        `;

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    // دالة عامة لتبديل القراءة
    window.__toggleSpeak = function(msgId) {
        if (isSpeaking) {
            stopSpeaking();
        } else {
            const text = window.__msgTexts && window.__msgTexts[msgId];
            if (text) speakText(text);
        }
    };

    // === مؤشر الكتابة ===
    function addTypingIndicator() {
        const container = document.getElementById('chatMessages');
        const id = 'typing_' + Date.now();
        const div = document.createElement('div');
        div.className = 'message bot-message';
        div.id = id;
        div.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function updateSendButton() {
        document.getElementById('sendBtn').disabled = isProcessing;
    }

    // === تنسيق Markdown ===
    function formatMarkdown(text) {
        return text
            .replace(/### (.+)/g, '<h4>$1</h4>')
            .replace(/## (.+)/g, '<h3>$1</h3>')
            .replace(/# (.+)/g, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.85em">$1</code>')
            .replace(/^\- (.+)/gm, '<li>$1</li>')
            .replace(/^\d+\. (.+)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/<\/li><br><li>/g, '</li><li>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==========================================
    // 🚀 التهيئة
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const micBtn = document.getElementById('micBtn');

        // تهيئة التعرف على الكلام
        initSpeechRecognition();

        // اختبار الصوت عند أول ضغطة على الصفحة (مطلوب لسياسة المتصفح)
        document.addEventListener('click', function enableAudio() {
            const testAudio = new Audio();
            testAudio.volume = 0;
            testAudio.play().catch(() => {});
            document.removeEventListener('click', enableAudio);
        }, { once: true });

        // إرسال بالضغط على Enter
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(chatInput.value);
            }
        });

        sendBtn.addEventListener('click', () => sendMessage(chatInput.value));

        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });

        // 🎤 زر الميكروفون
        micBtn.addEventListener('click', () => {
            if (isRecording) stopRecording();
            else startRecording();
        });

        document.getElementById('voiceStopBtn').addEventListener('click', stopRecording);

        // أزرار الاقتراحات
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chatInput.value = btn.dataset.prompt + ' ';
                chatInput.focus();
            });
        });

        // إعدادات API
        document.getElementById('aiSettingsBtn').addEventListener('click', () => {
            const currentKey = Storage.get('groqApiKey', '');
            document.getElementById('apiKey').value = currentKey || DEFAULT_API_KEY;
            document.getElementById('groqModel').value = getSelectedModel();
            document.getElementById('autoSpeakToggle').checked = autoSpeak;
            document.getElementById('apiModal').classList.add('active');
        });

        document.getElementById('closeApiModal').addEventListener('click', () => {
            document.getElementById('apiModal').classList.remove('active');
        });

        document.getElementById('cancelApiBtn').addEventListener('click', () => {
            document.getElementById('apiModal').classList.remove('active');
        });

        document.getElementById('apiForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const key = document.getElementById('apiKey').value.trim();
            const model = document.getElementById('groqModel').value;
            autoSpeak = document.getElementById('autoSpeakToggle').checked;
            saveApiKey(key);
            saveSelectedModel(model);
            Storage.set('autoSpeak', autoSpeak);
            document.getElementById('apiModal').classList.remove('active');
            addMessage('bot', `✅ تم حفظ الإعدادات! القراءة التلقائية: <strong>${autoSpeak ? 'مفعّلة 🔊' : 'معطّلة 🔇'}</strong>`);
        });

        // تحميل إعداد القراءة التلقائية
        autoSpeak = Storage.get('autoSpeak', true);
    });
})();
