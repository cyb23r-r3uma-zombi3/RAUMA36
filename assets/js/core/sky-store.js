/**
 * SKY EDU - Sky Store
 * Lớp dữ liệu chung: localStorage + Firebase fallback
 * Không phá cấu trúc cũ; chỉ bổ sung key mới.
 */
(function (global) {
    'use strict';

    const USE_FIREBASE = true; // Đã bật: sky-store đọc/ghi userStats/{uid} trên Firebase làm nguồn chính, localStorage chỉ cache

    const PREFIX = 'skyedu_';
    const SAFE_KEYS = {
        gamification: 'skyedu_gamification',
        dashboard: 'skyedu_dashboard',
        leaderboard: 'skyedu_leaderboard',
        ranks: 'skyedu_ranks_v1',
        achievements: 'skyedu_achievements',
        learningStats: 'skyedu_learning_stats',
        adminMeta: 'skyedu_admin_meta',
        examHistory: 'examHistory',
        users: 'users',
        currentUser: 'currentUser'
    };

    const SkyStore = {
        PREFIX: PREFIX,
        KEYS: SAFE_KEYS,
        USE_FIREBASE: USE_FIREBASE,

        /**
         * Đọc giá trị từ localStorage
         */
        get(key, defaultValue = null) {
            try {
                const raw = localStorage.getItem(key);
                if (raw === null) return defaultValue;
                return JSON.parse(raw);
            } catch (e) {
                console.warn('[SkyStore.get] Lỗi đọc', key, e);
                return defaultValue;
            }
        },

        /**
         * Ghi giá trị vào localStorage (tùy chọn đồng bộ Firebase)
         */
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                this._syncFirebase(key, value);
                window.dispatchEvent(new CustomEvent('skyStoreUpdate', { detail: { key, value } }));
                return true;
            } catch (e) {
                console.error('[SkyStore.set] Lỗi ghi', key, e);
                return false;
            }
        },

        /**
         * Xoá key
         */
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                return false;
            }
        },

        /**
         * Đồng bộ Firebase - ghi vào userStats/{uid} (path MỚI, sạch),
         * KHÔNG dùng field lẻ 'stats_'+key trong users/{uid} như code cũ.
         */
        _syncFirebase(key, value) {
            if (!this.USE_FIREBASE) return;
            if (typeof FirebaseAPI === 'undefined' || !FirebaseAPI.isReady || !FirebaseAPI.isReady()) return;
            const user = this.getCurrentUser();
            if (!user || !user.uid) return;
            try {
                // Chỉ sync các gamification/stats liên quan tới userStats/{uid}
                // (KHÔNG sync cache session/auth nhạy cảm khác)
                const ALLOWED = {
                    gamification: true,
                    achievements: true,
                    ranks: true,
                    learningStats: true,
                    examHistory: true
                };
                const safeKey = key.startsWith(PREFIX) ? key.substring(PREFIX.length) : key;
                if (!ALLOWED[safeKey]) return;

                const payload = this._buildUserStatsPayload();
                if (!payload) return;
                // Fire-and-forget; lỗi không chặn UI
                FirebaseAPI.saveUserStats(user.uid, payload).catch((e) => {
                    console.warn('[SkyStore._syncFirebase] failed', e && e.message);
                });
            } catch (e) {
                console.warn('[SkyStore._syncFirebase] exception', e);
            }
        },

        /**
         * Build payload userStats/{uid} từ các cache local tương ứng.
         * Tách riêng để không phải biết key nào đang được ghi.
         */
        _buildUserStatsPayload() {
            const gam = this.getGamification();
            return {
                totalXP: gam.totalXP || 0,
                currentStreak: gam.currentStreak || 0,
                longestStreak: gam.longestStreak || 0,
                lastActiveDate: gam.lastActiveDate || null,
                totalExams: gam.totalExams || 0,
                totalCorrect: gam.totalCorrect || 0,
                totalQuestions: gam.totalQuestions || 0,
                bestScore: gam.bestScore || 0,
                averageScore: gam.averageScore || 0,
                scores: JSON.stringify(gam.scores || []),
                badges: JSON.stringify(gam.badges || []),
                achievements: JSON.stringify(gam.achievements || []),
                stats: JSON.stringify(gam.stats || {}),
                updatedAt: Date.now()
            };
        },

        /**
         * Load user stats từ Firebase, merge với cache local.
         * - Nếu Firebase rỗng: cache local giữ nguyên (không ghi đè)
         * - Nếu Firebase có nhưng cache rỗng: nhận từ Firebase
         * - Nếu cả 2 có: merge theo updatedAt (cái mới nhất thắng)
         * @returns {Promise<boolean>} true nếu đã thực hiện migration
         */
        async loadUserStatsFromFirebase() {
            if (typeof FirebaseAPI === 'undefined' || !FirebaseAPI.isReady || !FirebaseAPI.isReady()) return false;
            const user = this.getCurrentUser();
            if (!user || !user.uid) return false;
            try {
                const remote = await FirebaseAPI.getUserStats(user.uid);
                if (!remote) {
                    // Chưa có trên Firebase — chạy migration nếu local có dữ liệu
                    return await this._migrateLocalStatsToFirebase();
                }
                // Merge an toàn: ưu tiên remote (Firebase) làm nguồn chính
                const local = this.getGamification();
                const merged = this._mergeStats(local, remote);
                this.set(SAFE_KEYS.gamification, merged);
                return true;
            } catch (e) {
                console.warn('[SkyStore.loadUserStatsFromFirebase] error', e);
                return false;
            }
        },

        /**
         * Migration 1 lần: nếu local có gamification nhưng Firebase userStats/{uid} rỗng,
         * upload local lên Firebase. Không ghi đè nếu Firebase đã có.
         */
        async _migrateLocalStatsToFirebase() {
            const local = this.getGamification();
            // Không migration nếu local rỗng/zero
            const hasData = (local.totalXP > 0) || (local.totalExams > 0) || (local.longestStreak > 0)
                || (local.totalQuestions > 0) || (local.totalCorrect > 0);
            if (!hasData) return false;

            const payload = this._buildUserStatsPayload();
            try {
                const res = await FirebaseAPI.saveUserStats(
                    (this.getCurrentUser() || {}).uid,
                    payload
                );
                if (res && res.success) {
                    AuditLogger && AuditLogger.log &&
                        AuditLogger.log(
                            'migrate_userStats',
                            (this.getCurrentUser() || {}).uid || 'unknown',
                            { source: 'localStorage skyedu_gamification' }
                        );
                }
                return !!(res && res.success);
            } catch (e) {
                console.warn('[SkyStore._migrateLocalStatsToFirebase] failed', e);
                return false;
            }
        },

        /**
         * Merge giữa local cache và Firebase remote.
         * updatedAt: lấy max → field nào mới hơn thì thắng.
         */
        _mergeStats(local, remote) {
            const remoteTs = remote && remote.updatedAt ? Number(remote.updatedAt) : 0;
            const localTs = local && local.updatedAt ? Number(local.updatedAt) : 0;
            const newer = remoteTs >= localTs ? remote : local;
            return {
                ...local,
                totalXP: newer.totalXP || local.totalXP || 0,
                currentStreak: newer.currentStreak || local.currentStreak || 0,
                longestStreak: Math.max(newer.longestStreak || 0, local.longestStreak || 0),
                lastActiveDate: newer.lastActiveDate || local.lastActiveDate || null,
                totalExams: Math.max(newer.totalExams || 0, local.totalExams || 0),
                totalCorrect: Math.max(newer.totalCorrect || 0, local.totalCorrect || 0),
                totalQuestions: Math.max(newer.totalQuestions || 0, local.totalQuestions || 0),
                bestScore: Math.max(newer.bestScore || 0, local.bestScore || 0),
                averageScore: newer.averageScore || local.averageScore || 0,
                scores: parseArr(newer.scores, local.scores || []),
                badges: parseArr(newer.badges, local.badges || []),
                achievements: parseArr(newer.achievements, local.achievements || []),
                stats: parseObj(newer.stats, local.stats || {}),
                updatedAt: Math.max(remoteTs, localTs) || Date.now()
            };
            function parseArr(v, fallback) {
                if (Array.isArray(v)) return v;
                if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : fallback; } catch (e) { return fallback; } }
                return fallback;
            }
            function parseObj(v, fallback) {
                if (v && typeof v === 'object' && !Array.isArray(v)) return v;
                if (typeof v === 'string') { try { const p = JSON.parse(v); return (p && typeof p === 'object') ? p : fallback; } catch (e) { return fallback; } }
                return fallback;
            }
        },

        /**
         * Lấy thông tin user hiện tại
         */
        getCurrentUser() {
            return this.get(SAFE_KEYS.currentUser);
        },

        /**
         * Lấy stats gamification
         */
        getGamification() {
            const existing = this.get(SAFE_KEYS.gamification, null);
            if (existing) return existing;
            return {
                totalXP: 0, currentStreak: 0, longestStreak: 0, lastActiveDate: null,
                totalExams: 0, totalCorrect: 0, totalQuestions: 0, bestScore: 0,
                averageScore: 0, scores: [], badges: [], achievements: [],
                updatedAt: 0,
                stats: { earlyBird: false, nightOwl: false, speedDemon: false, noSkip: false }
            };
        },

        /**
         * Lấy lịch sử làm bài
         */
        getExamHistory() {
            return this.get(SAFE_KEYS.examHistory, []);
        },

        /**
         * Lấy danh sách user
         */
        getUsers() {
            return this.get(SAFE_KEYS.users, []);
        },

        /**
         * Lấy thống kê học tập (aggregate từ examHistory + gamification)
         */
        getLearningStats() {
            return this.get(SAFE_KEYS.learningStats, null) || this._buildLearningStats();
        },

        /**
         * Tính toán lại learning stats từ examHistory
         */
        _buildLearningStats() {
            const history = this.getExamHistory();
            const gam = this.getGamification();
            const totalExams = history.length;
            let totalQuestions = 0, totalCorrect = 0, totalTime = 0;
            const byDate = {};
            const bySubject = {};
            const scoreByDate = {};

            history.forEach(h => {
                totalQuestions += (h.total || 0);
                totalCorrect += (h.score || 0);
                totalTime += (h.timeSpent || 0);
                const d = (h.timestamp || '').substring(0, 10);
                if (d) {
                    byDate[d] = (byDate[d] || 0) + 1;
                    if (!scoreByDate[d]) scoreByDate[d] = { sum: 0, count: 0 };
                    const pct = h.total > 0 ? Math.round((h.score / h.total) * 100) : 0;
                    scoreByDate[d].sum += pct;
                    scoreByDate[d].count += 1;
                }
                const subject = h.subject || h.category || 'TSA';
                if (!bySubject[subject]) bySubject[subject] = { correct: 0, total: 0 };
                bySubject[subject].correct += (h.score || 0);
                bySubject[subject].total += (h.total || 0);
            });

            const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
            const avgScore = totalExams > 0 ? Math.round(history.reduce((a, b) => {
                const pct = b.total > 0 ? (b.score / b.total) * 100 : 0;
                return a + pct;
            }, 0) / totalExams) : 0;

            const accuracyBySubject = {};
            Object.keys(bySubject).forEach(k => {
                accuracyBySubject[k] = bySubject[k].total > 0
                    ? Math.round((bySubject[k].correct / bySubject[k].total) * 100)
                    : 0;
            });

            return {
                totalExams,
                totalQuestions,
                totalCorrect,
                totalTime,
                accuracy,
                avgScore,
                bestScore: gam.bestScore || 0,
                totalXP: gam.totalXP || 0,
                currentStreak: gam.currentStreak || 0,
                longestStreak: gam.longestStreak || 0,
                byDate,
                scoreByDate,
                accuracyBySubject,
                updatedAt: new Date().toISOString()
            };
        },

        /**
         * Lưu learning stats (aggregate mới)
         */
        saveLearningStats() {
            const stats = this._buildLearningStats();
            this.set(SAFE_KEYS.learningStats, stats);
            return stats;
        }
    };

    global.SkyStore = SkyStore;
})(window);
