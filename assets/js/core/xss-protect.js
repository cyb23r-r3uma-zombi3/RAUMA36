/**
 * XSS PROTECTION - Centralized sanitization & safe DOM helpers
 *
 * Các hàm escapeHtml, sanitizeHtml, setTextSafe, setHTMLSafe dùng chung
 * cho toàn bộ app để tránh XSS khi render dữ liệu từ user/Firebase.
 */

(function (global) {
    'use strict';

    const XSSProtect = {
        /**
         * Escape HTML special characters
         * @param {*} text
         * @returns {string} HTML-safe string
         */
        escapeHtml: function (text) {
            if (text == null) return '';
            if (typeof text !== 'string') {
                try { text = String(text); } catch (e) { return ''; }
            }
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/\//g, '&#x2F;');
        },

        /**
         * Strip tất cả HTML tags - chỉ giữ text
         */
        stripHtml: function (html) {
            if (html == null) return '';
            if (typeof html !== 'string') {
                try { html = String(html); } catch (e) { return ''; }
            }
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || '';
        },

        /**
         * Sanitize HTML - chỉ cho phép một số tag an toàn
         * (sử dụng khi KHÔNG THỂ dùng escapeHtml - cần render ảnh inline)
         */
        sanitizeHtml: function (html, options) {
            if (html == null) return '';
            if (typeof html !== 'string') return '';
            options = options || {};
            const allowedTags = options.allowedTags || ['b', 'i', 'em', 'strong', 'br', 'span', 'p', 'img', 'a', 'div', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'sub', 'sup', 'code', 'pre'];
            const allowedAttrs = options.allowedAttrs || ['src', 'alt', 'title', 'class', 'style', 'href', 'target', 'rel'];

            try {
                const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
                const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null, false);
                const toRemove = [];
                const node = walker.currentNode;
                while (node) {
                    if (!allowedTags.includes(node.tagName.toLowerCase())) {
                        toRemove.push(node);
                    } else {
                        // strip attrs không cho phép
                        const attrs = Array.from(node.attributes || []);
                        attrs.forEach(function (a) {
                            if (!allowedAttrs.includes(a.name.toLowerCase())) {
                                node.removeAttribute(a.name);
                            }
                        });
                        // strip javascript: protocol
                        if (node.tagName === 'A' || node.tagName === 'IMG') {
                            const href = node.getAttribute('href') || '';
                            const src = node.getAttribute('src') || '';
                            if (/^\s*javascript:/i.test(href) || /^\s*javascript:/i.test(src)) {
                                toRemove.push(node);
                            }
                        }
                        // strip on* event handlers
                        Array.from(node.attributes || []).forEach(function (a) {
                            if (a.name.toLowerCase().startsWith('on')) {
                                node.removeAttribute(a.name);
                            }
                        });
                    }
                    node = walker.nextNode();
                }
                toRemove.forEach(function (n) {
                    if (n.parentNode) n.parentNode.removeChild(n);
                });
                return doc.body.firstChild ? doc.body.firstChild.innerHTML : '';
            } catch (e) {
                console.error('[XSSProtect] sanitizeHtml fallback to escape:', e);
                return this.escapeHtml(html);
            }
        },

        /**
         * Set text an toàn - dùng textContent, không innerHTML
         */
        setTextSafe: function (container, text) {
            if (!container) return;
            if (Array.isArray(container) || container instanceof NodeList) {
                container.forEach(function (c) { XSSProtect.setTextSafe(c, text); });
                return;
            }
            try { container.textContent = (text == null ? '' : String(text)); }
            catch (e) { console.error('[XSSProtect] setTextSafe failed:', e); }
        },

        /**
         * Set HTML an toàn - sanitize trước khi set
         * @param {Element|Element[]|NodeList} container
         * @param {string} html
         * @param {Object} options - { sanitize: bool, allowedTags, allowedAttrs }
         */
        setHTMLSafe: function (container, html, options) {
            if (!container) return;
            if (Array.isArray(container) || container instanceof NodeList) {
                container.forEach(function (c) { XSSProtect.setHTMLSafe(c, html, options); });
                return;
            }
            options = options || {};
            const safe = options.sanitize === false
                ? String(html == null ? '' : html)
                : this.sanitizeHtml(html, options);
            try { container.innerHTML = safe; }
            catch (e) { console.error('[XSSProtect] setHTMLSafe failed:', e); }
        }
    };

    if (typeof global !== 'undefined') {
        global.XSSProtect = XSSProtect;
        // Backward compat
        global.escapeHtml = XSSProtect.escapeHtml.bind(XSSProtect);
    }

})(typeof window !== 'undefined' ? window : globalThis);
