/* ================================================================
   TSA TOPICS - Nguồn dữ liệu dùng chung cho 13 chuyên đề TSA
   Tác giả: SKY EDU Team
   Phiên bản: 1.0.0
   Mô tả: Danh sách 13 chuyên đề Toán TSA + mục "Đề thực chiến" +
           "Đề thi thử". Đây là SINGLE SOURCE OF TRUTH — cả admin lẫn
           phòng luyện TSA đều đọc từ file này.
   ================================================================ */

(function (global) {
    'use strict';

    /**
     * 13 chuyên đề Toán TSA — đúng thứ tự người dùng yêu cầu.
     * Mỗi key là slug dùng làm `category` của exam / `chuyenDe` của question.
     */
    const TSA_TOPICS = [
        { key: 'bat-pt',        num: 1,  title: 'Bất phương trình và quy hoạch tuyến tính',                 icon: 'lucide:sigma' },
        { key: 'thong-ke',      num: 2,  title: 'Thống kê',                                                  icon: 'lucide:bar-chart-3' },
        { key: 'so-hoc',        num: 3,  title: 'Số học',                                                    icon: 'lucide:hash' },
        { key: 'hh-phang',      num: 4,  title: 'Hình học phẳng và 3 đường conic',                            icon: 'lucide:triangle' },
        { key: 'gioi-han',      num: 5,  title: 'Giới hạn và tính liên tục của hàm số',                        icon: 'lucide:trending-down' },
        { key: 'cap-so',        num: 6,  title: 'Cấp số, dãy số và hệ thức truy hồi',                         icon: 'lucide:layers' },
        { key: 'logarit',       num: 7,  title: 'Hàm số logarit, hàm lũy thừa và hàm số mũ',                  icon: 'lucide:superscript' },
        { key: 'luong-giac',    num: 8,  title: 'Phương trình lượng giác',                                    icon: 'lucide:circle-dot' },
        { key: 'to-hop',        num: 9,  title: 'Tổ hợp – Xác suất cổ điển – Xác suất có điều kiện',          icon: 'lucide:dices' },
        { key: 'ham-so',        num: 10, title: 'Hàm số, đồ thị hàm số và đạo hàm',                            icon: 'lucide:function-square' },
        { key: 'nguyen-ham',    num: 11, title: 'Nguyên hàm & Tích phân',                                     icon: 'lucide:integral' },
        { key: 'vector',        num: 12, title: 'Vector & Hình học không gian có tọa độ',                      icon: 'lucide:axis-3d' },
        { key: 'hh-khong-gian', num: 13, title: 'Hình học không gian thuần túy',                              icon: 'lucide:box' }
    ];

    /** Tra cứu nhanh theo key */
    const TOPICS_BY_KEY = TSA_TOPICS.reduce((m, t) => { m[t.key] = t; return m; }, {});

    /** 4 mục "đặc biệt" ngoài 13 chuyên đề — không phải chuyên đề Toán */
    const EXTRA_CATEGORIES = [
        { key: 'thuc-chien', title: 'Đề thực chiến',           icon: 'lucide:flame',    badge: '🔥', desc: 'Đề thi tổng hợp mô phỏng kì thi thật' },
        { key: 'khung-de',   title: 'Đề thi thử',              icon: 'lucide:layout-template', badge: '🧩', desc: 'Bộ khung đề tái sử dụng để sinh đề nhanh' }
    ];

    /** Map đầy đủ category → title (để hiển thị trong dropdown, badge, ...) */
    const ALL_CATEGORIES = {};
    TSA_TOPICS.forEach(t => { ALL_CATEGORIES[t.key] = t.title; });
    EXTRA_CATEGORIES.forEach(c => { ALL_CATEGORIES[c.key] = c.title; });

    /** Map đầy đủ category → {title, num, type:'topic'|'extra'} */
    const ALL_CATEGORIES_META = {};
    TSA_TOPICS.forEach(t => { ALL_CATEGORIES_META[t.key] = { ...t, type: 'topic' }; });
    EXTRA_CATEGORIES.forEach(c => { ALL_CATEGORIES_META[c.key] = { ...c, type: 'extra' }; });

    /**
     * 4 mức độ chuẩn của kho câu hỏi.
     * `key` là giá trị lưu vào question.difficulty.
     */
    const DIFFICULTY_LEVELS = [
        { key: 'Nhan biet',    short: 'NB',  label: 'Nhận biết',    color: '#10B981' },
        { key: 'Thong hieu',   short: 'TH',  label: 'Thông hiểu',   color: '#3B82F6' },
        { key: 'Van dung',     short: 'VD',  label: 'Vận dụng',     color: '#F59E0B' },
        { key: 'Van dung cao', short: 'VDC', label: 'Vận dụng cao', color: '#EF4444' }
    ];
    const DIFFICULTY_BY_KEY = DIFFICULTY_LEVELS.reduce((m, d) => { m[d.key] = d; return m; }, {});

    /**
     * Các key category cũ (legacy 'basic' | 'advanced' | 'full') — dùng để
     * tương thích ngược khi đọc đề thi đã tạo trước khi refactor.
     */
    const LEGACY_CATEGORIES = ['basic', 'advanced', 'full'];

    /** API công khai */
    const TsaTopics = {
        TSA_TOPICS,
        TOPICS_BY_KEY,
        EXTRA_CATEGORIES,
        ALL_CATEGORIES,
        ALL_CATEGORIES_META,
        DIFFICULTY_LEVELS,
        DIFFICULTY_BY_KEY,
        LEGACY_CATEGORIES,

        /** Lấy title theo key. Trả về key gốc nếu không tìm thấy. */
        getTitle(key) {
            return (ALL_CATEGORIES_META[key] && ALL_CATEGORIES_META[key].title) || key || '';
        },

        /** Lấy object meta theo key */
        getMeta(key) {
            return ALL_CATEGORIES_META[key] || null;
        },

        /** Danh sách option HTML cho <select> — gồm 13 chuyên đề + 2 mục đặc biệt */
        buildCategoryOptions(opts = {}) {
            const { includeTopic = true, includeExtra = true, prefix = '' } = opts;
            const parts = [];
            if (includeTopic) {
                if (prefix) parts.push(`<optgroup label="${prefix} chuyên đề">`);
                TSA_TOPICS.forEach(t => {
                    parts.push(`<option value="${t.key}">${t.num}. ${escape(t.title)}</option>`);
                });
                if (prefix) parts.push('</optgroup>');
            }
            if (includeExtra) {
                if (prefix) parts.push(`<optgroup label="${prefix} đặc biệt">`);
                EXTRA_CATEGORIES.forEach(c => {
                    parts.push(`<option value="${c.key}">${escape(c.title)}</option>`);
                });
                if (prefix) parts.push('</optgroup>');
            }
            return parts.join('');
        },

        /** Danh sách option HTML cho mức độ */
        buildDifficultyOptions(opts = {}) {
            const { includeEmpty = true, emptyLabel = '-- Chọn mức độ --' } = opts;
            const parts = [];
            if (includeEmpty) parts.push(`<option value="">${escape(emptyLabel)}</option>`);
            DIFFICULTY_LEVELS.forEach(d => {
                parts.push(`<option value="${d.key}">${escape(d.label)}</option>`);
            });
            return parts.join('');
        },

        /** Danh sách option cho category cũ (basic/advanced/full) — để tương thích ngược */
        buildLegacyCategoryOptions() {
            return [
                { value: 'basic',    label: 'Cơ bản (Luyện tập từng dạng)' },
                { value: 'advanced', label: 'Nâng cao (Luyện tập định lượng)' },
                { value: 'full',     label: 'Đề thi đầy đủ (Thực chiến) — legacy' }
            ];
        }
    };

    function escape(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TsaTopics;
    } else {
        global.TsaTopics = TsaTopics;
        global.TSA_TOPICS = TSA_TOPICS;
        global.DIFFICULTY_LEVELS = DIFFICULTY_LEVELS;
    }
})(typeof window !== 'undefined' ? window : globalThis);