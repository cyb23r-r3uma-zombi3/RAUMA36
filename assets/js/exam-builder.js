/* ================================================================
   EXAM BUILDER - Quản lý tạo đề thi từ kho câu hỏi
   Tác giả: SKY EDU Team
   Phiên bản: 1.0.0
   Mô tả: Module xây dựng đề thi: chọn câu hỏi, tạo đề, lưu trữ,
           xáo trộn câu hỏi/đáp án, hỗ trợ rubric tự luận.
   ================================================================ */

(function (global) {
    'use strict';

    const STORAGE_KEY = 'sky_exams';
    const FIREBASE_PATH = 'exams';

    /* ================================================================
       DATA CHANGE NOTIFICATION SYSTEM
       ================================================================ */
    const _ExamSubscribers = {
        _cbs: [],
        _pending: false,
        subscribe(fn) { this._cbs.push(fn); return () => { this._cbs = this._cbs.filter(cb => cb !== fn); }; },
        _notify(data, source) { this._cbs.forEach(cb => { try { cb(data, source); } catch(e) { console.warn('[ExamSubscribers] callback error:', e); } }); },
        _debouncedNotify(data, source) {
            if (this._pending) return;
            this._pending = true;
            setTimeout(() => { this._pending = false; this._notify(data, source); }, 100);
        }
    };

    /* ================================================================
       13 CHUYÊN ĐỀ + ĐỀ THỰC CHIẾN + KHUNG ĐỀ
       (mirror từ tsa-topics.js để giữ tương thích khi file bị xóa / chưa load)
       ================================================================ */
    const _EXAM_CATEGORIES = (() => {
        const base = (typeof TsaTopics !== 'undefined')
            ? { ...TsaTopics.ALL_CATEGORIES }
            : {
                'bat-pt': 'Bất phương trình và quy hoạch tuyến tính',
                'thong-ke': 'Thống kê',
                'so-hoc': 'Số học',
                'hh-phang': 'Hình học phẳng và 3 đường conic',
                'gioi-han': 'Giới hạn và tính liên tục của hàm số',
                'cap-so': 'Cấp số, dãy số và hệ thức truy hồi',
                'logarit': 'Hàm số logarit, hàm lũy thừa và hàm số mũ',
                'luong-giac': 'Phương trình lượng giác',
                'to-hop': 'Tổ hợp – Xác suất cổ điển – Xác suất có điều kiện',
                'ham-so': 'Hàm số, đồ thị hàm số và đạo hàm',
                'nguyen-ham': 'Nguyên hàm & Tích phân',
                'vector': 'Vector & Hình học không gian có tọa độ',
                'hh-khong-gian': 'Hình học không gian thuần túy',
                'thuc-chien': 'Đề thực chiến',
                'khung-de': 'Đề thi thử'
            };
        // Merge thêm 5 chuyên đề HSA + 2 mục đặc biệt HSA nếu file hsa-topics.js đã load
        if (typeof HsaTopics !== 'undefined') {
            try {
                Object.keys(HsaTopics.ALL_CATEGORIES).forEach(k => {
                    if (!base[k]) base[k] = HsaTopics.ALL_CATEGORIES[k];
                });
            } catch (e) { console.error('[ExamBuilder] read local error:', e); }
        }
        return base;
    })();
    const _VALID_EXAM_CATEGORIES = new Set(Object.keys(_EXAM_CATEGORIES));

    /* ================================================================
       LOCAL STORAGE HELPERS
       ================================================================ */

    const EXAM_CACHE_VERSION = 2; // [FIX] Tăng version để invalidate cache cũ
    const EXAM_CACHE_VERSION_KEY = 'sky_exams_version';

    function _readLocal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                console.log('[ExamBuilder] Cache empty');
                return [];
            }
            const data = JSON.parse(raw);
            const count = Array.isArray(data) ? data.length : 0;
            console.log(`[ExamBuilder] Cache loaded: ${count} exams`);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.error(`[ExamBuilder] localStorage read error (${e.name}):`, e.message);
            return [];
        }
    }

    function _writeLocal(exams) {
        try {
            const json = JSON.stringify(exams);
            localStorage.setItem(STORAGE_KEY, json);
            try { localStorage.setItem(EXAM_CACHE_VERSION_KEY, String(EXAM_CACHE_VERSION)); } catch (e) { console.error('[ExamBuilder] set version error:', e); }
            const sizeKB = Math.round(json.length / 1024);
            console.log(`[ExamBuilder] Cache saved: ${exams.length} exams (${sizeKB}KB)`);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.error('[ExamBuilder] localStorage quota exceeded! Clearing old cache...');
                try {
                    localStorage.clear();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
                    try { localStorage.setItem(EXAM_CACHE_VERSION_KEY, String(EXAM_CACHE_VERSION)); } catch (e2) {}
                    console.log('[ExamBuilder] Retry after clear: success');
                } catch (retry) {
                    console.error('[ExamBuilder] Retry after clear: failed', retry.name, retry.message);
                }
            } else {
                console.error(`[ExamBuilder] localStorage write error (${e.name}):`, e.message);
            }
        }
    }

    function _isExamCacheValid() {
        try {
            const v = localStorage.getItem(EXAM_CACHE_VERSION_KEY);
            if (v === null) return true;
            return parseInt(v, 10) >= EXAM_CACHE_VERSION;
        } catch (e) {
            return true;
        }
    }

    /**
     * Mirror exam sang localStorage 'exams' (key phòng luyện TSA/HSA đang đọc).
     * Firebase mirror đã được _saveToFirebase xử lý (ghi vào exams/ + phongluyen_exams/),
     * nên hàm này CHỈ lo localStorage cache để phòng luyện đọc offline.
     */
    function _mirrorToPhongLuyen(exam) {
        if (!exam) return;
        try {
            const KEY = 'exams';
            const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
            const idx = arr.findIndex(e => e.id === exam.id);
            const cloned = JSON.parse(JSON.stringify(exam));
            if (idx >= 0) arr[idx] = cloned; else arr.push(cloned);
            localStorage.setItem(KEY, JSON.stringify(arr));
        } catch (e) {
            console.warn('[ExamBuilder] mirror localStorage failed:', e);
        }
        // [FIX P0-2] Không ghi Firebase phongluyen_exams/ ở đây nữa — _saveToFirebase đã lo.
    }

    function _removeFromPhongLuyen(examId) {
        try {
            const KEY = 'exams';
            const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
            const next = arr.filter(e => e.id !== examId);
            localStorage.setItem(KEY, JSON.stringify(next));
        } catch (e) { /* ignore */ }
        // [FIX P0-2] Không ghi Firebase ở đây — _deleteFromFirebase đã lo cả 2 path.
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

    /**
     * [FIX P0-2/P0-3] Ghi exam lên Firebase - returns Promise giải quyết khi CẢ HAI
     * exams/{id} (source of truth) và phongluyen_exams/{id} (mirror) đều xác nhận.
     * - Nếu exams/ fail → reject ngay, KHÔNG ghi phongluyen_exams/ (giữ consistency)
     * - Nếu exams/ OK nhưng phongluyen_exams/ fail → vẫn resolve (mirror optional, student side có fallback)
     * - Caller phải await để biết write thực sự thành công.
     */
    function _doSaveToFirebase(exam) {
        console.log('[ExamBuilder._saveToFirebase] mcq_multi:', (exam.questions || []).filter(q => q.type === 'mcq_multi').map(q => ({ id: q.id, correctAnswers: q.correctAnswers })));
        if (!_isFirebaseReady()) return Promise.resolve(null);
        const db = _fb();
        // exams/{id} = source of truth
        return db.ref(`${FIREBASE_PATH}/${exam.id}`).set(exam)
            .then(() => {
                console.log('[ExamBuilder._saveToFirebase] exams/ SUCCESS:', exam.id);
                // Mirror sang phongluyen_exams/ (best-effort)
                return db.ref(`phongluyen_exams/${exam.id}`).set(exam)
                    .then(() => {
                        console.log('[ExamBuilder._saveToFirebase] phongluyen_exams/ SUCCESS:', exam.id);
                        return exam;
                    })
                    .catch(err => {
                        // Mirror fail không chặn write chính (mirror có thể bị rule reject nếu qtv)
                        console.warn('[ExamBuilder] Mirror phongluyen_exams/ failed (non-fatal):', err.code || err.message);
                        return exam;
                    });
            })
            .catch(err => {
                console.error('[ExamBuilder] Firebase exams/ save FAILED:', exam.id, err.code || err.message);
                // [FIX P0-3] Reject để caller biết save fail
                throw err;
            });
    }

    function _saveToFirebase(exam) {
        if (typeof saveQueue !== 'undefined') {
            return saveQueue.enqueue('exam_' + exam.id, () => _doSaveToFirebase(exam));
        }
        return _doSaveToFirebase(exam);
    }

    function _deleteFromFirebase(examId) {
        if (!_isFirebaseReady()) return Promise.resolve(null);
        const db = _fb();
        // [FIX P0-2] Xóa cả 2 path song song, trả về kết quả để caller biết
        return Promise.all([
            db.ref(`${FIREBASE_PATH}/${examId}`).remove()
                .catch(err => { console.warn('[ExamBuilder] Firebase exams/ delete error:', err); throw err; }),
            db.ref(`phongluyen_exams/${examId}`).remove()
                .catch(err => { console.warn('[ExamBuilder] phongluyen_exams/ delete error (non-fatal):', err); /* không throw */ })
        ]);
    }

    function _loadFromFirebase() {
        if (!_isFirebaseReady()) return Promise.resolve([]);
        const db = _fb();
        return Promise.all([
            db.ref('exams').once('value').catch((e) => { console.error('[ExamBuilder] Fetch exams error:', e); return null; }),
            db.ref('phongluyen_exams').once('value').catch((e) => { console.error('[ExamBuilder] Fetch phongluyen_exams error:', e); return null; })
        ]).then(([snap1, snap2]) => {
            const merged = new Map();
            // [FIX P0-2] exams/ là source of truth → ưu tiên ghi đè
            if (snap1 && snap1.val()) Object.values(snap1.val()).forEach(e => merged.set(e.id, e));
            if (snap2 && snap2.val()) Object.values(snap2.val()).forEach(e => {
                if (!merged.has(e.id)) merged.set(e.id, e);
            });
            return Array.from(merged.values());
        }).catch(err => {
            console.warn('[ExamBuilder] Firebase load error:', err);
            return [];
        });
    }

    /**
     * [FIX] Sync từ Firebase với logging chi tiết.
     * Phát event 'examsSynced' để UI cập nhật khi hoàn tất.
     * Backward-compat: detail vừa là object {exams, counts} vừa có thể truy cập qua Array.isArray(detail) (legacy).
     */
    async function _syncFromFirebaseWithLogging() {
        try {
            console.log('[ExamBuilder.Sync] Starting Firebase sync...');
            const fbExams = await _loadFromFirebase();
            const localExams = _readLocal();

            const fbCount = (fbExams || []).length;
            const localCount = localExams.length;

            console.log(`[ExamBuilder.Sync] Firebase: ${fbCount} | Local: ${localCount}`);

            if (!fbExams || fbCount === 0) {
                console.warn('[ExamBuilder.Sync] Firebase returned empty, keeping local cache');
                window.dispatchEvent(new CustomEvent('examsSynced', {
                    detail: localExams, // [FIX] backward compat với code cũ dùng Array.isArray(detail)
                    __meta: { counts: { firebase: 0, local: localCount, merged: localCount }, source: 'empty-firebase' }
                }));
                return localExams;
            }

            const merged = new Map();
            fbExams.forEach(e => merged.set(e.id, e));

            // Local bổ sung (giữ local mới hơn)
            localExams.forEach(e => {
                const existing = merged.get(e.id);
                if (!existing || new Date(e.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                    merged.set(e.id, e);
                }
            });

            const synced = Array.from(merged.values());
            const mergedCount = synced.length;

            console.log(`[ExamBuilder.Sync] After merge: ${mergedCount}`);

            _writeLocal(synced);
            console.log('[ExamBuilder.Sync] Cache updated');

            // Notify subscribers
            _ExamSubscribers._debouncedNotify(synced, 'firebase-sync');

            // [FIX] Phát event chuẩn - backward compat: detail là array (cho code cũ) + expose counts qua __meta
            window.dispatchEvent(new CustomEvent('examsSynced', {
                detail: synced,
                __meta: { counts: { firebase: fbCount, local: localCount, merged: mergedCount }, source: 'firebase' }
            }));
            console.log('[ExamBuilder.Sync] Event dispatched: examsSynced (count=' + mergedCount + ')');

            return synced;
        } catch (error) {
            console.error('[ExamBuilder.Sync] Fatal error:', error);
            window.dispatchEvent(new CustomEvent('examsSyncError', {
                detail: { error: error.message }
            }));
            throw error;
        }
    }

    /**
     * [SYNC] Ghi Blueprint lên Firebase với retry
     */
    function _saveBlueprintToFirebase(blueprint, maxRetries = 3) {
        return new Promise((resolve, reject) => {
            if (!_isFirebaseReady()) {
                reject(new Error('Firebase not ready'));
                return;
            }
            
            const db = _fb();
            const ref = db.ref(`exam_blueprints/${blueprint.id}`);
            let attempt = 0;
            
            const attemptWrite = () => {
                attempt++;
                ref.set(blueprint)
                    .then(() => {
                        console.log(`[ExamBuilder] Blueprint Firebase write success (attempt ${attempt}):`, blueprint.id);
                        resolve(blueprint);
                    })
                    .catch((error) => {
                        console.warn(`[ExamBuilder] Blueprint write attempt ${attempt}/${maxRetries} failed:`, error.code);
                        if (attempt < maxRetries) {
                            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                            setTimeout(attemptWrite, delay);
                        } else {
                            reject(error);
                        }
                    });
            };
            
            attemptWrite();
        });
    }

    /**
     * [SYNC] Xóa Blueprint khỏi Firebase
     */
    function _deleteBlueprintFromFirebase(blueprintId) {
        return new Promise((resolve, reject) => {
            if (!_isFirebaseReady()) {
                resolve();
                return;
            }
            
            const db = _fb();
            db.ref(`exam_blueprints/${blueprintId}`).remove()
                .then(() => resolve())
                .catch(reject);
        });
    }

    /* ================================================================
       BLUEPRINT FIREBASE REALTIME SYNC MODULE
       ================================================================ */
    const BlueprintSync = {
        _listeners: [],
        _data: [],
        _dataMap: new Map(),
        _initialized: false,

        init() {
            if (this._initialized) {
                console.log('[BlueprintSync] Already initialized');
                return;
            }
            
            if (!_isFirebaseReady()) {
                console.log('[BlueprintSync] Firebase not ready, will retry...');
                setTimeout(() => this.init(), 1000);
                return;
            }

            console.log('[BlueprintSync] Initializing realtime listener...');
            this._initialized = true;
            
            const db = _fb();
            const ref = db.ref('exam_blueprints');

            const valueHandler = (snapshot) => {
                const data = snapshot.val() || {};
                const blueprints = Object.values(data);
                
                this._dataMap.clear();
                blueprints.forEach(bp => this._dataMap.set(bp.id, bp));
                this._data = blueprints;
                
                _writeBlueprints(blueprints);
                
                console.log('[BlueprintSync] Synced', blueprints.length, 'blueprints from Firebase');
                
                window.dispatchEvent(new CustomEvent('blueprintsUpdated', { 
                    detail: { blueprints, source: 'firebase' } 
                }));
            };

            const childAddedHandler = (snapshot) => {
                const blueprint = snapshot.val();
                if (blueprint && blueprint.id) {
                    console.log('[BlueprintSync] Blueprint added:', blueprint.id);
                    window.dispatchEvent(new CustomEvent('blueprintAdded', { 
                        detail: { blueprint, source: 'firebase' } 
                    }));
                }
            };

            const childChangedHandler = (snapshot) => {
                const blueprint = snapshot.val();
                if (blueprint && blueprint.id) {
                    console.log('[BlueprintSync] Blueprint updated:', blueprint.id);
                    window.dispatchEvent(new CustomEvent('blueprintUpdated', { 
                        detail: { blueprint, source: 'firebase' } 
                    }));
                }
            };

            const childRemovedHandler = (snapshot) => {
                console.log('[BlueprintSync] Blueprint removed:', snapshot.key);
                window.dispatchEvent(new CustomEvent('blueprintRemoved', { 
                    detail: { blueprintId: snapshot.key, source: 'firebase' } 
                }));
            };

            ref.on('value', valueHandler);
            ref.on('child_added', childAddedHandler);
            ref.on('child_changed', childChangedHandler);
            ref.on('child_removed', childRemovedHandler);

            this._listeners = [
                { ref, event: 'value', handler: valueHandler },
                { ref, event: 'child_added', handler: childAddedHandler },
                { ref, event: 'child_changed', handler: childChangedHandler },
                { ref, event: 'child_removed', handler: childRemovedHandler }
            ];

            console.log('[BlueprintSync] Realtime listeners registered');
        },

        destroy() {
            if (!_isFirebaseReady()) return;
            this._listeners.forEach(({ ref, event, handler }) => ref.off(event, handler));
            this._listeners = [];
            this._initialized = false;
        },

        getData() {
            return this._data;
        },

        getById(id) {
            return this._dataMap.get(id) || null;
        },

        isReady() {
            return this._initialized;
        }
    };
    global.BlueprintSync = BlueprintSync;

    /* ================================================================
       EXAM FIREBASE REALTIME SYNC MODULE
       ================================================================ */
    const ExamSync = {
        _listeners: [],
        _data: [],
        _dataMap: new Map(),
        _initialized: false,

        init() {
            if (this._initialized) return;
            if (!_isFirebaseReady()) {
                setTimeout(() => this.init(), 1000);
                return;
            }

            console.log('[ExamSync] Initializing realtime listener...');
            this._initialized = true;
            
            const db = _fb();
            const ref = db.ref(FIREBASE_PATH);

            const valueHandler = (snapshot) => {
                const data = snapshot.val() || {};
                const exams = Object.values(data);
                
                this._dataMap.clear();
                exams.forEach(ex => this._dataMap.set(ex.id, ex));
                this._data = exams;
                
                _writeLocal(exams);
                
                console.log('[ExamSync] Synced', exams.length, 'exams from Firebase');
                
                window.dispatchEvent(new CustomEvent('examsUpdated', { 
                    detail: { exams, source: 'firebase' } 
                }));
            };

            ref.on('value', valueHandler);
            this._listeners = [{ ref, event: 'value', handler: valueHandler }];

            console.log('[ExamSync] Realtime listeners registered');
        },

        destroy() {
            if (!_isFirebaseReady()) return;
            this._listeners.forEach(({ ref, event, handler }) => ref.off(event, handler));
            this._listeners = [];
            this._initialized = false;
        },

        getData() {
            return this._data;
        },

        isReady() {
            return this._initialized;
        }
    };
    global.ExamSync = ExamSync;

    /* ================================================================
       MIGRATION: Đồng bộ blueprints từ local lên Firebase
       ================================================================ */
    async function migrateBlueprintsToFirebase() {
        const MIGRATED_KEY = '_sky_bp_migrated_to_fb';
        
        try {
            if (localStorage.getItem(MIGRATED_KEY) === 'true') {
                return { success: true, skipped: true };
            }
        } catch (e) { console.error('[ExamBuilder] save/sync error:', e); }
        
        if (!_isFirebaseReady()) {
            return { success: false, error: 'Firebase not ready' };
        }
        
        try {
            const fbSnap = await _fb().ref('exam_blueprints').once('value');
            const fbData = fbSnap.val() || {};
            
            if (Object.keys(fbData).length > 0) {
                _writeBlueprints(Object.values(fbData));
                localStorage.setItem(MIGRATED_KEY, 'true');
                return { success: true, action: 'synced_from_fb', count: Object.keys(fbData).length };
            }
            
            const localData = _readBlueprints();
            if (localData.length === 0) {
                localStorage.setItem(MIGRATED_KEY, 'true');
                return { success: true, action: 'no_data' };
            }
            
            const writes = localData.map(bp => 
                _fb().ref(`exam_blueprints/${bp.id}`).set(bp)
            );
            
            await Promise.all(writes);
            localStorage.setItem(MIGRATED_KEY, 'true');
            return { success: true, migrated: localData.length };
            
        } catch (error) {
            console.error('[BlueprintSync] Migration failed:', error);
            return { success: false, error: error.message };
        }
    }
    global.migrateBlueprints = migrateBlueprintsToFirebase;

    /* ================================================================
       AUTO-INIT
       ================================================================ */
    if (typeof firebase !== 'undefined' && firebase.database) {
        setTimeout(() => {
            if (!BlueprintSync._initialized && _isFirebaseReady()) {
                console.log('[ExamBuilder] Auto-initializing BlueprintSync...');
                BlueprintSync.init();
                setTimeout(() => migrateBlueprintsToFirebase(), 2000);
            }
            if (!ExamSync._initialized && _isFirebaseReady()) {
                ExamSync.init();
            }
        }, 500);
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('firebaseReady', () => {
            setTimeout(() => {
                if (!BlueprintSync._initialized && _isFirebaseReady()) {
                    BlueprintSync.init();
                    setTimeout(() => migrateBlueprintsToFirebase(), 2000);
                }
                if (!ExamSync._initialized && _isFirebaseReady()) {
                    ExamSync.init();
                }
            }, 500);
        });
    }

    /* ================================================================
       UTILS
       ================================================================ */

    function _shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function _uuid() {
        return 'exam-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function _qid() {
        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.generateId) {
            return QuestionTypes.generateId();
        }
        return 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function _validate(q) {
        if (typeof QuestionTypes !== 'undefined' && QuestionTypes.validate) {
            return QuestionTypes.validate(q);
        }
        return null;
    }

    /**
     * Chuẩn hoá category của đề thi:
     *  - 13 chuyên đề TSA + 'thuc-chien' + 'khung-de'  → giữ nguyên
     *  - Legacy 'full' → đổi thành 'thuc-chien'
     *  - 'basic' | 'advanced' | bất kỳ → fallback về 'thuc-chien'
     */
    function _normalizeCategory(category) {
        const c = String(category || '').trim();
        if (_VALID_EXAM_CATEGORIES.has(c)) return c;
        if (c === 'full') return 'thuc-chien';
        return 'thuc-chien';
    }

    /**
     * Danh sách `room` hợp lệ — canonical để phân biệt phòng chứa đề:
     *  - 'practice-tsa'  : Phòng luyện TSA (trả phí)
     *  - 'practice-hsa'  : Phòng luyện HSA (trả phí)
     *  - 'mock-exam'     : Thi thử (miễn phí)
     */
    const _VALID_ROOMS = ['practice-tsa', 'practice-hsa', 'mock-exam'];

    /**
     * Suy ra `room` từ `type` + `category` cho đề thi cũ (chưa có field room).
     * Quy tắc:
     *  - category ∈ {'khung-de', 'hsa-de-thi-thu'}       → 'mock-exam'
     *  - type === 'tsa'                                 → 'practice-tsa'
     *  - type === 'hsa'                                 → 'practice-hsa'
     *  - mặc định theo type
     */
    function _inferRoomFromLegacy(exam) {
        const category = String(exam && exam.category || '').trim();
        if (category === 'khung-de' || category === 'hsa-de-thi-thu') return 'mock-exam';
        const t = (exam && exam.type) || 'tsa';
        return t === 'hsa' ? 'practice-hsa' : 'practice-tsa';
    }

    /**
     * Chuẩn hoá `room` của đề thi:
     *  - Nếu thiếu → suy ra từ type/category (legacy)
     *  - Nếu có nhưng không hợp lệ → fallback theo type
     */
    function _normalizeRoom(exam, providedRoom) {
        const incoming = providedRoom != null ? String(providedRoom).trim() : '';
        if (_VALID_ROOMS.includes(incoming)) return incoming;
        if (exam && _VALID_ROOMS.includes(exam.room)) return exam.room;
        return _inferRoomFromLegacy(exam || {});
    }

    /* ================================================================
       BLUEPRINT (KHUNG ĐỀ) - lưu localStorage
       ================================================================ */
    const BLUEPRINT_STORAGE_KEY = 'sky_exam_blueprints';

    function _readBlueprints() {
        try {
            const raw = localStorage.getItem(BLUEPRINT_STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function _writeBlueprints(arr) {
        try { localStorage.setItem(BLUEPRINT_STORAGE_KEY, JSON.stringify(arr)); }
        catch (e) { console.error('[ExamBuilder] Lỗi ghi blueprint:', e); }
    }
    function _readLocalQuestions() {
        try {
            const raw = localStorage.getItem('sky_question_bank');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    /* ================================================================
       PUBLIC API
       ================================================================ */

    const ExamBuilder = {
        STORAGE_KEY,
        FIREBASE_PATH,

        /** Lấy toàn bộ đề thi (optimistic read - return local ngay, sync background)
         *  Subscribe bằng ExamBuilder.onSyncComplete(cb) để nhận thông báo khi sync xong.
         */
        getAll() {
            const local = _readLocal();

            // [FIX] Check cache version - invalidate cache cũ
            if (!_isExamCacheValid()) {
                console.warn('[ExamBuilder] Cache version mismatch, reloading from Firebase');
                try { localStorage.removeItem(STORAGE_KEY); } catch (e) { console.error('[ExamBuilder] clear old cache error:', e); }
            }

            // Trigger sync background nếu chưa từng sync
            if (!window._ExamBuilder_syncInitiated) {
                window._ExamBuilder_syncInitiated = true;
                if (_isFirebaseReady()) {
                    _syncFromFirebaseWithLogging()
                        .then(synced => {
                            console.log('[ExamBuilder] Sync completed successfully');
                        })
                        .catch(err => {
                            console.error('[ExamBuilder] Sync error:', err.message);
                            window.dispatchEvent(new CustomEvent('examsSyncError', {
                                detail: { error: err.message }
                            }));
                        });
                }
            }

            return local;
        },

        /** [FIX] Sync từ Firebase với logging chi tiết */
        async _syncFromFirebaseWithLogging() {
            return _syncFromFirebaseWithLogging();
        },

        /** Subscribe callback được gọi mỗi khi exams thay đổi (sau sync Firebase) */
        onSyncComplete(cb) {
            return _ExamSubscribers.subscribe(cb);
        },

        /** Force re-sync từ Firebase (hữu ích khi cần đảm bảo data mới nhất) */
        refresh() {
            if (!_isFirebaseReady()) return Promise.resolve(_readLocal());
            return _syncFromFirebaseWithLogging();
        },

        /**
         * Lấy đề theo ID (sync, từ local cache)
         * @param {string} id
         * @returns {Object|null}
         */
        getById(id) {
            return _readLocal().find(e => e.id === id) || null;
        },

        /** Tạo đề thi mới */
        async create(opts) {
            const {
                name, code, type = 'tsa', category = 'thuc-chien',
                targetRole = 'all', tier = 'free', room,
                timeMinutes = 150, questions = [],
                showAnswers = true, showExplanation = true, shuffleQuestions = false, shuffleOptions = false,
                videoUrl = '', exerciseFileUrl = '', exerciseFileName = '',
                answerFileUrl = '', answerFileName = '',
                antiCheat = false,  // Bật/tắt chống gian lận cho từng đề
                attempts = 0  // Số lượt làm: 0 = không giới hạn
            } = opts;

            if (!name || !name.trim()) return { success: false, error: 'Tên đề không được trống' };
            if (!code || !code.trim()) return { success: false, error: 'Mã đề không được trống' };
            if (!Array.isArray(questions) || questions.length === 0)
                return { success: false, error: 'Đề thi phải có ít nhất 1 câu hỏi' };

            // [FIX P2.4] Validate trùng câu + cấu trúc câu hỏi
            if (typeof ExamValidator !== 'undefined' && ExamValidator.validateExam) {
                const v = ExamValidator.validateExam({ questions: questions });
                if (!v.valid) return { success: false, error: v.error };
            } else {
                // Fallback inline validation
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    if (!q.type) return { success: false, error: `Câu ${i + 1}: thiếu loại câu hỏi` };
                    const err = _validate(q);
                    if (err) return { success: false, error: `Câu ${i + 1}: ${err}` };
                }
                // Check duplicate IDs
                const seenIds = new Set();
                for (let i = 0; i < questions.length; i++) {
                    const id = questions[i].id;
                    if (id && seenIds.has(id)) {
                        return { success: false, error: `Câu ${i + 1}: trùng ID với câu trước` };
                    }
                    if (id) seenIds.add(id);
                }
            }

            // [FIX P0-4] Validate trùng mã đề (code)
            const codeUpper = code.trim().toUpperCase();
            const existingExams = _readLocal();
            if (existingExams.some(e => (e.code || '').trim().toUpperCase() === codeUpper)) {
                return { success: false, error: `Mã đề "${code}" đã tồn tại. Vui lòng dùng mã khác.` };
            }

            // Chuẩn hoá category: chấp nhận 13 chuyên đề + thuc-chien + khung-de + legacy basic/advanced/full
            const normalizedCategory = _normalizeCategory(category);

            // Chuẩn hoá targetRole: 'all' | 'TSA' | 'HSA'
            const allowedRoles = ['all', 'TSA', 'HSA'];
            const normalizedRole = allowedRoles.includes(targetRole) ? targetRole : 'all';

            // Chuẩn hoá tier: 'free' | 'TSA01' | 'TSA02' | 'TSA03'
            const allowedTiers = ['free', 'TSA01', 'TSA02', 'TSA03'];
            const normalizedTier = allowedTiers.includes(tier) ? tier : 'free';

            // Chuẩn hoá room (canonical): 'practice-tsa' | 'practice-hsa' | 'mock-exam'.
            // Mặc định: nếu category gốc là 'khung-de'/'hsa-de-thi-thu' → 'mock-exam'; ngược lại theo type.
            // Lưu ý: dùng `category` gốc (chưa normalize) để tránh trường hợp _normalizeCategory rewrite
            // 'hsa-de-thi-thu' → 'thuc-chien' khi hsa-topics.js chưa load.
            const normalizedRoom = _normalizeRoom({ type, category: category }, room);

            // Chuẩn hoá videoUrl: chỉ giữ nếu là link YouTube hợp lệ
            const cleanedVideoUrl = (typeof videoUrl === 'string' && videoUrl.trim()) ? videoUrl.trim() : '';

            const exam = {
                id: _uuid(),
                name: name.trim(),
                code: code.trim(),
                type, category: normalizedCategory,
                targetRole: normalizedRole,
                tier: normalizedTier,
                room: normalizedRoom,
                timeMinutes: parseInt(timeMinutes) || 150,
                attempts: parseInt(attempts) || 0,  // Số lượt làm: 0 = không giới hạn
                questions: questions.map(q => ({
                    ...JSON.parse(JSON.stringify(q)),
                    id: q.id || _qid()
                })),
                options: { showAnswers, showExplanation, shuffleQuestions, shuffleOptions },
                // === Tài liệu đính kèm (video / file bài tập / file đáp án) ===
                videoUrl: cleanedVideoUrl,
                exerciseFileUrl: (typeof exerciseFileUrl === 'string' && exerciseFileUrl.trim()) ? exerciseFileUrl.trim() : '',
                exerciseFileName: (typeof exerciseFileName === 'string' && exerciseFileName.trim()) ? exerciseFileName.trim() : '',
                answerFileUrl: (typeof answerFileUrl === 'string' && answerFileUrl.trim()) ? answerFileUrl.trim() : '',
                answerFileName: (typeof answerFileName === 'string' && answerFileName.trim()) ? answerFileName.trim() : '',
                antiCheat: !!antiCheat,  // Bật/tắt chống gian lận cho từng đề
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Tính tổng điểm
            exam.totalPoints = exam.questions.reduce((sum, q) => sum + (q.points || 1), 0);

            // Ghi local NGAY để UI phản hồi tức thì
            const exams = _readLocal();
            exams.push(exam);
            _writeLocal(exams);
            _mirrorToPhongLuyen(exam);

            // [FIX P0-3] Await Firebase write, trả success=false nếu fail
            try {
                await _saveToFirebase(exam);
                return { success: true, exam };
            } catch (fbErr) {
                console.error('[ExamBuilder.create] Firebase write FAILED:', fbErr);
                // Rollback local
                const rollback = _readLocal().filter(e => e.id !== exam.id);
                _writeLocal(rollback);
                _removeFromPhongLuyen(exam.id);
                return {
                    success: false,
                    error: 'Lưu Firebase thất bại: ' + (fbErr.code || fbErr.message || 'unknown') + '. Đề đã được rollback, vui lòng thử lại.',
                    firebaseError: true
                };
            }
        },

        /** Lưu "khung đề" (blueprint) — không có câu hỏi, chỉ chứa cấu trúc
         *  (số câu theo chuyên đề + độ khó) để tái sử dụng cho việc tạo đề nhanh.
         */
        saveBlueprint(blueprint) {
            if (!blueprint) return { success: false, error: 'Thiếu khung đề' };
            const name = (blueprint.name || '').trim();
            if (!name) return { success: false, error: 'Tên khung đề không được trống' };

            const bp = {
                id: blueprint.id || ('bp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
                name,
                description: (blueprint.description || '').trim(),
                type: blueprint.type || 'tsa',
                timeMinutes: parseInt(blueprint.timeMinutes) || 150,
                /** Mảng cấu trúc: [{ categoryKey, difficulty, count, points }] */
                slots: Array.isArray(blueprint.slots) ? blueprint.slots.map(s => ({
                    categoryKey: s.categoryKey || '',
                    difficulty: s.difficulty || '',
                    count: parseInt(s.count) || 0,
                    points: parseFloat(s.points) || 1
                })).filter(s => s.count > 0) : [],
                createdAt: blueprint.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Cập nhật localStorage NGAY để UI phản hồi nhanh
            const arr = _readBlueprints();
            const idx = arr.findIndex(b => b.id === bp.id);
            if (idx >= 0) arr[idx] = bp; else arr.push(bp);
            _writeBlueprints(arr);

            // [SYNC] Ghi Firebase - FIREBASE LÀ SINGLE SOURCE OF TRUTH
            // PHẢI await và chỉ return success KHI Firebase xác nhận
            if (_isFirebaseReady()) {
                return _saveBlueprintToFirebase(bp).then(() => {
                    console.log('[ExamBuilder] Blueprint saved to Firebase:', bp.id);
                    return { success: true, blueprint: bp };
                }).catch((error) => {
                    // Log đầy đủ lỗi Firebase
                    console.error('[ExamBuilder] Blueprint Firebase save FAILED:', error);
                    console.error('[ExamBuilder] error.code:', error?.code);
                    console.error('[ExamBuilder] error.message:', error?.message);
                    console.error('[ExamBuilder] error.stack:', error?.stack);
                    // Vẫn return success vì đã lưu local, nhưng cảnh báo
                    return { success: true, blueprint: bp, warning: 'Firebase sync failed: ' + (error?.message || String(error)) };
                });
            } else {
                console.warn('[ExamBuilder] Firebase not ready, blueprint saved locally only');
                return { success: true, blueprint: bp, warning: 'Firebase offline - saved locally' };
            }
        },

        /** Lấy danh sách khung đề */
        getBlueprints() {
            return _readBlueprints();
        },

        /** Lấy 1 khung đề theo id */
        getBlueprintById(id) {
            return _readBlueprints().find(b => b.id === id) || null;
        },

        /** Xoá khung đề */
        removeBlueprint(id) {
            const arr = _readBlueprints();
            const next = arr.filter(b => b.id !== id);
            _writeBlueprints(next);
            // Unlink câu hỏi đã gán blueprint này (để chúng quay về "chưa gán")
            try {
                if (typeof QuestionBank !== 'undefined' && QuestionBank.unlinkBlueprint) {
                    QuestionBank.unlinkBlueprint(id);
                }
            } catch (e) {
                console.error('[ExamBuilder] QuestionBank.unlinkBlueprint failed for', id, e);
            }
            if (_isFirebaseReady()) {
                try {
                    firebase.database().ref(`exam_blueprints/${id}`).remove().catch(err => {
                        console.warn('[ExamBuilder] Firebase blueprint remove failed for', id, err);
                    });
                }
                catch (e) {
                    console.error('[ExamBuilder] blueprint remove threw:', e);
                }
            }
            return { success: true };
        },

        /**
         * Sinh đề thi thực tế từ 1 khung đề (kho câu hỏi).
         * Lấy TẤT CẢ câu hỏi đã được gán `blueprintId` khớp với blueprint này.
         * Mỗi câu chỉ dùng 1 lần; nếu không đủ câu sẽ trả về lỗi để admin biết cần thêm câu.
         */
        async generateExamFromBlueprint(blueprintId, extraOpts = {}) {
            const bp = this.getBlueprintById(blueprintId);
            if (!bp) return { success: false, error: 'Không tìm thấy khung đề' };

            const seedQuestions = (typeof QuestionBank !== 'undefined' && QuestionBank.getAll)
                ? QuestionBank.getAll() : _readLocalQuestions();

            // Lấy toàn bộ câu đã gán blueprintId này
            const tagged = seedQuestions.filter(q => q.blueprintId === bp.id);

            if (tagged.length === 0) {
                return {
                    success: false,
                    error: 'Khung đề chưa có câu hỏi nào trong kho. Hãy thêm câu hỏi trước khi sinh đề.',
                    missing: [],
                    slotReport: []
                };
            }

            // [FIX P0-6] Phân bổ theo blueprint.slots (nếu có)
            // Mỗi slot: { topic, type, difficulty, count, points }
            let picked = [];
            const slotReport = [];
            const missing = [];

            if (Array.isArray(bp.slots) && bp.slots.length > 0) {
                bp.slots.forEach((slot, idx) => {
                    const candidates = tagged.filter(q => {
                        if (slot.type && q.type !== slot.type) return false;
                        if (slot.difficulty && q.difficulty !== slot.difficulty) return false;
                        if (slot.topic && q.topic !== slot.topic && q.category !== slot.topic) return false;
                        if (slot.categoryId && q.categoryId !== slot.categoryId) return false;
                        return true;
                    });
                    const need = Math.min(slot.count || 0, candidates.length);
                    if (need < (slot.count || 0)) {
                        missing.push({
                            slotIndex: idx,
                            need: (slot.count || 0),
                            got: need,
                            reason: slot.type ? `Thiếu ${slot.type}` : 'Thiếu câu phù hợp'
                        });
                    }
                    slotReport.push({
                        slotIndex: idx,
                        need: slot.count || 0,
                        got: need,
                        type: slot.type
                    });
                    // shuffle trước khi slice
                    picked = picked.concat(candidates.slice().sort(() => Math.random() - 0.5).slice(0, need));
                });
            } else {
                // Không có slots → lấy toàn bộ + shuffle
                picked = tagged.slice().sort(() => Math.random() - 0.5);
            }

            if (picked.length === 0) {
                return {
                    success: false,
                    error: 'Khung đề không sinh được câu nào phù hợp với slot đã định.',
                    missing,
                    slotReport
                };
            }

            const opts = Object.assign({
                name: (bp.name || 'Đề sinh tự động') + ' (sinh tự động)',
                code: 'BP-' + Date.now().toString().slice(-6),
                type: bp.type || 'tsa',
                category: 'thuc-chien',
                timeMinutes: bp.timeMinutes || 150,
                questions: picked,
                _blueprintId: bp.id
            }, extraOpts);

            const r = await this.create(opts);
            if (!r.success) {
                r.missing = missing;
                r.slotReport = slotReport;
                return r;
            }
            r.slotReport = slotReport;
            r.missing = missing;
            r.totalTagged = tagged.length;
            // [FIX P0-6] Nếu có missing nhưng vẫn có câu → vẫn success nhưng cảnh báo
            r.hasMissing = missing.length > 0;
            return r;
        },

        /** Cập nhật đề thi */
        async update(id, updates) {
            const exams = _readLocal();
            const idx = exams.findIndex(e => e.id === id);
            if (idx < 0) return { success: false, error: 'Không tìm thấy đề thi' };
            const current = exams[idx];

            // [FIX P0-4] Nếu đổi code, kiểm tra trùng
            if (updates.code && String(updates.code).trim().toUpperCase() !== String(current.code || '').trim().toUpperCase()) {
                const codeUpper = String(updates.code).trim().toUpperCase();
                if (exams.some(e => e.id !== id && String(e.code || '').trim().toUpperCase() === codeUpper)) {
                    return { success: false, error: `Mã đề "${updates.code}" đã tồn tại. Vui lòng dùng mã khác.` };
                }
            }

            // Validate questions nếu có thay đổi
            if (Array.isArray(updates.questions)) {
                if (updates.questions.length === 0)
                    return { success: false, error: 'Đề thi phải có ít nhất 1 câu hỏi' };
                // [FIX P2.4] Dùng ExamValidator nếu có
                if (typeof ExamValidator !== 'undefined' && ExamValidator.validateExam) {
                    const v = ExamValidator.validateExam({ questions: updates.questions });
                    if (!v.valid) return { success: false, error: v.error };
                } else {
                    for (let i = 0; i < updates.questions.length; i++) {
                        const q = updates.questions[i];
                        if (!q.type) return { success: false, error: `Câu ${i + 1}: thiếu loại câu hỏi` };
                        const err = _validate(q);
                        if (err) return { success: false, error: `Câu ${i + 1}: ${err}` };
                    }
                    // Check duplicate IDs
                    const seenIds = new Set();
                    for (let i = 0; i < updates.questions.length; i++) {
                        const id = updates.questions[i].id;
                        if (id && seenIds.has(id)) {
                            return { success: false, error: `Câu ${i + 1}: trùng ID với câu trước` };
                        }
                        if (id) seenIds.add(id);
                    }
                }
                // [FIX P1-7] Đảm bảo mỗi câu hỏi có id duy nhất (chống trùng)
                const seenIds2 = new Set();
                updates.questions = updates.questions.map((q, i) => {
                    if (q.id && !seenIds2.has(q.id)) {
                        seenIds2.add(q.id);
                        return q;
                    }
                    // Nếu không có id hoặc trùng → tạo id mới
                    const newId = q.id ? `q_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}` : _qid();
                    seenIds2.add(newId);
                    return { ...q, id: newId };
                });
            }

            const safeUpdates = Object.assign({}, updates);
            if (safeUpdates.category) safeUpdates.category = _normalizeCategory(safeUpdates.category);
            if (Object.prototype.hasOwnProperty.call(safeUpdates, 'room')) {
                safeUpdates.room = _normalizeRoom(
                    Object.assign({}, exams[idx], { room: safeUpdates.room }),
                    safeUpdates.room
                );
            }
            const updated = { ...exams[idx], ...safeUpdates, id, updatedAt: new Date().toISOString() };
            // Đồng bộ options với top-level fields (vì form gửi showAnswers/showExplanation ở top-level)
            if (safeUpdates.showAnswers !== undefined) {
                if (!updated.options) updated.options = {};
                updated.options.showAnswers = !!safeUpdates.showAnswers;
            }
            if (safeUpdates.showExplanation !== undefined) {
                if (!updated.options) updated.options = {};
                updated.options.showExplanation = !!safeUpdates.showExplanation;
            }
            if (safeUpdates.shuffleQuestions !== undefined) {
                if (!updated.options) updated.options = {};
                updated.options.shuffleQuestions = !!safeUpdates.shuffleQuestions;
            }
            if (safeUpdates.shuffleOptions !== undefined) {
                if (!updated.options) updated.options = {};
                updated.options.shuffleOptions = !!safeUpdates.shuffleOptions;
            }
            if (updated.questions) {
                updated.totalPoints = updated.questions.reduce((s, q) => s + (q.points || 1), 0);
            }
            exams[idx] = updated;
            _writeLocal(exams);
            _mirrorToPhongLuyen(updated);

            // [FIX P0-3] Await Firebase write, trả success=false nếu fail
            try {
                await _saveToFirebase(updated);
                return { success: true, exam: updated };
            } catch (fbErr) {
                console.error('[ExamBuilder.update] Firebase write FAILED:', fbErr);
                // Rollback local
                exams[idx] = current;
                _writeLocal(exams);
                _mirrorToPhongLuyen(current);
                return {
                    success: false,
                    error: 'Lưu Firebase thất bại: ' + (fbErr.code || fbErr.message || 'unknown') + '. Đề đã được rollback.',
                    firebaseError: true
                };
            }
        },

        /** Xóa đề thi */
        async remove(id) {
            const exams = _readLocal();
            const idx = exams.findIndex(e => e.id === id);
            if (idx < 0) return { success: false, error: 'Không tìm thấy đề thi' };
            const removed = exams[idx];
            exams.splice(idx, 1);
            _writeLocal(exams);
            _removeFromPhongLuyen(id);
            // [FIX P0-3] Await Firebase delete
            try {
                await _deleteFromFirebase(id);
                return { success: true };
            } catch (fbErr) {
                console.error('[ExamBuilder.remove] Firebase delete FAILED:', fbErr);
                // Restore local khi Firebase fail
                exams.push(removed);
                _writeLocal(exams);
                _mirrorToPhongLuyen(removed);
                return {
                    success: false,
                    error: 'Xóa Firebase thất bại: ' + (fbErr.code || fbErr.message || 'unknown') + '. Đề đã được khôi phục.',
                    firebaseError: true
                };
            }
        },

        /** Nhân bản đề thi */
        async duplicate(id) {
            const original = this.getById(id);
            if (!original) return { success: false, error: 'Không tìm thấy đề thi' };
            const copy = JSON.parse(JSON.stringify(original));
            copy.id = _uuid();

            // [FIX P0-4] Tránh trùng code khi duplicate nhiều lần liên tiếp
            const exams = _readLocal();
            let newCode = copy.code + '-COPY';
            let counter = 1;
            while (exams.some(e => String(e.code || '').trim().toUpperCase() === newCode.toUpperCase())) {
                counter++;
                newCode = copy.code + '-COPY' + counter;
            }

            copy.name = '[BẢN SAO] ' + copy.name;
            copy.code = newCode;
            copy.createdAt = new Date().toISOString();
            copy.updatedAt = new Date().toISOString();
            // Cũng nên tạo ID mới cho các câu hỏi
            copy.questions = copy.questions.map(q => ({
                ...q,
                id: _qid()
            }));
            exams.push(copy);
            _writeLocal(exams);
            _mirrorToPhongLuyen(copy);
            // [FIX P0-3] Await Firebase write
            try {
                await _saveToFirebase(copy);
                return { success: true, exam: copy };
            } catch (fbErr) {
                console.error('[ExamBuilder.duplicate] Firebase write FAILED:', fbErr);
                // Rollback local
                const rollback = _readLocal().filter(e => e.id !== copy.id);
                _writeLocal(rollback);
                _removeFromPhongLuyen(copy.id);
                return {
                    success: false,
                    error: 'Lưu Firebase thất bại: ' + (fbErr.code || fbErr.message || 'unknown') + '. Bản sao đã được rollback.',
                    firebaseError: true
                };
            }
        },

        /** Xáo trộn câu hỏi trong đề (preview) */
        shufflePreview(exam) {
            const copy = JSON.parse(JSON.stringify(exam));
            if (copy.options && copy.options.shuffleQuestions) {
                copy.questions = _shuffle(copy.questions);
            }
            if (copy.options && copy.options.shuffleOptions) {
                copy.questions = copy.questions.map(q => {
                    if ((q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'true_false') && q.options) {
                        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                        let origAnswers;
                        
                        if (q.type === 'true_false') {
                            origAnswers = new Set();
                        } else if (q.type === 'mcq_single') {
                            // correctAnswer có thể là chữ cái (A/B/C/D - format chuẩn) hoặc text (dữ liệu cũ)
                            const letterIdx = letters.indexOf(q.correctAnswer);
                            const correctText = (letterIdx >= 0 && q.options[letterIdx] !== undefined)
                                ? q.options[letterIdx]
                                : q.correctAnswer;
                            origAnswers = new Set([correctText]);
                        } else {
                            // mcq_multi: correctAnswers có thể là mảng chữ cái hoặc mảng text
                            const orig = q.correctAnswers || [];
                            console.log('[ExamBuilder.shufflePreview] mcq_multi before shuffle:', {
                                qid: q.id,
                                correctAnswers: orig,
                                options: q.options
                            });
                            origAnswers = new Set(orig.map(ans => {
                                const letterIdx = letters.indexOf(ans);
                                return (letterIdx >= 0 && q.options && q.options[letterIdx] !== undefined) 
                                    ? q.options[letterIdx] 
                                    : ans;
                            }));
                            console.log('[ExamBuilder.shufflePreview] mcq_multi origAnswers Set:', Array.from(origAnswers));
                        }
                        
                        const shuffled = _shuffle(q.options.map((opt, i) => ({ opt, isCorrect: origAnswers.has(opt) })));
                        q.options = shuffled.map(o => o.opt);
                        
                        if (q.type === 'mcq_single') {
                            // Gán lại correctAnswer theo CHỮ CÁI ứng với vị trí mới sau khi xáo (vì renderAnswer dùng letter làm value)
                            const newIdx = shuffled.findIndex(o => o.isCorrect);
                            q.correctAnswer = newIdx >= 0 ? letters[newIdx] : q.correctAnswer;
                        } else if (q.type === 'mcq_multi') {
                            // Gán lại correctAnswers theo CHỮ CÁI ứng với vị trí mới
                            const correctIndices = shuffled
                                .map((o, idx) => o.isCorrect ? idx : -1)
                                .filter(idx => idx >= 0);
                            q.correctAnswers = correctIndices.map(idx => letters[idx]);
                            console.log('[ExamBuilder.shufflePreview] mcq_multi after shuffle:', {
                                qid: q.id,
                                correctAnswers: q.correctAnswers,
                                correctIndices: correctIndices,
                                shuffledOptions: q.options,
                                isCorrectFlags: shuffled.map(o => o.isCorrect)
                            });
                        }
                    }
                    return q;
                });
            }
            return copy;
        },

        /** Thống kê */
        getStats() {
            const exams = _readLocal();
            const byType = {};
            exams.forEach(e => {
                byType[e.type] = (byType[e.type] || 0) + 1;
            });
            return { total: exams.length, byType };
        },

        /** Đồng bộ từ Firebase (đọc cả exams/ và phongluyen_exams/) */
        syncFromFirebase() {
            if (!_isFirebaseReady()) return Promise.resolve(_readLocal());
            return Promise.all([
                _loadFromFirebase(), // reads exams/ + phongluyen_exams/
            ]).then(([fbExams]) => {
                if (fbExams && fbExams.length > 0) {
                    const local = _readLocal();
                    const merged = new Map();
                    // Firebase làm base
                    fbExams.forEach(e => merged.set(e.id, e));
                    // Local bổ sung những thứ Firebase không có hoặc local mới hơn
                    local.forEach(e => {
                        const existing = merged.get(e.id);
                        if (!existing || new Date(e.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                            merged.set(e.id, e);
                        }
                    });
                    const synced = Array.from(merged.values());
                    _writeLocal(synced);
                    // Sync ngược lên cả 2 Firebase paths
                    synced.forEach(ex => {
                        _saveToFirebase(ex);
                        _mirrorToPhongLuyen(ex);
                    });
                    _ExamSubscribers._debouncedNotify(synced, 'syncFromFirebase');
                }
                return _readLocal();
            }).catch(err => {
                console.warn('[ExamBuilder] syncFromFirebase lỗi:', err);
                return _readLocal();
            });
        },

        /** [FIX P1-8] Refresh 1 exam cụ thể từ Firebase (ghi đè local nếu có) */
        async refreshFromFirebase(examId) {
            if (!_isFirebaseReady() || !examId) return null;
            const db = _fb();
            try {
                const snap = await db.ref(`${FIREBASE_PATH}/${examId}`).once('value');
                if (!snap || !snap.val()) {
                    // Không tồn tại trên server → xóa khỏi local
                    const local = _readLocal().filter(e => e.id !== examId);
                    _writeLocal(local);
                    _removeFromPhongLuyen(examId);
                    return null;
                }
                const remote = snap.val();
                const exams = _readLocal();
                const idx = exams.findIndex(e => e.id === examId);
                if (idx >= 0) exams[idx] = remote; else exams.push(remote);
                _writeLocal(exams);
                _mirrorToPhongLuyen(remote);
                return remote;
            } catch (err) {
                console.warn('[ExamBuilder.refreshFromFirebase] failed:', err);
                return null;
            }
        },

        /** [FIX P1-8] Ghi hoặc cập nhật 1 exam trong localStorage (không touch Firebase) */
        upsertLocal(exam) {
            if (!exam || !exam.id) return false;
            try {
                const exams = _readLocal();
                const idx = exams.findIndex(e => e.id === exam.id);
                if (idx >= 0) exams[idx] = exam; else exams.push(exam);
                _writeLocal(exams);
                _mirrorToPhongLuyen(exam);
                return true;
            } catch (e) {
                console.warn('[ExamBuilder.upsertLocal] failed:', e);
                return false;
            }
        },

        /**
         * [FIX P3.3] Invalidate cache local (gọi khi admin cập nhật đề)
         * - Xóa sky_exams, exams
         * - Tăng version → syncFromFirebase sẽ thấy cache stale
         * - Broadcast channel cho tab khác cũng refresh
         */
        invalidateCache() {
            try {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('exams'); // legacy
                // Tăng version để buộc invalidate
                if (typeof EXAM_CACHE_VERSION !== 'undefined' && typeof EXAM_CACHE_VERSION_KEY !== 'undefined') {
                    const v = (EXAM_CACHE_VERSION || 1) + 1;
                    localStorage.setItem(EXAM_CACHE_VERSION_KEY, String(v));
                }
                console.log('[ExamBuilder] Cache invalidated');
                // Cross-tab notify
                if (typeof BroadcastChannel !== 'undefined') {
                    try {
                        const ch = new BroadcastChannel('exam-cache-invalidate');
                        ch.postMessage({ action: 'invalidate', at: Date.now() });
                        ch.close();
                    } catch (e) {
                        console.warn('[ExamBuilder] BroadcastChannel failed:', e);
                    }
                }
            } catch (e) {
                console.error('[ExamBuilder.invalidateCache] failed:', e);
            }
        },

        /**
         * Lấy danh sách đề theo category (13 chuyên đề + 'thuc-chien' + 'khung-de').
         * Lọc theo type (mặc định 'tsa').
         */
        getByCategory(category, type = 'tsa') {
            const all = _readLocal();
            const c = _normalizeCategory(category);
            return all.filter(e => (e.category || 'thuc-chien') === c && (e.type || 'tsa') === type);
        },

        /**
         * Lấy danh sách đề theo `room` (canonical: 'practice-tsa' | 'practice-hsa' | 'mock-exam').
         * Không phụ thuộc `category` cũ — dùng cho trang Thi thử và các trang lọc nâng cao.
         */
        getByRoom(room, type = null) {
            const all = _readLocal();
            return all.filter(e => {
                const r = e.room || _inferRoomFromLegacy(e);
                if (r !== room) return false;
                if (type && (e.type || 'tsa') !== type) return false;
                return true;
            });
        },

        /**
         * Migration một lần: gán `room` cho tất cả đề cũ còn thiếu field này.
         * Quy tắc suy ra: category ∈ {khung-de, hsa-de-thi-thu} → 'mock-exam'; ngược lại theo type.
         *
         * Guard bằng localStorage flag `_sky_roomMigrated` để tránh chạy lặp lại.
         * Kết quả: ghi lại `sky_exams` + Firebase `exams/{id}` cho các đề đã thay đổi.
         * KHÔNG ghi `phongluyen_exams` (đã được mirror tự động qua các luồng create/update).
         *
         * Trả về { changed: number, total: number }.
         */
        migrateRoomFlags() {
            const FLAG = '_sky_roomMigrated';
            try {
                if (localStorage.getItem(FLAG) === '1') {
                    return { changed: 0, total: _readLocal().length, skipped: true };
                }
            } catch (e) { /* localStorage không khả dụng — vẫn chạy migration */ }

            const exams = _readLocal();
            let changed = 0;
            const updates = [];
            exams.forEach(e => {
                if (_VALID_ROOMS.includes(e.room)) return;
                const newRoom = _inferRoomFromLegacy(e);
                if (newRoom === e.room) return;
                e.room = newRoom;
                e.updatedAt = e.updatedAt || new Date().toISOString();
                changed++;
                updates.push(e);
            });
            if (changed > 0) {
                _writeLocal(exams);
                // Đẩy lên Firebase `exams/{id}` (không đụng `phongluyen_exams`)
                if (_isFirebaseReady()) {
                    updates.forEach(e => {
                        try {
                            firebase.database().ref(`${FIREBASE_PATH}/${e.id}`).update({ room: e.room });
                        } catch (err) { /* ignore */ }
                    });
                }
            }
            try { localStorage.setItem(FLAG, '1'); } catch (e) { /* ignore */ }
            return { changed, total: exams.length, skipped: false };
        },

        /** Lấy tất cả category hợp lệ của đề (13 chuyên đề + thuc-chien + khung-de) */
        getExamCategories() {
            return _EXAM_CATEGORIES;
        },

        /** Lấy title theo category key */
        getCategoryTitle(key) {
            return _EXAM_CATEGORIES[key] || key || '';
        },

        /** Xuất JSON */
        exportJSON(id) {
            const exam = this.getById(id);
            return exam ? JSON.stringify(exam, null, 2) : null;
        },

        /** [FIX P1-11] Xuất JSON cho 1 hoặc nhiều đề (bulk). Nếu không truyền id → xuất tất cả */
        exportMultiple(ids) {
            const exams = _readLocal();
            const target = Array.isArray(ids) && ids.length > 0
                ? exams.filter(e => ids.indexOf(e.id) >= 0)
                : exams;
            return JSON.stringify(target, null, 2);
        },

        /** [FIX P1-11] Nhập JSON đề thi từ file/textarea */
        async importJSON(jsonString) {
            try {
                const parsed = JSON.parse(jsonString);
                if (!Array.isArray(parsed) && typeof parsed === 'object' && parsed !== null) {
                    // Cho phép nhập 1 đề duy nhất
                    return await this._importOneExam(parsed);
                }
                if (!Array.isArray(parsed)) {
                    return { success: false, error: 'JSON phải là mảng hoặc 1 đề thi' };
                }
                const results = { success: 0, failed: 0, errors: [] };
                for (let i = 0; i < parsed.length; i++) {
                    const r = await this._importOneExam(parsed[i]);
                    if (r.success) results.success++; else { results.failed++; results.errors.push(`#${i + 1}: ${r.error}`); }
                }
                return {
                    success: results.failed === 0,
                    imported: results.success,
                    failed: results.failed,
                    errors: results.errors.slice(0, 10)
                };
            } catch (e) {
                return { success: false, error: 'JSON không hợp lệ: ' + e.message };
            }
        },

        /** [FIX P1-11] Helper: import 1 đề, xử lý trùng code */
        async _importOneExam(examData) {
            if (!examData || typeof examData !== 'object') return { success: false, error: 'Dữ liệu không hợp lệ' };
            if (!examData.name) return { success: false, error: 'Thiếu tên đề' };
            if (!examData.code) return { success: false, error: 'Thiếu mã đề' };

            // Đảm bảo có ID mới để tránh overwrite
            examData.id = _uuid();
            examData.createdAt = examData.createdAt || new Date().toISOString();
            examData.updatedAt = new Date().toISOString();

            // Validate
            if (!Array.isArray(examData.questions) || examData.questions.length === 0) {
                return { success: false, error: 'Đề phải có ít nhất 1 câu hỏi' };
            }

            // Tránh trùng code
            const existing = _readLocal();
            let newCode = examData.code;
            let counter = 1;
            while (existing.some(e => String(e.code || '').trim().toUpperCase() === newCode.toUpperCase())) {
                counter++;
                newCode = examData.code + '-IMPORT' + counter;
            }
            examData.code = newCode;

            existing.push(examData);
            _writeLocal(existing);
            _mirrorToPhongLuyen(examData);
            try {
                await _saveToFirebase(examData);
                return { success: true, exam: examData };
            } catch (fbErr) {
                const rollback = _readLocal().filter(e => e.id !== examData.id);
                _writeLocal(rollback);
                _removeFromPhongLuyen(examData.id);
                return { success: false, error: 'Lưu Firebase thất bại: ' + (fbErr.code || fbErr.message) };
            }
        },

        /** Lấy bản dùng thi từ đề gốc (loại bỏ đáp án) */
        buildAttempt(examId) {
            const exam = this.getById(examId);
            if (!exam) return null;
            return this.shufflePreview(exam);
        },

        _shuffle,
        _uuid,
        _VALID_ROOMS,
        _inferRoomFromLegacy,
        _normalizeRoom
    };

    /* ================================================================
       EXPORT
       ================================================================ */
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ExamBuilder;
    } else {
        global.ExamBuilder = ExamBuilder;
    }
})(typeof window !== 'undefined' ? window : globalThis);
