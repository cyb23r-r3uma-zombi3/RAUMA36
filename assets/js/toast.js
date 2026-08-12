/**
 * TOAST.JS — SKY EDU
 * Hệ thống toast notification nhẹ, thay thế alert() truyền thống.
 *
 * Usage:
 *   Toast.show('Hello', 'info');
 *   Toast.success('Đăng nhập thành công!');
 *   Toast.error('Có lỗi xảy ra', 5000);
 *   Toast.warning('Phiên hết hạn');
 *   Toast.info('Đang tải...');
 */
(function () {
    'use strict';

    const ICONS = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const COLORS = {
        success: { bg: '#10B981', dark: '#059669' },
        error:   { bg: '#EF4444', dark: '#DC2626' },
        warning: { bg: '#F59E0B', dark: '#D97706' },
        info:    { bg: '#3B82F6', dark: '#2563EB' }
    };

    function getContainer() {
        let c = document.getElementById('sky-toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'sky-toast-container';
            c.style.cssText = [
                'position:fixed',
                'top:20px',
                'right:20px',
                'z-index:99999',
                'display:flex',
                'flex-direction:column',
                'gap:10px',
                'max-width:360px',
                'pointer-events:none'
            ].join(';');
            document.body.appendChild(c);
        }
        return c;
    }

    function sanitize(message) {
        if (message === null || message === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(message);
        return div.innerHTML;
    }

    function show(message, type, duration) {
        type = type || 'info';
        duration = duration || 3500;

        const container = getContainer();
        const toast = document.createElement('div');
        toast.className = 'sky-toast sky-toast-' + type;
        toast.setAttribute('role', 'alert');

        const color = COLORS[type] || COLORS.info;
        toast.style.cssText = [
            'pointer-events:auto',
            'padding:12px 16px',
            'border-radius:10px',
            'background:' + color.bg,
            'color:#fff',
            'font-size:14px',
            'font-weight:500',
            'display:flex',
            'align-items:flex-start',
            'gap:10px',
            'box-shadow:0 8px 30px rgba(0,0,0,0.18)',
            'animation:skyToastSlideIn .3s cubic-bezier(.4,0,.2,1) forwards',
            'word-break:break-word',
            'line-height:1.4'
        ].join(';');

        const icon = document.createElement('span');
        icon.className = 'sky-toast-icon';
        icon.style.cssText = 'font-size:18px;line-height:1;flex-shrink:0;margin-top:1px;';
        icon.textContent = ICONS[type] || ICONS.info;

        const msg = document.createElement('span');
        msg.className = 'sky-toast-msg';
        msg.style.cssText = 'flex:1;';
        msg.innerHTML = sanitize(message);

        toast.appendChild(icon);
        toast.appendChild(msg);

        // Click to dismiss
        toast.addEventListener('click', () => dismiss(toast));

        container.appendChild(toast);

        // Auto dismiss
        const timer = setTimeout(() => dismiss(toast), duration);
        toast.dataset.timer = String(timer);

        return toast;
    }

    function dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        try {
            if (toast.dataset.timer) clearTimeout(Number(toast.dataset.timer));
        } catch (e) { console.error('[Toast] Error playing sound:', e); }
        toast.style.animation = 'skyToastSlideOut .25s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 250);
    }

    // Inject CSS animation (idempotent)
    function injectStyles() {
        if (document.getElementById('sky-toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'sky-toast-styles';
        style.textContent = [
            '@keyframes skyToastSlideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}',
            '@keyframes skyToastSlideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}',
            '.sky-toast{cursor:pointer;transition:transform .15s ease}',
            '.sky-toast:hover{transform:translateX(-4px)}',
            '@media(max-width:480px){.sky-toast{font-size:13px;padding:10px 14px}#sky-toast-container{left:12px;right:12px;max-width:none}}'
        ].join('');
        document.head.appendChild(style);
    }

    // Public API
    const Toast = {
        show,
        success: (msg, dur) => show(msg, 'success', dur),
        error:   (msg, dur) => show(msg, 'error', dur),
        warning: (msg, dur) => show(msg, 'warning', dur),
        info:    (msg, dur) => show(msg, 'info', dur),
        dismiss: (toast) => dismiss(toast),
        clear: () => {
            const c = document.getElementById('sky-toast-container');
            if (c) c.innerHTML = '';
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Toast;
    } else {
        window.Toast = Toast;
        // Auto-inject styles khi load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectStyles);
        } else {
            injectStyles();
        }
    }
})();
