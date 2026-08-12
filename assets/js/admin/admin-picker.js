/**
 * admin-picker.js - Question Picker for exam creation
 * Tách ra từ admin.html để giảm dung lượng
 */
(function(global) {
    'use strict';

    // Safe escape helper
    function safeEscape(s) {
        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.escapeHtml) {
            return QuestionTypes.escapeHtml(s);
        }
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Current picker state
    var _pickerFilter = 'all';
    var _currentCategoryId = '';
    var _pickerCurrentPage = 1;
    var _pickerPageSize = 25;
    var _pickerTotalItems = 0;

    // Get App reference - try multiple sources
    function getApp() {
        return global.App || window.App;
    }

    function setPickerFilter(filter) {
        _pickerFilter = filter;
        resetPickerPage();
        renderPicker();
    }

    // Render picker tabs and list
    function renderPicker() {
        populatePickerCategoryFilter();
        populateYearFilter();

        var tabs = document.getElementById('pickerTabs');
        if (!tabs) return;

        var stats = (typeof QuestionBank !== 'undefined' && QuestionBank.getStats) ? QuestionBank.getStats() : { total: 0, byType: {} };
        var filters = [{ key: 'all', label: 'Tất cả (' + (stats.total || 0) + ')' }];

        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.getAllTypes) {
            QuestionTypes.getAllTypes().forEach(function(t) {
                filters.push({ key: t.key, label: t.shortLabel + ' (' + (stats.byType[t.key] || 0) + ')' });
            });
        }

        tabs.innerHTML = filters.map(function(f) {
            return '<div class="picker-filter-tab ' + (_pickerFilter === f.key ? 'active' : '') + '" data-filter="' + f.key + '" onclick="AdminPicker.setPickerFilter(\'' + f.key + '\')">' + f.label + '</div>';
        }).join('');

        _renderPickerList();
    }

    function populatePickerCategoryFilter() {
        var sel = document.getElementById('pickerCategoryFilter');
        if (!sel) return;

        var parts = ['<option value="">📁 Tất cả chuyên đề</option>'];
        var cur = _currentCategoryId || '';

        if (typeof TsaTopics !== 'undefined') {
            parts.push('<optgroup label="13 chuyên đề TSA">');
            TsaTopics.TSA_TOPICS.forEach(function(t) {
                parts.push('<option value="' + t.key + '" ' + (cur === t.key ? 'selected' : '') + '>' + t.num + '. ' + safeEscape(t.title) + '</option>');
            });
            parts.push('</optgroup><optgroup label="TSA đặc biệt">');
            TsaTopics.EXTRA_CATEGORIES.forEach(function(c) {
                parts.push('<option value="' + c.key + '" ' + (cur === c.key ? 'selected' : '') + '>' + safeEscape(c.title) + '</option>');
            });
            parts.push('</optgroup>');
        }

        if (typeof HsaTopics !== 'undefined') {
            parts.push('<optgroup label="5 chuyên đề HSA">');
            HsaTopics.HSA_TOPICS.forEach(function(t) {
                parts.push('<option value="' + t.key + '" ' + (cur === t.key ? 'selected' : '') + '>' + t.num + '. ' + safeEscape(t.title) + '</option>');
            });
            parts.push('</optgroup><optgroup label="HSA đặc biệt">');
            HsaTopics.EXTRA_CATEGORIES.forEach(function(c) {
                parts.push('<option value="' + c.key + '" ' + (cur === c.key ? 'selected' : '') + '>' + safeEscape(c.title) + '</option>');
            });
            parts.push('</optgroup>');
        }

        sel.innerHTML = parts.join('');
    }

    function populateYearFilter() {
        var sel = document.getElementById('pickerYearFilter');
        if (!sel || typeof QuestionBank === 'undefined' || !QuestionBank.getYears) return;
        var years = QuestionBank.getYears();
        sel.innerHTML = '<option value="">📅 Năm</option>' + years.map(function(y) {
            return '<option value="' + y + '">' + y + '</option>';
        }).join('');
    }

    function _renderPickerList() {
        var container = document.getElementById('pickerList');
        if (!container) return;

        var kw = (document.getElementById('pickerSearch') || {}).value || '';
        var diff = (document.getElementById('pickerDiffFilter') || {}).value || '';
        var catId = (document.getElementById('pickerCategoryFilter') || {}).value || '';
        var year = (document.getElementById('pickerYearFilter') || {}).value || '';
        _currentCategoryId = catId;

        var opts = { keyword: kw, difficulty: diff, categoryId: catId, year: year };
        if (_pickerFilter !== 'all') opts.type = _pickerFilter;

        var questions = (typeof QuestionBank !== 'undefined' && QuestionBank.search) ? QuestionBank.search(opts) : [];

        _pickerTotalItems = questions.length;
        var totalPages = Math.max(1, Math.ceil(_pickerTotalItems / _pickerPageSize));
        if (_pickerCurrentPage > totalPages) _pickerCurrentPage = totalPages;
        if (_pickerCurrentPage < 1) _pickerCurrentPage = 1;
        var startIdx = (_pickerCurrentPage - 1) * _pickerPageSize;
        var endIdx = Math.min(startIdx + _pickerPageSize, _pickerTotalItems);
        var pagedQuestions = questions.slice(startIdx, endIdx);

        var countEl = document.getElementById('pickerCount');
        if (countEl) countEl.textContent = questions.length + ' câu';

        if (questions.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><p>Không có câu hỏi phù hợp</p></div>';
            document.getElementById('pickerPagination').innerHTML = '';
            return;
        }

        var diffLabels = { 'Nhan biet': 'NB', 'Thong hieu': 'TH', 'Van dung': 'VD', 'Van dung cao': 'VDC' };
        var diffColors = { 'Nhan biet': '#10B981', 'Thong hieu': '#3B82F6', 'Van dung': '#F59E0B', 'Van dung cao': '#EF4444' };

        // Lấy selectedQuestions từ App (authoritative source)
        var App = getApp();
        var selectedArr = (App && App.selectedQuestions) ? App.selectedQuestions : [];

        container.innerHTML = pagedQuestions.map(function(q, idx) {
            var t = (typeof QuestionTypes !== 'undefined' && QuestionTypes.getType) ? QuestionTypes.getType(q.type) : null;
            var isSelected = selectedArr.some(function(sq) { return sq.id === q.id; });
            var diffBadge = q.difficulty ? ' <span class="badge" style="background:' + (diffColors[q.difficulty] || '#666') + ';color:white;font-size:10px;">' + (diffLabels[q.difficulty] || q.difficulty) + '</span>' : '';
            var displayIdBadge = q.displayId ? '<span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; font-family: monospace; font-size: 10px;">' + safeEscape(q.displayId) + '</span>' : '';
            var typeBadge = '<span class="badge badge-type ' + (q.type || '') + '">' + (t ? t.icon : '') + ' ' + (t ? t.shortLabel : (q.type || '')) + '</span>';
            var pointsBadge = '<span class="badge" style="background:rgba(255,255,255,0.08); color:#B8C5D6;">' + (q.points || 1) + 'đ</span>';

            var body = '';
            try {
                if (typeof QuestionRenderer !== 'undefined' && QuestionRenderer.renderFullQuestion) {
                    body = QuestionRenderer.renderFullQuestion(q, idx, null);
                } else {
                    var plain = q.content ? q.content.replace(/<[^>]*>/g, '') : '';
                    body = '<div>' + safeEscape(plain) + '</div>';
                }
            } catch (e) {
                var plain2 = q.content ? q.content.replace(/<[^>]*>/g, '') : '';
                body = '<div>' + safeEscape(plain2) + '</div>';
            }

            return '<div class="picker-item ' + (isSelected ? 'selected' : '') + '" data-qid="' + q.id + '">' +
                '<div class="picker-item-header">' +
                    '<div class="picker-item-check">' + (isSelected ? '✓' : '') + '</div>' +
                    displayIdBadge + typeBadge + pointsBadge + diffBadge +
                    '<span style="flex:1;"></span>' +
                    '<span style="font-size: 11px; color: var(--text-muted);">' + (isSelected ? '✅ Đã chọn' : 'Bấm để chọn') + '</span>' +
                '</div>' +
                '<div class="picker-item-body">' + body + '</div>' +
            '</div>';
        }).join('');

        // Render pagination
        renderPickerPagination(_pickerCurrentPage, totalPages, _pickerTotalItems, startIdx + 1, endIdx);

        // Bind click events AFTER rendering (to ensure App is defined)
        bindPickerItemEvents(container);

        // Typeset math
        if (typeof QuestionRenderer !== 'undefined' && QuestionRenderer.typesetMath) {
            setTimeout(function() { QuestionRenderer.typesetMath(container); }, 50);
        }
    }

    // Render pagination controls for picker
    function renderPickerPagination(currentPage, totalPages, totalItems, startItem, endItem) {
        var container = document.getElementById('pickerPagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        var pageRange = 5;
        var startPage = Math.max(1, currentPage - Math.floor(pageRange / 2));
        var endPage = Math.min(totalPages, startPage + pageRange - 1);
        if (endPage - startPage < pageRange - 1) {
            startPage = Math.max(1, endPage - pageRange + 1);
        }

        var html = '<div class="pagination-controls">';

        // Previous button
        html += '<button class="pagination-btn" onclick="AdminPicker.goToPickerPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + '>‹ Trước</button>';

        // First page + ellipsis
        if (startPage > 1) {
            html += '<button class="pagination-btn" onclick="AdminPicker.goToPickerPage(1)">1</button>';
            if (startPage > 2) {
                html += '<span style="color:var(--text-muted);padding:0 4px;">...</span>';
            }
        }

        // Page numbers
        for (var i = startPage; i <= endPage; i++) {
            html += '<button class="pagination-btn ' + (i === currentPage ? 'active' : '') + '" onclick="AdminPicker.goToPickerPage(' + i + ')">' + i + '</button>';
        }

        // Last page + ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<span style="color:var(--text-muted);padding:0 4px;">...</span>';
            }
            html += '<button class="pagination-btn" onclick="AdminPicker.goToPickerPage(' + totalPages + ')">' + totalPages + '</button>';
        }

        // Next button
        html += '<button class="pagination-btn" onclick="AdminPicker.goToPickerPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>Sau ›</button>';

        // Info
        html += '<span class="pagination-info">Hiển thị ' + startItem + '-' + endItem + ' / ' + totalItems + ' câu</span>';

        // Jump to page
        html += '<div class="pagination-jump"><input type="number" id="pickerJumpPage" min="1" max="' + totalPages + '" value="' + currentPage + '" onkeypress="if(event.key===\'Enter\'){var p=parseInt(this.value);if(p>=1&&p<=' + totalPages + ')AdminPicker.goToPickerPage(p);}"><button onclick="var p=parseInt(document.getElementById(\'pickerJumpPage\').value);if(p>=1&&p<=' + totalPages + ')AdminPicker.goToPickerPage(p);">Đến</button></div>';

        html += '</div>';
        container.innerHTML = html;
    }

    // Go to specific page
    function goToPickerPage(page) {
        var totalPages = Math.max(1, Math.ceil(_pickerTotalItems / _pickerPageSize));
        if (page < 1 || page > totalPages) return;
        _pickerCurrentPage = page;
        _renderPickerList();
    }

    // Reset page
    function resetPickerPage() {
        _pickerCurrentPage = 1;
    }

    // Bind click events to picker items - called after render to ensure App is defined
    function bindPickerItemEvents(container) {
        var items = container.querySelectorAll('.picker-item');
        items.forEach(function(item) {
            item.addEventListener('click', function(e) {
                var qid = this.getAttribute('data-qid');
                if (!qid) return;
                var App = getApp();
                if (App && typeof App.togglePickQuestion === 'function') {
                    App.togglePickQuestion(qid);
                } else {
                    // Fallback: direct toggle
                    togglePickQuestionDirect(qid);
                }
            });
        });
    }

    // Direct toggle when App is not available
    function togglePickQuestionDirect(id) {
        var App = getApp();
        if (!App) return;
        var idx = -1;
        if (App.selectedQuestions) {
            idx = App.selectedQuestions.findIndex(function(q) { return q.id === id; });
            if (idx >= 0) {
                App.selectedQuestions.splice(idx, 1);
            } else {
                var q = (typeof QuestionBank !== 'undefined' && QuestionBank.getById) ? QuestionBank.getById(id) : null;
                if (q) App.selectedQuestions.push(JSON.parse(JSON.stringify(q)));
            }
        }
        _renderPickerList();
        _renderSelectedList();
    }

    function _renderSelectedList() {
        var container = document.getElementById('pickerSelectedList');
        if (!container) return;

        // Use App.selectedQuestions as the authoritative source
        var App = getApp();
        var selectedArr = (App && App.selectedQuestions) ? App.selectedQuestions : [];

        if (selectedArr.length === 0) {
            container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px;">Chưa chọn câu nào</div>';
            return;
        }

        var questions = selectedArr.map(function(q) {
            if (typeof QuestionBank !== 'undefined' && QuestionBank.getById) {
                return QuestionBank.getById(q.id) || q;
            }
            return q;
        }).filter(Boolean);

        container.innerHTML = questions.map(function(q) {
            var t = (typeof QuestionTypes !== 'undefined' && QuestionTypes.getType) ? QuestionTypes.getType(q.type) : null;
            return '<div class="selected-item" style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:6px;margin-bottom:4px;">' +
                '<input type="checkbox" checked onclick="AdminPicker.togglePickQuestionDirect(\'' + q.id + '\')" style="cursor:pointer;">' +
                '<span style="flex:1;font-size:12px;">' + (t ? t.icon : '') + ' ' + safeEscape((q.content || '').replace(/<[^>]*>/g, '').slice(0, 60)) + '</span>' +
                '<span style="font-size:11px;color:var(--text-muted);">' + (q.points || 1) + 'đ</span>' +
            '</div>';
        }).join('');
    }

    function updateSelectedCount() {
        var App = getApp();
        var count = (App && App.selectedQuestions) ? App.selectedQuestions.length : 0;
        var el = document.getElementById('pickerSelectedCount');
        if (el) el.textContent = count;
    }

    function clearSelected() {
        var App = getApp();
        if (App && typeof App.clearSelected === 'function') {
            App.clearSelected();
        } else {
            if (App && App.selectedQuestions) App.selectedQuestions = [];
            _renderPickerList();
            _renderSelectedList();
            updateSelectedCount();
        }
    }

    // Category management
    function promptAddCategory(parentId) {
        var label = parentId ? 'Tên thư mục con:' : 'Tên thư mục mẹ mới:';
        var name = prompt(label);
        if (!name || typeof CategoryManager === 'undefined') return;
        var r = CategoryManager.add(name, parentId);
        if (global.App && global.App.toast) {
            if (r.success) {
                global.App.toast('✅ Đã tạo thư mục', 'success');
                renderPicker();
            } else {
                global.App.toast(r.error, 'error');
            }
        }
    }

    function editCategory(id) {
        if (typeof CategoryManager === 'undefined') return;
        var c = CategoryManager.getById(id);
        if (!c) return;
        var name = prompt('Sửa tên thư mục:', c.name);
        if (!name || name === c.name) return;
        var r = CategoryManager.rename(id, name);
        if (global.App && global.App.toast) {
            if (r.success) {
                global.App.toast('✅ Đã đổi tên', 'success');
                renderPicker();
            } else {
                global.App.toast(r.error, 'error');
            }
        }
    }

    function deleteCategory(id) {
        if (typeof CategoryManager === 'undefined') return;
        var c = CategoryManager.getById(id);
        if (!c) return;
        if (!confirm('Xóa thư mục "' + c.name + '"?')) return;
        var r = CategoryManager.remove(id);
        if (global.App && global.App.toast) {
            if (r.success) {
                if (_currentCategoryId === id) _currentCategoryId = '';
                global.App.toast('✅ Đã xóa thư mục', 'success');
                renderPicker();
            } else {
                global.App.toast(r.error, 'error');
            }
        }
    }

    // Export
    global.AdminPicker = {
        renderPicker: renderPicker,
        setPickerFilter: setPickerFilter,
        populatePickerCategoryFilter: populatePickerCategoryFilter,
        populateYearFilter: populateYearFilter,
        togglePickQuestion: togglePickQuestionDirect,
        togglePickQuestionDirect: togglePickQuestionDirect,
        clearSelected: clearSelected,
        getSelectedQuestions: function() {
            var App = getApp();
            return (App && App.selectedQuestions) ? App.selectedQuestions.slice() : [];
        },
        promptAddCategory: promptAddCategory,
        editCategory: editCategory,
        deleteCategory: deleteCategory,
        goToPickerPage: goToPickerPage,
        resetPickerPage: resetPickerPage
    };

})(typeof window !== 'undefined' ? window : globalThis);
