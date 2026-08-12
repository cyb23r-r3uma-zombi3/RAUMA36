/* ================================================================
   THI THỬ PAGE - Logic load + render + filter
   Trang Thi thử miễn phí (TSA / HSA) — đọc từ ExamBuilder (room=mock-exam)
   ================================================================ */

(function () {
    'use strict';

    var MockExams = {
        currentTab: 'tsa',
        _allMockExams: [],
        _bootstrapDone: false,

        // ---- Lấy đề thi từ localStorage + Firebase ----
        getAllMockExams: function() {
            var self = this;

            // 1. Đọc từ localStorage (ExamBuilder cache)
            var local = (typeof ExamBuilder !== 'undefined' && ExamBuilder.getAll)
                ? ExamBuilder.getAll()
                : (JSON.parse(localStorage.getItem('sky_exams') || '[]'));

            var fromLocal = local.filter(function(e) {
                var r = e.room || (ExamBuilder && ExamBuilder._inferRoomFromLegacy ? ExamBuilder._inferRoomFromLegacy(e) : null);
                // [FIX] Fallback cho exam cũ (chưa có room) — nhận diện qua category hoặc thiếu room mà type hsa/tsa
                // Mục đích: tránh trường hợp admin tạo đề cũ (chưa có field room) mà bị ẩn khỏi Thi thử.
                if (r === 'mock-exam') return true;
                var cat = String((e && e.category) || '').trim();
                if (cat === 'khung-de' || cat === 'hsa-de-thi-thu' || cat === 'mock-exam') return true;
                return false;
            });

            // 2. Đọc trực tiếp từ Firebase (đảm bảo user thấy đề ngay)
            var fromFb = [];
            var done = false;

            function filterMockExams(arr) {
                return arr.filter(function(e) {
                    var r = e.room || (ExamBuilder && ExamBuilder._inferRoomFromLegacy ? ExamBuilder._inferRoomFromLegacy(e) : null);
                    if (r === 'mock-exam') return true;
                    var cat = String((e && e.category) || '').trim();
                    if (cat === 'khung-de' || cat === 'hsa-de-thi-thu' || cat === 'mock-exam') return true;
                    return false;
                });
            }

            return new Promise(function(resolve) {
                try {
                    if (typeof firebase !== 'undefined' && firebase.database) {
                        var db = firebase.database();
                        db.ref('exams').once('value').then(function(snap) {
                            if (snap && snap.val()) {
                                Array.prototype.push.apply(fromFb, filterMockExams(Object.values(snap.val())));
                            }
                            return db.ref('phongluyen_exams').once('value');
                        }).then(function(snap2) {
                            if (snap2 && snap2.val()) {
                                var extras = filterMockExams(Object.values(snap2.val()));
                                extras.forEach(function(e) {
                                    if (!fromFb.some(function(f) { return f.id === e.id; })) {
                                        fromFb.push(e);
                                    }
                                });
                            }
                            finish();
                        }).catch(function() { finish(); });
                    } else {
                        finish();
                    }
                } catch(e) { finish(); }

                function finish() {
                    if (done) return;
                    done = true;

                    // 3. Merge: ưu tiên bản Firebase (mới hơn hoặc bổ sung)
                    var merged = new Map();
                    fromLocal.forEach(function(e) { merged.set(e.id, e); });
                    fromFb.forEach(function(e) {
                        var exist = merged.get(e.id);
                        if (!exist) {
                            merged.set(e.id, e);
                        } else if (new Date(e.updatedAt || 0) > new Date(exist.updatedAt || 0)) {
                            merged.set(e.id, e);
                        }
                    });

                    self._allMockExams = Array.from(merged.values());
                    resolve(self._allMockExams);
                }
            });
        },

        // ---- Render tab hiện tại ----
        renderTab: function(type) {
            this.currentTab = type;
            var grid = document.getElementById('thiThuGrid');
            var empty = document.getElementById('thiThuEmpty');
            var loading = document.getElementById('thiThuLoading');
            if (!grid) return;

            var filtered = this._allMockExams.filter(function(e) { return (e.type || 'tsa') === type; });

            if (filtered.length === 0) {
                grid.innerHTML = '';
                if (empty) empty.style.display = '';
                return;
            }
            if (empty) empty.style.display = 'none';

            filtered.sort(function(a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });

            var self = this;
            grid.innerHTML = filtered.map(function(exam) { return self._renderCard(exam); }).join('');
        },

        // ---- Card HTML ----
        _renderCard: function(exam) {
            var id = (exam.id || '').replace(/'/g, '&#39;');
            var name = this._escape(exam.name || 'Đề thi thử');
            var code = this._escape(exam.code || '');
            var qCount = (exam.questions && exam.questions.length) || exam.questionCount || 0;
            var time = exam.timeMinutes || 90;
            var points = exam.totalPoints || qCount;
            var typeBadge = exam.type === 'hsa' ? 'HSA' : 'TSA';
            var typeIcon = exam.type === 'hsa' ? 'lucide:brain' : 'lucide:target';
            var startUrl = this._buildStartUrl(exam);

            return '<div class="thi-thu-card" data-exam-id="' + id + '">' +
                '<div class="thi-thu-card-badge-wrap">' +
                    '<span class="thi-thu-card-badge">' +
                        '<iconify-icon icon="' + typeIcon + '"></iconify-icon>' +
                        typeBadge +
                    '</span>' +
                '</div>' +
                '<div class="thi-thu-card-content">' +
                    '<h3 class="thi-thu-card-title">' + name + '</h3>' +
                    (code ? '<div class="thi-thu-card-code">' + code + '</div>' : '') +
                    '<div class="thi-thu-card-meta">' +
                        '<div class="thi-thu-card-meta-item"><iconify-icon icon="lucide:hash"></iconify-icon><span class="meta-value">' + qCount + '</span> câu</div>' +
                        '<div class="thi-thu-card-meta-divider"></div>' +
                        '<div class="thi-thu-card-meta-item"><iconify-icon icon="lucide:clock"></iconify-icon><span class="meta-value">' + time + '</span> phút</div>' +
                        '<div class="thi-thu-card-meta-divider"></div>' +
                        '<div class="thi-thu-card-meta-item"><iconify-icon icon="lucide:star"></iconify-icon><span class="meta-value">' + points + '</span> điểm</div>' +
                        '<div class="thi-thu-card-meta-divider"></div>' +
                        '<div class="thi-thu-card-meta-item free-badge"><iconify-icon icon="lucide:gift"></iconify-icon><span class="meta-value">Miễn phí</span></div>' +
                    '</div>' +
                '</div>' +
                '<a class="thi-thu-card-action" href="' + startUrl + '">' +
                    '<span>Vào thi</span>' +
                    '<iconify-icon icon="lucide:arrow-right"></iconify-icon>' +
                '</a>' +
            '</div>';
        },

        _buildStartUrl: function(exam) {
            var id = encodeURIComponent(exam.id || '');
            var type = exam.type || 'tsa';
            var base = type === 'hsa' ? '../phong-luyen-hsa/exam.html' : '../phong-luyen-tsa/exam.html';
            var sep = base.indexOf('?') >= 0 ? '&' : '?';
            return base + sep + 'examId=' + id + '&type=thi-thu&examType=' + type + '&from=thithu';
        },

        // ---- Bootstrap: migration + load đề ----
        bootstrap: function() {
            var self = this;
            var loading = document.getElementById('thiThuLoading');
            var grid = document.getElementById('thiThuGrid');
            var empty = document.getElementById('thiThuEmpty');

            if (loading) loading.style.display = '';
            if (grid) grid.innerHTML = '';
            if (empty) empty.style.display = 'none';

            // Migration room flag (1 lần)
            try {
                if (typeof ExamBuilder !== 'undefined' && ExamBuilder.migrateRoomFlags) {
                    ExamBuilder.migrateRoomFlags();
                }
            } catch(e) {
                console.warn('[thi-thu] migrateRoomFlags failed (non-fatal):', e);
            }

            this.getAllMockExams().then(function() {
                if (loading) loading.style.display = 'none';
                self.renderTab(self.currentTab);
                self._bootstrapDone = true;
            }).catch(function(err) {
                console.error('[ThiThu] bootstrap lỗi:', err);
                if (loading) loading.style.display = 'none';
                self.renderTab(self.currentTab);
                self._bootstrapDone = true;
            });
        },

        // ---- Merge thêm đề từ event, re-render nếu cần ----
        _mergeAndRender: function(exams) {
            if (!Array.isArray(exams)) return;
            var self = this;
            var changed = false;
            exams.forEach(function(ex) {
                var r = ex.room || (ExamBuilder && ExamBuilder._inferRoomFromLegacy ? ExamBuilder._inferRoomFromLegacy(ex) : null);
                // [FIX] Fallback tương tự getAllMockExams — nhận cả đề legacy qua category
                if (r !== 'mock-exam') {
                    var cat = String((ex && ex.category) || '').trim();
                    if (cat !== 'khung-de' && cat !== 'hsa-de-thi-thu' && cat !== 'mock-exam') return;
                }
                var existing = null;
                self._allMockExams.forEach(function(e) { if (e.id === ex.id) existing = e; });
                if (!existing) {
                    self._allMockExams.push(ex);
                    changed = true;
                } else if (new Date(ex.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                    Object.keys(ex).forEach(function(k) { existing[k] = ex[k]; });
                    changed = true;
                }
            });
            if (changed && this._bootstrapDone) {
                this.renderTab(this.currentTab);
            }
        },

        _escape: function(s) {
            return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        },

        // ---- Init: gắn sự kiện + bootstrap ----
        init: function() {
            var self = this;

            // examsSynced: sau khi ExamBuilder.getAll() sync Firebase xong
            window.addEventListener('examsSynced', function(e) {
                if (e && e.detail && Array.isArray(e.detail)) {
                    self._mergeAndRender(e.detail);
                }
            });

            // examsUpdated: từ ExamSync realtime listener (ExamBuilder)
            window.addEventListener('examsUpdated', function(e) {
                if (e && e.detail && e.detail.exams && Array.isArray(e.detail.exams)) {
                    self._mergeAndRender(e.detail.exams);
                }
            });

            // blueprintAdded: admin tạo đề mới → refresh toàn bộ
            window.addEventListener('blueprintAdded', function() {
                self.getAllMockExams().then(function() {
                    self.renderTab(self.currentTab);
                });
            });

            // Cross-tab storage: đề được tạo/sửa trên tab khác
            window.addEventListener('storage', function(e) {
                if (e.key === 'sky_exams' || e.key === 'exams') {
                    try {
                        var exams = JSON.parse(e.newValue || '[]');
                        if (Array.isArray(exams) && exams.length > 0) {
                            self._mergeAndRender(exams);
                        }
                    } catch(err) {
                        console.warn('[thi-thu] Failed to parse cross-tab storage event:', err);
                    }
                }
            });

            // Tab click
            var tabs = document.querySelectorAll('.thi-thu-tab');
            tabs.forEach(function(tab) {
                tab.addEventListener('click', function() {
                    tabs.forEach(function(t) {
                        t.classList.remove('active');
                        t.setAttribute('aria-selected', 'false');
                    });
                    tab.classList.add('active');
                    tab.setAttribute('aria-selected', 'true');
                    self.renderTab(tab.dataset.tab);
                });
            });

            this.bootstrap();
        }
    };

    window.MockExams = MockExams;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { MockExams.init(); });
    } else {
        setTimeout(function() { MockExams.init(); }, 50);
    }
})();
