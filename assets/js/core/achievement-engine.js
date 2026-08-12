/**
 * SKY EDU - Achievement Engine
 * CRUD badge với điều kiện linh hoạt, lưu localStorage
 * Tương thích ngược: nếu rỗng, tự seed 8 badge mặc định
 * tương ứng Gamification.BADGES cũ.
 */
(function (global) {
    'use strict';

    const STORAGE_KEY = 'skyedu_achievements';

    const DEFAULT_ACHIEVEMENTS = [
        { id: 'first_exam',   name: 'Khởi đầu',         icon: '🎯', description: 'Làm bài thi đầu tiên',           condition: { type: 'totalExams', value: 1 } },
        { id: 'exam_10',      name: 'Sĩ quan',          icon: '🎖️', description: 'Hoàn thành 10 bài thi',            condition: { type: 'totalExams', value: 10 } },
        { id: 'exam_50',      name: 'Thiếu tá',         icon: '⭐', description: 'Hoàn thành 50 bài thi',            condition: { type: 'totalExams', value: 50 } },
        { id: 'perfect_score',name: 'Hoàn hảo',         icon: '💯', description: 'Đạt 100% một bài thi',             condition: { type: 'bestScore', value: 100 } },
        { id: 'streak_7',     name: 'Kiên trì',         icon: '🔥', description: '7 ngày học liên tiếp',            condition: { type: 'streak', value: 7 } },
        { id: 'streak_30',    name: 'Tháng thần',       icon: '👑', description: '30 ngày học liên tiếp',           condition: { type: 'streak', value: 30 } },
        { id: 'xp_5000',      name: 'Cử nhân',          icon: '🏅', description: 'Tích lũy 5,000 XP',                condition: { type: 'totalXP', value: 5000 } },
        { id: 'xp_25000',     name: 'Thủ Khoa',         icon: '👑', description: 'Tích lũy 25,000 XP',               condition: { type: 'totalXP', value: 25000 } },
        { id: 'q_100',        name: '100 câu đầu tiên', icon: '🏆', description: 'Đã làm 100 câu hỏi',              condition: { type: 'totalQuestions', value: 100 } },
        { id: 'q_1000',       name: '1000 câu hỏi',     icon: '💎', description: 'Đã làm 1000 câu hỏi',             condition: { type: 'totalQuestions', value: 1000 } }
    ];

    const AchievementEngine = {
        STORAGE_KEY: STORAGE_KEY,
        DEFAULT_ACHIEVEMENTS: DEFAULT_ACHIEVEMENTS,

        /**
         * Lấy danh sách achievement (seed mặc định nếu rỗng)
         */
        list() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) {
                    this._save(DEFAULT_ACHIEVEMENTS);
                    return DEFAULT_ACHIEVEMENTS.slice();
                }
                return JSON.parse(raw);
            } catch (e) {
                return DEFAULT_ACHIEVEMENTS.slice();
            }
        },

        /**
         * Lấy 1 achievement theo id
         */
        get(id) {
            return this.list().find(a => a.id === id) || null;
        },

        /**
         * Tạo mới
         */
        create(data) {
            const list = this.list();
            const newItem = Object.assign({}, data, {
                id: data.id || ('ach_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7))
            });
            list.push(newItem);
            this._save(list);
            window.dispatchEvent(new CustomEvent('achievementUpdate', { detail: { action: 'create', item: newItem } }));
            return newItem;
        },

        /**
         * Cập nhật
         */
        update(id, updates) {
            const list = this.list();
            const idx = list.findIndex(a => a.id === id);
            if (idx === -1) return null;
            list[idx] = Object.assign({}, list[idx], updates);
            this._save(list);
            window.dispatchEvent(new CustomEvent('achievementUpdate', { detail: { action: 'update', item: list[idx] } }));
            return list[idx];
        },

        /**
         * Xoá
         */
        remove(id) {
            const list = this.list().filter(a => a.id !== id);
            this._save(list);
            window.dispatchEvent(new CustomEvent('achievementUpdate', { detail: { action: 'remove', id } }));
        },

        /**
         * Reset về mặc định
         */
        reset() {
            localStorage.removeItem(STORAGE_KEY);
            window.dispatchEvent(new CustomEvent('achievementUpdate', { detail: { action: 'reset' } }));
        },

        /**
         * Đánh giá user stats, trả về danh sách id đã đạt
         * stats: { totalExams, totalXP, streak, bestScore, totalQuestions }
         */
        evaluate(stats) {
            stats = stats || {};
            return this.list()
                .filter(a => this._checkCondition(a.condition, stats))
                .map(a => a.id);
        },

        /**
         * Render HTML danh sách badge
         */
        renderList(earnedIds, opts = {}) {
            const list = this.list();
            const showAll = opts.showAll !== false;
            return list.map(a => {
                const earned = earnedIds && earnedIds.includes(a.id);
                return `<div class="sky-ach-item ${earned ? 'earned' : 'locked'}" data-id="${a.id}" title="${a.description}">
                    <div class="sky-ach-icon">${earned ? a.icon : '🔒'}</div>
                    <div class="sky-ach-name">${a.name}</div>
                    <div class="sky-ach-desc">${a.description}</div>
                </div>`;
            }).join('');
        },

        /**
         * Nhóm: đã đạt và chưa đạt
         */
        renderGrouped(earnedIds) {
            const list = this.list();
            const earned = list.filter(a => earnedIds && earnedIds.includes(a.id));
            const locked = list.filter(a => !(earnedIds && earnedIds.includes(a.id)));
            return {
                earned: this.renderList(earnedIds, { showAll: true }),
                locked: locked.map(a => `<div class="sky-ach-item locked" data-id="${a.id}" title="${a.description}">
                    <div class="sky-ach-icon">🔒</div>
                    <div class="sky-ach-name">${a.name}</div>
                    <div class="sky-ach-desc">${a.description}</div>
                </div>`).join(''),
                earnedCount: earned.length,
                totalCount: list.length
            };
        },

        _save(list) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
        },

        _checkCondition(cond, stats) {
            if (!cond || !cond.type) return false;
            switch (cond.type) {
                case 'totalExams':     return (stats.totalExams || 0) >= (cond.value || 0);
                case 'totalXP':        return (stats.totalXP || 0) >= (cond.value || 0);
                case 'streak':         return (stats.streak || 0) >= (cond.value || 0);
                case 'bestScore':      return (stats.bestScore || 0) >= (cond.value || 0);
                case 'totalQuestions': return (stats.totalQuestions || 0) >= (cond.value || 0);
                default: return false;
            }
        }
    };

    // Inject CSS
    const css = `
        .sky-ach-item {
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            padding: 14px 8px;
            background: var(--bg-secondary, #F8FAFC);
            border: 1.5px solid var(--border, #E2E8F0);
            border-radius: 14px;
            text-align: center;
            transition: all .25s;
            cursor: pointer;
        }
        .sky-ach-item.earned {
            background: linear-gradient(135deg, rgba(255,215,0,0.12), rgba(245,158,11,0.06));
            border-color: rgba(255,215,0,0.4);
            box-shadow: 0 6px 18px rgba(245,158,11,0.15);
        }
        .sky-ach-item.earned:hover { transform: translateY(-3px); }
        .sky-ach-item.locked { opacity: 0.55; filter: grayscale(0.5); }
        .sky-ach-icon { font-size: 32px; line-height: 1; }
        .sky-ach-name { font-size: 13px; font-weight: 700; color: var(--text-primary, #0F172A); }
        .sky-ach-desc { font-size: 11px; color: var(--text-muted, #94A3B8); line-height: 1.3; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    global.AchievementEngine = AchievementEngine;
})(window);
