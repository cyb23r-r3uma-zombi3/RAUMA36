/**
 * SKY EDU - Role System
 *
 * 5 role: admin, owner, qtv, HSA, TSA, user
 *  - admin / owner: full quyền + auto có HSA + TSA
 *  - qtv:           tạo câu hỏi + tạo đề HSA + TSA (free)
 *  - HSA:           được vào phòng luyện HSA
 *  - TSA:           được vào phòng luyện TSA
 *  - user:          mặc định, không có quyền gì đặc biệt
 *
 * User có thể mang nhiều role (field `roles: []`); field `role` đơn giữ
 * để tương thích ngược với code cũ.
 */
(function (global) {
    'use strict';

    const ROLES = {
        ADMIN: 'admin',
        OWNER: 'owner',
        QTV:   'qtv',
        HSA:   'HSA',
        TSA:   'TSA',
        USER:  'user'
    };

    // Role hệ thống (cấp quyền quản trị)
    const SYSTEM_ROLES = [ROLES.ADMIN, ROLES.OWNER, ROLES.QTV];

    // Role gói học (cấp quyền vào phòng luyện)
    const PACKAGE_ROLES = [ROLES.HSA, ROLES.TSA];

    // Định nghĩa permissions cho từng role
    const PERMISSION_MATRIX = {
        admin: {
            canAccessAdmin:     true,
            canManageUsers:     true,
            canVerifyPayments:  true,
            canManageSite:      true,
            canCreateQuestions: true,
            canEditQuestions:   true,
            canDeleteQuestions: true,
            canCreateExams:     true,
            canEditExams:       true,
            canDeleteExams:     true,
            canAccessHSA:       true,
            canAccessTSA:       true
        },
        owner: {
            canAccessAdmin:     true,
            canManageUsers:     true,
            canVerifyPayments:  true,
            canManageSite:      true,
            canCreateQuestions: true,
            canEditQuestions:   true,
            canDeleteQuestions: true,
            canCreateExams:     true,
            canEditExams:       true,
            canDeleteExams:     true,
            canAccessHSA:       true,
            canAccessTSA:       true
        },
        qtv: {
            canAccessAdmin:     false,
            canManageUsers:     false,
            canVerifyPayments:  false,
            canManageSite:      false,
            canCreateQuestions: true,
            canEditQuestions:   true,
            canDeleteQuestions: false,
            canCreateExams:     true,
            canEditExams:       true,
            canDeleteExams:     false,
            canAccessHSA:       true,
            canAccessTSA:       true
        },
        HSA: {
            canAccessAdmin:     false,
            canManageUsers:     false,
            canVerifyPayments:  false,
            canManageSite:      false,
            canCreateQuestions: false,
            canEditQuestions:   false,
            canDeleteQuestions: false,
            canCreateExams:     false,
            canEditExams:       false,
            canDeleteExams:     false,
            canAccessHSA:       true,
            canAccessTSA:       false
        },
        TSA: {
            canAccessAdmin:     false,
            canManageUsers:     false,
            canVerifyPayments:  false,
            canManageSite:      false,
            canCreateQuestions: false,
            canEditQuestions:   false,
            canDeleteQuestions: false,
            canCreateExams:     false,
            canEditExams:       false,
            canDeleteExams:     false,
            canAccessHSA:       false,
            canAccessTSA:       true
        },
        user: {
            canAccessAdmin:     false,
            canManageUsers:     false,
            canVerifyPayments:  false,
            canManageSite:      false,
            canCreateQuestions: false,
            canEditQuestions:   false,
            canDeleteQuestions: false,
            canCreateExams:     false,
            canEditExams:       false,
            canDeleteExams:     false,
            canAccessHSA:       false,
            canAccessTSA:       false
        }
    };

    const RoleSystem = {
        ROLES: ROLES,
        SYSTEM_ROLES: SYSTEM_ROLES,
        PACKAGE_ROLES: PACKAGE_ROLES,
        PERMISSION_MATRIX: PERMISSION_MATRIX,

        /**
         * Chuẩn hoá user object về dạng:
         *  { role, roles: [], permissions: {} }
         */
        normalize(user) {
            if (!user) user = {};
            const roles = this._extractRoles(user);
            const primaryRole = roles.find(r => SYSTEM_ROLES.includes(r))
                             || roles.find(r => PACKAGE_ROLES.includes(r))
                             || ROLES.USER;
            return {
                ...user,
                role: primaryRole,
                roles: roles,
                permissions: this.getPermissions(roles)
            };
        },

        /**
         * Lấy mảng roles từ user (kết hợp role đơn + roles mảng)
         */
        _extractRoles(user) {
            const set = new Set();
            if (Array.isArray(user.roles)) user.roles.forEach(r => r && set.add(r));
            if (user.role) set.add(user.role);
            // Legacy: moderator -> qtv
            if (set.has('moderator')) { set.delete('moderator'); set.add(ROLES.QTV); }
            // Auto: admin/owner -> +HSA +TSA
            if (set.has(ROLES.ADMIN) || set.has(ROLES.OWNER)) {
                set.add(ROLES.HSA); set.add(ROLES.TSA);
            }
            // Auto: qtv -> +HSA +TSA (free)
            if (set.has(ROLES.QTV)) {
                set.add(ROLES.HSA); set.add(ROLES.TSA);
            }
            // Bỏ 'user' nếu có role khác (tránh rỗng)
            if (set.size > 1) set.delete(ROLES.USER);
            if (set.size === 0) set.add(ROLES.USER);
            return Array.from(set);
        },

        /**
         * Tính permission từ roles (gộp OR tất cả role)
         */
        getPermissions(roles) {
            const result = {};
            const list = Array.isArray(roles) ? roles : [roles];
            Object.keys(PERMISSION_MATRIX[ROLES.USER]).forEach(key => { result[key] = false; });
            list.forEach(r => {
                const p = PERMISSION_MATRIX[r];
                if (!p) return;
                Object.keys(p).forEach(k => { if (p[k]) result[k] = true; });
            });
            return result;
        },

        /** Kiểm tra user có role cụ thể không */
        hasRole(user, role) {
            if (!user) return false;
            const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
            return roles.includes(role);
        },

        /** Kiểm tra user có 1 trong các role không */
        hasAnyRole(user, roleList) {
            if (!user || !Array.isArray(roleList)) return false;
            const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
            return roles.some(r => roleList.includes(r));
        },

        /** Kiểm tra user có permission không */
        can(user, perm) {
            if (!user) return false;
            const perms = user.permissions || this.getPermissions(this._extractRoles(user));
            return !!perms[perm];
        },

        /**
         * Lấy user hiện tại từ localStorage (đã normalize)
         */
        getCurrentUser() {
            try {
                const raw = localStorage.getItem('currentUser');
                // safeParse tránh crash khi localStorage bị corrupt
                if (typeof SessionSecurity !== 'undefined' && SessionSecurity.safeParse) {
                    return this.normalize(SessionSecurity.safeParse(raw, null));
                }
                return this.normalize(raw ? JSON.parse(raw) : null);
            } catch (e) {
                console.warn('RoleSystem.getCurrentUser failed:', e.message);
                return null;
            }
        },

        /**
         * Lưu user vào localStorage (giữ nguyên cấu trúc cũ + thêm roles[])
         */
        saveCurrentUser(user) {
            const normalized = this.normalize(user);
            localStorage.setItem('currentUser', JSON.stringify(normalized));
            return normalized;
        },

        /**
         * Gán role cho user (dùng cho admin grant thủ công)
         */
        grantRole(user, roleToAdd) {
            const roles = Array.isArray(user.roles) ? [...user.roles] : (user.role ? [user.role] : []);
            if (!roles.includes(roleToAdd)) roles.push(roleToAdd);
            user.roles = roles;
            user.role = roles.find(r => SYSTEM_ROLES.includes(r))
                     || roles.find(r => PACKAGE_ROLES.includes(r))
                     || ROLES.USER;
            return this.normalize(user);
        },

        /**
         * Thu hồi role
         */
        revokeRole(user, roleToRemove) {
            if (!Array.isArray(user.roles)) user.roles = user.role ? [user.role] : [];
            user.roles = user.roles.filter(r => r !== roleToRemove);
            if (user.role === roleToRemove) {
                user.role = user.roles.find(r => SYSTEM_ROLES.includes(r))
                         || user.roles.find(r => PACKAGE_ROLES.includes(r))
                         || ROLES.USER;
            }
            return this.normalize(user);
        },

        /**
         * Map từ mã gói học → role
         *   HSA01, HSA02, HSA03 → HSA
         *   TSA01, TSA02, TSA03 → TSA
         */
        packageCodeToRole(code) {
            if (!code || typeof code !== 'string') return null;
            const c = code.toUpperCase().trim();
            if (c.startsWith('HSA')) return ROLES.HSA;
            if (c.startsWith('TSA')) return ROLES.TSA;
            return null;
        },

        /**
         * Render badge HTML cho role
         */
        getRoleBadge(role, opts = {}) {
            const meta = {
                admin: { label: 'Admin',     icon: '👑', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
                owner: { label: 'Owner',     icon: '👑', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
                qtv:   { label: 'QTV',       icon: '🛡️', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
                HSA:   { label: 'HSA',       icon: '🎓', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
                TSA:   { label: 'TSA',       icon: '📘', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                user:  { label: 'Thành viên', icon: '👤', color: '#64748B', bg: 'rgba(100,116,139,0.12)' }
            }[role] || { label: role, icon: '🏷️', color: '#64748B', bg: 'rgba(100,116,139,0.12)' };

            const small = opts.small ? ' role-badge-sm' : '';
            return `<span class="role-badge${small}" style="color:${meta.color}; background:${meta.bg}; border:1px solid color-mix(in srgb, ${meta.color} 40%, transparent);">
                <span class="role-badge-icon">${meta.icon}</span>
                <span class="role-badge-label">${meta.label}</span>
            </span>`;
        },

        /**
         * Render tất cả role badges của user
         */
        getRoleBadgesAll(user, opts = {}) {
            const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
            return roles.map(r => this.getRoleBadge(r, opts)).join(' ');
        }
    };

    // Inject CSS cho role badges
    const css = `
        .role-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 12px;
            line-height: 1.2;
            white-space: nowrap;
        }
        .role-badge-sm { padding: 2px 7px; font-size: 10px; gap: 3px; }
        .role-badge-icon { font-size: 1.1em; line-height: 1; }
        .role-badge-label { letter-spacing: 0.2px; }

        /* Role-restricted UI: ẩn theo data-requires-role, dùng inline-flex để thắng flex */
        [data-requires-role] { display: none !important; }
        body.role-hsa [data-requires-role~="HSA"],
        body.role-tsa [data-requires-role~="TSA"],
        body.role-qtv [data-requires-role~="qtv"],
        body.role-admin [data-requires-role~="admin"],
        body.role-owner [data-requires-role~="owner"],
        body.role-hsa [data-requires-role~="hsa-or-tsa"],
        body.role-tsa [data-requires-role~="hsa-or-tsa"],
        body.role-qtv [data-requires-role~="hsa-or-tsa"],
        body.role-admin [data-requires-role~="hsa-or-tsa"],
        body.role-owner [data-requires-role~="hsa-or-tsa"],
        body.role-admin [data-requires-role~="admin-or-qtv"],
        body.role-owner [data-requires-role~="admin-or-qtv"],
        body.role-qtv [data-requires-role~="admin-or-qtv"] {
            display: inline-flex !important;
        }
    `;
    if (typeof document !== 'undefined') {
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    global.RoleSystem = RoleSystem;
})(window);