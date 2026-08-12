/* ============================================================
 * SKY EDU - Shared Navbar Component
 * ------------------------------------------------------------
 * Single source of truth cho navbar trên mọi trang.
 *
 * Cách dùng:
 *   <header class="navbar" id="navbar">
 *       <div id="app-navbar"></div>
 *   </header>
 *   <script src="assets/js/navbar.js" data-base="./"></script>
 *
 *   - data-base: đường dẫn tương đối tới root (mặc định "./").
 *                Đặt "../" khi include từ thư mục con (vd: phong-luyen-hsa/).
 *   - Khi render, navbar sẽ tự:
 *       + Active đúng link theo đường dẫn hiện tại
 *       + Hiển thị nút Đăng nhập / Đăng ký nếu CHƯA đăng nhập
 *       + Hiển thị dropdown user (avatar + tên + menu) nếu ĐÃ đăng nhập
 *       + Bind scroll effect, mobile menu, dropdown, theme toggle, logout
 *       + Lắng nghe event "userLogin" / "userLogout" để cập nhật
 * ============================================================ */
(function () {
    'use strict';

    /* ------------------------------------------------------------
     * 1. Khai báo menu (label + icon + path tương đối tới root)
     * ------------------------------------------------------------ */
    const MENU_ITEMS = [
        { key: 'home', label: 'Trang chủ', icon: 'lucide:home', href: 'index.html' }
    ];

    /* ------------------------------------------------------------
     * 2. Helpers
     * ------------------------------------------------------------ */
    function getBase() {
        const tag = document.currentScript || document.querySelector('script[data-base]');
        if (tag && tag.getAttribute('data-base')) return tag.getAttribute('data-base');
        return './';
    }

    function normalizePath(p) {
        return String(p || '').replace(/\/+$/, '');
    }

    function getCurrentPath() {
        // Lấy path tương đối của trang hiện tại so với root
        // window.location.pathname có thể trả "/SkyEdu-main/phong-luyen-hsa/index.html"
        const path = window.location.pathname;
        // Cắt phần đầu cho đến thư mục SkyEdu-main (hoặc tương đương)
        const segments = path.split('/').filter(Boolean);
        // Nếu file nằm trong subfolder, segments sẽ có dạng [folder, file]
        // Nếu file ở root: [file]
        // Bỏ qua các segment là tên hosting path (vd: SkyEdu-main)
        const lastTwo = segments.slice(-2).join('/');
        return lastTwo;
    }

    function isActive(itemHref) {
        const cur = getCurrentPath();
        const target = normalizePath(itemHref);
        return cur === target || cur.endsWith('/' + target);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    function readUser() {
        try {
            if (typeof RoleSystem !== 'undefined' && typeof RoleSystem.getCurrentUser === 'function') {
                return RoleSystem.getCurrentUser();
            }
            const raw = localStorage.getItem('currentUser');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[navbar] readUser failed:', e);
            return null;
        }
    }

    function isAdmin(user) {
        if (!user) return false;
        if (typeof RoleSystem !== 'undefined' && typeof RoleSystem.hasAnyRole === 'function') {
            return RoleSystem.hasAnyRole(user, ['admin', 'owner', 'qtv']);
        }
        return ['admin', 'owner', 'qtv', 'moderator'].includes(user.role);
    }

    function isLightTheme() {
        try {
            const stored = localStorage.getItem('skyedu_theme');
            if (stored === 'lightpremium') return true;
            if (typeof window.Theme !== 'undefined' && window.Theme.currentTheme === 'lightpremium') return true;
        } catch (e) { console.error('[Navbar] Get user error:', e); }
        return false;
    }

    function userHasPackageAccess(user) {
        if (!user) return false;
        if (typeof RoleSystem !== 'undefined' && typeof RoleSystem.can === 'function') {
            return RoleSystem.can(user, 'canAccessHSA') || RoleSystem.can(user, 'canAccessTSA');
        }
        return false;
    }

    /* ------------------------------------------------------------
     * 3. Render navbar
     * ------------------------------------------------------------ */
    function renderNavbar() {
        const base = getBase();
        const host = document.getElementById('app-navbar');
        if (!host) return;

        const user = readUser();
        const isUserAdmin = isAdmin(user);
        const isLight = isLightTheme();

        // --- Menu items ---
        const menuHtml = MENU_ITEMS.map(item => {
            const active = isActive(item.href) ? ' active' : '';
            const reqAttr = item.requiresRole ? ` data-requires-role="${item.requiresRole}"` : '';
            return `<li><a href="${base}${item.href}" class="${active.trim()}"${reqAttr}>${escapeHtml(item.label)}</a></li>`;
        }).join('');

        // --- Auth area (right side) ---
        let authHtml;
        if (user) {
            const displayName = escapeHtml(user.fullname || user.username || 'Tài khoản');

            const dashboardHref = `${base}dashboard.html`;
            const profileHref   = `${base}account/tai-khoan.html`;
            const pwdHref       = `${base}account/doi-mat-khau.html`;
            const adminHref     = `${base}account/admin.html`;

            authHtml = `
                ${runPlugins('beforeUserDropdown')}
                <div class="user-dropdown" id="userDropdown">
                    <button class="user-dropdown-btn" id="userDropdownBtn" type="button" aria-haspopup="true" aria-expanded="false">
                        <iconify-icon icon="lucide:user" aria-hidden="true"></iconify-icon>
                        <span class="user-dropdown-name">${displayName}</span>
                        <iconify-icon icon="lucide:chevron-down" class="chev" aria-hidden="true"></iconify-icon>
                    </button>
                    <div class="user-dropdown-content" role="menu">
                        <a href="${dashboardHref}" class="dropdown-item" role="menuitem">
                            <iconify-icon icon="lucide:layout-dashboard" aria-hidden="true"></iconify-icon>
                            <span>Dashboard</span>
                        </a>
                        <a href="${profileHref}" class="dropdown-item" role="menuitem">
                            <iconify-icon icon="lucide:user-circle" aria-hidden="true"></iconify-icon>
                            <span>Hồ sơ cá nhân</span>
                        </a>
                        <a href="${pwdHref}" class="dropdown-item" role="menuitem">
                            <iconify-icon icon="lucide:key" aria-hidden="true"></iconify-icon>
                            <span>Đổi mật khẩu</span>
                        </a>
                        ${isUserAdmin ? `
                        <a href="${adminHref}" class="dropdown-item admin-only" role="menuitem">
                            <iconify-icon icon="lucide:shield" aria-hidden="true"></iconify-icon>
                            <span>Admin Panel</span>
                        </a>
                        ` : ''}
                        <div class="dropdown-divider"></div>
                        <button type="button" id="navbarLogout" class="dropdown-item logout" role="menuitem" onclick="if(window.SkyNavbar) window.SkyNavbar.logout();">
                            <iconify-icon icon="lucide:log-out" aria-hidden="true"></iconify-icon>
                            <span>Đăng xuất</span>
                        </button>
                    </div>
                </div>
                <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Mở menu" title="Mở menu điều hướng" aria-expanded="false">
                    <span></span><span></span><span></span>
                </button>
                ${runPlugins('afterMobileMenu')}
            `;
        } else {
            authHtml = `
                ${runPlugins('beforeUserDropdown')}
                <a href="${base}account/dang-nhap.html" class="btn-ghost nav-auth-btn">Đăng nhập</a>
                <a href="${base}account/dang-ky.html" class="btn-primary-sm nav-auth-btn">Đăng ký</a>
                <button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-label="Mở menu" title="Mở menu điều hướng" aria-expanded="false">
                    <span></span><span></span><span></span>
                </button>
                ${runPlugins('afterMobileMenu')}
            `;
        }

        host.innerHTML = `
            <div class="navbar-content">
                <a href="${base}index.html" class="logo-wrap" aria-label="SKY EDU - Trang chủ">
                    <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M6 26C12 26 18 22 22 16C24 13 26 9 28 4C23 6 19 8 16 10C10 14 6 20 6 26Z" fill="#38BDF8"/>
                        <path d="M10 26C14 26 18 23 21 19C22.5 17 24 14 25 11C21 12 18 13.5 16 15C12 18 10 22 10 26Z" fill="#1677FF"/>
                    </svg>
                    <div class="logo-text">
                        <span class="logo-title">SKY EDU</span>
                        <span class="logo-subtitle">Fly Higher • Think Better</span>
                    </div>
                </a>

                <nav class="nav-center" id="navCenter">
                    <ul class="nav-links" id="navLinks">${menuHtml}</ul>
                </nav>

                <div class="nav-actions" id="navActions">${authHtml}</div>
            </div>
        `;

        // Apply role-based classes lên body (để [data-requires-role] hoạt động)
        applyRoleClasses(user);

        // Bind handlers
        bindInteractions(user);
    }

    /* ------------------------------------------------------------
     * 4. Apply role classes to <body>
     * ------------------------------------------------------------ */
    function applyRoleClasses(user) {
        try {
            document.body.classList.remove('role-admin', 'role-owner', 'role-qtv', 'role-hsa', 'role-tsa', 'role-user', 'role-none');
            if (!user) {
                document.body.classList.add('role-none');
                return;
            }
            const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
            roles.forEach(r => {
                if (!r) return;
                document.body.classList.add('role-' + String(r).toLowerCase());
            });
            if (roles.length === 0) document.body.classList.add('role-user');
        } catch (e) { console.error('[Navbar] Init error:', e); }
    }

    /* ------------------------------------------------------------
     * 5. Bind interactions
     * ------------------------------------------------------------ */
    function bindInteractions(initialUser) {
        // -- Navbar scroll effect
        const navbar = document.getElementById('navbar');
        if (navbar) {
            const onScroll = () => {
                if (window.pageYOffset > 50) navbar.classList.add('scrolled');
                else navbar.classList.remove('scrolled');
            };
            onScroll();
            window.addEventListener('scroll', onScroll, { passive: true });
        }

        // -- Mobile menu toggle
        const mobileBtn = document.getElementById('mobileMenuBtn');
        const navCenter = document.getElementById('navCenter');
        if (mobileBtn && navCenter) {
            mobileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navCenter.classList.toggle('active');
                mobileBtn.classList.toggle('active');
                const open = navCenter.classList.contains('active');
                const menuLabel = open ? 'Đóng menu' : 'Mở menu';
                mobileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                mobileBtn.setAttribute('aria-label', menuLabel);
                mobileBtn.setAttribute('title', `${menuLabel} điều hướng`);
                
                // Toggle body scroll lock when menu is open
                document.body.style.overflow = open ? 'hidden' : '';
                
                // Create close button if not exists
                let closeBtn = navCenter.querySelector('.mobile-menu-close');
                if (open && !closeBtn) {
                    closeBtn = document.createElement('button');
                    closeBtn.className = 'mobile-menu-close';
                    closeBtn.setAttribute('type', 'button');
                    closeBtn.setAttribute('aria-label', 'Đóng menu');
                    closeBtn.innerHTML = '&times;';
                    closeBtn.addEventListener('click', closeMobileMenu);
                    navCenter.insertBefore(closeBtn, navCenter.firstChild);
                }
            });
            // Đóng menu khi click 1 link bên trong
            navCenter.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', () => {
                    closeMobileMenu();
                });
            });
        }
        
        function closeMobileMenu() {
            const navCenter = document.getElementById('navCenter');
            const mobileBtn = document.getElementById('mobileMenuBtn');
            if (navCenter) navCenter.classList.remove('active');
            if (mobileBtn) {
                mobileBtn.classList.remove('active');
                mobileBtn.setAttribute('aria-expanded', 'false');
                mobileBtn.setAttribute('aria-label', 'Mở menu');
                mobileBtn.setAttribute('title', 'Mở menu điều hướng');
            }
            document.body.style.overflow = '';
        }

        // -- Esc để đóng dropdown + mobile menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (userDropdown) userDropdown.classList.remove('open');
                if (navCenter && navCenter.classList.contains('active')) {
                    closeMobileMenu();
                }
            }
        });

    /* ------------------------------------------------------------
     * 6. Logout (chuẩn hoá từ index.html)
     * ------------------------------------------------------------ */
    function doLogout(currentUser) {
        try { localStorage.removeItem('currentUser'); } catch (e) { console.error('[Navbar] Logout error:', e); }
        // Lưu ý: trang account có thể cần đăng xuất khỏi Firebase. Best-effort:
        if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
                const p = firebase.auth().signOut().catch(e => console.warn('[navbar] signOut:', e));
                if (p && typeof p.then === 'function') {
                    p.then(() => { window.location.href = getBase() + 'account/dang-nhap.html'; });
                    return;
                }
            } catch (e) { console.error('[Navbar] Handle logout error:', e); }
        }
        window.location.href = getBase() + 'account/dang-nhap.html';
    }

    /* ------------------------------------------------------------
     * 7. Plugin slots (cho phép các trang thêm nội dung vào navbar)
     * ------------------------------------------------------------
     * Sử dụng:
     *   window.SkyNavbar.beforeUserDropdown(htmlString);  // thêm trước dropdown / auth buttons
     *   window.SkyNavbar.afterMobileMenu(htmlString);     // thêm sau mobile menu button
     */
    const _plugins = { beforeUserDropdown: [], afterMobileMenu: [] };

    function runPlugins(slot) {
        return (_plugins[slot] || []).join('');
    }

    /* ------------------------------------------------------------
     * 8. Khởi tạo
     * ------------------------------------------------------------ */
    function init() {
        renderNavbar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-render khi auth state đổi (sau khi đăng nhập thành công ở trang khác)
    window.addEventListener('userLogin', () => renderNavbar());
    window.addEventListener('userLogout', () => renderNavbar());
    window.addEventListener('storage', (e) => {
        if (e.key === 'currentUser' || e.key === 'skyedu_theme') renderNavbar();
    });
    window.addEventListener('themeChange', () => renderNavbar());

    window.SkyNavbar = {
        refresh: renderNavbar,
        logout: doLogout,
        getCurrentUser: readUser,
        beforeUserDropdown(html) {
            if (typeof html === 'string') _plugins.beforeUserDropdown.push(html);
            renderNavbar();
        },
        afterMobileMenu(html) {
            if (typeof html === 'string') _plugins.afterMobileMenu.push(html);
            renderNavbar();
        },
        clearPlugins() {
            _plugins.beforeUserDropdown.length = 0;
            _plugins.afterMobileMenu.length = 0;
            renderNavbar();
        }
    };

})();