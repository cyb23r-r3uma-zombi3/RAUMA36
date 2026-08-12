/**
 * ANTI-CHEAT SYSTEM - SKY EDU
 * Hệ thống chống gian lận cho phòng thi
 */

const antiCheat = {
    isActive: false,
    isSubmitting: false,
    violations: [],
    maxViolations: 3,
    enabledFeatures: {
        fullscreen: false,
        tabSwitch: true,
        screenshot: true,
        devTools: true,
        copyPaste: false,
        devToolsDetect: false
    },

    startExamMode: function() {
        return new Promise((resolve) => {
            this.showRulesModal(resolve);
        });
    },

    showRulesModal: function(callback) {
        const self = this;

        const modal = document.createElement('div');
        modal.id = 'antiCheatModal';
        modal.innerHTML = `
            <div class="modal-overlay" id="antiCheatOverlay"></div>
            <div class="modal-content">
                <h2 style="font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 24px; text-align: center;">Quy định làm bài thi</h2>

                <div class="rule-item">
                    <div class="rule-icon" style="background: #FEE2E2;">
                        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <path d="M9 9L15 15M15 9L9 15"/>
                        </svg>
                    </div>
                    <div class="rule-text">
                        <h3>Chế độ toàn màn hình</h3>
                        <p>Bài thi yêu cầu chế độ toàn màn hình. Thoát F11 hoặc Alt+Tab sẽ bị cảnh báo.</p>
                    </div>
                </div>

                <div class="rule-item">
                    <div class="rule-icon" style="background: #FEE2E2;">
                        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v4M12 16h.01"/>
                        </svg>
                    </div>
                    <div class="rule-text">
                        <h3>Giám sát chuyển tab</h3>
                        <p>Không được chuyển sang tab, ứng dụng khác. Vi phạm 3 lần = hủy bài.</p>
                    </div>
                </div>

                <div class="rule-item">
                    <div class="rule-icon" style="background: #FEE2E2;">
                        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                            <rect x="4" y="4" width="16" height="16" rx="2"/>
                            <circle cx="12" cy="11" r="2"/>
                        </svg>
                    </div>
                    <div class="rule-text">
                        <h3>Chụp màn hình</h3>
                        <p>Chức năng chụp màn hình (PrintScreen) bị vô hiệu hóa.</p>
                    </div>
                </div>

                <div class="checkbox-container">
                    <label>
                        <input type="checkbox" id="agreeCheckbox">
                        <span>Tôi đã đọc và hiểu các quy định. Tôi cam kết tuân thủ nghiêm ngặt các quy tắc làm bài.</span>
                    </label>
                </div>

                <div class="modal-buttons">
                    <button type="button" class="btn-cancel" id="antiCheatCancelBtn">Hủy</button>
                    <button type="button" class="btn-start" id="startExamBtn" disabled>Bắt đầu làm bài</button>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #antiCheatModal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
            }

            .modal-content {
                position: relative;
                background: white;
                border-radius: 16px;
                padding: 40px;
                max-width: 600px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: modalIn 0.3s ease-out;
            }

            @keyframes modalIn {
                from {
                    opacity: 0;
                    transform: scale(0.95) translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            .rule-item {
                display: flex;
                gap: 16px;
                padding: 20px;
                background: #F8FAFC;
                border-radius: 12px;
                margin-bottom: 16px;
                border: 1px solid #E2E8F0;
            }

            .rule-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .rule-text h3 {
                font-size: 16px;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 4px;
            }

            .rule-text p {
                font-size: 14px;
                color: #64748b;
                line-height: 1.6;
                margin: 0;
            }

            .checkbox-container {
                background: #EFF6FF;
                padding: 20px;
                border-radius: 12px;
                margin: 24px 0;
                border: 2px solid #BFDBFE;
            }

            .checkbox-container label {
                display: flex;
                align-items: start;
                gap: 12px;
                cursor: pointer;
                font-size: 14px;
                color: #1e293b;
                line-height: 1.6;
            }

            .checkbox-container input[type="checkbox"] {
                width: 20px;
                height: 20px;
                margin-top: 2px;
                cursor: pointer;
                flex-shrink: 0;
            }

            .modal-buttons {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .btn-cancel, .btn-start {
                padding: 14px 32px;
                border-radius: 10px;
                font-weight: 700;
                font-size: 15px;
                border: none;
                cursor: pointer;
                transition: all 0.2s;
            }

            .btn-cancel {
                background: #F1F5F9;
                color: #475569;
            }

            .btn-cancel:hover {
                background: #E2E8F0;
            }

            .btn-start {
                background: #1677FF;
                color: white;
            }

            .btn-start:disabled {
                background: #CBD5E1;
                cursor: not-allowed;
            }

            .btn-start:not(:disabled):hover {
                background: #0C63E7;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(22, 119, 255, 0.3);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(modal);

        const checkbox = document.getElementById('agreeCheckbox');
        const startBtn = document.getElementById('startExamBtn');
        const overlay = document.getElementById('antiCheatOverlay');
        const cancelBtn = document.getElementById('antiCheatCancelBtn');

        // Helper đóng modal + invoke callback(false)
        const closeModal = function() {
            try { modal.remove(); } catch (e) { /* ignore */ }
            if (typeof window.antiCheatCallback === 'function') {
                window.antiCheatCallback(false);
            }
        };

        // [FIX P2.3] Replace inline onclick với addEventListener
        if (overlay) {
            (typeof eventManager !== 'undefined' ? eventManager : { on: function(t, e, h) { t.addEventListener(e, h); return function() { t.removeEventListener(e, h); }; } })
                .on(overlay, 'click', closeModal);
        }
        if (cancelBtn) {
            (typeof eventManager !== 'undefined' ? eventManager : { on: function(t, e, h) { t.addEventListener(e, h); return function() { t.removeEventListener(e, h); }; } })
                .on(cancelBtn, 'click', closeModal);
        }

        checkbox.addEventListener('change', function() {
            startBtn.disabled = !this.checked;
        });

        window.antiCheatCallback = callback;
        startBtn.addEventListener('click', function() {
            modal.remove();

            self.enabledFeatures.fullscreen = true;
            self.enabledFeatures.tabSwitch = true;
            self.enabledFeatures.screenshot = true;
            self.enabledFeatures.devTools = true;
            self.enabledFeatures.copyPaste = true;

            self.isActive = true;
            self.violations = [];

            if (!self._listenersAttached) {
                if (self.enabledFeatures.fullscreen) self.enableFullscreen();
                if (self.enabledFeatures.tabSwitch) self.detectTabSwitch();
                if (self.enabledFeatures.screenshot) self.preventScreenshot();
                if (self.enabledFeatures.devTools) self.blockDevTools();
                if (self.enabledFeatures.copyPaste) self.preventCopyPaste();
                self._listenersAttached = true;
            }

            callback(true);
        });
    },

    onSubmitStart: function() {
        this.isSubmitting = true;
        this.enableFullscreen();
    },

    onSubmitEnd: function() {
        this.isSubmitting = false;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {});
        }
    },

    endExamMode: function() {
        this.isActive = false;
        this.isSubmitting = false;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {});
        }
    },

    recordViolation: function(type) {
        this.handleViolation(type);
    },

    enableFullscreen: function() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {});
        }
    },

    detectTabSwitch: function() {
        const self = this;
        let lastHiddenTime = 0;

        const _attachEvent = function(target, evt, handler) {
            if (typeof eventManager !== 'undefined') eventManager.on(target, evt, handler);
            else target.addEventListener(evt, handler);
        };
        _attachEvent(document, 'visibilitychange', function() {
            if (document.hidden && self.isActive) {
                lastHiddenTime = Date.now();
            } else if (!document.hidden && self.isActive && lastHiddenTime > 0) {
                const hiddenDuration = Date.now() - lastHiddenTime;
                if (hiddenDuration > 1000) {
                    self.handleViolation('Chuyển tab/cửa sổ');
                }
                lastHiddenTime = 0;
            }
        });

        _attachEvent(document, 'fullscreenchange', function() {
            if (self.isActive && !document.fullscreenElement) {
                if (self.isSubmitting) {
                    self.enableFullscreen();
                } else {
                    self.handleViolation('Thoát chế độ toàn màn hình');
                }
            }
        });
    },

    handleViolation: function(type) {
        if (!this.isActive) return;

        this.violations.push({
            type: type,
            time: new Date().toISOString()
        });

        const remaining = this.maxViolations - this.violations.length;

        if (remaining > 0) {
            this.showViolationModal(type, remaining);
        } else {
            alert('⛔ BÀI THI ĐÃ BỊ HỦY\n\nBạn đã vi phạm quy chế thi 3 lần!');

            const failResult = {
                status: 'DISQUALIFIED',
                reason: 'Vi phạm quy chế thi 3 lần',
                violations: this.violations,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('lastExamResult', JSON.stringify(failResult));

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    },

    showViolationModal: function(violationType, remainingCount) {
        const self = this;

        const oldModal = document.getElementById('violationModal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'violationModal';
        modal.innerHTML = `
            <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 999999; display: flex; align-items: center; justify-content: center;"></div>
            <div class="modal-content" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); max-width: 500px; width: 90%; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 25px 60px rgba(0,0,0,0.4); z-index: 9999999;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 80px; height: 80px; background: #FEE2E2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                        <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </div>
                    <h2 style="font-size: 24px; font-weight: 800; color: #1e293b; margin-bottom: 12px;">⚠️ Cảnh báo vi phạm!</h2>
                    <p style="color: #64748b; font-size: 16px; line-height: 1.6;">
                        <strong style="color: #EF4444;">${violationType}</strong><br>
                        Còn <strong style="color: #EF4444; font-size: 22px;">${remainingCount}</strong> lần cảnh báo nữa sẽ hủy bài thi!
                    </p>
                </div>

                <button type="button" id="continueExamBtn" style="width: 100%; padding: 16px; font-size: 16px; background: #1677FF; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">
                    Tôi hiểu, tiếp tục làm bài
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('continueExamBtn').addEventListener('click', function() {
            modal.remove();
            self.enableFullscreen();
        });
    },

    preventScreenshot: function() {
        const self = this;

        _attachEvent(document, 'keyup', function(e) {
            if (!self.isActive) return;

            // PrintScreen
            if (e.key === 'PrintScreen') {
                self.handleViolation('Cố gắng chụp màn hình');
            }
        });

        _attachEvent(document, 'keydown', function(e) {
            if (!self.isActive) return;

            // PrintScreen
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                e.preventDefault();
                navigator.clipboard.writeText('');
                self.handleViolation('Cố gắng chụp màn hình (PrintScreen)');
                return false;
            }

            // Win + Shift + S (Windows Snipping Tool)
            if (e.shiftKey && e.key === 'S' && (e.metaKey || e.key === 'Meta')) {
                e.preventDefault();
                self.handleViolation('Cố gắng chụp màn hình (Snipping Tool)');
                return false;
            }

            // Alt + PrintScreen
            if (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
                e.preventDefault();
                navigator.clipboard.writeText('');
                self.handleViolation('Cố gắng chụp màn hình (Alt+PrintScreen)');
                return false;
            }

            // Ctrl + PrintScreen
            if (e.ctrlKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
                e.preventDefault();
                navigator.clipboard.writeText('');
                self.handleViolation('Cố gắng chụp màn hình (Ctrl+PrintScreen)');
                return false;
            }

            // Alt + Tab (không thể chặn hoàn toàn, chỉ detect)
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                self.handleViolation('Cố gắng chuyển cửa sổ (Alt+Tab)');
                return false;
            }

            // Windows Key (chặn mở Start Menu)
            if (e.key === 'Meta' || e.keyCode === 91 || e.keyCode === 92) {
                e.preventDefault();
                self.handleViolation('Cố gắng mở Start Menu');
                return false;
            }
        });
    },

    blockDevTools: function() {
        const self = this;

        _attachEvent(document, 'keydown', function(e) {
            if (!self.isActive) return;

            // F12
            if (e.key === 'F12' || e.keyCode === 123) {
                e.preventDefault();
                self.handleViolation('Cố gắng mở DevTools (F12)');
                return false;
            }

            // Ctrl+Shift+I (DevTools)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
                e.preventDefault();
                self.handleViolation('Cố gắng mở DevTools (Ctrl+Shift+I)');
                return false;
            }

            // Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
                e.preventDefault();
                self.handleViolation('Cố gắng mở Console (Ctrl+Shift+J)');
                return false;
            }

            // Ctrl+Shift+C (Inspector)
            if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.keyCode === 67)) {
                e.preventDefault();
                self.handleViolation('Cố gắng mở Inspector (Ctrl+Shift+C)');
                return false;
            }

            // Ctrl+U (View Source)
            if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
                e.preventDefault();
                self.handleViolation('Cố gắng xem source code (Ctrl+U)');
                return false;
            }

            // Ctrl+S (Save Page)
            if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
                e.preventDefault();
                self.handleViolation('Cố gắng lưu trang (Ctrl+S)');
                return false;
            }

            // Ctrl+P (Print)
            if (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.keyCode === 80)) {
                e.preventDefault();
                self.handleViolation('Cố gắng in trang (Ctrl+P)');
                return false;
            }

            // F5 hoặc Ctrl+R (Refresh)
            if (e.key === 'F5' || e.keyCode === 116 || (e.ctrlKey && (e.key === 'r' || e.key === 'R' || e.keyCode === 82))) {
                e.preventDefault();
                if (confirm('⚠️ Bạn có chắc muốn tải lại trang?\n\nLàm mới trang sẽ MẤT toàn bộ bài làm hiện tại!')) {
                    location.reload();
                }
                return false;
            }

            // Escape (có thể thoát fullscreen)
            if (e.key === 'Escape' || e.keyCode === 27) {
                if (document.fullscreenElement) {
                    e.preventDefault();
                    self.handleViolation('Cố gắng thoát fullscreen (ESC)');
                    return false;
                }
            }
        });

        // Chặn right-click
        _attachEvent(document, 'contextmenu', function(e) {
            if (self.isActive) {
                e.preventDefault();
                return false;
            }
        });
    },

    preventCopyPaste: function() {
        const self = this;

        _attachEvent(document, 'copy', function(e) {
            if (self.isActive) {
                e.preventDefault();
                return false;
            }
        });
    }
};

if (typeof window !== 'undefined') {
    window.antiCheat = antiCheat;
    window.AntiCheat = antiCheat;
}
