/**
 * SKY EDU - AI Insight
 * Phân tích điểm mạnh/yếu từ examHistory + gợi ý bài học tiếp theo
 */
(function (global) {
    'use strict';

    const AIInsight = {
        /**
         * Phân tích tổng thể
         * Trả về: { strengths: [], weaknesses: [], improvements: [], nextLessons: [] }
         */
        analyze() {
            const history = SkyStore.getExamHistory();
            const gam = SkyStore.getGamification();
            const stats = LearningStats.get();

            const result = {
                strengths: [],
                weaknesses: [],
                improvements: [],
                nextLessons: []
            };

            if (history.length < 2) {
                result.nextLessons.push({
                    title: 'Bắt đầu hành trình',
                    desc: 'Hoàn thành thêm đề thi để AI phân tích chính xác hơn',
                    link: 'phong-luyen-tsa/index.html',
                    icon: '🚀'
                });
                return result;
            }

            // 1) Phân tích điểm mạnh/yếu theo môn
            const subjectStats = stats.accuracyBySubject || {};
            const subjects = Object.keys(subjectStats);
            if (subjects.length > 0) {
                const sorted = subjects
                    .map(s => ({ name: s, accuracy: subjectStats[s] }))
                    .sort((a, b) => b.accuracy - a.accuracy);

                if (sorted[0] && sorted[0].accuracy >= 70) {
                    result.strengths.push({
                        title: `Môn ${this._prettySubject(sorted[0].name)}`,
                        desc: `Độ chính xác ${sorted[0].accuracy}% - rất tốt!`,
                        icon: '💪'
                    });
                }
                if (sorted.length > 1) {
                    const last = sorted[sorted.length - 1];
                    if (last.accuracy < 60) {
                        result.weaknesses.push({
                            title: `Môn ${this._prettySubject(last.name)}`,
                            desc: `Độ chính xác chỉ ${last.accuracy}% - cần cải thiện`,
                            icon: '⚠️'
                        });
                    }
                }
            }

            // 2) Phân tích xu hướng điểm
            const recentScores = history.slice(-5).map(h => h.total > 0 ? (h.score / h.total) * 100 : 0);
            const olderScores = history.slice(-10, -5).map(h => h.total > 0 ? (h.score / h.total) * 100 : 0);
            if (recentScores.length >= 2 && olderScores.length >= 1) {
                const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
                const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
                const diff = recentAvg - olderAvg;
                if (diff > 5) {
                    result.strengths.push({
                        title: 'Cải thiện rõ rệt',
                        desc: `Điểm tăng ${Math.round(diff)}% so với trước`,
                        icon: '📈'
                    });
                } else if (diff < -5) {
                    result.weaknesses.push({
                        title: 'Điểm đang giảm',
                        desc: `Giảm ${Math.round(Math.abs(diff))}% - cần ôn lại`,
                        icon: '📉'
                    });
                }
            }

            // 3) Phân tích tỉ lệ đúng tổng
            if (stats.accuracy >= 80) {
                result.strengths.push({
                    title: 'Độ chính xác cao',
                    desc: `Tỉ lệ đúng ${stats.accuracy}% toàn hệ thống`,
                    icon: '🎯'
                });
            } else if (stats.accuracy < 50 && stats.totalQuestions > 0) {
                result.weaknesses.push({
                    title: 'Tỉ lệ đúng thấp',
                    desc: `Chỉ ${stats.accuracy}% - cần luyện thêm`,
                    icon: '❌'
                });
            }

            // 4) Phân tích streak
            if (gam.currentStreak >= 7) {
                result.strengths.push({
                    title: 'Chuỗi ngày học',
                    desc: `${gam.currentStreak} ngày liên tiếp - kỷ lục!`,
                    icon: '🔥'
                });
            } else if (gam.currentStreak === 0 && gam.longestStreak > 0) {
                result.improvements.push({
                    title: 'Khôi phục streak',
                    desc: 'Hãy làm 1 đề hôm nay để lấy lại chuỗi ngày học',
                    icon: '🎯'
                });
            }

            // 5) Chủ đề cần cải thiện
            if (subjects.length > 0) {
                const weak = subjects
                    .map(s => ({ name: s, accuracy: subjectStats[s] }))
                    .filter(s => s.accuracy < 70)
                    .sort((a, b) => a.accuracy - b.accuracy)
                    .slice(0, 3);
                weak.forEach(w => {
                    result.improvements.push({
                        title: this._prettySubject(w.name),
                        desc: `Độ chính xác ${w.accuracy}% - ưu tiên luyện tập`,
                        icon: '📚'
                    });
                });
            }

            // 6) Gợi ý bài học tiếp theo
            // Ưu tiên môn yếu nhất
            if (subjects.length > 0) {
                const weakest = subjects
                    .map(s => ({ name: s, accuracy: subjectStats[s] }))
                    .sort((a, b) => a.accuracy - b.accuracy)[0];
                if (weakest) {
                    result.nextLessons.push({
                        title: `Luyện thêm ${this._prettySubject(weakest.name)}`,
                        desc: `Tập trung cải thiện môn yếu nhất (${weakest.accuracy}%)`,
                        link: 'phong-luyen-tsa/index.html',
                        icon: '🎯'
                    });
                }
            }
            // Nếu chưa làm đề nào
            if (history.length < 3) {
                result.nextLessons.push({
                    title: 'Làm thêm 3 đề nữa',
                    desc: 'Hoàn thành để có phân tích chính xác hơn',
                    link: 'phong-luyen-tsa/index.html',
                    icon: '📝'
                });
            }
            // Mặc định
            result.nextLessons.push({
                title: 'Đề thi thử HSA',
                desc: 'Khám phá thêm dạng câu hỏi mới',
                link: 'phong-luyen-hsa/index.html',
                icon: '🌟'
            });

            return result;
        },

        /**
         * Render HTML cho AI Insight panel
         */
        render() {
            const data = this.analyze();
            const renderCard = (item, color) => `<div class="sky-ai-card" style="--ai-color:${color}">
                <div class="sky-ai-icon">${item.icon}</div>
                <div class="sky-ai-title">${item.title}</div>
                <div class="sky-ai-desc">${item.desc}</div>
            </div>`;

            const strengthsHTML = data.strengths.length
                ? data.strengths.map(s => renderCard(s, '#10B981')).join('')
                : '<div class="sky-ai-empty">Làm thêm đề để AI phát hiện điểm mạnh</div>';

            const weaknessesHTML = data.weaknesses.length
                ? data.weaknesses.map(s => renderCard(s, '#EF4444')).join('')
                : '<div class="sky-ai-empty">Chưa phát hiện điểm yếu rõ ràng - tiếp tục luyện tập!</div>';

            const improvementsHTML = data.improvements.length
                ? data.improvements.map(s => renderCard(s, '#F59E0B')).join('')
                : '<div class="sky-ai-empty">Không có chủ đề cần ưu tiên.</div>';

            const lessonsHTML = data.nextLessons.length
                ? data.nextLessons.map(l => `<a class="sky-ai-lesson" href="${l.link}">
                    <span class="sky-ai-lesson-icon">${l.icon}</span>
                    <div>
                        <div class="sky-ai-lesson-title">${l.title}</div>
                        <div class="sky-ai-lesson-desc">${l.desc}</div>
                    </div>
                    <span class="sky-ai-lesson-arrow">→</span>
                </a>`).join('')
                : '<div class="sky-ai-empty">Không có gợi ý.</div>';

            return `<div class="sky-ai-panel">
                <div class="sky-ai-col">
                    <h4 class="sky-ai-col-title"><span style="color:#10B981">💪</span> Điểm mạnh</h4>
                    <div class="sky-ai-list">${strengthsHTML}</div>
                </div>
                <div class="sky-ai-col">
                    <h4 class="sky-ai-col-title"><span style="color:#EF4444">⚠️</span> Điểm yếu</h4>
                    <div class="sky-ai-list">${weaknessesHTML}</div>
                </div>
                <div class="sky-ai-col">
                    <h4 class="sky-ai-col-title"><span style="color:#F59E0B">📚</span> Cần cải thiện</h4>
                    <div class="sky-ai-list">${improvementsHTML}</div>
                </div>
                <div class="sky-ai-col">
                    <h4 class="sky-ai-col-title"><span style="color:#1677FF">🎯</span> Bài học gợi ý</h4>
                    <div class="sky-ai-list">${lessonsHTML}</div>
                </div>
            </div>`;
        },

        _prettySubject(s) {
            if (!s) return 'Khác';
            const map = {
                'TSA': 'Tư duy TSA',
                'HSA': 'Năng lực HSA',
                'math': 'Toán',
                'logic': 'Logic',
                'verbal': 'Ngôn ngữ',
                'reading': 'Đọc hiểu'
            };
            return map[s] || s;
        }
    };

    const css = `
        .sky-ai-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
        }
        .sky-ai-col {
            background: var(--card-bg, #FFFFFF);
            border: 1px solid var(--border, #E2E8F0);
            border-radius: 16px;
            padding: 18px;
        }
        .sky-ai-col-title {
            font-size: 14px; font-weight: 800;
            color: var(--text-primary, #0F172A);
            margin: 0 0 14px; display: flex; align-items: center; gap: 8px;
        }
        .sky-ai-list { display: flex; flex-direction: column; gap: 10px; }
        .sky-ai-card {
            background: color-mix(in srgb, var(--ai-color) 8%, transparent);
            border: 1px solid color-mix(in srgb, var(--ai-color) 25%, transparent);
            border-radius: 12px;
            padding: 12px 14px;
            display: flex; flex-direction: column; gap: 4px;
            transition: transform .2s;
        }
        .sky-ai-card:hover { transform: translateX(4px); }
        .sky-ai-icon { font-size: 22px; }
        .sky-ai-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #0F172A); }
        .sky-ai-desc { font-size: 12px; color: var(--text-secondary, #475569); line-height: 1.4; }
        .sky-ai-empty { font-size: 12px; color: var(--text-muted, #94A3B8); padding: 12px; text-align: center; font-style: italic; }

        .sky-ai-lesson {
            display: flex; align-items: center; gap: 12px;
            padding: 12px;
            background: var(--bg-secondary, #F8FAFC);
            border: 1px solid var(--border, #E2E8F0);
            border-radius: 12px;
            text-decoration: none; color: inherit;
            transition: all .2s;
        }
        .sky-ai-lesson:hover {
            background: rgba(22, 119, 255, 0.06);
            border-color: var(--primary, #1677FF);
            transform: translateX(4px);
        }
        .sky-ai-lesson-icon { font-size: 24px; flex-shrink: 0; }
        .sky-ai-lesson-title { font-size: 13px; font-weight: 700; color: var(--text-primary, #0F172A); }
        .sky-ai-lesson-desc { font-size: 11px; color: var(--text-muted, #94A3B8); margin-top: 2px; }
        .sky-ai-lesson-arrow { margin-left: auto; color: var(--primary, #1677FF); font-weight: 700; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    global.AIInsight = AIInsight;
})(window);
