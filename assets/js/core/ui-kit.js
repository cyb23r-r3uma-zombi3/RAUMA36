/**
 * SKY EDU - UI Kit
 * Modal, confirm, toast helper, loading - tái sử dụng
 * Không phá: showNotification, modal-overlay sẵn có vẫn hoạt động.
 */
(function (global) {
    'use strict';

    const SkyUI = {
        /**
         * Modal dùng chung
         * opts: { title, body (html), footer (html), onClose, width }
         */
        modal(opts) {
            opts = opts || {};
            // Tái sử dụng modal-overlay của admin nếu có, nếu không tạo mới
            let overlay = document.getElementById('skyModalOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'skyModalOverlay';
                overlay.className = 'sky-modal-overlay';
                overlay.innerHTML = `<div class="sky-modal">
                    <div class="sky-modal-header">
                        <div class="sky-modal-title" id="skyModalTitle"></div>
                        <button type="button" class="sky-modal-close" aria-label="Đóng hộp thoại" title="Đóng hộp thoại">×</button>
                    </div>
                    <div class="sky-modal-body" id="skyModalBody"></div>
                    <div class="sky-modal-footer" id="skyModalFooter"></div>
                </div>`;
                document.body.appendChild(overlay);

                overlay.querySelector('.sky-modal-close').addEventListener('click', () => SkyUI.closeModal());
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) SkyUI.closeModal();
                });
            }
            document.getElementById('skyModalTitle').textContent = opts.title || '';
            document.getElementById('skyModalBody').innerHTML = opts.body || '';
            document.getElementById('skyModalFooter').innerHTML = opts.footer || '';
            const modal = overlay.querySelector('.sky-modal');
            if (opts.width) modal.style.maxWidth = opts.width;

            overlay.style.display = 'flex';
            requestAnimationFrame(() => overlay.classList.add('show'));

            this._onClose = opts.onClose;
            return overlay;
        },

        closeModal() {
            const overlay = document.getElementById('skyModalOverlay');
            if (!overlay) return;
            overlay.classList.remove('show');
            setTimeout(() => { overlay.style.display = 'none'; }, 200);
            if (typeof this._onClose === 'function') {
                this._onClose();
                this._onClose = null;
            }
        },

        /**
         * Confirm dialog
         */
        confirm(opts) {
            return new Promise((resolve) => {
                this.modal({
                    title: opts.title || 'Xác nhận',
                    body: `<div class="sky-confirm-body">
                        <div class="sky-confirm-icon">${opts.icon || '⚠️'}</div>
                        <div class="sky-confirm-message">${opts.message || ''}</div>
                    </div>`,
                    footer: `<button type="button" class="btn btn-secondary sky-cancel">Hủy</button>
                             <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'} sky-ok">${opts.okText || 'Xác nhận'}</button>`,
                    onClose: () => resolve(false)
                });
                const ok = document.querySelector('.sky-ok');
                const cancel = document.querySelector('.sky-cancel');
                if (ok) ok.addEventListener('click', () => { this.closeModal(); resolve(true); });
                if (cancel) cancel.addEventListener('click', () => { this.closeModal(); resolve(false); });
            });
        },

        /**
         * Toast thông báo (dùng showNotification có sẵn)
         */
        toast(message, type = 'info') {
            if (typeof showNotification === 'function') {
                showNotification(message, type);
            } else {
                // Silently ignore if no notification function available
            }
        },

        /**
         * Loading overlay
         */
        loading(show, message) {
            let overlay = document.getElementById('skyLoadingOverlay');
            if (!show) {
                if (overlay) overlay.remove();
                return;
            }
            overlay = document.createElement('div');
            overlay.id = 'skyLoadingOverlay';
            overlay.className = 'sky-loading-overlay';
            overlay.innerHTML = `<div class="sky-loading-content">
                <div class="sky-spinner"></div>
                <div class="sky-loading-text">${message || 'Đang tải...'}</div>
            </div>`;
            document.body.appendChild(overlay);
        }
    };

    // CSS
    const css = `
        .sky-modal-overlay {
            position: fixed; inset: 0; z-index: 100000;
            background: rgba(0, 0, 0, 0.5);
            display: none; align-items: center; justify-content: center;
            backdrop-filter: blur(4px);
            opacity: 0; transition: opacity .2s;
        }
        .sky-modal-overlay.show { opacity: 1; }
        .sky-modal {
            background: var(--card-bg, #FFFFFF);
            border-radius: 16px;
            width: 90%; max-width: 560px;
            max-height: 85vh; overflow: hidden;
            display: flex; flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            transform: scale(0.95); transition: transform .2s;
        }
        .sky-modal-overlay.show .sky-modal { transform: scale(1); }
        .sky-modal-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 18px 22px; border-bottom: 1px solid var(--border, #E2E8F0);
        }
        .sky-modal-title { font-size: 17px; font-weight: 800; color: var(--text-primary, #0F172A); }
        .sky-modal-close {
            background: transparent; border: none; font-size: 28px;
            color: var(--text-muted, #94A3B8); cursor: pointer;
            line-height: 1; padding: 0; width: 32px; height: 32px;
            border-radius: 8px; transition: all .2s;
        }
        .sky-modal-close:hover { background: var(--bg-secondary, #F8FAFC); color: var(--text-primary, #0F172A); }
        .sky-modal-body { padding: 22px; overflow-y: auto; flex: 1; }
        .sky-modal-footer {
            padding: 16px 22px; border-top: 1px solid var(--border, #E2E8F0);
            display: flex; gap: 8px; justify-content: flex-end;
        }

        .sky-confirm-body { text-align: center; padding: 12px 0; }
        .sky-confirm-icon { font-size: 48px; margin-bottom: 12px; }
        .sky-confirm-message { font-size: 15px; color: var(--text-primary, #0F172A); line-height: 1.5; }

        .sky-loading-overlay {
            position: fixed; inset: 0; z-index: 100001;
            background: rgba(0,0,0,0.5); display: flex;
            align-items: center; justify-content: center;
            backdrop-filter: blur(4px);
        }
        .sky-loading-content { text-align: center; color: white; }
        .sky-spinner {
            width: 48px; height: 48px;
            border: 4px solid rgba(255,255,255,0.2);
            border-top-color: white;
            border-radius: 50%;
            animation: skySpin 0.8s linear infinite;
            margin: 0 auto 12px;
        }
        .sky-loading-text { font-size: 14px; font-weight: 600; }
        @keyframes skySpin { to { transform: rotate(360deg); } }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    global.SkyUI = SkyUI;
})(window);
