/**
 * admin-preview.js - Exam Preview functionality
 * Tách ra từ admin.html để giảm dung lượng
 */
(function(global) {
    'use strict';

    // Open exam preview modal
    function openExamPreview(examId) {
        if (typeof ExamBuilder === 'undefined' || !ExamBuilder.getById) {
            alert('ExamBuilder chưa load');
            return;
        }

        var exam = ExamBuilder.getById(examId);
        if (!exam) {
            alert('Không tìm thấy đề thi');
            return;
        }

        var titleEl = document.getElementById('modalTitle');
        var bodyEl = document.getElementById('modalBody');

        if (titleEl) titleEl.textContent = '📝 Xem trước: ' + (exam.name || examId);
        if (!bodyEl) {
            console.error('[AdminPreview] Modal body not found (id="modalBody")');
            alert('Lỗi: Không tìm thấy modal');
            return;
        }

        var questions = exam.questions || [];
        var html = '<div class="preview-exam-container">';

        // Exam info header
        html += '<div class="preview-exam-header" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;border-radius:12px;margin-bottom:20px;color:white;">';
        html += '<h2 style="margin:0 0 10px 0;">' + safeEscape(exam.name || '') + '</h2>';
        html += '<div style="display:flex;gap:20px;font-size:14px;opacity:0.9;">';
        html += '<span>📝 ' + questions.length + ' câu</span>';
        html += '<span>⏱️ ' + (exam.timeMinutes || 150) + ' phút</span>';
        html += '<span>💯 ' + (exam.totalPoints || 0) + ' điểm</span>';
        html += '</div></div>';

        // Questions
        if (questions.length === 0) {
            html += '<p style="text-align:center;color:var(--text-muted);padding:40px;">Chưa có câu hỏi nào</p>';
        } else {
            questions.forEach(function(q, idx) {
                html += renderPreviewQuestion(q, idx + 1);
            });
        }

        html += '</div>';

        // Footer buttons
        html += '<div style="margin-top:20px;display:flex;gap:10px;justify-content:flex-end;">';
        html += '<button type="button" class="btn btn-secondary" onclick="AdminPreview.closeExamPreview()">Đóng</button>';
        html += '<button type="button" class="btn btn-primary" onclick="AdminPreview.editExam(\'' + safeEscape(examId) + '\')">✏️ Chỉnh sửa</button>';
        html += '</div>';

        bodyEl.innerHTML = html;

        // Show modal - use App.openModal pattern
        if (typeof App !== 'undefined' && App.openModal) {
            document.getElementById('modalTitle').innerHTML = '📝 Xem trước: ' + safeEscape(exam.name || examId);
            document.getElementById('modalBody').innerHTML = html;
            App.openModal('📝 Xem trước: ' + safeEscape(exam.name || examId), html, null, '');
        } else {
            var modal = document.getElementById('appModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
            }
        }

        // Typeset math
        if (typeof QuestionRenderer !== 'undefined' && QuestionRenderer.typesetMath) {
            setTimeout(function() { QuestionRenderer.typesetMath(bodyEl); }, 100);
        }
    }

    function closeExamPreview() {
        var modal = document.getElementById('appModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        // Also close overlay if exists
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    function renderPreviewQuestion(q, idx) {
        var t = (typeof QuestionTypes !== 'undefined' && QuestionTypes.getType) ? QuestionTypes.getType(q.type) : null;
        var html = '<div class="preview-question" style="background:var(--card-bg);border:1px solid var(--card-border);border-radius:12px;padding:20px;margin-bottom:16px;">';

        // Question header
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">';
        html += '<div style="font-weight:600;font-size:15px;">Câu ' + idx + ' <span style="font-weight:normal;color:var(--text-muted);font-size:13px;">' + (t ? t.shortLabel : q.type) + '</span></div>';
        html += '<span style="background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:20px;font-size:12px;">' + (q.points || 1) + ' điểm</span>';
        html += '</div>';

        // Question content - use safeRenderContent to allow <img> tags from inline images
        html += '<div class="question-content" style="font-size:14px;line-height:1.7;margin-bottom:16px;">';
        html += safeRenderContent(q.content || '');
        html += '</div>';

        // Answer options based on type
        if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
            var options = q.options || [];
            var letters = ['A', 'B', 'C', 'D', 'E', 'F'];

            if (q.type === 'mcq_single') {
                // correctAnswer is a letter like "A" — convert to index for comparison
                var correctIdx = -1;
                if (typeof q.correctAnswer === 'string' && /^[A-F]$/.test(q.correctAnswer)) {
                    correctIdx = q.correctAnswer.charCodeAt(0) - 65;
                } else if (typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < options.length) {
                    correctIdx = q.correctAnswer;
                }

                options.forEach(function(opt, i) {
                    var isCorrect = correctIdx === i;
                    var bg = isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)';
                    var border = isCorrect ? '1px solid #10B981' : '1px solid var(--card-border)';
                    html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:' + bg + ';border:' + border + ';border-radius:8px;margin-bottom:6px;">';
                    html += '<span style="font-weight:600;color:' + (isCorrect ? '#10B981' : 'var(--text-muted)') + ';">' + letters[i] + '.</span>';
                    // [FIX P1-9] Sanitize option text để chống XSS
                    html += '<span style="flex:1;">' + safeRenderContent(opt) + '</span>';
                    if (isCorrect) html += '<span style="color:#10B981;font-weight:600;">✓</span>';
                    html += '</div>';
                });
            } else {
                // correctAnswers is an array of letters like ["A","B"] — convert to index Set
                var rawLetters = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
                var correctSet = new Set(rawLetters.map(function(letter) {
                    if (typeof letter === 'string' && /^[A-F]$/.test(letter)) {
                        return letter;
                    }
                    return null;
                }).filter(function(l) { return l !== null; }));

                options.forEach(function(opt, i) {
                    var isCorrect = correctSet.has(letters[i]);
                    var bg = isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)';
                    var border = isCorrect ? '1px solid #10B981' : '1px solid var(--card-border)';
                    html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:' + bg + ';border:' + border + ';border-radius:8px;margin-bottom:6px;">';
                    html += '<span style="font-weight:600;color:' + (isCorrect ? '#10B981' : 'var(--text-muted)') + ';">' + letters[i] + '.</span>';
                    // [FIX P1-9] Sanitize option text
                    html += '<span style="flex:1;">' + safeRenderContent(opt) + '</span>';
                    if (isCorrect) html += '<span style="color:#10B981;font-weight:600;">✓</span>';
                    html += '</div>';
                });
            }
        } else if (q.type === 'fill_blank') {
            // Hiển thị các chỗ trống với đáp án
            var blanks = (q.content || '').match(/\[\d+\]/g) || [];
            var answers = q.correctAnswers || [];
            if (blanks.length > 0) {
                html += '<div style="background:rgba(16,185,129,0.1);padding:12px 16px;border-radius:8px;">';
                html += '<div style="color:var(--text-muted);font-size:13px;margin-bottom:8px;">Đáp án:</div>';
                blanks.forEach(function(blank, i) {
                    var answer = answers[i] || '...';
                    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">';
                    html += '<span style="background:#374151;padding:2px 8px;border-radius:4px;font-weight:600;font-size:13px;">' + blank + '</span>';
                    html += '<span style="color:#10B981;font-weight:500;">' + safeEscape(answer) + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            }
        } else if (q.type === 'drag_drop') {
            // Hiển thị mapping vị trí - đáp án
            var ddBlanks = (q.content || '').match(/\[\d+\]/g) || [];
            var choices = q.choices || [];
            var mapping = q.correctMapping || {};
            if (ddBlanks.length > 0 && choices.length > 0) {
                html += '<div style="background:rgba(16,185,129,0.1);padding:12px 16px;border-radius:8px;">';
                html += '<div style="color:var(--text-muted);font-size:13px;margin-bottom:8px;">Đáp án (vị trí → đáp án):</div>';
                ddBlanks.forEach(function(blank, i) {
                    var choiceIdx = mapping[i];
                    var choiceText = (choiceIdx !== undefined && choices[choiceIdx]) ? choices[choiceIdx] : '...';
                    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">';
                    html += '<span style="background:#374151;padding:2px 8px;border-radius:4px;font-weight:600;font-size:13px;">' + blank + '</span>';
                    html += '<span style="color:#10B981;font-weight:500;">' + safeEscape(choiceText) + '</span>';
                    html += '</div>';
                });
                html += '</div>';
            }
        } else if (q.type === 'matrix_choice') {
            // Hiển thị bảng với đáp án Đúng/Sai
            var rows = q.rows || [];
            var matrixAnswers = q.correctAnswer || {};
            if (rows.length > 0) {
                html += '<div style="background:rgba(16,185,129,0.1);padding:12px 16px;border-radius:8px;">';
                html += '<div style="color:var(--text-muted);font-size:13px;margin-bottom:8px;">Đáp án:</div>';
                html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
                html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><th style="text-align:left;padding:4px 8px;">Phát biểu</th><th style="width:60px;text-align:center;">Đúng</th><th style="width:60px;text-align:center;">Sai</th></tr></thead>';
                html += '<tbody>';
                rows.forEach(function(row, i) {
                    var answer = matrixAnswers[i];
                    html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">';
                    html += '<td style="padding:4px 8px;">' + safeEscape(row) + '</td>';
                    html += '<td style="text-align:center;">' + (answer === 'Đúng' ? '<span style="color:#10B981;font-weight:600;">✓</span>' : '') + '</td>';
                    html += '<td style="text-align:center;">' + (answer === 'Sai' ? '<span style="color:#EF4444;font-weight:600;">✓</span>' : '') + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table>';
                html += '</div>';
            }
        } else if (q.type === 'true_false') {
            // Hiển thị phát biểu với đáp án - giống phòng luyện
            const isCorrectDung = q.correctAnswer === 'Đúng';
            html += '<div style="padding:16px 0 8px;">';
            html += '<div class="tf-preview-exam-content" style="font-size:16px;line-height:1.7;margin-bottom:16px;font-family:\'Times New Roman\',Cambria,Georgia,serif;color:var(--text);">';
            html += safeRenderContent(q.content || '');
            html += '</div>';
            html += '<div class="tf-preview-exam-options" style="display:flex;justify-content:center;gap:120px;padding:8px 0;">';
            html += '<div style="display:flex;align-items:center;gap:10px;">';
            html += '<div style="width:22px;height:22px;border:2px solid ' + (isCorrectDung ? '#10B981' : 'var(--card-border)') + ';border-radius:50%;background:' + (isCorrectDung ? '#10B981' : 'transparent') + ';"></div>';
            html += '<span style="font-size:18px;font-family:\'Times New Roman\',Cambria,Georgia,serif;color:' + (isCorrectDung ? '#10B981' : 'var(--text)') + ';">Đúng.</span>';
            html += '</div>';
            html += '<div style="display:flex;align-items:center;gap:10px;">';
            html += '<div style="width:22px;height:22px;border:2px solid ' + (!isCorrectDung ? '#EF4444' : 'var(--card-border)') + ';border-radius:50%;background:' + (!isCorrectDung ? '#EF4444' : 'transparent') + ';"></div>';
            html += '<span style="font-size:18px;font-family:\'Times New Roman\',Cambria,Georgia,serif;color:' + (!isCorrectDung ? '#EF4444' : 'var(--text)') + ';">Sai.</span>';
            html += '</div>';
            html += '</div></div>';
        } else if (q.type === 'essay') {
            html += '<div style="background:rgba(255,255,255,0.05);padding:12px 16px;border-radius:8px;min-height:80px;">';
            html += '<span style="color:var(--text-muted);font-size:13px;">Câu trả lời:</span>';
            html += '</div>';
        }

        // Explanation
        if (q.explanation) {
            html += '<div style="margin-top:12px;padding:12px;background:rgba(99,102,241,0.1);border-radius:8px;border-left:3px solid #6366f1;">';
            html += '<div style="font-size:12px;font-weight:600;color:#818cf8;margin-bottom:4px;">💡 Lời giải</div>';
            // [FIX P1-9] Sanitize explanation
            html += '<div style="font-size:13px;">' + safeRenderContent(q.explanation || '') + '</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // Safe escape helper
    function safeEscape(s) {
        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.escapeHtml) {
            return QuestionTypes.escapeHtml(s);
        }
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /**
     * Render nội dung câu hỏi an toàn, cho phép <img> tags từ inline images.
     * Sử dụng escapeHtmlForDisplay nếu có, fallback sang sanitize cơ bản.
     */
    function safeRenderContent(s) {
        if (!s) return '';
        // Ưu tiên dùng escapeHtmlForDisplay nếu có (cho phép img, br, p...)
        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.escapeHtmlForDisplay) {
            return QuestionTypes.escapeHtmlForDisplay(s);
        }
        // Fallback: sanitize cơ bản cho phép img tags
        return basicSanitize(s);
    }

    /**
     * Sanitizer cơ bản - cho phép các thẻ an toàn (img, br, p, span, v.v.)
     * và escape phần còn lại. Dùng khi QuestionTypes chưa load.
     */
    function basicSanitize(html) {
        if (!html) return '';
        const ALLOWED = ['img', 'br', 'p', 'span', 'b', 'i', 'u', 'strong', 'em',
                          'sup', 'sub', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
                          'thead', 'tbody', 'div', 'blockquote', 'pre', 'hr'];
        const ALLOWED_ATTRS = {
            img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'style', 'class'],
            a: ['href', 'title', 'target', 'class'],
            span: ['class', 'style', 'id'],
            div: ['class', 'style', 'id'],
            p: ['class', 'style'],
            table: ['class', 'style'],
        };

        let result = '';
        const TAG_RE = /<\/?([a-z][a-z0-9]*)([^>]*)>/gi;
        let last = 0;
        let match;
        while ((match = TAG_RE.exec(html)) !== null) {
            const [fullTag, tagName, attrs] = match;
            const tagLower = tagName.toLowerCase();
            const isClosing = fullTag.startsWith('</');
            // Text trước thẻ này → escape
            result += escapeText(html.slice(last, match.index));
            last = match.index + fullTag.length;

            if (!ALLOWED.includes(tagLower)) {
                result += escapeText(fullTag);
                continue;
            }

            if (isClosing) {
                result += `</${tagLower}>`;
                continue;
            }

            // Parse và validate attributes
            let cleanAttrs = '';
            if (attrs.trim()) {
                const attrRe = /([a-zA-Z:_][a-zA-Z0-9_:.-]*)\s*=\s*(["'])([^"']*)\2/gi;
                let attrMatch;
                while ((attrMatch = attrRe.exec(attrs)) !== null) {
                    const [fullAttr, attrName, quote, attrVal] = attrMatch;
                    const allowedList = ALLOWED_ATTRS[tagLower] || [];
                    if (!allowedList.includes(attrName.toLowerCase())) continue;
                    const val = attrVal || '';
                    if (tagLower === 'img' && attrName.toLowerCase() === 'src') {
                        if (/^data:image\//.test(val) || /^https?:\/\//.test(val)) {
                            cleanAttrs += ` src="${val}"`;
                        }
                    } else if (tagLower === 'a' && attrName.toLowerCase() === 'href') {
                        if (/^https?:\/\//.test(val)) {
                            cleanAttrs += ` href="${val}"`;
                        }
                    } else {
                        cleanAttrs += ` ${attrName}="${attrVal}"`;
                    }
                }
            }
            if (tagLower === 'img') {
                if (!/\salt\s*=/.test(cleanAttrs)) cleanAttrs += ' alt="Hình ảnh"';
                if (!/\sloading\s*=/.test(cleanAttrs)) cleanAttrs += ' loading="lazy"';
            }
            result += `<${tagLower}${cleanAttrs}>`;
        }
        result += escapeText(html.slice(last));
        return result;
    }

    function escapeText(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br>');
    }

    // Preview question from bank (single question)
    function previewQuestion(questionId) {
        if (typeof QuestionBank === 'undefined' || !QuestionBank.getById) {
            alert('QuestionBank chưa load');
            return;
        }

        var q = QuestionBank.getById(questionId);
        if (!q) {
            alert('Không tìm thấy câu hỏi');
            return;
        }

        var bodyEl = document.getElementById('modalBody');
        var titleEl = document.getElementById('modalTitle');

        if (titleEl) titleEl.innerHTML = '👁️ Xem trước câu hỏi';
        if (bodyEl) {
            bodyEl.innerHTML = renderPreviewQuestion(q, 1);
        }

        // Show modal
        var modal = document.getElementById('appModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }

    // Edit exam - delegate to App.editExam
    function editExam(examId) {
        if (typeof global.App !== 'undefined' && typeof global.App.editExam === 'function') {
            global.App.editExam(examId);
        } else {
            alert('Không thể mở chỉnh sửa. Vui lòng thử lại.');
        }
    }

    // Export
    global.AdminPreview = {
        openExamPreview: openExamPreview,
        closeExamPreview: closeExamPreview,
        previewQuestion: previewQuestion,
        renderPreviewQuestion: renderPreviewQuestion,
        editExam: editExam
    };

})(typeof window !== 'undefined' ? window : globalThis);
