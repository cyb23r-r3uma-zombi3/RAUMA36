/**
 * FORM VALIDATOR - Centralized form input validation
 */

(function (global) {
    'use strict';

    const FormValidator = {
        /**
         * Validate exam code (alphanumeric + dash/underscore, max 50)
         */
        validateCode(code) {
            if (code == null || code === '') return { valid: false, error: 'Mã đề không được trống' };
            const s = String(code).trim();
            if (s.length > 50) return { valid: false, error: 'Mã đề tối đa 50 ký tự' };
            if (!/^[A-Z0-9_\-]+$/i.test(s)) {
                return { valid: false, error: 'Mã đề chỉ chứa chữ cái, số, _, -' };
            }
            return { valid: true, value: s };
        },

        /**
         * Validate name
         */
        validateName(name, opts) {
            opts = opts || {};
            const min = opts.min || 1;
            const max = opts.max || 200;
            if (name == null || String(name).trim().length < min) {
                return { valid: false, error: `Tên phải có ít nhất ${min} ký tự` };
            }
            if (String(name).trim().length > max) {
                return { valid: false, error: `Tên tối đa ${max} ký tự` };
            }
            return { valid: true, value: String(name).trim() };
        },

        /**
         * Validate points (0-999999, integer)
         */
        validatePoints(p) {
            const n = Number(p);
            if (!isFinite(n) || n < 0) return { valid: false, error: 'Điểm phải >= 0' };
            if (n > 999999) return { valid: false, error: 'Điểm tối đa 999,999' };
            if (!Number.isInteger(n)) return { valid: false, error: 'Điểm phải là số nguyên' };
            return { valid: true, value: n };
        },

        /**
         * Validate time (1-600 phút)
         */
        validateTimeMinutes(t) {
            const n = Number(t);
            if (!isFinite(n) || n < 1) return { valid: false, error: 'Thời gian phải >= 1 phút' };
            if (n > 600) return { valid: false, error: 'Thời gian tối đa 600 phút' };
            return { valid: true, value: Math.floor(n) };
        },

        /**
         * Validate URL (YouTube hoặc link bất kỳ)
         */
        validateUrl(url, opts) {
            opts = opts || {};
            if (!url) return opts.required ? { valid: false, error: 'URL không được trống' } : { valid: true, value: '' };
            try {
                const u = new URL(String(url));
                if (opts.youtubeOnly) {
                    const host = u.hostname.toLowerCase();
                    if (!/youtube\.com|youtu\.be/.test(host)) {
                        return { valid: false, error: 'Chỉ chấp nhận link YouTube' };
                    }
                }
                return { valid: true, value: u.toString() };
            } catch (e) {
                return { valid: false, error: 'URL không hợp lệ' };
            }
        },

        /**
         * Validate email
         */
        validateEmail(email) {
            if (!email) return { valid: false, error: 'Email không được trống' };
            const s = String(email).trim();
            if (s.length > 255) return { valid: false, error: 'Email quá dài' };
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
                return { valid: false, error: 'Email không đúng định dạng' };
            }
            return { valid: true, value: s.toLowerCase() };
        },

        /**
         * Validate nhiều field, trả về { valid, errors, values }
         */
        validateAll(validators) {
            const errors = [];
            const values = {};
            for (const key in validators) {
                const v = validators[key];
                if (typeof v === 'function') {
                    const r = v();
                    if (r && !r.valid) errors.push(r.error);
                    else if (r && r.value !== undefined) values[key] = r.value;
                }
            }
            return {
                valid: errors.length === 0,
                errors,
                values
            };
        }
    };

    if (typeof global !== 'undefined') {
        global.FormValidator = FormValidator;
    }

})(typeof window !== 'undefined' ? window : globalThis);
