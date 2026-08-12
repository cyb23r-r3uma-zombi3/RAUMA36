/**
 * admin-form.js - Form handling & question creation/editing
 * Tách ra từ admin.html để giảm dung lượng - giữ nguyên logic gốc
 */
(function(global) {
    'use strict';

    // Collect form data from question form - logic đầy đủ giống admin.html gốc
    function collectFormData() {
        var App = global.App;
        if (!App) {
            console.error('[AdminForm] collectFormData: App not found');
            return null;
        }
        if (!App.currentDraft) {
            console.error('[AdminForm] collectFormData: App.currentDraft is null');
            return null;
        }

        var q = JSON.parse(JSON.stringify(App.currentDraft));
        var form = document.getElementById('questionFormContent');
        if (!form) return q;

        q.content = form.querySelector('.q-content') ? (form.querySelector('.q-content').value || '') : '';

        // Lấy giá trị prompt từ textarea trước
        var promptEl = form.querySelector('.q-prompt');
        var promptValue = promptEl ? (promptEl.value || '') : '';

        // Ghép ảnh inline vào prompt hoặc content tùy loại câu hỏi
        // Với fill_blank, drag_drop, matrix_choice, short_answer: ảnh ghép vào q.prompt (phần đề bài)
        var inlineZone = form.querySelector('.inline-images-zone');
        var isPromptImage = (q.type === 'fill_blank' || q.type === 'drag_drop' || q.type === 'matrix_choice' || q.type === 'short_answer');
        if (inlineZone) {
            var imgs = inlineZone.querySelectorAll('.inline-images-list img');
            if (imgs.length > 0) {
                var extraHTML = Array.from(imgs).map(function(img) {
                    return '<br><img src="' + img.src + '" alt="Hình ảnh trong nội dung câu hỏi" loading="lazy" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;display:block;">';
                }).join('');
                if (isPromptImage) {
                    // Ghép ảnh vào prompt
                    q.prompt = promptValue + extraHTML;
                } else {
                    // Ghép ảnh vào content
                    q.content = q.content + extraHTML;
                    q.prompt = promptValue;
                }
            } else {
                q.prompt = promptValue;
            }
        } else {
            q.prompt = promptValue;
        }

        var explEl = form.querySelector('.q-explanation');
        q.explanation = explEl ? (explEl.value || '') : '';

        var pointsEl = form.querySelector('.q-points');
        q.points = pointsEl ? (parseFloat(pointsEl.value) || 1) : (q.points || 1);

        var displayIdEl = form.querySelector('.q-display-id');
        q.displayId = displayIdEl ? (displayIdEl.value.trim() || q.displayId || '') : (q.displayId || '');

        var diffEl = form.querySelector('.q-difficulty');
        q.difficulty = diffEl ? (diffEl.value || '') : '';

        var topicEl = form.querySelector('.q-topic');
        q.topic = topicEl ? (topicEl.value.trim() || '') : '';

        var tagsEl = form.querySelector('.q-tags');
        var tagsRaw = tagsEl ? (tagsEl.value || '') : '';
        q.tags = tagsRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

        var imageEl = form.querySelector('.q-image');
        q.image = imageEl ? (imageEl.value.trim() || '') : '';

        var qVideoEl = form.querySelector('.q-video');
        if (qVideoEl && App && typeof App.normalizeYouTubeInput === 'function') {
            App.normalizeYouTubeInput(qVideoEl);
        }
        q.videoUrl = qVideoEl ? (qVideoEl.value ? qVideoEl.value.trim() : '') : '';

        var yearEl = form.querySelector('.q-year');
        q.year = yearEl ? (parseInt(yearEl.value, 10) || new Date().getFullYear()) : new Date().getFullYear();

        var createdByEl = form.querySelector('.q-created-by');
        q.createdBy = createdByEl ? (createdByEl.value.trim() || q.createdBy || 'admin') : (q.createdBy || 'admin');

        // categoryId từ dropdown ở formActions
        var catSel = document.getElementById('qCategorySelect');
        q.categoryId = catSel ? (catSel.value || '') : (q.categoryId || '');

        // blueprintId
        var bpSel = document.getElementById('qBlueprintSelect');
        q.blueprintId = bpSel ? (bpSel.value || '') : (q.blueprintId || '');

        // Tự đồng bộ topic từ 13 chuyên đề nếu categoryId khớp
        if (q.categoryId && typeof TsaTopics !== 'undefined') {
            var meta = TsaTopics.getMeta(q.categoryId);
            if (meta && meta.type === 'topic') q.topic = meta.title;
        }

        var t = typeof QuestionTypes !== 'undefined' ? QuestionTypes.getType(q.type) : null;
        if (!t) return null;

        if (q.type === 'mcq_single') {
            q.options = Array.from(form.querySelectorAll('.q-option')).map(function(el) { return el.value; });
            var checked = form.querySelector('input[name="correct-0"]:checked');
            q.correctAnswer = checked ? checked.value : '';
        } else if (q.type === 'mcq_multi') {
            q.options = Array.from(form.querySelectorAll('.q-option')).map(function(el) { return el.value; });
            var rawAnswers = Array.from(form.querySelectorAll('input[name^="correct-multi-"]:checked')).map(function(el) {
                // Đọc index từ data-opt-idx thay vì value (index ổn định, không bị escape)
                return el.dataset.optIdx != null ? parseInt(el.dataset.optIdx, 10) : el.value;
            });
            // Filter out NaN
            q.correctAnswers = rawAnswers.filter(function(a) { return a != null && a !== '' && !isNaN(a); });
            // Defensive: ensure it's always an array
            if (!Array.isArray(q.correctAnswers)) q.correctAnswers = [];
            // Chuyển index → text để lưu đúng format
            q.correctAnswers = q.correctAnswers.map(function(idx) {
                return q.options[idx] || '';
            }).filter(function(a) { return a != null && String(a).trim() !== ''; });
        } else if (q.type === 'essay') {
            q.rubric = form.querySelector('.q-rubric') ? form.querySelector('.q-rubric').value : '';
            q.sampleAnswer = form.querySelector('.q-sample') ? form.querySelector('.q-sample').value : '';
        } else if (q.type === 'fill_blank') {
            q.correctAnswers = Array.from(form.querySelectorAll('.q-blank-answer')).map(function(el) { return el.value; });
        } else if (q.type === 'word_arrange' || q.type === 'sentence_order') {
            q.words = (form.querySelector('.q-words') ? form.querySelector('.q-words').value : '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
            if (q.type === 'sentence_order') q.sentences = q.words;
            q.correctOrder = (form.querySelector('.q-correct-order') ? form.querySelector('.q-correct-order').value : '').split('\n').map(function(s) { return parseInt(s.trim(), 10); }).filter(function(n) { return !isNaN(n); });
        } else if (q.type === 'matching') {
            q.pairs = [];
            var lefts = form.querySelectorAll('.q-pair-left');
            var rights = form.querySelectorAll('.q-pair-right');
            lefts.forEach(function(l, i) { q.pairs.push({ left: l.value, right: rights[i] ? rights[i].value : '' }); });
        } else if (q.type === 'true_false') {
            var checkedTF = form.querySelector('input[name^="correct-tf-"]:checked');
            q.correctAnswer = checkedTF ? checkedTF.value : '';
        } else if (q.type === 'drag_drop') {
            var blanks = (q.content || '').match(/\[\d+\]/g) || [];
            q.blanksCount = blanks.length;
            q.choices = (form.querySelector('.q-choices') ? form.querySelector('.q-choices').value : '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
            q.correctMapping = {};
            form.querySelectorAll('.q-correct-mapping').forEach(function(sel, i) { q.correctMapping[i] = parseInt(sel.value, 10); });
        } else if (q.type === 'matrix_choice') {
            q.rows = (form.querySelector('.q-rows') ? form.querySelector('.q-rows').value : '').split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
            q.correctAnswer = {};
            q.rows.forEach(function(_, i) {
                var checked = form.querySelector('input[name="matrix-correct-0-' + i + '"]:checked');
                if (checked) q.correctAnswer[i] = checked.value;
            });
        } else if (q.type === 'fill_image') {
            q.imageUrl = form.querySelector('.q-image-url') ? form.querySelector('.q-image-url').value : '';
            q.imageCaption = form.querySelector('.q-image-caption') ? form.querySelector('.q-image-caption').value : '';
            q.prefix = form.querySelector('.q-prefix') ? form.querySelector('.q-prefix').value : '';
            q.suffix = form.querySelector('.q-suffix') ? form.querySelector('.q-suffix').value : '';
            q.inputType = form.querySelector('.q-input-type') ? form.querySelector('.q-input-type').value : 'text';
            q.inputPlaceholder = form.querySelector('.q-input-placeholder') ? form.querySelector('.q-input-placeholder').value : '';
            q.correctAnswer = form.querySelector('.q-correct') ? form.querySelector('.q-correct').value : '';
            var selText = form.querySelector('.q-select-options') ? form.querySelector('.q-select-options').value : '';
            q.selectOptions = selText.split('\n').map(function(line) {
                var parts = line.split('|');
                var value = parts[0];
                var rest = parts.slice(1);
                return { value: (value || '').trim(), text: rest.join('|').trim() };
            }).filter(function(o) { return o.value !== '' || o.text !== ''; });
        } else if (q.type === 'short_answer') {
            q.correctAnswer = form.querySelector('.q-correct') ? form.querySelector('.q-correct').value : '';
        }
        return q;
    }

    // Save new question
    function saveNewQuestion() {
        var App = global.App;
        if (!App) return;

        // Validate YouTube embed trước
        var form = document.getElementById('questionFormContent');
        var qVideoEl = form ? form.querySelector('.q-video') : null;
        if (qVideoEl && qVideoEl.value.trim()) {
            var v = typeof App.parseEmbedCode === 'function' ? App.parseEmbedCode(qVideoEl) : { ok: true };
            if (!v.ok) {
                if (typeof App.toast === 'function') App.toast('Vui lòng dán Mã nhúng (Embed Code) từ YouTube (Chia sẻ → Nhúng).', 'error');
                qVideoEl.focus();
                return;
            }
        }

        var q = collectFormData();
        if (!q) {
            if (typeof App.toast === 'function') App.toast('Lỗi: không đọc được dữ liệu', 'error');
            return;
        }

        if (!q.content || q.content.trim() === '') {
            if (typeof App.toast === 'function') App.toast('Vui lòng nhập nội dung câu hỏi', 'error');
            return;
        }

        if (typeof QuestionBank !== 'undefined' && QuestionBank.save) {
            // QuestionBank.save() may return:
            // 1. Promise (when Firebase is ready)
            // 2. Plain object { success: false, error: err } (when validation fails)
            var result = QuestionBank.save(q);
            
            // Helper to handle the save result
            function handleSaveResult(r) {
                if (r && r.success) {
                    if (typeof App.toast === 'function') App.toast('Đã lưu câu hỏi thành công!', 'success');
                    if (typeof App.resetCreateForm === 'function') App.resetCreateForm();
                    if (typeof App.navigateTo === 'function') App.navigateTo('question-bank');
                } else {
                    // Log đầy đủ error để debug
                    console.error('[AdminForm] saveNewQuestion error:', r);
                    console.error('[AdminForm] error.message:', r?.error);
                    if (typeof App.toast === 'function') {
                        var errMsg = (r && r.error) ? r.error : 'Lỗi khi lưu câu hỏi';
                        App.toast('Lỗi: ' + errMsg, 'error');
                    }
                }
            }
            
            if (result && typeof result.then === 'function') {
                // It's a Promise
                result.then(handleSaveResult).catch(function(err) {
                    console.error('[AdminForm] saveNewQuestion Promise rejected:', err);
                    console.error('[AdminForm] err.message:', err?.message);
                    if (typeof App.toast === 'function') {
                        var errMsg = (err && err.message) ? err.message : 'Lỗi không xác định khi lưu câu hỏi';
                        App.toast('Lỗi: ' + errMsg, 'error');
                    }
                });
            } else {
                // It's a plain object (validation failed)
                handleSaveResult(result);
            }
        } else {
            if (typeof App.toast === 'function') App.toast('QuestionBank chưa load', 'error');
        }
    }

    // Edit question
    function editQuestion(id) {
        console.log('[AdminForm] editQuestion called with id:', id);
        var App = global.App;
        if (!App) {
            console.error('[AdminForm] App not found');
            return;
        }

        // Kiểm tra QuestionBank
        if (typeof QuestionBank === 'undefined') {
            alert('QuestionBank chưa load - vui lòng đợi');
            return;
        }

        // Lấy câu hỏi
        var q = null;
        if (QuestionBank.getById) {
            q = QuestionBank.getById(id);
        }
        if (!q && QuestionBankSync && QuestionBankSync.getById) {
            q = QuestionBankSync.getById(id);
        }
        if (!q) {
            // Thử đọc trực tiếp từ localStorage
            try {
                var raw = localStorage.getItem('sky_question_bank');
                if (raw) {
                    var arr = JSON.parse(raw);
                    if (Array.isArray(arr)) {
                        q = arr.find(function(item) { return item.id === id; });
                    }
                }
            } catch (e) {
                console.error('[AdminForm] Failed to read question from localStorage cache:', e);
            }
        }
        
        if (!q) {
            console.error('[AdminForm] Question not found:', id);
            alert('Không tìm thấy câu hỏi');
            return;
        }

        console.log('[AdminForm] Found question:', q);

        // Lưu câu hỏi cần sửa vào currentDraft
        App.currentDraft = JSON.parse(JSON.stringify(q));
        App.selectedType = q.type || '';
        console.log('[AdminForm] Set currentDraft, selectedType:', App.selectedType);

        // Chuyển sang trang tạo câu hỏi
        if (typeof App.navigateTo === 'function') {
            console.log('[AdminForm] Calling navigateTo create-question');
            App.navigateTo('create-question');
        } else {
            console.error('[AdminForm] navigateTo not found');
        }

        // Đợi DOM render xong rồi điền dữ liệu vào form
        var attempts = 0;
        var maxAttempts = 30;
        var tryFill = function() {
            attempts++;
            var formContent = document.getElementById('questionFormContent');
            var editorSplit = document.getElementById('editorSplit');
            var typeSelect = document.getElementById('typeSelect');

            if (!formContent || !editorSplit) {
                console.log('[AdminForm] DOM not ready, attempt:', attempts);
                if (attempts < maxAttempts) {
                    setTimeout(tryFill, 100);
                }
                return;
            }

            try {
                console.log('[AdminForm] Filling form, attempt:', attempts);
                // Hiện form editor
                editorSplit.style.display = 'grid';

                // Chọn đúng loại câu hỏi trong dropdown
                if (typeSelect) {
                    typeSelect.value = q.type || '';
                }

                // Build form HTML với dữ liệu có sẵn
                var formHtml = '';
                if (typeof QuestionTypes !== 'undefined' && QuestionTypes.renderForm) {
                    formHtml = QuestionTypes.renderForm(q, 0);
                } else {
                    // Fallback - tạo form HTML cơ bản
                    formHtml = _buildBasicFormHTML(q);
                }

                // Thêm các trường extra
                formHtml += _extraFieldsHTML(q);

                // Thêm toolbar LaTeX
                if (typeof App._latexToolbarHTML === 'function') {
                    formHtml += App._latexToolbarHTML();
                }

                // Set form content
                formContent.innerHTML = formHtml;

                // Populate difficulty select
                _populateDifficultySelect(q.difficulty);

                // Bind live update
                if (typeof App._bindFormLiveUpdate === 'function') {
                    App._bindFormLiveUpdate();
                }

                // Update preview
                if (typeof App._updatePreview === 'function') {
                    App._updatePreview();
                }

                // Populate category
                if (typeof App.populateCategorySelect === 'function') {
                    App.populateCategorySelect(q.categoryId);
                }

                console.log('[AdminForm] Form filled successfully');

            } catch (e) {
                console.error('[AdminForm] Error filling form:', e);
                if (attempts < maxAttempts) {
                    setTimeout(tryFill, 100);
                }
            }
        };

        setTimeout(tryFill, 300);
    }

    // Build basic form HTML fallback
    function _buildBasicFormHTML(q) {
        var type = q.type || 'mcq';
        var content = q.content || '';
        var choices = Array.isArray(q.choices) ? q.choices.join('\n') : '';

        var html = '<div class="form-group">';
        html += '<label class="form-label">Nội dung câu hỏi</label>';
        html += '<textarea class="form-control q-content" rows="4">' + _escapeHtml(content) + '</textarea>';
        html += '</div>';

        if (type === 'mcq' || type === 'mcq-multi') {
            html += '<div class="form-group">';
            html += '<label class="form-label">Các lựa chọn (mỗi dòng 1 đáp án)</label>';
            html += '<textarea class="form-control q-choices" rows="6" placeholder="A. Đáp án A\nB. Đáp án B\nC. Đáp án C\nD. Đáp án D">' + _escapeHtml(choices) + '</textarea>';
            html += '</div>';
        }

        html += '<div class="form-group">';
        html += '<label class="form-label">Đáp án đúng</label>';
        html += '<input type="text" class="form-control q-correct-answer" value="' + _escapeHtml(String(q.correctAnswer || '')) + '">';
        html += '</div>';

        return html;
    }

    function _escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function _extraFieldsHTML(q) {
        var q2 = q || {};
        var difficulty = q2.difficulty || '';
        var categoryId = q2.categoryId || '';
        var topic = q2.topic || '';
        var year = q2.year || '';
        var points = q2.points || 1;
        var image = q2.image || '';
        var videoUrl = q2.videoUrl || '';
        var blueprintId = q2.blueprintId || '';

        var html = '<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--card-border);">';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">Mức độ</label><select class="form-control" id="qDifficulty"><option value="Nhan biet">Nhận biết</option><option value="Thong hieu">Thông hiểu</option><option value="Van dung">Vận dụng</option><option value="Van dung cao">VDC</option></select></div>';
        html += '<div class="form-group"><label class="form-label">Chuyên đề</label><select class="form-control" id="qCategory"><option value="">-- Chọn --</option></select></div>';
        html += '<div class="form-group"><label class="form-label">Điểm</label><input type="number" class="form-control" id="qPoints" value="' + points + '" min="0.5" step="0.5"></div>';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group"><label class="form-label">Chủ đề</label><select class="form-control" id="qTopic"><option value="">-- Chọn --</option></select></div>';
        html += '<div class="form-group"><label class="form-label">Năm</label><input type="number" class="form-control" id="qYear" value="' + year + '" placeholder="2024"></div>';
        html += '</div>';
        html += '<div class="form-group"><label class="form-label">Hình ảnh (URL)</label><input type="text" class="form-control" id="qImage" value="' + _escapeHtml(image) + '" placeholder="https://..."></div>';
        html += '<div class="form-group"><label class="form-label">Video (URL)</label><input type="text" class="form-control" id="qVideoUrl" value="' + _escapeHtml(videoUrl) + '" placeholder="https://youtube.com/..."></div>';
        html += '</div>';
        return html;
    }

    function _populateDifficultySelect(selected) {
        var sel = document.getElementById('qDifficulty');
        if (sel && selected) {
            sel.value = selected;
        }
    }

    // Duplicate question
    function duplicateQuestion(id) {
        var App = global.App;
        if (!App) return;

        if (typeof QuestionBank === 'undefined' || !QuestionBank.getById) return;
        var q = QuestionBank.getById(id);
        if (!q) return;

        var newQ = JSON.parse(JSON.stringify(q));
        newQ.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        newQ.name = (q.name || '') + ' (copy)';
        newQ.createdAt = new Date().toISOString();
        newQ.updatedAt = new Date().toISOString();

        if (typeof QuestionBank !== 'undefined' && QuestionBank.save) {
            // QuestionBank.save() returns a Promise - must await it
            QuestionBank.save(newQ).then(function(r) {
                if (r && r.success) {
                    if (typeof App.toast === 'function') App.toast('Đã nhân bản câu hỏi', 'success');
                    if (typeof App.renderBank === 'function') App.renderBank();
                } else {
                    console.error('[AdminForm] duplicateQuestion error:', r);
                    console.error('[AdminForm] error.message:', r?.error);
                    if (typeof App.toast === 'function') {
                        var errMsg = (r && r.error) ? r.error : 'Lỗi khi nhân bản câu hỏi';
                        App.toast('Lỗi: ' + errMsg, 'error');
                    }
                }
            }).catch(function(err) {
                console.error('[AdminForm] duplicateQuestion Promise rejected:', err);
                if (typeof App.toast === 'function') {
                    var errMsg = (err && err.message) ? err.message : 'Lỗi không xác định khi nhân bản câu hỏi';
                    App.toast('Lỗi: ' + errMsg, 'error');
                }
            });
        }
    }

    // Delete question
    function deleteQuestion(id) {
        var App = global.App;
        if (!App) return;

        if (!confirm('Xóa câu hỏi này?')) return;

        if (typeof QuestionBank !== 'undefined' && QuestionBank.remove) {
            var r = QuestionBank.remove(id);
            if (r && r.success) {
                if (typeof App.toast === 'function') App.toast('✅ Đã xóa câu hỏi', 'success');
                if (typeof App.renderBank === 'function') App.renderBank();
            } else {
                if (typeof App.toast === 'function') App.toast(r ? ('Lỗi: ' + r.error) : 'Lỗi khi xóa', 'error');
            }
        }
    }

    // Reset create form
    function resetCreateForm() {
        var App = global.App;
        if (!App) return;
        App.currentDraft = null;
        App.selectedType = null;

        var form = document.getElementById('questionFormContent');
        if (form) {
            // Clear tất cả input/textarea (trừ những cái cố định)
            var inputs = form.querySelectorAll('input[type="text"], textarea');
            inputs.forEach(function(el) { el.value = ''; });

            // Reset dropdowns
            var selects = form.querySelectorAll('select');
            selects.forEach(function(el) {
                if (!el.classList.contains('q-difficulty') && !el.classList.contains('q-year')) {
                    el.selectedIndex = 0;
                }
            });

            // Reset checkbox/radio
            var checks = form.querySelectorAll('input[type="checkbox"], input[type="radio"]');
            checks.forEach(function(cb) { cb.checked = false; });
        }

        // Ẩn editor split
        var split = document.getElementById('editorSplit');
        if (split) split.style.display = 'none';
        var actions = document.getElementById('formActions');
        if (actions) actions.style.display = 'none';
    }

    // Export
    global.AdminForm = {
        collectFormData: collectFormData,
        saveNewQuestion: saveNewQuestion,
        editQuestion: editQuestion,
        duplicateQuestion: duplicateQuestion,
        deleteQuestion: deleteQuestion,
        resetCreateForm: resetCreateForm
    };

})(typeof window !== 'undefined' ? window : globalThis);
