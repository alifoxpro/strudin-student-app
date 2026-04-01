// ==========================================
// ai-helper.js - المساعد الذكي (Groq API) + صوت
// ==========================================

(function() {
    let isProcessing = false;
    let recognition = null;
    let isRecording = false;
    let speechSynth = window.speechSynthesis;
    let currentUtterance = null;
    let autoSpeak = true; // قراءة الرد تلقائياً

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
            console.warn('Speech Recognition غير مدعوم في هذا المتصفح');
            const micBtn = document.getElementById('micBtn');
            if (micBtn) {
                micBtn.style.display = 'none';
            }
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA'; // العربية السعودية
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let finalTranscript = '';
        let interimTranscript = '';

        recognition.onstart = () => {
            isRecording = true;
            document.getElementById('micBtn').classList.add('recording');
            document.getElementById('voiceStatus').style.display = 'flex';
            document.getElementById('chatInput').placeholder = '🎤 تكلم الآن...';
            finalTranscript = '';
        };

        recognition.onresult = (event) => {
            interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }

            // عرض النص أثناء التحدث
            const chatInput = document.getElementById('chatInput');
            chatInput.value = finalTranscript + interimTranscript;
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();

            if (event.error === 'no-speech') {
                // لم يتم اكتشاف كلام
            } else if (event.error === 'not-allowed') {
                addMessage('bot', '❌ يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.');
            } else if (event.error === 'network') {
                addMessage('bot', '❌ خطأ في الشبكة. تحقق من اتصال الإنترنت.');
            }
        };

        recognition.onend = () => {
            if (isRecording) {
                stopRecording();
                // إرسال تلقائي إذا كان هناك نص
                const chatInput = document.getElementById('chatInput');
                if (chatInput.value.trim()) {
                    sendMessage(chatInput.value.trim());
                }
            }
        };
    }

    function startRecording() {
        if (!recognition) {
            addMessage('bot', '❌ التعرف على الكلام غير مدعوم في متصفحك. جرب Google Chrome.');
            return;
        }

        // إيقاف القراءة الصوتية إذا كانت تعمل
        stopSpeaking();

        try {
            finalTranscript = '';
            document.getElementById('chatInput').value = '';
            recognition.start();
        } catch(e) {
            // قد يكون يعمل بالفعل
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
    // 🔊 تحويل النص إلى كلام (Text-to-Speech)
    // ==========================================
    function speakText(text) {
        if (!speechSynth) return;

        // إيقاف أي كلام سابق
        stopSpeaking();

        // تنظيف النص من HTML والرموز
        const cleanText = text
            .replace(/<[^>]*>/g, ' ')
            .replace(/[#*_`~]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) return;

        // تقسيم النص الطويل إلى أجزاء (المتصفح قد يتوقف مع النصوص الطويلة)
        const chunks = splitTextToChunks(cleanText, 200);
        speakChunks(chunks, 0);
    }

    function splitTextToChunks(text, maxLength) {
        const chunks = [];
        const sentences = text.split(/(?<=[.!?،؟\n])\s*/);
        let current = '';

        for (const sentence of sentences) {
            if ((current + ' ' + sentence).length > maxLength && current) {
                chunks.push(current.trim());
                current = sentence;
            } else {
                current += ' ' + sentence;
            }
        }
        if (current.trim()) chunks.push(current.trim());
        return chunks.length ? chunks : [text];
    }

    function speakChunks(chunks, index) {
        if (index >= chunks.length) {
            updateSpeakButtons(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        // محاولة اختيار صوت عربي
        const voices = speechSynth.getVoices();
        const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arabicVoice) {
            utterance.voice = arabicVoice;
        }

        utterance.onend = () => {
            speakChunks(chunks, index + 1);
        };

        utterance.onerror = () => {
            updateSpeakButtons(false);
        };

        currentUtterance = utterance;
        updateSpeakButtons(true);
        speechSynth.speak(utterance);
    }

    function stopSpeaking() {
        if (speechSynth) {
            speechSynth.cancel();
        }
        currentUtterance = null;
        updateSpeakButtons(false);
    }

    function updateSpeakButtons(isSpeaking) {
        document.querySelectorAll('.btn-speak').forEach(btn => {
            btn.classList.toggle('speaking', isSpeaking);
            if (isSpeaking) {
                btn.innerHTML = '🔊 جاري القراءة... (اضغط للإيقاف)';
            } else {
                btn.innerHTML = '🔈 اسمع الرد';
            }
        });
    }

    // ==========================================
    // 💬 إرسال واستقبال الرسائل
    // ==========================================
    async function sendMessage(message) {
        if (isProcessing || !message.trim()) return;

        const apiKey = getApiKey();

        // إضافة رسالة المستخدم
        addMessage('user', message);
        document.getElementById('chatInput').value = '';

        // عرض مؤشر الكتابة
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
                    addMessage('bot', '❌ مفتاح Groq API غير صحيح. يرجى التحقق من المفتاح في إعدادات API.');
                } else if (response.status === 429) {
                    addMessage('bot', '⏳ تم تجاوز الحد المسموح. يرجى الانتظار قليلاً والمحاولة مرة أخرى.');
                } else if (response.status === 503) {
                    addMessage('bot', '⏳ الخادم مشغول حالياً. جرب مرة أخرى بعد لحظات.');
                } else {
                    addMessage('bot', `❌ حدث خطأ: ${error.error?.message || 'خطأ غير معروف'}`);
                }
                return;
            }

            const data = await response.json();
            const reply = data.choices[0].message.content;

            // حفظ في سجل المحادثة
            saveToHistory('user', message);
            saveToHistory('assistant', reply);

            addMessage('bot', formatMarkdown(reply), reply);

            // قراءة الرد تلقائياً
            if (autoSpeak) {
                speakText(reply);
            }

        } catch (error) {
            removeTypingIndicator(typingId);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                addMessage('bot', '❌ لا يمكن الاتصال بالخادم. تحقق من اتصال الإنترنت.');
            } else {
                addMessage('bot', '❌ حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.');
            }
        } finally {
            isProcessing = false;
            updateSendButton();
        }
    }

    // === سجل المحادثة ===
    function getConversationHistory(currentMessage) {
        const history = Storage.get('chatHistory', []);
        const recent = history.slice(-10);
        const messages = recent.map(h => ({
            role: h.role,
            content: h.content
        }));
        messages.push({ role: 'user', content: currentMessage });
        return messages;
    }

    function saveToHistory(role, content) {
        const history = Storage.get('chatHistory', []);
        history.push({ role, content, timestamp: new Date().toISOString() });
        if (history.length > 50) history.splice(0, history.length - 50);
        Storage.set('chatHistory', history);
    }

    // === إضافة رسالة للمحادثة ===
    function addMessage(type, content, rawText) {
        const container = document.getElementById('chatMessages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type === 'user' ? 'user-message' : 'bot-message'}`;

        let speakButton = '';
        if (type === 'bot' && rawText) {
            speakButton = `<button class="btn-speak" onclick="window.__speakText(this, \`${rawText.replace(/`/g, "'").replace(/\\/g, "\\\\")}\`)">🔈 اسمع الرد</button>`;
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

    // دالة عامة للقراءة من الأزرار
    window.__speakText = function(btn, text) {
        if (speechSynth.speaking) {
            stopSpeaking();
        } else {
            speakText(text);
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

    // === تنسيق Markdown بسيط ===
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
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
            ;
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

        // تحميل الأصوات (بعض المتصفحات تحتاج وقت)
        if (speechSynth) {
            speechSynth.getVoices();
            speechSynth.onvoiceschanged = () => speechSynth.getVoices();
        }

        // إرسال بالضغط على Enter
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(chatInput.value);
            }
        });

        // زر الإرسال
        sendBtn.addEventListener('click', () => {
            sendMessage(chatInput.value);
        });

        // تكبير حقل الإدخال تلقائياً
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });

        // 🎤 زر الميكروفون
        micBtn.addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });

        // زر إيقاف التسجيل
        document.getElementById('voiceStopBtn').addEventListener('click', () => {
            stopRecording();
        });

        // أزرار الاقتراحات
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chatInput.value = btn.dataset.prompt + ' ';
                chatInput.focus();
            });
        });

        // إعدادات API
        document.getElementById('aiSettingsBtn').addEventListener('click', () => {
            document.getElementById('apiKey').value = getApiKey();
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
            if (key) {
                const modelName = GROQ_MODELS.find(m => m.id === model)?.name || model;
                addMessage('bot', `✅ تم حفظ الإعدادات بنجاح!<br>النموذج: <strong>${modelName}</strong><br>القراءة التلقائية: <strong>${autoSpeak ? 'مفعّلة 🔊' : 'معطّلة 🔇'}</strong>`);
            } else {
                addMessage('bot', '⚠️ تم حذف مفتاح API.');
            }
        });

        // تحميل إعداد القراءة التلقائية
        const savedAutoSpeak = Storage.get('autoSpeak', true);
        autoSpeak = savedAutoSpeak;
    });
})();
