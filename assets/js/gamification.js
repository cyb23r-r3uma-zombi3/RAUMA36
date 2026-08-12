/**
 * SKY EDU - Gamification System
 * XP, Badges, Streaks, Leaderboard
 */

const Gamification = {
    // Storage key
    STORAGE_KEY: 'skyedu_gamification',
    
    // Badge definitions
    BADGES: {
        // Exam badges
        first_exam: { name: 'Khởi đầu', icon: '🎯', description: 'Làm bài thi đầu tiên', condition: (stats) => stats.totalExams >= 1 },
        exam_10: { name: 'Sĩ quan', icon: '🎖️', description: 'Làm 10 bài thi', condition: (stats) => stats.totalExams >= 10 },
        exam_50: { name: 'Thiếu tá', icon: '⭐', description: 'Làm 50 bài thi', condition: (stats) => stats.totalExams >= 50 },
        exam_100: { name: 'Đại tá', icon: '🌟', description: 'Làm 100 bài thi', condition: (stats) => stats.totalExams >= 100 },
        
        // Score badges
        perfect_score: { name: 'Hoàn hảo', icon: '💯', description: 'Đạt 100% một bài thi', condition: (stats) => stats.bestScore >= 100 },
        high_scorer: { name: 'Chuyên gia', icon: '🏆', description: 'Đạt trên 90%', condition: (stats) => stats.bestScore >= 90 },
        improving: { name: 'Tiến bộ', icon: '📈', description: 'Cải thiện điểm 20%', condition: (stats) => stats.improvement >= 20 },
        
        // Streak badges
        streak_3: { name: 'Bắt đầu', icon: '🔥', description: '3 ngày liên tiếp', condition: (stats) => stats.streak >= 3 },
        streak_7: { name: 'Kiên trì', icon: '🔥', description: '7 ngày liên tiếp', condition: (stats) => stats.streak >= 7 },
        streak_30: { name: 'Tháng thần', icon: '👑', description: '30 ngày liên tiếp', condition: (stats) => stats.streak >= 30 },
        streak_100: { name: 'Huyền thoại', icon: '🏆', description: '100 ngày liên tiếp', condition: (stats) => stats.streak >= 100 },
        
        // XP milestones
        xp_100: { name: 'Tân binh', icon: '1️⃣', description: 'Tích lũy 100 XP', condition: (stats) => stats.totalXP >= 100 },
        xp_500: { name: 'Học viên', icon: '2️⃣', description: 'Tích lũy 500 XP', condition: (stats) => stats.totalXP >= 500 },
        xp_1000: { name: 'Sinh viên', icon: '3️⃣', description: 'Tích lũy 1,000 XP', condition: (stats) => stats.totalXP >= 1000 },
        xp_5000: { name: 'Cử nhân', icon: '4️⃣', description: 'Tích lũy 5,000 XP', condition: (stats) => stats.totalXP >= 5000 },
        xp_10000: { name: 'Thạc sĩ', icon: '5️⃣', description: 'Tích lũy 10,000 XP', condition: (stats) => stats.totalXP >= 10000 },
        
        // Special badges
        early_bird: { name: 'Đại bàng', icon: '🦅', description: 'Học trước 7h sáng', condition: (stats) => stats.earlyBird },
        night_owl: { name: 'Cú mèo', icon: '🦉', description: 'Học sau 23h đêm', condition: (stats) => stats.nightOwl },
        speedster: { name: 'Tia chớp', icon: '⚡', description: 'Nộp sớm hơn 50% thời gian', condition: (stats) => stats.speedDemon },
        perfectionist: { name: 'Cầu toàn', icon: '💎', description: 'Không bỏ câu nào', condition: (stats) => stats.noSkip }
    },
    
    // Level definitions
    LEVELS: [
        { level: 1, minXP: 0, title: 'Tân binh', color: '#94A3B8' },
        { level: 2, minXP: 100, title: 'Học viên', color: '#22C55E' },
        { level: 3, minXP: 300, title: 'Sinh viên', color: '#3B82F6' },
        { level: 4, minXP: 600, title: 'Cử nhân', color: '#8B5CF6' },
        { level: 5, minXP: 1000, title: 'Thạc sĩ', color: '#F59E0B' },
        { level: 6, minXP: 2000, title: 'Tiến sĩ', color: '#EF4444' },
        { level: 7, minXP: 4000, title: 'Giáo sư', color: '#EC4899' },
        { level: 8, minXP: 8000, title: 'Siêu sao', color: '#F97316' },
        { level: 9, minXP: 15000, title: 'Huyền thoại', color: '#6366F1' },
        { level: 10, minXP: 30000, title: 'Bậc thầy', color: '#FFD700' }
    ],
    
    // XP rewards
    XP_REWARDS: {
        examComplete: 10,           // Base XP for completing exam
        correctAnswer: 2,            // XP per correct answer
        perfectExam: 50,            // Bonus for 100% score
        highScore: 25,             // Bonus for >80% score
        streak: 5,                 // Bonus per streak day
        speedBonus: 10,            // Bonus for early submission
        noSkipBonus: 15            // Bonus for no skipped questions
    },
    
    // Get user stats — fetched from Firebase (server source of truth).
    // Falls back to localStorage only when Firebase is unavailable (offline
    // display), but such data is marked `_source: 'local-fallback'` and
    // must NOT be used for leaderboard/XP claims.
    async getStats(userId) {
        if (!userId) return this.getDefaultStats();

        if (typeof FirebaseAPI !== 'undefined' && typeof FirebaseAPI.getUserStats === 'function') {
            try {
                const fbStats = await FirebaseAPI.getUserStats(userId);
                if (fbStats && fbStats.totalXP !== undefined) {
                    return {
                        totalXP:        fbStats.totalXP        || 0,
                        currentStreak:  fbStats.currentStreak  || 0,
                        longestStreak:  fbStats.longestStreak  || 0,
                        lastActiveDate: fbStats.lastActiveDate || null,
                        totalExams:     fbStats.totalExams     || 0,
                        totalCorrect:   fbStats.totalCorrect   || 0,
                        totalQuestions: fbStats.totalQuestions || 0,
                        bestScore:      fbStats.bestScore      || 0,
                        averageScore:   fbStats.averageScore   || 0,
                        scores:         fbStats.scores         || [],
                        badges:         fbStats.badges         || [],
                        achievements:   fbStats.achievements   || [],
                        stats: {
                            earlyBird:  !!(fbStats.stats && fbStats.stats.earlyBird),
                            nightOwl:   !!(fbStats.stats && fbStats.stats.nightOwl),
                            speedDemon: !!(fbStats.stats && fbStats.stats.speedDemon),
                            noSkip:     !!(fbStats.stats && fbStats.stats.noSkip)
                        },
                        _source: 'firebase',
                        validated: !!(fbStats.validated === true)
                    };
                }
            } catch (err) {
                console.warn('[Gamification] Firebase getUserStats failed:', err && err.message);
            }
        }

        // Fallback: try localStorage (unvalidated, offline-only display)
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                return { ...this.getDefaultStats(), ...parsed, _source: 'local-fallback', validated: false };
            } catch (e) {
                console.warn('[Gamification] Failed to parse local stats, using defaults:', e);
            }
        }
        return this.getDefaultStats();
    },

    // [SECURITY] Direct client writes to userStats are no longer allowed.
    // Stats are written exclusively by the scoreExam + updateUserStats
    // Cloud Functions (validated: true). This method is a no-op for
    // persistence; it only refreshes UI from Firebase.
    async refreshAndSave(stats) {
        // Re-fetch authoritative data from Firebase and update UI.
        const userId = (typeof SkyStore !== 'undefined' && SkyStore.getCurrentUser)
            ? (SkyStore.getCurrentUser() || {}).uid
            : null;
        if (!userId) return;
        const fresh = await this.getStats(userId);
        this._lastStats = fresh;
        this.updateUIWithStats(fresh);
    },

    // Internal: store last known good stats to avoid repeated Firebase calls.
    _lastStats: null,

    // Internal: update UI with a given stats object (avoids re-fetching).
    updateUIWithStats(stats) {
        const levelInfo = this.getLevelInfo(stats);

        const xpDisplay = document.getElementById('xpDisplay');
        if (xpDisplay) {
            xpDisplay.innerHTML = `
                <div class="xp-badge" style="background: ${levelInfo.current.color};">
                    <span class="xp-icon">${this.getLevelIcon(levelInfo.level)}</span>
                    <div class="xp-info">
                        <span class="xp-level">Cấp ${levelInfo.level}</span>
                        <span class="xp-title">${levelInfo.current.title}</span>
                    </div>
                    <span class="xp-value">${stats.totalXP.toLocaleString()} XP</span>
                </div>
            `;
        }

        const streakDisplay = document.getElementById('streakDisplay');
        if (streakDisplay) {
            streakDisplay.innerHTML = `
                <span class="streak-flame">🔥</span>
                <span class="streak-count">${stats.currentStreak}</span>
                <span class="streak-label">ngày</span>
            `;
        }

        window.dispatchEvent(new CustomEvent('gamificationUpdate', {
            detail: { stats, levelInfo }
        }));
    },

    // [DEPRECATED] Use refreshAndSave() instead. localStorage stats are
    // unvalidated and cannot be persisted to Firebase from the client.
    saveStats(stats) {
        // Only persist locally for offline fallback display — NOT as source of truth.
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
        } catch (e) {
            console.warn('[Gamification] Failed to persist stats to localStorage (non-fatal):', e);
        }
        this.updateUIWithStats(stats);
    },
    
    // Get default stats
    getDefaultStats() {
        return {
            totalXP: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: null,
            totalExams: 0,
            totalCorrect: 0,
            totalQuestions: 0,
            bestScore: 0,
            averageScore: 0,
            scores: [], // Array of last 10 scores for improvement calculation
            badges: [],
            achievements: [],
            stats: {
                earlyBird: false,
                nightOwl: false,
                speedDemon: false,
                noSkip: false
            }
        };
    },
    
    // Save stats
    saveStats(stats) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats));
        this.updateUI();
    },
    
    // Calculate improvement percentage
    calculateImprovement(scores) {
        if (scores.length < 2) return 0;
        const recent = scores.slice(-5);
        const older = scores.slice(-10, -5);
        if (older.length === 0) return 0;
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        return Math.round(recentAvg - olderAvg);
    },
    
    // Get current level info
    getLevelInfo(stats) {
        const xp = stats.totalXP;
        let currentLevel = this.LEVELS[0];
        let nextLevel = this.LEVELS[1];

        for (let i = this.LEVELS.length - 1; i >= 0; i--) {
            if (xp >= this.LEVELS[i].minXP) {
                currentLevel = this.LEVELS[i];
                nextLevel = this.LEVELS[i + 1] || null;
                break;
            }
        }

        const xpInLevel = xp - currentLevel.minXP;
        const xpNeeded = nextLevel ? nextLevel.minXP - currentLevel.minXP : 1;
        const progress = nextLevel ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;

        return {
            current: currentLevel,
            next: nextLevel,
            xpInLevel,
            xpNeeded,
            progress,
            level: this.LEVELS.indexOf(currentLevel) + 1,
            // === BỔ SUNG (additive) - tương thích ngược với code cũ ===
            rank: (typeof RankSystem !== 'undefined') ? RankSystem.getByXP(xp) : null
        };
    },

    /**
     * Lấy rank info từ RankSystem mới (10 cấp SKY EDU)
     * Bổ sung mới, không phá logic cũ.
     */
    getRankInfo(stats) {
        const xp = (stats && stats.totalXP) || 0;
        if (typeof RankSystem === 'undefined') {
            const info = this.getLevelInfo(stats || { totalXP: xp });
            return { rank: null, legacy: info };
        }
        return { rank: RankSystem.getByXP(xp), legacy: this.getLevelInfo(stats || { totalXP: xp }) };
    },
    
    // Process exam completion
    processExamResult(examResult) {
        const stats = this.getStats();
        const currentDate = new Date().toDateString();
        
        // Update streak
        if (stats.lastActiveDate !== currentDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (stats.lastActiveDate === yesterday.toDateString()) {
                stats.currentStreak++;
            } else if (stats.lastActiveDate !== currentDate) {
                stats.currentStreak = 1;
            }
            
            stats.lastActiveDate = currentDate;
        }
        
        stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
        
        // Update exam stats
        stats.totalExams++;
        stats.totalCorrect += examResult.score;
        stats.totalQuestions += examResult.total;
        
        // Calculate score percentage
        const scorePercent = Math.round((examResult.score / examResult.total) * 100);
        stats.scores.push(scorePercent);
        if (stats.scores.length > 10) stats.scores.shift();
        
        // Update best score
        if (scorePercent > stats.bestScore) {
            stats.bestScore = scorePercent;
        }
        
        // Update average
        stats.averageScore = Math.round(
            stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
        );
        
        // Calculate improvement
        stats.improvement = this.calculateImprovement(stats.scores);
        
        // Calculate XP earned
        let xpEarned = this.XP_REWARDS.examComplete;
        xpEarned += examResult.score * this.XP_REWARDS.correctAnswer;
        
        // Bonuses
        if (scorePercent === 100) {
            xpEarned += this.XP_REWARDS.perfectExam;
            stats.badges.push('perfect_score');
        } else if (scorePercent >= 80) {
            xpEarned += this.XP_REWARDS.highScore;
        }
        
        xpEarned += Math.min(stats.currentStreak, 7) * this.XP_REWARDS.streak;
        
        // Time-based badges
        const hour = new Date().getHours();
        if (hour < 7) {
            stats.stats.earlyBird = true;
            stats.badges.push('early_bird');
        }
        if (hour >= 23) {
            stats.stats.nightOwl = true;
            stats.badges.push('night_owl');
        }
        
        // Speed bonus
        if (examResult.timeUsed && examResult.timeAllowed) {
            if (examResult.timeUsed < examResult.timeAllowed * 0.5) {
                stats.stats.speedDemon = true;
                stats.badges.push('speedster');
                xpEarned += this.XP_REWARDS.speedBonus;
            }
        }
        
        // No skip bonus
        if (examResult.skipped === 0) {
            stats.stats.noSkip = true;
            xpEarned += this.XP_REWARDS.noSkipBonus;
        }
        
        stats.totalXP += xpEarned;

        // === Đánh dấu updatedAt để merge an toàn với remote ===
        try {
            stats.updatedAt = Date.now();
        } catch (e) {
            console.warn('[Gamification] Failed to set updatedAt timestamp:', e);
        }

        // Check for new badges
        const newBadges = this.checkBadges(stats);
        stats.badges = [...new Set([...stats.badges, ...newBadges])];

        // === BỔ SUNG: AchievementEngine + RankSystem check (additive) ===
        try {
            if (typeof AchievementEngine !== 'undefined' && typeof SkyStore !== 'undefined' && typeof LearningStats !== 'undefined') {
                const ls = SkyStore.getLearningStats();
                const newAch = AchievementEngine.evaluate({
                    totalExams: stats.totalExams || 0,
                    totalXP: stats.totalXP || 0,
                    streak: stats.currentStreak || 0,
                    bestScore: stats.bestScore || 0,
                    totalQuestions: ls.totalQuestions || 0
                });
                newBadges.push(...newAch.filter(id => !stats.badges.includes(id)));
                stats.badges = [...new Set([...stats.badges, ...newAch])];
            }
        } catch (e) { console.warn('[Gamification] AchievementEngine error', e); }

        // Save
        this.saveStats(stats);

        return {
            xpEarned,
            newBadges,
            levelInfo: this.getLevelInfo(stats)
        };
    },
    
    // Check and award badges
    checkBadges(stats) {
        const newBadges = [];
        for (const [id, badge] of Object.entries(this.BADGES)) {
            if (!stats.badges.includes(id) && badge.condition(stats)) {
                newBadges.push(id);
            }
        }
        return newBadges;
    },
    
    // Update UI — fetches stats from Firebase first, then renders.
    async updateUI() {
        let stats;
        try {
            const userId = (typeof SkyStore !== 'undefined' && SkyStore.getCurrentUser)
                ? (SkyStore.getCurrentUser() || {}).uid
                : null;
            stats = await this.getStats(userId);
            this._lastStats = stats;
        } catch (err) {
            console.warn('[Gamification] updateUI failed, using default:', err);
            stats = this.getDefaultStats();
        }
        this.updateUIWithStats(stats);
    },
    
    // Get level icon
    getLevelIcon(level) {
        const icons = ['🍼', '🍼', '🥤', '🧃', '🧂', '🍔', '🍕', '🎂', '🍰', '👑'];
        return icons[Math.min(level - 1, icons.length - 1)] || '👑';
    },
    
    // Get badge display HTML
    getBadgeHTML(badgeId) {
        const badge = this.BADGES[badgeId];
        if (!badge) return '';
        return `
            <div class="badge-item" title="${badge.description}" data-badge="${badgeId}">
                <span class="badge-icon">${badge.icon}</span>
                <span class="badge-name">${badge.name}</span>
            </div>
        `;
    },
    
    // Show achievement notification
    showAchievement(type, data) {
        const container = document.getElementById('achievementContainer') || this.createAchievementContainer();
        
        let icon, title, message, color;
        
        if (type === 'badge') {
            const badge = this.BADGES[data.badgeId];
            icon = badge.icon;
            title = '🏅 Huy hiệu mới!';
            message = `${badge.icon} ${badge.name}\n${badge.description}`;
            color = '#FFD700';
        } else if (type === 'levelup') {
            icon = this.getLevelIcon(data.level);
            title = '⬆️ Thăng cấp!';
            message = `Bạn đã đạt cấp ${data.level}!\n${data.title}`;
            color = data.color;
        } else if (type === 'xp') {
            icon = '⚡';
            title = '+' + data.amount + ' XP';
            message = 'Kiếm được XP';
            color = '#8B5CF6';
        }
        
        const achievement = document.createElement('div');
        achievement.className = 'achievement-popup';
        achievement.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, ${color}, ${color}dd);
            color: white;
            padding: 16px 24px;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 99999;
            animation: slideInRight 0.5s ease, fadeOut 0.5s ease 3s forwards;
            text-align: center;
            min-width: 250px;
        `;
        
        achievement.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 8px;">${icon}</div>
            <div style="font-weight: 700; font-size: 14px;">${title}</div>
            <div style="font-size: 12px; opacity: 0.9; white-space: pre-line;">${message}</div>
        `;
        
        container.appendChild(achievement);
        
        setTimeout(() => achievement.remove(), 4000);
    },
    
    // Create achievement container
    createAchievementContainer() {
        const container = document.createElement('div');
        container.id = 'achievementContainer';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 99999;';
        document.body.appendChild(container);
        return container;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    Gamification.updateUI();
});

// Export
window.Gamification = Gamification;
