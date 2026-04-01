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
    // 🔊 تحويل النص إلى كلام (Text-to-Speech)
    // يستخدم 3 طرق كنسخة احتياطية لضمان العمل
    // ==========================================

    // الطريقة الرئيسية: Web Speech API مع إصلاحات
    function speakText(text) {
        // تنظيف النص
        const cleanText = text
            .replace(/<[^>]*>/g, ' ')
            .replace(/[#*_`~\[\]()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanText) return;

        // إيقاف أي كلام سابق
        stopSpeaking();

        // جرب Web Speech API أولاً
        if (window.speechSynthesis) {
            speakWithWebAPI(cleanText);
        }
    }

    function speakWithWebAPI(text) {
        const synth = window.speechSynthesis;

        // إصلاح: بعض المتصفحات تحتاج cancel أولاً
        synth.cancel();

        isSpeaking = true;
        updateAllSpeakButtons(true);

        // تقسيم النص لأجزاء قصيرة (Chrome يتوقف بعد ~15 ثانية)
        const chunks = splitTextSmall(text, 150);
        let currentIndex = 0;

        function speakNext() {
            if (currentIndex >= chunks.length || !isSpeaking) {
                isSpeaking = false;
                updateAllSpeakButtons(false);
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[currentIndex]);
            utterance.lang = 'ar';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;

            // اختيار أفضل صوت عربي
            const voices = synth.getVoices();
            const arabicVoices = voices.filter(v =>
                v.lang.startsWith('ar') ||
                v.name.toLowerCase().includes('arab') ||
                v.name.toLowerCase().includes('arabic')
            );

            if (arabicVoices.length > 0) {
                // تفضيل الأصوات عالية الجودة
                const preferred = arabicVoices.find(v =>
                    v.name.includes('Google') ||
                    v.name.includes('Microsoft') ||
                    v.name.includes('Majed') ||
                    v.name.includes('Tarik') ||
                    v.name.includes('Hoda')
                ) || arabicVoices[0];
                utterance.voice = preferred;
                utterance.lang = preferred.lang;
            }

            utterance.onend = () => {
                currentIndex++;
                // تأخير صغير بين الأجزاء لتجنب مشاكل Chrome
                setTimeout(speakNext, 100);
            };

            utterance.onerror = (e) => {
                console.warn('TTS error:', e.error);
                // محاولة الجزء التالي
                currentIndex++;
                setTimeout(speakNext, 100);
            };

            synth.speak(utterance);

            // إصلاح Chrome: يتوقف بعد 15 ثانية - نعيد التشغيل
            if (chunks[currentIndex].length > 50) {
                startChromeKeepAlive();
            }
        }

        // انتظر تحميل الأصوات
        if (synth.getVoices().length === 0) {
            synth.onvoiceschanged = () => {
                synth.onvoiceschanged = null;
                speakNext();
            };
            // fallback إذا لم يتم تحميل الأصوات خلال ثانية
            setTimeout(() => {
                if (currentIndex === 0) speakNext();
            }, 1000);
        } else {
            speakNext();
        }
    }

    // إصلاح مشكلة Chrome المعروفة: التوقف بعد 15 ثانية
    let chromeTimer = null;
    function startChromeKeepAlive() {
        clearInterval(chromeTimer);
        chromeTimer = setInterval(() => {
            if (window.speechSynthesis && window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            } else {
                clearInterval(chromeTimer);
            }
        }, 10000);
    }

    function splitTextSmall(text, maxLen) {
        const chunks = [];
        // تقسيم على النقاط والفواصل أولاً
        const parts = text.split(/(?<=[.!?؟،:\n])\s*/);
        let current = '';

        for (const part of parts) {
            if ((current + ' ' + part).length > maxLen && current) {
                chunks.push(current.trim());
                current = part;
            } else {
                current += (current ? ' ' : '') + part;
            }
        }
        if (current.trim()) chunks.push(current.trim());

        // إذا لا يزال هناك أجزاء طويلة، قسمها بالمسافات
        const finalChunks = [];
        for (const chunk of chunks) {
            if (chunk.length > maxLen) {
                const words = chunk.split(' ');
                let c = '';
                for (const w of words) {
                    if ((c + ' ' + w).length > maxLen && c) {
                        finalChunks.push(c.trim());
                        c = w;
                    } else {
                        c += (c ? ' ' : '') + w;
                    }
                }
                if (c.trim()) finalChunks.push(c.trim());
            } else {
                finalChunks.push(chunk);
            }
        }

        return finalChunks.length ? finalChunks : [text];
    }

    function stopSpeaking() {
        isSpeaking = false;
        clearInterval(chromeTimer);
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
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

        // تحميل الأصوات مبكراً
        if (window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => {
                const voices = window.speechSynthesis.getVoices();
                const arabic = voices.filter(v => v.lang.startsWith('ar'));
                console.log('أصوات عربية متاحة:', arabic.map(v => v.name + ' (' + v.lang + ')'));
            };
        }

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
