/**
 * SKY EDU - Admin Pro
 * Mở rộng Admin Panel: 4 trang mới (Overview, Ranks, Achievements, Analytics)
 * Tương thích: dùng các hàm có sẵn trong admin.html (App.navigateTo, renderDashboard, ...)
 * + bổ sung SkyStore/RankSystem/AchievementEngine/LearningStats.
 */
(function (global) {
    'use strict';

    const STORAGE_ADMIN_META = 'skyedu_admin_meta';

    const AdminPro = {
        STORAGE_ADMIN_META: STORAGE_ADMIN_META,
        _charts: {},

        /**
         * Trang 1: Tổng quan
         */
        async renderOverview() {
            this._destroyCharts();
            // Stats
            const stats = this._gatherOverviewStats();
            const el = document.getElementById('admOverviewStats');
            if (el) {
                el.innerHTML = `
                    <div class="stat-card bg-blue"><div class="stat-card-icon">👥</div><div class="stat-card-value">${stats.totalUsers}</div><div class="stat-card-label">Tổng user</div></div>
                    <div class="stat-card bg-green"><div class="stat-card-icon">⚡</div><div class="stat-card-value">${stats.activeUsers}</div><div class="stat-card-label">User hoạt động</div></div>
                    <div class="stat-card bg-orange"><div class="stat-card-icon">📝</div><div class="stat-card-value">${stats.totalExams}</div><div class="stat-card-label">Tổng bài làm</div></div>
                    <div class="stat-card bg-purple"><div class="stat-card-icon">❓</div><div class="stat-card-value">${stats.totalQuestions.toLocaleString()}</div><div class="stat-card-label">Tổng câu hỏi</div></div>
                    <div class="stat-card bg-pink"><div class="stat-card-icon">📊</div><div class="stat-card-value">${stats.avgScore}%</div><div class="stat-card-label">Điểm TB</div></div>
                `;
            }

            // Recent users
            const recentEl = document.getElementById('admRecentUsers');
            if (recentEl) {
                const users = await this._getAllUsers();
                const recent = users.slice(-5).reverse();
                if (recent.length === 0) {
                    recentEl.innerHTML = '<div class="empty-state"><div class="icon">👤</div><p>Chưa có user nào</p></div>';
                } else {
                    recentEl.innerHTML = `<table class="adm-table">
                        <thead><tr><th>Username</th><th>Họ tên</th><th>Email</th><th>Ngày tạo</th><th>Role</th></tr></thead>
                        <tbody>${recent.map(u => `<tr>
                            <td>${this._esc(u.username)}</td>
                            <td>${this._esc(u.fullname)}</td>
                            <td>${this._esc(u.email)}</td>
                            <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'N/A'}</td>
                            <td><span class="badge ${u.role === 'admin' ? 'bg-orange' : ''}">${u.role || 'user'}</span></td>
                        </tr>`).join('')}</tbody>
                    </table>`;
                }
            }

            // Chart: User growth 30 ngày
            await this._renderUserGrowthChart();
            // Chart: Activity
            await this._renderActivityChart();
        },

        // === Helpers ===
        _gatherOverviewStats() {
            const users = SkyStore.getUsers();
            const history = SkyStore.getExamHistory();
            const ls = (typeof LearningStats !== 'undefined') ? LearningStats.get() : { totalQuestions: 0, accuracy: 0 };
            const totalExams = history.length;
            const avgScore = totalExams > 0
                ? Math.round(history.reduce((a, b) => a + (b.total > 0 ? (b.score / b.total) * 100 : 0), 0) / totalExams)
                : 0;
            return {
                totalUsers: users.length,
                activeUsers: users.filter(u => !u.banned).length,
                newUsersThisMonth: users.filter(u => u.createdAt && (Date.now() - u.createdAt) < 30 * 24 * 3600 * 1000).length,
                totalExams: totalExams,
                totalQuestions: ls.totalQuestions || 0,
                avgScore: avgScore,
                accuracy: ls.accuracy || 0
            };
        },

        async _getAllUsers() {
            // Ưu tiên Firebase nếu có
            try {
                if (typeof FirebaseAPI !== 'undefined' && FirebaseAPI.isReady && FirebaseAPI.isReady()) {
                    const fb = await FirebaseAPI.getAllUsers();
                    if (fb && fb.length) return fb;
                }
            } catch (e) {
                console.warn('[AdminPro] Firebase users fetch failed, falling back to SkyStore:', e);
            }
            return SkyStore.getUsers();
        },

        async _renderUserGrowthChart() {
            const el = document.getElementById('admUserGrowthChart');
            if (!el || typeof Chart === 'undefined') return;
            const users = await this._getAllUsers();
            const last30 = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().substring(0, 10);
                const count = users.filter(u => {
                    if (!u.createdAt) return false;
                    const t = (typeof u.createdAt === 'number') ? u.createdAt : new Date(u.createdAt).getTime();
                    const ts = new Date(t).toISOString().substring(0, 10);
                    return ts === key;
                }).length;
                last30.push({ label: d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }), count });
            }
            this._charts.userGrowth = new Chart(el, {
                type: 'line',
                data: {
                    labels: last30.map(d => d.label),
                    datasets: [{
                        label: 'User mới',
                        data: last30.map(d => d.count),
                        borderColor: '#1677FF',
                        backgroundColor: 'rgba(22,119,255,0.15)',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 3
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
            });
        },

        async _renderActivityChart() {
            const el = document.getElementById('admActivityChart');
            if (!el || typeof Chart === 'undefined') return;
            const history = SkyStore.getExamHistory();
            const last14 = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().substring(0, 10);
                const count = history.filter(h => (h.timestamp || '').substring(0, 10) === key).length;
                last14.push({ label: d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }), count });
            }
            this._charts.activity = new Chart(el, {
                type: 'bar',
                data: {
                    labels: last14.map(d => d.label),
                    datasets: [{
                        label: 'Lượt làm bài',
                        data: last14.map(d => d.count),
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: '#10B981',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
            });
        },

        _destroyCharts() {
            Object.values(this._charts).forEach(c => { try { c.destroy(); } catch (e) {
                console.warn('[AdminPro] Failed to destroy chart:', e);
            } });
            this._charts = {};
        },

        _esc(s) {
            if (typeof s !== 'string') return '';
            return s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
    };

    // Inject CSS cho admin tables
    const css = `
        .adm-table {
            width: 100%; border-collapse: collapse;
            background: var(--card-bg, #FFFFFF);
            border-radius: 8px; overflow: hidden;
        }
        .adm-table th, .adm-table td {
            padding: 12px 14px; text-align: left;
            border-bottom: 1px solid var(--border, #E2E8F0);
            font-size: 13px;
        }
        .adm-table thead {
            background: var(--bg-secondary, #F8FAFC);
        }
        .adm-table th {
            font-weight: 700; color: var(--text-secondary, #475569);
            text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;
        }
        .adm-table tbody tr:hover { background: var(--bg-secondary, #F8FAFC); }
        .adm-table tbody tr:last-child td { border-bottom: none; }
        .sky-rank-badge {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 10px; border-radius: 999px;
            background: color-mix(in srgb, var(--rank-color) 12%, transparent);
            border: 1px solid color-mix(in srgb, var(--rank-color) 30%, transparent);
            color: var(--rank-color);
            font-size: 12px; font-weight: 700;
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    global.AdminPro = AdminPro;
})(window);
