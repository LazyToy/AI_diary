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
        this.diaryList = document.getElementById('diaryList');


        this.init();
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

        // Modal controls
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal(this.summaryModal));
        document.getElementById('historyModalClose').addEventListener('click', () => this.closeModal(this.historyModal));
        document.getElementById('btnHistory').addEventListener('click', () => this.showHistory());
        document.getElementById('btnNewDiary').addEventListener('click', () => this.startNewDiary());
        document.getElementById('btnGenerateImage').addEventListener('click', () => this.generateImage());

        // Close modal on backdrop click
        [this.summaryModal, this.historyModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });
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

    async startSession() {
        this.showLoading('대화를 준비하고 있어요...');

        try {
            const response = await fetch('/api/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to start session');

            const data = await response.json();
            this.sessionId = data.session_id;
            this.isSessionActive = true;

            // Clear welcome message and show chat
            this.chatMessages.innerHTML = '';
            this.inputContainer.style.display = 'block';

            // Add AI greeting
            this.addMessage('assistant', data.message);
            this.messageInput.focus();

        } catch (error) {
            console.error('Error starting session:', error);
            alert('세션 시작에 실패했습니다. 다시 시도해주세요.');
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
            this.isSessionActive = false;

            // Show summary modal
            this.showSummaryModal(data);

        } catch (error) {
            console.error('Error ending session:', error);
            alert('일기 정리에 실패했습니다. 다시 시도해주세요.');
        } finally {
            this.hideLoading();
        }
    }

    showSummaryModal(data) {
        const summary = data.summary || {};

        // Set summary text
        this.summaryText.textContent = summary.summary || '요약을 생성할 수 없었습니다.';

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

        // Show modal
        this.summaryModal.classList.add('active');
    }

    async generateImage() {
        if (!this.sessionId) return;

        const btn = document.getElementById('btnGenerateImage');
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

            if (data.success && data.image_path) {
                // Show generated image
                this.generatedImage.src = `/api/diaries/${this.sessionId}/image?t=${Date.now()}`;
                this.imageSection.style.display = 'block';
                this.imageGenerateSection.style.display = 'none';
            } else {
                alert(data.message || '이미지 생성에 실패했습니다.');
            }

        } catch (error) {
            console.error('Error generating image:', error);
            alert('이미지 생성에 실패했습니다.');
        } finally {
            btn.disabled = false;
            btn.textContent = '🎨 이미지 생성하기';
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

            const diaries = await response.json();

            this.diaryList.innerHTML = '';

            if (diaries.length === 0) {
                this.diaryList.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <p>아직 작성한 일기가 없어요.</p>
                    </div>
                `;
            } else {
                diaries.forEach(diary => {
                    const item = this.createDiaryItem(diary);
                    this.diaryList.appendChild(item);
                });
            }

            this.historyModal.classList.add('active');

        } catch (error) {
            console.error('Error loading history:', error);
            alert('일기 목록을 불러오는데 실패했습니다.');
        } finally {
            this.hideLoading();
        }
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
            this.summaryText.textContent = diary.summary || '요약 없음';

            this.emotionTags.innerHTML = '';
            (diary.emotion_tags || []).forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'emotion-tag';
                tagEl.textContent = `#${tag}`;
                this.emotionTags.appendChild(tagEl);
            });

            if (diary.image_path) {
                this.generatedImage.src = `/api/diaries/${diaryId}/image?t=${Date.now()}`;
                this.imageSection.style.display = 'block';
                this.imageGenerateSection.style.display = 'none';
            } else {
                this.imageSection.style.display = 'none';
                this.imageGenerateSection.style.display = 'block';
            }

            this.summaryModal.classList.add('active');

        } catch (error) {
            console.error('Error loading diary:', error);
            alert('일기를 불러오는데 실패했습니다.');
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
