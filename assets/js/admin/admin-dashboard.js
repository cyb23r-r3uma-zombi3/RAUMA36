/**
 * admin-dashboard.js - Dashboard & UI utilities
 * Tách ra từ admin.html để giảm dung lượng
 */
(function(global) {
    'use strict';

    // Render dashboard stats
    function renderDashboard() {
        var stats = (typeof QuestionBank !== 'undefined') ? QuestionBank.getStats() : { total: 0, byType: {} };
        var examStats = (typeof ExamBuilder !== 'undefined') ? ExamBuilder.getStats() : { total: 0 };
        var typeStats = stats.byType || {};
        var qtKeys = (typeof QuestionTypes !== 'undefined' && QuestionTypes.KEYS) ? QuestionTypes.KEYS.length : 0;
        var mcqTotal = (typeStats.mcq_single || 0) + (typeStats.mcq_multi || 0);

        var cards = [
            { value: stats.total || 0, label: 'Tổng câu hỏi', class: 'bg-blue', icon: '📚' },
            { value: examStats.total || 0, label: 'Tổng đề thi', class: 'bg-green', icon: '📝' },
            { value: qtKeys, label: 'Dạng câu hỏi', class: 'bg-purple', icon: '🎨' },
            { value: typeStats.essay || 0, label: 'Câu tự luận', class: 'bg-orange', icon: '✍️' },
            { value: typeStats.fill_blank || 0, label: 'Câu điền khuyết', class: 'bg-pink', icon: '✏️' },
            { value: mcqTotal, label: 'Câu trắc nghiệm', class: 'bg-info', icon: '🔘' }
        ];

        var el = document.getElementById('dashboardStats');
        if (el) {
            el.innerHTML = cards.map(function(c) {
                return '<div class="stat-card ' + c.class + '">' +
                    '<div class="stat-card-icon">' + c.icon + '</div>' +
                    '<div class="stat-card-value">' + c.value + '</div>' +
                    '<div class="stat-card-label">' + c.label + '</div>' +
                '</div>';
            }).join('');
        }
    }

    // Modal controls
    function openModal(title, body, onConfirm, confirmText) {
        confirmText = confirmText || 'OK';
        var titleEl = document.getElementById('modalTitle');
        var bodyEl = document.getElementById('modalBody');
        var footerEl = document.getElementById('modalFooter');

        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = body;
        if (footerEl) {
            footerEl.innerHTML = '<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Đóng</button>';
            if (onConfirm) {
                footerEl.innerHTML += '<button type="button" class="btn btn-primary" id="modalConfirmBtn">' + confirmText + '</button>';
                var btn = document.getElementById('modalConfirmBtn');
                if (btn) {
                    var _appRef = global.App || window.App;
                    btn.addEventListener('click', function() {
                        try {
                            if (typeof onConfirm === 'function') {
                                // Bind với App context nếu có
                                if (_appRef) {
                                    onConfirm.call(_appRef);
                                } else {
                                    onConfirm();
                                }
                            }
                        } catch (e) {
                            console.error('[Modal] onConfirm error:', e);
                        }
                        if (global.App || window.App) {
                            (global.App || window.App).closeModal();
                        } else if (typeof closeModal === 'function') {
                            closeModal();
                        }
                    });
                }
            }
        }

        // [FIX BUG 1] Show BOTH overlay AND modal
        var overlay = document.getElementById('modalOverlay');
        var modal = document.getElementById('appModal');
        if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
        }
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }

    function closeModal() {
        var overlay = document.getElementById('modalOverlay');
        var modal = document.getElementById('appModal');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    }

    // Toast notification với hỗ trợ retry
    function toast(message, type, options) {
        type = type || 'info';
        options = options || {};
        var container = document.getElementById('toastContainer') || createToastContainer();
        var icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        var toastEl = document.createElement('div');
        toastEl.className = 'toast toast-' + type;

        var content = '<span>' + (icons[type] || icons.info) + ' ' + message + '</span>';

        // Thêm nút retry nếu có error và có retry callback
        if (type === 'error' && typeof options.onRetry === 'function') {
            content += ' <button class="toast-retry-btn" data-retry="true">Thử lại</button>';
        }

        toastEl.innerHTML = content;

        // Xử lý nút retry
        if (type === 'error' && typeof options.onRetry === 'function') {
            var retryBtn = toastEl.querySelector('[data-retry="true"]');
            if (retryBtn) {
                retryBtn.addEventListener('click', function() {
                    hideToast(toastEl);
                    options.onRetry();
                });
            }
        }

        container.appendChild(toastEl);

        // Animate in
        setTimeout(function() { toastEl.classList.add('show'); }, 10);

        // Auto remove (giữ lâu hơn cho error)
        var duration = type === 'error' ? 8000 : 3000;
        setTimeout(function() {
            hideToast(toastEl);
        }, duration);
    }

    function hideToast(toastEl) {
        if (!toastEl || !toastEl.parentNode) return;
        toastEl.classList.remove('show');
        setTimeout(function() {
            if (toastEl.parentNode) toastEl.remove();
        }, 300);
    }

    function createToastContainer() {
        var container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(container);
        return container;
    }

    // Thêm style cho toast retry button
    function injectToastStyles() {
        if (document.getElementById('toast-retry-style')) return;
        var style = document.createElement('style');
        style.id = 'toast-retry-style';
        style.textContent = `
            .toast-retry-btn {
                margin-left: 10px;
                padding: 4px 12px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
            }
            .toast-retry-btn:hover {
                background: #dc2626;
            }
        `;
        document.head.appendChild(style);
    }

    // Inject styles khi module load
    injectToastStyles();

    // Export
    global.AdminDashboard = {
        renderDashboard: renderDashboard,
        openModal: openModal,
        closeModal: closeModal,
        toast: toast,
        hideToast: hideToast
    };

})(typeof window !== 'undefined' ? window : globalThis);
