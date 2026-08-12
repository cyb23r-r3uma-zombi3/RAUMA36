/**
 * EXAM VALIDATION - Centralized validation cho exam questions
 *
 * Dùng trước khi tạo/sửa đề để phát hiện trùng câu, thiếu field.
 */

(function (global) {
    'use strict';

    const ExamValidator = {
        /**
         * Validate 1 câu hỏi có cấu trúc hợp lệ
         * @param {Object} q
         * @returns {{valid: boolean, error?: string}}
         */
        validateQuestion: function (q) {
            if (!q || typeof q !== 'object') return { valid: false, error: 'Câu hỏi không hợp lệ' };
            if (!q.id || typeof q.id !== 'string') return { valid: false, error: 'Câu hỏi thiếu id' };
            if (!q.type) return { valid: false, error: 'Câu hỏi thiếu loại' };
            // type-specific checks
            if ((q.type === 'mcq_single' || q.type === 'mcq_multi') && (!Array.isArray(q.options) || q.options.length < 2)) {
                return { valid: false, error: 'Câu trắc nghiệm phải có ít nhất 2 lựa chọn' };
            }
            return { valid: true };
        },

        /**
         * Validate toàn bộ exam questions
         * @param {Object} exam
         * @returns {{valid: boolean, error?: string, duplicates?: Array, missing?: Array}}
         */
        validateExam: function (exam) {
            if (!exam || typeof exam !== 'object') return { valid: false, error: 'Exam không hợp lệ' };
            const questions = exam.questions;
            if (!Array.isArray(questions) || questions.length === 0) {
                return { valid: false, error: 'Đề phải có ít nhất 1 câu hỏi' };
            }

            // Check từng câu
            for (let i = 0; i < questions.length; i++) {
                const r = this.validateQuestion(questions[i]);
                if (!r.valid) return { valid: false, error: `Câu ${i + 1}: ${r.error}` };
            }

            // Check trùng ID
            const ids = new Map();
            const duplicates = [];
            for (let i = 0; i < questions.length; i++) {
                const id = questions[i].id;
                if (ids.has(id)) {
                    duplicates.push({ id, positions: [ids.get(id) + 1, i + 1] });
                } else {
                    ids.set(id, i);
                }
            }
            if (duplicates.length > 0) {
                return {
                    valid: false,
                    error: `Phát hiện ${duplicates.length} câu trùng ID. Vui lòng kiểm tra lại.`,
                    duplicates
                };
            }

            return { valid: true, count: questions.length };
        },

        /**
         * Kiểm tra integrity giữa exam.questions và QuestionBank
         * - Báo missing: câu có id không tồn tại trong bank
         * - Báo orphan: câu trong bank không dùng trong exam nào
         * @param {Object} exam
         * @param {Array} bank - danh sách câu hỏi từ QuestionBank
         * @returns {{missing: Array, orphans: Array, ok: boolean}}
         */
        checkIntegrity: function (exam, bank) {
            const bankIds = new Set((bank || []).map(q => q.id));
            const examIds = new Set((exam.questions || []).map(q => q.id));
            const missing = (exam.questions || []).filter(q => !bankIds.has(q.id));
            const orphans = (bank || []).filter(q => !examIds.has(q.id));
            return {
                missing,
                orphans,
                ok: missing.length === 0
            };
        }
    };

    if (typeof global !== 'undefined') {
        global.ExamValidator = ExamValidator;
    }

})(typeof window !== 'undefined' ? window : globalThis);
