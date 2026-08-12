/**
 * ADMIN ERROR HANDLER
 * ==================
 * Provides comprehensive error handling for the admin panel:
 * - Loading spinner during initialization
 * - Error notifications with auto-dismiss
 * - Global error handlers for uncaught exceptions
 * - Graceful fallback UI
 * 
 * Usage:
 *   AdminErrorHandler.showError('Something went wrong');
 *   AdminErrorHandler.showLoadingSpinner('Loading admin panel...');
 */

(function(global) {
    'use strict';

    const AdminErrorHandler = {
        // Store active notifications for cleanup
        _notifications: [],
        _initialized: false,

        /**
         * Initialize global error handlers
         */
        setupGlobalErrorHandlers() {
            if (this._initialized) return;
            this._initialized = true;

            // Catch runtime errors
            window.addEventListener('error', (e) => {
                console.error('[Global Error]:', e.error);
                if (!this._isIgnoredError(e.error)) {
                    this.showError(
                        `Lỗi: ${e.error?.message || e.message}`,
                        'RUNTIME_ERROR'
                    );
                }
            });

            // Catch unhandled promise rejections
            window.addEventListener('unhandledrejection', (e) => {
                console.error('[Unhandled Rejection]:', e.reason);
                const msg = e.reason?.message || e.reason?.name || String(e.reason);
                if (!this._isIgnoredError(e.reason)) {
                    this.showError(
                        `Lỗi xử lý: ${msg}`,
                        'PROMISE_ERROR'
                    );
                }
            });

            console.log('[AdminErrorHandler] Global handlers initialized');
        },

        /**
         * Check if error should be ignored (e.g., Firebase timeout warnings)
         */
        _isIgnoredError(err) {
            if (!err) return true;
            const msg = (err.message || String(err)).toLowerCase();
            const ignored = [
                'favicon',
                'firebase init timeout',
                'firebase sdk not loaded',
                'network',
                'failed to load resource'
            ];
            return ignored.some(s => msg.includes(s));
        },

        /**
         * Show loading spinner overlay
         */
        showLoadingSpinner(message = 'Đang tải...') {
            // Remove existing spinner if any
            const existing = document.getElementById('admin-loading-overlay');
            if (existing) existing.remove();

            // Remove any loading spinners in admin-app
            const adminApp = document.getElementById('admin-app');
            if (adminApp) {
                adminApp.style.visibility = 'hidden';
            }

            const overlay = document.createElement('div');
            overlay.id = 'admin-loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #0F172A 0%, #1A2332 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99998;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            `;

            overlay.innerHTML = `
                <div style="text-align: center; color: white;">
                    <div style="
                        width: 48px;
                        height: 48px;
                        border: 3px solid rgba(0, 212, 255, 0.3);
                        border-top-color: #00D4FF;
                        border-radius: 50%;
                        margin: 0 auto 24px;
                        animation: admin-spin 1s linear infinite;
                    "></div>
                    <div style="
                        font-size: 18px;
                        color: #00D4FF;
                        font-weight: 600;
                        margin-bottom: 8px;
                    ">SKY EDU Admin</div>
                    <div style="
                        font-size: 14px;
                        color: rgba(255, 255, 255, 0.7);
                    ">${this._escapeHtml(message)}</div>
                </div>
                <style>
                    @keyframes admin-spin {
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;

            document.body.appendChild(overlay);
            this._notifications.push(overlay);

            // Auto-remove after 30 seconds (failsafe)
            setTimeout(() => {
                if (document.getElementById('admin-loading-overlay')) {
                    this.hideLoadingSpinner();
                    this.showError('Quá thời gian tải. Vui lòng làm mới trang.', 'TIMEOUT');
                }
            }, 30000);

            return overlay;
        },

        /**
         * Hide loading spinner
         */
        hideLoadingSpinner() {
            const overlay = document.getElementById('admin-loading-overlay');
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.3s ease';
                setTimeout(() => overlay.remove(), 300);
            }

            const adminApp = document.getElementById('admin-app');
            if (adminApp) {
                adminApp.style.visibility = 'visible';
            }
        },

        /**
         * Show error notification
         */
        showError(message, code = '') {
            // 1. Log to console
            console.error(`[Admin Error ${code}]:`, message);

            // 2. Show notification in UI
            const errorEl = document.createElement('div');
            errorEl.className = 'admin-error-notification';
            errorEl.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #EF4444;
                color: white;
                padding: 20px;
                border-radius: 12px;
                max-width: 400px;
                z-index: 99999;
                font-family: 'Inter', -apple-system, sans-serif;
                box-shadow: 0 10px 40px rgba(239, 68, 68, 0.4);
                animation: admin-slide-in 0.3s ease;
            `;

            const timestamp = new Date().toLocaleTimeString('vi-VN');
            errorEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <div style="font-size: 24px; flex-shrink: 0;">❌</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 8px; font-size: 15px;">
                            Lỗi Admin Panel
                        </div>
                        <div style="font-size: 14px; line-height: 1.5; opacity: 0.95;">
                            ${this._escapeHtml(message)}
                        </div>
                        ${code ? `
                            <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 12px;">
                                Mã: ${this._escapeHtml(code)} • ${timestamp}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button type="button" onclick="this.closest('.admin-error-notification').remove()" style="
                        background: rgba(255,255,255,0.2);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        flex: 1;
                    ">Đóng</button>
                    <button type="button" onclick="location.reload()" style="
                        background: white;
                        color: #EF4444;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        flex: 1;
                    ">Tải lại</button>
                </div>
                <style>
                    @keyframes admin-slide-in {
                        from { opacity: 0; transform: translateX(100%); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                </style>
            `;

            document.body.appendChild(errorEl);
            this._notifications.push(errorEl);

            // Auto-remove after 10 seconds
            const autoRemove = setTimeout(() => {
                if (errorEl.parentElement) {
                    errorEl.style.opacity = '0';
                    errorEl.style.transform = 'translateX(100%)';
                    setTimeout(() => errorEl.remove(), 300);
                }
            }, 10000);

            // Remove from tracking when manually closed
            errorEl.querySelector('button').addEventListener('click', () => {
                clearTimeout(autoRemove);
            });

            return errorEl;
        },

        /**
         * Show warning notification
         */
        showWarning(message, code = '') {
            console.warn(`[Admin Warning ${code}]:`, message);

            const warnEl = document.createElement('div');
            warnEl.className = 'admin-warning-notification';
            warnEl.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #F59E0B;
                color: #070D1F;
                padding: 16px 20px;
                border-radius: 12px;
                max-width: 400px;
                z-index: 99999;
                font-family: 'Inter', -apple-system, sans-serif;
                box-shadow: 0 10px 40px rgba(245, 158, 11, 0.4);
                animation: admin-slide-in 0.3s ease;
            `;

            warnEl.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <div style="font-size: 20px; flex-shrink: 0;">⚠️</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">
                            Cảnh báo
                        </div>
                        <div style="font-size: 13px; line-height: 1.5;">
                            ${this._escapeHtml(message)}
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes admin-slide-in {
                        from { opacity: 0; transform: translateX(100%); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                </style>
            `;

            document.body.appendChild(warnEl);
            this._notifications.push(warnEl);

            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (warnEl.parentElement) {
                    warnEl.style.opacity = '0';
                    setTimeout(() => warnEl.remove(), 300);
                }
            }, 8000);

            return warnEl;
        },

        /**
         * Show success notification
         */
        showSuccess(message) {
            console.log(`[Admin Success]:`, message);

            const successEl = document.createElement('div');
            successEl.className = 'admin-success-notification';
            successEl.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10B981;
                color: white;
                padding: 14px 20px;
                border-radius: 10px;
                max-width: 350px;
                z-index: 99999;
                font-family: 'Inter', -apple-system, sans-serif;
                box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
                animation: admin-slide-in 0.3s ease;
            `;

            successEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 18px;">✅</span>
                    <span style="font-size: 14px; font-weight: 500;">${this._escapeHtml(message)}</span>
                </div>
                <style>
                    @keyframes admin-slide-in {
                        from { opacity: 0; transform: translateX(100%); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                </style>
            `;

            document.body.appendChild(successEl);
            this._notifications.push(successEl);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (successEl.parentElement) {
                    successEl.style.opacity = '0';
                    setTimeout(() => successEl.remove(), 300);
                }
            }, 5000);

            return successEl;
        },

        /**
         * Show Firebase-specific error
         */
        showFirebaseError(error) {
            let message = 'Không thể kết nối Firebase.';
            let code = 'FIREBASE_ERROR';

            if (error) {
                const msg = error.message || String(error);
                
                if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
                    message = 'Firebase không phản hồi. Vui lòng kiểm tra kết nối mạng.';
                    code = 'FIREBASE_TIMEOUT';
                } else if (msg.includes('network') || msg.includes('NETWORK')) {
                    message = 'Lỗi mạng. Vui lòng kiểm tra kết nối internet.';
                    code = 'FIREBASE_NETWORK';
                } else if (msg.includes('not loaded') || msg.includes('undefined')) {
                    message = 'Firebase SDK không tải được. Thử tải lại trang.';
                    code = 'FIREBASE_SDK';
                } else {
                    message = `Lỗi Firebase: ${msg.substring(0, 100)}`;
                }
            }

            this.showError(message, code);
        },

        /**
         * Show offline mode message
         */
        showOfflineMode() {
            const offlineEl = document.createElement('div');
            offlineEl.id = 'admin-offline-notification';
            offlineEl.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(90deg, #1e2436, #252B3D);
                color: #00D4FF;
                padding: 12px 24px;
                z-index: 99997;
                font-family: 'Inter', -apple-system, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                border-bottom: 1px solid rgba(0, 212, 255, 0.3);
                font-size: 14px;
            `;

            offlineEl.innerHTML = `
                <span style="font-size: 18px;">📡</span>
                <span>Chế độ Offline - Một số tính năng có thể không hoạt động</span>
                <span style="opacity: 0.6; font-size: 12px;">(Dữ liệu được đồng bộ khi có mạng)</span>
            `;

            document.body.insertBefore(offlineEl, document.body.firstChild);
            this._notifications.push(offlineEl);

            // Listen for online event to remove notification
            const onlineHandler = () => {
                if (offlineEl.parentElement) {
                    offlineEl.innerHTML = `
                        <span style="font-size: 18px;">✅</span>
                        <span>Đã kết nối lại - Đang đồng bộ dữ liệu...</span>
                    `;
                    offlineEl.style.background = 'linear-gradient(90deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))';
                    setTimeout(() => offlineEl.remove(), 2000);
                }
                window.removeEventListener('online', onlineHandler);
            };
            window.addEventListener('online', onlineHandler);

            return offlineEl;
        },

        /**
         * Escape HTML to prevent XSS
         */
        _escapeHtml(s) {
            if (typeof s !== 'string') return '';
            return s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;');
        },

        /**
         * Clean up all notifications
         */
        cleanup() {
            this._notifications.forEach(el => {
                if (el.parentElement) {
                    el.remove();
                }
            });
            this._notifications = [];
        },

        /**
         * Show admin panel main container
         */
        showAdminContent() {
            this.hideLoadingSpinner();
            const adminApp = document.getElementById('admin-app');
            if (adminApp) {
                adminApp.style.display = 'flex';
            }
        }
    };

    // Initialize global handlers when DOM is ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                AdminErrorHandler.setupGlobalErrorHandlers();
            });
        } else {
            AdminErrorHandler.setupGlobalErrorHandlers();
        }
    }

    // Expose globally
    global.AdminErrorHandler = AdminErrorHandler;

})(window);
