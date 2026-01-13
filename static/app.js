/**
 * AI Diary Application - Frontend JavaScript
 */

class AIDiary {
    constructor() {
        this.sessionId = null;
        this.isSessionActive = false;

        // DOM Elements
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.btnSend = document.getElementById('btnSend');
        this.btnStart = document.getElementById('btnStart');
        this.btnEndSession = document.getElementById('btnEndSession');
        this.inputContainer = document.getElementById('inputContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');

        // Modal Elements
        this.summaryModal = document.getElementById('summaryModal');
        this.historyModal = document.getElementById('historyModal');
        this.summaryText = document.getElementById('summaryText');
        this.emotionTags = document.getElementById('emotionTags');
        this.imageSection = document.getElementById('imageSection');
        this.imageGenerateSection = document.getElementById('imageGenerateSection');
        this.generatedImage = document.getElementById('generatedImage');
        this.styleSelect = document.getElementById('styleSelect');
        this.regenerateStyleSelect = document.getElementById('regenerateStyleSelect');
        this.imageGallery = document.getElementById('imageGallery');
        this.diaryList = document.getElementById('diaryList');

        // Image gallery state
        this.imagePaths = [];
        this.selectedImageIndex = 0;

        // BGM Elements
        this.bgmSection = document.getElementById('bgmSection');
        this.bgmGenerateSection = document.getElementById('bgmGenerateSection');
        this.bgmPlayer = document.getElementById('bgmPlayer');
        this.bgmCount = 0;

        // Custom Alert
        this.customAlert = document.getElementById('customAlert');
        this.alertMessage = document.getElementById('alertMessage');
        this.btnAlertClose = document.getElementById('alertClose');
        this.btnThemeToggle = document.getElementById('btnThemeToggle');

        // Custom Confirm
        this.customConfirm = document.getElementById('customConfirm');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.btnConfirmOk = document.getElementById('confirmOk');
        this.btnConfirmCancel = document.getElementById('confirmCancel');
        this.confirmCallback = null;
        this.currentCalendarDate = new Date();
        this.selectedDateStr = null;
        this.diariesByDate = {};
        this.isPickerOpen = false;
        this.pickerYear = new Date().getFullYear();

        this.init();
        this.initTheme();
    }

    init() {
        // Event Listeners
        this.btnStart.addEventListener('click', () => this.startSession());
        this.btnSend.addEventListener('click', () => this.sendMessage());
        this.btnEndSession.addEventListener('click', () => this.endSession());

        this.messageInput.addEventListener('input', () => this.autoResize());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Modal controls - X button/Save logic
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal(this.summaryModal));
        document.getElementById('historyModalClose').addEventListener('click', () => this.closeModal(this.historyModal));
        document.getElementById('btnHistory').addEventListener('click', () => this.showHistory());
        document.getElementById('btnNewDiary').addEventListener('click', () => this.startNewDiary());
        document.getElementById('btnResetSession').addEventListener('click', () => {
            this.showConfirm('대화 내용을 모두 지우고 새로 시작하시겠습니까?', () => {
                this.startNewDiary();
            });
        });
        document.getElementById('btnGenerateImage').addEventListener('click', () => this.generateImage());
        document.getElementById('btnRegenerateImage').addEventListener('click', () => this.regenerateImage());
        document.getElementById('btnGenerateBGM').addEventListener('click', () => this.generateBGM());
        document.getElementById('btnUpdateSummary').addEventListener('click', () => this.updateSummary());
        document.getElementById('btnSaveDiary').addEventListener('click', () => {
            this.isSessionActive = false; // Mark session as inactive on save
            this.showAlert('✅ 일기가 성공적으로 저장되었습니다!');
            // 저장 성공 메시지를 보여준 후 1.5초 뒤에 모달을 닫고 새 일기 시작
            setTimeout(() => {
                this.startNewDiary();
                this.closeModal(this.customAlert);
            }, 1500);
        });
        this.btnAlertClose.addEventListener('click', () => this.closeModal(this.customAlert));

        this.btnConfirmOk.addEventListener('click', () => {
            if (this.confirmCallback) this.confirmCallback();
            this.closeModal(this.customConfirm);
        });
        this.btnConfirmCancel.addEventListener('click', () => this.closeModal(this.customConfirm));

        this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());

        // Summary modal backdrop click just closes (keep conversation alive)
        this.summaryModal.addEventListener('click', (e) => {
            if (e.target === this.summaryModal) this.closeModal(this.summaryModal);
        });

        // Other modals backdrop click just closes
        this.historyModal.addEventListener('click', (e) => {
            if (e.target === this.historyModal) this.closeModal(this.historyModal);
        });

        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));

        // Picker toggle
        const calendarTitle = document.getElementById('calendarTitle');
        calendarTitle.classList.add('clickable');
        calendarTitle.addEventListener('click', () => this.togglePicker());
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    }

    toggleTheme() {
        const isLight = document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
        this.btnSend.disabled = !this.messageInput.value.trim();
    }

    showLoading(text = '잠시만 기다려주세요...') {
        this.loadingText.textContent = text;
        this.loadingOverlay.classList.add('active');
    }

    hideLoading() {
        this.loadingOverlay.classList.remove('active');
    }

    async startSession(dateStr = null) {
        this.showLoading('대화를 준비하고 있어요...');

        try {
            const response = await fetch('/api/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: dateStr })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || '세션 생성에 실패했습니다.');
            }

            const data = await response.json();
            this.sessionId = data.session_id;
            this.isSessionActive = true;

            // Clear welcome message and show chat
            this.chatMessages.innerHTML = '';
            this.inputContainer.style.display = 'block';

            // Add AI greeting
            this.addMessage('assistant', data.message);
            this.messageInput.focus();

            // Close history modal if open
            if (this.historyModal.classList.contains('active')) {
                this.closeModal(this.historyModal);
            }

        } catch (error) {
            console.error('Error starting session:', error);
            // Show the actual error message from server
            this.showAlert(error.message);
        } finally {
            this.hideLoading();
        }
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isSessionActive) return;

        // Add user message
        this.addMessage('user', message);
        this.messageInput.value = '';
        this.autoResize();
        this.btnSend.disabled = true;

        // Show typing indicator
        const typingId = this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    message: message
                })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const data = await response.json();

            // Remove typing indicator and add response
            this.removeTypingIndicator(typingId);
            this.addMessage('assistant', data.message);

            // Check if session should end
            if (data.is_complete) {
                this.showEndSessionPrompt();
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.removeTypingIndicator(typingId);
            this.addMessage('assistant', '죄송해요, 응답을 받지 못했어요. 다시 시도해주세요.');
        }
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatar = role === 'assistant' ? '✨' : '👤';

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${this.formatMessage(content)}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatMessage(content) {
        // Basic markdown-like formatting
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = id;
        typingDiv.className = 'message assistant';
        typingDiv.innerHTML = `
            <div class="message-avatar">✨</div>
            <div class="message-content typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
        return id;
    }

    removeTypingIndicator(id) {
        const element = document.getElementById(id);
        if (element) element.remove();
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showEndSessionPrompt() {
        // Highlight end session button
        this.btnEndSession.style.background = 'var(--gradient-primary)';
        this.btnEndSession.style.color = 'white';
        this.btnEndSession.style.borderColor = 'transparent';
    }

    async endSession() {
        if (!this.sessionId) return;

        this.showLoading('오늘의 일기를 정리하고 있어요...');

        try {
            const response = await fetch('/api/session/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: this.sessionId })
            });

            if (!response.ok) throw new Error('Failed to end session');

            const data = await response.json();
            // this.isSessionActive = false; // Keep session active to allow more conversation

            // Show summary modal
            this.showSummaryModal(data);

        } catch (error) {
            console.error('Error ending session:', error);
            this.showAlert('일기 정리에 실패했습니다. 다시 시도해주세요.');
        } finally {
            this.hideLoading();
        }
    }

    showSummaryModal(data) {
        const summary = data.summary || {};

        // Set summary text (textarea value)
        this.summaryText.value = summary.summary || '요약을 생성할 수 없었습니다.';

        // Set emotion tags
        this.emotionTags.innerHTML = '';
        const tags = summary.emotion_tags || [];
        tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'emotion-tag';
            tagEl.textContent = `#${tag}`;
            this.emotionTags.appendChild(tagEl);
        });

        // Reset image sections
        this.imageSection.style.display = 'none';
        this.imageGenerateSection.style.display = 'block';
        this.imagePaths = [];
        this.selectedImageIndex = 0;
        this.imageGallery.innerHTML = '';
        this.imageGallery.style.display = 'none';

        // Reset BGM sections
        this.bgmSection.style.display = 'none';
        this.bgmGenerateSection.style.display = 'block';
        this.bgmCount = 0;

        // Show modal
        this.summaryModal.classList.add('active');
    }

    showAlert(message) {
        this.alertMessage.textContent = message;
        this.customAlert.classList.add('active');
    }

    showConfirm(message, callback) {
        this.confirmMessage.textContent = message;
        this.confirmCallback = callback;
        this.customConfirm.classList.add('active');
    }

    async generateImage() {
        if (!this.sessionId) return;

        const btn = document.getElementById('btnGenerateImage');
        this.showLoading('이미지를 생성하고 있어요...');
        btn.disabled = true;
        btn.textContent = '🎨 이미지 생성 중...';

        try {
            const response = await fetch('/api/image/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    style: this.styleSelect.value
                })
            });

            const data = await response.json();

            if (data.success && data.image_paths) {
                // Update gallery state
                this.imagePaths = data.image_paths;
                this.selectedImageIndex = data.selected_image_index;
                // Show generated image
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?t=${Date.now()}`;
                this.imageSection.style.display = 'block';
                this.imageGenerateSection.style.display = 'none';
                this.renderGallery();
            } else {
                this.showAlert(data.message || '이미지 생성에 실패했습니다.');
            }

        } catch (error) {
            console.error('Error generating image:', error);
            this.showAlert('이미지 생성에 실패했습니다.');
        } finally {
            this.hideLoading();
            btn.disabled = false;
            btn.textContent = '🎨 이미지 생성하기';
        }
    }

    async regenerateImage() {
        if (!this.sessionId) return;

        // 최대 6개 이미지 제한
        const MAX_IMAGES = 6;
        if (this.imagePaths.length >= MAX_IMAGES) {
            this.showAlert(`한 일기당 최대 ${MAX_IMAGES}개의 이미지만 생성할 수 있습니다.`);
            return;
        }

        const btn = document.getElementById('btnRegenerateImage');
        this.showLoading('새 이미지를 생성하고 있어요...');
        btn.disabled = true;
        btn.textContent = '🔄 생성 중...';

        try {
            const response = await fetch('/api/image/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    style: this.regenerateStyleSelect.value
                })
            });

            const data = await response.json();

            if (data.success && data.image_paths) {
                // Update gallery with all images
                this.imagePaths = data.image_paths;
                this.selectedImageIndex = data.selected_image_index;
                this.renderGallery();
                // Update main image
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?t=${Date.now()}`;
            } else {
                this.showAlert(data.message || '이미지 생성에 실패했습니다.');
            }

        } catch (error) {
            console.error('Error regenerating image:', error);
            this.showAlert('이미지 생성에 실패했습니다.');
        } finally {
            this.hideLoading();
            btn.disabled = false;
            btn.textContent = '🔄 새 이미지 생성하기';
        }
    }

    renderGallery() {
        this.imageGallery.innerHTML = '';

        if (this.imagePaths.length <= 1) {
            this.imageGallery.style.display = 'none';
            return;
        }

        this.imageGallery.style.display = 'flex';

        this.imagePaths.forEach((path, index) => {
            const thumb = document.createElement('div');
            thumb.className = `gallery-thumbnail ${index === this.selectedImageIndex ? 'selected' : ''}`;
            thumb.innerHTML = `<img src="/api/diaries/${this.sessionId}/image?index=${index}&t=${Date.now()}" alt="이미지 ${index + 1}">`;
            thumb.addEventListener('click', () => this.selectImage(index));
            this.imageGallery.appendChild(thumb);
        });
    }

    async selectImage(index) {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/image/select/${this.sessionId}/${index}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.selectedImageIndex = data.selected_image_index;
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?index=${index}&t=${Date.now()}`;
                this.renderGallery();
            }
        } catch (error) {
            console.error('Error selecting image:', error);
        }
    }

    async generateBGM() {
        if (!this.sessionId) return;

        // 최대 2개 BGM 제한
        const MAX_BGM = 2;
        if (this.bgmCount >= MAX_BGM) {
            this.showAlert(`한 일기당 최대 ${MAX_BGM}개의 BGM만 생성할 수 있습니다.`);
            return;
        }

        const btn = document.getElementById('btnGenerateBGM');
        this.showLoading('BGM을 생성하고 있어요... (약 1-2분 소요)');
        btn.disabled = true;
        btn.textContent = '🎵 BGM 생성 중...';

        try {
            const response = await fetch('/api/bgm/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });

            const data = await response.json();

            if (data.success && data.bgm_path) {
                // Show generated BGM
                this.bgmPlayer.src = `/api/diaries/${this.sessionId}/bgm?t=${Date.now()}`;
                this.bgmSection.style.display = 'block';
                this.bgmGenerateSection.style.display = 'none';
                this.bgmCount++;
            } else {
                this.showAlert(data.message || 'BGM 생성에 실패했습니다.');
            }

        } catch (error) {
            console.error('Error generating BGM:', error);
            this.showAlert('BGM 생성에 실패했습니다.');
        } finally {
            this.hideLoading();
            btn.disabled = false;
            btn.textContent = '🎵 BGM 생성하기';
        }
    }

    async updateSummary() {
        if (!this.sessionId) return;

        const newSummary = this.summaryText.value.trim();
        if (!newSummary) {
            this.showAlert('요약 내용을 입력해주세요.');
            return;
        }

        const btn = document.getElementById('btnUpdateSummary');
        btn.disabled = true;
        btn.textContent = '✨ 태그 재생성 중...';

        try {
            const response = await fetch('/api/summary/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    summary: newSummary
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update emotion tags
                this.emotionTags.innerHTML = '';
                (data.emotion_tags || []).forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'emotion-tag';
                    tagEl.textContent = `#${tag}`;
                    this.emotionTags.appendChild(tagEl);
                });

                // Show success message briefly
                btn.textContent = '✅ 완료!';
                setTimeout(() => {
                    btn.textContent = '✨ 태그 재생성하기';
                }, 1500);
            } else {
                this.showAlert(data.message || '태그 재생성에 실패했습니다.');
            }

        } catch (error) {
            console.error('Error updating summary:', error);
            this.showAlert('태그 재생성에 실패했습니다.');
        } finally {
            btn.disabled = false;
            if (btn.textContent !== '✅ 완료!') {
                btn.textContent = '✨ 태그 재생성하기';
            }
        }
    }


    startNewDiary() {
        this.closeModal(this.summaryModal);
        this.sessionId = null;
        this.isSessionActive = false;

        // Reset UI
        this.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">✨</div>
                <h2>오늘 하루는 어떠셨나요?</h2>
                <p>시작 버튼을 눌러 AI와 함께 오늘 하루를 돌아보세요.</p>
                <button class="btn-start" id="btnStart">대화 시작하기</button>
            </div>
        `;
        this.inputContainer.style.display = 'none';
        this.btnEndSession.style = '';

        // Re-attach start button listener
        document.getElementById('btnStart').addEventListener('click', () => this.startSession());
    }

    async showHistory() {
        this.showLoading('일기 목록을 불러오고 있어요...');

        try {
            const response = await fetch('/api/diaries');
            if (!response.ok) throw new Error('Failed to load diaries');

            const data = await response.json();
            this.diariesByDate = this.groupDiariesByDate(data);

            // Default to today or most recent date
            this.currentCalendarDate = new Date();
            this.renderCalendar();

            const todayStr = this.formatDateKey(new Date());
            if (this.diariesByDate[todayStr]) {
                this.renderDiaryListByDate(todayStr);
            } else {
                // Find most recent date with diaries
                const dates = Object.keys(this.diariesByDate).sort().reverse();
                if (dates.length > 0) {
                    this.renderDiaryListByDate(dates[0]);
                } else {
                    this.diaryList.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">📝</div>
                            <p>아직 작성한 일기가 없어요.</p>
                        </div>
                    `;
                }
            }

            this.historyModal.classList.add('active');

        } catch (error) {
            console.error('Error loading history:', error);
            this.showAlert('일기 목록을 불러오는데 실패했습니다.');
        } finally {
            this.hideLoading();
        }
    }

    groupDiariesByDate(diaries) {
        const groups = {};
        diaries.forEach(diary => {
            const dateStr = this.formatDateKey(new Date(diary.created_at));
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(diary);
        });
        return groups;
    }

    formatDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    changeMonth(delta) {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + delta);
        this.renderCalendar();
    }

    togglePicker() {
        this.isPickerOpen = !this.isPickerOpen;
        if (this.isPickerOpen) {
            this.pickerYear = this.currentCalendarDate.getFullYear();
            this.showPicker();
        } else {
            this.hidePicker();
        }
    }

    showPicker() {
        let picker = document.getElementById('calendarPicker');
        if (!picker) {
            picker = document.createElement('div');
            picker.id = 'calendarPicker';
            picker.className = 'calendar-picker';
            document.querySelector('.history-sidebar').appendChild(picker);
        }
        picker.classList.add('active');
        this.renderPicker();
    }

    hidePicker() {
        const picker = document.getElementById('calendarPicker');
        if (picker) picker.classList.remove('active');
        this.isPickerOpen = false;
    }

    renderPicker() {
        const picker = document.getElementById('calendarPicker');
        if (!picker) return;

        picker.innerHTML = `
            <div class="picker-header">
                <button id="pickerPrevYear">&lt;</button>
                <span>${this.pickerYear}년</span>
                <button id="pickerNextYear">&gt;</button>
            </div>
            <div class="picker-months">
                ${Array.from({ length: 12 }, (_, i) => `
                    <div class="picker-month ${this.isCurrentMonth(i) ? 'active' : ''}" data-month="${i}">${i + 1}월</div>
                `).join('')}
            </div>
        `;

        // Picker events
        picker.querySelector('#pickerPrevYear').addEventListener('click', (e) => {
            e.stopPropagation();
            this.pickerYear--;
            this.renderPicker();
        });
        picker.querySelector('#pickerNextYear').addEventListener('click', (e) => {
            e.stopPropagation();
            this.pickerYear++;
            this.renderPicker();
        });
        picker.querySelectorAll('.picker-month').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const month = parseInt(el.dataset.month);
                this.currentCalendarDate.setFullYear(this.pickerYear);
                this.currentCalendarDate.setMonth(month);
                this.hidePicker();
                this.renderCalendar();
            });
        });
    }

    isCurrentMonth(month) {
        return this.currentCalendarDate.getFullYear() === this.pickerYear &&
            this.currentCalendarDate.getMonth() === month;
    }

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const title = document.getElementById('calendarTitle');
        grid.innerHTML = '';

        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();

        title.textContent = `${year}년 ${month + 1}월`;

        // Get first day of month and total days
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        // Previous month filler
        const prevMonthLastDate = new Date(year, month, 0).getDate();
        for (let i = firstDay - 1; i >= 0; i--) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day not-current';
            dayEl.textContent = prevMonthLastDate - i;
            grid.appendChild(dayEl);
        }

        // Current month days
        for (let i = 1; i <= lastDate; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = i;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            if (this.diariesByDate[dateStr]) {
                dayEl.classList.add('has-diary');
            }

            if (this.selectedDateStr === dateStr) {
                dayEl.classList.add('active');
            }

            dayEl.addEventListener('click', () => {
                this.selectedDateStr = dateStr;
                this.renderCalendar();
                this.renderDiaryListByDate(dateStr);
            });

            grid.appendChild(dayEl);
        }

        // Next month filler
        const totalCells = firstDay + lastDate;
        const remainingCells = 42 - totalCells; // 6 weeks
        for (let i = 1; i <= remainingCells; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day not-current';
            dayEl.textContent = i;
            grid.appendChild(dayEl);
        }
    }

    renderDiaryListByDate(dateStr) {
        const diaries = this.diariesByDate[dateStr] || [];
        this.diaryList.innerHTML = '';

        // Format date for title
        const dateObj = new Date(dateStr);
        const formattedDate = dateObj.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        document.getElementById('selectedDateTitle').textContent = `${formattedDate}의 일기`;

        // Add "Write Diary on this date" button if less than 2 diaries
        if (diaries.length < 2) {
            const writeBtnSection = document.createElement('div');
            writeBtnSection.className = 'history-write-section';
            writeBtnSection.innerHTML = `
                <button class="btn-write-on-date" id="btnWriteOnDate">
                    <span>✍️</span> ${formattedDate} 일기 작성하기 (${diaries.length}/2)
                </button>
            `;
            this.diaryList.appendChild(writeBtnSection);

            document.getElementById('btnWriteOnDate').addEventListener('click', () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const selectedDate = new Date(dateStr);

                if (selectedDate > today) {
                    this.showAlert('미래의 일기는 아직 작성할 수 없습니다. 😊');
                    return;
                }
                this.startSession(dateStr);
            });
        }

        if (diaries.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = '<p>이 날짜에 작성된 일기가 없습니다.</p>';
            this.diaryList.appendChild(emptyState);
            return;
        }

        diaries.forEach(diary => {
            const item = this.createDiaryItem(diary);
            this.diaryList.appendChild(item);
        });

        this.diaryList.scrollTop = 0;
    }

    createDiaryItem(diary) {
        const date = new Date(diary.created_at);
        const formattedDate = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });

        const item = document.createElement('div');
        item.className = 'diary-item';
        item.innerHTML = `
            <div class="diary-item-header">
                <span class="diary-item-date">${formattedDate}</span>
                ${diary.has_image ? '<span class="diary-item-badge">🎨 이미지</span>' : ''}
            </div>
            <p class="diary-item-summary">${diary.summary || '요약 없음'}</p>
            <div class="diary-item-tags">
                ${(diary.emotion_tags || []).map(tag =>
            `<span class="diary-item-tag">#${tag}</span>`
        ).join('')}
            </div>
        `;

        item.addEventListener('click', () => this.viewDiary(diary.id));
        return item;
    }

    async viewDiary(diaryId) {
        this.showLoading('일기를 불러오고 있어요...');

        try {
            const response = await fetch(`/api/diaries/${diaryId}`);
            if (!response.ok) throw new Error('Failed to load diary');

            const diary = await response.json();

            // Close history modal
            this.closeModal(this.historyModal);

            // Set session ID for image viewing
            this.sessionId = diary.id;

            // Show summary modal with diary data
            this.summaryText.value = diary.summary || '요약 없음';

            this.emotionTags.innerHTML = '';
            (diary.emotion_tags || []).forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'emotion-tag';
                tagEl.textContent = `#${tag}`;
                this.emotionTags.appendChild(tagEl);
            });
            // Handle images (support both legacy and new format)
            const hasImages = (diary.image_paths && diary.image_paths.length > 0) || diary.image_path;
            if (hasImages) {
                // Set gallery state
                this.imagePaths = diary.image_paths || [diary.image_path];
                this.selectedImageIndex = diary.selected_image_index || 0;

                this.generatedImage.src = `/api/diaries/${diaryId}/image?t=${Date.now()}`;
                this.imageSection.style.display = 'block';
                this.imageGenerateSection.style.display = 'none';

                // Render gallery thumbnails
                this.renderGallery();
            } else {
                this.imagePaths = [];
                this.selectedImageIndex = 0;
                this.imageGallery.innerHTML = '';
                this.imageSection.style.display = 'none';
                this.imageGenerateSection.style.display = 'block';
            }

            // Handle BGM
            if (diary.bgm_path) {
                this.bgmPlayer.src = `/api/diaries/${diaryId}/bgm?t=${Date.now()}`;
                this.bgmSection.style.display = 'block';
                this.bgmGenerateSection.style.display = 'none';
                this.bgmCount = 1; // 이미 하나가 있는 상태
            } else {
                this.bgmSection.style.display = 'none';
                this.bgmGenerateSection.style.display = 'block';
                this.bgmCount = 0;
            }

            this.summaryModal.classList.add('active');

        } catch (error) {
            console.error('Error loading diary:', error);
            this.showAlert('일기를 불러오는데 실패했습니다.');
        } finally {
            this.hideLoading();
        }
    }

    closeModal(modal) {
        modal.classList.remove('active');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AIDiary();
});
