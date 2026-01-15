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
        this.designModeSelect = document.getElementById('designModeSelect');

        // Custom Confirm
        this.customConfirm = document.getElementById('customConfirm');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.btnConfirmOk = document.getElementById('confirmOk');
        this.btnConfirmCancel = document.getElementById('confirmCancel');
        this.confirmCallback = null;

        // Payment Modal
        this.paymentModal = document.getElementById('paymentModal');
        this.currentCalendarDate = new Date();
        this.selectedDateStr = null;
        this.diariesByDate = {};
        this.isPickerOpen = false;
        this.pickerYear = new Date().getFullYear();

        // Dashboard Elements
        this.dashboardModal = document.getElementById('dashboardModal');
        this.emotionChart = null;
        this.currentPeriod = 'week';

        // Search & Filter
        this.searchKeyword = '';
        this.filterTag = '';

        // View mode - 목록에서 일기를 볼 때 추적
        this.viewedFromHistory = false;

        // Clerk State
        this.clerk = null;
        this.user = null;

        this.initAuth();
        this.init();
        this.initTheme();
        this.initDesignMode();
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
        document.getElementById('modalClose').addEventListener('click', () => this.closeSummaryModal());
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

        // Payment Modal Events
        document.getElementById('btnPayment').addEventListener('click', () => this.showPaymentModal());
        document.getElementById('paymentClose').addEventListener('click', () => this.closeModal(this.paymentModal));
        document.getElementById('btnPayNow').addEventListener('click', () => this.processPayment());
        this.paymentModal.addEventListener('click', (e) => {
            if (e.target === this.paymentModal) this.closeModal(this.paymentModal);
        });

        this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
        this.designModeSelect.addEventListener('change', () => this.changeDesignMode());

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

        // Dashboard
        document.getElementById('btnDashboard').addEventListener('click', () => this.showDashboard());
        document.getElementById('dashboardModalClose').addEventListener('click', () => this.closeModal(this.dashboardModal));
        this.dashboardModal.addEventListener('click', (e) => {
            if (e.target === this.dashboardModal) this.closeModal(this.dashboardModal);
        });

        // Period tabs
        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.loadDashboardData();
            });
        });

        // Search & Filter
        document.getElementById('btnSearch').addEventListener('click', () => this.performSearch());
        document.getElementById('searchKeyword').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        document.getElementById('tagFilter').addEventListener('change', (e) => {
            this.filterTag = e.target.value;
            this.applyFilters();
        });
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

    initDesignMode() {
        const savedDesign = localStorage.getItem('designMode') || 'basic';
        this.designModeSelect.value = savedDesign;
        this.applyDesignMode(savedDesign);
    }

    changeDesignMode() {
        const mode = this.designModeSelect.value;
        localStorage.setItem('designMode', mode);
        this.applyDesignMode(mode);
    }

    applyDesignMode(mode) {
        // Remove all design mode classes first
        document.body.classList.remove('refined-design', 'modern-design');

        // Apply the selected design mode
        if (mode === 'refined') {
            document.body.classList.add('refined-design');
        } else if (mode === 'modern') {
            document.body.classList.add('modern-design');
        }
        // 'basic' doesn't need any class - uses default styles
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

    async initAuth() {
        // 2. Clerk SDK 로드 대기
        const checkClerk = setInterval(async () => {
            if (window.Clerk) {
                clearInterval(checkClerk);
                this.clerk = window.Clerk;

                try {
                    console.log('Clerk loading...');
                    // 최신 SDK는 스크립트 태그의 키를 자동으로 감지합니다.
                    await this.clerk.load();
                    console.log('Clerk loaded successfully');
                    this.updateAuthState();

                    this.clerk.addListener(({ session }) => {
                        console.log('Auth state changed:', session ? 'LoggedIn' : 'LoggedOut');
                        this.updateAuthState();
                    });
                } catch (err) {
                    console.error('Clerk load error:', err);
                }
            }
        }, 100);
    }

    updateAuthState() {
        if (!this.clerk) return;

        this.user = this.clerk.user;
        const container = document.getElementById('user-button-container');

        if (this.clerk.session) {
            // 로그인 상태: User Button 렌더링
            this.clerk.mountUserButton(container);
            console.log('User logined:', this.user.primaryEmailAddress.emailAddress);

            // Backend Sync Trigger
            // 로그인 시 바로 백엔드와 통신하여 사용자 정보를 Supabase에 동기화합니다.
            this.fetchWithAuth('/api/diaries?limit=1').catch(err => console.error("Initial sync failed:", err));
        } else {
            // 로그아웃 상태: 로그인 버튼/링크 표시 가능
            container.innerHTML = `<button class="header-btn login-btn" onclick="AIDiaryInstance.login()">로그인</button>`;
        }
    }

    login() {
        if (this.clerk) {
            this.clerk.openSignIn();
        }
    }

    hideLoading() {
        this.loadingOverlay.classList.remove('active');
    }

    async fetchWithAuth(url, options = {}) {
        if (this.clerk && this.clerk.session) {
            try {
                const token = await this.clerk.session.getToken();
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            } catch (err) {
                console.error('Failed to get auth token:', err);
            }
        }
        return fetch(url, options);
    }

    async startSession(dateStr = null) {
        // 로그인 체크
        if (this.clerk && !this.clerk.session) {
            this.showConfirm('로그인이 필요한 서비스입니다. 지금 로그인하시겠습니까?', () => {
                this.login();
            });
            return;
        }

        this.showLoading('대화를 준비하고 있어요...');

        try {
            // 기존에 요약 없는 일기가 있으면 삭제
            if (this.sessionId) {
                try {
                    const checkResponse = await this.fetchWithAuth(`/api/diaries/${this.sessionId}`);
                    if (checkResponse.ok) {
                        const existingDiary = await checkResponse.json();
                        if (!existingDiary.summary) {
                            await this.fetchWithAuth(`/api/diaries/${this.sessionId}`, { method: 'DELETE' });
                        }
                    }
                } catch (e) {
                    console.error('기존 세션 정리 오류:', e);
                }
            }

            const response = await this.fetchWithAuth('/api/session/start', {
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
            const response = await this.fetchWithAuth('/api/chat', {
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
            const response = await this.fetchWithAuth('/api/session/end', {
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

    showPaymentModal() {
        this.paymentModal.classList.add('active');
    }

    processPayment() {
        // 결제 페이지로 이동
        this.closeModal(this.paymentModal);
        window.location.href = '/static/payment.html';
    }

    async generateImage() {
        if (!this.sessionId) return;

        const btn = document.getElementById('btnGenerateImage');
        this.showLoading('이미지를 생성하고 있어요...');
        btn.disabled = true;
        btn.textContent = '🎨 이미지 생성 중...';

        try {
            const response = await this.fetchWithAuth('/api/image/generate', {
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
                const token = await this.clerk.session.getToken();
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?t=${Date.now()}&token=${token}`;
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
            const response = await this.fetchWithAuth('/api/image/generate', {
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
                const token = await this.clerk.session.getToken();
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?t=${Date.now()}&token=${token}`;
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

    async renderGallery() {
        this.imageGallery.innerHTML = '';

        if (this.imagePaths.length <= 1) {
            this.imageGallery.style.display = 'none';
            return;
        }

        this.imageGallery.style.display = 'flex';

        let token = '';
        if (this.clerk && this.clerk.session) {
            token = await this.clerk.session.getToken();
        }

        this.imagePaths.forEach((path, index) => {
            const thumb = document.createElement('div');
            thumb.className = `gallery-thumbnail ${index === this.selectedImageIndex ? 'selected' : ''}`;
            thumb.innerHTML = `<img src="/api/diaries/${this.sessionId}/image?index=${index}&t=${Date.now()}&token=${token}" alt="이미지 ${index + 1}">`;
            thumb.addEventListener('click', () => this.selectImage(index));
            this.imageGallery.appendChild(thumb);
        });
    }

    async selectImage(index) {
        if (!this.sessionId) return;

        try {
            const response = await this.fetchWithAuth(`/api/image/select/${this.sessionId}/${index}`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.selectedImageIndex = data.selected_image_index;
                const token = await this.clerk.session.getToken();
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?index=${index}&t=${Date.now()}&token=${token}`;
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
            const response = await this.fetchWithAuth('/api/bgm/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId
                })
            });

            const data = await response.json();

            if (data.success && data.bgm_path) {
                // Show generated BGM
                const token = await this.clerk.session.getToken();
                this.bgmPlayer.src = `/api/diaries/${this.sessionId}/bgm?t=${Date.now()}&token=${token}`;
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
            const response = await this.fetchWithAuth('/api/summary/update', {
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


    async startNewDiary() {
        // 요약이 생성되지 않은 일기는 삭제
        if (this.sessionId) {
            try {
                const response = await this.fetchWithAuth(`/api/diaries/${this.sessionId}`);
                if (response.ok) {
                    const diary = await response.json();
                    if (!diary.summary) {
                        // 요약이 없으면 삭제
                        await this.fetchWithAuth(`/api/diaries/${this.sessionId}`, { method: 'DELETE' });
                        console.log('요약 없는 일기 자동 삭제:', this.sessionId);
                    }
                }
            } catch (error) {
                console.error('일기 정리 중 오류:', error);
            }
        }

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
            // 검색/필터 상태 초기화
            this.searchKeyword = '';
            this.filterTag = '';
            document.getElementById('searchKeyword').value = '';
            document.getElementById('tagFilter').value = '';

            // 태그 필터 옵션 로드
            await this.loadTagsForFilter();

            const response = await this.fetchWithAuth('/api/diaries');
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
                // 한국 시간 기준으로 오늘 날짜 가져오기
                const now = new Date();
                const kstOffset = 9 * 60; // KST는 UTC+9
                const kstNow = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
                const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;

                // dateStr은 'YYYY-MM-DD' 형식
                if (dateStr > todayStr) {
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
                <div class="diary-item-actions">
                    ${diary.has_image ? '<span class="diary-item-badge">🎨</span>' : ''}
                    <button class="diary-edit-btn" title="수정">✏️</button>
                    <button class="diary-delete-btn" title="삭제">🗑️</button>
                </div>
            </div>
            <p class="diary-item-summary">${diary.summary || '요약 없음'}</p>
            <div class="diary-item-tags">
                ${(diary.emotion_tags || []).map(tag =>
            `<span class="diary-item-tag">#${tag}</span>`
        ).join('')}
            </div>
        `;

        // 일기 보기 (아이템 클릭)
        item.addEventListener('click', (e) => {
            // 버튼 클릭이 아닌 경우에만 상세 보기
            if (!e.target.closest('.diary-edit-btn') && !e.target.closest('.diary-delete-btn')) {
                this.viewDiary(diary.id);
            }
        });

        // 수정 버튼
        item.querySelector('.diary-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editDiary(diary.id);
        });

        // 삭제 버튼
        item.querySelector('.diary-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showConfirm('이 일기를 삭제하시겠습니까?', () => this.deleteDiary(diary.id));
        });

        return item;
    }

    async editDiary(diaryId) {
        // 일기 수정 모드로 열기
        await this.viewDiary(diaryId);
        // viewDiary가 summaryModal을 열어주므로 수정 가능한 상태가 됨
    }

    async deleteDiary(diaryId) {
        try {
            const response = await this.fetchWithAuth(`/api/diaries/${diaryId}`, { method: 'DELETE' });
            if (response.ok) {
                this.showAlert('✅ 일기가 삭제되었습니다.');
                // 현재 선택된 날짜의 목록 새로고침 (닫기 버튼과 동일한 동작)
                if (this.selectedDateStr) {
                    // diariesByDate 캐시 갱신
                    const diaries = this.diariesByDate[this.selectedDateStr];
                    if (diaries) {
                        this.diariesByDate[this.selectedDateStr] = diaries.filter(d => d.id !== diaryId);
                    }
                    this.renderDiaryListByDate(this.selectedDateStr);
                } else {
                    await this.showHistory();
                }
            } else {
                this.showAlert('일기 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('Error deleting diary:', error);
            this.showAlert('일기 삭제에 실패했습니다.');
        }
    }

    async viewDiary(diaryId) {
        this.showLoading('일기를 불러오고 있어요...');

        try {
            const response = await this.fetchWithAuth(`/api/diaries/${diaryId}`);
            if (!response.ok) throw new Error('Failed to load diary');

            const diary = await response.json();

            // 목록에서 열었는지 추적 (히스토리 모달이 열려 있는 경우)
            this.viewedFromHistory = this.historyModal.classList.contains('active');

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

                const token = await this.clerk.session.getToken();
                this.generatedImage.src = `/api/diaries/${diaryId}/image?t=${Date.now()}&token=${token}`;
                this.imageSection.style.display = 'block';
                this.imageGenerateSection.style.display = 'none';

                // Render gallery thumbnails
                await this.renderGallery();
            } else {
                this.imagePaths = [];
                this.selectedImageIndex = 0;
                this.imageGallery.innerHTML = '';
                this.imageSection.style.display = 'none';
                this.imageGenerateSection.style.display = 'block';
            }

            // Handle BGM
            if (diary.bgm_path) {
                const token = await this.clerk.session.getToken();
                this.bgmPlayer.src = `/api/diaries/${diaryId}/bgm?t=${Date.now()}&token=${token}`;
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

    closeSummaryModal() {
        this.closeModal(this.summaryModal);

        // 목록에서 열었으면 다시 목록으로 돌아가기 (이전 선택한 날짜 유지)
        if (this.viewedFromHistory) {
            this.viewedFromHistory = false;
            // 히스토리 모달만 다시 열기 (기존 상태 유지)
            this.historyModal.classList.add('active');
        }
    }

    closeModal(modal) {
        modal.classList.remove('active');
    }

    // ===========================
    // Dashboard Methods
    // ===========================

    async showDashboard() {
        this.showLoading('대시보드를 불러오고 있어요...');

        try {
            await this.loadDashboardData();
            this.dashboardModal.classList.add('active');
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showAlert('대시보드를 불러오는데 실패했습니다.');
        } finally {
            this.hideLoading();
        }
    }

    async loadDashboardData() {
        try {
            // 감정 통계 로드
            const statsResponse = await this.fetchWithAuth(`/api/stats/emotions?period=${this.currentPeriod}`);
            const statsData = await statsResponse.json();

            // 베스트 미디어 로드
            const mediaResponse = await this.fetchWithAuth(`/api/stats/best-media?period=${this.currentPeriod}`);
            const mediaData = await mediaResponse.json();

            this.renderEmotionChart(statsData);
            this.renderBestMedia(mediaData);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            throw error;
        }
    }

    renderEmotionChart(data) {
        // 일기 수 표시
        document.getElementById('statsDiaryCount').textContent = data.diary_count || 0;

        // 태그 목록 렌더링
        const tagsContainer = document.getElementById('dashboardTags');
        tagsContainer.innerHTML = '';

        if (data.emotions && data.emotions.length > 0) {
            data.emotions.forEach(item => {
                const tagEl = document.createElement('span');
                tagEl.className = 'emotion-tag';
                tagEl.innerHTML = `#${item.tag}<span class="tag-count">${item.count}</span>`;
                tagsContainer.appendChild(tagEl);
            });

            // 차트 데이터 준비
            const labels = data.emotions.map(e => e.tag);
            const values = data.emotions.map(e => e.count);
            const colors = this.generateChartColors(data.emotions.length);

            // 기존 차트 제거
            if (this.emotionChart) {
                this.emotionChart.destroy();
            }

            // 새 차트 생성
            const ctx = document.getElementById('emotionChart').getContext('2d');
            this.emotionChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: colors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } else {
            tagsContainer.innerHTML = '<span class="no-media">기록된 감정 태그가 없습니다</span>';
            if (this.emotionChart) {
                this.emotionChart.destroy();
                this.emotionChart = null;
            }
        }
    }

    generateChartColors(count) {
        const baseColors = [
            '#7c3aed', '#a855f7', '#ec4899', '#f43f5e', '#f97316',
            '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
        ];
        return baseColors.slice(0, count);
    }

    renderBestMedia(data) {
        const bestImage = document.getElementById('bestImage');
        const noImage = document.getElementById('noImage');
        const bestImageSummary = document.getElementById('bestImageSummary');
        const bestBgm = document.getElementById('bestBgm');
        const noBgm = document.getElementById('noBgm');
        const bestBgmSummary = document.getElementById('bestBgmSummary');

        // 베스트 이미지
        if (data.best_image) {
            const imgUrl = `/api/diaries/${data.best_image.diary_id}/image?index=${data.best_image.image_index}&t=${Date.now()}`;
            bestImage.src = imgUrl;
            bestImage.style.display = 'block';
            noImage.style.display = 'none';
            bestImageSummary.textContent = data.best_image.summary || '';
        } else {
            bestImage.style.display = 'none';
            noImage.style.display = 'block';
            bestImageSummary.textContent = '';
        }

        // 베스트 BGM
        if (data.best_bgm) {
            bestBgm.src = `/api/diaries/${data.best_bgm.diary_id}/bgm?t=${Date.now()}`;
            bestBgm.style.display = 'block';
            noBgm.style.display = 'none';
            bestBgmSummary.textContent = data.best_bgm.summary || '';
        } else {
            bestBgm.style.display = 'none';
            noBgm.style.display = 'block';
            bestBgmSummary.textContent = '';
        }
    }

    // ===========================
    // Search & Filter Methods
    // ===========================

    performSearch() {
        let keyword = document.getElementById('searchKeyword').value.trim();
        // 검색어에서 # 제거
        keyword = keyword.replace(/#/g, '');
        this.searchKeyword = keyword;
        this.applyFilters();
    }

    async applyFilters() {
        this.showLoading('검색 중...');

        try {
            let url = '/api/diaries';
            const params = new URLSearchParams();

            if (this.searchKeyword) {
                params.append('keyword', this.searchKeyword);
            }
            if (this.filterTag) {
                params.append('tag', this.filterTag);
            }

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await this.fetchWithAuth(url);
            if (!response.ok) throw new Error('Failed to search diaries');

            const data = await response.json();

            // 필터 결과로 일기 목록 업데이트
            this.diariesByDate = this.groupDiariesByDate(data);
            this.renderFilteredDiaryList(data);

            // 선택된 날짜 초기화
            this.selectedDateStr = null;
            document.getElementById('selectedDateTitle').textContent =
                this.searchKeyword || this.filterTag
                    ? `검색 결과 (${data.length}개)`
                    : '일기 목록';

        } catch (error) {
            console.error('Error applying filters:', error);
            this.showAlert('검색에 실패했습니다.');
        } finally {
            this.hideLoading();
        }
    }

    renderFilteredDiaryList(diaries) {
        this.diaryList.innerHTML = '';

        if (diaries.length === 0) {
            this.diaryList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>검색 결과가 없어요.</p>
                </div>
            `;
            return;
        }

        diaries.forEach(diary => {
            const item = document.createElement('div');
            item.className = 'diary-item';

            const date = new Date(diary.created_at);
            const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

            const emotionTags = diary.emotion_tags || [];
            const tags = emotionTags.slice(0, 3).map(t => `#${t}`).join(' ');

            item.innerHTML = `
                <div class="diary-item-header">
                    <span class="diary-date">${dateStr}</span>
                    ${diary.has_image ? '<span class="diary-media-badge">🖼️</span>' : ''}
                    ${diary.has_bgm ? '<span class="diary-media-badge">🎵</span>' : ''}
                </div>
                <p class="diary-preview">${diary.summary || '요약 없음'}</p>
                <div class="diary-tags">${tags}</div>
            `;

            item.addEventListener('click', () => this.viewDiary(diary.id));
            this.diaryList.appendChild(item);
        });
    }

    async loadTagsForFilter() {
        try {
            const response = await this.fetchWithAuth('/api/stats/all-tags');
            const data = await response.json();

            const select = document.getElementById('tagFilter');
            // 기존 옵션 유지하고 태그 추가
            select.innerHTML = '<option value="">모든 감정</option>';

            data.tags.forEach(tag => {
                const option = document.createElement('option');
                // 태그에서 # 제거
                const cleanTag = tag.replace(/^#+/, '');
                option.value = cleanTag;
                option.textContent = cleanTag;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.AIDiaryInstance = new AIDiary();
});
