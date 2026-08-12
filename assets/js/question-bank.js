/* ================================================================
   QUESTION BANK MANAGER - Quản lý CRUD kho câu hỏi
   Tác giả: SKY EDU Team
   Phiên bản: 1.0.0
   Mô tả: Module quản lý thêm/sửa/xóa/sao chép câu hỏi.
           Đồng bộ giữa localStorage (cache) và Firebase (persistent).
   ================================================================ */

(function (global) {
    'use strict';

    const STORAGE_KEY = 'sky_question_bank';
    const FIREBASE_PATH = 'questionBank';
    const CATEGORY_STORAGE_KEY = 'sky_question_categories';
    const CATEGORY_FIREBASE_PATH = 'questionCategories';

    /* ================================================================
       13 CHUYÊN ĐỀ TSA — dùng chung
       ================================================================ */
    const _TOPIC_KEYS = (typeof TSA_TOPICS !== 'undefined')
        ? TSA_TOPICS.map(t => t.key)
        : [
            'bat-pt','thong-ke','so-hoc','hh-phang','gioi-han','cap-so',
            'logarit','luong-giac','to-hop','ham-so','nguyen-ham','vector','hh-khong-gian'
        ];
    const _TOPIC_TITLES = {};
    if (typeof TsaTopics !== 'undefined') {
        TsaTopics.TSA_TOPICS.forEach(t => { _TOPIC_TITLES[t.key] = t.title; });
    }
    if (Object.keys(_TOPIC_TITLES).length === 0) {
        // Fallback nếu TsaTopics chưa load
        _TOPIC_TITLES['bat-pt'] = 'Bất phương trình và quy hoạch tuyến tính';
        _TOPIC_TITLES['thong-ke'] = 'Thống kê';
        _TOPIC_TITLES['so-hoc'] = 'Số học';
        _TOPIC_TITLES['hh-phang'] = 'Hình học phẳng và 3 đường conic';
        _TOPIC_TITLES['gioi-han'] = 'Giới hạn và tính liên tục của hàm số';
        _TOPIC_TITLES['cap-so'] = 'Cấp số, dãy số và hệ thức truy hồi';
        _TOPIC_TITLES['logarit'] = 'Hàm số logarit, hàm lũy thừa và hàm số mũ';
        _TOPIC_TITLES['luong-giac'] = 'Phương trình lượng giác';
        _TOPIC_TITLES['to-hop'] = 'Tổ hợp – Xác suất cổ điển – Xác suất có điều kiện';
        _TOPIC_TITLES['ham-so'] = 'Hàm số, đồ thị hàm số và đạo hàm';
        _TOPIC_TITLES['nguyen-ham'] = 'Nguyên hàm & Tích phân';
        _TOPIC_TITLES['vector'] = 'Vector & Hình học không gian có tọa độ';
        _TOPIC_TITLES['hh-khong-gian'] = 'Hình học không gian thuần túy';
    }
    /** Bộ mức độ chuẩn */
    const _DIFFICULTY_KEYS = (typeof DIFFICULTY_LEVELS !== 'undefined')
        ? DIFFICULTY_LEVELS.map(d => d.key)
        : ['Nhan biet','Thong hieu','Van dung','Van dung cao'];

    /** Lấy tiêu đề chuyên đề theo key (dùng cho categoryId lẫn `topic` cũ) */
    function _topicTitle(key) {
        return _TOPIC_TITLES[key] || key || '';
    }

    /**
     * Lấy danh sách "category" hiển thị trong dropdown kho câu hỏi.
     * Trả về 13 chuyên đề TSA dưới dạng:
     *   [{ id: 'bat-pt', name: 'Bất phương trình...', source: 'tsa' }, ...]
     * (legacy: vẫn merge thêm CategoryManager nếu có custom folder).
     */
    function listTsaTopicCategories() {
        const arr = _TOPIC_KEYS.map(k => ({ id: k, name: _topicTitle(k), source: 'tsa' }));
        // Merge thêm các category custom (CategoryManager) — KHÔNG trùng key với 13 chuyên đề
        try {
            const customs = _readCategories();
            customs.forEach(c => {
                if (!arr.some(x => x.id === c.id) && !_TOPIC_KEYS.includes(c.id)) {
                    arr.push({ id: c.id, name: c.name, source: 'custom' });
                }
            });
        } catch (e) {
            console.error('[QuestionBank] Failed to merge topic categories:', e);
        }
        return arr;
    }

    function _readCategories() {
        try {
            const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            console.error('[QuestionBank._readCategories] Failed to parse cached categories:', e);
            return [];
        }
    }

    /* ================================================================
       CATEGORY MANAGER - Thư mục mẹ / con cho kho câu hỏi
       ================================================================ */
    const CategoryManager = {
        _readLocal() {
            try {
                const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
                if (!raw) return this._seed();
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : this._seed();
            } catch (e) {
                console.error('[Category] Lỗi đọc:', e);
                return [];
            }
        },
        _writeLocal(arr) {
            try { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(arr)); }
            catch (e) { console.error('[Category] Lỗi ghi:', e); }
        },
        _seed() {
            // Không seed mặc định - người dùng tự tạo thư mục/chủ đề
            this._writeLocal([]);
            return [];
        },
        getAll() { return this._readLocal(); },
        getTree() { return this._readLocal().map(c => ({ ...c, children: [] })); },
        getById(id) { return this._readLocal().find(c => c.id === id) || null; },
        add(name, parentId) {
            name = (name || '').trim();
            if (!name) return { success: false, error: 'Tên thư mục không được trống' };
            const all = this._readLocal();
            // Tránh trùng tên
            if (all.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                return { success: false, error: 'Tên thư mục đã tồn tại' };
            }
            const id = 'cat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
            const cat = { id, name, parentId: null };
            all.push(cat);
            this._writeLocal(all);
            this._syncToFirebase();
            return { success: true, category: cat };
        },
        rename(id, newName) {
            newName = (newName || '').trim();
            if (!newName) return { success: false, error: 'Tên không được trống' };
            const all = this._readLocal();
            const c = all.find(c => c.id === id);
            if (!c) return { success: false, error: 'Không tìm thấy thư mục' };
            c.name = newName;
            this._writeLocal(all);
            this._syncToFirebase();
            return { success: true };
        },
        remove(id) {
            const all = this._readLocal();
            // Không cho xóa nếu còn câu hỏi
            const bank = _readLocal();
            const hasQ = bank.some(q => q.categoryId === id);
            if (hasQ) return { success: false, error: 'Thư mục còn chứa câu hỏi' };
            const idx = all.findIndex(c => c.id === id);
            if (idx < 0) return { success: false, error: 'Không tìm thấy' };
            all.splice(idx, 1);
            this._writeLocal(all);
            this._syncToFirebase();
            return { success: true };
        },
        getPath(id) {
            if (!id) return [];
            const all = this._readLocal();
            const path = [];
            let cur = all.find(c => c.id === id);
            while (cur) {
                path.unshift(cur.name);
                cur = cur.parentId ? all.find(c => c.id === cur.parentId) : null;
            }
            return path;
        },
        getPathString(id) { return this.getPath(id).join(' / '); },
        _syncToFirebase() {
            if (!_isFirebaseReady()) return;
            const db = _fb();
            db.ref(CATEGORY_FIREBASE_PATH).set(this._readLocal()).catch(err => console.warn('[Category] Firebase sync:', err));
        },
        syncFromFirebase() {
            if (!_isFirebaseReady()) return Promise.resolve([]);
            const db = _fb();
            return db.ref(CATEGORY_FIREBASE_PATH).once('value')
                .then(snap => {
                    const data = snap.val();
                    if (Array.isArray(data) && data.length) {
                        this._writeLocal(data);
                    }
                    return this._readLocal();
                });
        }
    };
    global.CategoryManager = CategoryManager;

    /* ================================================================
       LOCAL STORAGE HELPERS
       ================================================================ */

    function _generateId() {
        return 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    const CACHE_VERSION = 2; // [FIX] Tăng để invalidate cache cũ
    const CACHE_VERSION_KEY = 'sky_question_bank_version';

    function _readLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                console.log('[QuestionBank] Cache empty');
                return [];
            }
            const data = JSON.parse(raw);
            const count = Array.isArray(data) ? data.length : 0;
            console.log(`[QuestionBank] Cache loaded: ${count} questions`);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.error(`[QuestionBank] localStorage read error (${e.name}):`, e.message);
            return [];
        }
    }

    function _writeLocal(bank) {
        try {
            const json = JSON.stringify(bank);
            localStorage.setItem(STORAGE_KEY, json);
            // [FIX] Lưu cache version để detect cache cũ
            try { localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION)); } catch (e) {
                console.warn('[QuestionBank] Failed to write CACHE_VERSION_KEY (non-fatal):', e);
            }
            const sizeKB = Math.round(json.length / 1024);
            console.log(`[QuestionBank] Cache saved: ${bank.length} questions (${sizeKB}KB)`);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.error('[QuestionBank] localStorage quota exceeded! Clearing old cache...');
                try {
                    localStorage.clear();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
                    try { localStorage.setItem(CACHE_VERSION_KEY, String(CACHE_VERSION)); } catch (e2) {
                        console.warn('[QuestionBank] Failed to write CACHE_VERSION_KEY after clear (non-fatal):', e2);
                    }
                    console.log('[QuestionBank] Retry after clear: success');
                } catch (retry) {
                    console.error('[QuestionBank] Retry after clear: failed', retry.name, retry.message);
                }
            } else {
                console.error(`[QuestionBank] localStorage write error (${e.name}):`, e.message);
            }
        }
    }

    /**
     * [FIX] Kiểm tra version cache - nếu cache là version cũ, xóa và force reload
     */
    function _isCacheValid() {
        try {
            const v = localStorage.getItem(CACHE_VERSION_KEY);
            if (v === null) return true; // Chưa có version flag = cache cũ nhưng vẫn dùng được tạm
            return parseInt(v, 10) >= CACHE_VERSION;
        } catch (e) {
            return true;
        }
    }

    function _invalidateCache() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.warn('[QuestionBank] Cache invalidated');
        } catch (e) {
            console.warn('[QuestionBank] Failed to invalidate cache:', e);
        }
    }

    // Hàm hỗ trợ validate - dùng QuestionTypes nếu có sẵn (browser), fallback nếu chạy Node
    function _validate(q) {
        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.validate) {
            return QuestionTypes.validate(q);
        }
        return null; // Fallback: chấp nhận nếu không có QuestionTypes
    }

    /* ================================================================
       FIREBASE HELPERS
       ================================================================ */

    function _isFirebaseReady() {
        return typeof firebase !== 'undefined' && firebase.database && typeof firebase.database === 'function';
    }

    function _fb() {
        return _isFirebaseReady() ? firebase.database() : null;
    }

    function _doSaveToFirebase(question) {
        if (!_isFirebaseReady()) return Promise.resolve(null);
        const db = _fb();
        return db.ref(`${FIREBASE_PATH}/${question.id}`).set(question)
            .then(() => question)
            .catch(err => {
                console.warn('[QuestionBank] Firebase save error:', err);
                return null;
            });
    }

    function _saveToFirebase(question) {
        if (typeof saveQueue !== 'undefined') {
            return saveQueue.enqueue('question_' + question.id, () => _doSaveToFirebase(question));
        }
        return _doSaveToFirebase(question);
    }

    /**
     * [SYNC] Ghi Firebase với retry mechanism
     * Đảm bảo dữ liệu được ghi thành công hoặc báo lỗi rõ ràng
     */
    function _saveToFirebaseWithRetry(question, maxRetries = 3) {
        return new Promise((resolve, reject) => {
            if (!_isFirebaseReady()) {
                reject(new Error('Firebase not ready'));
                return;
            }
            
            const db = _fb();
            const ref = db.ref(`${FIREBASE_PATH}/${question.id}`);
            let attempt = 0;
            
            const attemptWrite = () => {
                attempt++;
                ref.set(question)
                    .then(() => {
                        console.log(`[QuestionBank] Firebase write success (attempt ${attempt}):`, question.id);
                        resolve(question);
                    })
                    .catch((error) => {
                        console.warn(`[QuestionBank] Firebase write attempt ${attempt}/${maxRetries} failed:`, error.code, error.message);
                        if (attempt < maxRetries) {
                            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                            console.log(`[QuestionBank] Retrying in ${delay}ms...`);
                            if (typeof timerManager !== 'undefined') timerManager.setTimeout(attemptWrite, delay, 'qb-write-retry');
                            else setTimeout(attemptWrite, delay);
                        } else {
                            console.error(`[QuestionBank] Firebase write FAILED after ${maxRetries} attempts:`, question.id);
                            reject(error);
                        }
                    });
            };
            
            attemptWrite();
        });
    }

    function _deleteFromFirebase(questionId) {
        if (!_isFirebaseReady()) return Promise.resolve(null);
        const db = _fb();
        return db.ref(`${FIREBASE_PATH}/${questionId}`).remove()
            .catch(err => console.warn('[QuestionBank] Firebase delete error:', err));
    }

    function _loadFromFirebase() {
        if (!_isFirebaseReady()) return Promise.resolve([]);
        const db = _fb();
        return db.ref(FIREBASE_PATH).once('value')
            .then(snap => {
                const data = snap.val() || {};
                return Object.values(data);
            })
            .catch(err => {
                console.warn('[QuestionBank] Firebase load error:', err);
                return [];
            });
    }

    /**
     * [FIX] Sync từ Firebase với logging chi tiết.
     * Merge: Firebase làm base, local bổ sung những ID không có trong Firebase.
     * Phát event 'questionBankSynced' để UI cập nhật khi hoàn tất.
     */
    async function _syncFromFirebaseWithLogging() {
        try {
            console.log('[QuestionBank.Sync] Starting Firebase sync...');
            const fbBank = await _loadFromFirebase();
            const localBank = _readLocal();

            const fbCount = (fbBank || []).length;
            const localCount = localBank.length;

            console.log(`[QuestionBank.Sync] Firebase: ${fbCount} | Local: ${localCount}`);

            if (!fbBank || fbCount === 0) {
                console.warn('[QuestionBank.Sync] Firebase returned empty, keeping local cache');
                // Vẫn phát event để UI biết sync đã chạy (và cache có gì hiển thị gì)
                window.dispatchEvent(new CustomEvent('questionBankSynced', {
                    detail: {
                        questions: localBank,
                        counts: { firebase: 0, local: localCount, merged: localCount },
                        source: 'empty-firebase'
                    }
                }));
                return localBank;
            }

            // Merge: Firebase làm base
            const merged = new Map();
            fbBank.forEach(q => merged.set(q.id, q));

            // Local bổ sung những cái Firebase không có
            localBank.forEach(q => {
                if (!merged.has(q.id)) {
                    merged.set(q.id, q);
                }
            });

            const mergedArray = Array.from(merged.values());
            const mergedCount = mergedArray.length;

            console.log(`[QuestionBank.Sync] After merge: ${mergedCount}`);

            // Ghi cache
            _writeLocal(mergedArray);
            console.log('[QuestionBank.Sync] Cache updated successfully');

            // [FIX] Phát event để UI refresh (Admin Bank, Dashboard, ...)
            window.dispatchEvent(new CustomEvent('questionBankSynced', {
                detail: {
                    questions: mergedArray,
                    counts: { firebase: fbCount, local: localCount, merged: mergedCount },
                    source: 'firebase'
                }
            }));
            console.log('[QuestionBank.Sync] Event dispatched: questionBankSynced');

            return mergedArray;
        } catch (error) {
            console.error('[QuestionBank.Sync] Fatal error:', error);
            // Phát event error để UI biết
            window.dispatchEvent(new CustomEvent('questionBankSyncError', {
                detail: { error: error.message }
            }));
            throw error;
        }
    }

    /* ================================================================
       PUBLIC API
       ================================================================ */

    const QuestionBank = {
        STORAGE_KEY,
        FIREBASE_PATH,

        /** Lấy toàn bộ câu hỏi trong kho — đọc localStorage (cache), sync Firebase nền */
        getAll() {
            const local = _readLocal();

            // [FIX] Trigger background sync nếu Firebase ready — chỉ 1 lần
            if (_isFirebaseReady() && !window._QuestionBank_syncInitiated) {
                window._QuestionBank_syncInitiated = true;
                _syncFromFirebaseWithLogging().catch(err => {
                    console.error('[QuestionBank.getAll] Sync error:', err.message);
                });
            }

            return local;
        },

        /** [FIX] Sync từ Firebase với logging chi tiết — gọi từ getAll() và QuestionBankSync.init() */
        async _syncFromFirebaseWithLogging() {
            return _syncFromFirebaseWithLogging();
        },

        /** Lấy một câu hỏi theo ID */
        getById(id) {
            return _readLocal().find(q => q.id === id) || null;
        },

        /** Lấy danh sách câu hỏi theo loại */
        getByType(typeKey) {
            return _readLocal().filter(q => q.type === typeKey);
        },

        /** Tìm kiếm câu hỏi */
        search(opts = {}) {
            let bank = _readLocal();
            const { keyword = '', type = '', tags = [], categoryId = '', difficulty = '', topic = '', year = '', createdBy = '', difficulties = [], categoryIds = [], blueprintId = '', noBlueprint = false } = opts;

            if (type) bank = bank.filter(q => q.type === type);
            if (categoryId) bank = bank.filter(q => q.categoryId === categoryId);
            if (Array.isArray(categoryIds) && categoryIds.length) {
                bank = bank.filter(q => categoryIds.includes(q.categoryId));
            }
            if (difficulty) bank = bank.filter(q => q.difficulty === difficulty);
            if (Array.isArray(difficulties) && difficulties.length) {
                bank = bank.filter(q => difficulties.includes(q.difficulty));
            }
            if (topic) bank = bank.filter(q => q.topic === topic);
            if (year) bank = bank.filter(q => String(q.year) === String(year));
            if (createdBy) bank = bank.filter(q => (q.createdBy || '').toLowerCase().includes(createdBy.toLowerCase()));
            if (blueprintId) bank = bank.filter(q => q.blueprintId === blueprintId);
            if (noBlueprint) bank = bank.filter(q => !q.blueprintId);

            if (keyword) {
                const kw = keyword.toLowerCase();
                bank = bank.filter(q => {
                    const content = (q.content || '').toLowerCase();
                    const exp = (q.explanation || '').replace(/<[^>]*>/g, '').toLowerCase();
                    const options = (q.options || []).join(' ').toLowerCase();
                    const dispId = (q.displayId || '').toLowerCase();
                    const topicText = (q.topic || '').toLowerCase();
                    const qTags = (q.tags || []).join(' ').toLowerCase();
                    return content.includes(kw) || exp.includes(kw) || options.includes(kw)
                        || dispId.includes(kw) || topicText.includes(kw) || qTags.includes(kw);
                });
            }

            if (tags && tags.length) {
                bank = bank.filter(q => {
                    const qTags = q.tags || [];
                    return tags.some(t => qTags.includes(t));
                });
            }

            return bank;
        },

        /** Lấy danh sách các mức độ có trong ngân hàng */
        getDifficulties() {
            const set = new Set();
            _readLocal().forEach(q => { if (q.difficulty) set.add(q.difficulty); });
            return Array.from(set);
        },

        /** Danh sách đầy đủ 4 mức độ chuẩn (kèm label, color) */
        getDifficultyLevels() {
            if (typeof DIFFICULTY_LEVELS !== 'undefined') return DIFFICULTY_LEVELS;
            return [
                { key: 'Nhan biet',    short: 'NB',  label: 'Nhận biết',    color: '#10B981' },
                { key: 'Thong hieu',   short: 'TH',  label: 'Thông hiểu',   color: '#3B82F6' },
                { key: 'Van dung',     short: 'VD',  label: 'Vận dụng',     color: '#F59E0B' },
                { key: 'Van dung cao', short: 'VDC', label: 'Vận dụng cao', color: '#EF4444' }
            ];
        },

        /** Lấy danh sách các chủ đề (13 chuyên đề TSA + custom) có trong ngân hàng */
        getCategories() {
            return listTsaTopicCategories();
        },

        /** Lấy danh sách 13 chuyên đề TSA cố định */
        getTsaTopics() {
            return (typeof TSA_TOPICS !== 'undefined') ? TSA_TOPICS : _TOPIC_KEYS.map(k => ({ key: k, title: _topicTitle(k) }));
        },

        /** Lấy danh sách các chủ đề con có trong ngân hàng */
        getTopics() {
            const set = new Set();
            _readLocal().forEach(q => { if (q.topic) set.add(q.topic); });
            return Array.from(set);
        },

        /** Lấy danh sách blueprint (proxy sang ExamBuilder nếu có) */
        getBlueprints() {
            if (typeof ExamBuilder !== 'undefined' && ExamBuilder.getBlueprints) {
                return ExamBuilder.getBlueprints();
            }
            // Fallback: đọc localStorage nếu ExamBuilder chưa load
            try {
                const raw = localStorage.getItem('sky_exam_blueprints');
                const arr = raw ? JSON.parse(raw) : [];
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                console.error('[QuestionBank] Failed to read sky_exam_blueprints from localStorage:', e);
                return [];
            }
        },

        /** Lấy danh sách câu hỏi đã được gán vào 1 blueprint cụ thể */
        getByBlueprint(blueprintId) {
            if (!blueprintId) return [];
            return _readLocal().filter(q => q.blueprintId === blueprintId);
        },

        /** Đếm số câu hỏi đã gán vào từng slot của blueprint (key = categoryKey+difficulty) */
        countByBlueprint(blueprintId) {
            if (!blueprintId) return {};
            const counts = {};
            _readLocal().forEach(q => {
                if (q.blueprintId !== blueprintId) return;
                const k = (q.categoryId || '') + '|' + (q.difficulty || '');
                counts[k] = (counts[k] || 0) + 1;
            });
            return counts;
        },

        /** Xoá blueprintId khỏi tất cả câu hỏi (khi blueprint bị xoá) */
        unlinkBlueprint(blueprintId) {
            if (!blueprintId) return 0;
            const bank = _readLocal();
            // [FIX P1-10] Chỉ thu thập các câu BỊ ẢNH HƯỞNG (không quét toàn bộ)
            const affected = [];
            for (let i = 0; i < bank.length; i++) {
                const q = bank[i];
                if (q && q.blueprintId === blueprintId) {
                    delete q.blueprintId;
                    q.updatedAt = new Date().toISOString();
                    affected.push(q);
                }
            }
            if (affected.length === 0) return 0;
            // Ghi lại local (chỉ 1 lần)
            _writeLocal(bank);
            // [FIX P1-10] Đồng bộ Firebase CHỈ các câu bị ảnh hưởng, dùng batch update
            if (_isFirebaseReady()) {
                const db = _fb();
                const updates = {};
                affected.forEach(q => {
                    // Đặt lại blueprintId = null trong Firebase
                    updates[`${FIREBASE_PATH}/${q.id}/blueprintId`] = null;
                    updates[`${FIREBASE_PATH}/${q.id}/updatedAt`] = q.updatedAt;
                });
                db.ref().update(updates).catch(err =>
                    console.warn('[QuestionBank.unlinkBlueprint] batch update failed:', err));
            }
            return affected.length;
        },

        /** Lấy danh sách năm */
        getYears() {
            const set = new Set();
            _readLocal().forEach(q => { if (q.year) set.add(q.year); });
            return Array.from(set).sort((a, b) => b - a);
        },

        /** Lưu (thêm mới hoặc cập nhật) một câu hỏi */
        save(question, options = {}) {
            const { skipFirebase = false } = options;
            
            if (!question.id) {
                question.id = _generateId();
                question.createdAt = new Date().toISOString();
                // Tự sinh displayId dạng Q-YYMM-NNNN nếu chưa có
                if (!question.displayId) {
                    const d = new Date();
                    const yy = String(d.getFullYear()).slice(-2);
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const rand = Math.floor(Math.random() * 9000 + 1000);
                    question.displayId = `Q-${yy}${mm}-${rand}`;
                }
                if (!question.year) question.year = new Date().getFullYear();
                if (!question.createdBy && typeof Auth !== 'undefined' && Auth.currentUser) {
                    question.createdBy = Auth.currentUser.name || Auth.currentUser.email || 'admin';
                } else if (!question.createdBy) {
                    question.createdBy = 'admin';
                }
            }
            question.updatedAt = new Date().toISOString();

            // Tự động đồng bộ `topic` ← title của 13 chuyên đề (nếu categoryId là 1 trong 13 key)
            if (question.categoryId && _TOPIC_TITLES[question.categoryId] && !question.topic) {
                question.topic = _TOPIC_TITLES[question.categoryId];
            }

            // Validate
            const err = _validate(question);
            if (err) {
                return { success: false, error: err };
            }

            // Cập nhật localStorage NGAY để UI phản hồi nhanh
            const bank = _readLocal();
            const idx = bank.findIndex(q => q.id === question.id);
            if (idx >= 0) {
                bank[idx] = { ...bank[idx], ...question };
            } else {
                bank.push(question);
            }
            _writeLocal(bank);

            // [SYNC] Ghi Firebase với RETRY - đây là SINGLE SOURCE OF TRUTH
            if (_isFirebaseReady() && !skipFirebase) {
                return _saveToFirebaseWithRetry(question).then(() => {
                    console.log('[QuestionBank] Saved to Firebase:', question.id);
                    return { success: true, question };
                }).catch((error) => {
                    console.error('[QuestionBank] Firebase save failed after retries:', error);
                    // Vẫn return success vì đã lưu local
                    return { success: true, question, warning: 'Firebase sync pending: ' + error.message };
                });
            } else {
                console.warn('[QuestionBank] Firebase not ready, saved locally only');
                return Promise.resolve({ success: true, question, warning: 'Firebase offline - saved locally' });
            }
        },

        /** Xóa câu hỏi */
        remove(id) {
            const bank = _readLocal();
            const idx = bank.findIndex(q => q.id === id);
            if (idx < 0) return { success: false, error: 'Không tìm thấy câu hỏi' };
            bank.splice(idx, 1);
            _writeLocal(bank);
            _deleteFromFirebase(id);
            return { success: true };
        },

        /** Xóa nhiều câu hỏi */
        removeMany(ids) {
            const bank = _readLocal();
            const idSet = new Set(ids);
            const newBank = bank.filter(q => !idSet.has(q.id));
            _writeLocal(newBank);
            ids.forEach(id => _deleteFromFirebase(id));
            return { success: true, removed: bank.length - newBank.length };
        },

        /** Nhân bản câu hỏi */
        duplicate(id) {
            const original = this.getById(id);
            if (!original) return { success: false, error: 'Không tìm thấy câu hỏi' };
            const copy = JSON.parse(JSON.stringify(original));
            copy.id = _generateId();
            copy.content = '[BẢN SAO] ' + (copy.content || '');
            copy.createdAt = new Date().toISOString();
            copy.updatedAt = new Date().toISOString();
            const bank = _readLocal();
            bank.push(copy);
            _writeLocal(bank);
            _saveToFirebase(copy);
            return { success: true, question: copy };
        },

        /** Import nhiều câu hỏi cùng lúc */
        bulkSave(questions) {
            const bank = _readLocal();
            const saved = [];
            const errors = [];

            questions.forEach(q => {
                const err = _validate(q);
                if (err) {
                    errors.push({ question: q, error: err });
                } else {
                    if (!q.id) {
                        q.id = _generateId();
                        q.createdAt = new Date().toISOString();
                    }
                    q.updatedAt = new Date().toISOString();
                    bank.push(q);
                    saved.push(q);
                }
            });
            _writeLocal(bank);
            saved.forEach(q => _saveToFirebase(q));
            return { success: true, saved, errors };
        },

        /** Đồng bộ từ Firebase về local */
        syncFromFirebase() {
            return _loadFromFirebase().then(fbBank => {
                if (fbBank.length > 0) {
                    // Merge: giữ local có updatedAt mới hơn
                    const local = _readLocal();
                    const merged = new Map();
                    fbBank.forEach(q => merged.set(q.id, q));
                    local.forEach(q => {
                        if (!merged.has(q.id) || new Date(q.updatedAt || 0) > new Date(merged.get(q.id).updatedAt || 0)) {
                            merged.set(q.id, q);
                        }
                    });
                    _writeLocal(Array.from(merged.values()));
                }
                return _readLocal();
            });
        },

        /**
         * Load câu hỏi theo loại — ưu tiên Firebase, fallback cache localStorage khi offline.
         * @param {string} examType - 'tsa' | 'hsa' | ...
         * @returns {Promise<Array>}
         */
        async loadByType(examType) {
            const cacheKey = `questions_cache_${examType}`;

            // Thử Firebase trước nếu sẵn sàng
            if (typeof firebase !== 'undefined' && firebase.database && typeof FirebaseAPI !== 'undefined' && FirebaseAPI.isReady && FirebaseAPI.isReady()) {
                try {
                    const snap = await firebase.database().ref('questionBank').orderByChild('examType').equalTo(examType).once('value');
                    const data = snap.val() || {};
                    const questions = Object.values(data);
                    if (questions.length) {
                        try {
                            localStorage.setItem(cacheKey, JSON.stringify({
                                data: questions,
                                timestamp: Date.now()
                            }));
                        } catch (e) {
                            console.warn('[QuestionBank] localStorage write error:', e);
                        }
                        return questions;
                    }
                } catch (err) {
                    console.warn('[QuestionBank] Firebase không khả dụng, dùng cache:', err);
                }
            }

            // Fallback: cache localStorage
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const { data, timestamp } = parsed;
                    const ageMinutes = (Date.now() - timestamp) / 60000;
                    if (ageMinutes < 60) {
                        console.info('[QuestionBank] Đang dùng câu hỏi từ cache (offline mode)');
                        return Array.isArray(data) ? data : [];
                    }
                }
            } catch (e) {
                console.warn('[QuestionBank] Cache read error:', e);
            }

            // Cuối cùng: trả về toàn bộ câu hỏi trong bank (không lọc theo examType)
            return _readLocal();
        },

        /** Thống kê */
        getStats() {
            const bank = _readLocal();
            const byType = {};
            const knownKeys = (typeof QuestionTypes !== 'undefined' && QuestionTypes.KEYS)
                ? QuestionTypes.KEYS : ['mcq_single', 'mcq_multi', 'essay', 'fill_blank', 'word_arrange', 'matching', 'true_false', 'sentence_order', 'drag_drop', 'matrix_choice'];
            knownKeys.forEach(k => byType[k] = 0);
            bank.forEach(q => {
                if (byType[q.type] !== undefined) byType[q.type]++;
            });
            return {
                total: bank.length,
                byType
            };
        },

        /** Xuất JSON */
        exportJSON() {
            return JSON.stringify(_readLocal(), null, 2);
        },

        /** Nhập JSON */
        importJSON(jsonString) {
            try {
                const arr = JSON.parse(jsonString);
                if (!Array.isArray(arr)) throw new Error('JSON phải là mảng');
                return this.bulkSave(arr);
            } catch (e) {
                return { success: false, error: 'JSON không hợp lệ: ' + e.message };
            }
        }
    };

    /* ================================================================
       FIREBASE REALTIME SYNC MODULE
       Đảm bảo dữ liệu đồng bộ realtime giữa tất cả thiết bị
       ================================================================ */
    const QuestionBankSync = {
        _listeners: [],
        _data: [],
        _initialized: false,
        _dataMap: new Map(),

        /**
         * Khởi tạo realtime listener - GỌI MỘT LẦN khi app load
         */
        init() {
            if (this._initialized) {
                console.log('[QuestionBankSync] Already initialized, skipping');
                return;
            }

            if (!_isFirebaseReady()) {
                console.log('[QuestionBankSync] Firebase not ready, will retry in 1s...');
                if (typeof timerManager !== 'undefined') timerManager.setTimeout(() => this.init(), 1000, 'qb-init-retry');
                else setTimeout(() => this.init(), 1000);
                return;
            }

            // [FIX] Check cache version - nếu cache cũ, xóa để force reload
            if (!_isCacheValid()) {
                console.warn(`[QuestionBankSync] Cache version mismatch, invalidating old cache`);
                _invalidateCache();
            }

            console.log('[QuestionBankSync] Initializing realtime listener...');
            this._initialized = true;
            
            const db = _fb();
            const ref = db.ref(FIREBASE_PATH);

            // Lắng nghe tất cả thay đổi - 'value' event
            const valueHandler = (snapshot) => {
                const data = snapshot.val() || {};
                const questions = Object.values(data);

                // Cập nhật Map để lookup nhanh
                this._dataMap.clear();
                questions.forEach(q => { if (q && q.id) this._dataMap.set(q.id, q); });
                this._data = questions;

                // Cập nhật localStorage cache
                _writeLocal(questions);

                // [FIX] Validate với localStorage cache
                const localCount = (function() {
                    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').length; } catch (e) {
                        console.warn('[QuestionBank] Failed to count local cache:', e);
                        return 0;
                    }
                })();
                console.log(`[QuestionBankSync] Firebase loaded: ${questions.length} questions`);

                if (questions.length === 0) {
                    console.warn('[QuestionBankSync] WARNING: Firebase returned 0 questions!');
                }
                if (localCount > questions.length) {
                    console.warn(`[QuestionBankSync] WARNING: Local cache had ${localCount} but Firebase only has ${questions.length}`);
                }
                console.log(`[QuestionBankSync] Cache synced: ${questions.length} questions (local before: ${localCount})`);

                // Thông báo cho UI cập nhật
                window.dispatchEvent(new CustomEvent('questionBankUpdated', {
                    detail: { questions, source: 'firebase', count: questions.length }
                }));

                // [FIX] Phát event chuẩn `questionBankSynced` để mọi UI (Admin Bank, dashboard, ...) đều refresh
                window.dispatchEvent(new CustomEvent('questionBankSynced', {
                    detail: {
                        questions: questions,
                        counts: { firebase: questions.length, local: localCount, merged: questions.length },
                        source: 'firebase-realtime'
                    }
                }));
            };

            // Lắng nghe child_added
            const childAddedHandler = (snapshot) => {
                const question = snapshot.val();
                if (question && question.id) {
                    console.log('[QuestionBankSync] New question added:', question.id);
                    window.dispatchEvent(new CustomEvent('questionAdded', { 
                        detail: { question, source: 'firebase' } 
                    }));
                }
            };

            // Lắng nghe child_changed
            const childChangedHandler = (snapshot) => {
                const question = snapshot.val();
                if (question && question.id) {
                    console.log('[QuestionBankSync] Question updated:', question.id);
                    window.dispatchEvent(new CustomEvent('questionUpdated', { 
                        detail: { question, source: 'firebase' } 
                    }));
                }
            };

            // Lắng nghe child_removed
            const childRemovedHandler = (snapshot) => {
                const question = snapshot.val();
                const key = snapshot.key;
                console.log('[QuestionBankSync] Question removed:', key);
                window.dispatchEvent(new CustomEvent('questionRemoved', { 
                    detail: { questionId: key, source: 'firebase' } 
                }));
            };

            // Đăng ký listeners
            ref.on('value', valueHandler);
            ref.on('child_added', childAddedHandler);
            ref.on('child_changed', childChangedHandler);
            ref.on('child_removed', childRemovedHandler);

            // Lưu refs để có thể cleanup
            this._listeners = [
                { ref, event: 'value', handler: valueHandler },
                { ref, event: 'child_added', handler: childAddedHandler },
                { ref, event: 'child_changed', handler: childChangedHandler },
                { ref, event: 'child_removed', handler: childRemovedHandler }
            ];

            console.log('[QuestionBankSync] Realtime listeners registered');
        },

        /**
         * Dừng tất cả listeners
         */
        destroy() {
            if (!_isFirebaseReady()) return;
            
            this._listeners.forEach(({ ref, event, handler }) => {
                ref.off(event, handler);
            });
            this._listeners = [];
            this._initialized = false;
            console.log('[QuestionBankSync] Destroyed');
        },

        /**
         * Lấy dữ liệu đã sync
         */
        getData() {
            return this._data;
        },

        /**
         * Lấy câu hỏi theo ID từ synced data
         */
        getById(id) {
            return this._dataMap.get(id) || null;
        },

        /**
         * Kiểm tra đã initialized chưa
         */
        isReady() {
            return this._initialized && this._data.length >= 0;
        }
    };
    global.QuestionBankSync = QuestionBankSync;

    /* ================================================================
       MIGRATION: Đồng bộ dữ liệu localStorage lên Firebase
       Chạy một lần duy nhất khi có dữ liệu local nhưng Firebase trống
       ================================================================ */
    async function migrateLocalToFirebase() {
        const MIGRATED_KEY = '_sky_qb_migrated_to_fb';
        
        // Kiểm tra đã migrate chưa
        try {
            if (localStorage.getItem(MIGRATED_KEY) === 'true') {
                console.log('[Migration] QuestionBank already migrated, skipping');
                return { success: true, skipped: true };
            }
        } catch (e) {
            console.warn('[QuestionBank] Failed to read MIGRATED_KEY flag:', e);
        }
        
        if (!_isFirebaseReady()) {
            console.warn('[Migration] Firebase not ready, skipping');
            return { success: false, error: 'Firebase not ready' };
        }
        
        console.log('[Migration] Starting QuestionBank local to Firebase migration...');
        
        try {
            // Kiểm tra Firebase có dữ liệu chưa
            const fbSnap = await _fb().ref(FIREBASE_PATH).once('value');
            const fbData = fbSnap.val() || {};
            
            if (Object.keys(fbData).length > 0) {
                console.log('[Migration] Firebase already has', Object.keys(fbData).length, 'questions, syncing locally...');
                // Đồng bộ Firebase về local
                const questions = Object.values(fbData);
                _writeLocal(questions);
                localStorage.setItem(MIGRATED_KEY, 'true');
                return { success: true, action: 'synced_from_fb', count: questions.length };
            }
            
            // Firebase trống, đẩy local lên
            const localData = _readLocal();
            if (localData.length === 0) {
                console.log('[Migration] No local data to migrate');
                localStorage.setItem(MIGRATED_KEY, 'true');
                return { success: true, action: 'no_data' };
            }
            
            console.log('[Migration] Migrating', localData.length, 'questions to Firebase...');
            
            const writes = localData.map(q => 
                _fb().ref(`${FIREBASE_PATH}/${q.id}`).set(q)
            );
            
            await Promise.all(writes);
            console.log('[Migration] Successfully migrated', localData.length, 'questions');
            
            localStorage.setItem(MIGRATED_KEY, 'true');
            return { success: true, migrated: localData.length };
            
        } catch (error) {
            console.error('[Migration] Failed:', error);
            return { success: false, error: error.message };
        }
    }
    global.migrateQuestionBank = migrateLocalToFirebase;

    /* ================================================================
       EXPORT
       ================================================================ */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = QuestionBank;
    } else {
        global.QuestionBank = QuestionBank;
    }

    /* ================================================================
       AUTO-INIT: Khởi tạo sync khi Firebase ready
       ================================================================ */
    // Thử init ngay nếu Firebase đã sẵn sàng
    if (typeof firebase !== 'undefined' && firebase.database) {
        // Đợi một chút để đảm bảo firebaseInitialized flag được set
        const t = (typeof timerManager !== 'undefined') ? timerManager.setTimeout : setTimeout;
        t(() => {
            if (!QuestionBankSync._initialized && _isFirebaseReady()) {
                console.log('[QuestionBank] Auto-initializing QuestionBankSync...');
                QuestionBankSync.init();
                
                // Chạy migration sau 2 giây
                t(() => {
                    migrateLocalToFirebase().then(result => {
                        if (result.migrated) {
                            console.log('[QuestionBank] Migration complete:', result.migrated, 'questions');
                        }
                    });
                }, 2000);
            }
        }, 500);
    }

    // Lắng nghe firebaseReady event
    if (typeof window !== 'undefined') {
        const _attach = (t, e, h) => typeof eventManager !== 'undefined' ? eventManager.on(t, e, h) : t.addEventListener(e, h);
        _attach(window, 'firebaseReady', () => {
            console.log('[QuestionBank] firebaseReady event received');
            t(() => {
                if (!QuestionBankSync._initialized && _isFirebaseReady()) {
                    QuestionBankSync.init();
                    
                    // Chạy migration
                    if (typeof timerManager !== 'undefined') timerManager.setTimeout(() => migrateLocalToFirebase(), 2000, 'qb-migrate');
                    else setTimeout(() => migrateLocalToFirebase(), 2000);
                }
            }, 500);
        });
    }

})(typeof window !== 'undefined' ? window : globalThis);
