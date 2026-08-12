/**
 * SKY EDU - Rank System (10 cấp)
 * Hệ thống rank mới, hoạt động độc lập với Gamification.LEVELS cũ
 * để không phá code cũ.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'skyedu_ranks_v1';

    // Bảng 10 cấp theo yêu cầu
    const DEFAULT_RANKS = [
        { level: 1,  name: 'Tân Binh',                icon: '🌱', color: '#94A3B8', minXP: 0 },
        { level: 2,  name: 'Học Viên',                icon: '📖', color: '#22C55E', minXP: 500 },
        { level: 3,  name: 'Chuyên Cần',              icon: '✍️', color: '#3B82F6', minXP: 1000 },
        { level: 4,  name: 'Chiến Binh Kiến Thức',    icon: '🔥', color: '#8B5CF6', minXP: 3000 },
        { level: 5,  name: 'Người Bứt Phá',           icon: '🚀', color: '#F59E0B', minXP: 5000 },
        { level: 6,  name: 'Học Bá',                  icon: '💎', color: '#EF4444', minXP: 10000 },
        { level: 7,  name: 'Cao Thủ',                 icon: '🧠', color: '#EC4899', minXP: 18000 },
        { level: 8,  name: 'Thủ Khoa',                icon: '👑', color: '#F97316', minXP: 25000 },
        { level: 9,  name: 'Nhà Vô Địch',             icon: '⚡', color: '#6366F1', minXP: 40000 },
        { level: 10, name: 'Huyền Thoại SKY',         icon: '🌌', color: '#FFD700', minXP: 50000 }
    ];

    const RankSystem = {
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_RANKS: DEFAULT_RANKS,

        /**
         * Lấy danh sách rank (kết hợp với override từ admin)
         */
        getAll() {
            const overrides = this._getOverrides();
            return DEFAULT_RANKS.map(r => {
                const ov = overrides[r.level];
                return ov ? Object.assign({}, r, ov) : r;
            });
        },

        /**
         * Lấy rank theo XP
         * Trả về: { current, next, progress, xpInLevel, xpNeeded }
         */
        getByXP(xp) {
            const ranks = this.getAll();
            xp = Math.max(0, parseInt(xp) || 0);
            let current = ranks[0];
            let next = null;

            for (let i = ranks.length - 1; i >= 0; i--) {
                if (xp >= ranks[i].minXP) {
                    current = ranks[i];
                    next = ranks[i + 1] || null;
                    break;
                }
            }

            const xpInLevel = xp - current.minXP;
            const xpNeeded = next ? (next.minXP - current.minXP) : 1;
            const progress = next ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;

            return {
                current: current,
                next: next,
                xpInLevel: xpInLevel,
                xpNeeded: xpNeeded,
                progress: progress,
                level: current.level,
                xp: xp
            };
        },

        /**
         * Lấy rank theo level
         */
        getByLevel(level) {
            const ranks = this.getAll();
            return ranks[Math.max(0, Math.min(level - 1, ranks.length - 1))] || ranks[0];
        },

        /**
         * HTML cho rank badge
         */
        getBadgeHTML(rank, opts = {}) {
            if (!rank) return '';
            const small = opts.small ? ' sky-rank-badge-sm' : '';
            return `<span class="sky-rank-badge${small}" style="--rank-color:${rank.color}">
                <span class="sky-rank-icon">${rank.icon}</span>
                <span class="sky-rank-name">${rank.name}</span>
            </span>`;
        },

        /**
         * Lấy progress bar HTML
         */
        getProgressHTML(info) {
            if (!info) return '';
            if (!info.next) {
                return `<div class="sky-rank-progress">
                    <div class="sky-rank-progress-bar" style="width:100%; background: linear-gradient(90deg, ${info.current.color}, #FFD700);"></div>
                    <div class="sky-rank-progress-label">Đã đạt cấp tối đa! 🌌</div>
                </div>`;
            }
            return `<div class="sky-rank-progress">
                <div class="sky-rank-progress-info">
                    <span>${info.current.icon} ${info.current.name}</span>
                    <span>${info.next.icon} ${info.next.name}</span>
                </div>
                <div class="sky-rank-progress-bar-bg">
                    <div class="sky-rank-progress-bar" style="width:${info.progress}%; background: linear-gradient(90deg, ${info.current.color}, ${info.next.color});">
                        <span class="sky-rank-progress-text">${info.progress}%</span>
                    </div>
                </div>
                <div class="sky-rank-progress-label">${info.xpInLevel} / ${info.xpNeeded} XP tới ${info.next.name}</div>
            </div>`;
        },

        /**
         * Admin: cập nhật XP yêu cầu cho 1 rank
         */
        updateRankMinXP(level, newMinXP) {
            const overrides = this._getOverrides();
            overrides[level] = Object.assign({}, overrides[level] || {}, { minXP: newMinXP });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
            window.dispatchEvent(new CustomEvent('rankUpdate', { detail: { level, minXP: newMinXP } }));
        },

        /**
         * Admin: reset toàn bộ override về mặc định
         */
        resetAll() {
            localStorage.removeItem(STORAGE_KEY);
            window.dispatchEvent(new CustomEvent('rankUpdate', { detail: { reset: true } }));
        },

        /**
         * Kiểm tra có lên rank không
         * Trả về: { leveledUp, from: RankInfo, to: RankInfo }
         *   RankInfo = { current: RankObject, next, progress, level, xp }
         */
        checkLevelUp(oldXP, newXP) {
            const oldRank = this.getByXP(oldXP);
            const newRank = this.getByXP(newXP);
            if (newRank.level > oldRank.level) {
                return { leveledUp: true, from: oldRank, to: newRank };
            }
            return { leveledUp: false };
        },

        _getOverrides() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            } catch (e) {
                return {};
            }
        }
    };

    // Inject CSS cho rank
    const rankCSS = `
        .sky-rank-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: color-mix(in srgb, var(--rank-color) 12%, transparent);
            border: 1.5px solid color-mix(in srgb, var(--rank-color) 40%, transparent);
            color: var(--rank-color);
            border-radius: 999px;
            font-weight: 700;
            font-size: 13px;
            line-height: 1;
            transition: all .2s;
        }
        .sky-rank-badge:hover { transform: translateY(-1px); box-shadow: 0 6px 16px color-mix(in srgb, var(--rank-color) 30%, transparent); }
        .sky-rank-badge-sm { padding: 3px 8px; font-size: 11px; }
        .sky-rank-icon { font-size: 1.1em; }

        .sky-rank-progress { margin-top: 8px; }
        .sky-rank-progress-info {
            display: flex; justify-content: space-between;
            font-size: 12px; font-weight: 600;
            color: var(--text-secondary, #475569);
            margin-bottom: 6px;
        }
        .sky-rank-progress-bar-bg {
            width: 100%; height: 10px;
            background: var(--bg-tertiary, #E2E8F0);
            border-radius: 999px; overflow: hidden;
        }
        .sky-rank-progress-bar {
            height: 100%; border-radius: 999px;
            display: flex; align-items: center; justify-content: flex-end;
            padding-right: 8px;
            transition: width 1s ease;
        }
        .sky-rank-progress-text {
            color: white; font-size: 10px; font-weight: 700;
        }
        .sky-rank-progress-label {
            font-size: 11px; color: var(--text-muted, #94A3B8);
            margin-top: 4px; text-align: center;
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = rankCSS;
    document.head.appendChild(styleEl);

    global.RankSystem = RankSystem;
})(window);
