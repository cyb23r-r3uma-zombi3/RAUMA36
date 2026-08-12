/**
 * SKY EDU - Session Security
 * Quản lý session expiry, kiểm tra token hết hạn, tự động logout.
 *
 * Cơ chế:
 *  - Mỗi lần login, lưu sessionExpiresAt = Date.now() + 1 giờ
 *  - Mỗi lần trang load / mỗi lần dùng session, kiểm tra expiresAt
 *  - Nếu hết hạn → xoá currentUser → redirect về trang login
 *  - Validate JSON trước khi parse để tránh crash
 */
(function(global){
    'use strict';

    const SESSION_KEY = 'currentUser';
    /* [FIX admin panel] Bỏ qua timeout phiên đăng nhập.
       Trước đây là 1 giờ → admin hay bị tự động logout khi đang thao tác.
       Đổi thành 10 năm để phiên đăng nhập không tự hết hạn (vẫn có thể đăng xuất thủ công).
       Lưu ý: vẫn validate sessionToken với server (xem firebase-config.js) → bảo mật vẫn đảm bảo. */
    const SESSION_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;   // 10 năm (không auto-logout)
    const WARNING_BEFORE_MS = 5 * 60 * 1000;      // cảnh báo trước 5 phút (giữ nguyên, không dùng tới)

    /**
     * Safe JSON.parse, trả về fallback nếu lỗi
     */
    function safeParse(json, fallback) {
        if (typeof json !== 'string') return fallback;
        if (!json || json === 'null' || json === 'undefined') return fallback;
        try {
            return JSON.parse(json);
        } catch (e) {
            console.warn('safeParse failed:', e.message);
            return fallback;
        }
    }

    const SessionSecurity = {
        SESSION_KEY: SESSION_KEY,
        SESSION_TTL_MS: SESSION_TTL_MS,

        /**
         * Lưu session với expiresAt = now + TTL
         */
        saveSession(user) {
            if (!user || typeof user !== 'object') return false;
            const expiresAt = Date.now() + SESSION_TTL_MS;
            const session = Object.assign({}, user, {
                sessionExpiresAt: expiresAt,
                sessionCreatedAt: Date.now()
            });
            try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                return true;
            } catch (e) {
                console.error('saveSession failed:', e);
                return false;
            }
        },

        /**
         * Lấy session hiện tại, null nếu hết hạn / không hợp lệ
         * [FIX] Tự heal: nếu session thiếu sessionExpiresAt (do cũ trước khi update),
         * tự gắn expiry mới (10 năm) thay vì xóa session ngay → tránh user bị "tự đăng xuất"
         * khi vừa đăng nhập xong lần đầu sau khi deploy.
         */
        getSession() {
            const raw = (() => {
                try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
            })();
            if (!raw) return null;
            const session = safeParse(raw, null);
            if (!session) return null;

            // [FIX] Self-heal: nếu session không có sessionExpiresAt → tự gắn expiry mới.
            // Lý do: SKY EDU trước đây dùng TTL 1 giờ (và sau đó đổi thành 10 năm).
            // Nếu user đăng nhập lần đầu sau khi deploy và localStorage còn cache cũ,
            // session sẽ không có field này → trước đây bị xóa → gây tự đăng xuất.
            const expiresAt = session.sessionExpiresAt;
            if (typeof expiresAt !== 'number') {
                try {
                    session.sessionExpiresAt = Date.now() + SESSION_TTL_MS;
                    session.sessionCreatedAt = session.sessionCreatedAt || Date.now();
                    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    console.warn('[SessionSecurity] Tự heal: gắn sessionExpiresAt mới cho session cũ.');
                } catch (e) {}
                return session;
            }

            // Check expiry
            if (expiresAt < Date.now()) {
                console.warn('Session hết hạn — tự động đăng xuất');
                this.clearSession();
                return null;
            }
            return session;
        },

        /**
         * Xoá session
         */
        clearSession() {
            try {
                localStorage.removeItem(SESSION_KEY);
            } catch (e) {}
        },

        /**
         * Kiểm tra session còn hạn không. Gọi lúc page load.
         * Nếu hết hạn → xoá + trả về false
         */
        checkSession() {
            const s = this.getSession();
            return s !== null;
        },

        /**
         * Còn bao nhiêu ms tới khi hết hạn (số âm = đã hết hạn)
         */
        msUntilExpiry() {
            const s = this.getSession();
            if (!s || typeof s.sessionExpiresAt !== 'number') return -1;
            return s.sessionExpiresAt - Date.now();
        },

        /**
         * Có cần cảnh báo user trước khi hết hạn không (< 5 phút)
         */
        needsWarning() {
            const ms = this.msUntilExpiry();
            return ms > 0 && ms < WARNING_BEFORE_MS;
        },

        /**
         * Gia hạn session thêm 10 năm (TTL đầy đủ, gọi khi user có action)
         */
        refresh() {
            const s = this.getSession();
            if (!s) return false;
            return this.saveSession(s);
        },

        /**
         * Hiển thị modal cảnh báo (gọi 1 lần)
         */
        showExpiryWarning() {
            // Inject CSS nếu chưa có
            if (!document.getElementById('session-warning-css')) {
                const css = document.createElement('style');
                css.id = 'session-warning-css';
                css.textContent = `
                    .session-warning-banner {
                        position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
                        background: linear-gradient(135deg, #F59E0B, #EF4444);
                        color: white; padding: 12px 20px; text-align: center;
                        font-family: system-ui, sans-serif; font-size: 14px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        display: flex; align-items: center; justify-content: center;
                        gap: 16px;
                    }
                    .session-warning-banner button {
                        background: white; color: #EF4444; border: none;
                        padding: 6px 16px; border-radius: 6px; font-weight: 700;
                        cursor: pointer;
                    }
                    .session-warning-banner button:hover { transform: scale(1.05); }
                `;
                document.head.appendChild(css);
            }

            // Tránh trùng lặp
            if (document.getElementById('session-warning-banner')) return;

            const banner = document.createElement('div');
            banner.id = 'session-warning-banner';
            banner.className = 'session-warning-banner';
            const minutes = Math.ceil(this.msUntilExpiry() / 60000);
            banner.innerHTML = `
                <span>⚠️ Phiên đăng nhập sẽ hết hạn sau <b>${minutes} phút</b>. Bạn có muốn tiếp tục?</span>
                <button type="button" id="session-refresh-btn">Gia hạn</button>
                <button type="button" id="session-logout-btn">Đăng xuất</button>
            `;
            document.body.appendChild(banner);

            document.getElementById('session-refresh-btn').onclick = () => {
                this.refresh();
                banner.remove();
                console.log('Session đã gia hạn');
            };
            document.getElementById('session-logout-btn').onclick = () => {
                banner.remove();
                this.clearSession();
                if (typeof logout === 'function') logout();
                else window.location.href = 'index.html';
            };
        },

        /**
         * Auto-check định kỳ — ĐÃ TẮT (yêu cầu: bỏ autologout).
         * Trước đây setInterval 30s kiểm tra expiry và redirect về trang login.
         * Phiên admin giờ không tự hết hạn; nếu cần đăng xuất thì dùng nút "Đăng xuất" thủ công.
         * Bảo mật vẫn được đảm bảo nhờ validate sessionToken với server (firebase-config.js).
         */
        startMonitoring() {
            // Đảm bảo session tồn tại (không redirect, không tự logout)
            this.checkSession();
            // Không khởi tạo interval — không auto-logout
            return true;
        },

        safeParse: safeParse
    };

    global.SessionSecurity = SessionSecurity;
})(window);