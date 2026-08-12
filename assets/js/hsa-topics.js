/* ================================================================
   HSA TOPICS - Nguồn dữ liệu dùng chung cho các chuyên đề HSA
   Tác giả: SKY EDU Team
   Phiên bản: 1.0.0
   Mô tả: Danh sách 5 chuyên đề Toán HSA (Phần thi Định lượng) +
           2 mục đặc biệt: "Đề thực chiến" và "Đề thi thử".
           SINGLE SOURCE OF TRUTH — admin panel và phòng luyện HSA
           đều đọc từ file này.
   ================================================================ */

(function (global) {
    'use strict';

    /**
     * 5 chuyên đề Toán HSA — Phần thi Định lượng.
     * Mỗi key là slug dùng làm `category` của exam / `chuyenDe` của question.
     */
    const HSA_TOPICS = [
        { key: 'toan-dai-so',     num: 1, title: 'Toán Đại số',                    icon: 'lucide:function-square' },
        { key: 'toan-giai-tich',  num: 2, title: 'Toán Giải tích',                 icon: 'lucide:trending-up' },
        { key: 'toan-hinh-hoc',   num: 3, title: 'Toán Hình học',                  icon: 'lucide:shapes' },
        { key: 'toan-xac-suat',   num: 4, title: 'Xác suất & Thống kê',            icon: 'lucide:dices' },
        { key: 'toan-so-hoc',     num: 5, title: 'Số học & Tổ hợp',                icon: 'lucide:hash' }
    ];

    /** Tra cứu nhanh theo key */
    const TOPICS_BY_KEY = HSA_TOPICS.reduce((m, t) => { m[t.key] = t; return m; }, {});

    /** 2 mục "đặc biệt" ngoài 5 chuyên đề — không phải chuyên đề Toán */
    const EXTRA_CATEGORIES = [
        { key: 'hsa-thuc-chien',   title: 'Đề thực chiến',  icon: 'lucide:flame',           badge: '🔥', desc: 'Đề thi tổng hợp mô phỏng kì thi HSA thật' },
        { key: 'hsa-de-thi-thu',   title: 'Đề thi thử',    icon: 'lucide:file-check-2',    badge: '📝', desc: 'Đề thi thử theo cấu trúc HSA chính thức' }
    ];

    /** Map đầy đủ category → title (để hiển thị trong dropdown, badge, ...) */
    const ALL_CATEGORIES = {};
    HSA_TOPICS.forEach(t => { ALL_CATEGORIES[t.key] = t.title; });
    EXTRA_CATEGORIES.forEach(c => { ALL_CATEGORIES[c.key] = c.title; });

    /** Map đầy đủ category → {title, num, type:'topic'|'extra'} */
    const ALL_CATEGORIES_META = {};
    HSA_TOPICS.forEach(t => { ALL_CATEGORIES_META[t.key] = { ...t, type: 'topic' }; });
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

    /** API công khai */
    const HsaTopics = {
        HSA_TOPICS,
        TOPICS_BY_KEY,
        EXTRA_CATEGORIES,
        ALL_CATEGORIES,
        ALL_CATEGORIES_META,
        DIFFICULTY_LEVELS,
        DIFFICULTY_BY_KEY,

        /** Lấy title theo key. Trả về key gốc nếu không tìm thấy. */
        getTitle(key) {
            return (ALL_CATEGORIES_META[key] && ALL_CATEGORIES_META[key].title) || key || '';
        },

        /** Lấy object meta theo key */
        getMeta(key) {
            return ALL_CATEGORIES_META[key] || null;
        },

        /** Danh sách option HTML cho <select> — gồm 5 chuyên đề + 2 mục đặc biệt */
        buildCategoryOptions(opts = {}) {
            const { includeTopic = true, includeExtra = true, prefix = '' } = opts;
            const parts = [];
            if (includeTopic) {
                if (prefix) parts.push(`<optgroup label="${prefix} chuyên đề">`);
                HSA_TOPICS.forEach(t => {
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
        }
    };

    function escape(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = HsaTopics;
    } else {
        global.HsaTopics = HsaTopics;
        global.HSA_TOPICS = HSA_TOPICS;
        global.HSA_EXTRA_CATEGORIES = EXTRA_CATEGORIES;
    }
})(typeof window !== 'undefined' ? window : globalThis);