/* ============================================================
 * SKY EDU - Dashboard Notification Bell
 * ------------------------------------------------------------
 * Hook vào shared navbar (assets/js/navbar.js) để thêm chuông
 * thông báo vào trang dashboard.
 *
 * Yêu cầu:
 *   - Phải được load SAU assets/js/navbar.js
 *   - NotificationService phải tồn tại (xem firebase-config.js)
 * ============================================================ */
(function () {
    'use strict';

    if (!window.SkyNavbar) {
        console.warn('[dashboard-bell] SkyNavbar not found — make sure navbar.js loaded first.');
        return;
    }
    if (typeof NotificationService === 'undefined') {
        // Không có service thì không render bell (không cần thiết cho layout)
        return;
    }

    const BELL_HTML = `
        <div class="notif-bell" id="notifBell">
            <button id="notifBellBtn" class="notif-bell-btn" type="button" aria-label="Mở danh sách thông báo" title="Mở danh sách thông báo" aria-controls="notifDropdown" aria-expanded="false">
                <iconify-icon icon="lucide:bell" width="18" height="18" aria-hidden="true"></iconify-icon>
                <span class="notif-bell-badge" id="notifBellBadge" hidden>0</span>
            </button>
            <div class="notif-dropdown" id="notifDropdown" role="menu">
                <div class="notif-dropdown-header">
                    <span>Thông báo</span>
                    <button id="notifMarkAllBtn" type="button" class="notif-mark-all">Đánh dấu tất cả đã đọc</button>
                </div>
                <div class="notif-dropdown-body" id="notifDropdownBody">
                    <div class="notif-empty">Chưa có thông báo nào.</div>
                </div>
            </div>
        </div>
    `;

    function escapeHtml(s) {
        return s == null ? '' : String(s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }

    let _notifUnreadOff = null;

    function wireNotificationsBell(currentUser) {
        const uid = currentUser && (currentUser.uid || currentUser.id || currentUser.username);
        if (!uid) return;

        const bell    = document.getElementById('notifBell');
        const btn     = document.getElementById('notifBellBtn');
        const dropdown= document.getElementById('notifDropdown');
        const body    = document.getElementById('notifDropdownBody');
        const badge   = document.getElementById('notifBellBadge');
        const markAll = document.getElementById('notifMarkAllBtn');
        if (!bell || !btn || !dropdown || !body || !badge) return;

        // Live unread count → badge
        if (_notifUnreadOff) { try { _notifUnreadOff(); } catch (e) { console.error('[DashboardBell] unsubscribe error:', e); } _notifUnreadOff = null; }
        try {
            _notifUnreadOff = NotificationService.unreadCount(uid, (n) => {
                badge.textContent = n > 99 ? '99+' : String(n);
                badge.hidden = !(n > 0);
            });
        } catch (e) {
            console.warn('[dashboard-bell] unreadCount failed:', e);
        }

        // Toggle dropdown on bell click
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const open = bell.classList.toggle('open');
            const accessibleLabel = open ? 'Đóng danh sách thông báo' : 'Mở danh sách thông báo';
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.setAttribute('aria-label', accessibleLabel);
            btn.setAttribute('title', accessibleLabel);
            if (!open) return;
            try {
                const list = await NotificationService.list(uid, 20);
                if (!list || !list.length) {
                    body.innerHTML = '<div class="notif-empty">Chưa có thông báo nào.</div>';
                    return;
                }
                body.innerHTML = list.map(n => {
                    const ago = n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN', { hour12: false }) : '';
                    const url = n.actionUrl || '#';
                    const cls = n.read ? 'notif-item' : 'notif-item unread';
                    return `<a href="${escapeAttr(url)}" class="${cls}" data-notif-id="${escapeAttr(n.id)}">
                        <div class="notif-item-title"><span class="dot"></span> ${escapeHtml(n.title || 'Thông báo')}</div>
                        <div class="notif-item-msg">${escapeHtml(n.message || '')}</div>
                        <div class="notif-item-time">${escapeHtml(ago)}</div>
                    </a>`;
                }).join('');
                // Mark-as-read on click
                body.querySelectorAll('.notif-item').forEach(el => {
                    el.addEventListener('click', () => {
                        const id = el.getAttribute('data-notif-id');
                        if (id) NotificationService.markRead(uid, id);
                        el.classList.remove('unread');
                    });
                });
            } catch (e) {
                console.warn('[dashboard-bell] list failed:', e);
            }
        });

        // Click outside closes
        document.addEventListener('click', (e) => {
            if (!bell.contains(e.target)) {
                bell.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
                btn.setAttribute('aria-label', 'Mở danh sách thông báo');
                btn.setAttribute('title', 'Mở danh sách thông báo');
            }
        });

        // Mark all read
        if (markAll) markAll.addEventListener('click', async (e) => {
            e.stopPropagation();
            try { await NotificationService.markAllRead(uid); } catch (err) { console.error('[DashboardBell] markAllRead error:', err); }
            body.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
        });
    }

    // Inject bell vào navbar (chỉ khi user đã login)
    function setup() {
        const user = window.SkyNavbar.getCurrentUser();
        if (!user) return;
        window.SkyNavbar.beforeUserDropdown(BELL_HTML);

        // Sau khi navbar render xong, wire bell
        // Dùng setTimeout 0 để chờ DOM update
        setTimeout(() => wireNotificationsBell(user), 0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();