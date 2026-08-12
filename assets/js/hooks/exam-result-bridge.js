/**
 * SKY EDU - Exam Result Bridge
 * Hook vào result.html (TSA + HSA) để đẩy dữ liệu sang Dashboard, Leaderboard, Rank, Achievement
 * Đảm bảo tương thích ngược: nếu các module chưa load thì bỏ qua.
 */
(function (global) {
    'use strict';

    const BRIDGE_FLAG = 'skyedu_bridge_processed';

    const ExamResultBridge = {
        BRIDGE_FLAG: BRIDGE_FLAG,

        /**
         * Khởi tạo - gọi tự động khi result.html load
         */
        init() {
            try {
                if (sessionStorage.getItem(BRIDGE_FLAG)) return;
                sessionStorage.setItem(BRIDGE_FLAG, '1');

                // Đợi các module load
                this._waitForModules(() => this.process());
            } catch (e) {
                console.warn('[ExamResultBridge] init error', e);
            }
        },

        _waitForModules(cb) {
            let attempts = 0;
            const check = () => {
                attempts++;
                if (typeof SkyStore !== 'undefined'
                    && typeof Gamification !== 'undefined'
                    && typeof Dashboard !== 'undefined'
                    && typeof Leaderboard !== 'undefined') {
                    cb();
                } else if (attempts < 50) {
                    setTimeout(check, 100);
                } else {
                    console.warn('[ExamResultBridge] Modules chưa sẵn sàng sau 5s');
                }
            };
            check();
        },

        /**
         * Xử lý kết quả thi từ localStorage
         */
        process() {
            const result = this._readResult();
            if (!result) return;

            const user = SkyStore.getCurrentUser();
            if (!user || !user.uid) return;

            const examInfo = {
                score: result.score || 0,
                total: result.total || result.questions?.length || 0,
                timeSpent: result.timeSpent || 0,
                timeUsed: result.timeUsed || 0,
                skipped: (result.total || 0) - (result.answered || 0),
                name: result.examName || 'Đề thi',
                subject: result.subject || (location.pathname.includes('hsa') ? 'HSA' : 'TSA'),
                timestamp: result.completedAt || new Date().toISOString()
            };

            // 1) Lưu vào examHistory (Dashboard dùng)
            this._saveExamHistory(examInfo);

            // 2) Lưu entry vào BXH theo từng đề (per-exam leaderboard)
            try {
                if (typeof Leaderboard !== 'undefined' && Leaderboard.saveExamEntry) {
                    const examId = result.examId || result.examCode || result.examName || 'default';
                    Leaderboard.saveExamEntry(examId, {
                        uid: user.uid,
                        username: user.username,
                        displayName: user.fullname || user.username,
                        avatar: user.avatar || null,
                        score: examInfo.score,
                        total: examInfo.total,
                        correct: result.correct || 0,
                        wrong: Math.max(0, (examInfo.total || 0) - (result.correct || 0)),
                        timeUsed: examInfo.timeUsed || examInfo.timeSpent || 0,
                        examName: examInfo.name,
                        subject: examInfo.subject,
                        completedAt: result.completedAt || new Date().toISOString()
                    });
                }
            } catch (e) {
                console.warn('[ExamResultBridge] Leaderboard.saveExamEntry error', e);
            }

            // 3) [REMOVED] Gamification.processExamResult call removed.
            // Stats (XP, streak, badges) are now computed exclusively by the
            // scoreExam Cloud Function server-side and stored in Firebase userStats.
            // The client must not recompute or write stats locally.

            // 4) Cập nhật Dashboard.saveExamResult
            try {
                if (typeof Dashboard.saveExamResult === 'function') {
                    Dashboard.saveExamResult(examInfo);
                }
            } catch (e) {
                console.warn('[ExamResultBridge] Dashboard.saveExamResult error', e);
            }

            // 5) Cập nhật Leaderboard (global XP ranking - giữ để tương thích)
            try {
                const gam = SkyStore.getGamification();
                const rankInfo = (typeof RankSystem !== 'undefined')
                    ? RankSystem.getByXP(gam.totalXP || 0)
                    : null;
                Leaderboard.updateUserRank({
                    uid: user.uid,
                    username: user.username,
                    displayName: user.fullname || user.username,
                    xp: gam.totalXP || 0,
                    level: rankInfo ? rankInfo.level : 1,
                    rank: rankInfo ? rankInfo.current : null,
                    streak: gam.currentStreak || 0,
                    badges: (gam.badges || []).length,
                    avatar: user.avatar || null
                });
            } catch (e) {
                console.warn('[ExamResultBridge] Leaderboard.updateUserRank error', e);
            }

            // 6) Tính lại learning stats
            try {
                SkyStore.saveLearningStats();
            } catch (e) {
                console.error('[ExamResultBridge] SkyStore.saveLearningStats failed:', e);
            }

            // 7) Đánh giá Achievement mới
            try {
                if (typeof AchievementEngine !== 'undefined') {
                    const gam = SkyStore.getGamification();
                    const stats = LearningStats.get();
                    const earned = AchievementEngine.evaluate({
                        totalExams: gam.totalExams || 0,
                        totalXP: gam.totalXP || 0,
                        streak: gam.currentStreak || 0,
                        bestScore: gam.bestScore || 0,
                        totalQuestions: stats.totalQuestions || 0
                    });
                    if (earned.length > 0 && typeof Gamification.showAchievement === 'function') {
                        earned.slice(0, 1).forEach(badgeId => {
                            const badge = AchievementEngine.get(badgeId);
                            if (badge) Gamification.showAchievement('badge', { badgeId: badge.id, name: badge.name, icon: badge.icon, description: badge.description });
                        });
                    }
                }
            } catch (e) {
                console.error('[ExamResultBridge] Achievement evaluation failed:', e);
            }

            // 8) Check level-up
            try {
                if (typeof RankSystem !== 'undefined') {
                    const oldXP = (examInfo.score * 0); // không lưu oldXP, bỏ qua so sánh
                    const gam = SkyStore.getGamification();
                    const newXP = gam.totalXP || 0;
                    const newInfo = RankSystem.getByXP(newXP);
                    const oldInfo = RankSystem.getByXP(Math.max(0, newXP - 50));
                    if (newInfo.level > oldInfo.level && typeof Gamification.showAchievement === 'function') {
                        Gamification.showAchievement('levelup', {
                            level: newInfo.level,
                            title: newInfo.current.name,
                            icon: newInfo.current.icon,
                            color: newInfo.current.color
                        });
                    }
                }
            } catch (e) {
                console.error('[ExamResultBridge] Level-up check failed:', e);
            }
        },

        _readResult() {
            let raw = localStorage.getItem('examResultTSA');
            if (!raw) raw = localStorage.getItem('examResultHSA');
            if (!raw) raw = localStorage.getItem('examResult');
            if (!raw) return null;
            try { return JSON.parse(raw); } catch (e) { return null; }
        },

        _saveExamHistory(examInfo) {
            const history = SkyStore.getExamHistory();
            history.push({
                ...examInfo,
                timestamp: new Date().toISOString()
            });
            // Giữ tối đa 200 bản ghi
            if (history.length > 200) history.splice(0, history.length - 200);
            SkyStore.set('examHistory', history);
        },

        /**
         * Xoá cờ để cho phép xử lý lại (dùng cho test)
         */
        reset() {
            sessionStorage.removeItem(BRIDGE_FLAG);
        }
    };

    global.ExamResultBridge = ExamResultBridge;

    // Tự động chạy khi DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ExamResultBridge.init());
    } else {
        setTimeout(() => ExamResultBridge.init(), 300);
    }
})(window);
