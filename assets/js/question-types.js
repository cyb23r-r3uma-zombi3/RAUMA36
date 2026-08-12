/* ================================================================
   QUESTION TYPES - Định nghĩa 12 dạng câu hỏi
   Tác giả: SKY EDU Team
   Phiên bản: 1.0.0
   Mô tả: Core module định nghĩa metadata, schema, validator, renderer
           cho 12 dạng câu hỏi trong hệ thống khảo thí.
   ================================================================ */

(function (global) {
    'use strict';

    /**
     * Định nghĩa 12 dạng câu hỏi được hỗ trợ
     * Mỗi dạng bao gồm:
     *   - key: mã định danh duy nhất
     *   - label: tên hiển thị
     *   - icon: emoji đại diện
     *   - color: màu chủ đạo
     *   - schema: mô tả cấu trúc dữ liệu câu hỏi
     *   - validate: hàm kiểm tra tính hợp lệ của dữ liệu
     *   - renderForm: hàm sinh HTML cho form nhập liệu (admin)
     *   - renderAnswer: hàm sinh HTML cho khu vực trả lời (thi)
     *   - renderPreview: hàm sinh HTML preview trên card chọn dạng
     *   - grade: hàm chấm điểm tự động
     */
    /* Bỏ tiền tố "Câu X" / "Câu X:" / "<p>Câu X</p>" ở đầu nội dung để tránh lặp với .q-num */
    function _stripCauPrefix(s) {
        if (!s) return s;
        return String(s)
            .replace(/^\s*<p>\s*Câu\s+\d+\s*[.:)\-–—]?\s*<\/p>\s*/i, '')
            .replace(/^\s*<p>\s*Câu\s+\d+\s*[.:)\-–—]?\s*/i, '')
            .replace(/^\s*Câu\s+\d+\s*[.:)\-–—]?\s*/i, '');
    }

    const QUESTION_TYPES = {
        mcq_single: {
            key: 'mcq_single',
            label: 'Trắc nghiệm 1 đáp án',
            shortLabel: 'TN1',
            icon: '🔘',
            color: '#1677FF',
            description: 'Câu hỏi trắc nghiệm với 4 đáp án A/B/C/D, chọn 1 đáp án đúng.',
            schema: {
                prompt: String,       // Đề bài ngữ cảnh (phía trên, riêng biệt)
                content: String,
                options: [String, String, String, String],
                correctAnswer: String, // 'A' | 'B' | 'C' | 'D'
                explanation: String,
                points: Number
            },
            defaults: () => ({
                prompt: '',
                content: '',
                options: ['', '', '', ''],
                correctAnswer: 'A',
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Vui lòng nhập nội dung câu hỏi';
                if (!Array.isArray(q.options) || q.options.length < 2)
                    return 'Cần ít nhất 2 đáp án';
                const filled = q.options.filter(o => o && o.trim());
                if (filled.length < 2) return 'Cần ít nhất 2 đáp án có nội dung';
                if (!q.correctAnswer) return 'Vui lòng chọn đáp án đúng';
                // correctAnswer có thể là 'A'|'B'|'C'|'D' (chuẩn mới) HOẶC text của option (cũ)
                const validLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
                const isLetter = validLetters.includes(q.correctAnswer);
                const isText = q.options.includes(q.correctAnswer);
                if (!isLetter && !isText)
                    return 'Đáp án đúng phải khớp với một trong các lựa chọn';
                return null;
            },
            renderForm(q, idx) {
                const letters = ['A', 'B', 'C', 'D'];
                return `
                    <div class="form-group">
                        <label>Đề bài / Ngữ cảnh (tùy chọn)</label>
                        <textarea class="form-control q-prompt" data-idx="${idx}" rows="2"
                            placeholder="Nhập đề bài, ngữ cảnh, công thức... (hỗ trợ LaTeX)">${escapeHtmlForTextarea(q.prompt || '')}</textarea>
                        <small class="form-hint">Hiển thị phía trên nội dung câu hỏi, dùng cho bài toán có đề bài chung</small>
                    </div>
                    <div class="form-group">
                        <label>Nội dung câu hỏi <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: (x^2), (\\frac{a}{b}))">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Các đáp án <span class="required">*</span></label>
                        ${letters.map((L, i) => `
                            <div class="option-input-row">
                                <span class="option-letter">${L}</span>
                                <input type="text" class="form-control q-option" data-idx="${idx}" data-opt="${i}"
                                    placeholder="Đáp án ${L}" value="${escapeHtml(q.options[i] || '')}">
                            </div>
                        `).join('')}
                    </div>
                    <div class="form-group">
                        <label>Đáp án đúng <span class="required">*</span></label>
                        <div class="correct-options">
                            ${letters.map((L, i) => {
                                // correctAnswer lưu dạng 'A'|'B'|'C'|'D' (theo defaults)
                                // Đồng thời hỗ trợ cả trường hợp cũ lưu theo text của options
                                const opt = q.options[i] || '';
                                const isChecked = q.correctAnswer === L || q.correctAnswer === opt;
                                return `
                                <label class="correct-option">
                                    <input type="radio" name="correct-${idx}" value="${L}"
                                        ${isChecked ? 'checked' : ''}>
                                    <span>${L}. ${escapeHtml(opt || 'Đáp án ' + L)}</span>
                                </label>
                            `;}).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2"
                            placeholder="Giải thích đáp án đúng...">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const letters = ['A', 'B', 'C', 'D'];
                const userAns = saved || '';
                const allEmpty = !q.options || q.options.every(o => !o || !o.trim());
                if (allEmpty) {
                    return `
                        <div class="answer-mcq answer-mcq-single">
                            ${letters.map(L => `
                                <label class="mcq-choice" data-letter="${L}">
                                    <span class="mcq-marker"></span>
                                    <span class="mcq-text"><span class="mcq-letter-pref">${L}.</span> <span class="mcq-blank-line-inline"></span></span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                }
                // correctAnswer có thể là 'A'/'B'/'C'/'D' hoặc text. Quy đổi về index (0-3).
                const correctIdx = letters.indexOf(q.correctAnswer);
                return `
                    <div class="answer-mcq answer-mcq-single">
                        ${letters.map((L, i) => {
                            const txt = q.options[i] || `Đáp án ${L}`;
                            const isPlaceholder = !q.options[i];
                            const optValue = q.options[i] || '';
                            // So sánh: ưu tiên letter, fallback text (tương thích cũ)
                            const isSelected = userAns === L || (correctIdx >= 0 ? false : userAns === optValue) || (userAns && correctIdx < 0 && userAns === optValue);
                            return `
                            <label class="mcq-choice ${isSelected ? 'selected' : ''}" data-letter="${L}">
                                <input type="radio" name="q-${q.id}" value="${L}"
                                    ${isSelected ? 'checked' : ''}>
                                <span class="mcq-marker"></span>
                                <span class="mcq-text ${isPlaceholder ? 'mcq-text-placeholder' : ''}">${escapeHtml(txt)}</span>
                            </label>
                        `;}).join('')}
                    </div>
                `;
            },
            renderAnswerMulti(q, saved) {
                const letters = ['A', 'B', 'C', 'D'];
                const userAns = Array.isArray(saved) ? saved : [];
                const allEmpty = !q.options || q.options.every(o => !o || !o.trim());
                if (allEmpty) {
                    return `
                        <div class="answer-mcq answer-mcq-multi">
                            ${letters.map(L => `
                                <label class="mcq-choice">
                                    <span class="mcq-marker"></span>
                                    <span class="mcq-text">&nbsp;</span>
                                </label>
                            `).join('')}
                        </div>
                    `;
                }
                return `
                    <div class="answer-mcq answer-mcq-multi">
                        ${letters.map((L, i) => {
                            const txt = q.options[i] || `Đáp án ${L}`;
                            const isPlaceholder = !q.options[i];
                            const isSel = userAns.includes(q.options[i]) && q.options[i];
                            return `
                            <label class="mcq-choice ${isSel ? 'selected' : ''}">
                                <input type="checkbox" name="q-${q.id}" value="${escapeHtml(q.options[i] || '')}"
                                    ${isSel ? 'checked' : ''}>
                                <span class="mcq-marker"></span>
                                <span class="mcq-text ${isPlaceholder ? 'mcq-text-placeholder' : ''}">${escapeHtml(txt)}</span>
                            </label>
                        `;}).join('')}
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="q-header">
                        <div class="q-header-left">
                            <span class="q-num">Câu 1</span>
                            <span class="q-type-tag">Trắc nghiệm 1 đáp án</span>
                        </div>
                        <span class="q-points">1 điểm</span>
                    </div>
                    <div class="q-stem">
                        Thể tích của hình cầu bán kính \\(2\\) là:
                    </div>
                    <div class="answer-mcq answer-mcq-single" data-preview-mcq>
                        ${(() => {
                            const opts = ['\\(4\\pi\\)', '\\(8\\pi\\)', '\\(16\\pi\\)', '\\(32\\pi\\)'];
                            return opts.map(o => `
                                <label class="mcq-choice" data-mcq-radio>
                                    <span class="mcq-marker"></span>
                                    <span class="mcq-text">${o}</span>
                                </label>
                            `).join('');
                        })()}
                    </div>
                `;
            },
            grade(q, userAnswer) {
                if (!userAnswer) return { correct: false, partial: 0, total: q.points || 1 };
                // Unescape HTML entities từ getAnswer (phòng trường hợp text có special chars)
                function unescapeHtml(str) {
                    if (!str) return '';
                    return String(str)
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'");
                }
                const userAns = unescapeHtml(userAnswer);
                // Hỗ trợ cả 2 format correctAnswer:
                //   - Mới: 'A'|'B'|'C'|'D' (letter)
                //   - Cũ: text của option
                // Quy đổi cả 2 về text option để so sánh
                const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                const correctIdx = letters.indexOf(q.correctAnswer);
                const correctText = (correctIdx >= 0 && q.options && q.options[correctIdx] !== undefined)
                    ? q.options[correctIdx]
                    : q.correctAnswer;
                const userIdx = letters.indexOf(userAns);
                const userText = (userIdx >= 0 && q.options && q.options[userIdx] !== undefined)
                    ? q.options[userIdx]
                    : userAns;
                const isCorrect = (correctText === userText) || (userAns === q.correctAnswer);
                return {
                    correct: isCorrect,
                    partial: isCorrect ? (q.points || 1) : 0,
                    total: q.points || 1
                };
            }
        },

        mcq_multi: {
            key: 'mcq_multi',
            label: 'Trắc nghiệm nhiều đáp án',
            shortLabel: 'TN-N',
            icon: '☑️',
            color: '#10B981',
            description: 'Câu hỏi trắc nghiệm cho phép chọn nhiều đáp án đúng.',
            schema: {
                prompt: String,       // Đề bài ngữ cảnh (phía trên, riêng biệt)
                content: String,
                options: [String],
                correctAnswers: [String], // mảng các giá trị đáp án đúng
                explanation: String,
                points: Number
            },
            defaults: () => ({
                prompt: '',
                content: '',
                options: ['', '', '', ''],
                correctAnswers: [],
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Vui lòng nhập nội dung câu hỏi';
                const filled = (q.options || []).filter(o => o && o.trim());
                if (filled.length < 2) return 'Cần ít nhất 2 đáp án có nội dung';
                if (!q.correctAnswers || q.correctAnswers.length === 0)
                    return 'Vui lòng chọn ít nhất 1 đáp án đúng';
                return null;
            },
            renderForm(q, idx) {
                return `
                    <div class="form-group">
                        <label>Đề bài / Ngữ cảnh (tùy chọn)</label>
                        <textarea class="form-control q-prompt" data-idx="${idx}" rows="2"
                            placeholder="Nhập đề bài, ngữ cảnh, công thức... (hỗ trợ LaTeX)">${escapeHtmlForTextarea(q.prompt || '')}</textarea>
                        <small class="form-hint">Hiển thị phía trên nội dung câu hỏi, dùng cho bài toán có đề bài chung</small>
                    </div>
                    <div class="form-group">
                        <label>Nội dung câu hỏi <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: (x^2), (\\frac{a}{b}))">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Các đáp án (có thể thêm/bớt) <span class="required">*</span></label>
                        <div class="options-list" data-idx="${idx}">
                            ${(q.options || []).map((opt, i) => `
                                <div class="option-input-row">
                                    <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                                    <input type="text" class="form-control q-option" data-idx="${idx}" data-opt="${i}"
                                        placeholder="Đáp án ${String.fromCharCode(65 + i)}" value="${escapeHtml(opt || '')}">
                                    <button type="button" class="btn-icon btn-remove-option" onclick="QuestionTypes.removeOption(${idx}, ${i})" aria-label="Xóa đáp án ${String.fromCharCode(65 + i)}" title="Xóa đáp án ${String.fromCharCode(65 + i)}">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addOption(${idx})">+ Thêm đáp án</button>
                    </div>
                    <div class="form-group">
                        <label>Đáp án đúng (chọn nhiều) <span class="required">*</span></label>
                        <div class="correct-options">
                            ${(q.options || []).map((opt, i) => {
                                // Kiểm tra bằng text tại vị trí i — tương thích cả edit (text) lẫn index-based save
                                const willCheck = (q.correctAnswers || []).includes(q.options[i]);
                                return `
                                <label class="correct-option">
                                    <input type="checkbox" class="correct-multi-cb" data-opt-idx="${i}" name="correct-multi-${idx}"
                                        ${willCheck ? 'checked' : ''}>
                                    <span>${String.fromCharCode(65 + i)}. ${escapeHtml(opt || 'Đáp án ' + String.fromCharCode(65 + i))}</span>
                                </label>`;
                            }).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                // IMPORTANT: checkbox value uses raw text (not escapeHtml) for consistency
                // with how correctAnswers are stored in the database (raw text, not escaped).
                // When grading, both sides are unescaped before comparison.
                function unescapeHtml(str) {
                    if (!str) return '';
                    return String(str)
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'");
                }
                const userAns = (saved || []).map(a => unescapeHtml(a));
                return `
                    <div class="answer-mcq-multi">
                        ${(q.options || []).map((opt, i) => `
                            <label class="mcq-choice ${userAns.includes(unescapeHtml(opt)) ? 'selected' : ''}">
                                <input type="checkbox" name="q-${q.id}" value="${opt || ''}"
                                    ${userAns.includes(unescapeHtml(opt)) ? 'checked' : ''}>
                                <span class="mcq-marker"></span>
                                <span class="mcq-text">${escapeHtml(opt || '')}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="preview-mcq">
                        <div class="mcq-preview-row"><span class="mcq-preview-letter">A</span><span class="mcq-preview-text">Đáp án A</span></div>
                        <div class="mcq-preview-row selected"><span class="mcq-preview-letter">B</span><span class="mcq-preview-text">Đáp án B</span><span class="check-mark">✓</span></div>
                        <div class="mcq-preview-row"><span class="mcq-preview-letter">C</span><span class="mcq-preview-text">Đáp án C</span></div>
                        <div class="mcq-preview-row selected"><span class="mcq-preview-letter">D</span><span class="mcq-preview-text">Đáp án D</span><span class="check-mark">✓</span></div>
                    </div>
                `;
            },
            grade(q, userAnswer) {
                if (!userAnswer || !Array.isArray(userAnswer) || userAnswer.length === 0)
                    return { correct: false, partial: 0, total: q.points || 1 };
                
                // Hàm unescape HTML entities để so sánh chính xác
                function unescapeHtml(str) {
                    if (!str) return '';
                    return String(str)
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'");
                }

                // Hàm escape để so sánh đồng nhất
                function escapeForCompare(str) {
                    if (!str) return '';
                    return String(str)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }

                // Hỗ trợ cả 2 format correctAnswers:
                //   - Mới: ['A', 'B', 'C'] (letters)
                //   - Cũ: [text của options]
                // Quy đổi cả 2 về text options đã unescape để so sánh
                const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                const correct = (q.correctAnswers || []).map(ans => {
                    const idx = letters.indexOf(ans);
                    if (idx >= 0 && q.options && q.options[idx] !== undefined) {
                        // Là letter → lấy text từ options và unescape
                        return unescapeHtml(q.options[idx]);
                    }
                    // Là text trực tiếp → unescape
                    return unescapeHtml(ans);
                });
                
                // Unescape userAnswer vì getAnswer() lấy từ DOM đã bị escape HTML
                const user = userAnswer.map(ans => {
                    const unescaped = unescapeHtml(ans);
                    const idx = letters.indexOf(unescaped);
                    if (idx >= 0 && q.options && q.options[idx] !== undefined) {
                        // Là letter → lấy text từ options và unescape
                        return unescapeHtml(q.options[idx]);
                    }
                    return unescaped;
                });
                
                const correctSet = new Set(correct);
                const userSet = new Set(user);
                let matches = 0;
                correctSet.forEach(a => { if (userSet.has(a)) matches++; });
                const wrong = user.filter(a => !correctSet.has(a)).length;
                // Partial credit: (matches - wrong) / totalCorrect
                const total = q.points || 1;
                const partial = Math.max(0, (matches - wrong) / correctSet.size) * total;
                return {
                    correct: matches === correctSet.size && wrong === 0,
                    partial: parseFloat(partial.toFixed(2)),
                    total
                };
            }
        },

        essay: {
            key: 'essay',
            label: 'Tự luận',
            shortLabel: 'TL',
            icon: '📝',
            color: '#F59E0B',
            description: 'Câu hỏi tự luận với Rubric chấm điểm chi tiết.',
            schema: {
                content: String,
                rubric: String,
                sampleAnswer: String,
                explanation: String,
                points: Number
            },
            defaults: () => ({
                content: '',
                rubric: '',
                sampleAnswer: '',
                explanation: '',
                points: 5
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Vui lòng nhập nội dung câu hỏi';
                return null;
            },
            renderForm(q, idx) {
                return `
                    <div class="form-group">
                        <label>Đề bài tự luận <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="4"
                            placeholder="Nhập đề bài tự luận...">${escapeHtmlForTextarea(q.content || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Rubric chấm điểm (tùy chọn)</label>
                        <textarea class="form-control q-rubric" data-idx="${idx}" rows="4"
                            placeholder="Mô tả tiêu chí chấm điểm, ví dụ:&#10;- Trình bày rõ ràng: 2đ&#10;- Lập luận chặt chẽ: 2đ&#10;- Kết quả đúng: 1đ">${escapeHtmlForTextarea(q.rubric || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Đáp án mẫu (tùy chọn)</label>
                        <textarea class="form-control q-sample" data-idx="${idx}" rows="4"
                            placeholder="Đáp án mẫu để giáo viên tham khảo...">${escapeHtmlForTextarea(q.sampleAnswer || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Tổng điểm</label>
                        <input type="number" class="form-control q-points" data-idx="${idx}" min="0" step="0.5" 
                            value="${q.points || 5}">
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                return `
                    <div class="answer-essay">
                        <textarea class="form-control essay-textarea" data-qid="${q.id}" rows="8"
                            placeholder="Nhập câu trả lời của bạn...">${escapeHtmlForTextarea(saved || '')}</textarea>
                        <small class="text-muted">Tối đa ${q.points || 5} điểm</small>
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="preview-essay">
                        <div class="essay-textbox">Nhập câu trả lời của bạn...</div>
                    </div>
                `;
            },
            grade(q, userAnswer) {
                // Tự luận cần chấm tay
                return {
                    correct: null,
                    partial: 0,
                    total: q.points || 5,
                    needsManualGrading: true
                };
            }
        },

        fill_blank: {
            key: 'fill_blank',
            label: 'Điền khuyết',
            shortLabel: 'ĐK',
            icon: '✏️',
            color: '#06B6D4',
            description: 'Câu hỏi điền từ vào chỗ trống trong câu. Hỗ trợ 1-2 chỗ trống.',
            schema: {
                prompt: String,    // Đề bài ngữ cảnh (phía trên, riêng biệt)
                content: String,   // Câu có [1], [2] cho chỗ trống
                correctAnswers: [String],
                explanation: String,
                points: Number
            },
            defaults: () => ({
                prompt: '',
                content: '',
                correctAnswers: [],
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Vui lòng nhập nội dung câu hỏi';
                const blanks = (q.content.match(/\[\d+\]/g) || []).length;
                if (blanks === 0) return 'Câu hỏi cần có ít nhất 1 chỗ trống, dùng [1], [2]...';
                if (!q.correctAnswers || q.correctAnswers.length === 0)
                    return 'Vui lòng thêm đáp án bằng nút "+ Thêm đáp án"';
                const emptyAnswers = q.correctAnswers.filter(a => !a || !a.trim());
                if (emptyAnswers.length > 0)
                    return 'Vui lòng nhập đáp án cho tất cả các chỗ trống';
                if (q.correctAnswers.length < blanks)
                    return `Cần nhập đáp án cho ${blanks} chỗ trống`;
                return null;
            },
            renderForm(q, idx) {
                const blanks = (q.content || '').match(/\[\d+\]/g) || [];
                const blankCount = blanks.length;
                const hasAnswers = q.correctAnswers && q.correctAnswers.length > 0;
                return `
                    <div class="form-group">
                        <label>Đề bài (ngữ cảnh, không bắt buộc)</label>
                        <textarea class="form-control q-prompt" data-idx="${idx}" rows="2"
                            placeholder="Ví dụ: Bài toán về đội bóng đá, hãy điền số liệu phù hợp...">${escapeHtmlForTextarea(q.prompt || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                        <small class="form-hint">Phần giới thiệu ngữ cảnh, hiển thị phía trên câu hỏi</small>
                    </div>
                    <div class="form-group">
                        <label>Câu có chỗ trống (dùng <code>[1]</code>, <code>[2]</code> cho chỗ trống) <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: (x^2), (\\frac{a}{b}))"
                            oninput="QuestionTypes.updateFillBlankAnswers(${idx})">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <small>Đã phát hiện: <strong>${blankCount} chỗ trống</strong></small>
                    </div>
                    <div class="form-group">
                        <label>Đáp án cho các chỗ trống <span class="required">*</span></label>
                        <div class="blanks-answers" data-idx="${idx}">
                            ${hasAnswers ? q.correctAnswers.map((ans, i) => `
                                <div class="blank-answer-row">
                                    <span class="blank-label">[${i + 1}]</span>
                                    <input type="text" class="form-control q-blank-answer" data-idx="${idx}" data-pos="${i}"
                                        placeholder="Đáp án cho vị trí [${i + 1}]" value="${escapeHtml(ans || '')}">
                                </div>
                            `).join('') : '<div class="blank-empty-notice">Chưa có đáp án nào. Bấm "Thêm đáp án" để tạo.</div>'}
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addBlankAnswer(${idx})">+ Thêm đáp án</button>
                            ${hasAnswers ? '<button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeBlankAnswer(${idx})">− Xóa đáp án cuối</button>' : ''}
                        </div>
                        <small style="color: #374151;">Mỗi dòng tương ứng 1 chỗ trống. Số đáp án phải khớp số <code>[1] [2] ...</code> trong nội dung.</small>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const content = _stripCauPrefix(q.content || '');
                const blanks = content.match(/\[\d+\]/g) || [];
                let html = '<div class="answer-fill">';
                const parts = content.split(/\[\d+\]/);
                const userAns = saved || [];
                for (let i = 0; i < parts.length; i++) {
                    // Sử dụng escapeHtmlWithImages để giữ nguyên <img> tags nếu có
                    const part = escapeHtmlWithImages(parts[i] || '');
                    html += part;
                    if (i < blanks.length) {
                        const placeholder = userAns[i] || '';
                        html += `<input type="text" class="fill-blank-input" data-qid="${q.id}" data-pos="${i}" value="${escapeHtml(placeholder)}" placeholder=" " autocomplete="off" spellcheck="false">`;
                    }
                }
                html += '</div>';
                return html;
            },
            renderPreview() {
                return `
                    <div class="preview-fill">
                        <span>Một đội bóng có</span>
                        <span class="fill-blank-box">[1]</span>
                        <span>người và</span>
                        <span class="fill-blank-box">[2]</span>
                        <span>thủ môn.</span>
                    </div>
                `;
            },
            grade(q, userAnswer) {
                if (!userAnswer || !Array.isArray(userAnswer))
                    return { correct: false, partial: 0, total: q.points || 1 };
                const correct = q.correctAnswers || [];
                let matches = 0;
                const total = q.points || 1;
                correct.forEach((ans, i) => {
                    if ((userAnswer[i] || '').trim().toLowerCase() === (ans || '').trim().toLowerCase()) {
                        matches++;
                    }
                });
                return {
                    correct: matches === correct.length,
                    partial: (matches / Math.max(correct.length, 1)) * total,
                    total
                };
            }
        },

        word_arrange: {
            key: 'word_arrange',
            label: 'Sắp xếp từ thành câu',
            shortLabel: 'SX',
            icon: '🔀',
            color: '#8B5CF6',
            description: 'Sắp xếp các từ/đoạn văn bản cho trước thành câu hoàn chỉnh đúng thứ tự.',
            schema: {
                content: String,
                words: [String],        // danh sách từ (đã xáo trộn)
                correctOrder: [Number], // thứ tự đúng (chỉ số trong mảng words)
                explanation: String,
                points: Number
            },
            defaults: () => ({
                content: 'Sắp xếp các từ sau thành câu hoàn chỉnh:',
                words: ['học', 'sinh', 'Việt', 'Nam', 'chăm', 'học'],
                correctOrder: [2, 3, 0, 4, 1, 5], // "sinh Việt Nam học chăm học"
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.words || q.words.length < 2) return 'Cần ít nhất 2 từ';
                if (!q.correctOrder || q.correctOrder.length !== q.words.length)
                    return 'Thứ tự đúng phải chứa tất cả các từ';
                return null;
            },
            renderForm(q, idx) {
                return `
                    <div class="form-group">
                        <label>Hướng dẫn</label>
                        <input type="text" class="form-control q-content" data-idx="${idx}"
                            value="${escapeHtml(q.content || '')}" placeholder="Sắp xếp các từ sau thành câu hoàn chỉnh:">
                    </div>
                    <div class="form-group">
                        <label>Các từ (mỗi từ một dòng) <span class="required">*</span></label>
                        <textarea class="form-control q-words" data-idx="${idx}" rows="5"
                            placeholder="học&#10;sinh&#10;Việt&#10;Nam&#10;chăm">${(q.words || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Thứ tự đúng (mỗi số một dòng, bắt đầu từ 0) <span class="required">*</span></label>
                        <textarea class="form-control q-correct-order" data-idx="${idx}" rows="5"
                            placeholder="0&#10;1&#10;2&#10;3&#10;4">${(q.correctOrder || []).join('\n')}</textarea>
                        <small>Ví dụ: "0,2,1" nghĩa là từ 0, rồi từ 2, rồi từ 1</small>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userOrder = saved || [];
                // Xáo trộn MẢNG CÁC INDEX GỐC (không xáo trộn mảng words/sentences).
                // data-pos PHẢI là index gốc vào q.words, để getAnswer() đọc lại
                // và grade() so sánh trực tiếp với q.correctOrder.
                let order;
                if (userOrder.length > 0) {
                    // Đã có thứ tự từ user (saved) — render đúng theo saved.
                    order = userOrder.map(Number);
                } else {
                    // Lần render đầu: shuffle các index gốc.
                    const n = (q.words || []).length;
                    order = [];
                    for (let i = 0; i < n; i++) order.push(i);
                    for (let i = n - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
                    }
                }
                return `
                    <div class="answer-arrange" data-qid="${q.id}">
                        <div class="arrange-list" data-qid="${q.id}">
                            ${order.map(originalIdx => `
                                <span class="arrange-chip" draggable="true" data-pos="${originalIdx}">${escapeHtml(q.words[originalIdx] || '')}</span>
                            `).join('')}
                        </div>
                        <p class="arrange-hint">Kéo thả để sắp xếp lại thứ tự</p>
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="preview-arrange">
                        <span class="arrange-chip-preview">từ 1</span>
                        <span class="arrange-chip-preview">từ 2</span>
                        <span class="arrange-chip-preview">từ 3</span>
                        <span class="arrange-chip-preview">từ 4</span>
                    </div>
                `;
            },
            grade(q, userOrder) {
                if (!userOrder || !Array.isArray(userOrder))
                    return { correct: false, partial: 0, total: q.points || 1 };
                const correct = q.correctOrder || [];
                const total = q.points || 1;
                let matches = 0;
                for (let i = 0; i < correct.length; i++) {
                    if (userOrder[i] === correct[i]) matches++;
                }
                return {
                    correct: matches === correct.length,
                    partial: (matches / Math.max(correct.length, 1)) * total,
                    total
                };
            }
        },

        matching: {
            key: 'matching',
            label: 'Ghép đôi',
            shortLabel: 'GH',
            icon: '🔗',
            color: '#EC4899',
            description: 'Nối các phần tử cột trái với phần tử tương ứng ở cột phải.',
            schema: {
                content: String,
                pairs: [{ left: String, right: String }],
                explanation: String,
                points: Number
            },
            defaults: () => ({
                content: 'Ghép từ ở cột A với nghĩa tương ứng ở cột B:',
                pairs: [
                    { left: 'apple', right: 'quả táo' },
                    { left: 'banana', right: 'quả chuối' },
                    { left: 'cherry', right: 'quả cherry' }
                ],
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.pairs || q.pairs.length < 2) return 'Cần ít nhất 2 cặp ghép';
                const empty = q.pairs.find(p => !p.left || !p.right);
                if (empty) return 'Có cặp ghép bị trống';
                return null;
            },
            renderForm(q, idx) {
                return `
                    <div class="form-group">
                        <label>Hướng dẫn</label>
                        <input type="text" class="form-control q-content" data-idx="${idx}"
                            value="${escapeHtml(q.content || '')}" placeholder="Ghép từ ở cột A với nghĩa ở cột B:">
                    </div>
                    <div class="form-group">
                        <label>Các cặp ghép <span class="required">*</span></label>
                        <div class="pairs-list" data-idx="${idx}">
                            ${(q.pairs || []).map((p, i) => `
                                <div class="pair-row">
                                    <input type="text" class="form-control q-pair-left" data-idx="${idx}" data-pos="${i}"
                                        placeholder="Cột A" value="${escapeHtml(p.left || '')}">
                                    <span class="pair-arrow">→</span>
                                    <input type="text" class="form-control q-pair-right" data-idx="${idx}" data-pos="${i}"
                                        placeholder="Cột B" value="${escapeHtml(p.right || '')}">
                                    <button type="button" class="btn-icon btn-remove-pair" onclick="QuestionTypes.removePair(${idx}, ${i})" aria-label="Xóa cặp ghép ${i + 1}" title="Xóa cặp ghép ${i + 1}">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addPair(${idx})">+ Thêm cặp</button>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userPairs = saved || {};
                // Hiển thị cột trái cố định, cột phải dạng dropdown
                return `
                    <div class="answer-matching">
                        <table class="matching-table">
                            <thead>
                                <tr>
                                    <th>Cột A</th>
                                    <th>Cột B (chọn)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(q.pairs || []).map((p, i) => `
                                    <tr>
                                        <td><strong>${escapeHtml(p.left)}</strong></td>
                                        <td>
                                            <select class="form-control q-match-select" data-qid="${q.id}" data-pos="${i}">
                                                <option value="">-- Chọn --</option>
                                                ${(q.pairs || []).map((p2, j) => `
                                                    <option value="${j}" ${userPairs[i] == j ? 'selected' : ''}>
                                                        ${String.fromCharCode(65 + j)}. ${escapeHtml(p2.right)}
                                                    </option>
                                                `).join('')}
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="preview-matching">
                        <div class="match-col">
                            <div class="match-item">A</div>
                            <div class="match-item">B</div>
                            <div class="match-item">C</div>
                        </div>
                        <div class="match-col">
                            <div class="match-item">D</div>
                            <div class="match-item">E</div>
                            <div class="match-item">F</div>
                        </div>
                    </div>
                `;
            },
            grade(q, userPairs) {
                if (!userPairs) return { correct: false, partial: 0, total: q.points || 1 };
                const total = q.points || 1;
                const n = q.pairs.length;
                let matches = 0;
                for (let i = 0; i < n; i++) {
                    if (parseInt(userPairs[i]) === i) matches++;
                }
                return {
                    correct: matches === n,
                    partial: (matches / n) * total,
                    total
                };
            }
        },

        true_false: {
            key: 'true_false',
            label: 'Đúng/Sai',
            shortLabel: 'Đ/S',
            icon: '✓✗',
            color: '#14B8A6',
            description: 'Câu hỏi với 2 lựa chọn Đúng hoặc Sai.',
            schema: {
                prompt: String,       // Đề bài ngữ cảnh (phía trên, riêng biệt)
                content: String,
                correctAnswer: String, // 'Đúng' | 'Sai'
                explanation: String,
                points: Number
            },
            defaults: () => ({
                prompt: '',
                content: '',
                correctAnswer: 'Đúng',
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Vui lòng nhập nội dung';
                if (!q.correctAnswer) return 'Vui lòng chọn đáp án đúng';
                return null;
            },
            renderForm(q, idx) {
                const isTrue = q.correctAnswer === 'Đúng';
                const isFalse = q.correctAnswer === 'Sai';
                return `
                    <div class="form-group">
                        <label>Đề bài / Ngữ cảnh (tùy chọn)</label>
                        <textarea class="form-control q-prompt" data-idx="${idx}" rows="2"
                            placeholder="Nhập đề bài, ngữ cảnh, công thức... (hỗ trợ LaTeX)">${escapeHtmlForTextarea(q.prompt || '')}</textarea>
                        <small class="form-hint">Hiển thị phía trên nội dung câu hỏi, dùng cho bài toán có đề bài chung</small>
                    </div>
                    <div class="tf-form-container">
                        <div class="tf-form-section">
                            <label class="tf-form-label">Phát biểu <span class="required">*</span></label>
                            <textarea class="form-control q-content tf-content-input" data-idx="${idx}" rows="4"
                                placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: $x^2$, $\\frac{a}{b}$)">${escapeHtmlForTextarea(q.content || '')}</textarea>
                            <div class="inline-images-zone" data-idx="${idx}">
                                <div class="inline-images-list"></div>
                                <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                    title="Dán ảnh vào nội dung"
                                    style="margin-top:8px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                    📷 Dán ảnh vào nội dung
                                </button>
                            </div>
                        </div>
                        <div class="tf-form-section">
                            <label class="tf-form-label">Đáp án đúng <span class="required">*</span></label>
                            <div class="tf-form-answers">
                                <label class="tf-form-option ${isTrue ? 'active' : ''}">
                                    <input type="radio" name="correct-tf-${idx}" value="Đúng" ${isTrue ? 'checked' : ''}>
                                    <span class="tf-form-radio"></span>
                                    <span class="tf-form-text">Đúng</span>
                                </label>
                                <label class="tf-form-option ${isFalse ? 'active' : ''}">
                                    <input type="radio" name="correct-tf-${idx}" value="Sai" ${isFalse ? 'checked' : ''}>
                                    <span class="tf-form-radio"></span>
                                    <span class="tf-form-text">Sai</span>
                                </label>
                            </div>
                        </div>
                        <div class="tf-form-section">
                            <label class="tf-form-label">Giải thích (tùy chọn)</label>
                            <textarea class="form-control q-explanation" data-idx="${idx}" rows="2"
                                placeholder="Nhập giải thích đáp án">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                        </div>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userAns = saved || '';
                const checkedD = userAns === 'Đúng' ? 'checked' : '';
                const checkedS = userAns === 'Sai' ? 'checked' : '';
                const escaped = escapeHtmlForDisplay(q.content || '');
                return `
                    <div class="tf-answer-area">
                        <div class="tf-question-text">${escaped}</div>
                        <div class="tf-options-row">
                            <label class="tf-option-item">
                                <input type="radio" name="q-${q.id}" value="Đúng" class="tf-hidden-input" ${checkedD}>
                                <span class="tf-custom-radio"></span>
                                <span class="tf-option-label">Đúng</span>
                            </label>
                            <label class="tf-option-item">
                                <input type="radio" name="q-${q.id}" value="Sai" class="tf-hidden-input" ${checkedS}>
                                <span class="tf-custom-radio"></span>
                                <span class="tf-option-label">Sai</span>
                            </label>
                        </div>
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="tf-mini-preview">
                        <span class="tf-mini-radio"></span>
                        <span class="tf-mini-text">Đúng.</span>
                        <span class="tf-mini-separator">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                        <span class="tf-mini-radio"></span>
                        <span class="tf-mini-text">Sai.</span>
                    </div>
                `;
            },
            grade(q, userAnswer) {
                if (!userAnswer) return { correct: false, partial: 0, total: q.points || 1 };
                return {
                    correct: userAnswer === q.correctAnswer,
                    partial: userAnswer === q.correctAnswer ? (q.points || 1) : 0,
                    total: q.points || 1
                };
            }
        },

        sentence_order: {
            key: 'sentence_order',
            label: 'Sắp xếp câu/đoạn văn',
            shortLabel: 'SXV',
            icon: '📋',
            color: '#F97316',
            description: 'Sắp xếp thứ tự các câu/đoạn văn cho trước để tạo thành đoạn văn hoàn chỉnh.',
            schema: {
                content: String,
                sentences: [String],     // các câu/đoạn (đã xáo trộn)
                correctOrder: [Number],  // thứ tự đúng
                explanation: String,
                points: Number
            },
            defaults: () => ({
                content: 'Sắp xếp các câu sau thành đoạn văn hoàn chỉnh:',
                sentences: [
                    'Hôm nay trời đẹp.',
                    'Tôi đi học.',
                    'Trên đường gặp bạn A.',
                    'Chúng tôi đi chơi cùng nhau.'
                ],
                correctOrder: [0, 1, 2, 3],
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.sentences || q.sentences.length < 2) return 'Cần ít nhất 2 câu';
                if (!q.correctOrder || q.correctOrder.length !== q.sentences.length)
                    return 'Thứ tự đúng phải chứa tất cả các câu';
                return null;
            },
            renderForm(q, idx) {
                return `
                    <div class="form-group">
                        <label>Hướng dẫn</label>
                        <input type="text" class="form-control q-content" data-idx="${idx}"
                            value="${escapeHtml(q.content || '')}" placeholder="Sắp xếp các câu sau:">
                    </div>
                    <div class="form-group">
                        <label>Các câu/đoạn văn (mỗi câu một dòng) <span class="required">*</span></label>
                        <textarea class="form-control q-sentences" data-idx="${idx}" rows="6"
                            placeholder="Câu 1...&#10;Câu 2...&#10;Câu 3...">${(q.sentences || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Thứ tự đúng (mỗi số một dòng, từ 0) <span class="required">*</span></label>
                        <textarea class="form-control q-correct-order" data-idx="${idx}" rows="6"
                            placeholder="0&#10;1&#10;2&#10;3">${(q.correctOrder || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userOrder = saved || [];
                // Tương tự word_arrange: shuffle mảng INDEX GỐC để data-pos giữ
                // identity của từng câu, để getAnswer() + grade() so sánh đúng với
                // q.correctOrder (vốn là chỉ số vào q.sentences).
                let order;
                if (userOrder.length > 0) {
                    order = userOrder.map(Number);
                } else {
                    const n = (q.sentences || []).length;
                    order = [];
                    for (let i = 0; i < n; i++) order.push(i);
                    for (let i = n - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
                    }
                }
                return `
                    <div class="answer-sentence-order" data-qid="${q.id}">
                        <ol class="sentence-list" data-qid="${q.id}">
                            ${order.map(originalIdx => `
                                <li class="sentence-item" draggable="true" data-pos="${originalIdx}">
                                    <span class="drag-handle">⋮⋮</span>
                                    <span class="sentence-text">${escapeHtml(q.sentences[originalIdx] || '')}</span>
                                </li>
                            `).join('')}
                        </ol>
                        <p class="arrange-hint">Kéo thả để sắp xếp lại</p>
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="preview-sentence-order">
                        <div class="sentence-preview-item">1. Câu thứ nhất</div>
                        <div class="sentence-preview-item">2. Câu thứ hai</div>
                        <div class="sentence-preview-item">3. Câu thứ ba</div>
                    </div>
                `;
            },
            grade(q, userOrder) {
                if (!userOrder || !Array.isArray(userOrder))
                    return { correct: false, partial: 0, total: q.points || 1 };
                const correct = q.correctOrder || [];
                const total = q.points || 1;
                let matches = 0;
                for (let i = 0; i < correct.length; i++) {
                    if (userOrder[i] === correct[i]) matches++;
                }
                return {
                    correct: matches === correct.length,
                    partial: (matches / Math.max(correct.length, 1)) * total,
                    total
                };
            }
        },

        drag_drop: {
            key: 'drag_drop',
            label: 'Kéo thả từ/câu',
            shortLabel: 'KT',
            icon: '👆',
            color: '#0EA5E9',
            description: 'Kéo thả các phương án vào vị trí thích hợp trong câu.',
            schema: {
                prompt: String,        // Đề bài ngữ cảnh (SGK, phía trên)
                content: String,       // Câu có [1], [2] cho chỗ trống cần kéo đáp án vào
                choices: [String],     // các phương án để kéo thả
                correctMapping: Object, // { targetIndex: choiceIndex }
                explanation: String,
                points: Number
            },
            defaults: () => ({
                prompt: '',
                content: '',
                choices: [],
                correctMapping: {},
                explanation: '',
                points: 1
            }),
            validate(q) {
                // Drag-drop dùng content có [1], [2]... làm "vị trí" (không dùng q.targets)
                const blanks = (q.content || '').match(/\[\d+\]/g) || [];
                if (blanks.length === 0) return 'Cần ít nhất 1 vị trí — dùng [1], [2]... trong nội dung';
                if (!q.choices || q.choices.length === 0) return 'Cần ít nhất 1 lựa chọn — bấm "+ Thêm đáp án"';
                const emptyChoices = q.choices.filter(c => !c || !c.trim());
                if (emptyChoices.length > 0)
                    return 'Vui lòng nhập nội dung cho tất cả các đáp án';
                if (!q.correctMapping) return 'Cần xác định đáp án đúng';
                // Kiểm tra tất cả vị trí đã được gán đáp án
                const mappingKeys = Object.keys(q.correctMapping || {});
                const filledMappings = mappingKeys.filter(k => {
                    const val = q.correctMapping[k];
                    return val !== undefined && val !== null && q.choices[val];
                });
                if (filledMappings.length < blanks.length)
                    return 'Vui lòng chọn đáp án cho tất cả các vị trí';
                // Số đáp án phải >= số ô trống (mỗi ô cần ít nhất 1 đáp án để chọn)
                if (blanks.length > (q.choices || []).length) {
                    return `Có ${blanks.length} ô trống nhưng chỉ có ${(q.choices || []).length} đáp án. Vui lòng thêm đáp án (mỗi dòng 1 đáp án).`;
                }
                return null;
            },
            renderForm(q, idx) {
                // Tự đếm số chỗ trống [1], [2]... trong content
                const blanks = (q.content || '').match(/\[\d+\]/g) || [];
                const blankCount = blanks.length;
                const hasChoices = q.choices && q.choices.length > 0;
                const hasMapping = blanks.length > 0 && hasChoices;
                return `
                    <div class="form-group">
                        <label>Đề bài (ngữ cảnh SGK, không bắt buộc)</label>
                        <textarea class="form-control q-prompt" data-idx="${idx}" rows="2"
                            placeholder="Ví dụ: Bài tập kéo thả từ vào chỗ trống...">${escapeHtml(q.prompt || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Câu có chỗ trống (dùng <code>[1]</code>, <code>[2]</code> cho chỗ trống) <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: (x^2), (\\frac{a}{b}))"
                            oninput="QuestionTypes.updateDragDropMapping(${idx})">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <small style="color: #374151;">Đã phát hiện: <strong>${blankCount} chỗ trống</strong> cần điền (có thể thêm bao nhiêu tùy ý)</small>
                    </div>
                    <div class="form-group">
                        <label>Các đáp án có thể kéo (mỗi dòng 1) <span class="required">*</span></label>
                        <textarea class="form-control q-choices" data-idx="${idx}" rows="4"
                            placeholder="Lựa chọn A&#10;Lựa chọn B"
                            oninput="QuestionTypes.updateDragDropMapping(${idx})">${hasChoices ? q.choices.join('\n') : ''}</textarea>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addDragChoice(${idx})">+ Thêm đáp án</button>
                            ${hasChoices ? '<button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeDragChoice(${idx})">− Xóa đáp án cuối</button>' : ''}
                        </div>
                        <small style="color: #374151;">Mỗi dòng là 1 đáp án. Số đáp án phải ≥ số ô trống (${blankCount} ô trống).</small>
                    </div>
                    <div class="form-group">
                        <label>Đáp án (vị trí nào đi với đáp án nào) <span class="required">*</span></label>
                        ${hasMapping ? `
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addDragPosition(${idx})">+ Thêm vị trí</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeDragPosition(${idx})">− Xóa vị trí cuối</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.refreshDragMapping(${idx})">🔄 Đồng bộ từ nội dung</button>
                        </div>
                        <table class="mapping-table">
                            <thead><tr><th>Vị trí</th><th>Đáp án (số thứ tự)</th></tr></thead>
                            <tbody>
                                ${blanks.map((b, i) => `
                                    <tr>
                                        <td>${b}</td>
                                        <td>
                                            <select class="form-control q-correct-mapping" data-idx="${idx}" data-pos="${i}">
                                                ${q.choices.map((c, j) => `
                                                    <option value="${j}" ${q.correctMapping?.[i] == j ? 'selected' : ''}>
                                                        ${j}. ${escapeHtml(c)}
                                                    </option>
                                                `).join('')}
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : `<div class="drag-mapping-empty-notice">Chưa có vị trí. Nhập nội dung với [1], [2]... rồi bấm "Đồng bộ" hoặc thêm vị trí.</div>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.refreshDragMapping(${idx})">🔄 Đồng bộ từ nội dung</button>
                        </div>`}
                    </div>
                    <div class="form-group">
                        <label>Giải thích (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userMapping = saved || {};
                const usedChoices = new Set(Object.values(userMapping).map(v => parseInt(v)).filter(n => !isNaN(n)));
                // Khung đáp án phía trên (để kéo xuống ô nét đứt, kéo lên lại để thay đổi)
                const choicesTopHtml = `
                    <div class="dd-choices-pool dd-choices-top">
                        <div class="dd-choices-list">
                            ${(q.choices || []).map((c, i) => `
                                <span class="dd-choice ${usedChoices.has(i) ? 'used' : ''}" draggable="true" data-qid="${q.id}" data-choice="${i}">
                                    ${escapeHtml(c)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                `;
                // Tách content thành các phần theo [1], [2]... - hiển thị giống fill_blank với ô nét đứt trắng
                const content = _stripCauPrefix(q.content || '');
                const blanks = content.match(/\[\d+\]/g) || [];
                const parts = content.split(/\[\d+\]/);
                let stemHtml = '<div class="dd-stem">';
                for (let i = 0; i < parts.length; i++) {
                    // Sử dụng escapeHtmlWithImages để giữ nguyên <img> tags nếu có
                    const part = escapeHtmlWithImages(parts[i] || '');
                    stemHtml += `<span class="dd-stem-text">${part}</span>`;
                    if (i < blanks.length) {
                        const filled = userMapping[i] !== undefined && q.choices[userMapping[i]] !== undefined;
                        const filledText = filled ? escapeHtml(q.choices[userMapping[i]]) : '';
                        stemHtml += `<span class="dd-drop-slot ${filled ? 'filled' : 'empty'}" data-qid="${q.id}" data-pos="${i}">${filled ? filledText : '&nbsp;'}</span>`;
                    }
                }
                stemHtml += '</div>';
                return `<div class="answer-dragdrop" data-qid="${q.id}">${choicesTopHtml}${stemHtml}</div>`;
            },
            renderPreview() {
                return `
                    <div class="answer-dragdrop">
                        <div class="dd-choices">
                            <h5>Dap an</h5>
                            <span class="dd-choice">meo</span>
                            <span class="dd-choice">cho</span>
                            <span class="dd-choice">chim</span>
                        </div>
                        <div class="dd-targets">
                            <div class="dd-target">
                                <span class="dd-target-label">Con ___ thì đi cùng.</span>
                                <div class="dd-drop-zone"></div>
                            </div>
                            <div class="dd-target">
                                <span class="dd-target-label">Con ___ thì đi cùng.</span>
                                <div class="dd-drop-zone"></div>
                            </div>
                            <div class="dd-target">
                                <span class="dd-target-label">Con ___ thì đi cùng.</span>
                                <div class="dd-drop-zone"></div>
                            </div>
                        </div>
                    </div>
                `;
            },
            grade(q, userMapping) {
                if (!userMapping) return { correct: false, partial: 0, total: q.points || 1 };
                const correct = q.correctMapping || {};
                const total = q.points || 1;
                // Đếm số chỗ trống từ content
                const blanks = (q.content || '').match(/\[\d+\]/g) || [];
                const n = blanks.length;
                if (n === 0) return { correct: false, partial: 0, total };
                let matches = 0;
                for (let i = 0; i < n; i++) {
                    if (parseInt(userMapping[i]) === parseInt(correct[i])) matches++;
                }
                return {
                    correct: matches === n,
                    partial: (matches / n) * total,
                    total
                };
            }
        },

        matrix_choice: {
            key: 'matrix_choice',
            label: 'Lựa chọn dạng bảng',
            shortLabel: 'MT',
            icon: '📊',
            color: '#7C3AED',
            description: 'Bảng câu hỏi với lựa chọn Đúng/Sai cho từng dòng.',
            schema: {
                content: String,
                rows: [String],
                correctAnswer: Object, // { 0: 'Đúng', 1: 'Sai', ... }
                explanation: String,
                points: Number
            },
            defaults: () => ({
                content: '',
                rows: [],
                correctAnswer: {},
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.rows || q.rows.length === 0) return 'Cần ít nhất 1 dòng — bấm "+ Thêm dòng"';
                const emptyRows = q.rows.filter(r => !r || !r.trim());
                if (emptyRows.length > 0)
                    return 'Vui lòng nhập nội dung cho tất cả các dòng';
                if (!q.correctAnswer) return 'Cần xác định đáp án đúng';
                // Kiểm tra tất cả dòng đã chọn Đúng/Sai
                for (let i = 0; i < q.rows.length; i++) {
                    if (q.correctAnswer[i] !== 'Đúng' && q.correctAnswer[i] !== 'Sai') {
                        return 'Vui lòng chọn Đúng/Sai cho tất cả các dòng';
                    }
                }
                return null;
            },
            renderForm(q, idx) {
                const hasRows = q.rows && q.rows.length > 0;
                return `
                    <div class="form-group">
                        <label>Hướng dẫn</label>
                        <input type="text" class="form-control q-content" data-idx="${idx}"
                            value="${escapeHtml(q.content || '')}" placeholder="Xác định Đúng/Sai cho từng dòng:">
                    </div>
                    <div class="form-group">
                        <label>Hình ảnh minh họa (không bắt buộc)</label>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                        <small class="form-hint">Ảnh sẽ hiển thị ngay dưới phần hướng dẫn</small>
                    </div>
                    <div class="form-group">
                        <label>Các dòng (mỗi dòng một dòng) <span class="required">*</span></label>
                        <textarea class="form-control q-rows" data-idx="${idx}" rows="5"
                            placeholder="Dòng 1&#10;Dòng 2&#10;Dòng 3"
                            oninput="QuestionTypes.updateMatrixRows(${idx})">${hasRows ? q.rows.join('\n') : ''}</textarea>
                        <div style="display: flex; gap: 8px; margin-top: 8px;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addMatrixRow(${idx})">+ Thêm dòng</button>
                            ${hasRows ? '<button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeMatrixRow(${idx})">− Xóa dòng cuối</button>' : ''}
                        </div>
                    </div>
                    ${hasRows ? `
                    <div class="form-group">
                        <label>Đáp án <span class="required">*</span></label>
                        <table class="matrix-form-table">
                            <thead><tr><th>Dòng</th><th>Đúng</th><th>Sai</th></tr></thead>
                            <tbody>
                                ${q.rows.map((r, i) => `
                                    <tr>
                                        <td>${escapeHtml(r)}</td>
                                        <td><input type="radio" name="matrix-correct-${idx}-${i}" value="Đúng"
                                            ${q.correctAnswer[i] === 'Đúng' ? 'checked' : ''}></td>
                                        <td><input type="radio" name="matrix-correct-${idx}-${i}" value="Sai"
                                            ${q.correctAnswer[i] === 'Sai' ? 'checked' : ''}></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : '<div class="matrix-empty-notice">Chưa có dòng nào. Bấm "Thêm dòng" để bắt đầu.</div>'}
                    <div class="form-group">
                        <label>Giải thích (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userAns = saved || {};
                return `
                    <div class="answer-matrix">
                        <table class="matrix-answer-table">
                            <thead>
                                <tr>
                                    <th>Phát biểu</th>
                                    <th>Đúng</th>
                                    <th>Sai</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(q.rows || []).map((r, i) => `
                                    <tr>
                                        <td>${escapeHtml(r)}</td>
                                        <td>
                                            <input type="radio" name="q-mtx-${q.id}-${i}" value="Đúng" 
                                                ${userAns[i] === 'Đúng' ? 'checked' : ''}>
                                        </td>
                                        <td>
                                            <input type="radio" name="q-mtx-${q.id}-${i}" value="Sai" 
                                                ${userAns[i] === 'Sai' ? 'checked' : ''}>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            },
            renderPreview() {
                return `
                    <div class="preview-matrix">
                        <div class="matrix-preview-row"><span class="mp-label">Câu 1</span><span class="mp-tf">Đ</span><span class="mp-tf">S</span></div>
                        <div class="matrix-preview-row"><span class="mp-label">Câu 2</span><span class="mp-tf active">Đ</span><span class="mp-tf">S</span></div>
                        <div class="matrix-preview-row"><span class="mp-label">Câu 3</span><span class="mp-tf">Đ</span><span class="mp-tf">S</span></div>
                    </div>
                `;
            },
            grade(q, userAnswer) {
                if (!userAnswer) return { correct: false, partial: 0, total: q.points || 1 };
                const correct = q.correctAnswer || {};
                const total = q.points || 1;
                const n = q.rows.length;
                let matches = 0;
                for (let i = 0; i < n; i++) {
                    if (userAnswer[i] === correct[i]) matches++;
                }
                return {
                    correct: matches === n,
                    partial: (matches / n) * total,
                    total
                };
            }
        },

        fill_image: {
            key: 'fill_image',
            label: 'Điền đáp án kèm hình ảnh',
            shortLabel: 'FI',
            icon: '🖼️',
            color: '#EC4899',
            description: 'Hiển thị hình minh họa + nhập/ chọn đáp án (input text hoặc select).',
            schema: {
                content: String,        // Câu hỏi
                imageUrl: String,       // URL ảnh (có thể là data URI)
                imageCaption: String,   // Caption ảnh
                prefix: String,         // Text trước input
                suffix: String,         // Text sau input
                inputType: String,      // 'text' | 'number'
                inputPlaceholder: String,
                selectOptions: Array,   // [{value, text}]
                correctAnswer: String,
                explanation: String,
                points: Number
            },
            defaults: () => ({
                content: 'Cho hàm số $y = ax^3 + bx^2 + cx + d$ có đồ thị như hình vẽ.',
                imageUrl: '',
                imageCaption: 'Đồ thị hàm số',
                prefix: 'Có',
                suffix: 'số dương trong các số $a, b, c, d$.',
                inputType: 'text',
                inputPlaceholder: 'nhập số',
                selectOptions: [
                    { value: '', text: '-- chọn --' },
                    { value: '0', text: '0' },
                    { value: '1', text: '1' },
                    { value: '2', text: '2' },
                    { value: '3', text: '3' },
                    { value: '4', text: '4' }
                ],
                correctAnswer: '',
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Cần nhập nội dung câu hỏi';
                if (!q.correctAnswer || !q.correctAnswer.toString().trim()) return 'Cần nhập đáp án đúng';
                return null;
            },
            renderQuestion(q) {
                const nl2br = (str) => String(str || '').replace(/\\n/g, '<br>');
                return `
                    <div class="fill-image-text">${nl2br(q.content)}</div>
                    ${q.imageUrl ? `
                        <div class="fill-image-figure">
                            <img src="${q.imageUrl}" alt="${escapeHtml(q.imageCaption || 'Hình minh họa cho câu hỏi')}" loading="lazy">
                            ${q.imageCaption ? `<div class="fill-image-caption">${q.imageCaption}</div>` : ''}
                        </div>
                    ` : ''}
                    <div class="fill-image-answer">
                        <span>${q.prefix || ''}</span>
                        <input type="${q.inputType || 'text'}"
                               class="fill-image-input"
                               placeholder="${q.inputPlaceholder || 'nhập đáp án'}"
                               value="">
                        <span>${q.suffix || ''}</span>
                    </div>
                    ${q.selectOptions && q.selectOptions.length ? `
                        <div class="fill-image-answer" style="margin-top: 12px;">
                            <span>Chọn đáp án khác:</span>
                            <select class="fill-image-select">
                                ${q.selectOptions.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                `;
            },
            renderPreview() {
                return `
                    <div class="fill-image-preview">
                        <div class="fill-image-figure-preview">🖼️ Hình minh họa</div>
                        <div class="fill-image-answer-preview">Có <span class="fill-image-blank">____</span> số dương...</div>
                    </div>
                `;
            },
            renderForm(q, idx) {
                const selectOpts = (q.selectOptions || []).map(o => `${o.value}|${o.text}`).join('\n');
                return `
                    <div class="form-group">
                        <label>Nội dung câu hỏi <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: (x^2), (\\frac{a}{b}))">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>URL hình ảnh (hoặc data URI)</label>
                        <textarea class="form-control q-image-url" data-idx="${idx}" rows="2"
                            placeholder="data:image/svg+xml;... hoặc https://...">${escapeHtml(q.imageUrl || '')}</textarea>
                        <small style="color: #374151; font-size: 11px;">Có thể upload ảnh lên host rồi paste link, hoặc dùng data URI cho ảnh nhỏ.</small>
                    </div>
                    <div class="form-group">
                        <label>Caption ảnh</label>
                        <input type="text" class="form-control q-image-caption" data-idx="${idx}"
                            value="${escapeHtml(q.imageCaption || '')}" placeholder="Đồ thị hàm số">
                    </div>
                    <div class="form-group">
                        <label>Text trước input</label>
                        <input type="text" class="form-control q-prefix" data-idx="${idx}"
                            value="${escapeHtml(q.prefix || '')}" placeholder="Có">
                    </div>
                    <div class="form-group">
                        <label>Text sau input</label>
                        <input type="text" class="form-control q-suffix" data-idx="${idx}"
                            value="${escapeHtml(q.suffix || '')}" placeholder="số dương trong các số $a, b, c, d$.">
                    </div>
                    <div class="form-group">
                        <label>Loại input</label>
                        <select class="form-control q-input-type" data-idx="${idx}">
                            <option value="text" ${q.inputType === 'text' ? 'selected' : ''}>Text</option>
                            <option value="number" ${q.inputType === 'number' ? 'selected' : ''}>Number</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Placeholder input</label>
                        <input type="text" class="form-control q-input-placeholder" data-idx="${idx}"
                            value="${escapeHtml(q.inputPlaceholder || '')}" placeholder="nhập số">
                    </div>
                    <div class="form-group">
                        <label>Các lựa chọn cho select (mỗi dòng: <code>value|text</code>)</label>
                        <textarea class="form-control q-select-options" data-idx="${idx}" rows="6"
                            placeholder="|&#10;0|0&#10;1|1&#10;2|2">${escapeHtml(selectOpts)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Đáp án đúng <span class="required">*</span></label>
                        <input type="text" class="form-control q-correct" data-idx="${idx}"
                            value="${escapeHtml(q.correctAnswer || '')}" placeholder="Nhập đáp án đúng">
                    </div>
                    <div class="form-group">
                        <label>Giải thích (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const v = saved || {};
                return `
                    <div class="fill-image-container">
                        <div class="fill-image-text">${q.content || ''}</div>
                        ${q.imageUrl ? `
                            <div class="fill-image-figure">
                                <img src="${q.imageUrl}" alt="${escapeHtml(q.imageCaption || 'Hình minh họa cho câu hỏi')}" loading="lazy">
                                ${q.imageCaption ? `<div class="fill-image-caption">${q.imageCaption}</div>` : ''}
                            </div>
                        ` : ''}
                        <div class="fill-image-answer">
                            <span>${q.prefix || ''}</span>
                            <input type="${q.inputType || 'text'}"
                                   class="fill-image-input"
                                   name="q-fillimage-${q.id}-input"
                                   value="${escapeHtml(v.input || '')}"
                                   placeholder="${escapeHtml(q.inputPlaceholder || 'nhập đáp án')}">
                            <span>${q.suffix || ''}</span>
                        </div>
                        ${q.selectOptions && q.selectOptions.length ? `
                            <div class="fill-image-answer" style="margin-top: 12px;">
                                <span>Chọn đáp án khác:</span>
                                <select class="fill-image-select" name="q-fillimage-${q.id}-select">
                                    ${q.selectOptions.map(opt => `
                                        <option value="${escapeHtml(opt.value)}" ${v.select === opt.value ? 'selected' : ''}>${escapeHtml(opt.text)}</option>
                                    `).join('')}
                                </select>
                            </div>
                        ` : ''}
                    </div>
                `;
            },
            grade(q, userAnswer) {
                const total = q.points || 1;
                if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
                    return { correct: false, partial: 0, total };
                }
                const correct = (q.correctAnswer || '').toString().trim().toLowerCase();
                const user = (typeof userAnswer === 'object' ? userAnswer.input : userAnswer).toString().trim().toLowerCase();
                return {
                    correct: correct === user,
                    partial: correct === user ? total : 0,
                    total
                };
            }
        },

        // ================================================================
        // CÂU HỎI TRẢ LỜI NGẮN CHO HSA - Hiển thị giống câu điền khuyết
        // ================================================================
        short_answer: {
            key: 'short_answer',
            label: 'Trả lời ngắn (HSA)',
            shortLabel: 'TLN',
            icon: '✏️',
            color: '#06B6D4',
            description: 'Câu hỏi trả lời ngắn cho HSA - hiển thị như điền khuyết.',
            schema: {
                prompt: String,       // Đề bài ngữ cảnh (phía trên, riêng biệt)
                content: String,     // Nội dung câu hỏi (có thể có [1], [2] như fill_blank)
                correctAnswer: String,
                explanation: String,
                points: Number
            },
            defaults: () => ({
                prompt: '',
                content: '',
                correctAnswer: '',
                explanation: '',
                points: 1
            }),
            validate(q) {
                if (!q.content || !q.content.trim()) return 'Vui lòng nhập nội dung câu hỏi';
                if (!q.correctAnswer || !q.correctAnswer.toString().trim()) return 'Vui lòng nhập đáp án';
                return null;
            },
            renderForm(q, idx) {
                const blanks = (q.content || '').match(/\[\d+\]/g) || [];
                const blankCount = blanks.length;
                return `
                    <div class="form-group">
                        <label>Đề bài / Ngữ cảnh (tùy chọn)</label>
                        <textarea class="form-control q-prompt" data-idx="${idx}" rows="2"
                            placeholder="Nhập đề bài, ngữ cảnh, công thức... (hỗ trợ LaTeX)">${escapeHtmlForTextarea(q.prompt || '')}</textarea>
                        <small class="form-hint">Hiển thị phía trên nội dung câu hỏi, dùng cho bài toán có đề bài chung</small>
                    </div>
                    <div class="form-group">
                        <label>Câu hỏi có chỗ trống <span class="required">*</span></label>
                        <textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX). Dùng [1], [2]... cho chỗ trống.">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>
                        <small>Đã phát hiện: <strong>${blankCount > 0 ? blankCount + ' chỗ trống' : 'không có chỗ trống (sẽ hiển thị 1 ô nhập)'}</strong></small>
                    </div>
                    <div class="form-group">
                        <label>Đáp án đúng <span class="required">*</span></label>
                        <input type="text" class="form-control q-correct" data-idx="${idx}"
                            value="${escapeHtml(q.correctAnswer || '')}" placeholder="Nhập đáp án đúng">
                        <small>Nếu có nhiều đáp án đúng, separate bằng dấu gạch ngang: đáp án 1 - đáp án 2</small>
                    </div>
                    <div class="form-group">
                        <label>Hướng dẫn giải (tùy chọn)</label>
                        <textarea class="form-control q-explanation" data-idx="${idx}" rows="2"
                            placeholder="Giải thích đáp án...">${escapeHtmlForTextarea(q.explanation || '')}</textarea>
                    </div>
                `;
            },
            renderAnswer(q, saved) {
                const userAns = saved || '';
                const blanks = (q.content || '').match(/\[\d+\]/g) || [];
                
                // Nếu không có chỗ trống, hiển thị 1 ô nhập như câu điền khuyết
                if (blanks.length === 0) {
                    return `
                        <div class="answer-fill">
                            <input type="text" class="fill-blank-input" data-qid="${q.id}" data-pos="0" 
                                value="${escapeHtml(userAns)}" placeholder="Nhập đáp án..." autocomplete="off" spellcheck="false">
                        </div>
                    `;
                }
                
                // Có chỗ trống - hiển thị y hệt fill_blank
                const content = _stripCauPrefix(q.content || '');
                let html = '<div class="answer-fill">';
                const parts = content.split(/\[\d+\]/);
                for (let i = 0; i < parts.length; i++) {
                    const part = escapeHtmlWithImages(parts[i] || '');
                    html += part;
                    if (i < blanks.length) {
                        const placeholder = userAns[i] || '';
                        html += `<input type="text" class="fill-blank-input" data-qid="${q.id}" data-pos="${i}" value="${escapeHtml(placeholder)}" placeholder=" " autocomplete="off" spellcheck="false">`;
                    }
                }
                html += '</div>';
                return html;
            },
            grade(q, userAnswer) {
                console.log('[short_answer.grade CALLED]', { userAnswer, type: typeof userAnswer, correctAnswer: q.correctAnswer, typeOfCorrect: typeof q.correctAnswer });
                const total = q.points || 1;
                if (!userAnswer || (typeof userAnswer === 'string' && !userAnswer.trim())) {
                    return { correct: false, partial: 0, total };
                }
                const correct = (q.correctAnswer || '').toString().trim().toLowerCase();
                const user = typeof userAnswer === 'string' ? userAnswer.trim().toLowerCase() : '';
                
                // Debug log
                console.log('[short_answer grade]', { correct, user, match: correct === user });
                
                // Hỗ trợ nhiều đáp án (separate bằng -)
                const correctAnswers = correct.split('-').map(a => a.trim()).filter(Boolean);
                const isCorrect = correctAnswers.some(ans => ans === user);
                
                return {
                    correct: isCorrect,
                    partial: isCorrect ? total : 0,
                    total
                };
            }
        }
    };

    /* ================================================================
       UTILITY FUNCTIONS
       ================================================================ */

    /**
     * Escape HTML an toàn — dùng cho input value, attribute, textarea.
     * KHÔNG cho phép thẻ. Dùng khi cần ngăn XSS nghiêm ngặt.
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        let s = String(str);
        
        // Bảo vệ các delimiters LaTeX trước khi escape HTML
        const mathPlaceholders = [];
        let mathIdx = 0;
        
        // Bảo vệ display math $$...$$ TRƯỚC (để tránh inline math match bên trong)
        s = s.replace(/\$\$(.+?)\$\$/gs, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bảo vệ inline math $...$ (không nested, không escaped)
        s = s.replace(/((?<!\\)\$)(?!\$)(.+?)((?<!\\)\$)/gs, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bảo vệ inline math \(...\)
        s = s.replace(/\\\((.+?)\\\)/g, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bảo vệ display math \[...\]
        s = s.replace(/\\\[(.+?)\\\]/g, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bước 0b: Chuyển < > thành \lt \gt bên trong math blocks (để KaTeX nhận diện đúng sau khi escape)
        mathPlaceholders.forEach(item => {
            item.original = item.original.replace(/<(?!$)/g, '\\lt ').replace(/(?<![\\])\\>/g, '\\gt ');
        });
        
        // Escape HTML entities thông thường
        s = s.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');
        
        // Khôi phục các delimiters LaTeX (dùng split/join để tránh JS replace special sequences như $$)
        mathPlaceholders.forEach(item => {
            s = s.split(item.placeholder).join(item.original);
        });
        
        return s;
    }

    /**
     * Escape cho giá trị textarea — chỉ escape & " ' để lưu trữ an toàn
     * trong value attribute và khi đọc lại từ textarea.
     * GIỮ NGUYÊN < > để HTML (img, br...) được lưu và hiển thị đúng trong textarea.
     * KHI dùng trong innerHTML: phải qua sanitize.
     */
    /* [CONTENT_EDITABLE_MARKER] */
    function _getContentEditableHTML(placeholder, existingContent, idx) {
        return `<textarea class="form-control q-content" data-idx="${idx}" rows="3"
                            placeholder="Nhập nội dung câu hỏi (hỗ trợ LaTeX: (x^2), (\\frac{a}{b}))">${escapeHtmlForTextarea(q.content || '')}</textarea>
                        <div class="inline-images-zone" data-idx="${idx}">
                            <div class="inline-images-list"></div>
                            <button type="button" class="btn-paste-inline-image" onclick="App.pasteImageToInline(this)"
                                title="Dán ảnh vào nội dung"
                                style="margin-top:6px;padding:6px 14px;font-size:13px;border:1.5px dashed #1677ff;color:#1677ff;background:#f0f7ff;border-radius:6px;cursor:pointer;font-weight:500;display:inline-flex;align-items:center;gap:5px;">
                                📷 Dán ảnh vào nội dung
                            </button>
                        </div>`;
    }
    /* [/CONTENT_EDITABLE_MARKER] */
    function escapeHtmlForTextarea(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Escape HTML nhưng CHO PHÉP thẻ <img> và <br>, <p>, <span>, <b>, <i>, <u>, <strong>, <em>.
     * Dùng cho hiển thị nội dung câu hỏi đã lưu (cho phép ảnh embedded).
     * Bảo vệ khỏi XSS bằng cách loại bỏ tất cả JS event handlers và thẻ nguy hiểm.
     */
    function escapeHtmlForDisplay(str) {
        if (str === null || str === undefined) return '';
        if (!str) return '';
        const s = String(str);
        // Bước 1: Chuyển CRLF → LF để tránh double-escape
        const normalized = s.replace(/\r\n/g, '\n');
        // Bước 2: Escape tất cả HTML ngoại trừ whitelist
        // Whitelist: img (src=data hoặc https), br, p, span, b, i, u, strong, em, sup, sub, ul, ol, li, table, tr, td, th, thead, tbody
        // Parse từng thẻ, validate attributes
        return _sanitizeHtml(normalized);
    }

    /**
     * Escape text nhưng cho phép giữ nguyên các thẻ HTML an toàn (img, br, p, span...).
     * Dùng cho renderAnswer của fill_blank và drag_drop khi content có ảnh inline.
     * Khác với escapeHtmlForDisplay: KHÔNG escape text bên trong thẻ HTML.
     */
    function escapeHtmlWithImages(str) {
        if (!str) return '';
        const s = String(str);
        // Tách HTML tags và text để xử lý riêng
        const parts = [];
        const tagRegex = /<[^>]+>/g;
        let lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(s)) !== null) {
            // Text trước tag
            if (match.index > lastIndex) {
                parts.push({ type: 'text', content: s.slice(lastIndex, match.index) });
            }
            // Tag HTML
            parts.push({ type: 'tag', content: match[0] });
            lastIndex = match.index + match[0].length;
        }
        // Text cuối cùng
        if (lastIndex < s.length) {
            parts.push({ type: 'text', content: s.slice(lastIndex) });
        }

        return parts.map(part => {
            if (part.type === 'tag') {
                return part.content;
            }
            // Escape text nhưng giữ \n (chuyển thành <br>)
            return escapeHtml(part.content).replace(/\\n/g, '<br>');
        }).join('');
    }

    /**
     * Sanitizer cơ bản: cho phép các thẻ an toàn, loại bỏ event handlers và thẻ nguy hiểm.
     * THỨ TỰ ĐÚNG: parse HTML trước → whitelist → escape phần còn lại.
     * @param {string} html
     * @returns {string}
     */
    function _sanitizeHtml(html) {
        if (!html) return '';
        const ALLOWED = ['img', 'br', 'p', 'span', 'b', 'i', 'u', 'strong', 'em',
                          'sup', 'sub', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
                          'thead', 'tbody', 'div', 'blockquote', 'pre', 'hr',
                          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a'];
        const ALLOWED_ATTRS = {
            img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'style', 'class'],
            a: ['href', 'title', 'target', 'class'],
            span: ['class', 'style', 'id'],
            div: ['class', 'style', 'id'],
            p: ['class', 'style'],
            table: ['class', 'style'],
        };
        let result = '';
        // Tokenize: tìm tất cả thẻ HTML bằng regex
        const TAG_RE = /<\/?([a-z][a-z0-9]*)([^>]*)>/gi;
        let last = 0;
        let match;
        while ((match = TAG_RE.exec(html)) !== null) {
            const [fullTag, tagName, attrs] = match;
            const tagLower = tagName.toLowerCase();
            const isClosing = fullTag.startsWith('</');
            // Phần text trước thẻ này → escape thông thường
            result += _escapeText(html.slice(last, match.index));
            last = match.index + fullTag.length;
            if (!ALLOWED.includes(tagLower)) {
                // Thẻ không được phép → escape luôn
                result += _escapeText(fullTag);
                continue;
            }
            // Whitelist: kiểm tra attributes
            if (isClosing) {
                result += `</${tagLower}>`;
                continue;
            }
            // Opening tag + attrs
            let cleanAttrs = '';
            if (attrs.trim()) {
                // Parse từng attr: name="value" hoặc name='value'
                const attrRe = /([a-zA-Z:_][a-zA-Z0-9_:.-]*)\s*=\s*(["'])([^"']*)\2/gi;
                let attrMatch;
                while ((attrMatch = attrRe.exec(attrs)) !== null) {
                    const [fullAttr, attrName, quote, attrVal] = attrMatch;
                    const allowedList = ALLOWED_ATTRS[tagLower] || [];
                    if (!allowedList.includes(attrName.toLowerCase())) continue;
                    // Validate giá trị theo tag
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
                if (!/\salt\s*=/.test(cleanAttrs)) cleanAttrs += ' alt="Hình ảnh trong nội dung câu hỏi"';
                if (!/\sloading\s*=/.test(cleanAttrs)) cleanAttrs += ' loading="lazy"';
            }
            result += `<${tagLower}${cleanAttrs}>`;
        }
        // Phần text còn lại sau thẻ cuối
        result += _escapeText(html.slice(last));
        return result;
    }

    function _escapeText(str) {
        if (!str) return '';
        let s = String(str);
        
        // Bước 0: Bảo vệ các delimiters LaTeX trước khi escape HTML
        // Inline math: $...$, \(...\)  
        // Display math: $$...$$, \[...\]
        // Also protect content WITHIN math blocks (to preserve < > \le \ge etc)
        const mathPlaceholders = [];
        let mathIdx = 0;
        
        // Bảo vệ display math $$...$$ (bao gồm cả nội dung bên trong)
        s = s.replace(/\$\$(.+?)\$\$/gs, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bảo vệ inline math $...$ (không nested, không escaped)
        s = s.replace(/((?<!\\)\$)(?!\$)(.+?)((?<!\\)\$)/gs, (match, start, content, end) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bảo vệ inline math \(...\)
        s = s.replace(/\\\((.+?)\\\)/gs, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bảo vệ display math \[...\]
        s = s.replace(/\\\[(.+?)\\\]/gs, (match) => {
            const placeholder = `\x00MATH${mathIdx++}\x00`;
            mathPlaceholders.push({ placeholder, original: match });
            return placeholder;
        });
        
        // Bước 1: Escape HTML entities
        s = s.replace(/&/g, '&amp;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;')
             .replace(/\n/g, '<br>');
        
        // Bước 2: Chuyển < > thành \lt \gt bên trong math blocks (để tránh browser parse thành HTML tag)
        mathPlaceholders.forEach(item => {
            // Thay thế < thành \lt và > thành \gt bên trong nội dung LaTeX
            item.original = item.original.replace(/<(?!\/[a-z])/gi, '\\lt ').replace(/>(?![a-z])/gi, '\\gt');
        });
        
        // Bước 3: Khôi phục các delimiters LaTeX (dùng split/join để tránh JS replace special sequences như $$)
        mathPlaceholders.forEach(item => {
            s = s.split(item.placeholder).join(item.original);
        });
        
        return s;
    }

    /**
     * Bắt sự kiện Ctrl+V dán ảnh vào textarea.
     * Ảnh được convert sang base64 (data URI) và chèn dưới dạng <img src="data:...">
     * vào vị trí con trỏ, tách khỏi text.
     *
     * @param {HTMLTextAreaElement} textarea
     * @param {Function} onInsert  - callback(insertedHtmlString) sau khi chèn thành công
     */
    function handleImagePaste(textarea, onInsert) {
        if (!textarea) return;
        textarea.addEventListener('paste', async (e) => {
            const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
            const imageItems = items.filter(item => item.type.startsWith('image/'));
            if (!imageItems.length) return;

            e.preventDefault(); // chặn paste text mặc định

            for (const item of imageItems) {
                const file = item.getAsFile();
                if (!file) continue;

                try {
                    const dataUrl = await _fileToDataUrl(file);
                    const maxW = 800;
                    const resized = await _resizeImage(dataUrl, maxW);
                    const imgTag = `\n<img src="${resized}" alt="Hình ảnh trong nội dung câu hỏi" loading="lazy" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;">\n`;
                    _insertAtCursor(textarea, imgTag);
                    if (typeof onInsert === 'function') onInsert(imgTag);
                } catch (err) {
                    console.warn('[handleImagePaste] Lỗi xử lý ảnh:', err);
                }
            }
        });

        // Cho phép drag & drop ảnh vào textarea
        textarea.addEventListener('drop', async (e) => {
            e.preventDefault();
            const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (!imageFiles.length) return;

            for (const file of imageFiles) {
                try {
                    const dataUrl = await _fileToDataUrl(file);
                    const resized = await _resizeImage(dataUrl, 800);
                    const imgTag = `\n<img src="${resized}" alt="Hình ảnh trong nội dung câu hỏi" loading="lazy" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;">\n`;
                    _insertAtCursor(textarea, imgTag);
                    if (typeof onInsert === 'function') onInsert(imgTag);
                } catch (err) {
                    console.warn('[handleImagePaste] Lỗi drop ảnh:', err);
                }
            }
        });
        textarea.addEventListener('dragover', (e) => e.preventDefault());
    }

    function _fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function _resizeImage(dataUrl, maxWidth) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                if (w <= maxWidth) { resolve(dataUrl); return; }
                const ratio = maxWidth / w;
                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = Math.round(h * ratio);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    function _insertAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        textarea.value = before + text + after;
        const newPos = start + text.length;
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function generateId() {
        return 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    /* ================================================================
       MUTATORS - cho phép thêm/xóa options, pairs khi người dùng thao tác
       ================================================================ */

    const _state = {
        questions: []   // Lưu trữ tạm các câu hỏi đang soạn
    };

    function _findQuestion(idx) {
        if (!_state.questions[idx]) {
            _state.questions[idx] = { type: 'mcq_single', content: '', options: ['', '', '', ''], correctAnswer: '' };
        }
        return _state.questions[idx];
    }

    function addOption(idx) {
        const q = _findQuestion(idx);
        if (!q.options) q.options = [];
        q.options.push('');
        // Re-render
        if (typeof _rerenderForm === 'function') _rerenderForm(idx);
    }

    function removeOption(idx, optIdx) {
        const q = _findQuestion(idx);
        if (q.options && q.options.length > 2) {
            q.options.splice(optIdx, 1);
            if (q.correctAnswers) {
                q.correctAnswers = q.correctAnswers.filter(a => q.options.includes(a));
            }
            if (typeof _rerenderForm === 'function') _rerenderForm(idx);
        }
    }

    function addPair(idx) {
        const q = _findQuestion(idx);
        if (!q.pairs) q.pairs = [];
        q.pairs.push({ left: '', right: '' });
        if (typeof _rerenderForm === 'function') _rerenderForm(idx);
    }

    function removePair(idx, pairIdx) {
        const q = _findQuestion(idx);
        if (q.pairs && q.pairs.length > 1) {
            q.pairs.splice(pairIdx, 1);
            if (typeof _rerenderForm === 'function') _rerenderForm(idx);
        }
    }

    // Thêm 1 dòng trống vào textarea choices của drag_drop
    function addDragChoice(idx) {
        const ta = document.querySelector(`.q-choices[data-idx="${idx}"]`);
        if (!ta) return;
        const cur = ta.value.split('\n').filter(s => s.length || true);
        cur.push('');
        ta.value = cur.join('\n');
        ta.focus();
        // Đặt con trỏ vào dòng cuối
        const end = ta.value.length;
        ta.setSelectionRange(end, end);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Xóa dòng cuối của textarea choices của drag_drop
    function removeDragChoice(idx) {
        const ta = document.querySelector(`.q-choices[data-idx="${idx}"]`);
        if (!ta) return;
        const lines = ta.value.split('\n');
        if (lines.length <= 1) {
            ta.value = '';
        } else {
            lines.pop();
            ta.value = lines.join('\n');
        }
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Re-render form dragdrop để cập nhật bảng mapping khi thêm [4], [5]...
    function refreshDragMapping(idx) {
        const q = _findQuestion(idx);
        if (!q) return;
        // Đồng bộ lại q.content và q.choices từ DOM (người dùng có thể vừa gõ)
        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        const taChoices = document.querySelector(`.q-choices[data-idx="${idx}"]`);
        if (taContent) q.content = taContent.value;
        if (taChoices) q.choices = taChoices.value.split('\n').map(s => s.trim()).filter(Boolean);
        // Cắt correctMapping nếu số blanks giảm (correctMapping là object)
        const blankCount = (q.content || '').match(/\[\d+\]/g)?.length || 0;
        if (q.correctMapping) {
            Object.keys(q.correctMapping).forEach(k => {
                if (parseInt(k) >= blankCount) delete q.correctMapping[k];
            });
        }
        if (typeof _rerenderForm === 'function') {
            _rerenderForm(idx);
        } else if (typeof window.rerenderQuestionForm === 'function') {
            window.rerenderQuestionForm(idx);
        } else if (window.App && typeof window.App.rerenderCurrentForm === 'function') {
            window.App.rerenderCurrentForm();
        } else {
            // Fallback: thử gọi qua QuestionEditor nếu có
            const form = document.getElementById('questions-list');
            if (form) form.dispatchEvent(new CustomEvent('rerender-form', { detail: { idx } }));
        }
    }

    // Thêm 1 vị trí mới [N+1] vào cuối content, đồng thời update q.content & DOM
    function addDragPosition(idx) {
        const q = _findQuestion(idx);
        if (!q) return;
        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        // Đồng bộ trước
        if (taContent) q.content = taContent.value;
        const blanks = (q.content || '').match(/\[\d+\]/g) || [];
        const nextNum = blanks.length + 1;
        // Thêm " [N]" vào cuối content
        q.content = (q.content || '').trimEnd() + ` [${nextNum}]`;
        if (taContent) taContent.value = q.content;
        refreshDragMapping(idx);
    }

    // Xóa vị trí cuối khỏi content
    function removeDragPosition(idx) {
        const q = _findQuestion(idx);
        if (!q) return;
        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        if (taContent) q.content = taContent.value;
        const blanks = (q.content || '').match(/\[\d+\]/g) || [];
        if (blanks.length === 0) return;
        // Xóa [N] cuối cùng (kèm khoảng trắng phía trước nếu có)
        q.content = q.content.replace(/\s*\[\d+\]\s*$/, '');
        if (taContent) taContent.value = q.content;
        refreshDragMapping(idx);
    }

    // === Fill blank: thêm/xóa đáp án cho chỗ trống ===
    function addBlankAnswer(idx) {
        // Lấy đúng object câu hỏi đang soạn (App.currentDraft hoặc _state.questions[idx])
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;
        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        if (taContent) q.content = taContent.value;
        if (!q.correctAnswers) q.correctAnswers = [];

        // Nếu chưa có đáp án nào, tự tạo [1] trong content
        if (q.correctAnswers.length === 0) {
            const hasBlanks = (q.content || '').match(/\[\d+\]/g);
            if (!hasBlanks || hasBlanks.length === 0) {
                q.content = (q.content || '').trimEnd() + ' [1]';
                if (taContent) taContent.value = q.content;
            }
        }

        // Đồng bộ: nếu content có thêm [N] mà correctAnswers chưa có → tự thêm vào
        const blankCount = (q.content || '').match(/\[\d+\]/g)?.length || 0;
        while (q.correctAnswers.length < blankCount) {
            q.correctAnswers.push('');
        }
        // Đồng bộ ngược: nếu correctAnswers nhiều hơn blanks → thêm [N] vào content
        if (q.correctAnswers.length > blankCount) {
            const n = blankCount + 1;
            q.content = (q.content || '').trimEnd() + ` [${n}]`;
            if (taContent) taContent.value = q.content;
        }
        if (window.App && typeof window.App.rerenderCurrentForm === 'function') {
            window.App.rerenderCurrentForm();
        } else if (typeof _rerenderForm === 'function') {
            _rerenderForm(idx);
        }
    }

    // Fill blank: cập nhật số đáp án khi content thay đổi (gõ trong textarea)
    function updateFillBlankAnswers(idx) {
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;
        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        if (taContent) q.content = taContent.value;
        if (!q.correctAnswers) q.correctAnswers = [];

        const blankCount = (q.content || '').match(/\[\d+\]/g)?.length || 0;
        // Thêm answer slots nếu cần
        while (q.correctAnswers.length < blankCount) {
            q.correctAnswers.push('');
        }
        // Xóa answer slots thừa
        while (q.correctAnswers.length > blankCount && q.correctAnswers.length > 0) {
            q.correctAnswers.pop();
        }

        // Cập nhật DOM: hiển thị đúng số input
        const container = document.querySelector(`.blanks-answers[data-idx="${idx}"]`);
        if (container) {
            if (q.correctAnswers.length === 0) {
                container.innerHTML = '<div class="blank-empty-notice">Chưa có đáp án nào. Bấm "Thêm đáp án" để tạo.</div>';
            } else {
                container.innerHTML = q.correctAnswers.map((ans, i) => `
                    <div class="blank-answer-row">
                        <span class="blank-label">[${i + 1}]</span>
                        <input type="text" class="form-control q-blank-answer" data-idx="${idx}" data-pos="${i}"
                            placeholder="Đáp án cho vị trí [${i + 1}]" value="${escapeHtml(ans || '')}">
                    </div>
                `).join('');
            }
        }

        // Cập nhật số chỗ trống hiển thị
        const smallEl = document.querySelector(`.q-content[data-idx="${idx}"]`)?.parentElement?.querySelector('small');
        if (smallEl) {
            smallEl.innerHTML = `Đã phát hiện: <strong>${blankCount} chỗ trống</strong>`;
        }

        // Cập nhật nút xóa
        const btnContainer = container?.parentElement?.querySelector('div[style*="gap: 8px"]');
        if (btnContainer && q.correctAnswers.length > 0) {
            btnContainer.innerHTML = `
                <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addBlankAnswer(${idx})">+ Thêm đáp án</button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeBlankAnswer(${idx})">− Xóa đáp án cuối</button>
            `;
        }
    }

    // Drag drop: cập nhật mapping khi content hoặc choices thay đổi
    function updateDragDropMapping(idx) {
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;

        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        const taChoices = document.querySelector(`.q-choices[data-idx="${idx}"]`);

        if (taContent) q.content = taContent.value;
        if (taChoices) q.choices = taChoices.value.split('\n').map(s => s.trim()).filter(Boolean);

        const blanks = (q.content || '').match(/\[\d+\]/g) || [];
        const blankCount = blanks.length;
        const hasChoices = q.choices && q.choices.length > 0;
        const hasMapping = blankCount > 0 && hasChoices;

        // Cập nhật mapping section
        const mappingSection = document.querySelector(`.q-content[data-idx="${idx}"]`)?.closest('.form-group')?.nextElementSibling?.nextElementSibling;
        if (mappingSection) {
            if (hasMapping) {
                mappingSection.innerHTML = `
                    <label>Đáp án (vị trí nào đi với đáp án nào) <span class="required">*</span></label>
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addDragPosition(${idx})">+ Thêm vị trí</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeDragPosition(${idx})">− Xóa vị trí cuối</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.refreshDragMapping(${idx})">🔄 Đồng bộ từ nội dung</button>
                    </div>
                    <table class="mapping-table">
                        <thead><tr><th>Vị trí</th><th>Đáp án (số thứ tự)</th></tr></thead>
                        <tbody>
                            ${blanks.map((b, i) => `
                                <tr>
                                    <td>${b}</td>
                                    <td>
                                        <select class="form-control q-correct-mapping" data-idx="${idx}" data-pos="${i}">
                                            ${q.choices.map((c, j) => `
                                                <option value="${j}" ${q.correctMapping?.[i] == j ? 'selected' : ''}>
                                                    ${j}. ${escapeHtml(c)}
                                                </option>
                                            `).join('')}
                                        </select>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                mappingSection.innerHTML = `
                    <label>Đáp án (vị trí nào đi với đáp án nào) <span class="required">*</span></label>
                    <div class="drag-mapping-empty-notice">Chưa có vị trí. Nhập nội dung với [1], [2]... rồi bấm "Đồng bộ" hoặc thêm vị trí.</div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.refreshDragMapping(${idx})">🔄 Đồng bộ từ nội dung</button>
                    </div>
                `;
            }
        }

        // Cập nhật số chỗ trống
        const smallEl = taContent?.parentElement?.querySelector('small');
        if (smallEl) {
            smallEl.innerHTML = `Đã phát hiện: <strong>${blankCount} chỗ trống</strong> cần điền (có thể thêm bao nhiêu tùy ý)`;
        }
    }

    // Matrix choice: cập nhật bảng đáp án khi rows thay đổi
    function updateMatrixRows(idx) {
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;

        const taRows = document.querySelector(`.q-rows[data-idx="${idx}"]`);
        if (taRows) q.rows = taRows.value.split('\n').map(s => s.trim()).filter(Boolean);

        if (!q.rows) q.rows = [];
        if (!q.correctAnswer) q.correctAnswer = {};

        const hasRows = q.rows.length > 0;

        // Cập nhật đáp án section
        const rowsSection = taRows?.closest('.form-group');
        if (rowsSection) {
            // Cập nhật nút xóa
            const btnContainer = rowsSection.querySelector('div[style*="gap: 8px"]');
            if (btnContainer) {
                btnContainer.innerHTML = `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.addMatrixRow(${idx})">+ Thêm dòng</button>
                    ${hasRows ? `<button type="button" class="btn btn-secondary btn-sm" onclick="QuestionTypes.removeMatrixRow(${idx})">− Xóa dòng cuối</button>` : ''}
                `;
            }

            // Cập nhật hoặc thêm bảng đáp án
            let answerSection = rowsSection.nextElementSibling;
            if (hasRows) {
                if (answerSection && answerSection.classList.contains('matrix-empty-notice')) {
                    // Thay thế notice bằng bảng
                    answerSection.outerHTML = `
                        <div class="form-group">
                            <label>Đáp án <span class="required">*</span></label>
                            <table class="matrix-form-table">
                                <thead><tr><th>Dòng</th><th>Đúng</th><th>Sai</th></tr></thead>
                                <tbody>
                                    ${q.rows.map((r, i) => `
                                        <tr>
                                            <td>${escapeHtml(r)}</td>
                                            <td><input type="radio" name="matrix-correct-${idx}-${i}" value="Đúng"
                                                ${q.correctAnswer[i] === 'Đúng' ? 'checked' : ''}></td>
                                            <td><input type="radio" name="matrix-correct-${idx}-${i}" value="Sai"
                                                ${q.correctAnswer[i] === 'Sai' ? 'checked' : ''}></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                } else if (answerSection && answerSection.querySelector('.matrix-form-table')) {
                    // Cập nhật bảng hiện có
                    const tbody = answerSection.querySelector('tbody');
                    if (tbody) {
                        tbody.innerHTML = q.rows.map((r, i) => `
                            <tr>
                                <td>${escapeHtml(r)}</td>
                                <td><input type="radio" name="matrix-correct-${idx}-${i}" value="Đúng"
                                    ${q.correctAnswer[i] === 'Đúng' ? 'checked' : ''}></td>
                                <td><input type="radio" name="matrix-correct-${idx}-${i}" value="Sai"
                                    ${q.correctAnswer[i] === 'Sai' ? 'checked' : ''}></td>
                            </tr>
                        `).join('');
                    }
                }
            } else {
                if (answerSection && answerSection.querySelector('.matrix-form-table')) {
                    // Thay bảng bằng notice
                    answerSection.outerHTML = '<div class="matrix-empty-notice">Chưa có dòng nào. Bấm "Thêm dòng" để bắt đầu.</div>';
                }
            }
        }
    }

    function removeBlankAnswer(idx) {
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;
        const taContent = document.querySelector(`.q-content[data-idx="${idx}"]`);
        if (taContent) q.content = taContent.value;
        if (!q.correctAnswers || q.correctAnswers.length === 0) return;
        q.correctAnswers.pop();
        // Đồng bộ content: xóa [N] cuối nếu thừa
        const blankCount = (q.content || '').match(/\[\d+\]/g)?.length || 0;
        if (blankCount > q.correctAnswers.length) {
            q.content = q.content.replace(/\s*\[\d+\]\s*$/, '');
            if (taContent) taContent.value = q.content;
        }
        if (window.App && typeof window.App.rerenderCurrentForm === 'function') {
            window.App.rerenderCurrentForm();
        } else if (typeof _rerenderForm === 'function') {
            _rerenderForm(idx);
        }
    }

    // === Matrix choice (Bảng Đúng/Sai): thêm/xóa dòng ===
    function addMatrixRow(idx) {
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;
        const taRows = document.querySelector(`.q-rows[data-idx="${idx}"]`);
        if (taRows) q.rows = taRows.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!q.rows) q.rows = [];
        if (!q.correctAnswer) q.correctAnswer = {};
        // Thêm dòng mới
        q.rows.push('');
        // Thêm slot đáp án mặc định
        q.correctAnswer[q.rows.length - 1] = 'Đúng';
        if (taRows) taRows.value = q.rows.join('\n');
        if (window.App && typeof window.App.rerenderCurrentForm === 'function') {
            window.App.rerenderCurrentForm();
        } else if (typeof _rerenderForm === 'function') {
            _rerenderForm(idx);
        }
    }

    function removeMatrixRow(idx) {
        const q = (window.App && window.App.currentDraft) || _findQuestion(idx);
        if (!q) return;
        const taRows = document.querySelector(`.q-rows[data-idx="${idx}"]`);
        if (taRows) q.rows = taRows.value.split('\n').map(s => s.trim()).filter(Boolean);
        if (!q.rows || q.rows.length === 0) return;
        // Xóa dòng cuối
        q.rows.pop();
        // Xóa đáp án tương ứng
        if (q.correctAnswer) {
            const keys = Object.keys(q.correctAnswer).map(k => parseInt(k)).filter(k => !isNaN(k));
            if (keys.length > 0) {
                const maxKey = Math.max(...keys);
                delete q.correctAnswer[maxKey];
            }
        }
        if (taRows) taRows.value = q.rows.join('\n');
        if (window.App && typeof window.App.rerenderCurrentForm === 'function') {
            window.App.rerenderCurrentForm();
        } else if (typeof _rerenderForm === 'function') {
            _rerenderForm(idx);
        }
    }

    /* ================================================================
       PUBLIC API
       ================================================================ */

    const QuestionTypes = {
        TYPES: QUESTION_TYPES,
        KEYS: Object.keys(QUESTION_TYPES),

        getType(key) {
            return QUESTION_TYPES[key] || null;
        },

        getAllTypes() {
            return Object.values(QUESTION_TYPES);
        },

        create(typeKey) {
            const t = QUESTION_TYPES[typeKey];
            if (!t) throw new Error('Unknown type: ' + typeKey);
            return {
                id: generateId(),
                type: typeKey,
                ...t.defaults()
            };
        },

        validate(question) {
            const t = QUESTION_TYPES[question.type];
            if (!t) return 'Loại câu hỏi không hợp lệ';
            return t.validate(question);
        },

        renderForm(question, idx) {
            const t = QUESTION_TYPES[question.type];
            if (!t) return '<p>Loại câu hỏi không hỗ trợ</p>';
            return t.renderForm(question, idx);
        },

        renderAnswer(question, savedAnswer) {
            const t = QUESTION_TYPES[question.type];
            if (!t) return '<p>Loại câu hỏi không hỗ trợ</p>';
            return t.renderAnswer(question, savedAnswer);
        },

        renderPreview(typeKey) {
            const t = QUESTION_TYPES[typeKey];
            if (!t) return '';
            return t.renderPreview();
        },

        grade(question, userAnswer) {
            const t = QUESTION_TYPES[question.type];
            if (!t) return { correct: false, partial: 0, total: 0 };
            console.log('[QuestionTypes.grade]', { type: question.type, userAnswer: userAnswer, correctAnswer: question.correctAnswer });
            return t.grade(question, userAnswer);
        },

        addOption,
        removeOption,
        addPair,
        removePair,
        addDragChoice,
        removeDragChoice,
        refreshDragMapping,
        addDragPosition,
        removeDragPosition,
        addBlankAnswer,
        removeBlankAnswer,
        addMatrixRow,
        removeMatrixRow,
        updateFillBlankAnswers,
        updateDragDropMapping,
        updateMatrixRows,

        escapeHtml,
        escapeHtmlForDisplay,
        escapeHtmlWithImages,
        handleImagePaste,
        generateId
    };

    /* ================================================================
       EXPORT
       ================================================================ */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QuestionTypes;
    } else {
        global.QuestionTypes = QuestionTypes;
    }
})(typeof window !== 'undefined' ? window : globalThis);
