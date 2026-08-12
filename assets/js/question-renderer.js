/* ================================================================
   QUESTION RENDERER - Render đồng nhất 10 dạng câu hỏi
   Tác giả: SKY EDU Team
   Phiên bản: 1.0.0
   Mô tả: Module thu gom logic render, validate client-side và
           lấy giá trị trả lời cho 10 dạng câu hỏi.
   ================================================================ */

(function (global) {
    'use strict';

    /* ================================================================
       LẤY GIÁ TRỊ TRẢ LỜI TỪ DOM
       ================================================================ */

    function _types() {
        if (typeof QuestionTypes !== 'undefined') return QuestionTypes;
        try { return require('./question-types.js'); } catch (e) { return null; }
    }

    function getAnswer(q) {
        const types = _types();
        switch (q.type) {
            case 'mcq_single':
            case 'true_false': {
                const el = document.querySelector(`input[name="q-${q.id}"]:checked`);
                return el ? el.value : '';
            }

            case 'mcq_multi': {
                const els = document.querySelectorAll(`input[name="q-${q.id}"]:checked`);
                return Array.from(els).map(e => e.value);
            }

            case 'fill_blank':
            case 'short_answer': {
                const els = document.querySelectorAll(`.fill-blank-input[data-qid="${q.id}"]`);
                return Array.from(els).map(e => e.value);
            }

            case 'matching': {
                const selects = document.querySelectorAll(`.q-match-select[data-qid="${q.id}"]`);
                const out = {};
                selects.forEach(s => {
                    if (s.value !== '') out[s.dataset.pos] = s.value;
                });
                return out;
            }

            case 'matrix_choice': {
                const rows = q.rows || [];
                const out = {};
                rows.forEach((_, i) => {
                    const el = document.querySelector(`input[name="q-mtx-${q.id}-${i}"]:checked`);
                    if (el) out[i] = el.value;
                });
                return out;
            }

            case 'word_arrange':
            case 'sentence_order': {
                // Lấy từ DOM, thứ tự hiện tại
                const list = document.querySelector(`.arrange-list[data-qid="${q.id}"], .sentence-list[data-qid="${q.id}"]`);
                if (!list) return [];
                const chips = list.querySelectorAll('[data-pos]');
                return Array.from(chips).map(c => parseInt(c.dataset.pos));
            }

            case 'drag_drop': {
                // Ưu tiên đọc từ state lưu trong _ddState
                const container = document.querySelector(`.answer-dragdrop[data-qid="${q.id}"]`);
                if (container && container._ddState) {
                    return Object.assign({}, container._ddState);
                }
                // Fallback: đọc từ DOM
                const targets = document.querySelectorAll(`.dd-drop-zone[data-qid="${q.id}"]`);
                const out = {};
                targets.forEach(t => {
                    const meta = t.querySelector('.dd-drop-zone-meta');
                    if (meta && meta.dataset.choice !== undefined) {
                        out[t.dataset.pos] = parseInt(meta.dataset.choice);
                    }
                });
                return out;
            }

            case 'essay': {
                const ta = document.querySelector(`.essay-textarea[data-qid="${q.id}"]`);
                return ta ? ta.value : '';
            }

            case 'fill_image': {
                const inputEl = document.querySelector(`input[name="q-fillimage-${q.id}-input"]`);
                const selectEl = document.querySelector(`select[name="q-fillimage-${q.id}-select"]`);
                // Cả 2 phần tử đều không tồn tại → câu chưa từng render, trả null để không phá các nhánh khác
                if (!inputEl && !selectEl) return null;
                const result = {};
                if (inputEl) result.input = inputEl.value;
                if (selectEl) result.select = selectEl.value;
                return result;
            }

            default:
                return null;
        }
    }

    /* ================================================================
       BIND EVENTS - Kéo thả cho arrange & dragdrop
       ================================================================ */

    function bindEvents(q) {
        if (q.type === 'word_arrange' || q.type === 'sentence_order') {
            _bindArrange(q);
        } else if (q.type === 'drag_drop') {
            _bindDragDrop(q);
        } else if (q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'true_false') {
            _bindSelection(q);
        } else if (q.type === 'fill_blank' || q.type === 'short_answer') {
            _bindFillBlank(q);
        } else if (q.type === 'matrix_choice') {
            _bindMatrix(q);
        }
    }

    function _bindSelection(q) {
        const container = document.querySelector(`.question-content[data-qid="${q.id}"]`);
        if (!container) return;
        container.querySelectorAll('.mcq-choice, .tf-option').forEach(el => {
            const input = el.querySelector('input');
            if (!input) return;
            // Đồng bộ class 'selected' với trạng thái 'checked' của input
            const syncSelected = () => {
                el.classList.toggle('selected', input.checked);
                if (input.checked && q.type !== 'mcq_multi' && q.type !== 'true_false') {
                    // single: bỏ chọn các khác
                    container.querySelectorAll('.mcq-choice, .tf-option').forEach(other => {
                        if (other !== el) {
                            const otherInput = other.querySelector('input');
                            if (otherInput) otherInput.checked = false;
                            other.classList.remove('selected');
                        }
                    });
                }
            };
            // Lắng nghe sự kiện 'change' từ input (chạy khi user click label/input)
            input.addEventListener('change', syncSelected);
            // Click vào label/marker/text cũng trigger change, nên không cần click handler riêng
        });

        // Xử lý click cho TF option items (custom radio)
        container.querySelectorAll('.tf-option-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Không xử lý nếu click vào chính input
                if (e.target.tagName === 'INPUT') return;
                const input = item.querySelector('input[type="radio"]');
                if (input) {
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    }

    function _bindFillBlank(q) {
        // Fill-blank không cần bind đặc biệt
    }

    function _bindMatrix(q) {
        const container = document.querySelector(`.question-content[data-qid="${q.id}"]`);
        if (!container) return;
        container.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    // Style cho row đã chọn
                    const row = input.closest('tr');
                    if (row) {
                        row.querySelectorAll('td').forEach(td => td.classList.remove('selected'));
                        input.closest('td').classList.add('selected');
                    }
                }
            });
        });
    }

    function _bindArrange(q) {
        const list = document.querySelector(`.arrange-list[data-qid="${q.id}"], .sentence-list[data-qid="${q.id}"]`);
        if (!list) return;

        let dragged = null;
        list.querySelectorAll('[data-pos]').forEach(chip => {
            chip.addEventListener('dragstart', (e) => {
                dragged = chip;
                chip.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            chip.addEventListener('dragend', () => {
                chip.classList.remove('dragging');
            });
            chip.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            chip.addEventListener('drop', (e) => {
                e.preventDefault();
                if (dragged && dragged !== chip) {
                    const rect = chip.getBoundingClientRect();
                    const after = (e.clientY > rect.top + rect.height / 2);
                    if (after) {
                        chip.parentNode.insertBefore(dragged, chip.nextSibling);
                    } else {
                        chip.parentNode.insertBefore(dragged, chip);
                    }
                }
            });
        });
    }

        function _bindDragDrop(q) {
        const container = document.querySelector(`.answer-dragdrop[data-qid="${q.id}"]`);
        if (!container) return;

        // Lưu trạng thái: pos -> choiceIdx (đọc từ DOM đã render)
        const state = {};
        container.querySelectorAll('.dd-drop-slot').forEach(slot => {
            const pos = slot.dataset.pos;
            const txt = slot.textContent.trim();
            // Nếu textContent khác rỗng & khác nbsp, tìm index choice tương ứng
            if (txt && txt !== '\u00a0') {
                const choiceIdx = (q.choices || []).findIndex(c => c === txt);
                if (choiceIdx >= 0) state[pos] = choiceIdx;
            }
        });
        container._ddState = state;

        // Helper: render lại toàn bộ khi state thay đổi
        function repaint() {
            const slotsUpdated = [];
            container.querySelectorAll('.dd-drop-slot').forEach(slot => {
                const pos = slot.dataset.pos;
                const ci = state[pos];
                if (ci !== undefined) {
                    slot.innerHTML = q.choices[ci] || '';
                    slot.classList.add('filled');
                    slot.classList.remove('empty');
                    slotsUpdated.push(slot);
                } else {
                    slot.innerHTML = '\u00a0';
                    slot.classList.remove('filled');
                    slot.classList.add('empty');
                }
            });
            // Đánh dấu chip đã dùng (chỉ mờ đi + bỏ draggable, KHÔNG xóa khỏi DOM)
            container.querySelectorAll('.dd-choice').forEach(c => {
                const ci = parseInt(c.dataset.choice);
                if (Object.values(state).map(Number).includes(ci)) {
                    c.classList.add('used');
                    c.draggable = false;
                } else {
                    c.classList.remove('used');
                    c.draggable = true;
                }
            });
            // Render lại công thức toán cho các slot đã điền (MathJax ưu tiên, KaTeX fallback)
            if (slotsUpdated.length > 0) {
                if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
                    const targets = slotsUpdated.filter(s => s instanceof Element);
                    if (targets.length > 0) {
                        try {
                            window.MathJax.typesetPromise(targets);
                        } catch (e) { /* ignore */ }
                    }
                } else if (typeof renderMathInElement !== 'undefined') {
                    slotsUpdated.forEach(slot => {
                        try {
                            renderMathInElement(slot, {
                                delimiters: [
                                    { left: '$$', right: '$$', display: true },
                                    { left: '$', right: '$', display: false },
                                    { left: '\\(', right: '\\)', display: false },
                                    { left: '\\[', right: '\\]', display: true }
                                ],
                                throwOnError: false,
                                trust: true,
                                strict: false
                            });
                        } catch (e) { /* ignore */ }
                    });
                }
            }
            // Cập nhật state
            container._ddState = Object.assign({}, state);
            // Dispatch event để sidebar cập nhật tiến độ
            container.dispatchEvent(new Event('dd-state-change', { bubbles: true }));
        }

        let draggedChoice = null;

        container.querySelectorAll('.dd-choice').forEach(choice => {
            choice.addEventListener('dragstart', (e) => {
                if (choice.classList.contains('used')) {
                    e.preventDefault();
                    return;
                }
                draggedChoice = choice;
                choice.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', choice.dataset.choice); } catch (err) { console.error('[QuestionRenderer] dataTransfer error:', err); }
            });
            choice.addEventListener('dragend', () => {
                choice.classList.remove('dragging');
                draggedChoice = null;
            });
        });

        container.querySelectorAll('.dd-drop-slot').forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            });
            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                if (!draggedChoice) return;
                const choiceIdx = parseInt(draggedChoice.dataset.choice);
                const pos = slot.dataset.pos;

                // Nếu choice đã dùng ở ô khác, dỡ khỏi ô cũ
                for (const [p, c] of Object.entries(state)) {
                    if (c === choiceIdx) delete state[p];
                }
                state[pos] = choiceIdx;
                repaint();
            });
        });

        // Click vào ô đã điền để xóa (tiện hơn nút X)
        container.addEventListener('click', (e) => {
            const slot = e.target.closest('.dd-drop-slot');
            if (!slot || !slot.classList.contains('filled')) return;
            const pos = slot.dataset.pos;
            if (pos === undefined) return;
            delete state[pos];
            repaint();
        });
    }

    /* ================================================================
       RENDER QUESTION HTML (kèm wrapper)
       ================================================================ */

    function _types() {
        if (typeof QuestionTypes !== 'undefined') return QuestionTypes;
        try { return require('./question-types.js'); } catch (e) { return null; }
    }

    function renderQuestion(q, saved) {
        const types = _types();
        if (!types) return `<div class="question-content" data-qid="${q.id}" data-type="${q.type}">QuestionTypes chưa load</div>`;
        const html = types.renderAnswer(q, saved);
        return `<div class="question-content" data-qid="${q.id}" data-type="${q.type}">${html}</div>`;
    }

    function renderHeader(q, idx) {
        const types = _types();
        return `
            <div class="question-header-row">
                <div class="question-number-badge">${idx + 1}</div>
                <div class="question-main-text">${types ? types.escapeHtmlForDisplay(q.content || '') : (q.content || '')}</div>
            </div>
        `;
    }

    /* ================================================================
       RENDER FULL QUESTION (header + stem + answer) - dùng cho preview & thi
       ================================================================ */

    function renderFullQuestion(q, idx, saved) {
        const types = _types();
        const t = types ? types.getType(q.type) : null;
        const typeLabel = t ? `${t.icon} ${t.label}` : (q.type || 'Câu hỏi');
        const points = q.points || 1;
        // Phần "Câu hỏi" (content/stem) - gộp vào header cùng số câu, ẨN với fill_blank và drag_drop
        const inlineTypes = ['fill_blank', 'drag_drop'];
        const isInline = inlineTypes.includes(q.type);
        // TRUE_FALSE tự render content trong renderAnswer nên không cần contentHtml ở đây
        const selfRenderContentTypes = ['true_false'];
        const hasSelfRenderContent = selfRenderContentTypes.includes(q.type);
        // Bỏ prefix "Câu X" / "Câu X." / "Câu X:" trong content để tránh lặp với .q-num
        let stemContent = q.content || '';
        if (stemContent) {
            stemContent = stemContent.replace(/^\s*<p>\s*Câu\s+\d+\s*[.:)\-]?\s*/i, '')
                                      .replace(/^\s*Câu\s+\d+\s*[.:)\-]?\s*/i, '')
                                      .replace(/^<\/p>\s*/i, '')
                                      .replace(/^\s*<p>/i, '');
        }
        const contentHtml = stemContent && !isInline && !hasSelfRenderContent ? `<div class="q-stem">${types ? types.escapeHtmlForDisplay(stemContent) : stemContent}</div>` : '';
        const headerHtml = `
            <div class="q-header">
                <span class="q-type-tag">${typeLabel}</span>
            </div>
        `;
        // Phần "Đề bài" (prompt) - phía trên, hiển thị như text SGK
        // Sử dụng escapeHtmlForDisplay để cho phép <img> tags nếu có ảnh inline
        const promptHtml = q.prompt && q.prompt.trim()
            ? `<div class="q-prompt-block">${types ? types.escapeHtmlForDisplay(q.prompt) : String(q.prompt).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>')}</div>`
            : '';
        // Hình ảnh minh họa (nếu có): URL, dataURL, hoặc LaTeX
        let imageHtml = '';
        if (q.image && String(q.image).trim()) {
            const img = String(q.image).trim();
            if (/^data:image\//.test(img)) {
                imageHtml = `<div class="q-image-block" style="max-width:100%;overflow:hidden;"><img src="${img}" alt="Hình minh họa cho câu hỏi" loading="lazy" style="max-width:100%;height:auto;display:block;margin:0 auto;"></div>`;
            } else if (/^https?:\/\//.test(img) && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(img)) {
                imageHtml = `<div class="q-image-block" style="max-width:100%;overflow:hidden;"><img src="${img}" alt="Hình minh họa cho câu hỏi" loading="lazy" style="max-width:100%;height:auto;display:block;margin:0 auto;"></div>`;
            } else if (/^https?:\/\//.test(img)) {
                imageHtml = `<div class="q-image-block"><a href="${img}" target="_blank">🔗 Hình minh họa</a></div>`;
            } else if (img.includes('\\(') || img.includes('$') || img.includes('\\[')) {
                const tex = img.replace(/^\$+|\$+$/g, '').replace(/^\\\(|\\\)$/g, '').replace(/^\\\[|\\\]$/g, '');
                imageHtml = `<div class="q-image-block" style="text-align:center; padding: 10px; background:#F8FAFC; border-radius: 6px;">\\(${tex}\\)</div>`;
            } else {
                // Có thể là path tương đối → cứ <img>
                imageHtml = `<div class="q-image-block" style="max-width:100%;overflow:hidden;"><img src="${img}" alt="Hình minh họa cho câu hỏi" loading="lazy" style="max-width:100%;height:auto;display:block;margin:0 auto;" onerror="this.style.display='none'"></div>`;
            }
        }
        // MCQ vẫn render bình thường (có đáp án A/B/C/D)
        // Ẩn đáp án trắc nghiệm trong chế độ sáng (light mode) - kiểm tra ở runtime
        const isLightMode = (() => {
            const savedTheme = localStorage.getItem('skyedu_theme');
            return document.documentElement.classList.contains('light') || 
                   document.documentElement.classList.contains('light-premium-mode') ||
                   savedTheme === 'lightpremium';
        })();
        const mcqTypes = ['mcq_single', 'mcq_multi', 'true_false'];
        const shouldHideAnswer = isLightMode && mcqTypes.includes(q.type);
        const answerHtml = shouldHideAnswer ? '' : renderQuestion(q, saved);
        return `
            <div class="q-card-inner">
                <div class="q-left-col"><span class="q-num">${idx + 1}</span></div>
                <div class="q-right-col">
                    <div class="q-body">${headerHtml}${promptHtml}${imageHtml}${contentHtml}${answerHtml}</div>
                </div>
            </div>
        `;
    }

    /* Render 4 ô trống nét đứt cho học sinh tự điền (chế độ luyện tập) */
    function _renderBlankMCQ(q) {
        const letters = ['A', 'B', 'C', 'D'];
        const isMulti = q.type === 'mcq_multi';
        return `
            <div class="answer-mcq answer-mcq-single ${isMulti ? 'as-multi' : ''}">
                ${letters.map(L => `
                    <div class="mcq-blank-slot">
                        <span class="mcq-blank-letter">${L}</span>
                        <span class="mcq-blank-line"></span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /* ================================================================
       MathJax/KaTeX re-render helper
       Hỗ trợ cả MathJax (admin.html, phòng luyện HSA) và KaTeX
       (fallback nếu MathJax chưa load).
       Ưu tiên MathJax để đồng bộ rendering giữa các trang.
       ================================================================ */

    function typesetMath(container) {
        // Ưu tiên MathJax (đồng bộ với phòng luyện HSA)
        if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
            try {
                if (container && container instanceof Element) {
                    return window.MathJax.typesetPromise([container]);
                }
                return window.MathJax.typesetPromise();
            } catch (e) {
                console.warn('[typesetMath] MathJax error:', e);
            }
        }
        // Fallback KaTeX (renderMathInElement) — chỉ dùng khi MathJax chưa load
        if (typeof window !== 'undefined' && typeof renderMathInElement !== 'undefined') {
            if (container && container instanceof Element) {
                try {
                    renderMathInElement(container, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\(', right: '\\)', display: false },
                            { left: '\\[', right: '\\]', display: true }
                        ],
                        throwOnError: false,
                        trust: true,
                        strict: false
                    });
                } catch (e) {
                    console.warn('[typesetMath] KaTeX error:', e);
                }
            }
            return Promise.resolve();
        }
        return Promise.resolve();
    }

    /* ================================================================
       EXPORT
       ================================================================ */
    const QuestionRenderer = {
        getAnswer,
        bindEvents,
        renderQuestion,
        renderHeader,
        renderFullQuestion,
        typesetMath
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QuestionRenderer;
    } else {
        global.QuestionRenderer = QuestionRenderer;
    }
})(typeof window !== 'undefined' ? window : globalThis);
