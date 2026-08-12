/**
 * DATA VALIDATOR — SKY EDU
 * Validate dữ liệu trước khi lưu lên Firebase
 * + Sanitize HTML để tránh XSS khi render innerHTML
 */
const DataValidator = {

    /**
     * Validate user data
     * @returns {string[]} danh sách lỗi (rỗng = OK)
     */
    user(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
            errors.push('Dữ liệu user không hợp lệ');
            return errors;
        }
        if (!data.fullname || String(data.fullname).trim().length < 2) {
            errors.push('Họ tên phải có ít nhất 2 ký tự');
        }
        if (!data.username || !/^[a-z0-9_]{6,}$/.test(String(data.username))) {
            errors.push('Username không hợp lệ (chỉ a-z, 0-9, _ và tối thiểu 6 ký tự)');
        }
        if (!data.uid) errors.push('UID bắt buộc');
        return errors;
    },

    /**
     * Validate exam result
     */
    examResult(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
            errors.push('Dữ liệu kết quả không hợp lệ');
            return errors;
        }
        if (!data.examId) errors.push('examId bắt buộc');
        if (typeof data.score !== 'number' || data.score < 0 || data.score > 100) {
            errors.push('Score không hợp lệ (0-100)');
        }
        if (!data.userId) errors.push('userId bắt buộc');
        if (!data.submittedAt) data.submittedAt = Date.now();
        return errors;
    },

    /**
     * Validate question
     */
    question(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
            errors.push('Dữ liệu câu hỏi không hợp lệ');
            return errors;
        }
        if (!data.type) errors.push('Loại câu hỏi bắt buộc');
        if (!data.content || String(data.content).trim().length < 5) {
            errors.push('Nội dung câu hỏi quá ngắn (tối thiểu 5 ký tự)');
        }
        if (!data.points || data.points <= 0) data.points = 1;
        if (!data.createdAt) data.createdAt = Date.now();
        return errors;
    },

    /**
     * Validate course
     */
    course(data) {
        const errors = [];
        if (!data || typeof data !== 'object') {
            errors.push('Dữ liệu khóa học không hợp lệ');
            return errors;
        }
        if (!data.title || String(data.title).trim().length < 3) {
            errors.push('Tên khóa học phải có ít nhất 3 ký tự');
        }
        if (!data.createdAt) data.createdAt = Date.now();
        return errors;
    },

    /**
     * Sanitize HTML để tránh XSS khi gán vào innerHTML
     * @param {*} str
     * @returns {string}
     */
    sanitizeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * Sanitize HTML nhưng cho phép một số tag an toàn (img, br, b, i, u, code, ...)
     */
    sanitizeHtmlSafe(str) {
        if (str === null || str === undefined) return '';
        let s = String(str);
        // Encode < > đầu tiên
        s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Cho phép 1 số tag: img, br, b, strong, i, em, u, code, pre, span, div, p
        const allowed = ['img', 'br', 'b', 'strong', 'i', 'em', 'u', 'code', 'pre', 'span', 'div', 'p'];
        const tagRe = new RegExp(`&lt;(\/?)(${allowed.join('|')})(\\s+[^&]*?&gt;|\/?&gt;)`, 'gi');
        s = s.replace(tagRe, '<$1$2$3');
        return s;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataValidator;
} else {
    window.DataValidator = DataValidator;
}
