/**
 * admin-bank.js - Question Bank management
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

    // Pagination state
    var _bankCurrentPage = 1;
    var _bankPageSize = 25;
    var _bankTotalItems = 0;

    // Render question bank
    function renderBank() {
        var kw = (document.getElementById('bankSearch') || {}).value || '';
        var type = (document.getElementById('bankTypeFilter') || {}).value || '';
        var difficulty = (document.getElementById('bankDifficultyFilter') || {}).value || '';
        var categoryId = (document.getElementById('bankCategoryFilter') || {}).value || '';
        var blueprintFilter = (document.getElementById('bankBlueprintFilter') || {}).value || '';
        var year = (document.getElementById('bankYearFilter') || {}).value || '';

        var questions = [];
        if (typeof QuestionBank !== 'undefined' && QuestionBank.search) {
            questions = QuestionBank.search({ keyword: kw, type: type, difficulty: difficulty, categoryId: categoryId, year: year });
        }

        // Apply blueprint filter
        if (blueprintFilter === '__none__') {
            questions = questions.filter(function(q) { return !q.blueprintId; });
        } else if (blueprintFilter) {
            questions = questions.filter(function(q) { return q.blueprintId === blueprintFilter; });
        }

        var grid = document.getElementById('bankGrid');
        var countEl = document.getElementById('bankCount');
        var total = (typeof QuestionBank !== 'undefined' && QuestionBank.getAll) ? QuestionBank.getAll().length : 0;
        var filteredCount = questions.length;

        // [FIX] Log chi tiết để debug vấn đề race condition
        console.log(`[AdminBank.renderBank] Total: ${total} | Filtered: ${filteredCount} | source: bank-page`);
        if (total === 0) {
            console.warn('[AdminBank.renderBank] WARNING: Total is 0! Firebase may not be loaded yet — sẽ refresh khi nhận event questionBankSynced.');
        }

        if (countEl) {
            if (total === 0) {
                countEl.textContent = '⏳ Đang tải dữ liệu từ Firebase...';
            } else {
                var label = blueprintFilter ? (filteredCount + ' / ' + total + ' câu (lọc theo khung)') : (filteredCount + ' câu');
                countEl.textContent = label;
            }
        }

        // Render matrix stats
        if (global.App && global.App.renderBankMatrixStats) {
            global.App.renderBankMatrixStats();
        }

        if (!grid) return;

        if (questions.length === 0) {
            var msg = blueprintFilter
                ? '<p>Không có câu nào trong khung đang lọc. Hãy <b>bỏ filter</b> hoặc vào <b>"Quản lý khung đề"</b> để gán thêm câu.</p>'
                : '<p>Tạo câu hỏi mới hoặc thay đổi bộ lọc</p>';
            var bpBtn = blueprintFilter ? '<button type="button" class="btn btn-secondary" onclick="App.filterBankByBlueprint(\'\')">📁 Bỏ lọc khung</button>' : '';
            grid.innerHTML = '<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);"><div style="font-size:48px;">📭</div><h3>Chưa có câu hỏi phù hợp</h3>' + msg + '<div style="display:flex; gap:8px; justify-content:center; margin-top:12px;"><button type="button" class="btn btn-primary" onclick="App.navigateTo(\'create-question\')">➕ Tạo câu hỏi</button>' + bpBtn + '</div></div>';
            document.getElementById('bankPagination').innerHTML = '';
            return;
        }

        // Pagination
        _bankTotalItems = questions.length;
        var totalPages = Math.max(1, Math.ceil(_bankTotalItems / _bankPageSize));
        if (_bankCurrentPage > totalPages) _bankCurrentPage = totalPages;
        if (_bankCurrentPage < 1) _bankCurrentPage = 1;
        var startIdx = (_bankCurrentPage - 1) * _bankPageSize;
        var endIdx = Math.min(startIdx + _bankPageSize, _bankTotalItems);
        var pagedQuestions = questions.slice(startIdx, endIdx);

        var diffLabels = { 'Nhan biet': 'Nhận biết', 'Thong hieu': 'Thông hiểu', 'Van dung': 'Vận dụng', 'Van dung cao': 'VDC' };
        var diffColors = { 'Nhan biet': '#10B981', 'Thong hieu': '#3B82F6', 'Van dung': '#F59E0B', 'Van dung cao': '#EF4444' };

        var html = pagedQuestions.map(function(q, idx) {
            // [FIX] Dùng số thứ tự TOÀN CỤC (gồm cả trang trước) để khi chuyển trang
            // câu hỏi vẫn giữ số liên tục (ví dụ: trang 2 hiển thị 26-50 thay vì 1-25).
            var globalIdx = startIdx + idx;
            var t = (typeof QuestionTypes !== 'undefined' && QuestionTypes.getType) ? QuestionTypes.getType(q.type) : null;
            var body = '';
            try {
                if (typeof QuestionRenderer !== 'undefined' && QuestionRenderer.renderFullQuestion) {
                    body = QuestionRenderer.renderFullQuestion(q, globalIdx, null);
                } else {
                    var plain = q.content ? q.content.replace(/<[^>]*>/g, '') : '';
                    body = '<div class="qbank-fallback">' + safeEscape(plain) + '</div>';
                }
            } catch (e) {
                var plain = q.content ? q.content.replace(/<[^>]*>/g, '') : '';
                body = '<div class="qbank-fallback">' + safeEscape(plain) + '</div>';
            }

            var cat = null;
            if (q.categoryId && typeof CategoryManager !== 'undefined' && CategoryManager.getById) {
                cat = CategoryManager.getById(q.categoryId);
            }

            var bp = null;
            if (q.blueprintId && typeof ExamBuilder !== 'undefined' && ExamBuilder.getBlueprintById) {
                bp = ExamBuilder.getBlueprintById(q.blueprintId);
            }

            var blueprintBadge = '';
            if (bp) {
                blueprintBadge = '<span class="badge" title="Click để lọc theo khung này" onclick="App.filterBankByBlueprint(\'' + safeEscape(bp.id) + '\')" style="background: rgba(34,197,94,0.18); color: #4ADE80; font-size: 11px; cursor: pointer; padding: 4px 10px;">📁 ' + safeEscape(bp.name) + '</span>';
            }

            var catBadge = cat ? '<span class="badge" style="background:rgba(245,158,11,0.15); color:#FCD34D;">📁 ' + safeEscape(cat.name) + '</span>' : '';
            var topicBadge = q.topic ? '<span class="badge" style="background:rgba(139,92,246,0.15); color:#C4B5FD;">🏷️ ' + safeEscape(q.topic) + '</span>' : '';
            var yearBadge = q.year ? '<span class="badge" style="background:rgba(255,255,255,0.06); color:#9CA3AF;">\'' + String(q.year).slice(-2) + '</span>' : '';
            var diffBadge = q.difficulty ? '<span class="badge" style="background:' + (diffColors[q.difficulty] || '#666') + '; color:white;">' + (diffLabels[q.difficulty] || q.difficulty) + '</span>' : '';
            var displayIdBadge = q.displayId ? '<span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; font-family: monospace; font-size: 10px;">' + safeEscape(q.displayId) + '</span>' : '';
            var typeBadge = '<span class="badge badge-type ' + (q.type || '') + '">' + (t ? t.icon : '') + ' ' + (t ? t.shortLabel : (q.type || '')) + '</span>';
            var pointsBadge = '<span class="badge" style="background:rgba(255,255,255,0.08); color:#B8C5D6;">' + (q.points || 1) + 'đ</span>';
            var unlinkBtn = bp ? '<button type="button" class="btn-icon" onclick="App.unlinkQuestionFromBlueprint(\'' + q.id + '\')" title="Gỡ khỏi khung" style="background:none; border:1px solid rgba(74,222,128,0.4); color:#4ADE80; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:12px;">🔗 Gỡ</button>' : '';
            var videoLink = q.videoUrl ? '<div style="margin-top: 10px;"><a href="' + safeEscape(q.videoUrl) + '" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:rgba(239,68,68,0.15);color:#FCA5A5;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;">🎥 Xem video chữa bài</a></div>' : '';
            var imageInfo = q.image ? '<div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">🖼️ Hình ảnh/MathJax: <code>' + safeEscape(q.image.length > 80 ? q.image.slice(0, 80) + '…' : q.image) + '</code></div>' : '';

            return '<div class="qbank-row" data-id="' + safeEscape(q.id) + '">' +
                '<div class="qbank-row-meta" style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed var(--border);">' +
                    displayIdBadge + typeBadge + pointsBadge + diffBadge + blueprintBadge + catBadge + topicBadge + yearBadge +
                    '<span style="flex:1;"></span>' +
                    '<button type="button" class="btn-icon" onclick="App.editQuestion(\'' + q.id + '\')" title="Sửa" style="background:none; border:1px solid var(--card-border); border-radius:6px; padding:4px 8px; cursor:pointer; font-size:13px; color:var(--text-muted);">✏️ Sửa</button>' +
                    '<button type="button" class="btn-icon" onclick="App.duplicateQuestion(\'' + q.id + '\')" title="Nhân bản" style="background:none; border:1px solid var(--card-border); border-radius:6px; padding:4px 8px; cursor:pointer; font-size:13px; color:var(--text-muted);">📋 Nhân bản</button>' +
                    unlinkBtn +
                    '<button type="button" class="btn-icon" onclick="App.deleteQuestion(\'' + q.id + '\')" aria-label="Xóa câu hỏi" title="Xóa câu hỏi" style="background:none; border:1px solid #FCA5A5; color:#DC2626; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:13px;">🗑️</button>' +
                '</div>' +
                '<div class="qbank-row-body">' + body + '</div>' +
                videoLink + imageInfo +
            '</div>';
        }).join('');

        grid.innerHTML = html;

        // Render pagination controls
        renderBankPagination(_bankCurrentPage, totalPages, _bankTotalItems, startIdx + 1, endIdx);

        // Typeset math
        if (typeof QuestionRenderer !== 'undefined' && QuestionRenderer.typesetMath) {
            setTimeout(function() { QuestionRenderer.typesetMath(grid); }, 50);
        }
    }

    // Render pagination controls for bank
    function renderBankPagination(currentPage, totalPages, totalItems, startItem, endItem) {
        var container = document.getElementById('bankPagination');
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
        html += '<button class="pagination-btn" onclick="AdminBank.goToBankPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + '>‹ Trước</button>';

        // First page + ellipsis
        if (startPage > 1) {
            html += '<button class="pagination-btn" onclick="AdminBank.goToBankPage(1)">1</button>';
            if (startPage > 2) {
                html += '<span style="color:var(--text-muted);padding:0 4px;">...</span>';
            }
        }

        // Page numbers
        for (var i = startPage; i <= endPage; i++) {
            html += '<button class="pagination-btn ' + (i === currentPage ? 'active' : '') + '" onclick="AdminBank.goToBankPage(' + i + ')">' + i + '</button>';
        }

        // Last page + ellipsis
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<span style="color:var(--text-muted);padding:0 4px;">...</span>';
            }
            html += '<button class="pagination-btn" onclick="AdminBank.goToBankPage(' + totalPages + ')">' + totalPages + '</button>';
        }

        // Next button
        html += '<button class="pagination-btn" onclick="AdminBank.goToBankPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>Sau ›</button>';

        // Info
        html += '<span class="pagination-info">Hiển thị ' + startItem + '-' + endItem + ' / ' + totalItems + ' câu</span>';

        // Jump to page
        html += '<div class="pagination-jump"><input type="number" id="bankJumpPage" min="1" max="' + totalPages + '" value="' + currentPage + '" onkeypress="if(event.key===\'Enter\'){var p=parseInt(this.value);if(p>=1&&p<=' + totalPages + ')AdminBank.goToBankPage(p);}"><button onclick="var p=parseInt(document.getElementById(\'bankJumpPage\').value);if(p>=1&&p<=' + totalPages + ')AdminBank.goToBankPage(p);">Đến</button></div>';

        html += '</div>';
        container.innerHTML = html;
    }

    // Go to specific page
    function goToBankPage(page) {
        var totalPages = Math.max(1, Math.ceil(_bankTotalItems / _bankPageSize));
        if (page < 1 || page > totalPages) return;
        _bankCurrentPage = page;
        renderBank();
        var grid = document.getElementById('bankGrid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Reset page when filters change
    function resetBankPage() {
        _bankCurrentPage = 1;
    }

    // Populate filters
    function populateBankCategoryFilter() {
        var sel = document.getElementById('bankCategoryFilter');
        if (!sel) return;
        var cats = (typeof CategoryManager !== 'undefined' && CategoryManager.getAll) ? CategoryManager.getAll() : [];
        var type = (document.getElementById('bankTypeFilter') || {}).value || '';
        if (type) cats = cats.filter(function(c) { return !type || c.type === type; });
        sel.innerHTML = '<option value="">Tất cả danh mục</option>' + cats.map(function(c) {
            return '<option value="' + c.id + '">' + safeEscape(c.name) + '</option>';
        }).join('');
    }

    function populateBankYearFilter() {
        var sel = document.getElementById('bankYearFilter');
        if (!sel) return;
        var years = [];
        if (typeof QuestionBank !== 'undefined' && QuestionBank.getAll) {
            QuestionBank.getAll().forEach(function(q) {
                if (q.year && years.indexOf(q.year) < 0) years.push(q.year);
            });
        }
        years.sort(function(a, b) { return b - a; });
        sel.innerHTML = '<option value="">Tất cả năm</option>' + years.map(function(y) {
            return '<option value="' + y + '">' + y + '</option>';
        }).join('');
    }

    function populateBankBlueprintFilter() {
        var sel = document.getElementById('bankBlueprintFilter');
        if (!sel || typeof ExamBuilder === 'undefined' || !ExamBuilder.getBlueprints) return;
        var bps = ExamBuilder.getBlueprints();
        sel.innerHTML = '<option value="">Tất cả khung đề</option>' +
            '<option value="__none__">Chưa gán khung</option>' +
            bps.map(function(bp) {
                return '<option value="' + safeEscape(bp.id) + '">' + safeEscape(bp.name) + '</option>';
            }).join('');
    }

    // Bind filters
    function bindBankFilters() {
        var searchInput = document.getElementById('bankSearch');
        var typeFilter = document.getElementById('bankTypeFilter');
        var diffFilter = document.getElementById('bankDifficultyFilter');
        var catFilter = document.getElementById('bankCategoryFilter');
        var bpFilter = document.getElementById('bankBlueprintFilter');
        var yearFilter = document.getElementById('bankYearFilter');

        var debounce = function(fn, delay) {
            var timer;
            return function() {
                var args = arguments;
                var that = this;
                clearTimeout(timer);
                timer = setTimeout(function() { fn.apply(that, args); }, delay);
            };
        };

        var doRender = debounce(function() { resetBankPage(); renderBank(); }, 300);

        if (searchInput) searchInput.addEventListener('input', doRender);
        if (typeFilter) typeFilter.addEventListener('change', function() {
            resetBankPage();
            populateBankCategoryFilter();
            renderBank();
        });
        if (diffFilter) diffFilter.addEventListener('change', function() { resetBankPage(); renderBank(); });
        if (catFilter) catFilter.addEventListener('change', function() { resetBankPage(); renderBank(); });
        if (bpFilter) bpFilter.addEventListener('change', function() { resetBankPage(); renderBank(); });
        if (yearFilter) yearFilter.addEventListener('change', function() { resetBankPage(); renderBank(); });
    }

    // Filter by blueprint
    function filterBankByBlueprint(blueprintId) {
        resetBankPage();
        var sel = document.getElementById('bankBlueprintFilter');
        if (sel) sel.value = blueprintId;
        renderBank();
    }

    // Export
    global.AdminBank = {
        renderBank: renderBank,
        populateBankCategoryFilter: populateBankCategoryFilter,
        populateBankYearFilter: populateBankYearFilter,
        populateBankBlueprintFilter: populateBankBlueprintFilter,
        bindBankFilters: bindBankFilters,
        filterBankByBlueprint: filterBankByBlueprint,
        goToBankPage: goToBankPage,
        resetBankPage: resetBankPage
    };

    // [FIX] Lắng nghe event từ QuestionBank khi Firebase sync xong để refresh UI
    (function() {
        function handleQuestionBankSynced(e) {
            try {
                // Reset page về 1 để hiển thị từ đầu
                _bankCurrentPage = 1;
                renderBank();
            } catch (err) {
                console.warn('[AdminBank] renderBank after sync failed:', err);
            }
        }

        function handleQuestionBankSyncError(e) {
            console.warn('[AdminBank] questionBankSyncError:', (e && e.detail && e.detail.error) || 'unknown');
            // Vẫn render để hiển thị dữ liệu local (dù có thể 0)
            try { renderBank(); } catch (err) {
                console.error('[AdminBank] renderBank fallback failed:', err);
            }
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('questionBankSynced', handleQuestionBankSynced);
            window.addEventListener('questionBankSyncError', handleQuestionBankSyncError);
        }
    })();

})(typeof window !== 'undefined' ? window : globalThis);
