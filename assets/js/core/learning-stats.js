/**
 * SKY EDU - Learning Stats
 * Tổng hợp thống kê học tập: heatmap, trend, accuracy theo môn.
 * Đọc/ghi thông qua SkyStore để fallback Firebase.
 */
(function (global) {
    'use strict';

    const LearningStats = {
        /**
         * Lấy stats mới nhất (tự động build nếu chưa có)
         */
        get(forceRebuild = false) {
            if (forceRebuild) return SkyStore.saveLearningStats();
            return SkyStore.getLearningStats();
        },

        /**
         * Tính lại và lưu
         */
        recompute() {
            return SkyStore.saveLearningStats();
        },

        /**
         * Heatmap dữ liệu: { 'YYYY-MM-DD': count }
         * Mặc định trả về 12 tuần gần nhất
         */
        getHeatmapData(weeks = 12) {
            const stats = this.get();
            const byDate = stats.byDate || {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const days = weeks * 7;
            const start = new Date(today);
            start.setDate(start.getDate() - (days - 1));
            // Điều chỉnh về Chủ nhật
            const startDay = start.getDay();
            start.setDate(start.getDate() - startDay);

            const cells = [];
            for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().substring(0, 10);
                cells.push({
                    date: key,
                    count: byDate[key] || 0,
                    isToday: key === today.toISOString().substring(0, 10)
                });
            }
            return { cells, weeks, maxCount: Math.max(1, ...cells.map(c => c.count)) };
        },

        /**
         * Render heatmap HTML
         */
        renderHeatmap(weeks = 12) {
            const data = this.getHeatmapData(weeks);
            if (!data.cells.length) {
                return '<div class="sky-empty">Chưa có dữ liệu hoạt động.</div>';
            }
            const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            // Group cells theo tuần (7 cột)
            const cols = [];
            for (let i = 0; i < data.cells.length; i += 7) {
                cols.push(data.cells.slice(i, i + 7));
            }
            return `<div class="sky-heatmap-wrap">
                <div class="sky-heatmap">
                    <div class="sky-heatmap-days">
                        ${days.map(d => `<div class="sky-heatmap-day-label">${d}</div>`).join('')}
                    </div>
                    <div class="sky-heatmap-cols">
                        ${cols.map(col => `<div class="sky-heatmap-col">
                            ${col.map(cell => {
                                const intensity = data.maxCount > 0 ? (cell.count / data.maxCount) : 0;
                                const lvl = cell.count === 0 ? 0
                                    : intensity < 0.25 ? 1
                                    : intensity < 0.5 ? 2
                                    : intensity < 0.75 ? 3 : 4;
                                return `<div class="sky-heatmap-cell lvl-${lvl}${cell.isToday ? ' today' : ''}"
                                    data-date="${cell.date}" data-count="${cell.count}"
                                    title="${cell.date}: ${cell.count} hoạt động"></div>`;
                            }).join('')}
                        </div>`).join('')}
                    </div>
                </div>
                <div class="sky-heatmap-legend">
                    <span>Ít</span>
                    <div class="sky-heatmap-cell lvl-0"></div>
                    <div class="sky-heatmap-cell lvl-1"></div>
                    <div class="sky-heatmap-cell lvl-2"></div>
                    <div class="sky-heatmap-cell lvl-3"></div>
                    <div class="sky-heatmap-cell lvl-4"></div>
                    <span>Nhiều</span>
                </div>
            </div>`;
        },

        /**
         * Đếm tổng câu đã làm (tổng hợp từ examHistory)
         */
        getTotalQuestions() {
            const history = SkyStore.getExamHistory();
            return history.reduce((sum, h) => sum + (h.total || 0), 0);
        }
    };

    // CSS
    const css = `
        .sky-heatmap-wrap { padding: 12px 0; }
        .sky-heatmap {
            display: flex; gap: 8px; overflow-x: auto;
            padding: 8px 0;
        }
        .sky-heatmap-days {
            display: flex; flex-direction: column; gap: 3px;
            padding-top: 0;
        }
        .sky-heatmap-day-label {
            font-size: 10px; color: var(--text-muted, #94A3B8);
            height: 16px; line-height: 16px; font-weight: 600;
        }
        .sky-heatmap-cols { display: flex; gap: 3px; }
        .sky-heatmap-col { display: flex; flex-direction: column; gap: 3px; }
        .sky-heatmap-cell {
            width: 16px; height: 16px; border-radius: 3px;
            background: var(--bg-tertiary, #E2E8F0);
            transition: transform .15s;
        }
        .sky-heatmap-cell:hover { transform: scale(1.3); }
        .sky-heatmap-cell.lvl-1 { background: rgba(22, 119, 255, 0.25); }
        .sky-heatmap-cell.lvl-2 { background: rgba(22, 119, 255, 0.5); }
        .sky-heatmap-cell.lvl-3 { background: rgba(22, 119, 255, 0.75); }
        .sky-heatmap-cell.lvl-4 { background: rgba(22, 119, 255, 1); box-shadow: 0 0 8px rgba(22,119,255,0.4); }
        .sky-heatmap-cell.today { outline: 2px solid #F59E0B; outline-offset: 1px; }
        .sky-heatmap-legend {
            display: flex; align-items: center; gap: 4px;
            font-size: 11px; color: var(--text-muted, #94A3B8);
            margin-top: 12px; justify-content: flex-end;
        }
        .sky-empty {
            padding: 40px; text-align: center; color: var(--text-muted, #94A3B8);
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    global.LearningStats = LearningStats;
})(window);
